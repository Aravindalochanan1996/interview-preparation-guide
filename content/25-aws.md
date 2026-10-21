---
id: aws
title: AWS
short: AWS
category: Cloud Platforms
order: 17.6
color: #ff9900
icon: AWS
summary: Cloud fundamentals, IAM, VPC networking, EC2, S3, databases, serverless (Lambda, API Gateway, DynamoDB), containers (ECS/EKS), messaging, observability, security and the Well-Architected Framework.
---

# Beginner

## Cloud Computing Fundamentals

**Cloud computing** = on-demand IT resources over the internet with **pay-as-you-go** pricing.

### Service models
| Model | You manage | Provider manages | AWS examples |
|---|---|---|---|
| **IaaS** | OS, runtime, apps, data | hardware, virtualisation, network | EC2, EBS, VPC |
| **PaaS** | apps and data | OS, runtime, scaling | Elastic Beanstalk, RDS, App Runner |
| **SaaS** | just use it | everything | WorkMail, QuickSight |
| **FaaS / serverless** | function code | servers, scaling, runtime | Lambda |

### Deployment models
Public cloud, private cloud, **hybrid** (on-prem + cloud: Outposts, Direct Connect), multi-cloud.

### Six advantages of cloud (AWS)
Trade capital expense for variable expense · benefit from massive economies of scale · stop guessing capacity · increase speed and agility · stop spending money running data centres · go global in minutes.

### Shared responsibility model
- **AWS**: security **of** the cloud — physical data centres, hardware, hypervisor, managed service infrastructure.
- **You**: security **in** the cloud — IAM, data encryption, OS patching on EC2, network config (security groups), application security.
The split shifts with the service: with Lambda/S3 AWS manages more; with EC2 you manage the OS.

## Global Infrastructure

- **Region** — a geographic area (e.g., `ap-south-1` Mumbai, `us-east-1` N. Virginia), fully isolated. Choose by latency to users, data residency/compliance, service availability and price.
- **Availability Zone (AZ)** — one or more discrete data centres within a region with independent power/networking, connected by low-latency links. Deploy across **multiple AZs** for high availability.
- **Edge locations / PoPs** — for CloudFront (CDN), Route 53, Global Accelerator.
- **Local Zones, Wavelength, Outposts** — compute closer to users/5G/on-prem.

Global services: IAM, Route 53, CloudFront, WAF (for CloudFront). Most others are regional.

### Accessing AWS
Console (web), **CLI** (`aws s3 ls`), **SDKs** (boto3, AWS SDK for JS/Java/.NET), Infrastructure as Code (**CloudFormation**, **CDK**, Terraform).

## IAM — Identity and Access Management

IAM controls **who** (authentication) can do **what** on **which resources** (authorization).

| Entity | Meaning |
|---|---|
| **Root user** | account owner — lock it away: MFA, no access keys, use only for account-level tasks |
| **User** | a person or legacy app with long-term credentials (prefer federation/SSO instead) |
| **Group** | collection of users sharing permissions |
| **Role** | identity with **temporary credentials** assumed by services (EC2, Lambda), users or other accounts |
| **Policy** | JSON document of permissions |

```json S3 read-only policy for one bucket
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:ListBucket"],
    "Resource": ["arn:aws:s3:::acme-reports", "arn:aws:s3:::acme-reports/*"],
    "Condition": { "IpAddress": { "aws:SourceIp": "203.0.113.0/24" } }
  }]
}
```

### Policy evaluation
1. Default **implicit deny**.
2. An explicit **Allow** grants access…
3. …but any explicit **Deny** always wins (including from SCPs, permission boundaries, resource policies).

### Policy types
Identity-based (attached to users/groups/roles), **resource-based** (bucket policies, KMS key policies), permission boundaries, **Service Control Policies (SCPs)** in AWS Organizations, session policies.

### Best practices
Least privilege · MFA everywhere · roles instead of access keys (EC2 instance profiles, Lambda execution roles, OIDC for CI/CD) · **IAM Identity Center (SSO)** for humans · rotate/remove unused credentials (Access Analyzer, credential report) · tag-based access control (ABAC).

## Compute: EC2 Basics

**EC2** = resizable virtual servers.

- **AMI** — machine image (OS + software). **Instance type** — CPU/memory family: `t` (burstable), `m` (general), `c` (compute), `r` (memory), `g/p` (GPU), `i` (storage); Graviton (`g` suffix, ARM) gives better price/performance.
- **EBS** — network block storage volumes (gp3 general, io2 high IOPS), snapshots to S3; AZ-scoped. **Instance store** — ephemeral, very fast local disk.
- **Security groups** — stateful virtual firewalls at the instance (ENI) level, allow rules only.
- **Key pairs** for SSH; better: **SSM Session Manager** (no open ports, audited).
- **User data** — bootstrap script on first launch.
- **Elastic IP** — static public IPv4.

### Pricing options
| Option | Use case | Savings |
|---|---|---|
| On-Demand | short-term, unpredictable | baseline |
| **Savings Plans / Reserved Instances** | steady usage, 1–3 year commitment | up to ~72% |
| **Spot** | fault-tolerant, flexible (batch, CI, stateless workers) — can be reclaimed with 2-minute notice | up to ~90% |
| Dedicated Hosts/Instances | licensing, compliance | premium |

## Storage: S3 Basics

**S3** = object storage with 11 nines (99.999999999%) durability. Data stored as **objects** (key + data + metadata) in **buckets** (globally unique names, regional).

### Storage classes
Standard → Intelligent-Tiering (automatic) → Standard-IA → One Zone-IA → Glacier Instant Retrieval → Glacier Flexible Retrieval → Glacier Deep Archive (cheapest, hours to retrieve). **Lifecycle policies** transition/expire objects automatically.

### Key features
- **Versioning** (recover from deletes/overwrites), **MFA delete**, **Object Lock** (WORM compliance).
- **Encryption**: SSE-S3 (default), SSE-KMS (audit + key control), SSE-C, client-side.
- **Block Public Access** (on by default), bucket policies, presigned URLs for temporary access.
- **Static website hosting** (usually behind CloudFront), **replication** (CRR/SRR), **event notifications** (to Lambda/SQS/SNS/EventBridge).
- Strong read-after-write consistency.

```bash
aws s3 mb s3://acme-uploads-dev
aws s3 cp report.pdf s3://acme-uploads-dev/reports/
aws s3 presign s3://acme-uploads-dev/reports/report.pdf --expires-in 3600
```

# Intermediate

## Networking: VPC

A **VPC** is your logically isolated network in a region, with a CIDR block (e.g., `10.0.0.0/16`).

```text
VPC 10.0.0.0/16
├── AZ-a: public subnet 10.0.1.0/24  (ALB, NAT Gateway)     route 0.0.0.0/0 → Internet Gateway
│         private subnet 10.0.11.0/24 (app servers, EKS)   route 0.0.0.0/0 → NAT Gateway
│         data subnet 10.0.21.0/24    (RDS)                no internet route
└── AZ-b: same layout for high availability
```

| Component | Purpose |
|---|---|
| **Subnet** | range of IPs in one AZ; public (route to IGW) or private |
| **Internet Gateway** | allows internet access for public subnets |
| **NAT Gateway** | lets private subnets reach the internet outbound only (per AZ for HA; costs per hour + GB) |
| **Route tables** | where traffic goes |
| **Security groups** | stateful, instance-level, allow-only |
| **NACLs** | stateless, subnet-level, allow and deny rules, ordered |
| **VPC endpoints** | private access to AWS services: gateway endpoints (S3, DynamoDB, free) and interface endpoints (PrivateLink) |
| **VPC peering** | connect two VPCs (non-transitive) |
| **Transit Gateway** | hub to connect many VPCs and on-prem networks |
| **Site-to-Site VPN / Direct Connect** | hybrid connectivity (encrypted over internet / dedicated private line) |
| **Flow Logs** | network traffic logs for troubleshooting/security |

### Security group vs NACL
| Security Group | NACL |
|---|---|
| instance/ENI level | subnet level |
| stateful (return traffic automatically allowed) | stateless (allow both directions explicitly) |
| allow rules only | allow and deny |
| all rules evaluated | rules evaluated in number order |

## Load Balancing, Auto Scaling, DNS and CDN

### Elastic Load Balancing
| Type | Layer | Use |
|---|---|---|
| **ALB** (Application) | 7 (HTTP/HTTPS/gRPC) | path/host-based routing, microservices, containers, Lambda targets, WAF |
| **NLB** (Network) | 4 (TCP/UDP/TLS) | extreme performance, static IPs, non-HTTP protocols |
| **GWLB** (Gateway) | 3 | third-party virtual appliances (firewalls) |

Health checks, target groups, TLS termination with **ACM** certificates, cross-zone balancing, connection draining.

### Auto Scaling Groups
Maintain min/desired/max instances across AZs using a **launch template**; scaling policies: **target tracking** (keep CPU at 50%), step, scheduled, predictive. Replace unhealthy instances automatically.

### Route 53
DNS + domain registration + health checks. Routing policies: simple, **weighted** (canary), **latency-based**, **failover** (active-passive DR), **geolocation/geoproximity**, multivalue. **Alias records** point to AWS resources (ALB, CloudFront, S3) at the zone apex.

### CloudFront
Global CDN: caches content at edge locations, TLS, origin shield, signed URLs/cookies, **Origin Access Control** to keep S3 private, Lambda@Edge/CloudFront Functions for edge logic, integrates with WAF and Shield (DDoS protection).

## Databases on AWS

| Need | Service |
|---|---|
| Relational (MySQL, PostgreSQL, SQL Server, Oracle, MariaDB) | **RDS** — managed backups, patching, Multi-AZ, read replicas |
| High-performance cloud-native relational | **Aurora** — MySQL/PostgreSQL compatible, storage auto-scales, 6 copies across 3 AZs, up to 15 replicas, **Aurora Serverless v2**, Global Database |
| Key-value / document at any scale | **DynamoDB** — serverless NoSQL, single-digit ms latency |
| In-memory cache | **ElastiCache** (Redis/Valkey, Memcached), **MemoryDB** (durable Redis) |
| Document (MongoDB-compatible) | DocumentDB |
| Data warehouse / analytics | **Redshift**, Athena (SQL on S3), EMR (Spark), Glue (ETL/catalog) |
| Graph | Neptune |
| Time series | Timestream |
| Search | OpenSearch Service |

### RDS Multi-AZ vs read replicas
- **Multi-AZ** — synchronous standby in another AZ for **high availability**; automatic failover (DNS endpoint stays the same). Not for scaling reads (except Multi-AZ cluster deployments).
- **Read replicas** — asynchronous copies for **read scaling** (and cross-region DR); can be promoted.

### DynamoDB essentials
- Tables with **partition key** (+ optional sort key); design around access patterns (**single-table design**).
- **GSI/LSI** secondary indexes; capacity: **on-demand** or provisioned with auto scaling.
- **DynamoDB Streams** → Lambda for event-driven processing; **TTL**, transactions, **DAX** cache, global tables (multi-region active-active).
- Avoid hot partitions (high-cardinality keys); avoid Scans in production paths.

## Serverless: Lambda, API Gateway and Event-Driven Design

### Lambda
Run code without servers, billed per request and duration (ms) × memory.

```python handler.py
import json, boto3, os
table = boto3.resource("dynamodb").Table(os.environ["TABLE"])   # init outside handler: reused across invocations

def handler(event, context):
    body = json.loads(event["body"])
    table.put_item(Item={"pk": f"ORDER#{body['id']}", "total": body["total"]})
    return {"statusCode": 201, "body": json.dumps({"id": body["id"]})}
```

- Triggers: API Gateway, S3, SQS, SNS, EventBridge, DynamoDB/Kinesis streams, schedules.
- Limits: max **15 min** timeout, memory 128 MB–10 GB (CPU scales with memory), payload limits, concurrency quotas.
- **Cold starts** — new execution environment initialisation latency; mitigate with smaller packages, **provisioned concurrency**, **SnapStart** (Java/Python/.NET), keeping initialisation light, Graviton.
- Execution role for permissions; environment variables + Secrets Manager/Parameter Store for config; layers for shared code; container images up to 10 GB.

### API Gateway
REST APIs (feature-rich), **HTTP APIs** (cheaper, faster), WebSocket APIs. Features: authorizers (Cognito, JWT, Lambda), throttling, usage plans/API keys, request validation, stages, caching.

### Other serverless building blocks
**Step Functions** (workflow orchestration with retries, parallel branches, human approval), **EventBridge** (event bus, schedules, SaaS integrations), **SQS/SNS**, **Cognito** (user sign-up/sign-in, JWT tokens), **AppSync** (managed GraphQL), **Fargate** (serverless containers).

```text
Typical serverless API:
Client → CloudFront → API Gateway (JWT authorizer via Cognito) → Lambda → DynamoDB
                                                   └→ EventBridge → Lambda (emails) / Step Functions (order workflow)
```

## Containers on AWS

| Service | What |
|---|---|
| **ECR** | private container registry (image scanning, lifecycle policies) |
| **ECS** | AWS-native container orchestrator: task definitions, services, clusters |
| **EKS** | managed Kubernetes control plane |
| **Fargate** | serverless compute for ECS/EKS — no nodes to manage |
| **App Runner** | simplest: deploy a container/web app from source or image with auto scaling |
| Elastic Beanstalk | PaaS for traditional apps |

**ECS vs EKS**: ECS is simpler and deeply integrated with AWS (IAM roles per task, ALB, CloudWatch). EKS gives standard Kubernetes portability and ecosystem (Helm, operators) at higher complexity. **Fargate vs EC2 launch type**: Fargate removes node management; EC2 is cheaper at scale and allows GPUs/daemons/custom AMIs. EKS add-ons: AWS Load Balancer Controller, **Karpenter** for node autoscaling, **IRSA / EKS Pod Identity** for pod-level IAM.

# Advanced

## Messaging and Integration

| Service | Pattern | Notes |
|---|---|---|
| **SQS** | queue (point-to-point) | Standard (at-least-once, best-effort order, nearly unlimited throughput) vs **FIFO** (exactly-once processing, ordered per message group); visibility timeout, DLQ, long polling |
| **SNS** | pub/sub fan-out | push to SQS, Lambda, HTTP, email, SMS; message filtering |
| **EventBridge** | event bus with content-based routing rules | schema registry, archive/replay, Pipes, Scheduler, SaaS partners |
| **Kinesis Data Streams** | ordered real-time streaming with shards | replay, multiple consumers; Firehose to load into S3/Redshift |
| **MSK** | managed Kafka | Kafka ecosystem compatibility |
| **Step Functions** | orchestration | saga pattern, retries, long-running workflows |

**SNS + SQS fan-out**: publish once to an SNS topic; multiple SQS queues subscribe, each consumer processes independently — decoupled and durable.

## Security, Compliance and Secrets

- **KMS** — managed encryption keys (customer managed keys, key policies, rotation, envelope encryption); **CloudHSM** for dedicated HSMs.
- **Secrets Manager** (rotation for DB credentials) vs **SSM Parameter Store** (config + SecureString, cheaper).
- **ACM** — free TLS certificates for ALB/CloudFront/API Gateway.
- **WAF** (layer 7 rules: SQLi, XSS, rate limiting, bot control), **Shield** (DDoS; Advanced for 24×7 response), **Firewall Manager**.
- **GuardDuty** (threat detection from logs), **Inspector** (vulnerability scanning of EC2/ECR/Lambda), **Macie** (PII discovery in S3), **Security Hub** (aggregated findings, CIS/AWS Foundational benchmarks), **Detective**, **Config** (resource configuration history and compliance rules), **CloudTrail** (API audit logs — enable org-wide trail).
- **AWS Organizations** + **Control Tower** — multi-account landing zone (separate accounts for prod, dev, security, logging), SCP guardrails, centralised billing.
- Data protection: encryption at rest and in transit, VPC endpoints to avoid the public internet, least-privilege bucket policies, backup with **AWS Backup**.

## Observability and Operations

- **CloudWatch** — metrics (custom and built-in), **Logs** (Logs Insights queries), **alarms** (→ SNS, auto scaling, remediation), dashboards, **Synthetics** canaries, **Container Insights**, Application Signals.
- **X-Ray** / AWS Distro for **OpenTelemetry** — distributed tracing.
- **CloudTrail** — who did what (API calls).
- **Systems Manager** — Session Manager, Patch Manager, Run Command, Parameter Store, Automation runbooks, fleet inventory.
- **Trusted Advisor** — cost, security, fault tolerance, performance, service limit checks.
- **Cost management** — Cost Explorer, Budgets with alerts, Cost Anomaly Detection, **tagging** for cost allocation, Compute Optimizer, Savings Plans; turn off idle dev resources; S3 lifecycle; right-size instances; use Spot and Graviton.

## Well-Architected Framework and Reference Architectures

### Six pillars
1. **Operational Excellence** — IaC, small frequent changes, observability, runbooks, learn from failures.
2. **Security** — strong identity foundation, traceability, security at all layers, encryption, automate security.
3. **Reliability** — multi-AZ, auto recovery, scale horizontally, test recovery, manage change through automation.
4. **Performance Efficiency** — right services (serverless, managed), go global, experiment, mechanical sympathy.
5. **Cost Optimisation** — consumption model, measure efficiency, managed services, right-sizing.
6. **Sustainability** — maximise utilisation, efficient hardware (Graviton), reduce data movement.

### Disaster recovery strategies (RTO/RPO increasing cost →)
| Strategy | Description | RTO/RPO |
|---|---|---|
| Backup & restore | backups in another region; rebuild on disaster | hours |
| Pilot light | core data replicated, minimal infra off/scaled to zero | tens of minutes |
| Warm standby | scaled-down full environment running | minutes |
| Multi-site active/active | full capacity in multiple regions | near zero |

### Classic 3-tier web app architecture
```text
Route 53 → CloudFront (+WAF) → ALB (public subnets, multi-AZ)
        → Auto Scaling Group of EC2 / ECS Fargate tasks (private subnets)
        → Aurora (Multi-AZ, read replicas) + ElastiCache
        S3 for static assets & uploads, Secrets Manager for credentials,
        CloudWatch/X-Ray for observability, IaC via CloudFormation/CDK/Terraform, CI/CD via CodePipeline or GitHub Actions (OIDC)
```

### Certifications path
Cloud Practitioner → Solutions Architect Associate / Developer Associate / SysOps → Solutions Architect Professional / DevOps Engineer Professional → specialities (Security, Networking, ML).

# Interview Questions

## Beginner

### What is the AWS shared responsibility model?
AWS is responsible for security of the cloud — physical infrastructure, hardware, networking and the virtualisation layer. Customers are responsible for security in the cloud — IAM, data, encryption, OS patching on EC2, network configuration and application security. The split varies by service type (IaaS vs managed vs serverless).

### Region vs Availability Zone?
A region is a separate geographic area containing multiple isolated Availability Zones. An AZ is one or more data centres with independent power and networking. Deploying across multiple AZs protects against data-centre failures; multiple regions protect against regional outages and serve global users.

### What is IAM? User vs role?
IAM manages authentication and authorization for AWS. A user has long-term credentials for a person or application. A role has no long-term credentials — it's assumed to obtain temporary credentials, used by AWS services (EC2, Lambda), federated users and cross-account access. Roles are preferred.

### What is S3 and what are its storage classes?
Highly durable object storage organised in buckets. Classes include Standard, Intelligent-Tiering, Standard-IA, One Zone-IA, and Glacier Instant, Flexible and Deep Archive — trading lower storage cost for retrieval cost and latency. Lifecycle rules move objects automatically.

### EC2 pricing models?
On-Demand (pay per second, no commitment), Savings Plans/Reserved Instances (1–3 year commitment for large discounts), Spot (spare capacity at up to ~90% off but can be interrupted) and Dedicated Hosts (physical servers for licensing/compliance).

### Security group vs NACL?
Security groups are stateful firewalls attached to instances/ENIs with allow-only rules. NACLs are stateless firewalls at the subnet level with ordered allow and deny rules, requiring explicit rules for return traffic.

## Intermediate

### Explain public and private subnets and NAT Gateway.
A public subnet has a route to an Internet Gateway, so resources with public IPs are reachable. A private subnet has no direct internet route; a NAT Gateway in a public subnet lets private resources initiate outbound connections (updates, APIs) without accepting inbound internet traffic.

### ALB vs NLB?
ALB operates at layer 7 with HTTP-aware routing (paths, hosts, headers), WAF integration and Lambda targets — ideal for web apps and microservices. NLB operates at layer 4, handles millions of requests with ultra-low latency, supports static IPs and TCP/UDP — ideal for non-HTTP or extreme performance workloads.

### RDS Multi-AZ vs read replicas?
Multi-AZ maintains a synchronous standby in another AZ for high availability and automatic failover. Read replicas are asynchronous copies used to scale reads and for cross-region disaster recovery; they can be promoted manually.

### SQS vs SNS vs EventBridge?
SQS is a queue — consumers pull messages for decoupled, buffered processing. SNS is push-based pub/sub fan-out to many subscribers. EventBridge is an event bus with content-based rules, schema registry, archive/replay and SaaS integrations — best for event-driven architectures across services.

### What is a Lambda cold start and how do you reduce it?
The latency when Lambda creates a new execution environment (download code, start runtime, run initialisation). Reduce it with smaller packages and dependencies, lighter initialisation, provisioned concurrency, SnapStart, choosing faster runtimes and keeping functions warm with steady traffic.

### How do you secure credentials for applications on AWS?
Use IAM roles for compute (instance profiles, task roles, Lambda execution roles, Pod Identity) instead of access keys; store secrets in Secrets Manager or Parameter Store with KMS encryption and rotation; use OIDC federation for CI/CD; never commit keys to code.

### ECS vs EKS vs Fargate?
ECS is AWS's simpler native container orchestrator. EKS is managed Kubernetes for portability and its ecosystem. Fargate is a serverless compute engine for either, removing node management; EC2-backed clusters are cheaper at steady scale and allow more customisation.

## Advanced

### Design a highly available, scalable web application on AWS.
Route 53 and CloudFront with WAF in front of an ALB across at least two AZs; stateless app tier on an Auto Scaling Group or ECS Fargate in private subnets; Aurora Multi-AZ with read replicas and ElastiCache for hot data; S3 for static and user content; Secrets Manager, KMS and least-privilege roles; CloudWatch, X-Ray and alarms; IaC and CI/CD; backups and a DR strategy in a second region according to RTO/RPO.

### How would you reduce AWS costs?
Right-size using Compute Optimizer, use Savings Plans for steady usage and Spot for interruptible workloads, adopt Graviton, auto-scale and schedule non-production shutdowns, use S3 lifecycle and Intelligent-Tiering, reduce NAT and data transfer costs (VPC endpoints, CloudFront), use serverless for spiky workloads, delete idle resources, and enforce tagging with Budgets and anomaly detection.

### Explain DR strategies on AWS.
Backup and restore (cheapest, hours of RTO), pilot light (data replicated, core infrastructure minimal), warm standby (scaled-down copy running, minutes), and multi-site active-active (full capacity in multiple regions, near-zero RTO/RPO). Choose based on business RTO/RPO and cost, and test failover regularly.

### How do you design a multi-account AWS setup?
Use AWS Organizations with Control Tower to create a landing zone: separate accounts for security, log archive, shared services, and per-environment/workload accounts; SCP guardrails; IAM Identity Center for SSO; centralised CloudTrail, Config, GuardDuty and Security Hub; networking via Transit Gateway; consolidated billing and tagging policies.

### How would you design a serverless order-processing system?
API Gateway with a Cognito JWT authorizer invokes a Lambda that validates and writes orders to DynamoDB with idempotency keys, then publishes an event to EventBridge. A Step Functions workflow orchestrates payment, inventory and shipping with retries and compensation; SQS with DLQs buffers downstream calls; notifications via SNS/SES; observability with CloudWatch and X-Ray.

### DynamoDB — how do you design the data model?
Start from access patterns, choose partition keys with high cardinality to spread load, use sort keys for hierarchical queries and ranges, use GSIs for alternate access patterns, consider single-table design to fetch related items in one query, avoid scans, and use TTL, streams and transactions where appropriate.
