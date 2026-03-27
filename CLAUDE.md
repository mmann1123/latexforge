# LaTeX Forge

## Project Overview

LaTeX Forge is a web-based LaTeX editor aiming to replicate core functionality of [Overleaf](https://github.com/overleaf/overleaf) — the popular open-source collaborative LaTeX platform. The goal is a lightweight, self-hostable alternative with real-time PDF preview, multi-file project support, and Firebase-based auth/storage.

**Live app:** https://latexforge.web.app

## Architecture

- **Frontend:** React 18 + Vite, CodeMirror 6 (editor), PDF.js (viewer)
- **Backend:** Python FastAPI on Google Cloud Run — runs `pdflatex`/`bibtex` in Docker
- **Infrastructure:** Firebase (Auth, Firestore, Cloud Storage, Hosting)

### Key directories

- `src/` — React frontend (components, pages, hooks, Firebase config)
- `cloud-run/` — Python FastAPI compilation service + Dockerfile

## Overleaf Features We're Mimicking

### Implemented
- Browser-based LaTeX editor with syntax highlighting and autocomplete (100+ commands)
- Real-time PDF preview with page navigation
- Multi-file projects with nested folder support
- BibTeX/bibliography support (auto-detects .bib, runs pdflatex 3x)
- Binary file upload (images, PDFs)
- Auto-save (2s debounce) and optional auto-compile (5s after save)
- Toolbar with formatting snippets (bold, italic, math, figures, tables)
- Project CRUD from a dashboard
- User authentication (email/password + Google OAuth)
- Per-user project isolation

### Not Yet Implemented (Overleaf parity goals)
- Real-time multi-user collaboration (WebSocket/OT)
- Document templates / template gallery
- Git integration / version history
- Rich compilation log with clickable errors
- Project sharing (read-only or edit access)
- Search and replace across files
- Code folding
- Custom LaTeX package management
- Export to Word/other formats

## Development

```bash
# Frontend
npm install
npm run dev                # localhost:5173

# Backend (Docker)
cd cloud-run
docker build -t latexforge-compiler .
docker run -p 8080:8080 -e DEV_MODE=true latexforge-compiler

# Tests
npm run test               # Frontend (Vitest)
pytest cloud-run/          # Backend (pytest)
```

## Environment Variables

- **Frontend** (`.env.local`): `VITE_FIREBASE_*` keys, `VITE_COMPILE_SERVICE_URL`
- **Backend**: `DEV_MODE`, `ALLOWED_ORIGINS`, `ALLOWED_EMAILS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `COMPILE_TIMEOUT`

## Security

- Email allowlist enforced at 4 layers (frontend, Firestore rules, Storage rules, backend)
- `pdflatex -no-shell-escape` — no arbitrary command execution
- Path traversal protection via regex + resolved path checks
- Rate limiting (10 compiles / 60s per user)
- Firebase token verification on all compile requests (skipped when `DEV_MODE=true`)

## Deployment

- Frontend: `npm run build && firebase deploy --only hosting`
- Backend: `cd cloud-run && ./deploy.sh [PROJECT_ID] [REGION]`
- Cloud Run config: 2GB memory, 1 max instance, 4 concurrency, 120s timeout

## Data Model (Firestore)

```
users/{userId}/
  ├── email, displayName, createdAt
  └── projects/{projectId}/
      ├── name, mainFile, createdAt, updatedAt
      └── files/{fileId}/
          ├── name, type ("tex"|"binary"), content
          ├── createdAt, updatedAt
```
