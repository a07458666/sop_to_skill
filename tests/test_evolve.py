"""Tests for the G2 evolution loop: graph edits -> SOP-markdown diff -> recompile."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from evolve import apply_edit_to_markdown, evolve_sop  # noqa: E402
from optimizer import Edit  # noqa: E402
from parser import StateMachine, offline_fallback_parse  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCN = os.path.join(ROOT, "eval", "scenarios.json")
FLOW_KEY = "skills/tool_fault_investigation/flow.json"

GAP_OUTCOME = "exposed lots are found"
GAP_STATE = "check_lot_exposure"
GAP_TARGET = "review_process_data"


def _read(rel):
    with open(os.path.join(ROOT, rel), "r", encoding="utf-8") as f:
        return f.read()


def _validation():
    cfg = json.loads(_read("eval/scenarios.json"))
    mine = [s for s in cfg["scenarios"] if s["flow"] == FLOW_KEY]
    return [s for s in mine if s.get("split") != "holdout"]


def _drop_branch(markdown, outcome):
    token = f"**if {outcome.lower()}**"
    return "\n".join(ln for ln in markdown.split("\n") if token not in ln.lower())


def _compile(markdown):
    return StateMachine(**offline_fallback_parse(markdown))


def test_apply_edit_inserts_branch_line():
    md = _read("sample_sop.md")
    degraded = _drop_branch(md, GAP_OUTCOME)
    assert f"**If {GAP_OUTCOME}**" not in degraded  # the specific branch line is gone
    edit = Edit("add_transition", GAP_STATE, outcome=GAP_OUTCOME, target=GAP_TARGET)
    patched = apply_edit_to_markdown(degraded, edit)
    assert f"**If {GAP_OUTCOME}**" in patched
    assert f"(State: `{GAP_TARGET}`)" in patched


def test_closed_loop_restores_dropped_branch():
    md = _read("sample_sop.md")
    degraded = _drop_branch(md, GAP_OUTCOME)
    # the degraded SOP is genuinely missing the transition
    assert GAP_OUTCOME not in {
        o for s in _compile(degraded).states for o in (s.next_states or {})
    }

    result = evolve_sop(degraded, _validation())

    # one edit proposed, rendered as a real markdown diff
    assert len(result.edits) == 1
    assert result.edits[0].outcome == GAP_OUTCOME
    assert result.diff and "+" in result.diff
    assert f"**If {GAP_OUTCOME}**" in result.new_markdown

    # recompiling the revised SOP restores the transition to the correct target
    recompiled = {
        s.id: (s.next_states or {}) for s in _compile(result.new_markdown).states
    }
    assert recompiled[GAP_STATE].get(GAP_OUTCOME) == GAP_TARGET


def test_no_edits_when_sop_is_complete():
    result = evolve_sop(_read("sample_sop.md"), _validation())
    assert result.edits == []
    assert result.diff == ""
