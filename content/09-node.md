---
id: node
title: Node.js & Express
short: Node.js
category: Backend
order: 9
color: #3c873a
icon: N
summary: Runtime internals, the event loop & libuv, modules, streams, Express/NestJS APIs, auth, error handling, scaling, workers and production practices.
---

# Beginner

## What Node.js Is

Node.js is a **JavaScript runtime** built on Chrome's **V8** engine plus **libuv** (a C library providing the event loop, thread pool and async I/O). It lets you run JS on servers, CLIs and tooling.

### Key characteristics
- **Single-threaded event loop** for JavaScript execution.
- **Non-blocking, asynchronous I/O** — while waiting for disk/network, Node serves other requests.
- Excellent for **I/O-bound** workloads (APIs, real-time apps, proxies). Poor fit for **CPU-bound** work on the main thread (use worker threads or other services).
- Huge ecosystem via **npm**.

```js server.js
import http from 'node:http';
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, path: req.url }));
}).listen(3000, () => console.log('Listening on :3000'));
```

### Browser JS vs Node
No `window`/`document`; instead `global`/`globalThis`, `process`, `Buffer`, `fs`, `path`, `os`. Both share the language, `fetch`, `URL`, timers, `AbortController`, Web Streams.

## Modules and npm

### CommonJS vs ES Modules
```js
// CommonJS
const fs = require('fs');
module.exports = { add };

// ESM ("type": "module" in package.json or .mjs)
import fs from 'node:fs/promises';
export function add(a, b) { return a + b; }
```
`require` is synchronous and cached after first load. ESM is async, supports top-level `await`, and is the standard going forward. Recent Node versions can `require()` ESM modules synchronously (no top-level await).

### package.json essentials
```json
{
  "name": "orders-api",
  "type": "module",
  "scripts": { "dev": "node --watch src/index.js", "start": "node src/index.js", "test": "node --test" },
  "dependencies": { "express": "^5.1.0" },
  "devDependencies": { "vitest": "^3.0.0" },
  "engines": { "node": ">=22" }
}
```

### Semantic versioning
`MAJOR.MINOR.PATCH` — `^1.4.2` allows `<2.0.0`, `~1.4.2` allows `<1.5.0`. **Lockfiles** (`package-lock.json`) pin the exact tree — commit them, and use `npm ci` in CI for reproducible installs.

### Useful built-ins
`node --watch` (auto-restart), `node --env-file=.env` (load env vars), `node --test` (test runner), native `fetch`, and TypeScript type stripping in recent versions.

## Core Modules: fs, path, events, process

```js
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const file = path.join(import.meta.dirname, 'data', 'users.json');
const users = JSON.parse(await readFile(file, 'utf8'));

class OrderService extends EventEmitter {}
const orders = new OrderService();
orders.on('created', (o) => sendEmail(o));
orders.emit('created', { id: 1 });

process.env.PORT;           // environment variables
process.argv;               // CLI args
process.on('SIGTERM', shutdown);
process.exitCode = 1;
```

> [!WARN]
> Avoid sync APIs (`readFileSync`) in request handlers — they block the event loop for everyone. They're fine at startup.

## Building an API with Express

```js app.js
import express from 'express';
const app = express();

app.use(express.json());                      // parse JSON bodies

app.get('/api/users/:id', async (req, res) => {
  const user = await db.user.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

app.post('/api/users', async (req, res) => {
  const user = await db.user.create(req.body);
  res.status(201).json(user);
});

app.use((err, req, res, next) => {            // error handler: 4 args
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.expose ? err.message : 'Internal error' });
});

app.listen(3000);
```

### Middleware
Functions `(req, res, next)` executed **in order**. They can modify req/res, end the response, or call `next()` (or `next(err)` to jump to error handlers).

```js
const requestLogger = (req, res, next) => {
  const start = performance.now();
  res.on('finish', () => console.log(req.method, req.url, res.statusCode, `${(performance.now() - start).toFixed(1)}ms`));
  next();
};
app.use(requestLogger);
app.use('/api/admin', requireAuth, adminRouter);   // mount routers with middleware
```

Express 5 forwards rejected promises from async handlers to the error handler automatically (in Express 4 you needed a wrapper or `express-async-errors`).

# Intermediate

## The Event Loop in Node (libuv phases)

Each loop iteration ("tick") passes through phases:

1. **timers** — `setTimeout`/`setInterval` callbacks whose time has elapsed.
2. **pending callbacks** — some deferred system errors.
3. **idle/prepare** — internal.
4. **poll** — retrieve new I/O events and run their callbacks; may block here waiting for I/O.
5. **check** — `setImmediate` callbacks.
6. **close callbacks** — `socket.on('close')`.

Between **every** callback, Node drains:
- the **`process.nextTick` queue** first,
- then the **promise microtask queue**.

```js
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));
console.log('sync');
// sync, nextTick, promise, then timeout/immediate (order of these two varies in main module)

import fs from 'node:fs';
fs.readFile(import.meta.filename, () => {
  setTimeout(() => console.log('T'), 0);
  setImmediate(() => console.log('I'));   // inside an I/O callback: always I then T
});
```

### The thread pool
libuv's thread pool (default **4** threads, `UV_THREADPOOL_SIZE`) handles: file system ops, `dns.lookup`, `crypto.pbkdf2/scrypt`, `zlib`. Network sockets use OS async mechanisms (epoll/kqueue/IOCP), not the pool.

### Blocking the loop
CPU-heavy JSON parsing, regex backtracking (ReDoS), sync crypto, or large loops freeze all requests. Detect with `--prof`, clinic.js, `perf_hooks.monitorEventLoopDelay()`.

## Streams and Buffers

Streams process data **piece by piece** instead of loading everything into memory.

| Type | Example |
|---|---|
| Readable | `fs.createReadStream`, HTTP request |
| Writable | `fs.createWriteStream`, HTTP response |
| Duplex | TCP socket |
| Transform | `zlib.createGzip()`, CSV parser |

```js
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

await pipeline(createReadStream('huge.log'), createGzip(), createWriteStream('huge.log.gz'));

// stream a file as an HTTP response
app.get('/download', (req, res) => createReadStream('report.csv').pipe(res));
```

### Backpressure
When the writable side is slower, `write()` returns `false`; the readable should pause until `'drain'`. `pipeline()` handles backpressure and error propagation/cleanup automatically — prefer it over `.pipe()`.

### Buffer
Fixed-size raw binary data outside the V8 heap: `Buffer.from('hi')`, `buf.toString('base64')`.

## Authentication, Validation and Security

### JWT auth middleware
```js
import jwt from 'jsonwebtoken';
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
export const requireRole = (role) => (req, res, next) =>
  req.user?.role === role ? next() : res.status(403).json({ error: 'Forbidden' });
```

### Passwords
```js
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);
const ok = await bcrypt.compare(password, hash);
```

### Validation with Zod
```js
const CreateUser = z.object({ email: z.string().email(), age: z.number().int().min(18) });
app.post('/users', (req, res, next) => {
  const parsed = CreateUser.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ errors: parsed.error.flatten() });
  next();
});
```

### Security checklist
`helmet` (security headers), `cors` with an allow-list, rate limiting (`express-rate-limit` + Redis), body size limits, parameterised queries, input validation, no secrets in code (env vars / secret manager), `npm audit`, run as non-root, avoid `eval`/`child_process` with user input, prototype-pollution-safe merges.

## Databases and ORMs from Node

| Tool | Style |
|---|---|
| `pg`, `mysql2` | raw drivers with parameterised SQL |
| **Prisma** | schema-first ORM, generated typed client, migrations |
| **Drizzle** | TypeScript-first SQL-like query builder |
| TypeORM / Sequelize / MikroORM | decorator/Active Record/Data Mapper ORMs |
| Knex | query builder |
| Mongoose | MongoDB ODM with schemas |

```js
// Prisma
const user = await prisma.user.findUnique({ where: { id }, include: { orders: true } });
await prisma.$transaction([prisma.account.update(/* debit */), prisma.account.update(/* credit */)]);
```

### Connection pooling
Opening DB connections is expensive. Use a pool (`new Pool({ max: 20 })`) sized to DB limits ÷ number of instances. In serverless, use a proxy/pooler (PgBouncer, RDS Proxy).

### The N+1 problem
Fetching a list then querying related rows per item → N+1 queries. Fix with joins/`include`, batching (`WHERE id IN (...)`), or DataLoader in GraphQL.

## Error Handling and Logging

### Operational vs programmer errors
- **Operational**: expected runtime problems (invalid input, network timeout, 404) → handle and respond.
- **Programmer**: bugs (undefined is not a function) → log, crash and let the process manager restart; don't keep running in an unknown state.

```js
class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL') { super(message); this.status = status; this.code = code; this.expose = status < 500; }
}
throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');

process.on('unhandledRejection', (err) => { logger.fatal(err); process.exit(1); });
process.on('uncaughtException', (err) => { logger.fatal(err); process.exit(1); });
```

### Structured logging
Use **pino** or winston with JSON output, log levels, request ids (correlation ids via `AsyncLocalStorage`), and never log secrets/PII.

## NestJS in a Nutshell

NestJS is an opinionated, Angular-inspired framework for structured Node backends (TypeScript, DI, modules).

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.users.findOne(id); }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateUserDto) { return this.users.create(dto); }
}

@Injectable()
export class UsersService { constructor(@InjectRepository(User) private repo: Repository<User>) {} }

@Module({ imports: [TypeOrmModule.forFeature([User])], controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
```

Building blocks: **modules, controllers, providers (DI), pipes (validation/transform), guards (authz), interceptors (logging, caching, response mapping), exception filters, middleware**. Request lifecycle: middleware → guards → interceptors (before) → pipes → handler → interceptors (after) → exception filters.

# Advanced

## Scaling Node: Cluster, Worker Threads and Child Processes

| Mechanism | What | Use for |
|---|---|---|
| **cluster** / PM2 | multiple processes sharing a port | use all CPU cores for HTTP serving |
| **worker_threads** | threads with own V8 isolate, can share memory (`SharedArrayBuffer`) | CPU-heavy tasks: image processing, hashing, parsing |
| **child_process** | spawn separate programs (`spawn`, `exec`, `fork`) | run CLIs, Python scripts, isolation |

```js
import { Worker } from 'node:worker_threads';
function runHeavy(data) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./heavy.js', import.meta.url), { workerData: data });
    w.once('message', resolve); w.once('error', reject);
  });
}
```

In containers/Kubernetes, prefer **one process per container** and scale horizontally with replicas instead of cluster mode. Keep the app **stateless** (sessions in Redis, files in object storage) so any instance can serve any request.

## Performance, Memory and Profiling

```bash
node --max-old-space-size=3072 server.js          # keep below the container limit
node --cpu-prof server.js                         # writes .cpuprofile → open in DevTools
node --heapsnapshot-signal=SIGUSR2 server.js &    # kill -USR2 <pid> writes a heap snapshot
npx clinic doctor -- node server.js               # event-loop / I/O diagnosis
npx autocannon -c 100 -d 30 http://localhost:3000/api/orders
```
```js
const { monitorEventLoopDelay } = require('node:perf_hooks');
const h = monitorEventLoopDelay(); h.enable();
setInterval(() => console.log('p99 loop delay ms', h.percentile(99) / 1e6, 'heap MB', process.memoryUsage().heapUsed / 1e6), 10_000);
```

### V8 memory
Heap = new space (short-lived, scavenged quickly) + old space (mark-sweep-compact). Default heap limit depends on system memory; set with `--max-old-space-size=4096`. Set it below the container memory limit.

### Finding leaks
- Symptoms: steadily growing RSS/heap, longer GC pauses, eventual OOM.
- Causes: global caches without bounds, listeners not removed (`MaxListenersExceededWarning`), closures retaining big objects, timers.
- Tools: `--inspect` + Chrome DevTools heap snapshots (compare two), `--heapsnapshot-near-heap-limit`, clinic.js (doctor, flame, bubbleprof), `0x` flamegraphs.

### Performance tips
- Cache hot data (in-memory LRU, Redis) and use HTTP caching.
- Use streams for large payloads; compress responses.
- Avoid sync APIs and heavy JSON in hot paths; consider faster serializers (fast-json-stringify, Fastify schemas).
- **Fastify** is significantly faster than Express due to schema-based serialization and an optimised router.
- Keep-alive agents for outbound HTTP (`undici`), connection pooling for DBs.
- Offload CPU work to workers or queues.

## Background Jobs, Queues and Microservices

### Queues
Move slow/unreliable work out of the request path: emails, image processing, webhooks, reports.
```js
import { Queue, Worker } from 'bullmq';
const emailQueue = new Queue('email', { connection: redis });
await emailQueue.add('welcome', { userId }, { attempts: 5, backoff: { type: 'exponential', delay: 1000 } });
new Worker('email', async job => sendWelcome(job.data.userId), { connection: redis });
```
Brokers: Redis (BullMQ), RabbitMQ, Kafka, AWS SQS/SNS, NATS.

Design for **at-least-once delivery** → make handlers **idempotent**; use dead-letter queues for poison messages.

### Microservice communication
- Sync: REST/gRPC with timeouts, retries (with jitter), circuit breakers.
- Async: events via Kafka/RabbitMQ; **outbox pattern** to atomically save data and publish events; sagas for distributed transactions.
- Observability: OpenTelemetry tracing, correlation ids, metrics (Prometheus), centralised logs.

## Production Readiness

### Graceful shutdown
```js
const server = app.listen(port);
async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {            // stop accepting new connections, finish in-flight
    await db.$disconnect(); await redis.quit();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // force after timeout
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```
Kubernetes sends SIGTERM before killing the pod — this avoids dropped requests.

### Health checks
`/healthz` (liveness: process alive) and `/readyz` (readiness: dependencies reachable, warmed up).

### Configuration (12-factor)
Config via environment variables, validated at startup (Zod/envalid); fail fast on missing config. Secrets from a secret manager or Kubernetes Secrets.

### Other practices
`NODE_ENV=production`, run behind a reverse proxy/load balancer (`app.set('trust proxy', 1)`), TLS termination at the edge, structured logs to stdout, metrics, tracing, CI with tests + lint + `npm audit`, Docker multi-stage builds with a non-root user, and pinned Node LTS versions.

## AsyncLocalStorage, Diagnostics and Internals

### AsyncLocalStorage
Propagates context (request id, user, transaction) through async calls without passing it explicitly.
```js
import { AsyncLocalStorage } from 'node:async_hooks';
export const ctx = new AsyncLocalStorage();
app.use((req, res, next) => ctx.run({ requestId: crypto.randomUUID() }, next));
// anywhere later
logger.info({ requestId: ctx.getStore()?.requestId }, 'charging card');
```

### Other internals worth knowing
- `process.nextTick` vs `setImmediate`: nextTick runs before any other I/O or promise in the current phase (can starve the loop); setImmediate runs in the check phase.
- `EventEmitter` is synchronous — listeners run in registration order during `emit`.
- `require` caching and circular dependency behaviour (partial exports).
- Node's permission model (`--permission`) restricts fs/child process access.
- Diagnostic reports (`--report-on-fatalerror`), `diagnostics_channel`, and the built-in inspector.

# Interview Questions

## Beginner

### What is Node.js and why is it single-threaded?
A JavaScript runtime built on V8 and libuv. JavaScript executes on one main thread with an event loop; I/O is delegated to the OS or libuv's thread pool and completes asynchronously. This avoids thread-per-request overhead and locking, making it efficient for many concurrent I/O-bound connections.

```js
const fs = require('node:fs');
console.log('1 start');
fs.readFile(__filename, () => console.log('3 file read (libuv did the I/O)'));
console.log('2 main thread keeps going');
// One JS thread, many concurrent I/O operations
```

### What is npm and what is `package-lock.json` for?
npm is Node's package manager and registry. `package.json` declares dependency ranges; `package-lock.json` records the exact resolved versions of the whole dependency tree so installs are reproducible. Commit it and use `npm ci` in CI.

```json package.json
{ "dependencies": { "express": "^4.19.2" }, "devDependencies": { "jest": "~29.7.0" } }
```
```bash
npm ci            # installs EXACTLY what package-lock.json says (use in CI/Docker)
npm install       # may update the lock within the ranges
npm outdated && npm audit
```

### What is middleware in Express?
A function `(req, res, next)` in the request pipeline. It can read/modify the request and response, end the cycle, or pass control with `next()`. Examples: body parsing, logging, auth, CORS, rate limiting. Error middleware has four arguments `(err, req, res, next)`.

```js
const app = express();
app.use(express.json({ limit: '1mb' }));                          // built-in
app.use((req, res, next) => {                                     // custom logger
  const start = Date.now();
  res.on('finish', () => console.log(req.method, req.url, res.statusCode, Date.now() - start, 'ms'));
  next();
});
const requireAuth = (req, res, next) => (req.user ? next() : res.sendStatus(401));
app.get('/me', requireAuth, (req, res) => res.json(req.user));    // route-level
app.use((err, req, res, next) => res.status(err.status ?? 500).json({ error: err.message })); // error handler last
```

### `require` vs `import`?
`require` is CommonJS: synchronous, dynamic, can be called anywhere, exports a value. `import` is ESM: static (analysable, tree-shakable), asynchronous loading, live bindings, supports top-level await. Dynamic `import()` works in both.

```js CommonJS
const path = require('node:path');
if (process.env.DEBUG) require('./debug');      // conditional, synchronous
module.exports = { add: (a, b) => a + b };
```
```js ESM ("type": "module" or .mjs)
import path from 'node:path';
import { add } from './math.js';                // extension required
const { default: debug } = await import('./debug.js'); // dynamic import
export const sub = (a, b) => a - b;
```

### What is the difference between `process.nextTick()` and `setImmediate()`?
`nextTick` callbacks run immediately after the current operation, before promise microtasks and before the event loop continues. `setImmediate` callbacks run in the check phase of the next loop iteration, after I/O polling. Recursive `nextTick` can starve I/O.

```js
setImmediate(() => console.log('setImmediate'));
setTimeout(() => console.log('setTimeout'), 0);
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
// nextTick → promise → setTimeout/setImmediate (order of these two varies in the main module)
```

### How do you handle errors in async/await Express routes?
Wrap with try/catch and call `next(err)`, use a wrapper `asyncHandler`, or use Express 5 which forwards rejected promises automatically. Centralise responses in an error-handling middleware.

```js
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw Object.assign(new Error('Not found'), { status: 404 });
  res.json(order);
}));

app.use((err, req, res, _next) => {
  req.log?.error(err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Internal error' });
});
```

### What are environment variables used for in Node?
Configuration that varies by environment (ports, DB URLs, API keys) accessed via `process.env`. Load locally with `--env-file` or dotenv, never commit secrets, and validate them at startup.

```bash
node --env-file=.env server.js     # Node 20.6+, no dotenv needed
```
```js config.js — validate once at startup
const { z } = require('zod');
const env = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
}).parse(process.env);
module.exports = env;
```

## Intermediate

### Explain the Node.js event loop phases.
Timers → pending callbacks → idle/prepare → poll (I/O) → check (`setImmediate`) → close callbacks. Between each callback, Node drains the `process.nextTick` queue then the promise microtask queue. The poll phase waits for I/O when nothing else is scheduled.

```js
const fs = require('node:fs');
fs.readFile(__filename, () => {          // inside an I/O callback (poll phase)
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));  // check phase comes right after poll
});
// Always: immediate → timeout
```

### What are streams and why use them?
Abstractions for processing data incrementally — Readable, Writable, Duplex and Transform. They keep memory usage constant for large files/responses, start sending data sooner, and handle backpressure. Use `stream.pipeline` for safe composition and error handling.

```js
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');
const zlib = require('node:zlib');

await pipeline(
  fs.createReadStream('access.log'),     // 10 GB file, constant memory
  zlib.createGzip(),
  fs.createWriteStream('access.log.gz'),
);
app.get('/export', (req, res) => db.queryStream('SELECT * FROM orders').pipe(toCsv()).pipe(res));
```

### What is backpressure?
When a consumer can't process data as fast as the producer generates it. Writable streams signal it by `write()` returning `false`; producers should pause until `drain`. Ignoring it causes unbounded memory growth. `pipeline()`/`pipe()` manage it automatically.

```js
function writeMany(ws, rows) {
  let i = 0;
  (function write() {
    while (i < rows.length) {
      if (!ws.write(rows[i++] + '\n')) {   // buffer full
        ws.once('drain', write);           // resume when the consumer catches up
        return;
      }
    }
    ws.end();
  })();
}
// stream.pipeline() / .pipe() handle backpressure for you
```

### What runs on the libuv thread pool?
File system operations, DNS lookups via `dns.lookup`, some crypto (`pbkdf2`, `scrypt`, `randomBytes`), and zlib compression. Default size 4, configurable with `UV_THREADPOOL_SIZE`. Network I/O uses the OS's non-blocking mechanisms instead.

```js
process.env.UV_THREADPOOL_SIZE = 8;  // must be set before the pool is first used
const crypto = require('node:crypto');
console.time('4 hashes');
let done = 0;
for (let i = 0; i < 4; i++) crypto.pbkdf2('pw', 'salt', 100000, 64, 'sha512', () => { if (++done === 4) console.timeEnd('4 hashes'); });
// With the default pool of 4 these run in parallel; a 5th would wait
```

### How do you secure an Express API?
Helmet for headers, strict CORS, input validation (Zod/Joi), parameterised queries, auth with short-lived JWTs or sessions, role checks, rate limiting, body size limits, HTTPS, secrets in env/secret managers, dependency scanning, logging without sensitive data, and generic error messages in production.

```js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
app.use(helmet());
app.use(cors({ origin: ['https://app.example.com'] }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 100 }));
app.post('/api/users', validate(UserSchema), requireRole('admin'), async (req, res) => {
  await db.query('INSERT INTO users(email) VALUES ($1)', [req.body.email]); // parameterised
  res.sendStatus(201);
});
app.disable('x-powered-by');
```

### How do you implement JWT authentication with refresh tokens?
On login, issue a short-lived access token (e.g., 15 min) and a long-lived refresh token (stored hashed in DB, sent as HttpOnly cookie). Middleware verifies the access token on each request. When it expires, the client calls `/refresh`; the server validates, rotates the refresh token and issues a new access token. Logout revokes the refresh token.

```js
app.post('/login', async (req, res) => {
  const user = await verifyPassword(req.body.email, req.body.password);
  if (!user) return res.sendStatus(401);
  const access = jwt.sign({ sub: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: '15m' });
  const refresh = crypto.randomBytes(48).toString('base64url');
  await db.refreshTokens.insert({ userId: user.id, hash: sha256(refresh), expiresAt: addDays(30) });
  res.cookie('rt', refresh, { httpOnly: true, secure: true, sameSite: 'strict', path: '/auth/refresh' });
  res.json({ access });
});
const auth = (req, res, next) => {
  try { req.user = jwt.verify(req.headers.authorization?.split(' ')[1], ACCESS_SECRET); next(); }
  catch { res.sendStatus(401); }
};
```

### Express vs NestJS vs Fastify?
Express: minimal, flexible, huge ecosystem, slower, unstructured. Fastify: high performance, schema-based validation/serialization, plugin system. NestJS: opinionated architecture with modules, DI, decorators, guards and interceptors — great for large teams; can run on Express or Fastify.

```js Fastify: schema-driven validation & serialization
fastify.post('/users', {
  schema: { body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } },
}, async (req) => ({ id: await createUser(req.body) }));
```
```ts NestJS: decorators + DI
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Post() create(@Body() dto: CreateUserDto) { return this.users.create(dto); }
}
```

### What is the N+1 query problem?
Loading a list of N entities and then running one query per entity to load related data, giving N+1 queries. Fix with joins/eager loading (`include`), batching IN queries, or DataLoader.

```js
// ❌ 1 query for posts + N queries for authors
const posts = await Post.findAll();
for (const p of posts) p.author = await User.findByPk(p.authorId);

// ✅ eager load (1 JOIN) or batch (2 queries)
const posts2 = await Post.findAll({ include: [{ model: User, as: 'author' }] });
const authors = await User.findAll({ where: { id: [...new Set(posts.map((p) => p.authorId))] } });
// GraphQL: DataLoader batches per tick → new DataLoader((ids) => User.findAll({ where: { id: ids } }))
```

## Advanced

### How do you handle CPU-intensive tasks in Node.js?
Don't run them on the main thread. Use worker threads (with a pool like Piscina), offload to a job queue processed by separate workers, use native addons/WASM, or move the workload to a service better suited (Go, Python). Break long tasks into chunks with `setImmediate` as a last resort.

```js
const Piscina = require('piscina');
const pool = new Piscina({ filename: require.resolve('./resize-worker.js') });
app.post('/resize', async (req, res) => {
  const out = await pool.run({ buffer: req.body, width: 800 }); // runs on a worker thread
  res.type('image/webp').send(out);
});
```
```js resize-worker.js
const sharp = require('sharp');
module.exports = ({ buffer, width }) => sharp(buffer).resize(width).webp().toBuffer();
```

### Cluster module vs worker threads?
Cluster forks multiple processes, each with its own event loop and memory, sharing a server port — used to scale HTTP handling across cores. Worker threads run in the same process with separate isolates and can share memory — used to offload CPU-bound computations. In Kubernetes, prefer scaling pods over cluster mode.

```js cluster
const cluster = require('node:cluster');
if (cluster.isPrimary) {
  for (let i = 0; i < require('node:os').availableParallelism(); i++) cluster.fork();
  cluster.on('exit', () => cluster.fork());           // restart crashed workers
} else {
  require('./server');                                // each process listens on the same port
}
```
```js worker_threads
const { Worker } = require('node:worker_threads');
const w = new Worker('./hash.js', { workerData: { input } });
w.on('message', (hash) => console.log(hash));        // shares the process, can share memory
```

### How would you find and fix a memory leak in production?
Monitor heap/RSS metrics to confirm growth. Reproduce under load, take heap snapshots at intervals (`--inspect` or `--heapsnapshot-signal`) and compare retained objects and retainer paths. Common culprits: unbounded caches, event listeners, closures, global arrays, unclosed resources. Fix, add bounded caches/cleanup, and add memory alerts.

```bash
node --inspect=0.0.0.0:9229 server.js     # attach Chrome DevTools → Memory → Heap snapshot
kill -USR2 $(pgrep -f server.js)          # with --heapsnapshot-signal=SIGUSR2
```
```js Common fix: bound the cache
const { LRUCache } = require('lru-cache');
const cache = new LRUCache({ max: 5000, ttl: 10 * 60_000 }); // instead of an ever-growing Map
```

### How do you implement graceful shutdown?
Listen for SIGTERM/SIGINT, mark readiness as failing, stop accepting new connections (`server.close`), let in-flight requests finish, close DB/Redis/queue connections, flush logs, then exit. Add a hard timeout. Align with Kubernetes `terminationGracePeriodSeconds` and a preStop delay.

```js
const server = app.listen(3000);
let shuttingDown = false;
app.get('/ready', (req, res) => res.sendStatus(shuttingDown ? 503 : 200));

process.on('SIGTERM', async () => {
  shuttingDown = true;                         // load balancer stops sending traffic
  server.close(async () => {                   // finish in-flight requests
    await Promise.allSettled([db.end(), redis.quit(), queue.close()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000).unref(); // hard deadline < terminationGracePeriod
});
```

### What is AsyncLocalStorage and when would you use it?
A Node API that stores context bound to an asynchronous execution chain. It's used for request-scoped data like correlation ids, user info or DB transactions available deep in the call stack without passing arguments — e.g., for logging and tracing.

```js
const { AsyncLocalStorage } = require('node:async_hooks');
const als = new AsyncLocalStorage();

app.use((req, res, next) => als.run({ requestId: req.get('x-request-id') ?? crypto.randomUUID() }, next));

function log(msg) {
  console.log(JSON.stringify({ msg, requestId: als.getStore()?.requestId })); // no need to pass req around
}
app.get('/orders', async (req, res) => { log('loading orders'); res.json(await loadOrders()); });
```

### How do you design a reliable background job system?
Use a durable broker (Redis/BullMQ, RabbitMQ, SQS, Kafka). Make jobs idempotent, add retries with exponential backoff and jitter, dead-letter queues, timeouts, concurrency limits, priorities, scheduling, and monitoring dashboards. Use the outbox pattern when job creation must be atomic with a DB write.

```js BullMQ
const { Queue, Worker } = require('bullmq');
const emails = new Queue('emails', { connection });
await emails.add('welcome', { userId }, {
  jobId: `welcome:${userId}`,                    // idempotent enqueue
  attempts: 5, backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
});
new Worker('emails', async (job) => {
  if (await alreadySent(job.data.userId)) return; // idempotent handler
  await sendWelcome(job.data.userId);
}, { connection, concurrency: 10 });
```

### What is the difference between `spawn`, `exec` and `fork`?
`spawn` starts a process with streamed stdio — good for large output. `exec` runs a command in a shell and buffers output — convenient but limited and shell-injection-prone. `fork` is a special `spawn` for Node scripts with an IPC channel for `process.send` messages.

```js
const { spawn, exec, execFile, fork } = require('node:child_process');
spawn('ffmpeg', ['-i', 'in.mp4', 'out.webm']).stdout.pipe(process.stdout); // streamed
exec('ls -la | wc -l', (err, stdout) => console.log(stdout));             // shell + buffered
execFile('git', ['log', '--oneline', '-5'], (e, out) => console.log(out)); // no shell → safer with input
const child = fork('./worker.js'); child.send({ task: 'report' });         // Node process + IPC
child.on('message', (m) => console.log('done', m));
```

### How would you scale a Node.js WebSocket server horizontally?
Run multiple instances behind a load balancer with sticky sessions (or use a protocol that tolerates reconnection), share pub/sub messages through Redis/NATS (Socket.IO Redis adapter), keep connection state external, set heartbeats/timeouts, and scale on connection count/CPU metrics.

```js Socket.IO with the Redis adapter
const { createAdapter } = require('@socket.io/redis-adapter');
const pub = createClient({ url: REDIS_URL }); const sub = pub.duplicate();
await Promise.all([pub.connect(), sub.connect()]);
io.adapter(createAdapter(pub, sub));

io.on('connection', (socket) => {
  socket.join(`room:${socket.handshake.query.room}`);
  socket.on('msg', (m) => io.to(`room:${m.room}`).emit('msg', m)); // reaches clients on ALL instances
});
```

# Scenario Questions

## Beginner

### Your Express API hangs forever on some requests: no response, no error. What do you look for?
A code path that never calls `res.send`, `res.json` or `next()`. That might be a missing `return` after an `if`, a middleware that forgets `next()`, or an `async` handler whose rejection isn't caught (Express 4 doesn't catch async errors, so wrap handlers or upgrade to Express 5). Add request timeouts and log the route and duration.

```js
// ❌ missing return → falls through, or never responds
app.get('/user/:id', async (req, res) => {
  const user = await db.find(req.params.id);
  if (!user) res.status(404);          // forgot .end() / return
});
// ❌ middleware forgets next()
app.use((req, res, next) => { req.start = Date.now(); });

// Safety net: time out every request
app.use((req, res, next) => { res.setTimeout(10_000, () => res.status(503).end('timeout')); next(); });
```

## Intermediate

### API latency jumps from 20 ms to 2 s whenever one endpoint generates a report. Why, and how do you fix it?
The report does **CPU-heavy synchronous work** (large JSON processing, crypto, image resizing, `fs.readFileSync`), which blocks the single event loop for **every** request. Fixes:
- move the work to `worker_threads` or a separate job queue (BullMQ)
- stream the data instead of loading it all
- use async APIs

Spot it with `clinic doctor`, `--prof`, or event-loop lag metrics (`perf_hooks.monitorEventLoopDelay`).

```js
// ❌ blocks the event loop for everyone
app.get('/report', (req, res) => res.json(buildHugeReport(readFileSync('data.json'))));

// ✅ move it off the main thread / out of the request
app.post('/reports', async (req, res) => {
  const job = await reportQueue.add('build', { userId: req.user.id });
  res.status(202).json({ jobId: job.id, status: `/reports/${job.id}` });
});
```

### Memory grows steadily in production until the container is OOM-killed. How do you find the leak?
Take heap snapshots (`--inspect` with Chrome DevTools, or `heapdump`) at intervals and compare retained objects. Typical leaks:
- module-level caches or Maps with no eviction
- event listeners added on each request (watch for the `MaxListenersExceededWarning`)
- closures held by timers
- unbounded queues

Fix it with an LRU cache, by removing listeners, and with `--max-old-space-size` set to match container limits.

```js Typical leak and fix
// ❌ listener added per request, never removed
app.get('/stream', (req, res) => { bus.on('event', (e) => res.write(e)); });

// ✅ remove it when the client disconnects
app.get('/stream', (req, res) => {
  const onEvent = (e) => res.write(`data: ${e}\n\n`);
  bus.on('event', onEvent);
  req.on('close', () => bus.off('event', onEvent));
});
// Warning sign in logs: MaxListenersExceededWarning
```

## Advanced

### You must process a 5 GB file upload and save it to S3 without running out of memory. How?
**Stream** it end to end. Pipe the request stream (busboy) into the S3 multipart `Upload`, using `stream.pipeline` for error handling and **backpressure**, so memory stays constant. Don't buffer with `multer` memory storage. Validate size and type as the bytes flow, and support resumable uploads (presigned multipart URLs that go straight to S3) for big files.

```js
const Busboy = require('busboy');
const { Upload } = require('@aws-sdk/lib-storage');

app.post('/upload', (req, res) => {
  const bb = Busboy({ headers: req.headers, limits: { fileSize: 6 * 1024 ** 3 } });
  bb.on('file', async (name, file, info) => {
    const upload = new Upload({
      client: s3,
      params: { Bucket: 'uploads', Key: `${crypto.randomUUID()}-${info.filename}`, Body: file },
      partSize: 16 * 1024 * 1024, queueSize: 4,   // ~64 MB in memory max
    });
    try { await upload.done(); res.sendStatus(201); } catch (e) { res.status(500).end(e.message); }
  });
  req.pipe(bb);
});
```

# Tricky Questions

## Intermediate

### Predict the output order in Node.js.
```js
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));
console.log('sync');
```
`sync nextTick promise`, then `timeout` and `immediate` in **either order** when run from the main module, because it depends on loop start-up timing. Inside an I/O callback, `setImmediate` always runs before the timeout. `process.nextTick` runs before promise microtasks.

### What does this print, and why?
```js
const fs = require('fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
```
Always `immediate` then `timeout`. The callback runs in the **poll** phase. The next phase is **check** (setImmediate), and timers run on the following loop iteration.

## Advanced

### Why can `await`ing inside `array.forEach` cause bugs?
```js
items.forEach(async (i) => { await save(i); });
console.log('all saved');
```
`forEach` ignores the returned promises, so 'all saved' logs before anything is saved, and rejections go unhandled. Use `for...of` with `await` for sequential work, or `await Promise.all(items.map(save))` for concurrent work (limit concurrency with `p-limit`).
