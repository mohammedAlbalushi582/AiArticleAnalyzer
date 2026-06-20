# AI Article Analyzer

A full-stack web application that lets users submit articles (via URL or pasted text) and receive AI-generated summaries and key points, with a personal note-taking workspace tied to each analyzed article.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Django 5 + Django REST Framework
- **Database:** PostgreSQL
- **AI:** Google Gemini API (`gemini-2.5-flash`)
- **Auth:** JWT via `djangorestframework-simplejwt`
- **Article extraction:** `readability-lxml` + `requests`
- **Containerization:** Docker + Docker Compose

## Architecture

```
├── backend/
│   ├── config/settings/       # Django settings (base, dev, prod)
│   ├── apps/
│   │   ├── users/             # Custom user model, auth endpoints
│   │   ├── articles/          # Article model, analysis, CRUD
│   │   └── notes/             # Notes model + CRUD
│   └── core/
│       ├── ai/                # Analyzer ABC + Anthropic implementation
│       ├── scraper/           # URL article extraction
│       ├── exceptions.py      # Custom error handling
│       └── pagination.py
├── frontend/
│   ├── app/
│   │   ├── (auth)/            # Login, register pages
│   │   └── (dashboard)/       # Articles list, detail, new analysis
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   └── features/          # Sidebar, notes editor
│   ├── lib/                   # API client, utilities
│   └── hooks/                 # Auth hook
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- An Anthropic API key

### Setup

1. Clone the repository:

```bash
git clone <repo-url>
cd ai-article-analyzer
```

2. Create environment files:

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and add your ANTHROPIC_API_KEY

# Frontend
cp frontend/.env.local.example frontend/.env.local
```

3. Start the application:

```bash
docker compose up --build
```

4. (Optional) Seed demo data:

```bash
docker compose exec backend python manage.py seed_demo
```

The app will be available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000/api
- **Swagger docs:** http://localhost:8000/api/schema/swagger-ui/

### Demo Account

After running `seed_demo`:
- **Email:** demo@example.com
- **Password:** demo1234

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set DATABASE_URL to a local Postgres or SQLite for dev
export DATABASE_URL=sqlite:///db.sqlite3
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register a new user |
| POST | `/api/auth/login/` | Login (returns JWT tokens) |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| GET | `/api/auth/me/` | Get current user |
| POST | `/api/articles/analyze/` | Analyze article (URL or text) |
| GET | `/api/articles/` | List user's articles (paginated) |
| GET | `/api/articles/{id}/` | Get article detail |
| DELETE | `/api/articles/{id}/` | Delete article |
| GET | `/api/notes/{article_id}/` | Get note for article |
| PUT | `/api/notes/{article_id}/` | Create/update note |
| DELETE | `/api/notes/{article_id}/` | Delete note |
| POST | `/api/comparisons/` | Detect contradictions across 2–10 articles (`{article_ids}`) |
| GET | `/api/comparisons/` | List contradiction reports |
| GET | `/api/comparisons/{id}/` | Get a contradiction report |
| DELETE | `/api/comparisons/{id}/` | Delete a contradiction report |
| GET | `/api/schema/swagger-ui/` | Swagger API docs |

## Running Tests

```bash
cd backend
source .venv/bin/activate
pytest -v
```

## Features

- **Article Analysis:** Submit via URL (auto-extracts content) or paste text directly
- **AI-Powered:** Gemini generates summaries, key points, and topic tags
- **Contradiction Detector:** Compare 2–10 articles on a topic; a two-pass AI analysis surfaces where authors directly contradict each other, with verified side-by-side quotes and a severity score
- **Article Library:** Browse, search, and manage analyzed articles
- **Notes Workspace:** Markdown notes editor with auto-save per article
- **Dark Mode:** System-aware theme toggle
- **JWT Auth:** Secure authentication with token refresh
