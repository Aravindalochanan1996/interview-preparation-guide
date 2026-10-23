---
id: testing
title: Software Testing & QA
short: Testing & QA
category: Testing & Automation
order: 17.91
color: #15803d
icon: QA
summary: Testing fundamentals, SDLC/STLC, test design techniques, levels and types of testing, defect lifecycle, Agile QA, metrics and test strategy.
---

# Beginner

## Why Testing Matters and Core Terminology

Software testing is the process of **evaluating a system to find defects and verify it meets requirements**. Testing shows the *presence* of bugs, never their absence.

```js Error → defect → failure, in code
// Error: developer misreads "discount for orders over 100" as ">= 100"
function discount(total) { return total >= 100 ? total * 0.1 : 0; }   // defect (fault) in code
// Failure: observed when the defective line runs
test('no discount at exactly 100', () => expect(discount(100)).toBe(0)); // ❌ fails: got 10
```

### Key terms
| Term | Meaning |
|---|---|
| **Error (mistake)** | a human action producing an incorrect result (a developer misreads a requirement) |
| **Defect (bug, fault)** | a flaw in the code or document caused by the error |
| **Failure** | the observable deviation of the system from expected behaviour when the defect executes |
| **Verification** | "Are we building the product right?" — reviews, inspections, static checks against specs |
| **Validation** | "Are we building the right product?" — testing the running software against user needs |
| **QA (Quality Assurance)** | process-oriented: preventing defects (standards, reviews, process improvement) |
| **QC (Quality Control)** | product-oriented: detecting defects (executing tests) |

### The seven testing principles (ISTQB)
1. Testing shows the presence of defects, not their absence.
2. Exhaustive testing is impossible — prioritise with risk.
3. **Early testing** saves time and money (shift-left).
4. **Defects cluster** — a few modules contain most defects (Pareto).
5. **Pesticide paradox** — repeating the same tests stops finding new bugs; refresh them.
6. Testing is context-dependent (a banking app ≠ a game).
7. **Absence-of-errors fallacy** — bug-free software that doesn't meet user needs is still useless.

### Cost of defects
A defect found in requirements may cost 1×; in production it can cost 100× or more (rework, support, reputation). This is why reviews and early testing matter.

## SDLC, STLC and Where Testing Fits

```text V-model: each build phase has a matching test level
Requirements ─────────────────────── Acceptance tests   (UAT scripts)
   System design ────────────────── System tests        (E2E suites)
      Architecture ──────────────── Integration tests   (API + DB)
         Code ───────────────────── Unit tests          (Jest / JUnit / pytest)
```
```yaml Agile: testing runs in every pipeline stage
stages: [lint, unit, build, integration, deploy-staging, e2e-smoke, deploy-prod]
```

### SDLC models
- **Waterfall** — sequential phases; testing happens after development. Simple but late feedback.
- **V-Model** — each development phase has a matching test level (requirements ↔ acceptance, design ↔ system/integration, code ↔ unit). Test planning starts early.
- **Agile (Scrum/Kanban)** — iterative, testing within every sprint, whole-team quality.
- **DevOps** — continuous testing in CI/CD pipelines.

### STLC — Software Testing Life Cycle
1. **Requirement analysis** — understand testable requirements, clarify ambiguity, build an RTM.
2. **Test planning** — scope, approach, resources, schedule, risks, tools, entry/exit criteria.
3. **Test case design** — write test cases/scripts and prepare test data.
4. **Test environment setup** — servers, data, configurations, access.
5. **Test execution** — run tests, log results and defects, retest.
6. **Test closure** — reports, metrics, lessons learned, archive artefacts.

### Entry and exit criteria
- **Entry**: build deployed, smoke test passed, test data ready, test cases reviewed.
- **Exit**: planned tests executed, coverage met, no open critical/high defects, sign-off obtained.

### Requirement Traceability Matrix (RTM)
Maps each requirement to its test cases (and defects) — ensures **every requirement is tested** and shows the impact of requirement changes.

## Levels of Testing

| Level | What | Who | Example |
|---|---|---|---|
| **Unit** | smallest testable piece (function/class) in isolation | developers | `calculateTax()` returns correct value |
| **Integration** | interactions between components/services | developers/testers | API writes correctly to the database |
| **System** | the complete integrated system against requirements | QA team | full end-to-end checkout flow |
| **Acceptance (UAT)** | does it meet business needs? | users/business/PO | business users validate the invoice process |

```js
// Unit
test('calculateTax', () => expect(calculateTax(100, 'DE')).toBe(19));
// Integration (real DB via test container)
test('saves order', async () => { await repo.save(order); expect(await repo.find(order.id)).toMatchObject(order); });
// System / E2E (Playwright)
test('checkout', async ({ page }) => { await page.goto('/'); /* … */ await expect(page.getByText('Order confirmed')).toBeVisible(); });
// Acceptance (Gherkin)
// Given a logged-in customer  When they pay with a valid card  Then they see the confirmation
```

### Integration approaches
- **Big bang** — integrate everything at once (hard to localise defects).
- **Top-down** — test from top modules using **stubs** for lower ones.
- **Bottom-up** — test from low-level modules using **drivers** for higher ones.
- **Sandwich/hybrid** — both.

### Acceptance testing types
**Alpha** (internal users at the developer site), **beta** (real users in their environment), **contract/regulatory** acceptance, **operational** acceptance (backups, DR, maintainability).

## Types of Testing

```js
// Functional: does it do the right thing?
test('rejects expired coupon', async () => expect(await applyCoupon('OLD10')).toEqual({ error: 'expired' }));
// Non-functional: performance (k6)
// export const options = { thresholds: { http_req_duration: ['p(95)<300'] } };
// Non-functional: accessibility (axe + Playwright)
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```

### Functional vs non-functional
- **Functional** — *what* the system does: features, business rules, inputs/outputs.
- **Non-functional** — *how well*: performance, security, usability, accessibility, reliability, compatibility, scalability.

### Common types
| Type | Purpose |
|---|---|
| **Smoke** | shallow, wide check that a build is stable enough to test ("does it start, can I log in?") |
| **Sanity** | narrow, deep check that a specific fix/feature works after a small change |
| **Regression** | ensure existing functionality still works after changes |
| **Re-testing (confirmation)** | verify a specific defect is fixed |
| **Exploratory** | simultaneous learning, test design and execution, guided by charters |
| **Ad-hoc / monkey** | unstructured random testing |
| **Usability** | ease of use for real users |
| **Accessibility** | WCAG compliance, screen readers, keyboard navigation |
| **Compatibility** | browsers, devices, OS versions |
| **Localization / internationalization** | languages, date/number formats, RTL |
| **Performance** | speed, scalability, stability under load |
| **Security** | vulnerabilities, auth, data protection |
| **Recovery / failover** | system recovers from crashes and outages |

### Black-box, white-box, grey-box
- **Black-box** — tests from the outside based on requirements, no knowledge of code.
- **White-box** — tests based on internal code structure (statement/branch coverage).
- **Grey-box** — partial knowledge (e.g., knowing the DB schema while testing via UI/API).

### Static vs dynamic testing
**Static** — without executing code: reviews, walkthroughs, inspections, static analysis (SonarQube, linters). **Dynamic** — executing the software.

## Writing Good Test Cases

```gherkin Same test case as an executable scenario
Feature: Login
  Scenario: TC_LOGIN_003 Login fails with wrong password
    Given the user "asha@test.com" exists and is active
    When she logs in with password "Wrong@123"
    Then she sees the error "Invalid email or password"
    And she stays on the login page
```

### Anatomy of a test case
| Field | Example |
|---|---|
| ID | TC_LOGIN_003 |
| Title | Login fails with wrong password |
| Preconditions | user `asha@test.com` exists and is active |
| Test data | email: asha@test.com, password: Wrong@123 |
| Steps | 1. Open /login 2. Enter email 3. Enter password 4. Click Login |
| Expected result | error "Invalid email or password"; user stays on login page; no session created |
| Priority / severity | High |
| Requirement link | REQ-AUTH-02 |

### Characteristics of good test cases
Clear and atomic (one objective), independent, repeatable, traceable to requirements, with specific expected results, covering positive, negative and edge cases, and maintainable.

### Test scenario vs test case vs test script
- **Scenario** — a high-level "what to test" (Verify login functionality).
- **Case** — detailed steps, data and expected result.
- **Script** — automated implementation of a test case.

### Example: login feature coverage
Valid login · invalid password · unregistered email · empty fields · SQL/script injection in fields · password masking · case sensitivity · account lockout after N attempts · "remember me" · session timeout · password reset link · login on multiple devices · accessibility via keyboard.

# Intermediate

## Test Design Techniques

```js Boundary values + equivalence classes for "age 18–60"
test.each([
  [17, false], [18, true], [19, true],     // lower boundary
  [59, true], [60, true], [61, false],     // upper boundary
  [35, true],                              // valid partition representative
  ['abc', false], [null, false],           // invalid partitions
])('isEligible(%p) → %p', (age, expected) => expect(isEligible(age)).toBe(expected));
```
```text Decision table: free shipping
member? | total ≥ 50 | → free shipping
  Y     |    Y       |   Y
  Y     |    N       |   Y
  N     |    Y       |   Y
  N     |    N       |   N
```

### Equivalence Partitioning (EP)
Divide inputs into classes where all values should behave the same; test one value per class.
Age field accepts 18–60 → partitions: `< 18` (invalid), `18–60` (valid), `> 60` (invalid), non-numeric (invalid).

### Boundary Value Analysis (BVA)
Defects cluster at edges. For 18–60, test **17, 18, 19, 59, 60, 61** (3-value BVA) or 17, 18, 60, 61 (2-value).

### Decision Table Testing
For combinations of conditions → actions.

| Conditions / Rules | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| Valid user? | Y | Y | N | N |
| Valid password? | Y | N | Y | N |
| **Action** | Login | Error | Error | Error |

### State Transition Testing
For systems whose behaviour depends on state and events: an order goes `Created → Paid → Shipped → Delivered`, or `Paid → Refunded`. Test valid transitions and invalid ones (shipping an unpaid order). ATM PIN: 3 wrong attempts → card blocked.

### Use Case / Scenario Testing
Test end-to-end user flows, including the main success scenario and alternate/exception flows.

### Pairwise (all-pairs) testing
When many parameters combine (browser × OS × language × payment method), test every **pair** of values at least once — drastically fewer tests with high defect detection (tools: PICT, AllPairs).

### Experience-based techniques
**Error guessing** (common mistakes: nulls, zero, special characters, leap years, time zones), **exploratory testing** with charters and time boxes, checklist-based testing.

### White-box coverage
- **Statement coverage** — every line executed.
- **Branch/decision coverage** — every true/false outcome of each decision (stronger than statement).
- **Condition / MC/DC** — each condition independently affects the outcome (used in aviation/safety-critical).
- **Path coverage** — every path (often infeasible).

## Defect Lifecycle and Reporting

```markdown Bug report template
**Title:** Checkout total ignores coupon when cart has 10+ items
**Env:** staging build 2026.10.22-3, Chrome 130, Windows 11
**Steps:** 1. Add 10× SKU A1  2. Apply coupon SAVE10  3. Open checkout
**Expected:** total €90.00   **Actual:** total €100.00
**Severity:** High   **Priority:** P1   **Evidence:** screenshot.png, HAR file, request id 7f3a…
```

### Defect lifecycle
`New → Assigned → Open → Fixed → Ready for retest → Retest → Verified → Closed`
Alternative branches: `Rejected` (not a bug / works as designed), `Duplicate`, `Deferred` (fix later), `Reopened` (fix didn't work), `Cannot reproduce`.

### Severity vs priority
- **Severity** — technical impact on the system (set by QA): Critical, Major, Minor, Trivial.
- **Priority** — urgency of fixing (set by business/PO): P1–P4.

| Example | Severity | Priority |
|---|---|---|
| App crashes on checkout | High | High |
| Company logo misspelled on homepage | Low | **High** (brand) |
| Crash in a rarely-used admin export from a legacy screen | **High** | Low |
| Typo on an internal help page | Low | Low |

### A good bug report
Title (clear and specific) · environment (build, browser, OS, device) · preconditions · **steps to reproduce** · expected vs actual result · severity/priority · attachments (screenshots, video, logs, HAR files) · frequency (always/intermittent) · linked requirement/test case.

> [!TIP]
> Write bug titles as "[Area] What happens when what": `[Checkout] Order total ignores coupon when quantity > 10`.

### Root cause analysis
5 Whys, fishbone (Ishikawa) diagrams, defect categorisation (requirements, design, code, environment, data) to prevent recurrence.

## Agile Testing and the Test Pyramid

### Testing in Scrum
- QA participates in **backlog refinement** — clarifying acceptance criteria and testability.
- **Definition of Ready / Definition of Done** include testing (tests automated, regression passed).
- Testing happens **within the sprint**, not after it.
- **Three Amigos** (business, dev, QA) discuss a story before development.

### Acceptance criteria and BDD
Write criteria as **Given–When–Then** (Gherkin):
```gherkin
Feature: Coupon codes
  Scenario: Applying a valid percentage coupon
    Given a cart with items worth 1000 INR
    When I apply the coupon "SAVE10"
    Then the order total should be 900 INR
    And the coupon should show as "Applied"
```
Tools: Cucumber, SpecFlow/Reqnroll, Behave, pytest-bdd.

### Agile testing quadrants (Brian Marick)
Q1 technology-facing, supporting the team (unit/component tests) · Q2 business-facing, supporting the team (functional tests, examples, prototypes) · Q3 business-facing, critiquing the product (exploratory, usability, UAT) · Q4 technology-facing, critiquing the product (performance, security).

### The test pyramid
```text
          /\        E2E / UI tests        — few, slow, brittle, expensive
         /  \
        /----\      Integration / API      — more
       /      \
      /--------\    Unit tests             — many, fast, cheap
```
Avoid the **ice-cream cone** anti-pattern (mostly manual and UI tests). Variants: the **testing trophy** (emphasis on integration tests, plus static analysis at the base).

## Test Planning, Estimation and Risk-Based Testing

```text Risk matrix → effort
Feature            Likelihood  Impact  Risk  Testing depth
Payments              High      High    9    full regression + exploratory + security
Login / SSO           Med       High    6    automated suite + negative cases
Order history         Low       Med     2    smoke only
Theme switcher        Low       Low     1    skip this release
```

### Test plan contents (IEEE 829-inspired)
Scope (in/out) · test objectives · approach and test types · environments and tools · test data · roles and responsibilities · schedule and milestones · entry/exit/suspension criteria · deliverables · risks and mitigations.

### Test strategy vs test plan
**Strategy** — organisation/project-wide approach (levels, types, automation goals, tools, standards). **Plan** — specific to a release/project: what, when, who.

### Estimation techniques
Work Breakdown Structure, three-point (PERT: `(O + 4M + P) / 6`), function points, experience/analogy, Wideband Delphi / planning poker.

### Risk-based testing
Risk = **likelihood × impact**. Prioritise testing effort on high-risk areas: payment, security, frequently changed code, complex logic, new technology, areas with history of defects. Low-risk areas get lighter coverage.

### Test data management
Synthetic data generation, masked/anonymised production data (never raw PII), data refresh strategies, data per test isolation, test data builders/factories.

# Advanced

## Non-Functional Testing: Performance and Security

```js load-test.js (k6)
import http from 'k6/http';
import { check } from 'k6';
export const options = {
  stages: [{ duration: '2m', target: 200 }, { duration: '5m', target: 200 }, { duration: '1m', target: 0 }],
  thresholds: { http_req_duration: ['p(95)<300'], http_req_failed: ['rate<0.01'] },
};
export default function () {
  const r = http.get('https://staging.shop.example.com/api/products');
  check(r, { 'status 200': (res) => res.status === 200 });
}
```
```bash
k6 run load-test.js
docker run -t ghcr.io/zaproxy/zaproxy zap-baseline.py -t https://staging.shop.example.com   # passive security scan
```

### Performance testing types
| Type | Question |
|---|---|
| **Load** | does it meet SLAs under expected load? |
| **Stress** | where does it break, and how does it fail/recover? |
| **Spike** | sudden traffic surges (flash sale) |
| **Endurance / soak** | memory leaks, degradation over hours/days |
| **Scalability** | does adding resources increase capacity linearly? |
| **Volume** | large data volumes in the DB |

**Key metrics**: response time (avg, **p90/p95/p99**), throughput (RPS/TPS), error rate, concurrent users, CPU/memory/DB utilisation, saturation points. Tools: **JMeter, k6, Gatling, Locust, LoadRunner, NeoLoad**.

Process: define SLAs and workload model (realistic user journeys, think time, ramp-up) → production-like environment → baseline → run tests → analyse bottlenecks with APM (Dynatrace, New Relic, Grafana) → tune → re-test.

### Security testing
- **SAST** (static code analysis), **DAST** (testing running app: OWASP ZAP, Burp Suite), **IAST**, **SCA** (dependency vulnerabilities), penetration testing.
- Checklist: OWASP Top 10 — injection, broken auth/access control (IDOR), XSS, CSRF, security misconfiguration, sensitive data exposure, SSRF.
- Test authorization by trying to access other users' resources, privilege escalation, tampering with IDs/prices in requests.

## Test Metrics and Quality Reporting

| Metric | Formula / meaning |
|---|---|
| Test execution rate | executed ÷ planned |
| Pass rate | passed ÷ executed |
| Requirement coverage | requirements with tests ÷ total requirements |
| **Defect density** | defects ÷ size (KLOC or function points) |
| **Defect leakage** | defects found in production ÷ total defects — measures test effectiveness |
| **Defect removal efficiency (DRE)** | defects found before release ÷ (before + after) × 100 |
| Defect rejection ratio | rejected defects ÷ reported — quality of bug reports |
| Mean time to detect / repair | speed of feedback and fixes |
| Automation coverage | automated tests ÷ total regression tests |
| Flaky test rate | tests with nondeterministic results |

> [!WARN]
> Metrics can be gamed (e.g., code coverage at 90% with no meaningful assertions). Use them for insight, not as targets alone. Mutation testing measures whether tests actually catch bugs.

```js
const metrics = {
  passRate: passed / executed,                         // 0.96
  defectLeakage: prodDefects / (prodDefects + preReleaseDefects),   // 0.08
  defectRemovalEfficiency: preReleaseDefects / (preReleaseDefects + prodDefects),
  requirementCoverage: reqsWithTests / totalReqs,
};
```
```sql Defects by severity per release
SELECT release, severity, COUNT(*) FROM defects GROUP BY release, severity ORDER BY release;
```

### Mutation testing
Tools introduce small changes ("mutants") into code (e.g., `>` → `>=`); if tests still pass, the mutant "survived" → tests are weak. Tools: Stryker (JS/.NET), PIT (Java), mutmut (Python).

## Shift-Left, Shift-Right and Continuous Testing

### Shift-left
Test earlier: requirement reviews, TDD, static analysis, unit and API tests in CI on every commit, contract testing, testing in PR environments.

### Shift-right
Test and learn in production safely: monitoring, synthetic monitoring, **canary releases**, feature flags, A/B testing, **chaos engineering** (Chaos Monkey, Gremlin, LitmusChaos), real-user monitoring, observability-driven testing.

### Continuous testing in CI/CD
```text
commit → lint + unit tests (minutes) → build → integration/API/contract tests → deploy to test env → smoke + E2E (parallel) → performance/security gates → deploy to prod → synthetic checks
```
Quality gates block promotion on failed tests, coverage drops, critical vulnerabilities or SonarQube quality gate failures.

### Testing microservices
Unit → component tests (service in isolation with mocks) → **consumer-driven contract tests (Pact)** → integration tests with real dependencies (Testcontainers) → a small number of E2E tests. Service virtualisation (WireMock, Mountebank) replaces unavailable dependencies.

### TDD and BDD
- **TDD**: Red (write failing test) → Green (minimal code) → Refactor. Improves design and gives fast feedback.
- **BDD**: collaboration on examples in business language (Gherkin) that become automated acceptance tests.
- **ATDD**: acceptance tests written before development with the business.

## QA Leadership: Strategy, Process and Interviews for Senior Roles

```yaml Quality gates in the pipeline
quality_gates:
  pull_request: [lint, unit (coverage ≥ 80% on changed lines), contract tests]
  merge_to_main: [integration, security scan (no critical), build image]
  staging: [e2e smoke (critical journeys), performance check p95 < 300ms, a11y scan]
  production: [canary 10% with error-rate SLO, synthetic monitoring]
```

### Building a test strategy for a new product
1. Understand business goals, users, risks and compliance needs.
2. Define quality attributes that matter (e.g., availability 99.9%, p95 < 300 ms, WCAG AA).
3. Choose the test mix per the pyramid; decide automation scope and tools.
4. Set up environments, test data management and CI integration.
5. Define defect workflow, metrics and reporting.
6. Plan non-functional testing (performance, security, accessibility).
7. Continuously review and improve (retrospectives, escaped-defect analysis).

### Handling common situations
- **Release deadline but critical bug open** — present risk with data (impact, workaround, affected users); the business decides; propose options (feature flag off, hotfix plan).
- **Developer rejects your bug** — reproduce with evidence, refer to requirements/acceptance criteria, discuss with PO if ambiguous.
- **Requirements unclear** — ask questions early, document assumptions, use examples.
- **Flaky tests** — quarantine, fix root causes (waits, data dependencies, order dependency), never ignore.
- **No time for full regression** — risk-based selection, impact analysis of changes, automated suite prioritisation.

### Standards and certifications
ISTQB (Foundation, Advanced Test Analyst / Technical Test Analyst / Test Manager, Agile Tester), ISO/IEC/IEEE 29119, IEEE 829, TMMi for test process maturity.

# Interview Questions

## Beginner

### What is the difference between verification and validation?
Verification checks that the product is built correctly according to specifications ("building the product right") — through reviews, walkthroughs and inspections, often without executing code. Validation checks that the product meets user needs ("building the right product") — by executing and testing the software.

```text
Verification (static, "built right")   → review the spec, code review, linting
  npx eslint src && npx tsc --noEmit
Validation (dynamic, "right product")  → run it with users/tests against real needs
  npx playwright test checkout.spec.ts ; UAT session with the business
```

### What is the difference between error, defect and failure?
An error is a human mistake. It can introduce a defect (a fault in code or documents). When the defective code executes, it may cause a failure — the system behaving differently from what is expected.

```python
# Error: dev assumes the list is never empty
def average(xs): return sum(xs) / len(xs)   # Defect
average([])                                  # Failure: ZeroDivisionError at runtime
```

### Smoke testing vs sanity testing?
Smoke testing is a broad, shallow check that a new build's critical functions work and it's stable enough for further testing. Sanity testing is a narrow, deeper check that a specific change or bug fix works correctly, usually without full regression.

```bash
npx playwright test --grep @smoke          # broad & shallow: app up, login, home, checkout page loads
npx playwright test tests/coupons.spec.ts  # sanity: narrow & deep on the area that was just fixed
```
```js
test('home page loads @smoke', async ({ page }) => { await page.goto('/'); await expect(page).toHaveTitle(/Shop/); });
```

### What is regression testing?
Re-running tests to ensure recent code changes haven't broken existing functionality. It's done after fixes, enhancements or configuration changes and is the prime candidate for automation.

```js Pin a fixed bug with a regression test
// BUG-1423: totals were off by one cent for 3 × €0.10
test('BUG-1423 rounding regression', () => {
  expect(cartTotal([{ price: 0.1, qty: 3 }])).toBe(0.3);
});
```
```bash
npm test                          # full regression on every merge
npx jest --onlyChanged            # fast feedback locally
```

### Severity vs priority?
Severity is the technical impact of a defect on the system; priority is how urgently it should be fixed from a business perspective. A misspelled company name on the homepage is low severity but high priority; a crash in a rarely used feature may be high severity but low priority.

```text
Bug                                         Severity   Priority
Logo misspelled on homepage                 Low        High   (brand impact)
Crash in yearly legacy export (1 user)      High       Low
Payment fails for all Visa cards            Critical   P0
```

### What are the levels of testing?
Unit testing (individual components), integration testing (interactions between components), system testing (the complete system against requirements) and acceptance testing (validation by users/business, e.g., UAT).

```python pytest example of unit vs integration
def test_unit_discount():                       # unit: pure function
    assert discount(200) == 20

def test_integration_order_saved(db_session):   # integration: real DB fixture
    order = OrderService(db_session).place(customer_id=1, total=200)
    assert db_session.get(Order, order.id).total == 200
```

### What is the STLC?
The Software Testing Life Cycle: requirement analysis, test planning, test case design, environment setup, test execution and test closure — each with entry and exit criteria.

```text
Requirement analysis → Test planning → Test case design → Env setup → Execution → Closure
   (RTM drafted)       (test plan)     (cases + data)    (staging +   (runs,      (report,
                                                          seed data)   defects)     lessons)
```

### Black-box vs white-box testing?
Black-box testing validates functionality from the outside using requirements, without code knowledge. White-box testing designs tests based on internal structure and logic, measuring coverage of statements, branches and paths.

```js
// Black-box: from the spec — "orders ≥ 100 get 10%"
test.each([[99, 0], [100, 10]])('discount(%i)', (t, d) => expect(discount(t)).toBe(d));

// White-box: from the code — cover both branches of the if
function shipping(total, member) { if (member || total >= 50) return 0; return 4.99; }
test('member branch', () => expect(shipping(10, true)).toBe(0));
test('threshold branch', () => expect(shipping(60, false)).toBe(0));
test('paid branch', () => expect(shipping(10, false)).toBe(4.99));
```

## Intermediate

### Explain equivalence partitioning and boundary value analysis with an example.
For a field accepting ages 18–60, equivalence partitioning divides inputs into classes — below 18, 18–60, above 60, non-numeric — and tests one value from each. Boundary value analysis tests the edges where defects are common: 17, 18, 19, 59, 60, 61.

```python
import pytest
@pytest.mark.parametrize("age,ok", [
    (17, False), (18, True), (60, True), (61, False),   # boundaries
    (35, True), (-5, False), ("x", False),              # one value per partition
])
def test_age(age, ok):
    assert is_valid_age(age) is ok
```

### Describe the defect life cycle.
New → Assigned → Open → Fixed → Ready for retest → Verified → Closed. Defects can also be Rejected, marked Duplicate, Deferred, Not reproducible, or Reopened if retesting fails.

```text
New ─▶ Assigned ─▶ Open ─▶ Fixed ─▶ Ready for retest ─▶ Retest ─▶ Verified ─▶ Closed
 │                    │                                   │
 ├─▶ Rejected         ├─▶ Deferred                        └─▶ Reopened ─▶ Assigned
 └─▶ Duplicate        └─▶ Not reproducible
```

### What makes a good bug report?
A clear, specific title; environment details; preconditions; numbered steps to reproduce; expected vs actual results; severity and priority; evidence like screenshots, videos and logs; and frequency of occurrence. It should let a developer reproduce the issue without further questions.

```markdown
**Title:** [Checkout] 500 error when address line 2 contains an emoji
**Build/Env:** 2026.10.22-3 · staging · Firefox 131 · macOS 15
**Preconditions:** logged in as qa+7@test.com, 1 item in cart
**Steps:** 1. Checkout 2. Address line 2 = "Flat 3 🏠" 3. Click Pay
**Expected:** order placed · **Actual:** "Something went wrong" (HTTP 500)
**Evidence:** HAR, screenshot, request-id 9b21…, server log excerpt
**Severity:** Major · **Priority:** P2 · **Frequency:** 5/5
```

### What is a Requirement Traceability Matrix?
A document mapping requirements to test cases (and defects). It ensures every requirement is covered, helps assess the impact of requirement changes, and provides coverage evidence for audits and sign-off.

```text
Req ID   Requirement                    Test cases               Defects     Status
REQ-12   Login with email + password    TC-101, TC-102, TC-103   BUG-55      Pass
REQ-13   Lock account after 5 failures  TC-110                   —           Pass
REQ-14   Password reset by email        TC-120, TC-121           BUG-61(open) Fail
```

### What is the test pyramid?
A model recommending many fast, cheap unit tests at the base, fewer integration/API tests in the middle and a small number of slow, brittle UI/E2E tests on top — giving fast feedback and maintainable automation.

```text
          ▲  E2E (≈10)        Playwright: critical journeys only
         ▲▲▲ API/contract (≈100)  SuperTest, Pact
       ▲▲▲▲▲▲ Unit (≈1000)      Jest / pytest / JUnit: fast, isolated
```
```json package.json
{ "scripts": { "test:unit": "jest", "test:api": "jest -c jest.api.config.js", "test:e2e": "playwright test" } }
```

### How do you test when requirements are unclear or missing?
Ask stakeholders clarifying questions, review similar features and competitor products, use exploratory testing, write down assumptions and get them confirmed, base tests on user workflows, and collaborate with developers and the product owner via Three Amigos sessions.

```markdown Assumptions log, shared with the PO for sign-off
| # | Assumption                                   | Confirmed by | Date       |
|---|----------------------------------------------|--------------|------------|
| 1 | Coupons can't be combined                    | PO (Ravi)    | 2026-10-20 |
| 2 | Max 99 units per line item                   | pending      |            |
```

### What is exploratory testing and when is it useful?
Simultaneous learning, test design and execution, guided by a charter and time box rather than scripts. It's valuable for new features, unclear requirements, finding unexpected defects and complementing automated regression.

```markdown Session charter
**Charter:** Explore coupon application with unusual carts to discover pricing errors
**Time box:** 60 min · **Tester:** Asha · **Build:** 2026.10.22-3
**Ideas:** 0-price items, max qty, currency switch mid-checkout, back button after applying
**Notes / Bugs found:** BUG-1501 coupon re-applied after back navigation
```

### What is risk-based testing?
Prioritising test effort based on risk = probability of failure × business impact. High-risk areas (payments, security, complex or frequently changed code) get deeper and earlier testing, while low-risk areas get lighter coverage.

```js Pick the suite by risk tag
// playwright.config: grep by tags
test('pay with saved card @risk-high @payments', async ({ page }) => { /* … */ });
test('change avatar @risk-low', async ({ page }) => { /* … */ });
```
```bash
npx playwright test --grep "@risk-high"     # when time is short
```

## Advanced

### How would you design a test strategy for a new e-commerce platform?
Identify critical business flows (search, cart, checkout, payments) and risks; define quality goals (performance SLAs, availability, accessibility, security compliance like PCI DSS); apply the test pyramid with unit, API/contract and focused E2E tests in CI; plan performance tests for peak sales, security testing, cross-browser/device coverage, test data management with masked data, monitoring and canary releases in production, and metrics like defect leakage to improve continuously.

```yaml test-strategy.yml (summary)
critical_flows: [search, product page, cart, checkout, payment, order email]
quality_goals: { p95_latency_ms: 300, availability: 99.9, wcag: AA }
layers:
  unit: business rules (pricing, tax, stock)  — Jest, ≥80% on domain
  api: every endpoint + negative cases        — SuperTest + Pact with payment provider
  e2e: 12 critical journeys × 3 browsers      — Playwright
  non_functional: [k6 load before sales, OWASP ZAP, axe a11y]
environments: [ephemeral per PR, staging with anonymised data]
exit_criteria: { critical_open_bugs: 0, high_open_bugs: "<= 2 with workaround" }
```

### How do you measure the effectiveness of testing?
Defect leakage and defect removal efficiency (production vs pre-release defects), requirement and risk coverage, escaped defect severity, mean time to detect, mutation score of automated tests, flaky test rate, and trends over releases. Combine metrics with qualitative analysis of escaped defects.

```sql
-- Defect leakage per release
SELECT release,
       SUM(CASE WHEN found_in = 'production' THEN 1 ELSE 0 END)::float / COUNT(*) AS leakage
FROM defects GROUP BY release;
```
```bash
npx stryker run          # mutation score: do tests actually catch injected bugs?
```

### Load vs stress vs soak testing?
Load testing verifies performance under expected peak load against SLAs. Stress testing pushes beyond capacity to find breaking points and observe failure and recovery behaviour. Soak (endurance) testing runs a sustained load for hours or days to reveal memory leaks, resource exhaustion and degradation.

```js k6 scenarios
export const options = {
  scenarios: {
    load:   { executor: 'constant-vus', vus: 200, duration: '10m' },                       // expected peak
    stress: { executor: 'ramping-vus', stages: [{ duration: '10m', target: 2000 }], startTime: '10m' }, // find the breaking point
    soak:   { executor: 'constant-vus', vus: 150, duration: '8h', startTime: '20m' },      // leaks over time
  },
};
```

### What is contract testing and why is it useful for microservices?
Consumer-driven contract testing (e.g., Pact) captures the expectations each consumer has of a provider's API as a contract. Providers verify against those contracts in CI. It catches breaking API changes early without slow, fragile end-to-end environments.

```js Consumer test (Pact)
const provider = new PactV3({ consumer: 'web', provider: 'orders-api' });
provider
  .given('order 42 exists')
  .uponReceiving('get order 42')
  .withRequest({ method: 'GET', path: '/orders/42' })
  .willRespondWith({ status: 200, body: { id: 42, total: MatchersV3.decimal(19.99) } });
await provider.executeTest(async (mock) => {
  const order = await new OrdersClient(mock.url).get(42);
  expect(order.id).toBe(42);
});
// The provider's CI replays this contract against the real service
```

### How do you handle flaky tests?
Track and quarantine them so they don't block pipelines, then fix root causes: replace sleeps with explicit waits, isolate test data, remove order dependencies, stabilise environments, mock unreliable external services, and fix real race conditions in the product. Monitor flakiness rates over time.

```js
// ❌ flaky
await page.click('#save'); await page.waitForTimeout(2000); expect(await page.textContent('.toast')).toBe('Saved');
// ✅ wait on the condition
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByRole('status')).toHaveText('Saved');
test.fixme('known flaky: tracked in QA-311', async () => { /* quarantined */ });
```

### Shift-left vs shift-right testing?
Shift-left moves testing earlier — requirement reviews, TDD, static analysis, unit and API tests in CI — to find defects when they're cheapest to fix. Shift-right tests in production safely — monitoring, canary releases, feature flags, A/B tests and chaos engineering — to learn from real usage and improve resilience. Mature teams do both.

```yaml
# Shift-left: pre-commit + PR checks
- run: npx eslint . && npx tsc --noEmit && npm test
# Shift-right: production checks
- name: synthetic check every 5 min
  run: npx playwright test --grep @synthetic --config=prod.config.ts
```
```js Feature flag + canary metrics
if (flags.enabled('new-search', user)) return newSearch(q);   // watch error rate for 5% of users
```

# Scenario Questions

## Beginner

### The release is tomorrow and you only have time to test 20% of the features. How do you choose?
Use **risk-based testing**. Prioritise by business impact (payments, login, checkout), by likelihood of failure (recently changed code, complex areas, past bug hotspots) and by usage analytics. Run the smoke and critical-path tests first, then the regression tests around the changes. Tell stakeholders exactly what wasn't covered, so the residual risk is known.

```bash
git diff --stat v2.3.0..release/2.4.0 | sort -k3 -rn | head    # what changed most
npx playwright test --grep "@risk-high|@smoke"                  # critical + changed areas first
```

### A developer says "works on my machine" about a bug you found. How do you handle it?
Make the bug **reproducible and objective**: exact steps, test data, environment (browser, OS, build number, feature flags), expected versus actual result, screenshots or video, console and network logs, and a request ID. Compare environments (config, data, versions). Pair with the developer for a few minutes; it's faster than going back and forth on a ticket.

```bash Capture objective evidence
npx playwright test checkout.spec.ts --trace on      # trace.zip with DOM, network, console
curl -s https://staging.shop.example.com/version     # exact build
docker run --rm -e TZ=Asia/Kolkata myapp npm test    # reproduce env differences (timezone, locale)
```

## Intermediate

### Production bugs keep escaping even though test coverage is 85%. What would you change?
Coverage shows which lines ran, not whether the behaviour was checked. Look at the escaped bugs to find **why** they escaped (missing edge cases, integration gaps, environment differences, bad test data). Then add tests at the right level (contract and integration tests), use mutation testing to check test strength, put exploratory sessions on risky features, and add production monitoring and canaries.

```js High coverage, weak test
test('applyDiscount', () => { applyDiscount(cart); });                 // runs code, asserts nothing
// Meaningful
test('applyDiscount caps at 50%', () => expect(applyDiscount({ total: 100, pct: 80 }).total).toBe(50));
```
```bash
npx stryker run   # mutation testing exposes assertion-free tests
```

## Advanced

### How would you set up a QA strategy for a team moving from monthly releases to daily deploys?
- **Shift left**: acceptance criteria and test cases in refinement, a definition of done that includes automated tests.
- A test pyramid in CI (unit, then API/contract, then a few E2E tests) gating every merge.
- Feature flags with canary or progressive rollout.
- Synthetic monitoring and alerting in production.
- Exploratory testing time for new features.
- Track quality metrics: escaped defects, change failure rate, MTTR.

```yaml
on: [pull_request]
jobs:
  quality:
    steps:
      - run: npm run lint && npm run test:unit -- --coverage
      - run: npm run test:contract
      - run: npm run test:e2e -- --grep @smoke --shard=${{ matrix.shard }}/4
# After deploy: canary + synthetic monitoring + automatic rollback on SLO breach
```

# Tricky Questions

## Beginner

### A login field accepts 6–12 characters. Which lengths do you test with boundary value analysis?
5, 6, 12 and 13 at minimum (just outside and on each boundary), often plus 7 and 11, and one mid-range value from the valid **equivalence partition** (say 9). Also test empty input, whitespace-only input and multi-byte characters.

```js
test.each([
  [5, false], [6, true], [7, true], [9, true], [11, true], [12, true], [13, false], [0, false],
])('username length %i valid=%p', (len, ok) => expect(isValidUsername('a'.repeat(len))).toBe(ok));
```

## Intermediate

### Severity vs priority: give an example of a high-severity, low-priority bug and of the reverse.
- **High severity, low priority**: the app crashes on a rarely used legacy report that one internal user runs once a year.
- **Low severity, high priority**: the company logo is misspelled on the home page the day before a big launch.

Severity is technical impact; priority is how urgently the business needs it fixed.

```text
High severity / low priority : NullPointerException in a yearly legacy export used by one admin
Low severity / high priority : CEO's name misspelled on the launch landing page the day before launch
```

### Is 100% test coverage proof that the code is bug-free?
No. It proves every line ran, not that the assertions are meaningful or that every input combination, integration, concurrency case or requirement was tested. A test with no assertions still adds coverage. Mutation testing measures whether the tests actually catch faults.

```js
function divide(a, b) { return a / b; }
test('divide', () => expect(divide(10, 2)).toBe(5));   // 100% line coverage
divide(1, 0);   // Infinity — untested input, still a bug for a "safe divide" requirement
```
