# Merb Starterpack

Full-stack **Turborepo** monorepo starter kit with **Bun**, featuring production-ready **authentication, role-based authorization (RBAC), MongoDB, and BullMQ email notifications** — plus Docker orchestration and a complete CI/CD pipeline with GitHub Actions.

## ✨ Features

| Area | Details |
| --- | --- |
| 🔐 **Authentication** | JWT access tokens (15m) + refresh tokens (7d) with **rotation & replay detection** (hashed at rest, SHA-256) |
| 🔑 **Authorization (RBAC)** | Roles → permissions (`resource:action` strings), wildcard `*` support, system-role protection |
| 🍃 **Database** | MongoDB with Mongoose — User, Role, Token models with TTL cleanup |
| 📧 **Email notifications** | BullMQ + Redis queue, dedicated worker process, HTML templates, retry with exponential backoff, graceful dev fallback (logs instead of sends) |
| 🏃 **Runtime** | 100% [Bun](https://bun.sh) — runtime, package manager, test runner, bundler |
| ⚡ **Monorepo** | [Turborepo](https://turbo.build) — parallel tasks, remote-style caching across backend & frontend |
| 🎨 **Frontend** | TanStack Start (React 19) with login / register / protected dashboard pages |
| 🐳 **Docker** | Multi-stage `oven/bun:1` image, Compose stack (api + worker + mongo + redis) with healthchecks |
| 🔄 **CI/CD** | GitHub Actions: typecheck → test → frontend build → Docker build (GHA cache) → **full-stack compose smoke test** |
| ✅ **Validation** | Zod schemas on every request body |

## 📁 Project Structure

```
merb-starterpack/
├── turbo.json                # Turborepo task pipeline
├── package.json              # workspace root (bun workspaces + turbo)
├── bun.lock                  # single lockfile for the whole monorepo
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
├── .github/workflows/        # CI (ci.yml) + IaaS deploy (deploy.yml)
├── infra/
│   ├── pulumi/               # IaC: Droplet + firewall per environment
│   ├── ansible/              # config & deploy: hardening, Docker, app
│   ├── scripts/              # deploy.sh orchestrator, gen-inventory.sh
│   └── stress-test/          # k6 load tests
├── .github/workflows/ci.yml  # CI/CD pipeline
└── docker-compose.yml        # api + worker + mongo + redis
```

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- Docker & Docker Compose

### 1. Install & configure

```sh
bun install   # installs all workspace deps (backend + frontend) via bun workspaces

cp backend/.env.example backend/.env  # adjust if needed
```

### 2. Start infrastructure (MongoDB + Redis)

```sh
docker compose up -d mongo redis
```

> **Note:** Redis is mapped to host port **6380** to avoid clashing with a local Redis on 6379. The backend `.env` uses `REDIS_URL=redis://localhost:6380`.

### 3. Run everything

```sh
bun run dev          # turbo: backend (:3000) + frontend (:5173) in parallel
bun run dev:worker   # email worker (separate terminal)
```

Or run pieces individually:

```sh
bun run dev:backend   # API only
bun run dev:frontend  # frontend only
bun run dev:worker    # email worker only
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

## 🌍 Infrastructure (IaaS + IaC: Pulumi + Ansible)

Server provisioning and deployment are fully automated for 4 environments:
**`development`**, **`staging`**, **`stress-test`**, **`production`**.

| Layer | Tool | Responsibility |
| --- | --- | --- |
| Provisioning (IaaS) | **Pulumi** (`infra/pulumi/`) | DigitalOcean Droplet + cloud firewall per environment (sizing differs per stack) |
| Configuration & deploy | **Ansible** (`infra/ansible/`) | User + SSH hardening, UFW, fail2ban, Docker install, app deploy with vault-encrypted secrets |
| Load testing | **k6** (`infra/stress-test/`) | Auth-flow stress test against the stress-test environment |

### First-time setup (per environment)

```sh
# 1. Provisioning — Pulumi (TypeScript, run with node; deps installed via Bun)
cd infra/pulumi
bun install
pulumi login                      # or PULUMI_ACCESS_TOKEN=...
export DIGITALOCEAN_TOKEN=...
pulumi stack select development   # stack config: see Pulumi.development.yaml
pulumi config set dropletSize s-1vcpu-1gb
pulumi config set --secret sshPublicKey "ssh-ed25519 AAAA..."
pulumi up

# 2. Configuration & deployment — Ansible
cd ../ansible
pip install ansible-core          # or: brew install ansible
ansible-vault create group_vars/development/vault.yml
                                  # start from group_vars/vault.yml.example
echo "your-vault-password" > .vault-pass   # or enter it manually each time
```

### Provision + deploy in one command

```sh
./infra/scripts/deploy.sh development provision   # pulumi up → hardening → docker → app
./infra/scripts/deploy.sh staging deploy          # re-deploy app only
./infra/scripts/deploy.sh production destroy      # ☠️ tear down cloud resources
```

### Deploy from CI (repeatable deploys)

GitHub Actions workflow **Deploy (IaaS)** (`workflow_dispatch`) runs the Ansible deploy for the chosen environment. Required per GitHub **environment** (`development`/`staging`/`stress-test`/`production`):

| Type | Name | Contents |
| --- | --- | --- |
| Variable | `SERVER_HOST` | Server IP (from `pulumi stack output ip`) |
| Secret | `SSH_PRIVATE_KEY` | Deploy private key |
| Secret | `ANSIBLE_VAULT_PASSWORD` | Vault password for that environment |

> Provisioning from CI is intentionally **not** automated — creating/destroying cloud resources from a pipeline is risky. Run Pulumi locally.

### Stress testing

The `stress-test` environment provisions a larger droplet (s-4vcpu-8gb). Run the k6 suite against it:

```sh
k6 run infra/stress-test/k6/auth-flow.js -e BASE_URL=http://<stress-ip>
k6 run infra/stress-test/k6/auth-flow.js -e BASE_URL=https://stress.merb.example.com -e PROFILE=heavy
```

Thresholds: error rate < 5%, p95 latency < 1.5s.

### Production hardening notes

- Docker's port mapping for mongo/redis is protected by the DigitalOcean firewall **and** UFW (only 22/80/443 open).
- For real production, prefer **managed MongoDB (Atlas)** and **managed Redis** — set `vault_mongodb_uri` / `vault_redis_url` in the vault and the app stops using the compose-internal databases.
- Secrets never touch git: Pulumi secrets + Ansible Vault only.

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

1. **Backend** — workspace install → turbo typecheck → turbo test
2. **Frontend** — workspace install → turbo build
3. **Docker** — multi-stage image build (with GHA layer cache) + `docker compose config` validation
4. **Smoke test** *(on push to main)* — boots the full compose stack, waits for health, then exercises register → login → `/auth/me` end-to-end

To deploy from CI, add your registry/deploy credentials under **Settings → Secrets and variables → Actions** and extend the `docker` job with a `push` step.

## 🧪 Testing & Quality (via Turborepo)

Tasks run in parallel across workspaces, with caching — reruns are instant:

```sh
bun run typecheck   # turbo run typecheck (backend + frontend)
bun run test        # turbo run test (backend)
bun run build       # turbo run build (frontend; backend has no build step)
bun run lint        # turbo run lint (frontend)
```

## 📜 Scripts (root `package.json`)

| Script | Description |
| --- | --- |
| `bun run dev` | **Turbo** — backend + frontend dev servers in parallel |
| `bun run dev:backend` | API with hot reload |
| `bun run dev:worker` | Email worker |
| `bun run dev:frontend` | Frontend dev server (:5173) |
| `bun run build` | Turbo build (frontend) |
| `bun run typecheck` / `test` / `lint` | Turbo tasks across workspaces |
| `bun run seed` | Seed roles + admin user |
| `bun run stack:up` | Start mongo + redis only |
| `bun run stack:full` | Full stack via Docker Compose |

---

Built with 🧡 on [Bun](https://bun.sh)
