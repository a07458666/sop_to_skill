"""
Structured state-machine diff between two compiled SOP flows (G4 governance primitive).

`evolve.py` renders graph edits back as a *markdown* diff to the source SOP. This module
gives the complementary **graph-level** view: given two `flow.json` versions, it reports
exactly what changed in the state machine — states added/removed, per-state field changes
(tool, parameters, returns, signal, `requires_approval`, type, description), and
transitions added/removed/retargeted.

This is the building block for SOP versioning/governance (G4): two versions of a SOP can
coexist and be reviewed/diffed before a process owner promotes one. It is also useful in CI
or review to show how a self-evolution (optimizer/evolve) actually reshaped the graph.

Deterministic and offline — it reuses the parser's `StateMachine` schema.

CLI: python flowdiff.py --old A/flow.json --new B/flow.json [--format md|json] [--check]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Dict, List, Optional

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from parser import State, StateMachine  # noqa: E402

# Per-state scalar fields compared verbatim. `next_states` is handled separately as a
# transition diff; `id` is the key, not a field.
SCALAR_FIELDS = (
    "type",
    "description",
    "tool",
    "tool_kind",
    "mcp_server",
    "signal_field",
    "requires_approval",
)
LIST_FIELDS = ("parameters", "returns")


def _transitions(state: State) -> Dict[str, str]:
    return dict(state.next_states or {})


def _diff_state(old: State, new: State) -> dict:
    """Return the change record for one state present in both flows (empty if identical)."""
    fields: Dict[str, dict] = {}
    for name in SCALAR_FIELDS:
        ov, nv = getattr(old, name), getattr(new, name)
        if ov != nv:
            fields[name] = {"old": ov, "new": nv}
    for name in LIST_FIELDS:
        ov = list(getattr(old, name) or [])
        nv = list(getattr(new, name) or [])
        if ov != nv:
            fields[name] = {"old": ov, "new": nv}

    old_t, new_t = _transitions(old), _transitions(new)
    added = {k: v for k, v in new_t.items() if k not in old_t}
    removed = {k: v for k, v in old_t.items() if k not in new_t}
    retargeted = {
        k: {"old": old_t[k], "new": new_t[k]}
        for k in old_t
        if k in new_t and old_t[k] != new_t[k]
    }

    record: dict = {}
    if fields:
        record["fields"] = fields
    if added:
        record["transitions_added"] = added
    if removed:
        record["transitions_removed"] = removed
    if retargeted:
        record["transitions_retargeted"] = retargeted
    return record


def diff_flows(old: StateMachine, new: StateMachine) -> dict:
    """Compute a structured diff between two compiled flows."""
    old_by_id = {s.id: s for s in old.states}
    new_by_id = {s.id: s for s in new.states}

    diff: dict = {
        "sop_name": None,
        "start_state": None,
        "states_added": [s.id for s in new.states if s.id not in old_by_id],
        "states_removed": [s.id for s in old.states if s.id not in new_by_id],
        "states_changed": {},
    }
    if old.sop_name != new.sop_name:
        diff["sop_name"] = {"old": old.sop_name, "new": new.sop_name}
    if old.start_state != new.start_state:
        diff["start_state"] = {"old": old.start_state, "new": new.start_state}

    # Iterate in new-flow order for stable, readable output; fall back to remaining old ids.
    common_ids = [s.id for s in new.states if s.id in old_by_id]
    for sid in common_ids:
        record = _diff_state(old_by_id[sid], new_by_id[sid])
        if record:
            diff["states_changed"][sid] = record
    return diff


def has_changes(diff: dict) -> bool:
    return bool(
        diff["sop_name"]
        or diff["start_state"]
        or diff["states_added"]
        or diff["states_removed"]
        or diff["states_changed"]
    )


def _fmt(value) -> str:
    if value is None:
        return "`null`"
    if isinstance(value, bool):
        return f"`{str(value).lower()}`"
    if isinstance(value, list):
        return "`" + ", ".join(str(v) for v in value) + "`" if value else "`(空)`"
    return f"`{value}`"


def render_markdown(diff: dict, old_name: str = "old", new_name: str = "new") -> str:
    """Render the structured diff as a reviewable governance report (zh-TW)."""
    out = "# 狀態機 Diff (Flow Diff)\n\n"
    out += f"- **舊版**: `{old_name}`\n"
    out += f"- **新版**: `{new_name}`\n\n"

    if not has_changes(diff):
        out += "兩版狀態機完全相同，無圖層級變更。\n"
        return out

    if diff["sop_name"]:
        out += f"## SOP 名稱\n\n- {_fmt(diff['sop_name']['old'])} → {_fmt(diff['sop_name']['new'])}\n\n"
    if diff["start_state"]:
        out += f"## 起始 state\n\n- {_fmt(diff['start_state']['old'])} → {_fmt(diff['start_state']['new'])}\n\n"

    if diff["states_added"]:
        out += "## 新增 state\n\n"
        for sid in diff["states_added"]:
            out += f"- `{sid}`\n"
        out += "\n"
    if diff["states_removed"]:
        out += "## 移除 state\n\n"
        for sid in diff["states_removed"]:
            out += f"- `{sid}`\n"
        out += "\n"

    if diff["states_changed"]:
        out += "## 變更 state\n\n"
        for sid, record in diff["states_changed"].items():
            out += f"### `{sid}`\n\n"
            for field_name, change in record.get("fields", {}).items():
                out += f"- **{field_name}**: {_fmt(change['old'])} → {_fmt(change['new'])}\n"
            for outcome, target in record.get("transitions_added", {}).items():
                out += f"- ➕ 分支 `{outcome}` → `{target}`\n"
            for outcome, target in record.get("transitions_removed", {}).items():
                out += f"- ➖ 分支 `{outcome}`（原指向 `{target}`）\n"
            for outcome, change in record.get("transitions_retargeted", {}).items():
                out += f"- 🔀 分支 `{outcome}`：`{change['old']}` → `{change['new']}`\n"
            out += "\n"
    return out


def load_flow(path: str) -> StateMachine:
    with open(path, "r", encoding="utf-8") as f:
        return StateMachine(**json.load(f))


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Structured diff between two compiled SOP flows.")
    ap.add_argument("--old", required=True, help="Path to the older flow.json.")
    ap.add_argument("--new", required=True, help="Path to the newer flow.json.")
    ap.add_argument("--format", choices=["md", "json"], default="md", help="Output format.")
    ap.add_argument(
        "--check",
        action="store_true",
        help="Exit with code 1 if the flows differ (e.g. to gate CI on an unexpected change).",
    )
    args = ap.parse_args(argv)

    old, new = load_flow(args.old), load_flow(args.new)
    diff = diff_flows(old, new)

    if args.format == "json":
        print(json.dumps(diff, ensure_ascii=False, indent=2))
    else:
        print(render_markdown(diff, args.old, args.new))

    return 1 if (args.check and has_changes(diff)) else 0


if __name__ == "__main__":
    sys.exit(main())
