# Branch Protection — `main`

## Rules in effect

| Rule | Setting |
|---|---|
| Direct pushes to `main` | **Blocked** — all changes via PR |
| Required approving reviews | **1** |
| Dismiss stale reviews on new push | **Yes** |
| Required CI checks before merge | `Lint & Type Check`, `Unit Tests`, `Next.js Build` |
| Branches must be up-to-date before merge | **Yes** |
| Force push | **Disabled** |
| Branch deletion | **Disabled** |
| Conversation resolution required | **Yes** |

## Applying the rules

Branch protection is applied automatically via the `branch-protection.yml` workflow when it is merged to `main`. It can also be triggered manually from **Actions → Apply Branch Protection → Run workflow**.

### Prerequisites

A GitHub Personal Access Token (classic) with `repo` scope must be stored as the repository secret `BRANCH_PROTECTION_TOKEN`. The token owner must have **Admin** access to the repository.

```
Settings → Secrets and variables → Actions → New repository secret
Name:  BRANCH_PROTECTION_TOKEN
Value: <PAT with repo scope>
```

## Development workflow

```
main          ← protected, no direct push
  └── feat/my-feature   ← branch off main
        └── PR → 1 review + CI green → merge
```

1. Branch off `main`: `git checkout -b feat/<description>-<issue>`
2. Push and open a PR targeting `main`
3. CI must pass (lint, type-check, tests, build)
4. At least 1 reviewer must approve
5. Merge — squash or merge commit, no force push
