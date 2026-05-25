# Project conventions for AI assistants

## Auto-commit + push after each completed stage

Stop relying on "do I feel like this is a stage" — that judgement fails on
small tweaks and continuation work. Instead use these **hard triggers**:

### Mandatory `git status` check points

Run `git status` and, if the working tree has any tracked changes you made,
commit + push **before doing anything else**:

1. **User confirmation phrases**: `OK` / `好` / `没问题` / `确认了` /
   `looks good` / `nice` etc. These are end-of-stage signals from the user.
2. **TaskUpdate(status: completed)**: marking a task done = its diff is
   shippable. Commit immediately after, in the same turn.
3. **Before answering a new unrelated question**: if the user pivots topic
   and you have uncommitted code, push first, then answer.
4. **Before invoking a long-running sub-task**: don't leave dirty state
   when delegating to Agent/Explore.

### What to commit even if "trivial"

A 2-line CSS tweak the user just verified IS a stage. A debug script
deletion IS a stage. The cost of an extra small commit (5 sec) is
much lower than the cost of a tangled diff later.

### Skip auto-commit only when

- Half-finished work with TODOs you've explicitly flagged in conversation
- Exploratory scripts you're going to delete this turn anyway
- Changes the user has flagged as wrong but you haven't reverted yet
- Working tree is clean (`git status` shows no diff) — no-op, move on

### Workflow per commit

1. `git status` to confirm scope
2. Stage with explicit paths (no `git add .` or `-A`) — avoids junk
   files and accidentally-edited unrelated paths
3. `git diff --cached --stat` if scope is unclear
4. Commit: subject < 70 chars, body explains the *why* in 1-3 short
   paragraphs, end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
5. `git push origin main` — never `--force` without explicit ask
6. Report the commit hash + 1-line summary

### Self-audit

If the user ever asks "did you commit?", run `git log --oneline -3` AND
`git status` and report honestly. Don't say "yes" without checking.

## Other project rules

- See `memory/feedback_*.md` for accumulated user preferences (review-omission
  rule, etc.). Always check before doing review-related work.
- Coordinate convention: cells are `[row, col]` 0-indexed; printed coords
  are 1-indexed (data row N = printed row N+1; data col 0 = printed col A).
- `bbox` in `furniture_data.yaml` is the minimum bounding rectangle of
  `shape ∪ open_spaces`; the interior may be irregular (cells in bbox that
  are neither shape nor open are "void").
- `wall_edges` applies to ALL non-void cells on that bbox side (shape AND
  open spaces — island-style furniture has its open cells against walls).
