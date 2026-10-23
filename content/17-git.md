---
id: git
title: Git & CI/CD
short: Git & CI/CD
category: DevOps & Cloud
order: 17
color: #f05032
icon: Git
summary: Git internals, branching, merge vs rebase, resolving conflicts, undoing mistakes, workflows, CI/CD pipelines and deployment strategies.
---

# Beginner

## Git Basics and the Three Areas

Git is a **distributed version control system**: every clone has the full history.

### Three areas
1. **Working directory** — files you edit.
2. **Staging area (index)** — what will go into the next commit.
3. **Repository (.git)** — committed snapshots.

```bash
git init                          # or: git clone <url>
git status
git add file.js                   # stage (git add -p to stage hunks interactively)
git commit -m "feat: add login form"
git log --oneline --graph --all
git diff                          # working vs staged
git diff --staged                 # staged vs last commit
git restore file.js               # discard working changes
git restore --staged file.js      # unstage
```

### Good commit messages
Imperative mood, short subject (≤ 50 chars), body explaining *why*. Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`) enable automated changelogs and semantic versioning.

## Branches and Remotes

A **branch** is just a movable pointer to a commit. `HEAD` points to the current branch.

```bash
git switch -c feature/cart        # create & switch (old: git checkout -b)
git branch -a                     # list local and remote branches
git switch main
git merge feature/cart
git branch -d feature/cart

git remote -v
git fetch origin                  # download remote changes, don't touch your branch
git pull                          # fetch + merge (or rebase with --rebase)
git push -u origin feature/cart   # push and set upstream
```

| `git fetch` | `git pull` |
|---|---|
| updates remote-tracking branches (`origin/main`) only | fetch **and** integrate into your current branch |
| safe, lets you inspect first | can create merge commits/conflicts |

### `.gitignore`
```text
node_modules/
.env
dist/
*.log
__pycache__/
```

# Intermediate

## Merge vs Rebase

### Merge
```bash
git switch main && git merge feature
```
Creates a **merge commit** with two parents (unless fast-forward). Preserves true history; can be noisy.

### Rebase
```bash
git switch feature && git rebase main
```
Re-applies your commits **on top of** the latest `main`, creating new commits with new hashes → linear history.

| | Merge | Rebase |
|---|---|---|
| History | true, branching graph | linear, clean |
| Commits rewritten | no | **yes** (new SHAs) |
| Conflicts | resolved once | may resolve per commit |
| Safe on shared branches | ✅ | ❌ never rebase pushed public history others use |

### Interactive rebase — clean up before a PR
```bash
git rebase -i HEAD~4     # pick, reword, squash, fixup, drop, reorder
git commit --fixup <sha> && git rebase -i --autosquash main
```

### Fast-forward and squash merges
- **Fast-forward**: if `main` hasn't moved, the pointer just advances (no merge commit). `--no-ff` forces a merge commit.
- **Squash merge**: combines all PR commits into one commit on `main`.

## Resolving Conflicts

Conflicts happen when the same lines changed differently on both sides.

```text
<<<<<<< HEAD
const timeout = 5000;
=======
const timeout = 10000;
>>>>>>> feature/retry
```
1. Edit to the correct final content, remove markers.
2. `git add <file>`.
3. `git commit` (merge) or `git rebase --continue` (rebase).
4. Abort anytime: `git merge --abort` / `git rebase --abort`.

Tips: pull/rebase often, keep PRs small, use `git rerere` to reuse recorded resolutions, and use a merge tool (`git mergetool`, VS Code).

## Undoing Things

| Situation | Command |
|---|---|
| Fix the last commit message / add a forgotten file | `git commit --amend` (only if not pushed) |
| Discard local file changes | `git restore <file>` |
| Unstage | `git restore --staged <file>` |
| Undo a pushed commit safely | `git revert <sha>` (new commit that inverts it) |
| Move branch back, keep changes staged | `git reset --soft HEAD~1` |
| Move back, keep changes unstaged | `git reset --mixed HEAD~1` (default) |
| Move back, **discard** changes | `git reset --hard HEAD~1` ⚠️ |
| Recover "lost" commits | `git reflog` then `git reset --hard <sha>` or `git branch rescue <sha>` |
| Temporarily shelve work | `git stash push -m "wip"`, `git stash pop` |
| Apply one commit from another branch | `git cherry-pick <sha>` |
| Find the commit that introduced a bug | `git bisect start`, `git bisect bad`, `git bisect good <sha>` |

> [!INTERVIEW]
> `reset` rewrites history (local use); `revert` adds history (safe for shared branches).

```bash
git commit --amend -m "fix: correct message"     # last commit, not pushed yet
git restore src/app.js                           # discard working changes
git restore --staged src/app.js                  # unstage
git revert a1b2c3d                               # undo a pushed commit with a new commit
git reset --soft HEAD~1                          # undo the commit, keep changes staged
git reset --hard origin/main                     # throw away local commits (careful)
git reflog && git branch rescue HEAD@{3}         # get "lost" work back
git clean -fdn                                   # preview deleting untracked files (-f to do it)
```

## Branching Workflows

- **GitHub Flow** — `main` always deployable; short-lived feature branches → PR → review + CI → merge → deploy. Simple, great for continuous delivery.
- **Git Flow** — `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`. Suited to versioned/scheduled releases; heavier.
- **Trunk-Based Development** — everyone integrates into `main` at least daily with tiny branches; incomplete work hidden behind **feature flags**. Used by high-performing teams (DORA research).
- **Release branches** for supporting multiple versions.

```bash GitHub Flow / trunk-based
git switch -c feat/checkout-coupon main
git commit -am "feat: apply coupon at checkout"
git push -u origin feat/checkout-coupon      # open a PR → CI + review → squash merge → deploy
```
```bash Git Flow release
git switch -c release/2.3.0 develop
git commit -am "chore: bump version to 2.3.0"
git switch main && git merge --no-ff release/2.3.0 && git tag -a v2.3.0 -m "2.3.0"
git switch develop && git merge --no-ff release/2.3.0
```

### Pull request best practices
Small, focused PRs; descriptive title/description; linked ticket; CI green; required reviewers (CODEOWNERS); branch protection rules (no direct pushes, required checks, signed commits).

# Advanced

## Git Internals

Git is a **content-addressable object store** (`.git/objects`). Objects are identified by SHA-1 (or SHA-256) of their content:
- **blob** — file contents.
- **tree** — directory listing (names → blobs/trees).
- **commit** — snapshot: pointer to a root tree, parent commit(s), author, message.
- **tag** — annotated tag object.

**Refs** (`.git/refs/heads/main`) are files containing a commit hash. `HEAD` usually contains `ref: refs/heads/main`; a **detached HEAD** points directly to a commit.

```bash
git cat-file -p HEAD          # see commit object
git cat-file -p HEAD^{tree}   # see tree
git rev-parse main
```

Git stores **snapshots, not diffs** — but packfiles delta-compress objects for storage. The **index** is a binary file describing the next tree.

### Other advanced tools
- `git worktree add ../hotfix hotfix-branch` — multiple working directories for one repo.
- `git submodule` / subtree — nested repositories.
- Sparse checkout and partial clone (`--filter=blob:none`) for huge monorepos.
- Hooks (`pre-commit`, `commit-msg`, `pre-push`) — e.g., Husky + lint-staged, pre-commit framework.
- Git LFS for large binaries.
- Signed commits (GPG/SSH), `git blame -w -C`, `git log -S "text"` (pickaxe).

## CI/CD Pipelines

- **Continuous Integration** — every change is built and tested automatically on merge/PR.
- **Continuous Delivery** — every change is releasable; deploy to prod with a manual approval.
- **Continuous Deployment** — every passing change goes to production automatically.

### Typical pipeline stages
1. Checkout, install (with dependency caching).
2. Lint, format check, type check.
3. Unit tests + coverage.
4. Build artifact / Docker image (tag with commit SHA).
5. Security: SAST (CodeQL, Semgrep), dependency scan (SCA), secret scanning, image scan (Trivy).
6. Integration/E2E tests (ephemeral environments, testcontainers).
7. Push artifact/image to registry; sign; SBOM.
8. Deploy to staging → smoke tests → promote to production (GitOps).
9. Post-deploy verification, monitoring, automatic rollback.

```yaml .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push: { branches: [main] }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint && npm run typecheck
      - run: npm test -- --coverage
  image:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}" }
      - uses: docker/build-push-action@v6
        with: { push: true, tags: "ghcr.io/${{ github.repository }}:${{ github.sha }}" }
```

Tools: GitHub Actions, GitLab CI, Jenkins, Azure DevOps, CircleCI, Tekton, Argo Workflows; CD: Argo CD, Flux, Spinnaker, Octopus.

## Deployment Strategies and DevOps Metrics

| Strategy | How | Pros / cons |
|---|---|---|
| Recreate | stop old, start new | simple; downtime |
| Rolling | replace instances gradually | no downtime; mixed versions during rollout |
| Blue/Green | two full environments, switch traffic | instant rollback; double resources |
| Canary | small % of traffic to new version, increase gradually | real-user validation; needs good metrics |
| A/B testing | route by user attributes to compare features | business experimentation |
| Shadow | mirror traffic to new version without serving responses | safe load testing |
| Feature flags | deploy dark, release by toggling | decouple deploy from release; flag debt |

```yaml Canary with Argo Rollouts
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: api }
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 10m }
        - analysis: { templates: [{ templateName: error-rate }] }   # auto-rollback if errors spike
        - setWeight: 50
        - pause: { duration: 10m }
```
```sql DORA: deployment frequency and lead time from your deploy log
SELECT date_trunc('week', deployed_at) AS week, COUNT(*) AS deploys,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY deployed_at - committed_at) AS median_lead_time
FROM deployments WHERE env = 'prod' GROUP BY 1 ORDER BY 1;
```

### Database changes with zero downtime
**Expand/contract**: add new column (expand) → write to both → backfill → read from new → remove old (contract) in a later release. Never ship a breaking schema change together with code that depends on it.

### DORA metrics
Deployment frequency, lead time for changes, change failure rate, time to restore service (MTTR). High performers deploy on demand with low failure rates.

### Secrets in pipelines
Use the CI's secret store or OIDC federation to cloud providers (no long-lived keys), mask logs, least-privilege tokens, and never commit secrets (secret scanning + pre-commit hooks).

# Interview Questions

## Beginner

### What is Git and why is it distributed?
A version control system tracking changes to files. It's distributed because every clone contains the complete history, so you can commit, branch and view history offline, and there's no single point of failure.

```bash
git clone https://github.com/acme/shop.git   # full history copied locally
cd shop && git log --oneline | wc -l         # works offline
git commit -m "wip"                          # commits locally, no server needed
git remote add backup git@gitlab.com:acme/shop.git && git push backup main   # any clone can be a remote
```

### `git fetch` vs `git pull`?
`fetch` downloads new commits and updates remote-tracking branches without changing your working branch. `pull` runs fetch and then merges (or rebases) the remote branch into your current branch.

```bash
git fetch origin                     # update origin/main only
git log --oneline main..origin/main  # what's new upstream?
git diff main origin/main
git merge origin/main                # integrate when ready
git pull --rebase                    # fetch + rebase in one step
git config --global pull.rebase true
```

### What is the staging area?
An intermediate area (the index) where you assemble the exact changes for the next commit. It lets you commit part of your work (even parts of files with `git add -p`) and keep commits focused.

```bash
git add -p src/cart.js       # stage only some hunks
git diff                     # unstaged changes
git diff --staged            # what will be committed
git commit -m "fix: rounding in cart total"   # only the staged hunks
```

### How do you create and switch branches?
`git switch -c <name>` creates and switches (or `git checkout -b`). `git switch <name>` switches. `git branch` lists, `git branch -d` deletes merged branches.

```bash
git switch -c feature/search     # create + switch
git switch main                  # switch
git branch -vv                   # list with upstream info
git branch -d feature/search     # delete (merged)
git branch -D experiment         # force delete
git switch -c hotfix v2.3.0      # branch from a tag
```

### What does `.gitignore` do?
It lists patterns for untracked files Git should ignore — dependencies, build output, logs, secrets. It doesn't affect already-tracked files (use `git rm --cached` to stop tracking).

```text .gitignore
node_modules/
dist/
.env
*.log
!keep.log          # negate: do track this one
```
```bash
git rm --cached .env           # stop tracking a file that was committed before
git check-ignore -v dist/app.js   # which rule ignores it?
```

## Intermediate

### Merge vs rebase — when would you use each?
Merge integrates branches with a merge commit, preserving history — safe for shared branches. Rebase replays commits on a new base, producing linear history but rewriting SHAs — great for updating your private feature branch or cleaning commits before a PR. Never rebase public history others have based work on.

```bash
git switch feature && git rebase main        # replay your commits on top of main (local branch)
git rebase -i HEAD~4                         # squash/reword before opening the PR
git push --force-with-lease                  # safe force-push of your own branch
git switch main && git merge --no-ff feature # merge commit on the shared branch
```

### `git reset` vs `git revert`?
`reset` moves the branch pointer back (soft/mixed/hard deciding what happens to changes) — rewriting history, for local work. `revert` creates a new commit undoing a previous commit's changes — safe for pushed/shared branches.

```bash
git reset --hard HEAD~2          # local only: rewrites history
git revert 9f3e1a2               # shared branch: new commit undoing 9f3e1a2
git revert -m 1 <merge-sha>      # revert a merge commit (keep parent 1)
```

### How do you resolve a merge conflict?
Identify conflicted files with `git status`, edit to the intended content removing conflict markers, test, `git add` them, then complete with `git commit` or `git rebase --continue`. Abort with `--abort` if needed.

```text
<<<<<<< HEAD
const TAX = 0.2;
=======
const TAX = 0.21;
>>>>>>> feature/tax-update
```
```bash
git status                          # both modified: src/tax.js
# edit the file to the intended result, remove markers
git add src/tax.js && git commit    # or: git rebase --continue
git merge --abort                   # bail out
git checkout --theirs src/tax.js    # take their version wholesale
```

### What is `git stash`?
It saves uncommitted changes (working and staged) onto a stack and reverts to a clean tree, letting you switch context. Restore with `git stash pop` or `apply`; include untracked files with `-u`.

```bash
git stash push -u -m "half-done search"   # include untracked files
git switch hotfix && …                    # fix something else
git switch -
git stash list
git stash pop                             # apply + drop
git stash show -p stash@{1}
```

### What is cherry-pick and when is it used?
Applying the changes of a specific commit onto the current branch as a new commit — e.g., backporting a hotfix to a release branch.

```bash
git switch release/2.3
git cherry-pick -x 4c5d6e7        # backport the fix; -x records the original sha
git cherry-pick A..B              # a range
git cherry-pick --continue        # after resolving conflicts
```

### What is CI/CD?
Continuous Integration automatically builds and tests every change to catch issues early. Continuous Delivery keeps the main branch always releasable with automated deployment pipelines; Continuous Deployment automatically releases every passing change to production.

```yaml .github/workflows/ci.yml
name: CI
on: { pull_request: {}, push: { branches: [main] } }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run lint && npm test
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: ./scripts/deploy.sh
```

## Advanced

### How would you recover a commit after a `git reset --hard`?
Use `git reflog` to find the commit hash HEAD pointed to before the reset, then `git reset --hard <sha>` or create a branch at it. Reflog entries persist ~90 days by default unless garbage collected.

```bash
git reflog
# 1a2b3c4 HEAD@{0}: reset: moving to HEAD~1
# 9f8e7d6 HEAD@{1}: commit: feat: add invoices   ← the lost commit
git reset --hard 9f8e7d6        # or: git branch recovered 9f8e7d6
git fsck --lost-found           # dangling commits if the reflog is gone
```

### How does Git store data internally?
As a content-addressed object database of blobs (file contents), trees (directories), commits (snapshot + parents + metadata) and tags, each identified by the hash of its content. Branches and tags are refs pointing to commits; packfiles delta-compress objects for efficiency.

```bash
echo 'hello' | git hash-object --stdin       # ce013625030ba8dba906f756967f9e9ca394464a (blob id)
git cat-file -t HEAD                         # commit
git cat-file -p HEAD                         # tree <sha>, parent <sha>, author, message
git cat-file -p HEAD^{tree}                  # blobs and subtrees with names
ls .git/objects/ | head; git count-objects -vH
```

### How do you find which commit introduced a bug?
`git bisect`: mark a known bad and a known good commit; Git checks out midpoints for you to test (or run a script automatically with `git bisect run`), performing a binary search until the first bad commit is found.

```bash
git bisect start
git bisect bad HEAD
git bisect good v2.1.0
git bisect run npm test -- --testNamePattern="cart total"   # automatic binary search
git bisect reset
git log -S "applyDiscount" --oneline     # pickaxe: commits that added/removed the string
git blame -L 40,60 src/cart.js
```

### Compare Git Flow and trunk-based development.
Git Flow uses long-lived `develop` and release branches with formal release cycles — useful for versioned products but slows integration and increases merge pain. Trunk-based development integrates small changes into main continuously behind feature flags, enabling continuous delivery with fewer conflicts but requiring strong automated testing.

```text
Git Flow:     main ──●────────────●──           (releases only)
              develop ─●─●─●─●─●─●─●──
              feature/x  └─●─●─●─┘ (days–weeks)

Trunk-based:  main ─●─●─●─●─●─●─●─●─●─  (deploy many times a day)
                    └●┘ └●┘  (branches live hours, incomplete work behind feature flags)
```
```js
if (flags.isEnabled('new-checkout', user)) renderNewCheckout(); else renderOldCheckout();
```

### Blue/green vs canary deployments?
Blue/green runs two complete environments and switches all traffic at once, with instant rollback by switching back — simple but resource-heavy. Canary sends a small percentage of traffic to the new version, gradually increasing while monitoring metrics — limits blast radius and validates with real traffic, but requires traffic routing and observability.

```bash Blue/green with a Kubernetes Service selector
kubectl apply -f api-green.yaml                                       # deploy v2 as "green"
kubectl patch svc api -p '{"spec":{"selector":{"app":"api","color":"green"}}}'   # switch 100%
kubectl patch svc api -p '{"spec":{"selector":{"app":"api","color":"blue"}}}'    # instant rollback
```
```yaml Canary with NGINX Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"     # 10% of traffic to v2
```

### How do you design a secure CI/CD pipeline?
Least-privilege, short-lived credentials (OIDC instead of static keys), protected branches with required reviews and checks, pinned action/image versions, SAST/SCA/secret/image scanning gates, signed artifacts and provenance (SLSA), isolated runners, approval gates for production, and audit logs.

```yaml
permissions: { contents: read, id-token: write }        # least privilege token
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683   # pinned by SHA
      - uses: gitleaks/gitleaks-action@v2                                 # secret scanning
      - run: npm ci && npm audit --audit-level=high
      - uses: aws-actions/configure-aws-credentials@v4                     # OIDC, no stored keys
        with: { role-to-assume: arn:aws:iam::123456789012:role/ci, aws-region: eu-west-1 }
      - run: docker build -t $IMG . && trivy image --exit-code 1 $IMG && cosign sign --yes $IMG
```

# Scenario Questions

## Beginner

### You committed to `main` instead of a feature branch (not pushed yet). How do you move the commit?
```bash
git branch feature/login      # new branch keeps the commit
git reset --hard HEAD~1        # move main back one commit
git switch feature/login
```
If you already pushed, don't rewrite `main`. Revert the commit there, or ask the team first.

### You accidentally committed a `.env` file with an API key and pushed it. What do you do?
1. **Rotate the key immediately.** Assume it's compromised, because history is public and gets scraped by bots.
2. Remove it from history (`git filter-repo --path .env --invert-paths`) and force-push, in coordination with the team.
3. Add `.env` to `.gitignore`.
4. Turn on secret scanning or push protection, and a pre-commit hook (gitleaks).

```bash
# 1. Rotate the key at the provider FIRST
# 2. Purge it from history
pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push --force --all && git push --force --tags
# 3. Prevent a repeat
echo ".env" >> .gitignore
gitleaks protect --staged     # as a pre-commit hook
```

## Intermediate

### A bug appeared somewhere in the last 200 commits. How do you find the commit that introduced it, quickly?
`git bisect`: mark a known good and a known bad commit, and Git binary-searches, so 200 commits take about 8 steps. Automate it with `git bisect run npm test -- some.spec`.

```bash
git bisect start HEAD HEAD~200
git bisect run ./scripts/repro.sh    # exit 0 = good, 1 = bad, 125 = skip
# ~8 steps: "a1b2c3d is the first bad commit"
git bisect reset
```

### Your CI pipeline takes 40 minutes. How do you cut it down?
- Cache dependencies and build outputs, and use Docker layer caching.
- **Parallelise** test shards.
- Run only the tests affected by the change (Nx, Turborepo, path filters).
- Fail fast: lint and type-check first.
- Use bigger runners where they pay off.
- Split slow E2E tests into a separate nightly or merge-queue stage.

```yaml
jobs:
  test:
    strategy: { matrix: { shard: [1, 2, 3, 4] } }          # parallel shards
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }              # dependency cache
      - run: npm ci
      - run: npx jest --shard=${{ matrix.shard }}/4
      - run: npx nx affected -t test --base=origin/main     # only what changed
  docker:
    steps:
      - uses: docker/build-push-action@v6
        with: { cache-from: type=gha, cache-to: "type=gha,mode=max" }   # layer cache
```

## Advanced

### Long-lived feature branches cause painful merges every sprint. What process would you propose?
**Trunk-based development**: short-lived branches (under 1–2 days), small PRs, **feature flags** to hide incomplete work, a required CI status check and a merge queue, and continuous deploys with progressive rollout. Release branches only when needed.

```bash
git switch -c feat/coupon-api main        # lives < 2 days
git commit -m "feat: coupon API behind flag"   # dark-launched via a feature flag
gh pr create --fill && gh pr merge --squash --auto   # merge queue after green CI
```
```text Branch protection on main
✔ Require a pull request (1 approval)   ✔ Require status checks: ci/test
✔ Require branches to be up to date     ✔ Merge queue enabled
```

# Tricky Questions

## Beginner

### What's the difference between `git reset --soft`, `--mixed` and `--hard` HEAD~1?
All three move HEAD back one commit:
- `--soft` keeps the changes **staged**.
- `--mixed` (the default) keeps them in the working tree, **unstaged**.
- `--hard` **discards** them. You can recover them via `git reflog` for a while.

```bash
git reset --soft  HEAD~1   # commit undone, changes STAGED
git reset         HEAD~1   # (--mixed) changes in the working tree, unstaged
git reset --hard  HEAD~1   # changes gone (recoverable via reflog)
```

## Intermediate

### You ran `git reset --hard` and lost a commit. Is it gone?
Usually not. `git reflog` lists where HEAD has been, so you can `git reset --hard <sha>` or `git branch rescue <sha>`. Unreachable commits survive until garbage collection (about 30–90 days by default). Uncommitted work that was never staged is truly lost.

```bash
git reflog | head -5
git branch rescue HEAD@{1}
git log rescue --oneline -1
```

### `git revert` vs `git reset` on a shared branch: which one and why?
Use **revert**. It adds a new commit that undoes the change, so history stays intact for everyone. Reset rewrites history, so collaborators' branches diverge and a force-push can wipe their work. Note that reverting a merge commit needs `-m 1`, and re-merging the same branch later requires reverting the revert.

```bash
git revert --no-edit 7d3a9f1 && git push      # ✅ everyone pulls a normal commit
git reset --hard 7d3a9f1~1 && git push -f     # ❌ rewrites shared history
```
