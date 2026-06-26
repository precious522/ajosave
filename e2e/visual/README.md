# Visual Regression Tests

Playwright screenshot comparison tests for key Ajosave pages.

## How it works

- On first run (or after `--update-snapshots`), Playwright captures **baseline** PNG screenshots and stores them in `__snapshots__/`.
- On subsequent runs it compares the current render against the baseline. Any diff exceeding **0.1%** of total pixels fails the test.
- Baselines are committed to the repo. Diffs and actuals are gitignored.

## Running locally

```bash
# Run visual tests only (requires a running dev/prod server on :3000)
npm run test:visual

# Update baselines after an intentional UI change
npm run test:visual:update
```

## Capturing initial baselines

If you're setting up for the first time (no snapshots committed yet):

```bash
npm run build
npx next start &
npm run test:visual:update
```

Then commit the generated `e2e/visual/__snapshots__/` files.

## CI behaviour

- The `visual-regression` job in CI runs after the build succeeds.
- On failure, diff images are uploaded as a CI artifact (`visual-regression-report`) retained for 30 days.
- A comment is automatically posted on the PR with a direct link to the artifact.

## Adding new pages

1. Create `e2e/visual/<page-name>.visual.spec.ts`.
2. Use `toHaveScreenshot()` — Playwright handles the comparison automatically.
3. Run `npm run test:visual:update` to capture the baseline, then commit the snapshot.
