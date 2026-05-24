# SOP to Skill Compiler

An LLM-powered tool to convert human-readable Markdown Standard Operating Procedures (SOPs) into valid Skill directories.

The compiler reads a Markdown SOP, extracts steps, tool calls, parameters, decision branches, and terminal states, then emits a Skill directory containing:

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

## Example SOPs

- `sample_sop.md`: semiconductor tool fault investigation.
- `examples/furnace_temperature_drift_sop.md`: furnace temperature drift investigation.
- `examples/photoresist_coater_defect_sop.md`: photoresist coater defect investigation.
