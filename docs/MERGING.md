# Merging branches

Three of us write to this repo: the agent branches land as commits, the art pass arrives on `main`
directly, and both are merged by hand. This is the procedure that has actually worked, written down
because the same three files conflict every time and one bad resolution is silent.

## Before you merge

- `git fetch origin` **every time**. The artist pushes to `main` without warning, so a branch that was
  current an hour ago is behind, and a push will be rejected after you have already done the work.
- Merge into `main`; do not rebase a branch that has already been reviewed. The history of what was
  tested is worth more than linearity.
- The gate is `npm run build` and `npm run smoke`. Balance is **not** a gate — tuning is judged in play.
  See `docs/design.md` for why the harness is a regression floor rather than a difficulty model.

## Where conflicts happen, and why

- **`src/view/board.ts`** — every visual feature appends a `draw…` branch in the same region.
- **`src/main.ts`** — every feature adds one import line and one wiring line at the same anchor.
- **`scripts/smoke.mjs`** — every feature appends a numbered test section at the end, so two branches
  always conflict at the same point.

None of these are real disagreements. They are additions landing on the same line, and union is almost
always the right answer — but *union by hand*, not by deleting markers and hoping.

## The procedure for `smoke.mjs`

This file is 5,000 lines of tests and a broken merge here produces a file that still starts, so it is the
one to be careful with.

1. `git checkout --ours scripts/smoke.mjs` — take the `main` side, which is valid.
2. Extract the branch's new sections:

   ```bash
   git show <branch>:scripts/smoke.mjs | sed -n '/^\/\/ --- 39\./,$p'
   ```

   Take from the branch's first new header to just before its footer (`console.log(failures === 0 …)`).
3. Append that block to the `main` file **before** the footer.
4. Add the imports that block needs by hand. `git show <branch>:scripts/smoke.mjs | grep '^import'` and
   diff against the `main` file's imports; add only what is genuinely missing.
5. `node --check scripts/smoke.mjs` — must be silent. `RC=0` or do not continue.

## Never do this

- **Do not resolve a conflict by deleting the marker lines and nothing else.** It works only when both
  sides are self-contained blocks, and it silently drops a brace when one side was split mid-block. That
  is how a `}` goes missing and the file ends one scope short.
- **Do not trust the word `PASS`.** Confirm the tail of the file is intact: the last three lines must be
  the `console.log(failures === 0 …)` footer and `process.exit(…)`. A merge that eats the footer still
  prints tests and then exits 0.
- **Do not merge an SVG conflict by picking a side.** Run `node scripts/art-merge.mjs <ours> <theirs>
  <out>` — the rule is that the more complex side wins, and the script counts elements rather than
  guessing.

## After the merge

```bash
npm run build && npm run smoke      # both must pass before the commit is pushed
git log --oneline -1                # the merge commit exists
git rev-list --left-right --count origin/main...HEAD   # then push
```

A push that reports `Everything up-to-date` means the merge commit was never created — check
`git status` for staged paths, which is what a failed `git add -A ':!node_modules'` leaves behind.

## If the harness is unavailable

The smoke suite is the only automated gate, so a red harness blocks the merge. Do not merge on a green
`tsc` alone; a type check cannot see a sprite pool that was never hidden.
