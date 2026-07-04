# Delegation templates — copy, fill the ⟨blanks⟩, dispatch

Pair with docs/ops/DISPATCH.md (model choice, report contract). Rules that make
these work: keep the WHY line (prevents literal-minded drift); acceptance
criteria must be checkable by command or read-back, never adjectives; always
state what NOT to touch.

## 1. SEARCH / understanding (subagent_type: Explore; model: sonnet, haiku if trivial)

```
Goal: find ⟨what⟩ in this repo. Why: ⟨the decision this feeds⟩.
Scope: start from ⟨dir/file if known, else repo root⟩. Read-only.
Answer these questions, nothing else:
1. ⟨question 1⟩
2. ⟨question 2⟩
Acceptance: every claim carries file:line. If something is absent, say
"not found" explicitly after checking ⟨the places it would plausibly be⟩.
Report: ≤15 lines. Conclusions first, then the file:line evidence list.
No file dumps, no code blocks longer than 5 lines.
```

## 2. IMPLEMENTATION (subagent_type: general-purpose; model: sonnet; opus if it touches parity)

```
Goal: implement ⟨feature/fix⟩. Why: ⟨user-visible motivation⟩.
Context you need: ⟨2-4 lines: relevant files, the pattern to follow,
e.g. "mirror how optRenderScenarioTable does it"⟩.
Constraints:
- Do NOT touch: ⟨files/areas⟩.
- Iron rules apply (repo CLAUDE.md): parity both-sides-same-commit,
  \u0001 as escape sequence only, zh-TW UI text, calm visual language.
Acceptance (run these yourself before reporting):
- ⟨specific behavior check, e.g. "node /path/harness.js prints X: true"⟩
- The CLAUDE.md verify block passes: quote the pytest tail line.
Report: files changed (paths only) + what each does (1 line each) +
verification output tails. If blocked: exact error + tree state, stop there.
Do NOT commit; leave changes in the working tree.
```

## 3. REFACTOR / mechanical batch (model: haiku with exact recipe, sonnet otherwise)

```
Goal: apply this recipe across ⟨scope⟩. Why: ⟨motivation⟩.
Recipe (follow EXACTLY, no improvements beyond it):
1. ⟨step, e.g. "replace every `X(...)` call with `Y(...)`, keeping args"⟩
2. ⟨step⟩
Behaviour must not change. Do NOT reformat untouched lines, do NOT rename
anything not listed, do NOT touch: ⟨files⟩.
Acceptance: ⟨command⟩ passes; `git diff --stat` touches only ⟨expected files⟩.
Report: diff stat + the acceptance command tail. List any site where the
recipe did not cleanly apply (file:line) INSTEAD of improvising there.
```

## 4. RESEARCH (skill: deep-research for multi-source; else general-purpose + WebSearch; model: sonnet)

```
Question: ⟨precise question, incl. what decision it feeds⟩.
Constraints: prefer primary sources (docs/specs/release notes); note the
date of each source (things change); if sources conflict, show both sides.
Acceptance: every factual claim has a source link; explicitly separate
"verified fact" from "inference"; say "could not verify" where true.
Report: write the full findings to a file in the session scratchpad (default
— research dumps are NOT committed to the repo unless the user asks to keep
them; if asked, use docs/research/⟨topic⟩.md and create the dir); reply with
the path + a ≤10-line summary + your recommendation.
```

## 5. REVIEW / acceptance (fresh context ALWAYS — the author never reviews itself; model: sonnet, opus for parity/architecture)

```
You are reviewing work you did not write. Do not trust its claims; verify.
The change: ⟨paths / diff location / branch⟩.
It claims to: ⟨the acceptance criteria the author was given⟩.
Check, in order:
1. Claims true? Run: ⟨verify commands⟩. Quote tails.
2. Iron-rule violations (repo CLAUDE.md): parity single-sided edits,
   weakened tests, raw \u0001 bytes, missing skills/* regeneration.
3. Would a stranger understand the code without the PR description?
4. What is MISSING: untested paths, docs not updated, edge cases.
Report: verdict (ACCEPT / FIX-FIRST with the list / REJECT with why),
each finding as file:line + one sentence. Max 10 findings, worst first.
```

## Dispatch one-liners (for the Agent tool call itself)

- Fill `description` with 3–5 words ("survey optimizer call sites").
- Independent read-only agents: one message, multiple Agent calls.
- Writing agents that could touch the same file: serialize, or worktree
  isolation (see DISPATCH.md §6).
