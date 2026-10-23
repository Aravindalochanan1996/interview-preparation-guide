---
id: playwright
title: Playwright
short: Playwright
category: Testing & Automation
order: 17.926
color: #2ead33
icon: Pw
summary: Reliable end-to-end testing with Playwright: locators, auto-waiting and web-first assertions, fixtures, page objects, authentication, network mocking, API testing, visual and accessibility checks, tracing, parallelism and CI.
---

# Beginner

## Setup and Your First Test

**Playwright** automates Chromium, Firefox and WebKit with one API (TypeScript/JS, Python, Java, .NET). Its test runner, `@playwright/test`, gives you parallel workers, auto-waiting, web-first assertions, fixtures, tracing, retries and HTML reports.

```bash
npm init playwright@latest          # config, example tests, browsers, optional GitHub Actions workflow
npx playwright test                 # run headless in all configured projects
npx playwright test --ui            # interactive UI mode (watch, time-travel)
npx playwright test --headed --project=chromium tests/login.spec.ts
npx playwright show-report
npx playwright codegen https://demo.playwright.dev/todomvc   # record actions → code
```
```ts tests/todo.spec.ts
import { test, expect } from '@playwright/test';

test('adds a todo', async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
  await page.getByPlaceholder('What needs to be done?').fill('Write tests');
  await page.getByPlaceholder('What needs to be done?').press('Enter');
  await expect(page.getByTestId('todo-title')).toHaveText(['Write tests']);
  await expect(page.getByText('1 item left')).toBeVisible();
});
```

## Locators

Locators are lazy and strict (they fail if they match more than one element) and re-resolve on every action. Prefer **user-facing** locators.

```ts
page.getByRole('button', { name: 'Add to cart' });       // best: role + accessible name
page.getByRole('link', { name: /pricing/i });
page.getByLabel('Email address');
page.getByPlaceholder('Search');
page.getByText('Order confirmed', { exact: true });
page.getByAltText('Company logo');
page.getByTestId('cart-count');                           // data-testid (configurable attribute)
page.locator('css=.product-card').filter({ hasText: 'Blue Runner' }).getByRole('button', { name: 'Buy' });
page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'INV-901' }) });
page.getByRole('listitem').nth(2);  page.getByRole('listitem').first();
page.frameLocator('#payment-iframe').getByLabel('Card number');
```

## Actions and Auto-Waiting

Before every action, Playwright waits until the element is **attached, visible, stable, enabled and receiving events**. You don't need sleeps.

```ts
await page.getByLabel('Email').fill('ada@x.io');
await page.getByLabel('Country').selectOption('DE');
await page.getByLabel('I agree').check();
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByRole('textbox').press('Control+A');
await page.getByText('Drag me').dragTo(page.getByText('Drop here'));
await page.getByLabel('Upload').setInputFiles('fixtures/invoice.pdf');
await page.getByRole('button', { name: 'More' }).hover();

const downloadPromise = page.waitForEvent('download');
await page.getByRole('link', { name: 'Export CSV' }).click();
await (await downloadPromise).saveAs('out/orders.csv');
```

## Web-First Assertions

`expect(locator)` assertions **retry** until they pass or time out (5 s by default). That's what makes tests stable.

```ts
await expect(page).toHaveURL(/\/dashboard/);
await expect(page).toHaveTitle('Dashboard · Acme');
await expect(page.getByRole('alert')).toHaveText('Saved');
await expect(page.getByRole('listitem')).toHaveCount(3);
await expect(page.getByRole('button', { name: 'Pay' })).toBeEnabled();
await expect(page.getByLabel('Email')).toHaveValue('ada@x.io');
await expect(page.getByTestId('status')).toHaveAttribute('data-state', 'ready');
await expect(page.getByText('Loading')).toBeHidden();
await expect.soft(page.getByText('Promo')).toBeVisible();     // soft: keep going, report at the end
await expect.poll(async () => (await api.get('/jobs/1')).status, { timeout: 30_000 }).toBe('done');
```

# Intermediate

## Configuration and Projects

```ts playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html', { open: 'never' }], ['junit', { outputFile: 'results.xml' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' }, dependencies: ['setup'] },
    { name: 'webkit',   use: { ...devices['Desktop Safari'], storageState: '.auth/user.json' }, dependencies: ['setup'] },
    { name: 'mobile',   use: { ...devices['Pixel 7'], storageState: '.auth/user.json' }, dependencies: ['setup'] },
  ],
  webServer: { command: 'npm run start', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI },
});
```

## Authentication with storageState

Log in **once**, save cookies and localStorage, and reuse them in every test. That's faster and less flaky than logging in through the UI each time.

```ts tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
const authFile = '.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_USER!);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
```
```ts Different roles in one test
test('admin sees what the user submitted', async ({ browser }) => {
  const admin = await browser.newContext({ storageState: '.auth/admin.json' });
  const user = await browser.newContext({ storageState: '.auth/user.json' });
  // … drive both pages, then close the contexts
});
test.use({ storageState: { cookies: [], origins: [] } });   // logged-out tests in a file
```

## Page Object Model and Custom Fixtures

```ts pages/CheckoutPage.ts
import { type Page, type Locator, expect } from '@playwright/test';
export class CheckoutPage {
  readonly pay: Locator;
  constructor(private readonly page: Page) {
    this.pay = page.getByRole('button', { name: /pay/i });
  }
  async goto() { await this.page.goto('/checkout'); }
  async fillCard(n: string) {
    const frame = this.page.frameLocator('iframe[title="Secure card"]');
    await frame.getByLabel('Card number').fill(n);
  }
  async expectConfirmed() { await expect(this.page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible(); }
}
```
```ts fixtures.ts
import { test as base } from '@playwright/test';
type Fixtures = { checkout: CheckoutPage; product: { id: string } };
export const test = base.extend<Fixtures>({
  checkout: async ({ page }, use) => { await use(new CheckoutPage(page)); },
  product: async ({ request }, use) => {                           // API-created test data + cleanup
    const res = await request.post('/api/test/products', { data: { name: `P-${crypto.randomUUID()}`, price: 10 } });
    const product = await res.json();
    await use(product);
    await request.delete(`/api/test/products/${product.id}`);
  },
});
export { expect } from '@playwright/test';
```
```ts checkout.spec.ts
import { test } from './fixtures';
test('buy a product', async ({ page, checkout, product }) => {
  await page.goto(`/p/${product.id}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await checkout.goto();
  await checkout.fillCard('4242 4242 4242 4242');
  await checkout.pay.click();
  await checkout.expectConfirmed();
});
```

## Network Interception and Mocking

```ts
test('shows an empty state when there are no orders', async ({ page }) => {
  await page.route('**/api/orders', (route) => route.fulfill({ json: [] }));          // mock the response
  await page.goto('/orders');
  await expect(page.getByText('No orders yet')).toBeVisible();
});
test('handles server errors', async ({ page }) => {
  await page.route('**/api/orders', (route) => route.fulfill({ status: 500, body: 'boom' }));
  await page.goto('/orders');
  await expect(page.getByRole('alert')).toContainText('Something went wrong');
});
test('modify a real response', async ({ page }) => {
  await page.route('**/api/profile', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    await route.fulfill({ response: res, json: { ...json, plan: 'enterprise' } });
  });
});
await page.route('**/*.{png,jpg}', (route) => route.abort());                        // block images for speed
const resp = page.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
await page.getByRole('button', { name: 'Place order' }).click();
expect((await resp).status()).toBe(201);
```

# Advanced

## API Testing with the request Fixture

```ts tests/api/orders.spec.ts
test.describe('Orders API', () => {
  test('creates and fetches an order', async ({ request }) => {
    const created = await request.post('/api/orders', { data: { sku: 'A1', qty: 2 }, headers: { Authorization: `Bearer ${process.env.API_TOKEN}` } });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const fetched = await request.get(`/api/orders/${id}`);
    await expect(fetched).toBeOK();
    expect(await fetched.json()).toMatchObject({ id, sku: 'A1', qty: 2 });
  });
  test('validates input', async ({ request }) => {
    const res = await request.post('/api/orders', { data: { sku: 'A1', qty: 0 } });
    expect(res.status()).toBe(422);
  });
});
```

## Visual and Accessibility Testing

```ts
test('pricing page looks right', async ({ page }) => {
  await page.goto('/pricing');
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
  await expect(page).toHaveScreenshot('pricing.png', { fullPage: true, maxDiffPixelRatio: 0.01, mask: [page.getByTestId('live-clock')] });
});
// update baselines intentionally: npx playwright test --update-snapshots (run in the same OS/image as CI)
```
```ts Accessibility with axe
import AxeBuilder from '@axe-core/playwright';
test('checkout has no a11y violations', async ({ page }) => {
  await page.goto('/checkout');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
```

## Debugging Flaky Tests: Traces, UI Mode and Repeat

```bash
npx playwright test tests/cart.spec.ts --repeat-each=20 --workers=4   # reproduce flakiness
npx playwright test --debug                                           # inspector, step through
npx playwright show-trace test-results/cart-chromium-retry1/trace.zip # DOM snapshots, network, console per step
PWDEBUG=1 npx playwright test -g "applies coupon"
```
| Flaky symptom | Fix |
|---|---|
| element "not visible / detached" | use locators (not stored handles) and web-first assertions |
| read text too early | `await expect(locator).toHaveText()` instead of `textContent()` + `toBe` |
| depends on test order or shared user | API-created unique data per test, isolated contexts |
| animations and timing | `waitForResponse`, disable animations, avoid `waitForTimeout` |
| third-party scripts | `page.route` to stub them |

## Parallelism, Sharding and CI

```yaml .github/workflows/e2e.yml
jobs:
  e2e:
    runs-on: ubuntu-latest
    container: mcr.microsoft.com/playwright:v1.48.2-jammy      # browsers and deps preinstalled
    strategy:
      fail-fast: false
      matrix: { shard: [1, 2, 3, 4] }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright test --shard=${{ matrix.shard }}/4 --reporter=blob
        env:
          BASE_URL: https://staging.acme.dev
          E2E_USER: ${{ secrets.E2E_USER }}
          E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: "blob-${{ matrix.shard }}", path: blob-report }
  report:
    needs: e2e
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: { pattern: blob-*, merge-multiple: true, path: all-blob-reports }
      - run: npx playwright merge-reports --reporter html ./all-blob-reports
```
```ts Tags and grep
test('checkout @smoke @critical', async ({ page }) => { /* … */ });
// npx playwright test --grep @smoke     |  --grep-invert @slow
test.describe.configure({ mode: 'serial' });   // only when steps truly depend on each other
```

# Interview Questions

## Beginner

### What is Playwright and why choose it?

A cross-browser automation and testing framework from Microsoft. It covers Chromium, Firefox and WebKit, and has auto-waiting, web-first assertions, multi-tab, multi-origin and iframe support, network interception, API testing, tracing and parallel runs. It's fast and reliable, with first-class TypeScript support.

```bash
npx playwright test --project=webkit
```

### What are locators and why prefer getByRole?

Locators describe how to find elements and re-query them on each use, which avoids stale elements. `getByRole` with an accessible name matches how users and screen readers perceive the page, so tests survive CSS and markup refactors and encourage accessible UI.

```ts
await page.getByRole('button', { name: 'Checkout' }).click();
```

### What is auto-waiting?

Before an action, Playwright waits for actionability checks (attached, visible, stable, enabled, receives events), and web-first assertions retry until a condition is met. So you don't need explicit sleeps.

```ts
await page.getByRole('button', { name: 'Save' }).click();     // waits until clickable
await expect(page.getByText('Saved')).toBeVisible();          // retries up to the timeout
```

### How do you run tests on multiple browsers and devices?

Define `projects` in the config with `devices[...]` presets, then run them all or filter with `--project`.

```ts
projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }, { name: 'iphone', use: { ...devices['iPhone 15'] } }]
```

## Intermediate

### How do you avoid logging in through the UI in every test?

Use a setup project that logs in once and saves `storageState`. Then projects load that state. Use separate state files per role, and refresh them when tokens expire.

```ts
await page.context().storageState({ path: '.auth/user.json' });
// project: use: { storageState: '.auth/user.json' }, dependencies: ['setup']
```

### What are fixtures in Playwright Test?

Dependency-injected setup and teardown units (`page`, `context`, `request`, `browser`, plus custom ones defined with `test.extend`). They're created per test (or per worker), are lazy (only built when used), and clean up after `use()`.

```ts
export const test = base.extend<{ api: ApiClient }>({ api: async ({ request }, use) => { await use(new ApiClient(request)); } });
```

### How do you mock network requests?

`page.route(urlPattern, handler)` can `fulfill` a fake response, `abort` the request, `continue` with modifications, or `fetch` the real response and alter it. `waitForResponse` lets you assert on real calls.

```ts
await page.route('**/api/recommendations', (r) => r.fulfill({ json: [] }));
```

### Page Object Model in Playwright?

Classes that wrap a page or component's locators and actions, exposing intent-level methods to tests. They're often provided through custom fixtures. Keep assertions mostly in the tests, or in clearly named `expect*` methods.

```ts
await new LoginPage(page).login(user, pass);
```

### How do you test APIs with Playwright?

Use the `request` fixture (an `APIRequestContext`) with `baseURL` and headers from the config. Check the status, JSON and headers. It also works well for setting up test data before UI steps.

```ts
const r = await request.post('/api/users', { data: { email } }); await expect(r).toBeOK();
```

## Advanced

### How do you debug a test that fails only in CI?

Enable `trace: 'on-first-retry'` (or `retain-on-failure`), screenshots and videos, and download the artifacts to inspect with the trace viewer (DOM snapshots, network, console). Reproduce with the CI Docker image and the same viewport, locale and timezone, and use `--repeat-each` to expose races.

```bash
docker run --rm -v $PWD:/w -w /w mcr.microsoft.com/playwright:v1.48.2-jammy npx playwright test --repeat-each=10
```

### How do you scale a large Playwright suite?

Make tests independent (unique data, isolated contexts) with `fullyParallel` and workers, shard across CI machines and merge blob reports, tag critical journeys for PR runs (with the full suite nightly), set up state through APIs, mock third parties, and keep the E2E layer thin, pushing checks down to API and component tests.

```bash
npx playwright test --grep @critical --shard=1/6
```

### Playwright vs Cypress vs Selenium?

Playwright: multi-browser including WebKit, multi-tab and multi-origin, out-of-process, fast and parallel by default, multiple languages. Cypress: an in-browser runner with great DX and time-travel UI, historically weaker at multi-tab and origins, JS only. Selenium: the W3C WebDriver standard with the widest language and grid ecosystem, more manual waiting, a great fit for legacy and enterprise grids.

```ts
const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByText('Open docs').click()]);  // multi-tab
```

### How do you do visual regression testing reliably?

Use `toHaveScreenshot` with baselines generated in the same OS and browser image as CI. Disable animations, mask dynamic regions (dates, ads), set thresholds, use a fixed viewport and fonts, and review diffs in the HTML report. Update baselines only on intentional changes.

```ts
await expect(page).toHaveScreenshot({ mask: [page.locator('.timestamp')], animations: 'disabled' });
```

# Scenario Questions

## Beginner

### A test fails with "strict mode violation: locator resolved to 2 elements". How do you fix it?

The locator is ambiguous. Make it specific: add an accessible name, scope it within a parent (`filter({ hasText })`), use `exact: true`, or choose `first()`/`nth()` only when order is genuinely what you want to test.

```ts
page.getByRole('listitem').filter({ hasText: 'Blue Runner' }).getByRole('button', { name: 'Buy' });
```

## Intermediate

### Tests interfere with each other when run in parallel. What do you change?

They share data or state (one user account, a fixed product, a global setting). Create unique data per test through API fixtures, use per-worker accounts (worker-scoped fixtures with `workerIndex`), clean up after `use()`, and never depend on test order.

```ts
const email = `qa+${test.info().workerIndex}-${Date.now()}@test.com`;
```

### The app calls a slow third-party chat widget that makes E2E tests flaky. How do you handle it?

Block or stub it with `page.route`, so tests depend only on your system. Cover the real integration with a small number of dedicated contract or synthetic tests.

```ts
await page.route('https://widget.chatvendor.com/**', (r) => r.fulfill({ body: '' }));
```

## Advanced

### Design an E2E strategy for an e-commerce site deployed many times a day.

A small `@smoke` and `@critical` suite (search, cart, checkout, login) on every PR against an ephemeral environment. Shard the full cross-browser suite after merge or nightly. Create data through APIs, use storageState auth, mock third-party services, run visual and a11y checks on key pages, collect traces on retry, quarantine flaky tests with ownership, and run synthetic Playwright checks in production.

```bash
npx playwright test --grep @critical --project=chromium          # PR gate (< 10 min)
npx playwright test --grep @synthetic --config=prod.config.ts    # every 5 min in production
```

# Tricky Questions

## Beginner

### Why is `await page.waitForTimeout(3000)` a bad idea?

It's a fixed sleep. It's too long when the app is fast (a slow suite) and too short when it's slow (a flaky suite). Wait on conditions instead: web-first assertions, `waitForResponse`, `waitForURL`.

```ts
await expect(page.getByRole('status')).toHaveText('Ready');
```

## Intermediate

### What's the difference between `page.locator(...)` and `page.$(...)`?

`locator` is lazy, re-resolves on every use, auto-waits, and is strict about multiple matches. `$`/`$$` return an ElementHandle snapshot right away, without auto-waiting, and it can go stale after re-renders. Use locators.

```ts
const btn = page.getByRole('button', { name: 'Save' });   // ✅ locator
```

## Advanced

### Why can `expect(await locator.isVisible()).toBe(true)` be flaky while `await expect(locator).toBeVisible()` isn't?

`isVisible()` checks once, immediately, with no retry. `toBeVisible()` is a web-first assertion that retries until the timeout, so it tolerates normal rendering delays.

```ts
await expect(page.getByText('Welcome')).toBeVisible();
```
