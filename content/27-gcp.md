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

## Storage and Databases

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

## Messaging, Events and Integration

- **Pub/Sub** — global, serverless messaging: topics and subscriptions (pull, push, BigQuery/Cloud Storage export), at-least-once delivery (exactly-once option for pull), ordering keys, dead-letter topics, retention and replay. Pub/Sub Lite deprecated → use Pub/Sub or Managed Kafka.
- **Eventarc** — routes events from Google services (Audit Logs, Storage) and custom sources to Cloud Run/functions/Workflows using CloudEvents.
- **Workflows** — serverless orchestration of services/APIs (like Step Functions).
- **Cloud Tasks** — managed task queues with rate limiting and scheduled delivery to HTTP targets.
- **Cloud Scheduler** — managed cron.
- **Apigee** / API Gateway — API management.

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

# Interview Questions

## Beginner

### What is the GCP resource hierarchy?
Organization at the top, then folders, then projects, then resources. Projects are the base unit for billing, enabling APIs, quotas and IAM. IAM and organization policies set at higher levels are inherited by everything below.

### What is a service account?
An identity used by workloads (VMs, Cloud Run services, pipelines) rather than people. Grant it narrowly scoped roles, attach it to resources, and avoid exporting long-lived keys — use attached identities or Workload Identity Federation instead.

### Cloud Run vs Cloud Run functions vs GKE?
Cloud Run runs any stateless container with automatic scaling (including to zero) and minimal ops. Cloud Run functions run single-purpose event-driven code without building containers yourself. GKE provides full Kubernetes for complex, stateful or highly customised workloads.

### What are Cloud Storage classes?
Standard (frequent access), Nearline (accessed less than monthly), Coldline (less than quarterly) and Archive (less than yearly), with decreasing storage cost and increasing retrieval cost and minimum storage durations.

### What makes GCP networking different?
VPC networks are global resources with regional subnets, so one network can span all regions without peering. Google's global load balancer offers a single anycast IP serving users worldwide over Google's private backbone.

## Intermediate

### What is BigQuery and how do you control its cost?
A serverless, columnar data warehouse that separates storage and compute. Control cost by partitioning and clustering tables, selecting only required columns, filtering on partition columns, using materialized views, setting maximum bytes billed and quotas, or using capacity-based slot pricing for predictable workloads.

### Cloud SQL vs Spanner vs Firestore vs Bigtable?
Cloud SQL is managed MySQL/PostgreSQL/SQL Server for typical relational workloads. Spanner is globally distributed relational with strong consistency and horizontal scale for mission-critical global systems. Firestore is a document database for app backends with real-time sync. Bigtable is a wide-column store for massive throughput, time-series and analytics workloads.

### What is Shared VPC?
A model where a host project owns a VPC network and its subnets, and service projects deploy resources into those subnets. It centralises network administration and security while letting application teams manage their own projects.

### How does Pub/Sub work?
Publishers send messages to topics; subscriptions deliver them to subscribers via pull or push (or directly into BigQuery/Cloud Storage). Delivery is at-least-once with acknowledgement deadlines, optional ordering keys, dead-letter topics and replay from retained messages.

### What are VPC Service Controls?
Security perimeters around Google-managed services (BigQuery, Cloud Storage) that block data movement across the perimeter even with valid credentials — mitigating data exfiltration risks from stolen credentials or misconfigured IAM.

## Advanced

### How would you design a global, highly available application on GCP?
A global external Application Load Balancer with Cloud Armor and Cloud CDN routing to Cloud Run or GKE in multiple regions, Spanner multi-region (or Cloud SQL with cross-region replicas) for data, Memorystore per region, Pub/Sub for async processing, Secret Manager and per-service accounts, Cloud Monitoring SLOs and alerting, and Terraform-managed environments.

### Explain SRE concepts like SLIs, SLOs and error budgets.
An SLI is a measured indicator of service health (e.g., the proportion of requests under 300 ms). An SLO is the target for that SLI (99.9% over 30 days). The error budget is the allowed unreliability (0.1%). When the budget is exhausted, teams prioritise reliability work over new features; when there's budget left, they can ship faster.

### How do you migrate workloads from AWS or Azure to GCP?
Assess and map services (compute, storage, databases, IAM), choose strategies per workload (rehost with Migrate to Virtual Machines, replatform to Cloud Run/GKE, refactor), migrate data with Database Migration Service and Storage Transfer Service, set up landing zone and networking first, run in parallel with testing, then cut over with DNS and rollback plans.
