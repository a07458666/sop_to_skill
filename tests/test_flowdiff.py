"""Tests for flowdiff (G4 governance: structured state-machine diff)."""

import copy
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flowdiff import diff_flows, has_changes, render_markdown  # noqa: E402
from parser import StateMachine  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOW_PATH = os.path.join(ROOT, "skills", "tool_fault_investigation", "flow.json")


def _flow_dict() -> dict:
    with open(FLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _machine(data: dict) -> StateMachine:
    return StateMachine(**data)


def test_identical_flows_have_no_changes():
    data = _flow_dict()
    diff = diff_flows(_machine(data), _machine(copy.deepcopy(data)))
    assert not has_changes(diff)
    assert "兩版狀態機完全相同" in render_markdown(diff)


def test_detects_added_and_removed_state():
    base = _flow_dict()
    trimmed = copy.deepcopy(base)
    # drop the last (end) state to simulate removal in the new version
    removed = trimmed["states"].pop()
    diff = diff_flows(_machine(base), _machine(trimmed))
    assert removed["id"] in diff["states_removed"]
    assert not diff["states_added"]
    # reverse direction => it shows up as added
    diff2 = diff_flows(_machine(trimmed), _machine(base))
    assert removed["id"] in diff2["states_added"]


def test_detects_field_change_including_requires_approval():
    base = _flow_dict()
    changed = copy.deepcopy(base)
    target = next(s for s in changed["states"] if s["id"] == "place_tool_on_hold")
    target["requires_approval"] = False
    target["signal_field"] = "something_else"
    diff = diff_flows(_machine(base), _machine(changed))
    record = diff["states_changed"]["place_tool_on_hold"]
    assert record["fields"]["requires_approval"] == {"old": True, "new": False}
    assert record["fields"]["signal_field"]["new"] == "something_else"


def test_detects_transition_add_remove_retarget():
    base = _flow_dict()
    changed = copy.deepcopy(base)
    state = next(s for s in changed["states"] if s["id"] == "confirm_fault_event")
    outcomes = list(state["next_states"].items())
    # retarget the first outcome, drop the second, add a brand-new one
    state["next_states"][outcomes[0][0]] = "document_no_fault_found"
    del state["next_states"][outcomes[1][0]]
    state["next_states"]["new synthetic outcome"] = "place_tool_on_hold"

    diff = diff_flows(_machine(base), _machine(changed))
    record = diff["states_changed"]["confirm_fault_event"]
    assert record["transitions_added"] == {"new synthetic outcome": "place_tool_on_hold"}
    assert outcomes[1][0] in record["transitions_removed"]
    assert record["transitions_retargeted"][outcomes[0][0]]["new"] == "document_no_fault_found"


def test_render_markdown_lists_changes():
    base = _flow_dict()
    changed = copy.deepcopy(base)
    changed["sop_name"] = "Renamed SOP"
    md = render_markdown(diff_flows(_machine(base), _machine(changed)), "v1", "v2")
    assert "# 狀態機 Diff" in md
    assert "## SOP 名稱" in md
    assert "Renamed SOP" in md
