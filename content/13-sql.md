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

### Explain the types of joins.
INNER returns matching rows from both tables. LEFT returns all left rows plus matches (NULLs where none). RIGHT is the mirror. FULL OUTER returns all rows from both. CROSS returns the Cartesian product. A SELF JOIN joins a table to itself (e.g., employee-manager).

### What is a primary key vs a foreign key?
A primary key uniquely identifies each row and cannot be NULL. A foreign key is a column referencing another table's primary (or unique) key, enforcing referential integrity between related tables.

### DELETE vs TRUNCATE vs DROP?
`DELETE` removes rows matching a condition, is logged per row, fires triggers and can be rolled back. `TRUNCATE` quickly removes all rows (minimal logging, resets identity, DDL in some engines). `DROP` removes the entire table structure and data.

### What is normalization?
Organising tables to minimise redundancy and anomalies by applying normal forms: 1NF (atomic values), 2NF (no partial dependencies), 3NF (no transitive dependencies). It improves integrity at the cost of more joins.

### What is the difference between UNION and UNION ALL?
`UNION` combines result sets and removes duplicates (requiring a sort/hash). `UNION ALL` keeps all rows and is faster. Use `UNION ALL` unless you need deduplication.

### How do you handle NULLs in SQL?
Use `IS NULL`/`IS NOT NULL` for comparison, `COALESCE` to supply defaults, and remember aggregates skip NULLs and `NOT IN` with NULLs yields no rows — use `NOT EXISTS`.

## Intermediate

### What is an index and how does it work?
A data structure (typically a B-tree) storing sorted column values with pointers to rows, letting the database find rows in logarithmic time instead of scanning the table. It speeds up reads, joins and sorting, but costs storage and slows inserts/updates/deletes.

### How do composite indexes work?
They index multiple columns in a defined order and can be used for queries filtering on a leftmost prefix of those columns. `(customer_id, created_at)` serves `WHERE customer_id = ?` and `… AND created_at > ?`, and `ORDER BY created_at` within a customer, but not `WHERE created_at > ?` alone.

### What are window functions? Give an example.
Functions that compute values over a set of rows related to the current row without collapsing them: `ROW_NUMBER()`, `RANK()`, `LAG()`, running `SUM() OVER (PARTITION BY … ORDER BY …)`. Example: top N per group, running totals, period-over-period comparisons.

### Find the second-highest salary.
`SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);` or with `DENSE_RANK() OVER (ORDER BY salary DESC) = 2` (handles ties and generalises to N). `OFFSET 1 LIMIT 1` on distinct salaries also works.

### What are ACID properties?
Atomicity (all-or-nothing), Consistency (constraints are preserved), Isolation (concurrent transactions don't see each other's partial work, per isolation level), Durability (committed data persists, via the write-ahead log).

### What is a CTE and when do you use a recursive CTE?
A Common Table Expression (`WITH name AS (...)`) defines a named temporary result for one statement, improving readability and reuse. Recursive CTEs traverse hierarchical data — org charts, category trees, graph paths — by unioning an anchor query with a recursive part.

### RANK vs DENSE_RANK vs ROW_NUMBER?
`ROW_NUMBER` assigns unique sequential numbers (ties broken arbitrarily). `RANK` gives ties the same rank and skips subsequent numbers (1,1,3). `DENSE_RANK` gives ties the same rank without gaps (1,1,2).

### SQL vs NoSQL — how do you choose?
Choose SQL for structured data with relationships, transactions, complex queries and strong consistency (most business systems). Choose NoSQL when access patterns are simple and known, you need flexible schemas, massive horizontal scale or specialised models (graph, wide-column, key-value). Many systems use both.

## Advanced

### Explain transaction isolation levels and the anomalies they prevent.
Read Uncommitted allows dirty reads. Read Committed prevents dirty reads but allows non-repeatable reads and phantoms. Repeatable Read prevents non-repeatable reads (and phantoms in Postgres through snapshots). Serializable prevents all anomalies including write skew, at the cost of more aborts/locking.

### How would you optimise a slow query?
Run `EXPLAIN ANALYZE` to see the plan. Look for sequential scans, bad row estimates, expensive sorts or nested loops on large sets. Add or adjust indexes (composite/covering/partial), make predicates sargable, select fewer columns, rewrite subqueries, use keyset pagination, update statistics, and consider caching, materialized views or partitioning.

### What is MVCC?
Multi-Version Concurrency Control keeps multiple versions of rows so readers see a consistent snapshot without blocking writers and writers don't block readers. Each transaction sees versions committed before its snapshot. Old versions are garbage-collected (VACUUM in Postgres, undo logs in InnoDB).

### Optimistic vs pessimistic locking?
Pessimistic locking acquires locks before modifying (`SELECT … FOR UPDATE`), preventing conflicts but reducing concurrency — good for high contention. Optimistic locking lets transactions proceed and detects conflicts at write time via a version/timestamp check, retrying on conflict — good for low contention and long user think-times.

### How do you design database sharding?
Pick a shard key with high cardinality and even distribution that matches access patterns (e.g., tenant_id or user_id). Route via hashing (consistent hashing to ease rebalancing) or a lookup directory. Avoid cross-shard joins/transactions by co-locating related data, plan for resharding, hot-key mitigation and global unique IDs (Snowflake/UUIDv7).

### What is a deadlock and how do you prevent it?
Two or more transactions each hold a lock the other needs, so none can proceed. Databases detect cycles and abort a victim. Prevent by acquiring locks in a consistent order, keeping transactions short, using appropriate indexes (fewer locked rows), lower isolation where safe, and retrying aborted transactions.

### How do you handle cache consistency with a database?
Use cache-aside with delete-on-write (invalidate after the DB commit), short TTLs as a safety net, versioned keys, and CDC/events (Debezium) to invalidate across services. Guard against stampedes with locks or request coalescing, and accept bounded staleness where the business allows it.

### What is the difference between clustered and non-clustered indexes?
A clustered index determines the physical order of rows in the table, so there's only one (InnoDB's primary key). A non-clustered (secondary) index is a separate structure storing key values and a pointer (row id or primary key) to the row, requiring an extra lookup unless it's covering.
