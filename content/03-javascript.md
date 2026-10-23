---
id: javascript
title: JavaScript
short: JavaScript
category: Web Foundations
order: 3
color: #c9a400
icon: JS
summary: The language behind everything — types, scope, closures, this, prototypes, async, the event loop and output-prediction puzzles.
---

# Beginner

## Variables, Types and Values

### `var`, `let`, `const`

| | Scope | Hoisted | Re-declare | Re-assign |
|---|---|---|---|---|
| `var` | function | yes, initialised to `undefined` | yes | yes |
| `let` | block | yes, but in the **Temporal Dead Zone** | no | yes |
| `const` | block | yes, TDZ | no | no (but objects are still mutable) |

```js
const user = { name: 'Asha' };
user.name = 'Ravi';   // OK — the binding is constant, not the object
user = {};            // TypeError
```

Default to `const`, use `let` when you reassign, avoid `var`.

### The 8 data types
**Primitives** (immutable, compared by value): `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, `symbol`.
**Object** (compared by reference): objects, arrays, functions, dates, maps…

```js
typeof 'a'        // 'string'
typeof 42         // 'number'
typeof 10n        // 'bigint'
typeof undefined  // 'undefined'
typeof null       // 'object'  ← historical bug
typeof []         // 'object'  → use Array.isArray
typeof function(){} // 'function'
```

### `null` vs `undefined`
`undefined` = "not assigned yet" (default for missing values). `null` = "intentionally empty", set by the developer.

### Numbers
All numbers are IEEE-754 doubles: `0.1 + 0.2 === 0.30000000000000004`. Safe integers up to `2**53 - 1`; use `BigInt` beyond. `NaN !== NaN` — use `Number.isNaN()`.

## Operators, Equality and Type Coercion

### `==` vs `===`
`===` compares value **and** type with no conversion. `==` coerces types first.

```js
0 == ''          // true
0 == '0'         // true
'' == '0'        // false  (not transitive!)
null == undefined // true
null === undefined // false
[] == false      // true
NaN == NaN       // false
```
Always use `===` (the one acceptable `==` is `x == null` to check both null and undefined).

### Truthy and falsy
Falsy: `false, 0, -0, 0n, '', null, undefined, NaN`. **Everything else is truthy**, including `'0'`, `'false'`, `[]`, `{}`.

### Modern operators
```js
const port = config.port ?? 3000;     // nullish coalescing: only null/undefined fall back
const n = 0 || 10;                    // 10 (|| treats 0 as falsy)
const m = 0 ?? 10;                    // 0
const city = user?.address?.city;     // optional chaining
user.settings ??= {};                 // logical assignment
```

### Implicit conversions
```js
'5' + 1   // '51'   + with a string concatenates
'5' - 1   // 4      other math operators convert to number
+'42'     // 42
[] + {}   // '[object Object]'
```

## Functions

```js
// Declaration — hoisted completely
function add(a, b) { return a + b; }

// Expression — not hoisted (variable is)
const sub = function (a, b) { return a - b; };

// Arrow — concise, lexical `this`, no `arguments`, cannot be `new`ed
const mul = (a, b) => a * b;

// Defaults, rest, spread
function greet(name = 'guest', ...tags) { return `${name} ${tags.join(',')}`; }
greet(...['Asha', 'admin', 'dev']);
```

### Functions are first-class
They can be stored in variables, passed as arguments and returned — enabling **higher-order functions** like `map`, `filter`, `reduce`, and callbacks.

### Pure functions
Same input → same output, no side effects. Easy to test and reason about; the foundation of React reducers and Redux.

## Arrays and Objects

### Essential array methods

| Method | Returns | Mutates? |
|---|---|---|
| `map(fn)` | new array of transformed items | no |
| `filter(fn)` | new array of matching items | no |
| `reduce(fn, init)` | single accumulated value | no |
| `find` / `findIndex` / `findLast` | first match / index | no |
| `some` / `every` | boolean | no |
| `includes` | boolean | no |
| `slice(a, b)` | copy of a portion | no |
| `splice(i, n, ...items)` | removed items | **yes** |
| `push/pop/shift/unshift` | length / item | **yes** |
| `sort`, `reverse` | same array | **yes** — use `toSorted()`, `toReversed()` |
| `flat`, `flatMap` | new array | no |

```js
const orders = [{ total: 40, paid: true }, { total: 60, paid: false }, { total: 25, paid: true }];
const revenue = orders.filter(o => o.paid).reduce((sum, o) => sum + o.total, 0); // 65
```

> [!WARN]
> `[10, 1, 3].sort()` → `[1, 10, 3]` — default sort is lexicographic. Use `sort((a, b) => a - b)`.

### Objects
```js
const user = { name: 'Asha', age: 30, ['dynamic' + 1]: true };
const { name, age: years, role = 'user' } = user;        // destructuring
const copy = { ...user, age: 31 };                        // shallow copy + override
Object.keys(user); Object.values(user); Object.entries(user);
Object.fromEntries([['a', 1]]);
structuredClone(user);                                    // deep copy
```

## The DOM and Events

```js
const btn = document.querySelector('#save');
const items = document.querySelectorAll('.item'); // static NodeList

btn.addEventListener('click', (event) => {
  event.preventDefault();          // stop default (form submit, link nav)
  const li = document.createElement('li');
  li.textContent = 'New item';     // safe — never innerHTML with user input
  list.append(li);
  btn.classList.toggle('active');
});
```

### Event propagation
1. **Capture** phase: window → target.
2. **Target** phase.
3. **Bubble** phase: target → window (default listener phase).

`event.stopPropagation()` stops travel; `event.target` is the element that was clicked, `event.currentTarget` is the element the listener is attached to.

### Event delegation
Attach one listener to a parent instead of many to children — works for dynamically added items and uses less memory.
```js
list.addEventListener('click', (e) => {
  const item = e.target.closest('li[data-id]');
  if (item) remove(item.dataset.id);
});
```

# Intermediate

## Scope, Hoisting and Closures

### Scope
JavaScript has **lexical scope**: where a function is *written* determines what variables it can see. Scopes: global, module, function, block.

### Hoisting
Declarations are processed before execution:
```js
console.log(a); // undefined  (var hoisted & initialised)
console.log(b); // ReferenceError (TDZ)
var a = 1; let b = 2;

hello();        // works — function declarations hoist fully
function hello() {}
```

### Closures
A closure is a function bundled with references to the variables of the scope it was created in — it "remembers" them even after the outer function returns.

```js
function createCounter() {
  let count = 0;                     // private state
  return {
    increment: () => ++count,
    get: () => count,
  };
}
const c = createCounter();
c.increment(); c.increment();
c.get(); // 2 — `count` is not accessible any other way
```

Uses: data privacy, factories, memoization, partial application/currying, event handlers, React hooks.

### The classic loop question
```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i));  // 3 3 3
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i));  // 0 1 2
```
`var` creates one shared binding; `let` creates a new binding per iteration.

## The `this` Keyword

`this` is determined by **how a function is called**, not where it's defined (except arrow functions).

| Call style | `this` |
|---|---|
| `obj.method()` | `obj` (implicit binding) |
| `fn()` | `undefined` in strict mode / modules, `globalThis` in sloppy mode |
| `fn.call(x, a)` / `fn.apply(x, [a])` | `x` (explicit) |
| `fn.bind(x)` | new function permanently bound to `x` |
| `new Fn()` | the newly created object |
| arrow function | inherited from the enclosing scope (lexical) |

```js
const user = {
  name: 'Asha',
  regular() { return this?.name; },
  arrow: () => this?.name,          // `this` of module scope → undefined
  delayed() { setTimeout(() => console.log(this.name), 0); }, // arrow keeps `this`
};
const f = user.regular;
f();             // undefined — lost binding
user.regular();  // 'Asha'
```

Priority: `new` > `bind/call/apply` > method call > default.

## Prototypes and Classes

Every object has an internal `[[Prototype]]` link. Property lookup walks the **prototype chain** until found or `null`.

```js
const animal = { speak() { return `${this.name} makes a sound`; } };
const dog = Object.create(animal);
dog.name = 'Rex';
dog.speak(); // found on the prototype
```

### Classes are syntax over prototypes
```js
class Animal {
  #secret = 'hidden';          // truly private field
  static kingdom = 'Animalia';
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
  get upper() { return this.name.toUpperCase(); }
}
class Dog extends Animal {
  speak() { return `${super.speak()} — woof`; }
}
new Dog('Rex').speak();
Object.getPrototypeOf(Dog.prototype) === Animal.prototype; // true
```

- Methods live on `Class.prototype` (shared), fields live on each instance.
- `__proto__` (accessor on an instance) vs `.prototype` (property on constructor functions).

## Asynchronous JavaScript: Callbacks, Promises, async/await

### Callbacks → callback hell
```js
getUser(id, (err, user) => {
  getOrders(user, (err, orders) => { /* nesting grows… */ });
});
```

### Promises
A promise is a placeholder for a future value: **pending → fulfilled | rejected** (settled once).
```js
fetch('/api/user')
  .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
  .then(user => console.log(user))
  .catch(err => console.error(err))
  .finally(() => hideSpinner());
```

### async/await
```js
async function loadDashboard(id) {
  try {
    const user = await getUser(id);
    // run independent requests in parallel!
    const [orders, notifications] = await Promise.all([getOrders(user.id), getNotifications(user.id)]);
    return { user, orders, notifications };
  } catch (err) {
    log(err);
    throw err;
  }
}
```

### Combinators

| | Resolves when | Rejects when |
|---|---|---|
| `Promise.all` | all fulfil (array of values) | **any** rejects (fail-fast) |
| `Promise.allSettled` | all settle (array of `{status, value/reason}`) | never |
| `Promise.race` | first to **settle** | first settles with rejection |
| `Promise.any` | first to **fulfil** | all reject (`AggregateError`) |

> [!WARN]
> `await` inside `forEach` does not wait. Use `for...of` (sequential) or `Promise.all(items.map(...))` (parallel).

## The Event Loop

JavaScript runs on a **single thread** with a call stack. Asynchronous work is delegated to the host (browser Web APIs / Node's libuv) and callbacks are queued.

1. Run the current synchronous code until the **call stack** is empty.
2. Drain the **microtask queue** completely (promise callbacks, `queueMicrotask`, `MutationObserver`).
3. Browser may **render** (rAF callbacks run before paint).
4. Take **one macrotask** (setTimeout, setInterval, I/O, UI events, MessageChannel) and repeat.

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
queueMicrotask(() => console.log('4'));
(async () => { console.log('5'); await null; console.log('6'); })();
console.log('7');
// 1 5 7 3 4 6 2
```

Why: synchronous logs first (1, 5, 7) — the async function body runs synchronously until its first `await`. Then microtasks in order queued (3, 4, 6). Finally the timer macrotask (2).

> [!INTERVIEW]
> A long-running microtask chain can starve rendering — microtasks always run before the next frame.

## Modules and Modern Syntax

### ES Modules
```js
// math.js
export const PI = 3.14;
export default function area(r) { return PI * r * r; }
// app.js
import area, { PI } from './math.js';
const { heavy } = await import('./heavy.js'); // dynamic import → code splitting
```

| ESM | CommonJS |
|---|---|
| `import` / `export` | `require` / `module.exports` |
| static, analysable → tree-shaking | dynamic, evaluated at runtime |
| async loading, live bindings | sync loading, copies of values |
| strict mode by default, top-level `await` | — |

### Other ES2015+ essentials
Template literals, destructuring, spread/rest, `Map`/`Set`, `WeakMap`/`WeakRef`, `Symbol`, iterators/generators, `Array.prototype.at`, `Object.groupBy`, `structuredClone`, optional chaining, nullish coalescing, private class fields, top-level await.

# Advanced

## Execution Context and Memory

### Execution context
Each function call creates a context with: a **variable environment**, the **lexical environment** (scope chain) and a **`this` binding**. Creation phase (hoisting) happens before the execution phase.

### Memory management
JS uses **garbage collection** with a mark-and-sweep algorithm: objects not reachable from roots (globals, the stack) are freed. V8 uses generational GC (young generation scavenger + old generation mark-compact).

### Common memory leaks
- Forgotten timers/intervals and event listeners (remove them in cleanup).
- Closures capturing large objects.
- Detached DOM nodes still referenced from JS.
- Growing global caches → use `WeakMap`/`WeakRef` or LRU limits.

```js
const cache = new WeakMap();   // keys are weakly held — entry disappears with the object
function meta(el) {
  if (!cache.has(el)) cache.set(el, compute(el));
  return cache.get(el);
}
```

## Functional Patterns: Debounce, Throttle, Currying, Memoize

### Debounce — run after the user stops
```js
function debounce(fn, wait = 300) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}
input.addEventListener('input', debounce(e => search(e.target.value)));
```

### Throttle — run at most once per interval
```js
function throttle(fn, wait = 200) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) { last = now; fn.apply(this, args); }
  };
}
window.addEventListener('scroll', throttle(onScroll, 100));
```

### Currying
```js
const curry = fn => function curried(...args) {
  return args.length >= fn.length ? fn.apply(this, args) : (...more) => curried.apply(this, [...args, ...more]);
};
const add3 = curry((a, b, c) => a + b + c);
add3(1)(2)(3); add3(1, 2)(3); // 6
```

### Memoize
```js
const memo = fn => {
  const cache = new Map();
  return arg => cache.has(arg) ? cache.get(arg) : (cache.set(arg, fn(arg)), cache.get(arg));
};
```

## Polyfills You Should Be Able to Write

### `Function.prototype.bind`
```js
Function.prototype.myBind = function (ctx, ...preset) {
  const fn = this;
  return function bound(...args) {
    return new.target ? new fn(...preset, ...args) : fn.apply(ctx, [...preset, ...args]);
  };
};
```

### `Array.prototype.map` / `reduce`
```js
Array.prototype.myMap = function (cb, thisArg) {
  const out = [];
  for (let i = 0; i < this.length; i++) if (i in this) out[i] = cb.call(thisArg, this[i], i, this);
  return out;
};
Array.prototype.myReduce = function (cb, init) {
  let i = 0, acc = init;
  if (arguments.length < 2) { if (!this.length) throw new TypeError('Reduce of empty array'); acc = this[i++]; }
  for (; i < this.length; i++) acc = cb(acc, this[i], i, this);
  return acc;
};
```

### `Promise.all`
```js
function promiseAll(items) {
  return new Promise((resolve, reject) => {
    const results = []; let done = 0;
    if (!items.length) return resolve(results);
    items.forEach((p, i) => Promise.resolve(p).then(v => {
      results[i] = v;
      if (++done === items.length) resolve(results);
    }, reject));
  });
}
```

### Deep clone (handles cycles)
```js
function deepClone(obj, seen = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return seen.get(obj);
  const out = Array.isArray(obj) ? [] : Object.create(Object.getPrototypeOf(obj));
  seen.set(obj, out);
  for (const key of Reflect.ownKeys(obj)) out[key] = deepClone(obj[key], seen);
  return out;
}
```

### Flatten an array
```js
const flatten = (arr, depth = Infinity) =>
  arr.reduce((acc, x) => acc.concat(Array.isArray(x) && depth > 0 ? flatten(x, depth - 1) : x), []);
```

### Event emitter
```js
class Emitter {
  #events = new Map();
  on(evt, fn) { (this.#events.get(evt) ?? this.#events.set(evt, new Set()).get(evt)).add(fn); return () => this.off(evt, fn); }
  off(evt, fn) { this.#events.get(evt)?.delete(fn); }
  emit(evt, ...args) { this.#events.get(evt)?.forEach(fn => fn(...args)); }
  once(evt, fn) { const off = this.on(evt, (...a) => { off(); fn(...a); }); }
}
```

## Generators, Iterators, Proxies and Reflect

### Iteration protocol
An object is iterable if it has `[Symbol.iterator]()` returning `{ next() → { value, done } }`. `for...of`, spread and destructuring use it.

```js
function* idGen() { let id = 1; while (true) yield id++; }
const ids = idGen(); ids.next().value; // 1

const range = { from: 1, to: 3, *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; } };
[...range]; // [1, 2, 3]

for await (const chunk of stream) { /* async iteration */ }
```

### Proxy — intercept fundamental operations
```js
const validated = new Proxy({}, {
  set(target, key, value) {
    if (key === 'age' && !Number.isInteger(value)) throw new TypeError('age must be int');
    return Reflect.set(target, key, value);
  },
});
```
Vue 3's reactivity is built on Proxy. `Reflect` provides the default behaviour for each trap.

## Concurrency: Web Workers, AbortController and Performance

- **Web Workers** run JS on another thread (no DOM access); communicate with `postMessage` (structured clone) or transfer `ArrayBuffer`s. `SharedArrayBuffer` + `Atomics` for shared memory.
- **AbortController** cancels fetches and listeners:
```js
const ctrl = new AbortController();
fetch(url, { signal: ctrl.signal }).catch(e => { if (e.name === 'AbortError') return; throw e; });
ctrl.abort();
// also: AbortSignal.timeout(5000)
```
- **requestAnimationFrame** for visual updates; **requestIdleCallback** for low-priority work; `scheduler.yield()` to break up long tasks.
- **Race conditions** in UI: cancel stale requests or ignore responses that don't match the latest query.

## Tricky Output Questions

```js
// 1. Hoisting + shadowing
var x = 1;
function f() { console.log(x); var x = 2; }
f();                        // undefined

// 2. Object keys are strings
const a = {}, b = { k: 'b' }, c = { k: 'c' };
a[b] = 123; a[c] = 456;
console.log(a[b]);          // 456 — both keys become '[object Object]'

// 3. Closures in loops with var
const fns = [];
for (var i = 0; i < 3; i++) fns.push(() => i);
fns.map(f => f());          // [3, 3, 3]

// 4. this in callbacks
const obj = { n: 1, get() { return [1].map(function () { return this?.n; }); } };
obj.get();                  // [undefined]

// 5. Promise vs setTimeout ordering
setTimeout(() => console.log('t'));
Promise.resolve().then(() => console.log('p1')).then(() => console.log('p2'));
console.log('s');           // s p1 p2 t

// 6. typeof quirks
typeof NaN;                 // 'number'
[1, 2, 3] + [4];            // '1,2,34'
0.1 + 0.2 === 0.3;          // false
```

# Interview Questions

## Beginner

### What are the differences between `var`, `let` and `const`?
`var` is function-scoped, hoisted and initialised to `undefined`, and can be redeclared. `let`/`const` are block-scoped, hoisted but inaccessible before declaration (Temporal Dead Zone), and cannot be redeclared. `const` cannot be reassigned, though the object it refers to can still be mutated.

```js
function demo() {
  if (true) { var a = 1; let b = 2; const c = 3; }
  console.log(a);        // 1 — var is function-scoped
  // console.log(b);     // ReferenceError — block-scoped
}
const user = { name: 'Ada' };
user.name = 'Grace';     // ✅ const prevents reassignment, not mutation
// user = {};            // ❌ TypeError
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i)); // 3 3 3
for (let j = 0; j < 3; j++) setTimeout(() => console.log(j)); // 0 1 2
```

### What is the difference between `==` and `===`?
`===` is strict equality: no type conversion, so types must match. `==` performs type coercion before comparing (`'1' == 1` is true). Prefer `===` to avoid surprises; `x == null` is the common exception (matches null and undefined).

```js
'1' == 1;            // true  (string → number)
'1' === 1;           // false
0 == '';             // true
null == undefined;   // true  — the one useful == case:
if (value == null) { /* null OR undefined */ }
[] == false;         // true  ([] → '' → 0)
NaN === NaN;         // false → use Number.isNaN(x)
```

### What are the primitive types in JavaScript?
`string`, `number`, `bigint`, `boolean`, `undefined`, `null`, `symbol`. Primitives are immutable and compared by value; everything else is an object compared by reference.

```js
typeof 'hi';        // 'string'
typeof 42;          // 'number'
typeof 10n;         // 'bigint'
typeof true;        // 'boolean'
typeof undefined;   // 'undefined'
typeof Symbol('id');// 'symbol'
typeof null;        // 'object' (legacy bug)
let s = 'abc'; s[0] = 'z'; console.log(s); // 'abc' — primitives are immutable
({}) === ({});      // false — objects compare by reference
```

### What is the difference between `null` and `undefined`?
`undefined` means a variable has been declared but not assigned (or a property/argument doesn't exist). `null` is an intentional "no value" assigned by the developer. `typeof null` is `'object'` due to a legacy bug.

```js
let x;                 console.log(x);            // undefined (not assigned)
const o = {};          console.log(o.missing);    // undefined
function f(a) { return a; }  f();                 // undefined
let selected = null;   // explicit "nothing selected"
JSON.stringify({ a: undefined, b: null });        // '{"b":null}'
const port = config.port ?? 3000;                 // ?? only falls back for null/undefined
```

### What are truthy and falsy values?
Falsy values: `false`, `0`, `-0`, `0n`, `''`, `null`, `undefined`, `NaN`. Everything else is truthy — including `'0'`, `[]` and `{}`.

```js
const falsy = [false, 0, -0, 0n, '', null, undefined, NaN];
falsy.every((v) => !v);           // true
Boolean('0'); Boolean([]); Boolean({}); // true true true

const count = 0;
console.log(count || 10);  // 10  — 0 is falsy (often a bug)
console.log(count ?? 10);  // 0   — ?? keeps 0 and ''
```

### Explain arrow functions vs regular functions.
Arrow functions have a concise syntax, no own `this` (they capture it lexically), no `arguments`, no `prototype`, and can't be used with `new`. Use them for callbacks; use regular functions/methods when you need dynamic `this` or a constructor.

```js
const timer = {
  seconds: 0,
  start() {
    setInterval(() => this.seconds++, 1000);          // ✅ arrow captures `this`
    // setInterval(function () { this.seconds++ });   // ❌ `this` is undefined/global
  },
};
const add = (a, b) => a + b;              // implicit return
const toObj = (id) => ({ id });           // wrap object literals in ()
function legacy() { return arguments.length; } // arrows have no `arguments`
// new add();                             // TypeError: not a constructor
```

### What is event bubbling and event delegation?
Events fire on the target and then propagate up through its ancestors (bubbling). Delegation exploits this: attach one listener to a common parent and use `event.target.closest()` to identify the child. It reduces listeners and handles dynamically added elements.

```js
// One listener handles all current AND future <li> elements
document.querySelector('#todo-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button.delete');
  if (!btn) return;
  btn.closest('li').remove();
});
child.addEventListener('click', (e) => e.stopPropagation()); // stop bubbling
parent.addEventListener('click', handler, { capture: true }); // capture phase
```

### `map` vs `forEach`?
`map` returns a new array of transformed values and is chainable. `forEach` returns `undefined` and is used for side effects. Neither can be stopped early (use `for...of`, `some`, or `find` for that).

```js
const prices = [10, 20, 30];
const withTax = prices.map((p) => p * 1.2);    // [12, 24, 36]
const r = prices.forEach((p) => console.log(p)); // r === undefined
for (const p of prices) { if (p > 15) break; }   // need early exit? use for...of
prices.some((p) => p > 15);                      // or some/find
```

### What is the spread operator vs rest parameters?
Same `...` syntax, opposite roles. Spread **expands** an iterable/object into elements (`[...a, ...b]`, `{...obj}`, `fn(...args)`). Rest **collects** remaining items into an array/object (`function f(...args)`, `const {a, ...others} = obj`).

```js
const a = [1, 2], b = [3];
const all = [...a, ...b];                  // spread → [1, 2, 3]
const merged = { ...defaults, ...opts };   // later keys win
Math.max(...all);                          // spread into args

function sum(first, ...rest) {             // rest → array
  return rest.reduce((s, n) => s + n, first);
}
const { password, ...safeUser } = user;    // rest in destructuring
```

### How do you deep copy an object?
`structuredClone(obj)` handles nested objects, arrays, Maps, Sets, Dates and cycles (not functions or DOM nodes). `JSON.parse(JSON.stringify(obj))` loses `undefined`, functions, Dates (become strings), and fails on cycles. Spread/`Object.assign` are shallow.

```js
const original = { date: new Date(), tags: new Set(['a']), nested: { n: 1 } };
const copy = structuredClone(original);
copy.nested.n = 2;  console.log(original.nested.n); // 1

const shallow = { ...original };  shallow.nested.n = 99; // ❌ mutates original.nested
JSON.parse(JSON.stringify(original)).date;  // string, Set → {} — lossy
```

## Intermediate

### What is a closure? Give a practical example.
A function that retains access to variables from its lexical scope after that scope has finished executing. Examples: private state in a counter factory, `debounce` keeping a timer id, memoization caches, React hooks capturing props/state. Watch out for stale closures and accidental memory retention.

```js
function createCounter() {
  let count = 0;                       // private
  return { inc: () => ++count, get: () => count };
}
const c = createCounter(); c.inc(); c.inc(); c.get(); // 2

function debounce(fn, ms) {
  let id;                              // remembered between calls
  return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
}
```

### Explain hoisting.
Before code runs, declarations are registered in their scope. Function declarations are fully hoisted (callable before definition). `var` is hoisted and initialised to `undefined`. `let`, `const` and `class` are hoisted but remain in the Temporal Dead Zone until their declaration line executes.

```js
greet();                         // ✅ "hi" — function declarations are fully hoisted
function greet() { console.log('hi'); }

console.log(v);                  // undefined — var hoisted & initialised
var v = 1;

console.log(l);                  // ❌ ReferenceError (TDZ)
let l = 1;

sayBye();                        // ❌ TypeError: sayBye is not a function
var sayBye = () => console.log('bye');
```

### How does `this` work?
Determined at call time: `new` binds to the new object; `call/apply/bind` bind explicitly; `obj.method()` binds to `obj`; a plain call gets `undefined` (strict) or the global object. Arrow functions don't have their own `this` — they use the surrounding scope's.

```js
const user = { name: 'Ada', hi() { return this.name; } };
user.hi();                 // 'Ada'      — method call
const fn = user.hi; fn();  // undefined  — plain call loses `this`
fn.call({ name: 'Bob' });  // 'Bob'      — explicit
const bound = user.hi.bind(user); bound(); // 'Ada'
function Person(n) { this.n = n; } new Person('Z'); // `this` = new object
const arrow = { name: 'X', f: () => this }; // arrow: lexical this (module/global)
```

### Explain the event loop.
JS executes synchronous code on a single call stack. Async operations are handled by the environment, which queues callbacks. When the stack is empty, the loop drains all **microtasks** (promise reactions, queueMicrotask), optionally renders, then runs one **macrotask** (timers, I/O, events), and repeats. That's why promise callbacks run before `setTimeout(…, 0)`.

```js
console.log('1 sync');
setTimeout(() => console.log('4 macrotask'), 0);
Promise.resolve().then(() => console.log('3 microtask'));
console.log('2 sync');
// 1 sync → 2 sync → 3 microtask → 4 macrotask
```

### What is the difference between microtasks and macrotasks?
Microtasks (promise `.then`, `await` continuations, `queueMicrotask`, MutationObserver) run immediately after the current script, and the entire queue is drained before anything else — including rendering. Macrotasks (setTimeout, setInterval, I/O, UI events) run one per loop iteration.

```js
setTimeout(() => console.log('timeout'));
queueMicrotask(() => {
  console.log('micro 1');
  Promise.resolve().then(() => console.log('micro 2')); // still before timeout
});
(async () => { await null; console.log('await continuation'); })();
// micro 1, await continuation, micro 2, timeout
```

### What is prototypal inheritance?
Objects inherit directly from other objects via an internal `[[Prototype]]` link. Property access walks up the chain. Classes are syntactic sugar: methods are placed on `Constructor.prototype`, and `extends` links the prototypes.

```js
const animal = { speak() { return `${this.name} makes a sound`; } };
const dog = Object.create(animal);   // dog.[[Prototype]] = animal
dog.name = 'Rex';
dog.speak();                          // found on the prototype

class Cat { meow() {} }
Object.getPrototypeOf(new Cat()) === Cat.prototype; // true — classes are sugar
dog.hasOwnProperty('speak');          // false
```

### `call`, `apply` and `bind`?
All set `this`. `call(thisArg, a, b)` invokes immediately with individual args; `apply(thisArg, [a, b])` invokes with an array; `bind(thisArg, a)` returns a new function with `this` (and optionally args) permanently bound.

```js
function intro(greeting, punct) { return `${greeting}, I'm ${this.name}${punct}`; }
const ada = { name: 'Ada' };
intro.call(ada, 'Hi', '!');       // individual args
intro.apply(ada, ['Hi', '!']);    // array of args
const hiAda = intro.bind(ada, 'Hi'); // new function, partially applied
hiAda('?');                         // "Hi, I'm Ada?"
```

### `Promise.all` vs `allSettled` vs `race` vs `any`?
`all`: resolves with all values, rejects on the first rejection. `allSettled`: waits for all, never rejects, returns statuses. `race`: settles with the first promise to settle (either way). `any`: resolves with the first fulfilment, rejects only if all reject (`AggregateError`).

```js
const fast = new Promise((r) => setTimeout(() => r('fast'), 100));
const slow = new Promise((r) => setTimeout(() => r('slow'), 500));
const fail = Promise.reject(new Error('boom'));

await Promise.all([fast, slow]);          // ['fast', 'slow']
await Promise.all([fast, fail]);          // throws boom
await Promise.allSettled([fast, fail]);   // [{status:'fulfilled',value:'fast'},{status:'rejected',reason}]
await Promise.race([slow, fast]);         // 'fast'
await Promise.any([fail, slow]);          // 'slow' (first success)
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
await Promise.race([fetch('/api'), timeout(3000)]);
```

### How do you handle errors with async/await?
Wrap awaits in `try/catch` (and `finally` for cleanup), or attach `.catch()` to the returned promise. Handle unhandled rejections globally (`unhandledrejection` event / `process.on('unhandledRejection')`). For parallel work, use `Promise.allSettled` when partial failure is acceptable.

```js
async function loadUser(id) {
  const ctrl = new AbortController();
  try {
    const res = await fetch(`/api/users/${id}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // fetch doesn't throw on 4xx/5xx
    return await res.json();
  } catch (err) {
    console.error('loadUser failed', err);
    throw err;                   // rethrow or return a fallback
  } finally {
    spinner.hide();
  }
}
window.addEventListener('unhandledrejection', (e) => report(e.reason));
```

### What are ES modules and how do they differ from CommonJS?
ESM uses static `import/export`, loads asynchronously, supports live bindings, top-level await and tree-shaking, and runs in strict mode. CommonJS uses `require`/`module.exports`, loads synchronously at runtime and exports a value copy. Node supports both (`"type": "module"` or `.mjs`).

```js
// ESM — math.mjs
export let count = 0;
export const inc = () => count++;
// main.mjs
import { count, inc } from './math.mjs';
inc(); console.log(count);        // 1 — live binding
const { default: lib } = await import('./lib.mjs'); // dynamic + top-level await

// CommonJS — math.cjs
let n = 0; module.exports = { n, inc: () => n++ };
const m = require('./math.cjs'); m.inc(); console.log(m.n); // 0 — copied value
```

### What is debouncing vs throttling?
Debounce delays execution until events stop for N ms (search-as-you-type, resize end). Throttle guarantees execution at most once every N ms during continuous events (scroll, mousemove). Both limit expensive handlers.

```js
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function throttle(fn, ms) {
  let last = 0;
  return (...a) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...a); } };
}
searchInput.addEventListener('input', debounce((e) => search(e.target.value), 300));
window.addEventListener('scroll', throttle(updateProgressBar, 100));
```

### What are `Map` and `Set` and when are they better than objects/arrays?
`Map` allows any key type, preserves insertion order, has `size`, and is optimised for frequent add/delete. `Set` stores unique values with O(1) `has`. Use them for lookups, deduplication (`[...new Set(arr)]`), and caches. `WeakMap`/`WeakSet` hold keys weakly for GC-friendly metadata.

```js
const visits = new Map();
const el = document.body;
visits.set(el, 1);                       // any key type, even objects
visits.set('home', 3).size;              // 2
for (const [k, v] of visits) {}          // insertion order

const ids = [3, 1, 3, 2, 1];
const unique = [...new Set(ids)];        // [3, 1, 2]
const seen = new Set(); seen.has(3);     // O(1) membership vs array.includes O(n)
```

## Advanced

### Implement `debounce` and explain a use case.
```js
function debounce(fn, ms) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}
```
Each call resets the timer, so `fn` runs only after `ms` of silence — e.g., hitting a search API only when the user stops typing. Variants add `leading` execution and `cancel`/`flush`.

### Predict the output: setTimeout, Promise, async/await.
```js
async function a() { console.log('a1'); await b(); console.log('a2'); }
async function b() { console.log('b'); }
console.log('start');
setTimeout(() => console.log('timeout'), 0);
a();
new Promise(r => { console.log('p'); r(); }).then(() => console.log('then'));
console.log('end');
```
Output: `start, a1, b, p, end, a2, then, timeout`. Synchronous code runs first (promise executors are synchronous), then microtasks in queue order, then the timer.

### How does garbage collection work and what causes memory leaks?
Engines use reachability: mark everything reachable from roots, sweep the rest (V8 adds generational collection and compaction). Leaks happen when unneeded objects stay reachable: global variables, uncleared intervals, listeners never removed, closures holding big data, detached DOM nodes, unbounded caches. Diagnose with heap snapshots in DevTools.

```js
// Leak 1: forgotten listener keeps `bigData` reachable
function mount() {
  const bigData = new Array(1e6).fill('x');
  const onResize = () => console.log(bigData.length);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize); // ✅ cleanup
}
// Leak 2: unbounded cache → use WeakMap so entries die with the key
const meta = new WeakMap();
meta.set(domNode, { clicks: 0 });
// Leak 3: setInterval never cleared → clearInterval(id)
```

### Write a polyfill for `Promise.all`.
Create a new promise; track a results array and a counter. For each input, `Promise.resolve(item).then(value => { results[i] = value; if (++count === n) resolve(results); }, reject)`. Resolve immediately for an empty array. Preserve order by index, not completion order.

```js
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let done = 0;
    if (items.length === 0) return resolve(results);
    items.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;                 // keep input order
        if (++done === items.length) resolve(results);
      }, reject);                           // first rejection wins
    });
  });
}
```

### What is the Temporal Dead Zone?
The period between entering a scope and the execution of a `let`/`const`/`class` declaration. The binding exists (hoisted) but accessing it throws a `ReferenceError`. It catches use-before-define bugs, and `typeof` is not safe within it.

```js
{
  // TDZ for `x` starts here
  console.log(typeof x);   // ❌ ReferenceError (even typeof!)
  let x = 5;               // TDZ ends
}
function f(a = b, b = 1) {} f(); // ReferenceError: b used before init
```

### What are generators and where are they useful?
Functions (`function*`) that can pause with `yield` and resume via `next()`, returning an iterator. Use cases: lazy/infinite sequences, custom iterables, cooperative scheduling, and historically async flow control (redux-saga, co). Async generators (`async function*`) model streams consumed with `for await`.

```js
function* ids() { let i = 1; while (true) yield i++; }
const gen = ids();
gen.next().value; gen.next().value;   // 1, 2 — lazy, infinite

function* take(iter, n) { for (const x of iter) { if (n-- <= 0) return; yield x; } }
[...take(ids(), 3)];                  // [1, 2, 3]

async function* pages(url) {          // async generator for pagination
  while (url) { const r = await (await fetch(url)).json(); yield r.items; url = r.next; }
}
for await (const items of pages('/api/orders')) render(items);
```

### What is a Proxy and how is it used in frameworks?
A wrapper object that intercepts operations (get, set, has, deleteProperty, apply…) via traps. Vue 3 and MobX use it for reactivity: `get` tracks dependencies, `set` triggers updates. Other uses: validation, logging, negative array indices, API clients.

```js
function reactive(target, onChange) {
  return new Proxy(target, {
    get(obj, key) { console.log('track', key); return Reflect.get(obj, key); },
    set(obj, key, value) { Reflect.set(obj, key, value); onChange(key, value); return true; },
  });
}
const state = reactive({ count: 0 }, (k, v) => render());
state.count++;   // logs "track count", then re-renders
```

### How do you prevent race conditions with fetch in UI code?
Cancel previous requests with `AbortController` when a new one starts, or track a request id and ignore stale responses. In React, use a cleanup flag in `useEffect` or a data library (React Query/SWR) that handles this. Also debounce rapid inputs.

```js
let controller;
async function search(q) {
  controller?.abort();                       // cancel the previous request
  controller = new AbortController();
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
    render(await res.json());
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  }
}
```

### Explain shallow vs deep equality and how React-like libraries use reference equality.
Shallow equality compares top-level properties with `===`; deep equality recursively compares nested values. Frameworks use cheap reference checks (`Object.is`) to detect changes — so state must be updated immutably (new object/array) for changes to be noticed.

```js
const shallowEqual = (a, b) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((k) => Object.is(a[k], b[k]));

const s1 = { user: { name: 'A' } };
const s2 = { ...s1 };
shallowEqual(s1, s2);          // true  — same nested reference
s2.user.name = 'B';            // ❌ mutation: React won't see a change
const s3 = { ...s1, user: { ...s1.user, name: 'B' } }; // ✅ new reference → re-render
```

### What is the difference between `Object.freeze`, `Object.seal` and `Object.preventExtensions`?
`preventExtensions`: no new properties. `seal`: no add/delete, but existing props are writable. `freeze`: no add/delete/modify — fully read-only. All are **shallow**; nested objects remain mutable unless frozen recursively.

```js
'use strict';
const a = Object.preventExtensions({ x: 1 }); a.x = 2; delete a.x; // ok; a.y = 1 ❌
const b = Object.seal({ x: 1 });   b.x = 2;      // ok; delete b.x ❌; b.y = 1 ❌
const c = Object.freeze({ x: 1, nested: { y: 1 } });
// c.x = 2 ❌ TypeError
c.nested.y = 2;                    // ✅ freeze is shallow
const deepFreeze = (o) => { Object.values(o).forEach((v) => typeof v === 'object' && v && deepFreeze(v)); return Object.freeze(o); };
```

# Scenario Questions

## Beginner

### A button's click handler fires twice on every click. How do you track down why?
Check where the listener is attached. The usual causes are:
- `addEventListener` runs on every render or route change without a matching `removeEventListener`, so listeners pile up.
- The handler sits on a parent and a child, and the event bubbles to both. Use `event.stopPropagation()`, or better, a single delegated listener.
- In React 18 dev, Strict Mode runs effects twice. Clean up in the effect's return function.

Confirm it in DevTools → Elements → **Event Listeners**, or with `getEventListeners(el)` in the Chrome console.

```js
// Bug: called on every render/route change
function render() { btn.addEventListener('click', save); }

// Fix 1: attach once, or remove first
btn.removeEventListener('click', save); btn.addEventListener('click', save);
// Fix 2: AbortController cleans up all listeners for a view
const ac = new AbortController();
btn.addEventListener('click', save, { signal: ac.signal });
onUnmount(() => ac.abort());
// DevTools: getEventListeners(btn) in the console lists attached handlers
```

### A user types "10" and "5" into two inputs and your total shows "105". What happened and how do you fix it?
`input.value` is always a string, so `+` concatenates. Convert explicitly, `Number(a) + Number(b)` or `parseFloat`, and check the result with `Number.isNaN` before you use it. For money, work in integer cents (or `Intl.NumberFormat` for display) so floating-point errors don't creep in.

```js
const a = document.querySelector('#a').value;  // "10"
const b = document.querySelector('#b').value;  // "5"
a + b;                                         // "105"
const total = Number(a) + Number(b);           // 15
if (Number.isNaN(total)) showError('Enter numbers');
document.querySelector('#a').valueAsNumber;    // 10 for <input type="number">
```

## Intermediate

### Your search box fires an API call on every keystroke and results arrive out of order. How do you fix it?
1. **Debounce** the input (about 300 ms) so a request goes out only after typing pauses.
2. **Cancel stale requests** with `AbortController`. Abort the previous request before you send the next one.
3. **Ignore late responses**: only render a response if it belongs to the latest query.

```js
let ctrl;
const search = debounce(async (q) => {
  ctrl?.abort();
  ctrl = new AbortController();
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
    render(await res.json());
  } catch (e) { if (e.name !== 'AbortError') throw e; }
}, 300);
```

### A single-page app gets slower the longer it stays open and memory keeps climbing. How do you investigate?
Take heap snapshots in DevTools → Memory: one snapshot, repeat the action (open and close a view), take another, then compare. Look for **detached DOM nodes** and objects whose count keeps growing. Common culprits:
- event listeners or `setInterval` never removed
- caches or `Map`s that grow forever (switch to `WeakMap` or an LRU)
- closures holding large objects
- third-party widgets that are never destroyed

Fix it by adding teardown logic (AbortController `signal` on listeners, clearing timers), then check that the heap returns to its baseline.

```js
// Typical culprit found in a heap snapshot: a global cache that only grows
const cache = new Map();
export function getRow(id) {
  if (!cache.has(id)) cache.set(id, fetchRow(id));
  return cache.get(id);
}
// Fix: bound it (LRU) or key it weakly
const MAX = 500;
function setBounded(k, v) { cache.set(k, v); if (cache.size > MAX) cache.delete(cache.keys().next().value); }
```

## Advanced

### You need to process a 200 MB CSV in the browser without freezing the UI. What's your approach?
- Read it as a **stream** (`file.stream()` plus `TextDecoderStream`) instead of `file.text()`, so the whole file never sits in memory.
- Parse in a **Web Worker** so the main thread stays responsive. Post progress messages back to the page.
- Use transferable objects (`ArrayBuffer`) to avoid copying data between threads.
- Batch results and render with virtualization.
- If you have to stay on the main thread, chunk the work and yield with `scheduler.yield()` or `setTimeout`.

```js worker.js
self.onmessage = async ({ data: file }) => {
  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  let buf = '', rows = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const lines = buf.split('\n'); buf = lines.pop();   // keep the partial line
    rows += lines.length;
    if (rows % 50000 < lines.length) self.postMessage({ progress: rows });
  }
  self.postMessage({ done: rows });
};
// main.js: new Worker('worker.js').postMessage(input.files[0]);
```

### Users report that a page shows another user's data for a split second after logout and login. What could cause it?
Usually it's cached state that survives the session change:
- a module-level singleton or store (Redux, a query cache) that isn't reset on logout
- an HTTP cache, or a service worker serving a cached authenticated response
- a request still in flight from the old session that resolves after the new login

Fixes: clear stores and query caches on logout, key caches by user id, abort in-flight requests, send `Cache-Control: no-store`/`private` on personal API responses, and make the service worker skip authenticated routes.

```js
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  queryClient.clear();               // React Query / SWR cache
  store.dispatch({ type: 'RESET' }); // root reducer returns initial state on RESET
  sessionStorage.clear();
  location.assign('/login');         // hard reload drops module-level singletons
}
// Server: Cache-Control: private, no-store on /api/me
```

# Tricky Questions

## Beginner

### What does this print? `console.log(typeof null, typeof NaN, typeof [], typeof function(){})`
`object number object function`. `typeof null === 'object'` is a historical bug in the language. `NaN` is a number. Arrays are objects, so use `Array.isArray` to detect them. Functions are the only callable objects and get their own `"function"` result.

```js
console.log(typeof null, typeof NaN, typeof [], typeof function () {});
// object number object function
Array.isArray([]);      // true — the right array check
value === null;         // the right null check
```

### What is the output? `console.log(0.1 + 0.2 === 0.3, [] + [], [] + {}, 1 + '2' - 1)`
- `false`: binary floating point gives `0.30000000000000004`. Compare with `Math.abs(a - b) < Number.EPSILON`.
- `""`: both arrays convert to empty strings.
- `"[object Object]"`: the object converts to that string.
- `11`: `1 + '2'` is `'12'`, then `-` forces numeric conversion, so `12 - 1 = 11`.

```js
console.log(0.1 + 0.2 === 0.3, [] + [], [] + {}, 1 + '2' - 1);
// false "" "[object Object]" 11
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON;  // true
(0.1 * 10 + 0.2 * 10) / 10;                  // 0.3 — or work in integer cents
```

### What does this print, and why?
```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);
for (let j = 0; j < 3; j++) setTimeout(() => console.log(j), 0);
```
`3 3 3` and then `0 1 2`. `var` is function-scoped, so all three callbacks share one `i`, which is `3` by the time they run. `let` creates a new binding on every iteration, so each callback captures its own `j`.

## Intermediate

### Predict the output order of this event-loop puzzle.
```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => {
  console.log('3');
  setTimeout(() => console.log('4'), 0);
}).then(() => console.log('5'));
queueMicrotask(() => console.log('6'));
(async () => {
  console.log('7');
  await null;
  console.log('8');
})();
console.log('9');
```
**Output: `1 7 9 3 6 8 5 2 4`**

1. Synchronous code runs first: `1`. The `setTimeout` queues macrotask **2**. The `.then` callback is queued as a microtask (**3**). `queueMicrotask` queues **6**. The async IIFE runs synchronously up to its first `await`, printing `7`, and `await null` queues its continuation (**8**) as a microtask. Then `9`.
2. The microtask queue drains in FIFO order: `3`, which also queues macrotask **4**. Once that `.then` resolves, the chained `.then` (**5**) joins the end of the queue. Then `6`, `8`, `5`.
3. Macrotasks run in order: `2`, then `4`.

Rules to remember: **sync → all microtasks (including ones queued while draining) → one macrotask → microtasks again**. `await` code is synchronous until the first `await`.

### What does this log?
```js
const obj = {
  name: 'A',
  regular() { return this?.name; },
  arrow: () => this?.name,
  delayed() { setTimeout(function () { console.log(this?.name); }, 0); },
};
const f = obj.regular;
console.log(obj.regular(), obj.arrow(), f());
obj.delayed();
```
Running as an ES module (strict mode, top-level `this` is `undefined`): `A undefined undefined`. The delayed log prints `undefined` in Node, where `this` is the Timeout object. In a browser `this` is `window`, so it prints `window.name`, usually an empty string. Arrow functions take `this` from the enclosing scope (the module here), not from the object. `f()` loses its receiver, so `this` is `undefined`. Without the `?.` it would throw a `TypeError`. The plain `function` passed to `setTimeout` never sees `obj` as `this`. Use an arrow function or `.bind(this)` to keep it.

### What is the output, and what is the bug?
```js
const nums = ['1', '7', '11'].map(parseInt);
console.log(nums);
```
`[1, NaN, 3]`. `map` passes `(value, index, array)`, so the calls are `parseInt('1', 0)` → 1 (radix 0 means auto), `parseInt('7', 1)` → NaN (radix 1 is invalid), and `parseInt('11', 2)` → 3 (binary). Fix it with `.map(Number)` or `.map((s) => parseInt(s, 10))`.

## Advanced

### What does this print?
```js
async function a() { console.log('a1'); await b(); console.log('a2'); }
async function b() { console.log('b'); }
console.log('start');
setTimeout(() => console.log('timeout'), 0);
a();
new Promise((r) => { console.log('p1'); r(); }).then(() => console.log('p2'));
console.log('end');
```
`start a1 b p1 end a2 p2 timeout`. `a()` runs synchronously: it prints `a1`, calls `b()` which prints `b`, and the `await` queues `a2` as a microtask. The Promise executor runs synchronously (`p1`) and its `.then` queues `p2` after `a2`. After `end`, the microtasks drain in order, then the timeout runs.

### Why does `[NaN].includes(NaN)` differ from `[NaN].indexOf(NaN)`, and what about `Object.is`?
`[NaN].includes(NaN)` is `true` because `includes` uses **SameValueZero**. `[NaN].indexOf(NaN)` is `-1` because `indexOf` uses `===`, and `NaN !== NaN`. `Object.is(NaN, NaN)` is `true` and `Object.is(0, -0)` is `false` (SameValue). `===` gives the opposite answer for both pairs.

```js
[NaN].includes(NaN);   // true  (SameValueZero)
[NaN].indexOf(NaN);    // -1    (===)
Object.is(NaN, NaN);   // true
Object.is(0, -0);      // false
[-0].includes(0);      // true
```
