"""
Evolution closing-the-loop: graph edits rendered back as a SOP-markdown diff (G2).

`optimizer.py` proposes bounded edits on the *compiled* graph. But the human-owned source
of truth is the SOP markdown. G2 closes the loop: it takes the optimizer's accepted graph
edits and renders them as a **patch to the SOP markdown** — a reviewable diff a process
owner can approve. After approval the SOP recompiles, so the graph change always traces
back to a human-readable, version-controlled document edit (SOP-as-Code; see docs/PRODUCT.md).

Deterministic and offline: it reuses `optimizer.optimize` (held-out validation gate) and
`parser.make_state_id` to map a state id back to its step section in the markdown.
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from optimizer import Edit, OptimizeResult, optimize  # noqa: E402
from parser import StateMachine, make_state_id, offline_fallback_parse  # noqa: E402


def _section_state_id(heading: str) -> str:
    """State id for a `### ...` heading (handles both 'Step N: X' and 'State: `id`')."""
    m = re.match(r"State:\s*`([^`]+)`", heading.strip(), re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return make_state_id(heading)


def _find_section(lines: List[str], state_id: str) -> Optional[Tuple[int, int]]:
    """Return (start, end) line indices of the `### ` section whose state id matches."""
    bounds = [i for i, ln in enumerate(lines) if ln.startswith("### ")]
    for idx, start in enumerate(bounds):
        heading = lines[start][len("### "):]
        if _section_state_id(heading) == state_id:
            end = bounds[idx + 1] if idx + 1 < len(bounds) else len(lines)
            return start, end
    return None


def apply_edit_to_markdown(markdown: str, edit: Edit) -> str:
    """Apply one bounded graph edit as a markdown edit to the matching step section."""
    lines = markdown.split("\n")
    section = _find_section(lines, edit.state_id)
    if section is None:
        raise ValueError(f"no SOP section found for state '{edit.state_id}'")
    start, end = section

    if edit.kind == "add_transition":
        branch_idxs = [i for i in range(start, end) if "**If" in lines[i]]
        new_line_body = (
            f"**If {edit.outcome}**: Transition to (State: `{edit.target}`)."
        )
        if branch_idxs:
            ref = lines[branch_idxs[-1]]
            prefix = ref[: ref.index("**If")]
            lines.insert(branch_idxs[-1] + 1, prefix + new_line_body)
        else:
            # no branching block yet: append one using a sane default bullet style
            insert_at = end
            lines.insert(insert_at, "*   **Branching Logic**:")
            lines.insert(insert_at + 1, "    *   " + new_line_body)
        return "\n".join(lines)

    if edit.kind == "set_signal_field":
        signal_line = None
        for i in range(start, end):
            if "**Signal**:" in lines[i]:
                signal_line = i
                break
        new_line = f"*   **Signal**: `{edit.field_value}`"
        if signal_line is not None:
            indent = lines[signal_line][: len(lines[signal_line]) - len(lines[signal_line].lstrip())]
            lines[signal_line] = indent + new_line.lstrip()
        else:
            # place after the System/Tool line if present, else after the heading
            anchor = start
            for i in range(start, end):
                if "**System/Tool**:" in lines[i] or "**Returns**:" in lines[i]:
                    anchor = i
            lines.insert(anchor + 1, new_line)
        return "\n".join(lines)

    raise ValueError(f"unsupported edit kind for markdown rendering: {edit.kind}")


def render_diff(old_md: str, new_md: str, path: str = "SOP.md") -> str:
    return "".join(
        difflib.unified_diff(
            old_md.splitlines(keepends=True),
            new_md.splitlines(keepends=True),
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
        )
    )


@dataclass
class EvolveResult:
    edits: List[Edit] = field(default_factory=list)
    old_markdown: str = ""
    new_markdown: str = ""
    diff: str = ""
    optimize_result: Optional[OptimizeResult] = None


def evolve_sop(markdown: str, validation: List[dict]) -> EvolveResult:
    """Compile the SOP, optimize the graph against the validation set, and render the
    accepted edits as a SOP-markdown patch."""
    machine = StateMachine(**offline_fallback_parse(markdown))
    result = optimize(machine, validation)
    new_md = markdown
    edits = [edit for edit, _, _ in result.accepted]
    for edit in edits:
        new_md = apply_edit_to_markdown(new_md, edit)
    return EvolveResult(
        edits=edits,
        old_markdown=markdown,
        new_markdown=new_md,
        diff=render_diff(markdown, new_md),
        optimize_result=result,
    )


def _load_validation(scenarios_path: str, flow_key: str) -> List[dict]:
    with open(scenarios_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    mine = [s for s in cfg["scenarios"] if s["flow"].replace("\\", "/") == flow_key]
    return [s for s in mine if s.get("split") != "holdout"]


def _drop_branch(markdown: str, outcome: str) -> str:
    """Demo aid: remove the `**If <outcome>**:` branch line (exact outcome token, so a
    longer outcome that contains this one as a substring is not also removed)."""
    token = f"**if {outcome.lower()}**"
    kept = [ln for ln in markdown.split("\n") if token not in ln.lower()]
    return "\n".join(kept)


def main() -> int:
    ap = argparse.ArgumentParser(description="Render optimizer graph edits as a SOP markdown diff (G2).")
    ap.add_argument("--sop", required=True, help="Path to the source SOP markdown.")
    ap.add_argument("--scenarios", default=os.path.join(ROOT, "eval", "scenarios.json"))
    ap.add_argument("--flow-key", required=True, help="Flow path used in scenarios.json (e.g. skills/tool_fault_investigation/flow.json).")
    ap.add_argument("--drop-branch", default=None, help="Demo aid: remove a branch line containing this text first.")
    ap.add_argument("--apply", action="store_true", help="Write the revised SOP back to --sop (or --out).")
    ap.add_argument("--out", default=None, help="Where to write the revised SOP (defaults to --sop with --apply).")
    args = ap.parse_args()

    with open(args.sop, "r", encoding="utf-8") as f:
        markdown = f.read()
    if args.drop_branch:
        markdown = _drop_branch(markdown, args.drop_branch)
        print(f"[demo] dropped branch containing '{args.drop_branch}'")

    validation = _load_validation(args.scenarios, args.flow_key)
    result = evolve_sop(markdown, validation)

    if not result.edits:
        print("No SOP changes proposed (the flow already satisfies the validation set).")
        return 0

    print(f"Proposed {len(result.edits)} SOP edit(s) (accepted by the held-out validation gate):\n")
    for edit in result.edits:
        print(f"  - {edit.describe()}")
    print("\n--- proposed SOP diff (for human approval) ---\n")
    print(result.diff)

    if args.apply:
        out = args.out or args.sop
        with open(out, "w", encoding="utf-8") as f:
            f.write(result.new_markdown)
        print(f"\nApplied. Wrote revised SOP to {out}. Recompile with parser.py to update the bundle.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
