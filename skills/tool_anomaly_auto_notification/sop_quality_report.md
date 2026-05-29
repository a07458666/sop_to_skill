# SOP 品質報告

- **狀態**: `通過`
- **規則來源**: `sop_rule.md`
- **SOP 名稱**: SOP: Tool Anomaly Auto-Notification and Ticket Procedure
- **解析出的狀態數**: 8

## 檢查發現

- 未發現阻擋轉換的品質問題。

## SOP 修改建議

- 轉換前不需要修改。

## API / MCP 整合驗證

| State | 整合 | Server | Params | 回傳分支 | 驗證 |
| --- | --- | --- | --- | --- | --- |
| `detect_anomaly_event` | API | - | 2 | 2 | ✅ 通過 |
| `place_tool_on_hold` | API | - | 2 | 2 | ✅ 通過 |
| `create_tracking_ticket` | MCP | `jira` | 3 | 2 | ✅ 通過 |
| `notify_oncall_owner` | MCP | `slack` | 2 | 2 | ✅ 通過 |
| `confirm_owner_acknowledgement` | API | - | 2 | 2 | ✅ 通過 |
| `escalate_to_equipment_engineering` | MCP | `slack` | 0 | 0 | ✅ 通過 |

執行前需掛載的 MCP server：`jira`、`slack`。

每個工具 state 的回傳分支即為 Agent 的「回傳判讀規則」：API 依 HTTP `status` 與 `body.result`、MCP 依 `isError` 與 `structuredContent.outcome` 比對分支後決定下一步。

## 規則摘要

本報告檢查了標題、目的、編號步驟、描述、工具宣告、分支邏輯、終點狀態、transition target、end state 可達性，以及 API / MCP 整合（參數契約、回傳判讀規則、MCP server 掛載需求）。
