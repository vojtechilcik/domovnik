# Domovník

**Domovník** ("building caretaker") is a cross-platform property-management application for the Czech rental market, serving small-to-medium landlords (1–50 units) and their tenants.

This is a **monorepo** built with pnpm workspaces. It shares TypeScript domain logic, design tokens, and Czech-localized strings across four platform apps and a server backend.

---

## Repository structure

```
domovnik/
  apps/
    mobile/          # Expo (iOS + Android) — React Native
    desktop/         # Tauri 2 + React (Windows + macOS)
    server/          # NestJS API + agent worker
  packages/
    core/            # Domain types, zod schemas, business logic, parsers
    ui/              # Design tokens (colors, typography, spacing)
    i18n/            # Czech string catalogue (cs-CZ)
  .github/workflows/ # CI (GitHub Actions)
```

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Docker** (for the backend — Postgres)
- **Tauri prerequisites** ([Windows](https://v2.tauri.app/start/prerequisites/#windows) / [macOS](https://v2.tauri.app/start/prerequisites/#macos))
- **Expo CLI** for mobile development (installed via pnpm)

---

## Local setup

### 1. Clone and install

```bash
git clone <repo-url> domovnik
cd domovnik
pnpm install
```

### 2. Typecheck, lint, test (everything passes on first checkout)

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

Or run all checks in one command:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

### 3. Start the server (NestJS)

```bash
cd apps/server
pnpm dev
```

The health endpoint is at `http://localhost:3000/health`.

### 4. Start the desktop app (Tauri)

```bash
cd apps/desktop
pnpm dev          # Vite dev server on http://localhost:5173
pnpm tauri dev    # Full Tauri window
```

### 5. Start the mobile app (Expo)

```bash
cd apps/mobile
pnpm start        # Opens Expo dev tools — scan QR with your phone
```

---

## Environment variables

| Variable           | Description                |
| ------------------ | -------------------------- |
| `DATABASE_URL`     | Postgres connection string |
| `JWT_SECRET`       | Access-token signing key   |
| `JWT_REFRESH_SECRET` | Refresh-token signing key |
| `LLM_API_KEY`      | AI provider API key        |
| `STORAGE_ENDPOINT` | Object-storage endpoint    |

---

## Design decisions

- **pnpm workspaces** — fast, strict, disk-efficient monorepo.
- **NestJS** — structured, opinionated backend framework with decorator-based auth guards.
- **Tauri 2** — smaller binaries than Electron; wraps the same React web UI.
- **Expo managed workflow** — one React Native codebase for iOS + Android.
- **zod** — runtime validation of all domain types and agent JSON outputs.
- **Vitest** — fast, Vite-native test runner for all packages.
- **Prettier + ESLint** — auto-formatting and linting with TypeScript strict mode everywhere.

---

## Version choices (pinned)

| Tool        | Version      |
| ----------- | ------------ |
| Node.js     | ≥ 20         |
| pnpm        | ≥ 9.0        |
| TypeScript  | 5.7.x        |
| React       | 19.x (desktop), 18.x (mobile) |
| Expo SDK    | 52           |
| NestJS      | 11.x         |
| Prisma      | (Phase 2)    |
| Vitest      | 2.1.x        |
| Vite        | 6.x          |
| Tauri       | 2.x          |

---

## License

Proprietary — all rights reserved. This is a production application under active development.