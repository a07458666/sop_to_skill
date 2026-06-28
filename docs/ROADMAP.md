# 開發路線圖 (ROADMAP)

本文件是開發排程與驗收標準的單一事實來源。產品定位、設計原則與北極星指標見 `docs/PRODUCT.md`。

## 北極星與階段目標

**北極星：** 「**讓 AI Agent 可證明地照 SOP 做事，並讓 SOP 在治理下持續變好**」（詳見 `docs/PRODUCT.md`）。

**第一階段命題（✅ 已用數據證明）：** 把 SOP 編譯成狀態機 + executor，守步率顯著優於直接閱讀 markdown
（非法動作 28%→0%、正確終點 60%→100%）。

**第二階段命題（進行中）：** 同樣的保證對「**真實 agent + 真實介面**」成立，且守步缺口能在人類治理下
閉環成 SOP 修訂。

**貫穿原則：**
1. 先還技術債（兩套平行實作）再加新功能，否則每個改動都要改兩遍。
2. 每個里程碑都要有**可量測的驗收標準**，不做無法驗證的功能。
3. `parser.py` 與 `index.html` 必須維持 parity（見 `CLAUDE.md`）。

## 里程碑總覽

| 里程碑 | 目標 | 為什麼 | 規模 |
| --- | --- | --- | --- |
| **M0 單一事實來源 + 測試** ✅ | golden snapshot（`parser.py` ↔ committed skills）+ parity（`parser.py` ↔ `index.html` JS，Node 執行），接進 CI（PR 也跑） | 擋住兩套實作走鐘，讓後續迭代安全 | 小 |
| **M1 executor MVP + eval** ✅ | 載入 `flow.json`、強制合法轉移、記錄 state history、設核准閘；用 eval 比較守步率 | **證明核心命題**，建立護城河 | 中 |
| **M2 工具 I/O 契約進 schema** ✅ | 新增 `**Returns**` / `**Signal**` SOP 標註 → `returns` / `signal_field` 寫進 `flow.json`，SKILL.md 渲染 Response Interpretation，品質報告驗證 | 讓「Agent 知道怎麼判讀回傳」進到真正的產物，而非只在 demo | 中 |
| **M2.5 結構化自我演化（SkillOpt 對位）** ✅ | `optimizer.py`：對 `flow.json` 做**有界圖編輯**（add_transition / set_signal_field），只在 held-out 驗證分數嚴格提升時接受，含 rejected-edit buffer 與 edit budget | 對應 SkillOpt 的核心方法，但作用在**受控狀態圖**而非自由文字 → 我們的差異化主打 | 大 |
| ~~M3 漏斗與正確性~~ | ~~tKMS 匯入、非 ASCII id、真實 MCP~~ | **已被 G1–G4 取代**（2026-06 重新規劃，見下） | - |
| ~~M4 企業就緒~~ | ~~版本控管、RBAC、可觀測性~~ | **已被 G4 取代** | - |

## 第二階段開發目標（G1–G4，2026-06 重新規劃）

依 `docs/PRODUCT.md` 的定位（四支柱閉環 + 真實化），下一階段按優先序：

### G1 — executor 變成 MCP server（✅ 完成）
讓**真實 agent**（Claude 等）透過 MCP 在 enforcement 下執行 SOP，終結「只是模擬」。
- 範圍：`mcp_server.py` 以 MCP 協議曝露 executor —— tools 如 `sop_start`、`sop_current_state`
  （回 description/tool/parameters/returns/signal/allowed_outcomes）、`sop_report_outcome`（驗 outcome、
  推進狀態）、`sop_request_approval`、`sop_audit_trail`。Agent 的真實工具呼叫由它閘控代理或核驗。
- 已完成：`mcp_server.py`（無 SDK 依賴，純 stdio JSON-RPC：`initialize`/`tools/list`/`tools/call`/`ping`）。
  Tools：`sop_start`、`sop_current_state`、`sop_report_outcome`（擋未知 outcome 並回傳合法清單）、
  `sop_request_approval`、`sop_call_tool`（閘控工具呼叫）、`sop_audit_trail`。
  `handle()` 為純函式並有單元測試；端到端 stdio 子行程 smoke test 通過（initialize→start→report）。
- 規模：中。**Done.**

### G2 — 演化閉環：提案以「SOP diff」回到人類（✅ 完成）
optimizer 的圖編輯反向渲染成 SOP markdown 修訂建議，人核准後重編譯——SOP 永遠是單一事實來源。
- 已完成：`evolve.py`。accepted graph edit → `apply_edit_to_markdown`（用 `make_state_id` 對應到
  正確的 step section，補 `**If ...**: (State: \`target\`)` 分支，保留縮排/bullet 風格）→ `unified_diff`
  供人核准 → `--apply` 後重編譯。閉環測試：drop 一條分支 → optimizer 提案 → SOP diff → 套用 →
  重編譯後 transition 復原且指向正確 target。
- 規模：中。**Done.**

### G3 — 真實 LLM agent 守步率 eval
把「28%→0%」從模擬升級為真模型對照（有/無 enforcement），讓核心主張可被外部驗證。
- 範圍：eval 增加 LLM 模式（有 API key 時跑真模型，無 key 時 CI 維持確定性模式）；逐 cell 報告。
- 驗收：`eval/results.md` 增加真模型 cell；CI 不依賴 API key 仍全綠。
- 規模：中。依賴 G1 的介面設計。

### G4 — 治理層（企業就緒）
SOP registry（版本、狀態機 diff）、核准流（誰能放行哪些閘）、RBAC-lite、執行可觀測性。
- 驗收：一份 SOP 的兩個版本可並存、回溯；每個核准有 actor 與時間戳；稽核可匯出。
- 規模：大。最後做——前三者把價值做實，G4 把它包成企業可買的形狀。
- 進度：
  - ✅ **狀態機 diff**（`flowdiff.py`）——兩版 `flow.json` 的圖層級差異（新增/移除 state、欄位變更含 `requires_approval`、分支 add/remove/retarget），結構化 dict + 可審查 markdown 報告，`--check` 可當 CI 閘。
  - ✅ **治理頁**（`governance.html`）——`flowdiff` 的 JS port 比較兩版、差異疊到流程圖、並渲染「演化建議」（把差異寫回 SOP 的修訂清單，evolve 閉環的 web 半）。
  - ✅ **稽核軌跡：actor + 時間戳 + 可匯出**——`executor` 的每筆動作（`tool_call`/`approval`/`transition`）記錄 actor 歸屬（核准閘記錄簽核者）與時間戳，並以 **prev_hash→entry_hash 雜湊鏈** 做防竄改（`verify_audit()` 重算驗證）；可匯出 JSON / CSV（`--export`），MCP 工具亦接受 `actor` 並回傳稽核驗證結果。
  - 後續：SOP registry/版本並存與回溯、核准流（誰能放行哪些閘 / RBAC-lite）、執行可觀測性。

**優先序與依賴：** G1 → G3（用 G1 的真實路徑跑量測）→ G2 → G4。

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
第一階段（✅ 完成）: M0 ──▶ M1 ──▶ M2 ──▶ M2.5
第二階段        : G1 ✅ ──▶ G2 ✅ ──▶ G3 (真實 agent eval, 需 API key) ──▶ G4 (治理層, 最後)
```
G1（MCP server）、G2（SOP diff 閉環）已完成。G3 需要可呼叫真實模型的環境（本機無 API key/網路），
待具備模型存取的環境再做；G4（治理層）最後。

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

## 風險與緩解（第二階段）
- **「只是模擬」的質疑持續** → G1 是唯一根治；在 G1 完成前對外敘事誠實標注模擬範圍。
- **真模型 eval 成本/不穩定** → G3 維持雙模式：CI 走確定性 agent（不依賴 key），真模型 cell 另行報告。
- **兩套實作走鐘**（持續風險）→ parity + golden 測試已入 CI，任何 compile 改動兩邊同改。
- ~~**核准閘語意仍靠慣例推斷**~~ → ✅ 已把 `requires_approval` 正式入 schema 與 SOP 標註（`**Approval**: required`）；明確標註優先於關鍵字推斷，未標註才回退 `DEFAULT_APPROVAL_KEYWORDS`。

## 成功指標（第二階段）
對齊 `docs/PRODUCT.md` 北極星：
1. **真實 agent 守步率**：G1+G3 產出真模型的非法攔截/正確終點數據。
2. **Time-to-governed-execution**：一份新 SOP 從匯入到可受控執行的時間。
3. **演化閉環次數**：缺口 → 提案 → 人核准 → 新版 SOP 的完整循環跑通至少一次（G2）。
