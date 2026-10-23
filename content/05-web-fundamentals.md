---
id: web
title: Web, HTTP & Security
short: HTTP & Security
category: Web Foundations
order: 5
color: #6b46c1
icon: WEB
summary: HTTP, REST, caching, CORS, cookies, authentication (sessions, JWT, OAuth/OIDC), browser storage and OWASP security.
---

# Beginner

## HTTP Fundamentals

HTTP is a **stateless request/response protocol**. Each request carries everything the server needs.

```http
GET /api/users/42 HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer eyJhbGciOi...

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: max-age=60

{"id":42,"name":"Asha"}
```

### Methods

| Method | Purpose | Safe | Idempotent |
|---|---|---|---|
| GET | read | ✅ | ✅ |
| HEAD | headers only | ✅ | ✅ |
| POST | create / action | ❌ | ❌ |
| PUT | replace whole resource | ❌ | ✅ |
| PATCH | partial update | ❌ | ❌ (can be) |
| DELETE | remove | ❌ | ✅ |
| OPTIONS | capabilities / CORS preflight | ✅ | ✅ |

**Safe** = doesn't change state. **Idempotent** = repeating the request has the same effect as doing it once (important for retries).

### Status codes
- **1xx** informational · **2xx** success · **3xx** redirect · **4xx** client error · **5xx** server error.
- Must-know: `200 OK`, `201 Created`, `204 No Content`, `301 Moved Permanently`, `302 Found`, `304 Not Modified`, `400 Bad Request`, `401 Unauthorized` (not authenticated), `403 Forbidden` (authenticated but not allowed), `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`, `429 Too Many Requests`, `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`.

## REST API Design

REST (Representational State Transfer) principles: client–server, stateless, cacheable, uniform interface, layered system.

### Resource-oriented URLs
```text
GET    /users              list (with ?page=2&limit=20&sort=-createdAt&role=admin)
POST   /users              create
GET    /users/42           read one
PATCH  /users/42           update fields
DELETE /users/42           delete
GET    /users/42/orders    sub-resource
```
- Nouns, not verbs (`/users`, not `/getUsers`). Plural collection names.
- Use status codes correctly and return consistent error bodies:
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Email is invalid", "details": [{ "field": "email" }] } }
```
- **Versioning**: `/v1/users` (URL), header (`Accept: application/vnd.app.v2+json`), or query param.
- **Pagination**: offset/limit (simple, slow on deep pages) vs **cursor-based** (`?after=abc`, stable and fast).
- **Idempotency keys** for safe retries of POST payments: `Idempotency-Key: <uuid>`.

### REST vs GraphQL vs gRPC

| | REST | GraphQL | gRPC |
|---|---|---|---|
| Transport | HTTP/JSON | HTTP, single endpoint | HTTP/2, Protobuf |
| Fetching | fixed responses (over/under-fetch) | client picks fields | strongly-typed RPC |
| Caching | HTTP caching built in | harder (POST), client caches | custom |
| Best for | public APIs, CRUD | complex UIs, many clients | internal microservices, streaming |

## URLs, DNS and HTTPS

```js
const u = new URL('https://user@shop.example.com:443/products/42?color=red#reviews');
u.protocol; u.hostname; u.port; u.pathname; u.searchParams.get('color'); u.hash;
// 'https:' 'shop.example.com' '' (default port) '/products/42' 'red' '#reviews'
```
```bash
dig +short shop.example.com            # DNS lookup
curl -vI https://shop.example.com      # see TLS handshake + response headers
openssl s_client -connect shop.example.com:443 -servername shop.example.com | openssl x509 -noout -dates
```

### URL anatomy
`https://user@shop.example.com:443/products/42?color=red#reviews` → scheme, userinfo, host, port, path, query, fragment (fragment is never sent to the server).

### DNS
Browser cache → OS cache → resolver → root → TLD (`.com`) → authoritative server. Records: `A` (IPv4), `AAAA` (IPv6), `CNAME` (alias), `MX` (mail), `TXT` (verification, SPF), `NS`. TTL controls caching.

### HTTPS / TLS
TLS provides **encryption, integrity and authentication**. In the handshake (TLS 1.3, 1-RTT): client and server agree on a cipher, exchange keys via (EC)DHE, and the server proves identity with a **certificate** signed by a trusted Certificate Authority. Then symmetric encryption is used for speed.

**HSTS** (`Strict-Transport-Security`) tells browsers to always use HTTPS for the domain.

## Browser Storage and Cookies

| | Cookie | localStorage | sessionStorage | IndexedDB |
|---|---|---|---|---|
| Size | ~4 KB | ~5–10 MB | ~5 MB | large (quota-based) |
| Sent to server | automatically with each request | no | no | no |
| Lifetime | `Expires`/`Max-Age` or session | until cleared | tab session | until cleared |
| JS access | unless `HttpOnly` | yes | yes | yes, async |

### Cookie attributes
```http
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```
- `HttpOnly` — JS can't read it (mitigates token theft via XSS).
- `Secure` — HTTPS only.
- `SameSite=Strict|Lax|None` — controls cross-site sending (CSRF protection). `None` requires `Secure`. Browsers default to `Lax`.
- `Domain` / `Path` — scope.

# Intermediate

## Caching on the Web

```nginx nginx.conf
location /assets/ {                      # fingerprinted files: app.3f9a1.js
  add_header Cache-Control "public, max-age=31536000, immutable";
}
location = /index.html {
  add_header Cache-Control "no-cache";   # always revalidate (ETag → 304)
}
location /api/account {
  add_header Cache-Control "private, no-store";
}
```

### HTTP caching headers
- `Cache-Control: max-age=31536000, immutable` — static, fingerprinted assets (`app.3f9a1.js`).
- `Cache-Control: no-cache` — may store, but **must revalidate** before use.
- `Cache-Control: no-store` — never store (sensitive data).
- `Cache-Control: private` (browser only) vs `public`/`s-maxage` (CDN/shared caches).
- `stale-while-revalidate=60` — serve stale while refreshing in the background.

### Validation (conditional requests)
Server sends `ETag: "v5"` or `Last-Modified`. The browser later sends `If-None-Match: "v5"`; if unchanged the server answers **304 Not Modified** with no body.

### Cache layers
Browser memory/disk cache → Service Worker cache → CDN edge → reverse proxy (Nginx/Varnish) → application cache (Redis) → database cache.

### Strategy
HTML: `no-cache` (always revalidate). Hashed JS/CSS/images: one year + `immutable`. API GETs: short `max-age` or `private, no-cache` with ETags.

## CORS (Cross-Origin Resource Sharing)

The **Same-Origin Policy** blocks scripts from reading responses from a different origin (scheme + host + port). CORS is how a server opts in.

### Simple requests
GET/POST/HEAD with simple headers → browser sends the request with `Origin`; it exposes the response only if the server replies `Access-Control-Allow-Origin: https://app.example.com` (or `*`).

### Preflight
Other methods (PUT/DELETE), custom headers (`Authorization`, `Content-Type: application/json`) trigger an `OPTIONS` preflight:
```http
OPTIONS /api/items
Origin: https://app.example.com
Access-Control-Request-Method: DELETE
Access-Control-Request-Headers: authorization

204
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 600
```

### Credentials
To send cookies cross-origin: `fetch(url, { credentials: 'include' })` **and** server `Access-Control-Allow-Credentials: true` with an explicit origin (not `*`).

> [!INTERVIEW]
> CORS is enforced by the **browser**, not the server. curl/Postman ignore it. CORS is not a security mechanism protecting the server — it protects users' data in other origins.

## Authentication: Sessions vs Tokens

### Session-based (stateful)
1. User logs in → server creates a session in a store (Redis/DB) → sends `Set-Cookie: sid=…; HttpOnly`.
2. Browser sends the cookie automatically; server looks up the session.
- ✅ easy revocation, small cookie. ❌ needs shared session store across instances; CSRF considerations.

### Token-based — JWT (stateless)
A JWT = `base64url(header).base64url(payload).signature`.
```json
{ "sub": "42", "role": "admin", "iat": 1729500000, "exp": 1729500900 }
```
- The server **verifies the signature** (HS256 shared secret or RS256/ES256 public key) — no DB lookup.
- The payload is **encoded, not encrypted** — never put secrets in it.
- ❌ hard to revoke before expiry → keep access tokens short-lived (5–15 min) + **refresh tokens** (rotated, stored server-side, `HttpOnly` cookie).

### Where to store tokens in the browser?
`HttpOnly; Secure; SameSite` cookie is safest against XSS theft (add CSRF protection). localStorage is readable by any injected script.

### Password storage
Never store plain or simply-hashed passwords. Use slow, salted algorithms: **bcrypt, scrypt, Argon2id**.

## OAuth 2.0 and OpenID Connect

- **OAuth 2.0** = **authorization** framework: lets an app access resources on a user's behalf ("Allow this app to read your Google Calendar").
- **OpenID Connect (OIDC)** = identity layer on top of OAuth: adds an **ID token** (JWT) for **authentication** ("Sign in with Google").

```http Authorization Code + PKCE
GET https://auth.example.com/authorize?response_type=code
    &client_id=web-app&redirect_uri=https://app.example.com/callback
    &scope=openid%20profile%20email&state=xyz
    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256

POST https://auth.example.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=AUTH_CODE&redirect_uri=https://app.example.com/callback
&client_id=web-app&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```
```json Response
{ "access_token": "eyJ…", "id_token": "eyJ…", "refresh_token": "…", "token_type": "Bearer", "expires_in": 900 }
```

### Roles
Resource owner (user), client (your app), authorization server (Auth0, Keycloak, Okta, Entra ID), resource server (API).

### Authorization Code flow + PKCE (for SPAs and mobile)
1. App creates a random `code_verifier`, sends its hash (`code_challenge`) and redirects the user to the auth server.
2. User logs in and consents.
3. Auth server redirects back with a short-lived **authorization code**.
4. App exchanges code + `code_verifier` for **access token** (+ refresh token, ID token).
5. App calls the API with `Authorization: Bearer <access_token>`.

Other grants: **Client Credentials** (machine-to-machine), Device Code (TVs/CLIs). Implicit and Password grants are deprecated.

### SSO and SAML
SAML is an older XML-based SSO protocol common in enterprises; OIDC is the modern JSON/JWT alternative.

## Real-Time Communication

| Technique | How | Use when |
|---|---|---|
| Short polling | client asks every N seconds | simple, low-frequency |
| Long polling | server holds the request until data | legacy fallback |
| **Server-Sent Events** | one-way server → client stream over HTTP (`text/event-stream`) | notifications, live feeds, LLM token streaming |
| **WebSockets** | full-duplex, persistent TCP after HTTP upgrade | chat, games, collaborative editing |
| WebRTC | peer-to-peer media/data | video calls |

Scaling WebSockets: sticky sessions or a pub/sub backplane (Redis, NATS) so messages reach users connected to other instances.

```js
// Server-Sent Events (server → client)
const es = new EventSource('/api/notifications');
es.onmessage = (e) => showToast(JSON.parse(e.data));

// WebSocket (bi-directional)
const ws = new WebSocket('wss://chat.example.com/room/42');
ws.onopen = () => ws.send(JSON.stringify({ type: 'join', user: 'ada' }));
ws.onmessage = (e) => appendMessage(JSON.parse(e.data));
```
```js Node SSE endpoint
app.get('/api/notifications', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const id = setInterval(() => res.write(`data: ${JSON.stringify({ t: Date.now() })}\n\n`), 5000);
  req.on('close', () => clearInterval(id));
});
```

# Advanced

## OWASP Top Security Risks

### Cross-Site Scripting (XSS)
Attacker injects script that runs in your origin (stored, reflected, DOM-based). Prevent: context-aware output encoding (frameworks auto-escape), avoid `innerHTML`/`dangerouslySetInnerHTML`, sanitize HTML (DOMPurify), strict **CSP** with nonces, `HttpOnly` cookies, Trusted Types.

### Cross-Site Request Forgery (CSRF)
A malicious site makes the user's browser send an authenticated request (cookies attached automatically). Prevent: `SameSite=Lax/Strict` cookies, anti-CSRF tokens (synchronizer or double-submit), checking `Origin`, never changing state on GET.

### SQL / NoSQL / Command injection
Never concatenate user input into queries. Use parameterized queries/ORM, validate input, least-privilege DB users.
```js
// ❌ db.query(`SELECT * FROM users WHERE email = '${email}'`)
// ✅
db.query('SELECT * FROM users WHERE email = $1', [email]);
```

### Other key risks
- **Broken access control / IDOR** — `/orders/123` returning another user's order. Always check ownership server-side.
- **SSRF** — server fetches attacker-supplied URLs reaching internal services (e.g., cloud metadata `169.254.169.254`). Allow-list destinations.
- **Security misconfiguration** — verbose errors, default credentials, open S3 buckets.
- **Vulnerable dependencies** — `npm audit`, Dependabot, SCA scanning, lockfiles.
- **Broken authentication** — no rate limiting, weak password storage, missing MFA.
- **Sensitive data exposure** — enforce TLS, encrypt at rest, minimise logging of PII/secrets.

### Security headers
`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`.

## HTTP/1.1 vs HTTP/2 vs HTTP/3

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Transport | TCP | TCP | **QUIC over UDP** |
| Multiplexing | ❌ (one request per connection at a time; browsers open ~6) | ✅ streams over one connection | ✅ |
| Head-of-line blocking | HTTP level | TCP level (one lost packet stalls all streams) | **eliminated** (per-stream) |
| Headers | text | HPACK compression, binary framing | QPACK |
| Handshake | TCP + TLS | TCP + TLS | combined, 0-RTT resumption |

Consequences: domain sharding and sprite sheets/bundling-everything were HTTP/1 hacks that are less necessary under HTTP/2+. Server Push was deprecated in favour of `103 Early Hints`.

```bash
curl -sI --http1.1 https://example.com | head -1   # HTTP/1.1 200
curl -sI --http2   https://example.com | head -1   # HTTP/2 200
curl -sI --http3   https://example.com | head -1   # HTTP/3 200 (curl built with QUIC)
curl -sI https://example.com | grep -i alt-svc     # alt-svc: h3=":443" advertises HTTP/3
```
```nginx
listen 443 ssl;   http2 on;
listen 443 quic reuseport;  add_header Alt-Svc 'h3=":443"; ma=86400';
```

## Service Workers and Progressive Web Apps

A **Service Worker** is a script running in the background, acting as a programmable network proxy for its scope.

```js sw.js
self.addEventListener('install', (e) => e.waitUntil(caches.open('v1').then(c => c.addAll(['/', '/app.css', '/app.js']))));
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
```

Strategies: **cache-first** (static assets), **network-first** (API/HTML), **stale-while-revalidate**, cache-only, network-only. Workbox simplifies this.

PWA = HTTPS + Web App Manifest + Service Worker → installable, offline-capable, push notifications.

Lifecycle gotcha: a new service worker waits until all tabs using the old one close (unless `skipWaiting()` + `clients.claim()`).

## What Happens When You Type a URL (Full Answer)

1. **URL parsing** and HSTS check; browser may use cache/prefetched DNS.
2. **DNS resolution** (browser → OS → resolver → root/TLD/authoritative).
3. **TCP handshake** (SYN, SYN-ACK, ACK) and **TLS handshake**, or **QUIC** for HTTP/3.
4. **HTTP request** with headers and cookies. Might hit a **CDN** edge, load balancer, reverse proxy, then the application server, which queries caches/databases.
5. **Response** — status, headers (caching, cookies, CSP), body (often compressed with gzip/brotli).
6. **Parsing**: HTML → DOM; discovers CSS/JS/images (preload scanner fetches them early); CSS → CSSOM; JS executes (may block).
7. **Render**: render tree → layout → paint → composite. `DOMContentLoaded` then `load` fire.
8. Subsequent interactions: event loop handles input, network requests, re-renders.

> [!INTERVIEW]
> Tailor depth to the role: frontend roles expect rendering detail; backend roles expect load balancers, TLS, caching and DB detail.

```js Measure each phase with the Navigation Timing API
const [n] = performance.getEntriesByType('navigation');
console.table({
  dns: n.domainLookupEnd - n.domainLookupStart,
  tcpTls: n.connectEnd - n.connectStart,
  ttfb: n.responseStart - n.requestStart,
  download: n.responseEnd - n.responseStart,
  domInteractive: n.domInteractive,
  load: n.loadEventEnd,
});
```

# Interview Questions

## Beginner

### What is the difference between PUT and PATCH?
PUT replaces the entire resource with the request body (idempotent — sending it twice yields the same state). PATCH applies a partial modification; it may or may not be idempotent depending on the operation (e.g., "increment counter" isn't).

```http
PUT /users/42                       # full replacement — omitted fields are cleared
{ "name": "Ada", "email": "ada@x.io", "role": "admin" }

PATCH /users/42                     # partial update
Content-Type: application/merge-patch+json
{ "email": "ada@new.io" }
```

### What is the difference between 401 and 403?
401 Unauthorized actually means **unauthenticated** — no valid credentials; the client should log in. 403 Forbidden means the server knows who you are but you lack permission.

```js
app.delete('/posts/:id', (req, res) => {
  if (!req.user) return res.status(401).set('WWW-Authenticate', 'Bearer').end(); // who are you?
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' }); // not allowed
  // …
});
```

### What does stateless mean in HTTP/REST?
Each request contains all the information needed to process it; the server keeps no client session context between requests. This simplifies horizontal scaling. State lives in the client (tokens) or a shared store.

```http
GET /api/orders?page=2 HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9…   # identity travels with EVERY request
Accept: application/json
# Any server instance can answer — no sticky sessions needed
```

### What is idempotency and why does it matter?
An operation is idempotent if performing it multiple times has the same effect as once. It matters for safe retries after timeouts: GET, PUT, DELETE are idempotent; POST is not, so payments use idempotency keys.

```js
app.post('/payments', async (req, res) => {
  const key = req.get('Idempotency-Key');
  const prev = await redis.get(`idem:${key}`);
  if (prev) return res.status(200).json(JSON.parse(prev)); // retry → same result, no double charge
  const result = await charge(req.body);
  await redis.set(`idem:${key}`, JSON.stringify(result), { EX: 86400 });
  res.status(201).json(result);
});
```

### Cookies vs localStorage vs sessionStorage?
Cookies are small, sent with every request, can be `HttpOnly`/`Secure`/`SameSite` and are used for sessions. localStorage persists indefinitely per origin, JS-accessible, ~5MB. sessionStorage is per-tab and cleared when the tab closes. None of the JS-accessible ones are safe for secrets under XSS.

```js
res.cookie('sid', sessionId, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600_000 }); // server
localStorage.setItem('theme', 'dark');        // UI preference — fine
sessionStorage.setItem('wizardStep', '3');    // per tab
// ❌ localStorage.setItem('accessToken', t)  — readable by any XSS
```

### What is HTTPS and how does it work?
HTTP over TLS. TLS authenticates the server via a CA-signed certificate, negotiates keys with an asymmetric key exchange, then encrypts traffic with fast symmetric ciphers, guaranteeing confidentiality and integrity.

```bash
openssl s_client -connect example.com:443 -servername example.com -brief
# Protocol version: TLSv1.3
# Ciphersuite: TLS_AES_256_GCM_SHA384
# Peer certificate: CN = example.com   ← verified against the CA chain
```
```js Node HTTPS server
https.createServer({ key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') }, app).listen(443);
```

## Intermediate

### What is CORS and how does a preflight request work?
CORS lets servers relax the same-origin policy. For non-simple requests the browser first sends `OPTIONS` with `Origin`, `Access-Control-Request-Method/Headers`. If the server responds with matching `Access-Control-Allow-*` headers, the browser sends the real request. The browser enforces it; non-browser clients aren't affected.

```http
OPTIONS /api/orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type, authorization

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 600
```
```js
app.use(cors({ origin: 'https://app.example.com', credentials: true }));
```

### Explain JWT. What are its pros and cons?
A signed, self-contained token with a header, claims payload and signature. Pros: stateless verification, works across services, carries claims. Cons: hard to revoke, payload is readable, larger than a session id, risk if algorithms are misconfigured (`alg: none`). Mitigate with short expiry, refresh token rotation and a denylist for critical revocations.

```js
const jwt = require('jsonwebtoken');
const token = jwt.sign({ sub: '42', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '15m' });
// header.payload.signature  →  eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0MiJ9.abc…
const claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
// Payload is only base64url — anyone can read it, so never put secrets in it
```

### Session cookies vs JWT — which would you choose?
For a classic web app on one domain, server sessions in `HttpOnly` cookies are simple, revocable and secure. For distributed APIs, mobile clients or service-to-service auth, JWT access tokens (short-lived) with refresh tokens fit better. Many systems combine both (BFF pattern: cookie session to browser, tokens to APIs).

```js
// Server session: revocable by deleting the row
app.use(session({ store: new RedisStore({ client: redis }), secret: process.env.SESSION_SECRET,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 8 * 3600_000 } }));
app.post('/logout', (req, res) => req.session.destroy(() => res.sendStatus(204)));

// JWT: stateless verification in any service
app.use((req, res, next) => { req.user = jwt.verify(req.headers.authorization?.slice(7), publicKey); next(); });
```

### Explain OAuth 2.0 Authorization Code flow with PKCE.
The client redirects the user to the authorization server with a code challenge; after login, the server redirects back with a one-time code; the client exchanges the code plus the original code verifier for tokens over a back channel. PKCE prevents intercepted codes from being redeemed by an attacker. It's the recommended flow for SPAs and mobile apps.

```js Generate the PKCE pair in the browser
const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
sessionStorage.setItem('pkce_verifier', verifier);
location.assign(`https://auth.example.com/authorize?response_type=code&client_id=web&redirect_uri=${encodeURIComponent(cb)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`);

function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
```

### How does HTTP caching work with ETags?
The server returns an `ETag` fingerprint. On subsequent requests the client sends `If-None-Match` with that value; if the resource hasn't changed, the server replies `304 Not Modified` with no body, saving bandwidth. `Cache-Control` decides whether the cache can be used without revalidation at all.

```http
GET /api/products/42            →  200 OK
                                   ETag: "a1b2c3"
                                   Cache-Control: no-cache
GET /api/products/42
If-None-Match: "a1b2c3"         →  304 Not Modified   (no body)
```
```js
app.set('etag', 'strong');   // Express generates ETags and answers 304 automatically
```

### WebSockets vs Server-Sent Events?
WebSockets are bi-directional, binary-capable, custom protocol after upgrade — needed for chat or games. SSE is server→client only over plain HTTP, text-based, auto-reconnects, works with HTTP/2 multiplexing and existing infrastructure — ideal for notifications and streaming LLM output.

```js
// SSE: auto-reconnects, resumes with Last-Event-ID, plain HTTP
const es = new EventSource('/stream'); es.addEventListener('price', (e) => update(e.data));

// WebSocket: full duplex, you handle reconnects yourself
function connect() {
  const ws = new WebSocket('wss://example.com/ws');
  ws.onclose = () => setTimeout(connect, 1000 + Math.random() * 2000); // backoff + jitter
  return ws;
}
```

### What is OIDC and how does it differ from OAuth?
OAuth 2.0 handles delegated authorization (access tokens for APIs). OpenID Connect adds authentication on top: an ID token (JWT) with user identity claims, a `userinfo` endpoint and standard scopes (`openid profile email`).

```json Decoded ID token (OIDC) — identity
{ "iss": "https://auth.example.com", "sub": "248289761001", "aud": "web-app",
  "email": "ada@example.com", "name": "Ada", "iat": 1761200000, "exp": 1761203600, "nonce": "n-0S6" }
```
```http Access token (OAuth) — authorization to call an API
GET /calendar/v3/events
Authorization: Bearer ya29.a0Af…      # scope: calendar.readonly
```

## Advanced

### How do you prevent XSS and CSRF in a modern web app?
XSS: framework auto-escaping, avoid raw HTML sinks or sanitize, strict CSP with nonces/hashes, Trusted Types, `HttpOnly` cookies, validate URLs. CSRF: `SameSite` cookies, CSRF tokens for cookie-authenticated state-changing requests, verify `Origin`/`Referer`, and keep GET side-effect free. Bearer tokens in headers are not CSRF-prone but are more exposed to XSS.

```js
app.use(helmet.contentSecurityPolicy({
  directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`], objectSrc: ["'none'"] },
}));
res.cookie('sid', id, { httpOnly: true, secure: true, sameSite: 'lax' });    // CSRF baseline
app.use(csrf());                                                            // token for state changes
// <form><input type="hidden" name="_csrf" value="<%= csrfToken %>"></form>
```

### What is SSRF and how do you prevent it?
Server-Side Request Forgery: the attacker makes your server fetch a URL of their choosing, reaching internal services or cloud metadata endpoints. Prevent with an allow-list of hosts, blocking private IP ranges after DNS resolution (watch DNS rebinding), disabling redirects, using IMDSv2 on AWS, and network egress controls.

```js
import dns from 'node:dns/promises'; import ipaddr from 'ipaddr.js';
const ALLOWED_HOSTS = new Set(['images.partner.com']);

async function safeFetch(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) throw new Error('blocked host');
  const { address } = await dns.lookup(url.hostname);
  if (ipaddr.parse(address).range() !== 'unicast') throw new Error('private IP'); // blocks 169.254.169.254, 10.x…
  return fetch(url, { redirect: 'error' });
}
```

### Explain HTTP/2 multiplexing and how HTTP/3 improves on it.
HTTP/2 sends many concurrent request/response streams over one TCP connection with binary framing and header compression, solving HTTP-level head-of-line blocking. But one lost TCP packet stalls all streams. HTTP/3 runs over QUIC (UDP) with independent streams, built-in TLS 1.3, faster handshakes and connection migration across networks.

```text
HTTP/1.1: conn1 ─ GET a.js ──────▶ │ conn2 ─ GET b.css ─▶   (≤6 connections, queued)
HTTP/2  : one TCP conn ─ [s1 a.js][s3 b.css][s5 img][s1 a.js]…  interleaved frames
          one lost TCP packet stalls ALL streams
HTTP/3  : QUIC over UDP ─ each stream independent; loss on s3 doesn't block s1
          0-RTT resumption, connection migration (Wi-Fi → 4G)
```

### How would you design API rate limiting?
Identify the client (API key, user, IP). Choose an algorithm: fixed window, sliding window log/counter, token bucket (allows bursts) or leaky bucket (smooth). Store counters in Redis with atomic operations (Lua/INCR+EXPIRE) for distributed enforcement. Return `429` with `Retry-After` and `RateLimit-*` headers. Apply at the gateway/edge as well as per-endpoint.

```lua Token bucket in Redis (atomic Lua script)
-- KEYS[1]=bucket  ARGV: capacity, refill_per_sec, now_ms
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local cap, rate, now = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local tokens = tonumber(b[1]) or cap
local ts = tonumber(b[2]) or now
tokens = math.min(cap, tokens + (now - ts) / 1000 * rate)
local allowed = tokens >= 1
if allowed then tokens = tokens - 1 end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], 60000)
return allowed and 1 or 0
```
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Limit: 100
RateLimit-Remaining: 0
```

### How do you store and rotate refresh tokens safely?
Keep refresh tokens in `HttpOnly; Secure; SameSite=Strict` cookies scoped to the refresh endpoint, store a hash server-side, rotate on every use (issue a new one, invalidate the old), and detect reuse of an old token as theft — revoke the whole token family. Bind to device/session metadata and set absolute expiry.

```js
app.post('/auth/refresh', async (req, res) => {
  const token = req.cookies.rt;
  const row = await db.refreshTokens.findByHash(sha256(token));
  if (!row) return res.sendStatus(401);
  if (row.usedAt) {                         // reuse detected → token theft
    await db.refreshTokens.revokeFamily(row.familyId);
    return res.sendStatus(401);
  }
  await db.refreshTokens.markUsed(row.id);
  const next = randomToken();
  await db.refreshTokens.insert({ hash: sha256(next), familyId: row.familyId, userId: row.userId });
  res.cookie('rt', next, { httpOnly: true, secure: true, sameSite: 'strict', path: '/auth/refresh' });
  res.json({ accessToken: signAccess(row.userId) });
});
```

### What is Content Security Policy and how do you roll it out?
An HTTP header that restricts sources for scripts, styles, images, frames, connections, etc. Start with `Content-Security-Policy-Report-Only` and a `report-to` endpoint to discover violations, remove inline scripts or add nonces/`strict-dynamic`, then enforce. Key directives: `default-src`, `script-src`, `connect-src`, `frame-ancestors`, `object-src 'none'`, `base-uri`.

```http Step 1: observe
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'nonce-r4nd0m' 'strict-dynamic'; object-src 'none'; base-uri 'none'; report-to csp
Reporting-Endpoints: csp="https://example.com/csp-reports"
```
```http Step 2: enforce once reports are clean
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-r4nd0m' 'strict-dynamic'; object-src 'none'; base-uri 'none'
```

# Scenario Questions

## Beginner

### Your front end on `app.example.com` calls `api.example.com` and the browser shows a CORS error. Postman works fine. Why, and how do you fix it?
CORS is enforced by **browsers**, not servers, so Postman ignores it. The API must answer with `Access-Control-Allow-Origin: https://app.example.com`. If it uses cookies or credentials, it also needs `Access-Control-Allow-Credentials: true`, and the origin can't be `*`. Non-simple requests (JSON body, custom headers) send an `OPTIONS` **preflight** first, which must be answered with `Allow-Methods`/`Allow-Headers`. In development you can proxy through the dev server instead.

```js api.example.com
app.use(cors({
  origin: ['https://app.example.com'],     // exact origin, not '*', when sending cookies
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// front end
fetch('https://api.example.com/me', { credentials: 'include' });
```

### Users stay logged in on a shared computer after closing the browser. What do you check?
- Session cookies with a long `Max-Age`/`Expires` ("remember me" turned on by default).
- Refresh tokens kept forever in `localStorage`.
- No server-side session expiry, or logout that doesn't revoke the session or refresh token.

Use short session lifetimes, server-side revocation, an idle timeout, and make "remember me" opt-in.

```js
// Session cookie (no maxAge) → removed when the browser session ends
res.cookie('sid', id, { httpOnly: true, secure: true, sameSite: 'lax' });
// "Remember me" only when ticked
if (req.body.remember) res.cookie('sid', id, { ...opts, maxAge: 30 * 864e5 });
// Server-side idle + absolute timeouts
if (Date.now() - session.lastSeen > 30 * 60e3 || Date.now() - session.created > 12 * 3600e3) destroy(session);
```

## Intermediate

### After a deploy, some users see a broken page until they hard-refresh. What's going on?
Their cached `index.html` references old asset files (or new HTML references assets they don't have yet). Fix it with a caching strategy:
- `index.html` gets `Cache-Control: no-cache`, so it is revalidated on every request.
- Fingerprinted assets (`app.3f9a.js`) get `Cache-Control: public, max-age=31536000, immutable`.
- Keep old assets available for a while after a deploy.
- If you use a service worker, version it and prompt users to reload.

```text Cache-Control strategy
/index.html            → Cache-Control: no-cache            (always revalidate)
/assets/app.7c1d2.js   → Cache-Control: max-age=31536000, immutable
Keep the previous release's assets on the CDN for a while so old HTML still works.
```
```js Recover from a missing lazy chunk
window.addEventListener('vite:preloadError', () => location.reload());
```

### A security review flags that your app is vulnerable to CSRF. You use cookie sessions. What do you do?
- Set the cookie to `SameSite=Lax` (or `Strict`), plus `Secure` and `HttpOnly`.
- Require a **CSRF token** (synchronizer or double-submit) on state-changing requests.
- Never change state on `GET`.
- Check the `Origin`/`Referer` header for unsafe methods.

Bearer tokens in an `Authorization` header aren't sent automatically by the browser, so they're not vulnerable to CSRF, but tokens stored in JavaScript-readable storage are exposed to XSS.

```js
res.cookie('sid', id, { httpOnly: true, secure: true, sameSite: 'strict' });
// Double-submit token
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      req.get('X-CSRF-Token') !== req.cookies['csrf']) return res.sendStatus(403);
  next();
});
// Never change state on GET: app.get('/delete/:id') ❌ → app.delete('/items/:id') ✅
```

## Advanced

### Your API is hit by credential-stuffing attacks: millions of login attempts from many IPs. How do you defend it?
- **Rate limit** by account, IP and device fingerprint, with progressive delays.
- Use **bot detection** (a CAPTCHA or challenge after failures) and a WAF.
- Check passwords against breach lists (HIBP k-anonymity), and require MFA.
- Return generic error messages and use constant-time comparisons.
- Monitor failure-rate anomalies and alert on them.
- Lock out softly (step-up verification) rather than hard-locking, so attackers can't lock real users out.

```js
const limiter = new RateLimiterRedis({ storeClient: redis, keyPrefix: 'login', points: 5, duration: 900 });
app.post('/login', async (req, res) => {
  const key = `${req.body.email}:${req.ip}`;
  try { await limiter.consume(key); } catch { return res.status(429).set('Retry-After', '900').end(); }
  if (await isPwned(req.body.password)) return res.status(400).json({ error: 'Choose another password' });
  // verify, then require MFA for new devices
});
```

# Tricky Questions

## Beginner

### Is `PUT` idempotent? Is `POST`? Is `PATCH`?
`PUT` **is** idempotent: sending the same full replacement twice leaves the same state. `POST` is **not**: it may create two resources. `PATCH` is **not guaranteed** to be: `{ "op": "increment" }` isn't. To make POST safe to retry, use an **Idempotency-Key** header that the server deduplicates on.

```http
PUT   /cart/items/7  { "qty": 2 }          # x2 → qty is 2      ✅ idempotent
POST  /orders        { "sku": "A" }        # x2 → two orders    ❌
PATCH /counter       { "op": "inc" }       # x2 → +2            ❌ not guaranteed
PATCH /users/1       { "name": "Ada" }     # x2 → same state    ✅ this one happens to be
```

### Which status code should "logged in, but not allowed to delete this" return: 401 or 403?
**403 Forbidden.** **401 Unauthorized** really means *unauthenticated*: no credentials or invalid credentials, so log in. Some APIs return **404** to hide that the resource exists.

```js
if (!req.user) return res.sendStatus(401);                       // not authenticated
if (doc.ownerId !== req.user.id) return res.sendStatus(403);     // authenticated, not allowed
// or 404 to avoid revealing the document exists
```

## Intermediate

### A cookie is set with `Domain=example.com; Path=/app; SameSite=Lax`. Is it sent on a `fetch` POST from `evil.com` to `example.com/app/transfer`?
**No.** `SameSite=Lax` cookies are sent on cross-site **top-level GET navigations** only, not on cross-site POSTs, iframes or `fetch`. That's why Lax is a solid CSRF defence. With `SameSite=None; Secure` the cookie would be sent.

```js
// On evil.com
fetch('https://example.com/app/transfer', { method: 'POST', credentials: 'include', body: 'to=attacker' });
// → cookie NOT sent (Lax blocks cross-site subresource requests)
// <a href="https://example.com/app/home"> clicked on evil.com → cookie IS sent (top-level GET)
```

### Your JWT is signed with HS256. An attacker changes the header to `"alg": "none"`. What happens?
A vulnerable library accepts the unsigned token as valid. Always **pin the expected algorithm** when verifying (`jwt.verify(token, key, { algorithms: ['HS256'] })`) and reject `none`. The related attack is RS256→HS256 confusion, where the public key gets used as an HMAC secret.

```js
// ❌ vulnerable pattern: trusting the token's own header
const decoded = jwt.decode(token, { complete: true });
// ✅ pin the algorithm (and issuer/audience)
const claims = jwt.verify(token, process.env.JWT_SECRET, {
  algorithms: ['HS256'], issuer: 'https://auth.example.com', audience: 'api',
});
```
