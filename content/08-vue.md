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

```vue
<template>
  <div>
    <h1>Static title</h1>                <!-- hoisted: created once -->
    <p :class="cls">{{ msg }}</p>         <!-- patch flag: TEXT | CLASS only -->
  </div>
</template>
```
```js Compiled output (simplified)
const _hoisted = createElementVNode('h1', null, 'Static title', -1 /* HOISTED */);
function render(_ctx) {
  return (openBlock(), createElementBlock('div', null, [
    _hoisted,
    createElementVNode('p', { class: normalizeClass(_ctx.cls) }, toDisplayString(_ctx.msg), 3 /* TEXT, CLASS */),
  ]));
}
```

## Performance Optimisation

- Use `computed` instead of methods in templates.
- Stable `:key`s in `v-for`; never use `v-if` with `v-for` on the same element (`v-if` has higher precedence in Vue 3) — filter in a computed.
- `shallowRef` for large datasets; `markRaw` for non-reactive objects.
- Lazy-load routes and `defineAsyncComponent`.
- Virtual scrolling for long lists (`vue-virtual-scroller`).
- `v-memo`, `v-once`, `KeepAlive` for expensive views.
- Keep props stable — passing a new object each render re-renders children.
- Analyse with Vue DevTools performance timeline.

```vue
<script setup>
import { shallowRef, computed, defineAsyncComponent } from 'vue';
const rows = shallowRef([]);                     // no deep proxy for 10k rows
const active = computed(() => rows.value.filter((r) => r.active)); // filter in computed, not v-if+v-for
const Chart = defineAsyncComponent(() => import('./Chart.vue'));
</script>
<template>
  <li v-for="r in active" :key="r.id" v-memo="[r.updatedAt]">{{ r.name }}</li>
  <KeepAlive><component :is="currentTab" /></KeepAlive>
  <Chart v-if="showChart" />
</template>
```

## Nuxt and Server-Side Rendering

Nuxt is the Vue meta-framework (like Next.js for React).

- File-based routing in `pages/`, layouts, middleware, plugins.
- Rendering modes: SSR (universal, default), SPA, SSG (`nuxi generate`), hybrid per-route rules (`routeRules: { '/blog/**': { isr: 60 } }`).
- Data fetching: `useFetch`/`useAsyncData` (deduplicated, SSR-transferred payload), `$fetch` for client actions.
- Server routes via **Nitro** (`server/api/*.ts`), deployable to Node, serverless and edge.
- Auto-imports for components and composables.

```ts nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },              // SSG
    '/blog/**': { isr: 3600 },             // regenerate hourly
    '/dashboard/**': { ssr: false },       // SPA
  },
});
```
```vue pages/products/[id].vue
<script setup>
const route = useRoute();
const { data: product } = await useFetch(`/api/products/${route.params.id}`); // runs on server, hydrated on client
</script>
<template><h1>{{ product.name }}</h1></template>
```

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

```html Drop-in on an existing page
<div id="app"><button @click="count++">Clicked {{ count }}</button></div>
<script type="module">
  import { createApp, ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
  createApp({ setup: () => ({ count: ref(0) }) }).mount('#app');
</script>
```
```bash Full SPA when you need it
npm create vue@latest    # Vite + Router + Pinia + Vitest
```

### `v-if` vs `v-show`?
`v-if` conditionally renders — the element is created/destroyed and its components mounted/unmounted. `v-show` always renders and toggles CSS `display`. Use `v-show` for frequent toggles, `v-if` when the condition rarely changes or the content is expensive.

```vue
<AdminPanel v-if="user.isAdmin" />   <!-- not rendered at all for non-admins -->
<Dropdown v-show="open" />           <!-- always rendered, toggles display:none -->
<p v-if="status === 'ok'">OK</p>
<p v-else-if="status === 'warn'">Warning</p>
<p v-else>Error</p>
```

### What is `v-model`?
Two-way binding sugar. On native inputs it binds `value` and listens to `input` (or `change` for checkboxes/selects). On components it binds the `modelValue` prop and listens to `update:modelValue`; multiple v-models can be named (`v-model:title`). `defineModel()` simplifies the child side.

```vue
<input v-model.trim="name" />
<!-- = <input :value="name" @input="name = $event.target.value.trim()" /> -->
<input type="checkbox" v-model="agree" />
<select v-model="country"><option>UK</option><option>IN</option></select>

<SearchBox v-model="query" />
<!-- = <SearchBox :modelValue="query" @update:modelValue="query = $event" /> -->
<UserForm v-model:first="first" v-model:last="last" />  <!-- multiple models -->
```

### Why is `key` important in `v-for`?
It gives each node a stable identity so Vue's diff can reuse and reorder elements correctly instead of patching in place, preserving component state and input values.

```vue
<li v-for="todo in todos" :key="todo.id">
  <input v-model="todo.text" />
</li>
<!-- :key="index" → after removing the first todo, inputs show the wrong text -->
```

### What are computed properties vs methods?
Computed properties are cached based on reactive dependencies and recompute only when those change. Methods run on every render when used in the template. Use computed for derived data.

```vue
<script setup>
import { ref, computed } from 'vue';
const items = ref([{ price: 10, qty: 2 }, { price: 5, qty: 1 }]);
const total = computed(() => items.value.reduce((s, i) => s + i.price * i.qty, 0)); // cached
function totalMethod() { return items.value.reduce((s, i) => s + i.price * i.qty, 0); } // runs each render
</script>
<template>{{ total }} vs {{ totalMethod() }}</template>
```

### `ref` vs `reactive`?
`ref` wraps any value (primitive or object) and is accessed via `.value` in script; it can be reassigned and destructured safely. `reactive` makes an object deeply reactive without `.value` but can't hold primitives, and loses reactivity if replaced or destructured. The Vue team recommends `ref` as the primary API.

```js
import { ref, reactive, toRefs } from 'vue';
const count = ref(0);
count.value++;                       // .value in script, auto-unwrapped in template
const user = ref({ name: 'Ada' });
user.value = { name: 'Grace' };      // ✅ can reassign

const state = reactive({ todos: [], filter: 'all' });
state.filter = 'done';               // no .value
const { filter } = state;            // ❌ loses reactivity
const { todos } = toRefs(state);     // ✅
```

### How do parent and child components communicate?
Parent → child with props; child → parent by emitting events. For deeper trees use provide/inject or a Pinia store. Slots let parents pass template content; scoped slots let children pass data back to that content.

```vue Child.vue
<script setup>
const props = defineProps({ item: { type: Object, required: true } });
const emit = defineEmits(['remove']);
</script>
<template>
  <li>{{ props.item.name }} <button @click="emit('remove', props.item.id)">x</button>
    <slot name="actions" :item="props.item" /></li>
</template>
```
```vue Parent.vue
<Child v-for="i in items" :key="i.id" :item="i" @remove="removeItem">
  <template #actions="{ item }"><a :href="`/edit/${item.id}`">Edit</a></template>
</Child>
```

## Intermediate

### Options API vs Composition API?
Options API organises code by type (`data`, `methods`, `computed`) and uses `this`. Composition API organises by feature using functions (`ref`, `computed`, `watch`) inside `setup`/`<script setup>`, enabling reusable composables, better TypeScript inference and easier refactoring of large components.

```js Options API
export default {
  data: () => ({ count: 0 }),
  computed: { double() { return this.count * 2; } },
  methods: { inc() { this.count++; } },
  mounted() { console.log('mounted'); },
};
```
```vue Composition API
<script setup>
import { ref, computed, onMounted } from 'vue';
const count = ref(0);
const double = computed(() => count.value * 2);
const inc = () => count.value++;
onMounted(() => console.log('mounted'));
</script>
```

### `watch` vs `watchEffect`?
`watch` takes explicit sources, runs lazily (unless `immediate`), and provides new and old values. `watchEffect` runs immediately and automatically tracks any reactive state it reads. Use `watch` for precise control, `watchEffect` for simple sync effects.

```js
watch(userId, async (id, oldId) => {                 // explicit source, old & new values
  user.value = await fetchUser(id);
}, { immediate: true });

watch(() => form.email, validateEmail);              // getter source

watchEffect(async (onCleanup) => {                   // tracks everything read inside
  const ctrl = new AbortController();
  onCleanup(() => ctrl.abort());
  results.value = await search(query.value, { signal: ctrl.signal });
});
```

### What are composables?
Functions that use the Composition API to encapsulate and reuse stateful logic (`useMouse`, `useFetch`). Each call creates independent state. They replace mixins, which suffered from name collisions and unclear origin of properties.

```js composables/useFetch.js
import { ref, watchEffect, toValue } from 'vue';
export function useFetch(url) {
  const data = ref(null), error = ref(null), loading = ref(false);
  watchEffect(async () => {
    loading.value = true; error.value = null;
    try { data.value = await (await fetch(toValue(url))).json(); }
    catch (e) { error.value = e; }
    finally { loading.value = false; }
  });
  return { data, error, loading };
}
// const { data, loading } = useFetch(() => `/api/users/${id.value}`);
```

### Pinia vs Vuex?
Pinia is the official store: simpler API with no mutations, excellent TypeScript support, modular stores, composition-style setup stores, devtools and SSR support. Vuex required mutations for sync changes and had weaker typing. New projects should use Pinia.

```js stores/cart.js (Pinia)
import { defineStore } from 'pinia';
export const useCartStore = defineStore('cart', {
  state: () => ({ items: [] }),
  getters: { total: (s) => s.items.reduce((t, i) => t + i.price, 0) },
  actions: { async add(id) { this.items.push(await api.product(id)); } }, // no mutations
});
```
```js Vuex equivalent
mutations: { ADD(state, item) { state.items.push(item); } },
actions:   { async add({ commit }, id) { commit('ADD', await api.product(id)); } },
```

### What are slots and scoped slots?
Slots are placeholders in a child component's template filled by the parent's content. Named slots allow multiple insertion points. Scoped slots expose data from the child (`<slot :item="item">`) so the parent can render it (`#default="{ item }"`) — useful for list/table components.

```vue DataTable.vue
<template>
  <table>
    <thead><slot name="header" /></thead>
    <tr v-for="row in rows" :key="row.id"><slot :row="row">{{ row.name }}</slot></tr>
  </table>
</template>
```
```vue Usage
<DataTable :rows="users">
  <template #header><th>Name</th></template>
  <template #default="{ row }"><td><strong>{{ row.name }}</strong></td></template>
</DataTable>
```

### What is `nextTick`?
Vue batches DOM updates asynchronously. `await nextTick()` waits until the DOM reflects the latest state changes — needed when you must measure or focus elements right after changing data.

```js
import { nextTick, ref } from 'vue';
const editing = ref(false);
const inputEl = ref(null);
async function startEdit() {
  editing.value = true;
  // inputEl.value is still null here — DOM not updated yet
  await nextTick();
  inputEl.value.focus();
}
```

### What is provide/inject?
A dependency injection mechanism: an ancestor `provide`s a value and any descendant can `inject` it without prop drilling. Provide refs (or readonly refs) to keep it reactive.

```js
// Ancestor
import { provide, ref, readonly } from 'vue';
const theme = ref('dark');
provide('theme', { theme: readonly(theme), toggle: () => (theme.value = theme.value === 'dark' ? 'light' : 'dark') });

// Any descendant
import { inject } from 'vue';
const { theme, toggle } = inject('theme');
// Typed key: export const ThemeKey = Symbol() as InjectionKey<ThemeApi>
```

## Advanced

### How does Vue 3's reactivity system work?
`reactive` wraps objects in Proxies. Reading a property inside an effect (render function, computed, watcher) tracks that effect as a dependency of the property in a WeakMap → Map → Set structure. Setting the property triggers the dependent effects, which are queued and flushed asynchronously. `ref` uses getter/setter on `.value` for the same tracking.

```js Mini implementation
let activeEffect;
const deps = new WeakMap();
function reactive(obj) {
  return new Proxy(obj, {
    get(t, k) { track(t, k); return Reflect.get(t, k); },
    set(t, k, v) { Reflect.set(t, k, v); trigger(t, k); return true; },
  });
}
function track(t, k) { if (!activeEffect) return; const m = deps.get(t) ?? deps.set(t, new Map()).get(t); (m.get(k) ?? m.set(k, new Set()).get(k)).add(activeEffect); }
function trigger(t, k) { deps.get(t)?.get(k)?.forEach((fn) => fn()); }
function effect(fn) { activeEffect = fn; fn(); activeEffect = null; }

const state = reactive({ count: 0 });
effect(() => console.log('count is', state.count));
state.count++;  // logs again
```

### What were the limitations of Vue 2 reactivity?
It used `Object.defineProperty` on existing keys at initialisation, so it couldn't detect added/deleted properties or direct array index/length changes, requiring `Vue.set`/`Vue.delete`. Recursively converting large objects upfront was also costly. Proxies in Vue 3 solved these and made reactivity lazy.

```js Vue 2
this.user.age = 30;                 // ❌ new property not reactive
this.$set(this.user, 'age', 30);    // ✅ Vue 2 workaround
this.items[0] = 'x';                // ❌ index assignment not detected
this.items.splice(0, 1, 'x');       // ✅
// Vue 3 (Proxy): both plain assignments just work
```

### How does Vue's compiler optimise rendering?
It analyses templates at build time: hoists static content, adds patch flags describing which parts of a node are dynamic, and groups dynamic nodes into blocks so the runtime diff skips static subtrees. Vapor Mode goes further by compiling to fine-grained DOM updates without a virtual DOM.

```vue
<template>
  <div>
    <header>Logo</header>                           <!-- static: hoisted -->
    <span :id="id">{{ text }}</span>                <!-- PROPS(id) | TEXT flags -->
    <ul><li v-for="i in list" :key="i">{{ i }}</li></ul> <!-- block: dynamic children tracked as a flat array -->
  </div>
</template>
<!-- Explore the output at https://play.vuejs.org → JS tab -->
```

### How do you optimise a large Vue application?
Lazy-load routes and async components, use computed caching, `shallowRef`/`markRaw` for large or external objects, `v-memo`/`v-once`, KeepAlive for tabs, virtual scroll long lists, avoid unnecessary deep watchers, keep props stable, code-split, and use SSR/SSG via Nuxt for initial load.

```js router.js
const routes = [{ path: '/reports', component: () => import('./views/Reports.vue') }]; // lazy route
```
```js
import { shallowRef, markRaw } from 'vue';
const rows = shallowRef(await loadRows());   // replace, don't mutate: rows.value = newRows
const map = markRaw(new mapboxgl.Map({ container: 'map' })); // never proxied
```
```vue
<RecycleScroller :items="rows" :item-size="40" key-field="id" v-slot="{ item }">{{ item.name }}</RecycleScroller>
```

### What is cross-request state pollution in SSR?
On the server, a single Node process handles many requests. Module-level singleton state (e.g., a global reactive store) would be shared across users, leaking data. Create app, router and store instances per request (Nuxt and Pinia do this) and avoid global mutable state.

```js ❌ shared across every request on the server
export const store = reactive({ user: null });

// ✅ create per request (createApp is called once per request in SSR)
export function createAppInstance() {
  const app = createSSRApp(App);
  const pinia = createPinia();          // fresh store per request
  app.use(pinia);
  return { app, pinia };
}
```

### How would you build a custom `v-model`-compatible input?
Use `defineModel()` in the child (or `modelValue` prop + `update:modelValue` emit), bind it to the inner input, forward attributes with `v-bind="$attrs"` (and `inheritAttrs: false` if needed), support modifiers through `defineModel`'s second tuple element, and emit validation state if required.

```vue MoneyInput.vue
<script setup>
const model = defineModel({ type: Number, default: 0 });   // Vue 3.4+
defineOptions({ inheritAttrs: false });
</script>
<template>
  <label class="money">€
    <input v-bind="$attrs" type="number" step="0.01"
           :value="model" @input="model = $event.target.valueAsNumber" />
  </label>
</template>
<!-- <MoneyInput v-model="price" placeholder="0.00" /> -->
```

# Scenario Questions

## Beginner

### You destructure props in `<script setup>` and the values stop updating. Why?
In Vue < 3.5, `const { title } = defineProps()` copies the value and loses reactivity. Use `props.title`, `toRefs(props)`, or Vue 3.5+, where destructured `defineProps` stays reactive. The same applies to reactive store objects: use `storeToRefs` with Pinia.

```vue
<script setup>
const props = defineProps(['title']);
const { title } = props;                 // ❌ (Vue < 3.5) plain copy, not reactive
import { toRefs, computed } from 'vue';
const { title: titleRef } = toRefs(props);   // ✅ ref
const upper = computed(() => props.title.toUpperCase()); // ✅ access via props.
</script>
```

## Intermediate

### A watcher on a nested object never fires when a nested field changes. How do you fix it?
A getter watcher such as `watch(() => state.user, cb)` fires only when the returned reference changes, not when a field inside it is mutated. Use `watch(() => state.user.address.city, cb)` for one field, `{ deep: true }` for the whole tree (which costs more), or watch a reactive object directly, which is deep by default.

```js
watch(() => state.user, cb);                  // ❌ fires only if user is replaced
watch(() => state.user.address.city, cb);     // ✅ watch the exact field
watch(() => state.user, cb, { deep: true });  // ✅ any nested change (costlier)
watch(state.user, cb);                        // ✅ reactive object source is deep by default
```

### After `npm run build`, routes work from the home page but refreshing `/settings` returns 404. Why?
Vue Router in **history mode** needs the web server to fall back to `index.html` for unknown paths (`try_files $uri /index.html` in nginx, or rewrites on Netlify and Vercel). Alternatively use hash mode.

```nginx
location / {
  try_files $uri $uri/ /index.html;   # let Vue Router handle unknown paths
}
```
```text Netlify _redirects
/*  /index.html  200
```

## Advanced

### A Vue SSR (Nuxt) app leaks one user's data to another under load. What's the likely bug?
State is held at **module scope** (a singleton store or a plain `const state = reactive({})` outside a function), and that's shared across requests on the server. Create state per request: Pinia created per app instance, `useState` in Nuxt, and provide/inject instead of global singletons.

```ts
// ❌ module scope — one instance per server process
const currentUser = ref<User | null>(null);
export const useUser = () => currentUser;

// ✅ request-scoped state in Nuxt
export const useUser = () => useState<User | null>('user', () => null);
```

# Tricky Questions

## Beginner

### Why does the template still show the old value?
```js
const count = ref(0);
let copy = count.value;
copy++;
```
`copy` is a plain number copied out of the ref, not reactive. Only `count.value++` triggers updates.

## Intermediate

### What's the difference between `computed` and a method called in the template?
A `computed` is **cached** and recalculated only when its reactive dependencies change. A method runs **on every re-render**. Use computed for derived data, and never put side effects in a computed.

```vue
<script setup>
const now = computed(() => Date.now());  // ❌ cached forever — Date.now() isn't reactive
const fullName = computed(() => `${first.value} ${last.value}`); // ✅ cached until first/last change
</script>
```

### Does `v-if` or `v-for` take priority on the same element in Vue 3?
In Vue 3, **`v-if` has higher priority**, so it can't reference the loop variable. That's the opposite of Vue 2. Move the condition to a wrapping `<template v-for>`, or filter with a computed.

```vue
<!-- ❌ Vue 3: v-if runs first, `user` is undefined -->
<li v-for="user in users" v-if="user.active" :key="user.id">{{ user.name }}</li>

<!-- ✅ -->
<template v-for="user in users" :key="user.id">
  <li v-if="user.active">{{ user.name }}</li>
</template>
<!-- ✅ better: <li v-for="user in activeUsers" …> with a computed -->
```
