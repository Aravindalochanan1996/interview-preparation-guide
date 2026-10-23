---
id: grafana
title: Grafana & Prometheus
short: Grafana
category: Observability
order: 17.56
color: #f46800
icon: Gf
summary: Metrics, dashboards and alerting: Prometheus data model and PromQL, instrumenting apps, Grafana data sources, panels, variables, alerting, Loki logs, Tempo traces, SLOs and dashboards as code.
---

# Beginner

## Observability, Grafana and Prometheus

**Observability** rests on three signals: **metrics** (numbers over time), **logs** (events) and **traces** (request paths across services). **Grafana** is the visualisation and alerting layer that queries many data sources. **Prometheus** is the most common metrics backend: it **scrapes** HTTP `/metrics` endpoints on a schedule and stores time series.

```text
apps (/metrics) ◀─scrape─ Prometheus ─▶ Grafana dashboards & alerts ─▶ Slack / PagerDuty
apps logs ──▶ Loki ─────────────────────┘
apps traces ─▶ Tempo ───────────────────┘
```
```yaml docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:v2.54.1
    volumes: ["./prometheus.yml:/etc/prometheus/prometheus.yml"]
    ports: ["9090:9090"]
  grafana:
    image: grafana/grafana:11.2.0
    ports: ["3000:3000"]
    environment: { GF_SECURITY_ADMIN_PASSWORD: change-me }
  node-exporter:
    image: prom/node-exporter:v1.8.2
```
```yaml prometheus.yml
global: { scrape_interval: 15s }
scrape_configs:
  - job_name: api
    static_configs: [{ targets: ["api:8080"] }]
  - job_name: node
    static_configs: [{ targets: ["node-exporter:9100"] }]
```

## The Prometheus Data Model and Metric Types

A **time series** is a metric name plus a set of **labels**: `http_requests_total{method="GET", route="/orders", status="200"}`.

| Type | Meaning | Example |
|---|---|---|
| Counter | only goes up (resets on restart) | `http_requests_total` |
| Gauge | goes up and down | `queue_depth`, `memory_bytes` |
| Histogram | bucketed observations (+ `_sum`, `_count`) | `http_request_duration_seconds_bucket` |
| Summary | client-side quantiles (can't be aggregated across instances) | rarely preferred |

```text /metrics output (text exposition format)
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/orders",status="200"} 10432
http_request_duration_seconds_bucket{route="/orders",le="0.1"} 9800
http_request_duration_seconds_bucket{route="/orders",le="0.5"} 10390
http_request_duration_seconds_bucket{route="/orders",le="+Inf"} 10432
```

## Instrumenting an Application

```js Node (prom-client)
import client from 'prom-client';
client.collectDefaultMetrics();                             // CPU, memory, event loop lag
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds', help: 'Request latency',
  labelNames: ['method', 'route', 'status'], buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5],
});
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => end({ method: req.method, route: req.route?.path ?? 'unknown', status: res.statusCode }));
  next();
});
app.get('/metrics', async (_req, res) => { res.set('Content-Type', client.register.contentType); res.end(await client.register.metrics()); });
```
```python Python (prometheus_client)
from prometheus_client import Counter, Gauge, Histogram, start_http_server
ORDERS = Counter("orders_created_total", "Orders created", ["channel"])
QUEUE = Gauge("email_queue_depth", "Emails waiting")
LATENCY = Histogram("payment_seconds", "Payment latency")
start_http_server(8000)
ORDERS.labels(channel="web").inc()
with LATENCY.time(): charge_card()
```

> [!WARN]
> Keep label **cardinality** low. Never put user ids, emails, full URLs or request ids in labels: every unique combination is a new time series, and Prometheus memory explodes.

## Grafana Basics: Data Sources, Panels and Dashboards

1. Add a **data source** (Prometheus, Loki, Tempo, Elasticsearch, PostgreSQL, CloudWatch…).
2. Create a **dashboard** and add **panels** (time series, stat, gauge, bar, table, heatmap, logs).
3. Write a query, set units (seconds, bytes, req/s), thresholds and legends, then save.

```yaml provisioning/datasources/prometheus.yml (configure by file)
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
  - name: Loki
    type: loki
    url: http://loki:3100
```

# Intermediate

## PromQL Essentials

```promql
rate(http_requests_total[5m])                                         # per-second rate of a counter
sum by (route) (rate(http_requests_total[5m]))                         # req/s per route
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))   # error ratio
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))   # p95 latency
increase(orders_created_total[1h])                                     # orders in the last hour
avg_over_time(email_queue_depth[10m])
topk(5, sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="shop"}[5m])))
(1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100   # CPU %
predict_linear(node_filesystem_avail_bytes[6h], 24 * 3600) < 0         # disk will fill within 24 h
up == 0                                                                 # targets that are down
```
Rules: apply `rate()` to counters *before* `sum()`, use a range at least 4× the scrape interval, and use `histogram_quantile` on summed `_bucket` rates, keeping the `le` label.

## Dashboard Variables, Templating and Good Design

```promql Variables (Dashboard settings → Variables)
# $namespace  (query)  label_values(kube_pod_info, namespace)
# $service    (query)  label_values(http_requests_total{namespace="$namespace"}, service)
# $interval   (interval) 1m,5m,15m
sum by (route) (rate(http_requests_total{namespace="$namespace", service=~"$service"}[$__rate_interval]))
```
A good service dashboard follows **RED** (Rate, Errors, Duration) for services and **USE** (Utilisation, Saturation, Errors) for resources:
```text
Row "Traffic":   req/s by route (time series) · total req/s (stat)
Row "Errors":    5xx ratio (time series with threshold) · errors by route (bar)
Row "Latency":   p50/p95/p99 (time series) · latency heatmap from _bucket
Row "Resources": CPU, memory, pod restarts, saturation (queue depth, DB pool usage)
Links: drill-down to Loki logs and Tempo traces for the same $service and time range
```

## Alerting in Grafana and Prometheus

```yaml Prometheus alerting rules
groups:
  - name: api
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 10m                                    # must hold 10 min → fewer false alarms
        labels: { severity: page, team: checkout }
        annotations:
          summary: "5xx error rate {{ $value | humanizePercentage }} on {{ $labels.service }}"
          runbook_url: https://runbooks.acme.dev/high-error-rate
      - record: job:http_requests:rate5m           # recording rule: precompute expensive queries
        expr: sum by (job) (rate(http_requests_total[5m]))
```
```yaml Alertmanager routing
route:
  receiver: slack-default
  group_by: [alertname, service]
  group_wait: 30s
  repeat_interval: 4h
  routes:
    - matchers: [severity="page"]
      receiver: pagerduty
receivers:
  - name: pagerduty
    pagerduty_configs: [{ routing_key: "${PD_KEY}" }]
  - name: slack-default
    slack_configs: [{ api_url: "${SLACK_WEBHOOK}", channel: "#alerts" }]
inhibit_rules:
  - source_matchers: [alertname="ClusterDown"]
    target_matchers: [severity="warning"]       # don't spam warnings when the cluster is down
```
In **Grafana-managed alerting** you build rules from any data source query (Prometheus, Loki, SQL), with contact points, notification policies, silences and mute timings.

## Logs with Loki and LogQL

Loki indexes only **labels** (service, namespace, level) and stores log lines compressed. That makes it cheap, and you query it with **LogQL**.

```logql
{namespace="shop", app="orders"} |= "error"
{app="orders"} | json | status >= 500 | line_format "{{.method}} {{.path}} {{.status}}"
sum by (app) (rate({namespace="shop"} |= "error" [5m]))                  # metric from logs
topk(5, sum by (path) (count_over_time({app="nginx"} | pattern "<_> \"<method> <path> <_>\" <status> <_>" | status="500" [1h])))
```
```yaml promtail / Grafana Alloy (ship pod logs)
scrape_configs:
  - job_name: pods
    kubernetes_sd_configs: [{ role: pod }]
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_label_app]
        target_label: app
```

# Advanced

## Traces with Tempo and OpenTelemetry

```js OpenTelemetry SDK → OTLP → Tempo (or any backend)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
new NodeSDK({
  serviceName: 'orders-api',
  traceExporter: new OTLPTraceExporter({ url: 'http://otel-collector:4318/v1/traces' }),
  instrumentations: [getNodeAutoInstrumentations()],      // http, express, pg, redis… spans automatically
}).start();
```
```text TraceQL (Tempo)
{ resource.service.name = "orders-api" && span.http.status_code >= 500 }
{ duration > 2s && span.db.system = "postgresql" }
```
Correlate the signals: put `trace_id` in logs, use exemplars on histograms (click a latency spike and jump to a trace), and configure derived fields in Loki to link to Tempo.

## SLOs, Error Budgets and Burn-Rate Alerts

```promql SLI: share of good requests (non-5xx and under 300 ms) over 30 days
sum(rate(http_request_duration_seconds_bucket{le="0.3", status!~"5.."}[30d]))
/
sum(rate(http_request_duration_seconds_count[30d]))
```
```yaml Multi-window burn-rate alert for a 99.9% SLO (error budget 0.1%)
- alert: ErrorBudgetBurnFast
  expr: |
    (sum(rate(http_requests_total{status=~"5.."}[1h])) / sum(rate(http_requests_total[1h]))) > (14.4 * 0.001)
    and
    (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) > (14.4 * 0.001)
  labels: { severity: page }      # 2% of the 30-day budget burned in 1 hour
```

## Dashboards as Code and Scaling Prometheus

```yaml provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
  - name: team-dashboards
    folder: Services
    type: file
    options: { path: /var/lib/grafana/dashboards }      # JSON files committed to Git
```
```hcl Terraform Grafana provider
resource "grafana_folder" "checkout" {
  title = "Checkout"
}
resource "grafana_dashboard" "api" {
  folder      = grafana_folder.checkout.uid
  config_json = file("${path.module}/dashboards/api.json")
}
```
```yaml Kubernetes: ServiceMonitor (Prometheus Operator / kube-prometheus-stack)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata: { name: orders-api, labels: { release: kube-prometheus-stack } }
spec:
  selector: { matchLabels: { app: orders-api } }
  endpoints: [{ port: http, path: /metrics, interval: 30s }]
```
Scaling: use federation or `remote_write` to long-term storage (Grafana Mimir, Thanos, Cortex), recording rules for heavy queries, `metric_relabel_configs` to drop high-cardinality series, and sharding scrapes across Prometheus replicas.

# Interview Questions

## Beginner

### What is Grafana?

An open-source visualisation and alerting platform. It queries many data sources (Prometheus, Loki, Tempo, Elasticsearch, SQL, cloud monitoring) and displays the results in dashboards with panels, variables and alerts, without storing the data itself.

```yaml
datasources: [{ name: Prometheus, type: prometheus, url: http://prometheus:9090 }]
```

### How does Prometheus collect metrics?

It pulls them: it scrapes HTTP `/metrics` endpoints of targets (found through static config or service discovery such as Kubernetes) at an interval and stores samples in its local time-series database. Short-lived jobs can push to the Pushgateway.

```yaml
scrape_configs: [{ job_name: api, kubernetes_sd_configs: [{ role: pod }] }]
```

### Counter vs gauge vs histogram?

Counters only increase (requests, errors), so query them with `rate`. Gauges go up and down (memory, queue depth). Histograms count observations in buckets (latency, size) and support percentiles through `histogram_quantile`, aggregated across instances.

```promql
rate(errors_total[5m]) ; queue_depth ; histogram_quantile(0.99, sum by (le) (rate(latency_seconds_bucket[5m])))
```

### What are labels and why does cardinality matter?

Labels are key-value dimensions on a metric. Each unique label combination is a separate time series. High-cardinality labels (user id, URL with ids, request id) multiply the series and blow up memory and query cost.

```text
✅ route="/orders/:id"   ❌ path="/orders/98213"
```

## Intermediate

### Explain rate() vs irate() vs increase().

`rate` is the per-second average over the range, smooth and right for alerts and dashboards. `irate` uses the last two samples, so it reacts quickly but is spiky. `increase` is `rate × range`, the total increase over the window. All three handle counter resets.

```promql
rate(http_requests_total[5m]) ; irate(http_requests_total[1m]) ; increase(http_requests_total[1h])
```

### How do you calculate p95 latency in PromQL?

Sum the bucket rates by `le` (plus any grouping labels), then apply `histogram_quantile`. Averaging percentiles across instances is wrong.

```promql
histogram_quantile(0.95, sum by (le, service) (rate(http_request_duration_seconds_bucket[5m])))
```

### What are dashboard variables?

Template variables (query, custom, interval, data source) that parameterise panel queries, so one dashboard serves every service, namespace or environment, with drop-downs and repeat panels.

```promql
sum(rate(http_requests_total{service="$service"}[$__rate_interval]))
```

### What are the RED and USE methods?

RED is for request-driven services: Rate, Errors, Duration. USE is for resources: Utilisation, Saturation, Errors (CPU, memory, disk, network, pools). They give dashboards and alerts a consistent shape.

```promql
sum(rate(http_requests_total[5m])) ; sum(rate(http_requests_total{status=~"5.."}[5m])) ; histogram_quantile(0.99, …)
```

### Loki vs Elasticsearch for logs?

Loki indexes only labels and keeps compressed chunks in object storage. It's cheap, simple and integrates with Grafana, and it filters lines at query time. Elasticsearch indexes the full content for rich full-text search and analytics, at a higher resource cost.

```logql
{app="checkout"} |= "timeout" | json | duration > 2s
```

## Advanced

### How do you design alerts that don't wake people up for nothing?

Alert on symptoms users feel (SLO burn rate, error rate, latency), not every cause. Use `for:` durations, multi-window burn rates, severity routing (page vs ticket), grouping and inhibition, runbook links, and regular reviews of noisy alerts.

```yaml
for: 10m
labels: { severity: ticket }
annotations: { runbook_url: https://runbooks/… }
```

### What are recording rules and when do you use them?

Precomputed PromQL expressions stored as new series. Use them for expensive or frequently used queries (dashboards, SLOs, federation) to cut query latency and load.

```yaml
- record: service:http_error_ratio:rate5m
  expr: sum by (service) (rate(http_requests_total{status=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))
```

### How do you scale Prometheus for many clusters and long retention?

Run a Prometheus per cluster or shard, `remote_write` to horizontally scalable storage (Mimir, Thanos, Cortex), deduplicate HA pairs, downsample old data, enforce cardinality limits and relabel-drops, and use recording rules. Query globally through the long-term store.

```yaml
remote_write: [{ url: https://mimir.acme.dev/api/v1/push, queue_config: { max_samples_per_send: 5000 } }]
```

### How do you correlate metrics, logs and traces in Grafana?

Use shared labels (service, namespace, pod), `trace_id` in log lines with Loki derived fields linking to Tempo, exemplars on histograms linking to traces, and Tempo's "traces to logs/metrics" configuration. Dashboards link to Explore with the same variables and time range.

```yaml
derivedFields: [{ name: TraceID, matcherRegex: "trace_id=(\\w+)", url: "$${__value.raw}", datasourceUid: tempo }]
```

# Scenario Questions

## Beginner

### A Grafana panel shows "No data". How do you debug it?

Run the query in Prometheus (`:9090`) or Explore. Check that the target is up (`up{job="api"}`), the metric and label names are spelled right, the time range and data source are correct, the variable values match, and there's no `rate()` over a range shorter than the scrape interval.

```promql
up{job="api"}
count by (__name__) ({job="api"})      # which metrics exist for this job
```

## Intermediate

### Prometheus memory usage tripled after a release. What happened?

The release almost certainly added a high-cardinality label (user id, raw path, error message). Find the offending metrics in the TSDB status page or with `topk(count by (__name__))`, fix the instrumentation, and drop the label with `metric_relabel_configs` in the meantime.

```promql
topk(10, count by (__name__) ({__name__=~".+"}))
```
```yaml
metric_relabel_configs: [{ source_labels: [user_id], action: labeldrop, regex: user_id }]
```

### Users complain the site is slow, but the average latency panel looks fine. Why?

Averages hide the tail. A few very slow requests barely move the mean. Plot p95 and p99 from histograms and a latency heatmap, and break them down by route and region to find the slow path.

```promql
histogram_quantile(0.99, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))
```

## Advanced

### Design monitoring for a new checkout service with a 99.9% availability SLO.

Instrument RED metrics (request counter with route and status labels, a duration histogram), structured logs with trace ids to Loki, and OTel traces to Tempo. Define the SLI (good requests under 300 ms and non-5xx), recording rules, multi-window burn-rate alerts (page) plus slow-burn tickets, and a RED dashboard with drill-downs. Add a synthetic probe (blackbox exporter) for the user-facing URL.

```yaml blackbox probe
- job_name: checkout-probe
  metrics_path: /probe
  params: { module: [http_2xx] }
  static_configs: [{ targets: [https://acme.com/checkout/health] }]
```

# Tricky Questions

## Beginner

### Why is `sum(http_requests_total)` a poor panel for traffic?

A raw counter only goes up (and resets on restart), so the panel shows an ever-growing line. Graph `sum(rate(http_requests_total[5m]))` to get requests per second.

```promql
sum(rate(http_requests_total[5m]))
```

## Intermediate

### Why is `rate(sum(http_requests_total)[5m:])` wrong?

Summing before `rate` mixes counters from different instances. When one instance restarts, the sum drops and `rate` misreads it. Always take `rate()` of each series first, then `sum()`.

```promql
sum(rate(http_requests_total[5m]))
```

## Advanced

### Can you average p99 values from 10 pods to get the service p99?

No. Percentiles can't be averaged. Aggregate the histogram buckets across pods first, then compute the quantile (which is why histograms beat summaries).

```promql
histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{service="api"}[5m])))
```
