# Dim regression repair

Base: `6d42e8af4deccab6f4c94debe99284c0b2073606` (merged navigation 2.0.0). This branch is review-only; no merge, deployment or Pages setting change.

## Historical failures

The untouched base reproduces seven failures (`baseline.tap`: 20 pass / 7 fail). Approved commits `26711cb5766922bf01567bfa55cba5209463158d` and `f9942d95ebef9e51b237cf679029e6e38bc78952` changed 17 market input defaults and the date label. Later historical normalizers did not reverse those exact changes. This broke first-run, UI, navigation and price-metadata source hashes and prevented dim-nav's module from loading. Once repaired, nav140 also exposed its frozen copy of the price-metadata browser assertion, whose date had legitimately changed in f9942d9.

`market-changes.json` records only those exact changes. The source tests prove its reversal recreates the original parent commit byte-for-byte, check merge ancestry and mutate each input to show unrelated edits cannot pass. Historical baseline hashes remain unchanged. The contrast CSS fix is already recorded by the existing UI manifest and is preserved.

The first-run browser harness now explicitly serves an input-only historical price fixture for like-for-like old numeric oracles, mocks the exact catalog endpoint before loading, and records original/served hashes. Its exact reviewed changes are reversible for the nav140 frozen QA-file guard; that original hash is still asserted. Current production defaults are independently asserted and used by the raw import/export suite.

## Real importer defects

A complete JSON file with a null numeric field was silently accepted as zero. Empty/structured numeric values are now rejected; legitimate numbers, zero and comma-formatted numeric strings remain accepted. Duplicate row IDs and malformed CSV quotes, duplicate/empty headers and wrong column counts are rejected before state is applied. Formulas, storage keys, export formats, price defaults, theme, public paths and navigation artifacts are unchanged. The three exact validation/parser edits are recorded in `import-changes.json`; reversing them reproduces the full deployed HTML SHA-256 `4d1f3e55a133992580ffcbd47ee925aa7cf609317b0228dc9d9040d015529af5`.

## Validation

- Complete source suite: 41 passing tests (all historical assertions plus raw importer/provenance mutation tests).
- `tests/import-export.browser.cjs`: raw candidate, actual downloads/file chooser, JSON/CSV/XLSX roundtrip and XLS import, malformed/partial/duplicate files, atomic rejection/storage preservation, reload, reset cancellation, version warning and spreadsheet script failure at 320/390/1440px.
- `tests/dim-nav.browser.cjs`: full original numeric/state/navigation/format/metadata matrix at 320/360/390/430/768/1440px; exact historical source and asset guards remain. `QA_WIDTHS` shards only that fixed set.
- First-run: 360/390/768/1440px; UI: four calculation cases and three geometry/keyboard/accessibility probes; dynamic nav: catalog updates, hostile input, timeout, offline, focus and mobile.

Local executor access to the production SheetJS CDN is blocked (403). Local compatibility runs use the genuine npm SheetJS 0.18.5 parser, not a stub. The dedicated read-only repair CI downloads production SheetJS 0.20.3 from its exact existing CDN URL, verifies its runtime version, records its hash, and runs the raw and historical browser suites against it. A failed download fails CI; there is no silent parser-version fallback. The initial implementation CI passed production 0.20.3 acquisition/version verification and all raw import/export checks. Final exact-head CI results and the full historical matrix are tracked in the PR; in-progress checks must not be treated as passed.

Run `node --test tests/*.test.cjs`. See `.github/workflows/repair-qa.yml` for pinned Playwright 1.55.1, historical archive SHAs and reproducible complete browser commands. CI uploads reports/downloads/screenshots even after failure. Local logs are evidence of their stated environment only.

Rollback is an ordinary revert of this repair after review. It would reintroduce the malformed-import bug and stale test failures; it does not migrate or remove saved data. Existing navigation 2.0.0 and all previous releases remain untouched.

Local completed evidence: `import-export-before.log` reproduces null acceptance on pristine deployed base; `import-export-candidate-final.log` passes all three viewports. `first-run-report.json` and `ui-cohesion-report.json` retain exact before/after outputs and original/served fixture hashes. `local-evidence.json` records their hashes and implementation commit. Full historical reports and screenshots are retained by CI artifacts.
