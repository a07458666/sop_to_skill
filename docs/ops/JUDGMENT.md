# Judgment — rubrics for the calls that are usually "taste"

Each rubric: concrete triggers → action, plus one positive example (✓ = what a
past session actually did right, taken from real history in this repo) and one
negative example (✗ = the tempting wrong move). If a situation matches no
rubric, see §7 (limits).

## §1 When to escalate to a stronger model

Escalate (per docs/ops/DISPATCH.md §4 ladder) when ANY:
- T1. The same subtask failed twice with different attempted fixes AND a §4-S1
  re-diagnosis pass did not change your causal model. (Precedence: on the
  second failure ALWAYS re-diagnose first — S1; escalate only if re-diagnosis
  leaves you with the same theory of the cause.)
- T2. The fix keeps GROWING: attempt 2 touches more files than attempt 1.
- T3. The task needs holding > ~3 interacting constraints at once (e.g. a
  change that must satisfy parity + golden + eval + UI simultaneously).
- T4. You cannot state WHY the current failure happens, only WHERE.

Do NOT escalate for: mechanical work that failed due to a wrong recipe (fix the
recipe), or environment breakage (that's DIAGNOSIS.md #1, not intelligence).

- ✓ 2026-06: `pytest` import errors after a container reset were correctly
  treated as environment loss (reinstall deps), not escalated or "debugged".
- ✗ Haiku botches a rename, and you retry haiku three more times with
  increasingly detailed prompts. One failure at haiku = move to sonnet.

## §2 When work is actually DONE

ALL boxes, no exceptions ("it works on my run" is not done):
- [ ] The CLAUDE.md verify block passes (all five commands; show tails).
- [ ] If parser output changed: skills/* regenerated in the same commit.
- [ ] If UI changed: DOM-shim smoke of every affected page's init path ran.
- [ ] Committed with a message that says what + why, AND pushed to origin.
- [ ] Docs whose content the change invalidates are updated in the same commit
      (CLAUDE.md key-files line, docs/web_demo.md, ROADMAP status).
- [ ] The final chat message states outcome first, with real numbers
      ("80 passed", "4 pages validated") — no hedging, no unverified claims.

- ✓ 2026-06: the G4 audit change shipped with +6 tests, eval re-run, CLAUDE.md
  and ROADMAP updated, pushed — one commit,全綠 verification quoted.
- ✗ "Tests pass locally, I'll push after the next feature too." The container
  reset between turns has already destroyed exactly such work once.

## §3 When to stop and ask the user

ASK (with 2–4 concrete options and a recommended default) only when:
- A1. Two legitimate directions genuinely diverge and the choice is the user's
  taste/ownership: visual style depth, product scope, naming, what to cut.
- A2. The action is destructive or outward-facing: force-push over unclear
  history, deleting user-authored content, opening/merging PRs (only when
  asked), posting comments, anything leaving the repo.
- A3. The user's request conflicts with a documented iron rule.

Do NOT ask when: a documented default exists (follow it and say so), the choice
is reversible and small (pick, state it, move on), or you're merely nervous.
Format: lead with your recommendation. This user answers fast and decisively
when given concrete options — and historically picks the recommended one.

- ✓ 2026-06: "how deep should the visual simplification go?" was asked with 3
  options + recommendation (a real taste fork); user picked the recommendation.
- ✗ Asking "should I also update the docs?" Docs updates are part of DONE (§2)
  — asking that is offloading your checklist onto the user.

## §4 Signals the DIRECTION is wrong (change course, don't retry harder)

- S1. Two different fixes for the same symptom both failed → your model of the
  cause is wrong. Stop patching; go read the failing path end-to-end (or
  dispatch Explore to map it), then re-diagnose.
- S2. The diff keeps growing while the goal isn't getting closer.
- S3. You're fighting the framework (adding shims/workarounds around a tool or
  library instead of using it the intended way).
- S4. You're about to weaken a test/assertion to make it pass. HARD STOP —
  in this repo that specifically means parity/golden tests (iron rule 1).
- S5. The plan requires an ability the environment doesn't have (browser,
  network to arbitrary hosts, real MCP mounts) → redesign around the
  documented substitutes (Node shim, simulation), don't brute-force.

- ✓ 2026-07: `pytest.approx()` rejected nested lists in a new parity test; the
  fix was flattening the comparison (reshape the approach), not looping on
  variations of the same call.
- ✗ Parity test fails after editing app.js only → "the expected values must be
  stale, I'll update the test." That destroys the product's core guarantee.

## §5 Quality floor — what "verified" minimally means

| Claim | Minimum evidence |
|---|---|
| "code works" | verify block green (tails shown), incl. eval `--check` |
| "UI works" | DOM-shim init smoke for each affected page + html-validate |
| "file written" | read-back (targeted grep/wc) of the file on disk |
| "pushed" | `git log --oneline -1 origin/<branch>` shows the commit |
| "agent completed X" | its report includes file:line evidence, spot-check one |
| "numbers improved" | both numbers quoted from actual runs, not paraphrased |

Never state a metric you didn't just observe. If verification is impossible
(e.g. real browser rendering), say exactly that and what proxy you used.

## §6 Session hygiene triggers

- Context growing + task large → write progress to files EARLY (the session
  can be cut; files are the only deliverable that survives).
- About to do a batch of > 3 similar edits → write the recipe down first
  (a fenced block in the commit or an ops note), then apply.
- End of any turn: the last message must contain the conclusions; text between
  tool calls may never be shown to the user.

## §7 Honest limits — what these rubrics cannot do

Rubrics recover EXECUTION quality (decompose, verify, escalate). They cannot
supply taste or resolve genuine ambiguity. When the call is aesthetic (is this
design good?), strategic (which product bet?), or underspecified (user intent
unclear after reading everything): do NOT fake confidence. The available moves,
in order: (1) present 2–3 concrete options with trade-offs and a recommendation
(§3 format); (2) escalate the judgment itself to the strongest available model
as a second opinion; (3) say plainly "this is a taste/strategy call I can't
settle" and ask. Inventing a confident answer is the only forbidden move.
