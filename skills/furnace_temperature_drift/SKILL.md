---
name: "furnace-temperature-drift-investigation-procedure"
description: "Use when executing the SOP workflow for SOP: Furnace Temperature Drift Investigation Procedure. Follow the bundled flow.json state machine for deterministic routing, tool calls, decision branches, and terminal states."
---

# SOP: Furnace Temperature Drift Investigation Procedure

## Objective
Execute the Standard Operating Procedure (SOP) for: SOP: Furnace Temperature Drift Investigation Procedure.

## Core Rules
1. Follow the state transition graph defined in `flow.json`.
2. Always begin execution at the state ID: `confirm_temperature_drift_event`.
3. Do not jump to subsequent states without verifying transition conditions.
4. Only use tools explicitly mapped to the current state.
5. Treat states with type `end_state` as terminal states.

## Tools Required

- `corrective_action_create`
- `furnace_alarm_lookup`
- `furnace_diagnostics`
- `lot_history_query`
- `metrology_review`
- `tool_hold_request`
- `tool_recovery_verify`

## State Map Reference

### State: `confirm_temperature_drift_event` (Type: `action`)
- **Description**: Review furnace alarm history, recipe setpoint, actual temperature trace, and event timestamp to confirm the drift condition.
- **Tool**: `furnace_alarm_lookup` (Parameters: tool_id, event_time)
- **Branching / Next States**:
  - If outcome is `drift is confirmed` -> transition to `place_furnace_on_hold`
  - If outcome is `drift is not confirmed` -> transition to `document_no_fault_found`

### State: `place_furnace_on_hold` (Type: `action`)
- **Description**: Stop new lots from entering the furnace and place the equipment under engineering hold.
- **Tool**: `tool_hold_request` (Parameters: tool_id, hold_reason)
- **Branching / Next States**:
  - If outcome is `hold is applied successfully` -> transition to `identify_exposed_lots`
  - If outcome is `hold cannot be applied` -> transition to `escalate_to_equipment_engineering`

### State: `identify_exposed_lots` (Type: `action`)
- **Description**: Query lot history to identify wafers processed during the temperature drift window.
- **Tool**: `lot_history_query` (Parameters: tool_id, event_time, lookback_hours)
- **Branching / Next States**:
  - If outcome is `exposed lots are found` -> transition to `review_metrology_impact`
  - If outcome is `no exposed lots are found` -> transition to `run_furnace_diagnostics`

### State: `review_metrology_impact` (Type: `action`)
- **Description**: Review film thickness, uniformity, oxide growth rate, and SPC trends for exposed lots.
- **Tool**: `metrology_review` (Parameters: lot_ids, measurement_type)
- **Branching / Next States**:
  - If outcome is `metrology excursion is detected` -> transition to `open_mrb_case`
  - If outcome is `no metrology excursion is detected` -> transition to `run_furnace_diagnostics`

### State: `run_furnace_diagnostics` (Type: `action`)
- **Description**: Check thermocouple calibration, heater zone status, gas flow stability, and controller logs.
- **Tool**: `furnace_diagnostics` (Parameters: tool_id, zone_id)
- **Branching / Next States**:
  - If outcome is `root cause is identified` -> transition to `create_corrective_action`
  - If outcome is `root cause is not identified` -> transition to `escalate_to_equipment_engineering`

### State: `create_corrective_action` (Type: `action`)
- **Description**: Define repair action, post-maintenance qualification, owner, and release criteria.
- **Tool**: `corrective_action_create` (Parameters: tool_id, root_cause, action_owner)
- **Branching / Next States**:
  - If outcome is `corrective action is approved` -> transition to `verify_furnace_recovery`
  - If outcome is `corrective action is rejected` -> transition to `escalate_to_equipment_engineering`

### State: `verify_furnace_recovery` (Type: `action`)
- **Description**: Run qualification recipe and confirm temperature stability before production release.
- **Tool**: `tool_recovery_verify` (Parameters: tool_id, qualification_plan)
- **Branching / Next States**:
  - If outcome is `verification passes` -> transition to `release_furnace_to_production`
  - If outcome is `verification fails` -> transition to `escalate_to_equipment_engineering`

### State: `release_furnace_to_production` (Type: `end_state`)
- **Description**: End state: Remove engineering hold, attach recovery evidence, and notify manufacturing that the furnace is released.
- **Termination**: This is an end state.

### State: `open_mrb_case` (Type: `end_state`)
- **Description**: End state: Open a Material Review Board case for exposed lots and notify process engineering and quality owners.
- **Termination**: This is an end state.

### State: `escalate_to_equipment_engineering` (Type: `end_state`)
- **Description**: End state: Escalate with alarm records, lot exposure, diagnostic evidence, and current containment status.
- **Termination**: This is an end state.

### State: `document_no_fault_found` (Type: `end_state`)
- **Description**: End state: Record no-fault finding, close the event, and notify the shift owner.
- **Termination**: This is an end state.

