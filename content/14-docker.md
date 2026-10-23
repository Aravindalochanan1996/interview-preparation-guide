---
id: docker
title: Docker
short: Docker
category: DevOps & Cloud
order: 14
color: #1d63ed
icon: Dk
summary: Containers vs VMs, images & layers, Dockerfiles, multi-stage builds, volumes, networking, Compose, security, optimisation and what's under the hood.
---

# Beginner

## Containers vs Virtual Machines

A **container** packages an application with its dependencies and runs it as an **isolated process** sharing the host OS kernel. A **virtual machine** emulates hardware and runs a full guest OS on a hypervisor.

| | Containers | VMs |
|---|---|---|
| Isolation | process-level (namespaces, cgroups) | hardware-level (hypervisor) |
| Size | MBs | GBs |
| Startup | milliseconds–seconds | minutes |
| OS | share host kernel | own kernel |
| Density | high | lower |
| Security boundary | weaker (shared kernel) | stronger |

```bash
docker run --rm alpine uname -r        # same kernel version as the host → shared kernel
time docker run --rm alpine echo hi    # starts in well under a second
docker run --rm alpine ps              # only the container's own processes are visible
```

### Why Docker?
"It works on my machine" → the **same image** runs identically in dev, CI and production. Fast, reproducible environments, microservice packaging, and the foundation for Kubernetes.

### Core terms
- **Image** — read-only template (layers) with app + dependencies.
- **Container** — a running (or stopped) instance of an image with a writable layer.
- **Dockerfile** — recipe to build an image.
- **Registry** — stores images (Docker Hub, GHCR, ECR, ACR, Quay, OpenShift internal registry).
- **Docker Engine** — daemon (`dockerd`) + CLI + containerd runtime.

## Essential Docker Commands

```bash
docker pull nginx:1.27                     # download an image
docker run -d --name web -p 8080:80 nginx:1.27   # run detached, map host:container port
docker ps            # running containers  (-a for all)
docker logs -f web   # follow logs
docker exec -it web sh                     # shell inside a running container
docker stop web && docker rm web
docker images        # list images
docker rmi nginx:1.27
docker build -t myapp:1.0 .                # build from Dockerfile in current dir
docker tag myapp:1.0 ghcr.io/me/myapp:1.0 && docker push ghcr.io/me/myapp:1.0
docker inspect web   # low-level JSON details
docker stats         # live CPU/memory usage
docker system prune -a   # clean unused data
```

Useful `run` flags: `-e KEY=value`, `--env-file .env`, `-v`/`--mount`, `--network`, `--rm` (auto-remove), `--restart unless-stopped`, `--memory 512m --cpus 1`, `-u 1000`.

## Writing a Dockerfile

```dockerfile Dockerfile
FROM node:22-alpine                 # base image
WORKDIR /app                        # set working dir
COPY package*.json ./               # copy dependency manifests first (cache!)
RUN npm ci --omit=dev               # install deps — cached unless manifests change
COPY . .                            # copy source
ENV NODE_ENV=production
EXPOSE 3000                         # documentation only — doesn't publish
USER node                           # don't run as root
CMD ["node", "server.js"]           # default command
```

### Instruction reference
| Instruction | Purpose |
|---|---|
| `FROM` | base image (every stage starts with one) |
| `RUN` | execute at **build time**, creates a layer |
| `COPY` / `ADD` | copy files (`ADD` also fetches URLs/extracts tars — prefer `COPY`) |
| `WORKDIR` | set working directory |
| `ENV` / `ARG` | runtime env var / build-time variable |
| `EXPOSE` | document the port |
| `USER` | user to run as |
| `CMD` | default command/args at **run time** (overridable) |
| `ENTRYPOINT` | fixed executable; `CMD` becomes its default args |
| `HEALTHCHECK` | container health command |
| `LABEL`, `VOLUME`, `SHELL`, `STOPSIGNAL` | metadata/misc |

### `.dockerignore`
```text
node_modules
.git
*.log
.env
dist
```
Keeps the build context small and avoids leaking secrets into images.

## Images, Layers and Caching

- Each `RUN`, `COPY`, `ADD` creates a **layer**; layers are stacked with a **union filesystem** (overlay2) and shared between images.
- Docker reuses cached layers until an instruction or its inputs change — then **everything after it rebuilds**.
- Order instructions from **least to most frequently changing**: base image → system packages → dependency manifests → install → source code.

```dockerfile
# ❌ any code change reinstalls all dependencies
COPY . .
RUN npm ci
# ✅ dependencies cached separately
COPY package*.json ./
RUN npm ci
COPY . .
```

### Tags and digests
`nginx:latest` is mutable and unpredictable — pin versions (`nginx:1.27.2`) or digests (`nginx@sha256:…`) for reproducibility.

# Intermediate

## Multi-Stage Builds

Build in one stage with full toolchains; copy only artifacts into a small runtime image.

```dockerfile Dockerfile
# ---- build stage ----
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "dist/server.js"]
```

```dockerfile Go — tiny distroless image
FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/server

FROM gcr.io/distroless/static-debian12
COPY --from=build /app /app
USER nonroot
ENTRYPOINT ["/app"]
```

Benefits: smaller images (faster pulls, less attack surface), no compilers or secrets in production images.

### Base image choices
`ubuntu/debian` (familiar, large) → `-slim` variants → `alpine` (tiny, uses musl libc — occasional compatibility issues with native modules) → **distroless** (no shell/package manager) → `scratch` (empty, for static binaries).

## CMD vs ENTRYPOINT, Shell vs Exec Form

```dockerfile
ENTRYPOINT ["python", "app.py"]
CMD ["--port", "8000"]
# docker run img            → python app.py --port 8000
# docker run img --port 9   → python app.py --port 9
```

| | Exec form `["node","app.js"]` | Shell form `node app.js` |
|---|---|---|
| Runs via | directly as PID 1 | `/bin/sh -c` |
| Signals (SIGTERM) | received by your app ✅ | received by the shell — app may not get it ❌ |
| Env var expansion | no | yes |

Always prefer **exec form** so graceful shutdown works. If your app doesn't reap zombie processes, use `docker run --init` or `tini` as PID 1.

### RUN vs CMD
`RUN` executes during the **build** and bakes results into the image. `CMD` defines what runs when a container **starts**.

## Volumes and Data Persistence

A container's writable layer is **ephemeral** — deleted with the container.

| Type | Syntax | Use |
|---|---|---|
| **Named volume** | `-v pgdata:/var/lib/postgresql/data` | persistent data managed by Docker (databases) |
| **Bind mount** | `-v $(pwd):/app` | mount host dir — live code reload in dev, config files |
| **tmpfs** | `--tmpfs /tmp` | in-memory, never written to disk (secrets, scratch) |

```bash
docker volume create pgdata
docker run -d -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=dev postgres:17
docker volume ls / inspect / rm
```
Back up volumes by running a temporary container that tars the volume contents.

## Networking

| Driver | Behaviour |
|---|---|
| **bridge** (default) | private network on the host; containers reach the outside via NAT; publish ports with `-p` |
| user-defined bridge | like bridge **plus automatic DNS by container name** — always use this for multi-container apps |
| **host** | container shares the host network stack (no isolation, no port mapping) |
| **none** | no networking |
| **overlay** | multi-host networking (Swarm) |
| macvlan | container gets its own MAC/IP on the physical network |

```bash
docker network create appnet
docker run -d --name db --network appnet postgres:17
docker run -d --name api --network appnet -e DB_HOST=db -p 8000:8000 myapi
# api reaches postgres at hostname "db"
```

`-p 8080:80` maps host port 8080 → container port 80. `-p 127.0.0.1:8080:80` binds only to localhost. Inside a container, `localhost` refers to the **container itself**, not the host (use `host.docker.internal` on Docker Desktop).

## Docker Compose

Define and run multi-container apps declaratively.

```yaml compose.yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://app:secret@db:5432/app
      REDIS_URL: redis://cache:6379
    depends_on:
      db: { condition: service_healthy }
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src

  db:
    image: postgres:17
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: secret, POSTGRES_DB: app }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 5

  cache:
    image: redis:7-alpine

volumes:
  pgdata:
```

```bash
docker compose up -d --build
docker compose logs -f api
docker compose exec db psql -U app
docker compose down -v      # -v also removes volumes
docker compose watch        # sync code changes into containers
```
Compose creates a default network so services reach each other by service name. Use multiple files/profiles for dev vs CI (`-f compose.yaml -f compose.ci.yaml`).

# Advanced

## How Containers Work Under the Hood

Containers are just Linux processes with isolation features:

- **Namespaces** — what a process can *see*:
  - `pid` (own process tree, app is PID 1), `net` (own interfaces/ports), `mnt` (own filesystem view), `uts` (hostname), `ipc`, `user` (UID mapping — rootless), `cgroup`.
- **cgroups** — what a process can *use*: CPU, memory, I/O, PIDs limits. Exceeding a memory limit → **OOMKilled** (exit code 137).
- **Union filesystem (OverlayFS)** — stacks read-only image layers + a thin writable layer (copy-on-write).
- **Capabilities, seccomp, AppArmor/SELinux** — restrict privileged operations and syscalls.

```bash
docker run -d --name web --memory 256m --cpus 0.5 nginx
docker inspect -f '{{.State.Pid}}' web              # host PID of the container's PID 1
sudo ls -l /proc/$(docker inspect -f '{{.State.Pid}}' web)/ns   # its namespaces
cat /sys/fs/cgroup/system.slice/docker-$(docker inspect -f '{{.Id}}' web).scope/memory.max  # 268435456
sudo unshare --pid --fork --mount-proc bash -c 'ps aux'   # a "container" with just a PID namespace
```

### The runtime stack
`docker CLI → dockerd → containerd → runc` (OCI runtime that actually creates namespaces/cgroups). Kubernetes talks to containerd or CRI-O directly through the **CRI** — Docker isn't required (dockershim was removed in K8s 1.24), but Docker-built images work everywhere because they follow the **OCI image spec**.

Alternatives: **Podman** (daemonless, rootless, Docker-compatible CLI; default on RHEL/OpenShift), Buildah, BuildKit, Kaniko (build in K8s without Docker daemon).

## Container Security

1. **Run as non-root** (`USER 1001`); OpenShift enforces random UIDs by default.
2. **Minimal base images** (distroless/alpine/slim) → smaller attack surface.
3. **Scan images** for CVEs: Trivy, Grype, Docker Scout, Snyk; fail CI on criticals.
4. **Never bake secrets** into images (they persist in layer history). Use BuildKit secrets:
```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```
   and runtime secrets from the orchestrator/vault.
5. **Pin versions and digests**; rebuild regularly for patches.
6. Read-only root filesystem (`--read-only`), drop capabilities (`--cap-drop ALL`), `--security-opt no-new-privileges`.
7. Never mount `/var/run/docker.sock` into untrusted containers (= root on host). Avoid `--privileged`.
8. **Sign and verify images** (Cosign/Sigstore), generate SBOMs (Syft), enforce admission policies.
9. Rootless Docker/Podman and user namespaces.

## Optimising Images and Builds

- Multi-stage builds; copy only runtime artifacts.
- Order layers for caching; combine related `RUN` steps and clean caches in the same layer:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
```
- `.dockerignore` everything not needed.
- **BuildKit** features: parallel stages, cache mounts (`RUN --mount=type=cache,target=/root/.npm npm ci`), remote cache (`--cache-from`/`--cache-to` in CI), `docker buildx` for **multi-architecture** images (`--platform linux/amd64,linux/arm64`).
- Analyse with `docker history` and `dive`.
- Prefer `npm ci`, `pip install --no-cache-dir`, `uv sync --frozen`.

## Debugging and Production Practices

### Debugging checklist
```bash
docker logs --tail 100 <c>              # app output
docker inspect <c> --format '{{.State.ExitCode}} {{.State.OOMKilled}}'
docker exec -it <c> sh                  # inspect inside
docker run -it --entrypoint sh myimg    # override entrypoint to debug startup
docker events                           # daemon events
docker debug <c>                        # attach a toolbox to slim/distroless containers
```
Common exit codes: **0** success, **1** app error, **125** docker run error, **126** not executable, **127** command not found, **137** SIGKILL (OOM or forced stop), **143** SIGTERM.

### Production practices
- One main process per container; log to **stdout/stderr**.
- Handle **SIGTERM** for graceful shutdown (exec form, `--init`).
- Health checks; resource limits; restart policies.
- Immutable, versioned images (tag with git SHA); promote the same image across environments.
- Configuration via env vars (12-factor); stateless containers.
- Use an orchestrator (Kubernetes/OpenShift/ECS) for scheduling, scaling and self-healing.

### Docker in CI/CD
Build → test → scan → sign → push to registry → deploy (Helm/Argo CD). Use layer caching, build once and promote by digest.

# Interview Questions

## Beginner

### What is Docker and why is it used?
A platform for building, shipping and running applications in containers — isolated processes packaged with all dependencies. It provides consistent environments from development to production, fast startup, efficient resource usage, and a standard unit for deployment and orchestration.

```bash
docker build -t myapp:1.0 .                 # package app + deps into an image
docker run -d -p 8080:3000 --name app myapp:1.0
docker push registry.example.com/myapp:1.0  # same image runs on laptop, CI and prod
```

### Image vs container?
An image is an immutable, layered template containing the filesystem and metadata. A container is a running (or stopped) instance of an image with its own writable layer, process space and network. Many containers can run from one image.

```bash
docker image ls                     # templates (read-only layers)
docker run -d --name a nginx        # container 1 from the image
docker run -d --name b nginx        # container 2, same image, separate writable layer
docker exec a touch /tmp/x          # only container a has /tmp/x
docker ps -a                        # containers (running + stopped)
docker diff a                       # changes in a's writable layer
```

### Container vs virtual machine?
Containers share the host kernel and isolate processes with namespaces and cgroups — lightweight and fast. VMs virtualise hardware and run a full guest OS — heavier but with stronger isolation. They're often combined (containers running inside VMs in the cloud).

```text
VM:        App | Libs | Guest OS kernel | Hypervisor | Host OS | Hardware   (GBs, boots in minutes)
Container: App | Libs | ─── shared host kernel ─── | Host OS | Hardware   (MBs, starts in ms)
```

### What is a Dockerfile?
A text file with instructions (`FROM`, `RUN`, `COPY`, `CMD`…) that Docker executes in order to build an image layer by layer.

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### What does `EXPOSE` do?
It documents which port the container listens on. It does not publish the port; you still need `-p host:container` (or `-P`) at run time.

```dockerfile
EXPOSE 3000          # metadata only
```
```bash
docker run -d myapp                  # not reachable from the host
docker run -d -p 8080:3000 myapp     # host 8080 → container 3000
docker run -d -P myapp               # publish all EXPOSEd ports to random host ports
docker port <container>
```

### How do you persist data in Docker?
Use named volumes (managed by Docker, ideal for databases) or bind mounts (host directories). Data written only to the container's writable layer is lost when the container is removed.

```bash
docker volume create pgdata
docker run -d --name db -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data postgres:16  # named volume
docker run -d -v "$PWD/src:/app/src" myapp          # bind mount for live code in dev
docker run --rm -v pgdata:/data -v "$PWD:/backup" alpine tar czf /backup/pg.tgz -C /data .   # back up a volume
```

### COPY vs ADD?
Both copy files into the image. `ADD` additionally supports remote URLs and auto-extracts local tar archives. Prefer `COPY` for clarity and predictability.

```dockerfile
COPY package.json /app/                  # ✅ predictable
ADD app.tar.gz /opt/app/                 # auto-extracts local tarballs
ADD https://example.com/tool /usr/bin/   # downloads (prefer RUN curl … with checksum verification)
```

## Intermediate

### CMD vs ENTRYPOINT?
`ENTRYPOINT` sets the executable that always runs; `CMD` provides default arguments (or the default command if no entrypoint). Arguments passed to `docker run` replace `CMD` but are appended to `ENTRYPOINT`. Use exec (JSON) form so signals reach the process.

```dockerfile
ENTRYPOINT ["python", "manage.py"]
CMD ["runserver", "0.0.0.0:8000"]
```
```bash
docker run app                 # python manage.py runserver 0.0.0.0:8000
docker run app migrate         # python manage.py migrate      (CMD replaced)
docker run --entrypoint sh app # override the entrypoint for debugging
```

### What are multi-stage builds and why use them?
Dockerfiles with multiple `FROM` stages where later stages copy artifacts from earlier ones (`COPY --from=build`). They keep compilers, dev dependencies and source code out of the final image, producing small, secure runtime images from a single Dockerfile.

```dockerfile
FROM golang:1.23 AS build
WORKDIR /src
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/api /api
USER nonroot
ENTRYPOINT ["/api"]          # final image ~15 MB, no compiler, no shell
```

### How does Docker layer caching work?
Each instruction produces a layer identified by the instruction and its inputs. On rebuild, Docker reuses cached layers until it encounters a changed instruction or changed copied files; all subsequent layers are rebuilt. Order instructions from stable to volatile to maximise cache hits.

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./   # changes rarely → cached
RUN npm ci                               # reused unless the lockfile changed
COPY . .                                 # changes often → only layers from here rebuild
RUN npm run build
```
```bash
docker build --progress=plain .   # shows CACHED for reused steps
docker history myapp:latest       # layers and their sizes
```

### How do containers communicate with each other?
On the same user-defined bridge network (or Compose's default network), containers reach each other by name via Docker's embedded DNS. Ports only need publishing (`-p`) for access from the host or outside world.

```bash
docker network create appnet
docker run -d --name db  --network appnet -e POSTGRES_PASSWORD=pw postgres:16
docker run -d --name api --network appnet -e DATABASE_URL=postgres://postgres:pw@db:5432/postgres myapi
docker exec api getent hosts db        # resolved by Docker's embedded DNS
# No -p needed for db: only containers on appnet can reach it
```

### What is Docker Compose?
A tool to define multi-container applications in a YAML file — services, networks, volumes, env vars, health checks and dependencies — and manage them with `docker compose up/down`. Ideal for local development and integration testing.

```yaml compose.yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    environment: { DATABASE_URL: postgres://app:pw@db:5432/app }
    depends_on: { db: { condition: service_healthy } }
  db:
    image: postgres:16
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: pw }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD", "pg_isready", "-U", "app"], interval: 5s, retries: 10 }
volumes: { pgdata: {} }
```
```bash
docker compose up -d --build && docker compose logs -f api && docker compose down -v
```

### How do you reduce Docker image size?
Use slim/alpine/distroless bases, multi-stage builds, `.dockerignore`, install only production dependencies, combine `RUN` steps and clean package caches in the same layer, and remove build tools from the final stage.

```text .dockerignore
node_modules
.git
dist
*.log
.env
```
```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
 && rm -rf /var/lib/apt/lists/*                      # clean in the SAME layer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```
```bash
docker images myapp && dive myapp:latest             # inspect what each layer adds
```

### Why should containers run as non-root?
If an attacker escapes or exploits the app, root inside the container maps to significant privileges on the host (especially without user namespaces). Running as an unprivileged user limits damage; platforms like OpenShift enforce it.

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY --chown=node:node . .
USER node                            # UID 1000, not root
```
```bash
docker run --read-only --cap-drop ALL --security-opt no-new-privileges myapp
docker exec <id> id                  # uid=1000(node)
```

## Advanced

### How are containers isolated under the hood?
Linux namespaces give each container its own view of PIDs, network, mounts, hostname, IPC and users; cgroups limit CPU, memory and I/O; OverlayFS provides layered copy-on-write filesystems; capabilities, seccomp and AppArmor/SELinux restrict privileged operations. runc sets all this up per the OCI runtime spec.

```bash
docker run -d --name t --pids-limit 100 --memory 128m busybox sleep 1d
docker exec t ps            # PID namespace: sleep is PID 1
docker exec t hostname      # UTS namespace: container id
docker exec t ip addr       # net namespace: own eth0
docker inspect t --format '{{.GraphDriver.Data.MergedDir}}'   # OverlayFS merged view
```

### What does exit code 137 mean and how do you troubleshoot it?
The process was killed with SIGKILL (128 + 9) — usually the kernel OOM killer because the container exceeded its memory limit, or a forced stop after a SIGTERM timeout. Check `docker inspect` for `OOMKilled`, monitor memory usage, fix leaks, tune heap sizes (e.g., Node's `--max-old-space-size`, JVM `-XX:MaxRAMPercentage`) or raise the limit.

```bash
docker inspect -f '{{.State.ExitCode}} OOMKilled={{.State.OOMKilled}}' app   # 137 OOMKilled=true
docker stats app                                   # live memory vs limit
docker run -m 1g -e NODE_OPTIONS=--max-old-space-size=768 myapp   # runtime heap below the limit
dmesg | grep -i 'killed process'                   # kernel OOM killer log on the host
```

### How do you handle secrets in Docker?
Never bake them into images or `ENV` in Dockerfiles (they remain in layer history). Use BuildKit `--mount=type=secret` for build-time secrets, and inject runtime secrets via orchestrator secrets (Kubernetes Secrets, Docker Swarm secrets), mounted files, or a vault (HashiCorp Vault, cloud secret managers).

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci   # never stored in a layer
```
```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t app .
docker run --env-file prod.env app      # runtime secrets from outside the image (or K8s Secrets / Vault)
```

### Docker vs Podman?
Podman is daemonless (each container is a child process), rootless by default, and supports pods; its CLI is Docker-compatible. Docker uses a central root daemon (rootless mode available) with a richer desktop/compose ecosystem. Both produce OCI images; Red Hat/OpenShift environments favour Podman/Buildah/CRI-O.

```bash
podman run -d -p 8080:80 nginx            # same CLI, no daemon, rootless by default
podman pod create --name web -p 8080:80   # Kubernetes-style pods
podman generate kube web > web.yaml       # export to a K8s manifest
alias docker=podman
```

### Why does my container not shut down gracefully?
Likely the app isn't PID 1 receiving SIGTERM (shell form CMD wraps it in `sh`), the app doesn't handle SIGTERM, or child processes aren't reaped. Use exec form, add `--init`/tini, implement signal handling, and ensure the stop timeout is long enough.

```dockerfile
CMD npm start                    # ❌ shell form: sh is PID 1 and doesn't forward SIGTERM
CMD ["node", "server.js"]        # ✅ exec form: node is PID 1
```
```js
process.on('SIGTERM', () => server.close(() => process.exit(0)));
```
```bash
docker run --init myapp          # tini as PID 1: forwards signals, reaps zombies
```

### How do you build multi-architecture images?
Use `docker buildx build --platform linux/amd64,linux/arm64 -t repo/app:tag --push .`, which builds per-platform images (natively or via QEMU emulation/cross-compilation) and pushes a manifest list so each host pulls the matching architecture.

```bash
docker buildx create --use --name multi
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/acme/api:1.4.0 --push .
docker buildx imagetools inspect ghcr.io/acme/api:1.4.0   # one manifest list, two images
```
```dockerfile Cross-compile instead of emulating
FROM --platform=$BUILDPLATFORM golang:1.23 AS build
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/app .
```

### How would you secure the container supply chain?
Use minimal, pinned and trusted base images; scan in CI with Trivy/Grype; generate SBOMs; sign images with Cosign and verify signatures with admission controllers (Kyverno, Gatekeeper); use private registries with access control; rebuild frequently; and enforce non-root, read-only and dropped capabilities at runtime.

```bash
trivy image --exit-code 1 --severity HIGH,CRITICAL ghcr.io/acme/api:1.4.0    # fail CI on vulns
syft ghcr.io/acme/api:1.4.0 -o spdx-json > sbom.json                          # SBOM
cosign sign --yes ghcr.io/acme/api@sha256:abc…                                 # keyless signing
cosign verify ghcr.io/acme/api@sha256:abc… --certificate-identity-regexp '.*' --certificate-oidc-issuer https://token.actions.githubusercontent.com
```
```dockerfile
FROM node:22.11.0-slim@sha256:…digest…     # pin by digest
```

# Scenario Questions

## Beginner

### Your container starts and exits immediately with code 0. Why?
A container lives only as long as its **main process** (PID 1). If the command finishes (a script runs and exits, a service daemonises into the background, or `CMD` is a shell that ends), the container stops. Run the process in the foreground (`nginx -g 'daemon off;'`, `node server.js`) and check with `docker logs` and `docker inspect --format '{{.State.ExitCode}}'`.

```bash
docker run -d nginx -g 'daemon on;'   # ❌ nginx forks to background, PID 1 exits
docker run -d nginx                   # ✅ default runs 'daemon off;' in the foreground
docker logs <id>; docker inspect -f '{{.Config.Cmd}} {{.Config.Entrypoint}}' <id>
docker run -it --entrypoint sh myimage   # poke around
```

### The app inside the container works, but `localhost:3000` on your machine can't reach it. What's wrong?
- Either the port isn't published (`-p 3000:3000`), or
- the app binds to `127.0.0.1` **inside** the container, which is unreachable from outside. Bind to `0.0.0.0`.

Check `docker ps` for the port mapping.

```js
app.listen(3000, '127.0.0.1');   // ❌ only reachable from inside the container
app.listen(3000, '0.0.0.0');     // ✅
```
```bash
docker run -p 3000:3000 myapp                  # publish the port
docker port <id>; docker exec <id> ss -tlnp    # what is actually listening where
```

## Intermediate

### Every code change triggers a 5-minute `npm install` in your Docker build. How do you fix it?
Order the layers for **caching**: copy `package*.json` first, run `npm ci`, *then* copy the source. Add a `.dockerignore` (node_modules, .git, dist), use BuildKit cache mounts (`RUN --mount=type=cache,target=/root/.npm npm ci`), and use multi-stage builds so the final image only holds production output.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci   # cached layer + persistent npm cache
COPY . .
RUN npm run build
```

### Your image is 1.8 GB. How do you shrink it?
- Multi-stage build: build in a full image, copy only the artifacts into `node:22-slim`, alpine, or distroless.
- Remove dev dependencies (`npm ci --omit=dev`).
- Clean package manager caches in the same `RUN` layer.
- Use `.dockerignore`.
- Inspect layers with `docker history` or `dive`.

```dockerfile
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/server.js"]      # typically 1.8 GB → ~200 MB
```

## Advanced

### `docker stop` takes 10 seconds and your app never runs its graceful shutdown. Why?
The app isn't PID 1, or doesn't handle **SIGTERM**. With shell-form `CMD npm start`, `sh` or `npm` receives the signal and doesn't forward it, so Docker sends SIGKILL after the timeout. Use exec form (`CMD ["node","server.js"]`), handle SIGTERM in code (stop accepting requests, drain, close the DB), or use `--init`/tini to reap zombies and forward signals.

```dockerfile
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```
```bash
docker stop -t 30 app   # give it more time if shutdown is legitimately slow
```

# Tricky Questions

## Beginner

### What's the difference between these? `CMD ["npm", "start"]` vs `ENTRYPOINT ["npm"]` + `CMD ["start"]`
With only `CMD`, `docker run img bash` replaces the whole command. With `ENTRYPOINT` plus `CMD`, the arguments you pass replace only `CMD`, so `docker run img test` runs `npm test`. The entrypoint is the fixed executable and CMD supplies the default arguments.

```bash
# Image A: CMD ["npm","start"]
docker run A            # npm start
docker run A npm test   # npm test (whole command replaced)
# Image B: ENTRYPOINT ["npm"] + CMD ["start"]
docker run B            # npm start
docker run B test       # npm test (only CMD replaced)
```

## Intermediate

### You deleted a secret in a later layer: `COPY .env .` then `RUN rm .env`. Is the secret gone from the image?
**No.** Every layer is kept, so the file still exists in the `COPY` layer and anyone with the image can extract it (`docker save`). Use BuildKit secrets (`RUN --mount=type=secret,id=npmrc …`), runtime environment variables or secret managers, and rotate anything that leaked.

```bash
docker save myapp -o app.tar && mkdir x && tar -xf app.tar -C x
grep -r "API_KEY" x/ 2>/dev/null     # still found inside the COPY layer
docker history --no-trunc myapp      # the layer is right there
```

### Why does `RUN apt-get update` followed by `RUN apt-get install -y curl` sometimes install stale or missing packages?
The `update` layer is **cached** from an old build while the install layer reruns, so the package lists are out of date. Combine them: `RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*`.

```dockerfile
# ❌
RUN apt-get update
RUN apt-get install -y curl
# ✅
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl=7.88.* \
 && rm -rf /var/lib/apt/lists/*
```
