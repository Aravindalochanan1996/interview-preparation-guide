---
id: postgresql
title: PostgreSQL
short: PostgreSQL
category: Databases & Messaging
order: 13.71
color: #336791
icon: Pg
summary: PostgreSQL in depth: data types, constraints, JSONB, indexes (B-tree, GIN, BRIN, partial), EXPLAIN, MVCC and VACUUM, transactions and locking, partitioning, replication, pooling and operations.
---

# Beginner

## Getting Started with psql

**PostgreSQL** is an open-source, ACID-compliant relational database. It's known for standards compliance, rich types (JSONB, arrays, ranges), extensibility (PostGIS, pgvector) and strong concurrency through MVCC.

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres:16
psql "postgresql://postgres:secret@localhost:5432/postgres"
```
```sql psql meta-commands
\l              -- list databases
\c shop         -- connect to a database
\dt             -- list tables
\d+ orders      -- describe a table (columns, indexes, constraints)
\dn             -- schemas
\du             -- roles
\x              -- expanded output
\timing on      -- show query time
\e              -- edit the last query in $EDITOR
```

## Tables, Data Types and Constraints

```sql
CREATE SCHEMA shop;
CREATE TABLE shop.customers (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()          -- always store timestamps with time zone
);
CREATE TABLE shop.orders (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES shop.customers(id) ON DELETE RESTRICT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','cancelled')),
  total       NUMERIC(12,2) NOT NULL CHECK (total >= 0),  -- NUMERIC for money, never float
  tags        TEXT[] DEFAULT '{}',
  metadata    JSONB NOT NULL DEFAULT '{}',
  id_public   UUID NOT NULL DEFAULT gen_random_uuid()
);
```

| Type | Use for |
|---|---|
| `BIGINT` identity / `UUID` | keys |
| `TEXT` / `VARCHAR(n)` | strings (TEXT is fine; add CHECK constraints for limits) |
| `NUMERIC(p,s)` | money and exact decimals |
| `TIMESTAMPTZ`, `DATE`, `INTERVAL` | time |
| `JSONB` | semi-structured data, indexable |
| `ARRAY`, `tstzrange`, `INET`, `ENUM` | lists, ranges, IP addresses, fixed sets |

## CRUD, UPSERT and RETURNING

```sql
INSERT INTO shop.customers (email, full_name) VALUES ('ada@x.io', 'Ada Lovelace') RETURNING id;

UPDATE shop.orders SET status = 'paid' WHERE id = 42 AND status = 'pending' RETURNING id, status;

DELETE FROM shop.orders WHERE status = 'cancelled' AND id < 1000 RETURNING id;

-- UPSERT: insert, or update on conflict with a unique constraint
INSERT INTO shop.inventory (sku, qty) VALUES ('A1', 5)
ON CONFLICT (sku) DO UPDATE SET qty = shop.inventory.qty + EXCLUDED.qty;

INSERT INTO shop.page_views (page, day, views) VALUES ('/home', current_date, 1)
ON CONFLICT (page, day) DO NOTHING;
```

## Querying: Joins, Aggregates and Useful Functions

```sql
SELECT c.full_name, COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS revenue
FROM shop.customers c
LEFT JOIN shop.orders o ON o.customer_id = c.id AND o.status = 'paid'
GROUP BY c.id
HAVING COUNT(o.id) >= 3
ORDER BY revenue DESC
LIMIT 10;

SELECT date_trunc('month', created_at) AS month, COUNT(*) FILTER (WHERE status = 'paid') AS paid
FROM shop.orders GROUP BY 1 ORDER BY 1;

SELECT string_agg(full_name, ', ' ORDER BY full_name) FROM shop.customers;
SELECT * FROM shop.customers WHERE email ILIKE '%@acme.com';
SELECT generate_series(date '2026-10-01', date '2026-10-07', interval '1 day');
```

# Intermediate

## JSONB

`JSONB` stores parsed, binary JSON. It supports indexing and rich operators. Use it for flexible attributes, not as a replacement for relational modelling.

```sql
UPDATE shop.orders SET metadata = '{"channel":"web","coupon":{"code":"SAVE10","pct":10},"items":[{"sku":"A1","qty":2}]}' WHERE id = 1;

SELECT metadata->>'channel'                     AS channel,      -- ->> returns text
       metadata->'coupon'->>'code'              AS coupon,
       metadata #>> '{coupon,pct}'              AS pct,
       jsonb_array_length(metadata->'items')    AS lines
FROM shop.orders WHERE metadata @> '{"channel":"web"}';           -- containment

UPDATE shop.orders SET metadata = jsonb_set(metadata, '{coupon,pct}', '15') WHERE id = 1;
UPDATE shop.orders SET metadata = metadata - 'coupon' WHERE id = 1;  -- remove a key

SELECT o.id, item->>'sku' AS sku, (item->>'qty')::int AS qty
FROM shop.orders o, jsonb_array_elements(o.metadata->'items') AS item;   -- explode an array

CREATE INDEX orders_metadata_gin ON shop.orders USING GIN (metadata jsonb_path_ops);   -- speeds up @>
```

## Indexes: B-tree, GIN, GiST, BRIN, Partial and Expression

```sql
CREATE INDEX CONCURRENTLY orders_customer_created_idx ON shop.orders (customer_id, created_at DESC);  -- B-tree, composite
CREATE INDEX orders_pending_idx ON shop.orders (created_at) WHERE status = 'pending';                 -- partial: small and hot
CREATE INDEX customers_lower_email_idx ON shop.customers (lower(email));                              -- expression
CREATE INDEX orders_cover_idx ON shop.orders (customer_id) INCLUDE (total, status);                   -- covering → index-only scan
CREATE INDEX orders_tags_gin ON shop.orders USING GIN (tags);                                         -- arrays/JSONB/full-text
CREATE INDEX events_created_brin ON events USING BRIN (created_at);                                   -- huge append-only tables, tiny index
CREATE EXTENSION pg_trgm; CREATE INDEX products_name_trgm ON products USING GIN (name gin_trgm_ops);  -- fast ILIKE '%shoe%'
```

| Index | Good for |
|---|---|
| B-tree | equality, ranges, ORDER BY (the default) |
| Hash | equality only |
| GIN | JSONB, arrays, full-text, trigram |
| GiST / SP-GiST | geometry, ranges, nearest-neighbour |
| BRIN | very large tables naturally ordered by a column (time) |

> [!TIP]
> Use `CREATE INDEX CONCURRENTLY` on production tables so writes aren't blocked. It can't run inside a transaction block.

## Reading EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, total FROM shop.orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20;
```
```text
Limit  (cost=0.43..8.95 rows=20 width=14) (actual time=0.031..0.062 rows=20 loops=1)
  ->  Index Scan using orders_customer_created_idx on orders  (actual rows=20 loops=1)
        Index Cond: (customer_id = 42)
        Buffers: shared hit=24
Planning Time: 0.15 ms
Execution Time: 0.09 ms
```
What to look for:
- **Seq Scan** on a big table with a selective filter means a missing or unusable index.
- **estimated rows ≠ actual rows** means stale statistics, so run `ANALYZE`.
- A **Sort** spilling to disk (`external merge`) means you need an index matching ORDER BY, or more `work_mem`.
- A **Nested Loop** with a huge `loops=` count means you need a join index or a hash join.

```sql
SELECT query, calls, mean_exec_time, total_exec_time FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
SELECT relname, seq_scan, idx_scan FROM pg_stat_user_tables ORDER BY seq_scan DESC LIMIT 10;
```

## Transactions, Isolation and Locking

```sql
BEGIN;                                                  -- READ COMMITTED by default
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;   -- row lock: others wait
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

BEGIN ISOLATION LEVEL SERIALIZABLE;                     -- may fail with 40001 → retry the transaction
SAVEPOINT before_risky;
-- … ROLLBACK TO SAVEPOINT before_risky;
COMMIT;

-- Job queue pattern: workers grab different rows without blocking each other
UPDATE jobs SET status = 'running', started_at = now()
WHERE id = (SELECT id FROM jobs WHERE status = 'queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING *;

SELECT pg_advisory_xact_lock(hashtext('nightly-report'));   -- app-level mutex
SET lock_timeout = '3s'; SET statement_timeout = '30s';
```

## Views, CTEs, Window Functions and Functions

```sql
CREATE MATERIALIZED VIEW shop.daily_revenue AS
SELECT date_trunc('day', created_at)::date AS day, SUM(total) AS revenue FROM shop.orders WHERE status = 'paid' GROUP BY 1;
CREATE UNIQUE INDEX ON shop.daily_revenue (day);
REFRESH MATERIALIZED VIEW CONCURRENTLY shop.daily_revenue;    -- needs the unique index

SELECT customer_id, total,
       RANK() OVER (PARTITION BY customer_id ORDER BY total DESC) AS rk,
       SUM(total) OVER (ORDER BY created_at ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS rolling
FROM shop.orders;

CREATE OR REPLACE FUNCTION shop.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER orders_touch BEFORE UPDATE ON shop.orders FOR EACH ROW EXECUTE FUNCTION shop.touch_updated_at();
```

# Advanced

## MVCC, VACUUM and Bloat

PostgreSQL never updates a row in place. An `UPDATE` writes a **new row version** and marks the old one dead (tracked by the `xmin`/`xmax` transaction IDs). Readers see a snapshot, so readers never block writers. **VACUUM** reclaims dead tuples, and **autovacuum** runs it automatically. **Transaction ID wraparound** must be prevented by freezing old rows.

```sql
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;

ALTER TABLE shop.orders SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01);  -- hot table
VACUUM (VERBOSE, ANALYZE) shop.orders;
SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;          -- wraparound risk if near 2 billion
SELECT pid, now() - xact_start AS age, state, query FROM pg_stat_activity
WHERE xact_start IS NOT NULL ORDER BY age DESC LIMIT 5;                       -- long transactions block vacuum
```

## Partitioning

```sql
CREATE TABLE events (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  tenant_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  payload JSONB,
  PRIMARY KEY (id, created_at)                            -- the PK must include the partition key
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_10 PARTITION OF events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE events_2026_11 PARTITION OF events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE events_default PARTITION OF events DEFAULT;

-- Drop old data instantly instead of a huge DELETE
ALTER TABLE events DETACH PARTITION events_2025_10 CONCURRENTLY;
DROP TABLE events_2025_10;
-- Automate creation with the pg_partman extension or a scheduled job
```

## Replication, High Availability and Backups

```sql On the primary
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '…';
SELECT client_addr, state, sent_lsn, replay_lsn,
       pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes FROM pg_stat_replication;
```
```bash Streaming replica + backups
pg_basebackup -h primary -U replicator -D /var/lib/postgresql/data -R -X stream -P   # -R writes standby config
pg_dump -Fc -d shop -f shop.dump && pg_restore -d shop_restore shop.dump             # logical backup
pgbackrest --stanza=main backup --type=full                                           # physical + WAL archiving → PITR
```
```sql Logical replication (selected tables, cross-version upgrades, CDC)
CREATE PUBLICATION shop_pub FOR TABLE shop.orders, shop.customers;
-- on the subscriber:
CREATE SUBSCRIPTION shop_sub CONNECTION 'host=primary dbname=shop user=replicator' PUBLICATION shop_pub;
```

## Connection Pooling, Security and Tuning

Each Postgres connection is a **process** (about 5–10 MB). Hundreds of idle app connections waste memory, so put **PgBouncer** in transaction mode in front of the database.

```ini pgbouncer.ini
[databases]
shop = host=127.0.0.1 port=5432 dbname=shop
[pgbouncer]
pool_mode = transaction
max_client_conn = 5000
default_pool_size = 50
```
```sql Least privilege and row-level security
CREATE ROLE app_rw LOGIN PASSWORD '…';
GRANT USAGE ON SCHEMA shop TO app_rw;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA shop TO app_rw;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

ALTER TABLE shop.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON shop.orders USING (tenant_id = current_setting('app.tenant_id')::bigint);
-- app: SET app.tenant_id = '42'; every query is now filtered to tenant 42
```
```ini postgresql.conf starting points (16 GB RAM)
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 32MB
maintenance_work_mem = 1GB
max_connections = 200
random_page_cost = 1.1        # SSDs
```

# Interview Questions

## Beginner

### What makes PostgreSQL different from MySQL?

PostgreSQL emphasises standards and extensibility. It has rich types (JSONB, arrays, ranges, custom types), advanced indexes (GIN, GiST, BRIN, partial, expression), transactional DDL, powerful window functions and CTEs, extensions (PostGIS, pgvector, TimescaleDB), and true serializable isolation. MySQL (InnoDB) is simpler to operate at a basic level and is traditionally strong for read-heavy web workloads.

```sql
BEGIN; ALTER TABLE orders ADD COLUMN note TEXT; ROLLBACK;   -- transactional DDL: the column never existed
```

### SERIAL vs IDENTITY vs UUID for primary keys?

`SERIAL` is legacy: it creates a sequence the table doesn't fully own. `GENERATED ALWAYS AS IDENTITY` is the SQL-standard, recommended choice. UUIDs are good for distributed or public ids. Random UUIDv4 values fragment B-tree indexes, so prefer time-ordered UUIDv7 or keep a bigint key internally.

```sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE
```

### TIMESTAMP vs TIMESTAMPTZ?

`TIMESTAMPTZ` stores an absolute instant (normalised to UTC) and converts to the session's `TimeZone` on output. `TIMESTAMP` has no zone, so it's ambiguous across regions. Use `TIMESTAMPTZ` for events.

```sql
SET TimeZone = 'Asia/Kolkata';
SELECT '2026-10-23 10:00:00+00'::timestamptz;   -- 2026-10-23 15:30:00+05:30
```

### What is an UPSERT in PostgreSQL?

`INSERT … ON CONFLICT (cols) DO UPDATE/DO NOTHING`. It needs a unique index or constraint on the conflict target, and it's atomic, so there's no race between "check" and "insert". `EXCLUDED` refers to the proposed row.

```sql
INSERT INTO settings (user_id, key, value) VALUES (1, 'theme', 'dark')
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value;
```

### What does RETURNING do?

It returns column values from rows affected by `INSERT`, `UPDATE` or `DELETE` in the same statement. That saves a round trip and avoids races.

```sql
UPDATE jobs SET status = 'done' WHERE id = 7 RETURNING id, finished_at;
```

## Intermediate

### JSON vs JSONB?

`JSON` stores the exact input text and re-parses it on every access. `JSONB` stores a decomposed binary format: whitespace and key order are dropped and duplicate keys collapse, but it's faster to query and supports GIN indexes and operators like `@>`, `?` and `jsonb_set`. Use JSONB almost always.

```sql
SELECT '{"a":1,"a":2}'::json, '{"a":1,"a":2}'::jsonb;   -- {"a":1,"a":2} | {"a": 2}
```

### When would you use a partial or expression index?

A partial index covers only the rows matching a WHERE clause (for example `status='pending'`), which keeps it small and hot. An expression index indexes a computed value (`lower(email)`) so that queries using the same expression can use it.

```sql
CREATE INDEX ON users (lower(email));
SELECT * FROM users WHERE lower(email) = lower('Ada@X.io');   -- uses the index
```

### Which index type would you use for JSONB, full-text, or a 5 TB time-series table?

GIN for JSONB containment and full-text `tsvector`. BRIN for a huge append-only table ordered by time: it's tiny and summarises block ranges. B-tree for normal equality and range lookups.

```sql
CREATE INDEX ON docs USING GIN (to_tsvector('english', body));
SELECT * FROM docs WHERE to_tsvector('english', body) @@ websearch_to_tsquery('english', 'refund policy');
```

### What is MVCC in PostgreSQL?

Multi-version concurrency control: each write creates a new tuple version stamped with transaction ids, and each transaction sees a consistent snapshot. Readers and writers don't block each other. The cost is dead tuples, which VACUUM must clean up.

```sql
SELECT xmin, xmax, * FROM accounts WHERE id = 1;   -- see the version metadata
```

### What does VACUUM do, and what's the difference from VACUUM FULL?

`VACUUM` marks dead tuples' space as reusable, updates the visibility map and freezes old xids, without blocking reads or writes. `VACUUM FULL` rewrites the table to return space to the OS, but it takes an exclusive lock. Prefer `pg_repack` for online compaction.

```sql
VACUUM (ANALYZE) orders;      -- routine
-- pg_repack -t orders -d shop    (online, no long exclusive lock)
```

### How do SELECT … FOR UPDATE and SKIP LOCKED help?

`FOR UPDATE` locks the selected rows until commit, so concurrent writers wait. That prevents lost updates. `SKIP LOCKED` lets other sessions skip rows that are already locked, which is perfect for parallel job queues where each worker takes a different row.

```sql
SELECT * FROM jobs WHERE status = 'queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 10;
```

## Advanced

### Why do you need connection pooling with PostgreSQL?

Each connection is an OS process with its own memory, and per-connection overhead and lock contention grow with count. Serverless and autoscaled apps can open thousands of connections. PgBouncer in transaction mode multiplexes many clients over a small pool. Remember that session state (prepared statements, `SET`, advisory locks) doesn't persist across transactions in that mode.

```sql
SHOW max_connections;
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

### How do you add a column or index to a huge table without downtime?

Add a nullable column, or one with a constant default (PG 11+ makes that metadata-only). Backfill in batches. Add `NOT NULL` through a `CHECK … NOT VALID` constraint, then `VALIDATE`. Build indexes with `CREATE INDEX CONCURRENTLY`. Always set `lock_timeout` so a migration can't queue behind a long transaction and block everyone.

```sql
SET lock_timeout = '5s';
ALTER TABLE orders ADD COLUMN region TEXT;
ALTER TABLE orders ADD CONSTRAINT region_nn CHECK (region IS NOT NULL) NOT VALID;
-- backfill in batches …
ALTER TABLE orders VALIDATE CONSTRAINT region_nn;
```

### Streaming vs logical replication?

Streaming (physical) replication ships WAL bytes to create an exact read-only copy of the whole cluster, used for HA and read replicas. Logical replication publishes row changes for selected tables to subscribers that can have different schemas or versions, used for upgrades, CDC and partial copies.

```sql
SELECT * FROM pg_replication_slots;     -- unused slots retain WAL and can fill the disk
```

### How would you implement multi-tenancy in PostgreSQL?

There are three models. A shared schema with a `tenant_id` on every table plus row-level security is the cheapest and scales to many tenants. Schema-per-tenant gives stronger separation but makes migrations harder. Database-per-tenant gives full isolation at the highest cost. Index `tenant_id` first in composite indexes, and consider partitioning or sharding (Citus) by tenant.

```sql
CREATE POLICY t ON invoices USING (tenant_id = current_setting('app.tenant_id')::bigint);
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
```

# Scenario Questions

## Beginner

### A query is fast in development but slow in production. Where do you start?

Run `EXPLAIN (ANALYZE, BUFFERS)` in production (or on a copy with production-sized data). Production has more rows, different data distribution and maybe stale statistics. Check for sequential scans, misestimated rows and disk sorts, then add the matching index and run `ANALYZE`.

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 20;
ANALYZE orders;
```

## Intermediate

### The database disk keeps growing although row counts are stable. What's happening?

It's table bloat from dead tuples that aren't vacuumed (often a long-running or idle-in-transaction session holds back the xmin horizon), or WAL retained by an inactive replication slot. Find and kill the old transaction, tune autovacuum for hot tables, drop unused slots, and compact with `pg_repack`.

```sql
SELECT pid, state, now() - xact_start FROM pg_stat_activity WHERE state LIKE 'idle in transaction%';
SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) FROM pg_replication_slots;
```

### Users get "too many clients already" during traffic peaks. How do you fix it?

The application instances open more connections than `max_connections` allows. Put PgBouncer (transaction mode) between the app and the database, shrink the per-instance pool sizes, close idle connections, and fix connection leaks. Raising `max_connections` alone wastes memory.

```text
40 pods × pool 20 = 800 connections → PgBouncer: 800 clients → 50 server connections
```

## Advanced

### A migration that added an index froze all writes on the orders table for 10 minutes. What should have happened?

A plain `CREATE INDEX` takes a lock that blocks writes for the whole build. Use `CREATE INDEX CONCURRENTLY` (outside a transaction), set `lock_timeout`, and check for invalid indexes if it fails.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_status_idx ON orders (status);
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;   -- drop and retry any invalid leftovers
```

# Tricky Questions

## Beginner

### What does `SELECT NULL = NULL` return?

`NULL` (unknown), not true. Use `IS NULL` or `IS NOT DISTINCT FROM`.

```sql
SELECT NULL = NULL, NULL IS NOT DISTINCT FROM NULL;   -- null | true
```

## Intermediate

### Why doesn't `WHERE created_at::date = '2026-10-23'` use the index on created_at?

Casting the column turns it into an expression, so the plain B-tree index on `created_at` doesn't apply. Rewrite it as a range on the raw column (or create an expression index).

```sql
WHERE created_at >= '2026-10-23' AND created_at < '2026-10-24'
```

## Advanced

### Can OFFSET pagination become slow? What's the alternative?

Yes. `OFFSET 100000` still reads and discards 100,000 rows. Use keyset (seek) pagination on an indexed, unique sort key instead.

```sql
SELECT id, created_at FROM orders
WHERE (created_at, id) < ('2026-10-22 10:00', 98765)
ORDER BY created_at DESC, id DESC LIMIT 20;
```
