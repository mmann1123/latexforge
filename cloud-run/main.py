from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import asyncio, uuid, base64, shutil, os, re, time
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

if not DEV_MODE:
    import firebase_admin
    from firebase_admin import auth, credentials
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)

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

SAFE_FILENAME = re.compile(r'^[a-zA-Z0-9_\-][a-zA-Z0-9_\-./]*\.[a-zA-Z0-9]+$')

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

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if DEV_MODE:
        return {"uid": "dev-user", "email": "dev@localhost"}
    try:
        decoded = auth.verify_id_token(credentials.credentials)
        email = decoded.get("email", "")
        if email not in ALLOWED_EMAILS:
            raise HTTPException(status_code=403, detail="Access denied")
        return decoded
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

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
            await run(["pdflatex", "-no-shell-escape", "-interaction=nonstopmode", "-output-directory=.", main])

        pdf_path = job_dir / (Path(main).stem + ".pdf")
        if pdf_path.exists():
            pdf_b64 = base64.b64encode(pdf_path.read_bytes()).decode()
            return {"success": True, "pdf": pdf_b64}
        else:
            log_path = job_dir / (Path(main).stem + ".log")
            log = log_path.read_text() if log_path.exists() else "No log generated."
            return {"success": False, "log": log}
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)

@app.get("/health")
async def health():
    return {"status": "ok"}
