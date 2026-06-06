"""Regression test for the eval harness: compiled must beat baseline."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from eval.run_eval import NoisyAgent, _agg, run_baseline, run_compiled  # noqa: E402

SCENARIOS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval", "scenarios.json"
)


def _run_all():
    with open(SCENARIOS, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    agent = NoisyAgent(seed=cfg["seed"], error_rate=cfg["error_rate"])
    baseline = [run_baseline(sc, agent) for sc in cfg["scenarios"]]
    compiled = [run_compiled(sc, agent) for sc in cfg["scenarios"]]
    return _agg(baseline), _agg(compiled)


def test_compiled_eliminates_illegal_actions():
    base, comp = _run_all()
    assert base["illegal_rate"] > 0  # the noisy baseline really does break rules
    assert comp["illegal_rate"] == 0.0  # executor blocks all of them


def test_compiled_improves_correct_end_rate():
    base, comp = _run_all()
    assert comp["correct_end_rate"] == 1.0
    assert comp["correct_end_rate"] > base["correct_end_rate"]


def test_compiled_has_no_skipped_required_steps():
    base, comp = _run_all()
    assert comp["skipped_rate"] == 0.0
    assert base["skipped_rate"] > 0
