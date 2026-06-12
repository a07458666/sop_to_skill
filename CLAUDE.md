# CLAUDE.md

Project memory for the **SOP-to-Skill Compiler**. Read this first; it captures the
architecture, conventions, and verification workflow so a fresh session is productive
immediately.

## What this project is

An LLM-powered tool that converts human-readable Markdown SOPs (Standard Operating
Procedures) into a valid Agent **Skill directory**. It targets a semiconductor
fab/manufacturing investigation domain, but the compiler is generic.

Output Skill bundle per SOP:
- `SKILL.md` — Skill entrypoint (YAML frontmatter + execution instructions).
- `flow.json` — the state-machine graph (bundled resource).
- `sop_rule.md` — authoring rules (copied in).
- `sop_quality_report.md` — quality + API/MCP integration validation findings.

## Key files

- `parser.py` — the CLI compiler. Pydantic schema (`State`, `StateMachine`), a
  Gemini path (`GEMINI_API_KEY`) and an **offline heuristic fallback** parser
  (`offline_fallback_parse`) used when no key is set. Emits the Skill bundle.
  `assess_sop_quality()` builds the quality report including the API/MCP validation table.
- `executor.py` — the **runtime enforcement layer** (M1). `SkillExecutor` loads a
  `flow.json` (reusing the parser's schema) and enforces it as an execution contract:
  legal-only tool calls + outcomes, human-in-the-loop **approval gates** (explicit
  `state.requires_approval` wins; null falls back to `DEFAULT_APPROVAL_KEYWORDS`, e.g.
  hold/escalate/release), and a serializable audit trail.
  CLI: `--flow`, `--steps` (`;`-separated outcomes), `--auto-approve`, `--audit`.
- `optimizer.py` — **structured self-evolution** of a flow (M2.5), the structured analogue
  of SkillOpt. Proposes **bounded graph edits** (`Edit`: add_transition / set_signal_field),
  accepts one **only when it strictly improves a held-out validation score** (`score_flow`
  via an oracle agent through the executor), with a rejected-edit buffer and edit budget.
  Candidates come from `detect_gaps` (a validation rollout needing an undefined outcome);
  the gate uniquely selects the right target because downstream outcomes must also match.
  CLI: `--flow`, `--scenarios`, `--out`, `--budget`, `--drop` (demo aid to create a gap).
- `evolve.py` — **evolution closing-the-loop** (G2). Takes the optimizer's accepted graph
  edits and renders them back as a **SOP-markdown diff** (a reviewable `unified_diff` patch to
  the source `.md`), so the human-owned SOP stays the single source of truth and recompiles
  after approval. `apply_edit_to_markdown` maps a state id → its step section via
  `parser.make_state_id`; `evolve_sop()` runs compile→optimize→render. CLI: `--sop`,
  `--scenarios`, `--flow-key`, `--drop-branch` (demo), `--apply`.
- `mcp_server.py` — **executor as an MCP server** (G1). Wraps `SkillExecutor` and speaks
  MCP stdio (newline-delimited JSON-RPC 2.0) with no SDK dependency: `initialize`,
  `tools/list`, `tools/call`, `ping`. Tools: `sop_start`, `sop_current_state`,
  `sop_report_outcome` (rejects undefined outcomes, returns legal ones), `sop_request_approval`,
  `sop_call_tool` (gate-checks tool calls), `sop_audit_trail`. `handle()` is pure/unit-tested;
  `serve_stdio()` is the I/O loop a real agent client spawns. Run: `python mcp_server.py --flow ...`.
- `eval/` — the eval harness (M1). `run_eval.py` drives a deterministic noisy agent through
  `scenarios.json` (held-out `dev`/`holdout` split) in two modes (baseline = no enforcement,
  compiled = executor), proving compiled >> baseline on illegal-action / skipped-step /
  correct-end rates; writes `eval/results.md`. `--check` gates CI. Methodology aligned with
  SkillOpt (see `docs/ROADMAP.md`).
- `tests/` — pytest suite: executor behaviour, the eval invariant, **golden
  snapshots** (`parser.py` output must match the committed `skills/*` bundles), and
  **parity** (`assets/app.js` JS compiles SOPs to the same graph as `parser.py`, run
  under Node — the guardrail against the two implementations drifting).
- `index.html` (**Converter**) + `simulator.html` (**Simulator**) — the web demo, split into
  two GitHub Pages. Shared logic lives in `assets/app.js`, shared CSS in `assets/styles.css`
  (both pages link them; no build step). `app.js` re-implements the compiler in JS
  (`compileMarkdownToFlow`, `buildSkillMarkdown`, `buildQualityReport`) to stay at **parity
  with `parser.py`** (enforced by `tests/test_parity.py`, which reads `assets/app.js`).
  - **Converter**: SOP markdown editor → compile → SKILL.md/flow.json/quality report + flow
    visualizer + 「前往模擬器」(`goToSimulator` persists state to `localStorage`).
  - **Simulator**: loads the compiled flow from `localStorage` (or a pasted `flow.json` via
    `loadPastedFlow`) → integration config editor + MCP mount panel + execution simulator.
  - Page-aware init: `app.js` reads `document.body.dataset.page` and runs `initConverter()`
    or `initSimulator()`. Cross-page handoff via `STORAGE_KEY` (`persistState`/`loadState`).
- `docs/PRODUCT.md` — product positioning (four-pillar loop: Compile/Enforce/Prove/Evolve,
  SOP-as-Code, north-star metrics). `docs/ROADMAP.md` — schedule + acceptance criteria;
  phase 1 (M0–M2.5) done, phase 2 is G1–G4 (G1 = executor as a real MCP server, first).
- `sample_sop.md` — semiconductor tool fault investigation (English; default for CLI).
- `examples/` — more SOPs incl. `tool_anomaly_auto_notification_sop.md` (mixed API+MCP).
- `skills/<name>/` — generated bundles, committed. Regenerate when the parser changes.
- `sop_rule.md` — SOP authoring rules (incl. the API/MCP annotation rules).
- `.github/workflows/ci-cd.yml` — CI runs on push to `main` **and on PRs to `main`**:
  lint (`ruff check parser.py executor.py optimizer.py evolve.py mcp_server.py eval/ tests/` + `html-validate index.html simulator.html` + `node --check assets/app.js`),
  test (`pytest` incl. golden+parity, needs Node; + `eval/run_eval.py --check`), then
  GitHub Pages deploy (push-only via `if: github.event_name == 'push'`).
- `.htmlvalidate.json` — html-validate config (several rules disabled; inline style/script ok).

## Core model

A SOP compiles to a state machine. Each `State` has: `id`, `type`
(`action` | `decision` | `end_state`), `description`, `tool`, `tool_kind`
(`api` | `mcp` | null), `mcp_server`, `parameters` (input fields), `returns`
(output fields), `signal_field` (the primary output field the agent reads to route),
`requires_approval` (`true`/`false`/null — human-in-the-loop approval gate),
`next_states` (map of free-text outcome → target state id).

### API vs MCP tools (SOP annotation)
In a `**System/Tool**` line, declare the integration:
- API: `` `tool_name` (API) (Parameters: `a`, `b`) ``
- MCP: `` `mcp__jira__create_issue` (MCP) `` or `(MCP: server)`, or just the
  `mcp__<server>__<tool>` naming convention.
- Detection: explicit marker > `mcp__` prefix > default `api`. `mcp_server` is the
  segment between `mcp__` and the next `__`, or the `(MCP: server)` value.
- Implemented identically in `parser.py:detect_tool_meta` and `assets/app.js:detectToolMeta`.

### Output contract: Returns / Signal (M2)
A tool step may declare its output contract in the SOP markdown:
- `**Returns**: \`f1\`, \`f2\`` → `returns` (output field names).
- `**Signal**: \`f1\`` → `signal_field` (the field the agent inspects to route; should be in `returns`).
Parsed identically in `parser.py` and `assets/app.js:compileMarkdownToFlow`, written into
`flow.json`, rendered as a **Response Interpretation** line in `SKILL.md`, and validated
(non-blocking) in the quality report's integration table (Returns/Signal columns).

### Approval gate (requires_approval)
A step may be marked a human-in-the-loop **approval gate**: `**Approval**: required`
(`required`/`yes`/`true`/`需要` → `true`; `no`/`false` → explicit opt-out) → `requires_approval`.
Parsed identically in `parser.py` and `assets/app.js:compileMarkdownToFlow`, written to
`flow.json`, rendered as an **Approval Gate** line in `SKILL.md` and an Approval-Gates
section in the quality report. The executor/MCP server block advancing past an unapproved
gate; explicit `requires_approval` wins over `DEFAULT_APPROVAL_KEYWORDS` inference (null →
fall back to keywords). The web simulator enforces it via `approveCurrentState()` (keyed on
the explicit field only).

### Response interpretation (how the agent routes)
Each state's `next_states` keys are the agent's **response-interpretation rules**:
- API: check HTTP `status` (non-2xx ⇒ failure branch), read `body.data`, inspect `signal_field`, match a branch.
- MCP: check `isError`, read `structuredContent`, inspect `signal_field`, match a branch.
Surfaced in the node inspector, simulator, and quality report.

## Web demo concepts (assets/app.js, shared by both pages)

- **Tool catalog** (`toolCatalog`): a simulated registry. Each tool advertises a
  description + input/output schema and returns a realistic, SQL-like result row
  (e.g. `event_count`, `exposed_lot_count`, `min_cpk`, `root_cause_found`, `issue_key`).
  `getToolSpec` falls back to a generic schema for unlisted tools.
  `mockQueryResult(state, outcome)` returns `{ok, data, interpretation}`;
  `isFailureOutcome(condition)` decides success vs failure data (EN + 中文 keywords).
- **Integration config editor** (`integrationConfig` + `renderIntegrationEditor`): a
  user-editable registry of MCP servers/tools and API tools with per-tool I/O fields
  (`input`/`output` as `name:type`) and a `signal`. **Seeded from `flow.json` on compile**
  (`seedIntegrationFromFlow`: params→inputs, `returns`→outputs, `signal_field`→signal;
  rich types pulled from `toolCatalog` when the tool is known). `getToolSpec` consults this
  config first (`findIntegrationSpec` → `specFromEntry` synthesizes `rows`/`interpret`), so
  the mount panel, node inspector and simulator all reflect the user's edits after
  「套用設定」. This is how the user sees/edits exactly how the skill calls API/MCP.
- **MCP mount panel** (`renderMcpPanel`): mount/unmount the configured servers;
  advertises each server's tool schemas (from `integrationConfig`). MCP tool calls in the
  simulator are **blocked until the server is mounted** (`mcpMounts` state).
- **Execution simulator**: shows request payload, output schema, the verification rule,
  and per-branch mock responses; the "Investigation Log" records returned data + the
  agent's interpretation per step.
- **Flow visualizer** (`computeFlowLayout` + `renderFlowFromGeneratedJson`):
  layered (Sugiyama-style) layout — longest-path ranking from `start_state`, then
  median/barycenter sweeps to reduce edge crossings; forward edges curve down with
  fanned connection points; back/loop edges route along the right margin (amber dashed).
  Nodes show a colored accent bar, API/MCP badge, transport line, and returned-fields
  preview. Don't regress this back to the old row-major grid.

## Conventions

- Keep `parser.py` (Python) and `assets/app.js` (JS) **in sync** — they implement the
  same compile + quality logic; changing one usually means changing the other.
  `tests/test_parity.py` enforces this for the compile path (structural graph).
- When `parser.py` output changes, **regenerate the committed skills** (see below).
- UI text is Traditional Chinese (zh-TW); code identifiers/tools are English.
- Do not put the model identifier in commits/PRs/code.

## Verify before pushing

```bash
ruff check parser.py executor.py eval/ tests/
python3 -m pytest tests/ -q
python3 eval/run_eval.py --check   # compiled must beat baseline; regenerates eval/results.md
html-validate index.html simulator.html
node --check assets/app.js   # shared web-demo JS
# Regenerate committed skills (offline fallback; no GEMINI_API_KEY needed):
python3 parser.py --input sample_sop.md --output-dir skills/tool_fault_investigation --rules sop_rule.md
python3 parser.py --input examples/furnace_temperature_drift_sop.md --output-dir skills/furnace_temperature_drift --rules sop_rule.md
python3 parser.py --input examples/photoresist_coater_defect_sop.md --output-dir skills/photoresist_coater_defect --rules sop_rule.md
python3 parser.py --input examples/tool_anomaly_auto_notification_sop.md --output-dir skills/tool_anomaly_auto_notification --rules sop_rule.md
```
There is no browser/puppeteer in the environment. For visual checks of the flow, the
JS layout/render functions can be extracted and run under Node (computeFlowLayout is
pure), and a standalone SVG can be rendered to PNG with `cairosvg` (`pip install cairosvg`).
A lightweight DOM shim can `eval` the inline script to smoke-test the init path.

## Known limitations

- The web demo runs on static GitHub Pages: MCP mounting and API/MCP calls are a
  faithful **simulation**, not real network/MCP calls.
- The JS `makeStateId` strips non-ASCII, so Chinese step titles degrade to `step_N`
  ids in the web demo. English SOPs via `parser.py` produce semantic ids.
- The tool catalog covers the tools used by the bundled sample SOPs; others fall back
  to a generic schema.

## Git / workflow

- Designated dev branch: `claude/sop-api-mcp-skill-viz-9A1xR`. Develop there; push with
  `git push -u origin <branch>`. Only open PRs / merge when asked.
- GitHub ops go through the GitHub MCP tools (`mcp__github__*`); no `gh` CLI here.
- Done so far (merged to `main`): API/MCP integration + schema, quality-report
  integration validation, layered flow layout (crossing fix), MCP mount panel,
  SQL-like tool-call simulation with agent result interpretation.
- On dev branch (M1, this work): `executor.py` enforcement layer + `eval/` harness +
  `tests/`, CI test job, `docs/ROADMAP.md` (incl. SkillOpt positioning). Eval proves
  illegal-action rate 28%→0% and correct-end 60%→100% (baseline vs compiled).
