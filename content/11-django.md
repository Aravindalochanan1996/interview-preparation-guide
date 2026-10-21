---
id: django
title: Django
short: Django
category: Backend
order: 11
color: #0c4b33
icon: Dj
summary: MVT architecture, models & ORM, views, templates, forms, admin, auth, Django REST Framework, query optimisation, signals, caching, Celery and deployment.
---

# Beginner

## Django Overview and Project Structure

Django is a **"batteries-included"** Python web framework: ORM, migrations, admin, auth, forms, templates, security protections and more out of the box.

```bash
pip install django
django-admin startproject mysite .
python manage.py startapp blog
python manage.py runserver
```

```text
mysite/
├── manage.py               # CLI entry point
├── mysite/
│   ├── settings.py         # configuration
│   ├── urls.py             # root URLconf
│   ├── wsgi.py / asgi.py   # server entry points
└── blog/                   # an "app" — a reusable module
    ├── models.py  views.py  urls.py  admin.py  apps.py  tests.py
    ├── migrations/
    └── templates/blog/
```

A **project** is the whole site/config; an **app** is a self-contained feature module. Register apps in `INSTALLED_APPS`.

### MVT architecture
| Django | Classic MVC equivalent | Role |
|---|---|---|
| **Model** | Model | data & business rules |
| **View** | Controller | handles request, returns response |
| **Template** | View | presentation |

Django itself (URL dispatcher) acts as the "controller" routing requests to views.

## Request/Response Flow

1. Request hits the WSGI/ASGI server (Gunicorn/Uvicorn).
2. Passes through **middleware** (top to bottom).
3. **URL resolver** matches `urls.py` patterns → view.
4. **View** uses models/forms, renders template or returns JSON.
5. Response goes back through middleware (bottom to top).

```python blog/urls.py
from django.urls import path
from . import views

app_name = "blog"
urlpatterns = [
    path("", views.post_list, name="list"),
    path("posts/<int:pk>/", views.post_detail, name="detail"),
    path("posts/<slug:slug>/", views.PostDetailView.as_view(), name="detail-slug"),
]
# mysite/urls.py: path("blog/", include("blog.urls"))
```

Reverse URLs by name: `reverse("blog:detail", args=[5])`, `{% url 'blog:detail' post.pk %}`.

## Models and Migrations

```python blog/models.py
from django.db import models
from django.conf import settings

class Category(models.Model):
    name = models.CharField(max_length=50, unique=True)
    def __str__(self): return self.name

class Post(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"; PUBLISHED = "published"

    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    body = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    tags = models.ManyToManyField("Tag", blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self): return self.title
```

```bash
python manage.py makemigrations   # generate migration files from model changes
python manage.py migrate          # apply to the database
python manage.py sqlmigrate blog 0001
python manage.py showmigrations
```

### Relationships
- `ForeignKey` — many-to-one. `on_delete`: `CASCADE`, `PROTECT`, `SET_NULL`, `SET_DEFAULT`, `RESTRICT`, `DO_NOTHING`.
- `ManyToManyField` — creates a join table (`through=` for extra fields).
- `OneToOneField` — e.g., a Profile extending User.
- `null=True` is about the **database**; `blank=True` is about **validation** (forms).

## The ORM: QuerySets

```python
Post.objects.all()
Post.objects.filter(status="published", created_at__year=2026).exclude(title__icontains="draft")
Post.objects.get(pk=1)                      # raises DoesNotExist / MultipleObjectsReturned
Post.objects.filter(author__username="asha")  # follow relations with __
Post.objects.order_by("-created_at")[:10]   # LIMIT 10
Post.objects.create(title="Hi", slug="hi", body="…", author=user)
Post.objects.filter(pk=1).update(status="published")
post.delete()
```

### QuerySets are lazy
Building a queryset doesn't hit the database. Evaluation happens on iteration, slicing with step, `len()`, `list()`, `bool()`, `repr()`. Results are cached on the queryset object.

### Field lookups
`exact, iexact, contains, icontains, in, gt, gte, lt, lte, startswith, range, isnull, year, date`.

### Q and F objects
```python
from django.db.models import Q, F
Post.objects.filter(Q(title__icontains="django") | Q(body__icontains="django"))
Product.objects.update(stock=F("stock") - 1)        # atomic, done in SQL — avoids race conditions
```

## Views and Templates

### Function-based view
```python
from django.shortcuts import render, get_object_or_404, redirect
def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk, status="published")
    return render(request, "blog/detail.html", {"post": post})
```

### Class-based views (CBVs)
```python
from django.views.generic import ListView, DetailView, CreateView
class PostListView(ListView):
    model = Post
    paginate_by = 10
    queryset = Post.objects.filter(status="published").select_related("author")

class PostCreateView(LoginRequiredMixin, CreateView):
    model = Post
    fields = ["title", "slug", "body"]
    success_url = reverse_lazy("blog:list")
    def form_valid(self, form):
        form.instance.author = self.request.user
        return super().form_valid(form)
```
FBVs are explicit and simple; CBVs/generic views reduce boilerplate and are extended via mixins.

### Templates
```html templates/blog/detail.html
{% extends "base.html" %}
{% block content %}
  <h1>{{ post.title }}</h1>
  <p>By {{ post.author.get_full_name|default:"Anonymous" }} on {{ post.created_at|date:"M d, Y" }}</p>
  {{ post.body|linebreaks }}
  {% for tag in post.tags.all %}<span>{{ tag }}</span>{% empty %}No tags{% endfor %}
  {% if user.is_authenticated %}<a href="{% url 'blog:edit' post.pk %}">Edit</a>{% endif %}
{% endblock %}
```
Variables are **auto-escaped** (XSS protection); `|safe` disables it.

## Forms and the Admin

```python
from django import forms
class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ["title", "body", "category"]
    def clean_title(self):
        title = self.cleaned_data["title"]
        if "spam" in title.lower(): raise forms.ValidationError("No spam")
        return title

def create_post(request):
    form = PostForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        post = form.save(commit=False); post.author = request.user; post.save()
        return redirect("blog:detail", pk=post.pk)
    return render(request, "blog/form.html", {"form": form})
```
Include `{% csrf_token %}` in POST forms.

### Admin
```python
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "status", "created_at"]
    list_filter = ["status", "category"]
    search_fields = ["title", "body"]
    prepopulated_fields = {"slug": ("title",)}
    raw_id_fields = ["author"]
```
`python manage.py createsuperuser`, then visit `/admin/`.

# Intermediate

## Authentication and Permissions

- `django.contrib.auth`: `User`, groups, permissions, sessions, password hashing (PBKDF2 default, Argon2 supported).
- Login/logout views, `@login_required`, `LoginRequiredMixin`, `@permission_required`, `user.has_perm("blog.change_post")`.
- **Custom user model** — always define one at project start:
```python
class User(AbstractUser):
    email = models.EmailField(unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]
# settings.py
AUTH_USER_MODEL = "accounts.User"
```
`AbstractUser` extends the default; `AbstractBaseUser` lets you build from scratch.

## Django REST Framework (DRF)

```python
from rest_framework import serializers, viewsets, permissions

class PostSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    class Meta:
        model = Post
        fields = ["id", "title", "slug", "body", "author", "created_at"]
    def validate_title(self, value):
        if len(value) < 5: raise serializers.ValidationError("Too short")
        return value

class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ["status", "category"]
    search_fields = ["title"]
    def get_queryset(self):
        return Post.objects.select_related("author").prefetch_related("tags")
    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

router = DefaultRouter()
router.register("posts", PostViewSet, basename="post")
urlpatterns = [path("api/", include(router.urls))]
```

### Key DRF concepts
- **Serializers** — validation + conversion between model instances and JSON (like Django forms for APIs).
- **Views**: `APIView` → generic views (`ListCreateAPIView`) → **ViewSets** + routers.
- **Authentication**: Session, Token, JWT (`djangorestframework-simplejwt`), OAuth.
- **Permissions**: `IsAuthenticated`, `IsAdminUser`, custom `has_object_permission`.
- **Throttling**, **pagination** (PageNumber, LimitOffset, Cursor), **filtering** (django-filter), **versioning**.
- API docs: drf-spectacular (OpenAPI).

Alternative: **Django Ninja** — FastAPI-style type-hinted APIs on Django.

## Query Optimisation: N+1, select_related, prefetch_related

```python
# N+1: 1 query for posts + 1 per post for author
for post in Post.objects.all():
    print(post.author.username)

# FIX — ForeignKey / OneToOne: SQL JOIN
Post.objects.select_related("author", "category")

# FIX — ManyToMany / reverse FK: separate query + Python join
Post.objects.prefetch_related("tags", "comments")
Post.objects.prefetch_related(Prefetch("comments", queryset=Comment.objects.filter(approved=True)))
```

### More tools
```python
Post.objects.only("id", "title")            # defer other columns
Post.objects.values("id", "title")          # dicts, no model instances
Post.objects.values_list("id", flat=True)
Post.objects.filter(...).exists()           # cheaper than len()/count() for checks
Post.objects.count()
Post.objects.bulk_create(objs, batch_size=500)
Post.objects.iterator(chunk_size=2000)      # stream large results
```

### Aggregation and annotation
```python
from django.db.models import Count, Avg, Sum
Author.objects.annotate(num_posts=Count("posts")).filter(num_posts__gt=5)
Order.objects.aggregate(total=Sum("amount"), avg=Avg("amount"))
```

Debug queries with **django-debug-toolbar**, `connection.queries`, `queryset.explain()`, `str(queryset.query)`.

## Middleware, Signals and Managers

### Middleware
```python
class TimingMiddleware:
    def __init__(self, get_response): self.get_response = get_response
    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        response["X-Elapsed"] = f"{time.monotonic() - start:.3f}"
        return response
```
Built-in: `SecurityMiddleware`, `SessionMiddleware`, `CsrfViewMiddleware`, `AuthenticationMiddleware`, `CommonMiddleware`. **Order matters.**

### Signals
Decoupled notifications: `pre_save`, `post_save`, `pre_delete`, `post_delete`, `m2m_changed`, `request_finished`, `user_logged_in`.
```python
@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created: Profile.objects.create(user=instance)
```
> [!WARN]
> Signals hide control flow and don't fire on `queryset.update()` or `bulk_create`. Prefer explicit service functions for business logic.

### Custom managers and querysets
```python
class PostQuerySet(models.QuerySet):
    def published(self): return self.filter(status="published")
    def by(self, user): return self.filter(author=user)

class Post(models.Model):
    objects = PostQuerySet.as_manager()
# Post.objects.published().by(user)
```

## Transactions and Concurrency

```python
from django.db import transaction

@transaction.atomic
def transfer(src_id, dst_id, amount):
    src = Account.objects.select_for_update().get(pk=src_id)   # row lock
    dst = Account.objects.select_for_update().get(pk=dst_id)
    if src.balance < amount: raise InsufficientFunds
    src.balance = F("balance") - amount; src.save(update_fields=["balance"])
    dst.balance = F("balance") + amount; dst.save(update_fields=["balance"])
    transaction.on_commit(lambda: send_receipt.delay(src_id))   # run after commit
```
- Default is **autocommit** per query; `ATOMIC_REQUESTS = True` wraps each request.
- `select_for_update()` for pessimistic locking; version fields for optimistic locking.
- `F()` expressions avoid read-modify-write races.
- `on_commit` ensures tasks don't run for rolled-back data.

# Advanced

## Caching and Performance

```python
CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": "redis://localhost:6379"}}

from django.views.decorators.cache import cache_page
@cache_page(60 * 15)
def landing(request): ...

from django.core.cache import cache
stats = cache.get_or_set(f"stats:{user.id}", lambda: compute_stats(user), timeout=300)
```
Levels: per-site middleware, per-view (`cache_page`), template fragment (`{% cache 500 sidebar %}`), low-level API.

### Other optimisations
- Database indexes (`Meta.indexes`, `db_index`), analyse with `EXPLAIN`.
- `select_related`/`prefetch_related`, `only`/`defer`, pagination.
- Persistent DB connections (`CONN_MAX_AGE`) or connection pooling (built-in for PostgreSQL since 5.1, or PgBouncer).
- Offload slow work to **Celery**.
- Serve static files via CDN/WhiteNoise; `ManifestStaticFilesStorage` for hashed filenames.
- Read replicas with **database routers**.

## Celery and Background Tasks

```python tasks.py
from celery import shared_task

@shared_task(bind=True, autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=5)
def send_welcome_email(self, user_id):
    user = User.objects.get(pk=user_id)
    send_mail("Welcome!", "…", None, [user.email])

# call
send_welcome_email.delay(user.id)               # pass IDs, not model instances
```
- Broker: Redis or RabbitMQ; result backend optional.
- **Celery Beat** for periodic tasks (cron-like).
- Make tasks **idempotent**, set time limits, use `acks_late` for reliability.
- Django 6.0 adds a built-in Tasks framework for defining background tasks (backends pluggable).

## Async Django and Channels

- Django supports **async views** (ASGI), async ORM methods (`await Post.objects.aget(pk=1)`, `async for p in qs`), async middleware.
- Some ORM paths are still sync internally (run in a thread); use `sync_to_async` / `async_to_sync` at boundaries.
- **Django Channels** adds WebSockets, background workers and protocols via consumers and a channel layer (Redis).
```python
class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("room", self.channel_name); await self.accept()
    async def receive(self, text_data):
        await self.channel_layer.group_send("room", {"type": "chat.message", "text": text_data})
    async def chat_message(self, event):
        await self.send(text_data=event["text"])
```

## Security and Deployment

### Built-in protections
- **CSRF** middleware + `{% csrf_token %}`.
- **XSS**: template auto-escaping.
- **SQL injection**: ORM parameterisation (careful with `raw()`/`extra()` — always pass params).
- **Clickjacking**: `XFrameOptionsMiddleware`.
- Password hashing, `SECURE_*` settings (HSTS, SSL redirect, secure cookies).

### Production checklist
```python
DEBUG = False
ALLOWED_HOSTS = ["example.com"]
SECRET_KEY = env("SECRET_KEY")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
```
Run `python manage.py check --deploy`.

### Deployment architecture
Nginx/load balancer → **Gunicorn** (WSGI) or **Uvicorn/Daphne** (ASGI) workers → Django → PostgreSQL + Redis. `collectstatic` to a CDN/object storage, migrations as a release step, Celery workers + beat as separate processes/containers, environment-based settings (django-environ), Sentry for errors.

## Architecture: Fat Models, Services and Testing

- **Fat models, thin views** is the classic advice; for larger projects add a **service layer** (`services.py`) for business operations and **selectors** for complex reads — keeps views and models focused and testable.
- Split settings per environment (`settings/base.py`, `dev.py`, `prod.py`).
- Multi-tenancy: shared schema with tenant FK, schema-per-tenant (django-tenants), or DB-per-tenant.
- Model inheritance: **abstract base classes** (shared fields, no table), **multi-table** (joins, a table per class), **proxy models** (different behaviour, same table).

### Testing
```python
from django.test import TestCase
class PostTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("asha", password="x")
    def test_list_shows_published(self):
        Post.objects.create(title="A", slug="a", body="…", author=self.user, status="published")
        res = self.client.get(reverse("blog:list"))
        self.assertContains(res, "A")
        self.assertNumQueries  # use as context manager to guard against N+1
```
`pytest-django`, factory_boy for fixtures, DRF's `APIClient`, `assertNumQueries` to prevent query regressions.

# Interview Questions

## Beginner

### What is Django's MVT architecture?
Model (data layer and ORM), View (business logic that receives a request and returns a response), Template (presentation). The URL dispatcher routes requests to views. It maps to MVC with Django's View acting as the controller and Template as the view.

### What is the difference between a project and an app?
A project is the entire configuration and collection of apps for a site (settings, root URLs, WSGI/ASGI). An app is a self-contained module providing a specific feature (blog, accounts) that can be reused across projects.

### What are migrations?
Version-controlled files describing changes to models, generated with `makemigrations` and applied with `migrate`. They keep the database schema in sync with models across environments and support data migrations with `RunPython`.

### `null=True` vs `blank=True`?
`null=True` allows NULL in the database column. `blank=True` allows the field to be empty in form/model validation. For string fields, Django convention is `blank=True` without `null=True` (store empty strings).

### What is the Django admin?
An automatically generated, customizable CRUD interface for registered models, with authentication, permissions, filtering, search and inline editing. Great for internal tools; not meant as the public-facing UI.

### How does Django protect against CSRF?
`CsrfViewMiddleware` requires a secret token on unsafe requests (POST, PUT, DELETE). Templates include it with `{% csrf_token %}`; AJAX sends it via the `X-CSRFToken` header. The token is checked against the CSRF cookie and the `Origin`/`Referer` header for HTTPS.

### FBV vs CBV?
Function-based views are simple, explicit Python functions — easy to read for custom logic. Class-based views encapsulate common patterns (list, detail, create) and are extended via inheritance and mixins, reducing repetition but adding indirection.

## Intermediate

### `select_related` vs `prefetch_related`?
`select_related` follows ForeignKey/OneToOne relationships via SQL JOINs in a single query. `prefetch_related` handles ManyToMany and reverse ForeignKey relations by running a separate query per relation and joining in Python. Both solve the N+1 problem.

### Are QuerySets lazy? What triggers evaluation?
Yes. Creating and chaining querysets doesn't touch the database. They're evaluated when iterated, sliced with a step, pickled, or when `len()`, `list()`, `bool()`, `repr()` are called. Results are then cached on that queryset instance.

### What are F and Q objects?
`F()` references a field's value in the database, enabling atomic updates (`stock=F('stock')-1`) and field comparisons without loading data into Python. `Q()` encapsulates conditions that can be combined with `|`, `&` and `~` for complex queries.

### What is middleware in Django?
A layer of hooks processing every request/response globally — e.g., sessions, authentication, CSRF, security headers, logging. Defined as callables in the `MIDDLEWARE` list; requests pass top-to-bottom, responses bottom-to-top.

### What are signals and their drawbacks?
A dispatcher that lets decoupled components react to events (e.g., `post_save`). Drawbacks: implicit control flow that's hard to trace and test, they don't fire for bulk operations or `update()`, and they run synchronously in the same transaction. Prefer explicit service calls for core logic.

### Why define a custom user model at the start?
Changing `AUTH_USER_MODEL` mid-project is painful because of foreign keys and migrations. Starting with a custom model (even identical to `AbstractUser`) lets you add fields or use email login later easily.

### What is a serializer in DRF?
A class that converts complex data (model instances, querysets) to native Python types for JSON rendering and validates/deserializes incoming data back into objects. `ModelSerializer` generates fields and `create`/`update` from a model.

### How do you implement authentication in DRF?
Configure `DEFAULT_AUTHENTICATION_CLASSES` — SessionAuthentication for browser clients, TokenAuthentication, or JWT via SimpleJWT for SPAs/mobile — and `DEFAULT_PERMISSION_CLASSES` like `IsAuthenticated`. Use custom permissions for object-level access.

## Advanced

### How do you optimise a slow Django endpoint?
Profile with debug-toolbar/silk to count queries and find slow SQL. Fix N+1 with `select_related`/`prefetch_related`, add indexes, use `only`/`values`, paginate, cache results (Redis, `cache_page`), move heavy work to Celery, denormalise or use materialized views for expensive aggregates, and use read replicas.

### How do you handle race conditions in Django?
Use atomic DB-level updates with `F()` expressions, `select_for_update()` inside `transaction.atomic()` for pessimistic locking, unique constraints with `get_or_create`/`update_or_create` handling `IntegrityError`, optimistic locking via version fields, and distributed locks (Redis) for cross-service coordination.

### How does Django handle transactions?
By default each query autocommits. `transaction.atomic` (decorator or context manager) wraps code in a transaction, with nested blocks creating savepoints. `ATOMIC_REQUESTS` wraps each request. `transaction.on_commit` registers callbacks executed only after a successful commit.

### How do you scale a Django application?
Stateless app servers behind a load balancer, sessions/cache in Redis, PostgreSQL with connection pooling and read replicas (DB routers), Celery for async work, CDN for static/media, caching at multiple layers, query optimisation, and horizontal scaling in containers/Kubernetes. Shard or split services only when needed.

### What are the model inheritance types?
Abstract base classes (no table, fields copied to children), multi-table inheritance (each class has its own table linked by one-to-one, causing joins), and proxy models (same table, different Python behaviour like managers or ordering).

### How does Django support async and when should you use it?
Django runs under ASGI with async views, middleware and async ORM APIs. Use async for high-concurrency I/O (calling external APIs, websockets with Channels, streaming). For typical CRUD with a sync DB driver, sync views with enough workers remain simpler; mixing requires `sync_to_async` boundaries.

### Explain how you would structure a large Django codebase.
Domain-focused apps, a custom user model, service and selector layers for business logic and queries, thin views/serializers, split settings, typed code with django-stubs, factories and pytest for tests, Celery tasks per domain, API versioning, and enforced boundaries between apps to avoid circular imports.
