---
id: kafka
title: Apache Kafka
short: Kafka
category: Databases & Messaging
order: 13.74
color: #231f20
icon: Kf
summary: Distributed event streaming: topics, partitions, offsets, producers and consumers, consumer groups, delivery semantics, idempotence and transactions, replication, schemas, Kafka Connect, Streams and operations.
---

# Beginner

## What Kafka Is: Topics, Partitions and Offsets

**Apache Kafka** is a distributed, durable **commit log**. Producers append **records** (key, value, headers, timestamp) to **topics**. Each topic is split into **partitions**: ordered, append-only logs stored on brokers. Each record gets an increasing **offset** within its partition. Consumers *read* records without deleting them, and records are kept according to the topic's **retention** policy.

```text
topic "orders" (3 partitions)
 P0: [0][1][2][3][4] ...
 P1: [0][1][2] ...            key "customer-7" → always the same partition → ordered per key
 P2: [0][1][2][3] ...
consumer group "billing": C1 ← P0,P1   C2 ← P2    (each partition read by one consumer in the group)
```

| Kafka | Traditional queue (RabbitMQ/SQS) |
|---|---|
| log, retained after reading, replayable | message removed after acknowledgement |
| many independent consumer groups | competing consumers on one queue |
| ordering per partition | ordering varies (FIFO queues) |
| very high throughput, streaming | flexible routing, per-message acks |

## Running Kafka and the CLI

```bash KRaft mode (no ZooKeeper)
docker run -d --name kafka -p 9092:9092 apache/kafka:3.8.0
docker exec -it kafka bash
cd /opt/kafka/bin
./kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 6 --replication-factor 1
./kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders
./kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --property parse.key=true --property key.separator=:
# > customer-7:{"orderId":901,"total":120}
./kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --group demo --property print.key=true
./kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group demo   # offsets and LAG
```

## Producing Messages

```js Node (KafkaJS)
import { Kafka } from 'kafkajs';
const kafka = new Kafka({ clientId: 'shop-api', brokers: ['localhost:9092'] });
const producer = kafka.producer({ idempotent: true });
await producer.connect();
await producer.send({
  topic: 'orders',
  messages: [{ key: `customer-${order.customerId}`, value: JSON.stringify(order), headers: { 'event-type': 'OrderPlaced' } }],
});
```
```python Python (confluent-kafka)
from confluent_kafka import Producer
p = Producer({"bootstrap.servers": "localhost:9092", "enable.idempotence": True, "acks": "all", "linger.ms": 5})
def delivered(err, msg):
    if err: log.error("delivery failed: %s", err)
    else: log.info("→ %s[%d]@%d", msg.topic(), msg.partition(), msg.offset())
p.produce("orders", key="customer-7", value=json.dumps(order), on_delivery=delivered)
p.flush()
```

## Consuming Messages and Consumer Groups

Consumers in the **same group** share the partitions (that's how you scale processing). **Different groups** each get every record (that's how several services fan out).

```js
const consumer = kafka.consumer({ groupId: 'billing' });
await consumer.connect();
await consumer.subscribe({ topic: 'orders', fromBeginning: false });
await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const order = JSON.parse(message.value.toString());
    await chargeCustomer(order);          // offsets are committed after this resolves
  },
});
```
```python
from confluent_kafka import Consumer
c = Consumer({"bootstrap.servers": "localhost:9092", "group.id": "billing", "auto.offset.reset": "earliest", "enable.auto.commit": False})
c.subscribe(["orders"])
while True:
    msg = c.poll(1.0)
    if msg is None or msg.error(): continue
    handle(json.loads(msg.value()))
    c.commit(message=msg, asynchronous=False)   # commit after processing → at-least-once
```

> [!NOTE]
> The parallelism of a consumer group is capped by the **partition count**. 6 partitions means at most 6 active consumers in a group. Extra consumers sit idle.

# Intermediate

## Delivery Semantics, acks and Idempotent Producers

| Setting | Meaning |
|---|---|
| `acks=0` | fire and forget, may lose data |
| `acks=1` | leader wrote it; lost if the leader dies before followers copy it |
| `acks=all` + `min.insync.replicas=2` | durable: at least 2 in-sync replicas have it |
| `enable.idempotence=true` | producer retries can't create duplicates or reorder within a partition |

- **At-most-once**: commit the offset *before* processing. Messages can be lost.
- **At-least-once**: commit *after* processing. Messages can be duplicated, so make consumers idempotent. This is the most common choice.
- **Exactly-once**: idempotent producer + transactions (read-process-write within Kafka), or an idempotent sink.

```python Idempotent consumer: dedupe by event id in the same DB transaction
def handle(event):
    with db.transaction():
        if db.execute("INSERT INTO processed(event_id) VALUES (%s) ON CONFLICT DO NOTHING", (event["id"],)).rowcount == 0:
            return                                   # duplicate delivery
        db.execute("UPDATE wallets SET balance = balance + %s WHERE id = %s", (event["amount"], event["wallet"]))
```

## Partitioning, Keys and Ordering

The default partitioner hashes the **key** (`murmur2(key) % partitions`). Records with the same key go to the same partition, so they stay **ordered**. Records without a key are spread across partitions ("sticky" batching).

```js
await producer.send({ topic: 'account-events', messages: [
  { key: 'acct-42', value: JSON.stringify({ type: 'Deposited', amount: 100 }) },
  { key: 'acct-42', value: JSON.stringify({ type: 'Withdrawn', amount: 30 }) },   // stays after the deposit
]});
```
- Choose keys by the entity whose events must stay ordered (account, order, user).
- **Hot keys** create hot partitions. If a single huge tenant dominates, add a sub-key or spread it out.
- **Increasing partitions** changes `hash % N`, so later records for an existing key may land on a different partition. Plan partition counts up front.

## Retention, Compaction and Replication

```bash
./kafka-configs.sh --bootstrap-server localhost:9092 --alter --entity-type topics --entity-name orders \
  --add-config retention.ms=604800000,min.insync.replicas=2          # 7 days
./kafka-topics.sh --bootstrap-server localhost:9092 --create --topic customer-profile \
  --config cleanup.policy=compact --partitions 6 --replication-factor 3  # keep the latest value per key
```
- **Delete policy**: drop segments older than `retention.ms` or beyond `retention.bytes`.
- **Compact policy**: keep at least the last record per key, which acts like a changelog or table. A record with a `null` value is a **tombstone** that deletes the key.
- **Replication**: each partition has a leader plus followers. The **ISR** (in-sync replicas) are the followers that are caught up. Only ISR members can become leader when `unclean.leader.election.enable=false`.

## Schemas and Serialisation

Use a **schema registry** (Avro, Protobuf or JSON Schema) so producers and consumers agree on the format, with compatibility rules (BACKWARD, FORWARD, FULL) enforced on every change.

```json order-placed.avsc
{ "type": "record", "name": "OrderPlaced", "namespace": "shop",
  "fields": [
    { "name": "orderId", "type": "long" },
    { "name": "total", "type": { "type": "bytes", "logicalType": "decimal", "precision": 12, "scale": 2 } },
    { "name": "coupon", "type": ["null", "string"], "default": null }
  ] }
```
```python
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
sr = SchemaRegistryClient({"url": "http://schema-registry:8081"})
serialize = AvroSerializer(sr, open("order-placed.avsc").read())
# adding an optional field with a default = backward-compatible; renaming or removing a required field = breaking
```

# Advanced

## Transactions and Exactly-Once Processing

```java Read → process → write atomically (consume-transform-produce)
producer.initTransactions();
while (true) {
  ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
  producer.beginTransaction();
  try {
    for (var r : records) producer.send(new ProducerRecord<>("orders-enriched", r.key(), enrich(r.value())));
    producer.sendOffsetsToTransaction(offsetsOf(records), consumer.groupMetadata());   // offsets in the same transaction
    producer.commitTransaction();
  } catch (KafkaException e) {
    producer.abortTransaction();                                                        // nothing visible, retry
  }
}
// producer: transactional.id=enricher-1, enable.idempotence=true · consumer: isolation.level=read_committed
```

## Kafka Connect and the Outbox Pattern

**Kafka Connect** moves data between Kafka and external systems through config-driven source and sink connectors. **Debezium** streams database changes (CDC) into Kafka.

```json Debezium Postgres source (outbox table → topics)
{
  "name": "orders-outbox",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "pg", "database.dbname": "shop", "database.user": "debezium",
    "table.include.list": "public.outbox",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.by.field": "aggregate_type"
  }
}
```
```sql Service writes business data and the event in ONE local transaction
BEGIN;
INSERT INTO orders (id, status) VALUES (901, 'PLACED');
INSERT INTO outbox (id, aggregate_type, aggregate_id, type, payload) VALUES (gen_random_uuid(), 'order', '901', 'OrderPlaced', '{"orderId":901}');
COMMIT;   -- Debezium publishes the outbox row → no lost or phantom events
```

## Kafka Streams and Stream Processing

```java Count orders per customer in 5-minute windows
StreamsBuilder b = new StreamsBuilder();
b.stream("orders", Consumed.with(Serdes.String(), orderSerde))
 .filter((k, o) -> o.status().equals("PAID"))
 .groupByKey()
 .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))
 .count(Materialized.as("orders-per-customer-5m"))          // state store, backed by a compacted changelog topic
 .toStream()
 .to("orders-per-customer", Produced.with(WindowedSerdes.timeWindowedSerdeFrom(String.class, 300_000L), Serdes.Long()));
// processing.guarantee=exactly_once_v2
```
Alternatives: **ksqlDB** (SQL on streams), **Apache Flink** (large-scale stateful processing), Spark Structured Streaming.

## Operations: Lag, Rebalancing and Tuning

```bash
./kafka-consumer-groups.sh --bootstrap-server b:9092 --describe --group billing
# TOPIC  PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# orders 0          120400          135900          15500   ← consumers falling behind
./kafka-consumer-groups.sh --bootstrap-server b:9092 --group billing --reset-offsets --topic orders --to-datetime 2026-10-23T08:00:00.000 --execute   # replay (group must be stopped)
```
| Lever | Effect |
|---|---|
| more partitions + consumers | more parallelism |
| `linger.ms`, `batch.size`, `compression.type=zstd` | producer throughput |
| `max.poll.records`, `max.poll.interval.ms` | avoid rebalances when processing is slow |
| `partition.assignment.strategy=CooperativeStickyAssignor` | incremental rebalances, fewer stop-the-world pauses |
| `group.instance.id` (static membership) | restarts don't trigger rebalances |
| dead-letter topic | poison messages don't block a partition |

```js Dead-letter topic after N retries
try { await process(message); }
catch (e) {
  const attempts = Number(message.headers?.attempts ?? 0) + 1;
  await producer.send({ topic: attempts >= 3 ? 'orders.DLT' : 'orders.retry',
    messages: [{ key: message.key, value: message.value, headers: { attempts: String(attempts), error: e.message } }] });
}
```

# Interview Questions

## Beginner

### What is Kafka and what is it used for?

A distributed, partitioned, replicated commit log used for event streaming. It's used for decoupling microservices, activity tracking, log and metrics pipelines, CDC, stream processing and event sourcing, at very high throughput with durable, replayable storage.

```bash
kafka-console-producer.sh --topic clicks --bootstrap-server b:9092   # producers append
kafka-console-consumer.sh --topic clicks --group analytics --bootstrap-server b:9092
```

### What are topics, partitions and offsets?

A topic is a named stream. Partitions are the ordered logs a topic is split into for parallelism and scale. An offset is a record's position within a partition. Consumers track the offsets they've processed.

```bash
kafka-topics.sh --describe --topic orders --bootstrap-server b:9092   # partitions, leaders, replicas, ISR
```

### What is a consumer group?

A set of consumers sharing a `group.id`. Each partition is assigned to exactly one consumer in the group, so the group processes the topic in parallel. Separate groups each receive all the records independently.

```python
Consumer({"group.id": "billing", ...})     # billing service
Consumer({"group.id": "analytics", ...})   # gets the same records independently
```

### How does Kafka guarantee ordering?

Only within a partition. Records with the same key go to the same partition, so per-key ordering is preserved. There's no global ordering across partitions (unless you use one partition).

```js
producer.send({ topic: 'payments', messages: [{ key: 'order-901', value: 'AUTHORIZED' }, { key: 'order-901', value: 'CAPTURED' }] });
```

### Does Kafka delete messages after they're consumed?

No. Retention is time- or size-based (or compaction), independent of consumption. Consumers can re-read by resetting offsets.

```bash
kafka-configs.sh --alter --entity-type topics --entity-name orders --add-config retention.ms=259200000 --bootstrap-server b:9092
```

## Intermediate

### Explain at-least-once, at-most-once and exactly-once.

At-most-once commits offsets before processing (may lose data). At-least-once commits after processing (may duplicate). Exactly-once uses an idempotent producer plus transactions, so consumed offsets and produced records commit atomically, or relies on an idempotent sink that dedupes by key.

```python
handle(msg); consumer.commit(message=msg)       # at-least-once
```

### What do `acks=all` and `min.insync.replicas` do together?

`acks=all` makes the leader wait for every in-sync replica before acknowledging a write. `min.insync.replicas=2` rejects writes (`NotEnoughReplicas`) when fewer than 2 replicas are in sync. With replication factor 3, the cluster survives one broker failure without losing acknowledged data.

```properties
acks=all
enable.idempotence=true
# topic: replication.factor=3, min.insync.replicas=2
```

### What happens during a consumer group rebalance?

When consumers join or leave, or the subscription changes, the group coordinator reassigns partitions. With eager protocols every consumer stops while that happens. Cooperative sticky assignment moves only the partitions that need moving. Commit offsets on revocation to avoid duplicates, and keep processing within `max.poll.interval.ms`.

```properties
partition.assignment.strategy=org.apache.kafka.clients.consumer.CooperativeStickyAssignor
group.instance.id=billing-pod-1
```

### What is log compaction?

A cleanup policy that keeps the latest record per key (and removes keys with tombstones). It turns a topic into a durable changelog or table, used for state stores, configuration and CDC snapshots.

```bash
kafka-topics.sh --create --topic user-settings --config cleanup.policy=compact --bootstrap-server b:9092
```

### How do you choose the number of partitions?

Target throughput divided by per-partition throughput (for both producers and consumers), the maximum number of consumers you'll need in a group, and future growth, because adding partitions later changes key placement. Avoid going extremely high: each partition costs open files, memory and leader elections.

```text
need 600 MB/s, ~30 MB/s per partition per consumer → ≥ 20 partitions; choose 24–32 for headroom
```

## Advanced

### How do Kafka transactions work?

A producer with a `transactional.id` begins a transaction, writes to multiple partitions, adds consumer offsets with `sendOffsetsToTransaction`, then commits or aborts. A transaction coordinator writes commit or abort markers. Consumers using `isolation.level=read_committed` see only committed data. Fencing on `transactional.id` stops zombie producers.

```java
producer.beginTransaction(); producer.send(rec); producer.sendOffsetsToTransaction(offsets, groupMeta); producer.commitTransaction();
```

### What is the ISR and what is unclean leader election?

The ISR is the set of replicas fully caught up with the leader (within `replica.lag.time.max.ms`). If every ISR member fails, unclean leader election lets an out-of-sync replica become leader, which restores availability but loses data. Disable it for durability.

```properties
unclean.leader.election.enable=false
```

### How would you handle poison messages?

Catch processing errors, retry with backoff (in-place or through retry topics with delays), then route to a dead-letter topic with error metadata. Alert on the DLT, fix the problem, and replay. Never let one bad record block its partition forever.

```js
if (attempts >= 3) await producer.send({ topic: 'orders.DLT', messages: [{ key, value, headers: { error: e.message } }] });
```

### Kafka vs RabbitMQ: how do you choose?

Kafka is a replayable log with partitioned ordering, huge throughput, many consumer groups and stream processing. RabbitMQ is a smart broker with flexible routing (exchanges, bindings), per-message acknowledgements, priorities, delayed messages, and simpler task queues at lower scale. Choose Kafka for event streaming and data pipelines, RabbitMQ for command and task queues with complex routing.

```text
"Every service needs the order events, and analytics wants 30 days of history" → Kafka
"Send this email job to one worker, retry with priority and TTL"              → RabbitMQ / SQS
```

# Scenario Questions

## Beginner

### Consumer lag keeps growing. What do you do?

Find the bottleneck. Is processing slow (external calls, DB writes)? Scale consumers up to the partition count, add partitions if you're already at the limit, process in batches or asynchronously within a partition, optimise the handler, and check for rebalance loops or poison messages.

```bash
kafka-consumer-groups.sh --describe --group billing --bootstrap-server b:9092
```

## Intermediate

### Customers are charged twice after a consumer restart. Why, and how do you fix it?

With at-least-once delivery, the consumer processed a batch but crashed before committing the offsets, so the batch was redelivered. Make the handler idempotent: dedupe by event id or use an idempotency key with the payment provider, and commit after successful processing.

```python
payment_api.charge(amount, idempotency_key=event["id"])
```

### A single huge tenant makes one partition hot while others are idle. How do you rebalance?

Keying by tenant concentrates that tenant's traffic in one partition. Use a finer key (tenant + entity id) where ordering is only needed per entity, or salt the hot tenant's key across N sub-partitions and merge downstream.

```js
const key = hotTenants.has(t) ? `${t}#${hash(orderId) % 8}` : t;
```

## Advanced

### You need to publish an event whenever an order row is saved, without losing events or publishing phantom ones. How?

Use the transactional outbox. Write the order and an outbox row in the same DB transaction, then let a relay or Debezium CDC publish the outbox rows to Kafka. Consumers dedupe by event id. That avoids the dual-write problem (DB commit succeeds, Kafka send fails, or the reverse).

```sql
BEGIN; INSERT INTO orders …; INSERT INTO outbox (…, type) VALUES (…, 'OrderPlaced'); COMMIT;
```

# Tricky Questions

## Beginner

### If you have 10 consumers in a group but 4 partitions, how many consumers do work?

4. Each partition is owned by one consumer in the group, and the other 6 stay idle (as hot standbys).

```bash
kafka-consumer-groups.sh --describe --group g --bootstrap-server b:9092   # 6 members show no assigned partitions
```

## Intermediate

### Will adding partitions to an existing topic keep per-key ordering?

Not across the change. `hash(key) % N` changes, so new records for a key can go to a different partition than older ones. Ordering between old and new records for that key isn't guaranteed. Size partitions up front, or migrate to a new topic.

```text
key "acct-42": hash % 6 = 3 → after scaling to 12, hash % 12 = 9
```

## Advanced

### Does `enable.idempotence=true` give you exactly-once end to end?

No. It prevents duplicates and reordering caused by *producer retries* within a partition and session. End-to-end exactly-once also needs transactions (atomic offsets plus output) or an idempotent consumer and sink.

```properties
enable.idempotence=true          # producer-side only
transactional.id=app-1           # + transactions for read-process-write
```
