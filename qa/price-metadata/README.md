# Price metadata and form labels QA

Base: `927e6b1d25a8ab59aa4a67b08acf9db26119d916` (main), clean fresh checkout.
Publishing remains repository root at `/dim_glacier_planner/`.

## Baseline and permitted change inventory

- `baseline.json`: pre-edit source hash, all original input markup/default values, labels, storage/format/reset inventory. It also identifies earlier browser results; those are historical evidence, not a claim that this task's new browser replay ran before implementation.
- `baseline-tests.log`: actual pre-edit `node --test tests/*.test.cjs` (11 passed).
- `permitted-changes.json`: exact reversible production edit inventory. Tests undo only these edits and require the reconstructed source to match the pre-edit hash and the older nav-era invariants. No production asset, default input value, parser, calculation, or export function is replaced by a test fixture.
- The PR workflow archives the immutable base commit and runs that actual application before testing the candidate. Real before/after output snapshots, original exported files, and screenshots are saved in the run artifact, not synthesized from expected values.

## Metadata contract

The existing `dim-glacier-planner-state-v1` localStorage record retains version 1 and all old values/fields. An optional `metadata.priceLastModified` ISO UTC timestamp is saved locally only. It is rendered in browser-local time using Thai Buddhist dates; no timezone is hardcoded by the application.

All 18 market price/exchange-rate fields stamp only when their parsed effective numeric value changes. Formatting-only, unchanged, composing, and non-price events do not stamp. The existing blur normalization remains intact. Committed composition changes are tracked after the existing composition handler.

Reset retains the existing full reset semantics and clears the timestamp. Old records without metadata and malformed timestamps display `—` without losing prices. Successful imports use the current import time, ignoring file metadata. Existing imports require a complete template; partial/non-price-only imports remain rejected and leave state/time unchanged.

JSON/CSV/XLSX export formats are unchanged and omit this local metadata. JSON/CSV/XLSX import and existing legacy XLS import remain supported.

## Accessibility

21 new native associations: 18 market price/rate fields and 3 refine numeric controls. Existing select labels remain intact. IDs, types, input modes, parsing and comma formatting are unchanged. Browser checks inspect `input.labels`, dangling `for` references, duplicate IDs, and click every numeric label to verify focus on both desktop and mobile.

## Verification and limits

Run `node --test tests/*.test.cjs` for static/helper checks.

Run `PRICE_METADATA_QA=1 BASE_ROOT=<archived-base> BASE_SHA=927e6b1d25a8ab59aa4a67b08acf9db26119d916 SOURCE_SHA=<head> QA_OUTPUT=qa-artifacts NODE_PATH=<Playwright 1.55.1 modules> node tests/dim-nav.browser.cjs` for real Chromium regression and new metadata coverage.

The read-only feature-branch PR workflow installs pinned QA-only tooling; it cannot push or deploy. Its artifact contains report.json, source commit, changed files, logs, sample exports/imports, and screenshots. Local Chromium launch was attempted and failed with `socket() failed: Operation not permitted`; only actual CI browser outcomes count as browser passes.

Desktop and mobile contexts exercise distinct local timezones. Production has a fixed light theme; system dark preference must not alter it. Existing original mobile overflow is measured and allowed only up to the observed base value. The additional metadata line intentionally changes vertical dimensions, so the original geometry guard retains horizontal dimensions, overflow, collision and nav/header-overlap checks rather than requiring unchanged card heights.

Not covered: physical devices, Firefox/WebKit, actual screen-reader speech, installed-PWA contexts, and post-merge production Pages. Exact suite destination URLs are activated against intercepted QA landing pages; external destination availability is not claimed.
