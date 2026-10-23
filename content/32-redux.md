---
id: redux
title: Redux & Redux Toolkit
short: Redux / RTK
category: Frontend Frameworks
order: 6.5
color: #764abc
icon: Rx
summary: Predictable global state with Redux: store, actions, reducers, middleware, Redux Toolkit (createSlice, createAsyncThunk, RTK Query), selectors, normalisation and testing.
---

# Beginner

## Why Redux and the Core Idea

Redux keeps **all shared application state in one store** and changes it only through **pure functions** called reducers. It's predictable because every change follows the same one-way loop:

```text
UI ──dispatch(action)──▶ store ──reducer(state, action)──▶ new state ──▶ subscribed UI re-renders
```

Three principles:
1. **Single source of truth.** One state tree for the whole app.
2. **State is read-only.** The only way to change it is to dispatch an action (a plain object describing *what happened*).
3. **Changes are made with pure functions.** `(state, action) => newState`, with no side effects and no mutation.

```js Plain Redux in 15 lines
import { createStore } from 'redux';   // legacy API, shown only to explain the idea

function counter(state = { value: 0 }, action) {
  switch (action.type) {
    case 'counter/incremented': return { value: state.value + 1 };
    case 'counter/added':       return { value: state.value + action.payload };
    default:                    return state;          // unknown action → same state
  }
}
const store = createStore(counter);
store.subscribe(() => console.log(store.getState()));
store.dispatch({ type: 'counter/incremented' });        // { value: 1 }
store.dispatch({ type: 'counter/added', payload: 5 });  // { value: 6 }
```

> [!TIP]
> Not everything belongs in Redux. Form input state, hover state and server-cache data (better handled by RTK Query or TanStack Query) often stay local.

## Actions, Reducers and the Store

- **Action**: `{ type: 'todos/added', payload: {...} }`. The `type` is a string, conventionally `domain/eventName`.
- **Action creator**: a function that returns an action.
- **Reducer**: computes the next state. It must never mutate its arguments, call APIs, or use `Math.random()`/`Date.now()`.
- **Store**: holds state, and exposes `getState()`, `dispatch(action)` and `subscribe(listener)`.

```js Immutable updates by hand (what RTK saves you from)
const initial = { items: [], filter: 'all' };
function todos(state = initial, action) {
  switch (action.type) {
    case 'todos/added':
      return { ...state, items: [...state.items, { id: action.payload.id, text: action.payload.text, done: false }] };
    case 'todos/toggled':
      return { ...state, items: state.items.map((t) => (t.id === action.payload ? { ...t, done: !t.done } : t)) };
    case 'todos/filterChanged':
      return { ...state, filter: action.payload };
    default:
      return state;
  }
}
```

## Redux Toolkit: configureStore and createSlice

**Redux Toolkit (RTK)** is the official, recommended way to write Redux. It removes boilerplate and bakes in good defaults:
- `configureStore` sets up the Redux DevTools, the thunk middleware, and dev-only checks for mutation and serializability.
- `createSlice` generates action creators and the reducer from one object. It uses **Immer**, so you write "mutating" code that produces immutable updates.

```ts features/todos/todosSlice.ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type Todo = { id: string; text: string; done: boolean };
type TodosState = { items: Todo[]; filter: 'all' | 'active' | 'done' };
const initialState: TodosState = { items: [], filter: 'all' };

const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    added: {
      reducer(state, action: PayloadAction<Todo>) {
        state.items.push(action.payload);                // Immer: safe "mutation"
      },
      prepare(text: string) {                           // build the payload (ids, timestamps) outside the reducer
        return { payload: { id: crypto.randomUUID(), text, done: false } };
      },
    },
    toggled(state, action: PayloadAction<string>) {
      const todo = state.items.find((t) => t.id === action.payload);
      if (todo) todo.done = !todo.done;
    },
    filterChanged(state, action: PayloadAction<TodosState['filter']>) {
      state.filter = action.payload;
    },
  },
});
export const { added, toggled, filterChanged } = todosSlice.actions;
export default todosSlice.reducer;
```
```ts app/store.ts
import { configureStore } from '@reduxjs/toolkit';
import todos from '../features/todos/todosSlice';

export const store = configureStore({ reducer: { todos } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## Connecting React: Provider, useSelector, useDispatch

```tsx main.tsx
import { Provider } from 'react-redux';
import { store } from './app/store';
createRoot(document.getElementById('root')!).render(<Provider store={store}><App /></Provider>);
```
```ts app/hooks.ts: typed hooks
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```
```tsx TodoList.tsx
function TodoList() {
  const items = useAppSelector((s) => s.todos.items);     // re-renders only when this value changes
  const dispatch = useAppDispatch();
  return (
    <ul>
      {items.map((t) => (
        <li key={t.id} onClick={() => dispatch(toggled(t.id))} style={{ textDecoration: t.done ? 'line-through' : 'none' }}>
          {t.text}
        </li>
      ))}
    </ul>
  );
}
```

> [!WARN]
> `useSelector` compares results with `===`. A selector that returns a **new object or array every time** (`s => s.todos.items.filter(...)`) makes the component re-render on *every* store update. Memoise it with `createSelector`.

# Intermediate

## Async Logic: Thunks and createAsyncThunk

Reducers must be pure, so side effects (API calls) go in **middleware**. A **thunk** is a function you dispatch that receives `dispatch` and `getState`. `createAsyncThunk` dispatches `pending`, `fulfilled` and `rejected` actions for you.

```ts
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

export const fetchUser = createAsyncThunk(
  'users/fetchById',
  async (id: string, { rejectWithValue, signal }) => {
    const res = await fetch(`/api/users/${id}`, { signal });     // aborted if thunk is cancelled
    if (!res.ok) return rejectWithValue({ status: res.status });
    return (await res.json()) as User;
  },
  { condition: (id, { getState }) => !(getState() as RootState).users.byId[id] }, // skip if cached
);

const usersSlice = createSlice({
  name: 'users',
  initialState: { byId: {} as Record<string, User>, status: 'idle' as 'idle' | 'loading' | 'failed', error: null as unknown },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchUser.fulfilled, (s, a) => { s.status = 'idle'; s.byId[a.payload.id] = a.payload; })
      .addCase(fetchUser.rejected, (s, a) => { s.status = 'failed'; s.error = a.payload ?? a.error; });
  },
});
// In a component: const user = await dispatch(fetchUser('42')).unwrap();   // throws on rejection
```

## Selectors and Memoisation with createSelector

**Selectors** read and derive data from state. Keep the stored state minimal, and *derive* everything else.

```ts
import { createSelector } from '@reduxjs/toolkit';

const selectItems = (s: RootState) => s.todos.items;
const selectFilter = (s: RootState) => s.todos.filter;

export const selectVisibleTodos = createSelector([selectItems, selectFilter], (items, filter) => {
  console.log('recomputing');                         // runs only when items or filter change
  return filter === 'all' ? items : items.filter((t) => (filter === 'done' ? t.done : !t.done));
});
export const selectDoneCount = createSelector([selectItems], (items) => items.filter((t) => t.done).length);

// Parameterised selector: create one per component instance
export const makeSelectTodosByTag = () =>
  createSelector([selectItems, (_: RootState, tag: string) => tag], (items, tag) => items.filter((t) => t.tags?.includes(tag)));
```

## Normalising State with createEntityAdapter

Store collections **normalised**, like database tables: `{ ids: [], entities: { [id]: item } }`. Updates become O(1), there are no duplicates, and nested data doesn't go out of sync.

```ts
import { createEntityAdapter, createSlice } from '@reduxjs/toolkit';

const postsAdapter = createEntityAdapter<Post, string>({
  selectId: (p) => p.id,
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt),
});
const postsSlice = createSlice({
  name: 'posts',
  initialState: postsAdapter.getInitialState({ status: 'idle' }),
  reducers: {
    postAdded: postsAdapter.addOne,
    postUpdated: postsAdapter.updateOne,          // payload: { id, changes }
    postsReceived: postsAdapter.setAll,
    postRemoved: postsAdapter.removeOne,
  },
});
export const { selectAll: selectAllPosts, selectById: selectPostById } =
  postsAdapter.getSelectors((s: RootState) => s.posts);
```

## RTK Query: Data Fetching and Caching

**RTK Query** (part of RTK) handles server state: fetching, caching, de-duplication, re-fetching, and cache invalidation through **tags**. It replaces most hand-written thunks and loading flags.

```ts services/api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (h, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) h.set('Authorization', `Bearer ${token}`);
      return h;
    },
  }),
  tagTypes: ['Todo'],
  endpoints: (build) => ({
    getTodos: build.query<Todo[], void>({
      query: () => 'todos',
      providesTags: (res) => [...(res ?? []).map(({ id }) => ({ type: 'Todo' as const, id })), { type: 'Todo', id: 'LIST' }],
    }),
    addTodo: build.mutation<Todo, Partial<Todo>>({
      query: (body) => ({ url: 'todos', method: 'POST', body }),
      invalidatesTags: [{ type: 'Todo', id: 'LIST' }],      // re-fetches getTodos automatically
    }),
  }),
});
export const { useGetTodosQuery, useAddTodoMutation } = api;
```
```ts store.ts
export const store = configureStore({
  reducer: { todos, [api.reducerPath]: api.reducer },
  middleware: (gDM) => gDM().concat(api.middleware),
});
```
```tsx
function Todos() {
  const { data = [], isLoading, error } = useGetTodosQuery(undefined, { pollingInterval: 30_000 });
  const [addTodo, { isLoading: saving }] = useAddTodoMutation();
  if (isLoading) return <Spinner />;
  if (error) return <p>Failed to load</p>;
  return <><button disabled={saving} onClick={() => addTodo({ text: 'New' })}>Add</button>{data.map((t) => <p key={t.id}>{t.text}</p>)}</>;
}
```

# Advanced

## Middleware and the Listener Middleware

Middleware sits between `dispatch` and the reducer. Use it for logging, analytics, crash reporting, and reacting to actions. It has the signature `store => next => action => ...`.

```ts Custom middleware
import type { Middleware } from '@reduxjs/toolkit';
export const logger: Middleware = (store) => (next) => (action) => {
  console.group((action as { type: string }).type);
  console.log('prev', store.getState());
  const result = next(action);                 // pass the action on
  console.log('next', store.getState());
  console.groupEnd();
  return result;
};
```
```ts Listener middleware: side effects in response to actions (lighter than sagas)
import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
export const listener = createListenerMiddleware();

listener.startListening({
  matcher: isAnyOf(added, toggled),
  effect: async (action, api) => {
    api.cancelActiveListeners();               // debounce: only the latest run continues
    await api.delay(500);
    localStorage.setItem('todos', JSON.stringify(api.getState().todos.items));
  },
});
// configureStore({ ..., middleware: (gDM) => gDM().prepend(listener.middleware) })
```

## Optimistic Updates, Code-Splitting and Persistence

```ts Optimistic update in RTK Query
toggleTodo: build.mutation<Todo, { id: string; done: boolean }>({
  query: ({ id, ...patch }) => ({ url: `todos/${id}`, method: 'PATCH', body: patch }),
  async onQueryStarted({ id, done }, { dispatch, queryFulfilled }) {
    const patch = dispatch(api.util.updateQueryData('getTodos', undefined, (draft) => {
      const t = draft.find((x) => x.id === id); if (t) t.done = done;       // UI updates instantly
    }));
    try { await queryFulfilled; } catch { patch.undo(); }                     // roll back on failure
  },
}),
```
```ts Lazy-loaded slices (RTK 2 combineSlices)
import { combineSlices } from '@reduxjs/toolkit';
export const rootReducer = combineSlices(todosSlice, api).withLazyLoadedSlices<LazySlices>();
// In a route chunk: rootReducer.inject(reportsSlice);
```
```ts redux-persist (only persist what you must)
const persisted = persistReducer({ key: 'root', storage, whitelist: ['auth', 'settings'] }, rootReducer);
// remember to ignore redux-persist actions in the serializableCheck middleware option
```

## Testing Redux Code

Test **reducers and selectors as pure functions**, and test **components with a real store**. That's better than mocking `useSelector`.

```ts todosSlice.test.ts
import reducer, { added, toggled } from './todosSlice';
test('toggles a todo', () => {
  const s1 = reducer(undefined, added('Write tests'));
  const id = s1.items[0].id;
  const s2 = reducer(s1, toggled(id));
  expect(s2.items[0].done).toBe(true);
  expect(s1.items[0].done).toBe(false);          // previous state untouched (immutability)
});
```
```tsx test-utils.tsx
export function renderWithStore(ui: React.ReactElement, preloadedState?: Partial<RootState>) {
  const store = configureStore({ reducer: { todos }, preloadedState });
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}
test('clicking a todo marks it done', async () => {
  const { store } = renderWithStore(<TodoList />, { todos: { items: [{ id: '1', text: 'A', done: false }], filter: 'all' } });
  await userEvent.click(screen.getByText('A'));
  expect(store.getState().todos.items[0].done).toBe(true);
});
```

## Redux vs Context vs Zustand vs Server-State Libraries

| Tool | Best for | Trade-off |
|---|---|---|
| React state / Context | local or rarely-changing global values (theme, user) | every consumer re-renders when the context value changes |
| Redux Toolkit | large apps, many teams, complex client state, time-travel debugging, strict patterns | more concepts to learn |
| Zustand / Jotai | small to medium global state with minimal API | fewer conventions and devtools |
| RTK Query / TanStack Query | **server state** (cache, refetch, invalidation) | not a general client-state store |

```ts The same counter in Zustand, for comparison
import { create } from 'zustand';
const useCounter = create<{ n: number; inc: () => void }>((set) => ({ n: 0, inc: () => set((s) => ({ n: s.n + 1 })) }));
```

# Interview Questions

## Beginner

### What is Redux and what problem does it solve?

Redux is a predictable state container. All shared state lives in one store, and it changes only when you dispatch actions to pure reducers. This makes state changes traceable, debuggable (time travel in DevTools) and testable. It solves the "who changed this state, and when?" problem that appears when many components share and mutate data.

```js
store.dispatch({ type: 'cart/itemAdded', payload: { sku: 'A1' } });
// DevTools shows: action → state diff → you can replay or skip it
```

### What are the three principles of Redux?

A single source of truth (one store), state is read-only (change it only by dispatching actions), and changes are made with pure reducer functions.

```js
const reducer = (state = 0, action) => (action.type === 'inc' ? state + 1 : state); // pure
store.getState();          // read
store.dispatch({ type: 'inc' }); // the only way to change it
```

### What is an action and an action creator?

An action is a plain object with a `type` (and an optional `payload`) that describes something that happened. An action creator is a function that builds one. `createSlice` generates them for you.

```js
const itemAdded = (sku) => ({ type: 'cart/itemAdded', payload: { sku } });  // action creator
dispatch(itemAdded('A1'));                                                   // dispatches { type, payload }
itemAdded.type;   // with RTK: 'cart/itemAdded'
```

### What is a reducer and why must it be pure?

A reducer is a `(state, action) => newState` function. It must be pure (no side effects, no mutation, the same output for the same input) so that Redux can compare references to detect changes, DevTools can replay actions, and tests stay deterministic.

```js
// ❌ impure: mutates and calls Date.now()
function bad(state, action) { state.items.push({ ...action.payload, at: Date.now() }); return state; }
// ✅ pure
function good(state, action) { return { ...state, items: [...state.items, action.payload] }; }
```

### What is Redux Toolkit and why is it recommended?

RTK is the official toolset for writing Redux. `configureStore` adds DevTools, thunks and safety checks. `createSlice` generates actions and reducers and uses Immer for mutable-looking updates. `createAsyncThunk` handles async request lifecycles, `createEntityAdapter` handles normalised collections, and RTK Query handles data fetching. Together they remove most boilerplate and common bugs.

```ts
const slice = createSlice({ name: 'counter', initialState: { n: 0 }, reducers: { inc: (s) => { s.n++; } } });
export const store = configureStore({ reducer: { counter: slice.reducer } });
```

### What do useSelector and useDispatch do?

`useSelector` subscribes a component to part of the store and re-renders it when the selected value changes (compared with `===`). `useDispatch` returns the store's `dispatch` function.

```tsx
const count = useSelector((s: RootState) => s.counter.n);
const dispatch = useDispatch();
<button onClick={() => dispatch(inc())}>{count}</button>
```

### How does Immer let you "mutate" state in createSlice?

Immer gives your reducer a **draft** proxy. It records the changes you make to the draft and produces a new, structurally shared immutable object. Only the changed paths get new references. You must either mutate the draft or return a new value, never both.

```ts
reducers: {
  renamed(state, action) { state.user.name = action.payload; },   // ✅ mutate the draft
  reset() { return initialState; },                                 // ✅ return a replacement
  // ❌ (state) => { state.n++; return { ...state } }               // both → error
}
```

## Intermediate

### How do you handle async logic in Redux?

Use middleware. Thunks (built into RTK) handle most cases. `createAsyncThunk` dispatches pending/fulfilled/rejected actions, and RTK Query handles server data with caching. For complex workflows, use the listener middleware or redux-saga.

```ts
export const saveOrder = createAsyncThunk('orders/save', async (order: Order) => (await api.post('/orders', order)).data);
builder.addCase(saveOrder.fulfilled, (s, a) => { s.items.push(a.payload); });
await dispatch(saveOrder(order)).unwrap();
```

### What is createSelector and when do you need it?

`createSelector` (from Reselect) builds memoised selectors. It recomputes only when its input selectors return new references. You need it when a selector derives a new array or object, such as a filtered list. Without it, `useSelector` sees a new reference on every update and re-renders.

```ts
const selectExpensive = createSelector([(s: RootState) => s.products.items], (items) => items.filter((p) => p.price > 100));
```

### Why normalise state and how?

Nested and duplicated data makes updates error-prone (an author's name stored in 50 posts). Normalise into `ids` and `entities` maps keyed by id, and reference related items by id. `createEntityAdapter` provides CRUD reducers and selectors for this shape.

```ts
// { posts: { ids: ['p1'], entities: { p1: { id: 'p1', authorId: 'u1' } } }, users: { entities: { u1: { name: 'Ada' } } } }
const author = useSelector((s) => s.users.entities[post.authorId]);
```

### RTK Query vs createAsyncThunk?

Use `createAsyncThunk` for one-off async workflows whose results feed your own reducers. RTK Query is a full data-fetching and caching layer: auto-generated hooks, request de-duplication, cache lifetimes, polling, re-fetch on focus, tag-based invalidation and optimistic updates. Prefer RTK Query for server state.

```ts
const { data, isFetching, refetch } = useGetOrdersQuery({ page }, { refetchOnFocus: true });
```

### What is middleware in Redux? Write one.

Middleware wraps `dispatch`. It can inspect, delay, transform or stop actions, and run side effects. Its shape is `store => next => action => result`.

```ts
const analytics: Middleware = () => (next) => (action) => {
  if (typeof action === 'object' && action && 'type' in action && String(action.type).startsWith('checkout/')) track(action.type);
  return next(action);
};
```

### What state should NOT go into Redux?

Ephemeral UI state (an input's value while typing, open/closed toggles used by one component), non-serializable values (class instances, Promises, DOM nodes, functions), and server cache data you can keep in RTK Query or TanStack Query. Put state in Redux when many distant components need it or when you need to trace changes.

```tsx
const [query, setQuery] = useState('');          // local: one component
const user = useAppSelector((s) => s.auth.user); // global: many components
```

## Advanced

### How does useSelector decide to re-render, and how do you avoid unnecessary renders?

After every dispatched action, each `useSelector` runs its selector and compares the result with the previous one using `===` (or a custom equality function). Avoid unnecessary renders by selecting the smallest piece you need, memoising derived data with `createSelector`, using `shallowEqual` for small objects, and splitting components so each subscribes narrowly.

```tsx
import { shallowEqual } from 'react-redux';
const { name, avatar } = useAppSelector((s) => ({ name: s.user.name, avatar: s.user.avatar }), shallowEqual);
```

### Explain RTK Query cache tags and invalidation.

Queries declare which data they `providesTags` (for example `{type: 'Post', id}`). Mutations declare `invalidatesTags`. When a mutation succeeds, every active query that provides a matching tag is re-fetched automatically. Use a `LIST` id for "the collection changed" and item ids for single updates.

```ts
getPost: build.query<Post, string>({ query: (id) => `posts/${id}`, providesTags: (r, e, id) => [{ type: 'Post', id }] }),
updatePost: build.mutation<Post, Post>({ query: (p) => ({ url: `posts/${p.id}`, method: 'PUT', body: p }), invalidatesTags: (r, e, p) => [{ type: 'Post', id: p.id }] }),
```

### Thunks vs sagas vs listener middleware?

Thunks are simple async functions, and they're enough for most request flows. Redux-saga uses generator-based effects that are powerful for complex orchestration (races, cancellation, channels) but add complexity. The RTK listener middleware reacts to actions with async effects, cancellation and debouncing, and covers most saga use cases with less code.

```ts
listener.startListening({ actionCreator: searchChanged, effect: async (a, api) => {
  api.cancelActiveListeners(); await api.delay(300);
  api.dispatch(api.extra.search(a.payload));           // debounced search
}});
```

### How would you structure Redux in a large application?

Organise by feature ("ducks"): each feature folder owns its slice, selectors, thunks and API endpoints, and exports only a public API. Use one `createApi` with `injectEndpoints` per feature, lazy-load slices for code-split routes, keep state normalised and minimal, use typed hooks, and test reducers and selectors in isolation.

```ts
// features/orders/ordersApi.ts
export const ordersApi = api.injectEndpoints({ endpoints: (b) => ({ getOrders: b.query<Order[], void>({ query: () => 'orders' }) }) });
```

### Why does Redux require serializable state and actions?

So that DevTools can record, display and replay history, persistence libraries can save and restore state, and SSR can send state to the client. Non-serializable values (Dates, Maps, class instances) break time travel and equality checks. Store ISO strings or ids instead.

```ts
dispatch(eventScheduled({ at: new Date().toISOString() }));   // ✅ string, not a Date object
```

# Scenario Questions

## Beginner

### A component doesn't update after you dispatch an action, even though the action shows in DevTools. What's wrong?

Usually the reducer **mutated** state and returned the same reference (plain Redux), or returned without changing the selected slice. Another common cause is that the component selects a different path than the one you updated. With RTK, mutate the draft. In plain Redux, always return new objects.

```js
// ❌ same reference → useSelector sees no change
case 'todos/toggled': state.items[0].done = true; return state;
// ✅
case 'todos/toggled': return { ...state, items: state.items.map((t, i) => (i === 0 ? { ...t, done: true } : t)) };
```

## Intermediate

### A list page re-renders every component whenever anything in the store changes. How do you fix it?

The selector creates a new array each time (`filter`/`map` inside `useSelector`), or the parent selects a large object and passes it down. Memoise the derived data with `createSelector`. Have each row select its own item by id, and wrap rows in `React.memo`.

```tsx
const selectIds = createSelector([selectVisibleTodos], (todos) => todos.map((t) => t.id));
function List() { const ids = useAppSelector(selectIds, shallowEqual); return ids.map((id) => <Row key={id} id={id} />); }
const Row = React.memo(({ id }: { id: string }) => { const t = useAppSelector((s) => s.todos.entities[id]); return <li>{t.text}</li>; });
```

### Two components fire the same API request when the page loads. How do you de-duplicate?

Move the call to RTK Query. Multiple subscribers to the same query and arguments share one request and one cache entry. With thunks, use the `condition` option to skip the request when it's already loading or cached.

```ts
export const fetchProfile = createAsyncThunk('profile/fetch', fetchProfileApi, {
  condition: (_, { getState }) => (getState() as RootState).profile.status !== 'loading',
});
```

## Advanced

### After logout, the next user briefly sees the previous user's data. How do you reset Redux correctly?

Handle a global `logout` action in a root reducer that returns `undefined` for the whole state (each slice then falls back to its initial state). Also reset the RTK Query cache and clear persisted storage.

```ts
const appReducer = combineReducers({ auth, todos, [api.reducerPath]: api.reducer });
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: UnknownAction) =>
  appReducer(action.type === 'auth/logout' ? undefined : state, action);
// on logout: dispatch(api.util.resetApiState()); persistor.purge();
```

# Tricky Questions

## Beginner

### What's wrong with `reducers: { add(state, action) { state.items.push(action.payload); return state; } }` in createSlice?

Nothing breaks in this case. Returning the same draft is allowed. What's forbidden is mutating the draft **and** returning a *different* new object. The idiomatic form doesn't return at all. The real bug in plain Redux (no Immer) would be the mutation itself.

```ts
add(state, action) { state.items.push(action.payload); }               // ✅ idiomatic
add(state, action) { state.items.push(action.payload); return { ...state }; } // ❌ Immer throws
```

## Intermediate

### Why does `useSelector(s => ({ user: s.user, cart: s.cart }))` cause a re-render on every action?

The selector returns a **new object literal** on every call, so the `===` check always fails. Select the values separately, or pass `shallowEqual` as the equality function.

```tsx
const user = useAppSelector((s) => s.user);
const cart = useAppSelector((s) => s.cart);
```

## Advanced

### Can you put a `Date` or a `Map` in Redux state?

RTK's `serializableCheck` middleware warns about it, because DevTools, persistence and SSR expect plain JSON. Equality and time travel also become unreliable. Store an ISO string, a timestamp, or a plain object or array instead, and convert in selectors.

```ts
const selectDueDate = (s: RootState) => new Date(s.task.dueAt);   // convert when reading
```
