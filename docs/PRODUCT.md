# 產品定位與設計（PRODUCT）

> 本文件是產品層的單一事實來源：定位、設計原則、競品對位、北極星指標。
> 開發排程與驗收標準見 `docs/ROADMAP.md`。

## 一句話定位

**讓 AI Agent 在受監管的作業環境中「可證明地」照 SOP 做事，並讓 SOP 在治理下持續變好。**

從 v0「把 SOP 編成 Skill 的編譯器（工具）」進化為 v1「**Agent 作業治理層（閉環系統）**」。

## 我們從 M0–M2.5 學到的三件事（定位依據）

1. **護城河在 runtime，不在 compile。** 「Markdown → 狀態圖」會被任何 LLM 商品化；
   但「執行時硬性強制 + 核准閘 + 稽核軌跡」是結構性能力。eval 已證明：同一個 agent，
   非法動作率 28%→0%、正確終點 60%→100%（baseline vs enforced）。
2. **產業正走向「自我改善的 skill」**（SkillOpt 為代表）。我們的差異化不是「也會自我改善」，
   而是**自我改善發生在受控的圖空間、且每個編輯都過 held-out 閘、可稽核可回溯**——
   這是受監管環境唯一能接受的自我演化形態。
3. **目前最大的弱點是「模擬」。** demo 與 eval 都是模擬 agent / 模擬工具。
   下一階段的最高槓桿是讓**真實 agent** 透過真實介面（MCP）在 enforcement 下執行 SOP。

## 產品 = 四支柱閉環

```
        ┌──────────── 人類 process owner ────────────┐
        │            （核准每一個變更）                │
        ▼                                            │
  [1 Compile]──▶ flow.json ──▶ [2 Enforce] ──▶ 稽核軌跡│
  SOP.md ◀──────── SOP diff ◀── [4 Evolve] ◀── [3 Prove]
```

| 支柱 | 元件 | 保證 |
| --- | --- | --- |
| **1. Compile** | `parser.py` / `index.html`（parity） | SOP(人讀) ⇄ flow.json(機器契約)，品質閘把關 |
| **2. Enforce** | `executor.py` | 圖外工具 / 未知 outcome 必被擋；核准閘；可序列化稽核 |
| **3. Prove** | `eval/` | 守步率數據（SkillOpt 方法論：held-out、逐 cell）；scenario suite = SOP 的迴歸測試 |
| **4. Evolve** | `optimizer.py` | 有界圖編輯，僅在 held-out 嚴格提升時接受；rejected buffer |

**核心心智模型：SOP 即程式碼（SOP-as-Code）。**
scenario = 測試集、quality report = linter、optimizer 提案 = 自動 PR、
版本與核准 = code review。SOP markdown 永遠是人類的單一事實來源；
flow.json 是它的可執行編譯產物。

## 目標用戶與買點

- **誰**：受監管製造（半導體 fab、製藥、能源）的製程/設備工程組織與自動化團隊；
  泛化到任何「流程錯誤代價高、需稽核」的營運場景。
- **買點**（按優先序）：
  1. **合規可證明**：「agent 確實照 SOP 做了，這是逐步證據」——稽核軌跡是交付物。
  2. **風險上限**：非法動作 0% 是硬保證（圖之外做不了），不是 prompt 祈禱。
  3. **人在迴路**：高風險步驟（hold/release/escalate）有核准閘。
  4. **流程持續改善**：守步缺口自動變成「待核准的 SOP 修訂提案」。

## 競品對位

| 對象 | 他們 | 我們 |
| --- | --- | --- |
| SkillOpt / 自由文字 skill 優化 | 文字編輯 + 驗證閘，無 runtime 強制 | 圖編輯 + 驗證閘 + **執行時強制與稽核** |
| LangGraph / workflow 引擎 | 開發者用程式碼定義圖 | **從營運文件編譯**；文件持續為人類事實來源；附守步證明 |
| SOP 塞 prompt / RAG | 守步靠模型自律 | 已量測：自律 = 28% 非法率；強制 = 0% |
| RPA | 腳本化固定操作，脆弱 | agent 保留判讀彈性，但路由被契約約束 |

**我們不是**：通用 workflow 引擎、BPMN 替代品、RPA。不追求圖靈完備的流程語言，
追求「人類寫得出、agent 守得住、稽核看得懂」的最小充分契約。

## 北極星指標

1. **真實 agent 守步率**（enforcement 下非法動作攔截數 / 正確終點率）——把模擬數據升級為真實數據。
2. **Time-to-governed-execution**：一份 SOP 從匯入到可被 agent 受控執行的時間。
3. **演化閉環次數**：缺口 → 提案 → 人核准 → 新版 SOP 的完整循環數。

## 風險

- **編譯品質**：真實世界的髒 SOP 會考驗 heuristic/Gemini 路徑 → 品質閘 + 人工確認流程是產品的一部分，不是補丁。
- **「模擬」質疑** → 下一階段 G1/G3 直接解決（真 agent + 真 MCP）。
- **單一領域樣本** → 編譯器保持領域無關；新增非製造業範例 SOP。
