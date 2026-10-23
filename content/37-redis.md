---
id: redis
title: Redis
short: Redis
category: Databases & Messaging
order: 13.73
color: #dc382d
icon: Rd
summary: In-memory data structure store: strings, hashes, lists, sets, sorted sets, streams, TTLs, caching patterns, rate limiting, locks, pub/sub, Lua, persistence, replication, Sentinel and Cluster.
---

# Beginner

## What Redis Is and redis-cli Basics

**Redis** is an in-memory key-value store whose values are **data structures** (strings, hashes, lists, sets, sorted sets, streams and more). Operations run in memory, mostly in O(1) or O(log n), with sub-millisecond latency. Redis executes commands on a single thread, so **each command is atomic**.

Common uses: caching, sessions, rate limiting, leaderboards, queues, pub/sub, distributed locks and counters.

```bash
docker run -d --name redis -p 6379:6379 redis:7
redis-cli
```
```bash redis-cli
SET greeting "hello"          # OK
GET greeting                  # "hello"
SET session:abc '{"uid":42}' EX 1800   # expires in 30 minutes
TTL session:abc               # 1799
EXISTS greeting               # 1
DEL greeting
KEYS *                        # ❌ never in production: blocks the server. Use SCAN.
SCAN 0 MATCH session:* COUNT 100
```

## Strings, Counters and Expiry

```bash
INCR page:views:home          # 1, 2, 3 … atomic counter
INCRBY cart:42:items 3
DECR stock:A1
SETNX lock:job 1              # set only if missing (prefer SET … NX)
SET lock:job worker-1 NX PX 30000
MSET a 1 b 2 ; MGET a b
EXPIRE otp:ada@x.io 300 ; PERSIST otp:ada@x.io
GETDEL one-time-token:xyz     # read and delete atomically
```
```js Node (node-redis)
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();
await redis.set('user:42:name', 'Ada', { EX: 3600 });
const views = await redis.incr('page:views:home');
```

## Hashes, Lists, Sets and Sorted Sets

```bash Hash: an object's fields
HSET user:42 name "Ada" email "ada@x.io" visits 0
HGET user:42 name
HINCRBY user:42 visits 1
HGETALL user:42
```
```bash List: queue / recent items
LPUSH recent:42 "product:9"        # newest first
LTRIM recent:42 0 9                # keep 10
LRANGE recent:42 0 -1
RPUSH jobs '{"id":1}' ; BLPOP jobs 5    # blocking pop: a simple worker queue
```
```bash Set: unique members
SADD online:users 42 77 91
SISMEMBER online:users 42          # 1
SINTER followers:ada followers:bob # mutual followers
SCARD online:users
```
```bash Sorted set: ranked by score
ZADD leaderboard 1500 "ada" 1320 "bob" 990 "cy"
ZINCRBY leaderboard 50 "bob"
ZREVRANGE leaderboard 0 2 WITHSCORES   # top 3
ZRANK leaderboard "cy"
ZRANGEBYSCORE events 1761200000 +inf   # time-ordered data with timestamps as scores
```

## Caching with Redis (Cache-Aside)

```python
import json, redis
r = redis.Redis.from_url(os.environ["REDIS_URL"], decode_responses=True)

def get_product(pid: int) -> dict:
    key = f"product:{pid}"
    if (cached := r.get(key)) is not None:
        return json.loads(cached)                       # hit
    product = db.fetch_product(pid)                     # miss → database
    r.set(key, json.dumps(product), ex=300)             # TTL as a safety net
    return product

def update_product(pid: int, fields: dict):
    db.update_product(pid, fields)
    r.delete(f"product:{pid}")                          # invalidate after the write
```

> [!TIP]
> Name keys `object-type:id:field` (`user:42:cart`), always set a TTL on cache keys, and keep values small (well under 1 MB).

# Intermediate

## Rate Limiting and Counters

```python Fixed window: 100 requests per minute
def allow(user_id: str, limit=100) -> bool:
    key = f"rl:{user_id}:{int(time.time() // 60)}"
    pipe = r.pipeline()
    pipe.incr(key); pipe.expire(key, 61)
    count, _ = pipe.execute()
    return count <= limit
```
```python Sliding log with a sorted set: exact, more memory
def allow_sliding(user_id, limit=100, window=60):
    now = time.time(); key = f"rl:z:{user_id}"
    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zadd(key, {f"{now}-{uuid4()}": now})
    pipe.zcard(key)
    pipe.expire(key, window)
    _, _, count, _ = pipe.execute()
    return count <= limit
```
```bash Unique visitors with HyperLogLog (~12 KB, ~0.8% error)
PFADD visitors:2026-10-23 user42 user77
PFCOUNT visitors:2026-10-23
```

## Pipelines, Transactions and Lua Scripts

- **Pipeline**: send many commands in one round trip. Not atomic.
- **MULTI/EXEC**: queue commands and run them atomically. Combine with `WATCH` for optimistic locking.
- **Lua / Functions**: run a script atomically on the server. This is the usual way to do check-then-act.

```python
pipe = r.pipeline(transaction=False)
for pid in ids: pipe.get(f"product:{pid}")
values = pipe.execute()                     # 1 network round trip instead of len(ids)
```
```bash WATCH-based optimistic transaction
WATCH balance:42
GET balance:42          # client checks the value is ≥ 100
MULTI
DECRBY balance:42 100
EXEC                    # nil if balance:42 changed since WATCH → retry
```
```lua Atomic "decrement stock if available"
-- KEYS[1] = stock:sku   ARGV[1] = qty
local stock = tonumber(redis.call('GET', KEYS[1]) or '0')
if stock < tonumber(ARGV[1]) then return -1 end
return redis.call('DECRBY', KEYS[1], ARGV[1])
```
```python
reserve = r.register_script(open("reserve.lua").read())
left = reserve(keys=["stock:A1"], args=[2])     # -1 = not enough stock
```

## Distributed Locks

```python
import uuid
def acquire(name, ttl_ms=30_000):
    token = str(uuid.uuid4())
    return token if r.set(f"lock:{name}", token, nx=True, px=ttl_ms) else None

RELEASE = r.register_script("""
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0""")                                   # delete only our own lock

token = acquire("nightly-report")
if token:
    try: run_report()
    finally: RELEASE(keys=["lock:nightly-report"], args=[token])
```

> [!WARN]
> A Redis lock with a TTL is fine for **efficiency** (avoiding duplicate work). For **correctness** (money, inventory), also use fencing tokens or database constraints. A paused process can outlive its lock.

## Pub/Sub and Streams

**Pub/Sub** is fire-and-forget: subscribers that are offline miss the message. **Streams** are a persistent append-only log with consumer groups, acknowledgements and replay.

```bash Pub/Sub
SUBSCRIBE chat:room42             # client A
PUBLISH chat:room42 "hello"       # client B → delivered only to connected subscribers
```
```bash Streams with a consumer group
XADD orders * orderId 901 total 120
XGROUP CREATE orders billing $ MKSTREAM
XREADGROUP GROUP billing worker-1 COUNT 10 BLOCK 5000 STREAMS orders >
XACK orders billing 1761200000000-0
XPENDING orders billing            # delivered but not acknowledged
XAUTOCLAIM orders billing worker-2 60000 0   # take over stuck messages after 60 s
XTRIM orders MAXLEN ~ 1000000
```

# Advanced

## Persistence: RDB, AOF and Durability

| Mode | How | Trade-off |
|---|---|---|
| RDB | point-in-time snapshots (`fork` + dump) | compact, fast restarts; you lose data since the last snapshot |
| AOF | append every write; `appendfsync everysec` | at most ~1 s of data lost; bigger files, rewritten in the background |
| RDB + AOF | both (recommended when data matters) | best recovery |
| none | pure cache | everything lost on restart |

```text redis.conf
save 900 1
save 300 100
appendonly yes
appendfsync everysec
maxmemory 4gb
maxmemory-policy allkeys-lru     # cache: evict least-recently-used keys
# volatile-lru: only keys with a TTL · noeviction: return errors when full (queues, primary data)
```

## Replication, Sentinel and Cluster

- **Replication**: async primary → replicas for read scaling and failover copies.
- **Sentinel**: monitors the primary, elects a new one on failure, and tells clients the new address.
- **Cluster**: shards data across primaries using **16,384 hash slots** (`CRC16(key) % 16384`), with replicas per shard and automatic failover.

```bash
redis-cli --cluster create 10.0.0.1:6379 10.0.0.2:6379 10.0.0.3:6379 \
  10.0.0.4:6379 10.0.0.5:6379 10.0.0.6:6379 --cluster-replicas 1
redis-cli -c -h 10.0.0.1 CLUSTER INFO
redis-cli -c CLUSTER KEYSLOT user:42
```
```bash Hash tags keep related keys on the same slot (needed for multi-key ops)
SET {user:42}:cart "…"
SET {user:42}:profile "…"
MGET {user:42}:cart {user:42}:profile    # ✅ same slot
```

## Cache Problems: Stampede, Penetration, Avalanche and Hot Keys

| Problem | What happens | Fix |
|---|---|---|
| Stampede (dogpile) | a hot key expires → thousands hit the DB at once | single-flight lock, early probabilistic refresh, serve stale |
| Penetration | lookups for ids that don't exist always miss | cache negative results briefly, Bloom filter |
| Avalanche | many keys expire at the same moment | add TTL jitter, warm the cache |
| Hot key | one key gets most of the traffic | local in-process cache, replicate the key (`key:{1..N}`) |

```python Serve stale while one caller refreshes
def get_cached(key, loader, ttl=300):
    val = r.get(key)
    if val is not None and r.ttl(key) > 30:
        return json.loads(val)
    if r.set(f"refresh:{key}", 1, nx=True, ex=30):        # only one refresher
        fresh = loader()
        r.set(key, json.dumps(fresh), ex=ttl + random.randint(0, 60))   # jitter
        return fresh
    return json.loads(val) if val else loader()           # others get stale data (or load once)
```

## Memory, Big Keys and Monitoring

```bash
INFO memory                      # used_memory_human, mem_fragmentation_ratio
INFO stats                       # keyspace_hits / keyspace_misses → hit ratio
MEMORY USAGE user:42
redis-cli --bigkeys              # largest keys per type
redis-cli --latency
SLOWLOG GET 10
CLIENT LIST
UNLINK huge:set                  # non-blocking delete (DEL on a huge key blocks)
OBJECT ENCODING user:42          # listpack (compact) vs hashtable
```

# Interview Questions

## Beginner

### What is Redis and why is it fast?

An in-memory data structure store. It's fast because data lives in RAM, the commands are simple and mostly O(1), command execution is single-threaded (no lock contention), it uses efficient encodings, and its event-loop networking has optional I/O threads.

```bash
redis-benchmark -t set,get -n 100000 -q    # often >100K ops/s on a laptop
```

### What data types does Redis support?

Strings, hashes, lists, sets, sorted sets, streams, bitmaps, bitfields, HyperLogLog, geospatial indexes, and (with modules or Redis Stack) JSON, search and time series.

```bash
GEOADD stores 13.405 52.52 berlin ; GEOSEARCH stores FROMLONLAT 13.4 52.5 BYRADIUS 10 km
SETBIT active:2026-10-23 42 1 ; BITCOUNT active:2026-10-23
```

### How do TTLs and expiry work?

`EXPIRE`/`PEXPIRE` or `SET … EX` attach a time to live. Redis deletes expired keys lazily (when they're accessed) and actively (by sampling keys with TTLs in the background). `TTL` returns -1 for no expiry and -2 for a missing key.

```bash
SET otp:42 913842 EX 300 ; TTL otp:42
```

### Is Redis a database or a cache?

Both. It's often used as a cache with eviction and no persistence, but with AOF/RDB persistence and replication it can be a primary store for data that fits in memory (sessions, counters, leaderboards). It's not a replacement for a relational database with complex queries and strong durability.

```text
maxmemory-policy allkeys-lru   → cache
appendonly yes + noeviction    → data store
```

## Intermediate

### How do you implement a leaderboard?

With a sorted set: `ZINCRBY` updates scores, `ZREVRANGE … WITHSCORES` returns the top N, `ZREVRANK` returns a user's rank. All are O(log n).

```bash
ZINCRBY game:lb 25 "ada"
ZREVRANGE game:lb 0 9 WITHSCORES
ZREVRANK game:lb "ada"
```

### Pipelining vs MULTI/EXEC vs Lua?

Pipelining batches commands to save round trips but isn't atomic. MULTI/EXEC executes a queued batch atomically, and you can't branch on intermediate results inside it (use WATCH for optimistic checks). Lua scripts run server-side atomically and *can* branch, which makes them ideal for check-and-set logic.

```bash
EVAL "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0" 1 lock:x token123
```

### How would you build a rate limiter with Redis?

Use `INCR` + `EXPIRE` for a fixed window, a sorted set or two counters for a sliding window, or a token bucket in a Lua script. Every API instance shares Redis, so the limit is global. Return 429 with `Retry-After`.

```python
count = r.incr(key); r.expire(key, 60, nx=True)   # Redis 7: set the TTL only if it has none
```

### Pub/Sub vs Streams?

Pub/Sub pushes messages to currently connected subscribers with no persistence, so missed messages are gone. Streams persist entries and support consumer groups, acknowledgements, pending lists, replay and trimming. Use Streams for work queues and events that must not be lost.

```bash
XADD events * type signup user 42
XREADGROUP GROUP mailer w1 STREAMS events >
```

### What eviction policies exist?

`noeviction` (return errors on write), `allkeys-lru` / `allkeys-lfu` (any key), `volatile-lru` / `volatile-lfu` / `volatile-ttl` (only keys with an expiry), and `allkeys-random` / `volatile-random`. Pure caches typically use `allkeys-lru` or `lfu`.

```bash
CONFIG SET maxmemory-policy allkeys-lfu
```

## Advanced

### How does Redis Cluster distribute keys?

Each key maps to one of 16,384 hash slots by `CRC16(key) mod 16384` (or the hash of the `{tag}` part only). Slots are assigned to primary nodes. Clients cache the slot map and follow `MOVED`/`ASK` redirections. Multi-key commands require all the keys to be in the same slot.

```bash
CLUSTER KEYSLOT "{order:9}:items"   # same slot as "{order:9}:status"
```

### What are the pitfalls of using Redis for distributed locks?

Clock and GC pauses can make a holder outlive its TTL, async replication can lose a lock on failover, and releasing someone else's lock is a risk. Mitigate with unique tokens and compare-and-delete in Lua, TTLs longer than the work plus renewal, fencing tokens checked by the resource, or a consensus system (etcd, ZooKeeper) when correctness is critical.

```python
fencing = r.incr("lock:report:fence")     # pass it with each write; the storage rejects stale tokens
```

### How do you avoid a cache stampede?

Use single-flight recomputation (`SET NX` lock), serve stale values while refreshing, refresh early before the TTL runs out (probabilistic early expiration), add TTL jitter, and pre-warm hot keys.

```python
if r.ttl(key) < random.expovariate(1 / 30):   # refresh early, before the TTL runs out
    refresh_async(key)
```

### Why are big keys and `KEYS *` dangerous?

Redis runs commands on one thread, so O(n) work on huge collections (`KEYS`, `HGETALL` on a million-field hash, `DEL` of a big set) blocks every other client. Use `SCAN`/`HSCAN`, `UNLINK` (async free), split big values, and keep collections bounded.

```bash
redis-cli --scan --pattern 'session:*' | head
```

# Scenario Questions

## Beginner

### Your cache hit ratio is 20%. How do you investigate?

Compare `keyspace_hits` and `keyspace_misses`, then check that the TTLs aren't too short, that keys are consistent (no random parts or timestamps in key names), that memory isn't evicting keys (`evicted_keys`), and that you cache the data that's actually read most.

```bash
INFO stats | grep -E 'keyspace_(hits|misses)|evicted_keys'
INFO memory | grep -E 'used_memory_human|maxmemory_human'
```

## Intermediate

### Redis CPU is at 100% and latency spikes every few minutes. What do you check?

Check `SLOWLOG` for O(n) commands (KEYS, big HGETALL/SMEMBERS, big DEL), `--bigkeys`, Lua scripts that run long, AOF rewrites and RDB forks on a large memory footprint (latency from fork copy-on-write), and expiry storms where many keys share one TTL.

```bash
SLOWLOG GET 20
LATENCY DOCTOR
INFO persistence | grep -E 'rdb_bgsave_in_progress|aof_rewrite_in_progress'
```

### A popular product's cache key expires and the database falls over. How do you protect it?

That's a stampede on a hot key. Add single-flight refresh with a short `SET NX` lock, serve the stale value while refreshing, add TTL jitter, and keep a short in-process cache in each app instance for ultra-hot keys.

```python
if r.set(f"lock:{key}", 1, nx=True, ex=10): refresh(key)
else: return stale_or_wait(key)
```

## Advanced

### You must migrate from a single Redis to Redis Cluster. What breaks?

Multi-key commands, transactions and Lua scripts that touch keys in different slots fail with `CROSSSLOT`. Fix them with hash tags (`{user:42}:*`). You also need cluster-aware clients, `SELECT` (multiple databases) isn't supported, and `KEYS`/`SCAN` must run per node.

```bash
MSET {cart:42}:items "…" {cart:42}:total "…"    # same slot
```

# Tricky Questions

## Beginner

### Is `GET` then `SET` a safe way to increment a counter?

No. Two clients can read the same value and both write value+1, so one increment is lost. Use the atomic `INCR`, or Lua or `WATCH` for more complex logic.

```bash
INCR visits    # atomic
```

## Intermediate

### If Redis is single-threaded, why can a slow client or command hurt everyone?

All commands share one execution thread, so a single slow O(n) command delays every queued command behind it. I/O threads only parallelise network reading and writing, not command execution.

```bash
DEBUG SLEEP 2     # (lab only) every other client waits 2 s
```

## Advanced

### Does `SET key value` remove an existing TTL?

Yes. A plain `SET` overwrites the value and clears the expiry, unless you pass `KEEPTTL` (or set `EX` again).

```bash
SET k v EX 100 ; SET k v2 ; TTL k        # -1 (no expiry now)
SET k v3 KEEPTTL
```
