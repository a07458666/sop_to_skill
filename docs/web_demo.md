# Web demo — page map and shared concepts

Extracted from CLAUDE.md (2026-07-04) to keep the root file lean. This is the
detailed reference for the static GitHub Pages demo. All shared logic lives in
`assets/app.js`, shared CSS in `assets/styles.css`; no build step.

## The four-step journey

A stepper shared by all pages: ① 編譯 → ② 看懂 → ③ 驗證 → ④ 優化, plus a
進階 · 治理 entry (`.gov-entry` link) below it. Page-aware init: `app.js` reads
`document.body.dataset.page` and runs `initConverter()` / `initSimulator()` /
`initOptimize()` / `initGovernance()`. Cross-page handoff via `localStorage`
key `sop_to_skill_state` (`persistState`/`loadState`).

## Pages

### Converter (`index.html`, steps ①②)
Two switchable panels (`showStep`): ① 編譯 — editor → compile → SKILL.md /
flow.json + a collapsed quality-report card with a live pass/fail badge
(`updateQualityBadge`; auto-expands on problems). ② 看懂 — the flow visualizer
(the hero) + node inspector. Marketing/概念 and the `sop_rule.md` authoring
editor are collapsed `<details>`. 「前往模擬器」(`goToSimulator`) persists state
and hands off to ③. `index.html#review` deep-links straight to step ②.

### Simulator (`simulator.html`, step ③)
Loads the compiled flow from `localStorage` (or paste → `loadPastedFlow`) →
execution simulator. Integration config + MCP mount live inside one collapsed
進階 `<details>`. Bottom CTA hands off to step ④.

### Optimize (`optimize.html`, step ④)
The SkillOpt-style optimization loop running fully in the browser — a JS port of
`optimizer.py` (the `// ==== optimizer` block in `app.js`: `oracleRun`,
`scoreFlowJs`, `detectGapsJs`, `candidateEditsJs`, `optimizeFlowJs`; parity
guarded by `tests/test_optimizer_parity.py` across all four bundled flows —
same accepted edits, rounds, rejected buffer, scores, final graph).

- Validation scenarios auto-seeded from the flow (`seedScenariosFromFlow`, one
  BFS path per end state; user-editable JSON, live re-scored on input).
- Demo: 「製造缺口」 drops a chosen transition (`optDropTransition`); 「一鍵示範」
  (`optAutoDemo`) picks a scenario-critical branch, drops it and optimizes in
  one click.
- Output: hero stat tiles (pass rate before→after + accepted edits;
  `optRenderHero`), per-scenario pass/fail table (`scenarioResults` /
  `optRenderScenarioTable`), collapsed per-round trace (gaps → top-3 candidate
  scores → strict-gate verdict; `result.trace`, a UI-only field), diff overlay
  on the graph, SOP-edit suggestions (`renderEvolveSuggestions`), download, and
  hand-off of old+new to governance via localStorage key
  `sop_to_skill_state:gov_handoff` (`optSendToGovernance`).

### Governance (`governance.html`, 進階 entry)
Paste two `flow.json` versions (old defaults from localStorage; or auto-filled
from the optimizer hand-off — `initGovernance` consumes `:gov_handoff` and runs
the diff immediately). Graph-level diff via the JS port of `flowdiff.py` (the
`// ==== flowdiff` block; parity guarded by `tests/test_flowdiff_parity.py`),
overlaid on the new flow graph (added=green / changed=amber), plus evolve
suggestions — the diff translated into reviewable SOP-markdown edits (the web
half of `evolve.py`'s close-the-loop; the auto-proposal loop stays in Python).

## Shared concepts (assets/app.js)

- **Tool catalog** (`toolCatalog`): simulated registry; each tool advertises a
  description + I/O schema and returns a realistic SQL-like result row.
  `getToolSpec` falls back to a generic schema for unlisted tools.
  `mockQueryResult(state, outcome)` → `{ok, data, interpretation}`;
  `isFailureOutcome(condition)` decides success vs failure (EN + 中文 keywords).
- **Integration config editor** (`integrationConfig` +
  `renderIntegrationEditor`): user-editable registry of MCP servers/tools and
  API tools with per-tool I/O fields and a `signal`. Seeded from `flow.json` on
  compile (`seedIntegrationFromFlow`). `getToolSpec` consults this config first
  (`findIntegrationSpec` → `specFromEntry`), so the mount panel, node inspector
  and simulator all reflect user edits after 「套用設定」.
- **MCP mount panel** (`renderMcpPanel`): mount/unmount configured servers;
  simulator MCP calls are blocked until the server is mounted (`mcpMounts`).
- **Flow visualizer** (`computeFlowLayout` + `renderFlowFromGeneratedJson`):
  layered (Sugiyama-style) layout — longest-path ranking from `start_state`,
  median/barycenter sweeps to reduce crossings; forward edges curve down with
  fanned connection points; back/loop edges route along the right margin (amber
  dashed). Nodes: accent bar + API/MCP badge + title + one meta line.
  **Do not regress this to the old row-major grid.** `computeFlowLayout` is pure
  (safe to run under Node for tests/visual checks).
- **Separator**: option values / dedup keys join `state_id` and `outcome` with
  `\u0001` — always the 6-char escape sequence in source, never a raw control
  byte (see docs/ops/DIAGNOSIS.md #3).

## Visual language (calm redesign, 2026-06)

One accent (`--primary` #7aa2f7) + neutral grays; low-saturation hues for
API (`--secondary`) / MCP (`--accent`) / status (`--green`, `--amber`). No
gradients, glows, or glass blur. Flow nodes: title + one meta line. Status
colors appear on borders/badges/sub-lines, not on body text or big numbers.
When adding UI, match this restraint; the reference for stat tiles/charts is
the dataviz skill's rules (values wear text tokens; color only for status).
