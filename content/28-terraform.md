---
id: terraform
title: Terraform & Infrastructure as Code
short: Terraform
category: Cloud Platforms
order: 17.9
color: #7b42bc
icon: TF
summary: IaC principles, HCL, providers, resources, variables, state and backends, modules, workspaces, import, drift, CI/CD for infrastructure, policy as code and Ansible basics.
---

# Beginner

## Infrastructure as Code Principles

**Infrastructure as Code (IaC)** manages infrastructure (networks, servers, databases, DNS, permissions) through **versioned, declarative code** instead of manual console clicks.

### Benefits
Repeatability (identical dev/staging/prod) · version control and code review · automation in CI/CD · documentation by code · faster recovery (rebuild from code) · drift detection · policy enforcement.

### Declarative vs imperative
- **Declarative** (Terraform, CloudFormation, Bicep, Kubernetes YAML) — describe the **desired end state**; the tool figures out the steps.
- **Imperative** (scripts, AWS CLI, some Ansible usage) — describe **steps** to execute.

### Provisioning vs configuration management
- **Provisioning** — create infrastructure: Terraform/OpenTofu, CloudFormation, Bicep, Pulumi.
- **Configuration management** — configure software on servers: Ansible, Chef, Puppet, Salt.
- Modern pattern: **immutable infrastructure** — bake images (Packer) or containers, replace rather than patch servers.

### Terraform in one sentence
Terraform (HashiCorp; open-source fork **OpenTofu**) uses **HCL** to declare resources across **any provider** (AWS, Azure, GCP, Kubernetes, GitHub, Datadog…) and keeps a **state file** mapping code to real resources.

## HCL Basics and the Core Workflow

```hcl main.tf
terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
  default_tags { tags = { Project = "shop", Env = var.env, ManagedBy = "terraform" } }
}

resource "aws_s3_bucket" "uploads" {
  bucket = "shop-uploads-${var.env}"
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id          # implicit dependency via reference
  versioning_configuration { status = "Enabled" }
}

output "bucket_arn" { value = aws_s3_bucket.uploads.arn }
```

### Workflow
```bash
terraform init        # download providers & modules, configure backend
terraform fmt         # format code
terraform validate    # syntax & internal consistency
terraform plan -out=tfplan   # preview changes (+ create, ~ update, - destroy, -/+ replace)
terraform apply tfplan       # execute the saved plan
terraform destroy     # delete everything managed by this configuration
```

### Building blocks
| Block | Purpose |
|---|---|
| `terraform` | settings, required providers, backend |
| `provider` | configures a plugin that talks to an API |
| `resource` | infrastructure object to create/manage |
| `data` | read existing information (AMI IDs, existing VPC) |
| `variable` | input parameter |
| `output` | exported value |
| `locals` | named expressions within a module |
| `module` | reusable group of resources |

## Variables, Outputs, Locals and Data Sources

```hcl variables.tf
variable "env" {
  type        = string
  description = "Deployment environment"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be dev, staging or prod."
  }
}

variable "instance_count" {
  type    = number
  default = 2
}

variable "db_password" {
  type      = string
  sensitive = true
}
variable "subnets" {
  type = map(object({ cidr = string, az = string }))
}
```

Setting values (lowest → highest precedence): defaults → `terraform.tfvars` / `*.auto.tfvars` → `-var-file=prod.tfvars` → `-var` flags; also `TF_VAR_name` environment variables (precedence just above defaults).

```hcl
locals {
  name_prefix = "shop-${var.env}"
  common_tags = { Owner = "platform-team" }
}

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "web" {
  count         = var.instance_count
  ami           = data.aws_ami.al2023.id
  instance_type = var.env == "prod" ? "m7g.large" : "t4g.small"
  tags          = merge(local.common_tags, { Name = "${local.name_prefix}-web-${count.index}" })
}

output "web_ips" { value = aws_instance.web[*].private_ip }
```

Types: `string`, `number`, `bool`, `list(...)`, `set(...)`, `map(...)`, `object({...})`, `tuple([...])`, `any`.

# Intermediate

## State: What It Is and How to Manage It

Terraform **state** (`terraform.tfstate`) records the mapping between configuration and real resources, resource attributes and dependencies. Terraform compares **config ↔ state ↔ reality (refresh)** to compute plans.

### Why remote state
Local state breaks team collaboration and can be lost. Use a **remote backend** with **locking**:

```hcl backend.tf
terraform {
  backend "s3" {
    bucket       = "acme-terraform-state"
    key          = "shop/prod/network.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true          # S3-native locking (older setups use a DynamoDB table)
  }
}
```
Other backends: `azurerm` (Blob storage with lease locking), `gcs`, Terraform Cloud/HCP Terraform, Kubernetes, PostgreSQL.

### State hygiene
- State can contain **secrets** in plain text → encrypt the backend, restrict access, never commit state to Git.
- **Split state** by blast radius and lifecycle (network, data, app per environment) instead of one giant state.
- Read other states with `terraform_remote_state` data source or (better) published outputs/SSM parameters.

### State commands
```bash
terraform state list
terraform state show aws_s3_bucket.uploads
terraform state mv aws_instance.web aws_instance.app     # rename without destroying (prefer `moved` blocks)
terraform state rm aws_s3_bucket.legacy                  # stop managing (doesn't delete)
terraform import aws_s3_bucket.uploads shop-uploads-prod  # adopt existing resource (prefer `import` blocks)
terraform force-unlock <LOCK_ID>                          # only if a lock is stuck
```

```hcl Config-driven refactoring and import (Terraform 1.5+)
moved {
  from = aws_instance.web
  to   = aws_instance.app
}

import {
  to = aws_s3_bucket.uploads
  id = "shop-uploads-prod"
}
# terraform plan -generate-config-out=generated.tf   # generates HCL for imported resources
```

## Meta-Arguments and Expressions

### count vs for_each
```hcl
# count — identical copies indexed by number (removing one in the middle shifts indexes → recreation)
resource "aws_instance" "worker" {
  count = 3
  # ...
}

# for_each — keyed by map/set: stable identities, preferred for distinct items
resource "aws_subnet" "private" {
  for_each          = var.subnets            # { "a" = { cidr = "10.0.1.0/24", az = "ap-south-1a" }, ... }
  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az
  tags              = { Name = "private-${each.key}" }
}
```

### depends_on, lifecycle, provider aliases
```hcl
resource "aws_db_instance" "main" {
  # ...
  lifecycle {
    prevent_destroy       = true                 # guard critical resources
    create_before_destroy = true                 # zero-downtime replacement
    ignore_changes        = [tags["LastUpdated"]] # ignore changes made outside Terraform
  }
}

provider "aws" {            # second region (e.g., ACM certificates for CloudFront)
  alias  = "us"
  region = "us-east-1"
}
resource "aws_acm_certificate" "cdn" {
  provider    = aws.us
  domain_name = "shop.example.com"
  validation_method = "DNS"
}
```
`depends_on` is for **hidden** dependencies only — normal references create dependencies automatically.

### Expressions
Conditionals (`a ? b : c`), `for` expressions (`[for s in var.subnets : s.cidr]`, `{ for k, v in var.users : k => v.role if v.active }`), splat (`aws_instance.web[*].id`), **dynamic blocks**, and functions: `lookup`, `merge`, `concat`, `flatten`, `try`, `coalesce`, `cidrsubnet`, `templatefile`, `jsonencode`, `file`, `length`, `toset`.

```hcl
resource "aws_security_group" "web" {
  name   = "web"
  vpc_id = aws_vpc.main.id
  dynamic "ingress" {
    for_each = [80, 443]
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
}
```

## Modules

A **module** is a directory of `.tf` files; the working directory is the **root module**. Modules make infrastructure reusable and standardised.

```text
modules/
└── web-service/
    ├── main.tf        resources (ALB, ECS service, security groups)
    ├── variables.tf   inputs
    ├── outputs.tf     outputs
    ├── versions.tf    provider requirements
    └── README.md
envs/
├── dev/main.tf        module "api" { source = "../../modules/web-service" ... }
└── prod/main.tf
```

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"       # public registry module
  version = "~> 5.0"
  name            = "shop-${var.env}"
  cidr            = "10.0.0.0/16"
  azs             = ["ap-south-1a", "ap-south-1b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]
  enable_nat_gateway = true
}

module "api" {
  source     = "git::https://github.com/acme/tf-modules.git//web-service?ref=v2.3.0"
  name       = "api"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
}
```
Best practices: pin versions (`?ref=` tags, registry `version`), small focused modules with clear inputs/outputs, no hard-coded providers inside reusable modules, documentation and examples, semantic versioning, test modules (`terraform test`, Terratest).

## Environments: Workspaces vs Directories

- **CLI workspaces** (`terraform workspace new prod`) — multiple state files for one configuration; reference `terraform.workspace`. Simple but easy to apply to the wrong environment and configurations can't differ much.
- **Directory per environment** (`envs/dev`, `envs/prod`) calling shared modules with different variables and separate backends — most common for production.
- **Terragrunt** — wrapper to keep backend/provider config DRY across many environments/stacks.
- **HCP Terraform / Terraform Enterprise workspaces** — remote runs, state, variables, RBAC, policy checks, private registry.

# Advanced

## Terraform in CI/CD and Team Workflows

```yaml .github/workflows/terraform.yml
name: terraform
on:
  pull_request: { paths: ['infra/**'] }
  push: { branches: [main], paths: ['infra/**'] }
permissions: { id-token: write, contents: read, pull-requests: write }
jobs:
  plan-apply:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: infra/envs/prod } }
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4     # OIDC — no stored keys
        with: { role-to-assume: arn:aws:iam::123456789012:role/gh-terraform, aws-region: ap-south-1 }
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init -input=false
      - run: terraform fmt -check && terraform validate
      - run: terraform plan -input=false -out=tfplan
      - if: github.ref == 'refs/heads/main'
        run: terraform apply -input=false tfplan
```

Practices:
- **Plan on PR, apply on merge** (post plan output as a PR comment); require reviews for production.
- Apply the **exact saved plan**; protect production with manual approvals/environments.
- Static analysis: `tflint`, **Checkov**, **tfsec/Trivy**, KICS; cost estimation with **Infracost**.
- **Policy as code**: Sentinel (HCP Terraform), **OPA/Conftest** on plan JSON (`terraform show -json tfplan`) — e.g., deny public S3 buckets, require tags, restrict instance types.
- Tools: Atlantis (PR automation), Spacelift, env0, HCP Terraform.

## Drift, Troubleshooting and Gotchas

### Drift
Changes made outside Terraform (console clicks) make reality differ from state/config. Detect with scheduled `terraform plan -detailed-exitcode` (exit 2 = changes) or `terraform plan -refresh-only`; then either codify the change or revert it by applying.

### Common issues
| Problem | Fix |
|---|---|
| State lock stuck after a crashed run | verify no run is active, then `terraform force-unlock` |
| Resource "already exists" | `import` it into state instead of creating |
| Unexpected destroy/replace in plan | check `ForceNew` attributes (e.g., changing a name), count index shifts → use `for_each`/`moved` |
| Secrets in state | sensitive variables, encrypted backends, fetch secrets at runtime from a vault; ephemeral values/write-only attributes (newer Terraform) |
| Provider version breakage | pin versions, commit `.terraform.lock.hcl`, upgrade deliberately (`terraform init -upgrade`) |
| Circular dependencies | split resources (e.g., separate security group rules) |
| Slow plans in huge states | split state by component, `-target` only for emergencies, `-parallelism` |
| Debugging | `TF_LOG=DEBUG`, `terraform console` to evaluate expressions, `terraform graph` |

## Terraform vs Alternatives and Ansible Basics

| Tool | Notes |
|---|---|
| **Terraform / OpenTofu** | multi-cloud, huge provider ecosystem, explicit state, HCL. Since 2023 Terraform uses the BSL licence; OpenTofu is the open-source (MPL) fork |
| **CloudFormation / CDK** | AWS-native, no state file to manage (AWS keeps it), CDK lets you use TypeScript/Python |
| **Bicep / ARM** | Azure-native, day-zero feature support |
| **Pulumi** | IaC in general-purpose languages (TS, Python, Go, C#) with state |
| **Crossplane** | Kubernetes-native control plane managing cloud resources as CRDs |
| **Ansible** | agentless configuration management over SSH/WinRM, YAML playbooks, procedural, idempotent modules |

### Ansible in 60 seconds
```yaml playbook.yml
- name: Configure web servers
  hosts: web
  become: true
  vars: { app_port: 8080 }
  tasks:
    - name: Install nginx
      ansible.builtin.package: { name: nginx, state: present }
    - name: Deploy config
      ansible.builtin.template: { src: nginx.conf.j2, dest: /etc/nginx/nginx.conf }
      notify: Restart nginx
    - name: Ensure nginx is running
      ansible.builtin.service: { name: nginx, state: started, enabled: true }
  handlers:
    - name: Restart nginx
      ansible.builtin.service: { name: nginx, state: restarted }
```
Concepts: inventory (static/dynamic), modules, playbooks, roles (reusable structure), handlers, variables and facts, Jinja2 templates, **Ansible Vault** for secrets, idempotency, `--check` mode. Typical combo: **Terraform provisions**, **Ansible configures** (or Packer + Ansible bakes images).

# Interview Questions

## Beginner

### What is Infrastructure as Code and why use it?
Managing infrastructure through versioned, machine-readable definitions instead of manual processes. It brings repeatability, consistency across environments, code review, automation, auditability, faster disaster recovery and drift detection.

### What does `terraform plan` do?
It refreshes the known state of real resources, compares it with the configuration, and shows the actions Terraform would take — create, update in place, replace or destroy — without making changes. Saving the plan (`-out`) lets you apply exactly what was reviewed.

### What is a provider?
A plugin that lets Terraform interact with an API — such as AWS, Azure, GCP, Kubernetes or GitHub — exposing resources and data sources. Providers are declared in `required_providers` with version constraints and downloaded by `terraform init`.

### Resource vs data source?
A resource block creates and manages infrastructure. A data source reads information about existing infrastructure or external data (like the latest AMI ID or an existing VPC) without managing it.

### What is the Terraform state file?
A JSON file mapping configuration to real-world resources with their attributes and dependencies. Terraform uses it to plan changes, track metadata and improve performance. It must be stored securely and shared via a remote backend with locking for teams.

## Intermediate

### Why use a remote backend with state locking?
So teams share a single source of truth for state, avoid losing local files, encrypt sensitive data at rest, and prevent concurrent applies from corrupting state — locking ensures only one operation modifies state at a time.

### count vs for_each?
`count` creates N copies indexed by number — removing an item in the middle shifts indexes and may recreate resources. `for_each` iterates over a map or set with stable keys, so items can be added or removed without affecting others. Prefer `for_each` for distinct resources.

### What are Terraform modules and best practices for them?
Reusable packages of Terraform configuration with inputs and outputs. Best practices: keep them focused, version and pin them, document inputs/outputs, avoid hard-coded values and provider configs inside, provide examples, and test them.

### How do you manage multiple environments?
Typically a directory per environment with its own backend and variables, all calling shared versioned modules; or Terragrunt for DRY configuration; or HCP Terraform workspaces. CLI workspaces suit near-identical environments but risk mistakes in production.

### How do you bring existing resources under Terraform?
Write or generate matching configuration and use `import` blocks (or `terraform import`) to add them to state, then run plan until it shows no changes. Terraform 1.5+ can generate configuration for imported resources with `-generate-config-out`.

### How do you handle secrets in Terraform?
Mark variables `sensitive`, supply values from environment variables or CI secret stores, read secrets from vaults at apply time (or have apps fetch them at runtime), encrypt and restrict access to remote state, and never commit `tfvars` containing secrets.

## Advanced

### What is configuration drift and how do you handle it?
Drift is when real infrastructure diverges from Terraform state and code due to manual or external changes. Detect it with scheduled plans or refresh-only plans, then either update the code to match intentional changes or re-apply to revert unauthorised ones, and prevent it with restricted console access and policies.

### How would you structure Terraform for a large organisation?
Versioned shared modules in a registry, separate state per environment and component to limit blast radius, remote backends with locking, CI/CD with plan-on-PR and apply-on-merge, OIDC-based credentials, policy as code (Sentinel/OPA), static analysis and cost checks, clear ownership, and documentation.

### Terraform vs Ansible?
Terraform is declarative provisioning of infrastructure with state, ideal for creating cloud resources. Ansible is agentless configuration management that runs ordered tasks on existing machines, ideal for configuring software. They're complementary: provision with Terraform, configure or bake images with Ansible.

### What happens if two engineers run `terraform apply` at the same time?
With a locking backend, the second run fails to acquire the lock and waits or errors, preventing corruption. Without locking, both could write state concurrently, causing lost updates, duplicate resources or a corrupted state file.

### How do you refactor Terraform code without destroying resources?
Use `moved` blocks (or `terraform state mv`) to map old addresses to new ones when renaming resources or moving them into modules, verify with `terraform plan` that no destroy/create occurs, and apply. Use `removed` blocks to stop managing resources without destroying them.

# Scenario Questions

## Beginner

### Two engineers ran `terraform apply` at the same time and the state got corrupted. How do you prevent this?
Use a **remote backend with state locking**: S3 with native lockfile support (`use_lockfile = true`) or a DynamoDB table, the Azure Storage backend (blob lease) or GCS. Better still, run applies only through CI (Terraform Cloud, Atlantis, GitHub Actions) so humans don't apply from laptops. Turn on versioning on the state bucket for recovery.

## Intermediate

### Someone changed a security group manually in the console. What happens on the next `terraform plan`, and how do you handle drift?
The plan shows the difference and offers to **revert** the change to match the code. Decide whether the manual change is wanted. If it is, add it to the code. If not, apply to revert it. Detect drift with scheduled `plan -detailed-exitcode` runs, and restrict console write access.

### You need to rename a resource in code without destroying and recreating it.
Use a **`moved` block** (Terraform 1.1+), or `terraform state mv`:
```hcl
moved {
  from = aws_instance.web
  to   = aws_instance.app
}
```
To bring existing, unmanaged resources under Terraform, use `import` blocks (1.5+).

## Advanced

### How do you structure Terraform for 3 environments and 20 microservices across multiple teams?
- Reusable, versioned **modules** (a registry, or git tags).
- Separate **state per environment and component** to keep the blast radius small.
- Environment configuration through tfvars or Terragrunt.
- CI that plans on PRs and applies on merge, with policy checks (OPA/Sentinel, Checkov/tfsec).
- Least-privilege, per-environment roles assumed via OIDC.
- Outputs or remote state data sources only for clearly defined interfaces.

# Tricky Questions

## Beginner

### What happens if you change the `name` of an S3 bucket in Terraform?
The plan shows **destroy and recreate** (`-/+`), because the bucket name is a ForceNew attribute. The old bucket's data would be lost, or the destroy fails if the bucket isn't empty. Read the plan carefully, and use `lifecycle { prevent_destroy = true }` on critical resources.

## Intermediate

### `count` vs `for_each`: what goes wrong when you remove the middle item from a `count`-based list?
`count` addresses resources by **index**, so removing item 1 of 3 shifts index 2 into slot 1, and Terraform destroys and recreates resources unnecessarily. `for_each` with a map or set keys resources by **stable string keys**, so only the removed one is destroyed.

### Are secrets safe because you marked the variable `sensitive = true`?
Only partly. `sensitive` hides the value in CLI output, but it's still stored **in plain text in the state file**. Protect state with encryption and access controls, or use ephemeral resources and write-only attributes (Terraform 1.10+/1.11+), or fetch secrets at runtime from a vault.
