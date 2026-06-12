"""Tests for the M2.5 structured self-evolution loop."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from optimizer import (  # noqa: E402
    Edit,
    detect_gaps,
    optimize,
    score_flow,
)
from parser import StateMachine  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOW = os.path.join(ROOT, "skills", "tool_fault_investigation", "flow.json")
SCN = os.path.join(ROOT, "eval", "scenarios.json")

GAP_STATE = "check_lot_exposure"
GAP_OUTCOME = "exposed lots are found"
GAP_TARGET = "review_process_data"


def _machine():
    with open(FLOW, "r", encoding="utf-8") as f:
        return StateMachine(**json.load(f))


def _scenarios(split=None):
    with open(SCN, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    flow_rel = "skills/tool_fault_investigation/flow.json"
    mine = [s for s in cfg["scenarios"] if s["flow"] == flow_rel]
    if split == "dev":
        return [s for s in mine if s.get("split") != "holdout"]
    if split == "holdout":
        return [s for s in mine if s.get("split") == "holdout"]
    return mine


def _drop(machine, state_id, outcome):
    data = machine.model_dump()
    for st in data["states"]:
        if st["id"] == state_id and st.get("next_states"):
            st["next_states"].pop(outcome, None)
    return StateMachine(**data)


def test_intact_flow_passes_validation():
    val = _scenarios("dev")
    assert score_flow(_machine(), val).correct_end == len(val)


def test_degrading_flow_drops_score():
    val = _scenarios("dev")
    degraded = _drop(_machine(), GAP_STATE, GAP_OUTCOME)
    assert score_flow(degraded, val).correct_end < len(val)


def test_gap_is_detected():
    val = _scenarios("dev")
    degraded = _drop(_machine(), GAP_STATE, GAP_OUTCOME)
    gaps = detect_gaps(degraded, val)
    assert (GAP_STATE, GAP_OUTCOME) in gaps


def test_optimizer_restores_correct_edit_via_gate():
    val = _scenarios("dev")
    degraded = _drop(_machine(), GAP_STATE, GAP_OUTCOME)
    result = optimize(degraded, val)

    # exactly one edit accepted, and it is the correct (state, outcome, target)
    assert len(result.accepted) == 1
    edit = result.accepted[0][0]
    assert edit.kind == "add_transition"
    assert (edit.state_id, edit.outcome, edit.target) == (GAP_STATE, GAP_OUTCOME, GAP_TARGET)

    # validation fully recovered and wrong-target candidates were buffered as rejected
    assert result.final_score > result.start_score
    assert score_flow(result.machine, val).correct_end == len(val)
    assert result.rejected_count > 0


def test_optimizer_does_not_regress_holdout():
    val = _scenarios("dev")
    holdout = _scenarios("holdout")
    before = score_flow(_drop(_machine(), GAP_STATE, GAP_OUTCOME), holdout).correct_end
    result = optimize(_drop(_machine(), GAP_STATE, GAP_OUTCOME), val)
    after = score_flow(result.machine, holdout).correct_end
    assert after >= before


def test_already_optimal_flow_makes_no_edits():
    val = _scenarios("dev")
    result = optimize(_machine(), val)
    assert result.accepted == []


def test_edit_apply_is_pure():
    machine = _machine()
    before = json.dumps(machine.model_dump(), sort_keys=True)
    Edit("add_transition", GAP_STATE, outcome="x", target="open_mrb_case").apply(machine)
    after = json.dumps(machine.model_dump(), sort_keys=True)
    assert before == after  # apply() must not mutate the input machine
