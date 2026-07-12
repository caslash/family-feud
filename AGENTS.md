# Repository Guide

This is a Turborepo-managed monorepo using npm workspaces. It houses **Family
Feud** — a real-time, room-based multiplayer implementation of the game show.

## What We're Building

A single game of Family Feud runs inside a **Socket.io room** managed by the
server. Three kinds of client join the same room, each with a distinct job:

- **Board display** — a passive screen (think the TV in the room) that renders
  the game board and each team's score. Display only; it sends no game input.
- **Host console** — the emcee's device. It drives essentially everything:
  starting the game, opening the buzzer, marking answers correct/wrong,
  revealing slots, awarding strikes, advancing rounds, and running Fast Money.
- **Team players** — one per team (`home` / `away`). Their only job is to buzz
  in during the face-off (and choose play/pass when their team wins control).

### Architecture

The design is **server-authoritative**. All game state and rules live in a
single **XState v5** state machine instance running on the server — one machine
per room. Clients are thin Socket.io consumers: they emit events and render the
snapshots the server broadcasts back. There is **no game state machine on the
client**. The `apps/api` server owns room lifecycle (creation, membership,
teardown) and is the only source of truth for scores, the board, and whose turn
it is.

```
host / board / players  ──Socket.io events──▶  api (XState machine per room)
        ▲                                                    │
        └──────────────  state broadcasts  ◀─────────────────┘
```

### Questions

The board's questions and answers are supplied to the machine when a round
starts (via the `HOST_START_GAME` event), so the machine stays agnostic about
question *content*. The intended source is a large Family Feud question/answer
dataset (originally a Google Sheet) that will be loaded into a **PostgreSQL**
database. **The `apps/api` server fetches questions from Postgres** (the host
requests a question and the server pulls it and feeds it into the machine) — the
web clients never talk to the database directly. That persistence layer does not
exist yet.

### Tech Stack

| Layer          | Technology                                   |
| -------------- | -------------------------------------------- |
| Frontend       | Vite + React + TypeScript (`apps/web`)       |
| Backend        | NestJS (`apps/api`)                          |
| State machine  | XState v5 (server-side, one per room)        |
| Real-time      | Socket.io                                    |
| Shared types   | `@family-feud/types`                         |
| Monorepo       | Turborepo + npm workspaces                   |
| Tests          | Vitest                                       |

### Apps at a glance

- **`apps/web`** — a single Vite + React frontend that serves all three client
  types as different views/routes (host console, board display, player buzzer),
  each connecting to the same room. (No app-level guide yet.)
- **`apps/api`** — the NestJS server: the XState game machine plus the Socket.io
  room layer. See [`apps/api/AGENTS.md`](apps/api/AGENTS.md) for its conventions,
  the machine design, and the target multiplayer wiring. **Read it before working
  in the API.**

When an app has its own `AGENTS.md` (surfaced to agents via a `CLAUDE.md` that
`@`-includes it), read that guide before working inside the app.

## Topography

```
apps/
  web/            Vite + React + TypeScript frontend
  api/             NestJS backend
packages/
  types/          Shared TypeScript types consumed by both apps
```

- `apps/*` are deployable applications.
- `packages/*` are internal libraries consumed by one or more apps via npm
  workspace references (e.g. `"@family-feud/types": "*"`). They are not
  published externally.
- Workspace packages are named `@family-feud/<package>` (e.g.
  `@family-feud/web`, `@family-feud/api`, `@family-feud/types`).
- Cross-package imports must go through a package's declared entry point
  (e.g. `@family-feud/types`), never via relative paths that reach into
  another workspace's `src/`.

## Tooling

- **Package manager**: npm (workspaces). Run installs from the repo root —
  do not run `npm install` inside individual `apps/*` or `packages/*`
  directories.
- **Task runner**: Turborepo (`turbo.json` at the repo root). Common tasks
  (`build`, `dev`, `lint`, `test`, `typecheck`) are defined per-package in
  each package's `package.json` and orchestrated across the workspace via
  `npm run <task>` at the root, which delegates to `turbo run <task>`.
- **Language**: TypeScript in all packages.
- Any new app or package should follow the existing pattern: add it under
  `apps/` or `packages/`, give it a `@family-feud/<name>` package name, and
  implement the standard task scripts (`build`, `dev`, `lint`, `test`,
  `typecheck`) so it participates in the root Turborepo pipeline
  automatically.

## Adding a new package

1. Create the directory under `apps/` (deployable) or `packages/`
   (internal library).
2. Add a `package.json` with a `@family-feud/<name>` name and the standard
   scripts used by sibling packages.
3. Reference other workspace packages with `"@family-feud/<name>": "*"` in
   `dependencies`/`devDependencies` rather than relative paths or published
   version ranges.
4. Run `npm install` from the repo root to link the new workspace.

## Repository

- **Remote**: [`caslash/family-feud`](https://github.com/caslash/family-feud)
  (`origin`), public.
- **Default branch**: `main`.
- **Code owners**: `.github/CODEOWNERS` assigns `@caslash` as the owner of
  everything, so their review is required on every pull request into a
  protected branch.

## Git branching

- `main` — always deployable. Releases are cut by merging `develop` into
  `main`.
- `develop` — permanent integration branch. All feature work branches off
  `develop` and merges back into `develop` when complete.
- Work branches are short-lived and branch from `develop`, not `main`.

### Branch protection

Both `main` and `develop` are protected by repository rulesets:

- Neither branch can be deleted or force-pushed.
- Direct pushes are blocked — all changes must land through a pull request
  with at least one approving review from a code owner (`@caslash`).
- Repo admins may merge their own PRs without a second approver, but the
  bypass applies only within a PR; direct pushes and deletion remain blocked
  for everyone.
- **`develop`** additionally requires a **linear history** and restricts the
  merge method to **squash only**.
- **`main`** allows merge commits, since releases are integrated by merging
  `develop` into `main`.
