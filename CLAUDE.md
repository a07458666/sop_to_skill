# CLAUDE.md

**SOP-to-Skill Compiler** — compiles human-readable Markdown SOPs (semiconductor
fab domain, but generic) into enforceable Agent Skill bundles: `SKILL.md` +
`flow.json` (state machine) + `sop_rule.md` + `sop_quality_report.md`.
Four-pillar loop: Compile → Enforce → Prove → Evolve (see `docs/PRODUCT.md`).

## SESSION START — do this before any work

This container is ephemeral and resets silently between turns (deps and local
commits vanish). Full explanation + symptoms: `docs/ops/DIAGNOSIS.md` #1.

```bash
BR=claude/sop-api-mcp-skill-viz-9A1xR
git fetch origin $BR 2>/dev/null
git log --oneline origin/$BR..HEAD   # local-only commits (may be lost work-in-progress)
git log --oneline HEAD..origin/$BR   # commits origin has that local lacks
# Both empty            -> in sync, proceed.
# Only 2nd has commits  -> origin ahead: stash uncommitted work, then
#                          git reset --hard origin/$BR  (then pop stash)
# 1st has ANY commits   -> SAFETY FIRST: git branch rescue-$(date +%s) to keep
#                          them, THEN reset; reconcile by cherry-pick from rescue.
# NEVER recreate "missing" files before checking origin.
```

Environment recovery (after any reset; safe to re-run):
```bash
/usr/local/bin/python3 -m pip install --quiet pydantic pytest
npm install -g html-validate >/dev/null 2>&1
```

## Iron rules (violating any of these breaks the product or the repo)

1. **Parity**: `parser.py` ↔ `app.js` compile path, `flowdiff.py` ↔ its JS
   block, `optimizer.py` ↔ its JS block are byte-for-byte behavioural twins.
   Change both sides in the same commit; parity tests enforce it. A parity or
   golden failure is fixed in the drifted implementation, NEVER in the test or
   the committed bundle. Python is the source of truth when unsure.
2. **Golden bundles**: any change to `parser.py` output ⇒ regenerate all four
   `skills/*` bundles (commands below) in the same commit.
3. **Push = existence**: push after every commit
   (`git push -u origin <branch>`; on network failure retry 2s/4s/8s/16s).
   Unpushed work dies with the container.
4. UI text zh-TW; code identifiers English. Match the calm visual language
   (`docs/web_demo.md` §Visual language) — no gradients/glows/feature-dump.
5. Never put the model identifier in commits, PRs, or code.
6. The `\u0001` separator in `app.js` stays a 6-char escape sequence — never a
   raw control byte (`docs/ops/DIAGNOSIS.md` #3).
7. Files > 400 lines (`app.js`, `styles.css`): Grep first, Read ≤120-line
   windows. Pipe green test output through `| tail`; on failure re-run just the
   failing test with full output. (`docs/ops/DIAGNOSIS.md` #2)

## Verify before pushing (one copy-paste)

```bash
ruff check parser.py executor.py optimizer.py evolve.py flowdiff.py mcp_server.py eval/ tests/
python3 -m pytest tests/ -q
python3 eval/run_eval.py --check
html-validate index.html simulator.html governance.html optimize.html
node --check assets/app.js
```

Regenerate committed skills (needed only when parser output changes; offline,
no GEMINI_API_KEY needed):
```bash
python3 parser.py --input sample_sop.md --output-dir skills/tool_fault_investigation --rules sop_rule.md
python3 parser.py --input examples/furnace_temperature_drift_sop.md --output-dir skills/furnace_temperature_drift --rules sop_rule.md
python3 parser.py --input examples/photoresist_coater_defect_sop.md --output-dir skills/photoresist_coater_defect --rules sop_rule.md
python3 parser.py --input examples/tool_anomaly_auto_notification_sop.md --output-dir skills/tool_anomaly_auto_notification --rules sop_rule.md
```

No browser in this environment. UI smoke-testing: extract pure JS functions and
run under Node, or eval `app.js` inside a DOM shim (pattern: write the shim via
a `python3` heredoc, stub `document`/`localStorage`, set `body.dataset.page`).

## Key files (one line each; details live in the linked docs)

| File | Role |
|---|---|
| `parser.py` | Compiler CLI: Pydantic `State`/`StateMachine`, Gemini path + offline fallback, quality report |
| `executor.py` | Runtime enforcement (M1) + G4 audit: actor attribution, sha256 hash-chain (`verify_audit`), JSON/CSV export |
| `optimizer.py` | Structured self-evolution (M2.5): gap detection → bounded edits → strict held-out gate |
| `evolve.py` | Renders accepted edits back as a reviewable SOP-markdown diff (G2) |
| `flowdiff.py` | Graph-level diff of two flow.json versions (G4); `--check` = CI gate |
| `mcp_server.py` | Executor as MCP stdio server (G1); mutating tools take `actor` |
| `eval/run_eval.py` | Baseline vs compiled eval; `--check` gates CI |
| `tests/` | Executor, eval invariant, golden snapshots, 3× parity (compile/flowdiff/optimizer) |
| `assets/app.js` | ALL web-demo logic incl. the three JS ports (~2.7k lines — Grep first) |
| `index/simulator/optimize/governance.html` | The 4-step journey + governance; map in `docs/web_demo.md` |
| `.github/workflows/ci-cd.yml` | lint (ruff + html-validate 4 pages + node --check) → test (pytest + eval) → Pages deploy on push to main; also runs on PRs |

## Core model (compressed)

A SOP compiles to a state machine. `State`: `id`, `type`
(`action`|`decision`|`end_state`), `description`, `tool`, `tool_kind`
(`api`|`mcp`|null), `mcp_server`, `parameters`, `returns`, `signal_field`
(the output field the agent routes on), `requires_approval`
(true/false/null; explicit value wins, null falls back to
`DEFAULT_APPROVAL_KEYWORDS` inference in the executor), `next_states`
(free-text outcome → target id).

SOP markdown annotations (parsed identically in `parser.py` and `app.js`):
- `**System/Tool**`: `` `tool` (API) `` or `` `mcp__server__tool` (MCP) `` or
  `(MCP: server)`; detection: explicit marker > `mcp__` prefix > default api.
- `**Returns**: \`f1\`, \`f2\`` → `returns`; `**Signal**: \`f1\`` → `signal_field`.
- `**Approval**: required|yes|true|需要 → true; no|false → explicit opt-out.
Authoring rules live in `sop_rule.md`; response-interpretation semantics
(API status/body vs MCP isError/structuredContent) in `docs/web_demo.md`.

## Route map — read the file that matches your task

| Task | Read |
|---|---|
| Anything feels broken / env weird | `docs/ops/DIAGNOSIS.md` |
| Delegating work / choosing model & effort | `docs/ops/DISPATCH.md` |
| Deciding: escalate? done? ask user? change course? | `docs/ops/JUDGMENT.md` |
| Writing a subagent prompt | `docs/ops/TEMPLATES.md` |
| Updating any docs/ops file | `docs/ops/MAINTENANCE.md` |
| First session in this repo | `docs/ops/LETTER.md` |
| Web demo pages/UI work | `docs/web_demo.md` |
| Product positioning / roadmap status | `docs/PRODUCT.md`, `docs/ROADMAP.md` |
| UX rationale & history | `docs/UX_REVIEW.md` |

## Git / workflow

- Designated branch: `claude/sop-api-mcp-skill-viz-9A1xR`. Develop there.
  Open PRs / merge only when asked. After a PR merges, restart the branch:
  `git fetch origin main && git checkout -B <branch> origin/main`.
- GitHub ops via `mcp__github__*` tools (load with ToolSearch); no `gh` CLI.
- Known limitations: web demo is a faithful simulation (no real MCP/network);
  JS `makeStateId` strips non-ASCII (Chinese titles → `step_N` ids); tool
  catalog covers bundled SOPs, others get a generic schema.
