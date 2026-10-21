---
id: vue
title: Vue.js
short: Vue
category: Frontend Frameworks
order: 8
color: #42b883
icon: V
summary: Templates, reactivity with ref/reactive, Composition API, components, Pinia, Vue Router, Nuxt and the Proxy-based reactivity system.
---

# Beginner

## What Vue Is

Vue is a **progressive framework**: you can drop it into a page for a widget or build a full SPA with router, state and SSR (Nuxt). It combines HTML-based templates (like Angular) with a lightweight, component-based core (like React).

```bash
npm create vue@latest     # Vite-based scaffold with TS, Router, Pinia, Vitest options
```

### Single-File Components (SFC)
```vue Counter.vue
<script setup lang="ts">
import { ref, computed } from 'vue';
const count = ref(0);
const double = computed(() => count.value * 2);
</script>

<template>
  <button @click="count++">Clicked {{ count }} times (double: {{ double }})</button>
</template>

<style scoped>
button { padding: 8px 16px; }
</style>
```
`<script setup>` is the recommended Composition API syntax. `scoped` styles apply only to this component.

## Template Syntax and Directives

| Syntax | Meaning |
|---|---|
| `{{ msg }}` | text interpolation (escaped) |
| `v-bind:href="url"` / `:href` | bind attribute/prop |
| `v-on:click="fn"` / `@click` | listen to event |
| `v-model="name"` | two-way binding on inputs/components |
| `v-if` / `v-else-if` / `v-else` | conditional render (creates/destroys) |
| `v-show` | toggle `display` (stays in DOM) |
| `v-for="item in items" :key="item.id"` | list rendering |
| `v-html` | raw HTML — XSS risk |
| `v-slot` / `#name` | named slots |

```vue
<template>
  <input v-model.trim="query" @keyup.enter="search" placeholder="Search" />
  <p v-if="loading">Loading…</p>
  <ul v-else>
    <li v-for="(user, i) in users" :key="user.id" :class="{ active: user.id === selected }">
      {{ i + 1 }}. {{ user.name }}
    </li>
  </ul>
  <form @submit.prevent="save">…</form>
</template>
```

Event modifiers: `.prevent`, `.stop`, `.once`, `.self`, `.capture`; key modifiers `.enter`, `.esc`; `v-model` modifiers `.trim`, `.number`, `.lazy`.

> [!TIP]
> `v-if` vs `v-show`: `v-if` has higher toggle cost (mount/unmount) but zero cost when false initially; `v-show` has an initial render cost but cheap toggling.

## Reactivity Basics: ref, reactive, computed

```ts
import { ref, reactive, computed, watch } from 'vue';

const count = ref(0);                  // any value; access with .value in script
const user = reactive({ name: 'Asha', tags: [] as string[] }); // objects only, no .value

count.value++;
user.name = 'Ravi';
user.tags.push('admin');               // deep reactivity

const fullName = computed(() => `${user.name} (${count.value})`); // cached until deps change
```

- In templates, refs are **auto-unwrapped**: `{{ count }}`.
- `reactive()` loses reactivity if you **destructure** or **replace** it — use `toRefs()` or prefer `ref` everywhere (official recommendation).
- `computed` is cached; a method call in a template re-runs every render.

## Components, Props and Events

```vue Child.vue
<script setup lang="ts">
const props = defineProps<{ title: string; count?: number }>();
const emit = defineEmits<{ (e: 'increment', by: number): void }>();
</script>

<template>
  <h3>{{ title }}</h3>
  <button @click="emit('increment', 1)">+</button>
  <slot name="footer" :count="props.count">Default footer</slot>
</template>
```
```vue Parent.vue
<Child title="Cart" :count="n" @increment="n += $event">
  <template #footer="{ count }">Total: {{ count }}</template>
</Child>
```

- **Props down, events up** — one-way data flow. Never mutate props.
- **Slots** = content distribution; **scoped slots** pass data back to the parent's template.
- `v-model` on components uses `modelValue` + `update:modelValue`, or the `defineModel()` macro:
```ts
const model = defineModel<string>(); // in child; parent uses v-model="text"
```

## Lifecycle Hooks

| Composition API | Options API | When |
|---|---|---|
| (setup itself) | `beforeCreate`/`created` | instance set up |
| `onBeforeMount` | `beforeMount` | before first render |
| `onMounted` | `mounted` | DOM available |
| `onBeforeUpdate` / `onUpdated` | `beforeUpdate`/`updated` | around re-render |
| `onBeforeUnmount` / `onUnmounted` | `beforeUnmount`/`unmounted` | cleanup |
| `onErrorCaptured` | `errorCaptured` | descendant errors |
| `onActivated` / `onDeactivated` | same | `<KeepAlive>` caching |

```ts
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));
```

# Intermediate

## Options API vs Composition API

```ts
// Options API
export default {
  data: () => ({ count: 0 }),
  computed: { double() { return this.count * 2; } },
  methods: { inc() { this.count++; } },
  mounted() {},
};
```
```ts
// Composition API
const count = ref(0);
const double = computed(() => count.value * 2);
const inc = () => count.value++;
```

| Options API | Composition API |
|---|---|
| organised by option type | organised by **logical concern** |
| `this`-based, mixins for reuse (name clashes, unclear sources) | composables — explicit, typed reuse |
| easy for beginners | better TypeScript inference and scaling |

## Watchers and Composables

### `watch` vs `watchEffect`
```ts
watch(() => route.params.id, async (id, oldId) => { user.value = await fetchUser(id); }, { immediate: true });
watch([a, b], ([na, nb]) => {});
watch(state, () => {}, { deep: true });

watchEffect(async (onCleanup) => {       // tracks whatever it reads, runs immediately
  const ctrl = new AbortController();
  onCleanup(() => ctrl.abort());
  results.value = await search(query.value, ctrl.signal);
});
```
- `watch` — explicit sources, lazy by default, gives old & new values.
- `watchEffect` — auto-tracks dependencies, runs immediately.
- `flush: 'post'` to run after DOM updates.

### Composables — reusable stateful logic
```ts useFetch.ts
export function useFetch<T>(url: MaybeRefOrGetter<string>) {
  const data = ref<T | null>(null);
  const error = ref<unknown>(null);
  const loading = ref(false);
  watchEffect(async () => {
    loading.value = true; error.value = null;
    try { data.value = await (await fetch(toValue(url))).json(); }
    catch (e) { error.value = e; }
    finally { loading.value = false; }
  });
  return { data, error, loading };
}
```
VueUse is a large library of ready-made composables (`useLocalStorage`, `useDebounceFn`, `useIntersectionObserver`).

## Vue Router

```ts router.ts
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/users/:id', component: () => import('./UserView.vue'), props: true },
    { path: '/admin', component: AdminLayout, meta: { requiresAuth: true }, children: [ { path: 'stats', component: Stats } ] },
    { path: '/:pathMatch(.*)*', component: NotFound },
  ],
});
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !auth.isLoggedIn) return { name: 'login', query: { redirect: to.fullPath } };
});
```
```ts
const route = useRoute();    // current params, query
const router = useRouter();  // router.push('/x')
```
`<RouterLink>` and `<RouterView>` render links and matched components. Guards: global (`beforeEach`, `afterEach`), per-route (`beforeEnter`), in-component (`onBeforeRouteLeave`).

## State Management with Pinia

Pinia is the official store (successor to Vuex).

```ts stores/cart.ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<Item[]>([]);
  const total = computed(() => items.value.reduce((s, i) => s + i.price, 0));
  function add(item: Item) { items.value.push(item); }
  async function checkout() { await api.checkout(items.value); items.value = []; }
  return { items, total, add, checkout };
});
```
```ts
const cart = useCartStore();
const { items, total } = storeToRefs(cart);  // keep reactivity when destructuring
cart.add(product);
```

| Pinia | Vuex |
|---|---|
| no mutations — just actions | state, getters, **mutations**, actions |
| first-class TypeScript | weak typing |
| modular stores by default | nested modules with namespaces |
| devtools, plugins, SSR | devtools |

## Provide/Inject, Teleport, KeepAlive

```ts
// ancestor
provide(ThemeKey, readonly(theme));
// any descendant
const theme = inject(ThemeKey, 'light');
```
Use `InjectionKey<T>` symbols for typing. Good for plugin/library internals and avoiding prop drilling.

```vue
<Teleport to="body"><Modal v-if="open" /></Teleport>   <!-- render elsewhere in DOM -->
<KeepAlive :max="5"><component :is="currentTab" /></KeepAlive> <!-- cache inactive components -->
<Suspense><AsyncDashboard /><template #fallback>Loading…</template></Suspense>
<Transition name="fade"><p v-if="show">Hi</p></Transition>
```

### Custom directives
```ts
const vFocus = { mounted: (el: HTMLElement) => el.focus() };
// <input v-focus />
```

# Advanced

## How Vue Reactivity Works Internally

Vue 3 reactivity is built on **ES Proxy** (Vue 2 used `Object.defineProperty`).

1. `reactive(obj)` returns a Proxy. The **`get` trap** calls `track(target, key)` — recording the currently running **effect** as a dependency in a `WeakMap<target, Map<key, Set<effect>>>`.
2. The **`set` trap** calls `trigger(target, key)` — re-running all effects that depend on that key.
3. Components' render functions, `computed` and `watch` are all effects.
4. Updates are **batched** into an async queue (microtask); `await nextTick()` waits for the DOM to update.

```js
// simplified
let activeEffect;
const deps = new WeakMap();
function reactive(target) {
  return new Proxy(target, {
    get(t, k, r) { track(t, k); const v = Reflect.get(t, k, r); return typeof v === 'object' && v ? reactive(v) : v; },
    set(t, k, v, r) { const ok = Reflect.set(t, k, v, r); trigger(t, k); return ok; },
  });
}
function effect(fn) { activeEffect = fn; fn(); activeEffect = null; }
```

### Vue 2 limitations fixed by Proxy
Vue 2 couldn't detect property **addition/deletion** or **array index** assignment (needed `Vue.set`). Proxy intercepts all of these.

### Tools
`shallowRef`/`shallowReactive` (only top-level reactive — large immutable data), `markRaw` (never make reactive, e.g. class instances, map libs), `toRaw`, `triggerRef`, `customRef` (e.g., debounced ref), `effectScope`.

## Rendering: Virtual DOM and the Compiler

Vue compiles templates into render functions with **compiler-informed optimisations**:
- **Static hoisting** — static nodes created once, reused.
- **Patch flags** — each dynamic node records *what* can change (text, class, props), so the diff checks only that.
- **Block tree** — dynamic nodes are tracked in flat arrays, skipping static structure during diffing.

That makes Vue's VDOM diff much cheaper than a naive full-tree diff. **Vapor Mode** (in development) compiles templates to direct DOM operations without a VDOM, similar to Solid/Svelte.

`v-once` renders once; `v-memo="[deps]"` skips re-rendering a subtree unless deps change.

## Performance Optimisation

- Use `computed` instead of methods in templates.
- Stable `:key`s in `v-for`; never use `v-if` with `v-for` on the same element (`v-if` has higher precedence in Vue 3) — filter in a computed.
- `shallowRef` for large datasets; `markRaw` for non-reactive objects.
- Lazy-load routes and `defineAsyncComponent`.
- Virtual scrolling for long lists (`vue-virtual-scroller`).
- `v-memo`, `v-once`, `KeepAlive` for expensive views.
- Keep props stable — passing a new object each render re-renders children.
- Analyse with Vue DevTools performance timeline.

## Nuxt and Server-Side Rendering

Nuxt is the Vue meta-framework (like Next.js for React).

- File-based routing in `pages/`, layouts, middleware, plugins.
- Rendering modes: SSR (universal, default), SPA, SSG (`nuxi generate`), hybrid per-route rules (`routeRules: { '/blog/**': { isr: 60 } }`).
- Data fetching: `useFetch`/`useAsyncData` (deduplicated, SSR-transferred payload), `$fetch` for client actions.
- Server routes via **Nitro** (`server/api/*.ts`), deployable to Node, serverless and edge.
- Auto-imports for components and composables.

### SSR concepts
**Hydration** mismatches occur when server and client render differently (dates, random, browser-only APIs). Use `<ClientOnly>`, `onMounted` for browser-only code, and avoid cross-request state pollution — state must be created per request (Pinia/Nuxt `useState` handle this).

## Testing and Architecture

```ts
import { mount } from '@vue/test-utils';
test('increments', async () => {
  const wrapper = mount(Counter);
  await wrapper.get('button').trigger('click');
  expect(wrapper.text()).toContain('Clicked 1 times');
});
```
- **Vitest** + Vue Test Utils / Testing Library for components; **Playwright/Cypress** for E2E.
- `createTestingPinia()` to stub stores.
- Architecture: feature folders, composables for logic, Pinia stores per domain, typed API layer, plugin registration (`app.use()`), global error handler `app.config.errorHandler`.

# Interview Questions

## Beginner

### What is Vue and what makes it "progressive"?
Vue is a JavaScript framework for building UIs. "Progressive" means you can adopt it incrementally — from enhancing a static page with a script tag to building full SPAs with router, state management, SSR and tooling.

### `v-if` vs `v-show`?
`v-if` conditionally renders — the element is created/destroyed and its components mounted/unmounted. `v-show` always renders and toggles CSS `display`. Use `v-show` for frequent toggles, `v-if` when the condition rarely changes or the content is expensive.

### What is `v-model`?
Two-way binding sugar. On native inputs it binds `value` and listens to `input` (or `change` for checkboxes/selects). On components it binds the `modelValue` prop and listens to `update:modelValue`; multiple v-models can be named (`v-model:title`). `defineModel()` simplifies the child side.

### Why is `key` important in `v-for`?
It gives each node a stable identity so Vue's diff can reuse and reorder elements correctly instead of patching in place, preserving component state and input values.

### What are computed properties vs methods?
Computed properties are cached based on reactive dependencies and recompute only when those change. Methods run on every render when used in the template. Use computed for derived data.

### `ref` vs `reactive`?
`ref` wraps any value (primitive or object) and is accessed via `.value` in script; it can be reassigned and destructured safely. `reactive` makes an object deeply reactive without `.value` but can't hold primitives, and loses reactivity if replaced or destructured. The Vue team recommends `ref` as the primary API.

### How do parent and child components communicate?
Parent → child with props; child → parent by emitting events. For deeper trees use provide/inject or a Pinia store. Slots let parents pass template content; scoped slots let children pass data back to that content.

## Intermediate

### Options API vs Composition API?
Options API organises code by type (`data`, `methods`, `computed`) and uses `this`. Composition API organises by feature using functions (`ref`, `computed`, `watch`) inside `setup`/`<script setup>`, enabling reusable composables, better TypeScript inference and easier refactoring of large components.

### `watch` vs `watchEffect`?
`watch` takes explicit sources, runs lazily (unless `immediate`), and provides new and old values. `watchEffect` runs immediately and automatically tracks any reactive state it reads. Use `watch` for precise control, `watchEffect` for simple sync effects.

### What are composables?
Functions that use the Composition API to encapsulate and reuse stateful logic (`useMouse`, `useFetch`). Each call creates independent state. They replace mixins, which suffered from name collisions and unclear origin of properties.

### Pinia vs Vuex?
Pinia is the official store: simpler API with no mutations, excellent TypeScript support, modular stores, composition-style setup stores, devtools and SSR support. Vuex required mutations for sync changes and had weaker typing. New projects should use Pinia.

### What are slots and scoped slots?
Slots are placeholders in a child component's template filled by the parent's content. Named slots allow multiple insertion points. Scoped slots expose data from the child (`<slot :item="item">`) so the parent can render it (`#default="{ item }"`) — useful for list/table components.

### What is `nextTick`?
Vue batches DOM updates asynchronously. `await nextTick()` waits until the DOM reflects the latest state changes — needed when you must measure or focus elements right after changing data.

### What is provide/inject?
A dependency injection mechanism: an ancestor `provide`s a value and any descendant can `inject` it without prop drilling. Provide refs (or readonly refs) to keep it reactive.

## Advanced

### How does Vue 3's reactivity system work?
`reactive` wraps objects in Proxies. Reading a property inside an effect (render function, computed, watcher) tracks that effect as a dependency of the property in a WeakMap → Map → Set structure. Setting the property triggers the dependent effects, which are queued and flushed asynchronously. `ref` uses getter/setter on `.value` for the same tracking.

### What were the limitations of Vue 2 reactivity?
It used `Object.defineProperty` on existing keys at initialisation, so it couldn't detect added/deleted properties or direct array index/length changes, requiring `Vue.set`/`Vue.delete`. Recursively converting large objects upfront was also costly. Proxies in Vue 3 solved these and made reactivity lazy.

### How does Vue's compiler optimise rendering?
It analyses templates at build time: hoists static content, adds patch flags describing which parts of a node are dynamic, and groups dynamic nodes into blocks so the runtime diff skips static subtrees. Vapor Mode goes further by compiling to fine-grained DOM updates without a virtual DOM.

### How do you optimise a large Vue application?
Lazy-load routes and async components, use computed caching, `shallowRef`/`markRaw` for large or external objects, `v-memo`/`v-once`, KeepAlive for tabs, virtual scroll long lists, avoid unnecessary deep watchers, keep props stable, code-split, and use SSR/SSG via Nuxt for initial load.

### What is cross-request state pollution in SSR?
On the server, a single Node process handles many requests. Module-level singleton state (e.g., a global reactive store) would be shared across users, leaking data. Create app, router and store instances per request (Nuxt and Pinia do this) and avoid global mutable state.

### How would you build a custom `v-model`-compatible input?
Use `defineModel()` in the child (or `modelValue` prop + `update:modelValue` emit), bind it to the inner input, forward attributes with `v-bind="$attrs"` (and `inheritAttrs: false` if needed), support modifiers through `defineModel`'s second tuple element, and emit validation state if required.
