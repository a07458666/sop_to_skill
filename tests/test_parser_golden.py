"""Golden snapshot tests: parser.py output must match the committed skill bundles.

These guard against silent regressions in the compiler. When you intentionally
change parser.py output, regenerate the committed skills (see CLAUDE.md) so these
snapshots move with it.
"""

import json
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from parser import (  # noqa: E402
    StateMachine,
    generate_skill_md,
    offline_fallback_parse,
)

# (source SOP, committed skill directory)
CASES = [
    ("sample_sop.md", "tool_fault_investigation"),
    ("examples/furnace_temperature_drift_sop.md", "furnace_temperature_drift"),
    ("examples/photoresist_coater_defect_sop.md", "photoresist_coater_defect"),
    ("examples/tool_anomaly_auto_notification_sop.md", "tool_anomaly_auto_notification"),
]


def _read(rel_path: str) -> str:
    with open(os.path.join(ROOT, rel_path), "r", encoding="utf-8") as f:
        return f.read()


def _compile(src: str) -> StateMachine:
    return StateMachine(**offline_fallback_parse(_read(src)))


@pytest.mark.parametrize("src,name", CASES)
def test_flow_json_matches_committed(src, name):
    got = _compile(src).model_dump()
    want = json.loads(_read(os.path.join("skills", name, "flow.json")))
    assert got == want, (
        f"parser.py flow.json for {name} drifted from the committed bundle. "
        f"Regenerate with parser.py if this change is intentional."
    )


@pytest.mark.parametrize("src,name", CASES)
def test_skill_md_matches_committed(src, name):
    got = generate_skill_md(_compile(src))
    want = _read(os.path.join("skills", name, "SKILL.md"))
    assert got == want, (
        f"parser.py SKILL.md for {name} drifted from the committed bundle. "
        f"Regenerate with parser.py if this change is intentional."
    )
