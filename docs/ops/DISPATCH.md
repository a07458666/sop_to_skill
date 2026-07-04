# Dispatch — delegating work, choosing models, verifying results

For the main-session model ("the commander") in this repo. Written 2026-07-04.
Facts below were verified against the live environment then; if a tool or model
name errors out, trust the error and update this file per docs/ops/MAINTENANCE.md.

## 0. What actually exists here (verified, not from memory)

**Subagent types** (Agent tool `subagent_type`): `general-purpose` (full tools),
`Explore` (read-only search; cannot edit), `Plan` (architecture planning;
cannot edit), `claude` (generalist), `claude-code-guide` (questions about
Claude Code/SDK/API only). `statusline-setup` is irrelevant here.

**Model override** (Agent tool `model` param): `haiku` | `sonnet` | `opus`
(| `fable` — Mythos-tier; usually NOT available; if a dispatch with it errors,
fall back to `opus`). If omitted, the subagent inherits the session model.
The Agent tool has NO effort parameter. (A separate `Workflow` orchestration
tool with per-agent effort levels exists in SOME sessions only — check your
actual tool list; if absent, the Agent tool is the only dispatch mechanism,
and even when present Workflow requires the user to explicitly opt in.)
Default: use the Agent tool.

**Skills that replace hand-rolled dispatch** (invoke via the Skill tool):
`code-review` (diff review), `verify` (run the app to confirm a change),
`simplify` (cleanup pass), `deep-research` (multi-source web research),
`security-review`. Prefer these over writing your own equivalent prompt.

**GitHub**: only `mcp__github__*` MCP tools (ToolSearch to load). No `gh` CLI.

## 1. The commander does not descend

Main context is for: decisions, small targeted edits, synthesis, user
communication. Delegate when ANY of these hold:

| Trigger | Dispatch to |
|---|---|
| Question needs reading > 5 files, or any repo-wide "where is X / how does Y work" sweep | `Explore` (read-only) |
| Web research beyond one quick lookup | `deep-research` skill, or `general-purpose` |
| Bulk mechanical change across ≥ 3 files with a known recipe | `general-purpose` (haiku/sonnet), one agent per chunk if independent |
| Reviewing your own completed diff | `code-review` skill or a fresh `general-purpose` agent |
| Anything whose raw output would exceed ~200 lines if pasted into main context | any subagent; it returns conclusions only |

**Anti-over-delegation (this repo is small):** a single Grep + one ≤120-line
Read answers most questions here. Do NOT spawn an agent for a task you could
finish with ≤ 3 tool calls — the dispatch overhead exceeds the work.

## 2. Every dispatch carries the trio

1. **Goal + why** (one sentence each — the "why" prevents literal-minded drift).
2. **Acceptance criteria** — observable, checkable ("pytest tests/ -q exits 0",
   "returns file:line for every claim"), never "make it good".
3. **Report format** — what comes back (see §3). Templates: docs/ops/TEMPLATES.md.

## 3. Report contract (what subagents return)

- Conclusions + `file:line` references. NEVER full file dumps.
- Long artifacts (reports, generated code, logs) are written to a file;
  the reply carries the path + a ≤5-line summary.
- Every claim that a file/function/behaviour exists carries its `file:line`.
- If the task failed: what was tried, the exact error, the current state of the
  working tree (clean? half-edited files? which?).

## 4. Model + effort selection (explicit, never implicit)

| Task shape | Model | Notes |
|---|---|---|
| Mechanical: rename, apply known recipe, format, batch regex-like edits | `haiku` | must include an exact recipe + acceptance check |
| Standard implementation, search, review, docs | `sonnet` | default workhorse |
| Cross-cutting design, gnarly debugging, parity-sensitive changes, adversarial review of important work | `opus` | ceiling in normal sessions |
| (If available) one-shot judgment calls of highest stakes | `fable` | expect unavailable; fall back to `opus` |

Escalation ladder (per subtask):
- `haiku` fails once → redo on `sonnet`. Do not iterate with haiku.
- `sonnet` fails the SAME subtask twice → escalate to `opus`, forwarding the
  full failure trail (both attempts, errors, diffs) — not a fresh clean prompt.
- After `opus` solves it: if the fix is a repeatable pattern, write the recipe
  down and batch-apply the rest on `haiku`/`sonnet`.
- Max 2 retry rounds per approach TOTAL; a third attempt must change the
  approach or escalate (see docs/ops/JUDGMENT.md §4).

## 5. Verification is never self-verification

The agent (or main context) that produced work does not certify it.

- **Files**: read back the written file (or `wc -l` + targeted grep of key
  sections) before reporting done.
- **Code**: the CLAUDE.md verify block (all five commands) — run it, show the
  tail. For UI: the Node DOM-shim smoke pattern (CLAUDE.md §verify).
- **Important diffs**: fresh-context reviewer (`code-review` skill or a
  `general-purpose` agent that did NOT write the code) with the acceptance
  criteria in its prompt.
- **High-stakes judgment** (irreversible, user-facing, architectural): get a
  second opinion — either one `opus` reviewer, or 2–3 cheap independent answers
  and pick by explicit comparison. If they disagree and stakes remain high,
  ask the user with concrete options (JUDGMENT.md §3).

## 6. Parallelism rules

- Independent read-only dispatches: launch in ONE message (they run
  concurrently).
- Parallel WRITE dispatches must not touch the same files; if they might,
  serialize them or give each `isolation: "worktree"`.
- After delegating a search, do not also do the search yourself.
