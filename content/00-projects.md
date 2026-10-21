---
id: projects
title: End-to-End Projects
short: E2E Projects
category: Learning Paths & Projects
order: 0.5
color: #be185d
icon: ▶
summary: Hands-on capstones that join the tracks together — build, test, containerise, deploy and monitor real applications from first page to a cloud-native, AI-powered system.
---

# Beginner

## How to Use These Projects

Reading lessons builds knowledge; **building projects builds skill** — and gives you stories for interviews ("Tell me about something you built").

### The project loop
1. **Read the brief** and the architecture.
2. **Build milestone by milestone** — each milestone links to the tracks you need. Commit after each one.
3. **Test** it (unit → API → E2E) — every project has a testing milestone.
4. **Ship it** — deploy so it's live, add a README with screenshots and an architecture diagram.
5. **Reflect** — answer the "Interview talking points" in your own words.

### Progression
| Level | Project | Main tracks |
|---|---|---|
| Beginner | Portfolio website | HTML, CSS, JavaScript, Git |
| Beginner | Task manager SPA | React, TypeScript, testing |
| Beginner | Notes REST API | FastAPI or Node.js, SQL |
| Intermediate | Full-stack app with auth + Docker | React/Angular, Node/FastAPI/Spring, PostgreSQL, Docker |
| Intermediate | Test automation framework | Testing & QA, Test Automation, Git & CI/CD |
| Intermediate | Invoice processing bot | RPA |
| Advanced | Kubernetes / OpenShift deployment with GitOps | Docker, Kubernetes, OpenShift, Git & CI/CD |
| Advanced | Cloud infrastructure with Terraform | AWS / Azure / GCP, Terraform, Linux |
| Advanced | RAG AI assistant | GenAI, FastAPI, React, SQL (pgvector) |
| Advanced | System design capstone | System Design, Redis, Kafka, observability |

> [!TIP]
> Keep everything in one GitHub account with good READMEs. A live link + clean commits + tests is worth more in an interview than many unfinished repos.

## Project 1: Responsive Portfolio Website

**Goal**: a fast, accessible, responsive personal site deployed on the internet.
**Tracks**: HTML → CSS → JavaScript → Git.

### Milestones
1. **Structure (HTML)** — semantic layout: `header`, `nav`, `main` with sections (About, Skills, Projects, Contact), `footer`. One `h1`, logical headings, `alt` text on images.
2. **Style (CSS)** — CSS variables for colours/spacing, mobile-first layout, Flexbox for nav, Grid for project cards (`repeat(auto-fill, minmax(260px, 1fr))`), `clamp()` typography.
3. **Dark mode** — `prefers-color-scheme` + a toggle that sets `data-theme` and saves to `localStorage`.
4. **Interactivity (JS)** — mobile menu toggle with `aria-expanded`, smooth scroll, contact form with client-side validation and a "sent" message.
5. **Dynamic projects** — load projects from a `projects.json` with `fetch`, render cards, filter by technology tag.
6. **Quality** — Lighthouse ≥ 90 for Performance, Accessibility, Best Practices, SEO; keyboard-only navigation works; images sized and lazy-loaded.
7. **Ship** — Git repo with meaningful commits → deploy on GitHub Pages / Netlify / Vercel; custom domain optional.

```js projects.js
const res = await fetch('projects.json');
const projects = await res.json();
const grid = document.querySelector('#project-grid');
grid.innerHTML = '';
for (const p of projects) {
  const card = document.createElement('article');
  card.className = 'card';
  const h3 = document.createElement('h3');
  h3.textContent = p.title;                 // textContent, never innerHTML with data
  card.append(h3);
  grid.append(card);
}
```

### Interview talking points
How you made it accessible; how the layout responds without breakpoints; why `textContent` instead of `innerHTML`; your Lighthouse scores and what you fixed to get them.

## Project 2: Task Manager SPA (React + TypeScript)

**Goal**: a Trello-lite task app with filters, persistence and tests.
**Tracks**: JavaScript → TypeScript → React → Test Automation.

### Milestones
1. **Scaffold** — `npm create vite@latest tasks -- --template react-ts`; ESLint + Prettier.
2. **Model** — types: `type Task = { id: string; title: string; status: 'todo' | 'doing' | 'done'; due?: string }`.
3. **State** — `useReducer` with actions `added`, `moved`, `deleted`, `edited`; persist to `localStorage` via a custom `useLocalStorage` hook.
4. **Components** — `Board`, `Column`, `TaskCard`, `TaskForm` (controlled inputs, validation), search with `useDeferredValue`.
5. **Routing** — React Router: `/` board, `/tasks/:id` detail.
6. **Testing** — Vitest + React Testing Library for reducer and components (`getByRole`), one Playwright E2E test for "create → move → delete".
7. **Ship** — deploy to Vercel/Netlify/GitHub Pages; CI workflow running lint, type-check and tests on every PR.

```ts reducer.ts
type Action =
  | { type: 'added'; title: string }
  | { type: 'moved'; id: string; status: Task['status'] }
  | { type: 'deleted'; id: string };

export function tasksReducer(tasks: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'added':   return [...tasks, { id: crypto.randomUUID(), title: action.title, status: 'todo' }];
    case 'moved':   return tasks.map(t => t.id === action.id ? { ...t, status: action.status } : t);
    case 'deleted': return tasks.filter(t => t.id !== action.id);
  }
}
```

### Stretch goals
Drag and drop (dnd-kit), Zustand store, dark mode, PWA offline support.

### Interview talking points
Why `useReducer` over many `useState`s; discriminated unions for actions; how you avoided unnecessary re-renders; what you test with RTL vs Playwright.

## Project 3: Notes REST API

**Goal**: a documented, tested CRUD API with a real database.
**Tracks**: Python + FastAPI (or Node.js + Express) → SQL & Databases → Git.

### Milestones
1. **Project setup** — `uv init notes-api && uv add "fastapi[standard]" sqlalchemy alembic psycopg pydantic-settings`; or `npm init` + Express + Prisma.
2. **Data model** — `notes(id, title, body, tags, created_at, updated_at)`; Alembic/Prisma migration.
3. **Endpoints** — `GET /notes?search=&tag=&page=`, `GET /notes/{id}`, `POST /notes`, `PATCH /notes/{id}`, `DELETE /notes/{id}`; Pydantic/Zod validation; correct status codes (201, 204, 404, 422).
4. **Pagination & search** — limit/offset (then try keyset); `ILIKE` search; index on `created_at`.
5. **Errors & logging** — consistent error body, request-id middleware, structured logs.
6. **Tests** — pytest + httpx (or Vitest + SuperTest) against a test database; cover happy paths and validation errors.
7. **Docs & ship** — auto OpenAPI at `/docs`, README with curl examples; deploy to Render/Railway/Fly.io or Azure App Service.

```python app/routes/notes.py
@router.post("", response_model=NoteOut, status_code=201)
async def create_note(payload: NoteCreate, db: DB):
    note = Note(**payload.model_dump())
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note

@router.get("/{note_id}", response_model=NoteOut)
async def get_note(note_id: int, db: DB):
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(404, "Note not found")
    return note
```

### Interview talking points
PUT vs PATCH; how pagination works and its trade-offs; how you avoided SQL injection; how tests get an isolated database.

# Intermediate

## Project 4: Full-Stack App with Authentication and Docker

**Goal**: a production-shaped full-stack app — e.g., **"ExpenseTracker"**: users sign up, log in and track expenses with charts.
**Tracks**: React or Angular → Node.js/FastAPI/Spring Boot/.NET → SQL → Web/HTTP & Security → Docker.

### Architecture
```text
Browser (React/Angular SPA)
   │  HTTPS, JSON, HttpOnly refresh cookie + short-lived access token
   ▼
API (FastAPI | Express | Spring Boot | ASP.NET Core)
   ├── PostgreSQL (users, expenses, categories)
   └── Redis (rate limiting, caching dashboards)
All services run with Docker Compose locally.
```

### Milestones
1. **Database design** — `users`, `categories`, `expenses(user_id FK, amount NUMERIC, category_id, spent_on DATE)`; indexes on `(user_id, spent_on)`.
2. **Auth** — sign-up with password hashing (bcrypt/Argon2), login issuing a 15-minute access JWT + rotating refresh token in an `HttpOnly; Secure; SameSite=Strict` cookie, logout revoking the refresh token.
3. **Authorization** — every query filtered by the current user (prevent IDOR); admin role for category management.
4. **API** — CRUD for expenses, monthly summary endpoint using `GROUP BY date_trunc('month', spent_on)`, validation, ProblemDetails-style errors, rate limiting on login.
5. **Frontend** — login/register pages, protected routes, an HTTP interceptor that refreshes the token on 401, expense table with filters, charts (Recharts/Chart.js), optimistic updates via TanStack Query (or Angular signals + HttpClient).
6. **Docker** — multi-stage Dockerfiles for API and frontend (nginx serving the build), `compose.yaml` with Postgres (named volume, healthcheck), Redis and the API; `.env.example`.
7. **Testing** — unit tests for services, API integration tests with Testcontainers, 3–5 Playwright E2E journeys (sign up → add expense → see summary).
8. **CI** — GitHub Actions: lint, test, build images, push to GHCR on main.

```yaml compose.yaml (excerpt)
services:
  api:
    build: ./api
    env_file: .env
    depends_on: { db: { condition: service_healthy } }
    ports: ["8000:8000"]
  web:
    build: ./web
    ports: ["8080:80"]
  db:
    image: postgres:17
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: expenses }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U app"], interval: 5s, retries: 10 }
volumes: { pgdata: {} }
```

### Interview talking points
Why access + refresh tokens and where you store them; how you prevent IDOR; how the token-refresh interceptor avoids parallel refresh storms; image size before/after multi-stage builds; what your E2E tests cover and why only those.

## Project 5: Test Automation Framework

**Goal**: a professional automation framework for Project 4 (or a public demo app such as a sample e-commerce site) covering UI, API and performance — running in CI with reports.
**Tracks**: Testing & QA → Test Automation & E2E → Git & CI/CD.

### Milestones
1. **Test strategy** — one page: scope, risks, test pyramid split, environments, entry/exit criteria, tools.
2. **Framework skeleton** — Playwright + TypeScript (or Selenium + Java + TestNG, or pytest + Playwright): `pages/`, `tests/`, `fixtures/`, `api/`, `config/` with environment switching.
3. **Page Object Model** — `LoginPage`, `ExpensesPage`, component objects for tables and modals; role/label/test-id locators only.
4. **Auth setup** — log in once via API, store session state, reuse in all UI tests.
5. **UI E2E suite** — critical journeys tagged `@smoke` and `@regression`; data-driven tests for validation rules (boundary values from your test design).
6. **API suite** — schema validation, auth (401/403), negative cases, idempotency checks.
7. **Non-functional** — axe accessibility scan on key pages; a k6 load test with thresholds (`p(95)<300ms`).
8. **CI** — GitHub Actions matrix (Chromium/Firefox/WebKit, sharded), traces/videos on failure, HTML/Allure report published as an artifact, nightly regression schedule.
9. **Quality report** — a short README section with metrics: tests count, execution time, flaky rate, defects found.

```ts tests/expenses.spec.ts
test('@smoke user adds an expense and sees it in the monthly total', async ({ page, api }) => {
  await api.resetUserData();                         // fixture: clean state via API
  const expenses = new ExpensesPage(page);
  await expenses.goto();
  await expenses.add({ amount: '250.00', category: 'Food', date: '2026-10-01' });
  await expect(expenses.row('Food')).toContainText('250.00');
  await expect(expenses.monthlyTotal('October 2026')).toHaveText('₹250.00');
});
```

### Interview talking points
How you chose what to automate; your locator strategy; how you kept tests independent and parallel; how you handled flaky tests; how long the suite takes and how you'd keep it fast as it grows.

## Project 6: Invoice Processing Bot (RPA)

**Goal**: an unattended bot that reads invoices from email, extracts data, validates it and enters it into a target system, with human review of uncertain cases.
**Tracks**: RPA (UiPath or Power Automate) → Testing & QA.

### Milestones
1. **PDD** — document the manual process: steps, rules (PO must exist, amount ≤ PO balance), exceptions, volumes.
2. **Dispatcher** — read emails with attachments from a mailbox folder, save PDFs to a storage bucket, add one queue item per invoice (reference = invoice number to prevent duplicates).
3. **Performer (REFramework)** — Init (read Config, credentials from Orchestrator assets), Get Transaction (queue item), Process: extract fields with Document Understanding (or AI Builder), validate against a PO Excel/API, enter into the target app (a demo web form or ERP sandbox).
4. **Exceptions** — business exceptions (missing PO, amount mismatch) → notify AP team, no retry; system exceptions → retry with app restart.
5. **Human in the loop** — low-confidence extractions go to Action Center / an approval flow.
6. **Testing** — test cases for each rule and exception, including a corrupt PDF and a duplicate invoice.
7. **Reporting** — a daily summary email (processed, failed, average handling time) and an Orchestrator/Insights dashboard.

### Interview talking points
Business vs system exceptions; why dispatcher–performer; how you made selectors resilient; how you measured ROI (hours saved, accuracy).

# Advanced

## Project 7: Kubernetes / OpenShift Deployment with GitOps

**Goal**: take Project 4 to production-grade Kubernetes (or OpenShift): zero-downtime deploys, autoscaling, TLS, secrets, observability and GitOps.
**Tracks**: Docker → Kubernetes → OpenShift → Git & CI/CD → Linux.

### Milestones
1. **Cluster** — local kind/minikube or OpenShift Local; later a managed cluster (EKS/AKS/GKE/ROSA/ARO).
2. **Manifests** — Deployments with resource requests/limits, liveness/readiness/startup probes, Services, ConfigMaps, Secrets (External Secrets Operator or Sealed Secrets), PostgreSQL via an operator (CloudNativePG) or a managed DB.
3. **Ingress & TLS** — NGINX Ingress / Gateway API with cert-manager, or OpenShift **Routes** with edge TLS.
4. **Security** — non-root images (OpenShift `restricted-v2` compatible: group-writable dirs, port 8080), NetworkPolicies (default deny; web → api → db only), Pod Security restricted, image scanning in CI.
5. **Packaging** — a Helm chart (or Kustomize base + overlays for dev/prod).
6. **GitOps** — Argo CD (OpenShift GitOps) syncing a `deploy` repo; CI (GitHub Actions or Tekton) builds images and updates the image tag via PR.
7. **Scaling & resilience** — HPA on CPU/RPS, PodDisruptionBudget, anti-affinity across nodes, graceful shutdown with preStop.
8. **Observability** — Prometheus metrics endpoint + ServiceMonitor, Grafana dashboard (RED metrics: rate, errors, duration), logs to Loki, traces with OpenTelemetry; alert on SLO burn rate.
9. **Release strategies** — demonstrate a rolling update with zero errors under load (k6 running during deploy) and a canary with Argo Rollouts or Route weights.

```yaml deployment.yaml (excerpt)
spec:
  replicas: 3
  strategy: { rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } }
  template:
    spec:
      securityContext: { runAsNonRoot: true, seccompProfile: { type: RuntimeDefault } }
      containers:
        - name: api
          image: ghcr.io/you/expense-api:1.4.2
          ports: [{ containerPort: 8080 }]
          readinessProbe: { httpGet: { path: /readyz, port: 8080 }, periodSeconds: 5 }
          livenessProbe:  { httpGet: { path: /healthz, port: 8080 }, periodSeconds: 10 }
          resources: { requests: { cpu: 200m, memory: 256Mi }, limits: { memory: 512Mi } }
          lifecycle: { preStop: { exec: { command: ["sleep", "10"] } } }
          securityContext: { allowPrivilegeEscalation: false, capabilities: { drop: ["ALL"] } }
```

### Interview talking points
How a request flows from DNS to pod; why readiness ≠ liveness; how you achieved zero downtime; how GitOps differs from push-based CD; what you changed to run on OpenShift.

## Project 8: Cloud Infrastructure with Terraform

**Goal**: provision a secure, highly available environment for the app on AWS (or Azure/GCP) entirely as code, with CI/CD for infrastructure and cost awareness.
**Tracks**: AWS / Azure / GCP → Terraform → Linux → Git & CI/CD.

### Milestones (AWS flavour; map with the cross-cloud table in the GCP track)
1. **Bootstrap** — remote state (S3 + locking), separate dev/prod directories, OIDC role for GitHub Actions.
2. **Network module** — VPC across 2 AZs, public/private/data subnets, NAT Gateway, VPC endpoints for S3/ECR.
3. **Compute** — ECS Fargate service (or EKS) behind an ALB with ACM TLS; autoscaling on CPU and request count.
4. **Data** — RDS PostgreSQL Multi-AZ in data subnets, credentials in Secrets Manager, automated backups; ElastiCache Redis.
5. **Edge** — Route 53 record, CloudFront for the frontend from a private S3 bucket (Origin Access Control), WAF managed rules.
6. **Observability** — CloudWatch log groups, dashboards and alarms (5xx rate, latency p95, CPU, DB connections) to SNS email.
7. **Pipeline** — PR: `fmt`, `validate`, `tflint`, Checkov, Infracost comment, `plan` posted to the PR; merge: `apply` with manual approval for prod.
8. **Operate** — drift detection job, tagging for cost allocation, budget alerts, a DR runbook (restore DB snapshot to another region).

### Interview talking points
Why state is remote and locked; how modules and environments are structured; how secrets never touch Git; how the design survives an AZ failure; monthly cost estimate and how you'd reduce it.

## Project 9: RAG AI Assistant Over Your Documents

**Goal**: a chat assistant that answers questions about a set of documents (e.g., all the lessons in this app or your company's handbook) with citations, evaluations and guardrails.
**Tracks**: Generative AI & LLMs → AI/ML → FastAPI → React → SQL (pgvector) → Docker.

### Architecture
```text
Ingestion job: Markdown/PDF → parse → chunk (by headings, ~500 tokens, overlap) → embed → PostgreSQL + pgvector (+ metadata)
Query: React chat UI → FastAPI /chat (SSE streaming)
         → hybrid retrieval (pgvector cosine + full-text BM25) → re-rank → prompt with <documents> → LLM
         → stream answer with [doc-id] citations → UI renders sources
Evaluation: question set → retrieval recall@k + LLM-judge faithfulness → CI report
```

### Milestones
1. **Ingestion** — parser + structure-aware chunker; store `chunk_id, doc_title, section, url, text, embedding vector(1024)`; HNSW index.
2. **Retrieval** — vector search + keyword search merged with Reciprocal Rank Fusion; metadata filters.
3. **Generation** — system prompt that requires citations and "I don't know" when unsupported; streaming responses via Server-Sent Events.
4. **UI** — chat interface with streaming tokens, clickable citations, feedback buttons (👍/👎 stored for later evaluation).
5. **Tools (agentic stretch)** — add a tool (e.g., `search_lessons(topic, level)`) using function calling, or expose your retriever as an **MCP server** so any MCP client can use it.
6. **Evaluation** — 50 real questions with expected source chunks; measure recall@5, faithfulness and answer relevance; run in CI on prompt/model changes.
7. **Guardrails & cost** — input length limits, prompt-injection-resistant prompt structure (documents treated as data), rate limiting, prompt caching for the static system prompt, token/cost logging per request.
8. **Ship** — Docker Compose (API, DB, UI); deploy to a cloud container service.

```python retrieval.py
async def retrieve(q: str, k: int = 8) -> list[Chunk]:
    q_emb = await embed(q)
    vec = await db.fetch("""SELECT id, text, title, 1 - (embedding <=> $1) AS score
                            FROM chunks ORDER BY embedding <=> $1 LIMIT 20""", q_emb)
    kw = await db.fetch("""SELECT id, text, title, ts_rank(tsv, plainto_tsquery($1)) AS score
                           FROM chunks WHERE tsv @@ plainto_tsquery($1) ORDER BY score DESC LIMIT 20""", q)
    return rerank(q, reciprocal_rank_fusion(vec, kw))[:k]
```

### Interview talking points
Chunking choices and how you validated them; why hybrid search; how you measure hallucination; prompt-injection defences; latency and cost per answer and how you reduced them.

## Project 10: System Design Capstone — Scalable URL Shortener

**Goal**: implement and load-test the classic design, proving the trade-offs you talk about in system design interviews.
**Tracks**: System Design → SQL & Databases (Redis) → Node.js/Java/Go → Docker/Kubernetes → Test Automation (k6).

### Milestones
1. **Requirements & estimates** — write them down (100:1 read/write, p99 redirect < 50 ms).
2. **ID generation** — base62 encoding of a Snowflake-style ID (timestamp + worker + sequence); custom aliases with uniqueness checks.
3. **Storage** — PostgreSQL table `links(code PK, url, owner, created_at, expires_at)`.
4. **Cache** — Redis cache-aside for `code → url` with TTL and jitter; measure hit ratio.
5. **Redirect service** — 302 with `Cache-Control`; separate stateless read and write services.
6. **Analytics** — publish click events to Kafka/Redis Streams asynchronously; a consumer aggregates per-day counts; the redirect path never waits for analytics.
7. **Protection** — token-bucket rate limiting in Redis on the create endpoint; URL validation and blocklist.
8. **Load test** — k6 scenarios: 95% redirects, 5% creates; find the bottleneck, add replicas/caching, re-test; record before/after numbers.
9. **Observability** — RED metrics, cache hit ratio, Kafka consumer lag dashboards; alerts.

### Interview talking points
Concrete numbers: QPS achieved, p99 latency, cache hit ratio, what broke first under load and what fixed it; 301 vs 302; how you'd go multi-region.

# Interview Questions

## Beginner

### How should you present a personal project in an interview?
Use a short structure: the problem and who it's for, the architecture (draw it), your key technical decisions and why, a challenge you hit and how you solved it, how you tested and deployed it, and what you'd improve. Keep it to two or three minutes, then let the interviewer dig in.

### What makes a project portfolio strong for hiring managers?
Working live demos, clean READMEs with screenshots and architecture diagrams, readable commits, tests and CI, sensible security (no secrets committed), and depth in a few projects rather than many unfinished ones. Projects aligned with the target role's stack carry the most weight.

### How do you choose which project to build first?
Start with something small you can finish in a week that uses your target stack's fundamentals (e.g., a portfolio site or a CRUD API), then increase scope: add authentication, a database, tests, Docker and deployment step by step.

## Intermediate

### Walk me through how a request flows through your full-stack application.
Describe it end to end: DNS resolves the domain, the browser loads the SPA from a CDN/nginx, the SPA calls the API over HTTPS with an access token, the API middleware validates the token and authorizes the user, the service layer queries PostgreSQL (with indexes) and maybe Redis, returns JSON, and the UI updates state — then mention logging, error handling and how you'd trace it.

### How did you test your project, and why that mix?
Explain the pyramid: many unit tests for business logic, integration/API tests against a real database (Testcontainers) for endpoints and auth, and a handful of E2E tests for critical journeys, all run in CI. Justify it by speed, confidence and maintainability, and mention what you didn't automate.

### What was the hardest bug in your project?
Pick a real one, describe symptoms, how you investigated (logs, reproduction, narrowing down, tools), the root cause, the fix, and the test you added so it can't come back. Interviewers assess debugging method more than the bug itself.

## Advanced

### How would you scale your project to 100× users?
Identify the bottleneck with load tests and metrics first. Typical steps: stateless app instances behind a load balancer with autoscaling, a CDN for static assets, caching hot reads in Redis, read replicas and indexing for the database, queues for slow work, connection pooling, then partitioning or sharding only if data volume requires it — with observability and SLOs throughout.

### How did you make your deployment reliable and secure?
Multi-stage non-root images scanned in CI, secrets from a secret manager, least-privilege identities (OIDC for CI, roles for workloads), health probes, rolling or canary releases with automated rollback, network policies, TLS everywhere, backups with tested restores, and monitoring with alerts tied to user-facing SLOs.

### If you rebuilt your project today, what would you change?
Show reflection: choices that didn't scale or slowed you down (e.g., premature microservices, missing tests, weak data model), what you learned since, and concrete alternatives with trade-offs. This demonstrates growth and engineering judgement.
