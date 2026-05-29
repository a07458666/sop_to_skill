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
- `index.html` — a single-file interactive web demo (GitHub Pages). It re-implements
  the compiler in JS (`compileMarkdownToFlow`, `buildSkillMarkdown`, `buildQualityReport`)
  to stay at **parity with `parser.py`**, plus the flow visualizer, MCP mount panel,
  and execution simulator. No build step; all inline.
- `sample_sop.md` — semiconductor tool fault investigation (English; default for CLI).
- `examples/` — more SOPs incl. `tool_anomaly_auto_notification_sop.md` (mixed API+MCP).
- `skills/<name>/` — generated bundles, committed. Regenerate when the parser changes.
- `sop_rule.md` — SOP authoring rules (incl. the API/MCP annotation rules).
- `.github/workflows/ci-cd.yml` — CI: `ruff check parser.py` + `html-validate index.html`,
  then GitHub Pages deploy on push to `main`.
- `.htmlvalidate.json` — html-validate config (several rules disabled; inline style/script ok).

## Core model

A SOP compiles to a state machine. Each `State` has: `id`, `type`
(`action` | `decision` | `end_state`), `description`, `tool`, `tool_kind`
(`api` | `mcp` | null), `mcp_server`, `parameters`, `next_states`
(map of free-text outcome → target state id).

### API vs MCP tools (SOP annotation)
In a `**System/Tool**` line, declare the integration:
- API: `` `tool_name` (API) (Parameters: `a`, `b`) ``
- MCP: `` `mcp__jira__create_issue` (MCP) `` or `(MCP: server)`, or just the
  `mcp__<server>__<tool>` naming convention.
- Detection: explicit marker > `mcp__` prefix > default `api`. `mcp_server` is the
  segment between `mcp__` and the next `__`, or the `(MCP: server)` value.
- Implemented identically in `parser.py:detect_tool_meta` and `index.html:detectToolMeta`.

### Response interpretation (how the agent routes)
Each state's `next_states` keys are the agent's **response-interpretation rules**:
- API: check HTTP `status` (non-2xx ⇒ failure branch), read `body.data`, match a branch.
- MCP: check `isError`, read `structuredContent`, match a branch.
Surfaced in the node inspector, simulator, and quality report.

## Web demo concepts (index.html)

- **Tool catalog** (`toolCatalog`): a simulated registry. Each tool advertises a
  description + input/output schema and returns a realistic, SQL-like result row
  (e.g. `event_count`, `exposed_lot_count`, `min_cpk`, `root_cause_found`, `issue_key`).
  `getToolSpec` falls back to a generic schema for unlisted tools.
  `mockQueryResult(state, outcome)` returns `{ok, data, interpretation}`;
  `isFailureOutcome(condition)` decides success vs failure data (EN + 中文 keywords).
- **MCP mount panel** (`renderMcpPanel`): mount/unmount servers referenced by the SOP;
  advertises each server's tool schemas. MCP tool calls in the simulator are **blocked
  until the server is mounted** (`mcpMounts` state).
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

- Keep `parser.py` (Python) and `index.html` (JS) **in sync** — they implement the
  same compile + quality logic; changing one usually means changing the other.
- When `parser.py` output changes, **regenerate the committed skills** (see below).
- UI text is Traditional Chinese (zh-TW); code identifiers/tools are English.
- Do not put the model identifier in commits/PRs/code.

## Verify before pushing

```bash
ruff check parser.py
html-validate index.html
# JS syntax check of the inline <script>:
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script>([\s\S]*?)<\/script>/g;let m,l=null;while((m=re.exec(h)))l=m[1];fs.writeFileSync("/tmp/m.js",l)'; node --check /tmp/m.js
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
