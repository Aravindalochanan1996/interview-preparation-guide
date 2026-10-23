---
id: mongodb
title: MongoDB
short: MongoDB
category: Databases & Messaging
order: 13.72
color: #00684a
icon: Mg
summary: Document database essentials: CRUD, query operators, schema design (embed vs reference), indexes, aggregation pipeline, transactions, replica sets, sharding, Mongoose and performance.
---

# Beginner

## Documents, Collections and the Shell

**MongoDB** stores **BSON documents** (binary JSON) in **collections** inside databases. Documents in a collection can have different shapes, and the schema is enforced by your application (or by optional JSON Schema validation).

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
mongosh "mongodb://localhost:27017/shop"
```
```js mongosh
show dbs
use shop
db.products.insertOne({ sku: "A1", name: "Blue Runner", price: 89.9, tags: ["shoes", "running"], stock: { qty: 12, warehouse: "BER" } })
db.products.findOne({ sku: "A1" })
show collections
```

| SQL | MongoDB |
|---|---|
| database | database |
| table | collection |
| row | document |
| column | field |
| JOIN | embedding or `$lookup` |
| primary key | `_id` (ObjectId by default) |

## CRUD Operations

```js
db.products.insertMany([
  { sku: "B2", name: "Trail Pro", price: 129, tags: ["shoes", "trail"], stock: { qty: 0 } },
  { sku: "C3", name: "Socks", price: 9.5, tags: ["accessories"] },
]);

db.products.find({ price: { $lt: 100 } }, { name: 1, price: 1, _id: 0 }).sort({ price: -1 }).limit(10);

db.products.updateOne({ sku: "A1" }, { $set: { price: 79.9 }, $inc: { "stock.qty": -1 }, $push: { tags: "sale" } });
db.products.updateMany({ "stock.qty": 0 }, { $set: { available: false } });
db.products.updateOne({ sku: "D4" }, { $setOnInsert: { createdAt: new Date() }, $set: { price: 20 } }, { upsert: true });

db.products.deleteOne({ sku: "C3" });
db.products.countDocuments({ tags: "shoes" });
```

## Query Operators

```js
db.orders.find({
  status: { $in: ["paid", "shipped"] },               // IN
  total: { $gte: 50, $lte: 500 },                     // range
  "customer.country": "DE",                           // dot notation into embedded docs
  items: { $elemMatch: { sku: "A1", qty: { $gte: 2 } } },   // one array element matching both conditions
  coupon: { $exists: false },
  $or: [{ priority: "high" }, { total: { $gt: 1000 } }],
});
db.users.find({ email: { $regex: /@acme\.com$/i } });
db.products.find({ tags: { $all: ["shoes", "running"] } });
db.products.find({ $text: { $search: "blue runner" } }, { score: { $meta: "textScore" } }); // needs a text index
```

## Using MongoDB from Node.js

```js
import { MongoClient, ObjectId } from 'mongodb';
const client = new MongoClient(process.env.MONGO_URL, { maxPoolSize: 20 });
await client.connect();                                // reuse one client for the whole app
const db = client.db('shop');

const { insertedId } = await db.collection('orders').insertOne({ customerId: new ObjectId(cid), items, total, createdAt: new Date() });
const order = await db.collection('orders').findOne({ _id: insertedId });
const recent = await db.collection('orders').find({ customerId: new ObjectId(cid) }).sort({ createdAt: -1 }).limit(20).toArray();
```
```python Python (PyMongo)
from pymongo import MongoClient
db = MongoClient(os.environ["MONGO_URL"]).shop
db.orders.insert_one({"customer_id": cid, "total": 40, "items": [{"sku": "A1", "qty": 2}]})
for o in db.orders.find({"total": {"$gt": 30}}).sort("created_at", -1).limit(5):
    print(o["_id"], o["total"])
```

# Intermediate

## Schema Design: Embed vs Reference

Design around **access patterns**: data that's read together should be stored together.

| Embed when | Reference when |
|---|---|
| one-to-few, owned data (address, order items) | one-to-many-unbounded (comments, events, logs) |
| always read with the parent | read independently or shared across parents |
| changes together, atomically | updated often by itself, or would exceed 16 MB |

```js Embedded: an order owns its line items (one read, atomic update)
{ _id: ObjectId("…"), customerId: ObjectId("…"), status: "paid",
  items: [{ sku: "A1", name: "Blue Runner", qty: 2, price: 79.9 }],      // snapshot of price at purchase
  shipping: { street: "Main 1", city: "Berlin" } }
```
```js Referenced: unbounded comments live in their own collection
{ _id: ObjectId("p1"), title: "Release notes", commentCount: 3120 }                 // posts
{ _id: ObjectId("…"), postId: ObjectId("p1"), author: "ada", text: "…", at: ISODate() } // comments
```
```js Common patterns
// Extended reference: copy the few fields you display (name) plus the id
{ customer: { _id: ObjectId("…"), name: "Ada" } }
// Bucket pattern: group time series into one document per sensor-hour
{ sensorId: 42, hour: ISODate("2026-10-23T10:00Z"), readings: [{ m: 0, t: 21.5 }, { m: 1, t: 21.6 }], count: 2 }
// Computed pattern: keep counters up to date instead of counting on every read
db.posts.updateOne({ _id }, { $inc: { commentCount: 1 } })
```

## Indexes

```js
db.orders.createIndex({ customerId: 1, createdAt: -1 });                    // compound: equality, then sort
db.users.createIndex({ email: 1 }, { unique: true });
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });    // TTL: auto-delete old docs
db.orders.createIndex({ status: 1 }, { partialFilterExpression: { status: "pending" } });
db.products.createIndex({ tags: 1 });                                       // multikey: indexes each array element
db.products.createIndex({ name: "text", description: "text" });
db.places.createIndex({ location: "2dsphere" });

db.orders.find({ customerId: cid }).sort({ createdAt: -1 }).explain("executionStats");
// look for: stage IXSCAN (good) vs COLLSCAN; totalDocsExamined ≈ nReturned
```

> [!TIP]
> Compound index order follows the **ESR rule**: fields used for **E**quality first, then **S**ort, then **R**ange.

## The Aggregation Pipeline

```js Revenue per category for paid orders last 30 days
db.orders.aggregate([
  { $match: { status: "paid", createdAt: { $gte: new Date(Date.now() - 30 * 864e5) } } },  // filter early (uses indexes)
  { $unwind: "$items" },
  { $lookup: { from: "products", localField: "items.sku", foreignField: "sku", as: "product" } },
  { $unwind: "$product" },
  { $group: { _id: "$product.category", revenue: { $sum: { $multiply: ["$items.qty", "$items.price"] } }, orders: { $addToSet: "$_id" } } },
  { $project: { _id: 0, category: "$_id", revenue: { $round: ["$revenue", 2] }, orderCount: { $size: "$orders" } } },
  { $sort: { revenue: -1 } },
  { $limit: 10 },
]);
```
```js Other useful stages
{ $facet: { byStatus: [{ $sortByCount: "$status" }], totals: [{ $group: { _id: null, sum: { $sum: "$total" } } }] } }
{ $bucket: { groupBy: "$total", boundaries: [0, 50, 100, 500], default: "500+" } }
{ $setWindowFields: { partitionBy: "$customerId", sortBy: { createdAt: 1 }, output: { running: { $sum: "$total", window: { documents: ["unbounded", "current"] } } } } }
{ $merge: { into: "daily_revenue", on: "_id", whenMatched: "replace" } }   // materialise results
```

## Mongoose ODM

```js
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGO_URL);

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  items: [{ sku: { type: String, required: true }, qty: { type: Number, min: 1 }, price: Number }],
  status: { type: String, enum: ['pending', 'paid', 'shipped'], default: 'pending' },
}, { timestamps: true });

orderSchema.virtual('total').get(function () { return this.items.reduce((s, i) => s + i.qty * i.price, 0); });
orderSchema.pre('save', function (next) { if (!this.items.length) return next(new Error('empty order')); next(); });

const Order = mongoose.model('Order', orderSchema);
const orders = await Order.find({ status: 'paid' }).populate('customer', 'name email').lean();  // lean(): plain objects, faster
```

# Advanced

## Transactions and Atomicity

A single-document write is **always atomic**, including nested arrays. That's why embedding often removes the need for transactions. Multi-document ACID transactions exist on replica sets and sharded clusters, but they cost more, so use them sparingly.

```js
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    const r = await db.collection('inventory').updateOne(
      { sku: 'A1', qty: { $gte: 2 } }, { $inc: { qty: -2 } }, { session });
    if (r.modifiedCount === 0) throw new Error('out of stock');            // aborts the transaction
    await db.collection('orders').insertOne({ sku: 'A1', qty: 2, status: 'paid' }, { session });
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
} finally {
  await session.endSession();
}
```
```js Atomic single-document alternative: conditional update
db.inventory.findOneAndUpdate({ sku: "A1", qty: { $gte: 2 } }, { $inc: { qty: -2 } }, { returnDocument: "after" })
```

## Replica Sets, Read/Write Concerns and Change Streams

A **replica set** has one primary (which takes writes) and secondaries that replicate the oplog. If the primary fails, a new one is elected automatically.

```js
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "m1:27017" }, { _id: 1, host: "m2:27017" }, { _id: 2, host: "m3:27017" }] })
rs.status()
```
```js Durability and consistency knobs
db.orders.insertOne(doc, { writeConcern: { w: "majority", wtimeout: 5000 } });   // survives a primary failover
db.orders.find().readPref("secondaryPreferred");                               // offload reads (may be stale)
db.orders.find().readConcern("majority");                                      // only majority-committed data
```
```js Change streams: react to changes (CDC, cache invalidation, notifications)
const stream = db.collection('orders').watch([{ $match: { operationType: 'insert', 'fullDocument.total': { $gt: 1000 } } }]);
for await (const change of stream) {
  notifySales(change.fullDocument);
  saveResumeToken(change._id);                 // resume after a restart: watch([], { resumeAfter: token })
}
```

## Sharding

**Sharding** splits a collection across shards by a **shard key**. `mongos` routers send each query to the right shards. The shard key is the most important (and hardest to change) decision you'll make.

```js
sh.enableSharding("shop")
sh.shardCollection("shop.orders", { customerId: "hashed" })                 // even write distribution
sh.shardCollection("shop.events", { tenantId: 1, createdAt: 1 })            // ranged: targeted tenant queries
sh.status()
```
| Good shard key | Bad shard key |
|---|---|
| high cardinality, even distribution | low cardinality (`status`, `country`) |
| present in most queries (targeted) | rarely queried → scatter-gather on every query |
| not monotonically increasing (or hashed) | `createdAt` / ObjectId ranged → every insert hits one "hot" shard |

## Performance and Operations

```js
db.setProfilingLevel(1, { slowms: 100 });                              // log slow operations
db.system.profile.find().sort({ ts: -1 }).limit(5);
db.orders.aggregate([{ $indexStats: {} }]);                             // unused indexes cost writes and RAM
db.serverStatus().wiredTiger.cache["bytes currently in the cache"];
db.runCommand({ collMod: "orders", validator: { $jsonSchema: {
  bsonType: "object", required: ["customerId", "items"],
  properties: { total: { bsonType: "decimal", minimum: 0 } } } }, validationLevel: "moderate" });
```
```bash
mongodump --uri "$MONGO_URL" --gzip --archive=shop.gz
mongorestore --uri "$MONGO_URL" --gzip --archive=shop.gz
```

# Interview Questions

## Beginner

### What is MongoDB and when would you choose it?

A document database that stores flexible BSON documents, scales horizontally with sharding, and provides high availability with replica sets. Choose it when your data is naturally hierarchical or polymorphic (catalogs, content, user profiles, events), when the schema evolves quickly, and when access patterns are document-centric. Prefer a relational database for heavily relational data with complex joins and transactions.

```js
db.products.insertOne({ sku: "TV1", type: "tv", specs: { inches: 55, hdr: true } });
db.products.insertOne({ sku: "BK1", type: "book", specs: { isbn: "978-…", pages: 320 } });   // different shape, same collection
```

### What is `_id` and an ObjectId?

Every document needs a unique `_id` (indexed automatically). The default ObjectId is 12 bytes: a timestamp, a random value and a counter. It's roughly time-ordered and generated client-side.

```js
const id = new ObjectId(); id.getTimestamp();      // creation time
db.users.insertOne({ _id: "user-42", name: "Ada" }) // any unique value works
```

### What's the difference between `find` and `findOne`?

`find` returns a cursor over all matching documents (iterate it, or use `.toArray()`). `findOne` returns the first match or `null`.

```js
const cursor = db.orders.find({ status: "paid" }).batchSize(500);
for await (const o of cursor) process(o);
```

### How do update operators work?

Updates use operators instead of replacing the whole document: `$set`, `$unset`, `$inc`, `$push`, `$addToSet`, `$pull`, and the positional `$` / `$[]` for array elements.

```js
db.carts.updateOne({ _id: cid, "items.sku": "A1" }, { $inc: { "items.$.qty": 1 } });   // the matched array element
db.carts.updateOne({ _id: cid }, { $pull: { items: { sku: "C3" } } });
```

## Intermediate

### Embedding vs referencing: how do you decide?

Embed data that's owned, bounded and read together with the parent (order items, address). Reference data that's unbounded, shared or accessed independently (comments, users referenced by many orders). Also consider the 16 MB document limit and update frequency.

```js
// embed:     { _id, name, addresses: [{ type: "home", city: "Pune" }] }
// reference: { _id, postId, text }  in "comments", queried by postId
```

### What is the aggregation pipeline?

A sequence of stages (`$match`, `$group`, `$project`, `$lookup`, `$unwind`, `$sort`, `$facet`…) that transform documents step by step, like SQL's WHERE, GROUP BY and JOIN. Put `$match` and `$sort` early so they can use indexes.

```js
db.orders.aggregate([{ $match: { status: "paid" } }, { $group: { _id: "$customerId", spent: { $sum: "$total" } } }, { $sort: { spent: -1 } }, { $limit: 5 }]);
```

### What is the ESR rule for compound indexes?

Order compound index fields as Equality, then Sort, then Range. That lets one index filter, return results in order (no in-memory sort) and bound the range scan.

```js
// query: { status: "paid", total: { $gt: 100 } } sort { createdAt: -1 }
db.orders.createIndex({ status: 1, createdAt: -1, total: 1 });
```

### How do you join data in MongoDB?

Prefer embedding or extended references. When you must join, use `$lookup` in aggregation (a left outer join), or do two queries in the application. In Mongoose, `populate` is application-side and costs extra queries.

```js
db.orders.aggregate([{ $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } }, { $unwind: "$customer" }]);
```

### What are TTL and partial indexes?

A TTL index deletes documents automatically after a time period (sessions, OTPs, logs). A partial index indexes only documents matching a filter, so it's smaller and faster.

```js
db.otps.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
db.users.createIndex({ email: 1 }, { unique: true, partialFilterExpression: { deletedAt: { $exists: false } } });
```

## Advanced

### Does MongoDB support ACID transactions?

Single-document operations are always atomic. Since 4.0 (replica sets) and 4.2 (sharded clusters), multi-document ACID transactions are available through sessions. They add latency and lock overhead and have a 60-second default lifetime. Model data so that most writes touch one document.

```js
await session.withTransaction(async () => { /* several writes with { session } */ });
```

### Explain write concern and read concern.

Write concern sets how many replicas must acknowledge a write (`w:1`, `w:"majority"`), plus journaling. Read concern sets what data a read can see (`local`, `majority`, `snapshot`, `linearizable`). `majority` for both gives you causal, durable reads that survive failover.

```js
db.payments.insertOne(p, { writeConcern: { w: "majority", j: true } });
```

### How do you choose a shard key?

Look for high cardinality, low frequency of any single value, non-monotonic or hashed values to avoid hot shards, and inclusion in your most common queries so they're targeted rather than scatter-gather. Compound keys (`tenantId + createdAt`) often balance targeting and distribution.

```js
sh.shardCollection("app.messages", { chatId: 1, _id: 1 });   // queries are per chat → targeted
```

### What are change streams used for?

They provide a resumable, ordered feed of inserts, updates and deletes (built on the oplog) for event-driven designs: invalidating caches, syncing to search or analytics, notifications and the outbox pattern. They require a replica set.

```js
const cs = db.collection("products").watch([], { fullDocument: "updateLookup" });
cs.on("change", (c) => searchIndex.upsert(c.fullDocument));
```

# Scenario Questions

## Beginner

### A query is slow and `explain()` shows COLLSCAN. What do you do?

Create an index that matches the filter and sort (following ESR), then re-check `explain("executionStats")` for IXSCAN and `totalDocsExamined ≈ nReturned`. Add a projection so the query can be covered by the index.

```js
db.orders.createIndex({ customerId: 1, createdAt: -1 });
db.orders.find({ customerId: cid }, { _id: 0, total: 1, createdAt: 1 }).sort({ createdAt: -1 }).explain("executionStats");
```

## Intermediate

### A blog post document with embedded comments hits the 16 MB limit. How do you redesign?

Unbounded arrays don't belong inside the parent. Move comments to their own collection with an index on `{postId, createdAt}`, keep a `commentCount` and maybe the latest 3 comments embedded for fast rendering (the subset pattern).

```js
db.comments.createIndex({ postId: 1, createdAt: -1 });
db.posts.updateOne({ _id: pid }, { $inc: { commentCount: 1 }, $push: { latest: { $each: [c], $slice: -3 } } });
```

### Two users buy the last item at the same time. How do you prevent overselling?

Use one atomic conditional update on the inventory document. Only the request that matches `qty >= 1` succeeds. Use a transaction only if the order document and the inventory must be written together.

```js
const res = await inventory.updateOne({ sku, qty: { $gte: 1 } }, { $inc: { qty: -1 } });
if (res.modifiedCount === 0) throw new OutOfStock();
```

## Advanced

### After sharding on `createdAt`, all writes go to one shard. Why, and how do you fix it?

A monotonically increasing ranged key sends every new document to the chunk with the highest range, which is a hot shard. Use a hashed key or a compound key with a high-cardinality prefix (`{ tenantId: 1, createdAt: 1 }`). Resharding is possible from 5.0 onward with `reshardCollection`.

```js
db.adminCommand({ reshardCollection: "shop.events", key: { tenantId: 1, createdAt: 1 } });
```

# Tricky Questions

## Beginner

### Does `db.products.find({ tags: "shoes" })` match a document with `tags: ["shoes", "sale"]`?

Yes. A query on an array field matches if **any element** equals the value. To match the exact array, compare the whole array: `{ tags: ["shoes", "sale"] }` (order matters).

```js
db.products.find({ tags: "shoes" });            // any element
db.products.find({ tags: ["shoes", "sale"] });  // exact array
```

## Intermediate

### Why does `find({ "items.sku": "A1", "items.qty": { $gte: 5 } })` return orders where A1 has qty 1?

Each condition can be satisfied by a **different** array element. Use `$elemMatch` to require one element that meets both.

```js
db.orders.find({ items: { $elemMatch: { sku: "A1", qty: { $gte: 5 } } } });
```

## Advanced

### Is MongoDB "schemaless", so you don't need to design a schema?

No. It's schema-flexible, which makes design *more* important. The schema lives in your access patterns, indexes and application code. Use JSON Schema validators, Mongoose schemas and migrations to keep data consistent.

```js
db.createCollection("users", { validator: { $jsonSchema: { required: ["email"], properties: { email: { bsonType: "string", pattern: "@" } } } } });
```
