---
id: kibana
title: Kibana & the ELK Stack
short: Kibana / ELK
category: Observability
order: 17.55
color: #e8478b
icon: Kb
summary: Centralised logging and search with Elasticsearch, Logstash, Beats and Kibana: indexing, mappings, KQL, Discover, visualisations, dashboards, ingest pipelines, ILM, alerting, APM and cluster operations.
---

# Beginner

## What the ELK / Elastic Stack Is

The **Elastic Stack** collects, stores, searches and visualises logs, metrics and traces:

| Component | Role |
|---|---|
| **Beats** (Filebeat, Metricbeat) / **Elastic Agent** | lightweight shippers on hosts and containers |
| **Logstash** | heavier pipeline: parse, enrich, transform, route |
| **Elasticsearch** | distributed search and analytics engine (stores the data in indices) |
| **Kibana** | UI: Discover, dashboards, visualisations, alerting, APM, Dev Tools |

```text
app logs ─▶ Filebeat ─▶ (Logstash: grok/enrich) ─▶ Elasticsearch ─▶ Kibana (Discover, Dashboards, Alerts)
```
```yaml docker-compose.yml (local, security disabled for learning only)
services:
  es:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0
    environment: { discovery.type: single-node, xpack.security.enabled: "false", ES_JAVA_OPTS: "-Xms1g -Xmx1g" }
    ports: ["9200:9200"]
  kibana:
    image: docker.elastic.co/kibana/kibana:8.15.0
    environment: { ELASTICSEARCH_HOSTS: "http://es:9200" }
    ports: ["5601:5601"]
```

## Structured Logging from Your App

Search, filter and aggregate work far better on **structured JSON logs** with consistent field names (ideally the **Elastic Common Schema (ECS)**) than on free text.

```js Node (pino) → JSON lines
import pino from 'pino';
const log = pino({ base: { 'service.name': 'orders-api', 'service.environment': process.env.ENV } });
log.info({ 'http.request.method': 'POST', 'url.path': '/orders', 'event.duration': 42e6, 'trace.id': traceId, 'user.id': 42 }, 'order created');
// {"level":30,"time":1761210000000,"service.name":"orders-api","url.path":"/orders","msg":"order created",...}
```
```python Python (structlog)
import structlog
log = structlog.get_logger().bind(service="payments")
log.warning("payment_declined", order_id=901, reason="insufficient_funds", amount=120.0)
```

## Shipping Logs with Filebeat

```yaml filebeat.yml
filebeat.inputs:
  - type: filestream
    id: app-logs
    paths: [/var/log/app/*.log]
    parsers:
      - ndjson: { target: "", overwrite_keys: true }      # JSON lines → fields
processors:
  - add_host_metadata: ~
  - add_cloud_metadata: ~
  - add_kubernetes_metadata: ~
output.elasticsearch:
  hosts: ["https://es:9200"]
  api_key: "${ES_API_KEY}"
  index: "logs-orders-%{+yyyy.MM.dd}"
setup.ilm.enabled: true
```
```bash
filebeat test config && filebeat test output
filebeat modules enable nginx system     # ready-made parsing + dashboards
filebeat setup --dashboards
```

## Discover and KQL

**Discover** lets you explore documents by time range with filters, columns and a histogram. Create a **data view** (index pattern) such as `logs-*` with `@timestamp` as the time field first.

```text KQL (Kibana Query Language) examples
service.name : "orders-api" and log.level : "error"
http.response.status_code >= 500 and not url.path : "/health"
user.id : 42 or user.email : *@acme.com
message : "timeout" and event.duration > 2000000000
kubernetes.namespace : ("shop" or "payments")
error.message : * and service.environment : "prod"
```
```text Lucene syntax (also supported)
status:[500 TO 599] AND NOT path:"/health"
message:"connection refused"~3
```

# Intermediate

## Elasticsearch Basics: Indices, Documents and Mappings

An **index** stores JSON **documents**. A **mapping** defines field types. **Shards** split an index across nodes, and **replicas** copy shards for high availability and read throughput.

```http Kibana Dev Tools console
PUT orders
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 1 },
  "mappings": {
    "properties": {
      "order_id":   { "type": "keyword" },
      "customer":   { "type": "text", "fields": { "raw": { "type": "keyword" } } },
      "total":      { "type": "scaled_float", "scaling_factor": 100 },
      "status":     { "type": "keyword" },
      "created_at": { "type": "date" },
      "items":      { "type": "nested", "properties": { "sku": { "type": "keyword" }, "qty": { "type": "integer" } } }
    }
  }
}

POST orders/_doc
{ "order_id": "901", "customer": "Ada Lovelace", "total": 120.5, "status": "paid", "created_at": "2026-10-23T10:00:00Z" }

GET orders/_mapping
GET _cat/indices/logs-*?v&s=store.size:desc
```
> [!TIP]
> Use `keyword` for exact match, aggregations and sorting (ids, status, emails). Use `text` for full-text search (messages, descriptions). Dynamic mapping can turn every new field into `text` + `keyword` and cause a **mapping explosion**, so define templates.

## Query DSL and Aggregations

```http
GET logs-*/_search
{
  "size": 20,
  "sort": [{ "@timestamp": "desc" }],
  "query": {
    "bool": {
      "must":   [{ "match": { "message": "payment timeout" } }],
      "filter": [
        { "term": { "service.name": "payments" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ],
      "must_not": [{ "term": { "url.path": "/health" } }]
    }
  }
}
```
```http Error count per service per 5 minutes + p95 latency
GET logs-*/_search
{
  "size": 0,
  "query": { "range": { "@timestamp": { "gte": "now-24h" } } },
  "aggs": {
    "per_service": {
      "terms": { "field": "service.name", "size": 10 },
      "aggs": {
        "errors": { "filter": { "term": { "log.level": "error" } } },
        "over_time": { "date_histogram": { "field": "@timestamp", "fixed_interval": "5m" } },
        "p95_ms": { "percentiles": { "field": "event.duration", "percents": [95] } }
      }
    }
  }
}
```

## Ingest Pipelines and Logstash

```http Ingest pipeline: parse nginx lines inside Elasticsearch
PUT _ingest/pipeline/nginx-access
{
  "processors": [
    { "grok": { "field": "message", "patterns": ["%{IPORHOST:client.ip} - %{DATA:user.name} \\[%{HTTPDATE:ts}\\] \"%{WORD:http.request.method} %{DATA:url.original} HTTP/%{NUMBER}\" %{NUMBER:http.response.status_code:int} %{NUMBER:http.response.body.bytes:int}"] } },
    { "date": { "field": "ts", "formats": ["dd/MMM/yyyy:HH:mm:ss Z"] } },
    { "geoip": { "field": "client.ip", "target_field": "client.geo" } },
    { "user_agent": { "field": "user_agent.original", "ignore_missing": true } },
    { "remove": { "field": ["ts"] } }
  ]
}
POST _ingest/pipeline/nginx-access/_simulate
{ "docs": [{ "_source": { "message": "203.0.113.9 - - [23/Oct/2026:10:00:01 +0000] \"GET /cart HTTP/1.1\" 200 512" } }] }
```
```ruby logstash.conf
input  { beats { port => 5044 } }
filter {
  if [service][name] == "payments" {
    json { source => "message" }
    mutate { remove_field => ["[card][number]"] }            # drop sensitive data
    translate { source => "[country]" target => "[region]" dictionary_path => "/etc/logstash/regions.yml" }
  }
}
output { elasticsearch { hosts => ["https://es:9200"] api_key => "${ES_API_KEY}" data_stream => "true" } }
```

## Visualisations and Dashboards

Build visualisations with **Lens** (drag and drop): bar charts of errors over time, top-N services by error count, latency percentiles, maps by `client.geo`, tables of the slowest endpoints. Combine them into **dashboards** with shared time pickers, filters and **controls** (drop-downs for service and environment).

```text Example "Service health" dashboard
Row 1: Requests/min (Lens line) · Error rate % (formula: count(kql='log.level:error') / count())  · p95 latency
Row 2: Top 10 failing endpoints (table: url.path, count, p95)   · Errors by version (bar, split by service.version)
Row 3: Saved search "prod errors" (log stream)                  · Map: requests by client.geo.country_iso_code
Controls: service.name, service.environment, kubernetes.namespace
```
```bash Export and import dashboards as code (Saved Objects API)
curl -s -X POST "$KIBANA/api/saved_objects/_export" -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"type":["dashboard"],"includeReferencesDeep":true}' -o dashboards.ndjson
curl -s -X POST "$KIBANA/api/saved_objects/_import?overwrite=true" -H 'kbn-xsrf: true' --form file=@dashboards.ndjson
```

# Advanced

## Index Lifecycle Management and Data Streams

Logs are time series, so use **data streams** (append-only, backed by rolling indices) and **ILM** to move data through hot → warm → cold → delete phases.

```http
PUT _ilm/policy/logs-30d
{
  "policy": { "phases": {
    "hot":    { "actions": { "rollover": { "max_primary_shard_size": "50gb", "max_age": "1d" } } },
    "warm":   { "min_age": "7d",  "actions": { "shrink": { "number_of_shards": 1 }, "forcemerge": { "max_num_segments": 1 } } },
    "cold":   { "min_age": "14d", "actions": { "set_priority": { "priority": 0 } } },
    "delete": { "min_age": "30d", "actions": { "delete": {} } }
  } }
}
PUT _index_template/logs-orders
{
  "index_patterns": ["logs-orders-*"],
  "data_stream": {},
  "template": {
    "settings": { "index.lifecycle.name": "logs-30d", "number_of_shards": 1 },
    "mappings": { "dynamic": "strict", "properties": { "@timestamp": { "type": "date" }, "message": { "type": "text" }, "service.name": { "type": "keyword" } } }
  }
}
```

## Alerting, Observability and APM

```text Kibana alerting rule (Elasticsearch query rule)
Index: logs-*      Query (KQL): service.name:"payments" and log.level:"error"
Condition: count > 50 over last 5 minutes, check every 1 minute
Action: Slack #payments-oncall + PagerDuty, message:
  "{{context.hits}} payment errors in 5m — {{context.link}}"
```
```js Elastic APM agent (Node): traces, spans, errors linked to logs by trace.id
require('elastic-apm-node').start({
  serviceName: 'orders-api',
  serverUrl: process.env.ELASTIC_APM_SERVER_URL,
  secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
  environment: 'prod',
  transactionSampleRate: 0.2,
});
// OpenTelemetry also works: send OTLP to the APM server / Elastic Agent
```

## Cluster Operations, Performance and Security

```http Health and troubleshooting
GET _cluster/health                         # green / yellow (replicas unassigned) / red (primary missing)
GET _cat/shards?v&h=index,shard,prirep,state,unassigned.reason
GET _cluster/allocation/explain
GET _cat/nodes?v&h=name,heap.percent,cpu,load_1m,disk.used_percent,node.role
GET _nodes/hot_threads
```
| Rule of thumb | Why |
|---|---|
| shard size 10–50 GB | too many tiny shards waste heap; huge shards recover slowly |
| JVM heap ≤ 50% of RAM, ≤ ~31 GB | leave RAM for the file-system cache; compressed oops |
| dedicated master nodes (3) | stable cluster coordination |
| `refresh_interval: 30s` for heavy ingest | fewer segment refreshes |
| bulk API, not single-doc writes | throughput |

```http Security: least-privilege API key for a shipper
POST _security/api_key
{
  "name": "filebeat-orders",
  "role_descriptors": { "writer": { "indices": [{ "names": ["logs-orders-*"], "privileges": ["create_doc", "auto_configure"] }] } }
}
```
Also use TLS everywhere, Kibana spaces and roles per team, field- and document-level security for sensitive data, and audit logging.

# Interview Questions

## Beginner

### What is the ELK stack?

Elasticsearch (storage, search and analytics), Logstash (ingest and transform) and Kibana (visualise and explore). Beats and Elastic Agent are lightweight shippers. Together they centralise logs and metrics, so you can search across every service in one place.

```text
Filebeat → Logstash → Elasticsearch → Kibana
```

### What is Kibana used for?

Exploring data in Discover, building visualisations and dashboards with Lens, alerting, APM and observability UIs, security analytics (SIEM), managing indices and ILM, and running queries in Dev Tools.

```text
Discover → KQL: service.name:"orders-api" and log.level:"error"   (last 15 minutes)
```

### What is KQL?

Kibana Query Language: a simple filter syntax with `field : value`, `and`/`or`/`not`, ranges (`>=`), wildcards and nested field support. Use it in the Discover search bar and in dashboards.

```text
http.response.status_code >= 500 and not url.path : "/health"
```

### What is a data view (index pattern)?

A Kibana object that points at one or more indices or data streams (such as `logs-*`) and defines the time field, so Discover and visualisations know which data to query.

```bash
curl -X POST "$KIBANA/api/data_views/data_view" -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"data_view":{"title":"logs-*","timeFieldName":"@timestamp"}}'
```

### Why use structured (JSON) logs?

Fields become searchable, filterable and aggregatable without fragile regex parsing. You can chart errors by service, latency by endpoint, and link logs to traces through `trace.id`.

```json
{"@timestamp":"2026-10-23T10:00:00Z","log.level":"error","service.name":"payments","error.message":"timeout","trace.id":"4bf92f…"}
```

## Intermediate

### text vs keyword fields?

`text` is analysed (tokenised, lowercased) for full-text search. `keyword` stores the exact value for filters, sorting and aggregations. Many string fields use both through multi-fields.

```json
"customer": { "type": "text", "fields": { "raw": { "type": "keyword" } } }
```

### Filebeat vs Logstash?

Filebeat is a light agent that tails files and ships them, with simple processors. Logstash is a heavier, centralised pipeline with rich filters (grok, enrichment, conditionals) and many inputs and outputs. Often Filebeat ships to Logstash or directly to Elasticsearch ingest pipelines.

```yaml
output.logstash: { hosts: ["logstash:5044"] }
```

### What are shards and replicas?

An index is split into primary shards (for horizontal scale). Each primary has replica copies on other nodes, for high availability and read throughput. A yellow cluster means replicas are unassigned. Red means a primary is missing.

```http
PUT logs-x { "settings": { "number_of_shards": 2, "number_of_replicas": 1 } }
```

### How do you parse unstructured log lines?

Use grok patterns (in Logstash or ingest pipelines), dissect for fixed delimiters (faster), date processors for timestamps, and test with `_simulate`. Better still, change the app to emit JSON.

```http
{ "dissect": { "field": "message", "pattern": "%{ts} %{level} [%{service}] %{msg}" } }
```

### How do you create an alert in Kibana?

Create a rule (Elasticsearch query, threshold, log threshold or APM error rate) with a schedule and condition, then attach connectors (Slack, email, PagerDuty, webhook) with templated messages. Group alerts by fields to avoid noise.

```text
Rule: count(log.level:error) by service.name > 50 in 5m → Slack
```

## Advanced

### What is ILM and why is it essential for logs?

Index lifecycle management automates rollover and moves indices through hot, warm and cold tiers, shrinking, force-merging and finally deleting them. That controls cost and shard count and keeps search fast for recent data.

```http
GET logs-orders-*/_ilm/explain
```

### How do you avoid a mapping explosion?

Use explicit index templates with `dynamic: strict` or `false`, the `flattened` type for arbitrary key-value blobs, `index.mapping.total_fields.limit`, and ECS field names. Never log unbounded keys (user ids as field names).

```json
"labels": { "type": "flattened" }
```

### How would you design logging for 200 microservices?

Standardise structured JSON plus ECS fields and correlation ids (`trace.id`) in a shared logging library. Ship through Elastic Agent or Filebeat DaemonSets in Kubernetes. Use data streams per service or namespace, ILM tiers and retention per environment, sampling or dropping debug logs in production, PII scrubbing in pipelines, dashboards and alerts as code, and role-based spaces per team.

```yaml
processors: [{ drop_event: { when: { equals: { log.level: "debug" } } } }]
```

### How do you troubleshoot a slow Elasticsearch cluster?

Check `_cluster/health` and the shard count per node (over-sharding), heap and GC pressure, `hot_threads`, slow logs for expensive queries (leading wildcards, deep pagination, huge aggregations), disk watermarks, and merge and refresh pressure during ingest. Then fix shard sizing, mappings and queries.

```http
PUT logs-*/_settings { "index.search.slowlog.threshold.query.warn": "2s" }
```

# Scenario Questions

## Beginner

### Logs from a new service don't appear in Kibana. How do you debug?

Check whether the app writes logs where Filebeat reads them (`filebeat test config`, the registry, Filebeat's own logs), whether the output can reach and authenticate to Elasticsearch, whether the index or data stream exists (`_cat/indices`), whether the data view covers that index pattern, and whether the time range and timestamp parsing are correct (wrong timezone means "future" logs).

```bash
filebeat test output
curl -s "$ES/_cat/indices/logs-*?v" | grep orders
```

## Intermediate

### The cluster turned red after a node died. What do you do?

Red means some primary shards are unassigned. Run `_cluster/allocation/explain` to see why (disk watermark, the node lost with no replica, allocation filters). Bring the node back or restore from a snapshot. Prevent it with replicas ≥ 1, 3 master-eligible nodes, and disk monitoring.

```http
GET _cluster/allocation/explain
POST _snapshot/backup/snap-2026.10.22/_restore { "indices": "logs-orders-2026.10.22" }
```

### Storage costs are exploding from debug logs. How do you reduce them?

Drop or sample debug and info logs in production at the shipper, shorten retention with ILM, move older data to warm, cold or frozen tiers (searchable snapshots), remove unused fields, use `best_compression`, and size shards properly.

```yaml
processors:
  - drop_event: { when: { and: [{ equals: { log.level: "debug" } }, { equals: { service.environment: "prod" } }] } }
```

## Advanced

### Credit card numbers were found in your logs. How do you respond and prevent it?

Contain it: restrict access, then delete or redact the affected documents (`_delete_by_query` / `_update_by_query`, plus snapshots). Fix the application logging. Add redaction in ingest pipelines (`redact` or `gsub` processors), field-level security, and automated detection rules.

```http
PUT _ingest/pipeline/redact-pan
{ "processors": [{ "redact": { "field": "message", "patterns": ["%{CREDIT_CARD:card}"], "pattern_definitions": { "CREDIT_CARD": "\\b(?:\\d[ -]*?){13,16}\\b" } } }] }
```

# Tricky Questions

## Beginner

### Why does `status : "Error"` find nothing when the logs contain `"error"`?

`keyword` fields are case-sensitive exact matches. Either query with the exact case, use a normalised (lowercase) keyword mapping, or search an analysed `text` field.

```json
"log.level": { "type": "keyword", "normalizer": "lowercase" }
```

## Intermediate

### Why can a terms aggregation on a `text` field fail?

`text` fields don't have doc values for aggregations by default (fielddata is disabled, because it's expensive). Aggregate on the `keyword` sub-field instead.

```json
"aggs": { "top_customers": { "terms": { "field": "customer.raw" } } }
```

## Advanced

### Is it safe to page through 1M results with `from` / `size`?

No. Deep pagination is limited (`index.max_result_window`, 10,000 by default) and costs a lot of memory. Use `search_after` with a point-in-time (PIT) for deep paging, or the scroll API for exports.

```http
POST logs-*/_pit?keep_alive=2m
GET _search { "size": 1000, "pit": { "id": "…" }, "sort": [{ "@timestamp": "asc" }, { "_shard_doc": "asc" }], "search_after": [1761200000000, 42] }
```
