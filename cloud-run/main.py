from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import asyncio, uuid, base64, shutil, os, re, time, json, urllib.request, urllib.error
from pathlib import Path
from collections import defaultdict

DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
ALLOWED_EMAILS = os.environ.get("ALLOWED_EMAILS", "mmann1123@gmail.com").split(",")

# Rate limiting: max compiles per user per window
RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_MAX", "10"))
RATE_LIMIT_WINDOW = int(os.environ.get("RATE_LIMIT_WINDOW", "60"))  # seconds
rate_limit_store: dict[str, list[float]] = defaultdict(list)

# Per-process timeout for pdflatex/bibtex (seconds)
COMPILE_TIMEOUT = int(os.environ.get("COMPILE_TIMEOUT", "30"))

# Gemini API key (server-side only)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

if not DEV_MODE:
    import firebase_admin
    from firebase_admin import auth, credentials, firestore as admin_firestore
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)
    _firestore_client = admin_firestore.client()

app = FastAPI()

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=not DEV_MODE)

SAFE_FILENAME = re.compile(r'^[a-zA-Z0-9_\- ][a-zA-Z0-9_\- ./()]*\.[a-zA-Z0-9]+$')

def validate_filename(name: str) -> bool:
    """Reject path traversal, absolute paths, and suspicious filenames."""
    if not name or not SAFE_FILENAME.match(name):
        return False
    if '..' in name or name.startswith('/'):
        return False
    return True

class FileItem(BaseModel):
    name: str
    content: str
    encoding: str = "text"  # "text" or "base64"

class CompileRequest(BaseModel):
    mainFile: str
    files: list[FileItem]

def _is_email_allowed(email: str) -> bool:
    """Check static env var list, then Firestore allowlist."""
    if email in ALLOWED_EMAILS:
        return True
    try:
        snap = _firestore_client.document("config/allowedEmails").get()
        if snap.exists:
            return email in (snap.to_dict().get("emails") or [])
    except Exception:
        pass
    return False

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if DEV_MODE:
        return {"uid": "dev-user", "email": "dev@localhost"}
    try:
        decoded = auth.verify_id_token(credentials.credentials)
        email = decoded.get("email", "")
        if not _is_email_allowed(email):
            raise HTTPException(status_code=403, detail="Access denied")
        return decoded
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def parse_latex_log(log_text: str) -> list[dict]:
    """Extract structured errors, warnings, and typesetting issues from pdflatex log."""
    entries = []
    lines = log_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]

        # Errors: "! Error message"
        if line.startswith('! '):
            message = line[2:].strip()
            line_num = None
            context_parts = []
            for j in range(i + 1, min(i + 10, len(lines))):
                m = re.match(r'^l\.(\d+)\s*(.*)', lines[j])
                if m:
                    line_num = int(m.group(1))
                    if m.group(2).strip():
                        context_parts.append(m.group(2).strip())
                    break
                if lines[j].strip():
                    context_parts.append(lines[j].strip())
            entries.append({
                "level": "error",
                "message": message,
                "line": line_num,
                "context": '\n'.join(context_parts),
            })

        # LaTeX / Package / Class warnings
        elif re.search(r'(?:LaTeX|Package|Class)\s+.*Warning:', line):
            # Collect multiline warnings (continuation lines start with whitespace)
            full_msg = line.strip()
            j = i + 1
            while j < len(lines) and lines[j].startswith('               '):
                full_msg += ' ' + lines[j].strip()
                j += 1
            m_line = re.search(r'(?:line|input line)\s+(\d+)', full_msg)
            entries.append({
                "level": "warning",
                "message": full_msg,
                "line": int(m_line.group(1)) if m_line else None,
                "context": "",
            })

        # Overfull/Underfull hbox/vbox
        elif re.match(r'^(Over|Under)full \\[hv]box', line):
            m_line = re.search(r'at lines?\s+(\d+)', line)
            entries.append({
                "level": "typesetting",
                "message": line.strip(),
                "line": int(m_line.group(1)) if m_line else None,
                "context": "",
            })

        i += 1
    return entries

def check_rate_limit(uid: str):
    now = time.time()
    # Remove expired entries
    rate_limit_store[uid] = [t for t in rate_limit_store[uid] if now - t < RATE_LIMIT_WINDOW]
    if len(rate_limit_store[uid]) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Max {RATE_LIMIT_MAX} compiles per {RATE_LIMIT_WINDOW}s.")
    rate_limit_store[uid].append(now)

@app.post("/compile")
async def compile_latex(req: CompileRequest, user=Depends(verify_token)):
    check_rate_limit(user.get("uid", "anonymous"))
    job_id = str(uuid.uuid4())
    job_dir = Path(f"/tmp/job-{job_id}")
    job_dir.mkdir(parents=True)
    try:
        # Validate all filenames and mainFile before writing anything
        if not validate_filename(req.mainFile):
            raise HTTPException(status_code=400, detail=f"Invalid main file name: {req.mainFile}")
        # Pre-validate derived output paths from mainFile
        safe_stem = Path(req.mainFile).stem
        for derived in [safe_stem + ".pdf", safe_stem + ".log"]:
            derived_path = (job_dir / derived).resolve()
            if not str(derived_path).startswith(str(job_dir.resolve())):
                raise HTTPException(status_code=400, detail=f"Invalid main file name: {req.mainFile}")
        for f in req.files:
            if not validate_filename(f.name):
                raise HTTPException(status_code=400, detail=f"Invalid file name: {f.name}")
            file_path = (job_dir / f.name).resolve()
            if not str(file_path).startswith(str(job_dir.resolve())):
                raise HTTPException(status_code=400, detail=f"Invalid file path: {f.name}")

        for f in req.files:
            file_path = job_dir / f.name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            if f.encoding == "base64":
                file_path.write_bytes(base64.b64decode(f.content))
            else:
                file_path.write_text(f.content)

        has_bib = any(f.name.endswith(".bib") for f in req.files)
        main = req.mainFile

        async def run(cmd):
            proc = await asyncio.create_subprocess_exec(
                *cmd, cwd=str(job_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            try:
                await asyncio.wait_for(proc.communicate(), timeout=COMPILE_TIMEOUT)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                raise HTTPException(status_code=408, detail=f"Compilation timed out after {COMPILE_TIMEOUT}s")
            return proc.returncode

        await run(["pdflatex", "-no-shell-escape", "-interaction=nonstopmode", "-output-directory=.", main])
        if has_bib:
            stem = Path(main).stem
            await run(["bibtex", stem])
            await run(["pdflatex", "-no-shell-escape", "-interaction=nonstopmode", "-output-directory=.", main])
        # Always run a final pass to resolve cross-references (citations, \ref, TOC, etc.)
        await run(["pdflatex", "-no-shell-escape", "-interaction=nonstopmode", "-output-directory=.", main])

        # Output paths already validated above via safe_stem
        pdf_path = job_dir / (safe_stem + ".pdf")
        log_path = job_dir / (safe_stem + ".log")
        log = log_path.read_text() if log_path.exists() else ""
        errors = parse_latex_log(log) if log else []

        if pdf_path.exists():
            pdf_b64 = base64.b64encode(pdf_path.read_bytes()).decode()
            return {"success": True, "pdf": pdf_b64, "log": log, "errors": errors}
        else:
            return {"success": False, "log": log or "No log generated.", "errors": errors}
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)

class ExplainRequest(BaseModel):
    errorMessage: str
    context: str = ""
    sourceCode: str = ""

@app.post("/explain")
async def explain_error(req: ExplainRequest, user=Depends(verify_token)):
    check_rate_limit(user.get("uid", "anonymous"))
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI explanation not configured")

    parts = [
        "You are a helpful LaTeX assistant. A user got this compilation error:",
        "",
        f"Error: {req.errorMessage}",
    ]
    if req.context:
        parts.append(f"Log context: {req.context}")
    if req.sourceCode:
        parts.append(f"Source code around the error:")
        parts.append(req.sourceCode)
    parts.append("")
    parts.append("Explain in 2-3 simple sentences what went wrong and how to fix it. Be specific about what to change. Do not use markdown formatting.")
    prompt = "\n".join(parts)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode()
    api_req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(api_req, timeout=15) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError:
        raise HTTPException(status_code=502, detail="AI service error")
    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    return {"explanation": text or "No explanation available."}

@app.get("/health")
async def health():
    return {"status": "ok"}
