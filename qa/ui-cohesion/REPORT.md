# Dim Glacier Planner — first-run UI cohesion

Presentation-only pass on top of the first-run flow. No formula, price, storage, import/export, shared-nav or script change.

## Method
- Previous revision `a381113` is the immutable "before" (`baseline.json`); every edit is an exact `[before, after]` pair in `changes.json`.
- `normalize.cjs` reverses only those pairs, so all historical byte-invariant tests still see their original bytes. The new style block is `<style id="ui-cohesion">` (source: `ui-cohesion.css`); existing style blocks and every inline script are byte-identical.
- `tests/ui-cohesion.test.cjs` (structure/guards) and `tests/ui-cohesion.browser.cjs` (before/after calculations + layout/a11y probes) are new. Results: `regression-results.json`. Screenshots: `screenshots/before-*` / `after-*` (1440 and 390).

## Changes
- Start cue is one compact strip (duplicate "pick 2 fields" line removed; not-live-price line kept). The "#card_plan" skip link is hidden under 1100px where the planner is directly below.
- Current/target selects sit in a tinted group with larger labels and 44px selects; presets moved under them, outlined and quiet; active preset = tinted + check + 2px border (not fill-only). Mobile presets are a 2×2 grid (3 rows → 2).
- Stepper states: done = check badge, todo = solid accent, skipped = dashed, current = underlined label, target = `▸` marker; legend updated. Hover scale removed, ring weight reduced, label/badge contrast raised.
- Desktop columns swapped: planner + result left (main pair), narrow 380px sticky price/tools rail right. Mobile order is unchanged except tools now come after the best-price table.
- Per-card costs are muted (15px); the grand total is the only large figure (`clamp`ed so it never overflows at 360px).
- Shopping list: columns size to content, cost darkened for contrast, active view toggle has a check mark.
- Refine: `id="card_refine"` added; neutral border/header and smaller title so it reads as an optional add-on.
- Price card: meta on one muted line, warning kept visible, summary is a bordered "แก้ราคาตลาดและอัตราแลกเปลี่ยน (ไม่บังคับ)" button (still a native `<details>`, closed by default).
- Data tools: moved last, all buttons same outline weight (import no longer filled), no hover lift.
- `focus-visible` outline for buttons/selects/inputs/summary; method selects 36px min.

## Known limits
- `cdn.sheetjs.com` is blocked in the authoring sandbox, so the XLSX/XLS parts of `tests/dim-nav.browser.cjs` could not run here (50 identical failures before and after). Run it in CI.
- White text on the existing accent `#2980b9` is 4.3:1 (below AA for small text); left as-is to keep the palette.

## Follow-up: page frame
- Full-bleed shared nav (host-side margin/padding only; nav component and its host CSS untouched) and a slim title band (icon + h1 + one-line subtitle) replace the centred bare `<h1>`. Screenshots: `screenshots/frame-1440.png`, `frame-390.png`.
- Fonts: IBM Plex Sans Thai (body) and Bai Jamjuree (headings, costs, total) — the same pair the Reform page uses — are bundled in `assets/fonts/` (OFL, Thai + Latin, `font-display: swap`), so there is no third-party font request. The pinned shared-nav host stack names `'Sarabun'`; a `'Sarabun'` `@font-face` alias pointing at the Plex files keeps the nav in the same face without touching nav/host CSS or its audit. Body size is 15px.
- Test harness: `ui-cohesion.browser.cjs` now uses a fresh browser context per case (state could leak between cases and cause an intermittent mismatch).
