---
id: dotnet
title: C# & .NET
short: C# / .NET
category: Backend
order: 13.6
color: #512bd4
icon: C#
summary: C# language, types, LINQ, async/await, memory and GC, ASP.NET Core (middleware, DI, minimal APIs, MVC), Entity Framework Core, security, testing and performance.
---

# Beginner

## .NET Platform and C# Basics

**.NET** is Microsoft's open-source, cross-platform runtime and SDK (Windows, Linux, macOS). Modern .NET (5+, LTS versions 8 and 10) replaced the Windows-only .NET Framework.

- **CLR** (Common Language Runtime) — executes code, JIT compilation, garbage collection, type safety.
- **IL** (Intermediate Language) — C#/F#/VB compile to IL, JIT-compiled to native code (or AOT with Native AOT).
- **BCL** — base class libraries. **NuGet** — package manager. **SDK/CLI** — `dotnet` command.

```bash
dotnet new webapi -n Shop.Api
dotnet run --project Shop.Api
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet test
dotnet publish -c Release -o out
```

```csharp
var name = "Asha";                       // type inference
int age = 30;
string? nickname = null;                 // nullable reference type (C# 8+, enabled by default)
Console.WriteLine($"{name} is {age}");   // string interpolation

var level = age switch                   // switch expression with patterns
{
    < 18 => "minor",
    >= 18 and < 60 => "adult",
    _ => "senior"
};
```

### Value types vs reference types
| Value types (`struct`) | Reference types (`class`) |
|---|---|
| `int`, `double`, `bool`, `DateTime`, `decimal`, enums, structs, tuples | `string`, arrays, classes, delegates, records (class) |
| stored inline (stack or inside objects), copied on assignment | stored on the managed heap; variables hold references |
| can't be null (except `Nullable<T>`/`int?`) | can be null |

**Boxing** converts a value type to `object` (heap allocation) — avoid in hot paths.

## OOP and Modern C# Types

```csharp
public interface IPaymentGateway { Task<bool> ChargeAsync(decimal amount, CancellationToken ct = default); }

public abstract class Account
{
    public string Id { get; }
    public decimal Balance { get; protected set; }      // property with restricted setter
    protected Account(string id) => Id = id;
    public abstract decimal MonthlyFee();
    public virtual void Deposit(decimal amount)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(amount);
        Balance += amount;
    }
}

public sealed class SavingsAccount(string id) : Account(id)    // primary constructor (C# 12)
{
    public override decimal MonthlyFee() => 0m;
}

public record Product(int Id, string Name, decimal Price);     // immutable, value equality, `with` expressions
var discounted = product with { Price = product.Price * 0.9m };
```

### Key concepts
- Access modifiers: `public`, `private`, `protected`, `internal` (assembly), `protected internal`, `private protected`.
- `virtual`/`override`/`new` (hiding), `abstract`, `sealed`, `static` classes, extension methods.
- Interfaces can have default implementations; a class implements many interfaces, inherits one class.
- **Properties** (get/set/init), indexers, events and **delegates** (`Func<T>`, `Action<T>`, `Predicate<T>`).
- **Generics** are reified (type info at runtime, no erasure) with constraints (`where T : class, new()`).

## Collections and LINQ

| Type | Use |
|---|---|
| `List<T>` | dynamic array |
| `Dictionary<TKey,TValue>` | hash map |
| `HashSet<T>` | unique items |
| `Queue<T>`, `Stack<T>`, `PriorityQueue<T,P>` | FIFO, LIFO, heap |
| `ConcurrentDictionary`, `Channel<T>` | thread-safe / producer–consumer |
| `IEnumerable<T>` | iterate (deferred) |
| `IQueryable<T>` | query translated by a provider (EF Core → SQL) |
| `ImmutableList`, `FrozenDictionary` | immutable / read-optimised |

```csharp
var revenueByCity = orders
    .Where(o => o.Status == Status.Paid)
    .GroupBy(o => o.City)
    .Select(g => new { City = g.Key, Revenue = g.Sum(o => o.Amount) })
    .OrderByDescending(x => x.Revenue)
    .ToList();

var topCustomer = orders.MaxBy(o => o.Amount)?.Customer;
bool anyLarge = orders.Any(o => o.Amount > 10_000);
```

**Deferred execution**: LINQ queries run when enumerated (`foreach`, `ToList`, `Count`). Enumerating twice runs twice. `IEnumerable` LINQ runs in memory; `IQueryable` builds an expression tree translated to SQL — calling `.ToList()` too early pulls whole tables into memory.

## Exceptions and Resource Management

```csharp
try
{
    await using var conn = new SqlConnection(cs);      // async disposal
    await conn.OpenAsync(ct);
}
catch (SqlException ex) when (ex.Number == 1205)      // exception filter: deadlock
{
    logger.LogWarning(ex, "Deadlock, retrying");
    throw;                                             // rethrow preserving stack trace (not `throw ex;`)
}
finally { /* cleanup */ }
```
- `IDisposable`/`using` for deterministic cleanup of unmanaged resources (connections, files, streams).
- Custom exceptions for domain errors; don't use exceptions for normal control flow.
- Prefer `TryParse`/`TryGetValue` patterns for expected failures.

# Intermediate

## async/await and the Task Model

```csharp
public async Task<OrderDto> GetOrderAsync(int id, CancellationToken ct)
{
    var orderTask = _db.Orders.FindAsync([id], ct).AsTask();
    var shippingTask = _shippingClient.GetStatusAsync(id, ct);
    await Task.WhenAll(orderTask, shippingTask);            // run concurrently
    return new OrderDto(orderTask.Result!, shippingTask.Result);
}
```

- `async`/`await` frees the thread while awaiting I/O — scalability for web servers.
- Return `Task`/`Task<T>` (or `ValueTask` for hot paths often completing synchronously); avoid **`async void`** except event handlers.
- **Don't block on async** (`.Result`, `.Wait()`) — risks deadlocks (in UI/legacy ASP.NET synchronization contexts) and thread-pool starvation. "Async all the way."
- `ConfigureAwait(false)` in library code to avoid capturing the context (ASP.NET Core has no sync context).
- Always pass and honour **`CancellationToken`**.
- `Task.Run` for CPU-bound work offloading — not for wrapping I/O.
- `IAsyncEnumerable<T>` + `await foreach` for async streams; `Parallel.ForEachAsync` for bounded concurrency; `Channel<T>` for producer–consumer pipelines.

## ASP.NET Core Fundamentals

```csharp Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ShopDb>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Shop")));
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

var orders = app.MapGroup("/api/orders").RequireAuthorization();
orders.MapGet("/{id:int}", async (int id, IOrderService svc, CancellationToken ct) =>
    await svc.GetAsync(id, ct) is { } order ? Results.Ok(order) : Results.NotFound());
orders.MapPost("/", async (CreateOrder cmd, IOrderService svc, CancellationToken ct) =>
{
    var created = await svc.CreateAsync(cmd, ct);
    return Results.Created($"/api/orders/{created.Id}", created);
});

app.MapOpenApi();
app.Run();
```

### Middleware pipeline
Each middleware can handle the request, call `next()`, and act on the response. **Order matters**: exception handling → HTTPS → static files → routing → CORS → authentication → authorization → endpoints.
```csharp
app.Use(async (context, next) =>
{
    var sw = Stopwatch.StartNew();
    await next(context);
    context.Response.Headers["X-Elapsed-Ms"] = sw.ElapsedMilliseconds.ToString();
});
```

### Dependency injection lifetimes
| Lifetime | Instance per | Use for |
|---|---|---|
| **Transient** | every resolution | lightweight stateless services |
| **Scoped** | HTTP request | DbContext, unit-of-work, request-specific services |
| **Singleton** | application | caches, configuration, `HttpClient` factory clients, thread-safe services |

**Captive dependency** bug: injecting a scoped service into a singleton keeps it alive forever — the DI container validates this in development.

### Controllers vs minimal APIs
**Controllers** (`[ApiController]`, attribute routing, filters, model binding/validation) suit large, structured APIs; **minimal APIs** are concise and fast, with endpoint filters and route groups. Both support OpenAPI.

### Configuration and options
`appsettings.json` → `appsettings.{Environment}.json` → user secrets (dev) → environment variables → command line. Bind to strongly typed classes with the **Options pattern** (`IOptions<T>`, `IOptionsSnapshot<T>`, `IOptionsMonitor<T>`).

### HttpClient done right
Use `IHttpClientFactory` (typed clients) to avoid socket exhaustion and DNS staleness; add resilience with `Microsoft.Extensions.Http.Resilience` (Polly: retry, circuit breaker, timeout).

## Entity Framework Core

```csharp
public class ShopDb(DbContextOptions<ShopDb> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Customer> Customers => Set<Customer>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasOne(o => o.Customer).WithMany(c => c.Orders).HasForeignKey(o => o.CustomerId);
        b.Entity<Order>().Property(o => o.Total).HasPrecision(18, 2);
        b.Entity<Order>().HasIndex(o => new { o.CustomerId, o.CreatedAt });
    }
}

// Queries
var recent = await db.Orders
    .AsNoTracking()                                   // read-only: faster
    .Where(o => o.CreatedAt > since)
    .Include(o => o.Items)                            // eager load — avoids N+1
    .OrderByDescending(o => o.CreatedAt)
    .Select(o => new OrderSummary(o.Id, o.Total, o.Items.Count))   // projection: fetch only needed columns
    .ToListAsync(ct);

// Bulk operations without loading entities (EF Core 7+)
await db.Orders.Where(o => o.Status == Status.Expired).ExecuteDeleteAsync(ct);
```

- **Change tracking**: tracked entities are compared on `SaveChanges` → generated UPDATEs. `AsNoTracking` for read-only queries.
- **Migrations**: `dotnet ef migrations add AddOrders`, `dotnet ef database update` (or generate SQL scripts / bundles for production).
- Loading strategies: eager (`Include`), explicit, lazy (proxies — avoid in web apps), split queries for big includes (`AsSplitQuery`).
- Concurrency tokens (`[Timestamp]`/rowversion) for optimistic concurrency.
- **Dapper** for high-performance raw SQL micro-ORM use cases.

# Advanced

## Memory Management, GC and Performance

```csharp
// Avoid allocations on hot paths
ReadOnlySpan<char> line = "2026-10-23,ORD-42,19.99";
int comma = line.IndexOf(',');
var date = DateOnly.Parse(line[..comma]);              // slice without allocating substrings

var pool = ArrayPool<byte>.Shared;
byte[] buf = pool.Rent(64 * 1024);
try { /* read into buf */ } finally { pool.Return(buf); }
```
```bash
dotnet-counters monitor -p <pid> System.Runtime   # GC heap size, gen0/1/2 counts, thread pool queue
dotnet-trace collect -p <pid> --profile cpu-sampling
dotnet-gcdump collect -p <pid>
```

### Garbage collector
Generational: **Gen 0** (short-lived), **Gen 1** (buffer), **Gen 2** (long-lived); **Large Object Heap** (≥85 KB objects, collected with Gen 2) and Pinned Object Heap. Workstation vs **Server GC** (default for ASP.NET Core), concurrent/background GC; **DATAS** dynamically adapts heap count in containers.

### Reducing allocations
- `Span<T>`/`ReadOnlySpan<T>`/`Memory<T>` — slice arrays/strings without copying.
- `ArrayPool<T>`/`ObjectPool<T>` — reuse buffers.
- `StringBuilder`, `string.Create`, avoid LINQ in ultra-hot paths, `struct` for small immutable values, avoid boxing.
- `ValueTask` when results are often synchronous.

### Diagnostics
`dotnet-counters` (live metrics: GC, CPU, exceptions, thread pool), `dotnet-trace` (performance traces), `dotnet-dump` (memory dumps, analyse with `dumpheap`/`gcroot`), Visual Studio/JetBrains profilers, **BenchmarkDotNet** for micro-benchmarks, OpenTelemetry for distributed tracing and metrics.

### Common issues
Thread-pool starvation from sync-over-async, memory leaks from static events/caches/undisposed timers, LOH fragmentation, N+1 EF queries, excessive logging allocations (use `LoggerMessage` source generators).

### Native AOT
Compile ahead-of-time to a self-contained native executable: fast startup, small memory — great for serverless and containers; requires trimming-compatible code (limited reflection).

## Security in ASP.NET Core

- **Authentication**: cookies, **JWT bearer** (`AddJwtBearer` with Entra ID/Keycloak/Auth0), OpenID Connect, ASP.NET Core Identity (user store, password hashing, 2FA).
- **Authorization**: roles, **policies** and requirements, resource-based authorization (`IAuthorizationService`), `[Authorize(Policy = "CanEditOrders")]` / `.RequireAuthorization("policy")`.
- Built-in protections: Data Protection API, antiforgery tokens (forms), output encoding in Razor, HTTPS redirection and HSTS, CORS policies, rate limiting middleware (`AddRateLimiter` with fixed/sliding window, token bucket, concurrency).
- Secrets: user secrets in development; Azure Key Vault / environment variables in production; managed identities.
- Validate input (DataAnnotations, FluentValidation), parameterised queries (EF Core does this; beware `FromSqlRaw` with concatenation — use `FromSql` interpolation).

```csharp Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => { o.Authority = "https://login.microsoftonline.com/<tenant>/v2.0"; o.Audience = "api://orders"; });
builder.Services.AddAuthorization(o => o.AddPolicy("CanRefund", p => p.RequireRole("Support").RequireClaim("scope", "orders.refund")));
builder.Services.AddRateLimiter(o => o.AddFixedWindowLimiter("api", l => { l.PermitLimit = 100; l.Window = TimeSpan.FromMinutes(1); }));

app.UseHsts(); app.UseHttpsRedirection();
app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
app.MapPost("/orders/{id}/refund", Refund).RequireAuthorization("CanRefund").RequireRateLimiting("api");
```

## Architecture, Testing and Hosting

### Common architectures
- **Clean / Onion architecture** — Domain → Application (use cases) → Infrastructure → API; dependencies point inward.
- **Vertical slice architecture** — organise by feature; often with **MediatR**-style request handlers (CQRS).
- **Background work**: `BackgroundService`/`IHostedService`, Hangfire/Quartz for scheduling, message brokers via MassTransit/NServiceBus (RabbitMQ, Azure Service Bus).
- Real-time: **SignalR** (WebSockets with fallbacks).
- Cloud-native: **.NET Aspire** for orchestrating and observing distributed apps locally and deploying to Azure/Kubernetes; gRPC services; health checks (`AddHealthChecks`).

### Testing
```csharp
public class OrdersApiTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task GetOrder_ReturnsNotFound_ForUnknownId()
    {
        var client = factory.WithWebHostBuilder(b => b.ConfigureServices(s =>
            s.AddScoped<IOrderService, FakeOrderService>())).CreateClient();

        var res = await client.GetAsync("/api/orders/999");

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }
}
```
xUnit/NUnit/MSTest, Moq/NSubstitute, FluentAssertions/Shouldly, `WebApplicationFactory` for integration tests, Testcontainers for real databases, Playwright for .NET for UI.

### Hosting
Kestrel web server, behind a reverse proxy (IIS, Nginx, YARP, Azure Front Door), containers (`dotnet publish /t:PublishContainer`), Azure App Service, AKS, Azure Container Apps, AWS Lambda/ECS.

# Interview Questions

## Beginner

### What is the difference between .NET Framework and modern .NET?
.NET Framework is the older Windows-only runtime (4.8 is the final version). Modern .NET (5 and later, LTS releases like 8 and 10) is open-source, cross-platform, faster, container-friendly, and where all new development happens.

```xml Modern SDK-style project
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>      <!-- .NET Framework: net48, Windows only -->
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
```
```bash
dotnet new webapi -n Orders && dotnet run          # runs on Linux, macOS, Windows, containers
dotnet publish -c Release -r linux-x64 --self-contained
```

### Value types vs reference types?
Value types (structs, primitives, enums) hold their data directly and are copied on assignment. Reference types (classes, strings, arrays) store a reference to an object on the managed heap; assignments copy the reference. Value types can't be null unless declared nullable.

```csharp
struct PointS { public int X; }
class  PointC { public int X; }

var a = new PointS { X = 1 }; var b = a; b.X = 2;   // a.X == 1 (copied)
var c = new PointC { X = 1 }; var d = c; d.X = 2;   // c.X == 2 (same object)
int? maybe = null;                                  // Nullable<int> value type
object boxed = 42;                                  // boxing allocates on the heap
```

### What are records?
Reference (or `record struct` value) types designed for immutable data with value-based equality, concise positional syntax, built-in `ToString`, deconstruction and non-destructive mutation using `with` expressions.

```csharp
public record Money(decimal Amount, string Currency);
var a = new Money(10, "EUR");
var b = new Money(10, "EUR");
a == b;                                  // true — value equality
var c = a with { Amount = 20 };          // non-destructive copy
var (amount, cur) = c;                   // deconstruction
Console.WriteLine(c);                    // Money { Amount = 20, Currency = EUR }
public readonly record struct Point(int X, int Y);   // value-type record
```

### What is LINQ?
Language Integrated Query — a set of query operators (`Where`, `Select`, `GroupBy`, `OrderBy`, `Join`) and syntax for querying collections, databases (via IQueryable providers like EF Core), XML and more in a consistent, type-safe way, with deferred execution.

```csharp
var topCustomers = orders
    .Where(o => o.Status == Status.Paid)
    .GroupBy(o => o.CustomerId)
    .Select(g => new { CustomerId = g.Key, Total = g.Sum(o => o.Total) })
    .OrderByDescending(x => x.Total)
    .Take(5)
    .ToList();

var q = from o in orders join c in customers on o.CustomerId equals c.Id
        where o.Total > 100 select new { c.Name, o.Total };   // query syntax
```

### `IEnumerable` vs `IQueryable`?
`IEnumerable` executes queries in memory with delegates over objects already loaded. `IQueryable` builds expression trees that a provider (like EF Core) translates into another language such as SQL, executed at the data source — so filtering happens in the database.

```csharp
IQueryable<User> q = db.Users.Where(u => u.Age > 30);      // expression tree → SQL WHERE
Console.WriteLine(q.ToQueryString());                        // SELECT … WHERE Age > 30

IEnumerable<User> e = db.Users.AsEnumerable().Where(u => u.Age > 30); // loads ALL users, filters in memory
```

### What does `using` do?
The `using` statement or declaration ensures `Dispose()` is called on an `IDisposable` object when it goes out of scope, even if an exception occurs — releasing resources like database connections and file handles. `await using` does the same for `IAsyncDisposable`.

```csharp
using (var conn = new SqlConnection(cs))       // statement form
{
    conn.Open();
}                                               // conn.Dispose() even if an exception occurs

using var stream = File.OpenRead("data.csv");   // declaration form: disposed at end of scope
await using var tx = await db.Database.BeginTransactionAsync();   // IAsyncDisposable
```

## Intermediate

### Explain async/await in C#.
`async` methods return tasks and use `await` to asynchronously wait for operations without blocking the thread; the compiler builds a state machine that resumes after completion. In web apps this frees threads during I/O, increasing throughput. Avoid `async void` and blocking with `.Result`.

```csharp
public async Task<OrderDto> GetOrderAsync(int id, CancellationToken ct)
{
    var orderTask = _db.Orders.FindAsync([id], ct).AsTask();
    var ratesTask = _http.GetFromJsonAsync<Rates>("/rates", ct);
    await Task.WhenAll(orderTask, ratesTask);            // concurrent I/O, no blocked threads
    return Map(orderTask.Result!, ratesTask.Result!);
}
// ❌ var o = GetOrderAsync(1, ct).Result;   — sync-over-async blocks a thread
```

### What are the DI service lifetimes in ASP.NET Core?
Transient creates a new instance every time it's requested; Scoped creates one per HTTP request; Singleton creates one for the app's lifetime. Never inject scoped services into singletons (captive dependency).

```csharp
builder.Services.AddTransient<IEmailBuilder, EmailBuilder>();   // new every time
builder.Services.AddScoped<IOrderService, OrderService>();       // one per HTTP request
builder.Services.AddDbContext<ShopDb>(o => o.UseNpgsql(cs));     // scoped
builder.Services.AddSingleton<IClock, SystemClock>();            // one for the app

// Using a scoped service from a singleton/background service:
using var scope = _scopeFactory.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<ShopDb>();
```

### What is middleware?
Components in the ASP.NET Core request pipeline that each process the HTTP request and response and decide whether to call the next component. Examples: exception handling, routing, authentication, authorization, CORS, static files. Registration order determines execution order.

```csharp
app.Use(async (context, next) =>
{
    var sw = Stopwatch.StartNew();
    await next(context);                                         // call the rest of the pipeline
    context.Response.Headers["X-Elapsed-Ms"] = sw.ElapsedMilliseconds.ToString();
});
app.UseExceptionHandler("/error");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

### How does EF Core change tracking work?
The DbContext keeps snapshots of loaded entities; on `SaveChanges`, it detects modifications and generates INSERT/UPDATE/DELETE statements within a transaction. `AsNoTracking` disables tracking for read-only queries to improve performance.

```csharp
var order = await db.Orders.FirstAsync(o => o.Id == 7);   // tracked snapshot
order.Status = OrderStatus.Shipped;
Console.WriteLine(db.Entry(order).State);                   // Modified
await db.SaveChangesAsync();                                // UPDATE Orders SET Status=… WHERE Id=7

var report = await db.Orders.AsNoTracking().Where(o => o.Total > 100).ToListAsync(); // read-only, faster
```

### Why use IHttpClientFactory?
Creating and disposing `HttpClient` per request can exhaust sockets, while a single static instance can miss DNS changes. The factory pools and recycles message handlers, supports named/typed clients and integrates resilience policies like retries and circuit breakers.

```csharp
builder.Services.AddHttpClient<GitHubClient>(c =>
{
    c.BaseAddress = new Uri("https://api.github.com/");
    c.DefaultRequestHeaders.UserAgent.ParseAdd("shop/1.0");
}).AddStandardResilienceHandler();                 // retries, timeout, circuit breaker (Polly)

public class GitHubClient(HttpClient http)
{
    public Task<Repo?> GetRepo(string name) => http.GetFromJsonAsync<Repo>($"repos/{name}");
}
```

### Controllers vs minimal APIs?
Controllers organise endpoints in classes with attribute routing, filters and conventions — well suited for large APIs. Minimal APIs define endpoints with lambdas in a lightweight way with less ceremony and slightly better performance, using route groups and endpoint filters for organisation.

```csharp Controller
[ApiController, Route("api/[controller]")]
public class OrdersController(IOrderService svc) : ControllerBase
{
    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> Get(int id) =>
        await svc.Find(id) is { } o ? Ok(o) : NotFound();
}
```
```csharp Minimal API
app.MapGet("/api/orders/{id:int}", async (int id, IOrderService svc) =>
    await svc.Find(id) is { } o ? Results.Ok(o) : Results.NotFound());
```

## Advanced

### How does garbage collection work in .NET?
The GC uses generations (0, 1, 2) assuming most objects die young; it collects Gen 0 frequently and cheaply, promoting survivors. Large objects go to the Large Object Heap collected with Gen 2. Server GC uses multiple heaps and threads for throughput; background GC minimises pauses.

```csharp
var tmp = new byte[1024];          // Gen 0 — collected cheaply if it dies young
var big = new byte[100_000];       // ≥ 85 KB → Large Object Heap (collected with Gen 2)
Console.WriteLine(GC.GetGeneration(tmp));   // 0
GC.Collect(); Console.WriteLine(GC.GetGeneration(tmp)); // 1 if still referenced
Console.WriteLine(GC.GetGCMemoryInfo().HeapSizeBytes);
```
```xml
<ServerGarbageCollector>true</ServerGarbageCollector>   <!-- default for ASP.NET Core -->
```

### What causes thread-pool starvation and how do you fix it?
Blocking threads with synchronous waits on async code (`.Result`, `.Wait()`), long synchronous I/O, or locks prevents the pool from serving new requests, and it injects threads slowly. Fix by going async end to end, avoiding sync-over-async, offloading CPU work appropriately and monitoring with `dotnet-counters`.

```csharp
// ❌ blocks a pool thread waiting for another pool thread
public IActionResult Get() => Ok(_client.GetStringAsync(url).Result);

// ✅ async all the way
public async Task<IActionResult> Get() => Ok(await _client.GetStringAsync(url));
```
```bash
dotnet-counters monitor -p <pid> --counters System.Runtime[threadpool-queue-length,threadpool-thread-count]
```

### What are `Span<T>` and `Memory<T>`?
`Span<T>` is a stack-only type representing a contiguous region of memory (arrays, stack memory, native memory) that enables slicing without allocations. `Memory<T>` is its heap-storable counterpart usable in async methods. They're key to high-performance parsing and buffer handling.

```csharp
Span<int> numbers = stackalloc int[4] { 1, 2, 3, 4 };   // stack memory, no GC
Span<int> tail = numbers[1..];                           // slice, no copy
tail[0] = 42;                                            // numbers[1] == 42

async Task ProcessAsync(Memory<byte> buffer)             // Memory<T> can cross await
{
    int read = await stream.ReadAsync(buffer);
    Parse(buffer.Span[..read]);
}
```

### How would you structure a large ASP.NET Core application?
Clean or vertical-slice architecture with clear boundaries, DI with appropriate lifetimes, CQRS for complex domains, EF Core with migrations and projections, options pattern for configuration, centralised error handling with ProblemDetails, authentication via an identity provider, health checks, OpenTelemetry, automated tests with WebApplicationFactory and Testcontainers, and containerised deployment with CI/CD.

```text
src/
  Shop.Api/            Program.cs, endpoints, auth config
  Shop.Application/    Features/Orders/PlaceOrder.cs (command + handler + validator)
  Shop.Domain/         Order.cs, Money.cs, domain events (no framework references)
  Shop.Infrastructure/ EF Core DbContext, migrations, external clients
tests/
  Shop.UnitTests/  Shop.IntegrationTests/ (WebApplicationFactory + Testcontainers)
```
```csharp Vertical slice
public record PlaceOrder(int CustomerId, List<Line> Lines) : IRequest<int>;
public class PlaceOrderHandler(ShopDb db) : IRequestHandler<PlaceOrder, int>
{
    public async Task<int> Handle(PlaceOrder cmd, CancellationToken ct)
    {
        var order = Order.Create(cmd.CustomerId, cmd.Lines);
        db.Orders.Add(order); await db.SaveChangesAsync(ct);
        return order.Id;
    }
}
```

### How do you secure an ASP.NET Core API?
Use HTTPS and HSTS, JWT bearer authentication against a trusted identity provider, policy-based authorization including resource checks, input validation, parameterised queries, rate limiting, CORS restrictions, secrets in Key Vault with managed identities, and security headers; log and monitor without exposing sensitive data.

```csharp
app.MapPut("/documents/{id}", async (int id, DocDto dto, ClaimsPrincipal user, IAuthorizationService auth, ShopDb db) =>
{
    var doc = await db.Documents.FindAsync(id);
    if (doc is null) return Results.NotFound();
    var ok = await auth.AuthorizeAsync(user, doc, "IsOwner");        // resource-based check
    if (!ok.Succeeded) return Results.Forbid();
    doc.Title = dto.Title; await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();
// Parameterised by EF Core; secrets from Key Vault: builder.Configuration.AddAzureKeyVault(...)
```

# Scenario Questions

## Beginner

### Your ASP.NET Core API returns 500 errors, but you can't see why in production. How do you get useful diagnostics?
- Add structured logging (`ILogger` with Serilog or OpenTelemetry) shipped to a central store such as Application Insights.
- Use the exception handler middleware with **ProblemDetails** responses (no stack traces sent to clients).
- Add correlation IDs, and health checks.
- Make sure the `ASPNETCORE_ENVIRONMENT` and log levels are right.

```csharp
builder.Services.AddProblemDetails();
builder.Services.AddOpenTelemetry().UseAzureMonitor();          // traces + logs + metrics
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).Enrich.FromLogContext());

app.UseExceptionHandler();   // returns RFC 7807 problem+json with a traceId, logs the exception
app.UseStatusCodePages();
```

## Intermediate

### Under load the API stops responding, and the thread pool shows hundreds of blocked threads. What's the cause?
That's **sync-over-async**: calling `.Result`, `.Wait()` or `GetAwaiter().GetResult()` on tasks blocks thread-pool threads while they wait for other thread-pool work, so the pool starves. Go **async all the way** (`await`), use async EF Core and HttpClient methods, and never block on async code in request paths.

```csharp
// ❌ found in a hot path
var user = _userService.GetAsync(id).GetAwaiter().GetResult();
lock (_sync) { _cache = LoadAsync().Result; }

// ✅
var user = await _userService.GetAsync(id);
await _semaphore.WaitAsync(); try { _cache = await LoadAsync(); } finally { _semaphore.Release(); }
```

### You create `new HttpClient()` per request, and the server runs out of sockets. How do you fix it?
Each instance holds a connection that lingers in TIME_WAIT after disposal, which causes **socket exhaustion**. Use **`IHttpClientFactory`** (named or typed clients) or one long-lived static client with `SocketsHttpHandler.PooledConnectionLifetime`, so connections are pooled and DNS changes are still respected.

```csharp
// ❌
using var client = new HttpClient();
var json = await client.GetStringAsync(url);

// ✅ typed client via IHttpClientFactory
builder.Services.AddHttpClient<WeatherClient>(c => c.BaseAddress = new Uri("https://api.weather.com"));
// or one static SocketsHttpHandler with PooledConnectionLifetime
static readonly HttpClient Shared = new(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(2) });
```

## Advanced

### EF Core queries are slow on a large reporting page. What do you look at?
- Log the generated SQL (`LogTo`, or `ToQueryString()`).
- Make sure filters run in the database, not in memory: avoid calling `.ToList()` too early, and avoid client evaluation.
- Use `AsNoTracking()` for read-only queries, project to DTOs with `Select`, use `AsSplitQuery()` to avoid cartesian explosions, add indexes, and use compiled queries for hot paths.
- Use raw SQL or Dapper for complex reports.

```csharp
var rows = await db.Orders
    .AsNoTracking()
    .Where(o => o.CreatedAt >= from)                       // filter in SQL
    .Select(o => new ReportRow(o.Id, o.Customer.Name, o.Total)) // project only needed columns
    .OrderByDescending(o => o.Total)
    .Take(500)
    .AsSplitQuery()
    .ToListAsync();
optionsBuilder.LogTo(Console.WriteLine, LogLevel.Information);  // see the generated SQL
```

# Tricky Questions

## Intermediate

### What's the difference between `IEnumerable<T>` and `IQueryable<T>` for this query? `db.Users.AsEnumerable().Where(u => u.Age > 30)`
`AsEnumerable()` switches to LINQ-to-Objects, so **the whole Users table is loaded** and filtered in memory. With `IQueryable`, `Where` is translated to SQL and runs in the database. Keep queries `IQueryable` until the final materialisation.

```csharp
db.Users.AsEnumerable().Where(u => u.Age > 30).ToList(); // SELECT * FROM Users → filter in C#
db.Users.Where(u => u.Age > 30).ToList();                // SELECT … WHERE Age > 30
```

### What does `async void` do that `async Task` doesn't?
An exception thrown in `async void` can't be awaited or caught by the caller. It goes to the synchronisation context and can **crash the process**, and callers can't tell when the method finishes. Use `async void` only for event handlers; everything else should return `Task`.

```csharp
async void Bad()  { await Task.Delay(10); throw new Exception("boom"); }  // crashes the process
async Task Good() { await Task.Delay(10); throw new Exception("boom"); }

try { Bad(); }        catch { /* never reached */ }
try { await Good(); } catch (Exception e) { Console.WriteLine(e.Message); }  // ✅ caught
// async void only for event handlers: button.Click += async (s, e) => await SaveAsync();
```

### A singleton service injects a scoped `DbContext`. What's wrong?
That's a **captive dependency**: the scoped DbContext lives as long as the singleton, is shared across requests and threads (DbContext isn't thread-safe), and holds stale tracked entities. ASP.NET Core's scope validation throws in development. Inject `IServiceScopeFactory` (or `IDbContextFactory`) and create a scope per operation.

```csharp
builder.Services.AddSingleton<PriceCache>();          // ❌ captures ShopDb forever
public class PriceCache(ShopDb db) { }

public class PriceCache(IServiceScopeFactory scopes)  // ✅ create a scope per operation
{
    public async Task RefreshAsync()
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDb>();
        _prices = await db.Products.ToDictionaryAsync(p => p.Id, p => p.Price);
    }
}
// builder.Host.UseDefaultServiceProvider(o => o.ValidateScopes = true) catches this at startup
```
