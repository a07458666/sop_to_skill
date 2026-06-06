# SOP to Skill Compiler

An LLM-powered tool to convert human-readable Markdown Standard Operating Procedures (SOPs) into valid Skill directories.

The compiler reads a Markdown SOP, extracts steps, tool calls (distinguishing **API** vs **MCP** integrations), parameters, decision branches, and terminal states, then emits a Skill directory containing:

- `SKILL.md`: the required Skill entrypoint with YAML frontmatter and execution instructions.
- `flow.json`: the state machine graph used as a bundled resource by `SKILL.md`.
- `sop_rule.md`: authoring rules for input SOP Markdown.
- `sop_quality_report.md`: quality findings and revision suggestions based on `sop_rule.md`.

## Requirements

- Python 3.9+
- Optional Gemini API Key, set as the `GEMINI_API_KEY` environment variable.

If `GEMINI_API_KEY` is not set, the parser runs in offline heuristic fallback mode.

## Setup

```bash
pip install -r requirements.txt
```

## Usage

```bash
python parser.py --input sample_sop.md --output-dir skills/tool_fault_investigation --rules sop_rule.md
```

This writes:

```text
skills/tool_fault_investigation/
  SKILL.md
  flow.json
  sop_rule.md
  sop_quality_report.md
```

## API vs MCP tools

Each `**System/Tool**` step can declare how the tool is invoked:

- **API** (internal system / REST API): annotate with `(API)`, e.g.
  `**System/Tool**: \`mes_event_lookup\` (API) (Parameters: \`tool_id\`, \`event_time\`)`.
- **MCP** (Model Context Protocol server tool): annotate with `(MCP)` / `(MCP: server)`,
  or use the `mcp__<server>__<tool>` naming convention, e.g.
  `**System/Tool**: \`mcp__jira__create_issue\` (MCP) (Parameters: \`project_key\`, \`summary\`)`.

If no annotation is given, `mcp__...` names are treated as MCP and any other named tool as API.
The detected `tool_kind` and `mcp_server` are written into `flow.json`, grouped under
`## Tools Required` in `SKILL.md`, and surfaced in the web visualizer and execution simulator.
See `sop_rule.md` for the full authoring rules.

### Output contract: Returns & Signal

A tool step can also declare what the tool **returns** and which field drives the
decision, so the response-interpretation rule lives in the compiled artifact (not just
the demo):

- **Returns** — the output fields: `**Returns**: \`exposed_lot_count\`, \`lot_ids\`, \`wafer_count\``
- **Signal** — the primary field the agent inspects to pick a branch (should be one of
  Returns): `**Signal**: \`exposed_lot_count\``

These are written into `flow.json` (`returns`, `signal_field`) and rendered in `SKILL.md`
as a **Response Interpretation** line per tool state, e.g.:

> **Response Interpretation**: verify HTTP `status` (non-2xx ⇒ failure branch), read
> `body.data`, inspect `exposed_lot_count`, then match the outcome against a branch below.

Both fields are optional; when missing, the quality report adds a (non-blocking) suggestion.

### Integration validation & response interpretation

`sop_quality_report.md` includes an **`## API / MCP 整合驗證`** table that validates,
per tool state: the parameter contract (does the agent know what to send?), the declared
**Returns**/**Signal** output contract (does it know what comes back and what to read?),
the number of distinguishable response branches (can the agent route on the result?), and —
for MCP tools — that an `mcp_server` could be resolved (so it can be mounted). It also lists
the MCP servers that must be mounted before execution.

Each tool state's branch conditions act as the agent's **response-interpretation rules**:

- **API**: verify the HTTP `status` (non-2xx ⇒ failure branch), read `body.data`, inspect the
  `signal_field`, and match it against the state's branch conditions.
- **MCP**: check the `isError` flag, read `structuredContent`, inspect the `signal_field`, and
  match it against the branch conditions.

The web demo (`index.html`) makes this interactive: a **MCP Server 掛載** panel lets you
mount/unmount the servers referenced by the SOP (MCP tool calls are blocked until mounted),
and the **execution simulator** shows the simulated request payload, the verification rule,
and the mock API/MCP response for each routing choice.

## Executor: enforcing the flow at runtime

Compiling a SOP produces a `flow.json`, but a `SKILL.md` only *asks* the agent to
follow it. `executor.py` turns that graph into an **execution contract** that the
agent cannot violate:

- it only exposes the tool the current state declares (graph-external tool calls raise),
- it only accepts an outcome the current state actually defines (unknown outcomes raise),
- it blocks advancing past a **human-in-the-loop approval gate** until approved, and
- it records every step into a serializable **audit trail**.

```bash
# interactive walk-through
python executor.py --flow skills/tool_fault_investigation/flow.json

# scripted, non-interactive, with audit trail
python executor.py --flow skills/tool_fault_investigation/flow.json \
  --steps "fault event is confirmed;hold is applied successfully;exposed lots are found;process excursion is detected" \
  --auto-approve --audit
```

## Evaluation: does enforcement help?

`eval/` measures the core thesis — *the same agent obeys the SOP far better under
the executor than free-running over the raw markdown*. It runs a deterministic,
intentionally-noisy agent through every held-out scenario in two modes (baseline =
no enforcement, compiled = under the executor) and reports step-adherence. The
methodology follows **SkillOpt** (arXiv 2605.23904): a held-out `dev`/`holdout`
split with per-cell reporting, fully reproducible with no API key.

```bash
python eval/run_eval.py            # writes eval/results.md
python eval/run_eval.py --check    # also fails CI unless compiled beats baseline
```

Representative result (10 scenarios, 4 SOPs): illegal-action rate **28% → 0%**,
correct-end rate **60% → 100%**, all illegal attempts blocked by the executor.

## Structured self-evolution (optimizer)

`optimizer.py` evolves a `flow.json` the way SkillOpt evolves a `SKILL.md` — but with
**bounded, typed graph edits** instead of free text. It detects adherence gaps (a
validation rollout that needs an outcome the graph doesn't define), proposes candidate
edits, and accepts one **only when it strictly improves a held-out validation score**
(scored by running an oracle agent through the executor). Wrong candidates go into a
rejected-edit buffer; an edit budget bounds the change. No LLM/API required.

```bash
# demo: drop a real branch, then watch the optimizer re-discover and re-add it
python optimizer.py --flow skills/tool_fault_investigation/flow.json \
  --drop "check_lot_exposure=exposed lots are found"
```

The validation gate uniquely selects the correct target (e.g. `review_process_data`)
because the rest of the scenario's outcome chain must also resolve — a wrong target
fails downstream and scores lower. Every accepted edit is a schema-valid, auditable
graph operation.

## Tests

```bash
python -m pytest tests/ -q
```

## Example SOPs

- `sample_sop.md`: semiconductor tool fault investigation.
- `examples/furnace_temperature_drift_sop.md`: furnace temperature drift investigation.
- `examples/photoresist_coater_defect_sop.md`: photoresist coater defect investigation.
- `examples/tool_anomaly_auto_notification_sop.md`: tool anomaly auto-notification mixing API (MES/EAP) and MCP (Jira/Slack) tools.
