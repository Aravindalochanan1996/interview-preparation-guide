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

### Image vs container?
An image is an immutable, layered template containing the filesystem and metadata. A container is a running (or stopped) instance of an image with its own writable layer, process space and network. Many containers can run from one image.

### Container vs virtual machine?
Containers share the host kernel and isolate processes with namespaces and cgroups — lightweight and fast. VMs virtualise hardware and run a full guest OS — heavier but with stronger isolation. They're often combined (containers running inside VMs in the cloud).

### What is a Dockerfile?
A text file with instructions (`FROM`, `RUN`, `COPY`, `CMD`…) that Docker executes in order to build an image layer by layer.

### What does `EXPOSE` do?
It documents which port the container listens on. It does not publish the port; you still need `-p host:container` (or `-P`) at run time.

### How do you persist data in Docker?
Use named volumes (managed by Docker, ideal for databases) or bind mounts (host directories). Data written only to the container's writable layer is lost when the container is removed.

### COPY vs ADD?
Both copy files into the image. `ADD` additionally supports remote URLs and auto-extracts local tar archives. Prefer `COPY` for clarity and predictability.

## Intermediate

### CMD vs ENTRYPOINT?
`ENTRYPOINT` sets the executable that always runs; `CMD` provides default arguments (or the default command if no entrypoint). Arguments passed to `docker run` replace `CMD` but are appended to `ENTRYPOINT`. Use exec (JSON) form so signals reach the process.

### What are multi-stage builds and why use them?
Dockerfiles with multiple `FROM` stages where later stages copy artifacts from earlier ones (`COPY --from=build`). They keep compilers, dev dependencies and source code out of the final image, producing small, secure runtime images from a single Dockerfile.

### How does Docker layer caching work?
Each instruction produces a layer identified by the instruction and its inputs. On rebuild, Docker reuses cached layers until it encounters a changed instruction or changed copied files; all subsequent layers are rebuilt. Order instructions from stable to volatile to maximise cache hits.

### How do containers communicate with each other?
On the same user-defined bridge network (or Compose's default network), containers reach each other by name via Docker's embedded DNS. Ports only need publishing (`-p`) for access from the host or outside world.

### What is Docker Compose?
A tool to define multi-container applications in a YAML file — services, networks, volumes, env vars, health checks and dependencies — and manage them with `docker compose up/down`. Ideal for local development and integration testing.

### How do you reduce Docker image size?
Use slim/alpine/distroless bases, multi-stage builds, `.dockerignore`, install only production dependencies, combine `RUN` steps and clean package caches in the same layer, and remove build tools from the final stage.

### Why should containers run as non-root?
If an attacker escapes or exploits the app, root inside the container maps to significant privileges on the host (especially without user namespaces). Running as an unprivileged user limits damage; platforms like OpenShift enforce it.

## Advanced

### How are containers isolated under the hood?
Linux namespaces give each container its own view of PIDs, network, mounts, hostname, IPC and users; cgroups limit CPU, memory and I/O; OverlayFS provides layered copy-on-write filesystems; capabilities, seccomp and AppArmor/SELinux restrict privileged operations. runc sets all this up per the OCI runtime spec.

### What does exit code 137 mean and how do you troubleshoot it?
The process was killed with SIGKILL (128 + 9) — usually the kernel OOM killer because the container exceeded its memory limit, or a forced stop after a SIGTERM timeout. Check `docker inspect` for `OOMKilled`, monitor memory usage, fix leaks, tune heap sizes (e.g., Node's `--max-old-space-size`, JVM `-XX:MaxRAMPercentage`) or raise the limit.

### How do you handle secrets in Docker?
Never bake them into images or `ENV` in Dockerfiles (they remain in layer history). Use BuildKit `--mount=type=secret` for build-time secrets, and inject runtime secrets via orchestrator secrets (Kubernetes Secrets, Docker Swarm secrets), mounted files, or a vault (HashiCorp Vault, cloud secret managers).

### Docker vs Podman?
Podman is daemonless (each container is a child process), rootless by default, and supports pods; its CLI is Docker-compatible. Docker uses a central root daemon (rootless mode available) with a richer desktop/compose ecosystem. Both produce OCI images; Red Hat/OpenShift environments favour Podman/Buildah/CRI-O.

### Why does my container not shut down gracefully?
Likely the app isn't PID 1 receiving SIGTERM (shell form CMD wraps it in `sh`), the app doesn't handle SIGTERM, or child processes aren't reaped. Use exec form, add `--init`/tini, implement signal handling, and ensure the stop timeout is long enough.

### How do you build multi-architecture images?
Use `docker buildx build --platform linux/amd64,linux/arm64 -t repo/app:tag --push .`, which builds per-platform images (natively or via QEMU emulation/cross-compilation) and pushes a manifest list so each host pulls the matching architecture.

### How would you secure the container supply chain?
Use minimal, pinned and trusted base images; scan in CI with Trivy/Grype; generate SBOMs; sign images with Cosign and verify signatures with admission controllers (Kyverno, Gatekeeper); use private registries with access control; rebuild frequently; and enforce non-root, read-only and dropped capabilities at runtime.

# Scenario Questions

## Beginner

### Your container starts and exits immediately with code 0. Why?
A container lives only as long as its **main process** (PID 1). If the command finishes (a script runs and exits, a service daemonises into the background, or `CMD` is a shell that ends), the container stops. Run the process in the foreground (`nginx -g 'daemon off;'`, `node server.js`) and check with `docker logs` and `docker inspect --format '{{.State.ExitCode}}'`.

### The app inside the container works, but `localhost:3000` on your machine can't reach it. What's wrong?
- Either the port isn't published (`-p 3000:3000`), or
- the app binds to `127.0.0.1` **inside** the container, which is unreachable from outside. Bind to `0.0.0.0`.

Check `docker ps` for the port mapping.

## Intermediate

### Every code change triggers a 5-minute `npm install` in your Docker build. How do you fix it?
Order the layers for **caching**: copy `package*.json` first, run `npm ci`, *then* copy the source. Add a `.dockerignore` (node_modules, .git, dist), use BuildKit cache mounts (`RUN --mount=type=cache,target=/root/.npm npm ci`), and use multi-stage builds so the final image only holds production output.

### Your image is 1.8 GB. How do you shrink it?
- Multi-stage build: build in a full image, copy only the artifacts into `node:22-slim`, alpine, or distroless.
- Remove dev dependencies (`npm ci --omit=dev`).
- Clean package manager caches in the same `RUN` layer.
- Use `.dockerignore`.
- Inspect layers with `docker history` or `dive`.

## Advanced

### `docker stop` takes 10 seconds and your app never runs its graceful shutdown. Why?
The app isn't PID 1, or doesn't handle **SIGTERM**. With shell-form `CMD npm start`, `sh` or `npm` receives the signal and doesn't forward it, so Docker sends SIGKILL after the timeout. Use exec form (`CMD ["node","server.js"]`), handle SIGTERM in code (stop accepting requests, drain, close the DB), or use `--init`/tini to reap zombies and forward signals.

# Tricky Questions

## Beginner

### What's the difference between these? `CMD ["npm", "start"]` vs `ENTRYPOINT ["npm"]` + `CMD ["start"]`
With only `CMD`, `docker run img bash` replaces the whole command. With `ENTRYPOINT` plus `CMD`, the arguments you pass replace only `CMD`, so `docker run img test` runs `npm test`. The entrypoint is the fixed executable and CMD supplies the default arguments.

## Intermediate

### You deleted a secret in a later layer: `COPY .env .` then `RUN rm .env`. Is the secret gone from the image?
**No.** Every layer is kept, so the file still exists in the `COPY` layer and anyone with the image can extract it (`docker save`). Use BuildKit secrets (`RUN --mount=type=secret,id=npmrc …`), runtime environment variables or secret managers, and rotate anything that leaked.

### Why does `RUN apt-get update` followed by `RUN apt-get install -y curl` sometimes install stale or missing packages?
The `update` layer is **cached** from an old build while the install layer reruns, so the package lists are out of date. Combine them: `RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*`.
