# Prompt Library — Design

Since 2026-11-19 the library uses the shared **App shell** (see `APP-SHELL.md`; `app/app-shell.css` and
`components/app-shell.tsx` are copied byte for byte from productivity-ideas-web). It replaced the earlier dark
"cue wall" look, whose 9–10px mono labels, 26px filter pills, one rose colour for every stage, tall phone hero and
mixed cue/recipe/cut wording failed the design floor (review 2026-11-11).

- Sidebar of stages (All / Draft / Refine / Ready / Retired with counts; a pill row on phones). Each stage has one
  tone used by its sidebar dot and its row pill: Draft grey, Refine amber, Ready green, Retired red (text + tint,
  never colour alone).
- Head: the stage as h1, one count line ("4 recipes", or "Showing 1 of 4 recipes" when filtered), search and
  **New recipe**. One word throughout: recipe.
- Area filter is a 44px segmented control (two columns on phones).
- The composer opens in place, focuses Name, and keeps Add disabled until name and instruction have text.
- Rows open in place (accordion, `aria-expanded`): editable instruction, **Save revision** (disabled until the
  text changes), **Copy exact text**, **Remove** (undoable for six seconds, no confirm dialog).
- Empty states differ for "No recipes yet" and "No recipe matches" (with Clear filters).

Floor: Geist via `next/font` (variable on `<html>`), text ≥ 12px, controls ≥ 44px, 4.5:1 text contrast in
light and dark, 3px focus ring, forced-colors support, no horizontal scroll at 320px. `/more-projects`
redirects (308) to https://bookchaowalit.com/ and the footer links there. Canonical domain, robots.txt and
sitemap.xml: https://prompt-library.bookchaowalit.com.
