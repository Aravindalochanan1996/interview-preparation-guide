---
id: flask
title: Flask
short: Flask
category: Backend
order: 11.5
color: #3d8fb0
icon: Fl
summary: Python micro-framework for web apps and APIs: routing, request/response, Jinja templates, blueprints, app factory, SQLAlchemy, auth, testing, async and production deployment.
---

# Beginner

## What Flask Is and Your First App

**Flask** is a lightweight WSGI micro-framework. It gives you routing, request/response objects, Jinja2 templates and a dev server, and leaves the database, forms and auth to extensions you choose. It's simple to start with and flexible to grow.

```bash
python -m venv .venv && source .venv/bin/activate
pip install flask
```
```python app.py
from flask import Flask

app = Flask(__name__)

@app.get("/")
def home():
    return "Hello, Flask!"

@app.get("/health")
def health():
    return {"status": "ok"}          # dicts are returned as JSON automatically

if __name__ == "__main__":
    app.run(debug=True)              # dev server only; never use debug=True in production
```
```bash
flask --app app run --debug          # http://127.0.0.1:5000
```

## Routing, URL Parameters and HTTP Methods

```python
from flask import Flask, request, url_for, redirect, abort

@app.get("/users/<int:user_id>")                 # converters: string, int, float, path, uuid
def get_user(user_id):
    user = USERS.get(user_id) or abort(404)
    return user

@app.route("/users", methods=["GET", "POST"])
def users():
    if request.method == "POST":
        data = request.get_json()                # JSON body
        USERS[len(USERS) + 1] = data
        return data, 201                         # (body, status)
    page = request.args.get("page", 1, type=int) # query string ?page=2
    return {"page": page, "users": list(USERS.values())}

@app.get("/old-profile")
def old_profile():
    return redirect(url_for("get_user", user_id=1))   # build URLs by endpoint name, never hard-code
```

## Request, Response and Context Locals

Flask exposes **context locals**: `request`, `session`, `g` and `current_app`. They look global but are bound to the current request or app context.

```python
from flask import request, make_response, jsonify, g, session

@app.before_request
def load_user():
    g.user = get_user_from_token(request.headers.get("Authorization"))   # per-request storage

@app.post("/login")
def login():
    form = request.form                       # form fields
    upload = request.files.get("avatar")      # uploaded file
    resp = make_response(jsonify(ok=True), 200)
    resp.set_cookie("theme", "dark", httponly=True, secure=True, samesite="Lax")
    session["user_id"] = 42                   # signed cookie session (needs SECRET_KEY)
    return resp

@app.after_request
def add_headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp
```

## Templates with Jinja2

```python
from flask import render_template

@app.get("/products")
def products():
    return render_template("products.html", products=fetch_products(), title="Shop")
```
```jinja templates/base.html
<!doctype html>
<html><head><title>{% block title %}{{ title }}{% endblock %}</title></head>
<body>
  <nav><a href="{{ url_for('home') }}">Home</a></nav>
  {% with messages = get_flashed_messages() %}{% for m in messages %}<p class="flash">{{ m }}</p>{% endfor %}{% endwith %}
  {% block content %}{% endblock %}
</body></html>
```
```jinja templates/products.html
{% extends "base.html" %}
{% block content %}
  <ul>
  {% for p in products %}
    <li>{{ p.name }} — {{ "%.2f"|format(p.price) }} €</li>   {# auto-escaped: safe from XSS #}
  {% else %}
    <li>No products</li>
  {% endfor %}
  </ul>
{% endblock %}
```

# Intermediate

## Application Factory, Config and Blueprints

For anything beyond a toy app, use an **application factory** (`create_app`) and **blueprints** that group routes by feature. That allows multiple configs (dev/test/prod), avoids circular imports, and makes testing easy.

```text
shop/
  __init__.py        # create_app()
  config.py
  extensions.py      # db = SQLAlchemy(), migrate = Migrate(), login = LoginManager()
  orders/
    __init__.py      # bp = Blueprint("orders", __name__, url_prefix="/orders")
    routes.py
  auth/ …
wsgi.py              # app = create_app()
```
```python shop/__init__.py
from flask import Flask
from .extensions import db, migrate

def create_app(config_object="shop.config.ProdConfig"):
    app = Flask(__name__)
    app.config.from_object(config_object)
    app.config.from_prefixed_env()                  # FLASK_SECRET_KEY, FLASK_SQLALCHEMY_DATABASE_URI …
    db.init_app(app); migrate.init_app(app, db)
    from .orders.routes import bp as orders_bp
    app.register_blueprint(orders_bp)
    return app
```
```python shop/orders/routes.py
from flask import Blueprint
bp = Blueprint("orders", __name__, url_prefix="/orders")

@bp.get("/<int:order_id>")
def detail(order_id):
    return Order.query.get_or_404(order_id).to_dict()
```

## Databases with Flask-SQLAlchemy and Migrations

```python shop/models.py
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .extensions import db

class Customer(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(db.String(255), unique=True, index=True)
    orders: Mapped[list["Order"]] = relationship(back_populates="customer")

class Order(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(db.ForeignKey("customer.id"))
    total: Mapped[float] = mapped_column(db.Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    customer: Mapped[Customer] = relationship(back_populates="orders")
```
```python Queries
from sqlalchemy import select
stmt = select(Order).where(Order.total > 100).order_by(Order.created_at.desc()).limit(20)
orders = db.session.scalars(stmt).all()
db.session.add(Order(customer_id=1, total=42)); db.session.commit()
page = db.paginate(select(Order), page=2, per_page=20)
```
```bash
flask --app wsgi db init && flask --app wsgi db migrate -m "orders" && flask --app wsgi db upgrade
```

## Building REST APIs: Validation and Error Handling

```python
from marshmallow import Schema, fields, ValidationError
from werkzeug.exceptions import HTTPException

class OrderIn(Schema):
    sku = fields.Str(required=True)
    qty = fields.Int(required=True, validate=lambda n: 0 < n <= 99)

@bp.post("")
def create_order():
    try:
        data = OrderIn().load(request.get_json() or {})
    except ValidationError as e:
        return {"errors": e.messages}, 422
    order = Order(**data); db.session.add(order); db.session.commit()
    return {"id": order.id}, 201, {"Location": url_for("orders.detail", order_id=order.id)}

@app.errorhandler(HTTPException)
def http_error(e):
    return {"error": e.name, "detail": e.description}, e.code       # JSON errors instead of HTML

@app.errorhandler(Exception)
def unhandled(e):
    app.logger.exception("Unhandled error")
    return {"error": "Internal Server Error"}, 500
```

## Authentication: Sessions, Flask-Login and JWT

```python Session-based login for server-rendered apps
from flask_login import LoginManager, login_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash

login_manager = LoginManager()
@login_manager.user_loader
def load_user(user_id): return db.session.get(User, int(user_id))

@app.post("/login")
def do_login():
    user = db.session.scalar(select(User).filter_by(email=request.form["email"]))
    if user and check_password_hash(user.password_hash, request.form["password"]):
        login_user(user, remember=False)
        return redirect(url_for("dashboard"))
    flash("Invalid credentials"); return redirect(url_for("login"))

@app.get("/dashboard")
@login_required
def dashboard(): return f"Hi {current_user.email}"
```
```python JWT for APIs (Flask-JWT-Extended)
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
jwt = JWTManager(app)
@app.post("/api/token")
def token():
    user = authenticate(request.json["email"], request.json["password"]) or abort(401)
    return {"access_token": create_access_token(identity=str(user.id))}
@app.get("/api/me")
@jwt_required()
def me(): return {"id": get_jwt_identity()}
```

# Advanced

## Testing Flask Apps with pytest

```python tests/conftest.py
import pytest
from shop import create_app
from shop.extensions import db

@pytest.fixture
def app():
    app = create_app("shop.config.TestConfig")   # SQLALCHEMY_DATABASE_URI = "sqlite://", TESTING = True
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app): return app.test_client()
```
```python tests/test_orders.py
def test_create_order(client):
    r = client.post("/orders", json={"sku": "A1", "qty": 2})
    assert r.status_code == 201
    assert client.get(r.headers["Location"]).json["qty"] == 2

def test_rejects_bad_qty(client):
    r = client.post("/orders", json={"sku": "A1", "qty": 0})
    assert r.status_code == 422 and "qty" in r.json["errors"]
```

## Contexts, Extensions and Signals Under the Hood

- **Application context**: `current_app` and `g`. It's pushed for each request, or manually with `with app.app_context():` for CLI and scripts.
- **Request context**: `request` and `session`. Context locals are implemented with `contextvars`, so they're safe across threads and async tasks.

```python Writing a tiny extension
class Audit:
    def __init__(self, app=None):
        if app: self.init_app(app)
    def init_app(self, app):
        app.config.setdefault("AUDIT_ENABLED", True)
        app.after_request(self._log)
        app.extensions["audit"] = self
    def _log(self, resp):
        if current_app.config["AUDIT_ENABLED"]:
            current_app.logger.info("%s %s %s", request.method, request.path, resp.status_code)
        return resp
```
```python Custom CLI command
@app.cli.command("seed")
def seed():
    """Insert demo data."""
    db.session.add_all([Customer(email=f"user{i}@test.com") for i in range(10)]); db.session.commit()
# flask --app wsgi seed
```

## Async Views, Background Jobs and Performance

Flask 2+ supports `async def` views, but every request still occupies a WSGI worker. For high-concurrency I/O, use an ASGI framework (Quart, FastAPI). For slow work, use a task queue.

```python
@app.get("/weather")
async def weather():                                    # pip install "flask[async]"
    async with httpx.AsyncClient() as c:
        a, b = await asyncio.gather(c.get(URL_A), c.get(URL_B))
    return {"a": a.json(), "b": b.json()}
```
```python Celery for background work
from celery import Celery, shared_task
def celery_init_app(app):
    celery = Celery(app.name, broker=app.config["CELERY_BROKER_URL"])
    class FlaskTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context(): return self.run(*args, **kwargs)
    celery.Task = FlaskTask; celery.set_default(); return celery

@shared_task(autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_welcome(user_id): ...
# in a view: send_welcome.delay(user.id); return {"status": "queued"}, 202
```
```python Caching
from flask_caching import Cache
cache = Cache(config={"CACHE_TYPE": "RedisCache", "CACHE_REDIS_URL": "redis://redis:6379/0"})
@bp.get("/catalog")
@cache.cached(timeout=60, query_string=True)
def catalog(): return expensive_catalog()
```

## Production Deployment and Security

```bash
pip install gunicorn
gunicorn "shop:create_app()" -w 4 -k gthread --threads 4 -b 0.0.0.0:8000 --access-logfile -
```
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER 1000
CMD ["gunicorn", "wsgi:app", "-w", "4", "-b", "0.0.0.0:8000"]
```
```python Security checklist in code
app.config.update(
    SECRET_KEY=os.environ["SECRET_KEY"],          # never hard-coded
    SESSION_COOKIE_SECURE=True, SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
    MAX_CONTENT_LENGTH=10 * 1024 * 1024,          # reject huge uploads
)
from flask_wtf.csrf import CSRFProtect; CSRFProtect(app)          # CSRF for forms
from flask_talisman import Talisman; Talisman(app, content_security_policy={"default-src": "'self'"})
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)        # behind nginx / a load balancer
```

# Interview Questions

## Beginner

### What is Flask and how does it differ from Django?

Flask is a micro-framework: routing, a request/response layer and Jinja templates, with everything else added through extensions. Django is "batteries included", with an ORM, admin, auth, forms and migrations built in. Flask gives you flexibility and a small core. Django gives you conventions and speed for full-featured apps.

```python
app = Flask(__name__)
@app.get("/")
def index(): return "hi"           # a complete Flask app
```

### How do you define routes and read URL parameters?

Use `@app.route` (or `@app.get`, `@app.post`…) with variable parts and converters. Read query strings from `request.args`, JSON from `request.get_json()`, and form data from `request.form`.

```python
@app.get("/items/<int:item_id>")
def item(item_id):
    expand = request.args.get("expand", "false") == "true"
    return {"id": item_id, "expand": expand}
```

### What is url_for and why use it?

`url_for(endpoint, **values)` builds a URL from an endpoint name. Routes can change without breaking links, it escapes values, and it handles blueprint prefixes and `_external=True` absolute URLs.

```python
url_for("orders.detail", order_id=7)              # '/orders/7'
url_for("static", filename="app.css")
```

### How do you return JSON and status codes?

Return a dict or list (automatically JSON), or `jsonify(...)`, optionally with a status and headers as a tuple.

```python
return {"id": 1}, 201, {"Location": "/items/1"}
```

### What is the `g` object?

A per-request namespace (within the app context) for storing data during one request, such as the current user or a DB connection. It's reset for every request.

```python
@app.before_request
def before(): g.request_start = time.perf_counter()
@app.after_request
def after(r): r.headers["X-Time"] = f"{time.perf_counter() - g.request_start:.3f}"; return r
```

### How do sessions work in Flask?

By default, `session` is a **signed** (not encrypted) cookie. Users can read its contents but can't tamper with them without `SECRET_KEY`. Don't store secrets in it. For server-side sessions, use Flask-Session with Redis.

```python
app.secret_key = os.environ["SECRET_KEY"]
session["cart"] = ["A1"]
```

## Intermediate

### What is the application factory pattern and why use it?

A `create_app(config)` function builds and configures the app. It allows multiple instances with different configs (tests, dev, prod), avoids circular imports with extensions (`db.init_app(app)`), and is what most deployment and test setups expect.

```python
def create_app(cfg="config.Prod"):
    app = Flask(__name__); app.config.from_object(cfg); db.init_app(app); app.register_blueprint(api_bp); return app
```

### What are blueprints?

Modular groups of routes, templates, static files and hooks that you register on an app, often with a URL prefix. They organise large apps by feature and are reusable.

```python
api = Blueprint("api", __name__, url_prefix="/api/v1")
@api.get("/ping")
def ping(): return {"pong": True}
app.register_blueprint(api)
```

### Explain the application and request contexts.

The app context provides `current_app` and `g`. The request context provides `request` and `session`. Flask pushes both for each request. Outside a request (scripts, Celery tasks, the shell), push an app context manually or you'll get "Working outside of application context".

```python
with app.app_context():
    db.create_all()
with app.test_request_context("/?q=x"):
    assert request.args["q"] == "x"
```

### How do you handle errors globally?

Register `@app.errorhandler(code_or_exception)` (or on a blueprint) to return consistent JSON or HTML. Raise errors with `abort(404)` or custom exceptions.

```python
class NotFound(Exception): pass
@app.errorhandler(NotFound)
def nf(e): return {"error": str(e)}, 404
```

### How do you structure database access in Flask?

Use Flask-SQLAlchemy with an extension object initialised in the factory, models with `Mapped` types, Alembic migrations through Flask-Migrate, and one session per request (scoped automatically). Keep queries in a service or repository layer, not in templates.

```python
def orders_for(customer_id): return db.session.scalars(select(Order).filter_by(customer_id=customer_id)).all()
```

### How do you test a Flask application?

Use the app factory with a test config, pytest fixtures for `app` and `client`, `app.test_client()` for requests, and a disposable database (SQLite in memory or Testcontainers Postgres). Use `app.test_cli_runner()` for CLI commands.

```python
def test_ping(client): assert client.get("/api/v1/ping").json == {"pong": True}
```

## Advanced

### Is Flask thread-safe? How do context locals work?

Yes. Context locals like `request` are proxies to objects stored in `contextvars`, isolated per thread and per async task. Your own global mutable state isn't protected, though. Use the database, a cache or locks for shared data.

```python
counter = 0                       # ❌ shared across threads/workers
# ✅ redis.incr("visits")
```

### How do you run Flask in production?

Use a production WSGI server (Gunicorn or uWSGI) with multiple workers behind nginx or a load balancer, with `ProxyFix` for forwarded headers. Read config from environment variables, serve static files from a CDN, use structured logging, and add health endpoints. Never use the built-in dev server or `debug=True`.

```bash
gunicorn "shop:create_app()" -w $((2 * $(nproc) + 1)) -b 0.0.0.0:8000 --timeout 30
```

### Can Flask handle async? When would you choose FastAPI or Quart?

Flask supports `async def` views, but they run in a WSGI worker, one request per worker thread, so you don't get ASGI-level concurrency (WebSockets, long-lived streaming). For heavy concurrent I/O, choose Quart (an async Flask API) or FastAPI. Keep Flask for classic server-rendered apps and moderate APIs.

```python
@app.get("/x")
async def x(): await asyncio.sleep(0.1); return "ok"   # works, but still occupies a worker
```

### How do you secure a Flask app?

Use a strong `SECRET_KEY` from the environment and secure cookie flags, CSRF protection for forms (Flask-WTF), Jinja auto-escaping, validated input, parameterised ORM queries, password hashing, rate limiting (Flask-Limiter), security headers and CSP (Talisman), upload size limits, and `debug=False`.

```python
limiter = Limiter(get_remote_address, app=app, default_limits=["100/minute"])
@app.post("/login")
@limiter.limit("5/minute")
def login(): ...
```

# Scenario Questions

## Beginner

### You get "RuntimeError: Working outside of application context" in a script. How do you fix it?

The script uses `db` or `current_app` without an app context. Create the app and push a context.

```python
from shop import create_app
app = create_app()
with app.app_context():
    print(Order.query.count())
```

## Intermediate

### An endpoint that generates a PDF makes the whole app slow under load. What do you do?

Each request blocks a worker while the PDF renders, so the worker pool is exhausted. Move the generation to a Celery or RQ job, return `202` with a job URL, and let the client poll or receive a webhook. Also scale workers and cache repeated reports.

```python
@bp.post("/reports")
def create_report():
    job = build_pdf.delay(request.json["month"])
    return {"job_id": job.id, "status_url": url_for("reports.status", job_id=job.id)}, 202
```

### Your Flask API returns HTML error pages to the React frontend. How do you make all errors JSON?

Register an error handler for `HTTPException` and a generic `Exception` that returns JSON, on the app or the API blueprint.

```python
@api_bp.errorhandler(HTTPException)
def json_errors(e): return {"error": e.name, "detail": e.description}, e.code
```

## Advanced

### Behind a load balancer, `url_for(_external=True)` generates `http://` links and `request.remote_addr` is always the LB's IP. Why?

Flask sees the proxy's connection, not the original client. Configure `ProxyFix` to trust the right number of `X-Forwarded-*` headers, and set `PREFERRED_URL_SCHEME`.

```python
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.config["PREFERRED_URL_SCHEME"] = "https"
```

# Tricky Questions

## Beginner

### Why is `app.run(debug=True)` dangerous in production?

The Werkzeug debugger lets anyone who triggers an error execute arbitrary Python in the browser. Debug mode also enables the reloader and verbose errors. Use Gunicorn with debug off.

```python
app.run(debug=os.getenv("FLASK_DEBUG") == "1")   # dev only
```

## Intermediate

### Is data in Flask's default `session` hidden from the user?

No. It's base64-encoded and **signed**, not encrypted. The user can decode and read it but can't modify it without the secret key. Never store passwords or sensitive data in it.

```bash
echo 'eyJ1c2VyX2lkIjo0Mn0' | base64 -d     # {"user_id":42}
```

## Advanced

### Why does a mutable default object at module level leak data between users?

Module-level objects live for the worker's lifetime and are shared by every request (and every thread) in that process. Per-request data belongs in `g`, `session`, the database or a cache, never in globals.

```python
CART = []                      # ❌ every user shares one cart in this worker
@app.post("/cart")
def add(): CART.append(request.json["sku"]); return {"items": CART}
```
