---
id: jest
title: Jest (JavaScript Testing)
short: Jest
category: Testing & Automation
order: 17.925
color: #99425b
icon: Je
summary: Unit and integration testing for JavaScript/TypeScript with Jest: matchers, setup/teardown, mocks and spies, timers, async tests, snapshots, React Testing Library, API tests, coverage and CI.
---

# Beginner

## Getting Started with Jest

**Jest** is a JavaScript test runner with built-in assertions (`expect`), mocking, snapshot testing, coverage and watch mode. It works for Node, React, Angular (with presets) and TypeScript. **Vitest** has an almost identical API.

```bash
npm i -D jest @types/jest ts-jest
npx ts-jest config:init          # creates jest.config.js for TypeScript
```
```json package.json
{ "scripts": { "test": "jest", "test:watch": "jest --watch", "test:cov": "jest --coverage" } }
```
```ts src/math.ts
export const add = (a: number, b: number) => a + b;
export function divide(a: number, b: number) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}
```
```ts src/math.test.ts
import { add, divide } from './math';

describe('math', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
  it('throws on division by zero', () => {
    expect(() => divide(1, 0)).toThrow('Division by zero');
  });
});
```

## Matchers

```ts
expect(2 + 2).toBe(4);                                   // Object.is (primitives, same reference)
expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });   // deep equality
expect(user).toStrictEqual({ id: 1, name: 'Ada' });     // also checks undefined props and class types
expect(order).toMatchObject({ status: 'paid' });         // subset
expect(value).toBeNull(); expect(value).toBeDefined(); expect(flag).toBeTruthy();
expect(0.1 + 0.2).toBeCloseTo(0.3, 5);
expect(list).toHaveLength(3); expect(list).toContain('apple');
expect(users).toContainEqual({ id: 2, name: 'Bob' });
expect('hello world').toMatch(/world/);
expect(price).toBeGreaterThan(0);
expect(fn).toThrow(TypeError);
expect(obj).toHaveProperty('address.city', 'Berlin');
expect({ id: 'x', at: new Date() }).toEqual({ id: expect.any(String), at: expect.any(Date) });
expect(5).not.toBe(6);
```

## Setup, Teardown and Organising Tests

```ts
describe('CartService', () => {
  let cart: CartService;

  beforeAll(async () => { await db.connect(); });    // once per file / describe
  afterAll(async () => { await db.close(); });
  beforeEach(() => { cart = new CartService(); });   // fresh state for every test
  afterEach(() => { jest.clearAllMocks(); });

  it('starts empty', () => expect(cart.items).toEqual([]));

  describe('when adding items', () => {
    it('increases the total', () => {
      cart.add({ sku: 'A1', price: 10, qty: 2 });
      expect(cart.total).toBe(20);
    });
  });

  it.each([
    [1, 10, 10],
    [3, 10, 30],
    [0, 10, 0],
  ])('qty %i at %i costs %i', (qty, price, expected) => {
    cart.add({ sku: 'X', price, qty });
    expect(cart.total).toBe(expected);
  });

  it.todo('applies coupons');
  // it.only(...) / it.skip(...) for focusing while debugging — never commit .only
});
```

## Testing Async Code

```ts
it('resolves user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Ada');
});
it('resolves with matchers', async () => {
  await expect(fetchUser(1)).resolves.toMatchObject({ id: 1 });
  await expect(fetchUser(-1)).rejects.toThrow('Not found');
});
it('works with callbacks', (done) => {
  readConfig((err, cfg) => {
    try { expect(err).toBeNull(); expect(cfg.port).toBe(3000); done(); }
    catch (e) { done(e); }
  });
});
```

> [!WARN]
> Forgetting `await` (or `return`) on a promise assertion makes the test pass before the assertion runs. Use `expect.assertions(n)` when testing rejection paths.

# Intermediate

## Mock Functions and Spies

```ts
const onSave = jest.fn();                                // standalone mock function
onSave.mockReturnValue(true);
onSave.mockResolvedValueOnce({ id: 1 }).mockRejectedValueOnce(new Error('fail'));
save(order, onSave);
expect(onSave).toHaveBeenCalledTimes(1);
expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sku: 'A1' }));
expect(onSave.mock.calls[0][0].qty).toBe(2);

const spy = jest.spyOn(Math, 'random').mockReturnValue(0.42);   // spy on an existing method
expect(rollDice()).toBe(3);
spy.mockRestore();                                               // put the original back

const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});   // silence and assert logs
```
| Method | Effect |
|---|---|
| `mockClear()` / `jest.clearAllMocks()` | reset calls and results |
| `mockReset()` / `jest.resetAllMocks()` | also remove implementations |
| `mockRestore()` / `jest.restoreAllMocks()` | restore the original (spies) |

## Mocking Modules

```ts Auto-mock a module
import { sendEmail } from './mailer';
import { registerUser } from './users';
jest.mock('./mailer');                                   // every export becomes jest.fn()
const mockedSend = jest.mocked(sendEmail);

it('sends a welcome email', async () => {
  mockedSend.mockResolvedValue({ id: 'm1' });
  await registerUser({ email: 'ada@x.io' });
  expect(mockedSend).toHaveBeenCalledWith('ada@x.io', 'welcome');
});
```
```ts Factory mock + partial mock
jest.mock('./config', () => ({ ...jest.requireActual('./config'), FEATURE_X: true }));
jest.mock('axios', () => ({ get: jest.fn() }));
import axios from 'axios';
(axios.get as jest.Mock).mockResolvedValue({ data: [{ id: 1 }] });
```
```ts Mock global fetch
global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { USD: 1.08 } }) }) as jest.Mock;
await expect(convert(100, 'USD')).resolves.toBe(108);
```

## Fake Timers and Dates

```ts
jest.useFakeTimers();
it('debounces search', () => {
  const search = jest.fn();
  const debounced = debounce(search, 300);
  debounced('a'); debounced('ab'); debounced('abc');
  expect(search).not.toHaveBeenCalled();
  jest.advanceTimersByTime(300);
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledWith('abc');
});
it('marks trials expired after 14 days', () => {
  jest.setSystemTime(new Date('2026-10-01T00:00:00Z'));
  const trial = startTrial();
  jest.setSystemTime(new Date('2026-10-16T00:00:00Z'));
  expect(trial.isExpired()).toBe(true);
});
afterEach(() => jest.useRealTimers());
```

## Testing React Components with Testing Library

**React Testing Library** tests behaviour the way users experience it: query by role, label and text, and interact with `user-event`.

```bash
npm i -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jest-environment-jsdom
```
```tsx LoginForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

it('submits email and password', async () => {
  const onSubmit = jest.fn();
  render(<LoginForm onSubmit={onSubmit} />);
  await userEvent.type(screen.getByLabelText(/email/i), 'ada@x.io');
  await userEvent.type(screen.getByLabelText(/password/i), 's3cret!');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@x.io', password: 's3cret!' });
});

it('shows an error from the API', async () => {
  render(<LoginForm onSubmit={jest.fn().mockRejectedValue(new Error('Invalid credentials'))} />);
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');   // findBy* waits
  expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();                       // queryBy* for absence
});
```

# Advanced

## Snapshot Testing (and Its Limits)

```tsx
it('renders the price badge', () => {
  const { container } = render(<PriceBadge amount={19.99} currency="EUR" />);
  expect(container.firstChild).toMatchSnapshot();          // writes __snapshots__/… on first run
});
it('formats an invoice', () => {
  expect(formatInvoice(sample)).toMatchInlineSnapshot(`"INV-901 · €120.00 · due 2026-11-01"`);
});
```
```bash
npx jest -u        # update snapshots after an intentional change; review the diff in the PR
```
Use snapshots for small, stable outputs (serialisers, error messages). Avoid huge component snapshots: people approve diffs without reading them.

## Testing APIs and Databases (Integration Tests)

```ts orders.api.test.ts (Express + supertest + Testcontainers)
import request from 'supertest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let pg: StartedPostgreSqlContainer; let app: Express.Application;
beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:16').start();
  process.env.DATABASE_URL = pg.getConnectionUri();
  ({ app } = await import('../src/app'));
  await migrate();
}, 60_000);
afterAll(async () => { await pg.stop(); });
beforeEach(async () => { await db.query('TRUNCATE orders RESTART IDENTITY CASCADE'); });

it('POST /orders creates an order', async () => {
  const res = await request(app).post('/orders').send({ sku: 'A1', qty: 2 }).expect(201);
  expect(res.body).toMatchObject({ id: 1, sku: 'A1', qty: 2 });
  const { rows } = await db.query('SELECT qty FROM orders WHERE id = $1', [res.body.id]);
  expect(rows[0].qty).toBe(2);
});
it('rejects invalid qty', () => request(app).post('/orders').send({ sku: 'A1', qty: 0 }).expect(422));
```

## Configuration, Coverage and CI

```js jest.config.js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',                         // 'jsdom' for browser/React code
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1', '\\.(css|scss)$': 'identity-obj-proxy' },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/index.ts'],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 85, statements: 85 } },
  clearMocks: true,
  restoreMocks: true,
  // projects: [...] splits unit and integration suites (see the interview question below)
};
```
```bash
npx jest --coverage --ci --reporters=default --reporters=jest-junit
npx jest --shard=2/4                 # split across CI machines
npx jest --onlyChanged               # local fast feedback
npx jest path/to/file -t "applies coupon"   # run one test by name
node --inspect-brk node_modules/.bin/jest --runInBand   # debug in Chrome DevTools
```

## Writing Maintainable Tests

- **AAA** structure: Arrange, Act, Assert, with one behaviour per test and a descriptive name.
- Test **behaviour, not implementation**. Mock only at system boundaries (network, time, randomness, external services).
- Use **test data builders and factories**, not huge shared fixtures.
- Keep tests **independent**: no order dependency, and reset state in `beforeEach`.
- Avoid "assertion-free" tests. Verify their value with mutation testing (Stryker).

```ts Test data builder
const anOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'o-1', customerId: 'c-1', items: [{ sku: 'A1', qty: 1, price: 10 }], status: 'pending', ...overrides,
});
it('cannot ship a pending order', () => {
  expect(() => ship(anOrder({ status: 'pending' }))).toThrow('Order not paid');
});
```

# Interview Questions

## Beginner

### What is Jest?

A JavaScript and TypeScript testing framework that includes a runner, assertions, mocking, snapshots, coverage (Istanbul or V8), watch mode and parallel workers. It needs little configuration.

```bash
npx jest --watch
```

### toBe vs toEqual vs toStrictEqual?

`toBe` uses `Object.is` (primitives or the same reference). `toEqual` checks recursive equality and ignores `undefined` properties. `toStrictEqual` also checks `undefined` properties, array sparseness and class types.

```ts
expect({ a: 1, b: undefined }).toEqual({ a: 1 });         // passes
expect({ a: 1, b: undefined }).toStrictEqual({ a: 1 });   // fails
```

### How do you test that a function throws?

Wrap the call in a function and use `toThrow` (with a message, regex or error class). For async code, use `await expect(promise).rejects.toThrow()`.

```ts
expect(() => parse('')).toThrow(/empty/);
await expect(load(-1)).rejects.toThrow(NotFoundError);
```

### beforeEach vs beforeAll?

`beforeAll` runs once before every test in its scope (expensive setup like a DB connection). `beforeEach` runs before each test (fresh state). The matching `afterAll` and `afterEach` clean up.

```ts
beforeAll(() => server.listen()); beforeEach(() => store.reset()); afterAll(() => server.close());
```

### What is `it.each` used for?

Parameterised tests: the same test logic runs over a table of inputs and expected outputs, which keeps tests short and covers edge cases.

```ts
it.each([['', false], ['a@b.co', true], ['no-at', false]])('isEmail(%p) → %p', (s, ok) => expect(isEmail(s)).toBe(ok));
```

## Intermediate

### jest.fn vs jest.spyOn vs jest.mock?

`jest.fn()` creates a standalone mock function. `jest.spyOn(obj, 'method')` wraps an existing method so you can track calls or replace its implementation, and you can restore it. `jest.mock('module')` replaces an entire module's exports (automatically, or with a factory).

```ts
const cb = jest.fn(); jest.spyOn(Date, 'now').mockReturnValue(0); jest.mock('./db');
```

### How do you test code that uses setTimeout or Date?

Use fake timers (`jest.useFakeTimers()`) and advance them (`advanceTimersByTime`, `runAllTimers`). Control the clock with `jest.setSystemTime`, and restore real timers afterwards.

```ts
jest.useFakeTimers(); startPolling(); jest.advanceTimersByTime(5000); expect(api.poll).toHaveBeenCalledTimes(1);
```

### What does mockClear vs mockReset vs mockRestore do?

`mockClear` resets recorded calls and instances. `mockReset` also removes the mocked implementation and return values. `mockRestore` additionally restores the original method (spies only).

```ts
spy.mockClear(); spy.mockReset(); spy.mockRestore();
```

### Why does React Testing Library recommend getByRole?

Role queries mirror how assistive technology and users find elements, so they encourage accessible markup and make tests resilient to markup and class changes. Order of preference: role, label, placeholder, text, then test id as a last resort.

```ts
screen.getByRole('button', { name: /add to cart/i });
```

### getBy vs queryBy vs findBy?

`getBy*` throws if there's no match (assert presence). `queryBy*` returns `null` (assert absence). `findBy*` returns a promise that retries until the element appears or the timeout passes (async UI).

```ts
expect(screen.queryByText('Error')).toBeNull(); expect(await screen.findByText('Saved')).toBeVisible();
```

## Advanced

### When are snapshot tests a bad idea?

When outputs are large or change often. Reviewers rubber-stamp `-u` updates, the tests pin implementation details, and they don't express intent. Prefer explicit assertions on behaviour, and keep snapshots small (inline snapshots for serialisers and messages).

```ts
expect(screen.getByRole('heading')).toHaveTextContent('Checkout');   // explicit > giant snapshot
```

### How do you make a slow Jest suite faster?

Use the `node` environment where jsdom isn't needed, avoid expensive global setup per file, mock heavy modules, use SWC or esbuild transforms instead of ts-jest type-checking (type-check separately with `tsc`), shard in CI, use `--onlyChanged` locally, fix open handles, and tune `maxWorkers`.

```js
module.exports = { transform: { '^.+\\.(t|j)sx?$': '@swc/jest' }, testEnvironment: 'node' };
```

### How do you handle "Jest did not exit one second after the test run"?

Something keeps the event loop alive: an open server, DB pool, timer or socket. Close it in `afterAll`, run `--detectOpenHandles` to find it, and use fake timers or `.unref()` for intervals. Avoid `--forceExit` as a permanent fix.

```ts
afterAll(async () => { await server.close(); await pool.end(); });
```

### Unit vs integration tests with Jest: how do you split them?

Unit tests run fast and isolated, with mocked boundaries, on every save. Integration tests use real dependencies (a Testcontainers DB, supertest against the HTTP app). Use Jest `projects` or separate configs, run integration tests in CI with containers, and keep the pyramid shape.

```js
module.exports = { projects: [{ displayName: 'unit', testMatch: ['**/*.test.ts'] }, { displayName: 'int', testMatch: ['**/*.int.test.ts'], globalSetup: './test/db.ts' }] };
```

# Scenario Questions

## Beginner

### A test passes even though the code is clearly broken. What could be wrong?

The assertion never ran: a missing `await` on an async assertion, an assertion inside a callback that's never called, or a mock that returns the expected value so the real logic is bypassed. Add `expect.assertions(n)`, await the promises, and check that the test fails when you break the code.

```ts
it('rejects', async () => { expect.assertions(1); await expect(load()).rejects.toThrow(); });
```

## Intermediate

### Tests pass alone but fail when run together. Why?

They share state: module-level singletons, mocks not reset between tests, leftover DB rows, fake timers not restored, or a modified `process.env`. Reset in `beforeEach`/`afterEach`, enable `clearMocks`/`restoreMocks`, isolate data, and use `jest.isolateModules` for module state.

```js
module.exports = { clearMocks: true, restoreMocks: true, resetModules: true };
```

### You need to test a function that calls a third-party payment API. How?

Wrap the SDK in your own adapter. In unit tests, mock the adapter (or the HTTP layer with nock or MSW) to return success, decline and timeout responses, and assert how your code handles each. Add a small number of contract or sandbox tests in a separate suite.

```ts
jest.mock('./paymentGateway');
jest.mocked(charge).mockRejectedValueOnce(new GatewayTimeout());
await expect(checkout(cart)).resolves.toEqual({ status: 'retry_later' });
```

## Advanced

### Coverage is 90%, but bugs still escape. How do you improve test quality?

Coverage measures executed lines, not meaningful assertions. Run mutation testing (Stryker) to find weak tests, add boundary and negative cases, test behaviour rather than implementation, add integration tests where the bugs actually occur, and review tests in PRs.

```bash
npx stryker run      # surviving mutants = code that the tests don't really check
```

# Tricky Questions

## Beginner

### Why does `expect(0.1 + 0.2).toBe(0.3)` fail?

Floating-point arithmetic gives `0.30000000000000004`. Use `toBeCloseTo`.

```ts
expect(0.1 + 0.2).toBeCloseTo(0.3);
```

## Intermediate

### Why doesn't `jest.mock('./api')` inside a test function work as expected?

`jest.mock` calls are **hoisted** to the top of the file and apply at module load time. Calling it inside a test is too late for modules that are already imported. Declare it at the top level, then change behaviour per test with `mockReturnValue`, or use `jest.doMock` with dynamic imports.

```ts
jest.mock('./api');                                     // top level
it('…', () => { jest.mocked(getUser).mockResolvedValue(u); });
```

## Advanced

### Your test using fake timers and `await` hangs. Why?

The code awaits a promise that's resolved by a timer, but the timers never advance while the test is awaiting. Advance the timers and flush promises together, using `jest.advanceTimersByTimeAsync` or `runAllTimersAsync`.

```ts
const p = retryWithDelay(fn);       // uses setTimeout between retries
await jest.advanceTimersByTimeAsync(3000);
await expect(p).resolves.toBe('ok');
```
