
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <command>`
- Bun automatically loads .env, so don't use dotenv.

## Project conventions (auth/RBAC/queues)

- Permissions are `resource:action` strings declared in `src/lib/permissions.ts`.
  Add new ones there and guard routes with `requirePermissions(...)`.
- All request bodies are validated with zod schemas in `src/validators/`.
- Business logic lives in `src/services/`; controllers stay thin.
- Emails are never sent inline — always enqueue via `src/queue/email.queue.ts` and
  render/send in `src/workers/email.worker.ts`.
- Refresh tokens are stored hashed (SHA-256) in the `tokens` collection and rotated
  on every refresh; reuse triggers revocation of all user sessions.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. This project uses Express 5
  (served through Bun's node:http compatibility layer via `app.listen`) because it
  was already part of the scaffold — that is the accepted exception here.
- `Bun.password` for password hashing (bcrypt). Don't add bcrypt/bcryptjs/argon2 packages.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- Redis is accessed through **BullMQ**, which requires `ioredis` internally — that is
  the only accepted use of ioredis. Don't add ioredis elsewhere.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
