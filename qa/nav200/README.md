# Dynamic navigation migration

Install the immutable Portal 2.0.0 release in `assets/ro-suite/2.0.0/`; only the local module reference in root `index.html` changes. Stable ID `dim-glacier`, light host theme, root publishing location, URLs and all calculator/storage/import/export code remain unchanged. There is no deployment or Pages configuration change.

The component renders its bundled fallback immediately, then fetches `https://econds.github.io/ro_tools_portal/catalog/v1/tools.json` automatically on connection. Central schema v1 catalog-only updates require no further child release. Failed/invalid requests retain fallback. Planned entries are not links. The local script-failure Portal anchor remains.

Deploy the Portal catalog first after review, then independently approve and roll out child PRs. To roll back, restore the single module path to `./assets/ro-suite/1.5.1/nav.js`; every previous release remains intact. No merge/deployment is performed by this branch.

## Validation

`node --test tests/nav200.test.cjs tests/nav150.test.cjs` checks raw candidate markup, release hashes, and exact reversal to current main's HTML plus every existing asset. `NODE_PATH=/path/to/playwright/node_modules node tests/nav200.browser.cjs` runs 320/390/1440px integration checks with the exact central endpoint mocked **before** navigation. It changes only remote response data between reloads of the same bundle to prove catalog updates without a child rebuild, including 126 tools, search, current identity, rename/removal/reorder, keyboard, offline, invalid data, timeout and blocked local script. Calculator persistence and actual JSON downloads are exercised.

The full historical suite already fails seven checks on untouched main commit `08d2d0e7c70a7057dce5272abe2e44716fcb927c`: dim-nav test loading, first-run exact delta, nav130 rollout, nav140 reversal, two price metadata guards, and ui-cohesion exact delta. These arise from pre-existing main HTML drift versus historical normalizers/hashes. Those assertions are retained, not rewritten to bless drift. The new baseline guard locks all current application bytes. Scoped v2 CI runs applicable passing historical theme guards and new integration checks; legacy browser runner is updated for v2 fetch/search but retains its historical baseline comparisons.
