# SOP 品質報告

- **狀態**: `通過`
- **規則來源**: `sop_rule.md`
- **SOP 名稱**: SOP: Furnace Temperature Drift Investigation Procedure
- **解析出的狀態數**: 11

## 檢查發現

- 未發現阻擋轉換的品質問題。

## SOP 修改建議

- 為 `confirm_temperature_drift_event` 補上 **Returns** 宣告（工具回傳欄位），讓 Agent 知道可判讀哪些值。
- 為 `place_furnace_on_hold` 補上 **Returns** 宣告（工具回傳欄位），讓 Agent 知道可判讀哪些值。
- 為 `identify_exposed_lots` 補上 **Returns** 宣告（工具回傳欄位），讓 Agent 知道可判讀哪些值。
- 為 `review_metrology_impact` 補上 **Returns** 宣告（工具回傳欄位），讓 Agent 知道可判讀哪些值。
- 為 `run_furnace_diagnostics` 補上 **Returns** 宣告（工具回傳欄位），讓 Agent 知道可判讀哪些值。
- 為 `create_corrective_action` 補上 **Returns** 宣告（工具回傳欄位），讓 Agent 知道可判讀哪些值。
- 為 `verify_furnace_recovery` 補上 **Returns** 宣告（工具回傳欄位），讓 Agent 知道可判讀哪些值。

## API / MCP 整合驗證

| State | 整合 | Server | Params | Returns | Signal | 回傳分支 | 驗證 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `confirm_temperature_drift_event` | API | - | 2 | 0 | - | 2 | ✅ 通過 |
| `place_furnace_on_hold` | API | - | 2 | 0 | - | 2 | ✅ 通過 |
| `identify_exposed_lots` | API | - | 3 | 0 | - | 2 | ✅ 通過 |
| `review_metrology_impact` | API | - | 2 | 0 | - | 2 | ✅ 通過 |
| `run_furnace_diagnostics` | API | - | 2 | 0 | - | 2 | ✅ 通過 |
| `create_corrective_action` | API | - | 3 | 0 | - | 2 | ✅ 通過 |
| `verify_furnace_recovery` | API | - | 2 | 0 | - | 2 | ✅ 通過 |

此 SOP 未使用 MCP 工具（皆為 API 呼叫）。

每個工具 state 的「回傳判讀規則」由 **Returns**（回傳欄位）、**Signal**（主要判讀欄位）與回傳分支共同構成：API 先驗 HTTP `status`、讀 `body.data`，MCP 先驗 `isError`、讀 `structuredContent`，再依 Signal 欄位值比對分支後決定下一步。

## 核准閘 (Approval Gates)

- 此 SOP 未以 `**Approval**: required` 明確標註核准閘；executor 仍會依慣例關鍵字（如 hold / escalate / release）於執行期推斷。

## 規則摘要

本報告檢查了標題、目的、編號步驟、描述、工具宣告、分支邏輯、終點狀態、transition target、end state 可達性，以及 API / MCP 整合（參數契約、回傳欄位 Returns、判讀欄位 Signal、回傳判讀規則、MCP server 掛載需求）。
