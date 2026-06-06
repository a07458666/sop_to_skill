"""Behavioural tests for SkillExecutor (the M1 enforcement layer)."""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from executor import (  # noqa: E402
    ApprovalRequiredError,
    IllegalToolCallError,
    InvalidFlowError,
    SkillExecutor,
    TerminalStateError,
    UnknownOutcomeError,
)
from parser import StateMachine  # noqa: E402

FLOW_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "skills",
    "tool_fault_investigation",
    "flow.json",
)


def make_executor(**kwargs) -> SkillExecutor:
    return SkillExecutor.from_flow_file(FLOW_PATH, **kwargs)


def test_loads_and_starts_at_start_state():
    ex = make_executor()
    assert ex.current_id == "confirm_fault_event"
    assert not ex.is_terminal


def test_legal_path_reaches_expected_end_state():
    # confirmed fault -> hold -> exposed lots -> excursion -> MRB
    ex = make_executor(approval_states=[])  # disable gates for a clean happy path
    ex.step("fault event is confirmed")
    ex.step("hold is applied successfully")
    ex.step("exposed lots are found")
    ex.step("process excursion is detected")
    assert ex.current_id == "open_mrb_case"
    assert ex.is_terminal


def test_unknown_outcome_is_rejected():
    ex = make_executor(approval_states=[])
    with pytest.raises(UnknownOutcomeError) as exc:
        ex.step("totally made up outcome")
    # error message lists valid outcomes to guide the agent
    assert "Valid outcomes" in str(exc.value)
    # state did not move
    assert ex.current_id == "confirm_fault_event"


def test_illegal_tool_call_is_blocked():
    ex = make_executor(approval_states=[])
    # the current state's tool is mes_event_lookup; calling a downstream tool fails
    with pytest.raises(IllegalToolCallError):
        ex.call_tool("equipment_diagnostics")
    # the declared tool is accepted
    call = ex.call_tool("mes_event_lookup", {"tool_id": "T1", "event_time": "now"})
    assert call["tool"] == "mes_event_lookup"
    assert call["tool_kind"] == "api"


def test_approval_gate_blocks_then_allows():
    ex = make_executor()
    ex.step("fault event is confirmed")  # -> place_tool_on_hold (a gate)
    assert ex.requires_approval()
    with pytest.raises(ApprovalRequiredError):
        ex.step("hold is applied successfully")
    # still parked on the gate
    assert ex.current_id == "place_tool_on_hold"
    ex.approve("engineer signed off")
    ex.step("hold is applied successfully")
    assert ex.current_id == "check_lot_exposure"


def test_step_with_inline_approval():
    ex = make_executor()
    ex.step("fault event is confirmed")
    # passing approval= should satisfy the gate in one call
    ex.step("hold is applied successfully", approval="ok")
    assert ex.current_id == "check_lot_exposure"


def test_terminal_state_rejects_further_action():
    ex = make_executor(approval_states=[])
    ex.step("event is duplicate or false alarm")  # -> document_no_fault_found (end)
    assert ex.is_terminal
    with pytest.raises(TerminalStateError):
        ex.step("anything")
    with pytest.raises(TerminalStateError):
        ex.call_tool("mes_event_lookup")


def test_audit_trail_is_serializable():
    ex = make_executor(approval_states=[])
    ex.step("fault event is confirmed")
    ex.step("hold is applied successfully", tool_result={"status": 200})
    trail = ex.audit_trail()
    assert [e["event"] for e in trail] == ["transition", "transition"]
    assert trail[0]["from"] == "confirm_fault_event"
    assert trail[1]["tool_result"] == {"status": 200}
    # whole trail round-trips through json
    dumped = ex.to_json()
    parsed = json.loads(dumped)
    assert parsed["final_state"] == ex.current_id
    assert parsed["start_state"] == "confirm_fault_event"


def test_visited_states_tracks_path():
    ex = make_executor(approval_states=[])
    ex.step("fault event is confirmed")
    ex.step("hold is applied successfully")
    assert ex.visited_states() == [
        "confirm_fault_event",
        "place_tool_on_hold",
        "check_lot_exposure",
    ]


def test_invalid_flow_bad_start_state():
    sm = StateMachine(
        sop_name="x",
        start_state="nope",
        states=[],
    )
    with pytest.raises(InvalidFlowError):
        SkillExecutor(sm)


def test_invalid_flow_dangling_target():
    sm = StateMachine(
        sop_name="x",
        start_state="a",
        states=[
            {
                "id": "a",
                "type": "action",
                "description": "d",
                "next_states": {"go": "ghost"},
            }
        ],
    )
    with pytest.raises(InvalidFlowError):
        SkillExecutor(sm)


def test_approval_gates_are_inferred():
    ex = make_executor()
    # place_tool_on_hold / escalate / release should be inferred as gates
    assert "place_tool_on_hold" in ex._approval_states
    assert "escalate_to_equipment_engineering" not in ex._approval_states  # end_state excluded
