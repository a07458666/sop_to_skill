---
name: "photoresist-coater-defect-investigation-procedure"
description: "Use when executing the SOP workflow for SOP: Photoresist Coater Defect Investigation Procedure. Follow the bundled flow.json state machine for deterministic routing, tool calls, decision branches, and terminal states."
---

# SOP: Photoresist Coater Defect Investigation Procedure

## Objective
Execute the Standard Operating Procedure (SOP) for: SOP: Photoresist Coater Defect Investigation Procedure.

## Core Rules
1. Follow the state transition graph defined in `flow.json`.
2. Always begin execution at the state ID: `confirm_defect_signal`.
3. Do not jump to subsequent states without verifying transition conditions.
4. Only use tools explicitly mapped to the current state.
5. Treat states with type `end_state` as terminal states.
6. For `mcp` tools, invoke the named MCP server tool; for `api` tools, call the system/REST API.

## Tools Required

### API Tools

- `coater_diagnostics`
- `coater_process_data_review`
- `coater_recovery_verify`
- `containment_hold_request`
- `corrective_action_create`
- `inspection_result_lookup`
- `material_history_review`

## State Map Reference

### State: `confirm_defect_signal` (Type: `action`)
- **Description**: Review inspection image, defect map, metrology result, and operator report to confirm a coating-related defect.
- **Tool**: `inspection_result_lookup` (Parameters: lot_id, inspection_time)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `coating defect is confirmed` -> transition to `hold_affected_tool_and_lots`
  - If outcome is `defect is not coating related` -> transition to `route_to_process_owner`

### State: `hold_affected_tool_and_lots` (Type: `action`)
- **Description**: Put the coater module on engineering hold and hold affected lots for engineering disposition.
- **Tool**: `containment_hold_request` (Parameters: tool_id, lot_ids, hold_reason)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `containment is complete` -> transition to `review_coater_process_data`
  - If outcome is `containment fails` -> transition to `escalate_to_manufacturing_lead`

### State: `review_coater_process_data` (Type: `action`)
- **Description**: Review dispense pressure, spin speed, nozzle status, resist bottle lot, exhaust, and bake plate temperature.
- **Tool**: `coater_process_data_review` (Parameters: tool_id, lot_ids, recipe_id)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `abnormal process signal is found` -> transition to `run_coater_diagnostics`
  - If outcome is `no abnormal process signal is found` -> transition to `review_material_history`

### State: `run_coater_diagnostics` (Type: `action`)
- **Description**: Inspect dispense nozzle, pump calibration, cup cleanliness, track exhaust, and bake plate condition.
- **Tool**: `coater_diagnostics` (Parameters: tool_id, module_id)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `equipment issue is identified` -> transition to `create_corrective_action`
  - If outcome is `equipment issue is not identified` -> transition to `review_material_history`

### State: `review_material_history` (Type: `action`)
- **Description**: Check resist bottle lot, expiration date, storage condition, filter change record, and chemical dispense history.
- **Tool**: `material_history_review` (Parameters: material_lot_id, tool_id)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `material issue is suspected` -> transition to `open_mrb_case`
  - If outcome is `material issue is not suspected` -> transition to `escalate_to_process_engineering`

### State: `create_corrective_action` (Type: `action`)
- **Description**: Define cleaning, calibration, part replacement, or recipe correction action and assign an owner.
- **Tool**: `corrective_action_create` (Parameters: tool_id, root_cause, action_owner)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `corrective action is approved` -> transition to `verify_coater_recovery`
  - If outcome is `corrective action is rejected` -> transition to `escalate_to_process_engineering`

### State: `verify_coater_recovery` (Type: `action`)
- **Description**: Run monitor wafer coating test, review defect scan, and confirm thickness uniformity.
- **Tool**: `coater_recovery_verify` (Parameters: tool_id, qualification_plan)
- **Integration**: `API`
- **Branching / Next States**:
  - If outcome is `verification passes` -> transition to `release_coater_to_production`
  - If outcome is `verification fails` -> transition to `escalate_to_process_engineering`

### State: `release_coater_to_production` (Type: `end_state`)
- **Description**: End state: Release tool and lots according to engineering disposition, then notify manufacturing.
- **Termination**: This is an end state.

### State: `open_mrb_case` (Type: `end_state`)
- **Description**: End state: Open MRB case for affected material or lots and notify quality and process owners.
- **Termination**: This is an end state.

### State: `escalate_to_process_engineering` (Type: `end_state`)
- **Description**: End state: Escalate with defect evidence, process data, material history, and containment status.
- **Termination**: This is an end state.

### State: `escalate_to_manufacturing_lead` (Type: `end_state`)
- **Description**: End state: Escalate containment failure to the manufacturing shift lead.
- **Termination**: This is an end state.

### State: `route_to_process_owner` (Type: `end_state`)
- **Description**: End state: Route the event to the responsible non-coating process owner with evidence attached.
- **Termination**: This is an end state.

