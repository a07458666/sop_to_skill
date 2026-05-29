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

## Example SOPs

- `sample_sop.md`: semiconductor tool fault investigation.
- `examples/furnace_temperature_drift_sop.md`: furnace temperature drift investigation.
- `examples/photoresist_coater_defect_sop.md`: photoresist coater defect investigation.
- `examples/tool_anomaly_auto_notification_sop.md`: tool anomaly auto-notification mixing API (MES/EAP) and MCP (Jira/Slack) tools.
