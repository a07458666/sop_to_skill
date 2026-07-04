# Maintenance — how future sessions update the ops files safely

The ops files (CLAUDE.md, docs/ops/*, docs/web_demo.md) are institution, not
code. They decay if never updated and rot if updated carelessly. This file
defines who may change what, how, and when to compress.

## What you may change WITHOUT asking the user

- **Fixing verified staleness**: a path, command, tool name, or line count that
  the live environment proves wrong (you ran it / listed it and it errored).
  Fix it in place, note the evidence in the commit message.
- **Appending a LESSON** (format below) after any incident where the docs were
  wrong, silent, or misleading. Appending is always safe; rewriting rules from
  a single incident is not.
- **CLAUDE.md key-file table / route map rows** when you add or move files.
- **docs/web_demo.md** content, in the same commit as the UI change it tracks.

## What REQUIRES asking the user first

- Changing or deleting any **iron rule** (CLAUDE.md) or any threshold in
  DISPATCH.md §4 / JUDGMENT.md (escalation counts, done-definition boxes).
- Deleting any ops file or an entire section of one.
- Anything that weakens verification (removing a verify-block command,
  relaxing the report contract).
- Rewriting the LETTER (append a dated postscript instead).

## Backup rule

Before any non-append edit to CLAUDE.md or a docs/ops file: copy the current
version to `docs/ops/archive/⟨name⟩.⟨YYYY-MM-DD⟩.bak` in the same commit.
Archive files are never edited.

## LESSON format (append to the END of the file the lesson belongs to)

```
> **LESSON ⟨YYYY-MM-DD⟩** — Trigger: ⟨what happened, 1 line⟩.
> Rule: ⟨the corrected behaviour, imperative, 1-2 lines⟩.
> Evidence: ⟨commit hash / error text / file:line⟩.
```

Routing: environment/failure lessons → DIAGNOSIS.md; delegation/model lessons
→ DISPATCH.md; decision lessons → JUDGMENT.md; template fixes → edit the
template in place (templates are meant to be tuned) + one-line changelog at
the file bottom.

## Compression protocol (prevents unbounded growth)

- Trigger: a file exceeds ~250 lines OR holds > 10 LESSON blocks.
- Action: fold the lessons into the body rules they amend, delete the folded
  lesson blocks, archive the pre-compression version per the backup rule.
- Compression is a "requires asking" change ONLY if it drops a rule; pure
  folding (same rules, fewer words) is self-serve. When in doubt, keep the
  rule and cut the prose — rules are cheap, re-learning incidents is not.

## Canary check (run when you suspect doc rot)

The docs are stale if any of these disagree with reality — fix docs, not reality:
```bash
# every path CLAUDE.md routes to exists
ls docs/ops/DIAGNOSIS.md docs/ops/DISPATCH.md docs/ops/JUDGMENT.md \
   docs/ops/TEMPLATES.md docs/ops/MAINTENANCE.md docs/ops/LETTER.md docs/web_demo.md
# the verify block still matches CI
grep -n "html-validate" .github/workflows/ci-cd.yml CLAUDE.md | head -4
```

## Ownership note

The user owns intent (iron rules, thresholds, product direction). Sessions own
freshness (paths, commands, lessons). When those conflict, freshness yields:
flag the conflict to the user instead of "fixing" an intent you disagree with.
