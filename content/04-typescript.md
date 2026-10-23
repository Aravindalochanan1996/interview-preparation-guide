---
id: typescript
title: TypeScript
short: TypeScript
category: Web Foundations
order: 4
color: #3178c6
icon: TS
summary: Static typing for JavaScript — types, interfaces, generics, narrowing, utility, conditional and mapped types, and tsconfig.
---

# Beginner

## Why TypeScript?

TypeScript is a **typed superset of JavaScript** that compiles (transpiles) to plain JS. Types exist only at compile time — they are **erased** at runtime.

Benefits interviewers expect you to name:
- Catch bugs before running code (typos, wrong arguments, null access).
- Self-documenting APIs and excellent IDE autocomplete/refactoring.
- Safer large-scale refactors across teams.

```ts
function total(items: { price: number; qty: number }[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}
total([{ price: 10, qty: '2' }]); // ❌ Type 'string' is not assignable to type 'number'
```

Compile with `tsc`, or let a bundler (Vite/esbuild/SWC) strip types and run `tsc --noEmit` for type checking.

## Basic Types and Annotations

```ts
let name: string = 'Asha';
let age: number = 30;
let active: boolean = true;
let ids: number[] = [1, 2];          // or Array<number>
let pair: [string, number] = ['a', 1]; // tuple
let anything: any;                    // opts out of checking — avoid
let unknownVal: unknown;              // safe "any": must narrow before use
let nothing: void;                    // function returns nothing
function fail(msg: string): never { throw new Error(msg); } // never returns
```

### Type inference
You rarely need to annotate locals — TS infers them: `const count = 5` is type `5` (a literal), `let count = 5` is `number`. Annotate **function parameters and public return types**.

### Union and literal types
```ts
type Status = 'idle' | 'loading' | 'success' | 'error';
let s: Status = 'loading';
function format(id: string | number) { return String(id); }
```

### Optional and readonly
```ts
interface User {
  readonly id: number;
  name: string;
  email?: string;   // string | undefined
}
```

## Interfaces vs Type Aliases

```ts
interface Point { x: number; y: number; }
type PointT = { x: number; y: number };

interface Point3D extends Point { z: number; }
type Point3DT = PointT & { z: number };  // intersection
```

| | `interface` | `type` |
|---|---|---|
| Object shapes | ✅ | ✅ |
| Unions, primitives, tuples, mapped/conditional types | ❌ | ✅ |
| Declaration merging (reopen & add fields) | ✅ | ❌ |
| `extends` / `implements` | ✅ | via `&` (classes can implement object types) |

Common convention: `interface` for public object contracts (and libraries that users may augment), `type` for everything else. Consistency matters more than the choice.

## Functions and Classes in TypeScript

```ts
// optional & default params
function greet(name: string, greeting = 'Hello', suffix?: string): string {
  return `${greeting}, ${name}${suffix ?? ''}`;
}

// function type
type Comparator<T> = (a: T, b: T) => number;

// overloads
function parse(v: string): number;
function parse(v: number): string;
function parse(v: string | number) { return typeof v === 'string' ? Number(v) : String(v); }
```

### Classes
```ts
class Account {
  private balance = 0;          // compile-time privacy (use #balance for runtime)
  constructor(public readonly owner: string) {}  // parameter property
  deposit(amount: number): this { this.balance += amount; return this; }
  protected log() {}
}
abstract class Shape { abstract area(): number; }
class Circle extends Shape implements Serializable {
  constructor(private r: number) { super(); }
  area() { return Math.PI * this.r ** 2; }
  serialize() { return JSON.stringify({ r: this.r }); }
}
interface Serializable { serialize(): string; }
```

## Enums and Alternatives

```ts
enum Direction { Up, Down }          // numeric: Up = 0 — has reverse mapping
enum Role { Admin = 'ADMIN', User = 'USER' } // string enum
const enum Flag { A = 1 }            // inlined at compile time
```

Enums generate runtime objects. Many teams prefer **union types or `as const` objects**, which are zero-cost and work with plain strings:

```ts
const ROLE = { Admin: 'ADMIN', User: 'USER' } as const;
type Role = typeof ROLE[keyof typeof ROLE]; // 'ADMIN' | 'USER'
```

# Intermediate

## Generics

Generics let you write reusable code that preserves type information.

```ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }
first([1, 2]);        // number | undefined
first(['a']);         // string | undefined

interface ApiResponse<T> { data: T; error?: string; }
async function get<T>(url: string): Promise<ApiResponse<T>> {
  const res = await fetch(url);
  return res.json();
}
const { data } = await get<User[]>('/users');
```

### Constraints
```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; }
getProp({ id: 1, name: 'x' }, 'name'); // string
getProp({ id: 1 }, 'nope');            // ❌
```

### Defaults
`interface Box<T = string> { value: T }`.

## Narrowing and Type Guards

TypeScript narrows union types through control flow analysis.

```ts
function print(v: string | number | string[] | null) {
  if (v === null) return;                 // equality narrowing
  if (typeof v === 'string') v.toUpperCase();
  else if (Array.isArray(v)) v.join(',');
  else v.toFixed(2);
}
```

Other narrowing: `instanceof`, `in` operator (`'swim' in animal`), truthiness checks.

### Discriminated unions (most important pattern)
```ts
type Result =
  | { status: 'success'; data: string[] }
  | { status: 'error'; error: Error }
  | { status: 'loading' };

function render(r: Result) {
  switch (r.status) {
    case 'success': return r.data.length;
    case 'error': return r.error.message;
    case 'loading': return 'Loading…';
    default: { const _exhaustive: never = r; return _exhaustive; } // compile error if a case is missing
  }
}
```

### Custom type guards and assertion functions
```ts
function isUser(x: unknown): x is User {
  return typeof x === 'object' && x !== null && 'id' in x;
}
function assertDefined<T>(v: T): asserts v is NonNullable<T> {
  if (v == null) throw new Error('Missing value');
}
```

## Utility Types

| Utility | Result |
|---|---|
| `Partial<T>` | all properties optional |
| `Required<T>` | all properties required |
| `Readonly<T>` | all properties readonly |
| `Pick<T, 'a' \| 'b'>` | only those keys |
| `Omit<T, 'password'>` | all except those keys |
| `Record<K, V>` | object with keys K and values V |
| `Exclude<U, X>` / `Extract<U, X>` | filter a union |
| `NonNullable<T>` | remove `null`/`undefined` |
| `ReturnType<F>` / `Parameters<F>` | function return / param tuple |
| `Awaited<T>` | unwrap a Promise |
| `InstanceType<C>` | instance type of a class |

```ts
type UserUpdate = Partial<Omit<User, 'id'>>;
type PublicUser = Pick<User, 'id' | 'name'>;
type ByRole = Record<'admin' | 'user', User[]>;
type Data = Awaited<ReturnType<typeof fetchUsers>>;
```

## `keyof`, `typeof`, Indexed Access and `satisfies`

```ts
const config = { port: 3000, host: 'localhost' };
type Config = typeof config;            // { port: number; host: string }
type ConfigKey = keyof Config;          // 'port' | 'host'
type PortType = Config['port'];         // number

const routes = ['home', 'about'] as const;
type Route = typeof routes[number];     // 'home' | 'about'
```

### `satisfies` (TS 4.9+)
Validates a value against a type **without widening** its inferred type:
```ts
type Colors = Record<string, string | [number, number, number]>;
const palette = {
  red: [255, 0, 0],
  green: '#00ff00',
} satisfies Colors;
palette.green.toUpperCase(); // ✅ still known to be a string
```
With `: Colors` annotation you'd lose that and need narrowing.

### `as` assertions
`value as Type` tells the compiler "trust me" — no runtime check. Use sparingly; prefer narrowing. Non-null assertion `x!` is the same idea.

## Configuring a Project: tsconfig

```json tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "paths": { "@/*": ["./src/*"] },
    "outDir": "dist",
    "declaration": true
  },
  "include": ["src"]
}
```

`strict` enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictPropertyInitialization`, `useUnknownInCatchVariables` and more. **Always turn it on in new projects.**

### Declaration files
`.d.ts` files describe the types of JS code. Libraries ship them or get them from DefinitelyTyped (`npm i -D @types/lodash`). Module augmentation:
```ts
declare module 'express-serve-static-core' {
  interface Request { user?: { id: string } }
}
```

# Advanced

## Conditional Types and `infer`

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<'x'>;  // true

// Distributive over unions
type ToArray<T> = T extends any ? T[] : never;
type B = ToArray<string | number>; // string[] | number[]
type C = [string | number] extends [any] ? 1 : 0; // wrap in tuple to stop distribution

// infer extracts types
type MyReturnType<F> = F extends (...args: any[]) => infer R ? R : never;
type ElementOf<T> = T extends (infer E)[] ? E : never;
type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T;
```

## Mapped and Template Literal Types

```ts
// Re-implementing built-ins
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// Key remapping with `as`
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type UserGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }

// Filter keys by value type
type PickByType<T, V> = { [K in keyof T as T[K] extends V ? K : never]: T[K] };

// Template literal types
type EventName = `on${Capitalize<'click' | 'focus'>}`; // 'onClick' | 'onFocus'
type CssUnit = `${number}${'px' | 'rem' | '%'}`;
```

### DeepPartial / DeepReadonly
```ts
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
```

## Type System Theory: Structural Typing and Variance

### Structural typing
TS compares types by **shape**, not name ("duck typing"). Two unrelated interfaces with the same members are compatible.

```ts
interface Cat { name: string }
interface Dog { name: string }
const c: Cat = { name: 'Tom' };
const d: Dog = c; // ✅
```

**Excess property checks** apply only to fresh object literals: `const p: Point = { x: 1, y: 2, z: 3 }` errors, but passing a variable with extra props doesn't.

### Branded (nominal) types
```ts
type UserId = string & { readonly __brand: 'UserId' };
const toUserId = (s: string) => s as UserId;
function getUser(id: UserId) {}
getUser('abc');            // ❌
getUser(toUserId('abc'));  // ✅
```

### Variance
- **Covariant** (outputs): `Dog[]` assignable to `Animal[]`.
- **Contravariant** (function parameters under `strictFunctionTypes`): a `(a: Animal) => void` can be used where `(d: Dog) => void` is expected, not vice versa.
- Method-syntax parameters are **bivariant** (unsound legacy compromise).
- Explicit annotations: `interface Box<in out T>`.

### `any` vs `unknown` vs `never`
`any` disables checking (both top and bottom type). `unknown` is the safe top type — anything assigns to it, but you must narrow before use. `never` is the bottom type — no value; used for exhaustiveness and impossible branches.

## Runtime Validation and Type-Safe APIs

Types vanish at runtime, so **data crossing boundaries** (API responses, forms, env vars) must be validated.

```ts
import { z } from 'zod';
const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
});
type User = z.infer<typeof UserSchema>;       // single source of truth

const user = UserSchema.parse(await res.json()); // throws if invalid
```

Other end-to-end type-safety tools: **tRPC**, OpenAPI code generation, GraphQL Codegen, Prisma's generated client.

### Typing patterns for React/Angular/Node
```ts
// React
type ButtonProps = React.ComponentPropsWithoutRef<'button'> & { variant?: 'primary' | 'ghost' };
const [user, setUser] = useState<User | null>(null);

// Express
app.get('/users/:id', (req: Request<{ id: string }>, res: Response<User>) => {});

// Generic component
function List<T>({ items, render }: { items: T[]; render: (t: T) => React.ReactNode }) {}
```

## Decorators, Declaration Merging and Performance

### Decorators
Stage 3 ECMAScript decorators are supported from TS 5.0; Angular and NestJS still use the older `experimentalDecorators`.
```ts
function log(target: any, ctx: ClassMethodDecoratorContext) {
  return function (this: any, ...args: any[]) { console.log(`→ ${String(ctx.name)}`, args); return target.apply(this, args); };
}
class Service { @log save(x: number) {} }
```

### Declaration merging
Interfaces with the same name merge; namespaces merge with classes/functions/enums; module augmentation extends third-party types; `declare global { interface Window { analytics: Analytics } }`.

### Compiler performance in big repos
- Project references (`composite: true`, `tsc -b`) for monorepos.
- `incremental`, `skipLibCheck`.
- Prefer interfaces over large intersections; avoid huge unions and deeply recursive conditional types.
- `isolatedModules` so per-file transpilers (esbuild, SWC, Babel) work correctly.
- `tsc --extendedDiagnostics`, `--generateTrace` to profile.

# Interview Questions

## Beginner

### What is TypeScript and why use it?
A statically typed superset of JavaScript that compiles to JS. It catches type errors at compile time, improves editor tooling (autocomplete, refactoring), documents code contracts and makes large codebases safer to change. Types are erased at runtime.

```ts
interface User { id: number; email: string }
function sendWelcome(user: User) { return `Welcome ${user.email}`; }

sendWelcome({ id: 1, emial: 'a@b.com' });
//                    ~~~~~ compile error: did you mean 'email'?
// The compiled JS has no types — they're erased:
// function sendWelcome(user) { return `Welcome ${user.email}`; }
```

### What's the difference between `any` and `unknown`?
Both accept any value. `any` turns off type checking entirely and spreads unsafety. `unknown` forces you to narrow (typeof, instanceof, type guard) before using the value — it's the type-safe choice for values of unknown shape, like JSON or `catch` errors.

```ts
const a: any = JSON.parse(input);
a.foo.bar();                 // compiles — crashes at runtime

const u: unknown = JSON.parse(input);
// u.foo;                    // ❌ error: 'u' is of type 'unknown'
if (typeof u === 'object' && u !== null && 'foo' in u) {
  console.log(u.foo);        // ✅ narrowed
}
try { risky(); } catch (e: unknown) { if (e instanceof Error) console.log(e.message); }
```

### Interface vs type alias?
Both describe object shapes. Interfaces can be extended and **merged** (declaration merging) and are slightly better for error messages and performance in big hierarchies. Type aliases can express unions, intersections, tuples, primitives, mapped and conditional types. Use interfaces for object contracts, types for compositions.

```ts
interface Animal { name: string }
interface Animal { age: number }          // declaration merging → { name; age }
interface Dog extends Animal { bark(): void }

type ID = string | number;                // unions: type only
type Point = { x: number; y: number };
type Point3D = Point & { z: number };     // intersection
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] }; // mapped: type only
```

### What are union and intersection types?
Union `A | B` — a value that is one of the types (you can only use common members until narrowed). Intersection `A & B` — a value that has all members of both types.

```ts
type Status = 'idle' | 'loading' | 'error';
function format(v: string | number) {
  return typeof v === 'string' ? v.toUpperCase() : v.toFixed(2); // narrow before use
}
type Timestamped = { createdAt: Date };
type Named = { name: string };
const item: Named & Timestamped = { name: 'x', createdAt: new Date() }; // must have both
```

### What is type inference?
The compiler deduces types from values and usage: `let x = 3` → `number`, return types from `return` statements, generic arguments from call arguments. Rely on inference for locals, annotate function boundaries.

```ts
let count = 3;                    // number
const mode = 'dark';              // 'dark' (literal — const)
const nums = [1, 2, 3];           // number[]
function double(n: number) { return n * 2; } // return type inferred: number
const s = new Set(['a']);         // Set<string>
const [state, setState] = useState(0); // generic inferred from the argument
```

### What does the `?` mean in an interface?
An optional property — it may be missing; its type includes `undefined`. With `exactOptionalPropertyTypes`, explicitly assigning `undefined` is not allowed unless declared.

```ts
interface Options { timeout?: number; retries: number }
const o: Options = { retries: 3 };           // timeout may be missing
o.timeout?.toFixed();                        // optional chaining
const t = o.timeout ?? 5000;                 // number | undefined → number
function log(msg: string, level?: 'info' | 'warn') {} // optional parameter
```

### What is a tuple?
A fixed-length array with known types at each position: `[string, number]`. Supports optional (`[string, number?]`), rest (`[string, ...number[]]`) and labelled elements (`[name: string, age: number]`).

```ts
type Entry = [key: string, value: number];
const e: Entry = ['age', 42];
const [k, v] = e;                                   // string, number

type Range = [start: number, end?: number];
type Args = [string, ...number[]];                  // rest element
function useToggle(): readonly [boolean, () => void] { /* … */ return [true, () => {}]; }
```

### What is `never`?
The type with no values. It's the return type of functions that never return (throw/infinite loop) and the result of narrowing away all possibilities, used for exhaustive checking in switch statements.

```ts
function fail(msg: string): never { throw new Error(msg); }

type Shape = { kind: 'circle'; r: number } | { kind: 'square'; s: number };
function area(s: Shape) {
  switch (s.kind) {
    case 'circle': return Math.PI * s.r ** 2;
    case 'square': return s.s ** 2;
    default: const _exhaustive: never = s;   // error here if a new kind is added
      return _exhaustive;
  }
}
type NonString<T> = T extends string ? never : T; // filters out strings
```

## Intermediate

### What are generics? Give an example.
Type parameters that make functions, classes and types reusable while keeping type relationships: `function identity<T>(x: T): T`. Example: `ApiResponse<T>`, `useState<T>`, `Repository<User>`. Constraints (`T extends { id: string }`) restrict what T can be.

```ts
function first<T>(items: T[]): T | undefined { return items[0]; }
first([1, 2]);           // number | undefined
first(['a']);            // string | undefined

interface ApiResponse<T> { data: T; error?: string }
async function get<T>(url: string): Promise<ApiResponse<T>> {
  return (await fetch(url)).json();
}
const res = await get<User[]>('/api/users');   // res.data: User[]

function getProp<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; } // constraint
```

### Explain discriminated unions.
A union of object types sharing a literal "tag" property (`kind`, `status`, `type`). Checking the tag narrows the value to one member. Paired with a `never` default case, the compiler enforces that every variant is handled — great for reducers, API states and events.

```ts
type RemoteData<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: T };

function render(r: RemoteData<User>) {
  if (r.status === 'success') return r.data.email;  // data available only here
  if (r.status === 'error') return r.error;
  return 'Loading…';
}
```

### What are type guards?
Expressions that narrow a type within a block: `typeof`, `instanceof`, `in`, equality checks, truthiness, and user-defined guards with `x is T` return types. Assertion functions (`asserts x is T`) narrow after the call or throw.

```ts
interface Fish { swim(): void } interface Bird { fly(): void }

function isFish(p: Fish | Bird): p is Fish { return 'swim' in p; } // user-defined guard
function move(p: Fish | Bird) { isFish(p) ? p.swim() : p.fly(); }

function assertIsDefined<T>(v: T): asserts v is NonNullable<T> {
  if (v == null) throw new Error('missing');
}
const el = document.getElementById('app'); assertIsDefined(el); el.append('ok');
```

### Name and explain some utility types.
`Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record`, `Exclude`, `Extract`, `NonNullable`, `ReturnType`, `Parameters`, `Awaited`. E.g. a PATCH payload is `Partial<Omit<User, 'id'>>`.

```ts
interface User { id: number; name: string; email: string; password: string }
type UpdateUser   = Partial<Omit<User, 'id'>>;        // PATCH body
type PublicUser   = Omit<User, 'password'>;
type UserPreview  = Pick<User, 'id' | 'name'>;
type ById         = Record<number, User>;
type Frozen       = Readonly<User>;
type Fn = (a: string, b: number) => Promise<boolean>;
type R  = Awaited<ReturnType<Fn>>;                    // boolean
type P  = Parameters<Fn>;                             // [a: string, b: number]
type T1 = Exclude<'a' | 'b' | 'c', 'a'>;              // 'b' | 'c'
```

### What is `keyof` and `typeof` in type positions?
`typeof value` gets the type of a runtime value. `keyof T` gives a union of T's keys. Combined: `keyof typeof config` gives the config's key names; `T[K]` (indexed access) gives a property type.

```ts
const config = { apiUrl: 'https://x', retries: 3 };
type Config = typeof config;          // { apiUrl: string; retries: number }
type ConfigKey = keyof typeof config; // 'apiUrl' | 'retries'
type Retries = Config['retries'];     // number (indexed access)

function getConfig<K extends ConfigKey>(k: K): Config[K] { return config[k]; }
```

### What does `as const` do?
Creates the narrowest possible type: literals instead of `string`/`number`, readonly tuples instead of arrays, readonly properties. Great for deriving union types from arrays/objects.

```ts
const ROLES = ['admin', 'editor', 'viewer'] as const;
type Role = (typeof ROLES)[number];            // 'admin' | 'editor' | 'viewer'

const routes = { home: '/', profile: '/me' } as const;
// routes.home = '/x';                         // ❌ readonly
type Path = (typeof routes)[keyof typeof routes]; // '/' | '/me'
```

### What does `strict: true` enable and why does it matter?
`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`. Without it, `null`/`undefined` bugs and implicit `any` slip through, which defeats much of TS's purpose.

```json tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```
```ts
function len(s: string | null) { return s.length; }  // strictNullChecks: error — s may be null
class A { name: string; }                            // strictPropertyInitialization: error
function f(x) {}                                     // noImplicitAny: error
```

### What is the `satisfies` operator?
It checks that an expression conforms to a type while keeping its precise inferred type. Unlike `: Type`, it doesn't widen; unlike `as`, it doesn't bypass checks.

```ts
type Colors = Record<'primary' | 'danger', string | [number, number, number]>;

const a: Colors = { primary: '#00f', danger: [255, 0, 0] };
// a.primary.toUpperCase();   // ❌ string | tuple — annotation widened it

const b = { primary: '#00f', danger: [255, 0, 0] } satisfies Colors;
b.primary.toUpperCase();      // ✅ still known to be string
// { primery: '#00f' } satisfies Colors   // ❌ typo caught
```

### How do you type a function that can be called in different ways?
Overload signatures followed by one implementation signature, or a union/generic parameter. Overloads give callers precise return types per input shape.

```ts
function parse(input: string): object;
function parse(input: Buffer): object;
function parse(input: string, asArray: true): unknown[];
function parse(input: string | Buffer, asArray?: boolean): object | unknown[] {
  const text = typeof input === 'string' ? input : input.toString();
  const v = JSON.parse(text);
  return asArray ? [v] : v;
}
const arr = parse('{"a":1}', true);   // unknown[]
```

## Advanced

### Explain conditional types and `infer`.
`T extends U ? X : Y` chooses a type based on assignability. They distribute over unions when T is a naked type parameter. `infer` declares a type variable to capture part of a type within the `extends` clause — e.g., `ReturnType<F>` is `F extends (...a: any) => infer R ? R : never`.

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<'x'>;                  // true
type ToArray<T> = T extends any ? T[] : never;
type B = ToArray<string | number>;       // string[] | number[]  (distributes)

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type C = UnwrapPromise<Promise<User>>;   // User
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type FirstArg<F> = F extends (first: infer A, ...rest: any[]) => any ? A : never;
```

### Implement `DeepReadonly<T>`.
```ts
type DeepReadonly<T> = T extends (...args: any[]) => any ? T
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
```
Functions are left as-is; objects/arrays are recursively mapped; primitives returned unchanged.

### What is structural typing and how do you get nominal behaviour?
TS checks compatibility by shape, so same-shaped types are interchangeable. For nominal behaviour (e.g., `UserId` vs `OrderId` strings) use **branded types** — intersect with a unique phantom property — or classes with private fields (`#brand`).

```ts
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };
const UserId = (s: string) => s as UserId;

function getUser(id: UserId) {}
const oid = 'o-1' as OrderId;
// getUser(oid);            // ❌ OrderId is not assignable to UserId
getUser(UserId('u-1'));     // ✅
```

### Explain covariance and contravariance in TypeScript.
Return/readonly positions are covariant (subtype can substitute). Function parameters are contravariant under `strictFunctionTypes` (a handler accepting a supertype is safe where a subtype handler is expected). Method shorthand parameters remain bivariant for compatibility. Mutable arrays are treated covariantly — an unsound but pragmatic choice.

```ts
class Animal { name = '' } class Dog extends Animal { bark() {} }

let animals: readonly Animal[] = [] as Dog[];        // ✅ covariant (read-only)

type Handler<T> = (x: T) => void;
let handleAnimal: Handler<Animal> = (a) => console.log(a.name);
let handleDog: Handler<Dog> = handleAnimal;          // ✅ contravariant params
// let bad: Handler<Animal> = (d: Dog) => d.bark();  // ❌ under strictFunctionTypes

interface Box<in out T> { get(): T; set(v: T): void } // explicit variance annotations
```

### How do you ensure type safety for data from an API?
Types don't exist at runtime, so validate at the boundary with a schema library (Zod, Valibot, io-ts) and infer the static type from the schema. Or generate types and clients from OpenAPI/GraphQL schemas, or use end-to-end typed RPC (tRPC).

```ts
import { z } from 'zod';
const UserSchema = z.object({ id: z.number(), email: z.string().email(), roles: z.array(z.string()) });
type User = z.infer<typeof UserSchema>;      // static type from the runtime schema

async function getUser(id: number): Promise<User> {
  const json: unknown = await (await fetch(`/api/users/${id}`)).json();
  return UserSchema.parse(json);             // throws with a clear error if the shape is wrong
}
```

### What are mapped types with key remapping?
`{ [K in keyof T as NewKey]: ... }` iterates keys and lets you rename (e.g. to `getName` via a template literal type) or filter them (map to `never` to drop). It enables types like `Getters<T>` or `PickByValue<T, V>`.

```ts
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type UserGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }

type OmitFunctions<T> = { [K in keyof T as T[K] extends Function ? never : K]: T[K] };
type EventHandlers<E extends string> = { [K in E as `on${Capitalize<K>}`]: () => void };
type H = EventHandlers<'click' | 'focus'>;   // { onClick; onFocus }
```

### How would you speed up type-checking in a large monorepo?
Use project references with `tsc -b` and incremental builds, `skipLibCheck`, `isolatedModules` with a fast transpiler for builds, avoid overly complex recursive/conditional types and huge unions, prefer interfaces to deep intersections, and profile with `--extendedDiagnostics`/`--generateTrace`.

```json tsconfig.json (root)
{
  "files": [],
  "references": [{ "path": "packages/core" }, { "path": "packages/web" }]
}
```
```json packages/core/tsconfig.json
{
  "compilerOptions": { "composite": true, "incremental": true, "skipLibCheck": true, "isolatedModules": true, "outDir": "dist" },
  "include": ["src"]
}
```
```bash
tsc -b --verbose            # builds only changed projects
tsc --extendedDiagnostics   # find slow files / huge type instantiations
```

### What's the difference between `declare`, `.d.ts` files and module augmentation?
`declare` describes things that exist at runtime but aren't defined in TS (globals, external libs). `.d.ts` files contain only declarations. Module augmentation (`declare module 'x' { … }`) adds to an existing module's types — e.g., adding `user` to Express's `Request`.

```ts
declare const __APP_VERSION__: string;          // injected by the bundler

// types/legacy-lib.d.ts
declare module 'legacy-lib' { export function doThing(x: number): string; }

// Module augmentation: add a field to Express's Request
import 'express';
declare module 'express-serve-static-core' { interface Request { user?: { id: string } } }

// Global augmentation
declare global { interface Window { analytics: { track(e: string): void } } }
export {};
```

# Scenario Questions

## Beginner

### Your API returns data your types say can't exist, and the app crashes at runtime. How do you protect yourself?
TypeScript types disappear at runtime, so a `fetch` result typed `as User` is just a promise you made to the compiler. Validate at the boundary with a schema library (**Zod**, Valibot, io-ts):
```ts
const User = z.object({ id: z.number(), email: z.string().email() });
type User = z.infer<typeof User>;
const user = User.parse(await res.json()); // throws with a clear error if the shape is wrong
```
Or generate types and clients from an OpenAPI spec so the front end and back end can't drift apart.

## Intermediate

### You're migrating a 100k-line JavaScript codebase to TypeScript. What's your plan?
1. Add `tsconfig` with `allowJs` and `checkJs: false`. Rename files to `.ts` gradually, starting with leaf modules and utilities.
2. Start with `strict: false`, then enable flags one by one (`noImplicitAny`, then `strictNullChecks`, and so on). Use `// @ts-expect-error` sparingly and track how many remain.
3. Install `@types/*` packages for dependencies, and write `.d.ts` files for the untyped ones.
4. Type-check in CI (`tsc --noEmit`) so progress can't regress.
5. Add types to the API boundary first, because those types catch the most bugs.

```json tsconfig.json — phase 1
{
  "compilerOptions": { "allowJs": true, "checkJs": false, "strict": false, "noEmit": true, "skipLibCheck": true },
  "include": ["src"]
}
```
```js Type-check JS files one at a time with JSDoc before renaming
// @ts-check
/** @param {{ id: number, email: string }} user @returns {string} */
export function label(user) { return `${user.id}: ${user.email}`; }
```

### Adding a new value to a union broke production because one `switch` didn't handle it. How do you make the compiler catch this?
Use **exhaustiveness checking** with `never`:
```ts
type Status = 'active' | 'paused' | 'deleted';
function label(s: Status) {
  switch (s) {
    case 'active': return 'Active';
    case 'paused': return 'Paused';
    default: { const _exhaustive: never = s; return _exhaustive; } // error if a case is missing
  }
}
```
Or use `satisfies Record<Status, string>` for lookup objects.

## Advanced

### Your monorepo's `tsc` takes 4 minutes and editor IntelliSense is sluggish. How do you speed it up?
- Use **project references** (`composite: true`, `tsc -b`) so packages build incrementally.
- Turn on `incremental`, and `skipLibCheck: true`.
- Narrow `include` so it doesn't type-check `dist` or `node_modules`.
- Avoid huge inferred types and deep conditional or recursive types. Add explicit return types on exported APIs, and `isolatedDeclarations` where possible.
- Type-check separately from transpiling (esbuild or swc for builds, `tsc --noEmit` in CI).
- Profile with `--extendedDiagnostics` and `--generateTrace`.

```bash
npx tsc --generateTrace trace && npx @typescript/analyze-trace trace   # find hot spots
npx tsc --listFilesOnly | wc -l                                       # are you checking node_modules?
```
```ts
// Common culprit: giant recursive conditional types — add explicit annotations
export const routes: RouteMap = buildRoutes(config); // instead of letting TS infer a huge type
```

# Tricky Questions

## Beginner

### Does this compile? `const a: number[] = []; const b = a as unknown as string[]; b.push('x');`
Yes. A double assertion through `unknown` silences the compiler completely. At runtime `a` and `b` are the same array, so `a` now holds a string. Type assertions are not conversions, which is why validation beats `as`.

```ts
const a: number[] = [];
const b = a as unknown as string[];  // compiles: double assertion silences TS
b.push('x');
a[0].toFixed();                      // runtime TypeError: a[0].toFixed is not a function
// Prefer narrowing or a validated conversion: const b = a.map(String);
```

### What's the difference between `any` and `unknown` here?
```ts
let x: any = 'hi';     x.foo.bar();  // compiles, crashes at runtime
let y: unknown = 'hi'; y.toUpperCase(); // error: must narrow first
```
`any` switches off type checking. `unknown` accepts any value but forces you to narrow it (`typeof y === 'string'`) before you use it. Prefer `unknown` for untrusted data.

## Intermediate

### Why does this error? `const config = { mode: 'dark' }; setTheme(config.mode);` where `setTheme(m: 'dark' | 'light')`
`config.mode` is **widened** to `string`, because object properties are mutable. Fix it with `as const` (`{ mode: 'dark' } as const`), an explicit type annotation, or `satisfies { mode: 'dark' | 'light' }`.

```ts
declare function setTheme(m: 'dark' | 'light'): void;
const config = { mode: 'dark' };                 // mode: string
// setTheme(config.mode);                        // ❌ string not assignable
const c1 = { mode: 'dark' } as const;            setTheme(c1.mode); // ✅
const c2: { mode: 'dark' | 'light' } = { mode: 'dark' }; setTheme(c2.mode); // ✅
const c3 = { mode: 'dark' } satisfies { mode: 'dark' | 'light' }; setTheme(c3.mode); // ✅
```

### What's the type of `T` here? `type T = keyof { a: 1 } | keyof { b: 2 }` versus `keyof ({ a: 1 } | { b: 2 })`
The first is `'a' | 'b'`. The second is **`never`**, because `keyof` of a union returns only the keys common to **every** member, and there are none here. `keyof (A & B)` gives `'a' | 'b'`.

```ts
type T1 = keyof { a: 1 } | keyof { b: 2 };     // 'a' | 'b'
type T2 = keyof ({ a: 1 } | { b: 2 });         // never  (only common keys)
type T3 = keyof ({ a: 1 } & { b: 2 });         // 'a' | 'b'
type T4 = keyof ({ a: 1; c: 3 } | { b: 2; c: 4 }); // 'c'
```

## Advanced

### Why does this compile, even though it's unsafe?
```ts
const dogs: Dog[] = [];
const animals: Animal[] = dogs;
animals.push(new Cat());
```
Arrays in TypeScript are **covariant** (unsoundly, for convenience), so `Dog[]` is assignable to `Animal[]` and a `Cat` slips into the dogs array. Use `readonly Animal[]` for parameters you don't mutate. Method parameters are likewise **bivariant**; `strictFunctionTypes` only makes function-typed *properties* contravariant.
