---
id: gcp
title: Google Cloud (GCP)
short: GCP
category: Cloud Platforms
order: 17.8
color: #4285f4
icon: GCP
summary: Resource hierarchy, IAM, VPC, Compute Engine, Cloud Run, GKE, Cloud Storage, databases (Cloud SQL, Spanner, Firestore, BigQuery), Pub/Sub, operations and cross-cloud service mapping.
---

# Beginner

## GCP Fundamentals and Resource Hierarchy

Google Cloud runs on the same global infrastructure as Google Search and YouTube — notably its **global private fibre network**, strengths in **data/analytics (BigQuery)**, **Kubernetes (GKE)** and **AI (Vertex AI, Gemini)**.

### Resource hierarchy
```text
Organization (company domain)
└── Folders (departments, environments)
    └── Projects (the core unit: billing, APIs, IAM, quotas)
        └── Resources (VMs, buckets, databases …)
```
IAM policies inherit downward; **Organization Policies** constrain what can be done (allowed regions, no external IPs, uniform bucket access).

### Locations
**Regions** (e.g., `asia-south1` Mumbai) with **zones** (`asia-south1-a`). Resources are **zonal** (VMs, disks), **regional** (Cloud Run, regional MIGs, Cloud SQL HA) or **global** (VPC networks, global load balancers, Cloud Storage multi-region, Spanner multi-region configs).

> [!NOTE]
> A GCP **VPC is global** — subnets are regional, but one VPC spans all regions. In AWS and Azure, networks are regional.

### Tools
Cloud Console, **gcloud** CLI, Cloud Shell, client libraries, Terraform / Infrastructure Manager.

```bash
gcloud auth login
gcloud config set project shop-dev-123
gcloud services enable run.googleapis.com
gcloud run deploy shop-api --source . --region asia-south1 --allow-unauthenticated
```

## IAM and Service Accounts

- **Principals**: Google accounts, groups, **service accounts** (identities for workloads), domains, workforce/workload identity federation.
- **Roles**: **basic** (Owner, Editor, Viewer — too broad, avoid), **predefined** (e.g., `roles/storage.objectViewer`), **custom**.
- **Policy** = bindings of principals to roles on a resource (org, folder, project or individual resource). Allow policies inherit; **deny policies** can override.
- Service accounts: attach to VMs/Cloud Run/GKE (via **Workload Identity Federation for GKE**) — avoid downloading service account keys; use **Workload Identity Federation** for GitHub Actions/AWS/Azure.
- Least privilege, group-based access, IAM Recommender, **VPC Service Controls** (perimeter around sensitive APIs to prevent data exfiltration).

```bash
gcloud iam service-accounts create orders-api --display-name "Orders API"
gcloud projects add-iam-policy-binding shop-prod \
  --member serviceAccount:orders-api@shop-prod.iam.gserviceaccount.com --role roles/cloudsql.client
gcloud storage buckets add-iam-policy-binding gs://shop-invoices \
  --member serviceAccount:orders-api@shop-prod.iam.gserviceaccount.com --role roles/storage.objectViewer   # resource-level, narrower
gcloud projects get-iam-policy shop-prod --flatten=bindings --filter="bindings.role:roles/owner"
```

## Compute Options

| Service | Model | Use |
|---|---|---|
| **Compute Engine** | VMs | full control; **Managed Instance Groups** for autoscaling/autohealing; Spot VMs; custom machine types |
| **Cloud Run** | serverless containers | any container listening on a port; scales to zero; request or instance billing; jobs for batch |
| **Cloud Run functions** (formerly Cloud Functions) | FaaS | event-driven code (Pub/Sub, Storage, Eventarc, HTTP) |
| **GKE** | managed Kubernetes | **Autopilot** (Google manages nodes, pay per pod) or Standard (you manage node pools) |
| **App Engine** | PaaS | legacy-but-alive; Standard/Flexible environments |
| **Batch** | batch jobs | HPC, large-scale processing |

Cloud Run is the default for most new stateless services: deploy from source or image, HTTPS endpoint, revisions with **traffic splitting** for canaries, concurrency per instance, VPC access, Secret Manager integration.

```bash
gcloud run deploy orders --image europe-docker.pkg.dev/shop-prod/apps/orders:1.4 --region europe-west1 \
  --service-account orders-api@shop-prod.iam.gserviceaccount.com --min-instances 1 --max-instances 50 --concurrency 80
gcloud compute instance-groups managed create web-mig --template web-tmpl --size 3 --region europe-west1
gcloud container clusters create-auto shop-gke --region europe-west1
```

## Storage and Databases

```bash
gcloud storage buckets create gs://shop-assets --location=EU --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://shop-assets --lifecycle-file=lifecycle.json
gcloud sql instances create orders-pg --database-version=POSTGRES_16 --tier=db-custom-2-8192 --region=europe-west1 --availability-type=REGIONAL
gcloud spanner instances create shop-global --config=nam-eur-asia1 --processing-units=1000 --description="Global orders"
```

### Cloud Storage
Object storage with buckets; classes **Standard, Nearline (30d), Coldline (90d), Archive (365d)**; locations: regional, dual-region, multi-region; lifecycle rules, versioning, retention locks, **uniform bucket-level access** + IAM, signed URLs, Autoclass.

### Databases
| Need | Service |
|---|---|
| Managed MySQL/PostgreSQL/SQL Server | **Cloud SQL** (HA with regional standby, read replicas) |
| PostgreSQL-compatible high-performance | **AlloyDB** (columnar engine for analytics, AI integrations) |
| Globally distributed relational with strong consistency and horizontal scale | **Spanner** (TrueTime, 99.999% SLA multi-region) |
| Document NoSQL for apps/mobile | **Firestore** (real-time listeners, offline sync) |
| Wide-column, massive throughput, time-series | **Bigtable** |
| In-memory | **Memorystore** (Redis/Valkey, Memcached) |
| Data warehouse / analytics | **BigQuery** |

## BigQuery Essentials

BigQuery is a **serverless, columnar data warehouse** — no clusters to manage, separates storage and compute, scales to petabytes.

```sql
SELECT DATE(order_ts) AS day, country, SUM(amount) AS revenue
FROM `shop-prod.sales.orders`
WHERE order_ts >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY day, country
ORDER BY day;
```
- Pricing: **on-demand** (per TB scanned) or **capacity** (slots via editions).
- Cost/performance: **partition** tables (by date/ingestion time), **cluster** by frequently filtered columns, select only needed columns (never `SELECT *` on big tables), use preview instead of queries, materialized views, BI Engine.
- Ecosystem: streaming inserts / Storage Write API, external tables on Cloud Storage (BigLake), BigQuery ML (`CREATE MODEL` in SQL), Looker for BI, **Dataflow** (Apache Beam streaming/batch ETL), **Dataproc** (managed Spark/Hadoop), **Dataform** (SQL transformations), **Composer** (managed Airflow).

# Intermediate

## Networking

- **VPC** (global) with regional subnets; **auto mode** (subnet per region, for testing) vs **custom mode** (production).
- **Firewall rules / policies** — stateful, applied to VMs by network tags or service accounts; hierarchical firewall policies at org/folder level.
- **Shared VPC** — host project owns the network; service projects attach to it (central network team, decentralised apps).
- **VPC Network Peering**, **Network Connectivity Center** (hub), **Cloud VPN** (HA VPN 99.99%), **Cloud Interconnect** (dedicated/partner) for hybrid.
- **Cloud NAT** — outbound internet for private instances; **Private Google Access** and **Private Service Connect** to reach Google APIs/services privately.
- **Cloud Load Balancing** — global external Application Load Balancer (single anycast IP worldwide, HTTP/2, QUIC), regional and internal LBs, proxy/passthrough Network LBs; **Cloud CDN** and **Cloud Armor** (WAF + DDoS) attach to it.
- **Cloud DNS** — managed authoritative DNS (public and private zones).

```bash
gcloud compute networks create shop-vpc --subnet-mode=custom                      # global VPC
gcloud compute networks subnets create eu --network shop-vpc --region europe-west1 --range 10.10.0.0/20 --enable-private-ip-google-access
gcloud compute networks subnets create us --network shop-vpc --region us-central1  --range 10.20.0.0/20
gcloud compute firewall-rules create allow-hc --network shop-vpc --allow tcp:8080 \
  --source-ranges 35.191.0.0/16,130.211.0.0/22 --target-tags web                  # Google health checkers
gcloud compute routers create nat-router --network shop-vpc --region europe-west1
gcloud compute routers nats create nat --router nat-router --region europe-west1 --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges
```

## Messaging, Events and Integration

- **Pub/Sub** — global, serverless messaging: topics and subscriptions (pull, push, BigQuery/Cloud Storage export), at-least-once delivery (exactly-once option for pull), ordering keys, dead-letter topics, retention and replay. Pub/Sub Lite deprecated → use Pub/Sub or Managed Kafka.
- **Eventarc** — routes events from Google services (Audit Logs, Storage) and custom sources to Cloud Run/functions/Workflows using CloudEvents.
- **Workflows** — serverless orchestration of services/APIs (like Step Functions).
- **Cloud Tasks** — managed task queues with rate limiting and scheduled delivery to HTTP targets.
- **Cloud Scheduler** — managed cron.
- **Apigee** / API Gateway — API management.

```python
from google.cloud import pubsub_v1
publisher = pubsub_v1.PublisherClient(publisher_options=pubsub_v1.types.PublisherOptions(enable_message_ordering=True))
topic = publisher.topic_path("shop-prod", "orders")
publisher.publish(topic, b'{"orderId": 42}', ordering_key="customer-7", event="OrderPlaced").result()

subscriber = pubsub_v1.SubscriberClient()
def callback(msg):
    process(msg.data)       # idempotent: at-least-once delivery
    msg.ack()
subscriber.subscribe(subscriber.subscription_path("shop-prod", "orders-billing"), callback=callback)
```

## DevOps on GCP

- **Artifact Registry** — container images and language packages; vulnerability scanning.
- **Cloud Build** — serverless CI: `cloudbuild.yaml` steps run in containers; triggers on GitHub/GitLab pushes.
- **Cloud Deploy** — managed continuous delivery to GKE/Cloud Run with promotion, approvals, canary.
- **Binary Authorization** — only deploy signed/attested images.
- **Secret Manager** for secrets; **Cloud KMS** for keys (CMEK).

```yaml cloudbuild.yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-t', 'asia-south1-docker.pkg.dev/$PROJECT_ID/apps/shop-api:$SHORT_SHA', '.']
  - name: gcr.io/cloud-builders/docker
    args: ['push', 'asia-south1-docker.pkg.dev/$PROJECT_ID/apps/shop-api:$SHORT_SHA']
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args: ['run', 'deploy', 'shop-api', '--image', 'asia-south1-docker.pkg.dev/$PROJECT_ID/apps/shop-api:$SHORT_SHA', '--region', 'asia-south1']
```

## Operations and Observability

**Google Cloud Observability** (formerly Stackdriver): **Cloud Monitoring** (metrics, dashboards, uptime checks, SLO monitoring, alerting), **Cloud Logging** (Log Explorer, log-based metrics, log sinks to BigQuery/Storage/Pub/Sub), **Cloud Trace**, **Cloud Profiler**, **Error Reporting**, Managed Service for Prometheus. **Cloud Audit Logs** (Admin Activity, Data Access) record who did what.

Google popularised **SRE** practices: SLIs/SLOs, error budgets, blameless postmortems, toil reduction — expect these questions in GCP-focused interviews.

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND severity>=ERROR' --limit 20 --freshness 1h
gcloud logging metrics create checkout_errors --description="Checkout errors" \
  --log-filter='resource.type="cloud_run_revision" AND jsonPayload.event="checkout_failed"'
gcloud logging sinks create audit-to-bq bigquery.googleapis.com/projects/shop-prod/datasets/audit \
  --log-filter='logName:"cloudaudit.googleapis.com"'
```

# Advanced

## Security and Architecture Patterns

- **Security Command Center** (posture, threats, vulnerabilities), **Cloud Armor**, **Identity-Aware Proxy** (zero-trust access to apps and VMs without VPN), **BeyondCorp**, **VPC Service Controls**, **Assured Workloads** (compliance regimes), **Confidential VMs/GKE**, **Sensitive Data Protection** (DLP).
- Encryption at rest by default; CMEK with Cloud KMS; Cloud HSM; External Key Manager.
- **Landing zone / enterprise foundations blueprint**: org policies, folder structure per environment, Shared VPC, centralised logging, billing exports to BigQuery, group-based IAM.

### Reference: serverless web app on GCP
```text
Cloud DNS → global external Application LB (+ Cloud Armor, Cloud CDN)
  → Cloud Run (multiple regions, serverless NEGs) → Cloud SQL / Firestore / Spanner
  → Pub/Sub → Cloud Run jobs/functions for async work → BigQuery for analytics
  Secret Manager, IAM service accounts per service, Cloud Monitoring/Logging/Trace, Cloud Build + Cloud Deploy
```

### Vertex AI (frequently asked)
Unified ML platform: Model Garden (Gemini and open models), generative AI APIs, Agent Builder / Agent Engine, AutoML, custom training, pipelines, feature store, model registry, endpoints, evaluation and monitoring. **Vector search** for RAG; BigQuery ML and BigQuery vector search for in-warehouse AI.

## Cross-Cloud Service Mapping

| Category | AWS | Azure | GCP |
|---|---|---|---|
| VMs | EC2 | Virtual Machines | Compute Engine |
| Autoscaling groups | Auto Scaling Groups | VM Scale Sets | Managed Instance Groups |
| Serverless functions | Lambda | Functions | Cloud Run functions |
| Serverless containers | Fargate / App Runner | Container Apps | Cloud Run |
| Managed Kubernetes | EKS | AKS | GKE |
| PaaS web | Elastic Beanstalk | App Service | App Engine |
| Object storage | S3 | Blob Storage | Cloud Storage |
| Block storage | EBS | Managed Disks | Persistent Disk / Hyperdisk |
| File storage | EFS / FSx | Azure Files | Filestore |
| Managed relational | RDS / Aurora | Azure SQL / Database for PostgreSQL | Cloud SQL / AlloyDB |
| Global relational | Aurora DSQL / Global DB | Cosmos DB for PostgreSQL | Spanner |
| NoSQL | DynamoDB | Cosmos DB | Firestore / Bigtable |
| Data warehouse | Redshift | Synapse / Fabric | BigQuery |
| Queue | SQS | Service Bus / Storage Queues | Pub/Sub / Cloud Tasks |
| Pub/sub & events | SNS / EventBridge | Event Grid | Pub/Sub / Eventarc |
| Streaming | Kinesis / MSK | Event Hubs | Pub/Sub / Managed Kafka |
| Workflow orchestration | Step Functions | Logic Apps / Durable Functions | Workflows |
| CDN | CloudFront | Front Door / CDN | Cloud CDN |
| DNS | Route 53 | Azure DNS | Cloud DNS |
| Identity | IAM / IAM Identity Center | Entra ID + RBAC | Cloud IAM / Cloud Identity |
| Secrets | Secrets Manager | Key Vault | Secret Manager |
| Keys | KMS | Key Vault / Managed HSM | Cloud KMS |
| Monitoring | CloudWatch | Azure Monitor | Cloud Monitoring/Logging |
| IaC (native) | CloudFormation / CDK | ARM / Bicep | Infrastructure Manager (Terraform) |
| CI/CD | CodePipeline / CodeBuild | Azure DevOps / GitHub Actions | Cloud Build / Cloud Deploy |
| Container registry | ECR | ACR | Artifact Registry |
| WAF | AWS WAF | Azure WAF | Cloud Armor |
| ML platform | SageMaker / Bedrock | Azure ML / AI Foundry | Vertex AI |

```bash Same task on each cloud: deploy a container
aws ecs update-service --cluster prod --service api --force-new-deployment          # AWS (ECS/Fargate)
az containerapp update -n api -g rg-prod --image acr.azurecr.io/api:1.4              # Azure (Container Apps)
gcloud run deploy api --image europe-docker.pkg.dev/p/apps/api:1.4 --region europe-west1  # GCP (Cloud Run)
```

# Interview Questions

## Beginner

### What is the GCP resource hierarchy?
Organization at the top, then folders, then projects, then resources. Projects are the base unit for billing, enabling APIs, quotas and IAM. IAM and organization policies set at higher levels are inherited by everything below.

```bash
gcloud resource-manager folders create --display-name=Production --organization=123456789
gcloud projects create shop-prod --folder=987654321
gcloud billing projects link shop-prod --billing-account=0X0X0X-0X0X0X-0X0X0X
gcloud resource-manager org-policies enable-enforce compute.requireOsLogin --folder=987654321   # inherited by projects
```

### What is a service account?
An identity used by workloads (VMs, Cloud Run services, pipelines) rather than people. Grant it narrowly scoped roles, attach it to resources, and avoid exporting long-lived keys — use attached identities or Workload Identity Federation instead.

```bash
gcloud iam service-accounts create report-job
gcloud run jobs deploy nightly-report --image …/report:1 --service-account report-job@shop-prod.iam.gserviceaccount.com
gcloud iam service-accounts add-iam-policy-binding report-job@shop-prod.iam.gserviceaccount.com \
  --member user:ada@acme.com --role roles/iam.serviceAccountTokenCreator   # impersonate instead of key files
gcloud storage ls gs://shop-reports --impersonate-service-account report-job@shop-prod.iam.gserviceaccount.com
```

### Cloud Run vs Cloud Run functions vs GKE?
Cloud Run runs any stateless container with automatic scaling (including to zero) and minimal ops. Cloud Run functions run single-purpose event-driven code without building containers yourself. GKE provides full Kubernetes for complex, stateful or highly customised workloads.

```python Cloud Run functions
import functions_framework

@functions_framework.cloud_event
def on_upload(cloud_event):
    data = cloud_event.data
    print(f"New file gs://{data['bucket']}/{data['name']}")
```
```bash
gcloud functions deploy on-upload --gen2 --runtime python312 --region europe-west1 \
  --trigger-event-filters type=google.cloud.storage.object.v1.finalized --trigger-event-filters bucket=shop-uploads
gcloud run deploy api --source . --region europe-west1          # any container
```

### What are Cloud Storage classes?
Standard (frequent access), Nearline (accessed less than monthly), Coldline (less than quarterly) and Archive (less than yearly), with decreasing storage cost and increasing retrieval cost and minimum storage durations.

```json lifecycle.json
{
  "rule": [
    { "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" }, "condition": { "age": 30 } },
    { "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" }, "condition": { "age": 90 } },
    { "action": { "type": "SetStorageClass", "storageClass": "ARCHIVE" },  "condition": { "age": 365 } },
    { "action": { "type": "Delete" }, "condition": { "age": 2555 } }
  ]
}
```

### What makes GCP networking different?
VPC networks are global resources with regional subnets, so one network can span all regions without peering. Google's global load balancer offers a single anycast IP serving users worldwide over Google's private backbone.

```bash
# One global VPC, subnets in two regions, internal traffic without peering
gcloud compute instances create eu-vm --zone europe-west1-b --subnet eu --no-address
gcloud compute instances create us-vm --zone us-central1-a  --subnet us --no-address
gcloud compute ssh eu-vm --tunnel-through-iap --command "ping -c3 $(gcloud compute instances describe us-vm --zone us-central1-a --format='value(networkInterfaces[0].networkIP)')"
```

## Intermediate

### What is BigQuery and how do you control its cost?
A serverless, columnar data warehouse that separates storage and compute. Control cost by partitioning and clustering tables, selecting only required columns, filtering on partition columns, using materialized views, setting maximum bytes billed and quotas, or using capacity-based slot pricing for predictable workloads.

```sql
CREATE TABLE shop.events
PARTITION BY DATE(event_ts)
CLUSTER BY customer_id, event_type AS
SELECT * FROM shop.events_raw;

SELECT customer_id, COUNT(*) AS views          -- only needed columns
FROM shop.events
WHERE DATE(event_ts) BETWEEN '2026-10-01' AND '2026-10-22'   -- partition pruning
  AND event_type = 'page_view'
GROUP BY customer_id;
```
```bash
bq query --use_legacy_sql=false --dry_run 'SELECT * FROM shop.events'   # bytes it WOULD scan
bq query --maximum_bytes_billed=10000000000 --use_legacy_sql=false '…'   # hard cap per query
```

### Cloud SQL vs Spanner vs Firestore vs Bigtable?
Cloud SQL is managed MySQL/PostgreSQL/SQL Server for typical relational workloads. Spanner is globally distributed relational with strong consistency and horizontal scale for mission-critical global systems. Firestore is a document database for app backends with real-time sync. Bigtable is a wide-column store for massive throughput, time-series and analytics workloads.

```python Firestore: documents for app data
from google.cloud import firestore
db = firestore.Client()
db.collection("carts").document("user-7").set({"items": [{"sku": "A1", "qty": 2}]}, merge=True)
```
```python Bigtable: wide-column, high-throughput time series
row = table.direct_row(b"sensor#42#20261023T1200")
row.set_cell("m", b"temp", b"21.5"); row.commit()
```
```sql Spanner: relational + global strong consistency
INSERT INTO Orders (OrderId, CustomerId, Total) VALUES (901, 7, 120.00);
```

### What is Shared VPC?
A model where a host project owns a VPC network and its subnets, and service projects deploy resources into those subnets. It centralises network administration and security while letting application teams manage their own projects.

```bash
gcloud compute shared-vpc enable net-host-prod
gcloud compute shared-vpc associated-projects add shop-prod --host-project net-host-prod
gcloud compute networks subnets add-iam-policy-binding eu --region europe-west1 --project net-host-prod \
  --member group:shop-devs@acme.com --role roles/compute.networkUser
```

### How does Pub/Sub work?
Publishers send messages to topics; subscriptions deliver them to subscribers via pull or push (or directly into BigQuery/Cloud Storage). Delivery is at-least-once with acknowledgement deadlines, optional ordering keys, dead-letter topics and replay from retained messages.

```bash
gcloud pubsub topics create orders
gcloud pubsub topics create orders-dlq
gcloud pubsub subscriptions create orders-billing --topic orders --ack-deadline 60 \
  --dead-letter-topic orders-dlq --max-delivery-attempts 5 --enable-message-ordering --message-retention-duration 7d
gcloud pubsub subscriptions create orders-to-bq --topic orders --bigquery-table shop-prod:shop.orders_raw
gcloud pubsub subscriptions seek orders-billing --time 2026-10-23T08:00:00Z     # replay
```

### What are VPC Service Controls?
Security perimeters around Google-managed services (BigQuery, Cloud Storage) that block data movement across the perimeter even with valid credentials — mitigating data exfiltration risks from stolen credentials or misconfigured IAM.

```bash
gcloud access-context-manager perimeters create shop_data \
  --title "Shop data" --policy $POLICY_ID \
  --resources projects/123456789012 \
  --restricted-services bigquery.googleapis.com,storage.googleapis.com
# A stolen key used from outside the perimeter → "Request is prohibited by organization's policy"
```

## Advanced

### How would you design a global, highly available application on GCP?
A global external Application Load Balancer with Cloud Armor and Cloud CDN routing to Cloud Run or GKE in multiple regions, Spanner multi-region (or Cloud SQL with cross-region replicas) for data, Memorystore per region, Pub/Sub for async processing, Secret Manager and per-service accounts, Cloud Monitoring SLOs and alerting, and Terraform-managed environments.

```text
Cloud DNS ─▶ Global external Application LB (anycast IP) + Cloud Armor + Cloud CDN
                 │ serverless NEGs
     ┌───────────┴───────────┐
 Cloud Run europe-west1   Cloud Run us-central1
     └───────────┬───────────┘
        Spanner multi-region (nam-eur-asia1) · Memorystore per region · Pub/Sub (global)
```
```bash
gcloud compute network-endpoint-groups create orders-eu --region europe-west1 --network-endpoint-type serverless --cloud-run-service orders
gcloud compute backend-services add-backend orders-be --global --network-endpoint-group orders-eu --network-endpoint-group-region europe-west1
```

### Explain SRE concepts like SLIs, SLOs and error budgets.
An SLI is a measured indicator of service health (e.g., the proportion of requests under 300 ms). An SLO is the target for that SLI (99.9% over 30 days). The error budget is the allowed unreliability (0.1%). When the budget is exhausted, teams prioritise reliability work over new features; when there's budget left, they can ship faster.

```text
SLI          = good requests / valid requests   (status < 500 AND latency < 300 ms)
SLO          = 99.9 % over 30 days
Error budget = 0.1 % × 30 d × 24 h × 60 min ≈ 43 minutes of "bad" per month
Burn rate 14.4 for 1 h → 2 % of the monthly budget gone → page someone
```
```promql
sum(rate(http_requests_total{code!~"5.."}[30d])) / sum(rate(http_requests_total[30d]))
```

### How do you migrate workloads from AWS or Azure to GCP?
Assess and map services (compute, storage, databases, IAM), choose strategies per workload (rehost with Migrate to Virtual Machines, replatform to Cloud Run/GKE, refactor), migrate data with Database Migration Service and Storage Transfer Service, set up landing zone and networking first, run in parallel with testing, then cut over with DNS and rollback plans.

```bash
gcloud transfer jobs create s3://acme-assets gs://acme-assets --source-creds-file=aws-creds.json   # Storage Transfer Service
gcloud database-migration migration-jobs create pg-mig --region europe-west1 --type CONTINUOUS \
  --source aws-rds-profile --destination cloudsql-profile                                          # DMS with CDC
gcloud run deploy api --image europe-docker.pkg.dev/shop/apps/api:1.4                              # replatform the container
```

# Scenario Questions

## Beginner

### Your Cloud Run service returns 403 when you call it from the browser. Why?
The service requires **authentication**, the default for many organisation policies. For a public site, allow `allUsers` the `roles/run.invoker` role (if org policy permits). Otherwise call it with an identity token, or put it behind a load balancer with IAP. Also check ingress settings (internal only versus all).

```bash
gcloud run services get-iam-policy orders --region europe-west1
gcloud run services add-iam-policy-binding orders --region europe-west1 --member allUsers --role roles/run.invoker  # public site
# Private service: call it with an identity token
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://orders-abc-ew.a.run.app/health
gcloud run services describe orders --region europe-west1 --format='value(metadata.annotations."run.googleapis.com/ingress")'
```

## Intermediate

### A BigQuery query costs $50 each time it runs on a dashboard. How do you reduce it?
- **Partition** tables (by date) and **cluster** them on filter columns.
- Select only the columns you need (no `SELECT *`).
- Always filter on the partition column.
- Use materialised views or pre-aggregated tables.
- Enable BI Engine or result caching.
- Set per-user quotas, or move to capacity (slot) pricing for predictable spend.

```sql
CREATE MATERIALIZED VIEW shop.daily_revenue
PARTITION BY day CLUSTER BY region AS
SELECT DATE(order_ts) AS day, region, SUM(total) AS revenue, COUNT(*) AS orders
FROM shop.orders GROUP BY day, region;

-- Dashboard now reads a few MB instead of scanning the full table
SELECT * FROM shop.daily_revenue WHERE day >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
```

### Your service on GKE needs to read from Cloud Storage. How do you grant access without key files?
Use **Workload Identity Federation for GKE**. Bind the Kubernetes ServiceAccount to an IAM principal (or a Google service account) with `roles/storage.objectViewer` on the bucket. Pods get short-lived credentials automatically. Never download JSON service-account keys.

```bash
gcloud container clusters update shop-gke --region europe-west1 --workload-pool=shop-prod.svc.id.goog
kubectl create serviceaccount reports -n shop
gcloud storage buckets add-iam-policy-binding gs://shop-reports \
  --role roles/storage.objectViewer \
  --member "principal://iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/shop-prod.svc.id.goog/subject/ns/shop/sa/reports"
```
```yaml
spec:
  serviceAccountName: reports        # pods get Google credentials automatically
```

# Tricky Questions

## Intermediate

### Is a GCP VPC regional, like on AWS?
No. A GCP **VPC is global** and its **subnets are regional**, so VMs in different regions can talk over internal IPs in the same VPC without peering. Firewall rules belong to the VPC and target instances by network tags or service accounts.

```bash
gcloud compute networks describe shop-vpc --format='value(subnetworks)'   # subnets from many regions
gcloud compute firewall-rules create allow-internal --network shop-vpc --allow tcp,udp,icmp --source-ranges 10.0.0.0/8
```

### You grant a role at the project level, but a user still can't access a resource. What could block it?
**Deny policies**, organisation policy constraints, VPC Service Controls perimeters, or IAM Conditions on the binding. Also check whether the API is enabled for the project and whether the user is using the right project or account (`gcloud config list`).

```bash
gcloud policy-intelligence troubleshoot-policy iam //storage.googleapis.com/projects/_/buckets/shop-data \
  --principal-email=ada@acme.com --permission=storage.objects.get
gcloud iam policies list --attachment-point=cloudresourcemanager.googleapis.com/projects/shop-prod --kind=denypolicies
gcloud resource-manager org-policies list --project shop-prod
gcloud services list --enabled --project shop-prod | grep storage
```
