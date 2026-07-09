"""Parity: the JS optimizer port (assets/app.js) must match optimizer.py.

Same drift guard as test_parity / test_flowdiff_parity: the optimization loop is
deterministic (oracle rollouts, strict-improvement gate), so the Python and JS
implementations must accept the same edits, in the same order, with the same
scores, and produce the same final graph.
"""

import copy
import json
import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from optimizer import _load_scenarios, optimize  # noqa: E402
from parser import StateMachine  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENARIOS = os.path.join(ROOT, "eval", "scenarios.json")

FLOWS = [
    "skills/tool_fault_investigation/flow.json",
    "skills/furnace_temperature_drift/flow.json",
    "skills/photoresist_coater_defect/flow.json",
    "skills/tool_anomaly_auto_notification/flow.json",
]


def _read(rel_path: str) -> str:
    with open(os.path.join(ROOT, rel_path), "r", encoding="utf-8") as f:
        return f.read()


def _drop_for(validation: list) -> tuple:
    """Deterministic demo gap: the second hop of the first dev scenario."""
    situation = validation[0]["situation"]
    items = list(situation.items())
    return items[1] if len(items) > 1 else items[0]


def _dropped_flow_dict(flow_rel: str, drop: tuple) -> dict:
    data = json.loads(_read(flow_rel))
    for st in data["states"]:
        if st["id"] == drop[0] and st.get("next_states"):
            st["next_states"].pop(drop[1], None)
    return data


@pytest.fixture(scope="module")
def js_module(tmp_path_factory):
    """Extract the self-contained optimizer block from assets/app.js into a CJS module."""
    src = _read(os.path.join("assets", "app.js"))
    start = src.index("// ==== optimizer")
    end = src.index("// ==== end optimizer ====")
    block = src[start:end] + "\nmodule.exports = { optimizeFlowJs, scoreFlowJs, detectGapsJs };\n"
    path = tmp_path_factory.mktemp("optimizer") / "optimizer.js"
    path.write_text(block, encoding="utf-8")
    return str(path)


def _js_optimize(js_module: str, flow: dict, validation: list) -> dict:
    script = (
        f"const {{optimizeFlowJs}} = require({json.dumps(js_module)});"
        f"const flow = {json.dumps(flow)};"
        f"const validation = {json.dumps(validation)};"
        "const r = optimizeFlowJs(flow, validation);"
        "process.stdout.write(JSON.stringify({"
        "  accepted: r.accepted.map(a => [a.edit.kind, a.edit.state_id, a.edit.outcome, a.edit.target, a.before, a.after]),"
        "  rejected_count: r.rejected_count, rounds: r.rounds,"
        "  start_score: r.start_score, final_score: r.final_score,"
        "  final_next: Object.fromEntries(r.flow.states.map(s => [s.id, s.next_states || {}]))"
        "}));"
    )
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


@pytest.mark.parametrize("flow_rel", FLOWS)
def test_js_and_python_optimizer_agree(js_module, flow_rel):
    validation, _holdout = _load_scenarios(SCENARIOS, flow_rel)
    assert validation, f"no dev scenarios for {flow_rel}"
    drop = _drop_for(validation)
    flow = _dropped_flow_dict(flow_rel, drop)

    py = optimize(StateMachine(**copy.deepcopy(flow)), validation)
    js = _js_optimize(js_module, flow, validation)

    py_accepted = [
        [e.kind, e.state_id, e.outcome, e.target, before, after]
        for e, before, after in py.accepted
    ]
    assert [a[:4] for a in js["accepted"]] == [a[:4] for a in py_accepted]
    js_scores = [x for a in js["accepted"] for x in a[4:]]
    py_scores = [x for a in py_accepted for x in a[4:]]
    assert js_scores == pytest.approx(py_scores)
    assert js["rejected_count"] == py.rejected_count
    assert js["rounds"] == py.rounds
    assert js["start_score"] == pytest.approx(py.start_score)
    assert js["final_score"] == pytest.approx(py.final_score)
    py_next = {s.id: (s.next_states or {}) for s in py.machine.states}
    assert js["final_next"] == py_next
    # the demo drop must actually have been repaired
    assert py.final_score > py.start_score
