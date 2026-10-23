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

```bash Same goal at three service-model levels
# IaaS: you manage the OS
aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.small --key-name me
# PaaS: you manage the app
eb init -p node.js my-app && eb create prod
# Serverless/FaaS: you manage only the function code
aws lambda create-function --function-name hello --runtime nodejs20.x --handler index.handler \
  --role arn:aws:iam::123456789012:role/lambda-basic --zip-file fileb://fn.zip
```

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

```bash
aws ec2 describe-regions --query 'Regions[].RegionName' --output text
aws ec2 describe-availability-zones --region ap-south-1 --query 'AvailabilityZones[].ZoneName'
# ap-south-1a  ap-south-1b  ap-south-1c
aws cloudfront list-distributions --query 'DistributionList.Items[].DomainName'   # edge locations via CloudFront
```

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

```bash
aws ec2 run-instances \
  --image-id ami-0abc123 --instance-type m7g.large \
  --subnet-id subnet-0a1b --security-group-ids sg-0web \
  --iam-instance-profile Name=web-role \
  --user-data file://bootstrap.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-1}]'
```
```bash bootstrap.sh (user data)
#!/bin/bash
dnf install -y nginx && systemctl enable --now nginx
```

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

```hcl Terraform: ALB + Auto Scaling Group
resource "aws_lb" "web" {
  name               = "web"
  load_balancer_type = "application"
  subnets            = var.public_subnets
  security_groups    = [aws_security_group.alb.id]
}
resource "aws_autoscaling_group" "web" {
  min_size            = 2
  max_size            = 10
  vpc_zone_identifier = var.private_subnets
  target_group_arns   = [aws_lb_target_group.web.arn]
  launch_template {
    id = aws_launch_template.web.id
    version = "$Latest"
  }
}
resource "aws_autoscaling_policy" "cpu" {
  autoscaling_group_name = aws_autoscaling_group.web.name
  policy_type            = "TargetTrackingScaling"
  target_tracking_configuration {
    predefined_metric_specification { predefined_metric_type = "ASGAverageCPUUtilization" }
    target_value = 60
  }
}
```

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

```bash
aws rds create-db-instance --db-instance-identifier orders --engine postgres --engine-version 16.4 \
  --db-instance-class db.r7g.large --allocated-storage 100 --multi-az \
  --master-username app --manage-master-user-password --storage-encrypted
aws rds create-db-instance-read-replica --db-instance-identifier orders-ro --source-db-instance-identifier orders
aws dynamodb create-table --table-name Sessions --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=pk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH
```

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

```json ECS Fargate task definition (excerpt)
{
  "family": "api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512", "memory": "1024",
  "taskRoleArn": "arn:aws:iam::123456789012:role/api-task",
  "containerDefinitions": [{
    "name": "api",
    "image": "123456789012.dkr.ecr.eu-west-1.amazonaws.com/api:1.4.0",
    "portMappings": [{ "containerPort": 8080 }],
    "secrets": [{ "name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:db" }],
    "logConfiguration": { "logDriver": "awslogs", "options": { "awslogs-group": "/ecs/api", "awslogs-region": "eu-west-1", "awslogs-stream-prefix": "api" } }
  }]
}
```

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

```python SQS consumer with long polling and safe deletes
import boto3
sqs = boto3.client("sqs")
while True:
    resp = sqs.receive_message(QueueUrl=Q, MaxNumberOfMessages=10, WaitTimeSeconds=20, VisibilityTimeout=60)
    for m in resp.get("Messages", []):
        try:
            process(m["Body"])                                     # must be idempotent (at-least-once)
            sqs.delete_message(QueueUrl=Q, ReceiptHandle=m["ReceiptHandle"])
        except Exception:
            pass   # becomes visible again; after maxReceiveCount it goes to the DLQ
```

## Security, Compliance and Secrets

- **KMS** — managed encryption keys (customer managed keys, key policies, rotation, envelope encryption); **CloudHSM** for dedicated HSMs.
- **Secrets Manager** (rotation for DB credentials) vs **SSM Parameter Store** (config + SecureString, cheaper).
- **ACM** — free TLS certificates for ALB/CloudFront/API Gateway.
- **WAF** (layer 7 rules: SQLi, XSS, rate limiting, bot control), **Shield** (DDoS; Advanced for 24×7 response), **Firewall Manager**.
- **GuardDuty** (threat detection from logs), **Inspector** (vulnerability scanning of EC2/ECR/Lambda), **Macie** (PII discovery in S3), **Security Hub** (aggregated findings, CIS/AWS Foundational benchmarks), **Detective**, **Config** (resource configuration history and compliance rules), **CloudTrail** (API audit logs — enable org-wide trail).
- **AWS Organizations** + **Control Tower** — multi-account landing zone (separate accounts for prod, dev, security, logging), SCP guardrails, centralised billing.
- Data protection: encryption at rest and in transit, VPC endpoints to avoid the public internet, least-privilege bucket policies, backup with **AWS Backup**.

```python
import boto3, json
secret = json.loads(boto3.client("secretsmanager").get_secret_value(SecretId="prod/orders/db")["SecretString"])
param = boto3.client("ssm").get_parameter(Name="/orders/feature-x", WithDecryption=True)["Parameter"]["Value"]
kms = boto3.client("kms")
blob = kms.encrypt(KeyId="alias/orders", Plaintext=b"card-token")["CiphertextBlob"]
```
```bash
aws guardduty create-detector --enable
aws securityhub enable-security-hub --enable-default-standards
```

## Observability and Operations

- **CloudWatch** — metrics (custom and built-in), **Logs** (Logs Insights queries), **alarms** (→ SNS, auto scaling, remediation), dashboards, **Synthetics** canaries, **Container Insights**, Application Signals.
- **X-Ray** / AWS Distro for **OpenTelemetry** — distributed tracing.
- **CloudTrail** — who did what (API calls).
- **Systems Manager** — Session Manager, Patch Manager, Run Command, Parameter Store, Automation runbooks, fleet inventory.
- **Trusted Advisor** — cost, security, fault tolerance, performance, service limit checks.
- **Cost management** — Cost Explorer, Budgets with alerts, Cost Anomaly Detection, **tagging** for cost allocation, Compute Optimizer, Savings Plans; turn off idle dev resources; S3 lifecycle; right-size instances; use Spot and Graviton.

```text CloudWatch Logs Insights
fields @timestamp, @message
| filter level = "ERROR"
| stats count(*) as errors by bin(5m), service
| sort errors desc
```
```bash
aws cloudwatch put-metric-alarm --alarm-name api-5xx --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count --dimensions Name=LoadBalancer,Value=app/web/abc123 \
  --statistic Sum --period 60 --evaluation-periods 5 --threshold 20 --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:eu-west-1:123456789012:oncall
```

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

```bash Your side of the model, in practice
aws s3api put-public-access-block --bucket my-data \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket my-data \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
aws ec2 modify-instance-metadata-options --instance-id i-0abc --http-tokens required   # IMDSv2
```

### Region vs Availability Zone?
A region is a separate geographic area containing multiple isolated Availability Zones. An AZ is one or more data centres with independent power and networking. Deploying across multiple AZs protects against data-centre failures; multiple regions protect against regional outages and serve global users.

```hcl Spread subnets across AZs in one region
data "aws_availability_zones" "available" { state = "available" }
resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  availability_zone = data.aws_availability_zones.available.names[count.index]
  cidr_block        = cidrsubnet("10.0.0.0/16", 8, count.index)
}
```

### What is IAM? User vs role?
IAM manages authentication and authorization for AWS. A user has long-term credentials for a person or application. A role has no long-term credentials — it's assumed to obtain temporary credentials, used by AWS services (EC2, Lambda), federated users and cross-account access. Roles are preferred.

```json Trust policy: who may assume the role
{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" }, "Action": "sts:AssumeRole" }]
}
```
```bash
aws sts assume-role --role-arn arn:aws:iam::123456789012:role/deploy --role-session-name ci   # temporary creds
aws sts get-caller-identity
```

### What is S3 and what are its storage classes?
Highly durable object storage organised in buckets. Classes include Standard, Intelligent-Tiering, Standard-IA, One Zone-IA, and Glacier Instant, Flexible and Deep Archive — trading lower storage cost for retrieval cost and latency. Lifecycle rules move objects automatically.

```json Lifecycle rule
{
  "Rules": [{
    "ID": "logs-tiering", "Status": "Enabled", "Filter": { "Prefix": "logs/" },
    "Transitions": [
      { "Days": 30,  "StorageClass": "STANDARD_IA" },
      { "Days": 90,  "StorageClass": "GLACIER_IR" },
      { "Days": 365, "StorageClass": "DEEP_ARCHIVE" }
    ],
    "Expiration": { "Days": 2555 }
  }]
}
```
```bash
aws s3 cp report.pdf s3://acme-docs/2026/ --storage-class INTELLIGENT_TIERING
aws s3api put-bucket-lifecycle-configuration --bucket acme-logs --lifecycle-configuration file://lifecycle.json
```

### EC2 pricing models?
On-Demand (pay per second, no commitment), Savings Plans/Reserved Instances (1–3 year commitment for large discounts), Spot (spare capacity at up to ~90% off but can be interrupted) and Dedicated Hosts (physical servers for licensing/compliance).

```bash
aws ec2 run-instances --image-id ami-0abc --instance-type c7g.xlarge \
  --instance-market-options 'MarketType=spot,SpotOptions={SpotInstanceType=one-time}'   # up to ~90% off
aws savingsplans describe-savings-plans-offering-rates --savings-plan-types Compute --max-results 5
aws ce get-savings-plans-purchase-recommendation --savings-plans-type COMPUTE_SP --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT --lookback-period-in-days THIRTY_DAYS
```

### Security group vs NACL?
Security groups are stateful firewalls attached to instances/ENIs with allow-only rules. NACLs are stateless firewalls at the subnet level with ordered allow and deny rules, requiring explicit rules for return traffic.

```hcl
resource "aws_security_group_rule" "https_in" {        # stateful: replies allowed automatically
  type = "ingress"
  from_port = 443
  to_port = 443
  protocol = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
}
resource "aws_network_acl_rule" "ephemeral_out" {      # stateless: allow return traffic explicitly
  network_acl_id = aws_network_acl.public.id
  rule_number = 120
  egress = true
  protocol = "tcp"
  rule_action = "allow"
  cidr_block = "0.0.0.0/0"
  from_port = 1024
  to_port = 65535
}
```

## Intermediate

### Explain public and private subnets and NAT Gateway.
A public subnet has a route to an Internet Gateway, so resources with public IPs are reachable. A private subnet has no direct internet route; a NAT Gateway in a public subnet lets private resources initiate outbound connections (updates, APIs) without accepting inbound internet traffic.

```hcl
resource "aws_route" "public_internet" {
  route_table_id = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id = aws_internet_gateway.igw.id          # public subnet
}
resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
}
resource "aws_route" "private_egress" {
  route_table_id = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id = aws_nat_gateway.nat.id           # private subnet: outbound only
}
```

### ALB vs NLB?
ALB operates at layer 7 with HTTP-aware routing (paths, hosts, headers), WAF integration and Lambda targets — ideal for web apps and microservices. NLB operates at layer 4, handles millions of requests with ultra-low latency, supports static IPs and TCP/UDP — ideal for non-HTTP or extreme performance workloads.

```hcl
resource "aws_lb_listener_rule" "api" {             # ALB: layer-7 path routing
  listener_arn = aws_lb_listener.https.arn
  condition { path_pattern { values = ["/api/*"] } }
  action {
    type = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
resource "aws_lb" "mqtt" {                          # NLB: TCP, static IPs
  load_balancer_type = "network"
  subnet_mapping {
    subnet_id = var.subnet_a
    allocation_id = aws_eip.a.id
  }
}
```

### RDS Multi-AZ vs read replicas?
Multi-AZ maintains a synchronous standby in another AZ for high availability and automatic failover. Read replicas are asynchronous copies used to scale reads and for cross-region disaster recovery; they can be promoted manually.

```bash
aws rds modify-db-instance --db-instance-identifier orders --multi-az --apply-immediately   # HA standby
aws rds create-db-instance-read-replica --db-instance-identifier orders-read-1 \
  --source-db-instance-identifier orders --db-instance-class db.r7g.large                  # read scaling
aws rds reboot-db-instance --db-instance-identifier orders --force-failover                # test failover
```

### SQS vs SNS vs EventBridge?
SQS is a queue — consumers pull messages for decoupled, buffered processing. SNS is push-based pub/sub fan-out to many subscribers. EventBridge is an event bus with content-based rules, schema registry, archive/replay and SaaS integrations — best for event-driven architectures across services.

```bash
aws sqs send-message --queue-url $Q --message-body '{"orderId":42}'                  # queue: one consumer group
aws sns publish --topic-arn $TOPIC --message '{"orderId":42}'                         # fan-out to subscribers
aws events put-events --entries '[{"Source":"shop.orders","DetailType":"OrderPlaced","Detail":"{\"orderId\":42,\"total\":120}"}]'
```
```json EventBridge rule pattern: route only big orders
{ "source": ["shop.orders"], "detail-type": ["OrderPlaced"], "detail": { "total": [{ "numeric": [">", 100] }] } }
```

### What is a Lambda cold start and how do you reduce it?
The latency when Lambda creates a new execution environment (download code, start runtime, run initialisation). Reduce it with smaller packages and dependencies, lighter initialisation, provisioned concurrency, SnapStart, choosing faster runtimes and keeping functions warm with steady traffic.

```js
// Initialise once, outside the handler — reused on warm invocations
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
const ddb = new DynamoDBClient({});

export const handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify(await getItem(ddb, event.pathParameters.id)) };
};
```
```bash
aws lambda put-provisioned-concurrency-config --function-name api --qualifier live --provisioned-concurrent-executions 5
aws lambda update-function-configuration --function-name java-api --snap-start ApplyOn=PublishedVersions
```

### How do you secure credentials for applications on AWS?
Use IAM roles for compute (instance profiles, task roles, Lambda execution roles, Pod Identity) instead of access keys; store secrets in Secrets Manager or Parameter Store with KMS encryption and rotation; use OIDC federation for CI/CD; never commit keys to code.

```python
# ✅ No keys in code: the SDK picks up the instance/task/Lambda role automatically
import boto3
s3 = boto3.client("s3")
db_pass = boto3.client("secretsmanager").get_secret_value(SecretId="prod/db")["SecretString"]
# ❌ boto3.client("s3", aws_access_key_id="AKIA…", aws_secret_access_key="…")
```

### ECS vs EKS vs Fargate?
ECS is AWS's simpler native container orchestrator. EKS is managed Kubernetes for portability and its ecosystem. Fargate is a serverless compute engine for either, removing node management; EC2-backed clusters are cheaper at steady scale and allow more customisation.

```bash
aws ecs create-service --cluster prod --service-name api --task-definition api:12 \
  --desired-count 3 --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-a,subnet-b],securityGroups=[sg-api]}'
eksctl create cluster --name prod --region eu-west-1 --fargate      # EKS with Fargate profiles
kubectl apply -f deployment.yaml
```

## Advanced

### Design a highly available, scalable web application on AWS.
Route 53 and CloudFront with WAF in front of an ALB across at least two AZs; stateless app tier on an Auto Scaling Group or ECS Fargate in private subnets; Aurora Multi-AZ with read replicas and ElastiCache for hot data; S3 for static and user content; Secrets Manager, KMS and least-privilege roles; CloudWatch, X-Ray and alarms; IaC and CI/CD; backups and a DR strategy in a second region according to RTO/RPO.

```text
Route 53 ─▶ CloudFront + WAF ─▶ ALB (AZ-a, AZ-b, AZ-c)
                                   │
                        ECS Fargate service (private subnets, autoscaling)
                           │                 │
               ElastiCache Redis       Aurora PostgreSQL (writer + 2 readers, Multi-AZ)
                           │
                    SQS ─▶ worker service ─▶ S3 (assets, exports)
```

### How would you reduce AWS costs?
Right-size using Compute Optimizer, use Savings Plans for steady usage and Spot for interruptible workloads, adopt Graviton, auto-scale and schedule non-production shutdowns, use S3 lifecycle and Intelligent-Tiering, reduce NAT and data transfer costs (VPC endpoints, CloudFront), use serverless for spiky workloads, delete idle resources, and enforce tagging with Budgets and anomaly detection.

```bash
aws ce get-cost-and-usage --time-period Start=2026-09-01,End=2026-10-01 --granularity MONTHLY \
  --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE
aws compute-optimizer get-ec2-instance-recommendations --query 'instanceRecommendations[].{id:instanceArn,finding:finding}'
aws ec2 describe-volumes --filters Name=status,Values=available --query 'Volumes[].[VolumeId,Size]'   # unattached EBS
```
```hcl Gateway endpoint: S3 traffic skips the NAT Gateway (no per-GB NAT charge)
resource "aws_vpc_endpoint" "s3" {
  vpc_id = aws_vpc.main.id
  service_name = "com.amazonaws.eu-west-1.s3"
  route_table_ids = [aws_route_table.private.id]
}
```

### Explain DR strategies on AWS.
Backup and restore (cheapest, hours of RTO), pilot light (data replicated, core infrastructure minimal), warm standby (scaled-down copy running, minutes), and multi-site active-active (full capacity in multiple regions, near-zero RTO/RPO). Choose based on business RTO/RPO and cost, and test failover regularly.

```bash Pilot light / warm standby building blocks
aws rds create-db-instance-read-replica --db-instance-identifier orders-dr \
  --source-db-instance-identifier arn:aws:rds:eu-west-1:123456789012:db:orders --region eu-central-1
aws s3api put-bucket-replication --bucket acme-assets --replication-configuration file://crr.json
aws backup start-copy-job --recovery-point-arn $RP --source-backup-vault-name main \
  --destination-backup-vault-arn arn:aws:backup:eu-central-1:123456789012:backup-vault:dr --iam-role-arn $ROLE
```

### How do you design a multi-account AWS setup?
Use AWS Organizations with Control Tower to create a landing zone: separate accounts for security, log archive, shared services, and per-environment/workload accounts; SCP guardrails; IAM Identity Center for SSO; centralised CloudTrail, Config, GuardDuty and Security Hub; networking via Transit Gateway; consolidated billing and tagging policies.

```json SCP: deny leaving approved regions and disabling CloudTrail
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Deny", "Action": "*", "Resource": "*",
      "Condition": { "StringNotEquals": { "aws:RequestedRegion": ["eu-west-1", "eu-central-1"] } } },
    { "Effect": "Deny", "Action": ["cloudtrail:StopLogging", "cloudtrail:DeleteTrail"], "Resource": "*" }
  ]
}
```
```text
Root ─ Security OU (audit, log-archive) ─ Infrastructure OU (network, shared-services)
     ─ Workloads OU ─ prod OU (shop-prod) ─ non-prod OU (shop-dev, shop-staging) ─ Sandbox OU
```

### How would you design a serverless order-processing system?
API Gateway with a Cognito JWT authorizer invokes a Lambda that validates and writes orders to DynamoDB with idempotency keys, then publishes an event to EventBridge. A Step Functions workflow orchestrates payment, inventory and shipping with retries and compensation; SQS with DLQs buffers downstream calls; notifications via SNS/SES; observability with CloudWatch and X-Ray.

```yaml SAM template (excerpt)
Resources:
  PlaceOrderFn:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: nodejs20.x
      Handler: placeOrder.handler
      Events: { Api: { Type: HttpApi, Properties: { Path: /orders, Method: post } } }
      Policies: [{ DynamoDBCrudPolicy: { TableName: !Ref Orders } }, { EventBridgePutEventsPolicy: { EventBusName: default } }]
  Orders:
    Type: AWS::DynamoDB::Table
    Properties:
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions: [{ AttributeName: pk, AttributeType: S }]
      KeySchema: [{ AttributeName: pk, KeyType: HASH }]
```
```js placeOrder.js — idempotent write
await ddb.send(new PutItemCommand({ TableName: 'Orders', Item: marshall(order),
  ConditionExpression: 'attribute_not_exists(pk)' }));   // retry with the same key → no duplicate
```

### DynamoDB — how do you design the data model?
Start from access patterns, choose partition keys with high cardinality to spread load, use sort keys for hierarchical queries and ranges, use GSIs for alternate access patterns, consider single-table design to fetch related items in one query, avoid scans, and use TTL, streams and transactions where appropriate.

```text Single-table design
pk              sk                    attributes
CUSTOMER#42     PROFILE               name, email
CUSTOMER#42     ORDER#2026-10-23#901  total, status      ← "orders of customer, newest first"
ORDER#901       ITEM#1                sku, qty
GSI1: gsi1pk = STATUS#SHIPPED, gsi1sk = 2026-10-23     ← "shipped orders by date"
```
```js
await ddb.send(new QueryCommand({
  TableName: 'Shop', KeyConditionExpression: 'pk = :c AND begins_with(sk, :o)',
  ExpressionAttributeValues: { ':c': { S: 'CUSTOMER#42' }, ':o': { S: 'ORDER#' } }, ScanIndexForward: false, Limit: 10,
}));
```

# Scenario Questions

## Beginner

### Your EC2 instance's web server is running, but you can't reach it from the browser. What do you check?
- The **security group** allows inbound 80/443 from your IP or `0.0.0.0/0`.
- The instance is in a **public subnet** whose route table points to an Internet Gateway, and it has a public IP or Elastic IP.
- Network ACLs allow the traffic in **and** out (they're stateless, so return ephemeral ports must be open).
- The OS firewall is open, and the app listens on `0.0.0.0`.

```bash
aws ec2 describe-instances --instance-ids i-0abc --query 'Reservations[].Instances[].[PublicIpAddress,SubnetId,SecurityGroups]'
aws ec2 describe-security-groups --group-ids sg-0web --query 'SecurityGroups[].IpPermissions'
aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=subnet-0a1b   # 0.0.0.0/0 → igw-?
# on the instance
sudo ss -tlnp | grep ':80'        # bound to 0.0.0.0, not 127.0.0.1?
sudo firewall-cmd --list-all
```

### You got a surprise $3,000 AWS bill. How do you find the cause and prevent it next time?
Use **Cost Explorer**, grouped by service, region and usage type, to find it. Typical culprits: NAT Gateway data processing, idle large instances, unattached EBS volumes or old snapshots, data transfer, or a leaked access key mining crypto. Prevent it with **AWS Budgets** alerts, Cost Anomaly Detection, tagging policies, and lifecycle rules.

```bash
aws ce get-cost-and-usage --time-period Start=2026-10-01,End=2026-10-23 --granularity DAILY \
  --metrics UnblendedCost --group-by Type=DIMENSION,Key=USAGE_TYPE
aws budgets create-budget --account-id 123456789012 \
  --budget '{"BudgetName":"monthly","BudgetLimit":{"Amount":"500","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \
  --notifications-with-subscribers '[{"Notification":{"NotificationType":"FORECASTED","ComparisonOperator":"GREATER_THAN","Threshold":80},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"ops@example.com"}]}]'
```

## Intermediate

### A Lambda function times out when calling an RDS database in a VPC. What's going on?
- The Lambda's security group isn't allowed by the RDS security group.
- The Lambda is in a VPC subnet with no route to the internet, so calls to other AWS APIs hang (add a NAT gateway or VPC endpoints).
- Too many concurrent Lambdas exhaust DB connections. Use **RDS Proxy**, and reuse connections outside the handler.

```hcl
resource "aws_security_group_rule" "rds_from_lambda" {
  type = "ingress"
  from_port = 5432
  to_port = 5432
  protocol = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.lambda.id
}
resource "aws_vpc_endpoint" "secrets" {               # reach Secrets Manager without a NAT
  vpc_id = aws_vpc.main.id
  service_name = "com.amazonaws.eu-west-1.secretsmanager"
  vpc_endpoint_type = "Interface"
  private_dns_enabled = true
  subnet_ids = var.private_subnets
  security_group_ids = [aws_security_group.endpoints.id]
}
```

### You need to let an app running on EC2 read one S3 bucket. How do you grant access?
Attach an **IAM role** (instance profile) whose policy allows `s3:GetObject` on `arn:aws:s3:::bucket/*` and `s3:ListBucket` on the bucket. Never put access keys on the instance. The SDK picks up temporary credentials automatically. Add a bucket policy or VPC endpoint condition if you need tighter control.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::acme-reports" },
    { "Effect": "Allow", "Action": "s3:GetObject",  "Resource": "arn:aws:s3:::acme-reports/*" }
  ]
}
```
```bash
aws iam create-instance-profile --instance-profile-name reports-reader
aws iam add-role-to-instance-profile --instance-profile-name reports-reader --role-name reports-reader
aws ec2 associate-iam-instance-profile --instance-id i-0abc --iam-instance-profile Name=reports-reader
```

## Advanced

### Design a highly available web app on AWS that survives an Availability Zone failure.
- An **ALB** across at least 2 AZs, in front of an **Auto Scaling Group** (or ECS/EKS) spread across those AZs.
- **RDS Multi-AZ** (or Aurora with replicas).
- ElastiCache with replication.
- S3 and CloudFront for static assets.
- Route 53 health checks, and stateless app servers (sessions in Redis or DynamoDB).
- For regional disaster recovery: cross-region replication and a pilot-light or warm-standby setup.

```hcl
resource "aws_autoscaling_group" "app" {
  min_size = 3
  max_size = 12
  vpc_zone_identifier = [aws_subnet.private_a.id, aws_subnet.private_b.id, aws_subnet.private_c.id]
  health_check_type   = "ELB"
}
resource "aws_rds_cluster" "db" {
  engine = "aurora-postgresql"
  availability_zones = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
}
resource "aws_elasticache_replication_group" "cache" {
  replication_group_id = "cache"
  num_cache_clusters = 2
  automatic_failover_enabled = true
  multi_az_enabled = true
}
```

# Tricky Questions

## Intermediate

### An IAM policy allows `s3:*`, but a bucket policy has an explicit `Deny`. Can the user read the bucket?
**No.** In AWS policy evaluation an **explicit Deny always wins** over any Allow, whether from identity policies, resource policies, permission boundaries or SCPs. Without any Allow the default is implicit deny.

```json Bucket policy — explicit Deny beats the user's Allow
{
  "Statement": [{
    "Effect": "Deny", "Principal": "*", "Action": "s3:*",
    "Resource": ["arn:aws:s3:::payroll", "arn:aws:s3:::payroll/*"],
    "Condition": { "StringNotEquals": { "aws:PrincipalTag/team": "finance" } }
  }]
}
```
```bash
aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:user/ada \
  --action-names s3:GetObject --resource-arns arn:aws:s3:::payroll/jan.csv
```

### Is S3 eventually consistent? Can you read a file right after writing it?
Since December 2020, S3 gives **strong read-after-write consistency** for PUTs and DELETEs of objects, plus list consistency. Old interview answers about eventual consistency are out of date. Cross-region replication is still asynchronous.

```python
s3.put_object(Bucket="b", Key="k", Body=b"v2")
s3.get_object(Bucket="b", Key="k")["Body"].read()   # b"v2" — strong read-after-write since Dec 2020
s3.list_objects_v2(Bucket="b", Prefix="k")          # list is consistent too
```

### Do security groups or NACLs need rules for return traffic?
**Security groups are stateful**: return traffic for an allowed connection is allowed automatically. **NACLs are stateless**: you must allow both directions, including ephemeral ports 1024–65535 for responses.

```bash
# SG: one inbound rule is enough
aws ec2 authorize-security-group-ingress --group-id sg-web --protocol tcp --port 443 --cidr 0.0.0.0/0
# NACL: inbound 443 AND outbound ephemeral ports for the replies
aws ec2 create-network-acl-entry --network-acl-id acl-1 --ingress --rule-number 100 --protocol tcp --port-range From=443,To=443 --cidr-block 0.0.0.0/0 --rule-action allow
aws ec2 create-network-acl-entry --network-acl-id acl-1 --egress --rule-number 100 --protocol tcp --port-range From=1024,To=65535 --cidr-block 0.0.0.0/0 --rule-action allow
```
