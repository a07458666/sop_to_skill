"""
SkillExecutor — the runtime enforcement layer for a compiled SOP.

This is the M1 deliverable from docs/ROADMAP.md: it turns a `flow.json`
(state machine produced by ``parser.py``) into an *execution contract*. An agent
may only:

- call the tool that the current state declares (no graph-external tool calls),
- transition via an outcome that the current state actually defines, and
- advance past a human-in-the-loop *approval gate* only after it is approved.

Every step is recorded into a serializable audit trail. This is the hard
guarantee behind "the agent cannot skip steps" — the same routing rules the
SKILL.md asks the agent to follow, but enforced rather than merely requested.

The Pydantic schema (`State` / `StateMachine`) is reused from ``parser.py`` so
this module and the compiler never drift apart.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from typing import Dict, List, Optional

from parser import State, StateMachine

# Fallback inference: a state whose `requires_approval` is left unset (null) is
# treated as a human-in-the-loop approval gate when its id/description matches any
# of these substrings. An explicit `requires_approval` (True/False) in the SOP
# schema always wins over this convention.
DEFAULT_APPROVAL_KEYWORDS = (
    "hold",
    "escalat",
    "release",
    "approv",
    "mrb",
    "shutdown",
    "abort",
)


class ExecutorError(Exception):
    """Base class for all executor enforcement errors."""


class InvalidFlowError(ExecutorError):
    """The flow.json is structurally unusable (bad start state, dangling target)."""


class UnknownOutcomeError(ExecutorError):
    """The agent picked an outcome the current state does not define."""


class IllegalToolCallError(ExecutorError):
    """The agent tried to call a tool not mapped to the current state."""


class ApprovalRequiredError(ExecutorError):
    """The current state is an approval gate and has not been approved yet."""


class TerminalStateError(ExecutorError):
    """The agent tried to act after reaching an end state."""


class SkillExecutor:
    """Stateful executor that enforces a compiled SOP flow."""

    def __init__(
        self,
        machine: StateMachine,
        approval_states: Optional[List[str]] = None,
        approval_keywords: Optional[List[str]] = None,
    ):
        self.machine = machine
        self._states: Dict[str, State] = {s.id: s for s in machine.states}
        self._validate_flow()

        self._approval_keywords = tuple(
            k.lower() for k in (approval_keywords or DEFAULT_APPROVAL_KEYWORDS)
        )
        if approval_states is not None:
            self._approval_states = set(approval_states)
        else:
            self._approval_states = self._infer_approval_states()

        self.current_id: str = machine.start_state
        self._approved: set = set()
        self.history: List[dict] = []

    # ---- construction helpers ------------------------------------------------
    @classmethod
    def from_flow_file(cls, path: str, **kwargs) -> "SkillExecutor":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls(StateMachine(**data), **kwargs)

    def _validate_flow(self) -> None:
        if self.machine.start_state not in self._states:
            raise InvalidFlowError(
                f"start_state '{self.machine.start_state}' is not a defined state."
            )
        for state in self.machine.states:
            for outcome, target in (state.next_states or {}).items():
                if target not in self._states:
                    raise InvalidFlowError(
                        f"state '{state.id}' outcome '{outcome}' points to "
                        f"undefined target '{target}'."
                    )

    def _infer_approval_states(self) -> set:
        gates = set()
        for state in self.machine.states:
            if state.type == "end_state":
                continue
            declared = getattr(state, "requires_approval", None)
            if declared is True:  # explicit `**Approval**: required`
                gates.add(state.id)
                continue
            if declared is False:  # explicit opt-out — never a gate, skip inference
                continue
            haystack = f"{state.id} {state.description or ''}".lower()
            if any(kw in haystack for kw in self._approval_keywords):
                gates.add(state.id)
        return gates

    # ---- introspection -------------------------------------------------------
    @property
    def current(self) -> State:
        return self._states[self.current_id]

    @property
    def is_terminal(self) -> bool:
        state = self.current
        return state.type == "end_state" or not state.next_states

    def requires_approval(self, state_id: Optional[str] = None) -> bool:
        return (state_id or self.current_id) in self._approval_states

    def is_approved(self, state_id: Optional[str] = None) -> bool:
        return (state_id or self.current_id) in self._approved

    def allowed_transitions(self) -> List[str]:
        """Outcome keys the agent may legally choose from the current state."""
        return list((self.current.next_states or {}).keys())

    def available_actions(self) -> dict:
        """Everything an agent needs to act legally from the current state."""
        state = self.current
        return {
            "state": state.id,
            "type": state.type,
            "description": state.description,
            "tool": state.tool,
            "tool_kind": state.tool_kind,
            "mcp_server": state.mcp_server,
            "parameters": list(state.parameters or []),
            "returns": list(state.returns or []),
            "signal_field": state.signal_field,
            "requires_approval": self.requires_approval(),
            "approved": self.is_approved(),
            "allowed_outcomes": self.allowed_transitions(),
            "is_terminal": self.is_terminal,
        }

    # ---- enforcement ---------------------------------------------------------
    def call_tool(self, tool_name: str, parameters: Optional[dict] = None) -> dict:
        """Validate a tool call against the current state.

        Raises ``IllegalToolCallError`` when the agent tries to call any tool
        other than the one the current state declares. Returns a descriptor of
        the (validated) call; it does not perform real I/O — that is the
        executor's enforcement boundary, simulation belongs to callers/eval.
        """
        if self.is_terminal:
            raise TerminalStateError(
                f"state '{self.current_id}' is terminal; no tool calls allowed."
            )
        expected = self.current.tool
        if not expected:
            raise IllegalToolCallError(
                f"state '{self.current_id}' declares no tool; "
                f"call to '{tool_name}' is not allowed."
            )
        if tool_name != expected:
            raise IllegalToolCallError(
                f"state '{self.current_id}' allows tool '{expected}', "
                f"not '{tool_name}'."
            )
        return {
            "tool": expected,
            "tool_kind": self.current.tool_kind,
            "mcp_server": self.current.mcp_server,
            "parameters": parameters or {},
        }

    def approve(self, note: Optional[str] = None) -> None:
        """Approve the current state so execution may advance past the gate."""
        self._approved.add(self.current_id)
        if note:
            self.history.append(
                {
                    "seq": len(self.history),
                    "event": "approval",
                    "state": self.current_id,
                    "note": note,
                    "ts": _now(),
                }
            )

    def step(
        self,
        outcome: str,
        *,
        tool_result: Optional[dict] = None,
        approval: Optional[str] = None,
    ) -> State:
        """Advance via ``outcome``, enforcing the graph and approval gates."""
        if self.is_terminal:
            raise TerminalStateError(
                f"state '{self.current_id}' is terminal; cannot step further."
            )

        if approval is not None:
            self.approve(approval)

        if self.requires_approval() and not self.is_approved():
            raise ApprovalRequiredError(
                f"state '{self.current_id}' is an approval gate; call approve() "
                f"before stepping."
            )

        transitions = self.current.next_states or {}
        if outcome not in transitions:
            raise UnknownOutcomeError(
                f"state '{self.current_id}' has no outcome '{outcome}'. "
                f"Valid outcomes: {sorted(transitions.keys())}."
            )

        from_id = self.current_id
        target = transitions[outcome]
        self.history.append(
            {
                "seq": len(self.history),
                "event": "transition",
                "from": from_id,
                "tool": self.current.tool,
                "tool_kind": self.current.tool_kind,
                "outcome": outcome,
                "to": target,
                "approved": from_id in self._approved,
                "tool_result": tool_result,
                "ts": _now(),
            }
        )
        self.current_id = target
        return self.current

    # ---- audit ---------------------------------------------------------------
    def audit_trail(self) -> List[dict]:
        return list(self.history)

    def visited_states(self) -> List[str]:
        seq = [self.machine.start_state]
        for entry in self.history:
            if entry.get("event") == "transition":
                seq.append(entry["to"])
        return seq

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(
            {
                "sop_name": self.machine.sop_name,
                "start_state": self.machine.start_state,
                "final_state": self.current_id,
                "is_terminal": self.is_terminal,
                "approval_gates": sorted(self._approval_states),
                "trail": self.history,
            },
            ensure_ascii=False,
            indent=indent,
        )


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


# ---- CLI demo ---------------------------------------------------------------
def _run_cli(args: argparse.Namespace) -> int:
    ex = SkillExecutor.from_flow_file(args.flow)
    print(f"SOP: {ex.machine.sop_name}")
    print(f"Start: {ex.current_id}   Approval gates: {sorted(ex._approval_states)}\n")

    scripted = (
        [s.strip() for s in args.steps.split(";") if s.strip()] if args.steps else None
    )
    step_iter = iter(scripted) if scripted is not None else None

    while not ex.is_terminal:
        actions = ex.available_actions()
        print(f"State: {actions['state']} ({actions['type']})")
        print(f"  {actions['description']}")
        if actions["tool"]:
            kind = (actions["tool_kind"] or "api").upper()
            srv = f" @ {actions['mcp_server']}" if actions["mcp_server"] else ""
            print(f"  tool: {actions['tool']} [{kind}{srv}] params={actions['parameters']}")
        if actions["requires_approval"] and not actions["approved"]:
            if args.auto_approve or step_iter is not None:
                ex.approve("auto-approved (cli demo)")
                print("  [approval gate] auto-approved")
            else:
                input("  [approval gate] press Enter to approve and continue...")
                ex.approve("approved via cli")
        print(f"  outcomes: {ex.allowed_transitions()}")

        if step_iter is not None:
            try:
                choice = next(step_iter)
            except StopIteration:
                print("\n[scripted run ended before reaching a terminal state]")
                break
        else:
            choice = input("  choose outcome> ").strip()

        try:
            ex.step(choice)
        except ExecutorError as exc:
            print(f"  ! rejected: {exc}\n")
            if step_iter is not None:
                return 1
            continue
        print()

    if ex.is_terminal:
        print(f"Reached terminal state: {ex.current_id}")
        print(f"  {ex.current.description}\n")
    if args.audit:
        print(ex.to_json())
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Interactive executor for a compiled SOP flow.json")
    p.add_argument("--flow", required=True, help="Path to a compiled flow.json")
    p.add_argument(
        "--steps",
        default=None,
        help="Semicolon-separated outcomes for a non-interactive run, "
        'e.g. "fault event is confirmed;hold is applied successfully".',
    )
    p.add_argument("--auto-approve", action="store_true", help="Auto-approve approval gates.")
    p.add_argument("--audit", action="store_true", help="Print the JSON audit trail at the end.")
    return _run_cli(p.parse_args())


if __name__ == "__main__":
    sys.exit(main())
