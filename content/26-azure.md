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

```bash
az vm create -g rg-shop -n vm-legacy --image Ubuntu2204 --size Standard_B2s --admin-username azureuser --generate-ssh-keys
az appservice plan create -g rg-shop -n plan-shop --sku P1v3 --is-linux
az webapp create -g rg-shop -p plan-shop -n shop-api --runtime "NODE:20-lts"
az functionapp create -g rg-shop -n shop-fn --storage-account stshopfn --flexconsumption-location westeurope --runtime python --runtime-version 3.11
az containerapp up -g rg-shop -n orders --image ghcr.io/acme/orders:1.4 --ingress external --target-port 8080
```

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

```bash
az storage account create -g rg-shop -n stshopdata --sku Standard_ZRS --kind StorageV2 --hns true --min-tls-version TLS1_2 --allow-blob-public-access false
az storage container create --account-name stshopdata -n invoices --auth-mode login
az storage blob upload --account-name stshopdata -c invoices -n 2026/inv-901.pdf -f inv-901.pdf --auth-mode login --tier Cool
```
```python
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
svc = BlobServiceClient("https://stshopdata.blob.core.windows.net", credential=DefaultAzureCredential())
svc.get_container_client("invoices").upload_blob("2026/inv-902.pdf", open("inv-902.pdf", "rb"))
```

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

```bash
az network vnet create -g rg-shop -n vnet-shop --address-prefixes 10.10.0.0/16 --subnet-name snet-app --subnet-prefixes 10.10.1.0/24
az network nsg create -g rg-shop -n nsg-app
az network nsg rule create -g rg-shop --nsg-name nsg-app -n allow-https --priority 100 \
  --direction Inbound --access Allow --protocol Tcp --destination-port-ranges 443 --source-address-prefixes Internet
az network vnet subnet update -g rg-shop --vnet-name vnet-shop -n snet-app --network-security-group nsg-app
az network vnet peering create -g rg-shop -n shop-to-hub --vnet-name vnet-shop --remote-vnet /subscriptions/…/vnet-hub --allow-vnet-access
```

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

```bash
az sql server create -g rg-shop -n sql-shop --enable-ad-only-auth --external-admin-principal-type Group \
  --external-admin-name "sql-admins" --external-admin-sid <group-object-id>
az sql db create -g rg-shop -s sql-shop -n orders --edition GeneralPurpose --compute-model Serverless --family Gen5 --capacity 2 --auto-pause-delay 60
az cosmosdb create -g rg-shop -n cosmos-shop --default-consistency-level Session --locations regionName=westeurope isZoneRedundant=true
az postgres flexible-server create -g rg-shop -n pg-shop --tier GeneralPurpose --sku-name Standard_D2ds_v5 --high-availability ZoneRedundant
```

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

```bash
az acr create -g rg-shop -n acrshop --sku Premium
az aks create -g rg-shop -n aks-shop --node-count 3 --zones 1 2 3 \
  --enable-oidc-issuer --enable-workload-identity --network-plugin azure --attach-acr acrshop \
  --enable-cluster-autoscaler --min-count 3 --max-count 10
az aks nodepool add -g rg-shop --cluster-name aks-shop -n spot --priority Spot --eviction-policy Delete --spot-max-price -1 --node-count 1
az aks get-credentials -g rg-shop -n aks-shop && kubectl get nodes
```

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

```json Azure Policy: deny resources outside approved regions
{
  "if": { "not": { "field": "location", "in": "[parameters('allowedLocations')]" } },
  "then": { "effect": "deny" }
}
```
```bash
az policy assignment create -n allowed-locations --scope /providers/Microsoft.Management/managementGroups/mg-prod \
  --policy e56962a6-4747-49cd-b67b-bf8b01975c4c --params '{"listOfAllowedLocations":{"value":["westeurope","northeurope"]}}'
az lock create -n no-delete -g rg-shop-prod --lock-type CanNotDelete
```

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

```bash
az account management-group create -n mg-prod --parent mg-root
az account management-group subscription add -n mg-prod --subscription "Shop-Prod"
az group create -n rg-shop-prod -l westeurope --subscription "Shop-Prod"
az role assignment create --assignee devops@acme.com --role Reader --scope /providers/Microsoft.Management/managementGroups/mg-prod  # inherited below
```

### What is a resource group?
A logical container for Azure resources that share the same lifecycle, permissions and policies. Deleting a resource group deletes all its resources. A resource can belong to only one resource group.

```bash
az group create -n rg-shop-dev -l westeurope --tags env=dev owner=team-shop
az resource list -g rg-shop-dev -o table
az group delete -n rg-shop-dev --yes --no-wait          # deletes EVERYTHING inside
az resource move --destination-group rg-shop-prod --ids <resource-id>
```

### What is Microsoft Entra ID?
Microsoft's cloud identity and access management service (formerly Azure AD) providing users, groups, application identities, SSO, MFA, Conditional Access and integration with thousands of SaaS apps.

```bash
az ad user create --display-name "Ada Lovelace" --user-principal-name ada@acme.onmicrosoft.com --password '…'
az ad group create --display-name shop-devs --mail-nickname shop-devs
az ad app create --display-name orders-api --sign-in-audience AzureADMyOrg
az ad sp create --id <appId>
```

### Azure RBAC vs Entra ID roles?
Azure RBAC roles (Owner, Contributor, Reader, etc.) control access to Azure resources at management group, subscription, resource group or resource scope. Entra ID roles (Global Administrator, User Administrator) control directory objects like users, groups and app registrations.

```bash Azure RBAC — access to Azure resources
az role assignment create --assignee-object-id <group-id> --role Contributor --scope /subscriptions/<sub>/resourceGroups/rg-shop
```
```bash Entra ID role — directory administration (users, apps)
az rest --method POST --url https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments \
  --body '{"principalId":"<user-id>","roleDefinitionId":"fe930be7-5e62-47db-91af-98c3a49a38b1","directoryScopeId":"/"}'   # User Administrator
```

### What are managed identities?
Automatically managed identities in Entra ID for Azure resources, letting them authenticate to services like Key Vault or Storage without storing credentials. System-assigned identities are tied to one resource; user-assigned identities are standalone and reusable.

```bash
az webapp identity assign -g rg-shop -n shop-api           # system-assigned
az role assignment create --assignee <principalId> --role "Storage Blob Data Reader" --scope <storage-id>
```
```csharp
var client = new BlobServiceClient(new Uri("https://stshopdata.blob.core.windows.net"), new DefaultAzureCredential());
// No connection string or key anywhere
```

### Storage redundancy options?
LRS (three copies in one data centre), ZRS (across availability zones), GRS (LRS plus asynchronous replication to the paired region), GZRS (ZRS plus geo-replication), and read-access variants RA-GRS/RA-GZRS that allow reads from the secondary region.

```bash
az storage account create -n stlocal  -g rg --sku Standard_LRS    # 3 copies, one datacentre
az storage account create -n stzone   -g rg --sku Standard_ZRS    # across availability zones
az storage account create -n stgeo    -g rg --sku Standard_GRS    # + async copy to paired region
az storage account create -n stgeozone -g rg --sku Standard_RAGZRS # zones + geo + read access to secondary
```

## Intermediate

### App Service vs Functions vs Container Apps vs AKS?
App Service for traditional web apps and APIs with minimal ops. Functions for event-driven, short-running serverless code. Container Apps for containerised microservices with autoscaling (including to zero) without managing Kubernetes. AKS when you need full Kubernetes control and ecosystem.

```python Azure Functions (Python v2 model) — event-driven
import azure.functions as func
app = func.FunctionApp()

@app.queue_trigger(arg_name="msg", queue_name="orders", connection="AzureWebJobsStorage")
def process_order(msg: func.QueueMessage):
    handle(msg.get_json())
```
```bash Container Apps — scale to zero on HTTP or KEDA triggers
az containerapp update -n orders -g rg-shop --min-replicas 0 --max-replicas 20 \
  --scale-rule-name http --scale-rule-type http --scale-rule-http-concurrency 50
```

### What are deployment slots?
Live environments of an App Service app (e.g., staging) with their own hostnames. You deploy to a slot, warm it up and test, then swap with production for zero-downtime releases and instant rollback by swapping back. Slot-specific settings stay with the slot.

```bash
az webapp deployment slot create -g rg-shop -n shop-api --slot staging
az webapp deploy -g rg-shop -n shop-api --slot staging --src-path app.zip
curl -f https://shop-api-staging.azurewebsites.net/health
az webapp deployment slot swap -g rg-shop -n shop-api --slot staging --target-slot production
az webapp deployment slot swap -g rg-shop -n shop-api --slot staging --target-slot production   # swap back = rollback
```

### Service Bus vs Event Grid vs Event Hubs?
Service Bus is an enterprise message broker with queues/topics, transactions, sessions and dead-lettering for business messages. Event Grid routes discrete events with push delivery for reactive architectures. Event Hubs ingests massive event streams (telemetry, logs) with partitions and replay, Kafka-compatible.

```python Service Bus: reliable business messages
from azure.servicebus import ServiceBusClient, ServiceBusMessage
with ServiceBusClient(NS, credential=DefaultAzureCredential()) as sb:
    sb.get_queue_sender("orders").send_messages(ServiceBusMessage('{"orderId":42}', session_id="customer-7"))
```
```python Event Hubs: high-volume telemetry stream
from azure.eventhub import EventHubProducerClient, EventData
p = EventHubProducerClient(NS_FQDN, "clicks", credential=DefaultAzureCredential())
batch = p.create_batch(partition_key="user-7"); batch.add(EventData('{"page":"/cart"}')); p.send_batch(batch)
```
```bash Event Grid: react to "blob created"
az eventgrid event-subscription create --source-resource-id <storage-id> -n on-upload \
  --endpoint <function-resource-id> --endpoint-type azurefunction --included-event-types Microsoft.Storage.BlobCreated
```

### Private endpoint vs service endpoint?
A private endpoint gives a PaaS resource a private IP inside your VNet, so traffic stays private and the public endpoint can be disabled. A service endpoint routes traffic from a subnet to the service over the Azure backbone but the service still uses its public endpoint, restricted by firewall rules.

```bash Private endpoint: PaaS gets a private IP in your VNet
az network private-endpoint create -g rg-shop -n pe-sql --vnet-name vnet-shop --subnet snet-pe \
  --private-connection-resource-id <sql-server-id> --group-id sqlServer --connection-name sql
az sql server update -g rg-shop -n sql-shop --enable-public-network false
```
```bash Service endpoint: optimised route, public endpoint remains
az network vnet subnet update -g rg-shop --vnet-name vnet-shop -n snet-app --service-endpoints Microsoft.Sql
az sql server vnet-rule create -g rg-shop -s sql-shop -n from-app --vnet-name vnet-shop --subnet snet-app
```

### Azure Front Door vs Application Gateway vs Load Balancer?
Front Door is a global layer-7 entry point with CDN, WAF and multi-region failover. Application Gateway is a regional layer-7 load balancer with WAF, path-based routing and TLS termination. Azure Load Balancer is a regional layer-4 load balancer for TCP/UDP traffic.

```bash
az afd profile create -g rg-shop -n afd-shop --sku Premium_AzureFrontDoor            # global L7 + WAF + CDN
az network application-gateway create -g rg-shop -n agw-shop --sku WAF_v2 --capacity 2 \
  --vnet-name vnet-shop --subnet snet-agw --public-ip-address pip-agw --priority 100  # regional L7
az network lb create -g rg-shop -n lb-tcp --sku Standard --frontend-ip-name fe --backend-pool-name be  # L4
```

### What are Cosmos DB consistency levels?
Strong, Bounded Staleness, Session, Consistent Prefix and Eventual — trading consistency for latency, availability and throughput. Session (the default) guarantees read-your-own-writes within a session and suits most applications.

```csharp
var client = new CosmosClient(endpoint, new DefaultAzureCredential(), new CosmosClientOptions
{
    ConsistencyLevel = ConsistencyLevel.Session,      // read-your-own-writes per session (default)
    ApplicationPreferredRegions = new[] { Regions.WestEurope, Regions.NorthEurope },
});
// Per-request relaxation (can only weaken the account default)
await container.ReadItemAsync<Order>(id, new PartitionKey(customerId),
    new ItemRequestOptions { ConsistencyLevel = ConsistencyLevel.Eventual });
```

### How do you store secrets for an app on Azure?
Put them in Key Vault, give the app a managed identity with the Key Vault Secrets User role, reference secrets from App Service/Functions settings or the AKS CSI driver, enable soft delete and purge protection, and restrict network access with private endpoints.

```bash
az keyvault create -g rg-shop -n kv-shop --enable-rbac-authorization true
az keyvault secret set --vault-name kv-shop -n StripeKey --value 'sk_live_…'
az role assignment create --assignee <webapp-principal-id> --role "Key Vault Secrets User" --scope <kv-id>
az webapp config appsettings set -g rg-shop -n shop-api \
  --settings STRIPE_KEY='@Microsoft.KeyVault(SecretUri=https://kv-shop.vault.azure.net/secrets/StripeKey/)'
```

## Advanced

### How would you design a highly available, multi-region application on Azure?
Front Door with WAF for global routing and failover; zone-redundant App Service or AKS in two paired regions; Azure SQL auto-failover groups or Cosmos DB multi-region; zone- and geo-redundant storage; Redis per region; Key Vault and managed identities; Application Insights and Azure Monitor alerts; IaC for identical environments and regular failover drills against defined RTO/RPO.

```text
             Azure Front Door (WAF, health probes, priority/latency routing)
              │                                      │
   West Europe (primary)                    North Europe (secondary)
   App Service / AKS (zone-redundant)       App Service / AKS (zone-redundant)
   Azure SQL ── auto-failover group ──────▶ Azure SQL secondary
   Storage RA-GZRS, Key Vault per region, Service Bus Geo-DR alias
```
```bash
az sql failover-group create -g rg-shop -s sql-shop-weu -n fg-shop --partner-server sql-shop-neu \
  --add-db orders --failover-policy Automatic --grace-period 1
```

### What is an Azure Landing Zone?
A pre-configured, scalable enterprise environment based on the Cloud Adoption Framework: a management group hierarchy, platform subscriptions for identity, management and connectivity (hub networking), application landing zones, Azure Policy guardrails, RBAC, logging and security baselines — so teams can deploy workloads safely and consistently.

```text
Tenant Root
└─ mg-acme
   ├─ Platform
   │  ├─ Identity        (sub: identity)
   │  ├─ Management      (sub: log analytics, automation)
   │  └─ Connectivity    (sub: hub VNet, firewall, DNS)
   ├─ Landing Zones
   │  ├─ Corp            (sub: shop-prod, hr-prod — private only)
   │  └─ Online          (sub: website-prod — internet facing)
   ├─ Sandbox
   └─ Decommissioned
```
```bash
az deployment mg create --management-group-id mg-acme -l westeurope --template-file alz/main.bicep
```

### How do you implement governance in Azure?
Management groups for hierarchy, Azure Policy and initiatives for enforcing standards (regions, tags, SKUs, private networking), RBAC with least privilege and PIM for admins, resource locks, Defender for Cloud for posture management, cost budgets and tagging, and Activity Log/Log Analytics for auditing.

```bash
az policy assignment create -n require-tags --scope /subscriptions/<sub> \
  --policy 96670d01-0a4d-4649-9c89-2d3abc0a5025 --params '{"tagName":{"value":"costCenter"}}'
az policy state summarize --subscription <sub>
az consumption budget create --budget-name shop-monthly --amount 5000 --time-grain Monthly \
  --start-date 2026-11-01 --end-date 2027-10-31 --category cost
```

### How do you reduce Azure costs?
Right-size via Advisor, use reservations and savings plans, Azure Hybrid Benefit, spot VMs for interruptible work, autoscale and scale-to-zero services, auto-shutdown for dev VMs, storage lifecycle tiers, delete orphaned disks and IPs, and track with Cost Management budgets and tags.

```bash
az advisor recommendation list --category Cost -o table
az vm auto-shutdown -g rg-dev -n vm-dev --time 1900
az vm list -d --query "[?powerState=='VM stopped'].{name:name, rg:resourceGroup}" -o table   # stopped ≠ deallocated (still billed)
az vm deallocate -g rg-dev -n vm-dev
az disk list --query "[?diskState=='Unattached'].{name:name,size:diskSizeGb}" -o table
```

### Bicep vs ARM vs Terraform?
ARM templates are verbose JSON consumed by Azure Resource Manager. Bicep is a concise, type-safe DSL that compiles to ARM, with day-zero support for new Azure features and no state file. Terraform is multi-cloud with a large provider ecosystem and explicit state management. Choose Bicep for Azure-only teams, Terraform for multi-cloud or existing Terraform expertise.

```bicep main.bicep
param location string = resourceGroup().location
resource st 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'stshop${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2', allowBlobPublicAccess: false }
}
output id string = st.id
```
```hcl Same in Terraform
resource "azurerm_storage_account" "st" {
  name                     = "stshop${random_string.s.result}"
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "ZRS"
  min_tls_version          = "TLS1_2"
}
```

# Scenario Questions

## Beginner

### Your App Service web app shows "503 Service Unavailable" after a deploy. How do you troubleshoot it?
- Check **Log stream** and the Diagnose and solve problems blade.
- The app may fail at start-up: a wrong start-up command or runtime stack, missing app settings or connection strings, or the app listening on the wrong port (on Linux, set `WEBSITES_PORT`).
- Use deployment slots with a warm-up step to catch this before a swap.

```bash
az webapp log config -g rg-shop -n shop-api --docker-container-logging filesystem --application-logging filesystem
az webapp log tail -g rg-shop -n shop-api               # crash at startup? missing env var?
az webapp config show -g rg-shop -n shop-api --query "{stack:linuxFxVersion, cmd:appCommandLine}"
az webapp config appsettings list -g rg-shop -n shop-api -o table
az webapp config appsettings set -g rg-shop -n shop-api --settings WEBSITES_PORT=8080   # container listens on 8080
```

## Intermediate

### Your app stores a database password in `appsettings.json`. How should it be handled in Azure?
Use a **Managed Identity** so the app authenticates to Azure SQL, Storage or Key Vault with no secret at all. For secrets that must exist, keep them in **Key Vault** and reference them from App Service settings (`@Microsoft.KeyVault(...)`). Grant access with RBAC, and enable rotation and soft-delete.

```json appsettings.json — no password
{ "ConnectionStrings": { "Orders": "Server=tcp:sql-shop.database.windows.net;Database=orders;Authentication=Active Directory Default;" } }
```
```sql Grant the app's managed identity access inside the database
CREATE USER [shop-api] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [shop-api];
ALTER ROLE db_datawriter ADD MEMBER [shop-api];
```

### A Function App on the Consumption plan has a slow first request in the morning. How do you fix it?
That's a **cold start**. Use the **Flex Consumption** plan with always-ready instances, or the Premium plan with pre-warmed instances. Reduce package size and start-up work, and keep a lightweight timer ping only if your budget rules allow it.

```bash
az functionapp create -g rg-shop -n shop-fn --flexconsumption-location westeurope --runtime dotnet-isolated --runtime-version 8.0 --storage-account stshopfn
az functionapp scale config always-ready set -g rg-shop -n shop-fn --settings http=2   # warm instances
# or Premium plan with pre-warmed instances:
az functionapp plan create -g rg-shop -n plan-ep --sku EP1 --min-instances 1
```

## Advanced

### Design network isolation so your App Service can reach Azure SQL privately and SQL isn't exposed to the internet.
- Put SQL behind a **Private Endpoint** in a VNet and disable public network access.
- Use **VNet integration** for the App Service's outbound traffic.
- Link a Private DNS zone (`privatelink.database.windows.net`) to the VNet.
- Lock down NSGs, use Front Door with a WAF for inbound traffic, and audit with Azure Policy.

```bash
az webapp vnet-integration add -g rg-shop -n shop-api --vnet vnet-shop --subnet snet-integration
az network private-endpoint create -g rg-shop -n pe-sql --vnet-name vnet-shop --subnet snet-pe \
  --private-connection-resource-id <sql-server-id> --group-id sqlServer --connection-name sql
az network private-dns zone create -g rg-shop -n privatelink.database.windows.net
az network private-dns link vnet create -g rg-shop -z privatelink.database.windows.net -n link --virtual-network vnet-shop --registration-enabled false
az network private-endpoint dns-zone-group create -g rg-shop --endpoint-name pe-sql -n default \
  --private-dns-zone privatelink.database.windows.net --zone-name sql
az sql server update -g rg-shop -n sql-shop --enable-public-network false
```

# Tricky Questions

## Intermediate

### Is an Azure Resource Group a security or networking boundary?
Neither. It's a **lifecycle and management** container: you deploy, tag, apply RBAC and delete resources together. Resources in different resource groups can talk freely, and one VNet can span resources from many RGs. Isolation comes from VNets, NSGs, subscriptions and RBAC scopes.

```bash
# A VM in rg-a can reach a VM in rg-b in the same VNet — RGs don't isolate traffic
az network vnet show -g rg-network -n vnet-shop --query subnets[].name
# Boundaries come from NSGs/firewalls (network) and RBAC scopes (access), not from the RG itself
```

### A user has `Contributor` on a subscription. Can they grant access to other users?
**No.** Contributor can manage resources but not RBAC assignments. Assigning roles needs `Owner`, `User Access Administrator` or `Role Based Access Control Administrator`. Azure AD (Entra ID) roles are a separate system from Azure RBAC.

```bash
az role assignment create --assignee bob@acme.com --role Reader --scope /subscriptions/<sub>
# (as a Contributor) → AuthorizationFailed: does not have authorization to perform action
#   'Microsoft.Authorization/roleAssignments/write'
az role definition list --name Contributor --query "[].permissions[].notActions"   # roleAssignments/* is excluded
```
