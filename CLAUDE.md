# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package manager

- **pnpm only.** `preinstall` runs `only-allow pnpm`; using npm/yarn aborts the install.
- `.npmrc` pins the registry to `https://registry.npmmirror.com/`.
- CI is locked to pnpm **v8** — don't bump it without updating `.github/workflows/*.yml`.

## Build & develop

- `pnpm esbuild:base` — bundle once via `scripts/esbuild.ts` (tsx-driven esbuild, NOT `tsc`).
- `pnpm esbuild:watch` — watch mode used by the **F5 debug** preLaunchTask.
- `vscode:prepublish` re-runs the build with `--minify`; never publish without it.
- `stale-dep` runs before `esbuild:base` and `test`, and `postinstall` runs `stale-dep -u`. If a script complains about stale deps, run `pnpm install`.

## Tests

- Framework: **Mocha + @vscode/test-electron** (no Vitest/Jest).
- `pnpm test` does `clean → tsc -b ./test/tsconfig.json → node ./out/test/runTests.js` — it must compile to `out/` before running. There is no `--watch` test mode.
- Tests live in `test/*.test.ts`, fixtures in `test-workspace/`.
- To focus a single test, use Mocha's `it.only` / `describe.only` in source — there's no CLI flag wired up.

## Lint & type-check

- `pnpm lint` runs `eslint src --ext ts` — **only `src/`** is linted (not `scripts/`, not `test/`).
- `src/jsUnicodePreview/` contains `.js` files and is intentionally excluded via `eslintConfig.ignorePatterns`. Don't lint or rewrite that subtree casually.
- No standalone type-check script — `tsc -b ./test/tsconfig.json` (run by `pnpm test`) is the de-facto type check.
- Pre-commit hook (`simple-git-hooks` + `lint-staged`) auto-runs `eslint --fix` and `prettier --write` on staged `*.{js,ts,json,md}`.

## Packaging & release

- `pnpm package` → `vsce package --no-dependencies`. The **`--no-dependencies` flag is required** (pnpm's symlinked `node_modules` breaks vsce's default dep walk).
- Release flow: `pnpm release` (bumpp) bumps `package.json` and tags `v*`. Pushing the tag triggers `.github/workflows/publish.yml`, which publishes to **both** VS Marketplace (`VSCE_PAT`) and Open VSX (`OVSX_TOKEN`). Don't run `publish:*` scripts manually unless CI is broken.

## Conventions

- **Conventional Commits** prefixes used in this repo: `feat:`, `fix:`, `refactor:`, `build:`, `docs:`, `release:`. Match the existing style.
- Extension activates on `onStartupFinished`; entry is `src/extension.ts` → `out/extension.js`. New commands must be registered in both `src/extension.ts` and `package.json#contributes.commands`.
