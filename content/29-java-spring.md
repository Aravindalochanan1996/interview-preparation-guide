---
id: java
title: Java & Spring Boot
short: Java & Spring
category: Backend
order: 13.5
color: #e76f00
icon: Jv
summary: Core Java, OOP, collections, exceptions, generics, streams, concurrency, JVM internals, then Spring Core, Spring Boot, REST APIs, Spring Data JPA, Security, testing and microservices.
---

# Beginner

## Java Basics: JDK, JVM and Syntax

Java is a **statically typed, object-oriented, compiled-to-bytecode** language: `.java` → `javac` → `.class` bytecode → runs on the **JVM** ("write once, run anywhere").

| Term | Meaning |
|---|---|
| **JVM** | executes bytecode (class loading, JIT compilation, garbage collection) |
| **JRE** | JVM + standard libraries to *run* programs |
| **JDK** | JRE + compiler and tools (`javac`, `jar`, `jshell`, `jdb`) to *develop* |

Use an LTS release (Java 17, 21, 25).

```java Main.java
public class Main {
    public static void main(String[] args) {
        int age = 30;                       // primitives: byte short int long float double char boolean
        String name = "Asha";               // reference type, immutable
        var total = 99.5;                   // local type inference (Java 10+)
        System.out.printf("%s is %d%n", name, age);

        String level = switch (age / 10) {  // switch expression (Java 14+)
            case 0, 1 -> "young";
            case 2, 3 -> "adult";
            default   -> "senior";
        };
    }
}
```

### Primitives vs wrappers
`int` vs `Integer` — wrappers allow `null` and generics; **autoboxing** converts automatically. Beware `Integer` comparison with `==` (cache −128..127) — use `.equals()`.

### Strings
Immutable, stored in the **String pool** for literals. `==` compares references; `.equals()` compares content. Use `StringBuilder` for concatenation in loops. Text blocks (`"""`) for multi-line strings.

## OOP in Java

```java
public abstract class Account {                     // abstraction
    private final String id;                        // encapsulation: private + getters
    protected double balance;

    protected Account(String id) { this.id = id; }
    public String getId() { return id; }
    public abstract double monthlyFee();            // subclasses must implement

    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("Amount must be positive");
        balance += amount;
    }
}

public class SavingsAccount extends Account implements Interest {   // inheritance + interface
    public SavingsAccount(String id) { super(id); }
    @Override public double monthlyFee() { return 0; }              // polymorphism (overriding)
    @Override public double rate() { return 0.04; }
}

public interface Interest {
    double rate();
    default double yearlyInterest(double amount) { return amount * rate(); }   // default method
}
```

### Four pillars
**Encapsulation** (hide state behind methods), **Inheritance** (`extends`, single class inheritance), **Polymorphism** (overloading = compile-time; overriding = runtime dynamic dispatch), **Abstraction** (abstract classes and interfaces).

### Abstract class vs interface
| Abstract class | Interface |
|---|---|
| can have state (fields), constructors | no instance state (constants only) |
| single inheritance | a class implements many |
| any access modifiers | methods public (private helpers allowed since Java 9) |
| "is-a" with shared code | capability/contract ("can-do") |

### Key keywords
`static` (belongs to the class), `final` (variable can't be reassigned / method can't be overridden / class can't be extended), `this`, `super`, access modifiers: `private` < default (package) < `protected` < `public`.

### Modern data types
```java
public record Point(int x, int y) {}                  // immutable data carrier: constructor, getters, equals/hashCode/toString
public sealed interface Shape permits Circle, Square {}   // restricted hierarchy (Java 17)
if (obj instanceof Point p && p.x() > 0) { ... }      // pattern matching
```

## Collections Framework

| Interface | Implementations | Notes |
|---|---|---|
| `List` (ordered, duplicates) | **ArrayList** (dynamic array, O(1) get), **LinkedList** (O(1) add/remove at ends) | ArrayList is the default |
| `Set` (unique) | **HashSet** (unordered, O(1)), **LinkedHashSet** (insertion order), **TreeSet** (sorted, O(log n)) | relies on `equals`/`hashCode` (or `compareTo`) |
| `Map` (key→value) | **HashMap**, **LinkedHashMap** (order; LRU via access order), **TreeMap** (sorted) | `ConcurrentHashMap` for concurrency |
| `Queue`/`Deque` | **ArrayDeque**, **PriorityQueue** (heap) | ArrayDeque for stacks and queues |

```java
List<String> names = new ArrayList<>(List.of("Ravi", "Asha"));
Map<String, Integer> counts = new HashMap<>();
for (String w : words) counts.merge(w, 1, Integer::sum);
names.sort(Comparator.comparing(String::length).thenComparing(Comparator.naturalOrder()));
```

### equals and hashCode contract
If `a.equals(b)` then `a.hashCode() == b.hashCode()`. Override both together, or objects will misbehave as HashMap keys/HashSet elements. Records do this automatically.

### How HashMap works
Array of buckets; `hash(key)` picks a bucket; collisions stored in a linked list, converted to a **red-black tree** when a bucket exceeds 8 entries (Java 8+). Resizes (doubling) when size exceeds capacity × load factor (0.75). Not thread-safe.

### Fail-fast iterators
Modifying a collection while iterating (except via `iterator.remove()`) throws `ConcurrentModificationException`.

## Exceptions

```text
Throwable
├── Error (OutOfMemoryError, StackOverflowError) — don't catch
└── Exception
    ├── checked: IOException, SQLException — must be caught or declared (throws)
    └── RuntimeException (unchecked): NullPointerException, IllegalArgumentException, IllegalStateException
```

```java
try (var reader = Files.newBufferedReader(path)) {      // try-with-resources: auto close
    return reader.readLine();
} catch (NoSuchFileException e) {
    throw new ConfigNotFoundException("Missing config: " + path, e);   // wrap & keep cause
} finally {
    log.debug("read attempted");
}
```
Best practices: catch specific exceptions, don't swallow them, wrap with context, use custom unchecked exceptions for domain errors, use `Optional` instead of returning null for "maybe absent" values.

# Intermediate

## Generics, Lambdas and the Streams API

### Generics
```java
public class Box<T> { private T value; public T get() { return value; } }
public static <T extends Comparable<T>> T max(List<T> list) { ... }
double sum(List<? extends Number> nums)      // read from (producer extends)
void addAll(List<? super Integer> sink)      // write to (consumer super)  → PECS
```
Generics are implemented by **type erasure** — type info is removed at runtime (no `new T()`, no `List<int>`).

### Lambdas and functional interfaces
`Function<T,R>`, `Predicate<T>`, `Consumer<T>`, `Supplier<T>`, `BiFunction`, `UnaryOperator`, `Runnable`, `Comparator`. Method references: `String::toUpperCase`, `System.out::println`, `User::new`.

### Streams
```java
Map<String, Double> revenueByCity = orders.stream()
    .filter(o -> o.status() == Status.PAID)
    .collect(Collectors.groupingBy(Order::city, Collectors.summingDouble(Order::amount)));

List<String> topCustomers = orders.stream()
    .sorted(Comparator.comparingDouble(Order::amount).reversed())
    .map(Order::customer)
    .distinct()
    .limit(5)
    .toList();

Optional<Order> first = orders.stream().filter(o -> o.amount() > 1000).findFirst();
```
- **Intermediate** ops (lazy): `filter`, `map`, `flatMap`, `sorted`, `distinct`, `limit`, `peek`.
- **Terminal** ops (trigger execution): `collect`, `forEach`, `reduce`, `count`, `findFirst`, `anyMatch`, `toList`.
- Streams can be consumed only once; `parallelStream()` uses the ForkJoin pool — only for large CPU-bound work without shared state.

## Concurrency and Multithreading

```java
ExecutorService pool = Executors.newFixedThreadPool(4);
Future<Integer> f = pool.submit(() -> compute());

CompletableFuture<Profile> profile = CompletableFuture.supplyAsync(() -> userClient.get(id))
    .thenCombine(CompletableFuture.supplyAsync(() -> orderClient.list(id)), Profile::new)
    .exceptionally(ex -> Profile.empty());

// Java 21 virtual threads — cheap threads for blocking I/O
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    urls.forEach(u -> executor.submit(() -> http.get(u)));
}
```

### Key concepts
- **Thread lifecycle**: NEW → RUNNABLE → BLOCKED/WAITING/TIMED_WAITING → TERMINATED.
- **Race conditions** — fix with `synchronized`, `ReentrantLock`, atomic classes (`AtomicInteger`), immutable objects, or thread confinement.
- **`volatile`** — guarantees visibility of writes across threads (not atomicity).
- **Deadlock** — threads waiting on each other's locks; avoid with consistent lock ordering, `tryLock` with timeout.
- **Concurrent collections**: `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue` (producer/consumer).
- Synchronizers: `CountDownLatch`, `CyclicBarrier`, `Semaphore`.
- **Java Memory Model** and *happens-before* relationships define when writes become visible.
- **Virtual threads** (Project Loom, Java 21): millions of lightweight threads; ideal for thread-per-request blocking I/O; avoid pinning (long `synchronized` blocks around I/O in older JDKs) and don't pool them.

## Spring Core: IoC and Dependency Injection

**Spring** is the dominant Java application framework. Its core is the **IoC container** (ApplicationContext) that creates and wires **beans**.

```java
@Service
public class OrderService {
    private final OrderRepository repo;
    private final PaymentClient payments;

    public OrderService(OrderRepository repo, PaymentClient payments) {   // constructor injection (preferred)
        this.repo = repo;
        this.payments = payments;
    }
}

@Configuration
public class AppConfig {
    @Bean
    public RestClient paymentRestClient(@Value("${payments.url}") String url) {
        return RestClient.builder().baseUrl(url).build();
    }
}
```

- **Stereotypes**: `@Component`, `@Service`, `@Repository` (adds exception translation), `@Controller`/`@RestController`.
- **Injection types**: constructor (preferred — immutable, testable, required deps), setter (optional deps), field `@Autowired` (avoid).
- Ambiguity: `@Primary`, `@Qualifier("name")`.
- **Bean scopes**: `singleton` (default), `prototype`, `request`, `session`, `application`.
- **Bean lifecycle**: instantiate → inject → `@PostConstruct` → ready → `@PreDestroy`.
- **AOP** (aspects) powers `@Transactional`, `@Cacheable`, `@Async`, security — implemented with **proxies**, so self-invocation (calling a `@Transactional` method from the same class) bypasses the proxy.

## Spring Boot and REST APIs

Spring Boot = **auto-configuration + starters + embedded server + opinionated defaults + production features (Actuator)**.

```java
@SpringBootApplication          // = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class ShopApplication {
    public static void main(String[] args) { SpringApplication.run(ShopApplication.class, args); }
}

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService service;

    @GetMapping
    public Page<ProductDto> list(@RequestParam(defaultValue = "") String q, Pageable pageable) {
        return service.search(q, pageable);
    }

    @GetMapping("/{id}")
    public ProductDto get(@PathVariable Long id) { return service.get(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductDto create(@Valid @RequestBody CreateProductRequest req) { return service.create(req); }
}

public record CreateProductRequest(@NotBlank String name, @Positive BigDecimal price, @Size(max = 500) String description) {}

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(NotFoundException.class)
    ProblemDetail notFound(NotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());   // RFC 9457 error body
    }
}
```

### Configuration
`application.yml` + **profiles** (`application-prod.yml`, `spring.profiles.active=prod`), type-safe `@ConfigurationProperties`, externalised config via environment variables, config servers or Kubernetes ConfigMaps.

### Actuator
`/actuator/health` (liveness/readiness groups for Kubernetes), `/metrics` (Micrometer → Prometheus), `/info`, `/env`, `/loggers`. Secure and expose only what's needed.

### HTTP clients
`RestClient` (synchronous, modern), `WebClient` (reactive), declarative HTTP interfaces (`@HttpExchange`), OpenFeign (Spring Cloud).

## Spring Data JPA and Hibernate

```java
@Entity
@Table(name = "orders")
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "customer_id") private Customer customer;
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true) private List<OrderItem> items = new ArrayList<>();
    @Enumerated(EnumType.STRING) private Status status;
    @Version private Long version;                    // optimistic locking
}

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByStatusAndCreatedAtAfter(Status status, Instant after);     // derived query

    @Query("select o from Order o join fetch o.items where o.customer.id = :customerId")   // fetch join avoids N+1
    List<Order> findWithItems(@Param("customerId") Long customerId);

    @EntityGraph(attributePaths = {"customer"})
    Page<Order> findAll(Pageable pageable);
}
```

### Must-know JPA concepts
- **Persistence context** (first-level cache) and entity states: transient, managed, detached, removed; **dirty checking** writes changes on flush/commit.
- **Fetch types**: `@ManyToOne`/`@OneToOne` default EAGER (set LAZY), collections default LAZY. **LazyInitializationException** when accessing lazy data outside a transaction/session.
- **N+1 problem** — fix with `join fetch`, `@EntityGraph`, batch fetching (`hibernate.default_batch_fetch_size`), DTO projections.
- **@Transactional**: propagation (`REQUIRED` default, `REQUIRES_NEW`, `MANDATORY`…), isolation, `readOnly = true` for queries, rollback on unchecked exceptions by default (checked exceptions need `rollbackFor`).
- Schema migrations with **Flyway** or **Liquibase** (not `ddl-auto=update` in production).

# Advanced

## JVM Internals and Performance

### Memory areas
- **Heap** — objects; generational (young: Eden + survivors; old/tenured).
- **Stack** — per thread: frames, local primitives and references.
- **Metaspace** — class metadata (native memory, replaced PermGen in Java 8).
- Code cache (JIT-compiled code), direct buffers.

### Garbage collectors
| GC | Focus |
|---|---|
| Serial | small heaps, single core |
| Parallel | throughput (batch jobs) |
| **G1** (default) | balanced throughput/latency, region-based, pause targets |
| **ZGC** (generational) / Shenandoah | ultra-low pause times (sub-ms) for large heaps |

### Class loading
Bootstrap → Platform → Application class loaders with **parent delegation**; phases: loading, linking (verify, prepare, resolve), initialisation.

### JIT
Bytecode is interpreted initially; hot methods are compiled to native code by C1/C2 (tiered compilation) with optimisations like inlining and escape analysis. **GraalVM native image** compiles ahead-of-time for fast startup (used with Spring Boot native, Quarkus, Micronaut).

### Tuning and troubleshooting
- Containers: JVM is container-aware; size heap with `-XX:MaxRAMPercentage=75`.
- `OutOfMemoryError: Java heap space` → heap dump (`-XX:+HeapDumpOnOutOfMemoryError`), analyse with Eclipse MAT for leaks (static collections, caches, listeners, ThreadLocals).
- High CPU → thread dumps (`jstack`, `jcmd <pid> Thread.print`), profilers (async-profiler, **Java Flight Recorder** + JDK Mission Control).
- GC logs (`-Xlog:gc*`), monitor with Micrometer/Prometheus/Grafana.

## Spring Security

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())                         // stateless API with bearer tokens
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**", "/api/v1/auth/**").permitAll()
                .requestMatchers(HttpMethod.DELETE, "/api/v1/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))   // validate JWTs from an IdP (Keycloak, Entra ID, Okta)
            .build();
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
}

@PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
public UserDto getUser(String userId) { ... }
```
- Architecture: a **filter chain** (`DelegatingFilterProxy` → `FilterChainProxy` → security filters) → `AuthenticationManager`/`AuthenticationProvider` → `SecurityContextHolder`.
- Authentication methods: form login + sessions, HTTP Basic, **OAuth2 Login/OIDC** (client), **resource server** (JWT validation), method security.
- CSRF protection on for session-based apps; CORS configuration for SPAs.

## Microservices with Spring Cloud

| Concern | Solution |
|---|---|
| Configuration | Spring Cloud Config, Kubernetes ConfigMaps/Secrets |
| Service discovery | Eureka, Consul, or Kubernetes DNS |
| API gateway | **Spring Cloud Gateway** |
| Client calls | OpenFeign / RestClient / WebClient with load balancing |
| Resilience | **Resilience4j**: circuit breaker, retry, rate limiter, bulkhead, time limiter |
| Messaging | Spring for Apache Kafka, Spring AMQP (RabbitMQ), Spring Cloud Stream |
| Observability | Micrometer metrics + **Micrometer Tracing** (OpenTelemetry), structured logging with trace IDs |
| Distributed transactions | sagas (orchestration/choreography), outbox pattern |
| Contract testing | Spring Cloud Contract, Pact |

```java
@CircuitBreaker(name = "inventory", fallbackMethod = "inventoryFallback")
@Retry(name = "inventory")
public Stock checkStock(String sku) { return inventoryClient.stock(sku); }

private Stock inventoryFallback(String sku, Throwable t) { return Stock.unknown(sku); }
```

### Reactive Spring (WebFlux)
Non-blocking stack on Project Reactor (`Mono`, `Flux`) and Netty — high concurrency with few threads for streaming/I/O-heavy services. With virtual threads, classic blocking Spring MVC often achieves similar scalability with simpler code.

## Testing Spring Applications

```java
@WebMvcTest(ProductController.class)                       // slice test: MVC layer only
class ProductControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean ProductService service;                   // (formerly @MockBean)

    @Test
    void returnsProduct() throws Exception {
        when(service.get(1L)).thenReturn(new ProductDto(1L, "Pen", new BigDecimal("20")));
        mvc.perform(get("/api/v1/products/1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.name").value("Pen"));
    }
}

@SpringBootTest
@Testcontainers
class OrderRepositoryIT {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:17");
    @Autowired OrderRepository repo;
    @Test void savesOrder() { /* real database */ }
}
```
Slices: `@WebMvcTest`, `@DataJpaTest`, `@JsonTest`, `@RestClientTest`; full `@SpringBootTest`; **Testcontainers** for real dependencies; AssertJ, Mockito, WireMock, ArchUnit for architecture rules.

# Interview Questions

## Beginner

### JDK vs JRE vs JVM?
The JVM executes bytecode and manages memory and JIT compilation. The JRE bundles the JVM with standard libraries to run Java applications. The JDK adds development tools like the compiler (`javac`), debugger and packaging tools.

### `==` vs `equals()`?
`==` compares references for objects (whether both point to the same object) and values for primitives. `equals()` compares logical content as defined by the class — e.g., `String.equals` compares characters.

### Why are Strings immutable in Java?
Immutability enables the string pool (safe sharing), thread safety without synchronization, cached hash codes for fast HashMap keys, and security (strings used for class names, file paths and credentials can't be changed after validation).

### Abstract class vs interface?
An abstract class can have state, constructors and any access modifiers, and supports single inheritance — used for shared base behaviour. An interface defines a contract with abstract, default and static methods and no instance state; a class can implement many interfaces.

### ArrayList vs LinkedList?
ArrayList is backed by a dynamic array: O(1) random access, amortised O(1) append, O(n) inserts in the middle, cache-friendly. LinkedList is a doubly linked list: O(1) insert/remove at known nodes, O(n) access. ArrayList is the better default.

### Checked vs unchecked exceptions?
Checked exceptions (subclasses of Exception but not RuntimeException) must be caught or declared — for recoverable conditions like I/O failures. Unchecked exceptions (RuntimeException) indicate programming errors or domain violations and don't need declaration.

### What is the `final` keyword?
On a variable it prevents reassignment; on a method it prevents overriding; on a class it prevents inheritance. A final reference to a mutable object still allows the object's state to change.

## Intermediate

### How does HashMap work internally?
It hashes the key to find a bucket index in an array. Entries with colliding indexes are stored in a linked list, converted to a red-black tree after 8 entries for O(log n) lookups. When size exceeds capacity × load factor (0.75), the table doubles and entries are rehashed. Keys need consistent `equals` and `hashCode`.

### What is the equals/hashCode contract?
Equal objects must have equal hash codes; `hashCode` must be consistent while the object is unchanged; unequal objects may share hash codes. Violating it breaks hash-based collections — objects can't be found or duplicates appear.

### What are streams and how are they different from collections?
Streams are lazy pipelines of operations over data sources, processing elements on demand without storing them, supporting functional operations and optional parallelism. Collections store elements in memory. A stream can be consumed only once.

### What is dependency injection in Spring?
The IoC container creates objects (beans) and supplies their dependencies instead of classes constructing them. This decouples components, enables configuration and swapping implementations, and simplifies testing. Constructor injection is preferred.

### What does `@SpringBootApplication` do?
It combines `@Configuration` (bean definitions), `@EnableAutoConfiguration` (configure beans based on classpath and properties) and `@ComponentScan` (discover components in the package and subpackages).

### What is the N+1 problem in JPA and how do you fix it?
Loading N parent entities and then lazily loading each one's associations triggers N extra queries. Fix with fetch joins, `@EntityGraph`, batch fetching, or DTO projections that select exactly the needed data.

### How does `@Transactional` work?
Spring wraps the bean in a proxy that begins a transaction before the method and commits or rolls back after (rolling back on unchecked exceptions by default). Because it's proxy-based, calling a transactional method from within the same class bypasses the transaction, and it only applies to public methods on Spring beans.

### What is the difference between `synchronized` and `volatile`?
`volatile` guarantees visibility of the latest write to a variable across threads but not atomicity of compound actions. `synchronized` provides mutual exclusion and visibility for a block or method, making compound operations atomic.

## Advanced

### Explain JVM memory areas and garbage collection.
Objects live on the heap, split into young (Eden and survivor spaces) and old generations; most objects die young and are collected cheaply by minor GCs. Thread stacks hold frames and local references; Metaspace holds class metadata. Collectors like G1 balance throughput and pause times; ZGC achieves sub-millisecond pauses for large heaps.

### How would you troubleshoot an OutOfMemoryError in production?
Identify the type (heap, metaspace, direct memory, unable to create native thread), capture a heap dump on OOM, analyse dominators and retained sizes in Eclipse MAT, check GC logs and memory metrics trends, look for unbounded caches, static collections, leaked listeners or ThreadLocals, and validate container memory limits against JVM settings.

### What are virtual threads and when should you use them?
Lightweight threads managed by the JVM (Java 21) that make blocking I/O cheap — millions can exist because they unmount from carrier threads while blocked. They suit thread-per-request servers and I/O-heavy workloads; they don't speed up CPU-bound tasks, shouldn't be pooled, and you should avoid pinning with long synchronized blocks around blocking calls.

### How do you make Spring Boot microservices resilient?
Set timeouts on all clients, use Resilience4j circuit breakers, retries with backoff for idempotent calls, bulkheads and rate limiters, provide fallbacks, use asynchronous messaging with retries and DLQs, implement health probes for Kubernetes, and add tracing, metrics and alerting.

### How does Spring Security process a request?
The servlet filter chain delegates to Spring Security's `FilterChainProxy`, which runs ordered security filters (CORS, CSRF, authentication such as bearer token or session, exception translation, authorization). Authentication populates the `SecurityContext`; authorization filters and method security (`@PreAuthorize`) check permissions before reaching the controller.

### Optimistic vs pessimistic locking in JPA?
Optimistic locking uses a `@Version` field; updates include the version and fail with `OptimisticLockException` if another transaction changed the row, suitable for low contention. Pessimistic locking (`@Lock(PESSIMISTIC_WRITE)`) issues `SELECT … FOR UPDATE`, blocking others until commit — suitable for high contention but reduces concurrency.

# Scenario Questions

## Beginner

### Your Spring Boot app fails to start with "Port 8080 was already in use". What are your options?
Another process (often a previous run of the app) holds the port. Find it with `lsof -i :8080` (Linux/macOS) or `netstat -ano | findstr 8080` (Windows) and stop it, or change the port with `server.port=8081` (or `0` for a random port in tests).

## Intermediate

### The orders API is slow, and the logs show hundreds of SQL queries per request. How do you fix it?
It's the JPA **N+1 problem**: lazy associations are loaded one by one while serialising entities. Fixes:
- `JOIN FETCH` in JPQL, or `@EntityGraph`
- `@BatchSize` / `hibernate.default_batch_fetch_size`
- returning **DTO projections** instead of entities
- turning off Open Session in View (`spring.jpa.open-in-view=false`) so lazy loading can't silently happen in the view layer

Watch queries with `spring.jpa.show-sql` or datasource-proxy.

### A `@Transactional` method doesn't roll back when an error occurs. Why?
- By default only **unchecked** exceptions (`RuntimeException`, `Error`) trigger rollback. Add `rollbackFor = Exception.class` for checked ones.
- The method is called from **within the same class** (self-invocation), which bypasses the proxy, so there's no transaction at all.
- The method isn't public (on older Spring versions).
- The exception is caught and swallowed.

## Advanced

### Production pods crash with `OutOfMemoryError: Java heap space` under load. How do you investigate?
- Enable `-XX:+HeapDumpOnOutOfMemoryError`, and analyse the dump in Eclipse MAT (the dominator tree).
- Check GC logs and metrics with Micrometer/Prometheus.
- Common causes: unbounded caches, loading huge result sets (use pagination or streaming), ThreadLocal leaks, and a heap that's too small for the container (set `-XX:MaxRAMPercentage=75`).
- For thread-pool exhaustion, consider **virtual threads** (`spring.threads.virtual.enabled=true`) for blocking I/O workloads.

# Tricky Questions

## Beginner

### What does this print? `String a = "hi"; String b = new String("hi"); System.out.println(a == b); System.out.println(a.equals(b));`
`false`, then `true`. `==` compares **references**: `a` comes from the string pool and `b` is a new object. `equals` compares content. `b.intern() == a` would be `true`.

### What does `Integer x = 127, y = 127; Integer p = 128, q = 128; System.out.println((x == y) + " " + (p == q));` print?
`true false`. `Integer.valueOf` caches values from **-128 to 127**, so `x` and `y` are the same object while `p` and `q` are different objects. Always compare boxed numbers with `equals()`.

## Intermediate

### What happens here, and is it safe? `List<Integer> list = new ArrayList<>(List.of(1, 2, 3)); for (Integer i : list) if (i == 2) list.remove(i);`
Surprisingly, **nothing is thrown, and nothing is printed either**. `2` is the second-to-last element: after it's removed, the size becomes 2, the iterator's cursor is also 2, so `hasNext()` returns false and the loop ends quietly. Element `3` is never visited. Remove `1` instead and you get a **`ConcurrentModificationException`**. Either way, modifying a list inside a for-each loop is a bug. Use `list.removeIf(i -> i == 2)` or `Iterator.remove()`. Note too that `remove(Object)` and `remove(int index)` are different overloads.

### Why does this `HashMap` lose your object? You put a `Person` as a key, then change `person.name`, then `map.get(person)` returns null.
`hashCode` depends on `name`, so after the mutation the lookup searches the **wrong bucket**. Map keys must be immutable, or at least their hashCode/equals fields must never change. Records make good keys.

## Advanced

### Is `volatile` enough to make `count++` thread-safe?
**No.** `volatile` guarantees **visibility** and ordering, not atomicity. `count++` is read-modify-write, so two threads can both read 5 and both write 6. Use `AtomicInteger`/`LongAdder`, `synchronized`, or locks.
