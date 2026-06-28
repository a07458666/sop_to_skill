"""Tests for the MCP server wrapping the SOP executor (G1)."""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp_server import PROTOCOL_VERSION, MCPServer  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLOW = os.path.join(ROOT, "skills", "tool_fault_investigation", "flow.json")

_id = [0]


def _rpc(method, params=None):
    _id[0] += 1
    return {"jsonrpc": "2.0", "id": _id[0], "method": method, "params": params or {}}


def _call(server, name, arguments=None):
    """Invoke an MCP tool and return (payload_dict, is_error)."""
    resp = server.handle(_rpc("tools/call", {"name": name, "arguments": arguments or {}}))
    result = resp["result"]
    payload = json.loads(result["content"][0]["text"])
    return payload, result["isError"]


def test_initialize_handshake():
    server = MCPServer()
    resp = server.handle(_rpc("initialize", {"protocolVersion": PROTOCOL_VERSION}))
    res = resp["result"]
    assert res["serverInfo"]["name"] == "sop-executor"
    assert res["protocolVersion"] == PROTOCOL_VERSION
    assert "tools" in res["capabilities"]


def test_initialized_notification_has_no_response():
    server = MCPServer()
    assert server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None


def test_tools_list_exposes_the_sop_tools():
    server = MCPServer()
    resp = server.handle(_rpc("tools/list"))
    names = {t["name"] for t in resp["result"]["tools"]}
    assert {
        "sop_start",
        "sop_current_state",
        "sop_report_outcome",
        "sop_request_approval",
        "sop_call_tool",
        "sop_audit_trail",
    } <= names
    # every tool advertises an input schema
    for t in resp["result"]["tools"]:
        assert t["inputSchema"]["type"] == "object"


def test_unknown_method_returns_error():
    server = MCPServer()
    resp = server.handle(_rpc("does/not/exist"))
    assert resp["error"]["code"] == -32601


def test_current_state_requires_session():
    server = MCPServer()
    payload, is_error = _call(server, "sop_current_state")
    assert is_error
    assert "sop_start" in payload["error"]


def test_start_and_walk_legal_path():
    server = MCPServer()
    payload, is_error = _call(server, "sop_start", {"flow_path": FLOW})
    assert not is_error
    assert payload["start_state"] == "confirm_fault_event"

    payload, is_error = _call(server, "sop_report_outcome", {"outcome": "fault event is confirmed"})
    assert not is_error
    assert payload["moved_to"] == "place_tool_on_hold"


def test_illegal_outcome_is_rejected_with_guidance():
    server = MCPServer()
    _call(server, "sop_start", {"flow_path": FLOW})
    payload, is_error = _call(server, "sop_report_outcome", {"outcome": "nonsense"})
    assert is_error
    assert payload["rejected_outcome"] == "nonsense"
    assert "fault event is confirmed" in payload["allowed_outcomes"]


def test_approval_gate_enforced_over_mcp():
    server = MCPServer()
    _call(server, "sop_start", {"flow_path": FLOW})
    _call(server, "sop_report_outcome", {"outcome": "fault event is confirmed"})
    # place_tool_on_hold is an approval gate: advancing without approval fails
    payload, is_error = _call(server, "sop_report_outcome", {"outcome": "hold is applied successfully"})
    assert is_error
    assert payload["requires_approval"] is True
    # approve, then advance
    payload, is_error = _call(server, "sop_request_approval", {"note": "engineer ok"})
    assert not is_error
    payload, is_error = _call(server, "sop_report_outcome", {"outcome": "hold is applied successfully"})
    assert not is_error
    assert payload["moved_to"] == "check_lot_exposure"


def test_tool_call_is_gate_checked():
    server = MCPServer()
    _call(server, "sop_start", {"flow_path": FLOW})
    ok, is_error = _call(server, "sop_call_tool", {"tool": "mes_event_lookup"})
    assert not is_error and ok["validated_call"]["tool"] == "mes_event_lookup"
    bad, is_error = _call(server, "sop_call_tool", {"tool": "equipment_diagnostics"})
    assert is_error and bad["allowed_tool"] == "mes_event_lookup"


def test_audit_trail_records_transitions():
    server = MCPServer()
    _call(server, "sop_start", {"flow_path": FLOW})
    _call(server, "sop_report_outcome", {"outcome": "event is duplicate or false alarm"})
    payload, is_error = _call(server, "sop_audit_trail")
    assert not is_error
    assert payload["final_state"] == "document_no_fault_found"
    assert payload["is_terminal"] is True
    assert [e["event"] for e in payload["trail"]] == ["transition"]


def test_audit_trail_records_actor_and_verifies():
    server = MCPServer()
    _call(server, "sop_start", {"flow_path": FLOW})
    _call(
        server,
        "sop_report_outcome",
        {"outcome": "event is duplicate or false alarm", "actor": "engineer.lin"},
    )
    payload, is_error = _call(server, "sop_audit_trail")
    assert not is_error
    assert payload["trail"][0]["actor"] == "engineer.lin"
    assert payload["audit"]["ok"] is True
