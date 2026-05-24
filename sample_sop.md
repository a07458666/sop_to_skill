# SOP: Semiconductor Tool Fault Investigation Procedure

## Purpose
This SOP defines the investigation workflow for diagnosing, containing, and resolving semiconductor production tool faults after an alarm, abnormal process result, or operator report.

---

## Workflow Steps

### Step 1: Confirm Fault Event
*   **Description**: Review the tool alarm, operator report, MES event, and timestamp to confirm that a real equipment fault occurred.
*   **System/Tool**: `mes_event_lookup` (Parameters: `tool_id`, `event_time`)
*   **Branching Logic**:
    *   **If fault event is confirmed**: Proceed to **Step 2 (Place Tool On Hold)**.
    *   **If event is duplicate or false alarm**: Transition to **Document No Fault Found** (State: `document_no_fault_found`).

### Step 2: Place Tool On Hold
*   **Description**: Stop further wafer starts on the affected tool and place the tool in engineering hold while investigation is active.
*   **System/Tool**: `tool_hold_request` (Parameters: `tool_id`, `hold_reason`)
*   **Branching Logic**:
    *   **If hold is applied successfully**: Proceed to **Step 3 (Check Lot Exposure)**.
    *   **If hold cannot be applied**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 3: Check Lot Exposure
*   **Description**: Identify affected lots, wafers, recipes, chambers, and time windows that may have been exposed to the fault condition.
*   **System/Tool**: `lot_history_query` (Parameters: `tool_id`, `event_time`, `lookback_hours`)
*   **Branching Logic**:
    *   **If exposed lots are found**: Proceed to **Step 4 (Review Process Data)**.
    *   **If no exposed lots are found**: Proceed to **Step 5 (Run Equipment Diagnostics)**.

### Step 4: Review Process Data
*   **Description**: Review SPC charts, sensor traces, metrology results, and recipe parameters for excursions linked to the fault window.
*   **System/Tool**: `process_data_review` (Parameters: `lot_ids`, `tool_id`, `recipe_id`)
*   **Branching Logic**:
    *   **If process excursion is detected**: Transition to **Open Material Review Board Case** (State: `open_mrb_case`).
    *   **If no process excursion is detected**: Proceed to **Step 5 (Run Equipment Diagnostics)**.

### Step 5: Run Equipment Diagnostics
*   **Description**: Execute equipment diagnostics, review PM status, check chamber health, and inspect relevant hardware or subsystem logs.
*   **System/Tool**: `equipment_diagnostics` (Parameters: `tool_id`, `chamber_id`)
*   **Branching Logic**:
    *   **If root cause is identified**: Proceed to **Step 6 (Create Corrective Action)**.
    *   **If root cause is not identified**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 6: Create Corrective Action
*   **Description**: Define corrective action, repair plan, verification requirement, and tool release criteria.
*   **System/Tool**: `corrective_action_create` (Parameters: `tool_id`, `root_cause`, `action_owner`)
*   **Branching Logic**:
    *   **If corrective action is approved**: Proceed to **Step 7 (Verify Tool Recovery)**.
    *   **If corrective action is rejected**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 7: Verify Tool Recovery
*   **Description**: Run qualification checks, golden wafer validation, or monitor lot review before releasing the tool back to production.
*   **System/Tool**: `tool_recovery_verify` (Parameters: `tool_id`, `qualification_plan`)
*   **Branching Logic**:
    *   **If verification passes**: Transition to **Release Tool To Production** (State: `release_tool_to_production`).
    *   **If verification fails**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

---

## End States

### State: `release_tool_to_production`
*   **Action**: Remove engineering hold, document recovery evidence, and notify manufacturing that the tool is released.

### State: `open_mrb_case`
*   **Action**: Open a Material Review Board case for affected lots and notify process engineering, quality, and manufacturing owners.

### State: `escalate_to_equipment_engineering`
*   **Action**: Escalate to equipment engineering with fault summary, exposed lot list, diagnostic evidence, and current containment status.

### State: `document_no_fault_found`
*   **Action**: Record the duplicate or false alarm finding, close the investigation, and notify the shift owner.
