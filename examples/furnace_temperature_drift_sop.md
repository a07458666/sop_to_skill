# SOP: Furnace Temperature Drift Investigation Procedure

## Purpose
This SOP defines the workflow for investigating furnace temperature drift events that may affect oxidation, diffusion, or anneal process stability.

---

## Workflow Steps

### Step 1: Confirm Temperature Drift Event
*   **Description**: Review furnace alarm history, recipe setpoint, actual temperature trace, and event timestamp to confirm the drift condition.
*   **System/Tool**: `furnace_alarm_lookup` (Parameters: `tool_id`, `event_time`)
*   **Branching Logic**:
    *   **If drift is confirmed**: Proceed to **Step 2 (Place Furnace On Hold)**.
    *   **If drift is not confirmed**: Transition to **Document No Fault Found** (State: `document_no_fault_found`).

### Step 2: Place Furnace On Hold
*   **Description**: Stop new lots from entering the furnace and place the equipment under engineering hold.
*   **System/Tool**: `tool_hold_request` (Parameters: `tool_id`, `hold_reason`)
*   **Branching Logic**:
    *   **If hold is applied successfully**: Proceed to **Step 3 (Identify Exposed Lots)**.
    *   **If hold cannot be applied**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 3: Identify Exposed Lots
*   **Description**: Query lot history to identify wafers processed during the temperature drift window.
*   **System/Tool**: `lot_history_query` (Parameters: `tool_id`, `event_time`, `lookback_hours`)
*   **Branching Logic**:
    *   **If exposed lots are found**: Proceed to **Step 4 (Review Metrology Impact)**.
    *   **If no exposed lots are found**: Proceed to **Step 5 (Run Furnace Diagnostics)**.

### Step 4: Review Metrology Impact
*   **Description**: Review film thickness, uniformity, oxide growth rate, and SPC trends for exposed lots.
*   **System/Tool**: `metrology_review` (Parameters: `lot_ids`, `measurement_type`)
*   **Branching Logic**:
    *   **If metrology excursion is detected**: Transition to **Open MRB Case** (State: `open_mrb_case`).
    *   **If no metrology excursion is detected**: Proceed to **Step 5 (Run Furnace Diagnostics)**.

### Step 5: Run Furnace Diagnostics
*   **Description**: Check thermocouple calibration, heater zone status, gas flow stability, and controller logs.
*   **System/Tool**: `furnace_diagnostics` (Parameters: `tool_id`, `zone_id`)
*   **Branching Logic**:
    *   **If root cause is identified**: Proceed to **Step 6 (Create Corrective Action)**.
    *   **If root cause is not identified**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 6: Create Corrective Action
*   **Description**: Define repair action, post-maintenance qualification, owner, and release criteria.
*   **System/Tool**: `corrective_action_create` (Parameters: `tool_id`, `root_cause`, `action_owner`)
*   **Branching Logic**:
    *   **If corrective action is approved**: Proceed to **Step 7 (Verify Furnace Recovery)**.
    *   **If corrective action is rejected**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

### Step 7: Verify Furnace Recovery
*   **Description**: Run qualification recipe and confirm temperature stability before production release.
*   **System/Tool**: `tool_recovery_verify` (Parameters: `tool_id`, `qualification_plan`)
*   **Branching Logic**:
    *   **If verification passes**: Transition to **Release Furnace To Production** (State: `release_furnace_to_production`).
    *   **If verification fails**: Transition to **Escalate To Equipment Engineering** (State: `escalate_to_equipment_engineering`).

---

## End States

### State: `release_furnace_to_production`
*   **Action**: Remove engineering hold, attach recovery evidence, and notify manufacturing that the furnace is released.

### State: `open_mrb_case`
*   **Action**: Open a Material Review Board case for exposed lots and notify process engineering and quality owners.

### State: `escalate_to_equipment_engineering`
*   **Action**: Escalate with alarm records, lot exposure, diagnostic evidence, and current containment status.

### State: `document_no_fault_found`
*   **Action**: Record no-fault finding, close the event, and notify the shift owner.
