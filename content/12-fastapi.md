---
id: fastapi
title: FastAPI
short: FastAPI
category: Backend
order: 12
color: #009688
icon: FA
summary: Type-hint driven APIs — Pydantic models, dependency injection, async I/O, auth with OAuth2/JWT, SQLAlchemy, testing, background work and production deployment. Also Flask in brief.
---

# Beginner

## What FastAPI Is

FastAPI is a modern, high-performance Python web framework for building APIs, built on:
- **Starlette** — ASGI toolkit (routing, middleware, WebSockets).
- **Pydantic** — data validation and serialization using type hints.

### Why it's popular
- Type hints drive **validation, serialization and docs** automatically.
- **Auto-generated OpenAPI docs** at `/docs` (Swagger UI) and `/redoc`.
- **Async-first** (ASGI) — high throughput for I/O-bound services.
- Excellent editor support and fewer bugs.

```bash
pip install "fastapi[standard]"
fastapi dev main.py        # dev server with reload (uses Uvicorn)
```

```python main.py
from fastapi import FastAPI

app = FastAPI(title="Orders API", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "Hello"}
```

### WSGI vs ASGI
WSGI (Flask, classic Django) handles one request per worker thread synchronously. ASGI supports async, long-lived connections (WebSockets, SSE) and HTTP/2-style concurrency.

## Path, Query Parameters and Request Bodies

```python
from fastapi import FastAPI, Query, Path, HTTPException
from pydantic import BaseModel, Field, EmailStr

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(
    item_id: int = Path(gt=0),                       # path param, validated
    q: str | None = Query(default=None, max_length=50),  # optional query param
    limit: int = 10,                                 # query param with default
):
    return {"item_id": item_id, "q": q, "limit": limit}

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=50)
    age: int | None = Field(default=None, ge=18)

class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str

@app.post("/users", response_model=UserOut, status_code=201)
async def create_user(user: UserCreate):          # body parsed & validated
    if await repo.exists(user.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    return await repo.create(user)
```

Rules FastAPI applies:
- Declared in the path → **path parameter**.
- Simple type not in the path → **query parameter**.
- Pydantic model → **request body**.

Invalid input automatically returns **422 Unprocessable Entity** with details.

`response_model` filters the output (e.g., never leaks `password_hash`) and documents it.

## Pydantic Models in Depth

```python
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from datetime import datetime

class Order(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)  # ORM mode

    id: int
    items: list[str] = Field(min_length=1)
    total: float = Field(gt=0)
    coupon: str | None = None
    created_at: datetime

    @field_validator("coupon")
    @classmethod
    def upper_coupon(cls, v): return v.upper() if v else v

    @model_validator(mode="after")
    def check_total(self):
        if self.total > 100000: raise ValueError("total too large")
        return self

order = Order.model_validate({"id": 1, "items": ["a"], "total": "9.5", "created_at": "2026-10-21T10:00:00"})
order.model_dump(); order.model_dump_json(exclude_none=True)
```

- Pydantic v2 has a Rust core (**pydantic-core**) — much faster than v1.
- **Coercion**: `"9.5"` → `9.5` in lax mode; `strict=True` disables it.
- Separate schemas per use: `UserCreate`, `UserUpdate` (all optional), `UserOut`.
- `pydantic-settings` → typed configuration from env vars:
```python
class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    debug: bool = False
    model_config = SettingsConfigDict(env_file=".env")
```

## Routers and Project Structure

```text
app/
├── main.py
├── core/        (config.py, security.py)
├── db/          (session.py, base.py)
├── models/      (SQLAlchemy models)
├── schemas/     (Pydantic models)
├── api/v1/      (users.py, orders.py)
├── services/    (business logic)
└── tests/
```

```python app/api/v1/users.py
from fastapi import APIRouter
router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: int): ...
```
```python app/main.py
app = FastAPI()
app.include_router(users.router, prefix="/api/v1")
```

## Async vs Sync Path Operations

```python
@app.get("/async")
async def async_endpoint():
    data = await httpx_client.get("https://api.example.com")   # non-blocking
    return data.json()

@app.get("/sync")
def sync_endpoint():
    return requests.get("https://api.example.com").json()     # FastAPI runs this in a threadpool
```

- `async def` runs on the **event loop** — must only use non-blocking (awaitable) libraries.
- Plain `def` endpoints are run in a **threadpool** automatically, so blocking calls are OK there.
- **Biggest mistake**: calling blocking code (requests, `time.sleep`, sync DB drivers) inside `async def` — it freezes the whole server.

| Use `async def` when | Use `def` when |
|---|---|
| using async libraries: httpx, asyncpg, SQLAlchemy async, motor, aioredis | using blocking libraries: requests, psycopg2, sync SQLAlchemy |

CPU-heavy work belongs in a process pool or a task queue, not in either.

# Intermediate

## Dependency Injection

FastAPI's `Depends` resolves dependencies per request — for DB sessions, auth, pagination, settings, permissions.

```python
from typing import Annotated
from fastapi import Depends

async def get_db():
    async with SessionLocal() as session:
        yield session                     # code after yield = teardown

def pagination(skip: int = 0, limit: int = Query(20, le=100)):
    return {"skip": skip, "limit": limit}

DB = Annotated[AsyncSession, Depends(get_db)]
Page = Annotated[dict, Depends(pagination)]

@app.get("/orders")
async def list_orders(db: DB, page: Page, user: Annotated[User, Depends(get_current_user)]):
    return await order_service.list(db, user.id, **page)
```

- Dependencies can depend on other dependencies (a graph); results are **cached per request**.
- `yield` dependencies handle setup/cleanup (sessions, transactions).
- Router- or app-level: `APIRouter(dependencies=[Depends(verify_api_key)])`.
- **Override in tests**: `app.dependency_overrides[get_db] = get_test_db`.
- Class dependencies: `Depends(CommonQueryParams)`.

## Authentication: OAuth2 Password Flow with JWT

```python
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
from pwdlib import PasswordHash

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
password_hash = PasswordHash.recommended()   # Argon2

def create_access_token(sub: str, minutes: int = 15) -> str:
    payload = {"sub": sub, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

@app.post("/auth/token")
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DB):
    user = await users.get_by_email(db, form.username)
    if not user or not password_hash.verify(form.password, user.password_hash):
        raise HTTPException(401, "Incorrect credentials", headers={"WWW-Authenticate": "Bearer"})
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: DB) -> User:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token", headers={"WWW-Authenticate": "Bearer"})
    user = await users.get(db, int(payload["sub"]))
    if not user: raise HTTPException(401, "User not found")
    return user

def require_role(role: str):
    async def checker(user: Annotated[User, Depends(get_current_user)]):
        if role not in user.roles: raise HTTPException(403, "Forbidden")
        return user
    return checker

@app.delete("/admin/users/{id}", dependencies=[Depends(require_role("admin"))])
async def delete_user(id: int): ...
```
Also available: `APIKeyHeader`, `HTTPBearer`, OAuth2 scopes (`Security(get_current_user, scopes=["orders:write"])`), or delegate to an identity provider (Keycloak, Auth0) and just validate its JWTs.

## Databases with SQLAlchemy 2.0

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

engine = create_async_engine(settings.database_url, pool_size=10, max_overflow=20, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    orders: Mapped[list["Order"]] = relationship(back_populates="user")

# query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
stmt = select(User).where(User.email == email).options(selectinload(User.orders))
user = (await db.execute(stmt)).scalar_one_or_none()
```

- **Alembic** for migrations: `alembic revision --autogenerate -m "add users"`, `alembic upgrade head`.
- In async, lazy loading raises errors — use eager loading (`selectinload`, `joinedload`).
- **SQLModel** (by FastAPI's author) merges SQLAlchemy and Pydantic models.
- Unit of work: one session per request via a `yield` dependency; commit in the service layer.

## Error Handling, Middleware and CORS

```python
class DomainError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code, self.message, self.status = code, message, status

@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(status_code=exc.status, content={"error": {"code": exc.code, "message": exc.message}})

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origins=["https://app.example.com"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
```
Also: `GZipMiddleware`, `TrustedHostMiddleware`, `HTTPSRedirectMiddleware`, custom `RequestValidationError` handler to reshape 422s.

## Background Tasks, Lifespan and WebSockets

### BackgroundTasks — fire after response
```python
@app.post("/signup")
async def signup(user: UserCreate, tasks: BackgroundTasks):
    new_user = await users.create(user)
    tasks.add_task(send_welcome_email, new_user.email)   # runs after the response is sent
    return new_user
```
Runs in the same process — fine for small jobs. For heavy/reliable work use **Celery, ARQ, Dramatiq, RQ** or a message broker.

### Lifespan — startup/shutdown resources
```python
from contextlib import asynccontextmanager
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = await redis.from_url(settings.redis_url)
    app.state.http = httpx.AsyncClient()
    yield
    await app.state.http.aclose(); await app.state.redis.aclose()
app = FastAPI(lifespan=lifespan)
```

### WebSockets and streaming
```python
@app.websocket("/ws/{room}")
async def ws(websocket: WebSocket, room: str):
    await websocket.accept()
    try:
        while True:
            msg = await websocket.receive_text()
            await manager.broadcast(room, msg)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/stream")
async def stream():
    async def gen():
        for token in llm_tokens(): yield f"data: {token}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")
```

# Advanced

## Testing FastAPI Applications

```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.fixture
async def client(test_db):
    app.dependency_overrides[get_db] = lambda: test_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_create_user(client):
    res = await client.post("/users", json={"email": "a@b.com", "name": "Asha"})
    assert res.status_code == 201
    assert res.json()["email"] == "a@b.com"

async def test_validation(client):
    res = await client.post("/users", json={"email": "bad"})
    assert res.status_code == 422
```
- `TestClient` (sync) for simple tests; `httpx.AsyncClient` for async.
- Override dependencies for DB, auth (`get_current_user` → fake user), external clients.
- Use a test database with transactions rolled back per test, or testcontainers.

## Performance and Scalability

```bash
pip install "uvicorn[standard]" orjson
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000   # or: uvicorn --workers 4
```
```python
from fastapi.responses import ORJSONResponse
app = FastAPI(default_response_class=ORJSONResponse)
engine = create_async_engine(DB_URL, pool_size=10, max_overflow=5, pool_pre_ping=True)
http = httpx.AsyncClient(timeout=5, limits=httpx.Limits(max_connections=100))  # reuse, don't create per request
```

### How FastAPI is fast
Starlette's lean ASGI core, async I/O with uvloop/httptools, and Pydantic v2's Rust validation. It's among the fastest Python frameworks — but your DB and external calls usually dominate.

### Practical tuning
- Run multiple worker processes: `fastapi run --workers 4` or `gunicorn -k uvicorn.workers.UvicornWorker -w 4` (≈ CPU cores); in Kubernetes often 1–2 workers per pod and scale pods.
- Async DB driver with a properly sized pool; reuse a single `httpx.AsyncClient`.
- Cache with Redis (`fastapi-cache`), HTTP caching headers, ETags.
- Limit concurrency to downstreams with `asyncio.Semaphore`; set timeouts everywhere.
- Use `ORJSONResponse` or return Pydantic models directly; avoid huge responses — paginate, stream.
- Offload CPU-bound work: `ProcessPoolExecutor`, Celery, or separate services.
- Rate limiting: `slowapi` or at the API gateway.

## Production Deployment

```dockerfile Dockerfile
FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app
RUN useradd -m appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
CMD ["uv", "run", "fastapi", "run", "app/main.py", "--port", "8000", "--proxy-headers"]
```

Checklist:
- Behind a reverse proxy / ingress (TLS termination); `--proxy-headers` / `--forwarded-allow-ips`.
- Health endpoints (`/healthz`, `/readyz`), graceful shutdown via lifespan.
- Structured logging (structlog/loguru JSON), OpenTelemetry tracing (`opentelemetry-instrumentation-fastapi`), Prometheus metrics.
- Settings from environment, secrets from a vault; disable `/docs` in production if needed (`docs_url=None`).
- Run Alembic migrations as a separate release job.

## FastAPI vs Flask vs Django

| | FastAPI | Flask | Django |
|---|---|---|---|
| Style | API-first, async, type hints | micro-framework, sync (async views supported) | full-stack, batteries included |
| Validation | Pydantic built in | extensions (Marshmallow, Pydantic) | Forms / DRF serializers |
| Docs | automatic OpenAPI | extensions | DRF + drf-spectacular |
| ORM | bring your own (SQLAlchemy/SQLModel) | bring your own | built-in ORM + admin |
| Best for | microservices, ML model serving, high-concurrency APIs | small apps, flexibility | content sites, admin-heavy apps, monoliths |

### Flask essentials (often asked alongside)
```python
from flask import Flask, request, jsonify, g
app = Flask(__name__)

@app.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    return jsonify(id=user_id)

@app.before_request
def load_user(): g.user = current_user_from(request)
```
Concepts: application & request **contexts** (`current_app`, `g`, `request` are context-local proxies), **blueprints** for modular apps, app factory pattern (`create_app()`), extensions (Flask-SQLAlchemy, Flask-Login, Flask-Migrate).

## Serving ML Models with FastAPI

FastAPI is the default choice for ML inference APIs.

```python
@asynccontextmanager
async def lifespan(app):
    app.state.model = joblib.load("model.joblib")    # load once at startup
    yield

class Features(BaseModel):
    age: float
    income: float

@app.post("/predict")
def predict(f: Features, request: Request):          # sync def: model.predict is CPU-bound
    pred = request.app.state.model.predict([[f.age, f.income]])
    return {"prediction": float(pred[0])}
```
- Load models once (lifespan), not per request.
- CPU/GPU inference is blocking → sync endpoints, process workers, or dedicated servers (Triton, TorchServe, vLLM for LLMs, Ray Serve, BentoML).
- Batch requests for GPU efficiency; version models; monitor latency and drift.

# Interview Questions

## Beginner

### What is FastAPI and why is it fast?
A modern Python API framework based on Starlette (ASGI) and Pydantic. It's fast at runtime thanks to async I/O and Pydantic v2's Rust core, and fast to develop because type hints generate validation, serialization and OpenAPI docs automatically.

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
class Item(BaseModel):
    name: str
    price: float

@app.post("/items", status_code=201)
async def create(item: Item) -> Item:      # validation, serialization and docs from the type hints
    return item
# uvicorn main:app --reload  → http://localhost:8000/docs
```

### How does FastAPI distinguish path, query and body parameters?
Parameters declared in the route path are path params; simple-typed parameters not in the path are query params; parameters typed as Pydantic models are read from the JSON body. `Path()`, `Query()`, `Body()`, `Header()`, `Cookie()` make it explicit and add validation.

```python
@app.put("/users/{user_id}/items")
async def update(
    user_id: int,                     # path (in the URL template)
    q: str | None = None,             # query  ?q=...
    limit: int = Query(10, le=100),   # query with validation
    item: Item = Body(...),           # body (Pydantic model)
    x_token: str = Header(...),       # header X-Token
):
    return {"user_id": user_id, "q": q, "item": item}
```

### What is Pydantic used for in FastAPI?
Defining request and response schemas. It parses and validates incoming data (with type coercion), produces clear 422 errors, serializes outputs, filters fields via `response_model`, and generates JSON Schema for the OpenAPI docs.

```python
from pydantic import BaseModel, EmailStr, Field, field_validator

class UserCreate(BaseModel):
    email: EmailStr
    age: int = Field(ge=18)
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def strong(cls, v):
        if v.isalpha(): raise ValueError("must contain a digit or symbol")
        return v

UserCreate(email="a@b.com", age="21", password="s3cretpass").age   # 21 (coerced to int)
```

### What is the purpose of `response_model`?
It declares the output schema: FastAPI validates and filters the returned data to that model (e.g., excluding a password hash), converts it to JSON, and documents it in OpenAPI.

```python
class UserOut(BaseModel):
    id: int
    email: str

@app.get("/users/{id}", response_model=UserOut)
async def get_user(id: int, db=Depends(get_db)):
    return await db.get(UserORM, id)     # ORM object has password_hash → filtered out
```

### Where can you see the automatic docs?
Swagger UI at `/docs` and ReDoc at `/redoc`, generated from the OpenAPI schema at `/openapi.json`.

```python
app = FastAPI(title="Orders API", version="1.2.0", docs_url="/docs", redoc_url="/redoc")

@app.get("/orders/{id}", summary="Get one order", tags=["orders"],
         responses={404: {"description": "Order not found"}})
async def get_order(id: int): ...
# curl localhost:8000/openapi.json | jq '.paths | keys'
```

### What status code does FastAPI return for validation errors?
422 Unprocessable Entity, with a detailed list of which fields failed and why. You can customise this with an exception handler for `RequestValidationError`.

```python
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"errors": [
        {"field": ".".join(map(str, e["loc"])), "msg": e["msg"]} for e in exc.errors()]})
```
```json Default 422 body
{ "detail": [{ "type": "missing", "loc": ["body", "email"], "msg": "Field required" }] }
```

## Intermediate

### When should you use `async def` vs `def` for endpoints?
Use `async def` when every I/O call inside is awaitable (async DB driver, httpx). Use `def` when you call blocking libraries — FastAPI runs those in a threadpool so they don't block the event loop. Blocking code inside `async def` stalls all requests.

```python
@app.get("/async")
async def a():
    async with httpx.AsyncClient() as c:      # ✅ awaitable I/O
        return (await c.get(URL)).json()

@app.get("/sync")
def b():
    return requests.get(URL).json()           # ✅ FastAPI runs def endpoints in a threadpool

@app.get("/bad")
async def c():
    return requests.get(URL).json()           # ❌ blocks the event loop
```

### How does dependency injection work in FastAPI?
You declare dependencies with `Depends(callable)` in endpoint parameters. FastAPI resolves the dependency graph per request, passes results in, caches repeated dependencies within the request, and runs teardown code after `yield`. It's used for DB sessions, auth, permissions, pagination and config, and is easily overridden in tests.

```python
def pagination(skip: int = 0, limit: int = Query(20, le=100)):
    return {"skip": skip, "limit": limit}

async def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)) -> User:
    return await users.from_token(db, token)

@app.get("/orders")
async def orders(page=Depends(pagination), user: User = Depends(get_current_user)):
    return await list_orders(user.id, **page)

app.dependency_overrides[get_current_user] = lambda: User(id=1)  # in tests
```

### How do you implement JWT authentication in FastAPI?
Expose a token endpoint using `OAuth2PasswordRequestForm` that verifies the password hash and returns a signed JWT. Protect routes with a `get_current_user` dependency built on `OAuth2PasswordBearer` that decodes and validates the token and loads the user; layer role/scope checks as further dependencies.

```python
import jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/token")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate(form.username, form.password)
    if not user: raise HTTPException(401, "Bad credentials")
    exp = datetime.now(timezone.utc) + timedelta(minutes=15)
    return {"access_token": jwt.encode({"sub": str(user.id), "exp": exp}, SECRET, "HS256"), "token_type": "bearer"}

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try: payload = jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError: raise HTTPException(401, headers={"WWW-Authenticate": "Bearer"})
    return await load_user(int(payload["sub"]))
```

### BackgroundTasks vs Celery?
`BackgroundTasks` runs a function in the same process after the response is sent — simple, no infrastructure, but not durable (lost on crash) and competes for server resources. Celery (or ARQ/RQ) uses a broker and separate workers for durable, retryable, scalable and scheduled jobs.

```python
# BackgroundTasks: same process, after the response, not durable
@app.post("/signup")
async def signup(user: UserCreate, tasks: BackgroundTasks):
    u = await create_user(user)
    tasks.add_task(send_welcome_email, u.email)
    return u

# Celery: separate workers, retries, survives restarts
@celery.task(autoretry_for=(SMTPException,), retry_backoff=True, max_retries=5)
def generate_invoice_pdf(order_id: int): ...
generate_invoice_pdf.delay(order.id)
```

### How do you manage DB sessions per request?
Create an async session factory and a `yield` dependency that opens a session, yields it to the endpoint and closes it afterwards (committing or rolling back). This gives one unit of work per request and makes overriding with a test session trivial.

```python
engine = create_async_engine(DATABASE_URL, pool_size=10)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

@app.post("/orders")
async def create_order(o: OrderIn, db: AsyncSession = Depends(get_db)):
    db.add(Order(**o.model_dump()))
```

### How do you handle startup and shutdown logic?
With a `lifespan` async context manager passed to `FastAPI(lifespan=...)`: code before `yield` runs at startup (create DB pools, HTTP clients, load ML models), code after runs at shutdown (close them). The older `on_event` handlers are deprecated.

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient()
    app.state.model = load_model("model.onnx")     # once, not per request
    yield
    await app.state.http.aclose()
    await engine.dispose()

app = FastAPI(lifespan=lifespan)
```

## Advanced

### How would you scale a FastAPI service?
Run multiple Uvicorn workers or pods behind a load balancer, keep the app stateless, use async drivers with tuned connection pools, cache hot data in Redis, add timeouts/retries/circuit breakers for downstreams, offload CPU and long tasks to workers, paginate and stream large responses, and autoscale on CPU/latency metrics.

```yaml docker-compose (simplified)
services:
  api:
    image: orders-api
    command: uvicorn app.main:app --host 0.0.0.0 --workers 2
    deploy: { replicas: 4 }
    environment: { DATABASE_URL: postgresql+asyncpg://app@pgbouncer:6432/app, REDIS_URL: redis://redis:6379 }
  pgbouncer: { image: edoburu/pgbouncer, environment: { POOL_MODE: transaction } }
  redis: { image: redis:7 }
```

### How do you test endpoints that require authentication and a database?
Use `TestClient` or `httpx.AsyncClient` with `ASGITransport`, override `get_current_user` to return a fake user and `get_db` to return a session bound to a test database (rolled back per test or a testcontainer). Assert on status codes and JSON bodies; test 401/403/422 paths too.

```python
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.fixture
async def client(test_session):
    app.dependency_overrides[get_db] = lambda: test_session
    app.dependency_overrides[get_current_user] = lambda: User(id=1, role="admin")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

async def test_create_order(client):
    r = await client.post("/orders", json={"sku": "A1", "qty": 2})
    assert r.status_code == 201 and r.json()["qty"] == 2
```

### What is ASGI and how does it differ from WSGI?
WSGI is a synchronous interface: one request occupies a worker until finished. ASGI is its asynchronous successor: an app is an async callable receiving `scope`, `receive` and `send`, supporting concurrency within one worker plus long-lived protocols like WebSockets and lifespan events.

```python WSGI app
def app(environ, start_response):            # sync, one request per worker thread
    start_response("200 OK", [("Content-Type", "text/plain")])
    return [b"hello"]
```
```python ASGI app
async def app(scope, receive, send):         # async, handles HTTP + WebSockets + lifespan
    await send({"type": "http.response.start", "status": 200, "headers": [(b"content-type", b"text/plain")]})
    await send({"type": "http.response.body", "body": b"hello"})
```

### How do you avoid blocking the event loop with CPU-heavy work like ML inference?
Use sync endpoints (threadpool) for moderately blocking calls, `run_in_executor` with a `ProcessPoolExecutor` for CPU-bound work, or move inference to separate workers/servers (Celery, Ray Serve, Triton). Batch requests where possible and size workers per CPU/GPU.

```python
from concurrent.futures import ProcessPoolExecutor
pool = ProcessPoolExecutor(max_workers=4)

@app.post("/predict")
async def predict(req: PredictIn):
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(pool, run_model, req.features)  # off the event loop
    return {"prediction": result}

# Moderate blocking: await asyncio.to_thread(blocking_fn, arg)  or just a plain `def` endpoint
```

### FastAPI vs Django REST Framework — how do you choose?
FastAPI suits API-only microservices, async-heavy workloads and ML serving, with lightweight structure and automatic docs. DRF suits projects needing Django's ORM, admin, auth and ecosystem, or full-stack apps with a mature, conventional structure. Team expertise and existing stack often decide.

```python FastAPI
@app.get("/products/{id}", response_model=ProductOut)
async def product(id: int, db=Depends(get_db)): return await db.get(Product, id)
```
```python DRF
class ProductViewSet(viewsets.ModelViewSet):     # CRUD + admin + auth + ORM out of the box
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
router.register("products", ProductViewSet)
```

# Scenario Questions

## Beginner

### Your FastAPI endpoint returns 422 Unprocessable Entity, but the request "looks right". How do you debug it?
422 means **request validation failed**. Read the `detail` array: it lists each `loc` (`body`, `query`, `path`) and the error. Common causes:
- sending form data or a query param where the endpoint expects a JSON body
- a wrong field name or type
- a missing `Content-Type: application/json`
- an endpoint parameter declared as a query param when you meant the body (a plain `str` parameter that's not in the path is a query param)

```bash
curl -s -X POST localhost:8000/items -d 'name=x&price=1'          # ❌ form data, endpoint expects JSON
curl -s -X POST localhost:8000/items -H 'Content-Type: application/json' -d '{"name":"x","price":1}'  # ✅
```
```python
# ❌ a bare scalar parameter is a QUERY param, not body
@app.post("/rate")
async def rate(score: int): ...
# ✅ read it from the body
async def rate(score: int = Body(embed=True)): ...   # {"score": 5}
```

## Intermediate

### Throughput collapses under load even though the endpoints are `async def`. Why?
A **blocking call** inside `async def` (`requests.get`, a sync DB driver, `time.sleep`, CPU-heavy work) freezes the event loop for every request. Fixes:
- use async libraries (`httpx.AsyncClient`, asyncpg, async SQLAlchemy)
- declare the endpoint as plain `def`, so FastAPI runs it in a threadpool
- `await run_in_threadpool(...)` or `asyncio.to_thread`
- offload heavy work to a worker

```python
# ❌ looks async, isn't
@app.get("/report")
async def report(db=Depends(get_sync_db)):
    rows = db.execute(text("SELECT ...")).all()      # sync driver blocks the loop
    time.sleep(0.1)

# ✅
@app.get("/report")
async def report(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text("SELECT ..."))).all()   # asyncpg
    await asyncio.sleep(0.1)
# Detect it: PYTHONASYNCIODEBUG=1 logs "Executing <Task> took 0.5 seconds"
```

### How do you make every endpoint require a valid JWT, except `/health` and `/login`?
Create a dependency that decodes and validates the token (`OAuth2PasswordBearer` plus PyJWT, with algorithm, expiry and audience checks), and attach it to routers with `APIRouter(dependencies=[Depends(get_current_user)])` instead of each route. Keep public routes on a separate router. Return 401 with `WWW-Authenticate`, and add scope or role checks in sub-dependencies.

```python
public = APIRouter()
@public.get("/health")
async def health(): return {"ok": True}
@public.post("/login")
async def login(...): ...

protected = APIRouter(dependencies=[Depends(get_current_user)])   # applies to every route below
protected.include_router(orders.router)
protected.include_router(users.router)

app.include_router(public)
app.include_router(protected, prefix="/api")
```

## Advanced

### Database connections run out ("too many clients") when you scale FastAPI to 20 pods. How do you fix it?
Each pod's pool (pool_size + max_overflow) multiplied by workers and pods exceeds Postgres `max_connections`. Shrink the per-process pools, put **PgBouncer** (transaction pooling) in front, make sure sessions are closed (a `yield` dependency with `finally`), and use one engine per process, not one per request.

```text
20 pods × 4 workers × (pool_size 10 + max_overflow 10) = 1,600 connections  >  max_connections 200
```
```python
engine = create_async_engine(
    "postgresql+asyncpg://app@pgbouncer:6432/app",
    pool_size=2, max_overflow=2,                 # small per-process pool
    connect_args={"statement_cache_size": 0},    # required with PgBouncer transaction mode
)
```

# Tricky Questions

## Intermediate

### In which order do these run, and when does the cleanup happen?
```python
async def get_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()
```
FastAPI runs the code before `yield` before the endpoint and injects `db`. The `finally` runs **after the endpoint returns**, as part of finishing the response. Its timing relative to background tasks has changed between FastAPI versions, so never rely on a yield-managed session inside a `BackgroundTask`. Open a new session inside the task instead.

### Why does this endpoint leak `password_hash` to clients?
```python
@app.get("/users/{id}")
def get_user(id: int) -> dict:
    return db.get_user(id).__dict__
```
Returning a raw dict, or the ORM model without a `response_model`, serialises every field. Declare `response_model=UserOut` (or a return annotation `-> UserOut`) with only the public fields. FastAPI filters the output through it.
