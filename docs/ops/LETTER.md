# Letter to future sessions

Written 2026-07-04 by the session that built the ops institution, after ~15
working turns in this repo (the 4-step web journey, the optimizer port, G4
audit, and these docs). You are probably a smaller model than the author. That
is fine — everything here was written so that you don't need to be the author,
you need to FOLLOW the files. Read CLAUDE.md first; it routes everywhere else.

## Three things the user didn't ask me to tell you, but you need

**1. The parity system IS the product.** This repo's pitch is "the compiled
state machine is an enforceable contract". Its credibility rests on the Python
and JS implementations never disagreeing, and on CI proving it (3 parity
suites + golden bundles + eval gate). Nobody human reviews most changes here —
the tests are the only reviewer that always shows up. That is why iron rule 1
says a parity failure is never fixed on the test side. If you remember one
thing, remember that. The moment the implementations drift silently, every
demo this user gives becomes a potential live failure.

**2. Working style of this user (observed, consistent across many turns):**
- Communicates in zh-TW; replies fast and decisively; short imperative asks
  ("開PR", "繼續開發", "G4"). Between asks you are expected to act
  autonomously, verify, push, and END your reply with 1–3 concrete next-step
  options — they almost always pick one (usually the recommended one).
- They merge PRs within minutes. After any merge, restart the branch from
  main (recipe in CLAUDE.md §Git). Never stack on merged history.
- Taste: 冷靜、簡潔 (calm, restrained). When they said the UI was
  "資訊量爆炸", the fix that satisfied them was visual SUBTRACTION —
  fewer colors, collapsed panels, one hero element — not reorganization.
  Bias every UI decision toward removing, and toward the "ten-second demo
  story" (one button that shows the value).
- Report style they respond well to: outcome first, real numbers quoted
  ("80 passed"), then a short 中文 explanation of what changed and why.

**3. The demo audience is manufacturing/fab people.** Sample SOPs, tool names
(MES, SPC, MRB, engineering hold), and the whole scenario language are
semiconductor-domain. When you invent examples, stay in that domain — a
generic "send email" example reads as toy; a "lot hold / chamber health /
qualification plan" example reads as credible. `sop_rule.md` +
`examples/*.md` are the reference vocabulary.

## How this institution will most likely decay, and the countermeasure

| Decay mode | Early symptom | Countermeasure |
|---|---|---|
| **Docs rot** — paths/commands drift from reality | a routed file 404s; a verify command errors | MAINTENANCE.md canary check; fix docs immediately, cite evidence |
| **Append-only bloat** — lessons pile up, nobody reads them | an ops file > 250 lines / > 10 lessons | compression protocol (MAINTENANCE.md); fold lessons into rules |
| **Ritual compliance** — running the checklists without the reasoning | verify block "run" but tails not read; reviews that always ACCEPT | JUDGMENT §5: every claim needs quoted evidence; reviewers must FIND something or say explicitly why zero findings is plausible |
| **Delegation theater** — spawning agents for 2-tool-call tasks | more tokens on dispatch than on work | DISPATCH §1 anti-over-delegation threshold (≤3 tool calls ⇒ do it yourself) |
| **Test erosion** — "fixing" a red parity/golden test on the test side | a diff that edits tests/ + expected data together with app.js | iron rule 1 + JUDGMENT S4 hard stop; if you're mid-way through doing this, revert |
| **Push procrastination** — batching commits, container eats them | "I'll push after the next feature" | iron rule 3; it has already happened once — DIAGNOSIS #1 is the receipt |

## Honest limits (do not pretend otherwise)

These files recover execution discipline. They cannot give you: product
strategy, visual taste beyond the documented language, or the judgment to know
when a rule no longer serves its purpose. For those: JUDGMENT §7 — options +
recommendation to the user, second opinion from the strongest available model,
or an honest "this needs the user". The user knows smaller models run this
repo now; they will not punish "I need your call here" — they WILL be hurt by
confident wrong autonomy on taste/strategy calls.

## Handoff state as of this letter (2026-07-04)

- Branch `claude/sop-api-mcp-skill-viz-9A1xR`, all work pushed. PRs #8/#9
  merged earlier; the 4-step journey + optimize page + these ops docs are on
  the branch, not yet PR'd (user said 不用PR at the time — offer one when the
  next natural batch completes).
- Roadmap position: M0–M2.5 and G1/G2/G4-audit/G4-diff done. Open G4 items:
  SOP registry (version coexistence/rollback), approval-flow RBAC-lite,
  execution observability. `docs/ROADMAP.md` is current.
- No unfinished work-in-progress is stranded; working tree clean at the time
  of writing.

## Postscripts (append here, dated, per MAINTENANCE.md)
