# Repository Guide

This is a Turborepo-managed monorepo using npm workspaces.

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

## Git branching

- `main` — always deployable. Releases are cut by merging `develop` into
  `main`.
- `develop` — permanent integration branch. All feature work branches off
  `develop` and merges back into `develop` when complete.
- Work branches are short-lived and branch from `develop`, not `main`.
