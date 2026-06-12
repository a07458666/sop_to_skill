"""Unit tests for the M2 output contract (Returns / Signal)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parser import (  # noqa: E402
    StateMachine,
    assess_sop_quality,
    generate_skill_md,
    offline_fallback_parse,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(rel):
    with open(os.path.join(ROOT, rel), "r", encoding="utf-8") as f:
        return f.read()


def test_returns_and_signal_are_parsed():
    sm = StateMachine(**offline_fallback_parse(_read("sample_sop.md")))
    by_id = {s.id: s for s in sm.states}
    lot = by_id["check_lot_exposure"]
    assert lot.returns == ["exposed_lot_count", "lot_ids", "wafer_count", "window"]
    assert lot.signal_field == "exposed_lot_count"
    # end states carry no output contract
    assert by_id["document_no_fault_found"].returns is None


def test_approval_annotation_is_parsed():
    sm = StateMachine(**offline_fallback_parse(_read("sample_sop.md")))
    by_id = {s.id: s for s in sm.states}
    # explicitly annotated `**Approval**: required`
    assert by_id["place_tool_on_hold"].requires_approval is True
    assert by_id["create_corrective_action"].requires_approval is True
    # un-annotated steps stay null (fall back to runtime keyword inference)
    assert by_id["check_lot_exposure"].requires_approval is None


def test_approval_opt_out_is_parsed():
    md = (
        "# SOP: x\n\n## Workflow Steps\n\n"
        "### Step 1: Hold The Tool\n"
        "*   **Description**: stop the tool.\n"
        "*   **System/Tool**: `tool_hold` (API)\n"
        "*   **Approval**: no\n"
        "*   **Branching Logic**:\n"
        "    *   **If done**: Proceed to **Step 2 (Finish)**.\n\n"
        "### Step 2: Finish\n"
        "*   **Description**: wrap up.\n\n"
        "## End States\n\n"
        "### State: `finish`\n"
        "*   **Action**: close out.\n"
    )
    by_id = {s.id: s for s in StateMachine(**offline_fallback_parse(md)).states}
    assert by_id["hold_the_tool"].requires_approval is False


def test_skill_md_and_report_surface_approval_gate():
    sm = StateMachine(**offline_fallback_parse(_read("sample_sop.md")))
    md = generate_skill_md(sm)
    assert "**Approval Gate**:" in md
    report = assess_sop_quality(_read("sample_sop.md"), sm, "")
    assert "核准閘 (Approval Gates)" in report
    assert "`place_tool_on_hold`" in report


def test_skill_md_renders_response_interpretation():
    sm = StateMachine(**offline_fallback_parse(_read("sample_sop.md")))
    md = generate_skill_md(sm)
    assert "- **Returns**: `exposed_lot_count`" in md
    assert "**Response Interpretation**:" in md
    assert "inspect `exposed_lot_count`" in md


def test_quality_report_flags_signal_not_in_returns():
    sm = StateMachine(
        sop_name="x",
        start_state="a",
        states=[
            {
                "id": "a",
                "type": "action",
                "description": "d",
                "tool": "t",
                "tool_kind": "api",
                "parameters": ["p"],
                "returns": ["field_x"],
                "signal_field": "field_y",  # not in returns
                "next_states": {"ok": "b", "fail": "b"},
            },
            {"id": "b", "type": "end_state", "description": "done"},
        ],
    )
    report = assess_sop_quality("# SOP: x\n", sm, "")
    assert "不在宣告的 **Returns**" in report


def test_missing_returns_is_nonblocking():
    # furnace SOP is intentionally not annotated with Returns -> still passes
    report = assess_sop_quality(
        _read("examples/furnace_temperature_drift_sop.md"),
        StateMachine(**offline_fallback_parse(_read("examples/furnace_temperature_drift_sop.md"))),
        "",
    )
    assert "`通過`" in report
    assert "補上 **Returns**" in report  # but it is suggested
