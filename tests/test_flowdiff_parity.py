"""Parity: the JS flowdiff port (assets/app.js) must match flowdiff.py.

Guards the same two-implementation drift risk as test_parity.py, but for the
governance state-machine diff.
"""

import json
import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flowdiff import diff_flows, load_flow  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FLOWS = [
    os.path.join(ROOT, "skills", "furnace_temperature_drift", "flow.json"),
    os.path.join(ROOT, "skills", "photoresist_coater_defect", "flow.json"),
    os.path.join(ROOT, "skills", "tool_fault_investigation", "flow.json"),
]


def _read(rel_path: str) -> str:
    with open(os.path.join(ROOT, rel_path), "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture(scope="module")
def js_module(tmp_path_factory):
    """Extract the self-contained flowdiff block from assets/app.js into a CJS module."""
    src = _read(os.path.join("assets", "app.js"))
    start = src.index("// ==== flowdiff")
    end = src.index("// ==== end flowdiff ====")
    if start < 0 or end <= start:
        pytest.fail("could not locate the flowdiff block in assets/app.js")
    block = src[start:end] + "\nmodule.exports = { diffFlows };\n"
    path = tmp_path_factory.mktemp("flowdiff") / "flowdiff.js"
    path.write_text(block, encoding="utf-8")
    return str(path)


def _js_diff(js_module: str, old_path: str, new_path: str) -> dict:
    script = (
        f"const {{diffFlows}} = require({json.dumps(js_module)});"
        f"const fs = require('fs');"
        f"const a = JSON.parse(fs.readFileSync({json.dumps(old_path)}, 'utf8'));"
        f"const b = JSON.parse(fs.readFileSync({json.dumps(new_path)}, 'utf8'));"
        f"process.stdout.write(JSON.stringify(diffFlows(a, b)));"
    )
    out = subprocess.run(
        ["node", "-e", script], capture_output=True, text=True, check=True
    )
    return json.loads(out.stdout)


@pytest.mark.parametrize("old_rel", FLOWS)
@pytest.mark.parametrize("new_rel", FLOWS)
def test_js_and_python_flowdiff_agree(js_module, old_rel, new_rel):
    py = diff_flows(load_flow(old_rel), load_flow(new_rel))
    js = _js_diff(js_module, old_rel, new_rel)
    assert js == py
