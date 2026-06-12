# SOP 品質報告

- **狀態**: `通過`
- **規則來源**: `sop_rule.md`
- **SOP 名稱**: SOP: Semiconductor Tool Fault Investigation Procedure
- **解析出的狀態數**: 11

## 檢查發現

- 未發現阻擋轉換的品質問題。

## SOP 修改建議

- 轉換前不需要修改。

## API / MCP 整合驗證

| State | 整合 | Server | Params | Returns | Signal | 回傳分支 | 驗證 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `confirm_fault_event` | API | - | 2 | 5 | `is_duplicate` | 2 | ✅ 通過 |
| `place_tool_on_hold` | API | - | 2 | 3 | `applied` | 2 | ✅ 通過 |
| `check_lot_exposure` | API | - | 3 | 4 | `exposed_lot_count` | 2 | ✅ 通過 |
| `review_process_data` | API | - | 3 | 4 | `excursion_detected` | 2 | ✅ 通過 |
| `run_equipment_diagnostics` | API | - | 2 | 4 | `root_cause_found` | 2 | ✅ 通過 |
| `create_corrective_action` | API | - | 3 | 3 | `approval_state` | 2 | ✅ 通過 |
| `verify_tool_recovery` | API | - | 2 | 3 | `qual_result` | 2 | ✅ 通過 |

此 SOP 未使用 MCP 工具（皆為 API 呼叫）。

每個工具 state 的「回傳判讀規則」由 **Returns**（回傳欄位）、**Signal**（主要判讀欄位）與回傳分支共同構成：API 先驗 HTTP `status`、讀 `body.data`，MCP 先驗 `isError`、讀 `structuredContent`，再依 Signal 欄位值比對分支後決定下一步。

## 核准閘 (Approval Gates)

- 下列 state 已用 `**Approval**: required` 標註為人機協同核准閘，Agent 必須取得核准才能前進：`place_tool_on_hold`、`create_corrective_action`。

## 規則摘要

本報告檢查了標題、目的、編號步驟、描述、工具宣告、分支邏輯、終點狀態、transition target、end state 可達性，以及 API / MCP 整合（參數契約、回傳欄位 Returns、判讀欄位 Signal、回傳判讀規則、MCP server 掛載需求）。
