"""Parity tests: index.html (JS) must compile SOPs to the same graph as parser.py.

`parser.py` and the inline JS in `index.html` implement the same compiler twice
(see CLAUDE.md). This test extracts the pure JS compile functions, runs them under
Node, and asserts the resulting state graph matches parser.py on every
routing-relevant field — so the two implementations cannot silently drift.

Only the structural graph is compared (ids, type, tool, tool_kind, mcp_server,
parameters, next_states, start_state). Free-text `description` is intentionally
excluded: it is not used for routing and differs only in whitespace. English SOPs
are used because the JS `makeStateId` strips non-ASCII (a documented limitation).
"""

import json
import os
import shutil
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from parser import StateMachine, offline_fallback_parse  # noqa: E402

NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="node not available")

CASES = [
    "sample_sop.md",
    "examples/furnace_temperature_drift_sop.md",
    "examples/photoresist_coater_defect_sop.md",
    "examples/tool_anomaly_auto_notification_sop.md",
]

STRUCT_FIELDS = [
    "type",
    "tool",
    "tool_kind",
    "mcp_server",
    "parameters",
    "returns",
    "signal_field",
    "next_states",
]


def _read(rel_path: str) -> str:
    with open(os.path.join(ROOT, rel_path), "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="module")
def js_module(tmp_path_factory):
    """Extract the pure compile functions from assets/app.js into a CommonJS module."""
    src_js = _read(os.path.join("assets", "app.js"))
    start = src_js.index("function detectToolMeta")
    end = src_js.index("// Run compiler simulator")
    if start < 0 or end < 0 or end <= start:
        pytest.fail("could not locate the JS compile functions in assets/app.js")
    block = src_js[start:end] + "\nmodule.exports = { compileMarkdownToFlow };\n"
    path = tmp_path_factory.mktemp("parity") / "compile.js"
    path.write_text(block, encoding="utf-8")
    return str(path)


def _compile_js(js_module: str, src: str) -> dict:
    script = (
        f"const {{compileMarkdownToFlow}} = require({json.dumps(js_module)});"
        "const fs = require('fs');"
        "process.stdout.write(JSON.stringify(compileMarkdownToFlow("
        "fs.readFileSync(process.argv[1], 'utf8'))));"
    )
    out = subprocess.run(
        [NODE, "-e", script, os.path.join(ROOT, src)],
        capture_output=True,
        text=True,
    )
    assert out.returncode == 0, f"node failed for {src}: {out.stderr}"
    return json.loads(out.stdout)


@pytest.mark.parametrize("src", CASES)
def test_js_matches_python(src, js_module):
    py = StateMachine(**offline_fallback_parse(_read(src))).model_dump()
    js = _compile_js(js_module, src)

    assert js["start_state"] == py["start_state"]

    py_states = {s["id"]: s for s in py["states"]}
    js_states = {s["id"]: s for s in js["states"]}
    assert set(js_states) == set(py_states), "state ids diverged between JS and Python"

    for sid in py_states:
        for field in STRUCT_FIELDS:
            assert js_states[sid].get(field) == py_states[sid].get(field), (
                f"{sid}.{field} diverged: "
                f"py={py_states[sid].get(field)!r} js={js_states[sid].get(field)!r}"
            )
