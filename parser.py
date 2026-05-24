import os
import sys
import json
import argparse
import re
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


def slugify_skill_name(value: str) -> str:
    """Convert an SOP title into a skill-compatible name."""
    value = value.lower()
    value = re.sub(r"^sop:\s*", "", value)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value[:63].strip("-") or "generated-sop-skill"


def escape_frontmatter_value(value: str) -> str:
    """Escape a short string for double-quoted YAML frontmatter values."""
    return value.replace("\\", "\\\\").replace('"', '\\"')


# 1. Define the Pydantic schemas for Structured Output
class State(BaseModel):
    id: str = Field(
        description="Unique identifier for the state (e.g., confirm_fault_event, release_tool). Use snake_case."
    )
    type: str = Field(
        description="Type of state. Must be 'action' (performs a tool/API call), 'decision' (conditional routing), or 'end_state' (terminal step)."
    )
    description: str = Field(
        description="Brief description of what this state does or the decision condition to evaluate."
    )
    tool: Optional[str] = Field(
        default=None,
        description="Name of the API or tool/system invoked in this state, if any."
    )
    parameters: Optional[List[str]] = Field(
        default=None,
        description="List of parameter names required by the tool (e.g., ['tool_id', 'event_time'])."
    )
    next_states: Optional[Dict[str, str]] = Field(
        default=None,
        description="Mapping of transition keys (e.g. 'success', 'failure', 'true', 'false') to target state IDs. Empty for end_states."
    )

class StateMachine(BaseModel):
    sop_name: str = Field(
        description="The formal title of the Standard Operating Procedure (SOP)."
    )
    start_state: str = Field(
        description="The ID of the initial starting state of the workflow."
    )
    states: List[State] = Field(
        description="List of all states that compose the SOP workflow graph."
    )


def assess_sop_quality(content: str, flow_data: StateMachine, rules_content: str = "") -> str:
    """
    Generate a concise Traditional Chinese SOP quality report based on sop_rule.md expectations.
    """
    findings = []
    suggestions = []

    if not re.search(r"^#\s+SOP:\s+.+", content, re.MULTILINE):
        findings.append("缺少 H1 標題，或標題格式不符合規則。預期格式為 `# SOP: <流程名稱>`。")
        suggestions.append("將最上層標題改為 `# SOP: <流程名稱>`。")

    if not re.search(r"^##\s+Purpose\b", content, re.MULTILINE):
        findings.append("缺少 `## Purpose` 區段。")
        suggestions.append("新增 Purpose 區段，說明 SOP 適用情境與流程完成後應產生的結果。")

    step_headings = re.findall(r"^###\s+Step\s+(\d+):\s+(.+)$", content, re.MULTILINE)
    if not step_headings:
        findings.append("找不到編號式流程步驟。")
        suggestions.append("每個流程步驟請使用 `### Step 1: Confirm Fault Event` 這類標題格式。")
    else:
        numbers = [int(num) for num, _ in step_headings]
        expected = list(range(1, len(numbers) + 1))
        if numbers != expected:
            findings.append(f"Step 編號不連續。偵測到 {numbers}，預期為 {expected}。")
            suggestions.append("重新編排 Step 編號，從 1 開始且不中斷。")

    if not re.search(r"^##\s+End States\b", content, re.MULTILINE):
        findings.append("缺少 `## End States` 區段。")
        suggestions.append("在 `## End States` 下新增終點狀態，格式使用 `### State: `state_id``。")

    sections = re.split(r"^###\s+", content, flags=re.MULTILINE)[1:]
    for section in sections:
        lines = section.splitlines()
        if not lines:
            continue
        title = lines[0].strip()
        body = "\n".join(lines[1:])
        if title.lower().startswith("state:"):
            if "**Action**" not in body:
                findings.append(f"終點狀態 `{title}` 缺少 `**Action**`。")
                suggestions.append(f"為 `{title}` 補上終點動作說明。")
            continue

        if "**Description**" not in body:
            findings.append(f"步驟 `{title}` 缺少 `**Description**`。")
            suggestions.append(f"為 `{title}` 補上一句具體的步驟描述。")

        has_branching_heading = "**Branching Logic**" in body or "**Branching**" in body
        has_if_branch = re.search(r"\*\*If\s+[^:]+\*\*:", body, re.IGNORECASE)
        if not has_branching_heading or not has_if_branch:
            findings.append(f"步驟 `{title}` 沒有定義清楚的分支邏輯。")
            suggestions.append(f"為 `{title}` 加上明確的 `**If ...**:` 分支。")

    valid_ids = {state.id for state in flow_data.states}
    referenced_ids = set()
    for state in flow_data.states:
        if state.type != "end_state" and not state.next_states:
            findings.append(f"狀態 `{state.id}` 沒有往外的 transition。")
            suggestions.append(f"為 `{state.id}` 加上分支邏輯，讓流程可以繼續或結束。")
        if state.next_states:
            for _, target in state.next_states.items():
                referenced_ids.add(target)
                if target not in valid_ids:
                    findings.append(f"狀態 `{state.id}` 指向不存在的目標 `{target}`。")
                    suggestions.append(f"將 `{target}` 定義為步驟或終點狀態，或修正分支目標。")

    for state in flow_data.states:
        if state.type == "end_state" and state.id not in referenced_ids:
            findings.append(f"終點狀態 `{state.id}` 沒有任何分支會連到它。")
            suggestions.append(f"新增一個會轉移到 `{state.id}` 的分支，或移除未使用的終點狀態。")

    unique_suggestions = []
    for suggestion in suggestions:
        if suggestion not in unique_suggestions:
            unique_suggestions.append(suggestion)

    status = "通過" if not findings else "需要修訂"
    report = "# SOP 品質報告\n\n"
    report += f"- **狀態**: `{status}`\n"
    report += f"- **規則來源**: `sop_rule.md`\n"
    report += f"- **SOP 名稱**: {flow_data.sop_name}\n"
    report += f"- **解析出的狀態數**: {len(flow_data.states)}\n\n"

    report += "## 檢查發現\n\n"
    if findings:
        for finding in findings:
            report += f"- {finding}\n"
    else:
        report += "- 未發現阻擋轉換的品質問題。\n"

    report += "\n## SOP 修改建議\n\n"
    if unique_suggestions:
        for suggestion in unique_suggestions:
            report += f"- {suggestion}\n"
    else:
        report += "- 轉換前不需要修改。\n"

    if rules_content:
        report += "\n## 規則摘要\n\n"
        report += "本報告檢查了標題、目的、編號步驟、描述、工具宣告、分支邏輯、終點狀態、transition target，以及 end state 可達性。\n"

    return report


def offline_fallback_parse(content: str) -> dict:
    """
    A heuristic markdown parser that converts a structured SOP into a state machine.
    Used when GEMINI_API_KEY is not set.
    """
    states = []
    sop_name = "Generated SOP"
    start_state = ""

    # Extract SOP name if present
    name_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if name_match:
        sop_name = name_match.group(1).strip()

    def make_state_id(title: str) -> str:
        title = re.sub(r"step\s+\d+:\s*", "", title, flags=re.IGNORECASE)
        title = re.sub(r"^state:\s*", "", title, flags=re.IGNORECASE)
        title = title.replace("`", "")
        title = re.sub(r"[^a-zA-Z0-9\s]", "", title)
        return title.lower().strip().replace(" ", "_") or "unnamed_state"

    # First pass: map Step numbers and titles to state IDs.
    sections = re.split(r"###\s+", content)
    step_number_to_id = {}
    step_title_to_id = {}
    for section in sections[1:]:
        lines = section.split("\n")
        title_line = lines[0].strip()
        if title_line.startswith("State:"):
            continue

        id_str = make_state_id(title_line)
        if not start_state:
            start_state = id_str

        step_match = re.match(r"Step\s+(\d+):\s*(.+)", title_line, re.IGNORECASE)
        if step_match:
            step_number_to_id[step_match.group(1)] = id_str
            step_title_to_id[step_match.group(2).lower().strip()] = id_str
        step_title_to_id[title_line.lower().strip()] = id_str

    def resolve_target(action_part: str) -> str:
        state_match = re.search(r"State:\s*`([^`]+)`", action_part, re.IGNORECASE)
        if state_match:
            return state_match.group(1).strip()

        step_match = re.search(r"Step\s+(\d+)", action_part, re.IGNORECASE)
        if step_match and step_match.group(1) in step_number_to_id:
            return step_number_to_id[step_match.group(1)]

        normalized_action = action_part.lower()
        for title, state_id in step_title_to_id.items():
            if title and title in normalized_action:
                return state_id

        end_state_match = re.search(r"`([^`]+)`", action_part)
        if end_state_match:
            return end_state_match.group(1).strip()

        return ""

    # Parse sections (Steps)
    for section in sections[1:]:
        lines = section.split("\n")
        title_line = lines[0].strip()
        if title_line.startswith("State:"):
            continue

        id_str = make_state_id(title_line)

        state_type = "action"
        if "evaluate" in id_str or "check" in id_str or "decision" in id_str:
            state_type = "decision"

        description = ""
        tool = None
        params = []
        next_states = {}

        # Parse section details
        for line in lines[1:]:
            line_str = line.strip()
            if line_str.startswith("*   **Description**:") or line_str.startswith("-   **Description**:"):
                description = line_str.split(":", 1)[1].strip()
            elif line_str.startswith("*   **System/Tool**:") or line_str.startswith("-   **System/Tool**:"):
                tool_part = line_str.split(":", 1)[1].strip()
                # Parse e.g., `mes_event_lookup` (Parameters: `tool_id`, `event_time`)
                tool_match = re.search(r"`([^`]+)`", tool_part)
                if tool_match:
                    tool = tool_match.group(1)
                
                param_matches = re.findall(r"`([^`]+)`", tool_part)
                if len(param_matches) > 1:
                    params = param_matches[1:]
            elif "If " in line_str:
                # Basic parsing for branching conditions
                cond_match = re.search(r"\*\*If\s+([^:]+)\*\*:\s*(.+)", line_str)
                if not cond_match:
                    cond_match = re.search(r"If\s+([^:]+):\s*(.+)", line_str)
                
                if cond_match:
                    condition = cond_match.group(1).lower().strip()
                    target = resolve_target(cond_match.group(2))
                    if target:
                        next_states[condition] = target

        if not description:
            description = f"Execute step: {title_line}"

        states.append({
            "id": id_str,
            "type": state_type,
            "description": description,
            "tool": tool,
            "parameters": params if params else None,
            "next_states": next_states if next_states else None
        })

    # Parse End States
    end_states_match = re.findall(r"###\s+State:\s*`([^`]+)`\s*\n\*\s+\*\*Action\*\*:\s*(.+)", content, re.MULTILINE)
    for state_id, action in end_states_match:
        state_id = state_id.strip()
        action_text = action.strip()
        
        tool_match = re.search(r"`([^`]+)`", action_text)
        tool = tool_match.group(1) if tool_match else None
        
        states.append({
            "id": state_id,
            "type": "end_state",
            "description": f"End state: {action_text}",
            "tool": tool,
            "parameters": None,
            "next_states": None
        })

    if not start_state and states:
        start_state = states[0]["id"]

    # Validate state links
    valid_ids = {s["id"] for s in states}
    for s in states:
        if s["next_states"]:
            for key, val in list(s["next_states"].items()):
                if val not in valid_ids:
                    s["next_states"].pop(key)

    return {
        "sop_name": sop_name,
        "start_state": start_state,
        "states": states
    }

def generate_skill_md(flow_data: StateMachine) -> str:
    """
    Generates a valid SKILL.md entrypoint based on the parsed flow data.
    """
    skill_name = slugify_skill_name(flow_data.sop_name)
    tools_required = sorted(list({s.tool for s in flow_data.states if s.tool}))
    description = (
        f"Use when executing the SOP workflow for {flow_data.sop_name}. "
        "Follow the bundled flow.json state machine for deterministic routing, tool calls, "
        "decision branches, and terminal states."
    )

    instructions = "---\n"
    instructions += f'name: "{escape_frontmatter_value(skill_name)}"\n'
    instructions += f'description: "{escape_frontmatter_value(description)}"\n'
    instructions += "---\n\n"
    instructions += f"# {flow_data.sop_name}\n\n"
    instructions += "## Objective\n"
    instructions += f"Execute the Standard Operating Procedure (SOP) for: {flow_data.sop_name}.\n\n"
    
    instructions += "## Core Rules\n"
    instructions += "1. Follow the state transition graph defined in `flow.json`.\n"
    instructions += "2. Always begin execution at the state ID: `{}`.\n".format(flow_data.start_state)
    instructions += "3. Do not jump to subsequent states without verifying transition conditions.\n"
    instructions += "4. Only use tools explicitly mapped to the current state.\n"
    instructions += "5. Treat states with type `end_state` as terminal states.\n\n"
    if tools_required:
        instructions += "## Tools Required\n\n"
        for tool in tools_required:
            instructions += f"- `{tool}`\n"
        instructions += "\n"
    
    instructions += "## State Map Reference\n\n"
    for s in flow_data.states:
        instructions += "### State: `{}` (Type: `{}`)\n".format(s.id, s.type)
        instructions += f"- **Description**: {s.description}\n"
        if s.tool:
            instructions += f"- **Tool**: `{s.tool}`"
            if s.parameters:
                instructions += f" (Parameters: {', '.join(s.parameters)})"
            instructions += "\n"
        if s.next_states:
            instructions += "- **Branching / Next States**:\n"
            for cond, target in s.next_states.items():
                instructions += f"  - If outcome is `{cond}` -> transition to `{target}`\n"
        else:
            instructions += "- **Termination**: This is an end state.\n"
        instructions += "\n"
        
    return instructions

def main():
    parser = argparse.ArgumentParser(
        description="SOP Markdown to Agent Skill Bundle Generator using Google GenAI SDK."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the input Markdown SOP file."
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Path to save the generated Skill Bundle directory."
    )
    parser.add_argument(
        "--model",
        default="gemini-2.5-flash",
        help="Gemini model to use. Defaults to gemini-2.5-flash."
    )
    parser.add_argument(
        "--rules",
        default="sop_rule.md",
        help="Path to the SOP authoring rules file. Defaults to sop_rule.md."
    )
    args = parser.parse_args()

    # Read input file
    if not os.path.exists(args.input):
        print(f"[Error] Input file '{args.input}' does not exist.", file=sys.stderr)
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        sop_content = f.read()

    rules_content = ""
    if args.rules and os.path.exists(args.rules):
        with open(args.rules, "r", encoding="utf-8") as f:
            rules_content = f.read()

    flow_data = None

    # Verify API Key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[Warning] GEMINI_API_KEY environment variable is not set.")
        print("Running in offline heuristic fallback mode...")
        
        try:
            raw_flow = offline_fallback_parse(sop_content)
            # Validate output using StateMachine model
            flow_data = StateMachine(**raw_flow)
        except Exception as e:
            print(f"[Error] Heuristic fallback parsing failed: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # If API Key is present, call Google GenAI SDK
        print(f"Reading SOP file: {args.input}...")
        print(f"Calling Gemini ({args.model}) with structured schema...")

        try:
            from google import genai

            # Initialize the client (automatically picks up GEMINI_API_KEY from environment)
            client = genai.Client()

            prompt = f"""
You are an expert systems architect. Your task is to analyze the provided Standard Operating Procedure (SOP) Markdown document and convert it into a structured state machine graph.

Please read the following SOP document carefully, identify the steps, decision conditions, tools/API mappings, parameters, and branching routes:

---
{sop_content}
---

Extract all states, transitions, tools, parameters, and ensure that:
1. Every destination in `next_states` exists as a state ID in the `states` list.
2. The `start_state` points to a valid state ID.
3. Decision states have explicit branching conditions (e.g., 'true'/'false', or 'success'/'failure', or range conditions like '<=100' / '>100').
4. Terminal/end states have `next_states` set to null or empty.
"""

            response = client.models.generate_content(
                model=args.model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": StateMachine,
                    "temperature": 0.1,
                }
            )
            
            # The new SDK automatically parses the JSON into the pydantic model in response.parsed
            flow_data = response.parsed

        except Exception as e:
            print(f"[Error] Failed to parse SOP using Gemini API: {e}", file=sys.stderr)
            sys.exit(1)

    # 4. Generate the Skill Bundle files
    if flow_data:
        try:
            os.makedirs(args.output_dir, exist_ok=True)
            
            # A. Generate flow.json (State Machine structure)
            with open(os.path.join(args.output_dir, "flow.json"), "w", encoding="utf-8") as f:
                json.dump(flow_data.model_dump(), f, indent=2, ensure_ascii=False)

            # B. Generate SKILL.md (Skill entrypoint)
            skill_md_content = generate_skill_md(flow_data)
            with open(os.path.join(args.output_dir, "SKILL.md"), "w", encoding="utf-8") as f:
                f.write(skill_md_content)

            # C. Copy SOP authoring rules and generate quality report
            if rules_content:
                with open(os.path.join(args.output_dir, "sop_rule.md"), "w", encoding="utf-8") as f:
                    f.write(rules_content)

            quality_report = assess_sop_quality(sop_content, flow_data, rules_content)
            with open(os.path.join(args.output_dir, "sop_quality_report.md"), "w", encoding="utf-8") as f:
                f.write(quality_report)

            print(f"Successfully generated Skill in: {args.output_dir}")
            print("Files generated:")
            print(f"  - {os.path.join(args.output_dir, 'SKILL.md')} (Skill entrypoint)")
            print(f"  - {os.path.join(args.output_dir, 'flow.json')} (State Graph)")
            if rules_content:
                print(f"  - {os.path.join(args.output_dir, 'sop_rule.md')} (SOP authoring rules)")
            print(f"  - {os.path.join(args.output_dir, 'sop_quality_report.md')} (SOP quality report)")

        except Exception as e:
            print(f"[Error] Failed to write Skill Bundle files: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    main()
