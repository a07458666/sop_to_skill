# SOP: Tool Anomaly Auto-Notification and Ticket Procedure

## Purpose
This SOP defines the workflow for automatically containing a semiconductor tool anomaly and notifying owners. It mixes internal system **API** calls (MES / EAP) with **MCP** server tools (Jira, Slack) so that an Agent can both act on the equipment and communicate through collaboration tools.

---

## Workflow Steps

### Step 1: Detect Anomaly Event
*   **Description**: Review the tool alarm, MES event, and timestamp to confirm a real anomaly occurred rather than a duplicate or false alarm.
*   **System/Tool**: `mes_event_lookup` (API) (Parameters: `tool_id`, `event_time`)
*   **Branching Logic**:
    *   **If anomaly is confirmed**: Proceed to **Step 2 (Place Tool On Hold)**.
    *   **If event is a false alarm**: Transition to **Document No Fault Found** (State: `document_no_fault_found`).

### Step 2: Place Tool On Hold
*   **Description**: Stop new wafer starts and place the affected tool under engineering hold through the equipment automation API.
*   **System/Tool**: `eap_tool_hold` (API) (Parameters: `tool_id`, `hold_reason`)
*   **Branching Logic**:
    *   **If hold is applied successfully**: Proceed to **Step 3 (Create Tracking Ticket)**.
    *   **If hold cannot be applied**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 3: Create Tracking Ticket
*   **Description**: Open a tracking ticket for the anomaly so the investigation has an auditable record and an owner.
*   **System/Tool**: `mcp__jira__create_issue` (MCP) (Parameters: `project_key`, `summary`, `severity`)
*   **Branching Logic**:
    *   **If ticket is created**: Proceed to **Step 4 (Notify On-Call Owner)**.
    *   **If ticket creation fails**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 4: Notify On-Call Owner
*   **Description**: Post the anomaly summary and ticket link to the equipment on-call channel so the responsible engineer is paged.
*   **System/Tool**: `mcp__slack__post_message` (MCP) (Parameters: `channel`, `message`)
*   **Branching Logic**:
    *   **If notification is delivered**: Proceed to **Step 5 (Confirm Owner Acknowledgement)**.
    *   **If notification fails**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 5: Confirm Owner Acknowledgement
*   **Description**: Poll the on-call acknowledgement status to confirm the engineer has accepted ownership of the ticket within the response window.
*   **System/Tool**: `oncall_ack_status` (API) (Parameters: `ticket_id`, `timeout_minutes`)
*   **Branching Logic**:
    *   **If owner acknowledges in time**: Transition to **Hand Off To Owner** (State: `hand_off_to_owner`).
    *   **If acknowledgement times out**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

---

## End States

### State: `hand_off_to_owner`
*   **Action**: Record that the acknowledged owner now drives the investigation, attach containment evidence to the ticket, and close the auto-notification flow.

### State: `escalate_to_equipment_engineering`
*   **Action**: Escalate to equipment engineering with the anomaly summary, hold status, and ticket reference using `mcp__slack__post_message` (MCP) on the escalation channel.

### State: `document_no_fault_found`
*   **Action**: Record the false alarm finding, release any temporary hold, and close the investigation.
