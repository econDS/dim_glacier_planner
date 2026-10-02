# Dim Glacier navigation QA

This directory freezes the original application and documents a navigation-only integration. The reviewed baseline is the latest Thai-interface commit `7794dc7a1381c9a8aac2fc728d305b779a099ebc` (`ui: localize planner interface in Thai`), whose parent is `911afcf30986e310e5cca233a678aebd3212ca1e` (`feat: add enchant planning and shopping list`). Do not use the parent as the visual/Thai-text baseline.

## Original application and commands

The publishing root is the repository root; entry point is `index.html`. Public URL: <https://econds.github.io/dim_glacier_planner/>. The original `.claude/launch.json` starts `python -m http.server 8765`. There is no package manifest, build step, test suite, or CI workflow at the original baseline.

`source-baseline.json` was captured directly from the Git objects at the baseline commit. It contains SHA-256 hashes for the original HTML and all 19 image assets, exact inline CSS and script hashes, publishing details, the state schema, and supported application capabilities. The original HTML SHA-256 is:

`7761ae4e57c901e630a42577a59ef9ea46fbb15359e28acb7bc7310f1f9d23df`

The original body starts with the existing `h1`; there is no skip link or `header` element. The application is fixed light: body `#f4f7f6`, cards `#ffffff`, text `#2c3e50`, accent `#2980b9`. There is no dark-mode setting or system-color-scheme behavior.

## Source invariants

Run without dependencies:

```sh
node --test tests/dim-nav.test.cjs
# CI runs all source tests:
node --test tests/*.test.cjs
```

The same tests run during QA-only setup (navigation absent) and after integration. With no navigation, the entire original HTML must remain byte-identical. After integration, only the single navigation host, local module, and separately named fallback style are removed before comparing all original source; empty separator lines are ignored in that comparison. Original CSS and scripts are always separately compared byte-for-byte. Every original image is also byte-hashed.

The accepted host attributes are exactly `tool-id="dim-glacier"`, `theme="light"`, and `portal-url="https://econds.github.io/ro_tools_portal/"`. It belongs immediately after `body`, before the existing `h1`, with this light-DOM fallback:

```html
<nav aria-label="เครื่องมือ RO">
  <a href="https://econds.github.io/ro_tools_portal/">กลับ RO Tools Portal</a>
</nav>
```

Its only added script is `<script type="module" src="./assets/ro-suite/1.2.0/nav.js"></script>`, after the fallback. The only accepted fallback CSS is a separate `style` with ID `ro-suite-nav-fallback`, containing:

```css
ro-suite-nav > nav > a { display: inline-flex; align-items: center; min-width: 44px; min-height: 44px; }
```

No remote catalog, theme writer, calculator refactor, original CSS edit, URL mutation, iframe, or unrelated-storage clearing is introduced. The CI invariant requires a same-repository `feat/ro-suite-nav` pull request against `main`, read-only contents permission, SHA-pinned actions, checkout with `persist-credentials: false`, and no deployment/push/merge commands or secret references.

Local verification of the source suite passed 9/9 on the pristine application. A temporary synthetic integration fixture also passed 9/9; intentional mutations to a formula, storage key, Thai label, fallback selector, and remote catalog attribute each correctly failed. Synthetic fixtures are test-of-test evidence, not browser or deployment evidence.

## Immutable navigation release

The vendored directory is `assets/ro-suite/1.2.0/` with exactly three files. Tests check the complete file hashes and the lock's bundle hashes:

- `nav.js`: `d75be916445feb4febeaada437841a1b3be68db16a00673198c78fd6f6c8dc5f`
- `catalog.snapshot.json`: `800bb9c9d2b52a7fbae58e436b05529e69820fee3627d199da545a6f5e28f7dd`
- `nav.lock.json`: `3b0350135ba5f455b38799c7940492938a209e8e0a6570a5126cb40c36127358`

The reviewed release tag resolves to commit `df029e59f433d0a44be26798733df7a64bd049d4`. The immutable lock separately records component source commit `a3966bdda412f05b0756b5d139915e44894c0ee0`; these are distinct provenance fields, not interchangeable claims. The Dim Glacier catalog entry uses the existing public path, snowflake identity, and accent `#2b6fa3`. Grade & Refine remains planned with a null canonical URL. No release artifact is edited for integration.

## Browser regression scope

The browser harness is `tests/dim-nav.browser.cjs`; CI installs QA-only Playwright `1.55.1` outside the publishing root and archives the exact baseline Git tree into a separate directory. The workflow supplies `BASE_ROOT`, `BASE_SHA`, `SOURCE_SHA`, and `QA_OUTPUT`. Before production edits, it sets `BASELINE_ONLY=1`; after integration it compares current behavior with the same immutable baseline. The harness uses genuine clipboard and SheetJS behavior with real exported/imported files, including an import-only XLS fixture. Destination navigation interception verifies link targets only, not remote availability. Genuine XLSX tests fail if the SheetJS CDN is unavailable. Logs, screenshots, sample files, source SHA, and reports are uploaded even after failures. A not-run browser result remains a blocker, not a pass.

Browser checks should exercise the following actual features and compare baseline/current output:

- 25 state fields, market prices, exchange rate, formatted numeric typing/blur, Thai input composition, and recalculation
- Current/target stages `0..7`; presets `0→7`, `0→2`, `2→4`, `2→7`; stage stepper; target clamping; owned-weapon behavior
- Normal materials versus coupon methods for Slot 4 and Slot 3; one coupon versus two coupons respectively
- Finished/raw shopping lists, individual stage details, shopping/item clipboard, best-price table and ingredient tooltips
- Refine Cube count, Refinement Device count, and manual budget; include device acquisition and per-use consume costs
- Autosave/reload, native reset confirmation cancel/accept, malformed saved data, and unrelated localStorage preservation
- Supported file import/export and malformed import; both Excel available and unavailable branches
- Mobile/desktop geometry, keyboard focus/Escape/Tab, repeated menu open/close, navigation failure fallback, and Thai UI visibility

### Storage and file support

The sole application storage key is `dim-glacier-planner-state-v1`, in localStorage, with schema version `1`. Input/change autosave is debounced 150ms. Exports contain `version`, `exportedAt`, `app`, `values`, and `fields`. The finished/raw display choice is not persisted. Legacy `chk_s4`, `chk_s3`, and `sel_s2_lv` state is migrated into current/target stages.

- JSON: import and export
- CSV: import and export, columns `id,label,type,value`
- XLSX: import and export; export worksheet `PlannerData`, import first worksheet
- XLS: import only, not an export feature

Excel requires the pre-existing SheetJS dependency at <https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js>. If unavailable, Excel export reports a Thai error status and import produces a Thai alert/status; JSON/CSV and calculations do not require SheetJS. Reports must distinguish testing the genuine spreadsheet library and file bytes from a mocked availability/error branch.

Imports require all 25 fields. Unknown fields, invalid select values, negative numbers, noninteger quantities, and altered label/type metadata are rejected. Version differences warn. Original English field labels and supported Thai labels are accepted. JSON can be an export object, field array wrapper, or plain values object; table rows are supported for CSV/Excel. Native confirmation is used for reset and native alerts for invalid import.

### Formulas and unsupported modes

Best unit prices are the minimum of craft acquisition cost and market price; ties choose Market. Current stage above zero means the weapon is already owned, so its base cost is zero. Enchant cost is the sum of required steps after current stage through target. Refine cost is:

`cube count × CUBE + device count × (DEV + DEV_USE) + manual budget`

`DEV_USE` adds 40 petals and ten each of the best Encroached/Neutralized Magical Crystals per device. Total is base + enchant + refine. THB is total / 1,000,000 × entered exchange rate, displayed rounded to an integer. Raw shopping view recursively expands recipe quantities, but does not change the Enchant total.

An independent arithmetic oracle from original defaults is also recorded in the manifest: total `1,167,842,750 Zeny`, displayed `8,642 THB`; one device adds `32,071,000` refine cost. These are formula-derived expectations, not substitutes for browser observations.

There is no event/discount mode and no application share-URL feature. The application does not read/write query parameters, hashes, or browser history. Browser QA should verify that arbitrary incoming query/hash values remain intact and that navigation interactions do not acquire a new state-sharing interpretation; it must not claim to have tested nonexistent share or event controls.

## Rollback

Remove only the navigation host, local module, separate fallback style, and `assets/ro-suite/1.2.0/` when rolling back this integration. Preserve all original calculator code, Thai UI, storage schema, prices, formulas, original images, and publishing path. Re-run the source invariants after rollback; the pristine-source branch of the suite must pass.
