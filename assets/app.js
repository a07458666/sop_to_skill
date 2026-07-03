        // Initialize Lucide Icons
        lucide.createIcons();

        function loadApiMcpSample() {
            const sample = document.getElementById('sample-api-mcp').textContent.trim();
            document.getElementById('markdown-input').value = sample;
            renderMarkdownPreview();
            document.getElementById('log-text').textContent = '已載入 API + MCP 範例。點「編譯 SOP 為 Skill」即可轉換與模擬。';
        }

        // Generated mock files data
        const generatedFiles = {
            'skill-md': `---
name: "semiconductor-tool-fault-investigation-procedure"
description: "Use when executing the SOP workflow for SOP: Semiconductor Tool Fault Investigation Procedure. Follow the bundled flow.json state machine for deterministic routing, tool calls, decision branches, and terminal states."
---

# SOP: Semiconductor Tool Fault Investigation Procedure

## Objective
Execute the Standard Operating Procedure (SOP) for: SOP: Semiconductor Tool Fault Investigation Procedure.

## Core Rules
1. Follow the state transition graph defined in \`flow.json\`.
2. Always begin execution at the state ID: \`confirm_fault_event\`.
3. Do not jump to subsequent states without verifying transition conditions.
4. Only use tools explicitly mapped to the current state.
5. Treat states with type \`end_state\` as terminal states.

## Tools Required

- \`corrective_action_create\`
- \`equipment_diagnostics\`
- \`lot_history_query\`
- \`mes_event_lookup\`
- \`process_data_review\`
- \`tool_hold_request\`
- \`tool_recovery_verify\`

## State Map Reference

### State: \`confirm_fault_event\` (Type: \`action\`)
- **Description**: Review the tool alarm, operator report, MES event, and timestamp to confirm that a real equipment fault occurred.
- **Tool**: \`mes_event_lookup\` (Parameters: tool_id, event_time)
- **Branching / Next States**:
  - If outcome is \`fault event is confirmed\` -> \`place_tool_on_hold\`
  - If outcome is \`event is duplicate or false alarm\` -> \`document_no_fault_found\``,
            'flow-json': `{
  "sop_name": "SOP: Semiconductor Tool Fault Investigation Procedure",
  "start_state": "confirm_fault_event",
  "states": [
    {
      "id": "confirm_fault_event",
      "type": "action",
      "description": "Confirm that a real equipment fault occurred.",
      "tool": "mes_event_lookup",
      "parameters": ["tool_id", "event_time"],
      "next_states": {
        "fault event is confirmed": "place_tool_on_hold",
        "event is duplicate or false alarm": "document_no_fault_found"
      }
    },
    {
      "id": "place_tool_on_hold",
      "type": "action",
      "description": "Stop wafer starts and place the tool on engineering hold.",
      "tool": "tool_hold_request",
      "parameters": ["tool_id", "hold_reason"],
      "next_states": {
        "hold is applied successfully": "check_lot_exposure",
        "hold cannot be applied": "escalate_to_equipment_engineering"
      }
    },
    {
      "id": "check_lot_exposure",
      "type": "decision",
      "description": "Identify lots, wafers, recipes, chambers, and fault window.",
      "tool": "lot_history_query",
      "parameters": ["tool_id", "event_time", "lookback_hours"],
      "next_states": {
        "exposed lots are found": "review_process_data",
        "no exposed lots are found": "run_equipment_diagnostics"
      }
    },
    {
      "id": "review_process_data",
      "type": "action",
      "description": "Review SPC, sensor, metrology, and recipe data.",
      "tool": "process_data_review",
      "parameters": ["lot_ids", "tool_id", "recipe_id"],
      "next_states": {
        "process excursion is detected": "open_mrb_case",
        "no process excursion is detected": "run_equipment_diagnostics"
      }
    },
    {
      "id": "run_equipment_diagnostics",
      "type": "action",
      "description": "Run equipment diagnostics and inspect subsystem logs.",
      "tool": "equipment_diagnostics",
      "parameters": ["tool_id", "chamber_id"],
      "next_states": {
        "root cause is identified": "create_corrective_action",
        "root cause is not identified": "escalate_to_equipment_engineering"
      }
    },
    {
      "id": "create_corrective_action",
      "type": "action",
      "description": "Define corrective action, repair plan, verification requirement, and tool release criteria.",
      "tool": "corrective_action_create",
      "parameters": ["tool_id", "root_cause", "action_owner"],
      "next_states": {
        "corrective action is approved": "verify_tool_recovery",
        "corrective action is rejected": "escalate_to_equipment_engineering"
      }
    },
    {
      "id": "verify_tool_recovery",
      "type": "action",
      "description": "Run qualification checks, golden wafer validation, or monitor lot review before release.",
      "tool": "tool_recovery_verify",
      "parameters": ["tool_id", "qualification_plan"],
      "next_states": {
        "verification passes": "release_tool_to_production",
        "verification fails": "escalate_to_equipment_engineering"
      }
    },
    {
      "id": "release_tool_to_production",
      "type": "end_state",
      "description": "Remove hold and release the tool back to production."
    },
    {
      "id": "open_mrb_case",
      "type": "end_state",
      "description": "Open a Material Review Board case for affected lots."
    },
    {
      "id": "escalate_to_equipment_engineering",
      "type": "end_state",
      "description": "Escalate to equipment engineering with evidence and containment status."
    },
    {
      "id": "document_no_fault_found",
      "type": "end_state",
      "description": "Record duplicate or false alarm finding and close the investigation."
    }
  ]
}`,
            'sop-rule-md': `# SOP 轉換規則

撰寫要轉換成 Skill 狀態機的 Markdown SOP 時，請依照本規則整理內容。

## 必要結構

1. 使用一個 H1 標題：
   - 格式：\`# SOP: <流程名稱>\`
2. 加上目的段落：
   - 格式：\`## Purpose\`
   - 說明 SOP 適用情境，以及流程完成後應達成的結果。
3. 使用 H3 標題定義流程步驟：
   - 格式：\`### Step N: <明確的動作名稱>\`
   - Step 編號應連續，不跳號。
4. 每個步驟應包含：
   - \`**Description**\`：描述一個具體動作或判斷。
   - \`**System/Tool**\`：當此步驟需要呼叫外部系統或工具時必填。
   - \`**Branching Logic**\`：當下一步取決於條件時必填。
5. 定義終點狀態：
   - 區段：\`## End States\`
   - 格式：\`### State: state_id\`；實際 SOP 中請用 backtick 包住 state ID。
   - 每個終點狀態都應包含 \`**Action**\`。

## 分支規則

- 每個分支應以 \`**If ...**:\` 開頭。
- 每個分支應指向另一個編號步驟或明確的狀態 ID。
- 分支條件應盡量互斥。
- 避免使用「視情況」、「必要時」、「適當時」這類模糊條件。

## 工具規則

- 工具名稱應用 backtick 標示。
- 工具參數也應用 backtick 標示。
- 參數名稱應穩定且具語意，例如 \`tool_id\`、\`lot_ids\`、\`event_time\`、\`recipe_id\`。
- 如果某步驟只是純判斷，沒有呼叫系統或工具，可以省略 \`System/Tool\`。

## API 與 MCP 整合標註

- 每個工具呼叫應標明整合方式：API 或 MCP。
- **API**（內部系統 / REST API）：在工具名稱後加上 \`(API)\`，例如 \`mes_event_lookup\` (API)。
- **MCP**（Model Context Protocol server tool）：加上 \`(MCP)\` / \`(MCP: server)\`，或使用 \`mcp__<server>__<tool>\` 命名慣例，例如 \`mcp__jira__create_issue\` (MCP)。
- 若未標註，命名為 \`mcp__...\` 者視為 MCP，其餘有工具者一律視為 API。

## 品質檢查清單

- SOP 有明確的起始步驟。
- 每個非終點步驟至少有一個往外的 transition。
- 每個 transition target 都存在。
- 每個 end state 至少被一個分支連到。
- State 名稱具體、明確，並偏向動作導向。
- SOP 提供足夠的工具與參數資訊，讓 Agent 能執行或知道該向使用者要求哪些資訊。`,
            'quality-report-md': `# SOP 品質報告

- **狀態**: \`通過\`
- **規則來源**: \`sop_rule.md\`
- **SOP 名稱**: SOP: Semiconductor Tool Fault Investigation Procedure
- **解析出的狀態數**: 11

## 檢查發現

- 未發現阻擋轉換的品質問題。

## SOP 修改建議

- 轉換前不需要修改。

## 規則摘要

本報告檢查了標題、目的、編號步驟、描述、工具宣告、分支邏輯、終點狀態、transition target，以及 end state 可達性。`
        };

        let currentTab = 'skill-md';
        let currentInputTab = 'markdown-raw';
        let simulationState = {
            currentStateId: null,
            history: []
        };
        // Simulated runtime mount state for MCP servers: { serverName: boolean }.
        let mcpMounts = {};

        // Tab switcher
        function switchTab(e, tabId) {
            currentTab = tabId;
            const container = e ? e.currentTarget.closest('.editor-container') : document;
            container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            if (e) {
                e.currentTarget.classList.add('active');
            } else {
                document.querySelector(`button[onclick*="${tabId}"]`).classList.add('active');
            }
            
            const display = document.getElementById('code-content');
            if (display.textContent.startsWith('//') || display.textContent === '') {
                return;
            }
            display.textContent = generatedFiles[tabId];
        }

        function renderInlineMarkdown(value) {
            return escapeHtml(value)
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        }

        function renderMarkdownPreview() {
            const markdown = document.getElementById('markdown-input').value;
            const lines = markdown.split(/\r?\n/);
            let html = '';
            let inList = false;

            function closeList() {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
            }

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) {
                    closeList();
                    return;
                }
                if (trimmed === '---') {
                    closeList();
                    html += '<hr>';
                    return;
                }
                const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
                if (heading) {
                    closeList();
                    html += `<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`;
                    return;
                }
                const bullet = trimmed.match(/^[*-]\s+(.+)$/);
                if (bullet) {
                    if (!inList) {
                        html += '<ul>';
                        inList = true;
                    }
                    html += `<li>${renderInlineMarkdown(bullet[1])}</li>`;
                    return;
                }
                closeList();
                html += `<p>${renderInlineMarkdown(trimmed)}</p>`;
            });
            closeList();
            document.getElementById('markdown-preview').innerHTML = html;
        }

        function switchInputTab(e, tabId) {
            currentInputTab = tabId;
            const container = e.currentTarget.closest('.editor-container');
            container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderMarkdownPreview();
            document.getElementById('markdown-input').classList.toggle('hidden', tabId !== 'markdown-raw');
            document.getElementById('markdown-preview').classList.toggle('hidden', tabId !== 'markdown-preview');
        }

        function detectToolMeta(toolName, annotationText) {
            const text = annotationText || '';
            let kind = null;
            let server = null;
            const mcpMarker = text.match(/\(\s*mcp(?:\s*:\s*([a-zA-Z0-9_.\-]+))?\s*\)/i);
            const apiMarker = text.match(/\(\s*(?:rest\s+)?api\s*\)/i);
            if (mcpMarker) {
                kind = 'mcp';
                if (mcpMarker[1]) server = mcpMarker[1];
            } else if (apiMarker) {
                kind = 'api';
            } else if (toolName && toolName.toLowerCase().startsWith('mcp__')) {
                kind = 'mcp';
            } else if (toolName) {
                kind = 'api';
            }
            if (kind === 'mcp' && !server && toolName) {
                const parts = toolName.split('__');
                if (parts.length >= 3 && parts[0].toLowerCase() === 'mcp') {
                    server = parts[1];
                }
            }
            return { kind, server };
        }

        function makeStateId(title) {
            const stepMatch = title.match(/^Step\s+(\d+)/i);
            const normalized = title
                .replace(/^Step\s+\d+:\s*/i, '')
                .replace(/^State:\s*/i, '')
                .replaceAll('`', '')
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '_');
            return normalized || (stepMatch ? `step_${stepMatch[1]}` : 'unnamed_state');
        }

        function compileMarkdownToFlow(markdown) {
            const titleMatch = markdown.match(/^#\s+(.+)$/m);
            const sopName = titleMatch ? titleMatch[1].trim() : 'Generated SOP';
            const sections = markdown.split(/^###\s+/m).slice(1);
            const stepNumberToId = {};
            const stepTitleToId = {};
            const states = [];

            sections.forEach(section => {
                const titleLine = section.split('\n')[0].trim();
                if (/^State:/i.test(titleLine)) return;
                const id = makeStateId(titleLine);
                const stepMatch = titleLine.match(/^Step\s+(\d+):\s*(.+)$/i);
                if (stepMatch) {
                    stepNumberToId[stepMatch[1]] = id;
                    stepTitleToId[stepMatch[2].toLowerCase().trim()] = id;
                }
                stepTitleToId[titleLine.toLowerCase().trim()] = id;
            });

            function resolveTarget(text) {
                const explicitState = text.match(/State:\s*`([^`]+)`/i);
                if (explicitState) return explicitState[1].trim();

                const stepRef = text.match(/Step\s+(\d+)/i);
                if (stepRef && stepNumberToId[stepRef[1]]) return stepNumberToId[stepRef[1]];

                const lowered = text.toLowerCase();
                for (const [title, id] of Object.entries(stepTitleToId)) {
                    if (title && lowered.includes(title)) return id;
                }

                const codeRef = text.match(/`([^`]+)`/);
                return codeRef ? codeRef[1].trim() : '';
            }

            sections.forEach(section => {
                const lines = section.split('\n');
                const titleLine = lines[0].trim();
                if (/^State:/i.test(titleLine)) return;

                const id = makeStateId(titleLine);
                let description = `Execute step: ${titleLine}`;
                let tool = null;
                let toolKind = null;
                let mcpServer = null;
                let parameters = null;
                let returns = null;
                let signalField = null;
                let requiresApproval = null;
                const nextStates = {};

                lines.slice(1).forEach(line => {
                    const trimmed = line.trim();
                    if (/\*\*Description\*\*:/i.test(trimmed)) {
                        description = trimmed.split(/:\s*/).slice(1).join(': ').trim();
                    }
                    if (/\*\*System\/Tool\*\*:/i.test(trimmed)) {
                        const codeMatches = [...trimmed.matchAll(/`([^`]+)`/g)].map(match => match[1]);
                        tool = codeMatches[0] || null;
                        parameters = codeMatches.length > 1 ? codeMatches.slice(1) : null;
                        const meta = detectToolMeta(tool, trimmed);
                        toolKind = meta.kind;
                        mcpServer = meta.server;
                    }
                    if (/[-*]\s+\*\*Returns\*\*:/i.test(trimmed)) {
                        const codes = [...trimmed.matchAll(/`([^`]+)`/g)].map(match => match[1]);
                        returns = codes.length ? codes : null;
                    }
                    if (/[-*]\s+\*\*Signal\*\*:/i.test(trimmed)) {
                        const signalMatch = trimmed.match(/`([^`]+)`/);
                        signalField = signalMatch ? signalMatch[1] : null;
                    }
                    if (/[-*]\s+\*\*(?:Requires\s+)?Approval\*\*:/i.test(trimmed)) {
                        const approvalVal = trimmed.split(/:\s*/).slice(1).join(': ').trim().toLowerCase();
                        requiresApproval = ['required', 'yes', 'true', '需要'].includes(approvalVal);
                    }
                    const branch = trimmed.match(/\*\*If\s+([^:]+)\*\*:\s*(.+)$/i) || trimmed.match(/If\s+([^:]+):\s*(.+)$/i);
                    if (branch) {
                        const target = resolveTarget(branch[2]);
                        if (target) nextStates[branch[1].toLowerCase().trim()] = target;
                    }
                });

                states.push({
                    id,
                    type: /check|evaluate/i.test(id) ? 'decision' : 'action',
                    description,
                    tool,
                    tool_kind: toolKind,
                    mcp_server: mcpServer,
                    parameters,
                    returns,
                    signal_field: signalField,
                    requires_approval: requiresApproval,
                    next_states: Object.keys(nextStates).length ? nextStates : null
                });
            });

            const endStateMatches = [...markdown.matchAll(/^###\s+State:\s*`([^`]+)`\s*\n\*\s+\*\*Action\*\*:\s*(.+)$/gm)];
            endStateMatches.forEach(match => {
                const actionText = match[2].trim();
                const toolMatch = actionText.match(/`([^`]+)`/);
                const endTool = toolMatch ? toolMatch[1].trim() : null;
                const meta = detectToolMeta(endTool, actionText);
                states.push({
                    id: match[1].trim(),
                    type: 'end_state',
                    description: `End state: ${actionText}`,
                    tool: endTool,
                    tool_kind: meta.kind,
                    mcp_server: meta.server,
                    parameters: null,
                    returns: null,
                    signal_field: null,
                    requires_approval: null,
                    next_states: null
                });
            });

            return {
                sop_name: sopName,
                start_state: states[0]?.id || '',
                states
            };
        }

        // Run compiler simulator
        function runCompile() {
            const spinner = document.getElementById('log-spinner');
            const logText = document.getElementById('log-text');
            const display = document.getElementById('code-content');
            
            display.textContent = '';
            spinner.style.display = 'block';
            
            const steps = [
                '正在讀取 Markdown SOP 檔案...',
                '正在發送至 Gemini 2.5 Flash 模型...',
                '正在解析與結構化狀態圖 (StateMachine)...',
                '正在分類工具整合方式 (API / MCP) 與 server...',
                '正在驗證 API / MCP 工具參數契約...',
                '正在建立回傳判讀規則 (response → branch)...',
                '寫入檔案 SKILL.md (合法 Skill 入口完成)...',
                '寫入檔案 flow.json (流程圖編譯完成)...',
                '執行 Skill 格式與整合驗證...',
                '編譯完成！此目錄可被 Agent 作為 Skill 載入。'
            ];

            let currentStep = 0;
            const interval = setInterval(() => {
                logText.textContent = steps[currentStep];
                currentStep++;
                
                if (currentStep >= steps.length) {
                    clearInterval(interval);
                    spinner.style.display = 'none';
                    const flow = compileMarkdownToFlow(document.getElementById('markdown-input').value);
                    generatedFiles['flow-json'] = JSON.stringify(flow, null, 2);
                    syncSkillMarkdownFromFlow();
                    syncQualityReport(document.getElementById('markdown-input').value);
                    renderRuleAndReportBlocks();
                    renderFlowFromGeneratedJson();
                    seedIntegrationFromFlow(flow);
                    syncMcpMounts();
                    renderIntegrationEditor();
                    renderMcpPanel();
                    resetSimulation();
                    display.textContent = generatedFiles[currentTab];
                    persistState();
                }
            }, 600);
        }

        function parseGeneratedFlow() {
            const raw = generatedFiles['flow-json'];
            if (!raw) return { sop_name: '', start_state: '', states: [] };
            return JSON.parse(raw);
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        function buildSkillMarkdown(flow) {
            const apiTools = [...new Set(flow.states.filter(s => s.tool && s.tool_kind !== 'mcp').map(s => s.tool))].sort();
            const mcpTools = [...new Map(flow.states
                .filter(s => s.tool && s.tool_kind === 'mcp')
                .map(s => [s.tool, s.mcp_server || ''])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
            const skillName = flow.sop_name
                .replace(/^SOP:\s*/i, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') || 'generated-sop-skill';

            let md = `---\n`;
            md += `name: "${skillName}"\n`;
            md += `description: "Use when executing the SOP workflow for ${flow.sop_name}. Follow the bundled flow.json state machine for deterministic routing, tool calls, decision branches, and terminal states."\n`;
            md += `---\n\n# ${flow.sop_name}\n\n`;
            md += `## Objective\nExecute the Standard Operating Procedure (SOP) for: ${flow.sop_name}.\n\n`;
            md += `## Core Rules\n`;
            md += `1. Follow the state transition graph defined in \`flow.json\`.\n`;
            md += `2. Always begin execution at the state ID: \`${flow.start_state}\`.\n`;
            md += `3. Do not jump to subsequent states without verifying transition conditions.\n`;
            md += `4. Only use tools explicitly mapped to the current state.\n`;
            md += `5. Treat states with type \`end_state\` as terminal states.\n`;
            md += `6. For \`mcp\` tools, invoke the named MCP server tool; for \`api\` tools, call the system/REST API.\n\n`;

            if (apiTools.length || mcpTools.length) {
                md += `## Tools Required\n\n`;
                if (apiTools.length) {
                    md += `### API Tools\n\n${apiTools.map(tool => `- \`${tool}\``).join('\n')}\n\n`;
                }
                if (mcpTools.length) {
                    md += `### MCP Tools\n\n${mcpTools.map(([tool, server]) => `- \`${tool}\`${server ? ` (server: \`${server}\`)` : ''}`).join('\n')}\n\n`;
                }
            }

            md += `## State Map Reference\n\n`;
            flow.states.forEach(state => {
                md += `### State: \`${state.id}\` (Type: \`${state.type}\`)\n`;
                md += `- **Description**: ${state.description}\n`;
                if (state.tool) {
                    const params = state.parameters?.length ? ` (Parameters: ${state.parameters.join(', ')})` : '';
                    md += `- **Tool**: \`${state.tool}\`${params}\n`;
                    if (state.tool_kind) {
                        const serverNote = state.tool_kind === 'mcp' && state.mcp_server ? ` (server: \`${state.mcp_server}\`)` : '';
                        md += `- **Integration**: \`${state.tool_kind.toUpperCase()}\`${serverNote}\n`;
                    }
                    if (state.returns && state.returns.length) {
                        md += `- **Returns**: ${state.returns.map(r => `\`${r}\``).join(', ')}\n`;
                    }
                    if (state.next_states && Object.keys(state.next_states).length) {
                        const check = state.tool_kind === 'mcp'
                            ? 'the `isError` flag (true ⇒ failure branch)'
                            : 'HTTP `status` (non-2xx ⇒ failure branch)';
                        const channel = state.tool_kind === 'mcp' ? '`structuredContent`' : '`body.data`';
                        const signal = state.signal_field ? `, inspect \`${state.signal_field}\`` : '';
                        md += `- **Response Interpretation**: verify ${check}, read ${channel}${signal}, then match the outcome against a branch below.\n`;
                    }
                }
                if (state.requires_approval) {
                    md += `- **Approval Gate**: requires human-in-the-loop approval before advancing; do not transition until a human approves.\n`;
                }
                if (state.next_states && Object.keys(state.next_states).length) {
                    md += `- **Branching / Next States**:\n`;
                    Object.entries(state.next_states).forEach(([condition, target]) => {
                        md += `  - If outcome is \`${condition}\` -> transition to \`${target}\`\n`;
                    });
                } else {
                    md += `- **Termination**: This is an end state.\n`;
                }
                md += `\n`;
            });

            return md;
        }

        function syncSkillMarkdownFromFlow() {
            generatedFiles['skill-md'] = buildSkillMarkdown(parseGeneratedFlow());
        }

        function renderRuleAndReportBlocks() {
            const rule = document.getElementById('sop-rule-content');
            const report = document.getElementById('quality-report-content');
            if (rule) rule.value = generatedFiles['sop-rule-md'];
            if (report) report.textContent = generatedFiles['quality-report-md'];
            updateQualityBadge();
        }

        // Surface the quality verdict as a compact badge in the (collapsed) report summary,
        // so the user sees pass/fail without expanding a wall of markdown.
        function updateQualityBadge() {
            const badge = document.getElementById('quality-status-badge');
            if (!badge) return;
            const passed = /\*\*狀態\*\*:\s*`通過`/.test(generatedFiles['quality-report-md'] || '');
            badge.textContent = passed ? '✅ 通過' : '⚠️ 需修訂';
            badge.className = 'status-badge ' + (passed ? 'ok' : 'warn');
            // Auto-expand the (otherwise collapsed) report when there are problems to fix.
            const card = document.getElementById('quality-report-card');
            if (card && !passed) card.open = true;
        }

        function syncRuleContentFromEditor() {
            generatedFiles['sop-rule-md'] = document.getElementById('sop-rule-content').value;
        }

        function toggleRuleEdit() {
            const editor = document.getElementById('sop-rule-content');
            const button = document.getElementById('edit-rule-btn');
            const isReadonly = editor.hasAttribute('readonly');
            if (isReadonly) {
                editor.removeAttribute('readonly');
                button.innerHTML = '<i data-lucide="lock" style="width:18px;"></i>';
                button.title = '鎖定 SOP 轉換規則';
                editor.focus();
            } else {
                syncRuleContentFromEditor();
                editor.setAttribute('readonly', 'readonly');
                button.innerHTML = '<i data-lucide="pencil" style="width:18px;"></i>';
                button.title = '編輯 SOP 轉換規則';
            }
            lucide.createIcons();
        }

        function buildQualityReport(markdown, flow) {
            const findings = [];
            const suggestions = [];

            if (!/^#\s+SOP:\s+.+/m.test(markdown)) {
                findings.push('缺少 H1 標題，或標題格式不符合規則。預期格式為 `# SOP: <流程名稱>`。');
                suggestions.push('將最上層標題改為 `# SOP: <流程名稱>`。');
            }
            if (!/^##\s+Purpose\b/m.test(markdown)) {
                findings.push('缺少 `## Purpose` 區段。');
                suggestions.push('新增 Purpose 區段，說明 SOP 適用情境與流程完成後應產生的結果。');
            }

            const stepMatches = [...markdown.matchAll(/^###\s+Step\s+(\d+):\s+(.+)$/gm)];
            if (!stepMatches.length) {
                findings.push('找不到編號式流程步驟。');
                suggestions.push('每個流程步驟請使用 `### Step 1: Confirm Fault Event` 這類標題格式。');
            } else {
                const numbers = stepMatches.map(match => Number(match[1]));
                const expected = numbers.map((_, index) => index + 1);
                if (numbers.join(',') !== expected.join(',')) {
                    findings.push(`Step 編號不連續。偵測到 [${numbers.join(', ')}]，預期為 [${expected.join(', ')}]。`);
                    suggestions.push('重新編排 Step 編號，從 1 開始且不中斷。');
                }
            }

            if (!/^##\s+End States\b/m.test(markdown)) {
                findings.push('缺少 `## End States` 區段。');
                suggestions.push('在 `## End States` 下新增終點狀態，格式使用 `### State: state_id`。');
            }

            const sections = markdown.split(/^###\s+/m).slice(1);
            sections.forEach(section => {
                const [titleLine = '', ...bodyLines] = section.split('\n');
                const title = titleLine.trim();
                const body = bodyLines.join('\n');
                if (/^State:/i.test(title)) {
                    if (!body.includes('**Action**')) {
                        findings.push(`終點狀態 \`${title}\` 缺少 \`**Action**\`。`);
                        suggestions.push(`為 \`${title}\` 補上終點動作說明。`);
                    }
                    return;
                }
                if (!body.includes('**Description**')) {
                    findings.push(`步驟 \`${title}\` 缺少 \`**Description**\`。`);
                    suggestions.push(`為 \`${title}\` 補上一句具體的步驟描述。`);
                }
                if (!/\*\*If\s+[^:]+\*\*:/i.test(body)) {
                    findings.push(`步驟 \`${title}\` 沒有定義清楚的分支邏輯。`);
                    suggestions.push(`為 \`${title}\` 加上明確的 \`**If ...**:\` 分支。`);
                }
            });

            const validIds = new Set(flow.states.map(state => state.id));
            const referencedIds = new Set();
            flow.states.forEach(state => {
                if (state.type !== 'end_state' && (!state.next_states || !Object.keys(state.next_states).length)) {
                    findings.push(`狀態 \`${state.id}\` 沒有往外的 transition。`);
                    suggestions.push(`為 \`${state.id}\` 加上分支邏輯，讓流程可以繼續或結束。`);
                }
                Object.values(state.next_states || {}).forEach(target => {
                    referencedIds.add(target);
                    if (!validIds.has(target)) {
                        findings.push(`狀態 \`${state.id}\` 指向不存在的目標 \`${target}\`。`);
                        suggestions.push(`將 \`${target}\` 定義為步驟或終點狀態，或修正分支目標。`);
                    }
                });
            });
            flow.states
                .filter(state => state.type === 'end_state' && !referencedIds.has(state.id))
                .forEach(state => {
                    findings.push(`終點狀態 \`${state.id}\` 沒有任何分支會連到它。`);
                    suggestions.push(`新增一個會轉移到 \`${state.id}\` 的分支，或移除未使用的終點狀態。`);
                });

            // API / MCP integration validation: ensure each tool step gives the agent
            // enough to call the tool AND to interpret the response into a next step.
            const integrationRows = [];
            const mcpServersNeeded = new Set();
            flow.states.forEach(state => {
                if (!state.tool) return;
                const kind = (state.tool_kind || 'api').toUpperCase();
                const outcomes = Object.keys(state.next_states || {});
                const issues = [];
                if (!(state.parameters && state.parameters.length) && state.type !== 'end_state') {
                    issues.push('缺少參數宣告');
                    findings.push(`工具 state \`${state.id}\` (\`${state.tool}\`) 未宣告參數，Agent 不知道呼叫時要送哪些欄位。`);
                    suggestions.push(`為 \`${state.id}\` 的 \`System/Tool\` 補上 backtick 參數，例如 (參數: \`id\`)。`);
                }
                if (state.type !== 'end_state' && outcomes.length < 2) {
                    issues.push('回傳分支不足');
                    findings.push(`工具 state \`${state.id}\` 只有 ${outcomes.length} 個回傳分支，Agent 無法依 API / MCP 回傳判讀不同結果。`);
                    suggestions.push(`為 \`${state.id}\` 至少補上 success / failure 兩種可區分的 \`**If ...**:\` 回傳分支。`);
                }
                if (state.tool_kind === 'mcp') {
                    if (state.mcp_server) mcpServersNeeded.add(state.mcp_server);
                    else {
                        issues.push('MCP server 未指定');
                        findings.push(`MCP 工具 \`${state.tool}\` 未能解析出 server 名稱，執行前無法掛載。`);
                        suggestions.push(`使用 \`mcp__<server>__<tool>\` 命名或加上 \`(MCP: server)\` 標註。`);
                    }
                }
                // Output contract (non-blocking): does the agent know what comes back and what to read?
                if (state.type !== 'end_state' && !(state.returns && state.returns.length)) {
                    suggestions.push(`為 \`${state.id}\` 補上 **Returns** 宣告（工具回傳欄位），讓 Agent 知道可判讀哪些值。`);
                }
                if (state.returns && state.returns.length && state.signal_field && !state.returns.includes(state.signal_field)) {
                    findings.push(`工具 state \`${state.id}\` 的 **Signal** \`${state.signal_field}\` 不在宣告的 **Returns** 欄位中。`);
                    suggestions.push(`將 \`${state.id}\` 的 Signal 改為 Returns 內的欄位，或補進 Returns。`);
                }
                integrationRows.push({ id: state.id, tool: state.tool, kind, server: state.mcp_server || '', params: (state.parameters || []).length, returns: (state.returns || []).length, signal: state.signal_field || '', outcomes: outcomes.length, ok: issues.length === 0, issues });
            });

            const uniqueSuggestions = [...new Set(suggestions)];
            let report = `# SOP 品質報告\n\n`;
            report += `- **狀態**: \`${findings.length ? '需要修訂' : '通過'}\`\n`;
            report += `- **規則來源**: \`sop_rule.md\`\n`;
            report += `- **SOP 名稱**: ${flow.sop_name}\n`;
            report += `- **解析出的狀態數**: ${flow.states.length}\n\n`;
            report += `## 檢查發現\n\n`;
            report += findings.length ? findings.map(item => `- ${item}`).join('\n') : '- 未發現阻擋轉換的品質問題。';
            report += `\n\n## SOP 修改建議\n\n`;
            report += uniqueSuggestions.length ? uniqueSuggestions.map(item => `- ${item}`).join('\n') : '- 轉換前不需要修改。';
            report += `\n\n## API / MCP 整合驗證\n\n`;
            if (integrationRows.length) {
                report += `| State | 整合 | Server | Params | Returns | Signal | 回傳分支 | 驗證 |\n`;
                report += `| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
                integrationRows.forEach(row => {
                    report += `| \`${row.id}\` | ${row.kind} | ${row.server ? '`' + row.server + '`' : '-'} | ${row.params} | ${row.returns} | ${row.signal ? '`' + row.signal + '`' : '-'} | ${row.outcomes} | ${row.ok ? '✅ 通過' : '⚠️ ' + row.issues.join('、')} |\n`;
                });
                report += mcpServersNeeded.size
                    ? `\n執行前需掛載的 MCP server：${[...mcpServersNeeded].map(server => '`' + server + '`').join('、')}。\n`
                    : `\n此 SOP 未使用 MCP 工具（皆為 API 呼叫）。\n`;
                report += `\n每個工具 state 的「回傳判讀規則」由 **Returns**（回傳欄位）、**Signal**（主要判讀欄位）與回傳分支共同構成：API 先驗 HTTP \`status\`、讀 \`body.data\`，MCP 先驗 \`isError\`、讀 \`structuredContent\`，再依 Signal 欄位值比對分支後決定下一步。\n`;
            } else {
                report += `- 此 SOP 沒有工具呼叫，無 API / MCP 整合需驗證。\n`;
            }

            const approvalGates = (flow.states || []).filter(s => s.requires_approval).map(s => s.id);
            report += `\n## 核准閘 (Approval Gates)\n\n`;
            report += approvalGates.length
                ? `- 下列 state 已用 \`**Approval**: required\` 標註為人機協同核准閘，Agent 必須取得核准才能前進：${approvalGates.map(g => '`' + g + '`').join('、')}。\n`
                : `- 此 SOP 未以 \`**Approval**: required\` 明確標註核准閘；executor 仍會依慣例關鍵字（如 hold / escalate / release）於執行期推斷。\n`;

            report += `\n## 規則摘要\n\n`;
            report += `本報告檢查了標題、目的、編號步驟、描述、工具宣告、分支邏輯、終點狀態、transition target、end state 可達性，以及 API / MCP 整合（參數契約、回傳欄位 Returns、判讀欄位 Signal、回傳判讀規則、MCP server 掛載需求）。`;
            return report;
        }

        function syncQualityReport(markdown) {
            generatedFiles['quality-report-md'] = buildQualityReport(markdown, parseGeneratedFlow());
        }

        function rebuildGeneratedFilesFromCurrentMarkdown() {
            const markdown = document.getElementById('markdown-input').value;
            const flow = compileMarkdownToFlow(markdown);
            generatedFiles['flow-json'] = JSON.stringify(flow, null, 2);
            syncSkillMarkdownFromFlow();
            syncQualityReport(markdown);
        }

        // Layered (Sugiyama-style) layout: rank nodes by longest-path depth from the
        // start state, then reduce edge crossings with median/barycenter sweeps so the
        // connecting lines no longer tangle across the whole diagram.
        function computeFlowLayout(flow, dims) {
            const { nodeWidth, nodeHeight, gapX, gapY, marginX, marginY } = dims;
            const ids = flow.states.map(s => s.id);
            const idSet = new Set(ids);
            const start = (flow.start_state && idSet.has(flow.start_state)) ? flow.start_state : ids[0];

            const outEdges = new Map(ids.map(id => [id, []]));
            flow.states.forEach(s => {
                Object.entries(s.next_states || {}).forEach(([condition, target]) => {
                    if (idSet.has(target)) outEdges.get(s.id).push({ target, condition });
                });
            });

            // 1. Detect back edges (cycle edges) via DFS so ranking works on a DAG.
            const visitState = new Map(ids.map(id => [id, 0])); // 0=unseen, 1=on-stack, 2=done
            const backEdges = new Set();
            const finishOrder = [];
            function dfs(u) {
                visitState.set(u, 1);
                outEdges.get(u).forEach(e => {
                    if (visitState.get(e.target) === 0) dfs(e.target);
                    else if (visitState.get(e.target) === 1) backEdges.add(`${u}->${e.target}`);
                });
                visitState.set(u, 2);
                finishOrder.push(u);
            }
            if (start) dfs(start);
            ids.forEach(id => { if (visitState.get(id) === 0) dfs(id); });

            // 2. Longest-path ranking over forward edges (reverse finish order = topo order).
            const topo = [...finishOrder].reverse();
            const rank = new Map(ids.map(id => [id, 0]));
            topo.forEach(u => {
                outEdges.get(u).forEach(e => {
                    if (backEdges.has(`${u}->${e.target}`)) return;
                    if (rank.get(u) + 1 > rank.get(e.target)) rank.set(e.target, rank.get(u) + 1);
                });
            });

            const maxRank = ids.reduce((m, id) => Math.max(m, rank.get(id)), 0);
            const layers = Array.from({ length: maxRank + 1 }, () => []);
            topo.forEach(id => layers[rank.get(id)].push(id));

            // 3. Crossing reduction via median heuristic, sweeping down then up.
            const succ = new Map(ids.map(id => [id, []]));
            const pred = new Map(ids.map(id => [id, []]));
            flow.states.forEach(s => {
                outEdges.get(s.id).forEach(e => {
                    if (backEdges.has(`${s.id}->${e.target}`)) return;
                    succ.get(s.id).push(e.target);
                    pred.get(e.target).push(s.id);
                });
            });
            const pos = new Map();
            const reindex = () => layers.forEach(layer => layer.forEach((id, i) => pos.set(id, i)));
            reindex();
            const median = neighbours => {
                if (!neighbours.length) return -1;
                const sorted = [...neighbours].sort((a, b) => a - b);
                const m = Math.floor(sorted.length / 2);
                return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
            };
            const sortLayer = (layer, keyFn) => layer
                .map((id, i) => ({ id, i, key: keyFn(id) }))
                .map(item => (item.key < 0 ? { ...item, key: pos.get(item.id) } : item))
                .sort((a, b) => (a.key - b.key) || (a.i - b.i))
                .map(item => item.id);
            for (let iter = 0; iter < 8; iter++) {
                if (iter % 2 === 0) {
                    for (let r = 1; r < layers.length; r++) {
                        layers[r] = sortLayer(layers[r], id => median(pred.get(id).map(p => pos.get(p))));
                        reindex();
                    }
                } else {
                    for (let r = layers.length - 2; r >= 0; r--) {
                        layers[r] = sortLayer(layers[r], id => median(succ.get(id).map(s => pos.get(s))));
                        reindex();
                    }
                }
            }

            // 4. Assign coordinates, centering each layer.
            const layerSpan = layer => layer.length * nodeWidth + Math.max(0, layer.length - 1) * gapX;
            const maxSpan = layers.reduce((m, layer) => Math.max(m, layerSpan(layer)), nodeWidth);
            const positions = new Map();
            layers.forEach((layer, r) => {
                const startX = marginX + (maxSpan - layerSpan(layer)) / 2;
                layer.forEach((id, i) => {
                    positions.set(id, {
                        x: startX + i * (nodeWidth + gapX),
                        y: marginY + r * (nodeHeight + gapY),
                        rank: r
                    });
                });
            });

            const width = Math.max(920, maxSpan + marginX * 2);
            const height = Math.max(420, layers.length * nodeHeight + Math.max(0, layers.length - 1) * gapY + marginY * 2);
            return { positions, backEdges, width, height };
        }

        function renderFlowFromGeneratedJson() {
            const flow = parseGeneratedFlow();
            const container = document.getElementById('flow-container');
            if (!container) return;
            container.innerHTML = '';

            const svgNs = 'http://www.w3.org/2000/svg';
            const dims = { nodeWidth: 240, nodeHeight: 84, gapX: 56, gapY: 76, marginX: 44, marginY: 36 };
            const { nodeWidth, nodeHeight } = dims;
            const { positions, backEdges, width, height } = computeFlowLayout(flow, dims);

            const svg = document.createElementNS(svgNs, 'svg');
            svg.setAttribute('class', 'flow-svg');
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);

            const defs = document.createElementNS(svgNs, 'defs');
            defs.innerHTML = `
                <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                    <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(156, 163, 175, 0.85)"></path>
                </marker>
                <marker id="arrowhead-back" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                    <path d="M 0 0 L 10 4 L 0 8 z" fill="rgba(245, 158, 11, 0.85)"></path>
                </marker>
            `;
            svg.appendChild(defs);

            // Pre-count outgoing/incoming forward edges per node to fan-out connection points.
            const outCount = new Map();
            const inCount = new Map();
            flow.states.forEach(state => {
                const from = positions.get(state.id);
                Object.entries(state.next_states || {}).forEach(([, target]) => {
                    const to = positions.get(target);
                    if (!to) return;
                    const isBack = backEdges.has(`${state.id}->${target}`) || to.rank <= from.rank;
                    if (isBack) return;
                    outCount.set(state.id, (outCount.get(state.id) || 0) + 1);
                    inCount.set(target, (inCount.get(target) || 0) + 1);
                });
            });
            const outSeen = new Map();
            const inSeen = new Map();
            const fanOffset = (total, index, gap) => (index - (total - 1) / 2) * gap;

            flow.states.forEach(state => {
                const from = positions.get(state.id);
                Object.entries(state.next_states || {}).forEach(([condition, target], branchIndex) => {
                    const to = positions.get(target);
                    if (!to) return;

                    const isBack = backEdges.has(`${state.id}->${target}`) || to.rank <= from.rank;
                    const path = document.createElementNS(svgNs, 'path');
                    const label = document.createElementNS(svgNs, 'text');
                    const shortLabel = condition.length > 26 ? `${condition.slice(0, 23)}...` : condition;

                    if (!isBack) {
                        const oTotal = outCount.get(state.id) || 1;
                        const oIdx = outSeen.get(state.id) || 0;
                        outSeen.set(state.id, oIdx + 1);
                        const iTotal = inCount.get(target) || 1;
                        const iIdx = inSeen.get(target) || 0;
                        inSeen.set(target, iIdx + 1);

                        const x1 = from.x + nodeWidth / 2 + fanOffset(oTotal, oIdx, Math.min(46, nodeWidth / (oTotal + 1)));
                        const y1 = from.y + nodeHeight;
                        const x2 = to.x + nodeWidth / 2 + fanOffset(iTotal, iIdx, Math.min(46, nodeWidth / (iTotal + 1)));
                        const y2 = to.y;
                        const dy = (y2 - y1) * 0.5;
                        path.setAttribute('class', 'flow-edge');
                        path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`);
                        path.setAttribute('marker-end', 'url(#arrowhead)');

                        label.setAttribute('class', 'flow-edge-label');
                        label.setAttribute('text-anchor', 'middle');
                        label.setAttribute('x', (x1 + x2) / 2);
                        label.setAttribute('y', (y1 + y2) / 2 + (branchIndex % 2 === 0 ? -3 : 11));
                    } else {
                        // Route loop / back edges along the right margin so they bow clear of nodes.
                        const x1 = from.x + nodeWidth;
                        const y1 = from.y + nodeHeight / 2;
                        const x2 = to.x + nodeWidth;
                        const y2 = to.y + nodeHeight / 2;
                        const bulge = Math.max(x1, x2) + 48 + branchIndex * 18;
                        path.setAttribute('class', 'flow-edge back');
                        path.setAttribute('d', `M ${x1} ${y1} C ${bulge} ${y1}, ${bulge} ${y2}, ${x2} ${y2}`);
                        path.setAttribute('marker-end', 'url(#arrowhead-back)');

                        label.setAttribute('class', 'flow-edge-label back');
                        label.setAttribute('text-anchor', 'middle');
                        label.setAttribute('x', bulge + 6);
                        label.setAttribute('y', (y1 + y2) / 2);
                    }

                    label.textContent = shortLabel;
                    svg.appendChild(path);
                    svg.appendChild(label);
                });
            });

            flow.states.forEach(state => {
                const pos = positions.get(state.id);
                const group = document.createElementNS(svgNs, 'g');
                const typeColor = state.type === 'decision' ? 'var(--accent)' : state.type === 'end_state' ? 'var(--green)' : 'var(--secondary)';
                group.setAttribute('class', 'flow-svg-node');
                group.dataset.nodeId = state.id;
                group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

                const truncate = (text, max) => text.length > max ? `${text.slice(0, max - 1)}…` : text;
                const title = truncate(state.id, 24);

                // Clear transport line + returned-field preview to make API/MCP flow legible.
                const contract = buildToolContract(state);
                const spec = getToolSpec(state);
                let transportText;
                let returnsText = '';
                if (state.tool && contract) {
                    if (contract.transport === 'MCP') {
                        const shortTool = state.tool.split('__').pop();
                        transportText = `MCP · ${state.mcp_server || '?'}/${shortTool}`;
                    } else {
                        transportText = `API · ${contract.method} /api/${state.tool}`;
                    }
                    if (spec && spec.outputs && spec.outputs.length) {
                        returnsText = `↩ returns: ${spec.outputs.slice(0, 3).map(out => out[0]).join(', ')}`;
                    }
                } else {
                    transportText = state.type === 'end_state' ? 'terminal state' : 'decision · no tool';
                }

                let kindBadge = '';
                if (state.tool_kind) {
                    const kindLabel = state.tool_kind.toUpperCase();
                    const kindColor = state.tool_kind === 'mcp' ? 'var(--accent)' : 'var(--secondary)';
                    const badgeWidth = kindLabel.length * 7 + 14;
                    const badgeX = nodeWidth - badgeWidth - 12;
                    kindBadge = `
                        <rect x="${badgeX}" y="13" width="${badgeWidth}" height="18" rx="9" fill="rgba(255,255,255,0.04)" stroke="${kindColor}" stroke-width="1"></rect>
                        <text class="flow-node-kind" x="${badgeX + badgeWidth / 2}" y="25.5" text-anchor="middle" fill="${kindColor}">${kindLabel}</text>
                    `;
                }

                group.innerHTML = `
                    <rect width="${nodeWidth}" height="${nodeHeight}" rx="8"></rect>
                    <rect width="4" height="${nodeHeight}" rx="2" fill="${typeColor}" opacity="0.8"></rect>
                    <text class="flow-node-type" x="18" y="24" fill="${typeColor}">${state.type === 'end_state' ? 'END' : state.type.toUpperCase()}</text>
                    ${kindBadge}
                    <text class="flow-node-title" x="18" y="50">${escapeHtml(title)}</text>
                    <text class="flow-node-tool" x="18" y="70">${escapeHtml(truncate(transportText, 34))}</text>
                `;
                group.addEventListener('click', () => inspectNode(state.id, group));
                svg.appendChild(group);
            });

            container.appendChild(svg);
        }

        function inspectNode(nodeId, el) {
            document.querySelectorAll('.flow-svg-node').forEach(node => node.classList.remove('active'));
            el.classList.add('active');

            const flow = parseGeneratedFlow();
            const state = flow.states.find(item => item.id === nodeId);
            const contract = buildToolContract(state);
            const spec = state.tool ? getToolSpec(state) : null;
            const transitions = state.next_states && Object.keys(state.next_states).length
                ? `<ul>${Object.entries(state.next_states).map(([condition, target]) => `<li><code>${escapeHtml(condition)}</code> &rarr; ${escapeHtml(target)}</li>`).join('')}</ul>`
                : 'None (Terminal state)';
            const panel = document.getElementById('inspector-panel');

            panel.innerHTML = `
                <div class="inspector-content">
                    <h4><i data-lucide="info" style="color: var(--primary)"></i> 節點詳情: <code>${escapeHtml(state.id)}</code></h4>
                    <div class="inspector-grid">
                        <div class="inspector-item">
                            <div class="inspector-label">節點類型 (Node Type)</div>
                            <div class="inspector-val" style="color: ${state.type.includes('decision') ? 'var(--accent)' : state.type.includes('end') ? 'var(--green)' : 'var(--secondary)'}">${escapeHtml(state.type.toUpperCase())}</div>
                        </div>
                        <div class="inspector-item">
                            <div class="inspector-label">關聯工具 (System Tool)</div>
                            <div class="inspector-val"><code>${escapeHtml(state.tool || 'None')}</code></div>
                        </div>
                        <div class="inspector-item">
                            <div class="inspector-label">整合方式 (Integration)</div>
                            <div class="inspector-val" style="color: ${state.tool_kind === 'mcp' ? 'var(--accent)' : state.tool_kind === 'api' ? 'var(--secondary)' : 'var(--text-muted)'}">${state.tool_kind ? escapeHtml(state.tool_kind.toUpperCase()) : 'None'}${state.tool_kind === 'mcp' && state.mcp_server ? ` · <code>${escapeHtml(state.mcp_server)}</code>` : ''}</div>
                        </div>
                        <div class="inspector-item" style="grid-column: span 2">
                            <div class="inspector-label">節點敘述</div>
                            <div class="inspector-val">${escapeHtml(state.description)}</div>
                        </div>
                        <div class="inspector-item">
                            <div class="inspector-label">所需參數 (Params)</div>
                            <div class="inspector-val"><code>${escapeHtml((state.parameters || []).join(', ') || 'None')}</code></div>
                        </div>
                        <div class="inspector-item">
                            <div class="inspector-label">下一步跳轉路由</div>
                            <div class="inspector-val">${transitions}</div>
                        </div>
                        <div class="inspector-item">
                            <div class="inspector-label">核准閘 (Approval Gate)</div>
                            <div class="inspector-val" style="color: ${state.requires_approval ? 'var(--amber)' : 'var(--text-muted)'}">${state.requires_approval ? '需要人類核准才能前進' : (state.requires_approval === false ? '明確不需核准' : '未標註（執行期依關鍵字推斷）')}</div>
                        </div>
                        ${spec ? `
                        <div class="inspector-item" style="grid-column: span 2">
                            <div class="inspector-label">工具 I/O Schema · 回傳數值欄位 (Output)</div>
                            <div class="inspector-val" style="font-size:0.86rem;">
                                <div style="color: var(--text-muted); margin-bottom:4px;">${escapeHtml(spec.description || '')}</div>
                                <div style="margin:4px 0;"><span style="color: var(--text-muted);">input:</span> <code>${escapeHtml(spec.inputs.map(io => io[0] + ':' + io[1]).join(', ') || 'None')}</code></div>
                                <div><span style="color: var(--text-muted);">output:</span> <code>${escapeHtml(spec.outputs.map(io => io[0] + ':' + io[1]).join(', '))}</code></div>
                            </div>
                        </div>` : ''}
                        ${contract ? `
                        <div class="inspector-item" style="grid-column: span 2">
                            <div class="inspector-label">回傳判讀 (Response Verification)</div>
                            <div class="inspector-val" style="font-size:0.88rem; color: var(--text-muted);">${contract.verify}</div>
                        </div>` : ''}
                    </div>
                </div>
            `;
            lucide.createIcons();
        }

        function getStateById(stateId) {
            return parseGeneratedFlow().states.find(state => state.id === stateId);
        }

        // --- API / MCP runtime contract, validation & mock execution ---------------

        // Heuristic: does a branch condition describe a failure / negative outcome?
        function isFailureOutcome(condition) {
            return /(fail|reject|error|timeout|times?\s*out|timed\s*out|expire|exceed|invalid|cannot|unable|denied|missing|false|not |no |逾時|失敗|駁回|無法|未|錯誤|拒絕|否|誤報|重複)/i.test(condition);
        }

        function guessHttpMethod(toolName) {
            return /(lookup|get|query|status|read|list|fetch|check|review|verify)/i.test(toolName || '') ? 'GET' : 'POST';
        }

        // Simulated tool catalog. Like the schema an MCP server advertises (description +
        // input/output), each tool behaves like a SQL query that returns wafer/tool values.
        // `rows(ok)` is the fetched dataset and `interpret(ok)` is how the agent reads those
        // values to choose the next state. Tools not listed fall back to a generic spec.
        const toolCatalog = {
            mes_event_lookup: {
                description: '查詢 MES event store，回傳指定機台在時間窗內的 alarm / event 紀錄。',
                inputs: [['tool_id', 'string'], ['event_time', 'timestamp']],
                outputs: [['event_id', 'string'], ['alarm_code', 'string'], ['event_count', 'int'], ['is_duplicate', 'bool'], ['severity', 'enum']],
                rows: ok => ok
                    ? { event_id: 'EVT-83910', alarm_code: 'ALM-204', event_count: 3, is_duplicate: false, severity: 'major' }
                    : { event_id: 'EVT-83911', alarm_code: 'ALM-000', event_count: 1, is_duplicate: true, severity: 'info' },
                interpret: ok => ok
                    ? '`event_count=3`、`is_duplicate=false`、`severity=major` ⇒ 確認為真實故障事件'
                    : '`is_duplicate=true`、`severity=info` ⇒ 判定為重複事件 / 誤報'
            },
            tool_hold_request: {
                description: '對機台送出 engineering hold 請求，回傳套用後的設備狀態。',
                inputs: [['tool_id', 'string'], ['hold_reason', 'string']],
                outputs: [['hold_id', 'string'], ['applied', 'bool'], ['eqp_state', 'enum']],
                rows: ok => ok
                    ? { hold_id: 'HOLD-5521', applied: true, eqp_state: 'DOWN' }
                    : { hold_id: null, applied: false, eqp_state: 'RUN', error: 'PERMISSION_DENIED' },
                interpret: ok => ok
                    ? '`applied=true`、`eqp_state=DOWN` ⇒ hold 套用成功'
                    : '`applied=false`（PERMISSION_DENIED） ⇒ 無法套用 hold，需升級'
            },
            lot_history_query: {
                description: '以 SQL 查詢 lot history，回傳故障時間窗內經過此機台的批次。',
                inputs: [['tool_id', 'string'], ['event_time', 'timestamp'], ['lookback_hours', 'int']],
                outputs: [['exposed_lot_count', 'int'], ['lot_ids', 'string[]'], ['wafer_count', 'int'], ['window', 'string']],
                rows: ok => ok
                    ? { exposed_lot_count: 4, lot_ids: ['LOT2391', 'LOT2392', 'LOT2393', 'LOT2401'], wafer_count: 98, window: '2026-05-28 02:10~04:35' }
                    : { exposed_lot_count: 0, lot_ids: [], wafer_count: 0, window: '2026-05-28 02:10~04:35' },
                interpret: ok => ok
                    ? '`exposed_lot_count=4 > 0` ⇒ 有受影響批次，需審查製程資料'
                    : '`exposed_lot_count=0` ⇒ 無受影響批次，直接執行設備診斷'
            },
            process_data_review: {
                description: '查詢 SPC / metrology 資料庫，回傳製程指標與是否有 excursion。',
                inputs: [['lot_ids', 'string[]'], ['tool_id', 'string'], ['recipe_id', 'string']],
                outputs: [['spc_violations', 'int'], ['min_cpk', 'float'], ['excursion_detected', 'bool'], ['metrology_oos', 'int']],
                rows: ok => ok
                    ? { spc_violations: 5, min_cpk: 0.78, excursion_detected: true, metrology_oos: 12 }
                    : { spc_violations: 0, min_cpk: 1.42, excursion_detected: false, metrology_oos: 0 },
                interpret: ok => ok
                    ? '`excursion_detected=true`、`min_cpk=0.78 < 1.33` ⇒ 偵測到製程異常，開立 MRB'
                    : '`excursion_detected=false`、`min_cpk=1.42` 正常 ⇒ 無製程異常'
            },
            equipment_diagnostics: {
                description: '執行設備診斷並查詢 subsystem log，回傳診斷碼與 root cause 判定。',
                inputs: [['tool_id', 'string'], ['chamber_id', 'string']],
                outputs: [['diag_code', 'string'], ['subsystem', 'string'], ['root_cause_found', 'bool'], ['error_lines', 'int']],
                rows: ok => ok
                    ? { diag_code: 'DG-RF-014', subsystem: 'RF_MATCH', root_cause_found: true, error_lines: 23 }
                    : { diag_code: 'DG-UNK-000', subsystem: 'UNKNOWN', root_cause_found: false, error_lines: 0 },
                interpret: ok => ok
                    ? '`root_cause_found=true`（subsystem=RF_MATCH） ⇒ 找到 root cause'
                    : '`root_cause_found=false` ⇒ 未找到 root cause，需升級'
            },
            corrective_action_create: {
                description: '建立改善措施單並查詢核准狀態。',
                inputs: [['tool_id', 'string'], ['root_cause', 'string'], ['action_owner', 'string']],
                outputs: [['ca_id', 'string'], ['approval_state', 'enum'], ['owner', 'string']],
                rows: ok => ok
                    ? { ca_id: 'CA-7782', approval_state: 'APPROVED', owner: 'eng.lin' }
                    : { ca_id: 'CA-7783', approval_state: 'REJECTED', owner: 'eng.lin' },
                interpret: ok => ok
                    ? '`approval_state=APPROVED` ⇒ 改善措施核准'
                    : '`approval_state=REJECTED` ⇒ 改善措施駁回，需升級'
            },
            tool_recovery_verify: {
                description: '查詢 qualification / golden wafer / monitor lot 結果以判定機台是否可釋放。',
                inputs: [['tool_id', 'string'], ['qualification_plan', 'string']],
                outputs: [['qual_result', 'enum'], ['golden_wafer_pass', 'bool'], ['monitor_cpk', 'float']],
                rows: ok => ok
                    ? { qual_result: 'PASS', golden_wafer_pass: true, monitor_cpk: 1.51 }
                    : { qual_result: 'FAIL', golden_wafer_pass: false, monitor_cpk: 0.92 },
                interpret: ok => ok
                    ? '`qual_result=PASS`、`monitor_cpk=1.51 ≥ 1.33` ⇒ 驗證通過，可釋放機台'
                    : '`qual_result=FAIL`、`monitor_cpk=0.92` ⇒ 驗證失敗，需升級'
            },
            eap_tool_hold: {
                description: '透過 EAP 對機台套用 engineering hold，回傳設備狀態。',
                inputs: [['tool_id', 'string'], ['hold_reason', 'string']],
                outputs: [['hold_id', 'string'], ['applied', 'bool'], ['eqp_state', 'enum']],
                rows: ok => ok
                    ? { hold_id: 'HOLD-5521', applied: true, eqp_state: 'DOWN' }
                    : { hold_id: null, applied: false, eqp_state: 'RUN', error: 'PERMISSION_DENIED' },
                interpret: ok => ok
                    ? '`applied=true`、`eqp_state=DOWN` ⇒ hold 套用成功'
                    : '`applied=false`（PERMISSION_DENIED） ⇒ 無法套用 hold，需升級'
            },
            oncall_ack_status: {
                description: '輪詢 on-call 接手狀態，回傳是否在時限內 ack。',
                inputs: [['ticket_id', 'string'], ['timeout_minutes', 'int']],
                outputs: [['ack_state', 'enum'], ['ack_latency_min', 'int'], ['owner', 'string']],
                rows: ok => ok
                    ? { ack_state: 'ACK', ack_latency_min: 7, owner: 'oncall.wu' }
                    : { ack_state: 'NO_ACK', ack_latency_min: 30, owner: null, escalation: 'TIMEOUT' },
                interpret: ok => ok
                    ? '`ack_state=ACK`、`ack_latency_min=7` 在時限內 ⇒ 負責人接手'
                    : '`ack_state=NO_ACK`、逾時 30 分鐘 ⇒ 接手逾時，需升級'
            },
            mcp__jira__create_issue: {
                description: '[MCP jira] 建立 Jira issue 作為追蹤工單，回傳 issue key 與狀態。',
                inputs: [['project_key', 'string'], ['summary', 'string'], ['severity', 'enum']],
                outputs: [['issue_key', 'string'], ['url', 'string'], ['created', 'bool'], ['status', 'enum']],
                rows: ok => ok
                    ? { issue_key: 'EQP-1487', url: 'https://jira.example/EQP-1487', created: true, status: 'Open' }
                    : { issue_key: null, created: false, status: 'ERROR', error: 'PROJECT_NOT_FOUND' },
                interpret: ok => ok
                    ? '`created=true`、issue_key=EQP-1487 ⇒ 工單建立成功'
                    : '`created=false`（PROJECT_NOT_FOUND） ⇒ 工單建立失敗，需升級'
            },
            mcp__slack__post_message: {
                description: '[MCP slack] 張貼訊息到指定頻道，回傳是否送達。',
                inputs: [['channel', 'string'], ['message', 'string']],
                outputs: [['ts', 'string'], ['delivered', 'bool'], ['channel_id', 'string']],
                rows: ok => ok
                    ? { ts: '1716950000.0021', delivered: true, channel_id: 'C0EQPONCALL' }
                    : { ts: null, delivered: false, channel_id: 'C0EQPONCALL', error: 'CHANNEL_NOT_FOUND' },
                interpret: ok => ok
                    ? '`delivered=true` ⇒ 通報送達'
                    : '`delivered=false`（CHANNEL_NOT_FOUND） ⇒ 通報失敗，需升級'
            }
        };

        function sampleParamValue(name) {
            const samples = {
                tool_id: 'EQP-CVD-07', event_time: '2026-05-28T03:12:00Z', lookback_hours: 24,
                lot_ids: ['LOT2391', 'LOT2392'], recipe_id: 'RCP-OX-220', chamber_id: 'CH-B',
                hold_reason: 'ALARM_ALM-204', root_cause: 'RF_MATCH_DRIFT', action_owner: 'eng.lin',
                qualification_plan: 'QUAL-STD-03', project_key: 'EQP', summary: 'EQP-CVD-07 anomaly ALM-204',
                severity: 'major', channel: '#eqp-oncall', message: 'Anomaly on EQP-CVD-07 (ALM-204)',
                ticket_id: 'EQP-1487', timeout_minutes: 15
            };
            return Object.prototype.hasOwnProperty.call(samples, name) ? samples[name] : `<${name}>`;
        }

        // --- User-editable API / MCP integration configuration ---------------------
        // Lets the user edit which MCP servers/tools and APIs the skill uses, and each
        // tool's I/O fields, so the simulator/inspector show exactly how the skill calls
        // API / MCP and reads the output. Seeded from flow.json on compile.
        let integrationConfig = { mcpServers: [], apiTools: [] };

        function parseIo(str) {
            return String(str || '')
                .split(',')
                .map(part => part.trim())
                .filter(Boolean)
                .map(part => {
                    const [name, ...rest] = part.split(':');
                    return [name.trim(), (rest.join(':').trim() || 'value')];
                })
                .filter(pair => pair[0]);
        }

        function ioToStr(pairs) {
            return (pairs || []).map(([name, type]) => `${name}:${type}`).join(', ');
        }

        function sampleByType(type, ok, name) {
            const t = String(type || '').toLowerCase();
            if (t.includes('bool')) return ok;
            if (t.includes('int') || t.includes('float') || t.includes('number')) return ok ? 1 : 0;
            if (t.includes('enum')) return ok ? 'OK' : 'ERROR';
            if (t.includes('[]') || t.includes('array')) return ok ? [`<${name}>`] : [];
            return ok ? `<${name}>` : '';
        }

        function specFromEntry(entry, kind, server) {
            const inputs = parseIo(entry.inputs);
            const outputs = parseIo(entry.outputs);
            const signal = (entry.signal || '').trim();
            return {
                _user: true,
                kind,
                server,
                description: (kind === 'mcp' ? `[MCP ${server || '?'}] ` : '[REST API] ')
                    + `${entry.name} — 使用者設定的整合。`,
                inputs,
                outputs,
                signal,
                rows: ok => {
                    const row = {};
                    outputs.forEach(([n, t]) => { row[n] = sampleByType(t, ok, n); });
                    if (!outputs.length) row.status = ok ? 'OK' : 'ERROR';
                    return row;
                },
                interpret: ok => {
                    if (signal) {
                        const pair = outputs.find(o => o[0] === signal) || [signal, 'enum'];
                        return `讀取 \`${signal}=${JSON.stringify(sampleByType(pair[1], ok, signal))}\` ⇒ 走${ok ? '成功' : '失敗'}分支`;
                    }
                    return `依回傳值判讀 ⇒ 走${ok ? '成功' : '失敗'}分支`;
                }
            };
        }

        function findIntegrationSpec(toolName) {
            if (!toolName) return null;
            const api = integrationConfig.apiTools.find(t => t.name === toolName);
            if (api) return specFromEntry(api, 'api', null);
            for (const srv of integrationConfig.mcpServers) {
                const tool = (srv.tools || []).find(t => t.name === toolName);
                if (tool) return specFromEntry(tool, 'mcp', srv.server);
            }
            return null;
        }

        function seedIntegrationFromFlow(flow) {
            const servers = {};
            const apis = [];
            flow.states.forEach(state => {
                if (!state.tool) return;
                const cat = toolCatalog[state.tool];
                const inputs = cat ? ioToStr(cat.inputs) : (state.parameters || []).map(p => `${p}:string`).join(', ');
                const outputs = cat ? ioToStr(cat.outputs) : (state.returns || []).map(r => `${r}:value`).join(', ');
                const signal = state.signal_field || '';
                if (state.tool_kind === 'mcp') {
                    const srv = state.mcp_server || 'unknown';
                    servers[srv] = servers[srv] || { server: srv, tools: [] };
                    if (!servers[srv].tools.some(t => t.name === state.tool)) {
                        servers[srv].tools.push({ name: state.tool, inputs, outputs, signal });
                    }
                } else if (!apis.some(a => a.name === state.tool)) {
                    apis.push({ name: state.tool, inputs, outputs, signal });
                }
            });
            integrationConfig = { mcpServers: Object.values(servers), apiTools: apis };
        }

        function getToolSpec(state) {
            if (!state || !state.tool) return null;
            const userSpec = findIntegrationSpec(state.tool);
            if (userSpec) return userSpec;
            if (toolCatalog[state.tool]) return toolCatalog[state.tool];
            // Generic fallback for tools not in the catalog.
            return {
                generic: true,
                description: (state.tool_kind === 'mcp' ? 'MCP server tool' : 'REST API') + ' — 回傳查詢結果供 Agent 判讀。',
                inputs: (state.parameters || []).map(param => [param, 'string']),
                outputs: [['status', 'enum(OK|ERROR)'], ['rows_returned', 'int'], ['signal', 'string']],
                rows: ok => ({ status: ok ? 'OK' : 'ERROR', rows_returned: ok ? Math.max(1, (state.parameters || []).length) : 0 }),
                interpret: ok => ok ? '`status=OK` 且有回傳資料 ⇒ 走成功分支' : '`status=ERROR` / 無資料 ⇒ 走失敗分支'
            };
        }

        // Run the tool as a query for a given branch outcome: returns the fetched dataset
        // and the agent's interpretation of those values.
        function mockQueryResult(state, condition) {
            const spec = getToolSpec(state);
            if (!spec) return null;
            const ok = !isFailureOutcome(condition);
            return {
                ok,
                data: spec.rows ? spec.rows(ok) : {},
                interpretation: spec.interpret ? spec.interpret(ok) : `比對回傳值後符合 \`${condition}\``
            };
        }

        function summarizeData(data) {
            return Object.entries(data || {}).slice(0, 3).map(([key, value]) => {
                const shown = Array.isArray(value) ? `[${value.length}]` : JSON.stringify(value);
                return `${key}=${shown}`;
            }).join(', ');
        }

        // Render developer-authored interpretation text (backtick code spans only).
        function renderInterp(text) {
            return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
        }

        // The "contract" describes how the agent calls the tool and, crucially, how it
        // interprets the returned values to choose the next state.
        function buildToolContract(state) {
            if (!state || !state.tool) return null;
            const kind = state.tool_kind || 'api';
            if (kind === 'mcp') {
                return {
                    transport: 'MCP',
                    server: state.mcp_server || 'unknown',
                    signalField: 'structuredContent',
                    errorField: 'isError',
                    verify: 'Agent 先檢查 MCP 回傳的 <code>isError</code> 旗標（true 視為呼叫失敗），再讀取 <code>structuredContent</code> 中回傳的數值欄位，依其值比對此 state 的分支條件後選擇下一個 state。'
                };
            }
            return {
                transport: 'REST API',
                endpoint: `/api/${state.tool}`,
                method: guessHttpMethod(state.tool),
                signalField: 'body.data',
                errorField: 'status',
                verify: 'Agent 先驗證 HTTP <code>status</code> 是否為 2xx（非 2xx 走失敗分支），再讀取 <code>body.data</code> 取回的 wafer / tool 數值，依其值比對此 state 的分支條件後選擇下一個 state。'
            };
        }

        function buildMockRequest(state) {
            const contract = buildToolContract(state);
            if (!contract) return null;
            const args = {};
            (state.parameters || []).forEach(param => { args[param] = sampleParamValue(param); });
            if (contract.transport === 'MCP') {
                return { transport: 'MCP', server: contract.server, tool: state.tool, arguments: args };
            }
            return { transport: 'REST API', method: contract.method, endpoint: contract.endpoint, query: args };
        }

        function buildMockResponse(state, condition) {
            const contract = buildToolContract(state);
            if (!contract) return null;
            const query = mockQueryResult(state, condition);
            const failed = !query.ok;
            if (contract.transport === 'MCP') {
                return {
                    transport: 'MCP',
                    server: contract.server,
                    isError: failed,
                    structuredContent: query.data,
                    content: [{ type: 'text', text: JSON.stringify(query.data) }]
                };
            }
            return {
                transport: 'REST API',
                status: failed ? 422 : 200,
                body: { row_count: 1, data: query.data }
            };
        }

        function collectMcpServers(flow) {
            const servers = new Map();
            flow.states.forEach(state => {
                if (state.tool && state.tool_kind === 'mcp') {
                    const server = state.mcp_server || 'unknown';
                    if (!servers.has(server)) servers.set(server, new Set());
                    servers.get(server).add(state.tool);
                }
            });
            return servers;
        }

        function collectApiTools(flow) {
            return [...new Set(flow.states.filter(s => s.tool && s.tool_kind !== 'mcp').map(s => s.tool))].sort();
        }

        function syncMcpMounts() {
            // Mount state follows the configured MCP servers (preserve existing toggles).
            const next = {};
            integrationConfig.mcpServers.forEach(srv => {
                next[srv.server] = mcpMounts[srv.server] || false;
            });
            mcpMounts = next;
        }

        function toggleMount(server) {
            mcpMounts[server] = !mcpMounts[server];
            renderMcpPanel();
            renderSkillSimulator();
        }

        // --- Integration editor (the user-facing config UI) ----------------------
        function intgEdit(kind, idx, toolIdx, field, value) {
            if (kind === 'mcp') {
                const srv = integrationConfig.mcpServers[idx];
                if (!srv) return;
                if (toolIdx === null || toolIdx === undefined) srv[field] = value;
                else if (srv.tools[toolIdx]) srv.tools[toolIdx][field] = value;
            } else {
                const api = integrationConfig.apiTools[idx];
                if (api) api[field] = value;
            }
        }

        function addMcpServer() {
            integrationConfig.mcpServers.push({ server: 'new_server', tools: [] });
            renderIntegrationEditor();
        }
        function removeMcpServer(si) {
            integrationConfig.mcpServers.splice(si, 1);
            renderIntegrationEditor();
        }
        function addMcpTool(si) {
            const srv = integrationConfig.mcpServers[si];
            if (!srv) return;
            srv.tools = srv.tools || [];
            srv.tools.push({ name: `mcp__${srv.server}__tool`, inputs: '', outputs: '', signal: '' });
            renderIntegrationEditor();
        }
        function removeMcpTool(si, ti) {
            const srv = integrationConfig.mcpServers[si];
            if (srv && srv.tools) srv.tools.splice(ti, 1);
            renderIntegrationEditor();
        }
        function addApiTool() {
            integrationConfig.apiTools.push({ name: 'new_api_tool', inputs: '', outputs: '', signal: '' });
            renderIntegrationEditor();
        }
        function removeApiTool(ai) {
            integrationConfig.apiTools.splice(ai, 1);
            renderIntegrationEditor();
        }
        function reseedIntegration() {
            seedIntegrationFromFlow(parseGeneratedFlow());
            syncMcpMounts();
            renderIntegrationEditor();
            renderMcpPanel();
            renderSkillSimulator();
        }
        function applyIntegration() {
            syncMcpMounts();
            renderMcpPanel();
            renderSkillSimulator();
        }

        function renderIntegrationEditor() {
            const host = document.getElementById('integration-editor');
            if (!host) return;
            const esc = escapeHtml;
            const headRow = '<div class="intg-tool intg-head-row"><span>tool name</span><span>input (name:type)</span><span>output (name:type)</span><span>signal</span><span></span></div>';
            let html = '<div class="intg-group"><div class="intg-group-title"><i data-lucide="server" style="width:16px;color:var(--accent);"></i> MCP Servers &amp; Tools</div>';
            if (!integrationConfig.mcpServers.length) {
                html += '<div class="intg-hint">尚未設定 MCP server。按上方「新增 MCP server」，或編譯含 MCP 工具的 SOP 自動帶入。</div>';
            }
            integrationConfig.mcpServers.forEach((srv, si) => {
                html += `<div class="intg-server">
                    <div class="intg-server-head">
                        <i data-lucide="server" style="width:15px;color:var(--accent);"></i>
                        <input class="intg-input" style="max-width:240px;" value="${esc(srv.server)}" oninput="intgEdit('mcp',${si},null,'server',this.value)" placeholder="server 名稱 (e.g. jira)">
                        <button class="intg-btn tiny secondary" onclick="addMcpTool(${si})"><i data-lucide="plus" style="width:13px;"></i> 工具</button>
                        <button class="intg-btn tiny danger" onclick="removeMcpServer(${si})"><i data-lucide="trash-2" style="width:13px;"></i></button>
                    </div>
                    ${(srv.tools && srv.tools.length) ? headRow : '<div class="intg-hint">此 server 尚無工具，按「工具」新增。</div>'}`;
                (srv.tools || []).forEach((tool, ti) => {
                    html += `<div class="intg-tool">
                        <input class="intg-input" value="${esc(tool.name)}" oninput="intgEdit('mcp',${si},${ti},'name',this.value)" placeholder="mcp__server__tool">
                        <input class="intg-input" value="${esc(tool.inputs)}" oninput="intgEdit('mcp',${si},${ti},'inputs',this.value)" placeholder="project_key:string, summary:string">
                        <input class="intg-input" value="${esc(tool.outputs)}" oninput="intgEdit('mcp',${si},${ti},'outputs',this.value)" placeholder="issue_key:string, created:bool">
                        <input class="intg-input" value="${esc(tool.signal)}" oninput="intgEdit('mcp',${si},${ti},'signal',this.value)" placeholder="created">
                        <button class="intg-btn tiny danger" onclick="removeMcpTool(${si},${ti})"><i data-lucide="x" style="width:13px;"></i></button>
                    </div>`;
                });
                html += '</div>';
            });
            html += '</div>';

            html += '<div class="intg-group"><div class="intg-group-title"><i data-lucide="globe" style="width:16px;color:var(--secondary);"></i> API Tools</div>';
            if (!integrationConfig.apiTools.length) {
                html += '<div class="intg-hint">尚未設定 API。按上方「新增 API」。</div>';
            } else {
                html += '<div class="intg-api-row intg-head-row"><span>api name</span><span>input (name:type)</span><span>output (name:type)</span><span>signal</span><span></span></div>';
            }
            integrationConfig.apiTools.forEach((api, ai) => {
                html += `<div class="intg-api-row">
                    <input class="intg-input" value="${esc(api.name)}" oninput="intgEdit('api',${ai},null,'name',this.value)" placeholder="mes_event_lookup">
                    <input class="intg-input" value="${esc(api.inputs)}" oninput="intgEdit('api',${ai},null,'inputs',this.value)" placeholder="tool_id:string, event_time:timestamp">
                    <input class="intg-input" value="${esc(api.outputs)}" oninput="intgEdit('api',${ai},null,'outputs',this.value)" placeholder="event_count:int, is_duplicate:bool">
                    <input class="intg-input" value="${esc(api.signal)}" oninput="intgEdit('api',${ai},null,'signal',this.value)" placeholder="is_duplicate">
                    <button class="intg-btn tiny danger" onclick="removeApiTool(${ai})"><i data-lucide="x" style="width:13px;"></i></button>
                </div>`;
            });
            html += '</div>';
            host.innerHTML = html;
            lucide.createIcons();
        }

        // Render an advertised tool schema (description + input/output) — the kind of
        // contract a real MCP server exposes when it is mounted.
        function renderToolSchema(toolName) {
            const spec = getToolSpec({ tool: toolName, parameters: [] }) || {};
            const tags = pairs => (pairs && pairs.length
                ? pairs.map(([name, type]) => `<span class="mcp-tool-tag">${escapeHtml(name)}: ${escapeHtml(type)}</span>`).join('')
                : '<span class="mcp-tool-tag">—</span>');
            return `
                <details class="mcp-tool-detail">
                    <summary><code>${escapeHtml(toolName)}</code></summary>
                    <div class="mcp-tool-desc">${escapeHtml(spec.description || '')}</div>
                    <div class="mcp-io-label">input</div>
                    <div class="mcp-tool-tags">${tags(spec.inputs)}</div>
                    <div class="mcp-io-label">output (回傳數值)</div>
                    <div class="mcp-tool-tags">${tags(spec.outputs)}</div>
                </details>`;
        }

        function renderMcpPanel() {
            const panel = document.getElementById('mcp-mount-panel');
            if (!panel) return;
            const cards = [];

            integrationConfig.mcpServers.forEach(srv => {
                const server = srv.server;
                const tools = (srv.tools || []).map(t => t.name);
                const mounted = !!mcpMounts[server];
                const schemas = tools.map(renderToolSchema).join('');
                cards.push(`
                    <div class="mcp-card ${mounted ? 'mounted' : ''}">
                        <div class="mcp-card-head">
                            <span class="mcp-card-title"><i data-lucide="server" style="width:15px; color: var(--accent);"></i> ${escapeHtml(server)}</span>
                            <span class="mcp-status ${mounted ? 'on' : 'off'}">${mounted ? '已掛載' : '未掛載'}</span>
                        </div>
                        <button class="mount-btn ${mounted ? 'is-mounted' : ''}" onclick="toggleMount('${escapeHtml(server)}')">
                            <i data-lucide="${mounted ? 'check' : 'plug-zap'}" style="width:15px;"></i> ${mounted ? '已連線 (點擊卸載)' : `掛載 ${escapeHtml(server)} MCP server`}
                        </button>
                        <div class="mcp-io-label" style="margin-top:10px;">advertised tools (${tools.length})</div>
                        ${schemas || '<span class="mcp-tool-tag">尚無工具</span>'}
                    </div>
                `);
            });

            if (integrationConfig.apiTools.length) {
                const schemas = integrationConfig.apiTools.map(a => renderToolSchema(a.name)).join('');
                cards.push(`
                    <div class="mcp-card api">
                        <div class="mcp-card-head">
                            <span class="mcp-card-title"><i data-lucide="globe" style="width:15px; color: var(--secondary);"></i> REST API</span>
                            <span class="mcp-status on">直接可用</span>
                        </div>
                        <button class="mount-btn is-mounted" disabled><i data-lucide="check" style="width:15px;"></i> 內部 API 端點，無需掛載</button>
                        <div class="mcp-io-label" style="margin-top:10px;">api endpoints (${integrationConfig.apiTools.length})</div>
                        ${schemas}
                    </div>
                `);
            }

            panel.innerHTML = cards.length
                ? cards.join('')
                : '<p style="color: var(--text-muted);">此 SOP 未使用任何 API 或 MCP 工具，可於上方整合設定新增。</p>';
            lucide.createIcons();
        }

        function resetSimulation() {
            const flow = parseGeneratedFlow();
            simulationState = {
                currentStateId: flow.start_state,
                history: flow.start_state ? [{ stateId: flow.start_state, condition: 'start' }] : [],
                approved: {}
            };
            renderSkillSimulator();
        }

        // Mirror the executor's approval gate: a state marked requires_approval cannot
        // be left until a human approves it here.
        function approveCurrentState() {
            simulationState.approved[simulationState.currentStateId] = true;
            renderSkillSimulator();
        }

        function simulateResponse(condition, targetStateId) {
            const sourceState = getStateById(simulationState.currentStateId);
            const contract = buildToolContract(sourceState);
            // Guard: an MCP tool cannot be called until its server is mounted.
            if (contract && contract.transport === 'MCP' && !mcpMounts[contract.server]) return;
            // Guard: cannot advance past an unapproved approval gate.
            if (sourceState && sourceState.requires_approval && !simulationState.approved[sourceState.id]) return;

            const entry = { stateId: targetStateId, condition };
            if (sourceState && sourceState.tool) {
                const query = mockQueryResult(sourceState, condition);
                entry.via = {
                    fromState: sourceState.id,
                    tool: sourceState.tool,
                    transport: contract.transport,
                    server: contract.server || null,
                    response: buildMockResponse(sourceState, condition),
                    interpretation: query.interpretation
                };
            }
            simulationState.currentStateId = targetStateId;
            simulationState.history.push(entry);
            renderSkillSimulator();
        }

        function undoSimulation() {
            if (simulationState.history.length <= 1) return;
            simulationState.history.pop();
            simulationState.currentStateId = simulationState.history[simulationState.history.length - 1].stateId;
            renderSkillSimulator();
        }

        function renderSkillSimulator() {
            const currentPanel = document.getElementById('simulator-current-state');
            const historyPanel = document.getElementById('simulator-history');
            const backBtn = document.getElementById('sim-back-btn');
            if (!currentPanel || !historyPanel || !backBtn) return;
            const state = getStateById(simulationState.currentStateId);

            if (!state) {
                currentPanel.innerHTML = '<p style="color: var(--text-muted);">尚未產生可模擬的 flow.json。</p>';
                historyPanel.innerHTML = '<h4>執行歷程</h4><p style="color: var(--text-muted);">尚無歷程。</p>';
                backBtn.disabled = true;
                return;
            }

            const choices = Object.entries(state.next_states || {});
            const params = (state.parameters || []).join(', ') || 'None';
            const contract = buildToolContract(state);
            const request = buildMockRequest(state);
            const mcpBlocked = contract && contract.transport === 'MCP' && !mcpMounts[contract.server];
            const approved = !!simulationState.approved[state.id];
            const needsApproval = state.requires_approval && !approved;

            const kindPill = state.tool_kind
                ? `<span class="sim-pill" style="color: ${state.tool_kind === 'mcp' ? 'var(--accent)' : 'var(--secondary)'}; border-color: ${state.tool_kind === 'mcp' ? 'rgba(217,70,239,0.4)' : 'rgba(79,172,254,0.4)'}">${escapeHtml(state.tool_kind.toUpperCase())}${state.tool_kind === 'mcp' && state.mcp_server ? ` · ${escapeHtml(state.mcp_server)}` : ''}</span>`
                : '';

            const spec = getToolSpec(state);
            let requestBlock = '';
            let schemaBlock = '';
            let verifyBlock = '';
            if (contract && request) {
                requestBlock = `
                    <div class="sim-io">
                        <div class="sim-io-head"><i data-lucide="arrow-up-right" style="width:14px;"></i> 工具呼叫 Request · ${escapeHtml(contract.transport)}</div>
                        <pre>${escapeHtml(JSON.stringify(request, null, 2))}</pre>
                    </div>`;
                if (spec) {
                    const outs = spec.outputs.map(([name, type]) => `<span class="mcp-tool-tag">${escapeHtml(name)}: ${escapeHtml(type)}</span>`).join('');
                    schemaBlock = `<div style="margin-top:10px;"><div class="inspector-label" style="margin-bottom:6px;">回傳欄位 Schema (查詢取回的 wafer / tool 數值)</div><div class="mcp-tool-tags">${outs}</div></div>`;
                }
                verifyBlock = `<div class="sim-verify"><strong>回傳判讀機制：</strong> ${contract.verify}</div>`;
            }

            let choiceSection;
            if (!choices.length) {
                choiceSection = '<div class="sim-pill">已抵達終點狀態，流程結束。</div>';
            } else if (needsApproval) {
                choiceSection = `
                    <div class="sim-warning">
                        <div><i data-lucide="shield-alert" style="width:15px; vertical-align:-2px;"></i> 核准閘：此 state 標記為 <code>requires_approval</code>，Agent 必須先取得人類核准才能離開（對應 executor 的 <code>ApprovalRequiredError</code>）。</div>
                        <button class="mount-btn" onclick="approveCurrentState()"><i data-lucide="check-circle" style="width:15px;"></i> 核准並繼續</button>
                    </div>`;
            } else if (mcpBlocked) {
                choiceSection = `
                    <div class="sim-warning">
                        <div><i data-lucide="alert-triangle" style="width:15px; vertical-align:-2px;"></i> MCP server <code>${escapeHtml(contract.server)}</code> 尚未掛載，無法執行此工具呼叫。</div>
                        <button class="mount-btn" onclick="toggleMount('${escapeHtml(contract.server)}')"><i data-lucide="plug-zap" style="width:15px;"></i> 立即掛載 ${escapeHtml(contract.server)}</button>
                    </div>`;
            } else {
                const label = state.tool ? '模擬查詢回傳 (點選一種 wafer / tool 數值情境，Agent 判讀後路由)' : '選擇分支結果';
                choiceSection = `
                    <div class="inspector-label" style="margin-bottom:6px;">${label}</div>
                    <div class="sim-choice-grid">
                        ${choices.map(([condition, target]) => {
                            const query = state.tool ? mockQueryResult(state, condition) : null;
                            const hint = query ? summarizeData(query.data) : '';
                            return `<button class="sim-choice" onclick="simulateResponse('${escapeHtml(condition)}', '${escapeHtml(target)}')"><code>${escapeHtml(condition)}</code> &rarr; ${escapeHtml(target)}${hint ? `<span class="sim-choice-signal">&#8627; 回傳 { ${escapeHtml(hint)} }</span>` : ''}</button>`;
                        }).join('')}
                    </div>`;
            }

            currentPanel.innerHTML = `
                <h3><code>${escapeHtml(state.id)}</code></h3>
                <div class="sim-state-meta">
                    <span class="sim-pill">${escapeHtml(state.type)}</span>
                    <span class="sim-pill">tool: ${escapeHtml(state.tool || 'None')}</span>
                    ${kindPill}
                    <span class="sim-pill">params: ${escapeHtml(params)}</span>
                    ${state.requires_approval ? `<span class="sim-pill" style="color: var(--amber); border-color: rgba(245,158,11,0.4)">核准閘${approved ? ' ✓ 已核准' : ''}</span>` : ''}
                </div>
                <p style="color: var(--text-muted);">${escapeHtml(state.description)}</p>
                ${requestBlock}
                ${schemaBlock}
                ${verifyBlock}
                <div class="sim-choice-grid-wrap">${choiceSection}</div>
            `;

            historyPanel.innerHTML = `
                <h4><i data-lucide="search" style="width:16px; vertical-align:-3px;"></i> 查案歷程 (Investigation Log)</h4>
                <ol>
                    ${simulationState.history.map(item => {
                        let detail = `<span>${escapeHtml(item.condition)}</span>`;
                        if (item.via) {
                            const resp = item.via.response;
                            const sig = resp.transport === 'MCP' ? `isError=${resp.isError}` : `HTTP ${resp.status}`;
                            const data = resp.transport === 'MCP' ? resp.structuredContent : resp.body.data;
                            detail += `
                                <div class="sim-hist-call">
                                    <span class="sim-resp-tag">${escapeHtml(item.via.transport)} · ${escapeHtml(item.via.tool)} · ${escapeHtml(sig)}</span>
                                    <pre class="sim-hist-data">${escapeHtml(JSON.stringify(data))}</pre>
                                    <div class="sim-hist-interp"><strong>判讀：</strong>${renderInterp(item.via.interpretation)}</div>
                                </div>`;
                        }
                        return `<li><code>${escapeHtml(item.stateId)}</code><br>${detail}</li>`;
                    }).join('')}
                </ol>
            `;
            backBtn.disabled = simulationState.history.length <= 1;
            lucide.createIcons();
        }

        function handleMarkdownUpload(event) {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                document.getElementById('markdown-input').value = reader.result;
                renderMarkdownPreview();
                document.getElementById('log-text').textContent = `Loaded ${file.name}. Ready to compile.`;
            };
            reader.readAsText(file, 'utf-8');
        }

        function showTkmsImportPlaceholder() {
            const pageId = prompt('請輸入 tKMS Page ID');
            const suffix = pageId ? `Page ID: ${pageId}` : '未提供 Page ID';
            document.getElementById('log-text').textContent = `從 tKMS 匯入功能開發中。${suffix}`;
            alert('從 tKMS 匯入功能開發中');
        }

        function crc32(text) {
            const bytes = new TextEncoder().encode(text);
            let crc = 0xffffffff;
            for (const byte of bytes) {
                crc ^= byte;
                for (let i = 0; i < 8; i++) {
                    crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
                }
            }
            return (crc ^ 0xffffffff) >>> 0;
        }

        function uint16(value) {
            return [value & 0xff, (value >>> 8) & 0xff];
        }

        function uint32(value) {
            return [
                value & 0xff,
                (value >>> 8) & 0xff,
                (value >>> 16) & 0xff,
                (value >>> 24) & 0xff
            ];
        }

        function createZipBlob(files) {
            const encoder = new TextEncoder();
            const localParts = [];
            const centralParts = [];
            let offset = 0;

            files.forEach(file => {
                const nameBytes = encoder.encode(file.name);
                const dataBytes = encoder.encode(file.content);
                const checksum = crc32(file.content);
                const localHeader = new Uint8Array([
                    ...uint32(0x04034b50),
                    ...uint16(20),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint32(checksum),
                    ...uint32(dataBytes.length),
                    ...uint32(dataBytes.length),
                    ...uint16(nameBytes.length),
                    ...uint16(0)
                ]);

                localParts.push(localHeader, nameBytes, dataBytes);

                const centralHeader = new Uint8Array([
                    ...uint32(0x02014b50),
                    ...uint16(20),
                    ...uint16(20),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint32(checksum),
                    ...uint32(dataBytes.length),
                    ...uint32(dataBytes.length),
                    ...uint16(nameBytes.length),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint16(0),
                    ...uint32(0),
                    ...uint32(offset)
                ]);

                centralParts.push(centralHeader, nameBytes);
                offset += localHeader.length + nameBytes.length + dataBytes.length;
            });

            const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
            const endRecord = new Uint8Array([
                ...uint32(0x06054b50),
                ...uint16(0),
                ...uint16(0),
                ...uint16(files.length),
                ...uint16(files.length),
                ...uint32(centralSize),
                ...uint32(offset),
                ...uint16(0)
            ]);

            return new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
        }

        async function downloadSkillBundle() {
            syncSkillMarkdownFromFlow();
            syncRuleContentFromEditor();
            syncQualityReport(document.getElementById('markdown-input').value);
            const folder = 'tool_fault_investigation/';
            const blob = createZipBlob([
                { name: `${folder}SKILL.md`, content: generatedFiles['skill-md'] },
                { name: `${folder}flow.json`, content: generatedFiles['flow-json'] },
                { name: `${folder}sop_rule.md`, content: generatedFiles['sop-rule-md'] },
                { name: `${folder}sop_quality_report.md`, content: generatedFiles['quality-report-md'] }
            ]);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'tool_fault_investigation_skill.zip';
            link.click();
            URL.revokeObjectURL(url);
        }

        // ---- cross-page state handoff (Converter -> Simulator) ----
        const STORAGE_KEY = 'sop_to_skill_state';
        function persistState() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    files: {
                        'flow-json': generatedFiles['flow-json'] || '',
                        'skill-md': generatedFiles['skill-md'] || '',
                        'sop-rule-md': generatedFiles['sop-rule-md'] || '',
                        'quality-report-md': generatedFiles['quality-report-md'] || ''
                    },
                    integrationConfig: integrationConfig,
                    mcpMounts: mcpMounts
                }));
            } catch (e) { /* localStorage unavailable */ }
        }
        function loadState() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
            catch (e) { return null; }
        }
        function goToSimulator() {
            rebuildGeneratedFilesFromCurrentMarkdown();
            seedIntegrationFromFlow(parseGeneratedFlow());
            persistState();
            window.location.href = 'simulator.html';
        }
        function loadFlowFromText(text) {
            const flow = JSON.parse(text); // throws on invalid JSON
            generatedFiles['flow-json'] = JSON.stringify(flow, null, 2);
            // A pasted flow.json carries no source SOP, so SKILL.md is regenerated from
            // the graph and the quality report (which needs the markdown) is cleared.
            generatedFiles['skill-md'] = buildSkillMarkdown(flow);
            generatedFiles['quality-report-md'] = '';
            seedIntegrationFromFlow(flow);
            syncMcpMounts();
            renderIntegrationEditor();
            renderMcpPanel();
            renderFlowFromGeneratedJson();
            renderCompiledArtifacts();
            resetSimulation();
            persistState();
            return flow;
        }
        // Show the (context-only) compiled artifacts on the Simulator page; the simulator
        // itself only executes flow.json.
        function renderCompiledArtifacts() {
            const skillEl = document.getElementById('sim-skill-md');
            const qrEl = document.getElementById('sim-quality-report');
            if (!skillEl || !qrEl) return;
            const flow = parseGeneratedFlow();
            let skill = generatedFiles['skill-md'];
            if (!skill && flow.states && flow.states.length) skill = buildSkillMarkdown(flow);
            skillEl.textContent = skill || '（尚無 SKILL.md，請先從 Converter 編譯或貼上 flow.json）';
            qrEl.textContent = generatedFiles['quality-report-md']
                || '（貼上 flow.json 模式下沒有品質報告；請從 Converter 編譯以取得完整報告）';
        }
        function loadPastedFlow() {
            const box = document.getElementById('flow-paste');
            const status = document.getElementById('load-status');
            if (!box) return;
            try {
                const flow = loadFlowFromText(box.value.trim());
                if (status) status.textContent = '已載入 flow.json：' + (flow.sop_name || '(未命名)') + '，共 ' + flow.states.length + ' 個 state。';
            } catch (e) {
                if (status) status.textContent = '無法解析 flow.json：' + e.message;
            }
        }
        // Three-step journey on the Converter: ① 編譯 / ② 看懂. Step ③ (證明) lives on the
        // Simulator page. The flow SVG self-sizes from the graph, so rendering it inside a
        // hidden panel is fine — no re-render needed on switch.
        function showStep(n) {
            document.querySelectorAll('.step-panel').forEach(panel => {
                panel.style.display = String(panel.dataset.step) === String(n) ? '' : 'none';
            });
            document.querySelectorAll('.stepper .step[data-goto]').forEach(step => {
                step.classList.toggle('active', String(step.dataset.goto) === String(n));
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        function initConverter() {
            rebuildGeneratedFilesFromCurrentMarkdown();
            renderRuleAndReportBlocks();
            renderMarkdownPreview();
            renderFlowFromGeneratedJson();
            persistState();
            showStep(window.location.hash === '#review' ? 2 : 1);
        }
        function initSimulator() {
            const saved = loadState();
            const status = document.getElementById('load-status');
            if (saved && saved.files && saved.files['flow-json']) {
                Object.assign(generatedFiles, saved.files);
                integrationConfig = (saved.integrationConfig && saved.integrationConfig.mcpServers)
                    ? saved.integrationConfig : { mcpServers: [], apiTools: [] };
                mcpMounts = saved.mcpMounts || {};
                if (!integrationConfig.mcpServers.length && !integrationConfig.apiTools.length) {
                    seedIntegrationFromFlow(parseGeneratedFlow());
                }
                syncMcpMounts();
                const flow = parseGeneratedFlow();
                if (status) status.textContent = '已載入來自 Converter 的編譯結果：' + (flow.sop_name || '(未命名)') + '，共 ' + flow.states.length + ' 個 state。可直接於下方模擬，或貼上其他 flow.json 覆蓋。';
            } else {
                integrationConfig = { mcpServers: [], apiTools: [] };
                if (status) status.textContent = '尚無來自 Converter 的編譯結果。請先到 Converter 編譯並「前往模擬器」，或在下方貼上 flow.json。';
            }
            renderIntegrationEditor();
            renderMcpPanel();
            renderFlowFromGeneratedJson();
            renderCompiledArtifacts();
            resetSimulation();
        }
        // ==== flowdiff (JS port — keep in parity with flowdiff.py) ====
        // Structured graph-level diff between two compiled flows, for the governance page.
        const FLOWDIFF_SCALAR_FIELDS = ['type', 'description', 'tool', 'tool_kind', 'mcp_server', 'signal_field', 'requires_approval'];
        const FLOWDIFF_LIST_FIELDS = ['parameters', 'returns'];

        function _flowScalar(v) { return v === undefined ? null : v; }

        function _diffState(oldState, newState) {
            const fields = {};
            FLOWDIFF_SCALAR_FIELDS.forEach(name => {
                const ov = _flowScalar(oldState[name]);
                const nv = _flowScalar(newState[name]);
                if (ov !== nv) fields[name] = { old: ov, new: nv };
            });
            FLOWDIFF_LIST_FIELDS.forEach(name => {
                const ov = oldState[name] || [];
                const nv = newState[name] || [];
                if (JSON.stringify(ov) !== JSON.stringify(nv)) fields[name] = { old: ov, new: nv };
            });
            const oldT = oldState.next_states || {};
            const newT = newState.next_states || {};
            const added = {};
            const removed = {};
            const retargeted = {};
            Object.keys(newT).forEach(k => { if (!(k in oldT)) added[k] = newT[k]; });
            Object.keys(oldT).forEach(k => { if (!(k in newT)) removed[k] = oldT[k]; });
            Object.keys(oldT).forEach(k => { if (k in newT && oldT[k] !== newT[k]) retargeted[k] = { old: oldT[k], new: newT[k] }; });

            const record = {};
            if (Object.keys(fields).length) record.fields = fields;
            if (Object.keys(added).length) record.transitions_added = added;
            if (Object.keys(removed).length) record.transitions_removed = removed;
            if (Object.keys(retargeted).length) record.transitions_retargeted = retargeted;
            return record;
        }

        function diffFlows(oldFlow, newFlow) {
            const oldStates = oldFlow.states || [];
            const newStates = newFlow.states || [];
            const oldById = {};
            const newById = {};
            oldStates.forEach(s => { oldById[s.id] = s; });
            newStates.forEach(s => { newById[s.id] = s; });

            const diff = {
                sop_name: oldFlow.sop_name !== newFlow.sop_name ? { old: oldFlow.sop_name, new: newFlow.sop_name } : null,
                start_state: oldFlow.start_state !== newFlow.start_state ? { old: oldFlow.start_state, new: newFlow.start_state } : null,
                states_added: newStates.filter(s => !(s.id in oldById)).map(s => s.id),
                states_removed: oldStates.filter(s => !(s.id in newById)).map(s => s.id),
                states_changed: {}
            };
            newStates.filter(s => s.id in oldById).forEach(s => {
                const record = _diffState(oldById[s.id], newById[s.id]);
                if (Object.keys(record).length) diff.states_changed[s.id] = record;
            });
            return diff;
        }

        function hasFlowChanges(diff) {
            return !!(diff.sop_name || diff.start_state
                || diff.states_added.length || diff.states_removed.length
                || Object.keys(diff.states_changed).length);
        }

        function _fmtDiff(value) {
            if (value === null || value === undefined) return '`null`';
            if (typeof value === 'boolean') return '`' + value + '`';
            if (Array.isArray(value)) return value.length ? '`' + value.join(', ') + '`' : '`(空)`';
            return '`' + value + '`';
        }

        function renderFlowDiffMarkdown(diff, oldName, newName) {
            let out = '# 狀態機 Diff (Flow Diff)\n\n';
            out += '- **舊版**: `' + (oldName || 'old') + '`\n';
            out += '- **新版**: `' + (newName || 'new') + '`\n\n';
            if (!hasFlowChanges(diff)) return out + '兩版狀態機完全相同，無圖層級變更。\n';

            if (diff.sop_name) out += '## SOP 名稱\n\n- ' + _fmtDiff(diff.sop_name.old) + ' → ' + _fmtDiff(diff.sop_name.new) + '\n\n';
            if (diff.start_state) out += '## 起始 state\n\n- ' + _fmtDiff(diff.start_state.old) + ' → ' + _fmtDiff(diff.start_state.new) + '\n\n';
            if (diff.states_added.length) out += '## 新增 state\n\n' + diff.states_added.map(s => '- `' + s + '`').join('\n') + '\n\n';
            if (diff.states_removed.length) out += '## 移除 state\n\n' + diff.states_removed.map(s => '- `' + s + '`').join('\n') + '\n\n';
            if (Object.keys(diff.states_changed).length) {
                out += '## 變更 state\n\n';
                Object.entries(diff.states_changed).forEach(([sid, record]) => {
                    out += '### `' + sid + '`\n\n';
                    Object.entries(record.fields || {}).forEach(([f, c]) => { out += '- **' + f + '**: ' + _fmtDiff(c.old) + ' → ' + _fmtDiff(c.new) + '\n'; });
                    Object.entries(record.transitions_added || {}).forEach(([o, t]) => { out += '- ➕ 分支 `' + o + '` → `' + t + '`\n'; });
                    Object.entries(record.transitions_removed || {}).forEach(([o, t]) => { out += '- ➖ 分支 `' + o + '`（原指向 `' + t + '`）\n'; });
                    Object.entries(record.transitions_retargeted || {}).forEach(([o, c]) => { out += '- 🔀 分支 `' + o + '`：`' + c.old + '` → `' + c.new + '`\n'; });
                    out += '\n';
                });
            }
            return out;
        }
        // ==== end flowdiff ====

        // Evolve (closing-the-loop, web surface): translate a graph-level diff into a
        // reviewable list of SOP-markdown edits. The full auto-proposal loop (gap
        // detection → bounded edits → held-out gate) runs in evolve.py / optimizer.py
        // (needs rollouts); here we render the "edits back to the human-owned SOP" half.
        function renderEvolveSuggestions(diff) {
            if (!hasFlowChanges(diff)) return '兩版相同，SOP 不需修訂。\n';
            const lines = ['# 演化建議：把差異寫回 SOP\n'];
            lines.push('SOP 是單一事實來源。以下把上方圖層級差異，反映回人類可讀 SOP 的修訂建議；審核後更新 .md 並重新編譯即生效。\n');
            diff.states_added.forEach(id => lines.push('- ➕ 新增步驟 `' + id + '`：在 SOP 增加對應的 `### Step` / `### State` 段落。'));
            diff.states_removed.forEach(id => lines.push('- ➖ 移除步驟 `' + id + '`：刪除其段落，並改接其上游分支。'));
            Object.entries(diff.states_changed).forEach(([id, rec]) => {
                const f = rec.fields || {};
                if (f.signal_field) lines.push('- 🔧 `' + id + '`：把 **Signal** 改為 `' + f.signal_field.new + '`。');
                if (f.returns) lines.push('- 🔧 `' + id + '`：更新 **Returns** 為 ' + ((f.returns.new || []).map(x => '`' + x + '`').join(', ') || '（無）') + '。');
                if (f.parameters) lines.push('- 🔧 `' + id + '`：更新工具參數為 ' + ((f.parameters.new || []).map(x => '`' + x + '`').join(', ') || '（無）') + '。');
                if (f.requires_approval) {
                    lines.push(f.requires_approval.new === true
                        ? '- 🔒 `' + id + '`：加上核准閘（在該步驟加一行 `**Approval**: required`）。'
                        : '- 🔓 `' + id + '`：移除核准閘（`**Approval**: no`）。');
                }
                Object.entries(rec.transitions_added || {}).forEach(([o, t]) => lines.push('- ➕ `' + id + '` 新增分支：outcome 「' + o + '」→ `' + t + '`（在該步驟 Branching 下加一條 If 規則）。'));
                Object.entries(rec.transitions_retargeted || {}).forEach(([o, c]) => lines.push('- 🔀 `' + id + '` 分支「' + o + '」：改指向 `' + c.new + '`（原 `' + c.old + '`）。'));
                Object.entries(rec.transitions_removed || {}).forEach(([o, t]) => lines.push('- ➖ `' + id + '` 移除分支「' + o + '」（原指向 `' + t + '`）。'));
            });
            return lines.join('\n') + '\n';
        }

        function loadCurrentFlowIntoDiff() {
            const box = document.getElementById('diff-old');
            const saved = loadState();
            if (box && saved && saved.files && saved.files['flow-json']) {
                box.value = saved.files['flow-json'];
            }
            return !!(saved && saved.files && saved.files['flow-json']);
        }

        function runFlowDiff() {
            const oldBox = document.getElementById('diff-old');
            const newBox = document.getElementById('diff-new');
            const out = document.getElementById('diff-output');
            const status = document.getElementById('diff-status');
            if (!oldBox || !newBox || !out) return;
            try {
                const oldFlow = JSON.parse(oldBox.value.trim());
                const newFlow = JSON.parse(newBox.value.trim());
                const diff = diffFlows(oldFlow, newFlow);
                out.textContent = renderFlowDiffMarkdown(diff, oldFlow.sop_name || '舊版', newFlow.sop_name || '新版');
                // Overlay the diff on the NEW flow's graph: added = green, changed = amber.
                generatedFiles['flow-json'] = JSON.stringify(newFlow, null, 2);
                renderFlowFromGeneratedJson();
                decorateFlowDiff(diff);
                const evolveOut = document.getElementById('evolve-output');
                if (evolveOut) evolveOut.textContent = renderEvolveSuggestions(diff);
                if (status) {
                    status.textContent = hasFlowChanges(diff)
                        ? '兩版狀態機有差異（下方為差異報告與新版流程圖，綠＝新增、琥珀＝變更）。'
                        : '兩版狀態機完全相同。';
                }
            } catch (e) {
                if (status) status.textContent = '無法解析 flow.json：' + e.message;
            }
        }

        // Tint the new flow's nodes by diff status (removed states only appear in the report).
        function decorateFlowDiff(diff) {
            const container = document.getElementById('flow-container');
            if (!container) return;
            const mark = (id, cls) => {
                const g = container.querySelector('.flow-svg-node[data-node-id="' + id + '"]');
                if (g) g.classList.add(cls);
            };
            diff.states_added.forEach(id => mark(id, 'diff-added'));
            Object.keys(diff.states_changed).forEach(id => mark(id, 'diff-changed'));
        }

        function initGovernance() {
            // Hand-off from the optimizer page: prefill both versions and diff immediately.
            let handoff = null;
            try { handoff = JSON.parse(localStorage.getItem(STORAGE_KEY + ':gov_handoff') || 'null'); } catch (e) { handoff = null; }
            if (handoff && handoff.old && handoff.new) {
                localStorage.removeItem(STORAGE_KEY + ':gov_handoff');
                const oldBox = document.getElementById('diff-old');
                const newBox = document.getElementById('diff-new');
                if (oldBox && newBox) {
                    oldBox.value = JSON.stringify(handoff.old, null, 2);
                    newBox.value = JSON.stringify(handoff.new, null, 2);
                    runFlowDiff();
                    const status = document.getElementById('diff-status');
                    if (status) status.textContent = '已載入優化前 / 優化後兩版（來自優化頁），差異如下。';
                    return;
                }
            }
            const had = loadCurrentFlowIntoDiff();
            const status = document.getElementById('diff-status');
            if (status) {
                status.textContent = had
                    ? '已把目前編譯結果帶入「舊版」。貼上另一版 flow.json 到「新版」後按「比較」。'
                    : '貼上兩版 flow.json 後按「比較」。（從 Converter 編譯後，這裡會自動帶入舊版）';
            }
        }

        // ==== optimizer (JS port — keep in parity with optimizer.py) ====
        // Structured self-evolution (M2.5): bounded graph edits, accepted only on a strict
        // held-out validation improvement. Deterministic — no LLM, no network — so the full
        // loop runs in the browser. Mirrors optimizer.py exactly; guarded by
        // tests/test_optimizer_parity.py.
        function editKey(edit) {
            return [edit.kind, edit.state_id, edit.outcome || '', edit.target || '', edit.field_value || ''].join('\u0001');
        }

        function describeEdit(edit) {
            if (edit.kind === 'add_transition') {
                return "add_transition(" + edit.state_id + ": '" + edit.outcome + "' -> " + edit.target + ")";
            }
            if (edit.kind === 'set_signal_field') {
                return 'set_signal_field(' + edit.state_id + ' = ' + edit.field_value + ')';
            }
            return edit.kind + '(' + edit.state_id + ')';
        }

        function applyEditToFlow(edit, flow) {
            const data = JSON.parse(JSON.stringify(flow));
            data.states.forEach(st => {
                if (st.id !== edit.state_id) return;
                if (edit.kind === 'add_transition') {
                    const ns = st.next_states || {};
                    ns[edit.outcome] = edit.target;
                    st.next_states = ns;
                } else if (edit.kind === 'set_signal_field') {
                    st.signal_field = edit.field_value;
                }
            });
            return data;
        }

        function _flowValid(flow) {
            const ids = new Set((flow.states || []).map(s => s.id));
            if (!ids.has(flow.start_state)) return false;
            return (flow.states || []).every(s =>
                Object.values(s.next_states || {}).every(t => ids.has(t)));
        }

        function _isTerminalState(state) {
            return state.type === 'end_state' || !Object.keys(state.next_states || {}).length;
        }

        function oracleRun(flow, scenario) {
            // The oracle always picks the scenario's correct outcome; a missing outcome
            // (adherence gap) fails the run — same contract as optimizer._oracle_run.
            if (!_flowValid(flow)) return false;
            const byId = {};
            flow.states.forEach(s => { byId[s.id] = s; });
            let cur = flow.start_state;
            let guard = 0;
            while (!_isTerminalState(byId[cur]) && guard < flow.states.length + 3) {
                guard += 1;
                const correct = scenario.situation[cur];
                if (correct === undefined) break;
                if (!((byId[cur].next_states || {})[correct])) return false;
                cur = byId[cur].next_states[correct];
            }
            return cur === scenario.expected_end_state && _isTerminalState(byId[cur]);
        }

        function scoreFlowJs(flow, scenarios) {
            const s = { n: scenarios.length, correct_end: 0, blocked: 0 };
            scenarios.forEach(sc => { if (oracleRun(flow, sc)) s.correct_end += 1; else s.blocked += 1; });
            s.scalar = s.correct_end - 0.001 * s.blocked;
            return s;
        }

        function detectGapsJs(flow, scenarios) {
            const byId = {};
            flow.states.forEach(s => { byId[s.id] = s; });
            const gaps = [];
            const seen = new Set();
            scenarios.forEach(sc => {
                if (!_flowValid(flow)) return;
                let cur = flow.start_state;
                let guard = 0;
                while (!_isTerminalState(byId[cur]) && guard < flow.states.length + 3) {
                    guard += 1;
                    const correct = sc.situation[cur];
                    if (correct === undefined) break;
                    if (!((byId[cur].next_states || {})[correct])) {
                        const k = cur + '\u0001' + correct;
                        if (!seen.has(k)) { seen.add(k); gaps.push([cur, correct]); }
                        break;
                    }
                    cur = byId[cur].next_states[correct];
                }
            });
            return gaps;
        }

        function candidateEditsJs(flow, gaps, rejected) {
            const stateIds = flow.states.map(s => s.id);
            const out = [];
            gaps.forEach(([stateId, outcome]) => {
                stateIds.forEach(target => {
                    if (target === stateId) return;
                    const edit = { kind: 'add_transition', state_id: stateId, outcome, target };
                    if (!rejected.has(editKey(edit))) out.push(edit);
                });
            });
            return out;
        }

        function optimizeFlowJs(flow, validation, editBudget, maxRounds) {
            editBudget = editBudget === undefined ? 5 : editBudget;
            maxRounds = maxRounds === undefined ? 10 : maxRounds;
            let current = flow;
            const rejected = new Set();
            const result = {
                flow: current, accepted: [], rejected_count: 0, rounds: 0,
                start_score: scoreFlowJs(flow, validation).scalar, final_score: 0,
                trace: []   // per-round transparency for the UI; never affects behaviour
            };
            let editsMade = 0;
            while (editsMade < editBudget && result.rounds < maxRounds) {
                result.rounds += 1;
                const base = scoreFlowJs(current, validation);
                const gaps = detectGapsJs(current, validation);
                if (!gaps.length) break;
                const candidates = candidateEditsJs(current, gaps, rejected);
                if (!candidates.length) break;

                let bestEdit = null;
                let bestScore = base.scalar;
                const scored = [];
                candidates.forEach(edit => {
                    const candScore = scoreFlowJs(applyEditToFlow(edit, current), validation).scalar;
                    scored.push([candScore, edit]);
                    if (candScore > bestScore) { bestScore = candScore; bestEdit = edit; }
                });
                result.trace.push({
                    round: result.rounds,
                    base: base.scalar,
                    gaps: gaps.map(g => g[0] + ' → 「' + g[1] + '」'),
                    n_candidates: candidates.length,
                    top: scored.slice().sort((a, b) => b[0] - a[0]).slice(0, 3)
                        .map(([s, e]) => ({ score: s, edit: describeEdit(e) })),
                    accepted: bestEdit ? describeEdit(bestEdit) : null
                });

                if (bestEdit === null) {
                    candidates.forEach(edit => rejected.add(editKey(edit)));
                    result.rejected_count += candidates.length;
                    break;
                }
                candidates.forEach(edit => { if (editKey(edit) !== editKey(bestEdit)) rejected.add(editKey(edit)); });
                result.rejected_count += candidates.length - 1;
                current = applyEditToFlow(bestEdit, current);
                result.accepted.push({ edit: bestEdit, before: base.scalar, after: bestScore });
                editsMade += 1;
            }
            result.flow = current;
            result.final_score = scoreFlowJs(current, validation).scalar;
            return result;
        }
        // ==== end optimizer ====

        // Seed a validation set from the flow itself: one scenario per reachable end
        // state (BFS shortest path), so optimization works for any compiled SOP without
        // hand-written scenarios. The user can edit/extend the JSON before running.
        function seedScenariosFromFlow(flow) {
            const byId = {};
            flow.states.forEach(s => { byId[s.id] = s; });
            const parent = {};   // state id -> [prevId, outcome]
            const queue = [flow.start_state];
            const visited = new Set([flow.start_state]);
            while (queue.length) {
                const cur = queue.shift();
                Object.entries(byId[cur].next_states || {}).forEach(([outcome, target]) => {
                    if (visited.has(target)) return;
                    visited.add(target);
                    parent[target] = [cur, outcome];
                    queue.push(target);
                });
            }
            const scenarios = [];
            flow.states.forEach(state => {
                if (!_isTerminalState(state) || !visited.has(state.id)) return;
                const situation = {};
                let cur = state.id;
                while (parent[cur]) {
                    const [prev, outcome] = parent[cur];
                    situation[prev] = outcome;
                    cur = prev;
                }
                if (state.id !== flow.start_state) {
                    scenarios.push({
                        name: 'path to ' + state.id,
                        expected_end_state: state.id,
                        situation
                    });
                }
            });
            return scenarios;
        }

        // Per-scenario verdicts for the preview/result tables (pure; uses oracleRun).
        function scenarioResults(flow, scenarios) {
            return scenarios.map(sc => ({
                name: sc.name || ('path to ' + sc.expected_end_state),
                end: sc.expected_end_state,
                ok: oracleRun(flow, sc)
            }));
        }

        // --- optimize page (step ④) -------------------------------------------------
        let optBaselineFlow = null;   // the flow before optimization (after any demo drop)
        let optResultFlow = null;     // the optimized flow

        function optParseScenarios() {
            try {
                const scenarios = JSON.parse(document.getElementById('opt-scenarios').value);
                return (Array.isArray(scenarios) && scenarios.length) ? scenarios : null;
            } catch (e) { return null; }
        }

        // Render the per-scenario pass/fail table. With `after` (post-optimization
        // verdicts) it becomes a before → after comparison.
        function optRenderScenarioTable(before, after) {
            const box = document.getElementById('opt-scenario-table');
            if (!box) return;
            const mark = ok => ok
                ? '<span class="opt-ok">✓ 通過</span>'
                : '<span class="opt-fail">✗ 失敗</span>';
            let html = '<table class="opt-table"><thead><tr><th>驗證情境</th><th>預期終點</th>'
                + (after ? '<th>優化前</th><th>優化後</th>' : '<th>目前</th>') + '</tr></thead><tbody>';
            before.forEach((r, i) => {
                html += '<tr><td>' + escapeHtml(r.name) + '</td><td><code>' + escapeHtml(r.end) + '</code></td>'
                    + '<td>' + mark(r.ok) + '</td>'
                    + (after ? '<td>' + mark(after[i].ok) + '</td>' : '') + '</tr>';
            });
            html += '</tbody></table>';
            const passed = before.filter(r => r.ok).length;
            const summary = after
                ? '通過 ' + passed + '/' + before.length + ' → ' + after.filter(r => r.ok).length + '/' + after.length
                : '通過 ' + passed + '/' + before.length;
            box.innerHTML = '<div class="opt-table-summary">' + summary + '</div>' + html;
        }

        // Hero stat tiles: pass-rate before → after. Values wear the text token;
        // only the status sub-line / border carries green (improved) or amber (gaps).
        function optRenderHero(before, after, editsCount) {
            const box = document.getElementById('opt-hero');
            if (!box) return;
            if (!before) { box.innerHTML = ''; return; }
            const passed = r => r.filter(x => x.ok).length;
            const frac = r => passed(r) + '/' + r.length;
            const full = r => r.length && passed(r) === r.length;
            const tile = (label, value, cls, sub) =>
                '<div class="opt-tile' + (cls ? ' ' + cls : '') + '">'
                + '<div class="opt-tile-label">' + label + '</div>'
                + '<div class="opt-tile-value">' + value + '</div>'
                + (sub ? '<div class="opt-tile-sub">' + sub + '</div>' : '')
                + '</div>';
            if (!after) {
                box.innerHTML = tile('目前驗證通過', frac(before), full(before) ? 'ok' : 'warn',
                    full(before) ? '全部情境可走通' : '有情境走不通（存在缺口）');
                return;
            }
            const gained = passed(after) - passed(before);
            box.innerHTML =
                tile('優化前 驗證通過', frac(before), full(before) ? '' : 'warn',
                    full(before) ? '' : (before.length - passed(before)) + ' 條情境失敗')
                + '<div class="opt-hero-arrow">→</div>'
                + tile('優化後 驗證通過', frac(after), full(after) ? 'ok' : 'warn',
                    gained > 0 ? '+' + gained + ' 條情境修復' : '無變化')
                + tile('接受的編輯', String(editsCount), '', '通過嚴格改善關卡');
        }

        function optPreviewValidation() {
            if (!optBaselineFlow) return;
            const scenarios = optParseScenarios();
            if (!scenarios) return;
            const results = scenarioResults(optBaselineFlow, scenarios);
            optRenderScenarioTable(results, null);
            optRenderHero(results, null);
        }

        // Render the per-round optimization log (gaps → candidates → strict-gate verdict).
        function optRenderTrace(result) {
            const box = document.getElementById('opt-trace');
            if (!box) return;
            if (!result.trace.length) {
                box.textContent = '（0 輪：流程已滿足驗證情境，沒有缺口可修。）';
                return;
            }
            const lines = [];
            result.trace.forEach(t => {
                lines.push('第 ' + t.round + ' 輪　基準分數 ' + t.base.toFixed(3));
                t.gaps.forEach(g => lines.push('  缺口：' + g));
                lines.push('  候選 ' + t.n_candidates + ' 筆（每筆都以驗證情境重新評分），前 ' + t.top.length + ' 名：');
                t.top.forEach(c => lines.push('    ' + c.score.toFixed(3) + '  ' + c.edit));
                lines.push(t.accepted
                    ? '  ✅ 接受：' + t.accepted + '（嚴格改善 → 通過關卡）'
                    : '  ✗ 本輪無編輯嚴格改善分數：全部駁回並停止。');
                lines.push('');
            });
            box.textContent = lines.join('\n');
        }

        function optSetStatus(text) {
            const el = document.getElementById('opt-status');
            if (el) el.textContent = text;
        }

        function optRenderFlow(flow, diff) {
            generatedFiles['flow-json'] = JSON.stringify(flow, null, 2);
            renderFlowFromGeneratedJson();
            if (diff) decorateFlowDiff(diff);
        }

        function optRefreshDropOptions(flow) {
            const sel = document.getElementById('opt-drop-select');
            if (!sel) return;
            sel.innerHTML = '';
            flow.states.forEach(state => {
                Object.keys(state.next_states || {}).forEach(outcome => {
                    const opt = document.createElement('option');
                    opt.value = state.id + '\u0001' + outcome;
                    opt.textContent = state.id + ' → 「' + outcome + '」';
                    sel.appendChild(opt);
                });
            });
        }

        function optLoadFlow(flow, sourceLabel) {
            optBaselineFlow = JSON.parse(JSON.stringify(flow));
            optResultFlow = null;
            const scBox = document.getElementById('opt-scenarios');
            if (scBox) scBox.value = JSON.stringify(seedScenariosFromFlow(flow), null, 2);
            optRefreshDropOptions(flow);
            optRenderFlow(flow, null);
            const report = document.getElementById('opt-report');
            if (report) report.textContent = '// 按「執行優化」後，這裡會顯示每一輪的評分與被接受的編輯…';
            const evolveOut = document.getElementById('opt-evolve');
            if (evolveOut) evolveOut.textContent = '// 優化後，這裡會列出建議寫回 SOP 的修訂…';
            const traceBox = document.getElementById('opt-trace');
            if (traceBox) traceBox.textContent = '// 執行優化後，這裡會逐輪列出缺口、候選評分與關卡判定…';
            optPreviewValidation();
            optSetStatus(sourceLabel + '。驗證情境已依流程自動生成（可編輯）。可先「製造缺口」示範，或直接執行優化。');
        }

        function optLoadPastedFlow() {
            const box = document.getElementById('opt-flow-paste');
            if (!box || !box.value.trim()) return;
            try {
                optLoadFlow(JSON.parse(box.value.trim()), '已載入貼上的 flow.json');
            } catch (e) {
                optSetStatus('無法解析 flow.json：' + e.message);
            }
        }

        function optDropTransition() {
            if (!optBaselineFlow) return;
            const sel = document.getElementById('opt-drop-select');
            if (!sel || !sel.value) return;
            const [stateId, outcome] = sel.value.split('\u0001');
            optBaselineFlow.states.forEach(st => {
                if (st.id === stateId && st.next_states) delete st.next_states[outcome];
            });
            optResultFlow = null;
            optRefreshDropOptions(optBaselineFlow);
            optRenderFlow(optBaselineFlow, null);
            optPreviewValidation();
            optSetStatus('已移除分支 ' + stateId + ' → 「' + outcome + '」（模擬 SOP 缺漏）。下表顯示哪些情境因此失敗；執行優化，看它能否自動找回。');
        }

        // One-click demo: pick a mid-path branch a scenario depends on, drop it,
        // then immediately optimize — the whole story (break → detect → repair)
        // lands in the hero tiles, the table, and the per-round trace.
        function optAutoDemo() {
            if (!optBaselineFlow) { optSetStatus('請先載入 flow.json（從 ① 編譯，或在下方貼上）。'); return; }
            const scenarios = optParseScenarios();
            if (!scenarios) { optSetStatus('驗證情境 JSON 無法解析，無法示範。'); return; }
            const byId = {};
            optBaselineFlow.states.forEach(s => { byId[s.id] = s; });
            // forward-order hops of the first scenario; drop the 2nd hop (or the 1st)
            const sc = scenarios[0];
            const hops = [];
            let cur = optBaselineFlow.start_state;
            let guard = 0;
            while (byId[cur] && !_isTerminalState(byId[cur]) && guard < optBaselineFlow.states.length + 3) {
                guard += 1;
                const outcome = sc.situation ? sc.situation[cur] : undefined;
                if (outcome === undefined || !((byId[cur].next_states || {})[outcome])) break;
                hops.push([cur, outcome]);
                cur = byId[cur].next_states[outcome];
            }
            if (!hops.length) { optSetStatus('第一條情境走不出任何分支，無法示範。'); return; }
            const [sid, outcome] = hops[Math.min(1, hops.length - 1)];
            const sel = document.getElementById('opt-drop-select');
            if (sel) sel.value = sid + '\u0001' + outcome;
            optDropTransition();
            optRun();
            optSetStatus('一鍵示範完成：移除了 ' + sid + ' → 「' + outcome
                + '」，優化器偵測缺口並自動找回。上方大數字與對照表是修復前後，「優化過程」可展開看逐輪判定。');
        }

        function optRun() {
            if (!optBaselineFlow) { optSetStatus('請先載入 flow.json（從 Converter 編譯，或在下方貼上）。'); return; }
            let scenarios;
            try {
                scenarios = JSON.parse(document.getElementById('opt-scenarios').value);
            } catch (e) { optSetStatus('無法解析驗證情境 JSON：' + e.message); return; }
            if (!Array.isArray(scenarios) || !scenarios.length) { optSetStatus('驗證情境需為非空陣列。'); return; }
            const budget = Math.max(1, parseInt(document.getElementById('opt-budget').value, 10) || 5);

            const beforeResults = scenarioResults(optBaselineFlow, scenarios);
            const result = optimizeFlowJs(optBaselineFlow, scenarios, budget);
            optResultFlow = result.flow;
            const afterResults = scenarioResults(optResultFlow, scenarios);
            optRenderScenarioTable(beforeResults, afterResults);
            optRenderHero(beforeResults, afterResults, result.accepted.length);
            optRenderTrace(result);

            let md = '# 優化報告（SkillOpt 式結構化自我演化）\n\n';
            md += '- 驗證分數（correct-end）：**' + result.start_score.toFixed(3) + ' → ' + result.final_score.toFixed(3) + '**（' + result.rounds + ' 輪）\n';
            md += '- 接受的編輯：**' + result.accepted.length + '**；駁回（緩衝）：**' + result.rejected_count + '**\n\n';
            md += '## 被接受的編輯（每一筆都通過「嚴格改善驗證分數」關卡）\n\n';
            if (result.accepted.length) {
                result.accepted.forEach(a => {
                    md += '- `' + describeEdit(a.edit) + '`（驗證 ' + a.before.toFixed(3) + ' → ' + a.after.toFixed(3) + '）\n';
                });
            } else {
                md += '- 無（流程已滿足驗證情境，或沒有任何編輯能嚴格改善分數）。\n';
            }
            const report = document.getElementById('opt-report');
            if (report) report.textContent = md;

            const diff = diffFlows(optBaselineFlow, optResultFlow);
            optRenderFlow(optResultFlow, diff);
            const evolveOut = document.getElementById('opt-evolve');
            if (evolveOut) evolveOut.textContent = renderEvolveSuggestions(diff);
            optSetStatus(result.accepted.length
                ? '優化完成：接受 ' + result.accepted.length + ' 筆編輯（圖上琥珀＝變更的 state）。請審核下方 SOP 修訂建議，或送往治理頁比對。'
                : '優化完成：沒有可接受的編輯。');
        }

        function optDownloadFlow() {
            if (!optResultFlow) { optSetStatus('請先執行優化。'); return; }
            const blob = new Blob([JSON.stringify(optResultFlow, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'flow.optimized.json';
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function optSendToGovernance() {
            if (!optBaselineFlow || !optResultFlow) { optSetStatus('請先執行優化，再送往治理頁。'); return; }
            localStorage.setItem(STORAGE_KEY + ':gov_handoff',
                JSON.stringify({ old: optBaselineFlow, new: optResultFlow }));
            window.location.href = 'governance.html';
        }

        function initOptimize() {
            const saved = loadState();
            if (saved && saved.files && saved.files['flow-json']) {
                try {
                    optLoadFlow(JSON.parse(saved.files['flow-json']), '已載入 Converter 編譯的 flow.json');
                    return;
                } catch (e) { /* fall through to the paste prompt */ }
            }
            optSetStatus('尚未載入 flow.json。請先在 ① 編譯，或展開下方「貼上 flow.json」。');
        }

        (function initPage() {
            const page = (document.body && document.body.dataset && document.body.dataset.page) || 'converter';
            if (page === 'simulator') initSimulator();
            else if (page === 'governance') initGovernance();
            else if (page === 'optimize') initOptimize();
            else initConverter();
        })();
