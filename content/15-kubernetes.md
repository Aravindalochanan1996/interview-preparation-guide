---
id: kubernetes
title: Kubernetes
short: Kubernetes
category: DevOps & Cloud
order: 15
color: #326ce5
icon: K8s
summary: Architecture, Pods, Deployments, Services, Ingress, config & secrets, storage, probes, scheduling, autoscaling, RBAC, Helm, operators and troubleshooting.
---

# Beginner

## Why Kubernetes and Its Architecture

Kubernetes (K8s) is an open-source **container orchestration** platform: it schedules containers across a cluster of machines, keeps them running, scales them, exposes them on the network and rolls out updates.

It works declaratively: you describe the **desired state** in YAML; **controllers** continuously reconcile the **actual state** to match it.

### Control plane
- **kube-apiserver** — the front door; every component and `kubectl` talks to it (REST). Validates and persists objects.
- **etcd** — distributed key-value store holding all cluster state (back it up!).
- **kube-scheduler** — assigns new Pods to nodes based on resources, affinity, taints.
- **kube-controller-manager** — runs controllers (Deployment, ReplicaSet, Node, Job…) that reconcile state.
- **cloud-controller-manager** — integrates with cloud provider (load balancers, volumes).

### Worker nodes
- **kubelet** — agent ensuring the Pods assigned to its node are running and healthy.
- **container runtime** — containerd / CRI-O runs containers.
- **kube-proxy** — programs iptables/IPVS rules for Service networking (some CNIs like Cilium replace it with eBPF).

```bash
kubectl get nodes
kubectl cluster-info
kubectl get pods -A        # all namespaces
```

## Pods

A **Pod** is the smallest deployable unit: one or more containers that share a **network namespace (same IP, localhost)** and can share **volumes**.

```yaml pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: web
  labels: { app: web }
spec:
  containers:
    - name: nginx
      image: nginx:1.27
      ports: [{ containerPort: 80 }]
      resources:
        requests: { cpu: 100m, memory: 128Mi }
        limits: { memory: 256Mi }
```

- Pods are **ephemeral** — if one dies it isn't resurrected; a controller creates a **new** Pod (new IP). Don't create bare Pods in production.
- **Multi-container patterns**: **sidecar** (log shipper, service-mesh proxy), **ambassador** (proxy to external services), **adapter** (normalise output). **Init containers** run to completion before app containers (migrations, waiting for dependencies). Native sidecar containers (init containers with `restartPolicy: Always`) are stable since v1.33.

### Pod lifecycle phases
`Pending` → `Running` → `Succeeded`/`Failed` (`Unknown` if node unreachable). Container states: `Waiting`, `Running`, `Terminated`.

## Deployments and ReplicaSets

```yaml deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels: { app: api }
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    metadata:
      labels: { app: api }
    spec:
      containers:
        - name: api
          image: ghcr.io/acme/api:1.4.2
          ports: [{ containerPort: 8000 }]
```

- **ReplicaSet** keeps N identical Pods running (matching labels).
- **Deployment** manages ReplicaSets to provide **declarative rolling updates and rollbacks**.

```bash
kubectl apply -f deployment.yaml
kubectl get deploy,rs,pods -l app=api
kubectl set image deploy/api api=ghcr.io/acme/api:1.4.3
kubectl rollout status deploy/api
kubectl rollout history deploy/api
kubectl rollout undo deploy/api --to-revision=2
kubectl scale deploy/api --replicas=5
```

Strategies: **RollingUpdate** (default, zero downtime with proper probes) and **Recreate** (kill all, then start — when versions can't coexist).

## Services and Networking Basics

Pods get new IPs when recreated, so a **Service** provides a **stable virtual IP + DNS name** that load-balances to Pods selected by labels.

```yaml service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  type: ClusterIP
  selector: { app: api }
  ports:
    - port: 80          # service port
      targetPort: 8000  # container port
```

| Type | Exposure |
|---|---|
| **ClusterIP** (default) | internal only, `api.<namespace>.svc.cluster.local` |
| **NodePort** | opens a port (30000–32767) on every node |
| **LoadBalancer** | provisions a cloud load balancer |
| **ExternalName** | DNS CNAME to an external host |
| Headless (`clusterIP: None`) | DNS returns Pod IPs directly (StatefulSets) |

### Networking model
- Every Pod gets its own IP; all Pods can reach all Pods without NAT (implemented by a **CNI plugin**: Calico, Cilium, Flannel, OVN-Kubernetes).
- **CoreDNS** provides service discovery.
- **Endpoints/EndpointSlices** track the ready Pod IPs behind a Service.

## Namespaces, Labels and kubectl Essentials

- **Namespaces** partition a cluster (teams/environments) for names, RBAC, quotas and network policies.
- **Labels** are key/value tags used by selectors (Services, Deployments). **Annotations** hold non-identifying metadata (build info, tool config).

```bash
kubectl create namespace shop
kubectl config set-context --current --namespace=shop
kubectl get pods -o wide                       # node & IP
kubectl describe pod <pod>                     # events — first stop when debugging
kubectl logs <pod> -c <container> --previous   # logs of crashed container
kubectl exec -it <pod> -- sh
kubectl port-forward svc/api 8080:80
kubectl get pod <pod> -o yaml
kubectl explain deployment.spec.strategy
kubectl apply -f k8s/ --dry-run=server
kubectl diff -f k8s/
kubectl top pods                               # needs metrics-server
kubectl get events --sort-by=.lastTimestamp
```

# Intermediate

## ConfigMaps and Secrets

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: api-config }
data:
  LOG_LEVEL: info
  app.yaml: |
    featureFlags: { newCheckout: true }
---
apiVersion: v1
kind: Secret
metadata: { name: api-secrets }
type: Opaque
stringData:
  DATABASE_URL: postgresql://app:pass@db:5432/app
```
```yaml
containers:
  - name: api
    envFrom:
      - configMapRef: { name: api-config }
      - secretRef: { name: api-secrets }
    volumeMounts:
      - { name: config, mountPath: /etc/app }
volumes:
  - name: config
    configMap: { name: api-config }
```

- Secrets are only **base64-encoded**, not encrypted by default. Enable **encryption at rest** for etcd, restrict with RBAC, and prefer external secret managers (**External Secrets Operator**, Vault, Sealed Secrets, cloud CSI drivers).
- Env vars are read at start; **mounted files update** automatically (eventually) but the app must reload them. Common trick: add a checksum annotation so config changes trigger a rollout.

## Health Probes and Resource Management

```yaml
containers:
  - name: api
    image: api:1.4.2
    startupProbe:              # slow-starting apps: other probes wait until this passes
      httpGet: { path: /healthz, port: 8000 }
      failureThreshold: 30
      periodSeconds: 5
    readinessProbe:            # failing → removed from Service endpoints (no traffic)
      httpGet: { path: /readyz, port: 8000 }
      periodSeconds: 5
    livenessProbe:             # failing → container restarted
      httpGet: { path: /healthz, port: 8000 }
      periodSeconds: 10
      failureThreshold: 3
    resources:
      requests: { cpu: 250m, memory: 256Mi }   # used for scheduling
      limits: { memory: 512Mi }                # enforced ceiling
```

| Probe | On failure | Use for |
|---|---|---|
| Liveness | restart container | deadlocks, unrecoverable states |
| Readiness | stop sending traffic | warming up, dependency down, overloaded |
| Startup | delays liveness/readiness | slow boots (JVM, migrations) |

> [!WARN]
> Don't make liveness probes depend on external services (DB) — a DB blip would restart every Pod. Put dependency checks in readiness.

### Requests, limits and QoS
- **Requests** reserve capacity for scheduling; **limits** cap usage. CPU over limit → **throttled**; memory over limit → **OOMKilled**.
- QoS classes: **Guaranteed** (requests = limits for all), **Burstable** (some requests), **BestEffort** (none — evicted first).
- Many teams set memory limits but omit CPU limits to avoid throttling.
- `LimitRange` sets defaults per namespace; `ResourceQuota` caps totals.

## Ingress and Gateway API

An **Ingress** exposes HTTP(S) routes from outside the cluster to Services; an **Ingress Controller** (NGINX, Traefik, HAProxy, cloud LBs) implements it.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  annotations: { cert-manager.io/cluster-issuer: letsencrypt }
spec:
  ingressClassName: nginx
  tls: [{ hosts: [shop.example.com], secretName: shop-tls }]
  rules:
    - host: shop.example.com
      http:
        paths:
          - { path: /api, pathType: Prefix, backend: { service: { name: api, port: { number: 80 } } } }
          - { path: /,    pathType: Prefix, backend: { service: { name: web, port: { number: 80 } } } }
```

The **Gateway API** (`Gateway`, `HTTPRoute`, `GRPCRoute`) is the more expressive, role-oriented successor: header matching, traffic splitting (canary), cross-namespace routing. **cert-manager** automates TLS certificates.

## Storage: Volumes, PV, PVC and StorageClasses

- **Volume** types: `emptyDir` (scratch, pod lifetime), `configMap`/`secret`, `hostPath` (avoid), persistent volumes.
- **PersistentVolume (PV)** — a piece of storage in the cluster.
- **PersistentVolumeClaim (PVC)** — a request for storage by a workload.
- **StorageClass** — enables **dynamic provisioning** (EBS, Azure Disk, Ceph/ODF, NFS via CSI drivers).

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: data }
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: gp3
  resources: { requests: { storage: 20Gi } }
```
Access modes: `ReadWriteOnce` (one node), `ReadOnlyMany`, `ReadWriteMany` (shared FS), `ReadWriteOncePod`. Reclaim policies: `Delete`, `Retain`.

## Workload Types: StatefulSet, DaemonSet, Job, CronJob

| Workload | Use |
|---|---|
| **Deployment** | stateless apps (web, APIs) |
| **StatefulSet** | stateful apps needing stable identity & storage: databases, Kafka, ZooKeeper. Pods named `db-0, db-1`, ordered start/stop, per-pod PVCs via `volumeClaimTemplates`, headless Service for stable DNS |
| **DaemonSet** | one Pod per node: log collectors (Fluent Bit), monitoring agents, CNI |
| **Job** | run to completion (migrations, batch) with retries (`backoffLimit`), parallelism |
| **CronJob** | scheduled Jobs (`schedule: "0 2 * * *"`) |

```yaml
apiVersion: batch/v1
kind: CronJob
metadata: { name: nightly-report }
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      backoffLimit: 3
      template:
        spec:
          restartPolicy: OnFailure
          containers: [{ name: report, image: reports:2.1, args: ["--date", "yesterday"] }]
```

# Advanced

## Scheduling: Affinity, Taints, Tolerations and Disruption

- **nodeSelector** — simple label match (`disktype: ssd`).
- **Node affinity** — required/preferred rules over node labels.
- **Pod affinity/anti-affinity** — co-locate with or spread away from other pods (e.g., replicas on different nodes/zones).
- **Topology spread constraints** — evenly distribute across zones/nodes.
- **Taints & tolerations** — nodes repel pods unless tolerated (GPU nodes, dedicated nodes, control plane).
- **Priority classes & preemption** — critical pods evict lower-priority ones.
- **PodDisruptionBudget** — limits voluntary disruptions (node drains/upgrades):
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: api-pdb }
spec:
  minAvailable: 2
  selector: { matchLabels: { app: api } }
```

## Autoscaling

| Autoscaler | Scales | Based on |
|---|---|---|
| **HPA** (Horizontal Pod Autoscaler) | number of Pods | CPU/memory utilisation, custom/external metrics |
| **VPA** (Vertical Pod Autoscaler) | Pod requests/limits | historical usage |
| **Cluster Autoscaler / Karpenter** | number of nodes | pending unschedulable Pods |
| **KEDA** | Pods (incl. to zero) | event sources: queue length, Kafka lag, cron, Prometheus |

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
```
HPA needs **requests** set (utilisation is relative to requests) and metrics-server/Prometheus adapter.

## Security: RBAC, ServiceAccounts, Pod Security and NetworkPolicies

### RBAC
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: pod-reader, namespace: shop }
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: ci-reads-pods, namespace: shop }
subjects: [{ kind: ServiceAccount, name: ci, namespace: shop }]
roleRef: { kind: Role, name: pod-reader, apiGroup: rbac.authorization.k8s.io }
```
`Role`/`RoleBinding` are namespaced; `ClusterRole`/`ClusterRoleBinding` are cluster-wide. Check with `kubectl auth can-i delete pods --as=system:serviceaccount:shop:ci`.

### ServiceAccounts
Identities for Pods to call the API (projected short-lived tokens). Map to cloud IAM via workload identity (IRSA on EKS, Workload Identity on GKE/AKS).

### Pod Security
**Pod Security Admission** levels: `privileged`, `baseline`, `restricted` (per namespace labels). Set `securityContext`:
```yaml
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities: { drop: ["ALL"] }
  seccompProfile: { type: RuntimeDefault }
```
Policy engines: **Kyverno**, **OPA Gatekeeper** (e.g., require signed images, disallow `latest`).

### NetworkPolicies
Default: all Pods can talk to all Pods. NetworkPolicies (enforced by the CNI) restrict ingress/egress — start with **default deny** and allow explicitly.
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: db-allow-api }
spec:
  podSelector: { matchLabels: { app: db } }
  policyTypes: [Ingress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: api } } }]
      ports: [{ port: 5432 }]
```

## Helm, Kustomize, GitOps and Operators

### Helm — the package manager
Charts = templated manifests + `values.yaml`.
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install pg bitnami/postgresql -f values-prod.yaml -n data
helm upgrade --install api ./charts/api --set image.tag=1.4.3
helm rollback api 3
helm template ./charts/api | kubectl apply --dry-run=client -f -
```

### Kustomize — template-free overlays
`base/` + `overlays/dev|prod` patches; built into kubectl (`kubectl apply -k overlays/prod`).

### GitOps
Git is the source of truth; **Argo CD** or **Flux** continuously sync the cluster to the repo, detect drift and enable auditable rollbacks. CI builds/pushes images and updates manifests; CD pulls.

### Operators and CRDs
**CustomResourceDefinitions** extend the API with new kinds (`PostgresCluster`, `Certificate`). An **Operator** is a controller that encodes operational knowledge (provisioning, backups, failover, upgrades) for that resource — "an SRE in software". Built with Operator SDK/Kubebuilder; distributed via OperatorHub/OLM (heavily used in OpenShift).

### Progressive delivery
**Blue/green** (switch Service selector), **canary** (Argo Rollouts, Flagger, Gateway API weights, service mesh), feature flags.

### Service mesh
**Istio**, **Linkerd**, Cilium: mTLS between services, retries/timeouts, traffic splitting, observability — via sidecar or ambient (sidecar-less) proxies.

## Troubleshooting Kubernetes

| Symptom | Likely causes | Check |
|---|---|---|
| `Pending` | insufficient CPU/memory, node selector/affinity mismatch, taints, unbound PVC | `kubectl describe pod` events |
| `ImagePullBackOff` / `ErrImagePull` | wrong image/tag, private registry without `imagePullSecrets`, rate limits | events, registry access |
| `CrashLoopBackOff` | app crashes on start, bad config/env, missing secret, failing liveness probe | `kubectl logs --previous`, exit code |
| `OOMKilled` (137) | memory limit too low / leak | `describe` → Last State |
| `CreateContainerConfigError` | missing ConfigMap/Secret key | events |
| Service unreachable | selector/label mismatch, wrong targetPort, readiness failing, NetworkPolicy | `kubectl get endpointslices`, `port-forward`, curl from a debug pod |
| Node `NotReady` | kubelet down, disk/memory pressure, network | `kubectl describe node`, node logs |

```bash
kubectl debug -it <pod> --image=nicolaka/netshoot --target=<container>   # ephemeral debug container
kubectl run tmp --rm -it --image=busybox -- nslookup api.shop.svc.cluster.local
```

### Systematic approach
Events → logs (current and previous) → describe (probes, resources, image) → endpoints → network (DNS, policies) → node health → recent changes (`rollout history`, GitOps diff).

# Interview Questions

## Beginner

### What is Kubernetes?
An open-source container orchestration platform that automates deployment, scaling, self-healing, networking and rolling updates of containerised applications across a cluster, using a declarative desired-state model reconciled by controllers.

### What is a Pod?
The smallest deployable unit in Kubernetes — one or more tightly coupled containers sharing a network namespace (IP and ports) and storage volumes, scheduled together on the same node.

### Deployment vs ReplicaSet vs Pod?
A Pod runs containers. A ReplicaSet ensures a specified number of identical Pods are running. A Deployment manages ReplicaSets to provide declarative updates, rolling deployments and rollbacks — you normally only create Deployments.

### What is a Service and why do we need it?
A stable network endpoint (virtual IP + DNS name) that load-balances traffic to a set of Pods selected by labels. Pods are ephemeral with changing IPs; Services decouple consumers from them.

### Explain the Kubernetes control plane components.
kube-apiserver (API front end), etcd (state store), kube-scheduler (places Pods on nodes), kube-controller-manager (reconciliation loops) and cloud-controller-manager (cloud integrations). Nodes run kubelet, kube-proxy and a container runtime.

### What is a namespace?
A virtual partition of a cluster that scopes names and allows separate RBAC, resource quotas and network policies — commonly used per team, application or environment.

### ClusterIP vs NodePort vs LoadBalancer?
ClusterIP exposes a Service only inside the cluster. NodePort additionally opens a static port on every node. LoadBalancer additionally provisions an external cloud load balancer pointing at those node ports.

## Intermediate

### Liveness vs readiness vs startup probes?
Liveness failures restart the container (recover from deadlocks). Readiness failures remove the Pod from Service endpoints without restarting (temporarily unable to serve). Startup probes hold off the others until a slow-starting app has booted.

### ConfigMap vs Secret?
Both inject configuration as env vars or files. ConfigMaps hold non-sensitive data; Secrets hold sensitive data, are base64-encoded, can be encrypted at rest and access-restricted. For real security combine with RBAC, etcd encryption and external secret managers.

### What are requests and limits?
Requests are the guaranteed resources used by the scheduler to place Pods. Limits are maximums enforced at runtime: exceeding CPU limits causes throttling; exceeding memory limits causes OOMKill. They also determine QoS class and eviction order.

### How does a rolling update work and how do you roll back?
The Deployment creates a new ReplicaSet and gradually scales it up while scaling the old one down, respecting `maxSurge` and `maxUnavailable` and waiting for readiness. Roll back with `kubectl rollout undo deployment/<name>` (optionally `--to-revision`).

### What is an Ingress?
An API object defining HTTP/HTTPS routing rules (hosts, paths, TLS) from outside the cluster to Services. It requires an Ingress controller to implement it. The Gateway API is the newer, more expressive alternative.

### StatefulSet vs Deployment?
Deployments manage interchangeable stateless Pods. StatefulSets give each Pod a stable identity (ordinal name, DNS), ordered deployment/scaling and its own persistent volume via `volumeClaimTemplates` — needed for databases and clustered stateful systems.

### What is a DaemonSet?
A controller ensuring a copy of a Pod runs on every (or selected) node — used for node-level agents like log collectors, monitoring exporters, CNI and storage plugins.

### What is a PVC and how does dynamic provisioning work?
A PersistentVolumeClaim is a request for storage with size and access mode. When it references a StorageClass, the CSI provisioner automatically creates a matching PersistentVolume (e.g., an EBS disk) and binds it to the claim.

## Advanced

### How does the HPA work?
It periodically reads metrics (via metrics-server or custom/external metrics APIs), compares current utilisation (relative to requests) with the target, and computes desired replicas: `ceil(current * currentMetric / target)`, within min/max and with stabilisation windows to avoid flapping. It requires resource requests to be set.

### Explain taints, tolerations and affinity.
Taints on nodes repel Pods that don't tolerate them (dedicated or special hardware). Tolerations allow Pods onto tainted nodes but don't force them there. Node affinity attracts Pods to nodes with certain labels; pod anti-affinity spreads replicas across nodes/zones for availability.

### How would you secure a Kubernetes cluster?
RBAC with least privilege, Pod Security Admission (restricted), non-root/read-only containers with dropped capabilities, NetworkPolicies with default deny, etcd encryption and external secret management, image scanning/signing with admission policies, audit logging, private API endpoint, regular upgrades, and runtime security (Falco).

### What is an Operator?
A custom controller plus CustomResourceDefinitions that automate the lifecycle of a complex application (install, configure, scale, back up, upgrade, fail over) by encoding operational knowledge, reconciling custom resources just like built-in controllers do.

### Walk through debugging a Pod stuck in CrashLoopBackOff.
`kubectl describe pod` for events, exit codes and probe failures; `kubectl logs --previous` for the crash output; verify env vars, ConfigMaps/Secrets and command/args; check if the liveness probe is killing a slow start (add a startup probe); check OOMKilled; run the image locally or with `kubectl debug`/an overridden command to inspect.

### What happens when you run `kubectl apply -f deployment.yaml`?
kubectl sends the manifest to the API server, which authenticates, authorizes (RBAC), runs admission controllers (mutating/validating) and stores the object in etcd. The Deployment controller creates a ReplicaSet; the ReplicaSet controller creates Pods; the scheduler binds them to nodes; each node's kubelet pulls images via the runtime, starts containers, runs probes and reports status; endpoints are updated once Pods are ready.

### Helm vs Kustomize?
Helm is a package manager with templated charts, values files, releases and rollbacks — great for distributing reusable apps. Kustomize uses template-free overlays and patches on plain YAML, built into kubectl — great for environment variations of your own manifests. They're often combined, typically driven by GitOps (Argo CD/Flux).

### How do you achieve zero-downtime deployments?
Rolling updates with `maxUnavailable: 0`, correct readiness probes, graceful shutdown handling SIGTERM with a preStop sleep so endpoints update before termination, PodDisruptionBudgets, multiple replicas spread across nodes/zones, backward-compatible DB migrations, and canary/blue-green strategies for risky changes.

# Scenario Questions

## Beginner

### A pod is stuck in `CrashLoopBackOff`. Walk through how you debug it.
1. `kubectl describe pod <p>`: check events, exit code, `OOMKilled`, and failed probes.
2. `kubectl logs <p> --previous` shows the logs of the crashed container.
3. Common causes: the app exits (bad config, a missing env var or secret, an unreachable DB), the **liveness probe** kills it during slow start-up (add a `startupProbe`), or memory limits are too low (exit code 137).
4. To poke around, run `kubectl debug` or override the command (`sleep infinity`).

### A pod stays in `Pending`. What are the usual reasons?
`kubectl describe pod` shows the scheduler's message. Usual reasons:
- insufficient CPU or memory on every node (requests too high)
- a node selector, affinity rule or taint the pod doesn't tolerate
- an unbound PVC (no StorageClass, or a zone mismatch)
- ResourceQuota exceeded
- an image pull secret missing (that shows as `ImagePullBackOff` once the pod is scheduled)

## Intermediate

### Users get 502 errors for a few seconds during every rolling deploy. How do you get to zero downtime?
- Add a **readinessProbe**, so traffic only goes to ready pods.
- Set `maxUnavailable: 0` and `maxSurge: 1`.
- Handle SIGTERM gracefully, and add a `preStop` hook (`sleep 5–10`) so endpoints are removed from load balancers before the process stops.
- Make sure `terminationGracePeriodSeconds` covers the drain time.
- Add a PodDisruptionBudget for node maintenance.

### A service can't reach another service by name. How do you troubleshoot it?
- Check DNS (`nslookup svc.namespace.svc.cluster.local` from a debug pod).
- Check that the Service selector matches the pod labels (`kubectl get endpoints <svc>`; if it's empty, the selector is wrong or no pod is ready).
- Check that `targetPort` matches the container port.
- Look for **NetworkPolicies** blocking traffic.
- Check that the app listens on `0.0.0.0`.

## Advanced

### The cluster autoscaler adds nodes, but pods are still slow to scale during traffic spikes. How do you improve it?
- Tune the **HPA** (lower targets, custom or external metrics such as RPS or queue length via KEDA, faster `behavior.scaleUp`).
- Keep **headroom** with low-priority placeholder pods (overprovisioning).
- Use faster node provisioning (Karpenter, pre-warmed node pools).
- Shrink image size and start-up time, and use startup probes.
- Set requests correctly so the scheduler packs pods properly.

# Tricky Questions

## Beginner

### You `kubectl delete pod` a pod from a Deployment. What happens?
A new pod is created straight away. The ReplicaSet controller reconciles back to the desired replica count. To stop it, scale the Deployment to 0 or delete the Deployment.

## Intermediate

### A container has `requests.memory: 256Mi` and `limits.memory: 512Mi`, and it uses 600Mi. What happens? What if it's CPU instead?
Memory over the limit means the container is **OOMKilled** (exit code 137) and restarted. CPU over the limit means it's **throttled**, not killed. Requests drive scheduling and QoS class; when requests equal limits the pod is **Guaranteed**, which makes it the last to be evicted.

### Why might a liveness probe that checks the database cause an outage?
If the database blips, **every** pod fails liveness and is restarted at the same time, which turns a short database issue into a full outage plus a restart storm. A liveness probe should check only whether the process itself is healthy. Put dependency checks in the **readiness** probe, or nowhere.
