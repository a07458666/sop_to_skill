---
name: "semiconductor-tool-fault-investigation-procedure"
description: "Use when executing the SOP workflow for SOP: Semiconductor Tool Fault Investigation Procedure. Follow the bundled flow.json state machine for deterministic routing, tool calls, decision branches, and terminal states."
---

# SOP: Semiconductor Tool Fault Investigation Procedure

## Objective
Execute the Standard Operating Procedure (SOP) for: SOP: Semiconductor Tool Fault Investigation Procedure.

## Core Rules
1. Follow the state transition graph defined in `flow.json`.
2. Always begin execution at the state ID: `confirm_fault_event`.
3. Do not jump to subsequent states without verifying transition conditions.
4. Only use tools explicitly mapped to the current state.
5. Treat states with type `end_state` as terminal states.

## Tools Required

- `corrective_action_create`
- `equipment_diagnostics`
- `lot_history_query`
- `mes_event_lookup`
- `process_data_review`
- `tool_hold_request`
- `tool_recovery_verify`

## State Map Reference

### State: `confirm_fault_event` (Type: `action`)
- **Description**: Review the tool alarm, operator report, MES event, and timestamp to confirm that a real equipment fault occurred.
- **Tool**: `mes_event_lookup` (Parameters: tool_id, event_time)
- **Branching / Next States**:
  - If outcome is `fault event is confirmed` -> transition to `place_tool_on_hold`
  - If outcome is `event is duplicate or false alarm` -> transition to `document_no_fault_found`

### State: `place_tool_on_hold` (Type: `action`)
- **Description**: Stop further wafer starts on the affected tool and place the tool in engineering hold while investigation is active.
- **Tool**: `tool_hold_request` (Parameters: tool_id, hold_reason)
- **Branching / Next States**:
  - If outcome is `hold is applied successfully` -> transition to `check_lot_exposure`
  - If outcome is `hold cannot be applied` -> transition to `escalate_to_equipment_engineering`

### State: `check_lot_exposure` (Type: `decision`)
- **Description**: Identify affected lots, wafers, recipes, chambers, and time windows that may have been exposed to the fault condition.
- **Tool**: `lot_history_query` (Parameters: tool_id, event_time, lookback_hours)
- **Branching / Next States**:
  - If outcome is `exposed lots are found` -> transition to `review_process_data`
  - If outcome is `no exposed lots are found` -> transition to `run_equipment_diagnostics`

### State: `review_process_data` (Type: `action`)
- **Description**: Review SPC charts, sensor traces, metrology results, and recipe parameters for excursions linked to the fault window.
- **Tool**: `process_data_review` (Parameters: lot_ids, tool_id, recipe_id)
- **Branching / Next States**:
  - If outcome is `process excursion is detected` -> transition to `open_mrb_case`
  - If outcome is `no process excursion is detected` -> transition to `run_equipment_diagnostics`

### State: `run_equipment_diagnostics` (Type: `action`)
- **Description**: Execute equipment diagnostics, review PM status, check chamber health, and inspect relevant hardware or subsystem logs.
- **Tool**: `equipment_diagnostics` (Parameters: tool_id, chamber_id)
- **Branching / Next States**:
  - If outcome is `root cause is identified` -> transition to `create_corrective_action`
  - If outcome is `root cause is not identified` -> transition to `escalate_to_equipment_engineering`

### State: `create_corrective_action` (Type: `action`)
- **Description**: Define corrective action, repair plan, verification requirement, and tool release criteria.
- **Tool**: `corrective_action_create` (Parameters: tool_id, root_cause, action_owner)
- **Branching / Next States**:
  - If outcome is `corrective action is approved` -> transition to `verify_tool_recovery`
  - If outcome is `corrective action is rejected` -> transition to `escalate_to_equipment_engineering`

### State: `verify_tool_recovery` (Type: `action`)
- **Description**: Run qualification checks, golden wafer validation, or monitor lot review before releasing the tool back to production.
- **Tool**: `tool_recovery_verify` (Parameters: tool_id, qualification_plan)
- **Branching / Next States**:
  - If outcome is `verification passes` -> transition to `release_tool_to_production`
  - If outcome is `verification fails` -> transition to `escalate_to_equipment_engineering`

### State: `release_tool_to_production` (Type: `end_state`)
- **Description**: End state: Remove engineering hold, document recovery evidence, and notify manufacturing that the tool is released.
- **Termination**: This is an end state.

### State: `open_mrb_case` (Type: `end_state`)
- **Description**: End state: Open a Material Review Board case for affected lots and notify process engineering, quality, and manufacturing owners.
- **Termination**: This is an end state.

### State: `escalate_to_equipment_engineering` (Type: `end_state`)
- **Description**: End state: Escalate to equipment engineering with fault summary, exposed lot list, diagnostic evidence, and current containment status.
- **Termination**: This is an end state.

### State: `document_no_fault_found` (Type: `end_state`)
- **Description**: End state: Record the duplicate or false alarm finding, close the investigation, and notify the shift owner.
- **Termination**: This is an end state.

