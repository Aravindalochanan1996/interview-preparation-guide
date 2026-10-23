---
id: ngrx
title: NgRx (Redux for Angular)
short: NgRx
category: Frontend Frameworks
order: 7.5
color: #ba2bd2
icon: Nx
summary: Angular's Redux-style state management: Store, actions, reducers, selectors, effects, entity, NgRx SignalStore and ComponentStore, testing and when to use each.
---

# Beginner

## What NgRx Is and When to Use It

**NgRx** is a set of libraries for reactive state management in Angular. `@ngrx/store` follows the Redux pattern: one immutable store, **actions** describing events, pure **reducers**, **selectors** to read state, and **effects** for side effects. It's built on RxJS and also has Signals integration.

```text
Component ──dispatch(action)──▶ Store ──reducer──▶ new State ──selector──▶ Component (Observable/Signal)
                    │
                    └──▶ Effect (API call) ──▶ success/failure action ──▶ Store
```

| Option | Use when |
|---|---|
| Plain service + signals | small or medium apps, local feature state |
| `@ngrx/signals` (SignalStore) | feature or global state with a light API, signals-first |
| `@ngrx/component-store` | state scoped to one component subtree |
| `@ngrx/store` + effects | large apps, many teams, complex async flows, DevTools time travel |

```bash
ng add @ngrx/store@latest
ng add @ngrx/effects@latest
ng add @ngrx/store-devtools@latest
ng add @ngrx/signals@latest
```

## Actions with createActionGroup

Actions are unique events. Name them by **source** and **event** (`[Products Page] Opened`), not by command.

```ts products.actions.ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const ProductsPageActions = createActionGroup({
  source: 'Products Page',
  events: {
    'Opened': emptyProps(),
    'Search Changed': props<{ query: string }>(),
    'Product Selected': props<{ id: string }>(),
  },
});
export const ProductsApiActions = createActionGroup({
  source: 'Products API',
  events: {
    'Load Success': props<{ products: Product[] }>(),
    'Load Failure': props<{ error: string }>(),
  },
});
// ProductsPageActions.searchChanged({ query: 'shoes' }) → { type: '[Products Page] Search Changed', query: 'shoes' }
```

## Reducers with createReducer and createFeature

Reducers are pure functions that return a new state. `createFeature` also generates a selector for each state property.

```ts products.feature.ts
import { createFeature, createReducer, on } from '@ngrx/store';

export interface ProductsState { products: Product[]; query: string; selectedId: string | null; loading: boolean; error: string | null }
const initialState: ProductsState = { products: [], query: '', selectedId: null, loading: false, error: null };

export const productsFeature = createFeature({
  name: 'products',
  reducer: createReducer(
    initialState,
    on(ProductsPageActions.opened, (s) => ({ ...s, loading: true, error: null })),
    on(ProductsPageActions.searchChanged, (s, { query }) => ({ ...s, query })),
    on(ProductsPageActions.productSelected, (s, { id }) => ({ ...s, selectedId: id })),
    on(ProductsApiActions.loadSuccess, (s, { products }) => ({ ...s, products, loading: false })),
    on(ProductsApiActions.loadFailure, (s, { error }) => ({ ...s, error, loading: false })),
  ),
});
// Generated: productsFeature.selectProducts, selectQuery, selectLoading, selectProductsState …
```
```ts app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(),
    provideState(productsFeature),
    provideEffects(productsEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
  ],
};
```

## Reading State in Components: select and selectSignal

```ts products-page.component.ts
@Component({
  selector: 'app-products-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input [value]="query()" (input)="onSearch($any($event.target).value)" />
    @if (loading()) { <app-spinner /> }
    @for (p of products(); track p.id) {
      <app-product-card [product]="p" (click)="select(p.id)" />
    }
  `,
})
export class ProductsPageComponent {
  private store = inject(Store);
  products = this.store.selectSignal(selectFilteredProducts);   // Signal<Product[]>
  loading = this.store.selectSignal(productsFeature.selectLoading);
  query = this.store.selectSignal(productsFeature.selectQuery);
  products$ = this.store.select(selectFilteredProducts);         // Observable alternative (async pipe)

  constructor() { this.store.dispatch(ProductsPageActions.opened()); }
  onSearch(query: string) { this.store.dispatch(ProductsPageActions.searchChanged({ query })); }
  select(id: string) { this.store.dispatch(ProductsPageActions.productSelected({ id })); }
}
```

# Intermediate

## Selectors and Memoisation

Selectors are **memoised** pure functions. `createSelector` recomputes only when its input selectors return new values.

```ts products.selectors.ts
import { createSelector } from '@ngrx/store';
const { selectProducts, selectQuery, selectSelectedId } = productsFeature;

export const selectFilteredProducts = createSelector(selectProducts, selectQuery, (products, query) =>
  products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
);
export const selectSelectedProduct = createSelector(selectProducts, selectSelectedId, (products, id) =>
  products.find((p) => p.id === id) ?? null,
);
export const selectProductsViewModel = createSelector({   // one view model for the template
  products: selectFilteredProducts,
  loading: productsFeature.selectLoading,
  selected: selectSelectedProduct,
});
// Parameterised selector (factory): one memoised instance per id
export const selectProductById = (id: string) => createSelector(selectProducts, (ps) => ps.find((p) => p.id === id));
```

## Effects for Side Effects

**Effects** listen to the action stream, run side effects (HTTP, routing, storage) and usually dispatch new actions. Keep components and reducers free of side effects.

```ts products.effects.ts
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, debounceTime, exhaustMap, map, of, switchMap, tap } from 'rxjs';

export const loadProducts = createEffect(
  (actions$ = inject(Actions), api = inject(ProductsApi)) =>
    actions$.pipe(
      ofType(ProductsPageActions.opened),
      exhaustMap(() =>                                    // ignore re-opens while loading
        api.getAll().pipe(
          map((products) => ProductsApiActions.loadSuccess({ products })),
          catchError((e) => of(ProductsApiActions.loadFailure({ error: e.message }))),   // inside the inner pipe
        ),
      ),
    ),
  { functional: true },
);

export const searchProducts = createEffect(
  (actions$ = inject(Actions), api = inject(ProductsApi)) =>
    actions$.pipe(
      ofType(ProductsPageActions.searchChanged),
      debounceTime(300),
      switchMap(({ query }) => api.search(query).pipe(            // cancel the previous search
        map((products) => ProductsApiActions.loadSuccess({ products })),
        catchError((e) => of(ProductsApiActions.loadFailure({ error: e.message }))),
      )),
    ),
  { functional: true },
);

export const navigateOnSelect = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(ofType(ProductsPageActions.productSelected), tap(({ id }) => router.navigate(['/products', id]))),
  { functional: true, dispatch: false },                          // no action emitted
);
```

> [!WARN]
> Put `catchError` **inside** the inner observable (after `api.getAll()`). If you put it on the outer stream, the first error completes the effect and it stops listening forever.

## @ngrx/entity for Collections

```ts
import { createEntityAdapter, EntityState } from '@ngrx/entity';

export interface OrdersState extends EntityState<Order> { loading: boolean }
export const adapter = createEntityAdapter<Order>({ sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt) });
const initialState: OrdersState = adapter.getInitialState({ loading: false });

export const ordersFeature = createFeature({
  name: 'orders',
  reducer: createReducer(initialState,
    on(OrdersApiActions.loaded, (s, { orders }) => adapter.setAll(orders, { ...s, loading: false })),
    on(OrdersApiActions.updated, (s, { order }) => adapter.upsertOne(order, s)),
    on(OrdersPageActions.removed, (s, { id }) => adapter.removeOne(id, s)),
  ),
  extraSelectors: ({ selectOrdersState }) => ({ ...adapter.getSelectors(selectOrdersState) }),  // selectAll, selectEntities, selectTotal
});
```

## NgRx SignalStore

`@ngrx/signals` gives you a lightweight, signal-based store built from composable features. It's a strong default for feature state in modern Angular.

```ts todos.store.ts
import { signalStore, withState, withComputed, withMethods, patchState, withHooks } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';

type TodosState = { todos: Todo[]; filter: 'all' | 'done'; loading: boolean };

export const TodosStore = signalStore(
  { providedIn: 'root' },
  withState<TodosState>({ todos: [], filter: 'all', loading: false }),
  withComputed(({ todos, filter }) => ({
    visible: computed(() => (filter() === 'done' ? todos().filter((t) => t.done) : todos())),
    doneCount: computed(() => todos().filter((t) => t.done).length),
  })),
  withMethods((store, api = inject(TodosApi)) => ({
    toggle(id: string) {
      patchState(store, (s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
    },
    setFilter(filter: TodosState['filter']) { patchState(store, { filter }); },
    load: rxMethod<void>(pipe(
      tap(() => patchState(store, { loading: true })),
      switchMap(() => api.getAll().pipe(tapResponse({
        next: (todos) => patchState(store, { todos, loading: false }),
        error: () => patchState(store, { loading: false }),
      }))),
    )),
  })),
  withHooks({ onInit: (store) => store.load() }),
);
```
```ts
@Component({ template: `@for (t of store.visible(); track t.id) { <li (click)="store.toggle(t.id)">{{ t.title }}</li> }` })
export class TodosComponent { readonly store = inject(TodosStore); }
```

# Advanced

## ComponentStore for Local State

`@ngrx/component-store` scopes state to a component and its children. Each component instance gets its own store, which is destroyed with the component.

```ts
interface PagerState { page: number; pageSize: number; rows: Row[] }

@Injectable()
export class TableStore extends ComponentStore<PagerState> {
  constructor(private api: RowsApi) { super({ page: 1, pageSize: 20, rows: [] }); }
  readonly rows = this.selectSignal((s) => s.rows);
  readonly nextPage = this.updater((s) => ({ ...s, page: s.page + 1 }));
  readonly load = this.effect<number>((page$) =>
    page$.pipe(switchMap((page) => this.api.page(page).pipe(tapResponse((rows) => this.patchState({ rows }), console.error)))),
  );
}
@Component({ providers: [TableStore], template: `…` })
export class DataTableComponent { store = inject(TableStore); }
```

## Router Store, Meta-Reducers and Runtime Checks

```ts
provideStore({ router: routerReducer }, {
  metaReducers: isDevMode() ? [logger] : [],
  runtimeChecks: { strictStateImmutability: true, strictActionImmutability: true, strictStateSerializability: true },
}),
provideRouterStore(),
```
```ts Meta-reducer: wraps every reducer (logging, reset on logout)
export function clearOnLogout(reducer: ActionReducer<any>): ActionReducer<any> {
  return (state, action) => reducer(action.type === AuthActions.logout.type ? undefined : state, action);
}
export const selectRouteParam = getRouterSelectors().selectRouteParam;   // selectRouteParam('id')
```

## Testing NgRx

```ts Reducer: pure function
it('stores products on load success', () => {
  const state = productsFeature.reducer(undefined, ProductsApiActions.loadSuccess({ products: [p1] }));
  expect(state.products).toEqual([p1]);
  expect(state.loading).toBe(false);
});
```
```ts Selector: call the projector directly
it('filters by query', () => {
  expect(selectFilteredProducts.projector([shoe, shirt], 'sho')).toEqual([shoe]);
});
```
```ts Effect with provideMockActions
it('dispatches loadFailure on error', () => {
  const actions$ = of(ProductsPageActions.opened());
  const api = { getAll: () => throwError(() => new Error('boom')) } as unknown as ProductsApi;
  TestBed.runInInjectionContext(() => {
    loadProducts(actions$, api).subscribe((a) => expect(a).toEqual(ProductsApiActions.loadFailure({ error: 'boom' })));
  });
});
```
```ts Component with MockStore
TestBed.configureTestingModule({ providers: [provideMockStore({ selectors: [{ selector: selectFilteredProducts, value: [shoe] }] })] });
const store = TestBed.inject(MockStore);
spyOn(store, 'dispatch');
// click → expect(store.dispatch).toHaveBeenCalledWith(ProductsPageActions.productSelected({ id: shoe.id }))
```

## NgRx vs Redux Toolkit vs Services with Signals

| Concept | Redux Toolkit (React) | NgRx Store (Angular) | NgRx SignalStore |
|---|---|---|---|
| define state + updates | `createSlice` | `createActionGroup` + `createReducer`/`createFeature` | `withState` + `patchState` |
| derived data | `createSelector` | `createSelector` | `withComputed` |
| side effects | thunks / listener middleware | effects (RxJS) | `rxMethod`, methods |
| read in UI | `useSelector` | `store.select` / `selectSignal` | signals on the store |
| server cache | RTK Query | (effects or a separate library) | (methods) |

```ts Simple shared state without NgRx
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<Item[]>([]);
  readonly items = this._items.asReadonly();
  readonly total = computed(() => this._items().reduce((s, i) => s + i.price, 0));
  add(i: Item) { this._items.update((xs) => [...xs, i]); }
}
```

# Interview Questions

## Beginner

### What is NgRx?

A library family for reactive state management in Angular, inspired by Redux. Store holds immutable global state, actions describe events, reducers compute new state, selectors read it, and effects isolate side effects. It also includes DevTools, entity, router-store, ComponentStore and SignalStore.

```ts
this.store.dispatch(CartActions.itemAdded({ sku: 'A1' }));
total = this.store.selectSignal(selectCartTotal);
```

### What's the role of actions in NgRx?

Actions are unique, serializable events (`[Source] Event`) that the store and effects react to. Good actions describe *what happened* ("[Checkout Page] Pay Clicked"), not commands ("setLoading"). That keeps DevTools logs meaningful and lets several reducers and effects respond.

```ts
export const CheckoutActions = createActionGroup({ source: 'Checkout Page', events: { 'Pay Clicked': props<{ total: number }>() } });
```

### What is a reducer in NgRx?

A pure function created with `createReducer` and `on(action, (state, props) => newState)`. It must return new objects (no mutation) and never call APIs.

```ts
const reducer = createReducer({ count: 0 }, on(CounterActions.increment, (s) => ({ ...s, count: s.count + 1 })));
```

### What are selectors and why are they memoised?

Selectors are pure functions that read and derive data from state. `createSelector` caches the last result and returns it again when its inputs are unchanged. This avoids expensive recalculations and keeps reference equality stable, so OnPush components don't re-render needlessly.

```ts
export const selectCartTotal = createSelector(selectCartItems, (items) => items.reduce((t, i) => t + i.price * i.qty, 0));
```

### store.select vs store.selectSignal?

`select` returns an Observable, which you use with the `async` pipe or RxJS operators. `selectSignal` returns a Signal that you read in templates as `value()`, without subscriptions. It works well with zoneless and OnPush change detection.

```ts
user$ = this.store.select(selectUser);          // {{ user$ | async }}
user = this.store.selectSignal(selectUser);     // {{ user()?.name }}
```

## Intermediate

### What are effects and why use them?

Effects are injectable streams that listen to actions, perform side effects (HTTP, storage, navigation, timers) and map the results to new actions. They keep components and reducers pure and make async flows testable.

```ts
export const save$ = createEffect((a$ = inject(Actions), api = inject(Api)) =>
  a$.pipe(ofType(FormActions.submit), concatMap(({ form }) => api.save(form).pipe(
    map(() => FormActions.saveSuccess()), catchError((e) => of(FormActions.saveFailure({ error: e.message })))))),
  { functional: true });
```

### Which flattening operator should an effect use?

`switchMap` cancels the previous request, so use it for searches and reads where only the latest matters. `concatMap` queues requests in order, so use it for saves that must not interleave. `mergeMap` runs requests in parallel (independent deletes). `exhaustMap` ignores new triggers while one is running (login, "load once").

```ts
ofType(SearchActions.changed), switchMap(...)    // typeahead
ofType(CartActions.add), concatMap(...)          // ordered writes
ofType(AuthActions.login), exhaustMap(...)       // prevent double submit
```

### What does createFeature give you?

It bundles a feature name and a reducer, and auto-generates a feature selector plus a selector for every top-level state property. `extraSelectors` lets you add derived selectors in the same place.

```ts
export const authFeature = createFeature({ name: 'auth', reducer, extraSelectors: ({ selectUser }) => ({ selectIsLoggedIn: createSelector(selectUser, (u) => !!u) }) });
// authFeature.selectUser, authFeature.selectIsLoggedIn
```

### What is @ngrx/entity?

An adapter for normalised collections (`ids` + `entities`). It provides reducer helpers (`addOne`, `setAll`, `upsertMany`, `removeOne`, `updateOne`) and selectors (`selectAll`, `selectEntities`, `selectTotal`), with optional sorting.

```ts
on(UsersApiActions.loaded, (s, { users }) => adapter.setAll(users, s))
```

### What is SignalStore and how is it different from Store?

SignalStore (`@ngrx/signals`) is a functional, signal-based store composed of features (`withState`, `withComputed`, `withMethods`, `withHooks`, `withEntities`). It has no actions or reducers. State changes happen through `patchState` in methods. It's lighter and more local. The classic Store gives you a global, action-driven event log with effects and DevTools time travel.

```ts
const CounterStore = signalStore(withState({ n: 0 }), withMethods((s) => ({ inc: () => patchState(s, (st) => ({ n: st.n + 1 })) })));
```

## Advanced

### Why must catchError be inside the inner observable in an effect?

If an error reaches the outer action stream, that stream errors and completes. The effect is then dead: no further actions get handled. Catching inside the inner `api.call().pipe(catchError(...))` turns the error into a failure action, and the outer stream keeps running.

```ts
a$.pipe(ofType(X), switchMap(() => api.get().pipe(map(ok), catchError((e) => of(fail(e))))))   // ✅
// a$.pipe(ofType(X), switchMap(() => api.get()), map(ok), catchError(...))                  // ❌ dies after one error
```

### How do you reset the whole store on logout?

Use a meta-reducer that passes `undefined` to the root reducer when it sees the logout action, so every feature falls back to its initial state. Also clear browser storage and any caches.

```ts
export const resetOnLogout: MetaReducer = (reducer) => (state, action) =>
  reducer(action.type === AuthActions.logout.type ? undefined : state, action);
provideStore(reducers, { metaReducers: [resetOnLogout] });
```

### How do you test effects?

Call functional effects directly with fake `Actions` and services, or use `provideMockActions` with marble testing (`jasmine-marbles` or the RxJS `TestScheduler`) to assert timing, debouncing and cancellation.

```ts
testScheduler.run(({ hot, cold, expectObservable }) => {
  const actions$ = hot('-a', { a: SearchActions.changed({ q: 'x' }) });
  const api = { search: () => cold('--r|', { r: [item] }) };
  expectObservable(searchEffect(actions$, api as any)).toBe('---s', { s: SearchApiActions.success({ items: [item] }) });
});
```

### When is NgRx overkill?

When state is local to one feature, flows are simple CRUD, or the team is small. Then a signal-based service or SignalStore is simpler. NgRx Store pays off with many shared slices, complex async orchestration, a need for audit and time-travel debugging, and large teams that benefit from strict conventions.

```ts
// Often enough:
@Injectable({ providedIn: 'root' }) export class ThemeService { theme = signal<'light' | 'dark'>('light'); }
```

# Scenario Questions

## Beginner

### A component shows stale data after an effect succeeds. The success action appears in DevTools. What do you check?

Check that the reducer actually handles that action (the `on()` is registered for the right action creator), that the feature is provided with `provideState`, and that the reducer returns a new reference instead of mutating. Also check that the component selects the slice the reducer writes to.

```ts
on(ProductsApiActions.loadSuccess, (s, { products }) => ({ ...s, products }))   // must exist and return a new object
provideState(productsFeature)                                                     // must be registered
```

## Intermediate

### Search results flicker and show results for an older query. How do you fix it?

The effect uses `mergeMap`, so slow older requests resolve after newer ones. Switch to `switchMap` (which cancels stale requests) and add `debounceTime` and `distinctUntilChanged`.

```ts
ofType(SearchActions.changed), debounceTime(300), distinctUntilChanged((a, b) => a.query === b.query),
switchMap(({ query }) => api.search(query).pipe(map((r) => SearchApiActions.success({ r })), catchError(() => of(SearchApiActions.failure()))))
```

### An effect stops working after the first HTTP error. Why?

`catchError` is on the outer stream, so the first error completes the effect's observable. Move error handling into the inner HTTP observable and return a failure action.

```ts
switchMap(() => api.load().pipe(map(loaded), catchError((e) => of(loadFailed({ error: e.message })))))
```

## Advanced

### Your team wants to migrate a large NgRx Store app to signals. What's the plan?

Start with `selectSignal` in components, which needs no store changes. Then move new or local features to SignalStore or ComponentStore, while keeping truly global, event-driven state (auth, cart, cross-feature workflows) in Store with effects. Bridge with `toSignal` and `rxMethod`, and migrate feature by feature behind tests.

```ts
user = this.store.selectSignal(selectUser);                 // step 1: signals at the edge
export const FiltersStore = signalStore(withState({ q: '' })); // step 2: new local state
```

# Tricky Questions

## Beginner

### Is it fine to call the API inside a reducer?

No. Reducers must be pure and synchronous. API calls belong in effects (or SignalStore methods). Side effects in reducers break time travel and testing, and can run multiple times.

```ts
on(Load, (s) => { http.get('/x'); return s; })   // ❌ never
```

## Intermediate

### Why does a parameterised selector created inline in a template method re-run constantly?

Calling `createSelector` inside a method or template binding creates a **new selector with an empty cache** every time, so memoisation never helps. Create it once (in a field or with a factory that's cached per id).

```ts
product = this.store.selectSignal(selectProductById(this.id));   // created once in the field initialiser
```

## Advanced

### With `strictStateImmutability`, why does `state.items.push(x); return { ...state };` throw in development?

The runtime check freezes state objects in development. `push` mutates the frozen `items` array even though you return a new outer object. Create a new array: `{ ...state, items: [...state.items, x] }`.

```ts
on(Add, (s, { x }) => ({ ...s, items: [...s.items, x] }))
```
