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

| State | 整合 | Server | Params | 回傳分支 | 驗證 |
| --- | --- | --- | --- | --- | --- |
| `confirm_fault_event` | API | - | 2 | 2 | ✅ 通過 |
| `place_tool_on_hold` | API | - | 2 | 2 | ✅ 通過 |
| `check_lot_exposure` | API | - | 3 | 2 | ✅ 通過 |
| `review_process_data` | API | - | 3 | 2 | ✅ 通過 |
| `run_equipment_diagnostics` | API | - | 2 | 2 | ✅ 通過 |
| `create_corrective_action` | API | - | 3 | 2 | ✅ 通過 |
| `verify_tool_recovery` | API | - | 2 | 2 | ✅ 通過 |

此 SOP 未使用 MCP 工具（皆為 API 呼叫）。

每個工具 state 的回傳分支即為 Agent 的「回傳判讀規則」：API 依 HTTP `status` 與 `body.result`、MCP 依 `isError` 與 `structuredContent.outcome` 比對分支後決定下一步。

## 規則摘要

本報告檢查了標題、目的、編號步驟、描述、工具宣告、分支邏輯、終點狀態、transition target、end state 可達性，以及 API / MCP 整合（參數契約、回傳判讀規則、MCP server 掛載需求）。
