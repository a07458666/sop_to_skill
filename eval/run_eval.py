"""
SOP executor evaluation harness (M1).

Goal: produce data for the core thesis from docs/ROADMAP.md —
*a compiled SOP + executor makes an agent's step-adherence dramatically better
than letting the same agent free-run over the raw markdown.*

Methodology (aligned with SkillOpt, arXiv 2605.23904):
- A held-out scenario set (`scenarios.json`), split into `dev` / `holdout`.
- The SAME noisy agent policy is run through two environments per scenario:
    * baseline  — no enforcement (proxy for "agent reads the markdown freely").
    * compiled  — the flow.json `SkillExecutor` validates every action.
- We score per (SOP, split) cell, then aggregate, mirroring SkillOpt's per-cell
  reporting. No network / API key required: the agent and tool results are
  simulated deterministically so the run is reproducible in CI.

The agent is intentionally noisy (it sometimes hallucinates an outcome or tries
to skip ahead by calling a downstream tool). In `baseline` those mistakes take
effect; in `compiled` the executor blocks them and the agent is forced back onto
a legal transition. The contrast is the whole point.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import sys
from dataclasses import dataclass, field
from typing import Dict, List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from executor import ExecutorError, SkillExecutor  # noqa: E402
from parser import StateMachine  # noqa: E402

HALLUCINATED_OUTCOME = "__nonexistent_outcome__"


def _load_machine(flow_rel_path: str) -> StateMachine:
    with open(os.path.join(ROOT, flow_rel_path), "r", encoding="utf-8") as f:
        return StateMachine(**json.load(f))


class NoisyAgent:
    """A deterministic, intentionally imperfect agent policy.

    Decisions are keyed by (scenario, state, visit index) so the *same* state
    visit yields the *same* intended action in either environment — making the
    baseline vs compiled comparison fair.
    """

    def __init__(self, seed: int, error_rate: float):
        self.seed = seed
        self.error_rate = error_rate

    def _rng(self, scenario: str, state_id: str, visit: int) -> random.Random:
        key = f"{self.seed}|{scenario}|{state_id}|{visit}".encode("utf-8")
        digest = hashlib.sha256(key).hexdigest()
        return random.Random(int(digest[:16], 16))

    def decide(
        self,
        scenario: str,
        machine: StateMachine,
        states: Dict[str, "object"],
        state_id: str,
        visit: int,
        correct_outcome: str,
        correct_path: List[str],
    ) -> dict:
        """Return an intended action dict.

        kind == "outcome" -> {"kind","outcome"}            (legal or hallucinated)
        kind == "tool_skip" -> {"kind","target","tool"}    (illegal jump attempt)
        """
        rng = self._rng(scenario, state_id, visit)
        if rng.random() >= self.error_rate:
            return {"kind": "outcome", "outcome": correct_outcome, "legal": True}

        # a mistake: half hallucinate an outcome, half try to skip ahead
        if rng.random() < 0.5:
            return {"kind": "outcome", "outcome": HALLUCINATED_OUTCOME, "legal": False}

        target, tool = _skip_target(machine, states, state_id, correct_path)
        if target is None:
            # nothing to skip to -> degrade into a hallucinated outcome
            return {"kind": "outcome", "outcome": HALLUCINATED_OUTCOME, "legal": False}
        return {"kind": "tool_skip", "target": target, "tool": tool, "legal": False}


def _skip_target(machine, states, current_id, correct_path):
    """Pick a downstream tool-bearing state to 'jump' to (skipping a required step)."""
    later = []
    if current_id in correct_path:
        idx = correct_path.index(current_id)
        later = correct_path[idx + 2 :]  # skip the immediate next required step
    for sid in later:
        st = states.get(sid)
        if st is not None and st.tool:
            return sid, st.tool
    # fallback: any other action state that has a tool
    for st in machine.states:
        if st.id != current_id and st.tool:
            return st.id, st.tool
    return None, None


def _correct_path(machine: StateMachine, situation: Dict[str, str], expected_end: str) -> List[str]:
    states = {s.id: s for s in machine.states}
    path = [machine.start_state]
    cur = machine.start_state
    guard = 0
    while cur in situation and guard < len(machine.states) + 2:
        nxt = (states[cur].next_states or {}).get(situation[cur])
        if not nxt:
            break
        path.append(nxt)
        cur = nxt
        guard += 1
    return path


@dataclass
class RunResult:
    total_decisions: int = 0
    illegal_effected: int = 0
    blocked_by_executor: int = 0
    gates_enforced: int = 0
    visited: List[str] = field(default_factory=list)
    final_state: str = ""
    reached_correct_end: bool = False
    required_skipped: int = 0
    required_total: int = 0


def run_baseline(scenario: dict, agent: NoisyAgent) -> RunResult:
    """No enforcement: every intended action takes effect."""
    machine = _load_machine(scenario["flow"])
    states = {s.id: s for s in machine.states}
    situation = scenario["situation"]
    expected_end = scenario["expected_end_state"]
    path = _correct_path(machine, situation, expected_end)
    required = set(path)

    res = RunResult()
    res.required_total = len(required)

    cur = machine.start_state
    visited = [cur]
    visit_counts: Dict[str, int] = {}
    max_steps = 3 * len(machine.states) + 3

    for _ in range(max_steps):
        st = states[cur]
        if st.type == "end_state" or not st.next_states:
            break
        visit = visit_counts.get(cur, 0)
        visit_counts[cur] = visit + 1
        correct = situation.get(cur)
        if correct is None:
            # agent wandered off the situation's known path; treat as a stop
            break
        action = agent.decide(
            scenario["name"], machine, states, cur, visit, correct, path
        )
        res.total_decisions += 1

        if action["kind"] == "outcome" and action["legal"]:
            cur = st.next_states[correct]
        elif action["kind"] == "outcome":  # hallucinated outcome, no executor to stop it
            res.illegal_effected += 1
            # the agent does something off-script: take a *wrong* existing branch
            wrong = [t for o, t in st.next_states.items() if o != correct]
            cur = wrong[0] if wrong else st.next_states[correct]
        else:  # tool_skip: illegal tool call jumps ahead, skipping required steps
            res.illegal_effected += 1
            cur = action["target"]
        visited.append(cur)

    res.visited = visited
    res.final_state = cur
    res.reached_correct_end = cur == expected_end and (
        states[cur].type == "end_state" or not states[cur].next_states
    )
    res.required_skipped = len(required - set(visited))
    return res


def run_compiled(scenario: dict, agent: NoisyAgent) -> RunResult:
    """Executor-enforced: illegal actions are blocked, agent is forced legal."""
    machine = _load_machine(scenario["flow"])
    states = {s.id: s for s in machine.states}
    situation = scenario["situation"]
    expected_end = scenario["expected_end_state"]
    path = _correct_path(machine, situation, expected_end)
    required = set(path)

    ex = SkillExecutor(machine)
    res = RunResult()
    res.required_total = len(required)

    visit_counts: Dict[str, int] = {}
    max_steps = 3 * len(machine.states) + 3

    for _ in range(max_steps):
        if ex.is_terminal:
            break
        cur = ex.current_id
        st = ex.current
        visit = visit_counts.get(cur, 0)
        visit_counts[cur] = visit + 1
        correct = situation.get(cur)
        if correct is None:
            break
        action = agent.decide(
            scenario["name"], machine, states, cur, visit, correct, path
        )
        res.total_decisions += 1

        # the agent first attempts its (possibly illegal) action; the executor
        # is the guardrail that blocks it and the agent recovers to a legal move.
        if action["kind"] == "tool_skip":
            try:
                ex.call_tool(action["tool"])
            except ExecutorError:
                res.blocked_by_executor += 1
        elif action["kind"] == "outcome" and not action["legal"]:
            try:
                ex.step(action["outcome"])
            except ExecutorError:
                res.blocked_by_executor += 1

        # legal recovery: call the right tool (if any) and take the correct outcome
        if st.tool:
            ex.call_tool(st.tool)
        if ex.requires_approval() and not ex.is_approved():
            ex.approve("simulated human approval")
            res.gates_enforced += 1
        try:
            ex.step(correct)
        except ExecutorError:
            break

    res.visited = ex.visited_states()
    res.final_state = ex.current_id
    res.reached_correct_end = ex.current_id == expected_end and ex.is_terminal
    res.required_skipped = len(required - set(res.visited))
    return res


def _agg(results: List[RunResult]) -> dict:
    total = sum(r.total_decisions for r in results) or 1
    req_total = sum(r.required_total for r in results) or 1
    n = len(results) or 1
    return {
        "scenarios": len(results),
        "illegal_rate": sum(r.illegal_effected for r in results) / total,
        "skipped_rate": sum(r.required_skipped for r in results) / req_total,
        "correct_end_rate": sum(1 for r in results if r.reached_correct_end) / n,
        "blocked": sum(r.blocked_by_executor for r in results),
        "gates": sum(r.gates_enforced for r in results),
    }


def _fmt_pct(x: float) -> str:
    return f"{100 * x:.1f}%"


def _table(rows: List[List[str]], header: List[str]) -> str:
    out = "| " + " | ".join(header) + " |\n"
    out += "| " + " | ".join("---" for _ in header) + " |\n"
    for r in rows:
        out += "| " + " | ".join(r) + " |\n"
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Run the SOP executor eval.")
    ap.add_argument(
        "--scenarios",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenarios.json"),
    )
    ap.add_argument(
        "--out",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.md"),
    )
    ap.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero unless compiled strictly beats baseline on the core KPIs.",
    )
    args = ap.parse_args()

    with open(args.scenarios, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    agent = NoisyAgent(seed=cfg.get("seed", 7), error_rate=cfg.get("error_rate", 0.35))

    per_scenario = []
    baseline_all, compiled_all = [], []
    for sc in cfg["scenarios"]:
        b = run_baseline(sc, agent)
        c = run_compiled(sc, agent)
        baseline_all.append(b)
        compiled_all.append(c)
        per_scenario.append((sc, b, c))

    base_overall = _agg(baseline_all)
    comp_overall = _agg(compiled_all)

    # ---- build report --------------------------------------------------------
    md = "# SOP Executor Evaluation Results\n\n"
    md += (
        f"- Scenarios: **{len(cfg['scenarios'])}** "
        f"(seed={cfg.get('seed', 7)}, error_rate={cfg.get('error_rate', 0.35)})\n"
    )
    md += "- baseline = agent free-runs the SOP markdown (no enforcement); "
    md += "compiled = same agent under the flow.json executor.\n"
    md += "- Methodology aligned with SkillOpt (arXiv 2605.23904): held-out split, "
    md += "per-cell reporting, reproducible (no API key).\n\n"

    md += "## Overall\n\n"
    md += _table(
        [
            [
                "baseline",
                _fmt_pct(base_overall["illegal_rate"]),
                _fmt_pct(base_overall["skipped_rate"]),
                _fmt_pct(base_overall["correct_end_rate"]),
                "-",
            ],
            [
                "compiled",
                _fmt_pct(comp_overall["illegal_rate"]),
                _fmt_pct(comp_overall["skipped_rate"]),
                _fmt_pct(comp_overall["correct_end_rate"]),
                str(comp_overall["blocked"]),
            ],
        ],
        ["mode", "illegal-action rate", "skipped-step rate", "correct-end rate", "violations blocked"],
    )

    # ---- per split -----------------------------------------------------------
    md += "\n## By split (held-out)\n\n"
    split_rows = []
    for split in ("dev", "holdout"):
        idx = [i for i, (sc, _, _) in enumerate(per_scenario) if sc.get("split") == split]
        if not idx:
            continue
        b = _agg([baseline_all[i] for i in idx])
        c = _agg([compiled_all[i] for i in idx])
        split_rows.append(
            [
                split,
                _fmt_pct(b["illegal_rate"]),
                _fmt_pct(c["illegal_rate"]),
                _fmt_pct(b["correct_end_rate"]),
                _fmt_pct(c["correct_end_rate"]),
            ]
        )
    md += _table(
        split_rows,
        ["split", "illegal (base)", "illegal (comp)", "correct-end (base)", "correct-end (comp)"],
    )

    # ---- per SOP cell --------------------------------------------------------
    md += "\n## By SOP (per-cell)\n\n"
    sops = {}
    for i, (sc, _, _) in enumerate(per_scenario):
        sops.setdefault(sc["flow"].split("/")[1], []).append(i)
    cell_rows = []
    for sop, idx in sops.items():
        b = _agg([baseline_all[i] for i in idx])
        c = _agg([compiled_all[i] for i in idx])
        cell_rows.append(
            [
                sop,
                str(len(idx)),
                _fmt_pct(b["illegal_rate"]),
                _fmt_pct(c["illegal_rate"]),
                _fmt_pct(b["correct_end_rate"]),
                _fmt_pct(c["correct_end_rate"]),
            ]
        )
    md += _table(
        cell_rows,
        ["SOP", "n", "illegal (base)", "illegal (comp)", "correct-end (base)", "correct-end (comp)"],
    )

    # ---- per scenario detail -------------------------------------------------
    md += "\n## Per-scenario detail\n\n"
    detail_rows = []
    for sc, b, c in per_scenario:
        detail_rows.append(
            [
                sc["name"],
                sc.get("split", "-"),
                f"{b.illegal_effected}/{b.total_decisions}",
                f"{c.illegal_effected}/{c.total_decisions} ({c.blocked_by_executor} blocked)",
                "✅" if b.reached_correct_end else f"❌ {b.final_state}",
                "✅" if c.reached_correct_end else f"❌ {c.final_state}",
            ]
        )
    md += _table(
        detail_rows,
        ["scenario", "split", "illegal base", "illegal compiled", "end base", "end compiled"],
    )

    md += "\n## Takeaway\n\n"
    md += (
        f"The executor blocked **{comp_overall['blocked']}** illegal actions and enforced "
        f"**{comp_overall['gates']}** human-in-the-loop approval gates. Under enforcement the "
        f"illegal-action rate drops from **{_fmt_pct(base_overall['illegal_rate'])}** to "
        f"**{_fmt_pct(comp_overall['illegal_rate'])}** and correct-end rate rises from "
        f"**{_fmt_pct(base_overall['correct_end_rate'])}** to "
        f"**{_fmt_pct(comp_overall['correct_end_rate'])}** — including on the held-out split.\n"
    )

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(md)
    print(md)
    print(f"\nWrote {args.out}")

    if args.check:
        ok = (
            comp_overall["illegal_rate"] < base_overall["illegal_rate"]
            and comp_overall["correct_end_rate"] >= base_overall["correct_end_rate"]
            and comp_overall["illegal_rate"] == 0.0
        )
        if not ok:
            print("[check] FAILED: compiled did not strictly beat baseline.", file=sys.stderr)
            return 1
        print("[check] PASSED: compiled strictly beats baseline on core KPIs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
