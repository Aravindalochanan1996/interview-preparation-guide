---
id: system-design
title: System Design
short: System Design
category: Architecture
order: 20
color: #0f766e
icon: SD
summary: The interview framework, scalability building blocks, caching, load balancing, databases, messaging, microservices, reliability patterns and classic case studies (URL shortener, chat, feed, rate limiter).
---

# Beginner

## How to Approach a System Design Interview

System design rounds test structured thinking and trade-off reasoning, not one "correct" answer. Use a repeatable framework (~45 min):

1. **Clarify requirements (5 min)**
   - **Functional**: what must the system do? (post tweets, follow users, view timeline)
   - **Non-functional**: scale, latency, availability, consistency, durability, security, cost.
   - Out of scope items — say them explicitly.
2. **Estimate scale (3–5 min)** — users, QPS (read vs write), storage, bandwidth.
3. **Define the API** — key endpoints/events.
4. **Data model** — entities, relationships, choice of storage.
5. **High-level design** — boxes and arrows: clients, LB, services, DBs, caches, queues.
6. **Deep dives** — bottlenecks, scaling the hot path, failure handling, the interviewer's interests.
7. **Wrap up** — trade-offs, monitoring, future improvements.

> [!TIP]
> Think aloud, state assumptions, and always justify choices with trade-offs: "I'd choose X because… the downside is… which is acceptable here because…".

```text Whiteboard template you can fill in for any question
1. Requirements   F: post, follow, feed      NF: 100M DAU, p99 feed < 200 ms, 99.99%
2. Estimates      writes 5K/s, reads 500K/s, storage 1 KB × 500M posts/day ≈ 0.5 TB/day
3. API            POST /posts {text}  ·  GET /feed?cursor=…  ·  POST /follow/{id}
4. Data model     posts(id, user_id, text, ts) · follows(follower, followee) · feed cache
5. High level     client → CDN → LB → API → cache / DB / queue → workers
6. Deep dive      fan-out strategy, hot users, pagination, cache invalidation
7. Trade-offs     consistency vs latency, cost, failure modes, what I'd monitor
```

## Back-of-the-Envelope Estimation

```python
dau = 100e6
reads_per_user, writes_per_user = 50, 2
avg_qps_read = dau * reads_per_user / 86_400          # ≈ 58K QPS
peak_qps_read = avg_qps_read * 3                      # ≈ 174K QPS
storage_per_day = dau * writes_per_user * 1_000       # 1 KB/post → 200 GB/day
storage_5y = storage_per_day * 365 * 5 / 1e12         # ≈ 365 TB (before replication ×3)
servers = peak_qps_read / 5_000                       # ~5K QPS per app server → ~35 servers
print(round(avg_qps_read), round(peak_qps_read), storage_per_day / 1e9, round(storage_5y), round(servers))
```

### Handy numbers
| Quantity | Value |
|---|---|
| Seconds per day | ~86,400 ≈ **10⁵** |
| 1 million requests/day | ≈ **12 QPS** |
| 100M DAU × 10 req/day | 1B/day ≈ **12K QPS** average; peak ≈ 2–3× |
| Char | 1 byte (ASCII); UUID 16 bytes; timestamp 8 bytes |
| 1 KB × 1M | 1 GB |

### Latency numbers (orders of magnitude)
| Operation | Time |
|---|---|
| L1 cache reference | ~1 ns |
| Main memory reference | ~100 ns |
| Read 1 MB from memory | ~3–10 µs |
| SSD random read | ~16–100 µs |
| Round trip within a datacenter | ~0.5 ms |
| Read 1 MB from SSD | ~50 µs–1 ms |
| Disk seek (HDD) | ~10 ms |
| Round trip US ↔ Europe | ~150 ms |

### Example: photo-sharing storage
100M uploads/day × 500 KB avg = 50 TB/day → ~18 PB/year (before replication ×3). Conclusion: blob storage (S3) + CDN, metadata in a database.

## Core Building Blocks

| Component | Role |
|---|---|
| **DNS** | resolves domain to IPs; can do geo-routing |
| **CDN** | caches static (and some dynamic) content at the edge near users |
| **Load balancer** | distributes traffic across servers; health checks; TLS termination |
| **API gateway** | auth, rate limiting, routing, request transformation for microservices |
| **Application servers** | stateless business logic, horizontally scalable |
| **Cache** (Redis/Memcached) | low-latency reads of hot data |
| **Database** | source of truth (SQL/NoSQL) |
| **Object storage** (S3) | images, videos, backups — cheap and durable |
| **Message queue / stream** | async processing, decoupling, buffering (SQS, RabbitMQ, Kafka) |
| **Search index** | full-text search (Elasticsearch/OpenSearch) |
| **Observability** | logs, metrics, traces, alerting |

```text
            ┌──────── DNS (geo routing) ────────┐
Client ──▶ CDN (static, cached GETs) ──▶ Load balancer (TLS, health checks)
                                             │
                                      API gateway (auth, rate limit)
                                             │
                     ┌──────────── services (stateless) ────────────┐
                     │                    │                          │
               Redis cache          PostgreSQL (primary +       Kafka / SQS ──▶ workers
                                     read replicas)                         ──▶ S3 (blobs)
```

### Vertical vs horizontal scaling
- **Vertical** (scale up) — bigger machine. Simple, hard limit, single point of failure.
- **Horizontal** (scale out) — more machines. Requires **stateless** services (sessions in Redis/tokens), load balancing, data partitioning.

## Key Non-Functional Concepts

- **Latency** — time for one request (watch p95/p99, not just averages). **Throughput** — requests per unit time.
- **Availability** — % uptime: 99.9% ("three nines") ≈ 8.8 h downtime/year; 99.99% ≈ 53 min/year; 99.999% ≈ 5 min/year. Serial dependencies multiply: two 99.9% services in series ≈ 99.8%.
- **Reliability / fault tolerance** — keeps working when parts fail (redundancy, failover).
- **Scalability** — handles growth by adding resources.
- **Consistency** — all readers see the latest write (strong) vs eventually (eventual).
- **Durability** — data isn't lost once acknowledged (replication, backups).
- **SLI / SLO / SLA** — indicator (measured p99 latency), objective (p99 < 300 ms for 99.9% of the month), agreement (contractual, with penalties). **Error budget** = 100% − SLO.

```python Availability maths
def downtime_per_year(availability):
    return (1 - availability) * 365 * 24 * 60   # minutes
print(downtime_per_year(0.999), downtime_per_year(0.9999))   # 525.6, 52.6

serial = 0.999 * 0.999 * 0.999          # 3 dependencies in a chain → 99.7%
parallel = 1 - (1 - 0.99) ** 2          # 2 redundant replicas → 99.99%
print(serial, parallel)
```

# Intermediate

## Load Balancing

```nginx
upstream api {
  least_conn;                          # or: hash $remote_addr consistent;
  server 10.0.1.10:8080 max_fails=3 fail_timeout=10s;
  server 10.0.1.11:8080 max_fails=3 fail_timeout=10s;
  server 10.0.1.12:8080 backup;
}
server {
  listen 443 ssl;
  location /api/ { proxy_pass http://api; proxy_next_upstream error timeout http_502; }
}
```

### Algorithms
Round robin, weighted round robin, **least connections**, least response time, IP hash / **consistent hashing** (session affinity, cache locality), random with two choices.

### Layer 4 vs Layer 7
- **L4** (transport) — routes by IP/port; very fast; no HTTP awareness (NLB, HAProxy TCP).
- **L7** (application) — routes by URL path, headers, cookies; TLS termination, retries, compression (ALB, NGINX, Envoy).

### High availability
Active-passive or active-active LB pairs, health checks, connection draining, multiple availability zones, global load balancing with DNS/anycast across regions.

## Caching Strategies

```python Cache-aside with stampede protection
def get_product(pid):
    key = f"product:{pid}"
    if (hit := redis.get(key)) is not None:
        return json.loads(hit)
    if redis.set(f"lock:{key}", 1, nx=True, ex=5):            # only one caller rebuilds
        row = db.fetch_product(pid)
        redis.set(key, json.dumps(row), ex=300 + random.randint(0, 60))   # jittered TTL
        redis.delete(f"lock:{key}")
        return row
    time.sleep(0.05)
    return get_product(pid)                                   # others wait briefly and retry

def update_product(pid, data):
    db.update_product(pid, data)
    redis.delete(f"product:{pid}")                            # invalidate after write
```

### Where to cache
Browser → CDN → reverse proxy → application (in-memory) → distributed cache (Redis) → database buffer pool.

### Patterns
| Pattern | How | Trade-off |
|---|---|---|
| **Cache-aside** | app reads cache; on miss, reads DB and fills cache | simple, most common; first request slow; possible stale data |
| **Read-through** | cache loads from DB itself on miss | cleaner app code |
| **Write-through** | write cache + DB synchronously | consistent; slower writes |
| **Write-behind** | write cache; flush DB async | fast writes; risk of data loss |
| **Write-around** | write DB only; cache filled on read | avoids caching rarely-read data |

### Eviction
LRU (most common), LFU, FIFO, TTL-based.

### Pitfalls
- **Invalidation** ("one of the two hard problems") — delete-on-write, TTLs, events.
- **Thundering herd / stampede** — many misses at once: request coalescing, locks, stale-while-revalidate, jittered TTLs.
- **Hot keys** — replicate hot keys, local in-process caches.
- **Cache penetration** — negative caching, Bloom filters.

## Databases at Scale

```python Consistent-hash sharding
import bisect, hashlib
class Ring:
    def __init__(self, nodes, vnodes=100):
        self.ring = sorted((self._h(f"{n}#{i}"), n) for n in nodes for i in range(vnodes))
        self.keys = [h for h, _ in self.ring]
    def _h(self, s): return int(hashlib.md5(s.encode()).hexdigest(), 16)
    def node_for(self, key):
        i = bisect.bisect(self.keys, self._h(key)) % len(self.keys)
        return self.ring[i][1]

ring = Ring(["db-0", "db-1", "db-2"])
ring.node_for("user:42")     # adding db-3 moves only ~1/4 of the keys
```

### Choosing a store
- **Relational (Postgres/MySQL)** — transactions, joins, strong consistency; default choice.
- **Key-value (DynamoDB, Redis)** — simple access by key at massive scale.
- **Wide-column (Cassandra)** — huge write throughput, time-series, partition-key queries.
- **Document (MongoDB)** — flexible nested data.
- **Search (Elasticsearch)**, **graph (Neo4j)**, **time-series (TimescaleDB, InfluxDB)**, **vector (pgvector)**.

### Replication
- **Leader–follower** — writes to the leader, reads from replicas (replication lag → stale reads; read-your-own-writes by reading from leader after writes).
- **Multi-leader** — writes in multiple regions; conflict resolution needed.
- **Leaderless** (Dynamo-style) — quorum reads/writes: `W + R > N` for strong-ish consistency.
- Sync vs async replication: durability vs latency.

### Partitioning / sharding
Split data across nodes by **range** (easy range scans, hot spots risk), **hash** (even spread, no range queries), **directory/lookup**, or geography. **Consistent hashing** minimises data movement when nodes change (virtual nodes smooth distribution).

### CAP theorem
During a network partition, choose **consistency** (reject/queue some requests — CP: HBase, etcd, Spanner-like) or **availability** (serve possibly stale data — AP: Cassandra, DynamoDB defaults). Without partitions, the trade-off is latency vs consistency (PACELC).

### Consistency models
Strong (linearizable) → sequential → causal → read-your-writes → monotonic reads → eventual.

## Asynchronous Processing and Messaging

```python Producer returns fast; consumers do the heavy work
@app.post("/videos")
def upload(file):
    vid = storage.put(file)
    kafka.produce("video.uploaded", key=vid, value=json.dumps({"id": vid}))
    return {"id": vid, "status": "processing"}, 202

# worker (consumer group "transcoder")
for msg in consumer:                            # scale by adding consumers (≤ partitions)
    job = json.loads(msg.value)
    if already_done(job["id"]): continue         # idempotent: at-least-once delivery
    transcode(job["id"]); consumer.commit(msg)
```

### Message queue vs event stream
| Queue (RabbitMQ, SQS) | Log/stream (Kafka, Kinesis, Pulsar) |
|---|---|
| message consumed by one worker, then deleted | durable ordered log; many consumer groups read independently |
| task distribution, work queues | event sourcing, analytics, replay, high throughput |
| per-message ack, routing | ordering within a **partition**, offsets, retention |

### Delivery semantics
- **At-most-once** — may lose messages.
- **At-least-once** — may duplicate → consumers must be **idempotent** (dedupe by message id).
- **Exactly-once** — hard; approximated with idempotence + transactions (Kafka EOS within its ecosystem).

### Patterns
- **Pub/Sub** fan-out to many subscribers.
- **Dead-letter queue** for poison messages.
- **Backpressure** and consumer autoscaling on queue depth.
- **Outbox pattern** — write business data + an "outbox" event in the same DB transaction; a relay publishes it → no lost/dual-write inconsistencies.
- **CDC** (Debezium) — stream DB changes as events.

## Microservices vs Monolith

| Monolith | Microservices |
|---|---|
| one deployable unit | many independently deployable services |
| simple to develop, test, deploy initially | team autonomy, independent scaling and tech choices |
| in-process calls, ACID transactions | network calls, distributed data, eventual consistency |
| scaling = whole app | fine-grained scaling |
| risk: big ball of mud | risk: distributed monolith, operational complexity |

Start with a **modular monolith**; extract services along **bounded contexts** (Domain-Driven Design) when team size, scaling or deployment independence demands it.

```text Modular monolith → extract when needed
shop/ (one deployable)
  orders/    public: OrderService      ─┐
  payments/  public: PaymentService     ├─ in-process calls, one DB, ACID transactions
  catalog/   public: CatalogService    ─┘
Extract "payments" later: same interface, now over HTTP/events, own DB, own deploy pipeline
```

### Microservice essentials
- **Database per service** (no shared DB), communicate via APIs/events.
- **Service discovery**, API gateway, **BFF** (backend-for-frontend).
- **Sagas** for distributed transactions: **choreography** (services react to events) or **orchestration** (a coordinator directs steps), with compensating actions.
- **CQRS** — separate write model from read models (denormalised views).
- **Event sourcing** — store state changes as an append-only event log.
- Observability: correlation IDs, distributed tracing (OpenTelemetry), centralised logs, metrics.

# Advanced

## Reliability and Resilience Patterns

- **Timeouts** on every network call (no infinite waits).
- **Retries with exponential backoff + jitter** — only for idempotent operations; cap attempts; retry budgets to avoid retry storms.
- **Circuit breaker** — after repeated failures, fail fast for a while, then half-open probe (Resilience4j, Envoy, Istio).
- **Bulkheads** — isolate resources (thread pools, connection pools) per dependency so one failure doesn't sink everything.
- **Rate limiting & load shedding** — protect services; prioritise critical traffic; return 429/503 early.
- **Graceful degradation** — serve cached/partial results, disable non-critical features.
- **Idempotency keys** — safe retries of writes (payments).
- **Health checks & auto-healing**, redundancy across **availability zones/regions**.
- **Disaster recovery**: RPO (max data loss) and RTO (max downtime); backup/restore → pilot light → warm standby → active-active.
- **Chaos engineering** — inject failures deliberately to verify resilience.

```python Timeout + retry with backoff and jitter + circuit breaker
import random, time
def call_with_retry(fn, attempts=4, base=0.2, cap=3):
    for i in range(attempts):
        try:
            return fn(timeout=2)                       # always set a timeout
        except TransientError:
            if i == attempts - 1: raise
            time.sleep(random.uniform(0, min(cap, base * 2 ** i)))   # full jitter

class CircuitBreaker:
    def __init__(self, threshold=5, cooldown=30): self.fail, self.open_until, self.t, self.c = 0, 0, threshold, cooldown
    def call(self, fn):
        if time.time() < self.open_until: raise CircuitOpen()        # fail fast, use fallback
        try: r = fn(); self.fail = 0; return r
        except Exception:
            self.fail += 1
            if self.fail >= self.t: self.open_until = time.time() + self.c
            raise
```

## Case Study: URL Shortener

**Requirements**: shorten long URLs, redirect fast, optional custom alias & expiry, analytics. 100M new URLs/month, read:write ≈ 100:1.

**Estimates**: ~40 writes/s, ~4K reads/s (peak ×3). 5 years ≈ 6B URLs × ~500 B ≈ 3 TB.

**API**
```text
POST /api/urls { longUrl, alias?, expiresAt? } → { shortUrl }
GET  /{code} → 301/302 redirect
```

**Key generation** — 7 chars of base62 = 62⁷ ≈ 3.5 trillion codes.
- Hash (MD5/SHA) of URL → take 7 chars → collision handling needed.
- **Counter + base62 encode** — unique; use a distributed ID generator (Snowflake) or pre-allocated ranges per server to avoid a single counter bottleneck; codes become guessable (add obfuscation if needed).
- **Pre-generated key service** — keys generated offline, servers fetch batches.

**Storage** — key-value or SQL: `code (PK) → long_url, user_id, created_at, expires_at`. Read-heavy → **cache** hot codes in Redis (cache-aside, LRU), CDN/edge for popular redirects.

**Redirect choice** — **301** (permanent, cached by browsers → less load, worse analytics) vs **302** (temporary → every hit reaches you → better analytics).

**Analytics** — publish click events to Kafka asynchronously; aggregate into an analytics store; never slow down the redirect.

## Case Study: Chat System (WhatsApp/Slack-like)

**Requirements**: 1:1 and group chat, online presence, delivery/read receipts, history, push notifications; low latency; 50M DAU.

**Design**
- Clients hold a persistent **WebSocket** connection to a **chat gateway** fleet (stateful connections). A connection registry (Redis) maps `user → gateway server`.
- Sending: client → gateway → **chat service** assigns a message id (time-sortable, e.g., Snowflake), persists to a message store, then routes to recipients' gateways (via pub/sub or direct RPC). Offline recipients → **push notification** service (APNs/FCM).
- **Message store**: write-heavy, query by conversation + time → wide-column store (Cassandra/ScyllaDB) partitioned by `conversation_id`, clustered by `message_id`.
- **Ordering**: per-conversation sequence numbers; clients reorder and dedupe by id.
- **Delivery semantics**: at-least-once with client-side dedupe; ack flow drives sent/delivered/read receipts.
- **Group chat**: fan-out on write for small groups; for very large channels, fan-out on read.
- **Presence**: heartbeats with TTL in Redis; publish changes to friends lazily to avoid fan-out storms.
- **Media**: upload directly to object storage via pre-signed URLs; send only references in messages; CDN for delivery.
- **End-to-end encryption** (Signal protocol): server stores only ciphertext.

```python Message send path
async def on_message(ws, msg):                       # gateway holds the WebSocket
    msg_id = snowflake()
    await cassandra.insert("messages", {"conv_id": msg.conv, "msg_id": msg_id, "from": ws.user, "body": msg.body})
    for member in await members(msg.conv):
        gw = await redis.get(f"presence:{member}")    # which gateway holds their connection?
        if gw: await redis.publish(f"gw:{gw}", json.dumps({"to": member, "id": msg_id, "body": msg.body}))
        else:  await push_queue.send({"to": member, "id": msg_id})   # offline → push notification
    await ws.send(json.dumps({"ack": msg_id}))        # single tick: server received
```

## Case Study: News Feed / Timeline

**Requirements**: users post; followers see a reverse-chronological or ranked feed; feed load < 200 ms.

```python Hybrid fan-out
CELEB_THRESHOLD = 100_000
def on_post(author, post_id):
    if follower_count(author) < CELEB_THRESHOLD:
        for f in followers(author):                     # fan-out on write
            redis.lpush(f"feed:{f}", post_id); redis.ltrim(f"feed:{f}", 0, 799)

def get_feed(user, limit=50):
    ids = redis.lrange(f"feed:{user}", 0, limit)        # precomputed part
    for celeb in followed_celebrities(user):            # fan-out on read for celebrities
        ids += recent_posts(celeb, limit=10)
    return rank(hydrate(ids))[:limit]
```

### Fan-out on write (push)
On post, insert the post id into each follower's precomputed feed (Redis list / feed table). **Fast reads**, but expensive for celebrities with millions of followers.

### Fan-out on read (pull)
At read time, fetch recent posts from everyone the user follows and merge. **Cheap writes**, slow reads for users following many accounts.

### Hybrid (what real systems do)
Push for normal users; **pull for celebrity accounts** and merge at read time. Cache feeds for active users only; rebuild for inactive users on demand.

**Other pieces**: post service + object storage + CDN for media; social graph service; ranking service (ML features: engagement, recency, affinity); pagination with cursors; async workers consuming a "post created" event stream for fan-out.

## Case Study: Distributed Rate Limiter

**Requirements**: limit requests per user/API key/IP (e.g., 100 req/min), low latency overhead, distributed across many gateway instances, clear client feedback.

```python Sliding-window counter in Redis
def allow(user_id, limit=100, window=60):
    now = time.time()
    cur = int(now // window)
    k_cur, k_prev = f"rl:{user_id}:{cur}", f"rl:{user_id}:{cur - 1}"
    pipe = redis.pipeline()
    pipe.incr(k_cur); pipe.expire(k_cur, window * 2); pipe.get(k_prev)
    cur_count, _, prev_count = pipe.execute()
    elapsed = (now % window) / window
    estimated = int(prev_count or 0) * (1 - elapsed) + cur_count
    return estimated <= limit
# Response when blocked: 429 + Retry-After + RateLimit-Remaining headers
```

### Algorithms
| Algorithm | Behaviour | Notes |
|---|---|---|
| Fixed window counter | count per minute bucket | simple; burst at window edges (2× limit) |
| Sliding window log | store each timestamp | precise; memory heavy |
| Sliding window counter | weighted mix of current + previous window | good accuracy, cheap — common choice |
| **Token bucket** | tokens refill at rate r, bucket size b allows bursts | flexible, widely used (AWS, Stripe) |
| Leaky bucket | queue drains at constant rate | smooths traffic |

### Implementation
- Counters in **Redis** with atomic operations (Lua script or `INCR` + `EXPIRE`) shared by all gateway nodes; local in-memory pre-checks to reduce Redis calls for very high QPS.
- Rules configurable per tier/endpoint.
- Responses: `429 Too Many Requests` + `Retry-After` and `RateLimit-Limit/Remaining/Reset` headers.
- Failure mode: if Redis is down, **fail open** (allow) for availability or **fail closed** for protection — decide per use case.
- Place at the edge/API gateway, and also per service for internal protection.

## More Classic Problems to Practise

| System | Key challenges |
|---|---|
| **Video streaming** (YouTube/Netflix) | upload pipeline, transcoding to multiple bitrates (HLS/DASH), CDN, adaptive bitrate, recommendations |
| **Ride sharing** (Uber) | real-time location updates, geospatial indexing (geohash/quadtree/H3), matching, surge pricing, trip state machine |
| **Typeahead / autocomplete** | trie or prefix index, top-k precomputation, caching, latency < 100 ms |
| **Web crawler** | URL frontier, politeness per domain, dedupe (Bloom filters/hashes), distributed workers |
| **Notification system** | multi-channel (push/SMS/email), templates, user preferences, retries, rate limits, priority queues |
| **Payment system** | idempotency, double-entry ledger, exactly-once semantics via idempotency + reconciliation, PCI compliance, sagas |
| **Distributed cache / key-value store** | consistent hashing, replication, quorum, gossip membership, eviction |
| **Unique ID generator** | Snowflake (timestamp + machine + sequence), UUIDv7, ordering, clock skew |
| **Ticket booking** (BookMyShow) | seat locking with TTL, concurrency control, high-contention events, payments |
| **Collaborative editor** (Google Docs) | OT or CRDTs, WebSockets, presence, versioning |

```text Practice card: Ride sharing
Location updates : drivers send GPS every 4 s → 1M drivers ≈ 250K writes/s → in-memory geo index
Geo index        : geohash / H3 cells in Redis: GEOADD drivers lon lat id ; GEOSEARCH … BYRADIUS 2 km
Matching         : nearest N available drivers → offer one at a time with timeout
Trip state       : requested → accepted → arrived → in_trip → completed (state machine in DB)
Surge pricing    : demand/supply per cell computed by a stream job every minute
```

# Interview Questions

## Beginner

### What is the difference between horizontal and vertical scaling?
Vertical scaling adds resources (CPU, RAM) to a single machine — simple but limited and a single point of failure. Horizontal scaling adds more machines behind a load balancer — near-unlimited and fault tolerant, but requires stateless services and data distribution.

```bash
# Vertical: a bigger box
aws ec2 modify-instance-attribute --instance-id i-0abc --instance-type '{"Value":"m7g.4xlarge"}'
# Horizontal: more boxes behind a load balancer
kubectl scale deployment api --replicas=12
```

### What is a load balancer?
A component that distributes incoming traffic across multiple servers using algorithms like round robin or least connections, performs health checks to avoid unhealthy instances, and often terminates TLS. It enables horizontal scaling and high availability.

```yaml Kubernetes Service = built-in L4 load balancer across pods
apiVersion: v1
kind: Service
metadata: { name: api }
spec:
  type: LoadBalancer
  selector: { app: api }
  ports: [{ port: 443, targetPort: 8080 }]
# readinessProbe on the pods decides who receives traffic (health checks)
```

### What is a CDN?
A geographically distributed network of edge servers caching content close to users, reducing latency and origin load for static assets (images, JS, video) and increasingly dynamic content and edge compute.

```http Origin response the CDN can cache at the edge
HTTP/1.1 200 OK
Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=60
ETag: "v42"
Vary: Accept-Encoding
```
```bash
aws cloudfront create-invalidation --distribution-id E123ABC --paths "/index.html"
```

### What is caching and where can it be applied?
Storing copies of frequently accessed data in faster storage to reduce latency and load. Applied at the browser, CDN, reverse proxy, application memory, distributed caches like Redis, and database buffers.

```python In-process memoization — the simplest cache
from functools import lru_cache
@lru_cache(maxsize=10_000)
def exchange_rate(currency: str) -> float:
    return rates_api.get(currency)
# Other layers: browser (Cache-Control), CDN, reverse proxy (nginx proxy_cache), Redis, DB buffer pool
```

### What is the difference between latency and throughput?
Latency is the time to complete a single request; throughput is how many requests a system processes per unit of time. Optimising one can hurt the other (batching raises throughput but adds latency).

```python
import asyncio, time
async def handle(): await asyncio.sleep(0.1)               # each request: 100 ms latency
async def run(n, concurrency):
    sem = asyncio.Semaphore(concurrency)
    async def one():
        async with sem: await handle()
    t = time.perf_counter(); await asyncio.gather(*(one() for _ in range(n)))
    print(f"{n / (time.perf_counter() - t):.0f} req/s")
asyncio.run(run(1000, 10))     # ~100 req/s
asyncio.run(run(1000, 100))    # ~1000 req/s — same latency, 10× throughput
```

### What does 99.99% availability mean?
The system may be unavailable for at most ~52.6 minutes per year (~4.3 minutes per month). Higher availability requires redundancy, automated failover, and avoiding single points of failure.

```python
minutes_per_month = 30 * 24 * 60
for slo in (0.999, 0.9999, 0.99999):
    print(f"{slo:.3%}: {minutes_per_month * (1 - slo):.1f} min/month")
# 99.900%: 43.2 · 99.990%: 4.3 · 99.999%: 0.4
```

## Intermediate

### Explain the CAP theorem.
In a distributed system experiencing a network partition, you must choose between consistency (every read sees the latest write, possibly rejecting requests) and availability (every request gets a response, possibly stale). Partition tolerance is mandatory in practice, so systems are designed as CP or AP for partition scenarios.

```python Cassandra tunable consistency: choosing C or A per query
from cassandra import ConsistencyLevel
from cassandra.query import SimpleStatement
# Favour consistency (CP-ish): fails if a quorum of replicas can't be reached
cp = SimpleStatement("SELECT balance FROM accounts WHERE id=%s", consistency_level=ConsistencyLevel.QUORUM)
# Favour availability (AP-ish): answers from any replica, may be stale
ap = SimpleStatement("SELECT likes FROM posts WHERE id=%s", consistency_level=ConsistencyLevel.ONE)
```

### SQL vs NoSQL for a new system — how do you decide?
Consider data relationships, consistency/transaction needs, query flexibility, scale and access patterns. SQL fits relational data with complex queries and strong consistency. NoSQL fits massive scale with simple, known access patterns, flexible schema or specialised models. Many systems combine both.

```sql Relational: orders with integrity and joins
CREATE TABLE orders (id BIGSERIAL PRIMARY KEY, customer_id BIGINT REFERENCES customers(id), total NUMERIC(10,2));
```
```js Document: flexible product attributes, read as one unit
db.products.insertOne({ sku: "TSHIRT-1", attrs: { size: ["S", "M"], color: "red" }, reviews: [] })
```
```text Wide-column: 1M writes/s of sensor readings → Cassandra, partition key (sensor_id, day)
```

### What is consistent hashing?
A hashing scheme that maps both keys and nodes onto a ring; each key goes to the next node clockwise. Adding or removing a node only remaps keys in its neighbouring range rather than nearly all keys. Virtual nodes improve balance. Used in distributed caches, DynamoDB/Cassandra and load balancers.

```python
ring = Ring(["cache-a", "cache-b", "cache-c"])           # from the "Databases at Scale" lesson
before = {k: ring.node_for(k) for k in map(str, range(10_000))}
ring = Ring(["cache-a", "cache-b", "cache-c", "cache-d"])
moved = sum(before[k] != ring.node_for(k) for k in before)
print(moved / 10_000)    # ≈ 0.25 (modulo hashing would move ≈ 0.75)
```

### What are message queues and why use them?
Buffers that let producers send messages for consumers to process asynchronously. They decouple services, absorb traffic spikes, enable retries, allow independent scaling of consumers and improve resilience to downstream failures.

```python
# Producer: absorb a spike of 10K signups/min
sqs.send_message(QueueUrl=Q, MessageBody=json.dumps({"user_id": uid, "type": "welcome_email"}))
# Consumers: process at their own pace, retry on failure, DLQ after 5 attempts
for m in sqs.receive_message(QueueUrl=Q, WaitTimeSeconds=20).get("Messages", []):
    send_welcome(json.loads(m["Body"])["user_id"])
    sqs.delete_message(QueueUrl=Q, ReceiptHandle=m["ReceiptHandle"])
```

### Monolith vs microservices?
A monolith is a single deployable unit — simpler to build, test and transact across, but harder to scale teams and components independently. Microservices split by business capability for independent deployment and scaling, at the cost of distributed-systems complexity: network failures, data consistency and observability.

```python Monolith: one transaction
with db.transaction():
    order = orders.create(cart)
    inventory.reserve(cart.items)
    payments.charge(order)
```
```python Microservices: network calls + eventual consistency
order = await http.post("http://orders/orders", json=cart)
await bus.publish("OrderCreated", order)        # inventory and payments react asynchronously (saga)
```

### How do you handle database replication lag?
Route reads that must reflect a user's recent writes to the leader (read-your-writes), use session stickiness or version tokens, accept eventual consistency for non-critical reads, monitor lag, and design UIs to tolerate brief staleness.

```python Read-your-writes with a version token
def update_profile(user_id, data):
    lsn = primary.execute("UPDATE … RETURNING pg_current_wal_lsn()")
    session["min_lsn"] = lsn
def read_profile(user_id):
    replica = pick_replica()
    if session.get("min_lsn") and replica.replayed_lsn() < session["min_lsn"]:
        return primary.fetch_profile(user_id)          # replica too far behind → go to primary
    return replica.fetch_profile(user_id)
```

## Advanced

### How would you design a URL shortener?
Clarify scale (read-heavy). Generate unique 7-char base62 codes via a distributed ID generator or pre-generated key ranges, store code→URL in a key-value or SQL store, serve redirects through a Redis cache and CDN, choose 301 vs 302 based on analytics needs, and push click events to Kafka for asynchronous analytics. Handle custom aliases, expiry and abuse (rate limiting, malware URL checks).

```python
import string
ALPHABET = string.digits + string.ascii_letters          # base62
def base62(n):
    s = ""
    while n: n, r = divmod(n, 62); s = ALPHABET[r] + s
    return s or "0"

@app.post("/shorten")
def shorten(url: str):
    code = base62(id_generator.next())                    # unique 64-bit id → 7 chars covers 3.5T urls
    db.execute("INSERT INTO links(code, url) VALUES (%s, %s)", (code, url))
    return {"short": f"https://sho.rt/{code}"}

@app.get("/{code}")
def go(code: str):
    url = redis.get(code) or db.fetch_url(code)
    return RedirectResponse(url, status_code=302)         # 302 so clicks can be counted
```

### How do you design for exactly-once processing in an event-driven system?
True exactly-once delivery isn't achievable across arbitrary systems; achieve exactly-once *effects* with at-least-once delivery plus idempotent consumers (dedupe by event id in a processed-events table or unique constraints), transactional outbox for publishing, and transactional consumption/production where supported (Kafka transactions).

```python Idempotent consumer with a dedupe table in the same transaction
def handle(event):
    with db.transaction():
        inserted = db.execute(
            "INSERT INTO processed_events(event_id) VALUES (%s) ON CONFLICT DO NOTHING", (event.id,)
        ).rowcount
        if not inserted:
            return                                    # duplicate delivery → no-op
        db.execute("UPDATE wallets SET balance = balance + %s WHERE id = %s", (event.amount, event.wallet))
    # commit the consumer offset after the DB commit
```

### How do sagas work for distributed transactions?
A saga breaks a business transaction into local transactions per service, each publishing an event or being invoked by an orchestrator. If a step fails, compensating transactions undo previous steps (refund payment, release inventory). Choreography uses events between services; orchestration uses a central coordinator for clearer control and monitoring.

```python Orchestrated saga with compensations
def place_order_saga(order):
    steps = [
        (inventory.reserve, inventory.release),
        (payments.charge,   payments.refund),
        (shipping.schedule, shipping.cancel),
    ]
    done = []
    try:
        for action, compensate in steps:
            action(order); done.append(compensate)
        orders.mark_confirmed(order)
    except Exception:
        for compensate in reversed(done):
            compensate(order)                      # undo in reverse order
        orders.mark_failed(order)
```

### How would you design a rate limiter?
Choose an algorithm (token bucket or sliding window counter), keep counters in Redis with atomic Lua scripts shared by all gateway instances, identify clients by API key/user/IP, configure rules per tier, return 429 with Retry-After headers, decide fail-open vs fail-closed, and place it at the API gateway plus per-service for defence in depth.

```python Token bucket (single node, for clarity)
class TokenBucket:
    def __init__(self, rate, capacity):
        self.rate, self.capacity, self.tokens, self.last = rate, capacity, capacity, time.monotonic()
    def allow(self):
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)
        self.last = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
bucket = TokenBucket(rate=100 / 60, capacity=20)   # 100/min with bursts of 20
# Distributed: same logic in a Redis Lua script keyed by client id
```

### Fan-out on write vs fan-out on read for a news feed?
Fan-out on write precomputes each follower's feed at post time — fast reads, heavy writes for popular users. Fan-out on read assembles feeds at request time — cheap writes, slower reads. A hybrid pushes for regular users and pulls for celebrities, merging at read time, with caching for active users.

```python
# Write fan-out: O(followers) at post time, O(1) read
for f in followers(author): redis.lpush(f"feed:{f}", post_id)
# Read fan-out: O(1) write, O(followees) merge at read time
feed = heapq.merge(*(recent_posts(u) for u in following(user)), key=lambda p: -p.ts)
```

### How do you make a system resilient to downstream failures?
Timeouts on every call, retries with exponential backoff and jitter for idempotent operations, circuit breakers, bulkheads, fallbacks and graceful degradation (cached/partial responses), queues to absorb spikes, load shedding, redundancy across zones, and observability with SLO-based alerting.

```python
def product_page(pid):
    product = catalog.get(pid)                                   # critical
    try:
        recs = breaker.call(lambda: recommendations.get(pid, timeout=0.3))
    except (CircuitOpen, TimeoutError):
        recs = cached_popular_products()                         # graceful degradation
    return render(product, recs)
# Bulkhead: separate connection pools so a slow recommender can't exhaust the catalog pool
```

### How would you design a system for a flash sale with limited inventory?
Protect the core with a CDN and queue-based waiting room, rate limit per user, keep inventory counters in Redis with atomic decrements (Lua) as a reservation step, create orders asynchronously via a queue, reserve stock with TTL until payment completes, use idempotency keys for payment, reconcile with the database as the source of truth, and pre-scale/load test beforehand.

```lua Atomic reservation in Redis (one item per user)
-- KEYS[1]=stock:sku  KEYS[2]=buyers:sku  ARGV[1]=user_id
if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then return -1 end   -- already bought
local left = tonumber(redis.call('GET', KEYS[1]))
if left <= 0 then return 0 end                                         -- sold out
redis.call('DECR', KEYS[1])
redis.call('SADD', KEYS[2], ARGV[1])
return 1                                                               -- reserved → enqueue order creation
```

# Scenario Questions

## Intermediate

### Your service's database melts every day at 9 AM when a marketing email goes out. How do you handle the spike?
- **Cache** hot reads (CDN for static content and landing pages, Redis for API data).
- **Queue** writes and expensive work so you absorb bursts and process them asynchronously.
- Autoscale stateless tiers ahead of time (scheduled scaling).
- Rate-limit, and shed load gracefully.
- Add read replicas.
- Ask marketing to **stagger** email sends, which is the cheapest fix.

```yaml Scale ahead of the known spike + cache the landing page
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: api-morning }
spec:
  scaleTargetRef: { name: api }
  triggers:
    - type: cron
      metadata: { timezone: Europe/London, start: "50 8 * * *", end: "30 10 * * *", desiredReplicas: "30" }
```
```http
Cache-Control: public, s-maxage=300   # landing + product pages served by the CDN, not the DB
```

### A payment request times out and the client retries. The customer is charged twice. How do you design against this?
Use **idempotency keys**. The client sends a unique key per payment intent, and the server stores the key with its result (with a unique constraint) and returns the stored result on retries. Combine it with an outbox pattern for reliable events, and reconciliation jobs with the payment provider.

```sql
CREATE TABLE payment_requests (
  idempotency_key UUID PRIMARY KEY,
  status TEXT NOT NULL, response JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
```
```python
def charge(req, key):
    row = db.execute("INSERT INTO payment_requests(idempotency_key, status) VALUES (%s,'processing') "
                     "ON CONFLICT DO NOTHING RETURNING 1", (key,)).fetchone()
    if row is None:
        return db.fetch_response(key)                  # retry → same stored result, no second charge
    result = psp.charge(req, idempotency_key=key)      # pass the key downstream too
    db.execute("UPDATE payment_requests SET status='done', response=%s WHERE idempotency_key=%s", (json.dumps(result), key))
    return result
```

### Design a rate limiter that allows 100 requests per minute per user across 20 API servers.
Keep the counters in a shared, fast store (**Redis**) so every server sees the same count. Choose an algorithm:
- **Token bucket**: allows bursts.
- **Sliding-window log or counter**: accurate.
- **Fixed window**: simple, but permits bursts at window edges.

Make it atomic with a Lua script or `INCR` plus `EXPIRE`. Return `429` with `Retry-After`, and fail open or closed by policy if Redis is down. Use local token buckets in front for very hot paths.

```python All 20 servers share Redis; the check is atomic via Lua
SCRIPT = redis.register_script("""
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return c
""")
def allow(user):
    count = SCRIPT(keys=[f"rl:{user}:{int(time.time() // 60)}"], args=[60])
    return count <= 100
```

## Advanced

### Users in Asia report 800 ms latency on your US-hosted app. What do you change?
- Serve static assets and cacheable API responses from a **CDN** edge.
- Deploy read-heavy services in an Asian region, with **read replicas** or a geo-distributed database.
- Route users with latency-based DNS or anycast.
- Reduce round trips (HTTP/2 or HTTP/3, batched requests, edge compute).

Multi-region writes bring consistency trade-offs (CRDTs, conflict resolution, single-leader per tenant).

```text
Before: Tokyo ─(150 ms RTT × several round trips)─▶ us-east-1 app + DB  ≈ 800 ms
After : Tokyo ─▶ CDN edge Tokyo (static + cached API)        ≈ 30 ms
              ─▶ ap-northeast-1 app + read replica (reads)    ≈ 60 ms
              ─▶ writes forwarded to the primary region       ≈ 200 ms (acceptable for writes)
```

### An order service and an inventory service must stay consistent without a distributed transaction. How?
Use the **Saga pattern**: a sequence of local transactions, each publishing an event, with **compensating actions** on failure (cancel the order if the stock reservation fails). Orchestrate it centrally or through choreography. Use the **transactional outbox** so writing to the DB and publishing the event can't diverge, and idempotent consumers to handle duplicates.

```python Transactional outbox (no lost events)
with db.transaction():
    db.execute("INSERT INTO orders(id, status) VALUES (%s, 'PENDING')", (oid,))
    db.execute("INSERT INTO outbox(id, type, payload) VALUES (%s, 'OrderCreated', %s)", (uuid4(), json.dumps({"order": oid})))
# relay (or Debezium CDC) publishes outbox rows to Kafka; inventory reserves stock
# and emits StockReserved / StockRejected → order service confirms or cancels (compensation)
```

# Tricky Questions

## Intermediate

### You cache user profiles for 1 hour. A user updates their name but still sees the old one. What are your options?
Invalidate or update the cache on write (write-through, or delete-on-write followed by re-read), use shorter TTLs, read your own writes (bypass the cache for the user who just wrote), or version the cache key. Watch for races where a stale read repopulates the cache after the delete; delayed double-delete or leases handle that.

```python
def update_name(uid, name):
    db.update_user(uid, name=name)
    redis.delete(f"user:{uid}")                     # invalidate on write
    # or write-through: redis.set(f"user:{uid}", json.dumps(db.get_user(uid)), ex=3600)
    publish("user.updated", uid)                    # other services/instances drop their local copies
```

### Is adding a cache always a performance win?
No. Caches add **staleness**, invalidation bugs, cold-start stampedes (when many requests miss at once), memory cost and another failure mode. They help when reads far outnumber writes and slightly stale data is acceptable. Protect against **thundering herd** problems with request coalescing, jittered TTLs and early refresh.

```python Measure before you cache
hit_ratio = hits / (hits + misses)
effective_latency = hit_ratio * 1 + (1 - hit_ratio) * (2 + 20)   # ms: cache hit vs miss + DB
print(hit_ratio, effective_latency)   # at 10% hit ratio a cache ADDS latency vs 20 ms straight to the DB
```

## Advanced

### Under CAP, during a network partition, your system keeps accepting writes on both sides. Is it CP or AP, and what's the cost?
It's **AP**: it stays available, so the two sides diverge and you need conflict resolution afterwards (last-write-wins loses data; CRDTs or app-level merges are safer). A CP system would reject writes on the minority side to stay consistent. PACELC adds that even without a partition you're trading latency against consistency.

```python Conflict resolution after the partition heals
# Last-write-wins (simple, loses data)
merged = max(replica_a, replica_b, key=lambda v: v.timestamp)
# CRDT G-Counter (no data loss for counters)
def merge_counter(a: dict, b: dict):   # per-node counts
    return {n: max(a.get(n, 0), b.get(n, 0)) for n in a.keys() | b.keys()}
total = sum(merge_counter({"A": 5, "B": 2}, {"A": 3, "B": 4}).values())   # 9
```
