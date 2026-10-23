---
id: sql
title: SQL & Databases
short: SQL & DBs
category: Backend
order: 13
color: #336791
icon: DB
summary: SQL querying, joins, aggregation, window functions, indexing, transactions & isolation, normalization, query plans, NoSQL, Redis and scaling databases.
---

# Beginner

## Relational Databases and Basic Queries

A relational database stores data in **tables** (relations) of **rows** and **columns**, linked by keys. Popular engines: PostgreSQL, MySQL, SQL Server, Oracle, SQLite.

```sql
CREATE TABLE customers (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  city        VARCHAR(50),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  customer_id  INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) CHECK (amount > 0),
  status       VARCHAR(20) DEFAULT 'pending',
  created_at   TIMESTAMPTZ DEFAULT now()
);

INSERT INTO customers (name, email, city) VALUES ('Asha', 'asha@x.com', 'Chennai');
SELECT name, email FROM customers WHERE city = 'Chennai' ORDER BY name LIMIT 10;
UPDATE orders SET status = 'paid' WHERE id = 42;
DELETE FROM orders WHERE status = 'cancelled';
```

### SQL sub-languages
- **DDL** (definition): `CREATE`, `ALTER`, `DROP`, `TRUNCATE`.
- **DML** (manipulation): `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
- **DCL** (control): `GRANT`, `REVOKE`.
- **TCL** (transactions): `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`.

### Keys and constraints
**Primary key** (unique + not null identifier), **foreign key** (referential integrity), `UNIQUE`, `NOT NULL`, `CHECK`, `DEFAULT`. Natural keys (email) vs surrogate keys (auto id / UUID).

## Filtering, Sorting and NULL

```sql
SELECT * FROM orders
WHERE amount BETWEEN 100 AND 500
  AND status IN ('paid', 'shipped')
  AND created_at >= '2026-01-01'
  AND customer_id IS NOT NULL
  AND note LIKE '%gift%'        -- ILIKE for case-insensitive in Postgres
ORDER BY amount DESC, created_at
LIMIT 20 OFFSET 40;
```

### NULL semantics
- `NULL` means unknown. `NULL = NULL` is **unknown**, not true → use `IS NULL`.
- Aggregates ignore NULLs (`COUNT(col)` skips them; `COUNT(*)` doesn't).
- `COALESCE(discount, 0)` replaces NULL.
- `NOT IN (subquery)` returns nothing if the subquery contains a NULL — prefer `NOT EXISTS`.

### Logical query processing order
`FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT`. That's why you can't use a `SELECT` alias in `WHERE`, but you can in `ORDER BY`.

## Joins

```sql
-- INNER: only matching rows
SELECT c.name, o.amount FROM customers c JOIN orders o ON o.customer_id = c.id;

-- LEFT: all customers, order columns NULL if none
SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id;

-- Customers with no orders (anti-join)
SELECT c.* FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;

-- FULL OUTER: all rows from both sides
-- CROSS JOIN: Cartesian product
-- SELF JOIN: employees and their managers
SELECT e.name AS employee, m.name AS manager
FROM employees e LEFT JOIN employees m ON e.manager_id = m.id;
```

| Join | Returns |
|---|---|
| INNER | rows with matches in both tables |
| LEFT (OUTER) | all left rows + matches (NULLs otherwise) |
| RIGHT (OUTER) | all right rows + matches |
| FULL (OUTER) | all rows from both sides |
| CROSS | every combination |

> [!WARN]
> Putting a condition on the right table in `WHERE` turns a LEFT JOIN into an INNER JOIN. Put it in the `ON` clause to keep unmatched rows.

## Aggregation and GROUP BY

```sql
SELECT customer_id,
       COUNT(*)            AS orders,
       SUM(amount)         AS revenue,
       AVG(amount)         AS avg_order,
       MAX(created_at)     AS last_order
FROM orders
WHERE status = 'paid'
GROUP BY customer_id
HAVING SUM(amount) > 1000
ORDER BY revenue DESC;
```
- `WHERE` filters rows **before** grouping; `HAVING` filters groups **after**.
- Every non-aggregated column in `SELECT` must appear in `GROUP BY`.
- `COUNT(DISTINCT customer_id)`, conditional aggregation: `SUM(CASE WHEN status='paid' THEN amount ELSE 0 END)` or `COUNT(*) FILTER (WHERE status='paid')` (Postgres).

# Intermediate

## Subqueries, CTEs and Set Operations

```sql
-- Scalar subquery
SELECT name, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count FROM customers c;

-- EXISTS (correlated)
SELECT * FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.amount > 1000);

-- CTE (WITH) — readable, reusable named subqueries
WITH monthly AS (
  SELECT date_trunc('month', created_at) AS month, SUM(amount) AS revenue
  FROM orders GROUP BY 1
)
SELECT month, revenue FROM monthly WHERE revenue > 50000;

-- Recursive CTE: org chart / category tree
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 1 AS depth FROM employees WHERE id = 7
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.depth + 1 FROM employees e JOIN chain c ON e.id = c.manager_id
)
SELECT * FROM chain;
```

Set operations: `UNION` (dedupe), `UNION ALL` (keep duplicates — faster), `INTERSECT`, `EXCEPT`.

## Window Functions

Window functions compute across related rows **without collapsing them** (unlike GROUP BY).

```sql
SELECT
  id, customer_id, amount,
  ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn,
  RANK()       OVER (ORDER BY amount DESC)  AS rnk,        -- gaps after ties: 1,1,3
  DENSE_RANK() OVER (ORDER BY amount DESC)  AS drnk,       -- no gaps: 1,1,2
  SUM(amount)  OVER (PARTITION BY customer_id ORDER BY created_at) AS running_total,
  AVG(amount)  OVER (ORDER BY created_at ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg_7,
  LAG(amount)  OVER (PARTITION BY customer_id ORDER BY created_at) AS prev_amount,
  amount * 100.0 / SUM(amount) OVER () AS pct_of_total
FROM orders;
```

### Classic interview queries
```sql
-- Nth highest salary (e.g., 2nd)
SELECT DISTINCT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS r FROM employees
) t WHERE r = 2;

-- Top 3 earners per department
SELECT * FROM (
  SELECT e.*, ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rn FROM employees e
) t WHERE rn <= 3;

-- Latest order per customer
SELECT DISTINCT ON (customer_id) * FROM orders ORDER BY customer_id, created_at DESC; -- Postgres

-- Find duplicates
SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;

-- Delete duplicates keeping the lowest id
DELETE FROM users u USING users d WHERE u.email = d.email AND u.id > d.id;

-- Employees earning more than their manager
SELECT e.name FROM employees e JOIN employees m ON e.manager_id = m.id WHERE e.salary > m.salary;

-- Consecutive days logged in (gaps & islands)
SELECT user_id, MIN(day) AS start_day, COUNT(*) AS streak FROM (
  SELECT user_id, day, day - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day))::int AS grp FROM logins
) t GROUP BY user_id, grp HAVING COUNT(*) >= 3;
```

## Normalization and Data Modeling

```sql ❌ Unnormalised
CREATE TABLE orders (id INT, customer_name TEXT, customer_email TEXT, products TEXT); -- 'pen,ink'
```
```sql ✅ 3NF
CREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL);
CREATE TABLE products  (id SERIAL PRIMARY KEY, name TEXT NOT NULL, price NUMERIC(10,2) NOT NULL);
CREATE TABLE orders    (id SERIAL PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE order_items (
  order_id   INT REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  qty        INT NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(10,2) NOT NULL,          -- snapshot of price at purchase time
  PRIMARY KEY (order_id, product_id)
);
```

### Normal forms
- **1NF** — atomic values, no repeating groups (no comma-separated lists in a column).
- **2NF** — 1NF + no partial dependency on part of a composite key.
- **3NF** — 2NF + no transitive dependencies (non-key columns depend only on the key: "the key, the whole key, and nothing but the key").
- **BCNF** — every determinant is a candidate key.

Benefits: less redundancy, no update/insert/delete anomalies.

### Denormalization
Intentionally duplicating data (e.g., storing `order_total`, counters, read models) to speed up reads at the cost of write complexity and consistency management. Common in analytics (star schemas: fact + dimension tables) and high-read systems.

### Relationships
- One-to-many: FK on the "many" side.
- Many-to-many: junction table (`student_courses(student_id, course_id)` with a composite PK).
- One-to-one: FK with a UNIQUE constraint.

## Indexes

An index is an auxiliary data structure (usually a **B-tree**) that lets the DB find rows without scanning the whole table — like a book's index.

```sql
CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_cust_date ON orders (customer_id, created_at DESC);   -- composite
CREATE UNIQUE INDEX idx_users_email ON users (lower(email));                  -- expression
CREATE INDEX idx_active ON orders (created_at) WHERE status = 'pending';      -- partial
CREATE INDEX idx_cover ON orders (customer_id) INCLUDE (amount);              -- covering
```

### Rules of thumb
- Index columns used in `WHERE`, `JOIN`, `ORDER BY`, and FKs.
- **Composite index column order matters** — the leftmost-prefix rule: `(a, b)` helps `WHERE a=?` and `WHERE a=? AND b=?`, not `WHERE b=?` alone. Put equality columns before range columns.
- Indexes speed reads but **slow writes** and use storage.
- Low-selectivity columns (boolean) rarely benefit, except as partial indexes.
- Functions on columns defeat indexes: `WHERE lower(email) = ?` needs an expression index; `WHERE created_at::date = ?` → rewrite as a range.
- `LIKE 'abc%'` can use an index; `LIKE '%abc'` can't (use trigram/full-text indexes).

### Index types
B-tree (default, equality/range/sort), Hash (equality), GIN (arrays, JSONB, full-text), GiST/SP-GiST (geometric, ranges), BRIN (huge, naturally ordered tables like time series).

### Clustered vs non-clustered
A **clustered** index defines the physical order of table rows (one per table — InnoDB's primary key, SQL Server). **Non-clustered** indexes are separate structures pointing to rows.

## Transactions and ACID

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;      -- or ROLLBACK;
```

| Property | Meaning |
|---|---|
| **Atomicity** | all or nothing |
| **Consistency** | constraints hold before and after |
| **Isolation** | concurrent transactions don't interfere (to a chosen degree) |
| **Durability** | committed data survives crashes (write-ahead log) |

# Advanced

## Isolation Levels and Concurrency Anomalies

| Anomaly | Description |
|---|---|
| Dirty read | read uncommitted changes of another transaction |
| Non-repeatable read | same row read twice gives different values |
| Phantom read | same query returns new rows inserted by others |
| Lost update | two read-modify-write cycles overwrite each other |
| Write skew | two transactions read overlapping data and write disjoint rows, violating an invariant |

| Level | Dirty | Non-repeatable | Phantom |
|---|---|---|---|
| Read Uncommitted | possible | possible | possible |
| **Read Committed** (Postgres/Oracle/SQL Server default) | ✗ | possible | possible |
| **Repeatable Read** (MySQL InnoDB default) | ✗ | ✗ | possible (prevented in Postgres) |
| Serializable | ✗ | ✗ | ✗ |

```sql Lost update, and two fixes
-- T1 and T2 both read balance = 100, both write 100 - 10 → 90 (one withdrawal lost)
UPDATE accounts SET balance = balance - 10 WHERE id = 1;          -- fix 1: atomic update

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;                -- fix 2: stronger isolation
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;             -- or a row lock
UPDATE accounts SET balance = 90 WHERE id = 1;
COMMIT;
```

### MVCC
Postgres/MySQL use **Multi-Version Concurrency Control**: readers see a snapshot and don't block writers; old row versions are cleaned up later (Postgres `VACUUM`).

### Locking strategies
- **Pessimistic**: `SELECT … FOR UPDATE` locks rows until commit (`SKIP LOCKED` for job queues, `NOWAIT`).
- **Optimistic**: version column; `UPDATE … SET version = version + 1 WHERE id = ? AND version = ?` and retry if 0 rows updated.
- **Deadlocks**: two transactions waiting on each other's locks. DBs detect and abort one. Prevent by locking rows in a consistent order and keeping transactions short.

## Query Optimisation and Execution Plans

```sql
EXPLAIN ANALYZE
SELECT c.name, SUM(o.amount)
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE o.created_at > now() - interval '30 days'
GROUP BY c.name;
```

What to look for:
- **Seq Scan** on a large table where few rows are needed → missing/unused index.
- **Index Scan / Index Only Scan / Bitmap Heap Scan**.
- Join algorithms: **Nested Loop** (small inputs, indexed inner), **Hash Join** (large unsorted), **Merge Join** (sorted inputs).
- Estimated vs actual row counts far apart → stale statistics (`ANALYZE`).
- Sorts spilling to disk (increase `work_mem` or add an index matching `ORDER BY`).

### Optimisation checklist
1. Select only needed columns (avoid `SELECT *`).
2. Add the right indexes (composite, covering, partial).
3. Make predicates **sargable** (no functions on indexed columns).
4. Replace correlated subqueries with joins/window functions when beneficial.
5. Use **keyset pagination** (`WHERE id > :last ORDER BY id LIMIT 20`) instead of large OFFSETs.
6. Batch writes; avoid N+1 queries from the app.
7. Keep statistics up to date; tune connection pooling.
8. Materialized views or summary tables for heavy aggregates.
9. Partition very large tables (by date/range/hash).

## Scaling Databases

- **Vertical scaling** — bigger machine; simplest, limited.
- **Read replicas** — async replication; route reads to replicas (watch **replication lag** → read-your-writes issues).
- **Connection pooling** — PgBouncer/ProxySQL; DB connections are expensive.
- **Caching** — Redis/Memcached in front (cache-aside).
- **Partitioning** — split a table within one DB (range/list/hash) to prune scans and manage retention.
- **Sharding** — split data across multiple DB servers by a shard key (user_id hash, tenant, region). Challenges: cross-shard joins/transactions, rebalancing (use consistent hashing or a directory), hot shards.
- **Distributed SQL** — CockroachDB, YugabyteDB, Spanner, Vitess (MySQL sharding).

```sql Range partitioning (PostgreSQL)
CREATE TABLE events (id BIGSERIAL, created_at TIMESTAMPTZ NOT NULL, payload JSONB) PARTITION BY RANGE (created_at);
CREATE TABLE events_2026_10 PARTITION OF events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE events_2026_11 PARTITION OF events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
-- Queries with WHERE created_at >= '2026-10-15' only scan the relevant partition
```
```ini pgbouncer.ini
[databases]
app = host=primary port=5432 dbname=app
[pgbouncer]
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 40
```

### CAP and PACELC
In a network **P**artition, a distributed system must choose **C**onsistency or **A**vailability. PACELC adds: **E**lse (normal operation), trade **L**atency vs **C**onsistency.

## NoSQL Databases and When to Use Them

| Type | Examples | Good for |
|---|---|---|
| Document | MongoDB, Couchbase, Firestore | flexible schemas, nested aggregates (catalogs, CMS) |
| Key-value | Redis, DynamoDB, etcd | caching, sessions, simple fast lookups |
| Wide-column | Cassandra, ScyllaDB, HBase, Bigtable | massive write throughput, time series, partition-key access |
| Graph | Neo4j, Neptune | relationships: social graphs, recommendations, fraud |
| Search | Elasticsearch, OpenSearch | full-text search, log analytics |
| Vector | pgvector, Pinecone, Weaviate, Qdrant | embeddings similarity search (AI/RAG) |

**SQL vs NoSQL**: SQL gives strong consistency, joins, flexible ad-hoc queries and transactions. NoSQL gives schema flexibility and easier horizontal scaling, but you model around access patterns and often accept eventual consistency. Most companies use both (polyglot persistence). Modern Postgres (JSONB, pgvector) covers many NoSQL use cases.

### MongoDB snippet
```js
db.orders.find({ status: "paid", amount: { $gt: 100 } }).sort({ createdAt: -1 }).limit(10);
db.orders.aggregate([
  { $match: { status: "paid" } },
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
]);
```
Model by embedding data read together; reference when data is large, shared or unbounded.

## Redis Deep Dive

Redis is an in-memory data structure store: **strings, hashes, lists, sets, sorted sets, streams, bitmaps, HyperLogLog, geo, JSON**.

| Use case | Structure / command |
|---|---|
| Cache | `SET key val EX 300`, `GET` |
| Rate limiting | `INCR` + `EXPIRE`, or sorted sets for sliding windows |
| Leaderboards | sorted sets `ZADD`, `ZREVRANGE` |
| Sessions | hashes with TTL |
| Queues | lists `LPUSH`/`BRPOP`, or Streams with consumer groups |
| Pub/sub | `PUBLISH`/`SUBSCRIBE` |
| Distributed lock | `SET lock:x token NX PX 30000` (release only if token matches) |
| Unique counts | HyperLogLog `PFADD`/`PFCOUNT` |

```bash
SET session:abc '{"uid":42}' EX 1800       # cache with TTL
INCR rate:42:202610231200 && EXPIRE rate:42:202610231200 60   # rate limit per minute
ZADD leaderboard 1500 "ada" 1200 "bob"     # sorted set
ZREVRANGE leaderboard 0 9 WITHSCORES       # top 10
SET lock:order:7 worker-1 NX PX 30000      # simple distributed lock
XADD orders * id 7 total 20                # stream
```

### Caching patterns
- **Cache-aside** (lazy loading): app reads cache → on miss reads DB and populates cache. Most common.
- **Write-through**: write to cache and DB together. **Write-behind**: write cache, flush to DB async.
- **Invalidation**: TTLs, delete-on-write, versioned keys.
- Problems: **cache stampede** (many misses at once → use locks/request coalescing, early refresh), **cache penetration** (queries for non-existent keys → cache nulls, bloom filters), **cache avalanche** (many keys expire together → add jitter to TTLs).

Persistence: RDB snapshots and AOF logs. High availability: replication + Sentinel, or Redis Cluster (16384 hash slots) for sharding. Eviction policies: `allkeys-lru`, `volatile-ttl`, `allkeys-lfu`, etc.

# Interview Questions

## Beginner

### What is the difference between WHERE and HAVING?
`WHERE` filters individual rows before grouping and can't use aggregates. `HAVING` filters groups after `GROUP BY` and can use aggregate functions like `SUM()` or `COUNT()`.

```sql
SELECT customer_id, SUM(total) AS spent
FROM orders
WHERE status = 'paid'            -- filters rows before grouping
GROUP BY customer_id
HAVING SUM(total) > 1000;        -- filters groups after aggregation
```

### Explain the types of joins.
INNER returns matching rows from both tables. LEFT returns all left rows plus matches (NULLs where none). RIGHT is the mirror. FULL OUTER returns all rows from both. CROSS returns the Cartesian product. A SELF JOIN joins a table to itself (e.g., employee-manager).

```sql
SELECT c.name, o.id FROM customers c INNER JOIN orders o ON o.customer_id = c.id; -- only customers with orders
SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id;  -- all customers, NULL if no order
SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL; -- customers without orders
SELECT * FROM a FULL OUTER JOIN b ON a.k = b.k;                                     -- everything from both
SELECT s.size, c.color FROM sizes s CROSS JOIN colors c;                            -- every combination
SELECT e.name, m.name AS manager FROM employees e LEFT JOIN employees m ON e.manager_id = m.id; -- self join
```

### What is a primary key vs a foreign key?
A primary key uniquely identifies each row and cannot be NULL. A foreign key is a column referencing another table's primary (or unique) key, enforcing referential integrity between related tables.

```sql
CREATE TABLE departments (id INT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE employees (
  id INT PRIMARY KEY,
  dept_id INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT
);
INSERT INTO employees VALUES (1, 99);  -- ERROR: violates foreign key constraint (no department 99)
```

### DELETE vs TRUNCATE vs DROP?
`DELETE` removes rows matching a condition, is logged per row, fires triggers and can be rolled back. `TRUNCATE` quickly removes all rows (minimal logging, resets identity, DDL in some engines). `DROP` removes the entire table structure and data.

```sql
DELETE FROM logs WHERE created_at < now() - interval '90 days';  -- some rows, triggers fire
TRUNCATE TABLE staging_import RESTART IDENTITY;                    -- all rows, fast, resets sequence
DROP TABLE IF EXISTS tmp_report;                                   -- table + structure gone
```

### What is normalization?
Organising tables to minimise redundancy and anomalies by applying normal forms: 1NF (atomic values), 2NF (no partial dependencies), 3NF (no transitive dependencies). It improves integrity at the cost of more joins.

```sql
-- Violates 3NF: city depends on zip, not on the key
CREATE TABLE customers (id INT PRIMARY KEY, name TEXT, zip TEXT, city TEXT);
-- Normalised
CREATE TABLE zip_codes (zip TEXT PRIMARY KEY, city TEXT NOT NULL);
CREATE TABLE customers (id INT PRIMARY KEY, name TEXT, zip TEXT REFERENCES zip_codes(zip));
```

### What is the difference between UNION and UNION ALL?
`UNION` combines result sets and removes duplicates (requiring a sort/hash). `UNION ALL` keeps all rows and is faster. Use `UNION ALL` unless you need deduplication.

```sql
SELECT email FROM customers UNION     SELECT email FROM newsletter;  -- deduplicated (extra sort/hash)
SELECT email FROM customers UNION ALL SELECT email FROM newsletter;  -- every row, faster
```

### How do you handle NULLs in SQL?
Use `IS NULL`/`IS NOT NULL` for comparison, `COALESCE` to supply defaults, and remember aggregates skip NULLs and `NOT IN` with NULLs yields no rows — use `NOT EXISTS`.

```sql
SELECT name, COALESCE(phone, 'n/a') AS phone FROM users;
SELECT * FROM users WHERE deleted_at IS NULL;
SELECT AVG(rating) FROM reviews;             -- NULL ratings are ignored, not counted as 0
SELECT * FROM users u WHERE NOT EXISTS (SELECT 1 FROM blocked b WHERE b.user_id = u.id); -- NULL-safe
SELECT NULLIF(qty, 0) FROM items;            -- avoid division by zero: total / NULLIF(qty, 0)
SELECT * FROM t WHERE a IS DISTINCT FROM b;  -- NULL-aware comparison
```

## Intermediate

### What is an index and how does it work?
A data structure (typically a B-tree) storing sorted column values with pointers to rows, letting the database find rows in logarithmic time instead of scanning the table. It speeds up reads, joins and sorting, but costs storage and slows inserts/updates/deletes.

```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'ada@x.io';
-- Seq Scan on users  (rows=1) (actual time=0.02..210.5)
CREATE INDEX idx_users_email ON users (email);
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'ada@x.io';
-- Index Scan using idx_users_email  (actual time=0.03..0.04)
```

### How do composite indexes work?
They index multiple columns in a defined order and can be used for queries filtering on a leftmost prefix of those columns. `(customer_id, created_at)` serves `WHERE customer_id = ?` and `… AND created_at > ?`, and `ORDER BY created_at` within a customer, but not `WHERE created_at > ?` alone.

```sql
CREATE INDEX idx_orders_cust_created ON orders (customer_id, created_at DESC);
SELECT * FROM orders WHERE customer_id = 7;                                   -- ✅ uses it
SELECT * FROM orders WHERE customer_id = 7 ORDER BY created_at DESC LIMIT 10; -- ✅ uses it, no sort
SELECT * FROM orders WHERE created_at > now() - interval '1 day';             -- ❌ not the leftmost column
CREATE INDEX idx_cover ON orders (customer_id) INCLUDE (total);               -- covering → index-only scan
```

### What are window functions? Give an example.
Functions that compute values over a set of rows related to the current row without collapsing them: `ROW_NUMBER()`, `RANK()`, `LAG()`, running `SUM() OVER (PARTITION BY … ORDER BY …)`. Example: top N per group, running totals, period-over-period comparisons.

```sql
SELECT
  order_id, customer_id, total,
  SUM(total)   OVER (PARTITION BY customer_id ORDER BY created_at) AS running_total,
  ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS recency,
  LAG(total)   OVER (PARTITION BY customer_id ORDER BY created_at) AS previous_total,
  AVG(total)   OVER (ORDER BY created_at ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg_7
FROM orders;
```

### Find the second-highest salary.
`SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);` or with `DENSE_RANK() OVER (ORDER BY salary DESC) = 2` (handles ties and generalises to N). `OFFSET 1 LIMIT 1` on distinct salaries also works.

```sql
SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);

SELECT DISTINCT salary FROM (
  SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rk FROM employees
) t WHERE rk = 2;

-- Nth highest per department
SELECT * FROM (
  SELECT e.*, DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) rk FROM employees e
) t WHERE rk = 2;
```

### What are ACID properties?
Atomicity (all-or-nothing), Consistency (constraints are preserved), Isolation (concurrent transactions don't see each other's partial work, per isolation level), Durability (committed data persists, via the write-ahead log).

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;   -- Atomicity: both or neither
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
-- Consistency: CHECK (balance >= 0) is enforced; a violation aborts the transaction
COMMIT;                                                       -- Durability: survives a crash (WAL)
-- Isolation: other sessions never see the money "in flight"
```

### What is a CTE and when do you use a recursive CTE?
A Common Table Expression (`WITH name AS (...)`) defines a named temporary result for one statement, improving readability and reuse. Recursive CTEs traverse hierarchical data — org charts, category trees, graph paths — by unioning an anchor query with a recursive part.

```sql
WITH paid AS (
  SELECT customer_id, SUM(total) AS spent FROM orders WHERE status = 'paid' GROUP BY customer_id
)
SELECT c.name, p.spent FROM paid p JOIN customers c ON c.id = p.customer_id WHERE p.spent > 500;

WITH RECURSIVE chain AS (                     -- org chart below employee 1
  SELECT id, name, manager_id, 1 AS depth FROM employees WHERE id = 1
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.depth + 1
  FROM employees e JOIN chain c ON e.manager_id = c.id
)
SELECT * FROM chain ORDER BY depth;
```

### RANK vs DENSE_RANK vs ROW_NUMBER?
`ROW_NUMBER` assigns unique sequential numbers (ties broken arbitrarily). `RANK` gives ties the same rank and skips subsequent numbers (1,1,3). `DENSE_RANK` gives ties the same rank without gaps (1,1,2).

```sql
SELECT name, score,
  ROW_NUMBER() OVER (ORDER BY score DESC) AS rn,     -- 1 2 3 4
  RANK()       OVER (ORDER BY score DESC) AS rnk,    -- 1 1 3 4
  DENSE_RANK() OVER (ORDER BY score DESC) AS drnk    -- 1 1 2 3
FROM players;  -- scores: 90, 90, 80, 70
```

### SQL vs NoSQL — how do you choose?
Choose SQL for structured data with relationships, transactions, complex queries and strong consistency (most business systems). Choose NoSQL when access patterns are simple and known, you need flexible schemas, massive horizontal scale or specialised models (graph, wide-column, key-value). Many systems use both.

```sql SQL: relational, transactional
SELECT o.id, SUM(i.qty * i.unit_price) FROM orders o JOIN order_items i ON i.order_id = o.id
WHERE o.customer_id = 7 GROUP BY o.id;
```
```js NoSQL (MongoDB): document read in one go, flexible schema
db.orders.find({ customerId: 7 }, { items: 1, total: 1 });
// { _id, customerId: 7, items: [{ sku: 'A', qty: 2 }], total: 40 }
```

## Advanced

### Explain transaction isolation levels and the anomalies they prevent.
Read Uncommitted allows dirty reads. Read Committed prevents dirty reads but allows non-repeatable reads and phantoms. Repeatable Read prevents non-repeatable reads (and phantoms in Postgres through snapshots). Serializable prevents all anomalies including write skew, at the cost of more aborts/locking.

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;   -- default in PostgreSQL
-- T1                                          -- T2
BEGIN;                                         BEGIN;
SELECT stock FROM p WHERE id=1;  -- 5
                                               UPDATE p SET stock = 4 WHERE id=1; COMMIT;
SELECT stock FROM p WHERE id=1;  -- 4  ← non-repeatable read (prevented by REPEATABLE READ)
COMMIT;
BEGIN ISOLATION LEVEL SERIALIZABLE;           -- prevents all anomalies; be ready to retry on 40001
```

### How would you optimise a slow query?
Run `EXPLAIN ANALYZE` to see the plan. Look for sequential scans, bad row estimates, expensive sorts or nested loops on large sets. Add or adjust indexes (composite/covering/partial), make predicates sargable, select fewer columns, rewrite subqueries, use keyset pagination, update statistics, and consider caching, materialized views or partitioning.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE lower(email) = 'ada@x.io' AND status = 'paid' ORDER BY created_at DESC LIMIT 20;
-- Seq Scan … rows removed by filter: 9,800,000 → missing index / function on column

CREATE INDEX CONCURRENTLY idx_orders_email_status ON orders (lower(email), status, created_at DESC);
ANALYZE orders;                                    -- refresh statistics
SELECT id, total, created_at FROM orders ...;      -- select only needed columns
```

### What is MVCC?
Multi-Version Concurrency Control keeps multiple versions of rows so readers see a consistent snapshot without blocking writers and writers don't block readers. Each transaction sees versions committed before its snapshot. Old versions are garbage-collected (VACUUM in Postgres, undo logs in InnoDB).

```sql
-- Session A                                   -- Session B
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT price FROM products WHERE id=1; -- 10
                                               UPDATE products SET price = 12 WHERE id=1; COMMIT; -- not blocked
SELECT price FROM products WHERE id=1; -- 10   (A still sees its snapshot)
COMMIT;
SELECT xmin, xmax, price FROM products WHERE id = 1;  -- row-version metadata in PostgreSQL
```

### Optimistic vs pessimistic locking?
Pessimistic locking acquires locks before modifying (`SELECT … FOR UPDATE`), preventing conflicts but reducing concurrency — good for high contention. Optimistic locking lets transactions proceed and detects conflicts at write time via a version/timestamp check, retrying on conflict — good for low contention and long user think-times.

```sql Pessimistic
BEGIN;
SELECT * FROM seats WHERE id = 42 FOR UPDATE;      -- others wait
UPDATE seats SET booked_by = 7 WHERE id = 42;
COMMIT;
```
```sql Optimistic
UPDATE documents SET body = 'new', version = version + 1
WHERE id = 5 AND version = 3;                      -- 0 rows updated → someone else changed it, retry
```

### How do you design database sharding?
Pick a shard key with high cardinality and even distribution that matches access patterns (e.g., tenant_id or user_id). Route via hashing (consistent hashing to ease rebalancing) or a lookup directory. Avoid cross-shard joins/transactions by co-locating related data, plan for resharding, hot-key mitigation and global unique IDs (Snowflake/UUIDv7).

```js Hash-based routing in the application
const SHARDS = [pgShard0, pgShard1, pgShard2, pgShard3];
function shardFor(tenantId) {
  const h = crypto.createHash('md5').update(String(tenantId)).digest().readUInt32BE(0);
  return SHARDS[h % SHARDS.length];        // prefer consistent hashing to ease resharding
}
await shardFor(order.tenantId).query('INSERT INTO orders ...', [...]);
```

### What is a deadlock and how do you prevent it?
Two or more transactions each hold a lock the other needs, so none can proceed. Databases detect cycles and abort a victim. Prevent by acquiring locks in a consistent order, keeping transactions short, using appropriate indexes (fewer locked rows), lower isolation where safe, and retrying aborted transactions.

```sql
-- T1: UPDATE accounts SET … WHERE id = 1;  then id = 2
-- T2: UPDATE accounts SET … WHERE id = 2;  then id = 1   → deadlock
-- Fix: always lock in the same order
BEGIN;
SELECT * FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE;
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
UPDATE accounts SET balance = balance + 50 WHERE id = 2;
COMMIT;
SET lock_timeout = '2s';   -- fail fast instead of waiting forever
```

### How do you handle cache consistency with a database?
Use cache-aside with delete-on-write (invalidate after the DB commit), short TTLs as a safety net, versioned keys, and CDC/events (Debezium) to invalidate across services. Guard against stampedes with locks or request coalescing, and accept bounded staleness where the business allows it.

```js Cache-aside with delete-after-commit
async function getProduct(id) {
  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);
  const row = await db.one('SELECT * FROM products WHERE id = $1', [id]);
  await redis.set(`product:${id}`, JSON.stringify(row), { EX: 300 });   // TTL as safety net
  return row;
}
async function updatePrice(id, price) {
  await db.none('UPDATE products SET price = $2 WHERE id = $1', [id, price]);
  await redis.del(`product:${id}`);                                    // invalidate after commit
}
```

### What is the difference between clustered and non-clustered indexes?
A clustered index determines the physical order of rows in the table, so there's only one (InnoDB's primary key). A non-clustered (secondary) index is a separate structure storing key values and a pointer (row id or primary key) to the row, requiring an extra lookup unless it's covering.

```sql SQL Server
CREATE CLUSTERED INDEX cx_orders_created ON orders (created_at);      -- table rows stored in this order (only one)
CREATE NONCLUSTERED INDEX ix_orders_customer ON orders (customer_id) INCLUDE (total); -- separate structure
```
```sql PostgreSQL (heap tables)
CLUSTER orders USING idx_orders_created;   -- one-time physical reorder, not maintained
```

# Scenario Questions

## Beginner

### A query that ran in 50 ms now takes 30 s since the table grew to 20 million rows. What do you do first?
Run **`EXPLAIN ANALYZE`** and look for sequential scans on big tables, bad row estimates, and sorts or hash joins spilling to disk. Then:
- Add an index that matches the `WHERE`/`JOIN`/`ORDER BY` columns (a composite index in the right column order).
- Rewrite non-sargable predicates (`WHERE DATE(created_at) = …` becomes a range).
- Update statistics (`ANALYZE`).
- Paginate with keyset pagination instead of a big `OFFSET`.

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM events WHERE account_id = 42 ORDER BY created_at DESC LIMIT 50;
-- Sort Method: external merge Disk: 1.2GB  ← sorting 20M rows
CREATE INDEX CONCURRENTLY idx_events_account_created ON events (account_id, created_at DESC);
-- → Index Scan, Limit 50, 3 ms
SELECT relname, n_live_tup, last_analyze FROM pg_stat_user_tables WHERE relname = 'events';
```

## Intermediate

### A report double-counts revenue after you join orders with order_items and payments. Why?
Joining two **one-to-many** relations from the same parent multiplies rows: 3 items × 2 payments = 6 rows per order, so `SUM` inflates. Aggregate each child table in its own subquery or CTE first, then join the aggregates.
```sql
WITH i AS (SELECT order_id, SUM(qty * price) AS items_total FROM order_items GROUP BY order_id),
     p AS (SELECT order_id, SUM(amount) AS paid FROM payments GROUP BY order_id)
SELECT o.id, i.items_total, p.paid FROM orders o
LEFT JOIN i ON i.order_id = o.id LEFT JOIN p ON p.order_id = o.id;
```

### Users sometimes see deadlock errors when two transfers run at the same time. How do you fix it?
Two transactions lock the same rows in **opposite order** (A→B and B→A). Always lock in a consistent order (for example by ascending account id with `SELECT … FOR UPDATE`), keep transactions short, add the right indexes so updates don't lock extra rows, and retry on deadlock errors with backoff.

```sql
CREATE OR REPLACE FUNCTION transfer(a INT, b INT, amt NUMERIC) RETURNS void AS $$
BEGIN
  PERFORM 1 FROM accounts WHERE id IN (a, b) ORDER BY id FOR UPDATE;   -- consistent lock order
  UPDATE accounts SET balance = balance - amt WHERE id = a;
  UPDATE accounts SET balance = balance + amt WHERE id = b;
END $$ LANGUAGE plpgsql;
```

## Advanced

### Your primary database is at 90% CPU, mostly from read traffic. What options do you have?
- Fix the top queries first (`pg_stat_statements`).
- Add **read replicas** and route reads there, accepting replication lag; read your own writes from the primary.
- Cache hot data (Redis) with a clear invalidation plan.
- Use materialised views for heavy reports.
- Add connection pooling.
- Only then consider vertical scaling, partitioning, or sharding by tenant.

```sql
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;   -- top offenders first
```
```js Route reads to a replica, writes (and read-your-writes) to primary
const db = { write: primaryPool, read: replicaPool };
const products = await db.read.query('SELECT * FROM products WHERE category = $1', [cat]);
```

# Tricky Questions

## Beginner

### What does `SELECT * FROM users WHERE manager_id = NULL` return?
**No rows, ever.** Comparing with NULL yields UNKNOWN, not TRUE. Use `IS NULL`. Likewise, `WHERE status <> 'active'` silently excludes rows where `status` is NULL.

```sql
SELECT * FROM users WHERE manager_id = NULL;   -- 0 rows (NULL = NULL is UNKNOWN)
SELECT * FROM users WHERE manager_id IS NULL;  -- ✅
SELECT * FROM users WHERE status <> 'active' OR status IS NULL;  -- include NULLs explicitly
```

### `SELECT COUNT(*), COUNT(email), COUNT(DISTINCT email) FROM users` returns 100, 80, 75. Why are they different?
`COUNT(*)` counts rows. `COUNT(col)` skips NULLs, so 20 users have no email. `COUNT(DISTINCT col)` also removes duplicates, so 5 addresses appear more than once.

```sql
SELECT COUNT(*)              AS rows_total,     -- 100
       COUNT(email)          AS with_email,     -- 80  (NULLs skipped)
       COUNT(DISTINCT email) AS unique_emails,  -- 75  (duplicates removed)
       COUNT(*) FILTER (WHERE email IS NULL) AS missing_email  -- 20
FROM users;
```

## Intermediate

### Why does this return no rows when `blocked` has a NULL in it? `SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM blocked)`
`x NOT IN (1, 2, NULL)` means `x <> 1 AND x <> 2 AND x <> NULL`, and the last part is UNKNOWN, so the whole condition is never TRUE. Use `NOT EXISTS` (NULL-safe) or filter the NULLs out of the subquery.

```sql
SELECT * FROM users u WHERE NOT EXISTS (SELECT 1 FROM blocked b WHERE b.user_id = u.id); -- ✅
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM blocked WHERE user_id IS NOT NULL); -- ✅
```

### A LEFT JOIN acts like an INNER JOIN. What's wrong? `SELECT … FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = 'paid'`
The `WHERE` filter on the right table discards the NULL-extended rows. Move the condition into the join: `LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'`.

```sql
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid';   -- keeps customers with no paid orders
```

## Advanced

### Your index on `(last_name, first_name)` isn't used by `WHERE first_name = 'Ana'`. Why?
B-tree composite indexes follow the **leftmost prefix** rule. They help with `last_name`, or `last_name + first_name`, but not with `first_name` alone (except via a skip scan in some engines). Add an index on `first_name`, or reorder the columns based on your query patterns.

```sql
CREATE INDEX idx_name ON people (last_name, first_name);
SELECT * FROM people WHERE last_name = 'Silva';                       -- ✅ uses it
SELECT * FROM people WHERE last_name = 'Silva' AND first_name = 'Ana';-- ✅
SELECT * FROM people WHERE first_name = 'Ana';                        -- ❌ seq scan
CREATE INDEX idx_first ON people (first_name);                        -- add one if this query matters
```
