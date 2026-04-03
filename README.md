# Zettaword

Production-oriented MVP for **multi-site AI content planning**, topic review, and **SEO article generation**. Phase 1 stores everything internally; **WordPress is not connected**. Articles include a `wpReadyPayload` JSON field reserved for a future publish integration.

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Radix primitives, React Query, Zustand, React Hook Form (available), Zod, Tiptap |
| Backend  | Node.js, Express 5, TypeScript, JWT auth, Zod validation |
| Database | MySQL 8, Prisma ORM 6 |

## Repository layout

```
zettaword/
├── backend/          # Express API + Prisma schema + seed
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── controllers/
│       ├── routes/
│       ├── services/ai/    # Provider-agnostic AI layer + mock implementation
│       └── ...
├── frontend/         # Vite React app
│   └── src/
│       ├── pages/
│       ├── components/
│       └── api/
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Node.js 20+
- PostgreSQL 16+ (local install, cloud, or Docker)

### Option A: Docker PostgreSQL

```powershell
docker compose up -d
```

This exposes PostgreSQL on `localhost:5432` with user/password `postgres`/`postgres` and database `zettaword`.

### Option B: Your own connection string

Set `DATABASE_URL` in `backend/.env` to any valid PostgreSQL URL.

## Backend setup

```powershell
cd backend
copy .env.example .env
# Edit .env if needed (DATABASE_URL, JWT_SECRET, FRONTEND_URL)

npm install
npx prisma db push
npx prisma db seed
npm run dev
```

API listens on **http://localhost:4000** (`GET /health`, `POST /api/auth/login`, etc.).

## Frontend setup

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

The dev server runs on **http://localhost:5173** and proxies `/api` to `http://localhost:4000` (see `frontend/vite.config.ts`). To call a remote API without the proxy, set `VITE_API_URL` (origin only, e.g. `http://localhost:4000`).

## Seed credentials

| Field    | Value |
|----------|--------|
| Email    | `demo@zettaword.local` |
| Password | `password123` |

The seed creates two sample websites (coffee gear + B2B SaaS), keyword groups, categories, one monthly plan (April 2026), several planned topics, and one example article with a version snapshot.

## AI layer

- **Interface**: `generateTopics`, `regenerateTopic`, `generateArticle`, `generateSEOFields`, `improveArticle` (see `backend/src/services/ai/`).
- **Default**: `MockAIService` produces structured placeholder content and keeps prompts in `prompts.ts` for future LLM wiring.
- **Swap-in**: Add a new class implementing `AIService` and return it from `getAIService()` when `OPENAI_API_KEY` or similar is present (hook not included by default to avoid accidental billing).

## Key API routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register`, `/api/auth/login` | Auth |
| GET | `/api/auth/me` | Current user |
| CRUD | `/api/websites` | Sites / brand profiles |
| POST | `/api/planner/generate` | Generate monthly plan (replaces existing topics for that month) |
| GET | `/api/planner` | Load plan + topics |
| GET/PATCH | `/api/topics`, `/api/topics/:id` | Topics |
| POST | `/api/topics/:id/approve`, `.../regenerate`, bulk endpoints | Workflow |
| DELETE | `/api/topics/:id` | Reject/delete topic |
| POST | `/api/articles/generate/:topicId` | Generate or regenerate article |
| PATCH | `/api/articles/:id` | Update article + optional version |
| GET | `/api/dashboard/summary` | Dashboard metrics |

## Production build

```powershell
cd backend && npm run build && npm start
cd frontend && npm run build && npm run preview
```

Set `NODE_ENV=production`, strong `JWT_SECRET`, and a managed `DATABASE_URL`.

## Phase 2 (not implemented)

- WordPress REST integration using `wpReadyPayload`
- Real LLM provider adapter behind `AIService`
- Role-based access beyond single-user MVP
