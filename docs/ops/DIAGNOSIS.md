# Harness Diagnosis — top failure modes and fixes

Written 2026-07-04 from first-hand evidence in a long working session (referenced
by CLAUDE.md and every file in docs/ops/). Read this when something feels wrong;
the failure you are hitting is probably one of these three.

## #1 — Silent container resets destroy state (most dangerous)

**What happens.** This repo runs in an ephemeral remote container. It can be
reclaimed and rebuilt BETWEEN turns without any error message. After a rebuild:
the repo is re-cloned at some older commit (typically the last merged PR), local
commits that were never pushed are GONE, installed deps (`pydantic`, `pytest`,
`html-validate`) are gone, and everything in `/tmp` and the scratchpad is gone.

**Observed twice in one session.** Once the re-clone landed 4 pushed-commits
behind the branch tip: files "went missing" (`governance.html`,
`tests/test_flowdiff_parity.py`) and it looked exactly like a code problem.
The wrong reaction — recreating the files from scratch or force-pushing the stale
tree — would have destroyed pushed work.

**Symptoms that mean "reset happened", not "code broke":**
- `ModuleNotFoundError: pydantic` / `pytest: command not found` / `html-validate: command not found`
- Files or tests that existed earlier are absent; `git log` tip is older than you remember
- `/tmp` helper scripts you wrote earlier are gone

**Fix (do these, in order):**
1. `git fetch origin <branch> && git log --oneline -3 origin/<branch>` — compare
   with local `git log`. If origin is ahead: stash any real local work
   (`git stash push -m wip <files>`), `git reset --hard origin/<branch>`,
   `git stash pop`. Never recreate files that origin already has.
2. Reinstall deps (see the "Environment recovery" block in CLAUDE.md).
3. Regenerate any /tmp helpers — never assume they survived.

**Prevention:** push after EVERY commit (`git push -u origin <branch>`). An
unpushed commit does not exist. Do not batch commits "to push later".

## #2 — Token burn: reading big files whole, dumping raw output

**What happens.** `assets/app.js` is ~2,700 lines and `assets/styles.css` ~1,100.
Reading them end-to-end (or re-reading after every edit) is the single biggest
token leak. Second leak: pasting full test logs / reports into the conversation.

**Fix (hard rules):**
- Any file > 400 lines: `Grep` for the symbol/section first, then `Read` a
  window of ≤ 120 lines around the hit. Never full-file Read of app.js/styles.css.
- Test/lint output: always pipe through `| tail -N` (N ≤ 10). You need the
  verdict, not the transcript.
- Questions that span > 5 files ("where is X handled?"): dispatch an Explore
  subagent and receive conclusions + `file:line` only (see docs/ops/DISPATCH.md).
- Edits do not need read-back — the Edit tool fails loudly on mismatch. Re-read
  only the exact region when composing a follow-up edit.

## #3 — The parity/golden discipline breaks silently

**What happens.** This repo's core invariant: three JS ports in `assets/app.js`
must behave IDENTICALLY to their Python sources — compile (`parser.py`),
flowdiff (`flowdiff.py`), optimizer (`optimizer.py`) — and the committed
`skills/*` bundles must match what `parser.py` generates (golden tests). A model
that edits one side and smoke-tests only that side will pass locally and break
CI — or worse, "fix" the parity test's expectation instead of the other
implementation.

**Extra trap:** the JS optimizer/UI uses `\u0001` as a separator. It must appear
in source as the 6-char escape sequence `\u0001`, never as a raw control byte
(invisible in editors/diffs; the Bash tool rejects raw control bytes in commands
— write Node helpers to a file via a `python3` heredoc instead of inline `node -e`).

**Fix (hard rules):**
- Touching any of `parser.py` / `flowdiff.py` / `optimizer.py` / the matching
  blocks in `app.js` ⇒ change BOTH sides in the same commit, then run the full
  verify block from CLAUDE.md (one copy-paste). No exceptions for "tiny" changes.
- Touching `parser.py` output ⇒ regenerate all four `skills/*` bundles
  (commands in CLAUDE.md) in the same commit.
- A parity/golden test failure is NEVER fixed by editing the test or the
  committed bundle to match. Fix the implementation that drifted. If you cannot
  tell which side is correct, the Python side is the source of truth.

## Runner-ups (lower frequency, still real)

- **MCP server flapping**: `<system-reminder>` noise about servers
  connecting/disconnecting is ambient; ignore it unless a needed tool actually
  fails. Do not narrate it or re-plan around it.
- **`gh` CLI absent**: GitHub operations go through `mcp__github__*` tools only
  (load schemas via ToolSearch first). Retry network pushes with backoff
  (2s/4s/8s/16s) before concluding failure.
- **Blocking on questions**: in autonomous/remote sessions the user may be away.
  Ask only when genuinely blocked on a user-owned decision (see
  docs/ops/JUDGMENT.md §3); otherwise pick the documented default and state it.
