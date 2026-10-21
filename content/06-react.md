---
id: react
title: React
short: React
category: Frontend Frameworks
order: 6
color: #149eca
icon: Re
summary: Components, JSX, state, hooks, rendering & reconciliation, performance, state management, React 18/19 features, Server Components and Next.js.
---

# Beginner

## What React Is and How It Thinks

React is a **library for building user interfaces from components**. Its core idea:

> **UI = f(state)** — you describe what the UI should look like for a given state; React figures out how to update the DOM.

- **Declarative** — describe the result, not the DOM steps.
- **Component-based** — small reusable pieces composed into trees.
- **One-way data flow** — data flows down via props; events flow up via callbacks.
- **Learn once, write anywhere** — React DOM, React Native, etc.

### Starting a project
```bash
npm create vite@latest my-app -- --template react-ts
# or a framework: npx create-next-app@latest
```
`create-react-app` is deprecated; use Vite or a framework (Next.js, React Router/Remix).

## JSX

JSX is syntax sugar for `React.createElement` / the JSX runtime calls.

```jsx
const name = 'Asha';
const el = <h1 className="title">Hello, {name}!</h1>;
// compiles to: jsx('h1', { className: 'title', children: ['Hello, ', name, '!'] })
```

### Rules
- Return a **single root** (use fragments `<>...</>`).
- `className` instead of `class`, `htmlFor` instead of `for`, camelCase events (`onClick`).
- `{}` embeds any JS **expression** (not statements).
- Inline styles are objects: `style={{ marginTop: 8 }}`.
- Close every tag: `<img />`.
- JSX auto-escapes values → protects from XSS (except `dangerouslySetInnerHTML`).

### Conditional rendering and lists
```jsx
{isLoggedIn ? <Dashboard /> : <Login />}
{error && <Alert>{error}</Alert>}
{count > 0 && <Badge n={count} />}   {/* careful: {0 && x} renders "0" */}

<ul>
  {todos.map(todo => <li key={todo.id}>{todo.title}</li>)}
</ul>
```

## Components and Props

```jsx
function Avatar({ user, size = 48 }) {
  return <img src={user.avatarUrl} alt={user.name} width={size} height={size} />;
}

function Card({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

<Card title="Profile"><Avatar user={me} /></Card>
```

- Components are functions returning JSX; names start with a **capital letter**.
- **Props are read-only.** A component must never modify its props.
- `children` lets you compose (slot pattern).
- Prefer **composition over inheritance** — React has no need for component class hierarchies.

## State with useState

State is data that changes over time and triggers re-render.

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(c => c + 1)}>+1 (functional)</button>
    </>
  );
}
```

### Key behaviours
- Updates are **asynchronous and batched**: `setCount(count + 1)` three times in one handler adds only 1. Use the **functional updater** `setCount(c => c + 1)` when the new value depends on the old.
- State must be updated **immutably**:
```jsx
setUser({ ...user, name: 'Ravi' });
setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
setTodos([...todos, newTodo]);
setTodos(todos.filter(t => t.id !== id));
```
- **Lazy initial state**: `useState(() => expensiveCompute())` runs only on mount.

## Events and Forms

```jsx
function SignupForm({ onSubmit }) {
  const [form, setForm] = useState({ email: '', agree: false });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <input name="email" value={form.email} onChange={handleChange} />
      <input name="agree" type="checkbox" checked={form.agree} onChange={handleChange} />
      <button disabled={!form.agree}>Sign up</button>
    </form>
  );
}
```

### Controlled vs uncontrolled
- **Controlled**: React state is the single source of truth (`value` + `onChange`). Easy validation, more renders.
- **Uncontrolled**: the DOM holds the value; read with a `ref` or `FormData` (`defaultValue`). Fewer renders. Libraries like React Hook Form use this for performance.

React's events are **synthetic events** — a cross-browser wrapper; since React 17 they're attached at the root container, not `document`.

## Keys and Lists

Keys help React match elements between renders during reconciliation.

```jsx
{items.map(item => <Row key={item.id} item={item} />)}
```

- Keys must be **stable, unique among siblings, and predictable**.
- **Don't use array index** if the list can reorder, insert or delete — React will reuse the wrong component instance, causing state bugs (e.g., input text staying in the wrong row) and extra work.
- Changing a component's `key` forces a **remount** — a handy trick to reset state: `<Profile key={userId} />`.

# Intermediate

## useEffect and the Component Lifecycle

Effects synchronize a component with **external systems** (network, subscriptions, timers, DOM APIs).

```jsx
useEffect(() => {
  const ctrl = new AbortController();
  fetch(`/api/users/${id}`, { signal: ctrl.signal })
    .then(r => r.json())
    .then(setUser)
    .catch(e => { if (e.name !== 'AbortError') setError(e); });

  return () => ctrl.abort();       // cleanup: runs before the next effect and on unmount
}, [id]);                          // dependency array
```

| Dependencies | Runs |
|---|---|
| none | after every render |
| `[]` | once after mount (cleanup on unmount) |
| `[a, b]` | after mount and whenever `a` or `b` change (`Object.is`) |

### Lifecycle mapping
- `componentDidMount` → `useEffect(fn, [])`
- `componentDidUpdate` → `useEffect(fn, [deps])`
- `componentWillUnmount` → the cleanup function

### Common mistakes
- **Missing dependencies** → stale values. Follow the `react-hooks/exhaustive-deps` lint rule.
- **Objects/functions as deps** created each render → effect runs every render.
- Using effects for **derived state** — just compute during render.
- In **StrictMode (dev)** effects run mount → cleanup → mount to surface missing cleanups.

> [!TIP]
> "You might not need an effect": transform data during render, handle user events in event handlers, and use a data-fetching library or framework loaders for server data.

`useLayoutEffect` runs synchronously after DOM mutation but **before paint** — use for measuring layout to avoid flicker.

## useRef, useContext and useReducer

### useRef
A mutable box `{ current }` that persists across renders **without causing re-renders**.
```jsx
const inputRef = useRef(null);
useEffect(() => inputRef.current.focus(), []);
<input ref={inputRef} />

const renders = useRef(0); renders.current++;   // instance variable
```

### useContext — avoid prop drilling
```jsx
const ThemeContext = createContext('light');

function App() {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Toolbar />
    </ThemeContext.Provider>
  );
}
function ThemedButton() {
  const { theme } = useContext(ThemeContext);
  return <button className={theme}>OK</button>;
}
```
Every consumer re-renders when the `value` reference changes → memoize the value, split contexts, or use a store for high-frequency state.

### useReducer — complex state transitions
```jsx
function reducer(state, action) {
  switch (action.type) {
    case 'add': return { ...state, items: [...state.items, action.item] };
    case 'remove': return { ...state, items: state.items.filter(i => i.id !== action.id) };
    default: throw new Error('Unknown action');
  }
}
const [state, dispatch] = useReducer(reducer, { items: [] });
dispatch({ type: 'add', item });
```

## Custom Hooks and the Rules of Hooks

### Rules of Hooks
1. Only call hooks **at the top level** — not in loops, conditions or nested functions.
2. Only call hooks from **React function components or custom hooks**.

Why: React stores hook state in a linked list ordered by call order. Changing the order between renders mismatches the state.

### Custom hooks extract reusable stateful logic
```jsx
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function useFetch(url) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let ignore = false;
    setState(s => ({ ...s, loading: true }));
    fetch(url).then(r => r.json())
      .then(data => !ignore && setState({ data, loading: false, error: null }))
      .catch(error => !ignore && setState({ data: null, loading: false, error }));
    return () => { ignore = true; };
  }, [url]);
  return state;
}
```
Each component calling a custom hook gets **its own independent state**.

## Performance: memo, useMemo, useCallback

### When does a component re-render?
1. Its **state** changes.
2. Its **parent** re-renders (regardless of props!).
3. A **context** it consumes changes.

### Tools
```jsx
const ExpensiveList = React.memo(function ExpensiveList({ items, onSelect }) { /* … */ });

function Parent({ data }) {
  const sorted = useMemo(() => [...data].sort(byDate), [data]);     // cache a value
  const handleSelect = useCallback(id => setSelected(id), []);      // cache a function
  return <ExpensiveList items={sorted} onSelect={handleSelect} />;
}
```
- `React.memo` skips re-rendering if props are shallow-equal.
- `useMemo`/`useCallback` keep references stable so `memo` children and effect deps don't change needlessly.
- Don't memoize everything — it costs memory and comparisons. Measure with the **React DevTools Profiler**.
- **React Compiler** (stable in 2025) auto-memoizes components and hooks at build time, making most manual `useMemo`/`useCallback` unnecessary.

### Other techniques
- Move state down / lift content up (pass expensive subtrees as `children`).
- **Virtualize** long lists (`react-window`, TanStack Virtual).
- **Code splitting** with `React.lazy` + `Suspense`.
- Avoid creating new objects in context values.
- Debounce input; use `useDeferredValue`/`useTransition` for heavy updates.

## Routing and Data Fetching

### React Router
```jsx
const router = createBrowserRouter([
  { path: '/', element: <Layout />, errorElement: <ErrorPage />, children: [
    { index: true, element: <Home /> },
    { path: 'users/:id', element: <User />, loader: ({ params }) => fetchUser(params.id) },
  ]},
]);
<RouterProvider router={router} />

function User() {
  const user = useLoaderData();
  const { id } = useParams();
  const navigate = useNavigate();
}
```

### Server state with TanStack Query
```jsx
const { data, isPending, error } = useQuery({
  queryKey: ['user', id],
  queryFn: () => fetch(`/api/users/${id}`).then(r => r.json()),
  staleTime: 60_000,
});
const mutation = useMutation({
  mutationFn: updateUser,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', id] }),
});
```
It handles caching, deduplication, background refetching, retries, pagination and optimistic updates — distinguish **server state** (remote, cached) from **client state** (UI).

## State Management

| Kind of state | Tool |
|---|---|
| Local UI (open/closed, input) | `useState` / `useReducer` |
| Shared, low-frequency (theme, auth user) | Context |
| Server cache | TanStack Query, SWR, RTK Query, Apollo |
| Global client state | **Zustand**, Redux Toolkit, Jotai, MobX |
| URL state (filters, page) | search params / router |
| Forms | React Hook Form + Zod |

### Redux Toolkit
```js
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] },
  reducers: {
    added(state, action) { state.items.push(action.payload); }, // Immer makes this immutable
  },
});
export const { added } = cartSlice.actions;
const store = configureStore({ reducer: { cart: cartSlice.reducer } });
// component
const items = useSelector(s => s.cart.items);
const dispatch = useDispatch();
```
Redux principles: single store, state is read-only, changes via pure reducers. Strong devtools and predictability; more ceremony.

### Zustand
```js
const useCart = create(set => ({
  items: [],
  add: item => set(s => ({ items: [...s.items, item] })),
}));
const items = useCart(s => s.items);   // subscribes only to this slice
```

# Advanced

## Rendering, Reconciliation and Fiber

### Render vs commit
1. **Render phase** — React calls components to compute the new element tree and diffs it against the previous (**reconciliation**). Pure, can be paused or discarded.
2. **Commit phase** — applies DOM mutations, then runs layout effects and (later) passive effects. Synchronous.

### The diffing heuristics (O(n))
- Different element **type** → tear down the subtree and rebuild.
- Same type → keep the instance/DOM node, update changed props.
- Children lists are matched by **key**.

### Fiber
Fiber (React 16+) re-implemented reconciliation as a linked list of work units ("fibers"), enabling:
- **Interruptible rendering** — yield to the browser to keep input responsive.
- **Priorities (lanes)** — urgent updates (typing) before transitions (filtering a list).
- Foundation for Suspense, concurrent features and transitions.

### Virtual DOM — the honest answer
The Virtual DOM is an in-memory description of UI. It isn't "faster than the DOM" per se; it gives a **declarative programming model** with acceptable performance by batching and minimising DOM writes.

## Concurrent React: Transitions, Suspense and Batching

### Automatic batching (React 18)
All updates inside timeouts, promises and native handlers are batched into one render (previously only React event handlers). Opt out with `flushSync`.

### useTransition / useDeferredValue
```jsx
const [isPending, startTransition] = useTransition();
function onChange(e) {
  setQuery(e.target.value);                 // urgent: keep input responsive
  startTransition(() => setFilter(e.target.value)); // non-urgent, interruptible
}

const deferredQuery = useDeferredValue(query); // lagging copy for expensive children
```

### Suspense
```jsx
const Settings = lazy(() => import('./Settings'));
<Suspense fallback={<Spinner />}>
  <Settings />
</Suspense>
```
A component "suspends" (throws a promise / uses `use(promise)`) while waiting; the nearest Suspense boundary shows the fallback. Works with lazy code, Suspense-enabled data libraries and server streaming.

### Error boundaries
Catch render errors in a subtree (still class-based, or `react-error-boundary`). They don't catch errors in event handlers or async code.
```jsx
<ErrorBoundary fallback={<p>Something went wrong</p>}><Widget /></ErrorBoundary>
```

## React 19 Features

- **Actions** — async functions in transitions handle pending state, errors and optimistic updates.
```jsx
function UpdateName() {
  const [error, submitAction, isPending] = useActionState(async (prev, formData) => {
    const err = await updateName(formData.get('name'));
    return err ?? null;
  }, null);
  return (
    <form action={submitAction}>
      <input name="name" />
      <button disabled={isPending}>Save</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```
- **`useOptimistic`** — show the expected result immediately, roll back on failure.
- **`useFormStatus`** — read the parent form's pending state from a child button.
- **`use(promise | context)`** — read a resource during render (can be called conditionally).
- **`ref` as a prop** — no more `forwardRef` for function components.
- `<Context>` can be rendered directly as a provider.
- Document metadata (`<title>`, `<meta>`) rendered anywhere is hoisted to `<head>`.
- Resource preloading APIs (`preload`, `preinit`), better hydration error messages.
- **React Compiler** for automatic memoization.

## Server Components, SSR and Next.js

### Rendering strategies

| Strategy | HTML produced | Good for |
|---|---|---|
| CSR (client-side) | in the browser | dashboards behind login |
| SSR | per request on server, then hydrate | personalised, SEO pages |
| SSG | at build time | docs, marketing |
| ISR | static, regenerated periodically/on demand | e-commerce catalogues |
| Streaming SSR | HTML in chunks with Suspense | fast TTFB with slow data |

**Hydration** attaches event handlers and state to server HTML. Mismatches (e.g., `Date.now()` or `window` in render) cause warnings/bugs.

### React Server Components (RSC)
- Run **only on the server**; their code is never shipped to the client → smaller bundles.
- Can be `async` and access databases/files directly.
- Cannot use state, effects or browser APIs.
- **Client Components** are opted into with `'use client'` and are hydrated.
- Server components can render client components and pass serializable props.
- **Server Actions** (`'use server'`) are functions callable from the client (forms) that run on the server.

```tsx app/products/page.tsx
import { db } from '@/lib/db';
import AddToCart from './AddToCart';   // 'use client' component

export default async function Products() {
  const products = await db.product.findMany();   // runs on the server
  return products.map(p => <div key={p.id}>{p.name} <AddToCart id={p.id} /></div>);
}
```

### Next.js App Router essentials
File-based routing (`app/blog/[slug]/page.tsx`), nested `layout.tsx`, `loading.tsx` (Suspense), `error.tsx`, route handlers (`route.ts`), middleware, `fetch` caching & revalidation (`revalidatePath`, `revalidateTag`), `next/image`, `next/font`.

## Patterns and Architecture

### Component patterns
- **Compound components** — `<Tabs><Tabs.List/><Tabs.Panel/></Tabs>` sharing implicit state via context.
- **Render props** — `<DataLoader render={data => …} />` (mostly replaced by hooks).
- **Higher-Order Components** — `withAuth(Component)` (mostly replaced by hooks).
- **Controlled/uncontrolled component APIs** — accept `value`/`onChange` or manage internally with `defaultValue`.
- **Headless components** — logic without styles (Radix, Headless UI, TanStack Table).
- **Portals** — `createPortal(<Modal/>, document.body)` to escape overflow/stacking contexts while keeping React tree events.

### Folder structure for scale
Feature-based (`features/cart/{components,hooks,api,store}`) over type-based. Shared UI kit, design tokens, absolute imports, and boundaries enforced with lint rules.

### Testing
- **React Testing Library** — test behaviour the way users interact (`getByRole`, `userEvent`), not implementation details.
- **Vitest/Jest** for unit tests, **MSW** to mock network, **Playwright/Cypress** for E2E.
```jsx
test('increments', async () => {
  render(<Counter />);
  await userEvent.click(screen.getByRole('button', { name: '+1' }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### Micro-frontends
Split a large app by domain into independently deployed apps (Module Federation, single-spa, iframes or Web Components). Trade-offs: team autonomy vs duplication, consistency and runtime overhead.

# Interview Questions

## Beginner

### What is React and what problem does it solve?
A JavaScript library for building UIs from components. It lets you describe the UI declaratively as a function of state; when state changes, React efficiently updates the DOM. This removes manual DOM manipulation bugs and makes complex interactive UIs composable and predictable.

### What is JSX?
A syntax extension that looks like HTML inside JavaScript. It compiles to function calls (`jsx()`/`React.createElement`) that create plain objects describing the UI. It supports embedding expressions with `{}` and escapes values by default.

### What is the difference between props and state?
Props are inputs passed from parent to child and are read-only for the child. State is private data managed within a component that can change over time via its setter; changing it triggers a re-render. Data flows down through props, changes flow up through callbacks.

### Why do lists need keys?
Keys give list items a stable identity so React can match them across renders, reusing the right DOM nodes and component state when items move, insert or delete. Using indexes for dynamic lists causes state to attach to the wrong item.

### What are controlled and uncontrolled components?
Controlled inputs derive their value from React state and update via `onChange`, making React the source of truth. Uncontrolled inputs keep their value in the DOM; you read it via refs or `FormData`. Controlled is easier to validate; uncontrolled is simpler and faster for large forms.

### What is the Virtual DOM?
A lightweight in-memory tree of objects describing the UI. On updates React builds a new tree, diffs it with the previous one, and applies the minimal set of real DOM changes. Its real value is the declarative model plus batching, not raw speed.

### What are fragments?
`<></>` or `<React.Fragment key=…>` group multiple children without adding an extra DOM node — useful for returning multiple elements or rendering table rows.

### Function vs class components?
Class components use `this.state`, lifecycle methods and `render()`. Function components use hooks and are now the standard: less boilerplate, easier logic reuse via custom hooks, and support for all modern features. Classes are still needed only for error boundaries (without a library).

### What does lifting state up mean?
Moving shared state to the closest common ancestor so sibling components can read it via props and update it via callbacks, keeping a single source of truth.

## Intermediate

### Explain `useEffect` and its dependency array.
`useEffect` runs side effects after render. With no array it runs after every render; with `[]` once after mount; with `[a, b]` when those values change. The returned cleanup runs before the next effect run and on unmount. Missing dependencies cause stale closures; unstable object/function dependencies cause excessive runs.

### Why is my state not updating immediately after `setState`?
State updates are scheduled, not applied synchronously. The current render's variable is a snapshot; the new value appears in the next render. Use the functional updater (`setX(x => x + 1)`) for sequential updates, and `useEffect` or the next render to react to the new value.

### What are the rules of hooks and why do they exist?
Call hooks only at the top level of React functions — never in conditions, loops or nested functions — and only from components or custom hooks. React identifies each hook's state by call order; conditional calls would shift the order and mismatch state.

### `useMemo` vs `useCallback` vs `React.memo`?
`useMemo` caches a computed value; `useCallback` caches a function reference (`useCallback(fn, deps)` ≡ `useMemo(() => fn, deps)`); `React.memo` wraps a component to skip re-render when props are shallow-equal. The hooks are mainly useful to keep references stable for memoized children or effect dependencies, or to skip genuinely expensive computations.

### When would you use `useReducer` over `useState`?
When state has multiple sub-values that change together, when next state depends on complex logic, or when you want to centralise transitions in a testable pure function. It also lets you pass `dispatch` down (stable identity) instead of many callbacks.

### What is prop drilling and how do you avoid it?
Passing props through many intermediate components that don't use them. Solutions: composition (pass components as `children`), Context, or a state library (Zustand/Redux). Don't reach for Context for everything — it can cause wide re-renders.

### How does Context affect performance?
All consumers re-render whenever the provider's `value` changes by reference. Mitigate by memoizing the value, splitting contexts by update frequency (state vs dispatch), using selectors via external stores (`useSyncExternalStore`, Zustand), or keeping context for rarely-changing data.

### How do you fetch data in React correctly?
Prefer a framework loader/Server Component or a library like TanStack Query (caching, dedupe, retries, race handling). If using `useEffect`, handle loading/error states, cancel with `AbortController` or an ignore flag in cleanup, and include all dependencies.

### What is `useRef` used for?
Accessing DOM nodes (focus, measure, scroll) and storing mutable values that persist across renders without triggering re-renders — timer ids, previous values, instance counters.

### What is an error boundary?
A component that catches errors thrown during rendering, lifecycle or constructors of its children and renders a fallback UI. Implemented with `static getDerivedStateFromError` and `componentDidCatch` (or `react-error-boundary`). It doesn't catch event handler, async or SSR errors.

### What are portals?
`createPortal(children, domNode)` renders children into a different DOM node (e.g., `document.body`) while keeping them in the React tree — events bubble through React ancestors and context still works. Used for modals, tooltips and toasts.

## Advanced

### Explain reconciliation and the Fiber architecture.
Reconciliation diffs the new element tree against the previous one using heuristics: different types rebuild the subtree, same types update props, keys match children. Fiber re-implemented this as an incremental, interruptible work loop of fiber nodes with priority lanes, so React can pause rendering to handle urgent input and enables concurrent features like transitions and Suspense.

### What are concurrent features like `useTransition` and `useDeferredValue`?
They mark updates as non-urgent so React can interrupt them to keep the UI responsive. `useTransition` wraps state updates (`startTransition`) and gives `isPending`. `useDeferredValue` gives a lagging copy of a value to drive expensive rendering while the input stays snappy.

### What are React Server Components and how do they differ from SSR?
SSR renders the full component tree to HTML on the server, then ships all component JS to hydrate it. RSCs are components that only ever run on the server; their output is serialized (RSC payload) and their code is never shipped to the client. They can fetch data directly and reduce bundle size. They're combined with SSR for the initial HTML, and with client components for interactivity.

### What causes hydration mismatches and how do you fix them?
Server and client render different output: using `Date.now()`, `Math.random()`, `window`/`localStorage`, locale-dependent formatting, or invalid HTML nesting. Fix by rendering deterministic output, deferring client-only values to `useEffect`, using `suppressHydrationWarning` for unavoidable text, or rendering client-only components with dynamic import `ssr: false`.

### How would you optimise a slow React application?
Measure first with the Profiler and Performance panel. Then: avoid unnecessary re-renders (state colocation, memo, stable references, React Compiler), split code with `lazy`, virtualize long lists, debounce or defer expensive updates (transitions), move work to web workers, use a server-state cache, optimise images and bundles (tree-shaking, analyze), and use SSR/RSC for faster initial loads.

### What is a stale closure in hooks and how do you fix it?
A callback or effect captures state from the render it was created in; later it reads outdated values (e.g., an interval always logging `count = 0`). Fix with correct dependencies, functional updates (`setCount(c => c + 1)`), or a ref that always holds the latest value (`useEffectEvent`/latest-ref pattern).

### Explain `useSyncExternalStore`.
A hook for subscribing to external stores (Redux, Zustand, browser APIs) safely under concurrent rendering. It takes `subscribe`, `getSnapshot` (and `getServerSnapshot`) and prevents "tearing" — different components seeing different versions of the store within one render.

### How does React 18 automatic batching work?
React groups multiple state updates into a single re-render regardless of where they occur — event handlers, promises, timeouts or native events. Previously only React event handlers were batched. `flushSync` forces a synchronous flush when needed (e.g., before measuring DOM).

### What is the React Compiler?
A build-time compiler that analyses components and hooks and automatically inserts memoization, so values, callbacks and JSX are cached when their inputs don't change. It assumes code follows the Rules of React (pure render, immutable props/state) and reduces the need for manual `useMemo`/`useCallback`/`memo`.

### How would you design a large-scale React application architecture?
Feature-based folder structure, a shared design system, clear separation of server state (TanStack Query/RSC) and client state (Zustand/Redux), routing with code splitting, typed API layer (TypeScript + Zod/OpenAPI), error boundaries per route, testing pyramid (RTL + MSW + Playwright), CI with lint/type-check, performance budgets, and monitoring (Sentry, Web Vitals). Consider a framework like Next.js for SSR/RSC and micro-frontends only if team scale demands it.

# Scenario Questions

## Beginner

### A form input loses focus after every keystroke. What's the cause?
The input is being **unmounted and remounted** on each render. Common reasons:
- A component is defined *inside* another component, so it's a new type every render.
- The list `key` changes on every render (`key={Math.random()}`).
- A conditional swaps between two different wrappers.

Move component definitions to module scope and use stable keys.

### Clicking "+1" three times quickly in a handler with `setCount(count + 1); setCount(count + 1);` only adds 1 per click. Why?
Both calls read the same `count` from that render's closure, so they both set `count + 1`. Use the **functional updater** `setCount(c => c + 1)` when the next state depends on the previous one.

## Intermediate

### Your `useEffect` that fetches data runs in an infinite loop. How do you fix it?
The effect updates state that's in its own dependency array, or a dependency is a new object or function on every render (`options = {}` inline, an unmemoised callback). Fix it by:
- depending on primitives (`userId`)
- moving the object inside the effect, or wrapping it in `useMemo`/`useCallback`
- not setting state that feeds back into the dependencies

Better still, use a data library (TanStack Query, SWR), which handles caching, deduplication and race conditions.

### A 10,000-row table makes typing in the filter box laggy. How do you make it fast?
1. **Virtualize** the list (TanStack Virtual, react-window) so only visible rows render.
2. Keep the input responsive with `useDeferredValue(filter)` or `startTransition`.
3. Memoize rows (`React.memo`) with stable props, or let the React Compiler do it.
4. Do the filtering in `useMemo`, or on the server with pagination.

Profile with React DevTools Profiler before and after.

## Advanced

### After a release, the Next.js page logs "Hydration failed" in production for some users. How do you debug it?
Find what differs between server and client output:
- dates or timezones, `Math.random()`
- `window` or `localStorage` read during render
- browser extensions injecting DOM
- invalid nesting (`<div>` inside `<p>`)
- A/B flags evaluated differently on server and client

Reproduce with the user's locale or timezone. Fix with deterministic rendering, by moving client-only values into `useEffect` or a client component, or by passing server-computed values down as props.

### Your app's global Context causes every component to re-render on each keystroke. How do you restructure it?
Every consumer re-renders whenever the context **value** changes. Options:
- **Split contexts** by update frequency (state and dispatch apart).
- Memoize the value object.
- Keep fast-changing state local, or in a store with **selectors** (Zustand, Redux, `useSyncExternalStore`) so components subscribe only to the slice they use.

# Tricky Questions

## Beginner

### What renders when `items` is an empty array? `{items.length && <List items={items} />}`
A literal **`0`** on the screen. `0 && x` evaluates to `0`, and React renders numbers. Use `items.length > 0 && …` or a ternary.

### What gets logged?
```jsx
function Counter() {
  const [n, setN] = useState(0);
  const click = () => { setN(n + 1); console.log(n); };
  return <button onClick={click}>{n}</button>;
}
```
`0` on the first click, `1` on the second, and so on: always the **old** value. State updates are applied on the next render, and `n` in this closure is a constant snapshot.

## Intermediate

### Why does this effect log the stale value forever?
```jsx
useEffect(() => {
  const id = setInterval(() => console.log(count), 1000);
  return () => clearInterval(id);
}, []);
```
The empty dependency array means the effect runs once and captures `count` from the first render, so it's a **stale closure**. Fix it by adding `count` to the dependencies (the interval restarts), by keeping the latest value in a ref, or with `useEffectEvent`.

### In development, your effect's fetch runs twice and the API logs two calls. Is this a bug?
It's **Strict Mode** in React 18+ development: it mounts, unmounts and re-mounts components to surface effects that lack cleanup. Production calls it once. Don't disable it. Make the effect safe to repeat: abort the request in the cleanup, or use a data library that deduplicates requests.

## Advanced

### Items in a list are deleted, and the wrong row's input keeps the typed text. Why?
The list uses `key={index}`. After a delete, the indexes shift and React reuses the DOM and state of the old index for a different item. Use a **stable unique id** as the key.
