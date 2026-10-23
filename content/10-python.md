---
id: python
title: Python
short: Python
category: Backend
order: 10
color: #3776ab
icon: Py
summary: Core language to internals — data structures, comprehensions, OOP, decorators, generators, context managers, typing, GIL, asyncio and packaging.
---

# Beginner

## Python Basics and Data Types

Python is a **dynamically typed, strongly typed, interpreted** (compiled to bytecode, run by the CPython VM) language emphasising readability.

```python
name = "Asha"          # str
age = 30               # int (arbitrary precision)
price = 9.99           # float
active = True          # bool
nothing = None         # NoneType

print(f"{name} is {age} years old")   # f-strings
type(age), isinstance(age, int)
```

- **Dynamic typing**: variables are names bound to objects; types belong to objects.
- **Strong typing**: `"1" + 1` raises `TypeError` (no implicit coercion like JS).
- Indentation defines blocks.

### Mutable vs immutable

| Immutable | Mutable |
|---|---|
| `int`, `float`, `bool`, `str`, `tuple`, `frozenset`, `bytes` | `list`, `dict`, `set`, `bytearray`, most user objects |

Immutable objects can be dict keys / set members (hashable).

## Core Collections

```python
nums = [3, 1, 2]                 # list: ordered, mutable
nums.append(4); nums.sort(); nums[-1]; nums[1:3]

point = (1, 2)                   # tuple: ordered, immutable
x, y = point                     # unpacking
first, *rest = [1, 2, 3, 4]

user = {"name": "Asha", "age": 30}   # dict: insertion-ordered (3.7+)
user.get("email", "n/a"); user.items(); user | {"age": 31}   # merge (3.9+)

tags = {"py", "js"}              # set: unique, unordered
tags & {"py", "go"}; tags | {"rust"}; tags - {"js"}
```

### Time complexity (average)

| Operation | list | dict / set |
|---|---|---|
| index / lookup | O(1) by index, O(n) `in` | O(1) `in` / key lookup |
| append / add | O(1) amortised | O(1) |
| insert/delete at start | O(n) | O(1) |

Use `collections.deque` for O(1) appends/pops at both ends.

### The `collections` module
`Counter` (counting), `defaultdict` (default values), `deque`, `namedtuple`, `OrderedDict`, `ChainMap`.

```python
from collections import Counter, defaultdict
Counter("mississippi").most_common(2)      # [('i', 4), ('s', 4)]
groups = defaultdict(list)
for w in words: groups[w[0]].append(w)
```

## Control Flow, Functions and Comprehensions

```python
for i, item in enumerate(items, start=1): ...
for a, b in zip(list1, list2): ...
while queue: node = queue.pop()

match command.split():                    # structural pattern matching (3.10+)
    case ["go", direction]: move(direction)
    case ["quit"]: exit()
    case _: print("Unknown")
```

### Functions
```python
def greet(name: str, greeting: str = "Hello", *args, sep: str = " ", **kwargs) -> str:
    return f"{greeting}{sep}{name}"

greet("Asha", sep=", ")
square = lambda x: x * x
```
- `*args` collects extra positional args into a tuple; `**kwargs` collects keyword args into a dict.
- Params after `*` are keyword-only; before `/` are positional-only.

> [!WARN]
> **Mutable default arguments** are evaluated once at definition time:
> ```python
> def add(item, bucket=[]):   # BUG: shared list across calls
>     bucket.append(item); return bucket
> def add(item, bucket=None):  # FIX
>     bucket = [] if bucket is None else bucket
> ```

### Comprehensions
```python
squares = [n * n for n in range(10) if n % 2 == 0]
lookup = {u.id: u for u in users}
unique = {w.lower() for w in words}
total = sum(o.amount for o in orders)        # generator expression — lazy, no list
```

## Strings, Files and Exceptions

```python
s = "  Hello, World  "
s.strip().lower().replace("world", "py").split(",")
", ".join(["a", "b"])
s[::-1]                                  # reverse

with open("data.txt", encoding="utf-8") as f:   # auto-closes
    for line in f: process(line)

from pathlib import Path
text = Path("config.json").read_text()
```

### Exceptions
```python
try:
    value = int(user_input)
except ValueError as e:
    log.warning("bad input: %s", e)
    value = 0
except (KeyError, TypeError):
    raise
else:
    print("no exception")
finally:
    cleanup()

class InsufficientFunds(Exception):
    pass
raise InsufficientFunds("balance too low") from original_error
```
EAFP ("easier to ask forgiveness than permission") is idiomatic Python: try and handle exceptions rather than pre-checking.

## Modules, Packages and Virtual Environments

```text
myapp/
├── pyproject.toml
└── src/myapp/
    ├── __init__.py
    ├── models.py
    └── services/
        └── billing.py
```
```python
from myapp.services.billing import charge
if __name__ == "__main__":   # only runs when executed directly, not on import
    main()
```

### Virtual environments
Isolate dependencies per project:
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# modern tooling
uv init && uv add fastapi && uv run main.py
```
Tools: **pip + venv**, **uv** (very fast, modern standard), Poetry, pip-tools, conda (data science). `pyproject.toml` is the standard project config.

# Intermediate

## Object-Oriented Python

```python
class Account:
    interest_rate = 0.03                    # class attribute (shared)

    def __init__(self, owner: str, balance: float = 0):
        self.owner = owner                  # instance attribute
        self._balance = balance             # "protected" by convention
        self.__pin = 1234                   # name-mangled to _Account__pin

    @property
    def balance(self) -> float:             # getter
        return self._balance

    def deposit(self, amount: float) -> None:
        if amount <= 0: raise ValueError("amount must be positive")
        self._balance += amount

    @classmethod
    def from_dict(cls, d: dict) -> "Account":   # alternative constructor
        return cls(d["owner"], d.get("balance", 0))

    @staticmethod
    def validate_owner(name: str) -> bool:
        return bool(name.strip())

    def __repr__(self): return f"Account({self.owner!r}, {self._balance})"
    def __eq__(self, other): return isinstance(other, Account) and self.owner == other.owner

class Savings(Account):
    def deposit(self, amount):
        super().deposit(amount * 1.01)
```

### Dunder (magic) methods
`__init__`, `__repr__`/`__str__`, `__eq__`/`__hash__`, `__lt__`, `__len__`, `__getitem__`, `__iter__`, `__contains__`, `__call__`, `__enter__`/`__exit__`, `__add__`. They let your objects work with built-in syntax.

### Dataclasses
```python
from dataclasses import dataclass, field
@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float
    tags: list[str] = field(default_factory=list)
```
Auto-generates `__init__`, `__repr__`, `__eq__` (and `__hash__` when frozen).

### MRO and multiple inheritance
Python uses **C3 linearization** for the Method Resolution Order; check `Class.__mro__`. `super()` follows the MRO, enabling cooperative multiple inheritance and mixins.

### Abstract base classes and protocols
```python
from abc import ABC, abstractmethod
class Repo(ABC):
    @abstractmethod
    def get(self, id: int): ...

from typing import Protocol
class SupportsClose(Protocol):         # structural typing ("duck typing" for type checkers)
    def close(self) -> None: ...
```

## Decorators

A decorator is a function that takes a function and returns a new function — using closures.

```python
import functools, time

def timer(func):
    @functools.wraps(func)                   # preserves __name__, __doc__
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            print(f"{func.__name__} took {time.perf_counter() - start:.3f}s")
    return wrapper

@timer
def slow(): time.sleep(1)
# equivalent to: slow = timer(slow)
```

### Decorators with arguments
```python
def retry(times=3, exceptions=(Exception,)):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, times + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions:
                    if attempt == times: raise
        return wrapper
    return decorator

@retry(times=5, exceptions=(ConnectionError,))
def fetch(): ...
```

Built-in decorators: `@property`, `@classmethod`, `@staticmethod`, `@functools.lru_cache`/`@cache`, `@dataclass`, `@contextmanager`. Frameworks use them heavily: `@app.get()` (FastAPI), `@login_required` (Django).

## Iterators and Generators

An **iterable** has `__iter__`; an **iterator** has `__next__` and raises `StopIteration` when done.

```python
def read_large_file(path):
    with open(path) as f:
        for line in f:
            yield line.rstrip()          # generator: lazy, constant memory

def batched(iterable, n):
    batch = []
    for item in iterable:
        batch.append(item)
        if len(batch) == n:
            yield batch; batch = []
    if batch: yield batch

gen = (x * x for x in range(10**9))  # nothing computed yet
next(gen)
```

- Generators keep their state between `yield`s and can only be iterated once.
- `yield from sub_gen` delegates.
- **`itertools`**: `chain`, `islice`, `groupby`, `product`, `permutations`, `combinations`, `accumulate`, `batched` (3.12).

| `return` | `yield` |
|---|---|
| ends the function, returns one value | pauses, produces a value, resumes later |

## Context Managers

Guarantee setup/teardown (files, locks, DB transactions, timers).

```python
class Timer:
    def __enter__(self):
        self.start = time.perf_counter(); return self
    def __exit__(self, exc_type, exc, tb):
        self.elapsed = time.perf_counter() - self.start
        return False                      # don't swallow exceptions

from contextlib import contextmanager
@contextmanager
def transaction(conn):
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise

with transaction(db) as conn:
    conn.execute("UPDATE …")
```
Async version: `async with` and `@asynccontextmanager`.

## Type Hints and Tooling

```python
from typing import TypedDict, Literal, Callable, Iterator, TypeVar, Generic

def total(prices: list[float], discount: float | None = None) -> float: ...

Status = Literal["active", "inactive"]
class UserDict(TypedDict):
    id: int
    name: str

T = TypeVar("T")
class Repository(Generic[T]):
    def get(self, id: int) -> T | None: ...
# 3.12+ syntax
def first[T](items: list[T]) -> T: return items[0]
```

- Hints aren't enforced at runtime; checked by **mypy** / **pyright**. Pydantic and FastAPI *use* them at runtime for validation.
- Tooling: **ruff** (lint + format, very fast), black, mypy/pyright, pytest, pre-commit.

## Testing with pytest

```python
# test_cart.py
import pytest
from cart import Cart

@pytest.fixture
def cart():
    return Cart()

def test_add_item(cart):
    cart.add("apple", 2)
    assert cart.count == 2

@pytest.mark.parametrize("qty", [0, -1])
def test_rejects_invalid_qty(cart, qty):
    with pytest.raises(ValueError):
        cart.add("apple", qty)

def test_checkout_calls_payment(cart, mocker):
    pay = mocker.patch("cart.payment.charge", return_value=True)
    cart.add("apple", 1); cart.checkout()
    pay.assert_called_once()
```
Fixtures (scopes: function/module/session), `conftest.py`, parametrize, markers, `unittest.mock`, coverage with `pytest-cov`.

# Advanced

## Python Internals: Memory, References and the GIL

### Everything is an object; variables are references
```python
a = [1, 2]; b = a; b.append(3)    # a is [1, 2, 3]
a == b      # value equality
a is b      # identity (same object)
x = 256; y = 256; x is y          # True — small int caching (-5..256), implementation detail
```
Always compare to `None` with `is`.

### Memory management
- **Reference counting** frees most objects immediately when the count hits 0.
- A **cyclic garbage collector** (generational: gen 0/1/2) finds reference cycles.
- `__slots__` removes per-instance `__dict__` → less memory, faster attribute access.
- `sys.getrefcount`, `tracemalloc`, `gc` module for diagnostics; `weakref` for caches.

### Shallow vs deep copy
```python
import copy
copy.copy(nested)       # new outer container, same inner objects
copy.deepcopy(nested)   # recursive copy
```

### The GIL (Global Interpreter Lock)
In CPython only **one thread executes Python bytecode at a time**.
- **I/O-bound** work: threads are fine (GIL released during I/O).
- **CPU-bound** work: use `multiprocessing`/`ProcessPoolExecutor`, C extensions (NumPy releases the GIL), or other runtimes.
- Python 3.13 introduced an experimental **free-threaded build** (no GIL, PEP 703), officially supported (still optional) in 3.14.

## Concurrency: Threads, Processes and asyncio

| Model | Best for | Notes |
|---|---|---|
| `threading` / `ThreadPoolExecutor` | blocking I/O (requests, DB drivers) | GIL limits CPU parallelism |
| `multiprocessing` / `ProcessPoolExecutor` | CPU-bound work | separate memory, pickling overhead |
| `asyncio` | many concurrent I/O tasks (thousands of sockets) | single thread, cooperative; needs async libraries |

```python
import asyncio, httpx

async def fetch(client, url):
    r = await client.get(url, timeout=10)
    return r.status_code

async def main(urls):
    async with httpx.AsyncClient() as client:
        async with asyncio.TaskGroup() as tg:              # 3.11+, structured concurrency
            tasks = [tg.create_task(fetch(client, u)) for u in urls]
    return [t.result() for t in tasks]

asyncio.run(main(["https://example.com"] * 10))
```

- `await` yields control to the event loop at I/O points.
- **Never call blocking code** (`time.sleep`, `requests`, heavy CPU) inside async functions — use `await asyncio.sleep`, async libraries, or `await asyncio.to_thread(blocking_fn)`.
- `asyncio.gather` (collect results), `asyncio.wait_for` / `asyncio.timeout()` (timeouts), `asyncio.Semaphore` (limit concurrency), `asyncio.Queue` (producer/consumer).

## Metaprogramming: Descriptors and Metaclasses

### Descriptors
Objects defining `__get__`/`__set__`/`__delete__`; they power `property`, methods, `classmethod`, and ORM fields.
```python
class Positive:
    def __set_name__(self, owner, name): self.name = "_" + name
    def __get__(self, obj, objtype=None): return getattr(obj, self.name)
    def __set__(self, obj, value):
        if value <= 0: raise ValueError(f"{self.name[1:]} must be > 0")
        setattr(obj, self.name, value)

class Order:
    quantity = Positive()
    def __init__(self, q): self.quantity = q
```

### Metaclasses
A metaclass is the "class of a class" (`type` by default) — it controls class creation. Django models and SQLAlchemy declarative base use them to collect field definitions.
```python
class RegistryMeta(type):
    registry = {}
    def __new__(mcls, name, bases, ns):
        cls = super().__new__(mcls, name, bases, ns)
        mcls.registry[name] = cls
        return cls
```
Simpler alternatives first: class decorators and `__init_subclass__`.

### Attribute lookup order
Data descriptors on the type → instance `__dict__` → non-data descriptors/class attributes → `__getattr__` fallback.

## Performance and Profiling

- Profile before optimising: `cProfile` + snakeviz, `py-spy` (sampling, production-safe), `line_profiler`, `memray`/`tracemalloc` for memory.
- Use the right data structure (set/dict lookups vs list scans).
- Built-ins and comprehensions are implemented in C — faster than manual loops.
- Cache: `functools.lru_cache`, `cache`.
- Vectorise numeric work with **NumPy/pandas/Polars**.
- Avoid repeated string concatenation in loops — use `"".join()`.
- Local variable lookups are faster than globals/attributes in hot loops.
- Cython, Numba, Rust extensions (PyO3) for hotspots; PyPy for pure-Python speedups.
- CPython 3.11+ is substantially faster (specialising adaptive interpreter); 3.13 added an experimental JIT.

```bash
python -m cProfile -o prof.out app.py && snakeviz prof.out
py-spy top --pid 12345                     # sample a running process, no restart
py-spy record -o flame.svg -- python app.py
python -X importtime app.py 2> imports.log # slow imports
```
```python
import timeit
timeit.timeit("x in s", setup="s = set(range(10_000)); x = 9_999", number=100_000)   # O(1)
timeit.timeit("x in l", setup="l = list(range(10_000)); x = 9_999", number=100_000)  # O(n)

from functools import lru_cache
@lru_cache(maxsize=1024)
def price_for(sku: str) -> float: ...
```

## Packaging, Project Structure and Best Practices

### pyproject.toml
```toml
[project]
name = "orders-service"
version = "1.2.0"
requires-python = ">=3.12"
dependencies = ["fastapi>=0.115", "sqlalchemy>=2.0", "pydantic-settings>=2"]

[project.optional-dependencies]
dev = ["pytest", "ruff", "mypy"]

[tool.ruff]
line-length = 100
```

### Best practices
- `src/` layout, pinned lock files (`uv.lock`), reproducible builds.
- Configuration via environment (`pydantic-settings`), never hard-coded secrets.
- `logging` module with structured (JSON) logs, not `print`.
- Type hints + mypy/pyright in CI; ruff for lint/format; pytest with coverage.
- PEP 8 style; docstrings (PEP 257).
- Use `if __name__ == "__main__"`, `pathlib`, f-strings, `enumerate`/`zip`, context managers.

# Interview Questions

## Beginner

### What are Python's key features?
Readable syntax, dynamic and strong typing, automatic memory management, interpreted (bytecode on a VM), multi-paradigm (OOP, functional, procedural), huge standard library and ecosystem, and cross-platform support.

```python
from dataclasses import dataclass

@dataclass
class Order:                       # OOP
    id: int
    total: float

orders = [Order(1, 20.0), Order(2, 5.5)]
big = [o for o in orders if o.total > 10]          # readable comprehensions
total = sum(map(lambda o: o.total, orders))        # functional style
x = 5; x = "now a string"                           # dynamic typing
# "1" + 1  → TypeError                              # but strong typing
```

### List vs tuple?
Lists are mutable and use `[]`; tuples are immutable and use `()`. Tuples are hashable (if contents are), slightly faster and smaller, and signal fixed structure (records, dict keys). Lists are for homogeneous, changing collections.

```python
nums = [1, 2, 3]; nums.append(4)       # mutable
point = (10, 20)                       # immutable
# point[0] = 5                         # TypeError
locations = {(51.5, -0.1): "London"}   # tuples are hashable → dict keys
x, y = point                           # unpacking
import sys; sys.getsizeof([1, 2, 3]), sys.getsizeof((1, 2, 3))  # (88, 64) — tuples are smaller
```

### What is the difference between `is` and `==`?
`==` checks value equality (`__eq__`). `is` checks identity — whether both names refer to the same object. Use `is` for singletons like `None`.

```python
a = [1, 2]; b = [1, 2]; c = a
a == b      # True  — same value
a is b      # False — different objects
a is c      # True
if value is None: ...   # ✅ identity check for singletons
```

### What are `*args` and `**kwargs`?
`*args` collects extra positional arguments into a tuple; `**kwargs` collects extra keyword arguments into a dict. They're also used to unpack sequences/dicts when calling functions.

```python
def log(level, *args, **kwargs):
    print(level, args, kwargs)

log("INFO", "user", 42, request_id="abc")   # INFO ('user', 42) {'request_id': 'abc'}

def wrapper(*args, **kwargs):
    return target(*args, **kwargs)          # forward everything

nums = [1, 2, 3]; opts = {"sep": "-"}
print(*nums, **opts)                        # 1-2-3
def f(a, /, b, *, c): ...                   # positional-only a, keyword-only c
```

### What is a list comprehension?
A concise syntax for building a list from an iterable with optional filtering: `[x*x for x in nums if x > 0]`. Dict and set comprehensions exist too; generator expressions use parentheses and evaluate lazily.

```python
squares = [x * x for x in range(10) if x % 2 == 0]   # [0, 4, 16, 36, 64]
by_id = {u["id"]: u for u in users}                  # dict comprehension
domains = {e.split("@")[1] for e in emails}          # set comprehension
total = sum(x * x for x in range(10**6))             # generator expression: no list in memory
matrix = [[r * c for c in range(3)] for r in range(3)]
```

### What are mutable default arguments and why are they dangerous?
Default values are evaluated once when the function is defined. A mutable default (list/dict) is shared across calls, so changes persist between calls. Use `None` and create the object inside the function.

```python
def add_item(item, items=[]):        # ❌ one list shared by all calls
    items.append(item)
    return items
add_item(1); add_item(2)             # [1, 2]  ← surprise

def add_item(item, items=None):      # ✅
    if items is None:
        items = []
    items.append(item)
    return items
```

### What is `__init__`?
The initializer called after a new instance is created (`__new__` creates it). It sets up instance attributes. It's not technically the constructor — `__new__` is.

```python
class Account:
    def __new__(cls, *args, **kwargs):     # creates the instance (rarely overridden)
        return super().__new__(cls)

    def __init__(self, owner: str, balance: float = 0):  # initialises it
        self.owner = owner
        self.balance = balance

acc = Account("Ada", 100)   # __new__ → __init__
```

### How is memory managed in Python?
CPython uses reference counting to free objects when no references remain, plus a generational cyclic garbage collector for reference cycles. Memory is allocated from private heaps with pymalloc for small objects.

```python
import sys, gc
a = []
sys.getrefcount(a)      # 2 (a + the argument)
b = a                   # refcount 3
del b                   # refcount 2 → freed immediately when it reaches 0

x = {}; y = {"x": x}; x["y"] = y   # reference cycle
del x, y
gc.collect()            # cyclic GC reclaims it
import tracemalloc; tracemalloc.start(); print(tracemalloc.get_traced_memory())
```

## Intermediate

### What are decorators and how do they work?
Functions that take a function (or class) and return a modified one, applied with `@decorator`. They work because functions are first-class and closures capture the original function. Use `functools.wraps` to preserve metadata. Common uses: logging, timing, caching, auth, retries, routing.

```python
import functools, time

def timed(fn):
    @functools.wraps(fn)                     # keep __name__, __doc__
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            print(f"{fn.__name__} took {time.perf_counter() - start:.3f}s")
    return wrapper

def retry(times=3):                          # decorator with arguments
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*a, **kw):
            for i in range(times):
                try: return fn(*a, **kw)
                except Exception:
                    if i == times - 1: raise
        return wrapper
    return deco

@timed
@retry(times=5)
def fetch(): ...
```

### Generators vs lists — when to use generators?
Generators produce values lazily one at a time with `yield`, using constant memory, and can represent infinite or streaming sequences. Lists store all items in memory and allow random access and multiple iterations. Use generators for large data pipelines and streaming.

```python
def read_large(path):
    with open(path) as f:
        for line in f:                 # one line in memory at a time
            yield line.rstrip("\n")

errors = (l for l in read_large("app.log") if "ERROR" in l)   # lazy pipeline
first_10 = [next(errors) for _ in range(10)]

import itertools
evens = (n for n in itertools.count() if n % 2 == 0)          # infinite
```

### `@staticmethod` vs `@classmethod`?
A classmethod receives the class (`cls`) and is used for alternative constructors or class-level behaviour respecting inheritance. A staticmethod receives neither class nor instance — it's a plain function namespaced in the class.

```python
class Date:
    def __init__(self, y, m, d): self.y, self.m, self.d = y, m, d

    @classmethod
    def from_iso(cls, s: str):            # alternative constructor; works for subclasses
        return cls(*map(int, s.split("-")))

    @staticmethod
    def is_leap(year: int) -> bool:       # utility, no cls/self
        return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

class EuroDate(Date): ...
EuroDate.from_iso("2026-10-23")           # returns an EuroDate
```

### What is a context manager?
An object implementing `__enter__`/`__exit__` used with `with` to guarantee setup and cleanup even if exceptions occur — files, locks, DB transactions. `contextlib.contextmanager` builds one from a generator.

```python
from contextlib import contextmanager
import time

class Timer:
    def __enter__(self): self.t = time.perf_counter(); return self
    def __exit__(self, exc_type, exc, tb):
        print(f"{time.perf_counter() - self.t:.3f}s")
        return False                       # don't swallow exceptions

@contextmanager
def transaction(conn):
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise

with Timer(), transaction(conn) as c:
    c.execute("UPDATE accounts SET balance = balance - 10 WHERE id = 1")
```

### Shallow copy vs deep copy?
A shallow copy creates a new container but references the same inner objects (`list.copy()`, `copy.copy`). A deep copy recursively copies all nested objects (`copy.deepcopy`), so changes to nested data don't affect the original.

```python
import copy
orig = {"tags": ["a"], "n": 1}
shallow = copy.copy(orig)
deep = copy.deepcopy(orig)
shallow["tags"].append("b")
print(orig["tags"])   # ['a', 'b'] — shared inner list
deep["tags"].append("c")
print(orig["tags"])   # ['a', 'b'] — independent
```

### What is the MRO?
Method Resolution Order: the order Python searches classes for attributes in inheritance hierarchies, computed with C3 linearization. Visible via `Class.__mro__`; `super()` follows it, enabling cooperative multiple inheritance.

```python
class A:            
    def hi(self): return "A"
class B(A):
    def hi(self): return "B" + super().hi()
class C(A):
    def hi(self): return "C" + super().hi()
class D(B, C): pass

D().hi()          # 'BCA' — super() follows the MRO, not just the parent
D.__mro__         # (D, B, C, A, object)
```

### What are dataclasses?
A decorator that generates boilerplate (`__init__`, `__repr__`, `__eq__`, optionally ordering, hashing, `slots`, `frozen`) from annotated class attributes. Great for simple data containers; use Pydantic when you need validation.

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True, order=True)
class Money:
    amount: int                 # cents
    currency: str = "EUR"

@dataclass
class Cart:
    items: list[str] = field(default_factory=list)   # safe mutable default
    def __post_init__(self):
        self.items = [i.strip() for i in self.items]

Money(500) == Money(500)        # True (__eq__ generated)
sorted([Money(9), Money(3)])    # ordering generated
```

### How do you handle exceptions properly?
Catch specific exceptions, not bare `except:`. Use `else` for success code and `finally` for cleanup, or context managers. Chain with `raise … from e`. Define custom exception hierarchies for domain errors, and log with `logger.exception` to include tracebacks.

```python
class PaymentError(Exception):
    """Domain error raised when a charge fails."""

def charge(card, amount):
    try:
        resp = gateway.charge(card, amount)
    except TimeoutError as e:
        raise PaymentError("gateway timeout") from e   # keep the cause
    except (ValueError, KeyError):
        log.exception("bad gateway response")
        raise
    else:
        return resp.id                                   # only if no exception
    finally:
        metrics.incr("charge.attempt")
```

## Advanced

### What is the GIL and how does it affect concurrency?
CPython's Global Interpreter Lock lets only one thread execute Python bytecode at a time, simplifying memory management. Threads still help for I/O-bound work because the GIL is released during blocking I/O. For CPU-bound parallelism use multiprocessing, C extensions that release the GIL, or the free-threaded build in 3.13+.

```python
import time
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor

def cpu(n): return sum(i * i for i in range(n))

with ThreadPoolExecutor(4) as ex:        # ~same time as sequential (GIL)
    list(ex.map(cpu, [10**7] * 4))
with ProcessPoolExecutor(4) as ex:       # ~4× faster on 4 cores
    list(ex.map(cpu, [10**7] * 4))
# Threads DO help for I/O: the GIL is released while waiting on sockets/files
```

### Threading vs multiprocessing vs asyncio?
Threading: preemptive concurrency, good for blocking I/O with existing sync libraries. Multiprocessing: true parallelism on multiple cores for CPU-bound work, with IPC overhead. asyncio: single-threaded cooperative multitasking for very high numbers of concurrent I/O operations, requires async-compatible libraries.

```python
# I/O with sync libraries → threads
with ThreadPoolExecutor(20) as ex: pages = list(ex.map(requests.get, urls))

# CPU-bound → processes
with ProcessPoolExecutor() as ex: thumbs = list(ex.map(make_thumbnail, files))

# Lots of concurrent I/O with async libraries → asyncio
async def main():
    async with httpx.AsyncClient() as client:
        pages = await asyncio.gather(*(client.get(u) for u in urls))
asyncio.run(main())
```

### What happens if you call blocking code inside an async function?
It blocks the event loop thread, so all other coroutines stall until it finishes — latency spikes for every request. Use async libraries, or offload with `asyncio.to_thread()`/`run_in_executor()`.

```python
async def handler():
    time.sleep(2)                          # ❌ freezes every other coroutine
    data = requests.get(url).json()        # ❌ blocking HTTP

async def handler_fixed():
    await asyncio.sleep(2)                                   # ✅
    async with httpx.AsyncClient() as c: data = (await c.get(url)).json()  # ✅ async lib
    result = await asyncio.to_thread(legacy_blocking_call, data)          # ✅ offload
```

### What are descriptors?
Objects with `__get__`, `__set__` or `__delete__` that customise attribute access when stored as class attributes. They implement `property`, bound methods, `classmethod`/`staticmethod`, `__slots__`, and ORM fields.

```python
class Positive:
    def __set_name__(self, owner, name): self.name = "_" + name
    def __get__(self, obj, objtype=None): return getattr(obj, self.name)
    def __set__(self, obj, value):
        if value <= 0: raise ValueError(f"{self.name[1:]} must be > 0")
        setattr(obj, self.name, value)

class Product:
    price = Positive()          # descriptor lives on the class
    def __init__(self, price): self.price = price

Product(10).price               # 10
Product(-1)                     # ValueError: price must be > 0
```

### What are metaclasses and when would you use one?
Metaclasses create classes (default `type`). They can modify class creation — registering subclasses, validating attributes, injecting methods. Frameworks (Django ORM, enums) use them. In application code, prefer class decorators or `__init_subclass__`.

```python
class PluginMeta(type):
    registry = {}
    def __new__(mcs, name, bases, ns):
        cls = super().__new__(mcs, name, bases, ns)
        if bases: mcs.registry[ns.get("name", name.lower())] = cls
        return cls

class Plugin(metaclass=PluginMeta): pass
class CsvExporter(Plugin): name = "csv"
PluginMeta.registry          # {'csv': <class CsvExporter>}

# Usually simpler: __init_subclass__
class Base:
    def __init_subclass__(cls, **kw): super().__init_subclass__(**kw); REGISTRY[cls.__name__] = cls
```

### How does `__slots__` help?
Declaring `__slots__` replaces the per-instance `__dict__` with fixed storage, reducing memory (significant for millions of objects) and speeding attribute access. Trade-offs: no dynamic attributes and inheritance subtleties.

```python
class PointDict:  def __init__(self, x, y): self.x, self.y = x, y
class PointSlots:
    __slots__ = ("x", "y")
    def __init__(self, x, y): self.x, self.y = x, y

import sys
sys.getsizeof(PointDict(1, 2).__dict__)   # ~100+ bytes extra per instance
p = PointSlots(1, 2)
# p.z = 3   → AttributeError: no __dict__
```

### How would you profile and speed up slow Python code?
Measure with cProfile/py-spy to find hotspots, then fix algorithms and data structures first, use built-ins and comprehensions, cache results, vectorise with NumPy/Polars, parallelise CPU work with processes, use async for I/O, and move remaining hotspots to Cython/Rust/Numba.

```python
# Before: O(n*m) membership checks and Python loop
result = [o for o in orders if o.customer_id in [c.id for c in vip_customers]]

# After: set lookup O(1)
vip_ids = {c.id for c in vip_customers}
result = [o for o in orders if o.customer_id in vip_ids]

# Vectorise numeric work
import numpy as np
totals = np.asarray(prices) * np.asarray(qty)     # instead of a Python for-loop
```

### Explain how `asyncio` works under the hood.
Coroutines are generator-like objects that suspend at `await`. The event loop schedules ready tasks, and when a task awaits I/O, it registers interest with the OS selector (epoll/kqueue) and switches to another task. When I/O is ready, the loop resumes the waiting coroutine. All of this happens on one thread through cooperative yielding.

```python
import asyncio

async def fetch(i):
    print("start", i)
    await asyncio.sleep(1)      # suspends: control returns to the event loop
    print("done", i)
    return i

async def main():
    tasks = [asyncio.create_task(fetch(i)) for i in range(3)]  # scheduled on the loop
    return await asyncio.gather(*tasks)                        # ~1s total, not 3s

asyncio.run(main())
# start 0, start 1, start 2, done 0, done 1, done 2
```

# Scenario Questions

## Beginner

### Your script works on your laptop but fails on the server with `ModuleNotFoundError`. How do you make it reproducible?
Use a **virtual environment** per project (`python -m venv .venv`, or `uv`/Poetry) and pin dependencies (`requirements.txt` from `pip freeze`, or a lock file). Check that the server uses the same Python version (`python --version`, `pyproject` `requires-python`). Run it as a module (`python -m app`) so imports resolve from the project root, and ideally ship it in a Docker image.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip freeze > requirements.lock          # exact versions
# or with uv
uv init && uv add requests && uv sync   # pyproject.toml + uv.lock
which python && python -c "import sys; print(sys.executable, sys.path)"  # is it the venv's python?
```

## Intermediate

### A script calls 500 HTTP APIs one after another and takes 10 minutes. How do you speed it up?
The work is **I/O-bound**, so run it concurrently:
- `asyncio` with `httpx.AsyncClient` and a `Semaphore` to cap concurrency, or
- `concurrent.futures.ThreadPoolExecutor`.

Reuse one client session (connection pooling), and add timeouts, retries with backoff, and rate limiting. Multiprocessing would only help for CPU-bound work, because of the GIL.

```python
import asyncio, httpx

async def fetch_all(urls, limit=20):
    sem = asyncio.Semaphore(limit)
    async with httpx.AsyncClient(timeout=10) as client:
        async def one(url):
            async with sem:
                r = await client.get(url)
                r.raise_for_status()
                return r.json()
        return await asyncio.gather(*(one(u) for u in urls), return_exceptions=True)

results = asyncio.run(fetch_all(urls))   # ~500/20 × latency instead of 500 × latency
```

### A data job loads a 20 GB CSV with pandas and runs out of memory. What are your options?
- Read in chunks (`pd.read_csv(..., chunksize=100_000)`) and aggregate incrementally.
- Load only the columns you need (`usecols`) with smaller dtypes (`category`, `int32`).
- Use a columnar format (Parquet).
- Use out-of-core or faster tools: **Polars** (lazy, streaming), **DuckDB** (SQL over the file), or Dask/Spark for distributed work.

```python
import pandas as pd
totals = {}
for chunk in pd.read_csv("sales.csv", chunksize=200_000,
                         usecols=["region", "amount"],
                         dtype={"region": "category", "amount": "float32"}):
    for region, s in chunk.groupby("region", observed=True)["amount"].sum().items():
        totals[region] = totals.get(region, 0) + s

# Or out-of-core engines
import polars as pl
pl.scan_csv("sales.csv").group_by("region").agg(pl.col("amount").sum()).collect(streaming=True)
```

## Advanced

### A CPU-heavy image-processing service only uses one of 16 cores. Why, and what do you do?
The **GIL** lets only one thread run Python bytecode at a time, so threads don't parallelise CPU-bound pure-Python work. Options:
- `multiprocessing` / `ProcessPoolExecutor`, or several worker processes (gunicorn workers, Celery)
- libraries that release the GIL (NumPy, Pillow-SIMD, OpenCV)
- the C/Rust extensions they're built on
- Python 3.13+ free-threaded builds, where they're supported

```python
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

def resize(path):
    with Image.open(path) as im:
        im.thumbnail((800, 800)); im.save(path.replace(".jpg", "_sm.jpg"))
    return path

if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=16) as ex:   # one process per core, no GIL contention
        for done in ex.map(resize, paths, chunksize=8):
            print(done)
```

# Tricky Questions

## Beginner

### What does this print?
```python
def add(item, bucket=[]):
    bucket.append(item)
    return bucket
print(add(1), add(2))
```
`[1, 2] [1, 2]`. Default arguments are evaluated **once**, when the function is defined, so every call shares the same list, and both printed references point at it. Use `bucket=None` with `if bucket is None: bucket = []`.

### What's the output? `a = [[0] * 3] * 3; a[0][0] = 1; print(a)`
`[[1, 0, 0], [1, 0, 0], [1, 0, 0]]`. The outer `* 3` copies **references** to the same inner list. Use `[[0] * 3 for _ in range(3)]`.

```python
a = [[0] * 3] * 3
a[0][0] = 1
print(a)                      # [[1, 0, 0], [1, 0, 0], [1, 0, 0]]
print(a[0] is a[1])           # True — same inner list
b = [[0] * 3 for _ in range(3)]
b[0][0] = 1
print(b)                      # [[1, 0, 0], [0, 0, 0], [0, 0, 0]]
```

### Is `256 is 256` True? What about `a = 1000; b = 1000; a is b`?
CPython caches small integers from -5 to 256, so identity checks on them happen to be True. For 1000 the result depends on the implementation (it's often False in the REPL and True inside one compiled code block). `is` checks **identity**; use `==` for values. Reserve `is` for `None`, `True` and `False`.

```python
a = 256; b = 256
a is b                 # True  — small-int cache (-5..256)
a = int("1000"); b = int("1000")
a is b                 # False — separate objects
a == b                 # True  — always use == for values
```

## Intermediate

### What does this print?
```python
funcs = [lambda: i for i in range(3)]
print([f() for f in funcs])
```
`[2, 2, 2]`. Closures capture the **variable**, not its value, and look it up when called (late binding). Fix it with a default argument: `lambda i=i: i`.

### What is printed?
```python
x = 10
def f():
    print(x)
    x = 20
f()
```
`UnboundLocalError`. Because `x` is assigned somewhere in `f`, Python treats it as local for the **whole** function body, so the `print` reads it before assignment. Use `global x` or `nonlocal`, or rename the variable.

## Advanced

### Why does modifying a dict while iterating raise an error, but a list doesn't?
```python
d = {1: 'a', 2: 'b'}
for k in d: d[k + 10] = 'x'   # RuntimeError: dictionary changed size during iteration
```
Dicts detect size changes during iteration. Lists don't, and silently skip or repeat elements instead (for example removing items while iterating). Iterate over a copy (`list(d)`, `lst[:]`) or build a new collection.
