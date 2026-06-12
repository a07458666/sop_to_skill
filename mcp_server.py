"""
SOP executor exposed as a Model Context Protocol (MCP) server (G1).

This lets a *real* agent (e.g. Claude) drive a compiled SOP under enforcement, instead
of the simulated agents used in `eval/`. The server wraps `SkillExecutor`: the agent can
ask for the current state's legal actions, report an outcome (rejected if it isn't a
defined transition), pass human-in-the-loop approval gates, gate-check its own tool calls,
and pull the audit trail.

Transport: MCP stdio — newline-delimited JSON-RPC 2.0 on stdin/stdout. Implemented without
the `mcp` SDK (unavailable offline) but speaking the core protocol: `initialize`,
`tools/list`, `tools/call`, `ping`. The dispatch layer (`MCPServer.handle`) is pure and
unit-tested; `serve_stdio()` is the thin I/O loop a client spawns.

Run:  python mcp_server.py [--flow skills/<name>/flow.json]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Optional, Tuple

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

from executor import ExecutorError, SkillExecutor, UnknownOutcomeError  # noqa: E402
from parser import StateMachine  # noqa: E402

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "sop-executor", "version": "0.1.0"}

# JSON-RPC error codes
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602


class MCPServer:
    """A minimal MCP server that enforces one SOP flow session at a time."""

    def __init__(self):
        self.executor: Optional[SkillExecutor] = None
        self.sop_name: Optional[str] = None

    # ---- tool implementations (return (payload, is_error)) -------------------
    def _need_session(self) -> Optional[dict]:
        if self.executor is None:
            return {"error": "no active SOP session; call sop_start first."}
        return None

    def t_sop_start(self, args: dict) -> Tuple[dict, bool]:
        flow_path = args.get("flow_path")
        flow_inline = args.get("flow")
        if flow_inline is not None:
            machine = StateMachine(**flow_inline)
        elif flow_path:
            path = flow_path if os.path.isabs(flow_path) else os.path.join(ROOT, flow_path)
            if not os.path.exists(path):
                return {"error": f"flow file not found: {flow_path}"}, True
            with open(path, "r", encoding="utf-8") as f:
                machine = StateMachine(**json.load(f))
        else:
            return {"error": "provide either 'flow_path' or 'flow'."}, True
        try:
            self.executor = SkillExecutor(machine)
        except ExecutorError as exc:
            return {"error": str(exc)}, True
        self.sop_name = machine.sop_name
        return {
            "sop_name": self.sop_name,
            "start_state": self.executor.current_id,
            "approval_gates": sorted(self.executor._approval_states),
            "available_actions": self.executor.available_actions(),
        }, False

    def t_sop_current_state(self, args: dict) -> Tuple[dict, bool]:
        miss = self._need_session()
        if miss:
            return miss, True
        return {"sop_name": self.sop_name, **self.executor.available_actions()}, False

    def t_sop_report_outcome(self, args: dict) -> Tuple[dict, bool]:
        miss = self._need_session()
        if miss:
            return miss, True
        outcome = args.get("outcome")
        if not isinstance(outcome, str):
            return {"error": "'outcome' (string) is required."}, True
        try:
            self.executor.step(outcome)
        except UnknownOutcomeError as exc:
            # surface the executor's guidance so the agent can self-correct
            return {
                "error": str(exc),
                "rejected_outcome": outcome,
                "allowed_outcomes": self.executor.allowed_transitions(),
            }, True
        except ExecutorError as exc:
            return {
                "error": str(exc),
                "requires_approval": self.executor.requires_approval(),
            }, True
        return {
            "moved_to": self.executor.current_id,
            "is_terminal": self.executor.is_terminal,
            "available_actions": self.executor.available_actions(),
        }, False

    def t_sop_request_approval(self, args: dict) -> Tuple[dict, bool]:
        miss = self._need_session()
        if miss:
            return miss, True
        if not self.executor.requires_approval():
            return {"error": f"state '{self.executor.current_id}' is not an approval gate."}, True
        self.executor.approve(args.get("note") or "approved via MCP")
        return {
            "approved_state": self.executor.current_id,
            "available_actions": self.executor.available_actions(),
        }, False

    def t_sop_call_tool(self, args: dict) -> Tuple[dict, bool]:
        miss = self._need_session()
        if miss:
            return miss, True
        tool = args.get("tool")
        if not isinstance(tool, str):
            return {"error": "'tool' (string) is required."}, True
        try:
            call = self.executor.call_tool(tool, args.get("parameters") or {})
        except ExecutorError as exc:
            return {"error": str(exc), "allowed_tool": self.executor.current.tool}, True
        return {"validated_call": call}, False

    def t_sop_audit_trail(self, args: dict) -> Tuple[dict, bool]:
        miss = self._need_session()
        if miss:
            return miss, True
        return {
            "sop_name": self.sop_name,
            "final_state": self.executor.current_id,
            "is_terminal": self.executor.is_terminal,
            "visited_states": self.executor.visited_states(),
            "trail": self.executor.audit_trail(),
        }, False

    # ---- tool registry -------------------------------------------------------
    TOOLS = [
        {
            "name": "sop_start",
            "description": "Start a SOP session from a compiled flow.json. Provide 'flow_path' "
            "(path to flow.json) or 'flow' (the flow object). Returns the start state and its "
            "legal actions.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "flow_path": {"type": "string", "description": "Path to a flow.json."},
                    "flow": {"type": "object", "description": "Inline flow.json object."},
                },
            },
            "handler": "t_sop_start",
        },
        {
            "name": "sop_current_state",
            "description": "Get the current state: description, the tool it may call, its "
            "parameters/returns/signal_field, whether approval is required, and the legal "
            "outcomes to report next.",
            "inputSchema": {"type": "object", "properties": {}},
            "handler": "t_sop_current_state",
        },
        {
            "name": "sop_report_outcome",
            "description": "Report the outcome observed after acting on the current state. Only "
            "outcomes defined by the state are accepted; an unknown outcome is rejected with the "
            "list of legal outcomes. Advances the state machine on success.",
            "inputSchema": {
                "type": "object",
                "properties": {"outcome": {"type": "string"}},
                "required": ["outcome"],
            },
            "handler": "t_sop_report_outcome",
        },
        {
            "name": "sop_request_approval",
            "description": "Approve the current human-in-the-loop gate so execution may advance "
            "past it. Optional 'note' is recorded in the audit trail.",
            "inputSchema": {
                "type": "object",
                "properties": {"note": {"type": "string"}},
            },
            "handler": "t_sop_request_approval",
        },
        {
            "name": "sop_call_tool",
            "description": "Validate a tool call against the current state before performing it. "
            "Calling any tool other than the one the state declares is rejected.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tool": {"type": "string"},
                    "parameters": {"type": "object"},
                },
                "required": ["tool"],
            },
            "handler": "t_sop_call_tool",
        },
        {
            "name": "sop_audit_trail",
            "description": "Return the serializable audit trail: visited states and every "
            "transition taken, for compliance evidence.",
            "inputSchema": {"type": "object", "properties": {}},
            "handler": "t_sop_audit_trail",
        },
    ]

    # ---- JSON-RPC dispatch (pure, unit-tested) -------------------------------
    def handle(self, message: dict) -> Optional[dict]:
        """Dispatch a JSON-RPC message. Returns a response dict, or None for notifications."""
        method = message.get("method")
        msg_id = message.get("id")
        params = message.get("params") or {}

        # notifications have no id and expect no response
        if msg_id is None and method and method.startswith("notifications/"):
            return None

        if method == "initialize":
            client_version = params.get("protocolVersion") or PROTOCOL_VERSION
            return _result(msg_id, {
                "protocolVersion": client_version,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": SERVER_INFO,
            })
        if method == "ping":
            return _result(msg_id, {})
        if method == "tools/list":
            return _result(msg_id, {
                "tools": [
                    {k: t[k] for k in ("name", "description", "inputSchema")}
                    for t in self.TOOLS
                ]
            })
        if method == "tools/call":
            return self._tools_call(msg_id, params)
        if msg_id is None:
            return None  # unknown notification
        return _error(msg_id, METHOD_NOT_FOUND, f"unknown method: {method}")

    def _tools_call(self, msg_id, params: dict) -> dict:
        name = params.get("name")
        args = params.get("arguments") or {}
        handler_name = next((t["handler"] for t in self.TOOLS if t["name"] == name), None)
        if handler_name is None:
            return _error(msg_id, INVALID_PARAMS, f"unknown tool: {name}")
        try:
            payload, is_error = getattr(self, handler_name)(args)
        except Exception as exc:  # defensive: never crash the server on a tool bug
            payload, is_error = {"error": f"{type(exc).__name__}: {exc}"}, True
        return _result(msg_id, {
            "content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False, indent=2)}],
            "isError": is_error,
        })

    # ---- stdio loop ----------------------------------------------------------
    def serve_stdio(self) -> None:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                message = json.loads(line)
            except json.JSONDecodeError:
                continue
            response = self.handle(message)
            if response is not None:
                sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
                sys.stdout.flush()


def _result(msg_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def _error(msg_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def main() -> int:
    ap = argparse.ArgumentParser(description="SOP executor as an MCP server (stdio).")
    ap.add_argument("--flow", default=None, help="Optional flow.json to auto-start a session.")
    args = ap.parse_args()
    server = MCPServer()
    if args.flow:
        payload, is_error = server.t_sop_start({"flow_path": args.flow})
        if is_error:
            print(f"[error] {payload.get('error')}", file=sys.stderr)
            return 1
        print(f"[mcp] started SOP session: {payload['sop_name']}", file=sys.stderr)
    server.serve_stdio()
    return 0


if __name__ == "__main__":
    sys.exit(main())
