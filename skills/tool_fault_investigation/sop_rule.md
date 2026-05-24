# SOP 轉換規則

撰寫要轉換成 Skill 狀態機的 Markdown SOP 時，請依照本規則整理內容。

## 必要結構

1. 使用一個 H1 標題：
   - 格式：`# SOP: <流程名稱>`
2. 加上目的段落：
   - 格式：`## Purpose`
   - 說明 SOP 適用情境，以及流程完成後應達成的結果。
3. 使用 H3 標題定義流程步驟：
   - 格式：`### Step N: <明確的動作名稱>`
   - Step 編號應連續，不跳號。
4. 每個步驟應包含：
   - `**Description**`：描述一個具體動作或判斷。
   - `**System/Tool**`：當此步驟需要呼叫外部系統或工具時必填。
   - `**Branching Logic**`：當下一步取決於條件時必填。
5. 定義終點狀態：
   - 區段：`## End States`
   - 格式：`### State: \`state_id\``
   - 每個終點狀態都應包含 `**Action**`。

## 分支規則

- 每個分支應以 `**If ...**:` 開頭。
- 每個分支應指向以下其中一種目標：
  - 另一個編號步驟，例如 `Step 3`
  - 明確的狀態 ID，例如 `(State: \`escalate_to_engineering\`)`
- 分支條件應盡量互斥。
- 避免使用「視情況」、「必要時」、「適當時」這類模糊條件；請改成可觀察的判斷訊號。

## 工具規則

- 工具名稱應用 backtick 標示。
- 工具參數也應用 backtick 標示。
- 參數名稱應穩定且具語意，例如 `tool_id`、`lot_ids`、`event_time`、`recipe_id`。
- 如果某步驟只是純判斷，沒有呼叫系統或工具，可以省略 `System/Tool`。

## 品質檢查清單

- SOP 有明確的起始步驟。
- 每個非終點步驟至少有一個往外的 transition。
- 每個 transition target 都存在。
- 每個 end state 至少被一個分支連到。
- State 名稱具體、明確，並偏向動作導向。
- SOP 提供足夠的工具與參數資訊，讓 Agent 能執行或知道該向使用者要求哪些資訊。

## 常見修正方式

- 如果某個步驟沒有分支，加入明確的 success/failure 或 pass/fail transition。
- 如果分支目標只是用文字描述，改成引用 `Step N`，或加上 `(State: \`state_id\`)`。
- 如果某個工具呼叫只是隱含在描述中，補上 `System/Tool` 與參數。
- 如果一個 end state 混合多種不同結果，請拆成多個 end states。
