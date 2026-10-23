# Prompt Workbench — Product truth

> Inferred from the code and copy (no user interview). Checked against the portfolio card claims review
> (`portfolio-site-web/docs/audits/CARD-CLAIMS-REVIEW-2026-10.md`, row `prompt-library`, evidence Prototype) on 2026-10-23.

## What it is

A client-only prompt recipe shelf: four authored sample recipes that a visitor can browse, edit, copy, add to and
remove, saved only in that browser's localStorage.

## Who it is for

A solo builder (or a portfolio visitor) who reuses a few prompt instructions across engineering, research and writing
work and wants the exact text easy to find and copy.

## What works today

1. Filter recipes by lifecycle stage (Draft, Refine, Ready, Retired, with counts) and by area (Engineering, Research,
   Writing); search title, purpose, instruction text and area (case-insensitive).
2. Open a recipe, edit its instruction, save the revision in this browser, or copy the exact text to the clipboard.
   An unsaved edit belongs to the recipe it was typed in and is dropped when another recipe opens.
3. Add a recipe (name and instruction required, purpose optional) or remove the open one.
4. Saved recipes are read back on reload; malformed saved entries are skipped instead of crashing the page.
5. `/api/mcp` answers JSON-RPC with `get_all`, `get_by_id` and `search` (text, stage, area) over the four sample
   recipes. Recipes a visitor adds or edits stay in their browser, so the server cannot see them.
6. Front-end and server errors go to Sentry (errors only, personal data stripped) when `NEXT_PUBLIC_SENTRY_DSN` is set.

## What does not work (and must not be claimed)

- No variable placeholders filled in, version history, ratings, forking, URL sharing or "200+ tested prompts"
  (claims removed from the portfolio card in the 2026-10 review). `{{...}}` markers are plain text.
- No model connection: nothing runs a prompt or shows an output. No account, sync or export.

## Live URL and deploy state

- Live: https://prompt-library.bookchaowalit.com (HTTP 200 on 2026-10-23).
- The Vercel project `bookchaowalit-prompt-library-frontend` is deployed only by CLI (last production 2026-10-23,
  the CVE patch commit 51b987b) and its Git link names the old repository
  (`bookchaowalit/bookchaowalit-prompt-library-frontend`), so a push to `main` does not deploy. The live site lags
  `main` (no Sentry, old template MCP route, the stale-editor fix) until the owner reconnects Vercel Git to this
  repository (owner action D9). `NEXT_PUBLIC_SENTRY_DSN` is set on the Vercel project (Sentry project
  `ai-prompt-library-web`, org `personal-yu0`).

## Boundaries

- Browser-only apart from the stateless `/api/mcp` route. Design notes live in `DESIGN.md`.
