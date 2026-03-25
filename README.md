# LaTeX Forge

A web-based LaTeX editor with real-time PDF preview. Built with React, Firebase, and a Cloud Run backend for LaTeX compilation.

**Live:** [latexforge.web.app](https://latexforge.web.app)

## Features

- Browser-based LaTeX editing with syntax highlighting (CodeMirror 6)
- PDF compilation with BibTeX support
- Inline PDF preview (PDF.js)
- Multi-file project support (.tex, .bib, images)
- Firebase Authentication (Email/Password + Google OAuth)
- Per-user project storage in Firestore
- File upload to Firebase Storage

## Architecture

```
┌──────────────────┐       ┌───────────────────────┐
│   React Frontend │──────>│  Cloud Run Backend     │
│  (Firebase Host) │       │  (FastAPI + TexLive)   │
│                  │       │                        │
│  - CodeMirror    │  POST │  - pdflatex            │
│  - PDF.js        │ /compile │  - bibtex           │
│  - React Router  │<──────│  - Returns base64 PDF  │
└───────┬──────────┘       └───────────────────────┘
        │
        │ Firestore / Storage / Auth
        v
┌──────────────────┐
│     Firebase     │
│  - Auth          │
│  - Firestore     │
│  - Storage       │
└──────────────────┘
```

## Project Structure

```
latexforge/
├── src/
│   ├── firebase/
│   │   ├── config.js          # Firebase initialization
│   │   ├── auth.js            # Auth functions + email allowlist
│   │   ├── firestore.js       # Firestore CRUD operations
│   │   └── storage.js         # File upload/download
│   ├── hooks/
│   │   ├── useAuth.js         # Auth state hook
│   │   └── useProject.js      # Project data hook
│   ├── pages/
│   │   ├── Login.jsx          # Login page
│   │   ├── Register.jsx       # Registration page
│   │   ├── Dashboard.jsx      # Project list
│   │   └── ProjectEditor.jsx  # Editor + PDF viewer
│   ├── components/
│   │   ├── Editor.jsx         # CodeMirror LaTeX editor
│   │   ├── PdfViewer.jsx      # PDF.js renderer
│   │   ├── Toolbar.jsx        # Formatting toolbar
│   │   └── CompileLog.jsx     # Compilation output
│   ├── App.jsx                # Routes
│   ├── main.jsx               # Entry point
│   └── index.css              # Styles
├── cloud-run/                 # Backend compiler service
│   ├── Dockerfile             # Ubuntu 22.04 + TexLive + Python
│   ├── main.py                # FastAPI compile endpoint
│   ├── requirements.txt       # Python dependencies
│   └── deploy.sh              # Cloud Run deploy script
├── firestore.rules            # Firestore security rules
├── storage.rules              # Storage security rules
├── firebase.json              # Firebase hosting config
├── .env.example               # Environment variable template
├── vite.config.js             # Vite build config
├── package.json
└── index.html
```

## Prerequisites

- Node.js 18+
- Docker
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK (for Cloud Run deployment)

## Setup

### 1. Firebase Project

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password + Google provider)
3. Create a **Firestore Database**
4. Enable **Storage**
5. Register a **Web App** under Project Settings

### 2. Environment Variables

```bash
cp .env.example .env.local
```

Fill in your Firebase config values:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_COMPILE_SERVICE_URL=http://localhost:8080/compile
```

### 3. Deploy Security Rules

```bash
firebase login
firebase init firestore
firebase init storage
firebase deploy --only firestore:rules,storage
```

### 4. Run Frontend (Development)

```bash
npm install
npm run dev
```

App runs at http://localhost:5173.

### 5. Run Backend (Development)

```bash
cd cloud-run
docker build -t latexforge-compiler .
docker run -p 8080:8080 -e DEV_MODE=true latexforge-compiler
```

`DEV_MODE=true` skips Firebase token verification for local development.

## Deployment

### Frontend (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

Live at https://latexforge.web.app.

### Backend (Cloud Run)

```bash
cd cloud-run
./deploy.sh
```

After deploying, copy the Cloud Run service URL and update `VITE_COMPILE_SERVICE_URL` in `.env.local`, then rebuild and redeploy the frontend.

## Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_MODE` | `false` | Skip auth verification for local dev |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS origins |
| `ALLOWED_EMAILS` | `mmann1123@gmail.com` | Comma-separated authorized emails |
| `RATE_LIMIT_MAX` | `10` | Max compiles per rate limit window |
| `RATE_LIMIT_WINDOW` | `60` | Rate limit window in seconds |
| `COMPILE_TIMEOUT` | `30` | Max seconds per pdflatex/bibtex run |

## Security

Access is restricted to authorized emails only. Protection is enforced at multiple layers:

- **Firestore rules** — read/write restricted to allowlisted emails
- **Storage rules** — same email restriction
- **Frontend auth** — blocks login/registration for unauthorized emails
- **Backend** — verifies Firebase token and checks email allowlist
- **Rate limiting** — 10 compiles per 60 seconds per user
- **Shell escape disabled** — `pdflatex` runs with `-no-shell-escape`
- **Compile timeout** — 30 second max per process, kills runaway jobs
- **Path traversal protection** — filename validation + resolve check
- **CORS** — restricted to hosting domains only
- **Cloud Run** — max 1 instance, 4 concurrency to cap costs

### Adding Users

To grant access to a new user, add their email to:

1. `src/firebase/auth.js` — `ALLOWED_EMAILS` array
2. `firestore.rules` — email allowlist
3. `storage.rules` — email allowlist
4. Cloud Run `ALLOWED_EMAILS` env var (update via `deploy.sh` or GCP console)

## Firestore Data Model

```
users/{userId}/
  ├── email, displayName, createdAt
  └── projects/{projectId}/
      ├── name, mainFile, createdAt, updatedAt
      └── files/{fileId}/
          ├── name        # e.g. "main.tex", "refs.bib"
          ├── type        # "tex" or "binary"
          ├── content     # file contents (text files)
          ├── createdAt
          └── updatedAt
```

## Estimated Cost

With a single user and light usage, this project stays within free tiers:

| Service | Free Tier | Typical Usage |
|---------|-----------|---------------|
| Firebase Hosting | 10 GB/mo | Negligible |
| Firebase Auth | 50k MAU | 1 user |
| Firestore | 50k reads, 20k writes/day | Well under |
| Firebase Storage | 5 GB, 1 GB/day transfer | Minimal |
| Cloud Run | 2M requests, 180k vCPU-sec/mo | Few compiles/day |

**Expected: $0/month** for personal use.

## Tech Stack

- **Frontend:** React 18, Vite, React Router, CodeMirror 6, PDF.js
- **Backend:** Python, FastAPI, TexLive (pdflatex + bibtex)
- **Infrastructure:** Firebase (Auth, Firestore, Storage, Hosting), Google Cloud Run
- **Container:** Ubuntu 22.04, Docker
