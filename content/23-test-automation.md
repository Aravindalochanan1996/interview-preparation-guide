---
id: test-automation
title: Test Automation & E2E Testing
short: Test Automation
category: Testing & Automation
order: 17.92
color: #16a34a
icon: TA
summary: Unit, API and end-to-end automation with Selenium, Playwright and Cypress, framework design (POM), BDD, CI integration, flaky tests and performance scripts.
---

# Beginner

## What to Automate (and What Not To)

Test automation uses code to execute tests, compare results and report — giving **fast, repeatable feedback**.

### Good candidates
- **Regression** suites run on every build.
- Smoke tests after each deployment.
- Data-driven tests (same flow, many inputs).
- API tests (fast and stable).
- Cross-browser checks of critical flows.
- Repetitive, high-risk, business-critical paths (login, checkout, payments).

### Poor candidates
- Features still changing daily.
- One-time tests.
- Usability/look-and-feel judgements, exploratory testing.
- Tests needing physical interaction (CAPTCHA, hardware) — mock or bypass in test environments instead.

### ROI thinking
Automation costs time to build and **maintain**. A test is worth automating when `runs × manual cost > build + maintenance cost`. Unstable, poorly designed UI suites have negative ROI.

### The automation landscape

| Layer | Tools |
|---|---|
| Unit | Jest/Vitest (JS), pytest/unittest (Python), JUnit 5/TestNG (Java), xUnit/NUnit (.NET) |
| API | Postman/Newman, REST Assured, SuperTest, requests + pytest, Karate, Playwright `request` |
| Web E2E | **Playwright**, **Cypress**, **Selenium WebDriver**, WebdriverIO |
| Mobile | Appium, Espresso (Android), XCUITest (iOS), Detox |
| BDD | Cucumber, SpecFlow/Reqnroll, Behave, pytest-bdd |
| Performance | k6, JMeter, Gatling, Locust |
| Visual | Percy, Applitools, Playwright screenshots |
| Contract | Pact |

## Unit Testing Fundamentals

### Arrange–Act–Assert
```js cart.test.js (Vitest/Jest)
import { describe, it, expect, vi } from 'vitest';
import { Cart } from './cart';

describe('Cart', () => {
  it('applies a 10% coupon', () => {
    // Arrange
    const cart = new Cart();
    cart.add({ sku: 'A', price: 500, qty: 2 });
    // Act
    cart.applyCoupon('SAVE10');
    // Assert
    expect(cart.total()).toBe(900);
  });

  it('calls the payment gateway once on checkout', async () => {
    const gateway = { charge: vi.fn().mockResolvedValue({ ok: true }) };
    const cart = new Cart(gateway);
    cart.add({ sku: 'A', price: 100, qty: 1 });
    await cart.checkout();
    expect(gateway.charge).toHaveBeenCalledWith(100);
  });
});
```

### FIRST properties of good unit tests
**F**ast, **I**ndependent (no order dependency), **R**epeatable (same result every time), **S**elf-validating (pass/fail, no manual check), **T**imely (written with the code).

### Test doubles
| Double | Purpose |
|---|---|
| **Dummy** | passed around but never used |
| **Stub** | returns canned answers |
| **Spy** | records how it was called |
| **Mock** | pre-programmed with expectations it verifies |
| **Fake** | working lightweight implementation (in-memory DB) |

### Java (JUnit 5 + Mockito) and Python (pytest) equivalents
```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
  @Mock PaymentGateway gateway;
  @InjectMocks OrderService service;

  @Test
  void chargesTotalOnCheckout() {
    when(gateway.charge(100)).thenReturn(true);
    assertTrue(service.checkout(new Order(100)));
    verify(gateway).charge(100);
  }
}
```
```python
def test_checkout_charges_total(mocker):
    gateway = mocker.Mock(); gateway.charge.return_value = True
    assert OrderService(gateway).checkout(Order(100))
    gateway.charge.assert_called_once_with(100)
```

## API Test Automation

APIs are the **sweet spot** of automation: fast, stable, close to business logic.

### What to verify
Status codes · response body and **schema** · headers (content type, caching, security) · error handling (400/401/403/404/422) · auth/authorization · boundary and invalid inputs · idempotency · pagination/filtering · response time.

```python test_users_api.py (pytest + requests)
import requests, pytest

BASE = "https://api.test.example.com"

@pytest.fixture
def token():
    r = requests.post(f"{BASE}/auth/token", data={"username": "qa@test.com", "password": "Test@123"})
    return r.json()["access_token"]

def test_create_user(token):
    r = requests.post(f"{BASE}/users", json={"email": "new@test.com", "name": "Asha"},
                      headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "new@test.com"
    assert "password" not in body

@pytest.mark.parametrize("payload", [{}, {"email": "bad"}, {"email": "a@b.com", "name": ""}])
def test_create_user_validation(token, payload):
    r = requests.post(f"{BASE}/users", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 422
```

```java REST Assured (Java)
given().baseUri(BASE).auth().oauth2(token).contentType(JSON)
  .body(Map.of("email", "new@test.com", "name", "Asha"))
.when().post("/users")
.then().statusCode(201).body("email", equalTo("new@test.com"))
  .body(matchesJsonSchemaInClasspath("user-schema.json"));
```

### Postman / Newman
Collections with environments, pre-request scripts (generate tokens), tests (`pm.test`, `pm.expect`), data files for iterations, and CI runs with `newman run collection.json -e qa.json`.

## End-to-End Testing Concepts

**End-to-end (E2E) tests** drive the real application through the UI like a user, across all layers (frontend, backend, DB, integrations), verifying complete business flows.

### Characteristics
- Highest confidence that the **whole system** works together.
- Slowest, most expensive and most **flaky** layer → keep them **few and focused on critical journeys**.
- Need stable environments and test data.

### Choosing critical journeys
Sign up / login · search → product → cart → checkout → payment → order confirmation · password reset · key admin workflows · anything revenue- or compliance-critical.

### Locator strategy (most to least robust)
1. **User-facing attributes**: role + accessible name (`getByRole('button', { name: 'Checkout' })`), label, placeholder, text.
2. **Dedicated test ids**: `data-testid="checkout-btn"` (stable contract between devs and QA).
3. CSS selectors on stable attributes.
4. ❌ Avoid absolute XPath (`/html/body/div[3]/div[2]/button`) and generated class names.

### Waiting
Never use fixed sleeps. Use **auto-waiting** (Playwright/Cypress) or **explicit waits** (Selenium `WebDriverWait`) for conditions: visible, enabled, network idle, specific response.

# Intermediate

## Playwright End to End

Playwright (Microsoft) automates Chromium, Firefox and WebKit with one API, with **auto-waiting**, web-first assertions, parallelism, tracing and network control. Supports TS/JS, Python, Java, .NET.

```bash
npm init playwright@latest
npx playwright test                 # run all tests (parallel, headless)
npx playwright test --ui            # interactive UI mode
npx playwright codegen https://demo.app   # record actions into code
npx playwright show-report
```

```ts tests/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('user can buy a product', async ({ page }) => {
    await page.getByPlaceholder('Search products').fill('headphones');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('link', { name: /Wireless Headphones/ }).click();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.getByRole('link', { name: 'Cart' }).click();
    await page.getByRole('button', { name: 'Checkout' }).click();
    await page.getByLabel('Card number').fill('4242 4242 4242 4242');
    await page.getByRole('button', { name: 'Pay now' }).click();

    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page).toHaveURL(/\/orders\/\w+/);
  });
});
```

```ts playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['junit', { outputFile: 'results.xml' }]],
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000', trace: 'on-first-retry', screenshot: 'only-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' }, dependencies: ['setup'] },
    { name: 'mobile', use: { ...devices['iPhone 15'], storageState: '.auth/user.json' }, dependencies: ['setup'] },
  ],
});
```

### Power features
- **Authentication once**: a setup project logs in and saves `storageState`; tests reuse the session.
- **Network mocking**: `await page.route('**/api/recommendations', r => r.fulfill({ json: [] }))`.
- **API testing** in the same framework: `request.post('/api/orders', { data })` — also to seed data before UI steps.
- **Fixtures** for reusable setup (`test.extend`).
- **Trace viewer** (timeline, DOM snapshots, network, console) for debugging CI failures.
- Visual comparisons: `await expect(page).toHaveScreenshot()`.
- Multi-tab, iframes, downloads, file uploads, geolocation, permissions.

## Cypress End to End

Cypress runs **inside the browser** alongside the app, giving fast, interactive debugging with time-travel snapshots.

```js cypress/e2e/login.cy.js
describe('Login', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/login').as('login');
    cy.visit('/login');
  });

  it('logs in with valid credentials', () => {
    cy.get('[data-testid=email]').type('qa@test.com');
    cy.get('[data-testid=password]').type('Test@123', { log: false });
    cy.contains('button', 'Sign in').click();
    cy.wait('@login').its('response.statusCode').should('eq', 200);
    cy.url().should('include', '/dashboard');
    cy.contains('h1', 'Welcome').should('be.visible');
  });

  it('shows an error on invalid password', () => {
    cy.intercept('POST', '/api/auth/login', { statusCode: 401, body: { error: 'Invalid credentials' } });
    cy.get('[data-testid=email]').type('qa@test.com');
    cy.get('[data-testid=password]').type('wrong');
    cy.contains('button', 'Sign in').click();
    cy.contains('Invalid credentials').should('be.visible');
  });
});

// cypress/support/commands.js — reusable login via API + session caching
Cypress.Commands.add('login', (email, password) => {
  cy.session([email], () => {
    cy.request('POST', '/api/auth/login', { email, password }).then(({ body }) => {
      window.localStorage.setItem('token', body.token);
    });
  });
});
```

- Commands are **queued and asynchronous** (not Promises — don't `await` them); retries assertions automatically.
- `cy.intercept` for stubbing/spying network calls; fixtures for test data.
- Component testing for React/Vue/Angular components.
- Limitations: historically single browser tab and same-origin restrictions (`cy.origin` helps), JS/TS only.

### Playwright vs Cypress vs Selenium

| | Playwright | Cypress | Selenium |
|---|---|---|---|
| Architecture | out-of-process via CDP/protocols | runs in the browser | WebDriver protocol (W3C) |
| Languages | JS/TS, Python, Java, .NET | JS/TS | Java, Python, C#, JS, Ruby… |
| Browsers | Chromium, Firefox, WebKit | Chromium family, Firefox, WebKit (experimental) | all major incl. Safari, legacy |
| Waiting | auto-wait | auto-retry | explicit waits needed |
| Parallelism | built in, free | via Cypress Cloud or plugins | Selenium Grid |
| Multi-tab/origin | ✅ | limited | ✅ |
| Best for | modern web apps, speed, reliability | dev-friendly frontend testing | broad language/browser support, enterprise legacy, mobile via Appium |

## Selenium WebDriver End to End

Selenium is the long-standing W3C-standard browser automation tool.

```java Java + Selenium 4 + TestNG
public class LoginTest {
  WebDriver driver;
  WebDriverWait wait;

  @BeforeMethod
  public void setUp() {
    driver = new ChromeDriver();                 // Selenium Manager downloads the driver automatically
    driver.manage().window().maximize();
    wait = new WebDriverWait(driver, Duration.ofSeconds(10));
  }

  @Test
  public void validLogin() {
    driver.get("https://demo.app/login");
    driver.findElement(By.id("email")).sendKeys("qa@test.com");
    driver.findElement(By.id("password")).sendKeys("Test@123");
    driver.findElement(By.cssSelector("button[type='submit']")).click();
    WebElement header = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("h1")));
    Assert.assertEquals(header.getText(), "Welcome");
  }

  @AfterMethod
  public void tearDown() { driver.quit(); }
}
```

```python Python + Selenium
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = webdriver.Chrome()
driver.get("https://demo.app/login")
driver.find_element(By.ID, "email").send_keys("qa@test.com")
driver.find_element(By.ID, "password").send_keys("Test@123")
driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
WebDriverWait(driver, 10).until(EC.url_contains("/dashboard"))
driver.quit()
```

### Locators
`By.id`, `name`, `className`, `tagName`, `linkText`, `partialLinkText`, `cssSelector`, `xpath`. Selenium 4 adds **relative locators** (`above`, `below`, `toLeftOf`, `near`).

### Waits
- **Implicit** — global polling for element presence (don't mix with explicit).
- **Explicit** — `WebDriverWait` + `ExpectedConditions` for a specific condition (preferred).
- **Fluent** — explicit with custom polling interval and ignored exceptions.
- `Thread.sleep` — avoid.

### Common exceptions
`NoSuchElementException` (wrong locator/not loaded), `StaleElementReferenceException` (DOM re-rendered — re-find the element), `ElementClickInterceptedException` (overlay — wait for it to disappear), `TimeoutException`, `ElementNotInteractableException`.

### Handling special elements
Dropdowns (`Select`), alerts (`driver.switchTo().alert()`), frames (`switchTo().frame()`), windows/tabs (`getWindowHandles()`), `Actions` for hover/drag-drop/keyboard, `JavascriptExecutor` for scrolling, file upload via `sendKeys(path)`.

### Selenium Grid
Distributes tests across machines/browsers in parallel (hub + nodes, or Docker images `selenium/standalone-chrome`); cloud grids: BrowserStack, Sauce Labs, LambdaTest.

## Framework Design: Page Object Model and Beyond

### Page Object Model (POM)
Each page/component is a class exposing **intent-revealing methods**; tests never touch locators directly → changes in UI require updates in one place.

```ts pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';
export class LoginPage {
  readonly email: Locator; readonly password: Locator; readonly submit: Locator;
  constructor(private page: Page) {
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
  }
  async goto() { await this.page.goto('/login'); }
  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
  async expectError(msg: string) { await expect(this.page.getByRole('alert')).toHaveText(msg); }
}
// test
test('invalid login', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login('qa@test.com', 'wrong');
  await login.expectError('Invalid email or password');
});
```

### A maintainable framework structure
```text
automation/
├── config/            env configs (qa, staging), browsers, timeouts
├── pages/             page objects / component objects
├── tests/             specs grouped by feature, tagged @smoke @regression
├── fixtures/          test data, factories, auth setup
├── api/               API clients for setup/teardown
├── utils/             helpers (dates, random data, logging)
├── reports/           Allure / HTML / JUnit output
└── ci/                pipeline definitions
```

### Framework types
Linear (record & playback) → modular → **data-driven** (inputs from CSV/Excel/JSON) → **keyword-driven** (actions as keywords: Robot Framework) → **hybrid** (common in enterprises) → **BDD** (Gherkin + step definitions).

### Design principles
- Tests are **independent**: own data, no reliance on previous tests.
- **Set up via API, verify via UI** — create users/orders through APIs to keep UI tests short.
- Clean up data or use unique data per run.
- Config through environment variables; secrets from the CI vault.
- Meaningful reporting (Allure) with screenshots, videos and traces on failure.
- Tagging for suites (`@smoke`, `@regression`, `@critical`).

# Advanced

## BDD Automation with Cucumber

```gherkin features/checkout.feature
@regression
Feature: Checkout
  Background:
    Given I am logged in as a "standard" customer

  Scenario Outline: Coupon discounts
    Given my cart contains items worth <subtotal>
    When I apply coupon "<code>"
    Then the total should be <total>

    Examples:
      | subtotal | code    | total |
      | 1000     | SAVE10  | 900   |
      | 1000     | FLAT200 | 800   |
      | 100      | FLAT200 | 100   |
```

```java Step definitions (Cucumber-JVM)
public class CheckoutSteps {
  private final CartPage cart;
  public CheckoutSteps(TestContext ctx) { this.cart = ctx.pages().cart(); }   // DI via PicoContainer

  @Given("my cart contains items worth {int}")
  public void cartWorth(int subtotal) { ctx.api().seedCart(subtotal); cart.open(); }

  @When("I apply coupon {string}")
  public void applyCoupon(String code) { cart.applyCoupon(code); }

  @Then("the total should be {int}")
  public void totalShouldBe(int total) { assertEquals(total, cart.total()); }
}
```

Best practices: write scenarios in **business language** (declarative "When I check out", not imperative "When I click #btn-3"), keep step definitions thin by delegating to page objects/services, share context through dependency injection, and avoid giant feature files.

## CI/CD Integration, Parallelism and Reporting

```yaml .github/workflows/e2e.yml
name: E2E
on: [pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix: { shard: [1, 2, 3, 4] }        # split suite across 4 machines
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: docker compose up -d && npx wait-on http://localhost:3000
      - run: npx playwright test --shard=${{ matrix.shard }}/4
        env: { BASE_URL: http://localhost:3000 }
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: report-${{ matrix.shard }}, path: playwright-report }
```

- Run **smoke** on every PR, **full regression** nightly or before release.
- Spin up ephemeral environments (Docker Compose, preview deployments) per PR.
- **Parallelise** and shard; keep the PR feedback loop under ~10–15 minutes.
- Publish JUnit XML for the CI UI, Allure/HTML reports, traces/videos as artifacts.
- Quality gates: block merge on failures; track flaky tests separately.
- Jenkins equivalent: `stage('E2E') { steps { sh 'npx playwright test' } post { always { junit 'results.xml' } } }`.

## Flaky Tests: Causes and Cures

| Cause | Cure |
|---|---|
| Fixed sleeps / timing assumptions | auto-waiting, explicit waits on conditions, waiting for specific network responses |
| Shared or leftover test data | unique data per test, API setup/cleanup, isolated DB per run |
| Test order dependency | make every test self-contained; run in random order to detect |
| Unstable locators | role/label/test-id locators |
| Animations and transitions | disable animations in test env, wait for stable state |
| Third-party services (payments, email) | mock/stub (route interception, WireMock), sandbox accounts |
| Environment instability | dedicated test envs, health checks before runs, containers |
| Real product race conditions | report as bugs — flakiness sometimes reveals real defects |
| Time zones, dates, locales | freeze time (`page.clock`, `cy.clock`), fixed locale |

Policy: detect via re-runs and dashboards, **quarantine** quickly, fix within an SLA, and never "just add retries" without investigating.

## Advanced Topics: Visual, Accessibility, Mobile and Performance Scripts

### Visual regression
Screenshot comparison against baselines (Playwright `toHaveScreenshot`, Percy, Applitools with AI diffs). Mask dynamic regions (dates, ads), fix viewport and fonts.

### Accessibility automation
```ts
import AxeBuilder from '@axe-core/playwright';
test('home page has no a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
```
Automated tools catch ~30–50% of issues; combine with manual keyboard and screen-reader testing.

### Mobile automation (Appium)
Appium uses the WebDriver protocol to drive native, hybrid and mobile web apps on Android (UiAutomator2) and iOS (XCUITest) with the same client libraries; run on real-device clouds (BrowserStack, Sauce Labs).

### Performance scripting with k6
```js load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = {
  stages: [{ duration: '2m', target: 100 }, { duration: '5m', target: 100 }, { duration: '1m', target: 0 }],
  thresholds: { http_req_duration: ['p(95)<300'], http_req_failed: ['rate<0.01'] },
};
export default function () {
  const res = http.get(`${__ENV.BASE_URL}/api/products?page=1`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```
Run `k6 run -e BASE_URL=https://staging.app load.js`; thresholds fail the CI job when SLAs are breached.

### AI in test automation
Self-healing locators, AI-generated test cases from requirements, LLM agents that explore apps (Playwright MCP), visual AI diffs. Treat generated tests as drafts: review assertions and keep them deterministic.

# Interview Questions

## Beginner

### What test cases should be automated?
Stable, repetitive, high-value tests: regression and smoke suites, data-driven flows, API tests, critical business journeys and cross-browser checks. Avoid automating rapidly changing features, one-off tests, usability judgements and exploratory testing.

### What is the Page Object Model?
A design pattern where each page or component is represented by a class that encapsulates its locators and exposes user-level actions. Tests call these methods instead of using locators directly, reducing duplication and making maintenance easier when the UI changes.

### Implicit vs explicit wait in Selenium?
An implicit wait sets a global timeout for finding elements. An explicit wait (`WebDriverWait` with `ExpectedConditions`) waits for a specific condition on a specific element, such as visibility or clickability. Explicit waits are preferred; mixing both can cause unpredictable delays.

### What is end-to-end testing?
Testing complete user journeys through the real application — UI, backend services, database and integrations — to verify the whole system works together as a user would experience it, e.g., search → add to cart → pay → order confirmation.

### Which locators are most reliable?
User-facing locators (role with accessible name, label, text) and dedicated `data-testid` attributes are most robust. IDs are good if stable. Avoid absolute XPath and auto-generated CSS classes that change with builds.

### What is the difference between a stub and a mock?
A stub provides predefined responses to calls so the test can proceed. A mock also has expectations about how it should be called and verifies those interactions (e.g., that `charge()` was called once with 100).

## Intermediate

### Playwright vs Cypress vs Selenium — how would you choose?
Playwright for modern web apps needing speed, reliability, multi-browser (including WebKit), multi-tab and multiple languages. Cypress for JS teams wanting an excellent interactive developer experience and component testing. Selenium for broad language and browser coverage, existing enterprise frameworks, Selenium Grid infrastructure, or mobile via Appium.

### How do you handle authentication in E2E tests efficiently?
Log in once via API or a setup step, save the session (Playwright `storageState`, Cypress `cy.session`) and reuse it across tests. Use dedicated test accounts per role, and test the login UI itself in only a few dedicated tests.

### How do you manage test data for automation?
Create data through APIs or database seeding before each test, use unique identifiers per run, clean up afterwards or use disposable environments, use factories/builders for readable data creation, and never depend on data created by another test.

### What is StaleElementReferenceException and how do you fix it?
It occurs when a previously found element is no longer attached to the DOM, usually because the page re-rendered. Re-locate the element after the change, wait for the update to finish, or use frameworks with lazy locators (Playwright Locators) that re-query automatically.

### How do you run tests in parallel?
Make tests independent with isolated data, then use the runner's parallelism (Playwright workers/sharding, TestNG parallel suites, pytest-xdist), Selenium Grid or cloud grids, and CI matrix sharding. Avoid shared state like static WebDriver instances (use ThreadLocal in Java).

### What is data-driven testing?
Running the same test logic with multiple input sets supplied from external sources (CSV, Excel, JSON, database) or parameterisation (`@DataProvider`, `pytest.mark.parametrize`, Scenario Outline examples), increasing coverage without duplicating code.

### How do you test APIs automatically?
Send requests with a client (REST Assured, requests, SuperTest, Postman/Newman), assert status codes, body fields, schemas, headers and response times, cover negative and authorization cases, chain calls for workflows, and run them in CI against test environments.

## Advanced

### How would you design a test automation framework from scratch?
Choose tools matching the team's language and app (e.g., Playwright + TypeScript), structure it with page/component objects, API clients for setup, fixtures for data and auth, environment configs, tagging for suites, rich reporting (traces, screenshots, Allure), CI integration with parallel sharding and quality gates, coding standards and code review — and keep it aligned with the test pyramid.

### How do you deal with flaky tests in CI?
Detect them via reruns and flakiness dashboards, quarantine to keep pipelines trustworthy, then fix root causes: remove sleeps, wait on conditions, isolate data, stub third-party dependencies, freeze time, stabilise environments, or fix real race conditions in the app. Track flakiness as a metric with an SLA for fixes.

### How do you keep E2E suites fast?
Keep only critical journeys at the E2E layer, push other checks down to API/unit tests, set up state via APIs, reuse authenticated sessions, mock non-essential third parties, run in parallel with sharding, run smoke on PRs and full regression nightly, and remove redundant tests.

### How do you integrate automation into a CI/CD pipeline?
Run unit and API tests on every commit, deploy to an ephemeral or test environment, run smoke/E2E tests in parallel, publish JUnit/HTML reports and failure artifacts, enforce quality gates on merges and promotions, schedule full regression and performance runs, and notify the team on failures.

### What is the role of contract testing versus E2E testing?
Contract tests verify that each service meets the API expectations of its consumers in isolation and quickly, catching integration breaks early. E2E tests verify complete user flows across the deployed system. Contract tests reduce how many slow E2E tests you need, but a few E2E tests still validate the critical journeys.

### How would you automate a flow involving an OTP or email verification?
In test environments use a test mode or fixed OTP, retrieve the OTP from a test inbox API (Mailosaur, MailHog) or a test-only backend endpoint, or seed verified users via API. Never try to bypass production security; CAPTCHAs should be disabled or use test keys in non-production environments.

# Scenario Questions

## Beginner

### A Selenium test fails randomly with "element not found" and passes on rerun. How do you make it stable?
That's a **timing** problem. Replace `Thread.sleep` with **explicit waits** for a condition (`ExpectedConditions.elementToBeClickable`), or move to Playwright, whose auto-waiting locators handle this. Use stable selectors (`data-testid`, roles) instead of brittle XPath, and wait for app signals (network idle, a spinner gone) rather than fixed time.

## Intermediate

### Your E2E suite takes 90 minutes, so developers ignore it. How do you fix it?
- **Parallelise** with Playwright workers or a Selenium Grid, and shard across CI machines.
- Move most checks down to API and component tests, keeping E2E for critical journeys.
- Set up test data via the API instead of the UI, and reuse logged-in state (`storageState`).
- Delete or merge redundant tests.
- Run a smoke subset on PRs and the full suite nightly or in the merge queue.

### Tests pass locally but fail in CI. What differences do you check?
- Headless versus headed browser, viewport size, timezone and locale.
- Different data or environment variables, and missing secrets.
- Slower CI machines exposing timing bugs.
- Test order dependency and shared state when running in parallel.
- Browser and driver versions.

Collect traces, screenshots and videos in CI (the Playwright trace viewer) to see what actually happened.

## Advanced

### Design a test automation framework for a product with web, mobile and API layers.
- **Layers**: test specs → page/screen objects or a screenplay layer → a core layer (drivers, API clients, config, data builders, reporting).
- Shared API clients for setup and verification.
- Environment config via env vars or files.
- Parallel-safe test data (unique per test).
- Tags for smoke and regression runs.
- CI integration with retries only for diagnosis.
- Rich reports (Allure or the Playwright HTML report).
- Contract tests between services.
- Clear ownership and code review for test code.

# Tricky Questions

## Intermediate

### Why is this Playwright assertion flaky, and what's the fix? `expect(await page.locator('.count').textContent()).toBe('3')`
It reads the text **once**, possibly before the UI updates. Use the web-first assertion `await expect(page.locator('.count')).toHaveText('3')`, which retries until the timeout.

### Is it OK to add automatic retries to fix flaky tests?
Retries hide the symptom, and a flaky test might be a real race condition in the product. Use retries only to **collect evidence** (traces on the first retry), track flaky tests and quarantine them with an owner and a deadline, then fix the root cause (waits, test isolation, test data).

### Should E2E tests share one logged-in user and one database record?
No. Shared state makes tests **order-dependent** and breaks parallel runs. Give each test its own data (created through the API, with unique ids), isolated browser contexts, and cleanup or disposable environments. Reuse only immutable setup such as an auth `storageState` per worker.
