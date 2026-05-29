---
name: "tool-anomaly-auto-notification-and-ticket-procedure"
description: "Use when executing the SOP workflow for SOP: Tool Anomaly Auto-Notification and Ticket Procedure. Follow the bundled flow.json state machine for deterministic routing, tool calls, decision branches, and terminal states."
---

# SOP: Tool Anomaly Auto-Notification and Ticket Procedure

## Objective
Execute the Standard Operating Procedure (SOP) for: SOP: Tool Anomaly Auto-Notification and Ticket Procedure.

## Core Rules
1. Follow the state transition graph defined in `flow.json`.
2. Always begin execution at the state ID: `detect_anomaly_event`.
3. Do not jump to subsequent states without verifying transition conditions.
4. Only use tools explicitly mapped to the current state.
5. Treat states with type `end_state` as terminal states.
6. For `mcp` tools, invoke the named MCP server tool; for `api` tools, call the system/REST API.

## Tools Required

### API Tools

- `eap_tool_hold`
- `mes_event_lookup`
- `oncall_ack_status`

### MCP Tools

- `mcp__jira__create_issue` (server: `jira`)
- `mcp__slack__post_message` (server: `slack`)

## State Map Reference

### State: `detect_anomaly_event` (Type: `action`)
- **Description**: Review the tool alarm, MES event, and timestamp to confirm a real anomaly occurred rather than a duplicate or false alarm.
- **Tool**: `mes_event_lookup` (Parameters: tool_id, event_time)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `anomaly is confirmed` -> transition to `place_tool_on_hold`
  - If outcome is `event is a false alarm` -> transition to `document_no_fault_found`

### State: `place_tool_on_hold` (Type: `action`)
- **Description**: Stop new wafer starts and place the affected tool under engineering hold through the equipment automation API.
- **Tool**: `eap_tool_hold` (Parameters: tool_id, hold_reason)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `hold is applied successfully` -> transition to `create_tracking_ticket`
  - If outcome is `hold cannot be applied` -> transition to `escalate_to_equipment_engineering`

### State: `create_tracking_ticket` (Type: `action`)
- **Description**: Open a tracking ticket for the anomaly so the investigation has an auditable record and an owner.
- **Tool**: `mcp__jira__create_issue` (Parameters: project_key, summary, severity)
- **Integration**: `MCP` (server: `jira`)
- **Branching / Next States**:
  - If outcome is `ticket is created` -> transition to `notify_oncall_owner`
  - If outcome is `ticket creation fails` -> transition to `escalate_to_equipment_engineering`

### State: `notify_oncall_owner` (Type: `action`)
- **Description**: Post the anomaly summary and ticket link to the equipment on-call channel so the responsible engineer is paged.
- **Tool**: `mcp__slack__post_message` (Parameters: channel, message)
- **Integration**: `MCP` (server: `slack`)
- **Branching / Next States**:
  - If outcome is `notification is delivered` -> transition to `confirm_owner_acknowledgement`
  - If outcome is `notification fails` -> transition to `escalate_to_equipment_engineering`

### State: `confirm_owner_acknowledgement` (Type: `action`)
- **Description**: Poll the on-call acknowledgement status to confirm the engineer has accepted ownership of the ticket within the response window.
- **Tool**: `oncall_ack_status` (Parameters: ticket_id, timeout_minutes)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `owner acknowledges in time` -> transition to `hand_off_to_owner`
  - If outcome is `acknowledgement times out` -> transition to `escalate_to_equipment_engineering`

### State: `hand_off_to_owner` (Type: `end_state`)
- **Description**: End state: Record that the acknowledged owner now drives the investigation, attach containment evidence to the ticket, and close the auto-notification flow.
- **Termination**: This is an end state.

### State: `escalate_to_equipment_engineering` (Type: `end_state`)
- **Description**: End state: Escalate to equipment engineering with the anomaly summary, hold status, and ticket reference using `mcp__slack__post_message` (MCP) on the escalation channel.
- **Tool**: `mcp__slack__post_message`
- **Integration**: `MCP` (server: `slack`)
- **Termination**: This is an end state.

### State: `document_no_fault_found` (Type: `end_state`)
- **Description**: End state: Record the false alarm finding, release any temporary hold, and close the investigation.
- **Termination**: This is an end state.

