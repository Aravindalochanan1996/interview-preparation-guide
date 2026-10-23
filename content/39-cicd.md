---
id: cicd
title: CI/CD Pipelines
short: CI/CD
category: DevOps & Cloud
order: 17.1
color: #2088ff
icon: CI
summary: Continuous integration and delivery end to end: pipeline design, GitHub Actions, GitLab CI, Jenkins, Azure DevOps, caching, artifacts, environments, secrets and OIDC, deployment strategies, GitOps and DORA metrics.
---

# Beginner

## CI, Continuous Delivery and Continuous Deployment

- **Continuous Integration (CI)**: every push or PR is automatically built, linted and tested, so integration problems show up within minutes.
- **Continuous Delivery**: every change that passes the pipeline is *releasable*. Production deploys are one click (or one approval) away.
- **Continuous Deployment**: every change that passes is deployed to production automatically.

```text Typical pipeline
push/PR ─▶ checkout ─▶ install (cached) ─▶ lint + type-check ─▶ unit tests ─▶ build artifact/image
        ─▶ security scans ─▶ integration tests ─▶ deploy staging ─▶ smoke/E2E ─▶ approve ─▶ deploy prod ─▶ verify / rollback
```

> [!TIP]
> **Build once, deploy many.** Build the artifact (for example a Docker image tagged with the commit SHA) one time, then promote *the same* artifact through environments. Never rebuild for production.

## Your First GitHub Actions Workflow

```yaml .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:                                  # cancel outdated runs on the same branch
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/
```
Key concepts: **workflow** (a YAML file) → **jobs** (run in parallel on runners by default) → **steps** (shell commands or reusable **actions**). **Triggers**: `push`, `pull_request`, `schedule`, `workflow_dispatch` (manual) and `release`.

## Pipeline Stages and Quality Gates

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [{ uses: actions/checkout@v4 }, { run: npm ci && npm run lint && npx tsc --noEmit }]
  unit:
    runs-on: ubuntu-latest
    steps: [{ uses: actions/checkout@v4 }, { run: npm ci && npm test }]
  build:
    needs: [lint, unit]                        # runs only if both pass
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t ghcr.io/acme/api:${{ github.sha }} .
```
Gates that commonly block merging: a successful build, tests, a coverage threshold, lint, SAST and dependency scanning, an approving review, and an up-to-date branch. Enforce them with **branch protection** "required status checks".

## Build Artifacts and Versioning

```yaml Build and push an image tagged with the commit SHA
- uses: docker/login-action@v3
  with: { registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}" }
- uses: docker/metadata-action@v5
  id: meta
  with:
    images: ghcr.io/acme/api
    tags: |
      type=sha
      type=semver,pattern={{version}}
- uses: docker/build-push-action@v6
  with: { push: true, tags: "${{ steps.meta.outputs.tags }}", cache-from: type=gha, cache-to: "type=gha,mode=max" }
```
```bash Semantic versioning from Conventional Commits
npx semantic-release        # feat: → minor, fix: → patch, "BREAKING CHANGE:" → major; tags + changelog + release
```

# Intermediate

## Caching, Matrix Builds and Parallel Tests

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [20, 22]
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "${{ matrix.node }}", cache: npm }
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: pw-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - run: npm ci
      - run: npx jest --shard=${{ matrix.shard }}/3
```
```yaml Run jobs only when relevant paths change
on:
  pull_request:
    paths: ['services/orders/**', '.github/workflows/orders.yml']
```

## Environments, Approvals and Deployments

```yaml .github/workflows/deploy.yml
on:
  push:
    branches: [main]
jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: ./deploy.sh staging ${{ github.sha }}
      - run: npx playwright test --grep @smoke
        env: { BASE_URL: https://staging.acme.dev }
  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production                       # protected: required reviewers, wait timer, branch rule
      url: https://acme.com
    steps:
      - run: ./deploy.sh production ${{ github.sha }}   # same image as staging
```

## Secrets and OIDC (No Long-Lived Cloud Keys)

```yaml
permissions:
  id-token: write          # allow requesting an OIDC token
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/gha-deploy
      aws-region: eu-west-1
  - run: aws ecs update-service --cluster prod --service api --force-new-deployment
```
```json IAM trust policy: only main of this repo may assume the role
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike": { "token.actions.githubusercontent.com:sub": "repo:acme/api:ref:refs/heads/main" }
  }
}
```
Rules: never echo secrets, mask derived values (`::add-mask::`), scope secrets to environments, give `GITHUB_TOKEN` minimal permissions, and don't expose secrets to workflows triggered by forks.

## GitLab CI, Jenkins and Azure DevOps

```yaml .gitlab-ci.yml
stages: [test, build, deploy]
default:
  image: node:22
  cache: { key: { files: [package-lock.json] }, paths: [.npm/] }
test:
  stage: test
  script: [npm ci --cache .npm, npm test]
  rules: [{ if: $CI_PIPELINE_SOURCE == "merge_request_event" }, { if: $CI_COMMIT_BRANCH == "main" }]
build:
  stage: build
  image: docker:27
  services: [docker:27-dind]
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
deploy_prod:
  stage: deploy
  environment: production
  when: manual
  script: [./deploy.sh $CI_COMMIT_SHA]
  rules: [{ if: $CI_COMMIT_BRANCH == "main" }]
```
```groovy Jenkinsfile (declarative)
pipeline {
  agent { docker { image 'maven:3.9-eclipse-temurin-21' } }
  options { timeout(time: 30, unit: 'MINUTES'); disableConcurrentBuilds() }
  stages {
    stage('Test')  { steps { sh 'mvn -B verify' } post { always { junit 'target/surefire-reports/*.xml' } } }
    stage('Build') { steps { sh 'docker build -t acme/api:${GIT_COMMIT} .' } }
    stage('Deploy') {
      when { branch 'main' }
      input { message 'Deploy to production?' }
      steps { withCredentials([string(credentialsId: 'kubeconfig', variable: 'KCFG')]) { sh './deploy.sh' } }
    }
  }
}
```
```yaml azure-pipelines.yml
trigger: [main]
pool: { vmImage: ubuntu-latest }
stages:
  - stage: Build
    jobs:
      - job: test
        steps:
          - task: NodeTool@0
            inputs: { versionSpec: '22.x' }
          - script: npm ci && npm test
  - stage: Prod
    dependsOn: Build
    jobs:
      - deployment: deploy
        environment: production            # approvals configured on the environment
        strategy: { runOnce: { deploy: { steps: [{ script: ./deploy.sh }] } } }
```

# Advanced

## Deployment Strategies

| Strategy | How | Rollback |
|---|---|---|
| Recreate | stop old, start new | redeploy old (downtime) |
| Rolling | replace instances gradually | roll back the deployment |
| Blue/green | two environments, switch traffic | switch back instantly |
| Canary | send a small % of traffic to the new version, watch metrics | shift traffic back |
| Feature flags | deploy dark, release by toggling | turn the flag off |

```yaml Argo Rollouts canary with automatic analysis
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: api }
spec:
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis:
            templates: [{ templateName: success-rate }]    # Prometheus query; fails → auto-rollback
        - setWeight: 50
        - pause: { duration: 10m }
```
```js Feature flag in code
if (await flags.isEnabled('new-checkout', { userId })) return newCheckout(req);
return legacyCheckout(req);
```

## GitOps with Argo CD

In **GitOps**, Git holds the desired state of each environment. An in-cluster agent (Argo CD, Flux) **pulls** and reconciles it. CI only builds images and updates manifests, so it never needs cluster credentials.

```yaml Argo CD Application
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: api-prod, namespace: argocd }
spec:
  project: default
  source: { repoURL: https://github.com/acme/deploy.git, path: apps/api/overlays/prod, targetRevision: main }
  destination: { server: https://kubernetes.default.svc, namespace: api }
  syncPolicy:
    automated: { prune: true, selfHeal: true }     # drift is reverted automatically
```
```yaml CI step that promotes an image by commit
- run: |
    cd deploy/apps/api/overlays/staging
    kustomize edit set image ghcr.io/acme/api=ghcr.io/acme/api:${{ github.sha }}
    git commit -am "deploy api ${{ github.sha }} to staging" && git push
```

## Pipeline Security and Supply Chain

```yaml
permissions: { contents: read }                         # least privilege by default
steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683   # pin third-party actions by SHA
  - uses: gitleaks/gitleaks-action@v2                    # secret scanning
  - uses: github/codeql-action/init@v3                   # SAST
    with: { languages: javascript }
  - uses: github/codeql-action/analyze@v3
  - run: npm audit --audit-level=high                    # dependency vulnerabilities
  - run: trivy image --exit-code 1 --severity CRITICAL ghcr.io/acme/api:${{ github.sha }}
  - run: syft ghcr.io/acme/api:${{ github.sha }} -o spdx-json > sbom.json   # SBOM
  - run: cosign sign --yes ghcr.io/acme/api@${{ steps.build.outputs.digest }}  # keyless signing (OIDC)
```
Also: protect `main` (reviews, required checks, signed commits), separate the build and deploy identities, use ephemeral runners, don't use `pull_request_target` with untrusted code checkout, and record provenance (SLSA).

## Reusable Workflows, Monorepos and DORA Metrics

```yaml .github/workflows/node-service.yml (reusable)
on:
  workflow_call:
    inputs:
      path: { type: string, required: true }
jobs:
  ci:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: "${{ inputs.path }}" } }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
```
```yaml Caller
jobs:
  orders:
    uses: ./.github/workflows/node-service.yml
    with: { path: services/orders }
```
```bash Monorepo: test only what changed
npx nx affected -t lint test build --base=origin/main
npx turbo run test --filter=...[origin/main]
```

| DORA metric | Elite benchmark |
|---|---|
| Deployment frequency | on demand, several per day |
| Lead time for changes | < 1 day |
| Change failure rate | 0–15% |
| Time to restore service | < 1 hour |

# Interview Questions

## Beginner

### What is the difference between CI, continuous delivery and continuous deployment?

CI automatically builds and tests every change. Continuous delivery keeps every passing change ready to release, with a manual production approval. Continuous deployment releases every passing change to production automatically.

```yaml
deploy-prod:
  environment: production   # with required reviewers → continuous delivery; without → continuous deployment
```

### What are the typical stages of a CI/CD pipeline?

Checkout, dependency install (cached), lint and static analysis, unit tests, build artifact or image, security scans, integration tests, deploy to staging, smoke/E2E tests, approval, deploy to production, post-deploy verification and rollback.

```yaml
jobs: { lint: …, test: { needs: lint }, build: { needs: test }, deploy: { needs: build } }
```

### What is a pipeline artifact and why "build once, deploy many"?

An artifact is the immutable build output (a JAR, a bundle, a Docker image by digest). Building it once and promoting the same artifact guarantees that what you tested is exactly what you deploy, with no rebuild drift.

```bash
docker build -t api:$GIT_SHA . && docker push registry/api:$GIT_SHA   # staging and prod both use $GIT_SHA
```

### How do you store secrets in CI/CD?

Use the platform's secret store, scoped per environment, or an external vault. Inject them at runtime as masked environment variables, never commit them, and prefer OIDC federation over long-lived cloud keys.

```yaml
env:
  STRIPE_KEY: ${{ secrets.STRIPE_KEY }}   # masked in logs
```

## Intermediate

### How do you speed up a slow pipeline?

Cache dependencies and Docker layers, run independent jobs in parallel, shard tests, run only affected projects or paths, use faster runners, avoid redundant steps (build once, share artifacts), and fail fast on cheap checks first.

```yaml
- uses: docker/build-push-action@v6
  with: { cache-from: type=gha, cache-to: "type=gha,mode=max" }
```

### What is OIDC in CI/CD and why use it?

The CI platform issues a short-lived signed token describing the job (repo, branch, environment). The cloud provider trusts that issuer and exchanges the token for temporary credentials limited by conditions. There are no static keys to leak or rotate.

```yaml
permissions: { id-token: write }
- uses: azure/login@v2
  with: { client-id: "${{ vars.AZURE_CLIENT_ID }}", tenant-id: "${{ vars.AZURE_TENANT_ID }}", subscription-id: "${{ vars.AZURE_SUB }}" }
```

### Blue/green vs canary vs rolling?

Rolling replaces instances gradually (cheap, and two versions run side by side briefly). Blue/green keeps two full stacks and switches all traffic at once (instant rollback, double cost). Canary sends a small share of traffic to the new version and increases it while metrics stay healthy (limits the blast radius, needs good monitoring).

```bash
kubectl argo rollouts set image api api=ghcr.io/acme/api:v2 && kubectl argo rollouts get rollout api --watch
```

### How do you handle database migrations in a pipeline?

Run versioned migrations (Flyway, Liquibase, Alembic, Prisma) as a separate step or job before the new code goes live, and make them backward-compatible (expand, then contract) so the old and new versions both work during rollout. Never couple a destructive migration with a code change.

```yaml
- run: npx prisma migrate deploy      # idempotent, applies pending migrations
- run: ./deploy.sh ${{ github.sha }}
```

### What is GitOps?

Git holds the declarative desired state of each environment. A controller in the cluster (Argo CD, Flux) continuously pulls and reconciles it, reverting drift. Deploying means merging a PR, and rolling back means reverting a commit. The cluster pulls, so CI doesn't need cluster admin credentials.

```bash
argocd app sync api-prod && argocd app history api-prod
```

## Advanced

### How do you secure a CI/CD pipeline against supply-chain attacks?

Pin actions and images by digest, set least-privilege tokens per job, require reviews and checks on protected branches, run secret scanning, SAST and SCA, generate SBOMs, sign images and verify signatures at admission, use ephemeral isolated runners, use OIDC instead of static keys, and never run untrusted fork code with secrets.

```bash
cosign verify ghcr.io/acme/api@sha256:… --certificate-identity-regexp 'https://github.com/acme/.*' --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

### How would you design CI/CD for 50 microservices in a monorepo?

Use path- or graph-based change detection (Nx, Turborepo, Bazel) to build and test only affected services, reusable workflow templates per stack, a shared artifact registry with SHA-tagged images, per-service GitOps manifests, a merge queue to keep `main` green, and standard quality gates and observability for every service.

```yaml
strategy:
  matrix:
    service: ${{ fromJson(needs.changes.outputs.services) }}   # from a change-detection job
```

### What are DORA metrics and how do you improve them?

Deployment frequency, lead time for changes, change failure rate and time to restore. You improve them with small batches, trunk-based development, automated testing, feature flags, progressive delivery, fast rollback and good observability.

```sql
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY deployed_at - first_commit_at) FROM deployments WHERE env = 'prod';
```

# Scenario Questions

## Beginner

### The build passes locally but fails in CI. What do you check?

Check dependency versions (`npm ci` uses the lockfile), the Node/Java/Python version, environment variables and secrets, the OS and case sensitivity, timezone and locale, missing services (DB) in CI, and tests depending on local state. Reproduce with the same container image.

```bash
docker run --rm -v "$PWD:/w" -w /w node:22 bash -c "npm ci && npm test"
```

## Intermediate

### A bad deploy reached production and broke checkout. How do you recover, and prevent it next time?

Recover first: roll back to the previous image or revert the GitOps commit (minutes), or turn off the feature flag. Then add the missing test, a canary with automatic metric analysis, smoke tests after deploy, and alerts on business KPIs. Write a blameless postmortem.

```bash
kubectl rollout undo deployment/api        # or: git revert <sha> in the deploy repo → Argo CD syncs
```

### Your pipeline takes 45 minutes and developers bypass it. How do you fix it?

Measure each stage. Add caching (dependencies, Docker layers), split and parallelise jobs, shard tests, run only affected tests on PRs (full suite nightly), move slow E2E tests to a post-merge or scheduled pipeline, and use bigger runners. Make the fast checks blocking and keep them under 10 minutes.

```yaml
- run: npx jest --onlyChanged --shard=${{ matrix.shard }}/4
```

## Advanced

### A third-party GitHub Action you use was compromised. How do you limit the blast radius?

Pin every action by full commit SHA (not by tag), restrict `permissions` per job, avoid passing secrets to steps that don't need them, use OIDC with narrowly scoped roles, allowlist approved actions at the org level, and watch dependency alerts. Rotate any secrets the compromised action could have read.

```yaml
- uses: tj-actions/changed-files@<full-40-char-sha>   # immutable reference
permissions: { contents: read }
```

# Tricky Questions

## Beginner

### Is `npm install` or `npm ci` better in CI?

`npm ci`. It installs exactly what `package-lock.json` specifies, fails if the lockfile and `package.json` disagree, deletes `node_modules` first, and is faster and reproducible. `npm install` can update the lockfile.

```yaml
- run: npm ci
```

## Intermediate

### Why is rebuilding the Docker image for production (instead of promoting the staging one) risky?

A rebuild can pull different base image layers or dependency versions, so production runs something you never tested. Promote the exact digest that passed staging.

```bash
crane tag ghcr.io/acme/api@sha256:abc123 prod     # retag the same digest
```

## Advanced

### Why is `pull_request_target` dangerous?

It runs in the context of the base repository with write tokens and secrets, even for PRs from forks. If the workflow checks out and runs the PR's code, an attacker can steal secrets. Use `pull_request` for untrusted code, and keep `pull_request_target` for labelling or commenting without executing PR code.

```yaml
on: pull_request        # forks run without secrets
```
