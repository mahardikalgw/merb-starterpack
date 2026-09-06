# Merb Starterpack

Full-stack starter kit with **Bun**, featuring production-ready **authentication, role-based authorization (RBAC), MongoDB, and BullMQ email notifications** — plus Docker orchestration and a complete CI/CD pipeline with GitHub Actions.

## ✨ Features

| Area | Details |
| --- | --- |
| 🔐 **Authentication** | JWT access tokens (15m) + refresh tokens (7d) with **rotation & replay detection** (hashed at rest, SHA-256) |
| 🔑 **Authorization (RBAC)** | Roles → permissions (`resource:action` strings), wildcard `*` support, system-role protection |
| 🍃 **Database** | MongoDB with Mongoose — User, Role, Token models with TTL cleanup |
| 📧 **Email notifications** | BullMQ + Redis queue, dedicated worker process, HTML templates, retry with exponential backoff, graceful dev fallback (logs instead of sends) |
| 🏃 **Runtime** | 100% [Bun](https://bun.sh) — runtime, package manager, test runner, bundler |
| 🎨 **Frontend** | TanStack Start (React 19) with login / register / protected dashboard pages |
| 🐳 **Docker** | Multi-stage `oven/bun:1` image, Compose stack (api + worker + mongo + redis) with healthchecks |
| 🔄 **CI/CD** | GitHub Actions: typecheck → test → frontend build → Docker build (GHA cache) → **full-stack compose smoke test** |
| ✅ **Validation** | Zod schemas on every request body |

## 📁 Project Structure

```
merb-starterpack/
├── backend/                  # Bun + Express 5 + Mongoose API
│   ├── src/
│   │   ├── config/           # env + MongoDB connection
│   │   ├── controllers/      # thin request handlers
│   │   ├── emails/           # nodemailer transport + HTML templates
│   │   ├── lib/              # errors, logger, jwt, permission constants
│   │   ├── middleware/       # authenticate, requirePermissions, error handler
│   │   ├── models/           # User, Role, Token (refresh + password reset)
│   │   ├── queue/            # BullMQ connection + email queue
│   │   ├── routes/           # /auth, /users, /roles, /health
│   │   ├── services/         # business logic
│   │   ├── validators/       # zod schemas
│   │   └── workers/          # BullMQ email worker
│   ├── tests/                # bun test suites
│   ├── Dockerfile
│   └── .env.example
├── frontend/                 # TanStack Start (React 19, Vite, Tailwind v4)
│   └── src/routes/           # /, /login, /register, /dashboard (protected)
├── .github/workflows/ci.yml  # CI/CD pipeline
└── docker-compose.yml        # api + worker + mongo + redis
```

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- Docker & Docker Compose

### 1. Install & configure

```sh
bun install --frozen-lockfile         # backend deps
cd frontend && bun install && cd ..   # frontend deps

cp backend/.env.example backend/.env  # adjust if needed
```

### 2. Start infrastructure (MongoDB + Redis)

```sh
docker compose up -d mongo redis
```

> **Note:** Redis is mapped to host port **6380** to avoid clashing with a local Redis on 6379. The backend `.env` uses `REDIS_URL=redis://localhost:6380`.

### 3. Run everything

```sh
# Terminal 1 — API (http://localhost:3000)
bun run dev:backend

# Terminal 2 — email worker
bun run dev:worker

# Terminal 3 — frontend (http://localhost:5173)
bun run dev:frontend
```

On first boot the API **auto-seeds** system roles (`admin`, `user`) and an admin account (`SEED_ON_START=true`).

**Default admin login:** `admin@example.com` / `Admin123!` (change via env in production!)

### One-command alternative: full stack in Docker

```sh
docker compose up --build
```

## 🔌 API Reference

Base URL: `http://localhost:3000/api/v1`

### Auth

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create account (default `user` role) + queue welcome email |
| `POST` | `/auth/login` | Returns `{ user, accessToken, refreshToken }` |
| `POST` | `/auth/refresh` | Rotate refresh token (old one revoked; reuse revokes **all** sessions) |
| `POST` | `/auth/logout` | Revoke the given refresh token |
| `GET` | `/auth/me` 🔒 | Current profile |
| `POST` | `/auth/forgot-password` | Queue password-reset email (15-min token) |
| `POST` | `/auth/reset-password` | Consume reset token, set new password |

### Users

| Method | Endpoint | Permission |
| --- | --- | --- |
| `PATCH` | `/users/me` 🔒 | — (own profile) |
| `GET` | `/users` 🔒 | `users:read` |
| `PATCH` | `/users/:id` 🔒 | `users:write` (name / active / role) |
| `DELETE` | `/users/:id` 🔒 | `users:delete` |

### Roles

| Method | Endpoint | Permission |
| --- | --- | --- |
| `GET` | `/roles` 🔒 | `roles:read` |
| `POST` | `/roles` 🔒 | `roles:manage` |
| `PATCH` | `/roles/:id` 🔒 | `roles:manage` |
| `DELETE` | `/roles/:id` 🔒 | `roles:manage` (system roles protected) |

🔒 = requires `Authorization: Bearer <accessToken>`

### Quick test

```sh
# Login as admin
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin123!"}'

# List users
curl -s http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# Health check
curl http://localhost:3000/api/health
```

## 🔑 Roles & Permissions

Permissions are `resource:action` strings defined in `backend/src/lib/permissions.ts`:

```
users:read    users:write    users:delete
roles:read    roles:manage
```

- Roles live in MongoDB and hold an array of permissions.
- A permission of `*` grants **everything** (seeded `admin` role).
- Routes are guarded with `requirePermissions(...)` — **all** listed permissions are required.
- System roles (`admin`, `user`) cannot be edited or deleted.
- Seeding runs automatically on boot (`SEED_ON_START=true`) or manually:

```sh
bun run seed
```

## 📧 Email Pipeline

```
API service                     Redis (BullMQ)            Worker process
┌─────────────────┐            ┌──────────────┐          ┌─────────────────┐
│ enqueueEmail()  │  ──────►   │  "email"     │  ──────► │ render template │
│ (welcome, reset)│            │  queue       │          │ send via SMTP   │
└─────────────────┘            └──────────────┘          └─────────────────┘
                                    5 attempts, exponential backoff
```

- Without `SMTP_URL`, emails are **logged to console** instead of sent (perfect for dev/CI).
- With SMTP: `SMTP_URL=smtp://user:pass@smtp.example.com:587`

## ⚙️ Environment Variables

See [`backend/.env.example`](backend/.env.example) for the full list. Key variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | API port |
| `MONGODB_URI` | `mongodb://localhost:27017/merb-starterpack` | MongoDB connection |
| `REDIS_URL` | `redis://localhost:6380` | Redis (BullMQ) |
| `JWT_ACCESS_SECRET` | — | **Change in production!** |
| `JWT_REFRESH_SECRET` | — | **Change in production!** |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_DAYS` | `7` | Refresh token TTL |
| `SMTP_URL` | *(empty = log only)* | SMTP connection string |
| `MAIL_FROM` | `no-reply@example.com` | Sender address |
| `SEED_ON_START` | `false` | Seed roles + admin on boot |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@example.com` / `Admin123!` | Initial admin |
| `APP_URL` | `http://localhost:5173` | Frontend URL (used in email links) |
| `RUN_INLINE_WORKER` | `false` | Run email worker inside API process (dev convenience) |

## 🐳 Docker

```sh
docker compose up --build -d        # full stack
docker compose logs -f api worker   # follow logs
docker compose down                 # stop (data persists in volumes)
docker compose down -v              # stop + wipe data
```

Services:

| Service | Port | Notes |
| --- | --- | --- |
| `api` | `3000` | Bun + Express API |
| `worker` | — | BullMQ email worker (`bun run src/workers/email.worker.ts`) |
| `mongo` | `27017` | MongoDB 7 + healthcheck |
| `redis` | `6380` (host) | Redis 7 + healthcheck |

## 🔄 CI/CD Pipeline

`.github/workflows/ci.yml` runs on every push / PR to `main`:

1. **Backend** — Bun setup → `bun install --frozen-lockfile` → typecheck (`tsc --noEmit`) → `bun test`
2. **Frontend** — Bun setup → install → production build
3. **Docker** — multi-stage image build (with GHA layer cache) + `docker compose config` validation
4. **Smoke test** *(on push to main)* — boots the full compose stack, waits for health, then exercises register → login → `/auth/me` end-to-end

To deploy from CI, add your registry/deploy credentials under **Settings → Secrets and variables → Actions** and extend the `docker` job with a `push` step.

## 🧪 Testing & Quality

```sh
bun run typecheck   # tsc --noEmit (backend)
bun run test        # bun test (backend)
cd frontend && bun run build   # frontend typecheck + build
```

## 📜 Scripts (root `package.json`)

| Script | Description |
| --- | --- |
| `bun run dev:backend` | API with hot reload |
| `bun run dev:worker` | Email worker |
| `bun run dev:frontend` | Frontend dev server (:5173) |
| `bun run seed` | Seed roles + admin user |
| `bun run test` | Backend tests |
| `bun run stack:up` | Start mongo + redis only |
| `bun run stack:full` | Full stack via Docker Compose |

## 🗺️ Roadmap / Ideas

- [ ] Email verification flow (verify token on register)
- [ ] Rate limiting on auth endpoints
- [ ] Audit log collection
- [ ] Frontend admin UI for roles & users
- [ ] Refresh token storage in httpOnly cookies

---

Built with 🧡 on [Bun](https://bun.sh)
