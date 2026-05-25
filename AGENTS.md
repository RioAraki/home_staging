# Project conventions for AI assistants

## Auto-commit + push after each completed stage

When you finish a coherent "stage" of work — typically corresponding to a
checked-off task in the conversation's task list, or a self-contained feature
the user can verify in isolation — commit the diff and push to `origin/main`
**without being asked**.

Definition of a "stage":
- A new feature that the user can test in the running app
- A bugfix the user verified
- A data correction batch (yaml edits, script runs)
- A non-trivial refactor that passes type-check and validation
- Multi-file changes that belong together (data + code wired up)

Do **not** auto-commit:
- Half-finished work that still has TODOs / unsubmitted changes
- Pure exploration (debug scripts you intend to delete)
- Changes the user explicitly hasn't approved (e.g. discarding their flagged data)

Workflow:
1. `git status` + `git diff` to confirm scope
2. Stage the relevant files explicitly (avoid `git add .`/`-A` so you don't
   pull in junk like `.DS_Store` or accidentally-edited unrelated files)
3. Commit with a concise message: subject line < 70 chars, body explains
   the *why* in 1–3 short paragraphs, end with the Co-Authored-By trailer
4. `git push origin main` — never `--force` unless explicitly told
5. Report the commit hash + 1-line summary to the user

Then continue with the next task. The user explicitly said:
> "我很难每一步都叮嘱你要 commit and push" — so don't wait to be asked.

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
