---
id: openshift
title: OpenShift
short: OpenShift
category: DevOps & Cloud
order: 16
color: #ee0000
icon: OS
summary: Red Hat's enterprise Kubernetes — projects, Routes, SCCs, BuildConfigs/S2I, ImageStreams, the oc CLI, Operators & OLM, Pipelines, GitOps, monitoring and cluster operations.
---

# Beginner

## What OpenShift Is

**Red Hat OpenShift Container Platform (OCP)** is an enterprise **Kubernetes distribution** with opinionated security defaults, developer tooling, an integrated registry, CI/CD, monitoring and a fully automated operations layer. Everything that works on Kubernetes works on OpenShift — plus extra APIs.

```bash
oc login https://api.cluster.example.com:6443 --web
oc new-project shop
oc new-app nodejs~https://github.com/acme/shop-api.git --name api   # S2I build + Deployment + Service
oc expose service/api                                               # Route with a hostname
oc get route api -o jsonpath='{.spec.host}'
oc get clusterversion; oc get co                                    # cluster version + operators
```

### Flavours
- **OCP** — self-managed on-premises/cloud.
- **OKD** — the community upstream distribution.
- **ROSA** (AWS), **ARO** (Azure), **OpenShift Dedicated** — managed services.
- **OpenShift Local** (formerly CodeReady Containers) — single-node cluster on a laptop.
- **Single Node OpenShift**, **MicroShift** — edge.

### OpenShift vs vanilla Kubernetes

| Area | Kubernetes | OpenShift |
|---|---|---|
| Distribution | build/choose your own components | integrated, supported platform |
| Node OS | any Linux | **RHCOS** (immutable, managed by the cluster) for control plane |
| Runtime | containerd/CRI-O | **CRI-O** |
| Security | permissive defaults | **SCCs**: non-root, random UID by default |
| External access | Ingress (BYO controller) | **Routes** + built-in HAProxy router (Ingress also supported) |
| Builds | external CI | **BuildConfig, S2I, Shipwright builds**, internal registry |
| Multi-tenancy | Namespaces | **Projects** (namespaces + extras) |
| Upgrades | manual per component | over-the-air via **Cluster Version Operator** |
| Console | Dashboard add-on | rich web console (Admin + Developer perspectives) |
| Operators | optional | core: everything is an Operator, **OLM**/OperatorHub |

## The oc CLI and Projects

`oc` is a superset of `kubectl` (all kubectl commands work) plus OpenShift-specific commands.

```bash
oc login https://api.cluster.example.com:6443 --token=sha256~...
oc whoami && oc whoami --show-console
oc new-project shop --display-name="Shop" --description="Online store"
oc project shop                     # switch project
oc get pods,svc,route
oc status                           # overview of the project
oc logs -f deploy/api
oc rsh deploy/api                   # remote shell
oc debug deploy/api                 # copy of the pod with a shell (even if crashing)
oc debug node/worker-1              # host shell on a node: chroot /host
oc adm top pods
oc explain route.spec
```

### Projects
A **Project** is a Kubernetes namespace with additional annotations, default RBAC, and a self-service request flow (`oc new-project` creates a `ProjectRequest`). Admins can template default quotas, limit ranges and network policies for new projects.

## Deploying Applications

### From an image
```bash
oc new-app --image=quay.io/acme/api:1.4.2 --name=api -e LOG_LEVEL=info
oc expose service/api                 # creates a Route
oc get route api -o jsonpath='{.spec.host}'
```

### From source code (S2I)
```bash
oc new-app python:3.12~https://github.com/acme/flask-app.git --name=web
oc logs -f bc/web                     # follow the build
oc start-build web --follow           # rebuild
```

### From a Git repo with a Dockerfile
```bash
oc new-app https://github.com/acme/api.git --strategy=docker
```

`oc new-app` generates a Deployment, Service, ImageStream and (for source builds) a BuildConfig. In production, teams usually manage YAML via Helm/Kustomize + GitOps instead.

> [!NOTE]
> Older OpenShift used **DeploymentConfig** (with triggers and lifecycle hooks). It is **deprecated** since 4.14 — use standard Kubernetes **Deployments**.

## Routes

A **Route** exposes a Service at an external hostname via the built-in **OpenShift router** (HAProxy-based Ingress Controller).

```yaml route.yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: api
spec:
  host: api.apps.cluster.example.com      # optional; auto-generated if omitted
  to: { kind: Service, name: api, weight: 100 }
  port: { targetPort: 8080-tcp }
  tls:
    termination: edge                      # edge | passthrough | reencrypt
    insecureEdgeTerminationPolicy: Redirect
```

### TLS termination types

| Type | TLS terminates at | Router → pod |
|---|---|---|
| **edge** | router | plain HTTP |
| **passthrough** | the pod (router just forwards TCP via SNI) | encrypted end-to-end, router can't inspect HTTP |
| **re-encrypt** | router, then new TLS to the pod | encrypted with a different (often internal) certificate |

Routes also support **traffic splitting** (`alternateBackends` with weights) for blue/green and A/B, sticky sessions via cookies, path-based routing, rate limiting and timeouts through annotations (`haproxy.router.openshift.io/timeout: 60s`).

Route vs Ingress: OpenShift converts Ingress objects into Routes automatically; Routes predate Ingress and offer more TLS options and weighting out of the box.

## Security Context Constraints (SCC)

The #1 surprise when moving apps to OpenShift: **containers don't run as root**.

By default, Pods get the **`restricted-v2`** SCC:
- Run with an **arbitrary UID** from the project's assigned range (e.g., `1000680000`) and GID **0** (root group).
- Cannot run privileged, cannot escalate privileges, all capabilities dropped (except `NET_BIND_SERVICE`), seccomp `RuntimeDefault`.
- Cannot use host network/ports/paths.

### Making images OpenShift-friendly
```dockerfile
FROM registry.access.redhat.com/ubi9/nodejs-22
WORKDIR /opt/app-root/src
COPY --chown=1001:0 . .
RUN npm ci --omit=dev && \
    chgrp -R 0 /opt/app-root && chmod -R g=u /opt/app-root   # group-writable for the root group
USER 1001
EXPOSE 8080                                                  # >1024: non-root can't bind 80
CMD ["node", "server.js"]
```
- Listen on ports **above 1024** (8080).
- Make writable directories owned by group 0 with group write permissions.
- Don't rely on a specific UID or on writing to `/`.
- Use **UBI** (Universal Base Images) — freely redistributable RHEL-based images.

### Granting a different SCC (only when justified)
```bash
oc create sa legacy-app
oc adm policy add-scc-to-user anyuid -z legacy-app      # allows running as the image's UID (incl. root)
oc set serviceaccount deployment/legacy legacy-app
oc get pod mypod -o yaml | grep openshift.io/scc         # which SCC was applied
```
Built-in SCCs: `restricted-v2`, `nonroot-v2`, `anyuid`, `hostnetwork-v2`, `hostmount-anyuid`, `privileged`. SCCs work alongside Kubernetes Pod Security Admission.

# Intermediate

## Builds: BuildConfig, S2I and ImageStreams

### Build strategies
| Strategy | How |
|---|---|
| **Source-to-Image (S2I)** | builder image + source repo → runnable image without writing a Dockerfile |
| **Docker** | builds a Dockerfile in the cluster |
| **Custom** | your own builder image |
| **Pipeline** (deprecated Jenkins) | replaced by OpenShift Pipelines (Tekton) |

```yaml buildconfig.yaml
apiVersion: build.openshift.io/v1
kind: BuildConfig
metadata: { name: api }
spec:
  source:
    git: { uri: https://github.com/acme/api.git, ref: main }
    contextDir: services/api
  strategy:
    sourceStrategy:
      from: { kind: ImageStreamTag, name: python:3.12-ubi9, namespace: openshift }
  output:
    to: { kind: ImageStreamTag, name: api:latest }
  triggers:
    - type: GitHub
      github: { secretReference: { name: gh-webhook } }
    - type: ImageChange          # rebuild when the builder image is patched
    - type: ConfigChange
```

### S2I flow
1. Pulls the builder image (e.g., `python:3.12-ubi9`).
2. Injects source and runs the builder's `assemble` script (installs deps).
3. Commits a new image whose `run` script starts the app.
4. Pushes to the internal registry.

Benefits: developers don't write Dockerfiles; security patches to builder images can trigger rebuilds of all apps automatically.

### ImageStreams
An **ImageStream** is an abstraction pointing to images (in the internal or external registries) by tags. It enables:
- **Triggers** — redeploy when a tag updates (`image.openshift.io/triggers` annotation on Deployments).
- **Promotion** between environments: `oc tag shop-dev/api:latest shop-prod/api:1.4.2`.
- Periodic re-import of external tags (`--scheduled`) and stable references by digest.

**Shipwright / Builds for OpenShift** is the newer Kubernetes-native build framework (Buildah, S2I, Buildpacks strategies).

## Internal Registry, Templates and Helm

- The **integrated image registry** (`image-registry.openshift-image-registry.svc:5000`) stores built images; expose it with a route for external pushes. Pull across projects requires `system:image-puller` rights.
- **Templates** — parameterised object lists (`oc process -f template.yaml -p NAME=api | oc apply -f -`). Older mechanism; Helm charts are now preferred and the console has a Helm catalog.
- **Pull secrets** for external registries: `oc create secret docker-registry quay-creds ...` then `oc secrets link default quay-creds --for=pull`.

```bash
oc patch configs.imageregistry.operator.openshift.io/cluster --type merge -p '{"spec":{"defaultRoute":true}}'
HOST=$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}')
podman login -u $(oc whoami) -p $(oc whoami -t) $HOST
podman push $HOST/shop/api:1.0
oc policy add-role-to-user system:image-puller system:serviceaccount:prod:default -n shop  # cross-project pull
oc process -f template.yaml -p APP_NAME=api -p REPLICAS=3 | oc apply -f -
helm install api ./chart -n shop
```

## Operators and OperatorHub (OLM)

OpenShift itself is run by Operators:
- **Cluster Version Operator (CVO)** orchestrates platform upgrades.
- **Cluster Operators** manage each component (`oc get clusteroperators` / `oc get co` — check `AVAILABLE`, `PROGRESSING`, `DEGRADED`).
- **Machine Config Operator** manages node OS configuration (RHCOS) via `MachineConfig` objects.

### OLM (Operator Lifecycle Manager)
Installs and upgrades add-on Operators from catalogs (**OperatorHub** in the console):
```yaml
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata: { name: openshift-pipelines-operator-rh, namespace: openshift-operators }
spec:
  channel: latest
  name: openshift-pipelines-operator-rh
  source: redhat-operators
  sourceNamespace: openshift-marketplace
  installPlanApproval: Manual        # require approval for upgrades
```
Key OLM objects: `CatalogSource`, `Subscription`, `InstallPlan`, `ClusterServiceVersion (CSV)`, `OperatorGroup`.

Popular Operators: OpenShift Pipelines (Tekton), OpenShift GitOps (Argo CD), Service Mesh (Istio), Serverless (Knative), Data Foundation (Ceph storage), cert-manager, AMQ Streams (Kafka), Crunchy/CloudNativePG (Postgres), OpenShift AI.

## CI/CD: OpenShift Pipelines and GitOps

### OpenShift Pipelines (Tekton)
Kubernetes-native CI: each step runs in a container.
- **Task** — sequence of steps (containers). **Pipeline** — ordered/parallel tasks. **PipelineRun/TaskRun** — executions. **Workspaces** share data (PVCs). **Triggers** start runs from webhooks. **Pipelines as Code** keeps pipeline definitions in the repo (`.tekton/`).

```yaml
apiVersion: tekton.dev/v1
kind: Pipeline
metadata: { name: build-and-deploy }
spec:
  params: [{ name: git-url }, { name: image }]
  workspaces: [{ name: source }]
  tasks:
    - name: clone
      taskRef: { resolver: cluster, params: [{ name: name, value: git-clone }, { name: namespace, value: openshift-pipelines }, { name: kind, value: task }] }
      params: [{ name: URL, value: $(params.git-url) }]
      workspaces: [{ name: output, workspace: source }]
    - name: build
      runAfter: [clone]
      taskRef: { resolver: cluster, params: [{ name: name, value: buildah }, { name: namespace, value: openshift-pipelines }, { name: kind, value: task }] }
      params: [{ name: IMAGE, value: $(params.image) }]
      workspaces: [{ name: source, workspace: source }]
```

### OpenShift GitOps (Argo CD)
Declarative continuous delivery: Argo CD `Application`s sync manifests from Git into clusters, with drift detection, automated sync, self-heal and multi-cluster support (ApplicationSets).

Typical flow: **Git push → Tekton builds, tests, scans, pushes image → updates image tag in a GitOps repo → Argo CD deploys to dev → PR promotes to staging/prod.**

## Networking, Quotas and Multi-Tenancy

- **CNI**: OVN-Kubernetes (default; supports NetworkPolicy, egress IPs, egress firewall, multicast, hybrid networking). OpenShift SDN is removed in newer versions.
- **NetworkPolicy** for pod-level isolation; **AdminNetworkPolicy** for cluster-wide admin rules; **EgressFirewall** to restrict outbound destinations; **EgressIP** for stable source IPs to external firewalls.
- **Ingress Controllers**: multiple router shards (e.g., internal vs public) using route labels/namespace selectors.
- **ResourceQuota** and **LimitRange** per project; **ClusterResourceQuota** spanning multiple projects (by label/annotation).
- **Project request template** to auto-apply quotas, limits and default network policies to every new project.

```bash
oc create quota shop-quota --hard=pods=50,requests.cpu=10,requests.memory=20Gi,limits.memory=40Gi
oc describe quota -n shop
```

# Advanced

## Cluster Architecture and Installation

```yaml install-config.yaml (IPI on AWS, trimmed)
apiVersion: v1
baseDomain: example.com
metadata: { name: prod }
controlPlane: { name: master, replicas: 3, platform: { aws: { type: m6i.xlarge } } }
compute: [{ name: worker, replicas: 3, platform: { aws: { type: m6i.2xlarge } } }]
networking: { networkType: OVNKubernetes, clusterNetwork: [{ cidr: 10.128.0.0/14, hostPrefix: 23 }] }
platform: { aws: { region: eu-west-1 } }
pullSecret: '…'
sshKey: 'ssh-ed25519 AAAA…'
```
```bash
openshift-install create cluster --dir ./prod --log-level=info
oc label node infra-1 node-role.kubernetes.io/infra=""
```

### Node roles
- **Control plane** (3 nodes): API server, etcd, controllers, scheduler, plus OpenShift API server and OAuth server. Runs on RHCOS.
- **Compute (worker)** nodes run workloads (RHCOS or RHEL).
- **Infrastructure nodes** (labelled workers) host router, registry, monitoring, logging — often excluded from subscription counts.

### Installation methods
- **IPI** (Installer-Provisioned Infrastructure) — the installer creates infrastructure (VMs, networks, LBs, DNS) on AWS/Azure/GCP/vSphere/bare metal.
- **UPI** (User-Provisioned) — you prepare infrastructure; installer generates Ignition configs.
- **Agent-based / Assisted Installer** — for disconnected/bare-metal and SNO.
- `install-config.yaml` defines platform, networking (`clusterNetwork`, `serviceNetwork`, `machineNetwork`), pull secret, SSH key.

### Machine API
`MachineSet`s declare desired worker machines per zone; `MachineAutoscaler` + `ClusterAutoscaler` scale nodes automatically; `MachineHealthCheck` replaces unhealthy machines.

### MachineConfig
Node OS settings (kernel args, files, systemd units, chrony) are changed only through `MachineConfig` objects applied to `MachineConfigPool`s (`master`, `worker`, custom). The MCO drains and reboots nodes one by one to apply them. **Don't SSH-modify RHCOS nodes manually.**

## Upgrades and Day-2 Operations

- Upgrades are **over-the-air**: choose a **channel** (`stable-4.x`, `fast-4.x`, `eus-4.x`), CVO applies the release payload; cluster operators update, then MCO rolls nodes.
```bash
oc adm upgrade                         # available updates
oc adm upgrade --to=4.x.y
oc get clusterversion
oc get co                              # all should be Available=True, Degraded=False
oc get mcp                             # MachineConfigPool rollout progress
```
- Pause worker pools during sensitive windows (`oc patch mcp worker --type merge -p '{"spec":{"paused":true}}'`).
- **etcd backups**: `cluster-backup.sh` on a control-plane node; know the disaster recovery procedure.
- **Certificates** rotate automatically; check `oc get csr` and approve pending node CSRs when adding nodes.
- **Must-gather** for support: `oc adm must-gather`; `oc adm inspect ns/shop` for namespace diagnostics.
- Node maintenance: `oc adm cordon`, `oc adm drain --ignore-daemonsets --delete-emptydir-data`, `oc adm uncordon`.
- **Disconnected (air-gapped)** clusters mirror release images and operator catalogs with **oc-mirror** to a local registry.

## Authentication, Authorization and Compliance

- Built-in **OAuth server** with identity providers: HTPasswd, LDAP, Keycloak/OIDC, GitHub, GitLab, Google.
```yaml
apiVersion: config.openshift.io/v1
kind: OAuth
metadata: { name: cluster }
spec:
  identityProviders:
    - name: corp-sso
      mappingMethod: claim
      type: OpenID
      openID:
        clientID: openshift
        clientSecret: { name: oidc-secret }
        issuer: https://sso.example.com/realms/corp
        claims: { preferredUsername: [preferred_username], email: [email], groups: [groups] }
```
- Remove the temporary `kubeadmin` user after configuring an IdP.
- RBAC: `oc adm policy add-role-to-user edit alice -n shop`, `add-cluster-role-to-group cluster-reader auditors`; group sync from LDAP.
- Default roles: `admin`, `edit`, `view`, `cluster-admin`, `self-provisioner`.
- **Compliance Operator** (OpenSCAP — CIS, PCI-DSS, NIST profiles), **File Integrity Operator**, audit logs, **Red Hat Advanced Cluster Security (ACS/StackRox)** for vulnerability management, runtime detection and admission policies; **Advanced Cluster Management (ACM)** for multi-cluster governance.

## Observability: Monitoring and Logging

### Monitoring
- Pre-installed **Prometheus + Alertmanager + Thanos Querier** for platform metrics, dashboards in the console.
- **User workload monitoring** (enable in `cluster-monitoring-config` ConfigMap) lets teams scrape their own apps with `ServiceMonitor`/`PodMonitor` and create `PrometheusRule` alerts.
```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata: { name: api, namespace: shop }
spec:
  selector: { matchLabels: { app: api } }
  endpoints: [{ port: metrics, interval: 30s, path: /metrics }]
```

### Logging
**OpenShift Logging** (Vector collector → **LokiStack** storage, or forwarding to Splunk/Elasticsearch/Kafka/cloud) via `ClusterLogForwarder`. Logs categories: application, infrastructure, audit.

### Tracing
Distributed tracing with **Tempo** + **OpenTelemetry** Operator; network observability Operator for flow logs.

## Troubleshooting OpenShift-Specific Issues

| Issue | Cause | Fix |
|---|---|---|
| `Permission denied` writing files / `CrashLoopBackOff` right after migrating an image | random non-root UID can't write to dirs owned by root/UID 1000 | `chgrp -R 0 && chmod -R g=u`, write to `/tmp` or volumes, use UBI images |
| App fails to bind port 80/443 | non-root can't bind privileged ports | listen on 8080/8443 |
| Pod rejected: `unable to validate against any security context constraint` | needs privileges not allowed by `restricted-v2` | fix the image, or grant a specific SCC to a dedicated ServiceAccount |
| Route returns 503 "Application is not available" | no ready endpoints: wrong service selector/port, failing readiness | `oc get endpoints`, `oc describe route`, check probes |
| Route TLS errors | wrong termination type or cert/hostname mismatch | match termination to the app; re-encrypt needs `destinationCACertificate` |
| ImagePullBackOff from internal registry across projects | missing pull rights | `oc policy add-role-to-user system:image-puller system:serviceaccount:prod:default -n dev` |
| Build fails | builder image, network/proxy, git auth | `oc logs bc/x`, `oc describe build`, source secrets |
| Cluster operator `Degraded` | component failure | `oc describe co <name>`, operator pod logs, `must-gather` |
| Node `NotReady` / MCP stuck | MachineConfig rollout or kubelet issue | `oc describe mcp`, `oc debug node/x`, `journalctl -u kubelet` |

```dockerfile Make an image arbitrary-UID friendly
FROM registry.access.redhat.com/ubi9/nodejs-20
USER 0
COPY . /opt/app-root/src
RUN chgrp -R 0 /opt/app-root && chmod -R g=u /opt/app-root
USER 1001
EXPOSE 8080
```
```bash
oc get pod api-1 -o jsonpath='{.metadata.annotations.openshift\.io/scc}'   # which SCC admitted it
oc adm policy who-can use scc anyuid
oc debug deploy/api --as-root=false                                         # same pod, shell instead of entrypoint
```

# Interview Questions

## Beginner

### What is OpenShift and how does it relate to Kubernetes?
OpenShift is Red Hat's enterprise Kubernetes platform. It includes upstream Kubernetes plus integrated components and APIs: secure defaults (SCCs), Routes, an internal registry, builds (S2I), a developer/admin web console, monitoring, logging, CI/CD (Tekton) and GitOps (Argo CD), all managed and upgraded by Operators on RHCOS.

```bash
kubectl get deployments -n shop     # every Kubernetes API works on OpenShift
oc get routes,buildconfigs,imagestreams -n shop   # plus OpenShift-specific APIs
oc api-resources --api-group=route.openshift.io
```

### What is a Project in OpenShift?
A Kubernetes namespace with extra metadata and default policies. It isolates resources, RBAC, quotas and network policies for a team or application, and can be self-provisioned by users with `oc new-project`.

```bash
oc new-project payments --display-name="Payments" --description="Payments team"
oc adm policy add-role-to-group edit payments-devs -n payments
oc get project payments -o yaml          # a Namespace with openshift.io/* annotations
oc project payments                      # switch context
```

### What is a Route?
An OpenShift object that exposes a Service at an external hostname through the built-in HAProxy router, supporting edge, passthrough and re-encrypt TLS termination, weighted traffic splitting and sticky sessions.

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata: { name: api }
spec:
  host: api.apps.example.com
  to: { kind: Service, name: api, weight: 100 }
  port: { targetPort: 8080-tcp }
  tls: { termination: edge, insecureEdgeTerminationPolicy: Redirect }
```

### What is `oc` and how is it different from `kubectl`?
`oc` is the OpenShift CLI. It supports every `kubectl` command plus OpenShift features: `oc login`, `new-project`, `new-app`, `start-build`, `expose`, `rsh`, `debug`, `adm` (policy, upgrade, must-gather, node maintenance).

```bash
oc login --token=sha256~… --server=https://api.cluster:6443
oc new-app python~https://github.com/acme/flask-api.git
oc start-build api --follow
oc rsh deploy/api                       # remote shell into a pod
oc debug node/worker-1                  # host shell on a node
oc adm top nodes; oc adm must-gather    # admin tooling
oc get pods                             # identical to kubectl get pods
```

### Why does my container work in Docker but fail in OpenShift?
Most often because OpenShift runs containers with an arbitrary non-root UID under the `restricted-v2` SCC. Images that write to root-owned paths, bind to ports below 1024 or require root fail. Fix by making directories group-writable by GID 0, using ports ≥1024 and non-root-friendly base images (UBI).

```bash
oc logs api-1   # nginx: [emerg] bind() to 0.0.0.0:80 failed (13: Permission denied)
                # mkdir: cannot create directory '/app/cache': Permission denied
oc rsh api-1 id # uid=1000680000(1000680000) gid=0(root) groups=0(root),1000680000
```
```nginx Fix: listen on an unprivileged port and write to writable paths
listen 8080;
client_body_temp_path /tmp/client_temp;
pid /tmp/nginx.pid;
```

### What is Source-to-Image (S2I)?
A build strategy that takes application source code and a language builder image and produces a runnable container image without a Dockerfile. The builder's `assemble` script installs dependencies; its `run` script starts the app.

```bash
oc new-app registry.access.redhat.com/ubi9/python-311~https://github.com/acme/api.git --name api
oc logs -f bc/api                     # assemble script: pip install -r requirements.txt
s2i build . registry.access.redhat.com/ubi9/python-311 api:local   # same thing locally
```
```text .s2i/environment
APP_MODULE=app.main:app
PIP_INDEX_URL=https://nexus.example.com/repository/pypi/simple
```

## Intermediate

### Explain SCCs.
Security Context Constraints are OpenShift admission policies controlling what Pods may do: run as which UID/GID, use privileged mode, host networking/paths, capabilities, volume types, SELinux and seccomp. Pods are admitted under the most restrictive SCC that fits their ServiceAccount's permissions; `restricted-v2` is the default.

```bash
oc get scc
# restricted-v2  MustRunAsRange  no privileged, drop ALL caps, random UID   ← default
# anyuid         RunAsAny        any UID incl. root
# privileged     everything
oc describe scc restricted-v2
oc adm policy add-scc-to-user nonroot-v2 -z api-sa -n shop
```

### Edge vs passthrough vs re-encrypt routes?
Edge: TLS terminates at the router, traffic to the pod is HTTP. Passthrough: router forwards encrypted traffic using SNI; the pod terminates TLS (end-to-end encryption, no HTTP-level features). Re-encrypt: router terminates client TLS and opens a new TLS connection to the pod, typically with an internal certificate.

```bash
oc create route edge      web  --service=web --hostname=web.apps.example.com      # TLS ends at router
oc create route passthrough db-ui --service=db-ui --port=8443                       # pod terminates TLS
oc create route reencrypt api --service=api --dest-ca-cert=service-ca.crt         # router → pod TLS again
oc annotate service api service.beta.openshift.io/serving-cert-secret-name=api-tls # auto cert for re-encrypt
```

### What is an ImageStream and why use it?
An object that tracks images by tags, abstracting registry locations. It enables automatic rebuilds/redeploys on image changes via triggers, promotion between projects with `oc tag`, and scheduled imports of external images — useful for patch rollouts.

```bash
oc import-image ubi-node --from=registry.access.redhat.com/ubi9/nodejs-20 --confirm --scheduled
oc tag shop/api:latest shop/api:qa                     # promotion without rebuilding
oc set triggers deploy/api --from-image=shop/api:qa -c api   # redeploy when the tag moves
oc get is api -o jsonpath='{.status.tags[*].tag}'
```

### DeploymentConfig vs Deployment?
DeploymentConfig was OpenShift's original deployment object with triggers, lifecycle hooks and custom strategies, implemented by a deployer pod. It's deprecated; standard Kubernetes Deployments (with image trigger annotations) are the recommended replacement.

```yaml Deployment with an ImageStream trigger annotation
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  annotations:
    image.openshift.io/triggers: '[{"from":{"kind":"ImageStreamTag","name":"api:latest"},"fieldPath":"spec.template.spec.containers[?(@.name==\"api\")].image"}]'
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec: { containers: [{ name: api, image: " " }] }
```

### How does CI/CD work on OpenShift?
OpenShift Pipelines (Tekton) runs CI as Kubernetes-native tasks — clone, test, build with Buildah/S2I, scan, push to a registry. OpenShift GitOps (Argo CD) handles CD by syncing manifests from Git into clusters. Webhooks/Pipelines-as-Code trigger runs; promotion happens through Git PRs.

```yaml Tekton Pipeline (OpenShift Pipelines)
apiVersion: tekton.dev/v1
kind: Pipeline
metadata: { name: api-ci }
spec:
  params: [{ name: git-url }, { name: image }]
  workspaces: [{ name: src }]
  tasks:
    - name: clone
      taskRef: { resolver: cluster, params: [{ name: name, value: git-clone }, { name: namespace, value: openshift-pipelines }, { name: kind, value: task }] }
      params: [{ name: URL, value: $(params.git-url) }]
      workspaces: [{ name: output, workspace: src }]
    - name: build
      runAfter: [clone]
      taskRef: { resolver: cluster, params: [{ name: name, value: buildah }, { name: namespace, value: openshift-pipelines }, { name: kind, value: task }] }
      params: [{ name: IMAGE, value: $(params.image) }]
      workspaces: [{ name: source, workspace: src }]
```

### What is OLM and OperatorHub?
The Operator Lifecycle Manager installs, upgrades and manages dependencies of Operators. OperatorHub is the catalog UI. Admins create Subscriptions to channels; OLM resolves InstallPlans and deploys ClusterServiceVersions, with manual or automatic upgrade approval.

```yaml
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata: { name: openshift-gitops-operator, namespace: openshift-operators }
spec:
  channel: latest
  name: openshift-gitops-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
  installPlanApproval: Manual         # approve upgrades explicitly
```
```bash
oc get csv -n openshift-operators; oc get installplan -n openshift-operators
```

### How do you give a workload permission to run as a specific user?
Create a dedicated ServiceAccount, grant it an appropriate SCC (`oc adm policy add-scc-to-user anyuid -z my-sa` or a custom SCC), assign the ServiceAccount to the Deployment. Prefer fixing the image to run as non-root instead of loosening security.

```bash
oc create sa legacy-sa -n shop
oc adm policy add-scc-to-user anyuid -z legacy-sa -n shop
oc set serviceaccount deploy/legacy legacy-sa -n shop
```
```yaml
spec:
  template:
    spec:
      serviceAccountName: legacy-sa
      securityContext: { runAsUser: 1000 }
```

## Advanced

### How are OpenShift upgrades performed?
The Cluster Version Operator applies a release payload from the selected channel. Cluster Operators upgrade their components in order, then the Machine Config Operator updates RHCOS nodes pool by pool (cordon, drain, reboot). Monitor with `oc get clusterversion`, `oc get co` and `oc get mcp`; use PDBs so workloads stay available during node rollouts.

```bash
oc adm upgrade                                  # current version + available updates
oc adm upgrade channel stable-4.16
oc adm upgrade --to=4.16.12
oc get clusterversion -w; oc get co; oc get mcp  # operators, then MachineConfigPools roll nodes
```

### What is the Machine Config Operator?
It manages the operating system configuration of RHCOS nodes declaratively through MachineConfig objects applied to MachineConfigPools. It renders a combined configuration and rolls it out node by node, ensuring nodes are immutable and consistent rather than manually configured.

```yaml
apiVersion: machineconfiguration.openshift.io/v1
kind: MachineConfig
metadata: { name: 99-worker-chrony, labels: { machineconfiguration.openshift.io/role: worker } }
spec:
  config:
    ignition: { version: 3.4.0 }
    storage:
      files:
        - path: /etc/chrony.conf
          mode: 0644
          contents: { source: "data:,server%20ntp.example.com%20iburst%0A" }
```
```bash
oc get mcp worker -w      # nodes drain and reboot one at a time
```

### IPI vs UPI installation?
In IPI the installer provisions all infrastructure (VMs, networking, load balancers, DNS) and manages machines via the Machine API — fastest and fully automated. In UPI you provide the infrastructure yourself and boot nodes with installer-generated Ignition configs — for custom or restricted environments.

```bash IPI: the installer builds everything
openshift-install create cluster --dir prod
```
```bash UPI: you provision infra, the installer generates ignition
openshift-install create manifests --dir prod
openshift-install create ignition-configs --dir prod     # bootstrap.ign, master.ign, worker.ign
# → create VMs/LBs/DNS yourself (Terraform, vSphere…) and boot RHCOS with these ignition files
openshift-install wait-for bootstrap-complete --dir prod
```

### How would you set up multi-tenancy on OpenShift?
Projects per team/app with RBAC groups synced from LDAP/SSO, a project request template applying ResourceQuotas, LimitRanges and default-deny NetworkPolicies, ClusterResourceQuotas across multiple projects, router sharding for internal vs external apps, SCCs restricting privileges, and governance via ACM/ACS policies.

```bash
oc adm create-bootstrap-project-template -o yaml > template.yaml   # add quota, limits, netpol
oc create -f template.yaml -n openshift-config
oc patch project.config.openshift.io/cluster --type merge -p '{"spec":{"projectRequestTemplate":{"name":"project-request"}}}'
oc adm groups sync --sync-config=ldap-sync.yaml --confirm
```

### How do you monitor applications on OpenShift?
Enable user workload monitoring, expose `/metrics` from apps, define ServiceMonitors/PodMonitors and PrometheusRules for alerts routed through Alertmanager, view dashboards in the console; collect logs with the logging stack (Vector + Loki or forwarding) and traces with Tempo/OpenTelemetry.

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: cluster-monitoring-config, namespace: openshift-monitoring }
data: { config.yaml: "enableUserWorkload: true" }
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata: { name: api, namespace: shop }
spec:
  selector: { matchLabels: { app: api } }
  endpoints: [{ port: http, path: /metrics, interval: 30s }]
---
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata: { name: api-alerts, namespace: shop }
spec:
  groups:
    - name: api
      rules:
        - alert: HighErrorRate
          expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
          for: 10m
```

### How do you install OpenShift in an air-gapped environment?
Mirror release images and required operator catalogs to an internal registry with `oc-mirror`, configure `imageContentSourcePolicy`/`ImageDigestMirrorSet`, provide the mirror registry CA and pull secret in `install-config.yaml`, use the agent-based or UPI installer, and disable default online catalog sources in favour of mirrored ones.

```yaml imageset-config.yaml
apiVersion: mirror.openshift.io/v2alpha1
kind: ImageSetConfiguration
mirror:
  platform: { channels: [{ name: stable-4.16, minVersion: 4.16.10, maxVersion: 4.16.12 }] }
  operators:
    - catalog: registry.redhat.io/redhat/redhat-operator-index:v4.16
      packages: [{ name: openshift-gitops-operator }, { name: openshift-pipelines-operator-rh }]
```
```bash
oc mirror --v2 -c imageset-config.yaml file://mirror           # on the connected side
oc mirror --v2 -c imageset-config.yaml --from file://mirror docker://registry.internal:5000  # inside
```

# Scenario Questions

## Beginner

### An image that runs fine on plain Kubernetes fails on OpenShift with "permission denied". Why?
OpenShift's `restricted-v2` SCC runs containers as a **random, non-root UID** that belongs to group 0. Images that write to root-owned directories, or bind to ports below 1024, fail. Fix the image: `chgrp -R 0 /app && chmod -R g=u /app`, listen on 8080, and don't assume a fixed UID. Granting `anyuid` should be a last resort.

```dockerfile
RUN mkdir -p /app/data && chgrp -R 0 /app && chmod -R g=u /app   # group 0 can write
USER 1001
ENV PORT=8080                                                      # no ports < 1024
```

## Intermediate

### Your Route returns "Application is not available". How do you debug it?
Work along the chain **Route → Service → Endpoints → Pod**:
- Does the Route point at the right Service and `targetPort`?
- Does the Service have endpoints (`oc get endpoints`)?
- Are the pods ready (readiness probe)?
- Does the TLS termination type match the app (edge, passthrough or reencrypt)?
- Is a NetworkPolicy blocking the router namespace?

```bash
oc describe route api | grep -E 'Service|Port|Endpoints'
oc get endpoints api                       # <none> → selector/readiness problem
oc get pods -l app=api -o wide             # Running but 0/1 Ready?
oc rsh deploy/api curl -s localhost:8080/health
oc get svc api -o jsonpath='{.spec.ports}' # targetPort matches containerPort?
```

### Builds work in dev but your team wants promotion across dev → test → prod without rebuilding. How do you set that up?
Build once, then **promote the same image** by tag or digest. Use `oc tag` on ImageStreams between projects, or push to an external registry and update the GitOps manifests per environment (Argo CD / OpenShift GitOps with kustomize overlays). Keep config in ConfigMaps and Secrets per environment, not baked into the image.

```bash
DIGEST=$(oc get istag api:latest -n dev -o jsonpath='{.image.metadata.name}')
oc tag dev/api@$DIGEST test/api:current      # promote by immutable digest
oc tag test/api:current prod/api:current     # after tests pass
```
```yaml GitOps alternative (kustomization in the prod repo)
images: [{ name: api, newName: quay.io/acme/api, digest: "sha256:3f1c…" }]
```

## Advanced

### You need to give one team self-service namespaces while enforcing quotas and security. How?
- Use a **project template** with a default ResourceQuota, LimitRange, NetworkPolicy (deny-by-default) and RoleBindings.
- Use RBAC groups synced from LDAP or OIDC.
- Enforce policies with Gatekeeper or Kyverno (or OpenShift's admission plugins).
- Keep restricted SCCs by default.
- Let Argo CD AppProjects scope which clusters and namespaces each team can deploy to.

```yaml Project request template objects (excerpt)
- apiVersion: v1
  kind: ResourceQuota
  metadata: { name: quota }
  spec: { hard: { requests.cpu: "8", requests.memory: 16Gi, persistentvolumeclaims: "10" } }
- apiVersion: v1
  kind: LimitRange
  metadata: { name: defaults }
  spec: { limits: [{ type: Container, default: { cpu: 500m, memory: 512Mi }, defaultRequest: { cpu: 100m, memory: 128Mi } }] }
- apiVersion: networking.k8s.io/v1
  kind: NetworkPolicy
  metadata: { name: deny-other-namespaces }
  spec: { podSelector: {}, ingress: [{ from: [{ podSelector: {} }] }] }
```

# Tricky Questions

## Intermediate

### Is a DeploymentConfig the same as a Deployment?
No. **DeploymentConfig** is OpenShift-specific: it has triggers on ImageStream changes and lifecycle hooks, and it's **deprecated** since 4.14. Kubernetes **Deployments** are the recommended choice; use image-trigger annotations if you need automatic rollouts when the image changes.

```bash
oc get dc,deploy -n legacy
oc new-app --as-deployment-config=false …    # new-app creates a Deployment by default since 4.x
```

### `oc new-app` created a BuildConfig and you pushed a fix, but nothing rebuilt. Why?
A BuildConfig only rebuilds on configured **triggers**: a GitHub or generic webhook, an ImageChange of the builder image, or a ConfigChange. A git push doesn't reach the cluster unless a webhook is set up (and the cluster is reachable from the git host). Start a build manually with `oc start-build`.

```bash
oc describe bc/api | grep -A3 Webhook
oc set triggers bc/api --from-github
SECRET=$(oc get bc api -o jsonpath='{.spec.triggers[?(@.type=="GitHub")].github.secret}')
echo "$(oc whoami --show-server)/apis/build.openshift.io/v1/namespaces/shop/buildconfigs/api/webhooks/$SECRET/github"
# add that URL as a GitHub webhook — or trigger manually:
oc start-build api --follow
```
