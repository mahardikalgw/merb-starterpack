# Backend API

Bun + Express 5 + MongoDB (Mongoose) with JWT authentication, role-based access control (RBAC), and BullMQ/Redis email notifications.

## Stack

| Concern          | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Runtime          | Bun (also package manager, test runner)        |
| HTTP             | Express 5 (runs on Bun's node:http layer)      |
| Database         | MongoDB via Mongoose                           |
| Auth             | JWT access + refresh tokens (rotation + replay detection) |
| Passwords        | `Bun.password` (bcrypt, no native deps)        |
| Authorization    | Roles → permissions (`resource:action` strings)|
| Queues           | BullMQ + Redis                                 |
| Email            | Nodemailer (SMTP; logs to console when `SMTP_URL` is empty) |
| Validation       | Zod                                            |

## Getting started

```sh
bun install
cp .env.example .env      # adjust as needed

# infra only (mongo + redis), app runs locally:
docker compose up -d mongo redis   # from the repo root

bun run dev               # API with hot reload (seeds roles+admin when SEED_ON_START=true)
bun run worker            # dedicated email worker (or set RUN_INLINE_WORKER=true)
```

Full stack in Docker:

```sh
docker compose up --build   # from repo root: api, worker, mongo, redis
```

## API overview (`/api/v1`)

### Auth
| Method | Path              | Notes                                  |
| ------ | ----------------- | -------------------------------------- |
| POST   | `/auth/register`  | Creates user (default `user` role) + queues welcome email |
| POST   | `/auth/login`     | Returns `{ accessToken, refreshToken }` |
| POST   | `/auth/refresh`   | Rotates refresh token (old one is revoked; reuse revokes all) |
| POST   | `/auth/logout`    | Revokes the given refresh token        |
| GET    | `/auth/me`        | 🔒 Current profile                     |
| POST   | `/auth/forgot-password` | Queues reset email               |
| POST   | `/auth/reset-password`  | Consumes reset token             |

### Users
| Method | Path       | Permission required |
| ------ | ---------- | ------------------- |
| PATCH  | `/users/me`   | authenticated    |
| GET    | `/users`      | `users:read`     |
| PATCH  | `/users/:id`  | `users:write` (change name/active/role) |
| DELETE | `/users/:id`  | `users:delete`   |

### Roles
| Method | Path         | Permission required |
| ------ | ------------ | ------------------- |
| GET    | `/roles`     | `roles:read`        |
| POST   | `/roles`     | `roles:manage`      |
| PATCH  | `/roles/:id` | `roles:manage`      |
| DELETE | `/roles/:id` | `roles:manage` (system roles protected) |

## Roles & permissions

- Permissions are `resource:action` strings, defined in `src/lib/permissions.ts`.
- Roles live in MongoDB (`roles` collection) and hold an array of permissions.
- A permission of `*` grants everything (given to the seeded `admin` role).
- Routes are guarded with `requirePermissions(PERMISSIONS.X, ...)` (all listed permissions required).
- Seeded system roles: `admin` (all permissions), `user` (none).
- Seed runs automatically on boot when `SEED_ON_START=true`, or via `bun run seed`.

## Email pipeline

1. Services call `enqueueEmail(...)` (e.g. welcome, password reset).
2. Jobs go to the `email` BullMQ queue in Redis — 5 attempts, exponential backoff.
3. The worker (`src/workers/email.worker.ts`) renders the template and sends via nodemailer.
4. Without `SMTP_URL`, emails are logged (jsonTransport) instead of sent — great for dev/CI.

## Testing

```sh
bun test          # unit tests (permissions, JWT, hashing)
bun run typecheck # tsc --noEmit
```

## Project layout

```
src/
├── config/          env + mongo connection
├── controllers/     request handlers
├── emails/          mailer transport + HTML templates
├── lib/             errors, logger, jwt, permission constants
├── middleware/      authenticate + requirePermissions, error handler
├── models/          User, Role, Token (refresh + password reset)
├── queue/           BullMQ connection + email queue
├── routes/          /auth, /users, /roles, /health
├── services/        business logic
├── validators/      zod schemas
└── workers/         BullMQ workers (email)
```
