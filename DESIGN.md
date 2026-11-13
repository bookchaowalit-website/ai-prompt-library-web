---
name: Prompt Workbench
description: A staged cue wall for preparing, revising, and handing off prompt recipes.
colors:
  void: "#090d18"
  void-soft: "#111827"
  white: "#f3f3ec"
  white-soft: "#cdd4e0"
  line: "#3b485d"
  muted: "#aab5c7"
  cobalt: "#5276e8"
  rose: "#df7e96"
  day: "#e8eadf"
  amber: "#f0c869"
  danger: "#f09c86"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "clamp(3.35rem, 8vw, 6.5rem)"
    fontWeight: 560
    lineHeight: 0.88
    letterSpacing: "-0.085em"
  body:
    fontFamily: "Barlow Condensed, Arial Narrow, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  data:
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
    fontSize: "0.62rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  pill: "999px"
spacing:
  frame: "1220px"
  section: "84px"
  content: "20px"
components:
  active-stage:
    backgroundColor: "{colors.rose}"
    textColor: "{colors.void}"
    padding: "15px 16px"
---

# Design System: Prompt Workbench

## Overview

**Creative North Star: “The cue wall before the next scene.”**

Prompt Workbench translates prompt lifecycle into a stagecraft surface: a dark room, a horizontal cue rail, and a selected instruction under the working light. Draft, Refine, Ready, and Retired are operational phases, not scores. Cobalt and rose mark the horizon bands; amber marks the active handoff. The page is an index plus an editable work surface rather than a generic prompt-card grid.

## Rules

- The dark void is the working room; color belongs to lifecycle and action.
- Use mono for stage, area, dates, and exact instruction text; use sans for purpose and explanation.
- The cue rail is the navigation model. Selecting a phase changes the index without reloading.
- The instruction is always visible and editable before the copy handoff.
- No model output, quality claim, or API state is implied by the interface.


---

## Storybook

Storybook 10 (`@storybook/nextjs-vite`) shows this design system with the app's real CSS, tokens and fonts.

```bash
npm run storybook        # http://localhost:6006
npm run build-storybook  # static build in storybook-static/ (CI: .github/workflows/storybook.yml)
```

- **Foundations/Tokens** reads every CSS custom property the app defines at runtime, so it never drifts from the code.
- **Design/DESIGN.md** renders this file.
- **Components/**, **Sections/** and **Pages/** show the UI with mock data only (no network, analytics off).
- Toolbar: locale, theme (light / dark, when the app has a dark theme), viewports 320 / 375 / 768 / 1440. The a11y panel runs axe (WCAG 2.2 AA).
- Rule: a new shared component or page section ships with a story in `stories/`.
