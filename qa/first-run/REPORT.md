# dim_glacier_planner first-run UX

## Baseline
Clean default branch at `53f41ce9878cd139c14679879b80850cd2df6f1e` archived before edits. Existing unit checks passed on untouched source. Before browser evidence uses that immutable archive, never the candidate with features removed. See `baseline.json` for structural inventory and `local-first-run-results.json` for exact source hash, widths, measured geometry and three before/after output cases.

## Changes
Planner now precedes settings in DOM/mobile while desktop retains the original two-column arrangement. Market price metadata and warning stay visible outside a new native price disclosure. Exact total card moves ahead of shopping and optional Refine. Its old sticky-bottom placement overlapped the newly earlier planner during actual mobile QA, so only that moved total is made static. The existing hover-to-market-row workflow opens the native price disclosure before its original scroll logic. All 21 associated numeric labels and price timestamp behavior remain unchanged.

## Actual verification
- `node --test tests/*.test.*`: 20 tests (final result also in CI)
- `BASE_ROOT=… node tests/first-run.browser.cjs`: PASS at360/390/768/1440 and all configured real app themes, native keyboard paths, view-only storage/output invariants, no added overflow, IDs/native labels valid;3 exact before/after calculation snapshots passed
- `node tests/dim-nav.browser.cjs`: existing full functional/nav/fallback suite rerun; see final-head CI logs for authoritative outcome and full details
- Immutable shared navigation1.3 hashes, default data/formulas and all old calculation fixtures remain tested
- Historical whole-page invariant checks now first reverse only `changes.json` before checking their historical hashes. This keeps approved presentation edits explicit and preserves original business/data byte checks

## Evidence
The final geometry collector uses `Element.checkVisibility()` and excludes descendants of closed native details. Counts are rendered controls anywhere in the page, not a claim that all are in the first viewport; minimum required inputs are documented separately.
Before/after390/1440 screenshots are lossless WebP conversions of actual Chromium viewport captures. All widths/themes and source-linked outputs are in local JSON and final-head CI artifacts. No human usability study or conversion claim.

## Limitations and findings
Real devices, WebKit/Firefox and post-merge Pages not tested. Local Dim SheetJS CDN requests returned `ERR_EMPTY_RESPONSE` in Chromium, so local XLS/XLSX checks are not claimed passed; final CI must exercise real CDN/format round trips before readiness. Other existing limitations remain out of scope.

## Rollback
Revert feature commit. No storage migration, schema, tool-ID, URL, game-data, formula or nav release changes. Draft only; do not merge before suite review.

## New-control contrast audit
New Dim text controls use the existing primary text token; the new Ocean lore disclosure uses the existing dark accent token. Actual computed colors and source contrast assertions meet4.5:1 for normal text. These changes do not change the palette, navigation, or existing controls. Full app WCAG certification and audible screen-reader testing are not claimed.
