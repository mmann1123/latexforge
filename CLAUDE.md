# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LaTeX Forge is a web-based collaborative LaTeX editor (lightweight Overleaf alternative) with real-time PDF preview, multi-file projects, and Firebase-based auth/storage.

**Live app:** https://latexforge.web.app

## Architecture

- **Frontend:** React 18 + Vite, CodeMirror 6 (editor), PDF.js (viewer), Yjs (CRDT collaboration)
- **Backend:** Python FastAPI on Google Cloud Run — runs `pdflatex`/`bibtex` in Docker
- **Infrastructure:** Firebase (Auth, Firestore, Cloud Storage, Hosting)

### Key directories

- `src/` — React frontend (components, pages, hooks, Firebase config)
- `src/collaboration/` — Yjs providers and hooks for real-time collaborative editing
- `src/firebase/` — Firebase service modules (auth, firestore CRUD, storage, sharing/invitations)
- `cloud-run/` — Python FastAPI compilation service + Dockerfile

## Build & Development Commands

```bash
# Frontend
npm install
npm run dev                # localhost:5173

# Backend (Docker)
cd cloud-run
docker build -t latexforge-compiler .
docker run -p 8080:8080 -e DEV_MODE=true latexforge-compiler

# Backend base image (one-time, builds texlive-full layer)
cd cloud-run && ./build-base.sh [PROJECT_ID]
```

## Testing

```bash
# Frontend — all tests (Vitest + jsdom)
npm run test

# Frontend — watch mode
npm run test:watch

# Frontend — single test file
npx vitest run src/components/FileTree.test.jsx

# Frontend — single test by name
npx vitest run -t "renders root-level files"

# Backend (pytest) — requires DEV_MODE=true set in env
cd cloud-run && pytest
cd cloud-run && pytest test_main.py::TestValidateFilename  # single class
cd cloud-run && pytest test_main.py::TestCompileEndpoint::test_compile_simple_latex  # single test
```

CI runs both frontend and backend tests on push/PR to `main` via `.github/workflows/test.yml`.

## Deployment

```bash
# Frontend + Firestore/Storage rules
npm run build && firebase deploy --only firestore:rules,firestore:indexes,storage,hosting

# Backend to Cloud Run
cd cloud-run && ./deploy.sh [PROJECT_ID] [REGION]
```

Cloud Run config: 2GB memory, 1 max instance, 4 concurrency, 120s timeout.

## Environment Variables

- **Frontend** (`.env.local`): `VITE_FIREBASE_*` keys, `VITE_COMPILE_SERVICE_URL`
- **Backend**: `DEV_MODE`, `ALLOWED_ORIGINS`, `ALLOWED_EMAILS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`, `COMPILE_TIMEOUT`

## Security Model

- Email allowlist enforced at 4 layers: frontend, Firestore rules, Storage rules, backend
- Firestore rules use `parentCanRead()`/`parentCanWrite()` helper functions for subcollection access — avoids operator precedence bugs
- `config/allowedEmails` write-restricted to admin email only
- Project creation enforces `ownerId == request.auth.uid`
- Invitation acceptance verifies caller email matches invitee
- `pdflatex -no-shell-escape` — no arbitrary command execution
- Path traversal protection via regex + resolved path checks
- Rate limiting (10 compiles / 60s per user)
- Firebase token verification on all compile requests (skipped when `DEV_MODE=true`)

## Data Model (Firestore)

```
projects/{projectId}/
  ├── name, ownerId, collaborators: { [uid]: "editor"|"viewer" }
  ├── createdAt, updatedAt
  ├── files/{fileId}/
  │   ├── name, type ("tex"|"binary"), content
  │   ├── createdAt, updatedAt
  ├── yjs/{fileId}/
  │   ├── updates: string[] (base64-encoded Yjs updates)
  │   ├── snapshot: string (compacted state), updatedAt
  └── presence/{odUnique}/
      ├── uid, displayName, color, fileId, cursor, lastSeen

invitations/{invitationId}/
  ├── projectId, projectName, invitedEmail, invitedBy, invitedByName
  ├── role ("editor"|"viewer"), status ("pending"|"accepted"|"declined")
  ├── createdAt

config/allowedEmails
  ├── emails: string[] (auto-populated when collaborators are invited)
```

## Collaboration Architecture

- **Yjs** CRDTs handle conflict-free merging of concurrent edits
- **FirestoreYjsProvider** (`src/collaboration/FirestoreYjsProvider.js`): syncs Y.Doc updates to/from `projects/{pid}/yjs/{fileId}` via `onSnapshot`. Buffers local updates for 500ms, uses `arrayUnion` for writes, auto-compacts at 50 updates
- **FirestorePresenceProvider** (`src/collaboration/FirestorePresenceProvider.js`): writes cursor/selection to `presence/` subcollection with 15s heartbeat, 30s stale threshold
- **useCollaboration** hook (`src/collaboration/useCollaboration.js`): manages Y.Doc lifecycle, provider setup/teardown on file switch, seeds Yjs from existing file content, snapshots `yText.toString()` back to `files/{fileId}.content` every 30s for compilation compatibility
- **Editor.jsx** supports two modes: collaborative (yText/awareness/undoManager via `yCollab`) and legacy (value/onChange)
- Content is flushed to `files/{fileId}.content` before compile so the backend always reads current text

## Backend Compilation Flow

The `/compile` endpoint in `cloud-run/main.py`:
1. Validates all filenames (rejects path traversal, absolute paths, suspicious chars)
2. Writes files to a temporary directory
3. Runs: `pdflatex` → (if `.bib` detected) `bibtex` + 2× `pdflatex`
4. Parses the LaTeX log into structured errors/warnings
5. Returns base64-encoded PDF or compilation log on failure
6. 30-second timeout per subprocess, temp directory cleaned up after
