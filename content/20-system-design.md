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

## Back-of-the-Envelope Estimation

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

# Intermediate

## Load Balancing

### Algorithms
Round robin, weighted round robin, **least connections**, least response time, IP hash / **consistent hashing** (session affinity, cache locality), random with two choices.

### Layer 4 vs Layer 7
- **L4** (transport) — routes by IP/port; very fast; no HTTP awareness (NLB, HAProxy TCP).
- **L7** (application) — routes by URL path, headers, cookies; TLS termination, retries, compression (ALB, NGINX, Envoy).

### High availability
Active-passive or active-active LB pairs, health checks, connection draining, multiple availability zones, global load balancing with DNS/anycast across regions.

## Caching Strategies

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

## Case Study: News Feed / Timeline

**Requirements**: users post; followers see a reverse-chronological or ranked feed; feed load < 200 ms.

### Fan-out on write (push)
On post, insert the post id into each follower's precomputed feed (Redis list / feed table). **Fast reads**, but expensive for celebrities with millions of followers.

### Fan-out on read (pull)
At read time, fetch recent posts from everyone the user follows and merge. **Cheap writes**, slow reads for users following many accounts.

### Hybrid (what real systems do)
Push for normal users; **pull for celebrity accounts** and merge at read time. Cache feeds for active users only; rebuild for inactive users on demand.

**Other pieces**: post service + object storage + CDN for media; social graph service; ranking service (ML features: engagement, recency, affinity); pagination with cursors; async workers consuming a "post created" event stream for fan-out.

## Case Study: Distributed Rate Limiter

**Requirements**: limit requests per user/API key/IP (e.g., 100 req/min), low latency overhead, distributed across many gateway instances, clear client feedback.

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

# Interview Questions

## Beginner

### What is the difference between horizontal and vertical scaling?
Vertical scaling adds resources (CPU, RAM) to a single machine — simple but limited and a single point of failure. Horizontal scaling adds more machines behind a load balancer — near-unlimited and fault tolerant, but requires stateless services and data distribution.

### What is a load balancer?
A component that distributes incoming traffic across multiple servers using algorithms like round robin or least connections, performs health checks to avoid unhealthy instances, and often terminates TLS. It enables horizontal scaling and high availability.

### What is a CDN?
A geographically distributed network of edge servers caching content close to users, reducing latency and origin load for static assets (images, JS, video) and increasingly dynamic content and edge compute.

### What is caching and where can it be applied?
Storing copies of frequently accessed data in faster storage to reduce latency and load. Applied at the browser, CDN, reverse proxy, application memory, distributed caches like Redis, and database buffers.

### What is the difference between latency and throughput?
Latency is the time to complete a single request; throughput is how many requests a system processes per unit of time. Optimising one can hurt the other (batching raises throughput but adds latency).

### What does 99.99% availability mean?
The system may be unavailable for at most ~52.6 minutes per year (~4.3 minutes per month). Higher availability requires redundancy, automated failover, and avoiding single points of failure.

## Intermediate

### Explain the CAP theorem.
In a distributed system experiencing a network partition, you must choose between consistency (every read sees the latest write, possibly rejecting requests) and availability (every request gets a response, possibly stale). Partition tolerance is mandatory in practice, so systems are designed as CP or AP for partition scenarios.

### SQL vs NoSQL for a new system — how do you decide?
Consider data relationships, consistency/transaction needs, query flexibility, scale and access patterns. SQL fits relational data with complex queries and strong consistency. NoSQL fits massive scale with simple, known access patterns, flexible schema or specialised models. Many systems combine both.

### What is consistent hashing?
A hashing scheme that maps both keys and nodes onto a ring; each key goes to the next node clockwise. Adding or removing a node only remaps keys in its neighbouring range rather than nearly all keys. Virtual nodes improve balance. Used in distributed caches, DynamoDB/Cassandra and load balancers.

### What are message queues and why use them?
Buffers that let producers send messages for consumers to process asynchronously. They decouple services, absorb traffic spikes, enable retries, allow independent scaling of consumers and improve resilience to downstream failures.

### Monolith vs microservices?
A monolith is a single deployable unit — simpler to build, test and transact across, but harder to scale teams and components independently. Microservices split by business capability for independent deployment and scaling, at the cost of distributed-systems complexity: network failures, data consistency and observability.

### How do you handle database replication lag?
Route reads that must reflect a user's recent writes to the leader (read-your-writes), use session stickiness or version tokens, accept eventual consistency for non-critical reads, monitor lag, and design UIs to tolerate brief staleness.

## Advanced

### How would you design a URL shortener?
Clarify scale (read-heavy). Generate unique 7-char base62 codes via a distributed ID generator or pre-generated key ranges, store code→URL in a key-value or SQL store, serve redirects through a Redis cache and CDN, choose 301 vs 302 based on analytics needs, and push click events to Kafka for asynchronous analytics. Handle custom aliases, expiry and abuse (rate limiting, malware URL checks).

### How do you design for exactly-once processing in an event-driven system?
True exactly-once delivery isn't achievable across arbitrary systems; achieve exactly-once *effects* with at-least-once delivery plus idempotent consumers (dedupe by event id in a processed-events table or unique constraints), transactional outbox for publishing, and transactional consumption/production where supported (Kafka transactions).

### How do sagas work for distributed transactions?
A saga breaks a business transaction into local transactions per service, each publishing an event or being invoked by an orchestrator. If a step fails, compensating transactions undo previous steps (refund payment, release inventory). Choreography uses events between services; orchestration uses a central coordinator for clearer control and monitoring.

### How would you design a rate limiter?
Choose an algorithm (token bucket or sliding window counter), keep counters in Redis with atomic Lua scripts shared by all gateway instances, identify clients by API key/user/IP, configure rules per tier, return 429 with Retry-After headers, decide fail-open vs fail-closed, and place it at the API gateway plus per-service for defence in depth.

### Fan-out on write vs fan-out on read for a news feed?
Fan-out on write precomputes each follower's feed at post time — fast reads, heavy writes for popular users. Fan-out on read assembles feeds at request time — cheap writes, slower reads. A hybrid pushes for regular users and pulls for celebrities, merging at read time, with caching for active users.

### How do you make a system resilient to downstream failures?
Timeouts on every call, retries with exponential backoff and jitter for idempotent operations, circuit breakers, bulkheads, fallbacks and graceful degradation (cached/partial responses), queues to absorb spikes, load shedding, redundancy across zones, and observability with SLO-based alerting.

### How would you design a system for a flash sale with limited inventory?
Protect the core with a CDN and queue-based waiting room, rate limit per user, keep inventory counters in Redis with atomic decrements (Lua) as a reservation step, create orders asynchronously via a queue, reserve stock with TTL until payment completes, use idempotency keys for payment, reconcile with the database as the source of truth, and pre-scale/load test beforehand.

# Scenario Questions

## Intermediate

### Your service's database melts every day at 9 AM when a marketing email goes out. How do you handle the spike?
- **Cache** hot reads (CDN for static content and landing pages, Redis for API data).
- **Queue** writes and expensive work so you absorb bursts and process them asynchronously.
- Autoscale stateless tiers ahead of time (scheduled scaling).
- Rate-limit, and shed load gracefully.
- Add read replicas.
- Ask marketing to **stagger** email sends, which is the cheapest fix.

### A payment request times out and the client retries. The customer is charged twice. How do you design against this?
Use **idempotency keys**. The client sends a unique key per payment intent, and the server stores the key with its result (with a unique constraint) and returns the stored result on retries. Combine it with an outbox pattern for reliable events, and reconciliation jobs with the payment provider.

### Design a rate limiter that allows 100 requests per minute per user across 20 API servers.
Keep the counters in a shared, fast store (**Redis**) so every server sees the same count. Choose an algorithm:
- **Token bucket**: allows bursts.
- **Sliding-window log or counter**: accurate.
- **Fixed window**: simple, but permits bursts at window edges.

Make it atomic with a Lua script or `INCR` plus `EXPIRE`. Return `429` with `Retry-After`, and fail open or closed by policy if Redis is down. Use local token buckets in front for very hot paths.

## Advanced

### Users in Asia report 800 ms latency on your US-hosted app. What do you change?
- Serve static assets and cacheable API responses from a **CDN** edge.
- Deploy read-heavy services in an Asian region, with **read replicas** or a geo-distributed database.
- Route users with latency-based DNS or anycast.
- Reduce round trips (HTTP/2 or HTTP/3, batched requests, edge compute).

Multi-region writes bring consistency trade-offs (CRDTs, conflict resolution, single-leader per tenant).

### An order service and an inventory service must stay consistent without a distributed transaction. How?
Use the **Saga pattern**: a sequence of local transactions, each publishing an event, with **compensating actions** on failure (cancel the order if the stock reservation fails). Orchestrate it centrally or through choreography. Use the **transactional outbox** so writing to the DB and publishing the event can't diverge, and idempotent consumers to handle duplicates.

# Tricky Questions

## Intermediate

### You cache user profiles for 1 hour. A user updates their name but still sees the old one. What are your options?
Invalidate or update the cache on write (write-through, or delete-on-write followed by re-read), use shorter TTLs, read your own writes (bypass the cache for the user who just wrote), or version the cache key. Watch for races where a stale read repopulates the cache after the delete; delayed double-delete or leases handle that.

### Is adding a cache always a performance win?
No. Caches add **staleness**, invalidation bugs, cold-start stampedes (when many requests miss at once), memory cost and another failure mode. They help when reads far outnumber writes and slightly stale data is acceptable. Protect against **thundering herd** problems with request coalescing, jittered TTLs and early refresh.

## Advanced

### Under CAP, during a network partition, your system keeps accepting writes on both sides. Is it CP or AP, and what's the cost?
It's **AP**: it stays available, so the two sides diverge and you need conflict resolution afterwards (last-write-wins loses data; CRDTs or app-level merges are safer). A CP system would reject writes on the minority side to stay consistent. PACELC adds that even without a partition you're trading latency against consistency.
