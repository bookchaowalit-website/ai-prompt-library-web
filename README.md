# Prompt Workbench

A local prompt recipe shelf: browse four sample recipes by stage and area, search them, edit and copy the exact
instruction, and add or remove your own. Everything you change is saved only in this browser (localStorage).

Live: https://prompt-library.bookchaowalit.com (deployed by Vercel CLI; it can lag `main`, see `PRODUCT.md`).

## What it does not do

- No model API, prompt execution or output. No placeholders filled in, version history, ratings, sharing or sync.

## Run

```bash
npm ci
npm run dev
```

## Checks

```bash
npm test           # Vitest: recipe logic, local store, MCP route, home page render, Sentry scrubbing
npm run lint
npm run typecheck
npm run build
```

CI (`.github/workflows/ci.yml`) runs the shared Node workflow (with a line-coverage gate) and the shared security
scan on every push and PR to `main`.

## Code map

- `lib/prompts.ts`: sample recipes, filter/count/select rules, editor draft rule, recipe edits and the storage
  format (used by the page and the MCP route).
- `lib/local-store.ts`: a small localStorage store for `useSyncExternalStore` (copied per repository, not a package).
- `app/api/mcp/route.ts`: stateless JSON-RPC endpoint with `get_all`, `get_by_id` and `search` over the samples.
- `lib/sentry.ts` + `instrumentation*.ts`: error reporting to Sentry, errors only, personal data stripped; off when
  `NEXT_PUBLIC_SENTRY_DSN` is unset.
- `app/more-projects/page.tsx`: shared portfolio link page (copied per repository, not a package).
