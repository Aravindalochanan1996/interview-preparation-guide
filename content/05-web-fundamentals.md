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

# Interview Questions

## Beginner

### What is the difference between PUT and PATCH?
PUT replaces the entire resource with the request body (idempotent — sending it twice yields the same state). PATCH applies a partial modification; it may or may not be idempotent depending on the operation (e.g., "increment counter" isn't).

### What is the difference between 401 and 403?
401 Unauthorized actually means **unauthenticated** — no valid credentials; the client should log in. 403 Forbidden means the server knows who you are but you lack permission.

### What does stateless mean in HTTP/REST?
Each request contains all the information needed to process it; the server keeps no client session context between requests. This simplifies horizontal scaling. State lives in the client (tokens) or a shared store.

### What is idempotency and why does it matter?
An operation is idempotent if performing it multiple times has the same effect as once. It matters for safe retries after timeouts: GET, PUT, DELETE are idempotent; POST is not, so payments use idempotency keys.

### Cookies vs localStorage vs sessionStorage?
Cookies are small, sent with every request, can be `HttpOnly`/`Secure`/`SameSite` and are used for sessions. localStorage persists indefinitely per origin, JS-accessible, ~5MB. sessionStorage is per-tab and cleared when the tab closes. None of the JS-accessible ones are safe for secrets under XSS.

### What is HTTPS and how does it work?
HTTP over TLS. TLS authenticates the server via a CA-signed certificate, negotiates keys with an asymmetric key exchange, then encrypts traffic with fast symmetric ciphers, guaranteeing confidentiality and integrity.

## Intermediate

### What is CORS and how does a preflight request work?
CORS lets servers relax the same-origin policy. For non-simple requests the browser first sends `OPTIONS` with `Origin`, `Access-Control-Request-Method/Headers`. If the server responds with matching `Access-Control-Allow-*` headers, the browser sends the real request. The browser enforces it; non-browser clients aren't affected.

### Explain JWT. What are its pros and cons?
A signed, self-contained token with a header, claims payload and signature. Pros: stateless verification, works across services, carries claims. Cons: hard to revoke, payload is readable, larger than a session id, risk if algorithms are misconfigured (`alg: none`). Mitigate with short expiry, refresh token rotation and a denylist for critical revocations.

### Session cookies vs JWT — which would you choose?
For a classic web app on one domain, server sessions in `HttpOnly` cookies are simple, revocable and secure. For distributed APIs, mobile clients or service-to-service auth, JWT access tokens (short-lived) with refresh tokens fit better. Many systems combine both (BFF pattern: cookie session to browser, tokens to APIs).

### Explain OAuth 2.0 Authorization Code flow with PKCE.
The client redirects the user to the authorization server with a code challenge; after login, the server redirects back with a one-time code; the client exchanges the code plus the original code verifier for tokens over a back channel. PKCE prevents intercepted codes from being redeemed by an attacker. It's the recommended flow for SPAs and mobile apps.

### How does HTTP caching work with ETags?
The server returns an `ETag` fingerprint. On subsequent requests the client sends `If-None-Match` with that value; if the resource hasn't changed, the server replies `304 Not Modified` with no body, saving bandwidth. `Cache-Control` decides whether the cache can be used without revalidation at all.

### WebSockets vs Server-Sent Events?
WebSockets are bi-directional, binary-capable, custom protocol after upgrade — needed for chat or games. SSE is server→client only over plain HTTP, text-based, auto-reconnects, works with HTTP/2 multiplexing and existing infrastructure — ideal for notifications and streaming LLM output.

### What is OIDC and how does it differ from OAuth?
OAuth 2.0 handles delegated authorization (access tokens for APIs). OpenID Connect adds authentication on top: an ID token (JWT) with user identity claims, a `userinfo` endpoint and standard scopes (`openid profile email`).

## Advanced

### How do you prevent XSS and CSRF in a modern web app?
XSS: framework auto-escaping, avoid raw HTML sinks or sanitize, strict CSP with nonces/hashes, Trusted Types, `HttpOnly` cookies, validate URLs. CSRF: `SameSite` cookies, CSRF tokens for cookie-authenticated state-changing requests, verify `Origin`/`Referer`, and keep GET side-effect free. Bearer tokens in headers are not CSRF-prone but are more exposed to XSS.

### What is SSRF and how do you prevent it?
Server-Side Request Forgery: the attacker makes your server fetch a URL of their choosing, reaching internal services or cloud metadata endpoints. Prevent with an allow-list of hosts, blocking private IP ranges after DNS resolution (watch DNS rebinding), disabling redirects, using IMDSv2 on AWS, and network egress controls.

### Explain HTTP/2 multiplexing and how HTTP/3 improves on it.
HTTP/2 sends many concurrent request/response streams over one TCP connection with binary framing and header compression, solving HTTP-level head-of-line blocking. But one lost TCP packet stalls all streams. HTTP/3 runs over QUIC (UDP) with independent streams, built-in TLS 1.3, faster handshakes and connection migration across networks.

### How would you design API rate limiting?
Identify the client (API key, user, IP). Choose an algorithm: fixed window, sliding window log/counter, token bucket (allows bursts) or leaky bucket (smooth). Store counters in Redis with atomic operations (Lua/INCR+EXPIRE) for distributed enforcement. Return `429` with `Retry-After` and `RateLimit-*` headers. Apply at the gateway/edge as well as per-endpoint.

### How do you store and rotate refresh tokens safely?
Keep refresh tokens in `HttpOnly; Secure; SameSite=Strict` cookies scoped to the refresh endpoint, store a hash server-side, rotate on every use (issue a new one, invalidate the old), and detect reuse of an old token as theft — revoke the whole token family. Bind to device/session metadata and set absolute expiry.

### What is Content Security Policy and how do you roll it out?
An HTTP header that restricts sources for scripts, styles, images, frames, connections, etc. Start with `Content-Security-Policy-Report-Only` and a `report-to` endpoint to discover violations, remove inline scripts or add nonces/`strict-dynamic`, then enforce. Key directives: `default-src`, `script-src`, `connect-src`, `frame-ancestors`, `object-src 'none'`, `base-uri`.
