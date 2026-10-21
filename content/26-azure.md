---
id: azure
title: Microsoft Azure
short: Azure
category: Cloud Platforms
order: 17.7
color: #0078d4
icon: Az
summary: Azure fundamentals, Entra ID & RBAC, networking, VMs, App Service, Functions, AKS, storage, databases, messaging, DevOps pipelines, monitoring, security and the Well-Architected Framework.
---

# Beginner

## Azure Fundamentals and Resource Hierarchy

Microsoft Azure is a public cloud with 60+ regions offering IaaS, PaaS, serverless and SaaS-integrated services, strongly integrated with Microsoft 365, Entra ID and enterprise Windows/.NET workloads.

### Resource hierarchy
```text
Management groups (policy & RBAC inheritance across subscriptions)
└── Subscriptions (billing and access boundary)
    └── Resource groups (lifecycle container for related resources)
        └── Resources (VMs, storage accounts, databases …)
```
- A **resource group** holds resources that share a lifecycle (deploy/delete together). A resource belongs to exactly one RG; RGs can contain resources from multiple regions.
- **Tags** for cost allocation and organisation; **locks** (`CanNotDelete`, `ReadOnly`) prevent accidental changes.

### Regions and availability
- **Region pairs** (e.g., Central India ↔ South India) for DR and sequential platform updates.
- **Availability Zones** — physically separate data centres in a region; use **zone-redundant** services.
- **Availability sets** — fault and update domains within a data centre (older VM HA option).
- SLAs: single VM with premium SSD 99.9%, availability set 99.95%, across zones 99.99%.

### Tools
Azure **Portal**, **Azure CLI** (`az`), **Azure PowerShell** (`Az` module), **Cloud Shell**, SDKs, **ARM templates**, **Bicep**, Terraform, Azure Developer CLI (`azd`).

```bash
az login
az group create -n rg-shop-dev -l centralindia
az webapp up -n shop-api-dev -g rg-shop-dev --runtime "PYTHON:3.12"
az resource list -g rg-shop-dev -o table
```

## Identity: Microsoft Entra ID and Azure RBAC

**Microsoft Entra ID** (formerly Azure Active Directory) is the cloud identity provider: users, groups, apps, SSO, MFA, Conditional Access.

### Two different permission systems
| | Entra ID roles | Azure RBAC roles |
|---|---|---|
| Controls | the directory (users, groups, app registrations) | Azure **resources** (VMs, storage, subscriptions) |
| Examples | Global Administrator, User Administrator | **Owner**, **Contributor**, **Reader**, User Access Administrator, Storage Blob Data Reader |

### Azure RBAC
Role assignment = **security principal** (user/group/service principal/managed identity) + **role definition** (permissions) + **scope** (management group → subscription → resource group → resource). Permissions inherit downward. Custom roles possible. Deny assignments exist (via Blueprints/managed apps).

### Identities for applications
- **App registration / service principal** — identity for an app, with secrets or certificates (or **workload identity federation** for GitHub Actions/Kubernetes — no secrets).
- **Managed identities** — Azure-managed credentials for resources: **system-assigned** (tied to one resource's lifecycle) or **user-assigned** (independent, shareable). Preferred: no secrets to rotate.

```bash
az webapp identity assign -g rg-shop-dev -n shop-api-dev
az role assignment create --assignee <principalId> --role "Key Vault Secrets User" \
  --scope /subscriptions/<sub>/resourceGroups/rg-shop-dev/providers/Microsoft.KeyVault/vaults/kv-shop-dev
```

### Security features
MFA, **Conditional Access** (require MFA/compliant device based on risk, location, app), **Privileged Identity Management** (just-in-time admin), Identity Protection, B2B (guests) and **External ID / B2C** (customer identity).

## Compute Options

| Service | Model | Use when |
|---|---|---|
| **Virtual Machines** | IaaS | full OS control, lift-and-shift, legacy apps |
| **VM Scale Sets** | IaaS autoscaling | identical VMs at scale |
| **App Service** | PaaS web hosting | web apps/APIs (.NET, Java, Node, Python, PHP, containers) with slots, autoscale, custom domains |
| **Azure Functions** | serverless FaaS | event-driven code, timers, queue processing |
| **Container Apps** | serverless containers (built on Kubernetes + KEDA + Dapr) | microservices without managing K8s, scale to zero |
| **AKS** | managed Kubernetes | full Kubernetes control |
| **Container Instances** | single containers on demand | simple batch jobs, sidecar tasks |
| **Static Web Apps** | static frontends + Functions APIs | SPAs, Jamstack |
| **Batch** | large-scale parallel/HPC jobs | rendering, simulations |

### App Service essentials
- **App Service Plan** defines compute (tier: Free, Basic, Standard, Premium v3, Isolated) — multiple apps can share a plan.
- **Deployment slots** (staging → swap to production with zero downtime, warm-up, rollback by swapping back).
- Autoscale rules, VNet integration and private endpoints, managed certificates, Easy Auth (built-in authentication), application settings (env vars) referencing **Key Vault**.

## Storage

A **storage account** provides:
| Service | Purpose |
|---|---|
| **Blob storage** | objects (images, backups, data lake with hierarchical namespace = ADLS Gen2) |
| **Azure Files** | managed SMB/NFS file shares |
| **Queue storage** | simple message queues |
| **Table storage** | key-value NoSQL |
| **Disks** (separate managed resource) | block storage for VMs (Standard HDD/SSD, Premium SSD v2, Ultra) |

### Access tiers (blob)
**Hot** → **Cool** (30 days min) → **Cold** (90 days) → **Archive** (180 days, offline, hours to rehydrate). Lifecycle management policies move/delete blobs automatically.

### Redundancy
| Option | Copies |
|---|---|
| **LRS** | 3 copies in one data centre |
| **ZRS** | 3 copies across availability zones |
| **GRS** | LRS + async copy to the paired region |
| **GZRS** | ZRS + async copy to the paired region |
| RA-GRS / RA-GZRS | plus read access in the secondary region |

### Access control
Entra ID RBAC (preferred), **SAS tokens** (scoped, time-limited delegated access; user delegation SAS is best), account keys (avoid), private endpoints, firewall rules, encryption at rest (Microsoft- or customer-managed keys), immutable storage.

# Intermediate

## Networking

| Component | Purpose |
|---|---|
| **Virtual Network (VNet)** | private network with address space, divided into **subnets** |
| **NSG** (Network Security Group) | stateful allow/deny rules on subnets or NICs (priority-ordered) |
| **ASG** (Application Security Group) | group VMs logically to use in NSG rules |
| **VNet peering** | connect VNets (regional/global), non-transitive |
| **Hub-and-spoke** | shared services (firewall, VPN gateway) in a hub VNet, workloads in spokes; **Virtual WAN** for large scale |
| **VPN Gateway / ExpressRoute** | hybrid connectivity: encrypted over internet / private dedicated circuit |
| **Azure Firewall** | managed stateful firewall with threat intelligence |
| **Private Endpoint** | a private IP in your VNet for a PaaS resource (Storage, SQL, Key Vault) — traffic never touches the internet |
| **Service Endpoint** | optimised route to PaaS from a subnet (resource still has public endpoint) |
| **Azure DNS / Private DNS zones** | name resolution (required for private endpoints) |
| **Bastion** | browser-based RDP/SSH to VMs without public IPs |
| **NAT Gateway** | outbound internet for private subnets with static IPs |

### Load balancing options
| Service | Scope | Layer | Use |
|---|---|---|---|
| **Azure Load Balancer** | regional | 4 | TCP/UDP to VMs |
| **Application Gateway** (+ WAF) | regional | 7 | HTTP routing, TLS termination, WAF, AKS ingress (AGIC / Application Gateway for Containers) |
| **Front Door** (+ WAF) | global | 7 | global HTTP entry, CDN, acceleration, failover across regions |
| **Traffic Manager** | global | DNS | DNS-based routing (priority, weighted, performance, geographic) |

## Serverless and Integration

### Azure Functions
```python function_app.py (Python v2 model)
import azure.functions as func, json, logging
app = func.FunctionApp()

@app.route(route="orders", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
@app.queue_output(arg_name="msg", queue_name="orders", connection="AzureWebJobsStorage")
def create_order(req: func.HttpRequest, msg: func.Out[str]) -> func.HttpResponse:
    order = req.get_json()
    msg.set(json.dumps(order))                 # output binding writes to a queue
    return func.HttpResponse(json.dumps({"id": order["id"]}), status_code=202)

@app.queue_trigger(arg_name="msg", queue_name="orders", connection="AzureWebJobsStorage")
def process_order(msg: func.QueueMessage):
    logging.info("Processing %s", msg.get_body().decode())
```
- **Triggers** (HTTP, Timer, Queue, Service Bus, Event Hub, Event Grid, Blob, Cosmos DB) and **bindings** (declarative input/output).
- Hosting plans: **Consumption / Flex Consumption** (pay per execution, scale to zero, cold starts), **Premium** (pre-warmed, VNet), Dedicated (App Service plan), Container Apps.
- **Durable Functions** — stateful workflows in code: function chaining, fan-out/fan-in, async HTTP APIs, human interaction, eternal orchestrations.

### Messaging
| Service | Pattern | Use |
|---|---|---|
| **Service Bus** | enterprise broker: queues + topics/subscriptions | transactions, ordering (sessions), dead-lettering, duplicate detection — business workflows |
| **Event Grid** | event routing (push), pub/sub | react to resource events (blob created) and custom events |
| **Event Hubs** | big-data streaming (Kafka-compatible) | telemetry, logs, millions of events/sec |
| Storage Queues | simple queue | basic, cheap, large backlogs |

### Integration
**Logic Apps** (low-code workflows with 1,000+ connectors, similar to Power Automate for developers/enterprise integration), **API Management** (gateway, policies, rate limiting, developer portal, versioning), **Data Factory** (ETL/data pipelines).

## Databases and Data

| Service | Type |
|---|---|
| **Azure SQL Database** | managed SQL Server (single DB, elastic pools, **serverless** tier, Hyperscale up to 100 TB) |
| **Azure SQL Managed Instance** | near 100% SQL Server compatibility for lift-and-shift |
| **Azure Database for PostgreSQL / MySQL (Flexible Server)** | managed open-source relational |
| **Cosmos DB** | globally distributed multi-model NoSQL with SLAs on latency; APIs: NoSQL, MongoDB, Cassandra, Gremlin, Table, PostgreSQL |
| **Azure Cache for Redis / Managed Redis** | in-memory cache |
| **Synapse / Microsoft Fabric / Databricks** | analytics, data warehouse, lakehouse |
| **Azure AI Search** | full-text + vector search (RAG) |

### Cosmos DB essentials
- **Partition key** choice is critical (high cardinality, even distribution, matches queries).
- Throughput in **Request Units (RU/s)** — provisioned, autoscale, or serverless.
- **Five consistency levels**: Strong → Bounded Staleness → **Session** (default; read-your-writes per session) → Consistent Prefix → Eventual.
- Multi-region writes, change feed (event-driven processing), TTL.

### High availability for Azure SQL
Built-in HA, zone redundancy, **active geo-replication** / **auto-failover groups** (cross-region with a single listener endpoint), point-in-time restore, long-term retention backups.

## AKS and Containers

- **ACR** (Azure Container Registry) — private registry with geo-replication, tasks (build in cloud), scanning via Defender.
- **AKS** — managed control plane; you manage node pools (system and user pools, spot node pools, autoscaler / node auto-provisioning).
- Networking: Azure CNI (overlay or pod subnet), kubenet (legacy); ingress via Application Gateway for Containers, NGINX, or service mesh (Istio add-on).
- Identity: **Entra Workload ID** for pods to access Azure resources without secrets; Entra integration + Kubernetes RBAC for cluster access.
- Secrets: Key Vault **CSI driver**.
- Monitoring: Container Insights, Managed Prometheus + Managed Grafana.
- **Container Apps vs AKS**: Container Apps for most microservices (no cluster management, scale to zero, Dapr); AKS when you need full Kubernetes APIs, custom operators or fine control.

## Azure DevOps and CI/CD

**Azure DevOps** services: **Boards** (work items, sprints), **Repos** (Git), **Pipelines** (CI/CD), **Test Plans** (manual/exploratory testing), **Artifacts** (package feeds).

```yaml azure-pipelines.yml
trigger: { branches: { include: [main] } }
pool: { vmImage: ubuntu-latest }

stages:
  - stage: Build
    jobs:
      - job: build
        steps:
          - task: UsePythonVersion@0
            inputs: { versionSpec: '3.12' }
          - script: pip install -r requirements.txt && pytest --junitxml=test-results.xml
          - task: PublishTestResults@2
            inputs: { testResultsFiles: test-results.xml }
          - task: Docker@2
            inputs: { command: buildAndPush, containerRegistry: acr-connection, repository: shop-api, tags: $(Build.BuildId) }

  - stage: DeployProd
    dependsOn: Build
    jobs:
      - deployment: deploy
        environment: production            # approvals & checks configured on the environment
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureWebAppContainer@1
                  inputs: { azureSubscription: prod-service-connection, appName: shop-api, containers: myacr.azurecr.io/shop-api:$(Build.BuildId) }
```
Key concepts: stages, jobs, steps, tasks, templates, variable groups (linked to Key Vault), **service connections** (use workload identity federation), environments with approvals and checks, self-hosted vs Microsoft-hosted agents. GitHub Actions with `azure/login` (OIDC) is the alternative.

# Advanced

## Security, Governance and Landing Zones

- **Azure Policy** — enforce/audit rules (allowed regions, required tags, deny public IPs, require private endpoints); effects: Deny, Audit, Modify, DeployIfNotExists; grouped into **initiatives** and assigned at scopes.
- **Management groups** + **Azure Landing Zones** (Cloud Adoption Framework) — standard enterprise layout: platform subscriptions (identity, management, connectivity) and application landing zones, hub-and-spoke networking, policies and RBAC by design.
- **Microsoft Defender for Cloud** — security posture (Secure Score), recommendations, workload protection for servers, containers, SQL, storage, Key Vault.
- **Microsoft Sentinel** — cloud SIEM/SOAR.
- **Key Vault** — secrets, keys, certificates; RBAC access, soft delete and purge protection, private endpoints, managed HSM.
- **DDoS Protection**, **WAF** on Front Door/Application Gateway, **Azure Firewall Premium** (TLS inspection, IDPS).
- Encryption at rest everywhere by default; customer-managed keys for compliance; confidential computing for data in use.
- Cost governance: **Cost Management + Budgets**, Advisor recommendations, reservations and **Savings Plans**, Azure Hybrid Benefit (reuse Windows/SQL licences), spot VMs, auto-shutdown for dev.

## Monitoring and Operations

- **Azure Monitor** — the umbrella: **Metrics**, **Logs** (Log Analytics workspaces queried with **KQL**), alerts and action groups, workbooks, dashboards.
- **Application Insights** — APM: requests, dependencies, exceptions, distributed tracing, live metrics, availability tests (OpenTelemetry-based).
- **Diagnostic settings** route resource logs to Log Analytics/Storage/Event Hubs.
- **Activity log** — subscription-level control-plane events (who changed what).
- **Azure Advisor**, **Service Health**/**Resource Health**.
- Backup and DR: **Azure Backup** (VMs, SQL, Files), **Azure Site Recovery** (replicate VMs to another region and orchestrate failover).

```kql Find failed requests by operation in the last 24h
requests
| where timestamp > ago(24h) and success == false
| summarize failures = count(), p95 = percentile(duration, 95) by operation_Name, resultCode
| order by failures desc
```

## Infrastructure as Code: ARM and Bicep

**ARM** (Azure Resource Manager) is the deployment and management layer; every tool (portal, CLI, Terraform) calls ARM APIs. **Bicep** is a concise DSL that compiles to ARM JSON templates.

```bicep main.bicep
param location string = resourceGroup().location
param appName string

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  sku: { name: 'P1v3' }
  properties: { reserved: true }      // Linux
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: { linuxFxVersion: 'PYTHON|3.12', minTlsVersion: '1.2' }
  }
}

output principalId string = app.identity.principalId
```
```bash
az deployment group what-if -g rg-shop-dev -f main.bicep -p appName=shop-api-dev
az deployment group create  -g rg-shop-dev -f main.bicep -p appName=shop-api-dev
```
Features: idempotent declarative deployments, **what-if** previews, modules, Azure Verified Modules, deployment stacks, incremental vs complete modes.

## Azure Well-Architected Framework and Reference Architectures

### Five pillars
**Reliability** (zones, redundancy, health probes, DR), **Security** (zero trust, identity first, least privilege, encryption), **Cost Optimization**, **Operational Excellence** (IaC, DevOps, monitoring), **Performance Efficiency** (scaling, caching, CDN, right services).

### Zone-redundant web app reference
```text
Front Door (+WAF, global) → App Service (Premium v3, zone redundant) with VNet integration
   → Azure SQL (zone redundant + auto-failover group to paired region) / Cosmos DB
   → Azure Cache for Redis, Blob storage (ZRS/GZRS) via private endpoints
   Key Vault + managed identity, Application Insights + Log Analytics, Bicep/Terraform + Azure DevOps/GitHub Actions
```

### Azure AI services (frequently asked now)
**Azure OpenAI / Azure AI Foundry** (deploy and manage LLMs including OpenAI and other model families, agents, evaluations, content safety), **Azure AI Search** (hybrid + vector search for RAG), AI Document Intelligence (form extraction), Speech, Vision, Language, **Azure Machine Learning** (MLOps).

### Certifications path
AZ-900 (Fundamentals) → AZ-104 (Administrator) / AZ-204 (Developer) → AZ-305 (Solutions Architect Expert) / AZ-400 (DevOps Engineer Expert); AZ-500 (Security), AI-102 (AI Engineer), DP-203/DP-700 (Data).

# Interview Questions

## Beginner

### What is the Azure resource hierarchy?
Management groups contain subscriptions; subscriptions contain resource groups; resource groups contain resources. Policies and RBAC assignments at a higher scope inherit downward, and subscriptions act as billing and access boundaries.

### What is a resource group?
A logical container for Azure resources that share the same lifecycle, permissions and policies. Deleting a resource group deletes all its resources. A resource can belong to only one resource group.

### What is Microsoft Entra ID?
Microsoft's cloud identity and access management service (formerly Azure AD) providing users, groups, application identities, SSO, MFA, Conditional Access and integration with thousands of SaaS apps.

### Azure RBAC vs Entra ID roles?
Azure RBAC roles (Owner, Contributor, Reader, etc.) control access to Azure resources at management group, subscription, resource group or resource scope. Entra ID roles (Global Administrator, User Administrator) control directory objects like users, groups and app registrations.

### What are managed identities?
Automatically managed identities in Entra ID for Azure resources, letting them authenticate to services like Key Vault or Storage without storing credentials. System-assigned identities are tied to one resource; user-assigned identities are standalone and reusable.

### Storage redundancy options?
LRS (three copies in one data centre), ZRS (across availability zones), GRS (LRS plus asynchronous replication to the paired region), GZRS (ZRS plus geo-replication), and read-access variants RA-GRS/RA-GZRS that allow reads from the secondary region.

## Intermediate

### App Service vs Functions vs Container Apps vs AKS?
App Service for traditional web apps and APIs with minimal ops. Functions for event-driven, short-running serverless code. Container Apps for containerised microservices with autoscaling (including to zero) without managing Kubernetes. AKS when you need full Kubernetes control and ecosystem.

### What are deployment slots?
Live environments of an App Service app (e.g., staging) with their own hostnames. You deploy to a slot, warm it up and test, then swap with production for zero-downtime releases and instant rollback by swapping back. Slot-specific settings stay with the slot.

### Service Bus vs Event Grid vs Event Hubs?
Service Bus is an enterprise message broker with queues/topics, transactions, sessions and dead-lettering for business messages. Event Grid routes discrete events with push delivery for reactive architectures. Event Hubs ingests massive event streams (telemetry, logs) with partitions and replay, Kafka-compatible.

### Private endpoint vs service endpoint?
A private endpoint gives a PaaS resource a private IP inside your VNet, so traffic stays private and the public endpoint can be disabled. A service endpoint routes traffic from a subnet to the service over the Azure backbone but the service still uses its public endpoint, restricted by firewall rules.

### Azure Front Door vs Application Gateway vs Load Balancer?
Front Door is a global layer-7 entry point with CDN, WAF and multi-region failover. Application Gateway is a regional layer-7 load balancer with WAF, path-based routing and TLS termination. Azure Load Balancer is a regional layer-4 load balancer for TCP/UDP traffic.

### What are Cosmos DB consistency levels?
Strong, Bounded Staleness, Session, Consistent Prefix and Eventual — trading consistency for latency, availability and throughput. Session (the default) guarantees read-your-own-writes within a session and suits most applications.

### How do you store secrets for an app on Azure?
Put them in Key Vault, give the app a managed identity with the Key Vault Secrets User role, reference secrets from App Service/Functions settings or the AKS CSI driver, enable soft delete and purge protection, and restrict network access with private endpoints.

## Advanced

### How would you design a highly available, multi-region application on Azure?
Front Door with WAF for global routing and failover; zone-redundant App Service or AKS in two paired regions; Azure SQL auto-failover groups or Cosmos DB multi-region; zone- and geo-redundant storage; Redis per region; Key Vault and managed identities; Application Insights and Azure Monitor alerts; IaC for identical environments and regular failover drills against defined RTO/RPO.

### What is an Azure Landing Zone?
A pre-configured, scalable enterprise environment based on the Cloud Adoption Framework: a management group hierarchy, platform subscriptions for identity, management and connectivity (hub networking), application landing zones, Azure Policy guardrails, RBAC, logging and security baselines — so teams can deploy workloads safely and consistently.

### How do you implement governance in Azure?
Management groups for hierarchy, Azure Policy and initiatives for enforcing standards (regions, tags, SKUs, private networking), RBAC with least privilege and PIM for admins, resource locks, Defender for Cloud for posture management, cost budgets and tagging, and Activity Log/Log Analytics for auditing.

### How do you reduce Azure costs?
Right-size via Advisor, use reservations and savings plans, Azure Hybrid Benefit, spot VMs for interruptible work, autoscale and scale-to-zero services, auto-shutdown for dev VMs, storage lifecycle tiers, delete orphaned disks and IPs, and track with Cost Management budgets and tags.

### Bicep vs ARM vs Terraform?
ARM templates are verbose JSON consumed by Azure Resource Manager. Bicep is a concise, type-safe DSL that compiles to ARM, with day-zero support for new Azure features and no state file. Terraform is multi-cloud with a large provider ecosystem and explicit state management. Choose Bicep for Azure-only teams, Terraform for multi-cloud or existing Terraform expertise.

# Scenario Questions

## Beginner

### Your App Service web app shows "503 Service Unavailable" after a deploy. How do you troubleshoot it?
- Check **Log stream** and the Diagnose and solve problems blade.
- The app may fail at start-up: a wrong start-up command or runtime stack, missing app settings or connection strings, or the app listening on the wrong port (on Linux, set `WEBSITES_PORT`).
- Use deployment slots with a warm-up step to catch this before a swap.

## Intermediate

### Your app stores a database password in `appsettings.json`. How should it be handled in Azure?
Use a **Managed Identity** so the app authenticates to Azure SQL, Storage or Key Vault with no secret at all. For secrets that must exist, keep them in **Key Vault** and reference them from App Service settings (`@Microsoft.KeyVault(...)`). Grant access with RBAC, and enable rotation and soft-delete.

### A Function App on the Consumption plan has a slow first request in the morning. How do you fix it?
That's a **cold start**. Use the **Flex Consumption** plan with always-ready instances, or the Premium plan with pre-warmed instances. Reduce package size and start-up work, and keep a lightweight timer ping only if your budget rules allow it.

## Advanced

### Design network isolation so your App Service can reach Azure SQL privately and SQL isn't exposed to the internet.
- Put SQL behind a **Private Endpoint** in a VNet and disable public network access.
- Use **VNet integration** for the App Service's outbound traffic.
- Link a Private DNS zone (`privatelink.database.windows.net`) to the VNet.
- Lock down NSGs, use Front Door with a WAF for inbound traffic, and audit with Azure Policy.

# Tricky Questions

## Intermediate

### Is an Azure Resource Group a security or networking boundary?
Neither. It's a **lifecycle and management** container: you deploy, tag, apply RBAC and delete resources together. Resources in different resource groups can talk freely, and one VNet can span resources from many RGs. Isolation comes from VNets, NSGs, subscriptions and RBAC scopes.

### A user has `Contributor` on a subscription. Can they grant access to other users?
**No.** Contributor can manage resources but not RBAC assignments. Assigning roles needs `Owner`, `User Access Administrator` or `Role Based Access Control Administrator`. Azure AD (Entra ID) roles are a separate system from Azure RBAC.
