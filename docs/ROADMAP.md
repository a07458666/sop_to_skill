# 開發路線圖 (ROADMAP)

本文件把產品反思（見對話紀錄 / 可另存 `docs/PRODUCT_REVIEW.md`）收斂成可執行的開發計畫。

## 北極星與本階段目標

**北極星：** 從「能編譯 SOP 的工具」進化成「**能在執行時強制流程的 Agent 治理層**」。

**本階段（下一步）要證明的命題：** 把 SOP 編譯成狀態機 + 一個 executor，能讓 Agent 的**守步率**顯著優於直接閱讀原始 markdown。在這點被數據證明之前，其餘功能都是錦上添花。

**貫穿原則：**
1. 先還技術債（兩套平行實作）再加新功能，否則每個改動都要改兩遍。
2. 每個里程碑都要有**可量測的驗收標準**，不做無法驗證的功能。
3. `parser.py` 與 `index.html` 必須維持 parity（見 `CLAUDE.md`）。

## 里程碑總覽

| 里程碑 | 目標 | 為什麼 | 規模 |
| --- | --- | --- | --- |
| **M0 單一事實來源 + 測試** | `parser.py` 成為權威；加 golden snapshot 測試並接進 CI | 擋住兩套實作走鐘，讓後續迭代安全 | 小 |
| **M1 executor MVP + eval（推薦先做）** | 載入 `flow.json`、強制合法轉移、記錄 state history、設核准閘；用 eval 比較守步率 | **證明核心命題**，建立護城河 | 中 |
| **M2 工具 I/O 契約進 schema** | 把 demo 的 `toolCatalog`（output 欄位 + 判讀規則）提升為 SOP 標註 → 寫進 `flow.json`/`SKILL.md` | 讓「Agent 知道怎麼判讀回傳」進到真正的產物，而非只在 demo | 中 |
| **M2.5 結構化自我演化（SkillOpt 對位）** | 用 rollout 回饋對 `flow.json` 做**有界圖編輯**（補分支、收緊條件、設閘），只在 held-out 守步率提升時接受 | 對應 SkillOpt 的核心方法，但作用在**受控狀態圖**而非自由文字 → 我們的差異化主打 | 大 |
| **M3 漏斗與正確性** | 實作 tKMS 匯入、修非 ASCII id、executor 接真實 MCP | 打通真正的匯入路徑與真實整合 | 中 |
| **M4 企業就緒** | SOP 版本控管、閘門核准、稽核、RBAC、執行可觀測性 | 受監管環境的落地門檻 | 大 |

## 推薦的下一步：M1 — `flow.json` executor MVP + eval harness

### 範圍 (Scope)
一個小型 Python 模組（重用既有的 `State` / `StateMachine` Pydantic schema），把 `flow.json` 當作執行契約：

- 載入 `flow.json`，從 `start_state` 開始，維護 `current_state` 與 `history`。
- 曝露 API：`available_actions()`（當前 state 允許的 tool + 參數）、`allowed_transitions()`、`step(outcome)`（只接受 `next_states` 內的 outcome，否則丟錯）。
- **強制性**：拒絕圖外的工具呼叫與不存在的 outcome（這就是「Agent 無法跳步」的硬保證）。
- **人機協同閘**：標記為需核准的 state（如 hold / 升級）在通過前阻擋前進。
- **state history log**：每一步記錄 state、選用的 outcome、（模擬或真實）工具回傳，可序列化成稽核軌跡。

### 任務拆解
1. `executor.py`：`SkillExecutor` 類別（load / current / available_actions / step / history / is_terminal）。
2. 非法操作的錯誤型別與訊息（圖外 tool、未知 outcome、未過核准閘）。
3. 核准閘：以 state 設定（先用慣例：`type` 或命名，或在 schema 加 `requires_approval`）。
4. 一個 CLI demo：`python executor.py --flow skills/.../flow.json` 走互動式執行並印出 history。
5. **eval harness**（`eval/`）：對 N 個情境，比較
   - (a) baseline：把整份 SOP markdown 丟給模型，自由執行；
   - (b) compiled：flow.json + executor 約束下執行；
   量測**非法動作率 / 跳過必要步驟率 / 抵達正確 end state 率**。
   無 API key 時用腳本化的「會跳步的假 agent」當對照，仍能展示 executor 擋下違規。
   **方法論對齊 SkillOpt**（見下節）：採用 **held-out 驗證集**、**rollout 評分**、**逐 cell（情境 × 模型 × harness）比較**，讓結果可信、可對標既有研究。

### 檔案規劃
- 新增 `executor.py`（權威實作，重用 parser 的 schema）。
- 新增 `eval/`：情境檔 + 跑分腳本 + 結果輸出（markdown 表）。
- 新增 `tests/`：executor 行為測試（合法路徑、擋非法、核准閘、history）。
- 更新 `README.md` / `CLAUDE.md`：新增 executor 與 eval 的用法。
- （選配）`index.html` 模擬器改用與 executor 相同的轉移規則，維持 parity。

### 驗收標準
- executor 對合法路徑能走到 end state；對圖外 tool / 未知 outcome 會丟出明確錯誤。
- 核准閘在未核准時阻擋前進，核准後放行。
- history 可序列化成稽核軌跡。
- eval 產出一張表，**compiled 的非法動作率明顯低於 baseline**（核心證明）。
- `ruff`、測試、`html-validate` 全綠並接進 CI。

### 不在本里程碑（避免範圍蔓延）
- 真實 MCP 連線（M3）；治理／RBAC（M4）；tool I/O schema 提升（M2，但 executor 會預留接口）。

## M0（如先做這個）：單一事實來源 + 測試
- 抽出 compile + 驗證的 golden 測試：`sample_sop.md` / `examples/*` → 期望 `flow.json` snapshot + 品質報告關鍵發現。
- 決定 parity 策略：(a) 網頁載入 `parser.py` 產生的 JSON，或 (b) 共用一份 spec + 雙邊 snapshot 測試。
- CI 加上 `pytest`。
- 規模小、風險低，可與 M1 合併為同一個 PR 的前置。

## 依賴與順序
```
M0 (foundation) ──▶ M1 (executor + eval, 證明命題) ──▶ M2 (I/O schema) ──┬──▶ M3 (漏斗/真實 MCP) ──▶ M4 (治理)
                                                                          └──▶ M2.5 (結構化自我演化, SkillOpt 對位)
```
建議：**M0 併入 M1 一起做**（先補最小測試再開發 executor），其餘依序。M2.5 依賴 M1 的 eval/executor 與 M2 的 I/O 契約就緒。

## 相關工作對位：SkillOpt（arXiv 2605.23904）

Microsoft 的 **SkillOpt** 是「**訓練文件、而非訓練模型**」的 agent skill 優化器：frozen target model 跑 rollout → optimizer model 對成敗反思 → 提出**有界 add/delete/replace 編輯** → **只在 held-out 驗證分數嚴格提升時才接受**（並有 textual learning-rate 預算與 rejected-edit 記憶）。跨 6 benchmarks × 7 models × 3 harness 全 52 cell 最佳，部署期零額外推論成本。

**對本專案的三點意義：**

1. **佐證 eval/held-out gate 是關鍵**：SkillOpt 證明增益來自「觀察 rollout 後的回饋式編輯」而非更好的一次性 prompt。→ 強化 M1 把 **eval harness 當證明命題的中心**，且其方法論應對齊 SkillOpt（held-out 集、rollout 評分、逐 cell 比較）。
2. **定位差異即護城河**：SkillOpt 優化**自由文字 SKILL.md**；我們有**結構化 flow.json + 硬約束 + executor**。在狀態圖上做編輯可變成**受控圖操作**（加 state / 加 transition / 設 `requires_approval`），比自由文字更可控、可稽核 → 這是 **M2.5** 的立足點。
3. **策略風險**：領域正快速往「**自動改善 skill**」走；若只停在 compile + lint + 視覺化，價值會被上游化。我們的結構化 + executor + eval 正好能**承載這個優化迴圈，且帶治理保證**。

### M2.5 細節（結構化自我演化，SkillOpt-style 但作用在 flow.json）
- **迴圈**：對 SOP 跑 rollout batch（agent 在 executor 約束下執行）→ 收集失敗/守步缺口 → optimizer 提出**有界圖編輯**（補漏分支、收緊模糊條件、補參數、標記核准閘）→ **只在 held-out 守步率/結果分數提升時接受**，否則退回並記入 rejected 緩衝。
- **相對 SkillOpt 的差異**：編輯空間是**受約束的圖操作**而非自由文字 diff；每次編輯都經 schema 驗證與品質報告，天然可稽核、可回溯（接 M4 的版本控管）。
- **驗收**：在 held-out 情境上，自我演化後的 flow 守步率/正確 end state 率優於初版，且所有被接受的編輯都通過 schema 驗證與品質閘。
- **前置**：M1（executor + eval）與 M2（I/O 契約）就緒。

## 風險與緩解
- **eval 沒有 API key 不可信** → 用腳本化假 agent 對照，至少證明「executor 擋得住違規」這個確定性保證。
- **兩套實作再度走鐘** → M0 的 parity 測試是前提，不可跳過。
- **核准閘語意 SOP 未表達** → M1 先用慣例推斷，M2 在 schema 正式加 `requires_approval`。

## 成功指標（本階段）
- **守步率差異**：compiled vs baseline 的非法動作／跳步率（核心 KPI）。
- 測試覆蓋 compile + executor 主要路徑；CI 全綠。
- executor 能輸出可稽核的 state history。
