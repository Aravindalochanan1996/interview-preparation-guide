---
id: angular
title: Angular
short: Angular
category: Frontend Frameworks
order: 7
color: #dd0031
icon: Ng
summary: Standalone components, templates, DI, RxJS, Signals, routing, forms, change detection, zoneless, SSR and enterprise architecture.
---

# Beginner

## What Angular Is

Angular is a **complete, opinionated framework** by Google for building SPAs with TypeScript. Unlike React (a library), it ships with routing, forms, HTTP client, DI, testing tools and a CLI.

| Angular | React |
|---|---|
| Full framework, batteries included | UI library + ecosystem choices |
| TypeScript first | JS or TS |
| HTML templates with directives | JSX |
| Dependency injection built in | Context / props |
| RxJS + Signals for reactivity | hooks + state libs |

### Versions
"AngularJS" (1.x, 2010) is a different, obsolete framework. "Angular" (2+) is a full rewrite. Modern Angular (v17–v20+) uses **standalone components, Signals, new control flow (`@if`, `@for`), deferrable views and zoneless change detection**.

### CLI
```bash
npm i -g @angular/cli
ng new shop --style=scss --ssr
ng serve                 # dev server
ng generate component product-card    # ng g c
ng g service cart        # ng g s
ng build                 # production build (esbuild + Vite)
ng test / ng e2e
```

## Components and Templates

```ts product-card.component.ts
import { Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-product-card',
  standalone: true,                  // default since v19
  imports: [CurrencyPipe],
  template: `
    <article class="card">
      <h3>{{ product().name }}</h3>
      <p>{{ product().price | currency:'INR' }}</p>
      <button (click)="add.emit(product())" [disabled]="!product().inStock">Add to cart</button>
    </article>
  `,
  styles: [`.card { padding: 1rem; }`],
})
export class ProductCardComponent {
  product = input.required<Product>();   // signal input
  add = output<Product>();
}
```

A component = **TypeScript class + template + styles + metadata**. Styles are **encapsulated** by default (emulated Shadow DOM via attribute selectors).

### Data binding

| Syntax | Direction | Example |
|---|---|---|
| `{{ expr }}` | class → view (interpolation) | `{{ user.name }}` |
| `[prop]="expr"` | class → view (property binding) | `[src]="imageUrl"` |
| `(event)="handler()"` | view → class (event binding) | `(click)="save()"` |
| `[(ngModel)]="field"` | two-way ("banana in a box") | `[(ngModel)]="name"` |
| `[attr.x]`, `[class.x]`, `[style.x]` | attribute/class/style | `[class.active]="isActive"` |

## Control Flow, Directives and Pipes

### Built-in control flow (v17+)
```html
@if (user(); as u) {
  <p>Welcome {{ u.name }}</p>
} @else if (loading()) {
  <app-spinner />
} @else {
  <a routerLink="/login">Log in</a>
}

@for (item of items(); track item.id; let i = $index) {
  <li>{{ i + 1 }}. {{ item.title }}</li>
} @empty {
  <li>No items</li>
}

@switch (status()) {
  @case ('active') { <span>Active</span> }
  @default { <span>Unknown</span> }
}
```
`track` is required in `@for` (like React keys). The older `*ngIf`/`*ngFor` structural directives still work.

### Directives
- **Components** — directives with templates.
- **Attribute directives** change appearance/behaviour: `ngClass`, `ngStyle`, or custom:
```ts
@Directive({ selector: '[appHighlight]', host: { '(mouseenter)': 'on()', '(mouseleave)': 'off()' } })
export class HighlightDirective {
  private el = inject(ElementRef);
  color = input('yellow', { alias: 'appHighlight' });
  on() { this.el.nativeElement.style.background = this.color(); }
  off() { this.el.nativeElement.style.background = ''; }
}
```
- **Structural directives** change DOM structure (`*ngIf`, custom ones with `TemplateRef` + `ViewContainerRef`).

### Pipes
Transform values in templates: `date`, `currency`, `uppercase`, `json`, `async`, `percent`, `slice`, `keyvalue`.
```ts
@Pipe({ name: 'truncate', standalone: true })
export class TruncatePipe implements PipeTransform {
  transform(value: string, len = 20) { return value.length > len ? value.slice(0, len) + '…' : value; }
}
```
**Pure pipes** (default) re-run only when the input reference changes; **impure** pipes run on every change detection (expensive).

## Services and Dependency Injection

Services hold business logic and shared state, injected where needed.

```ts
@Injectable({ providedIn: 'root' })   // app-wide singleton, tree-shakable
export class CartService {
  private items = signal<Product[]>([]);
  readonly count = computed(() => this.items().length);
  add(p: Product) { this.items.update(list => [...list, p]); }
}

@Component({ /* … */ })
export class HeaderComponent {
  cart = inject(CartService);         // or constructor(private cart: CartService) {}
}
```

### Why DI?
Loose coupling, easy testing (swap with mocks), configurable implementations, and lifecycle/scope management by the framework.

### Provider types
```ts
providers: [
  { provide: Logger, useClass: ConsoleLogger },
  { provide: API_URL, useValue: 'https://api.example.com' },
  { provide: Storage, useFactory: () => isBrowser ? localStorage : memoryStorage },
  { provide: OldLogger, useExisting: Logger },
]
export const API_URL = new InjectionToken<string>('API_URL');
```

## Lifecycle Hooks

| Hook | When |
|---|---|
| `constructor` | class instantiation (DI only — no inputs yet) |
| `ngOnChanges` | when `@Input` values change (before `ngOnInit` too) |
| `ngOnInit` | once, after first inputs set — init logic, data loading |
| `ngDoCheck` | every change detection run — custom checks |
| `ngAfterContentInit` / `Checked` | projected content (`<ng-content>`) ready / checked |
| `ngAfterViewInit` / `Checked` | component's view and children ready / checked |
| `ngOnDestroy` | cleanup: unsubscribe, timers |

Modern alternatives: `afterNextRender`/`afterRender` (DOM work, SSR-safe), `DestroyRef`/`takeUntilDestroyed()` for cleanup, `effect()` for reacting to signals.

# Intermediate

## Signals

Signals (v16+) are Angular's fine-grained reactive primitive.

```ts
const count = signal(0);                   // writable
const double = computed(() => count() * 2); // derived, lazy & memoized
effect(() => console.log('count is', count())); // side effect, auto-tracks deps

count.set(5);
count.update(c => c + 1);
```

### In components
```ts
export class SearchComponent {
  query = signal('');
  results = computed(() => this.all().filter(r => r.name.includes(this.query())));
  // signal-based APIs
  value = model<string>('');                         // two-way bindable input
  item = input.required<Item>();
  header = viewChild<ElementRef>('header');
}
```

### Interop with RxJS
```ts
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
users = toSignal(this.http.get<User[]>('/api/users'), { initialValue: [] });
query$ = toObservable(this.query);
```

### Newer resource APIs
`resource()` / `httpResource()` load async data reactively from signals, exposing `value()`, `isLoading()`, `error()`. `linkedSignal()` creates writable state that resets when a source changes.

> [!INTERVIEW]
> Signals vs RxJS: signals model **synchronous state** (always have a current value, glitch-free); RxJS models **events and async streams over time** (cancellation, debounce, combining). They complement each other.

## RxJS and Observables

An **Observable** is a lazy stream of values over time. Nothing happens until you `subscribe`.

```ts
this.searchControl.valueChanges.pipe(
  debounceTime(300),
  map(v => v.trim()),
  distinctUntilChanged(),
  filter(v => v.length > 1),
  switchMap(q => this.api.search(q).pipe(catchError(() => of([])))),
  takeUntilDestroyed(this.destroyRef),
).subscribe(results => this.results.set(results));
```

### Higher-order mapping operators (asked constantly)

| Operator | Behaviour | Use for |
|---|---|---|
| `switchMap` | cancels the previous inner observable | search/typeahead, route params |
| `mergeMap` | runs all in parallel | independent writes, fire-and-forget |
| `concatMap` | queues, one after another in order | ordered saves |
| `exhaustMap` | ignores new values while busy | login button, prevent double submit |

### Subjects
- `Subject` — multicast, no initial value.
- `BehaviorSubject` — holds a current value, new subscribers get it immediately (classic service state).
- `ReplaySubject(n)` — replays last n values.
- `AsyncSubject` — emits last value on completion.

### Hot vs cold
Cold observables (HTTP) start a new producer per subscriber; hot ones (DOM events, Subjects) share a producer. `shareReplay({ bufferSize: 1, refCount: true })` shares and caches.

### Avoiding leaks
Use the `async` pipe (auto-unsubscribes), `takeUntilDestroyed()`, `toSignal`, or `take(1)`. HTTP observables complete by themselves.

## Routing

```ts app.routes.ts
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'products/:id', component: ProductComponent, resolve: { product: productResolver } },
  { path: 'admin', canActivate: [authGuard], loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES) },
  { path: 'settings', loadComponent: () => import('./settings.component').then(m => m.SettingsComponent) },
  { path: '**', component: NotFoundComponent },
];
// main.ts
bootstrapApplication(AppComponent, { providers: [provideRouter(routes, withComponentInputBinding()), provideHttpClient(withInterceptors([authInterceptor]))] });
```

### Functional guards and resolvers
```ts
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() || inject(Router).createUrlTree(['/login']);
};
export const productResolver: ResolveFn<Product> = (route) => inject(ProductService).get(route.paramMap.get('id')!);
```
Guards: `canActivate`, `canActivateChild`, `canDeactivate` (unsaved changes), `canMatch` (choose route/lazy load).

Read params: `inject(ActivatedRoute).paramMap`, or with `withComponentInputBinding()` as component `input()`s.

## Forms: Template-driven and Reactive

### Template-driven (simple forms)
```html
<form #f="ngForm" (ngSubmit)="save(f.value)">
  <input name="email" ngModel required email #email="ngModel">
  @if (email.invalid && email.touched) { <small>Invalid email</small> }
</form>
```

### Reactive forms (complex, testable)
```ts
export class SignupComponent {
  private fb = inject(NonNullableFormBuilder);
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    addresses: this.fb.array([this.fb.control('')]),
  }, { validators: passwordsMatch });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.api.signup(this.form.getRawValue());   // strongly typed
  }
}
```
```html
<form [formGroup]="form" (ngSubmit)="submit()">
  <input formControlName="email">
</form>
```

- Custom validators: `(control: AbstractControl): ValidationErrors | null`.
- **Async validators** (e.g., username taken) return an Observable.
- Control states: `valid/invalid`, `pristine/dirty`, `touched/untouched`, `pending`.
- `ControlValueAccessor` lets custom components work with `formControlName`.

## HTTP Client and Interceptors

```ts
@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  list(params: { page: number }) {
    return this.http.get<Product[]>('/api/products', { params: { page: params.page } });
  }
}
```

### Functional interceptors
```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) inject(Router).navigate(['/login']);
      return throwError(() => err);
    }),
  );
};
```
Use cases: auth headers, refresh tokens, global error handling, loading spinners, logging, caching, retry.

# Advanced

## Change Detection Deep Dive

### Default strategy with Zone.js
**Zone.js** monkey-patches async APIs (events, timers, XHR, promises). After any async task, Angular runs change detection **top-down over the whole component tree**, comparing template bindings to previous values.

### OnPush
```ts
@Component({ changeDetection: ChangeDetectionStrategy.OnPush, /* … */ })
```
An OnPush component is checked only when:
1. An `@Input` reference changes,
2. An event originates from it or its children,
3. An `async` pipe in it emits / a **signal** it reads changes,
4. It's marked manually with `ChangeDetectorRef.markForCheck()`.

This requires **immutable data** patterns and drastically reduces checks.

### Zoneless (stable in v20)
```ts
bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] });
```
Without Zone.js, change detection is scheduled by signals, `markForCheck`, events and the async pipe. Benefits: smaller bundle, better performance, clearer stack traces, no monkey patching.

### `ExpressionChangedAfterItHasBeenCheckedError`
In dev mode Angular runs an extra check; if a binding changed during the check (e.g., modifying parent state in a child's `ngAfterViewInit`), you get this error. Fix the data flow rather than suppressing it.

### Tools
`ChangeDetectorRef.detectChanges()`, `markForCheck()`, `detach()`, `NgZone.runOutsideAngular()` for high-frequency events (scroll, mousemove).

## Performance Optimisation

- **OnPush everywhere** + signals/immutable data.
- `track` in `@for` to avoid DOM re-creation.
- **Lazy loading** routes and `loadComponent`.
- **Deferrable views**:
```html
@defer (on viewport; prefetch on idle) {
  <app-heavy-chart [data]="data()" />
} @placeholder { <div class="skeleton"></div> } @loading (minimum 300ms) { <app-spinner /> }
```
- Pure pipes instead of method calls in templates (methods run every CD cycle).
- Virtual scrolling: CDK `cdk-virtual-scroll-viewport`.
- `NgOptimizedImage` (`ngSrc`) for priority hints, lazy loading, srcset.
- Bundle budgets in `angular.json`; analyse with `source-map-explorer`.
- Run noisy third-party code outside the zone.

## SSR, Hydration and SSG

```bash
ng new app --ssr        # or: ng add @angular/ssr
```
- **SSR** renders on the server (Node/Express) for SEO and fast first paint.
- **Non-destructive hydration** (v16+) reuses server DOM instead of re-rendering; **incremental hydration** (v19+) hydrates `@defer` blocks lazily (`hydrate on viewport`).
- **Event replay** captures clicks before hydration completes.
- **Prerendering (SSG)** at build time for static routes; hybrid render modes per route (`RenderMode.Server | Client | Prerender`).
- Guard browser-only APIs: `isPlatformBrowser(inject(PLATFORM_ID))` or `afterNextRender()`.
- `TransferState`/HTTP transfer cache avoids refetching data on the client.

## State Management at Scale

| Approach | When |
|---|---|
| Signals in services | most apps — simple, reactive, built in |
| `BehaviorSubject` services | legacy/RxJS-heavy code |
| **NgRx Store** (Redux pattern: actions, reducers, selectors, effects) | large teams, complex flows, devtools/time travel |
| **NgRx SignalStore** | modern, lightweight, signal-based stores |
| NGXS / Akita / Elf | alternatives |

```ts
export const CartStore = signalStore(
  { providedIn: 'root' },
  withState({ items: [] as Item[] }),
  withComputed(({ items }) => ({ total: computed(() => items().reduce((s, i) => s + i.price, 0)) })),
  withMethods(store => ({ add(item: Item) { patchState(store, s => ({ items: [...s.items, item] })); } })),
);
```

NgRx effects isolate side effects: listen for actions → call APIs → dispatch success/failure actions.

## Advanced DI, Content Projection and Dynamic Components

### Injector hierarchy
**Environment injectors** (root, route-level providers, lazy-loaded) and **element injectors** (component/directive `providers`). Resolution walks up the element tree, then the environment tree. Modifiers: `inject(X, { optional: true, self: true, skipSelf: true, host: true })`.

- `providers` on a component → new instance per component instance (and its children).
- `viewProviders` → visible to the view but not to projected content.
- Multi providers: `{ provide: HTTP_INTERCEPTORS, useClass: X, multi: true }`.

### Content projection
```html
<!-- card.component.html -->
<header><ng-content select="[card-title]" /></header>
<ng-content />
<!-- usage -->
<app-card><h2 card-title>Title</h2><p>Body</p></app-card>
```
`ng-template` + `ngTemplateOutlet` for rendering templates passed in; `@ContentChild`/`contentChild()` to access projected content.

### Dynamic components
```ts
const ref = this.vcr.createComponent(AlertComponent);
ref.setInput('message', 'Saved!');
```
Or `*ngComponentOutlet`. Used for modals, dashboards, plugin systems.

## Testing and Enterprise Architecture

### Testing
```ts
describe('CartService', () => {
  it('adds items', () => {
    TestBed.configureTestingModule({ providers: [CartService] });
    const svc = TestBed.inject(CartService);
    svc.add(mockProduct);
    expect(svc.count()).toBe(1);
  });
});
// HTTP: provideHttpClientTesting() + HttpTestingController.expectOne('/api/x').flush(data)
// Components: TestBed.createComponent, fixture.detectChanges(), harnesses from CDK
```
Jasmine/Karma were the defaults; Jest/Vitest and Web Test Runner are now common; Playwright/Cypress for E2E.

### Architecture
- Organise by **feature/domain** (`features/orders`), with `core` (singletons, interceptors) and `shared` (dumb components, pipes).
- **Smart (container) vs presentational (dumb)** components — containers inject services; presentational components use inputs/outputs + OnPush.
- **Nx monorepos** with library boundaries enforced by lint rules.
- **Micro-frontends** with Module Federation / Native Federation.
- Strict TypeScript, ESLint, consistent DI tokens for configuration, environment files for builds.

# Interview Questions

## Beginner

### What is Angular and how is it different from AngularJS?
Angular (2+) is a TypeScript-based, component-driven framework with a CLI, DI, RxJS/Signals, and an ahead-of-time compiler. AngularJS (1.x) was a JavaScript MVC framework based on controllers, `$scope` and digest-cycle two-way binding. Angular is a complete rewrite, not an upgrade.

### What are the types of data binding in Angular?
Interpolation `{{ }}` and property binding `[ ]` (component → view), event binding `( )` (view → component), and two-way binding `[( )]` which combines a property and an event (e.g., `ngModel` or `model()` signals).

### What is a component? What does the `@Component` decorator contain?
A class that controls a part of the UI. The decorator provides metadata: `selector`, `template`/`templateUrl`, `styles`/`styleUrl`, `imports` (for standalone), `providers`, `changeDetection`, `encapsulation`, `host`.

### What are directives? Name the types.
Classes that add behaviour to elements. Components (with templates), structural directives (change DOM layout: `*ngIf`, `*ngFor`, custom with `TemplateRef`), and attribute directives (change appearance/behaviour: `ngClass`, `ngStyle`, custom).

### What is a service and why use DI?
A class for business logic, data access or shared state, decorated with `@Injectable`. DI supplies dependencies instead of the class creating them, enabling singletons, loose coupling, configuration and easy mocking in tests.

### What are pipes? Pure vs impure?
Pipes transform displayed values in templates (`date`, `currency`, `async`). Pure pipes run only when their input reference (or primitive value) changes — efficient. Impure pipes run every change detection cycle — use sparingly.

### What are standalone components?
Components that declare their own dependencies via `imports` instead of belonging to an `NgModule`. They're the default since v19, simplify the mental model, and enable lazy loading individual components with `loadComponent`.

### What is the purpose of `ngOnInit` vs the constructor?
The constructor is for DI and simple field initialisation — inputs aren't set yet. `ngOnInit` runs after the first `ngOnChanges`, once inputs are available — the place for initialisation logic like fetching data.

## Intermediate

### What are Signals and why were they introduced?
Reactive primitives (`signal`, `computed`, `effect`) holding a value and notifying consumers when it changes. They let Angular know exactly which views depend on which state, enabling fine-grained, zoneless change detection, simpler state management and better performance than dirty-checking the whole tree.

### Explain `switchMap`, `mergeMap`, `concatMap` and `exhaustMap`.
All map each value to an inner observable and flatten. `switchMap` cancels the previous inner (search). `mergeMap` runs them concurrently (parallel requests). `concatMap` queues them sequentially preserving order (ordered writes). `exhaustMap` ignores new values while one is active (prevent double submits).

### Observable vs Promise?
Promises are eager, produce a single value and aren't cancellable. Observables are lazy, can emit many values over time, support cancellation via unsubscribe, and offer rich operators for composition (retry, debounce, combine).

### Subject vs BehaviorSubject?
A Subject is a multicast observable without a current value — late subscribers miss earlier emissions. A BehaviorSubject requires an initial value, stores the latest value and emits it immediately to new subscribers; `getValue()` reads it synchronously.

### How do you prevent memory leaks from subscriptions?
Use the `async` pipe, `toSignal`, `takeUntilDestroyed()` (with `DestroyRef`), `take(1)`/`first()`, or unsubscribe in `ngOnDestroy`. Finite observables like HttpClient complete automatically.

### Template-driven vs reactive forms?
Template-driven: model defined in the template with `ngModel`, asynchronous, simple forms. Reactive: model defined in TypeScript (`FormGroup`, `FormControl`), synchronous, strongly typed, easy to test, dynamic fields (`FormArray`), better for complex validation.

### What are route guards?
Functions that decide if navigation is allowed: `canActivate` (enter route), `canActivateChild`, `canDeactivate` (leave — unsaved changes), `canMatch` (whether route config matches, controls lazy loading), plus `resolve` to prefetch data. They can return boolean, `UrlTree` (redirect), Observable or Promise.

### How does lazy loading work in Angular?
Routes use `loadChildren` or `loadComponent` with dynamic `import()`. The build splits those into separate chunks fetched only on navigation. Preloading strategies (`withPreloading(PreloadAllModules)`) can fetch them in idle time.

### What are HTTP interceptors used for?
Functions that sit in the HttpClient pipeline to inspect or transform requests and responses: add auth tokens, refresh expired tokens, handle errors globally, show loaders, log, cache or retry.

## Advanced

### Explain Angular change detection and the OnPush strategy.
By default, Zone.js notifies Angular after async events and Angular checks every component's bindings top-down. With OnPush, a component (and its subtree) is checked only when its input references change, an event fires within it, an async pipe/signal it reads updates, or it's marked for check. Combined with immutability and signals, OnPush dramatically reduces work.

### What is zoneless Angular and what are the trade-offs?
Running without Zone.js using `provideZonelessChangeDetection()`. Change detection is triggered by signals, template events, async pipe and `markForCheck`. Benefits: no monkey patching, smaller bundles, better performance and debugging. Trade-off: code that mutates state in plain callbacks (setTimeout, third-party libs) must use signals or notify Angular explicitly.

### What causes `ExpressionChangedAfterItHasBeenCheckedError`?
In development, Angular verifies that bindings didn't change after a CD pass. Changing state that affects an already-checked binding during the same cycle (e.g., in `ngAfterViewInit` or a child updating parent state) triggers it. Fix by restructuring data flow, using signals, or moving updates to an earlier hook — not by wrapping in `setTimeout`.

### Explain the hierarchical injector system.
Angular has environment injectors (root, platform, lazy route injectors) and element injectors created from component/directive providers. Lookup starts at the requesting element and moves up the element tree, then the environment hierarchy. Providing a service at component level creates per-instance services; resolution modifiers (`self`, `skipSelf`, `host`, `optional`) control the search.

### How would you improve performance of a large Angular app?
Adopt OnPush and signals (or go zoneless), track in `@for`, lazy-load routes and `@defer` heavy components, virtual scroll long lists, replace template method calls with pure pipes/computed signals, run frequent events outside Angular, use SSR with hydration for initial load, NgOptimizedImage, enforce bundle budgets and analyse bundles.

### How does SSR with hydration work in Angular?
The app is rendered on the server via `@angular/ssr`; the HTML is sent to the browser. On the client, Angular boots and hydrates — reusing existing DOM nodes rather than recreating them, replaying early events. HTTP responses are transferred to avoid duplicate requests. Incremental hydration defers hydrating `@defer` blocks until triggered.

### NgRx — when is it worth it and how does it work?
Worth it for large apps with complex shared state, many async flows and teams needing strict patterns and devtools. Components dispatch actions; reducers (pure) produce new state; selectors derive memoized data; effects handle side effects and dispatch new actions. For smaller needs, signal services or NgRx SignalStore are simpler.

### What is `ControlValueAccessor`?
An interface (`writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`) that bridges a custom component with Angular forms, letting it be used with `formControlName` or `ngModel` like a native input. Register with the `NG_VALUE_ACCESSOR` provider.

### What is AOT compilation and why does it matter?
Ahead-of-time compilation converts templates and decorators into efficient JavaScript at build time (Ivy). Benefits: faster startup (no compiler shipped), template errors caught at build, smaller bundles with tree-shaking, and better security (no runtime template evaluation).
