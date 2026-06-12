"""
Structured self-evolution of a compiled SOP flow (M2.5).

This is the structured analogue of SkillOpt (arXiv 2605.23904): instead of free-text
add/delete/replace edits on a `SKILL.md`, the optimizer proposes **bounded graph edits**
on a `flow.json` and accepts one **only when it strictly improves a held-out validation
score**. A rejected-edit buffer prevents retrying known-bad edits, and an edit budget
bounds how much the graph can change per run (a "textual learning rate" on the graph).

Because the edit space is the state machine (not prose), every accepted edit is a typed,
schema-valid graph operation — auditable and reversible — which is the differentiator over
optimizing a free-text document.

The loop is deterministic and needs no LLM/API: candidates come from observed adherence
gaps (a validation rollout that needs an outcome the graph doesn't define), and the
validation gate — running an oracle agent through the executor — selects the edit that
recovers the most scenarios. No network required.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import sys
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from executor import ExecutorError, SkillExecutor  # noqa: E402
from parser import StateMachine  # noqa: E402


@dataclass(frozen=True)
class Edit:
    """A bounded, typed edit on the flow graph."""

    kind: str  # "add_transition" | "set_signal_field"
    state_id: str
    outcome: Optional[str] = None
    target: Optional[str] = None
    field_value: Optional[str] = None

    def describe(self) -> str:
        if self.kind == "add_transition":
            return f"add_transition({self.state_id}: '{self.outcome}' -> {self.target})"
        if self.kind == "set_signal_field":
            return f"set_signal_field({self.state_id} = {self.field_value})"
        return f"{self.kind}({self.state_id})"

    def key(self) -> Tuple:
        return (self.kind, self.state_id, self.outcome, self.target, self.field_value)

    def apply(self, machine: StateMachine) -> StateMachine:
        data = copy.deepcopy(machine.model_dump())
        for st in data["states"]:
            if st["id"] != self.state_id:
                continue
            if self.kind == "add_transition":
                ns = st.get("next_states") or {}
                ns[self.outcome] = self.target
                st["next_states"] = ns
            elif self.kind == "set_signal_field":
                st["signal_field"] = self.field_value
        return StateMachine(**data)


# ---- scoring (the validation gate) ------------------------------------------
@dataclass
class Score:
    n: int = 0
    correct_end: int = 0
    blocked: int = 0

    @property
    def scalar(self) -> float:
        # primarily reward reaching the correct end; lightly penalise blocked steps
        return self.correct_end - 0.001 * self.blocked

    @property
    def correct_end_rate(self) -> float:
        return self.correct_end / self.n if self.n else 0.0


def _oracle_run(machine: StateMachine, scenario: dict) -> bool:
    """Run an oracle agent (always picks the scenario's correct outcome) under the
    executor. Returns True iff it reaches the scenario's expected end state. A missing
    outcome (an adherence gap) blocks the run and it fails."""
    situation = scenario["situation"]
    expected_end = scenario["expected_end_state"]
    try:
        ex = SkillExecutor(machine)
    except ExecutorError:
        return False
    guard = 0
    while not ex.is_terminal and guard < len(machine.states) + 3:
        guard += 1
        correct = situation.get(ex.current_id)
        if correct is None:
            break
        if correct not in (ex.current.next_states or {}):
            return False  # graph cannot honour the required outcome -> gap
        if ex.requires_approval() and not ex.is_approved():
            ex.approve("optimizer oracle")
        try:
            ex.step(correct)
        except ExecutorError:
            return False
    return ex.current_id == expected_end and ex.is_terminal


def score_flow(machine: StateMachine, scenarios: List[dict]) -> Score:
    s = Score(n=len(scenarios))
    for sc in scenarios:
        if _oracle_run(machine, sc):
            s.correct_end += 1
        else:
            s.blocked += 1
    return s


# ---- gap detection + candidate generation -----------------------------------
def detect_gaps(machine: StateMachine, scenarios: List[dict]) -> List[Tuple[str, str]]:
    """Find (state_id, outcome) pairs that a validation rollout needs but the graph
    does not define. These are the adherence gaps the optimizer tries to close."""
    states = {s.id: s for s in machine.states}
    gaps: List[Tuple[str, str]] = []
    seen = set()
    for sc in scenarios:
        situation = sc["situation"]
        try:
            ex = SkillExecutor(machine)
        except ExecutorError:
            continue
        guard = 0
        while not ex.is_terminal and guard < len(machine.states) + 3:
            guard += 1
            cur = ex.current_id
            correct = situation.get(cur)
            if correct is None:
                break
            if correct not in (states[cur].next_states or {}):
                if (cur, correct) not in seen:
                    seen.add((cur, correct))
                    gaps.append((cur, correct))
                break  # can't proceed past the gap in this rollout
            if ex.requires_approval() and not ex.is_approved():
                ex.approve("optimizer oracle")
            try:
                ex.step(correct)
            except ExecutorError:
                break
    return gaps


def candidate_edits(
    machine: StateMachine, gaps: List[Tuple[str, str]], rejected: set
) -> List[Edit]:
    """For each gap, propose add_transition edits to every plausible target. The
    validation gate decides which (if any) is correct; we never peek at ground truth."""
    state_ids = [s.id for s in machine.states]
    candidates: List[Edit] = []
    for state_id, outcome in gaps:
        for target in state_ids:
            if target == state_id:
                continue
            edit = Edit("add_transition", state_id, outcome=outcome, target=target)
            if edit.key() not in rejected:
                candidates.append(edit)
    return candidates


# ---- the optimization loop --------------------------------------------------
@dataclass
class OptimizeResult:
    machine: StateMachine
    accepted: List[Tuple[Edit, float, float]] = field(default_factory=list)  # edit, before, after
    rejected_count: int = 0
    rounds: int = 0
    start_score: float = 0.0
    final_score: float = 0.0


def optimize(
    machine: StateMachine,
    validation: List[dict],
    edit_budget: int = 5,
    max_rounds: int = 10,
) -> OptimizeResult:
    current = machine
    rejected: set = set()
    result = OptimizeResult(machine=current)
    result.start_score = score_flow(current, validation).scalar
    edits_made = 0

    while edits_made < edit_budget and result.rounds < max_rounds:
        result.rounds += 1
        base = score_flow(current, validation)
        gaps = detect_gaps(current, validation)
        if not gaps:
            break
        candidates = candidate_edits(current, gaps, rejected)
        if not candidates:
            break

        # rank candidates by the held-out validation gate; accept the best strict win
        best_edit = None
        best_score = base.scalar
        for edit in candidates:
            cand_score = score_flow(edit.apply(current), validation).scalar
            if cand_score > best_score:
                best_score = cand_score
                best_edit = edit

        if best_edit is None:
            # nothing strictly improves; bank all candidates as rejected and stop
            for edit in candidates:
                rejected.add(edit.key())
            result.rejected_count += len(candidates)
            break

        # accept the winner; buffer the rest of this round's candidates as rejected
        for edit in candidates:
            if edit.key() != best_edit.key():
                rejected.add(edit.key())
        result.rejected_count += len(candidates) - 1
        current = best_edit.apply(current)
        result.accepted.append((best_edit, base.scalar, best_score))
        edits_made += 1

    result.machine = current
    result.final_score = score_flow(current, validation).scalar
    return result


def render_report(
    result: OptimizeResult,
    validation: List[dict],
    holdout: Optional[List[dict]] = None,
) -> str:
    md = "# Structured Self-Evolution Report (M2.5)\n\n"
    md += (
        "Bounded graph edits on `flow.json`, accepted only when they strictly improve a "
        "held-out validation score (SkillOpt-aligned).\n\n"
    )
    val0 = result.start_score
    val1 = result.final_score
    md += f"- Validation correct-end score: **{val0:.3f} -> {val1:.3f}** "
    md += f"over {result.rounds} round(s)\n"
    md += f"- Edits accepted: **{len(result.accepted)}**, rejected (buffered): **{result.rejected_count}**\n"
    if holdout is not None:
        h = score_flow(result.machine, holdout)
        md += (
            f"- Held-out generalization: correct-end "
            f"{h.correct_end}/{h.n} ({h.correct_end_rate * 100:.0f}%)\n"
        )
    md += "\n## Accepted edits\n\n"
    if result.accepted:
        for edit, before, after in result.accepted:
            md += f"- `{edit.describe()}`  (validation {before:.3f} -> {after:.3f})\n"
    else:
        md += "- none (flow already satisfied the validation set).\n"
    return md


def _load_scenarios(path: str, flow_rel: str) -> Tuple[List[dict], List[dict]]:
    """Load scenarios for a given flow, split into validation (dev) and holdout."""
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    flow_name = flow_rel.replace("\\", "/")
    mine = [s for s in cfg["scenarios"] if s["flow"].replace("\\", "/") == flow_name]
    validation = [s for s in mine if s.get("split") != "holdout"]
    holdout = [s for s in mine if s.get("split") == "holdout"]
    return validation, holdout


def main() -> int:
    ap = argparse.ArgumentParser(description="Structured self-evolution of a flow.json (M2.5).")
    ap.add_argument("--flow", required=True, help="Path to the flow.json to evolve.")
    ap.add_argument(
        "--scenarios",
        default=os.path.join(ROOT, "eval", "scenarios.json"),
        help="Scenario set; filtered to the given flow and split into dev/holdout.",
    )
    ap.add_argument("--out", default=None, help="Write the evolved flow.json here.")
    ap.add_argument("--budget", type=int, default=5, help="Max edits to accept.")
    ap.add_argument(
        "--drop",
        default=None,
        help='Demo aid: remove a transition first, e.g. "state_id=outcome text".',
    )
    args = ap.parse_args()

    with open(args.flow, "r", encoding="utf-8") as f:
        machine = StateMachine(**json.load(f))

    flow_rel = os.path.relpath(os.path.abspath(args.flow), ROOT)
    validation, holdout = _load_scenarios(args.scenarios, flow_rel)
    if not validation:
        print(f"[warn] no validation scenarios matched flow '{flow_rel}'.", file=sys.stderr)

    if args.drop:
        sid, _, outcome = args.drop.partition("=")
        data = machine.model_dump()
        for st in data["states"]:
            if st["id"] == sid and st.get("next_states"):
                st["next_states"].pop(outcome, None)
        machine = StateMachine(**data)
        print(f"[demo] dropped transition {sid}: '{outcome}'")

    result = optimize(machine, validation, edit_budget=args.budget)
    report = render_report(result, validation, holdout)
    print(report)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(result.machine.model_dump(), f, indent=2, ensure_ascii=False)
        print(f"\nWrote evolved flow to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
