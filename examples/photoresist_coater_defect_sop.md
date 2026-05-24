# SOP: Photoresist Coater Defect Investigation Procedure

## Purpose
This SOP defines the workflow for investigating abnormal photoresist coating defects such as streaks, bubbles, edge bead issues, or thickness non-uniformity.

---

## Workflow Steps

### Step 1: Confirm Defect Signal
*   **Description**: Review inspection image, defect map, metrology result, and operator report to confirm a coating-related defect.
*   **System/Tool**: `inspection_result_lookup` (Parameters: `lot_id`, `inspection_time`)
*   **Branching Logic**:
    *   **If coating defect is confirmed**: Proceed to **Step 2 (Hold Affected Tool And Lots)**.
    *   **If defect is not coating related**: Transition to **Route To Process Owner** (State: `route_to_process_owner`).

### Step 2: Hold Affected Tool And Lots
*   **Description**: Put the coater module on engineering hold and hold affected lots for engineering disposition.
*   **System/Tool**: `containment_hold_request` (Parameters: `tool_id`, `lot_ids`, `hold_reason`)
*   **Branching Logic**:
    *   **If containment is complete**: Proceed to **Step 3 (Review Coater Process Data)**.
    *   **If containment fails**: Transition to **Escalate To Manufacturing Lead** (State: `escalate_to_manufacturing_lead`).

### Step 3: Review Coater Process Data
*   **Description**: Review dispense pressure, spin speed, nozzle status, resist bottle lot, exhaust, and bake plate temperature.
*   **System/Tool**: `coater_process_data_review` (Parameters: `tool_id`, `lot_ids`, `recipe_id`)
*   **Branching Logic**:
    *   **If abnormal process signal is found**: Proceed to **Step 4 (Run Coater Diagnostics)**.
    *   **If no abnormal process signal is found**: Proceed to **Step 5 (Review Material History)**.

### Step 4: Run Coater Diagnostics
*   **Description**: Inspect dispense nozzle, pump calibration, cup cleanliness, track exhaust, and bake plate condition.
*   **System/Tool**: `coater_diagnostics` (Parameters: `tool_id`, `module_id`)
*   **Branching Logic**:
    *   **If equipment issue is identified**: Proceed to **Step 6 (Create Corrective Action)**.
    *   **If equipment issue is not identified**: Proceed to **Step 5 (Review Material History)**.

### Step 5: Review Material History
*   **Description**: Check resist bottle lot, expiration date, storage condition, filter change record, and chemical dispense history.
*   **System/Tool**: `material_history_review` (Parameters: `material_lot_id`, `tool_id`)
*   **Branching Logic**:
    *   **If material issue is suspected**: Transition to **Open Material Review Board Case** (State: `open_mrb_case`).
    *   **If material issue is not suspected**: Transition to **Escalate To Process Engineering** (State: `escalate_to_process_engineering`).

### Step 6: Create Corrective Action
*   **Description**: Define cleaning, calibration, part replacement, or recipe correction action and assign an owner.
*   **System/Tool**: `corrective_action_create` (Parameters: `tool_id`, `root_cause`, `action_owner`)
*   **Branching Logic**:
    *   **If corrective action is approved**: Proceed to **Step 7 (Verify Coater Recovery)**.
    *   **If corrective action is rejected**: Transition to **Escalate To Process Engineering** (State: `escalate_to_process_engineering`).

### Step 7: Verify Coater Recovery
*   **Description**: Run monitor wafer coating test, review defect scan, and confirm thickness uniformity.
*   **System/Tool**: `coater_recovery_verify` (Parameters: `tool_id`, `qualification_plan`)
*   **Branching Logic**:
    *   **If verification passes**: Transition to **Release Coater To Production** (State: `release_coater_to_production`).
    *   **If verification fails**: Transition to **Escalate To Process Engineering** (State: `escalate_to_process_engineering`).

---

## End States

### State: `release_coater_to_production`
*   **Action**: Release tool and lots according to engineering disposition, then notify manufacturing.

### State: `open_mrb_case`
*   **Action**: Open MRB case for affected material or lots and notify quality and process owners.

### State: `escalate_to_process_engineering`
*   **Action**: Escalate with defect evidence, process data, material history, and containment status.

### State: `escalate_to_manufacturing_lead`
*   **Action**: Escalate containment failure to the manufacturing shift lead.

### State: `route_to_process_owner`
*   **Action**: Route the event to the responsible non-coating process owner with evidence attached.
