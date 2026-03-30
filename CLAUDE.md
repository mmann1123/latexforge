# LaTeX Forge

## Project Overview

LaTeX Forge is a web-based LaTeX editor aiming to replicate core functionality of [Overleaf](https://github.com/overleaf/overleaf) — the popular open-source collaborative LaTeX platform. The goal is a lightweight, self-hostable alternative with real-time PDF preview, multi-file project support, collaborative editing, and Firebase-based auth/storage.

**Live app:** https://latexforge.web.app

## Architecture

- **Frontend:** React 18 + Vite, CodeMirror 6 (editor), PDF.js (viewer), Yjs (CRDT collaboration)
- **Backend:** Python FastAPI on Google Cloud Run — runs `pdflatex`/`bibtex` in Docker
- **Infrastructure:** Firebase (Auth, Firestore, Cloud Storage, Hosting)

### Key directories

- `src/` — React frontend (components, pages, hooks, Firebase config)
- `src/collaboration/` — Yjs providers and hooks for real-time collaborative editing
- `cloud-run/` — Python FastAPI compilation service + Dockerfile

## Overleaf Features We're Mimicking

### Implemented
- Browser-based LaTeX editor with syntax highlighting and autocomplete (100+ commands)
- Real-time PDF preview with page navigation
- Multi-file projects with nested folder support
- **Real-time multi-user collaborative editing** (Yjs CRDTs synced via Firestore)
- **Remote cursor/presence indicators** (see who's editing and where)
- **Project sharing** (invite collaborators by email as editor or viewer)
- BibTeX/bibliography support (auto-detects .bib, runs pdflatex 3x)
- Binary file upload (images, PDFs)
- Auto-save via Yjs (content snapshots every 30s + on disconnect) and optional auto-compile (5s after save)
- Toolbar with formatting snippets (bold, italic, math, figures, tables)
- Project CRUD from a dashboard with "Your Projects" and "Shared with Me" sections
- User authentication (email/password + Google OAuth)
- Dynamic email allowlist (hardcoded base list + auto-added invited collaborators via Firestore `config/allowedEmails`)

### Not Yet Implemented (Overleaf parity goals)
- Document templates / template gallery
- Git integration / version history
- Rich compilation log with clickable errors
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
- Firestore rules use `parentCanRead()`/`parentCanWrite()` helper functions for subcollection access — avoids operator precedence bugs
- `config/allowedEmails` write-restricted to admin email only
- Project creation enforces `ownerId == request.auth.uid`
- Storage writes require verified email
- Invitation acceptance verifies caller email matches invitee
- `pdflatex -no-shell-escape` — no arbitrary command execution
- Path traversal protection via regex + resolved path checks
- Rate limiting (10 compiles / 60s per user)
- Firebase token verification on all compile requests (skipped when `DEV_MODE=true`)

## Deployment

- Frontend + rules: `npm run build && firebase deploy --only firestore:rules,firestore:indexes,storage,hosting`
- Backend: `cd cloud-run && ./deploy.sh [PROJECT_ID] [REGION]`
- Cloud Run config: 2GB memory, 1 max instance, 4 concurrency, 120s timeout

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

users/{userId}/ (legacy — profile docs)
  ├── uid, email, displayName, createdAt
```

## Collaboration Architecture

- **Yjs** CRDTs handle conflict-free merging of concurrent edits
- **FirestoreYjsProvider** (`src/collaboration/FirestoreYjsProvider.js`): syncs Y.Doc updates to/from `projects/{pid}/yjs/{fileId}` via `onSnapshot`. Buffers local updates for 500ms, uses `arrayUnion` for writes, auto-compacts at 50 updates
- **FirestorePresenceProvider** (`src/collaboration/FirestorePresenceProvider.js`): writes cursor/selection to `presence/` subcollection with 15s heartbeat, 30s stale threshold
- **useCollaboration** hook (`src/collaboration/useCollaboration.js`): manages Y.Doc lifecycle, provider setup/teardown on file switch, seeds Yjs from existing file content, snapshots `yText.toString()` back to `files/{fileId}.content` every 30s for compilation compatibility
- **Editor.jsx** supports two modes: collaborative (yText/awareness/undoManager via `yCollab`) and legacy (value/onChange)
- Content is flushed to `files/{fileId}.content` before compile so the backend always reads current text
