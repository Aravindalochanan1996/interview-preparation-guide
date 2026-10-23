---
id: css
title: CSS
short: CSS
category: Web Foundations
order: 2
color: #264de4
icon: C
summary: Cascade, specificity, box model, Flexbox, Grid, responsive design, animations and modern CSS architecture.
---

# Beginner

## Syntax, Selectors and Where CSS Lives

```css
/* selector { property: value; } */
h1 { color: #1c2330; font-size: 2rem; }
```

### Three ways to add CSS
1. **External stylesheet** `<link rel="stylesheet" href="app.css">` — cacheable, preferred.
2. **Internal** `<style>` in the head — good for critical CSS.
3. **Inline** `style="color:red"` — highest priority, hard to maintain.

### Selectors cheat sheet

| Selector | Matches |
|---|---|
| `*` | everything |
| `p` | all `<p>` elements (type selector) |
| `.card` | elements with class `card` |
| `#main` | the element with id `main` |
| `a[target="_blank"]` | attribute selector |
| `nav a` | descendant `a` anywhere inside `nav` |
| `ul > li` | direct children only |
| `h2 + p` | the `p` immediately after an `h2` (adjacent sibling) |
| `h2 ~ p` | all `p` siblings after an `h2` (general sibling) |
| `a:hover`, `li:first-child`, `input:focus` | pseudo-classes (state/position) |
| `p::first-line`, `.btn::before` | pseudo-elements (virtual parts) |

## The Box Model

Every element is a rectangular box: **content → padding → border → margin**.

```css
.box {
  width: 200px;
  padding: 20px;
  border: 2px solid;
  margin: 10px;
}
/* content-box (default): rendered width = 200 + 40 + 4 = 244px */
```

### `box-sizing`
```css
*, *::before, *::after { box-sizing: border-box; }
/* now width: 200px includes padding and border */
```
`border-box` is the industry-standard reset because sizes become predictable.

### Margin collapsing
Vertical margins between adjacent block elements **collapse** to the larger of the two (20px + 30px → 30px). It does not happen with Flexbox/Grid children, padding/border between them, or horizontal margins.

### `display` basics
- `block` — new line, full width, respects width/height.
- `inline` — flows in text; width/height and vertical margins ignored.
- `inline-block` — flows inline but respects width/height.
- `none` — removed from layout (vs `visibility: hidden` which keeps the space).

## Colours, Units and Typography

### Units

| Unit | Relative to | Typical use |
|---|---|---|
| `px` | CSS pixel | borders, shadows |
| `rem` | root font size (usually 16px) | font sizes, spacing — respects user settings |
| `em` | the element's own font size | padding that scales with text |
| `%` | parent (varies by property) | widths |
| `vw`/`vh` | 1% of viewport | full-screen sections |
| `dvh`/`svh`/`lvh` | dynamic/small/large viewport | mobile browser chrome issues |
| `ch` | width of "0" | readable line length (`max-width: 65ch`) |
| `fr` | free space in grid | grid tracks |

### Colours
`#0b7a55`, `rgb(11 122 85 / 50%)`, `hsl(160 83% 26%)`, and modern `oklch(55% 0.12 160)` (perceptually uniform), `color-mix(in srgb, red 30%, white)`.

### Typography
```css
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 1rem;
  line-height: 1.6;   /* unitless — scales with font size */
}
h1 { font-size: clamp(1.8rem, 4vw, 3rem); } /* fluid type */
```

## The Cascade, Specificity and Inheritance

When multiple rules target the same element, the browser decides using the **cascade**, in this order:

1. **Origin & importance** — user-agent < user < author; `!important` flips the order.
2. **Cascade layers** (`@layer`) — later layers win.
3. **Specificity**.
4. **Source order** — the last declared wins.

```css
@layer reset, components, utilities;          /* later layer wins regardless of specificity */
@layer components { #nav .link { color: navy; } }
@layer utilities  { .text-red { color: red; } } /* beats #nav .link */

p { color: gray; }            /* 0,0,1 */
.note { color: blue; }        /* 0,1,0 — wins over p */
#main .note { color: green; } /* 1,1,0 — wins over .note */
.card { color: teal; }        /* inherited by children unless they set color */
.card a { color: inherit; }   /* force inheritance for a non-inheriting default */
```

### Specificity as (a, b, c)
- **a** — ID selectors
- **b** — classes, attributes, pseudo-classes
- **c** — type selectors and pseudo-elements

| Selector | Specificity |
|---|---|
| `p` | 0,0,1 |
| `.nav a` | 0,1,1 |
| `#header .nav a:hover` | 1,2,1 |
| `style=""` | beats all selectors |
| `:where(.x)` | 0,0,0 always |
| `:is(#a, .b)` | takes the **most** specific argument (1,0,0) |

Universal `*` and combinators add nothing.

### Inheritance
Text-related properties (`color`, `font-*`, `line-height`, `visibility`) inherit; box properties (`margin`, `border`, `width`) don't. Force with `inherit`, reset with `initial`, `unset`, `revert`.

> [!INTERVIEW]
> Avoid `!important` and ID selectors in styling. Keep specificity low and flat so components are easy to override.

## Positioning

| `position` | Behaviour |
|---|---|
| `static` | default, normal flow; `top/left` ignored |
| `relative` | normal flow, offset visually; creates a containing block for absolute children |
| `absolute` | removed from flow; positioned relative to the nearest **positioned** ancestor |
| `fixed` | relative to the viewport (unless an ancestor has `transform`/`filter`) |
| `sticky` | relative until a scroll threshold, then sticks within its parent |

```css
.card { position: relative; }
.badge { position: absolute; top: 8px; right: 8px; }
.header { position: sticky; top: 0; }
```

### `z-index` and stacking contexts
`z-index` only works on positioned elements (or flex/grid children). It's compared **within the same stacking context**. A new stacking context is created by `position` + `z-index`, `opacity < 1`, `transform`, `filter`, `isolation: isolate`, `will-change`, etc. That's why `z-index: 9999` sometimes "doesn't work".

# Intermediate

## Flexbox

One-dimensional layout (a row **or** a column).

```css
.toolbar {
  display: flex;
  flex-direction: row;          /* main axis */
  justify-content: space-between; /* main-axis alignment */
  align-items: center;          /* cross-axis alignment */
  gap: 12px;
  flex-wrap: wrap;
}
.toolbar .search { flex: 1; }   /* grow to fill */
```

### `flex` shorthand = `flex-grow flex-shrink flex-basis`
- `flex: 1` → `1 1 0%` — share free space equally.
- `flex: auto` → `1 1 auto` — grow based on content size.
- `flex: none` → `0 0 auto` — rigid.
- `flex: 0 0 200px` → fixed 200px column.

### Common patterns
```css
/* Perfect centering */
.center { display: flex; justify-content: center; align-items: center; }

/* Push last item to the right */
.nav .logout { margin-left: auto; }

/* Sticky footer */
body { display: flex; flex-direction: column; min-height: 100vh; }
main { flex: 1; }
```

> [!WARN]
> Flex items have `min-width: auto`, so long text/code can overflow. Fix with `min-width: 0` on the item.

## CSS Grid

Two-dimensional layout (rows **and** columns).

```css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  gap: 16px;
  min-height: 100vh;
}
header { grid-area: header; }
aside  { grid-area: sidebar; }
main   { grid-area: main; }
footer { grid-area: footer; }
```

### Responsive cards without media queries
```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
```
`auto-fill` keeps empty tracks; `auto-fit` collapses them so items stretch.

### Placing items
```css
.hero { grid-column: 1 / -1; }      /* span all columns */
.tall { grid-row: span 2; }
```

### Subgrid
`grid-template-columns: subgrid` lets nested children align to the parent grid tracks — great for card layouts with aligned headings/footers.

| Use Flexbox when | Use Grid when |
|---|---|
| content-driven, one direction (navbars, button groups) | layout-driven, two dimensions (page shells, galleries) |

## Responsive Design

### Mobile-first media queries
```css
.grid { display: grid; gap: 1rem; }
@media (min-width: 768px)  { .grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1200px) { .grid { grid-template-columns: repeat(3, 1fr); } }
```

### Other media features
`prefers-color-scheme`, `prefers-reduced-motion`, `hover: hover`, `pointer: coarse`, `orientation`, range syntax `@media (400px <= width <= 800px)`.

### Container queries
Components respond to **their container**, not the viewport.
```css
.card-wrap { container-type: inline-size; }
@container (min-width: 420px) {
  .card { display: grid; grid-template-columns: 120px 1fr; }
}
```

### Fluid techniques
`clamp(min, preferred, max)`, `min()`, `max()`, `aspect-ratio: 16 / 9`, `object-fit: cover` for images.

## Transitions, Transforms and Animations

```css
.btn { transition: transform .2s ease, background-color .2s; }
.btn:hover { transform: translateY(-2px) scale(1.02); }

@keyframes spin { to { transform: rotate(360deg); } }
.loader { animation: spin 1s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

### Performance
Animate **`transform` and `opacity`** — these run on the compositor without layout/paint. Animating `width`, `top`, `margin` triggers layout every frame. `will-change: transform` hints a layer promotion (use sparingly — memory cost).

### Modern additions
- **View Transitions API** — animated transitions between DOM states/pages.
- **Scroll-driven animations** — `animation-timeline: scroll()` / `view()`.
- `@starting-style` — animate elements in from `display: none`.

## Pseudo-classes, Pseudo-elements and Custom Properties

### Powerful selectors
```css
li:nth-child(odd) {}             /* zebra rows */
li:nth-child(3n + 1) {}
input:not([type="checkbox"]) {}
.card:has(img) { padding: 0; }   /* parent selector! */
form:has(:invalid) button { opacity: .5; }
:is(h1, h2, h3):hover {}
a:focus-visible { outline: 2px solid; }
```

### Pseudo-elements
`::before`/`::after` (need `content`), `::placeholder`, `::selection`, `::marker`, `::backdrop`, `::first-letter`.

### Custom properties (CSS variables)
```css
:root { --brand: #0b7a55; --space: 8px; }
.btn { background: var(--brand); padding: calc(var(--space) * 2); }
[data-theme="dark"] { --brand: #34c38f; }
```
Unlike Sass variables, custom properties are **live at runtime**, inherit through the DOM, and can be changed by JS: `el.style.setProperty('--brand', 'red')`. `@property` registers typed, animatable variables.

# Advanced

## CSS Architecture at Scale

### Methodologies
- **BEM** — `block__element--modifier` (`.card__title--large`). Flat specificity, self-documenting.
- **OOCSS / SMACSS / ITCSS** — separate structure from skin; organise by specificity layers.
- **Utility-first (Tailwind)** — compose small single-purpose classes; no naming, purged unused CSS, but verbose markup.
- **CSS Modules** — locally scoped class names generated at build time (`styles.title` → `title_x7a2`).
- **CSS-in-JS** (styled-components, Emotion) — co-located, dynamic styles; runtime cost; zero-runtime variants (vanilla-extract, Linaria, Panda).

### Cascade layers
```css
@layer reset, base, components, utilities;
@layer components { .btn { padding: 8px 16px; } }
@layer utilities { .p-0 { padding: 0; } } /* wins regardless of specificity */
```
Layers make the cascade explicit and end specificity wars with third-party CSS.

### Native nesting and scope
```css
.card {
  padding: 1rem;
  & .title { font-weight: 700; }
  &:hover { box-shadow: 0 2px 8px #0002; }
}
@scope (.card) to (.card-content) { img { border-radius: 8px; } }
```

## Rendering Performance and CSS

- **Selector matching** runs right-to-left; deep descendant selectors are slightly slower, but rarely the bottleneck today.
- Big costs: **large DOM**, **forced synchronous layout**, expensive paints (`box-shadow` blur, `filter`) on big areas, and **unused CSS** blocking render.
- **`content-visibility: auto`** skips rendering off-screen sections (+ `contain-intrinsic-size` to reserve space).
- **`contain: layout paint`** isolates subtrees so changes don't invalidate the whole page.
- Critical CSS inlined; rest loaded with `media="print" onload="this.media='all'"` or preload.
- Fonts: `font-display: swap`, preload WOFF2, subset fonts, use `size-adjust` to reduce CLS.

### Layout thrashing example
```js
// BAD: read/write interleaved → layout each iteration
items.forEach(el => { el.style.width = el.offsetWidth + 10 + 'px'; });
// GOOD: batch reads, then writes
const widths = items.map(el => el.offsetWidth);
items.forEach((el, i) => { el.style.width = widths[i] + 10 + 'px'; });
```

## Formatting Contexts and Layout Internals

### Block Formatting Context (BFC)
A BFC is an isolated layout region. Created by: root, floats, `position: absolute/fixed`, `display: inline-block | flow-root | flex/grid items`, `overflow` other than `visible`.

A BFC:
- contains its floats (fixes the "collapsed parent" problem),
- prevents margin collapsing with its children,
- doesn't overlap floats.

```css
.clearfix { display: flow-root; } /* modern clearfix */
```

### Containing blocks
Percentages and absolute positioning resolve against the **containing block**: for `absolute` it's the nearest positioned ancestor's padding box; for `fixed` it's the viewport — unless an ancestor has `transform`, `filter`, `perspective` or `contain`, which become the containing block.

### Intrinsic sizing
`min-content`, `max-content`, `fit-content()` — used heavily in Grid (`grid-template-columns: max-content 1fr`).

## Theming, Dark Mode and Accessibility in CSS

```css
:root {
  color-scheme: light dark;
  --bg: light-dark(#fff, #0e1116);
  --text: light-dark(#1c2330, #e6e9ef);
}
body { background: var(--bg); color: var(--text); }
```

- Respect `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `forced-colors` (Windows High Contrast).
- Never `outline: none` without a `:focus-visible` replacement.
- Visually hide but keep accessible:
```css
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
```
- Use logical properties (`margin-inline-start`, `padding-block`) for RTL support.
- Ensure tap targets ≥ 24×24 CSS px (WCAG 2.2), ideally 44×44.

# Interview Questions

## Beginner

### Explain the CSS box model.
Every element is a box of content, padding, border and margin. With `box-sizing: content-box` (default), `width` sets only the content; padding and border are added on top. With `border-box`, `width` includes padding and border, which makes layouts predictable.

```css
.box {
  width: 200px; padding: 20px; border: 5px solid; margin: 10px;
}
/* content-box: rendered width = 200 + 40 + 10 = 250px */
*, *::before, *::after { box-sizing: border-box; } /* now rendered width = 200px */
```

### What's the difference between `display: none` and `visibility: hidden`?
`display: none` removes the element from layout and the accessibility tree — it takes no space. `visibility: hidden` hides it but keeps its space. `opacity: 0` keeps it in layout and it still receives clicks.

```css
.gone      { display: none; }       /* no space, not in a11y tree, no events */
.invisible { visibility: hidden; }  /* keeps space, not in a11y tree, no events */
.faded     { opacity: 0; }          /* keeps space, still focusable & clickable! */
```

### How is specificity calculated?
As a tuple (IDs, classes/attributes/pseudo-classes, elements/pseudo-elements), compared left to right. Inline styles beat selectors, `!important` beats normal declarations. Equal specificity → last rule wins. `:where()` adds zero; `:is()`/`:not()`/`:has()` take their most specific argument.

```css
li                     { }  /* (0,0,1) */
ul li.active           { }  /* (0,1,2) */
#menu a:hover          { }  /* (1,1,1) */
:is(#menu, .nav) a     { }  /* (1,0,1) — :is() takes its most specific argument */
:where(#menu, .nav) a  { }  /* (0,0,1) — :where() is always 0 */
.btn { color: red !important; } /* beats everything non-important */
```

### `em` vs `rem`?
`rem` is relative to the root (`html`) font size; `em` is relative to the current element's font size (for `font-size` itself, the parent's). `em` compounds in nested elements; `rem` is predictable. Both respect the user's browser font settings, unlike `px`.

```css
html { font-size: 16px; }
.parent { font-size: 1.25em; }   /* 20px */
.parent .child { font-size: 1.25em; } /* 25px — em compounds */
.parent .child2 { font-size: 1.25rem; } /* 20px — always relative to html */
.button { padding: 0.5em 1em; }  /* em for spacing that scales with the button's own text */
```

### What are pseudo-classes and pseudo-elements?
Pseudo-classes select elements in a state or position (`:hover`, `:focus`, `:nth-child()`, `:checked`). Pseudo-elements style a part of an element or insert virtual content (`::before`, `::after`, `::placeholder`, `::first-line`). Pseudo-elements use double colons.

```css
a:hover, a:focus-visible { text-decoration: underline; }  /* pseudo-classes: state */
li:nth-child(odd) { background: #f6f6f6; }
input:checked + label { font-weight: bold; }

.quote::before { content: "“"; }        /* pseudo-elements: part of an element */
p::first-line { font-variant: small-caps; }
::selection { background: gold; }
```

### Explain the `position` values.
`static` (normal flow), `relative` (offset from its normal position, still occupies space), `absolute` (out of flow, relative to nearest positioned ancestor), `fixed` (relative to viewport), `sticky` (relative until a scroll threshold, then fixed within its container).

```css
.card     { position: relative; }               /* containing block for children */
.badge    { position: absolute; top: 8px; right: 8px; }
.toast    { position: fixed; bottom: 16px; right: 16px; }
.thead th { position: sticky; top: 0; background: white; }
```

### How do you center a div?
Horizontally for a block: `margin: 0 auto` with a width. Both axes: parent `display: flex; justify-content: center; align-items: center;` or `display: grid; place-items: center;`. For absolute: `top:50%; left:50%; transform: translate(-50%,-50%)` or `inset: 0; margin: auto`.

```css
.parent-grid { display: grid; place-items: center; min-height: 100vh; }

.parent-flex { display: flex; justify-content: center; align-items: center; }

.block { width: 600px; margin-inline: auto; }   /* horizontal only */

.overlay { position: absolute; inset: 0; margin: auto; width: 300px; height: 200px; }
```

### What is margin collapsing?
Adjacent vertical margins of block elements combine into a single margin equal to the larger one. It occurs between siblings, parent and first/last child (with no padding/border between), and empty blocks. It doesn't happen in flex/grid containers or BFC boundaries.

```css
.a { margin-bottom: 30px; }
.b { margin-top: 20px; }    /* gap = 30px, not 50px */

.parent { margin-top: 0; }
.parent > h1 { margin-top: 40px; } /* escapes and pushes the parent down */
.parent { display: flow-root; }    /* fix: new BFC stops the collapse (or padding/border) */
```

## Intermediate

### Flexbox vs Grid — when do you use each?
Flexbox is one-dimensional and content-out: great for distributing items along a row or column (toolbars, nav, centering). Grid is two-dimensional and layout-in: define rows and columns, then place items (page layouts, galleries). They combine well — Grid for the shell, Flex inside components.

```css
/* Flexbox: a row of items sized by their content */
.toolbar { display: flex; gap: 8px; align-items: center; }
.toolbar .spacer { margin-left: auto; }

/* Grid: a 2-D page layout */
.page {
  display: grid;
  grid-template: "header header" auto "sidebar main" 1fr "footer footer" auto / 240px 1fr;
}
.page > header { grid-area: header; }
```

### What does `flex: 1` mean?
Shorthand for `flex-grow: 1; flex-shrink: 1; flex-basis: 0%`. Items ignore their content size as a starting point and split free space equally.

```css
.item { flex: 1; }          /* = flex: 1 1 0% → equal columns regardless of content */
.item { flex: auto; }       /* = flex: 1 1 auto → grow from content size */
.sidebar { flex: 0 0 250px; } /* fixed 250px, never grow or shrink */
.main    { flex: 1; min-width: 0; } /* min-width:0 lets long content shrink */
```

### What's the difference between `auto-fill` and `auto-fit`?
Both create as many tracks as fit. `auto-fill` keeps empty tracks (items keep their min size), `auto-fit` collapses empty tracks to zero so existing items stretch to fill the row. The difference only shows when there are fewer items than slots.

```css
.fill { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
/* 2 items in a 1000px row → 2 items at 200px + 3 empty tracks */

.fit  { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
/* 2 items in a 1000px row → 2 items stretched to 500px each */
```

### What is a stacking context?
A 3D layering group. Elements inside are stacked relative to each other and the whole context is painted as one unit in its parent. Created by positioned elements with `z-index`, `opacity < 1`, `transform`, `filter`, `isolation: isolate`, `will-change`, flex/grid children with `z-index`. A child can never escape its parent's stacking context, whatever its z-index.

```css
.header { position: relative; z-index: 10; }
.content { transform: translateZ(0); }    /* creates a stacking context! */
.content .modal { position: fixed; z-index: 9999; } /* still below .header */

.isolated { isolation: isolate; }        /* explicit new context, no side effects */
```

### How do CSS variables differ from Sass variables?
Sass variables are compiled away at build time — static. CSS custom properties exist at runtime, cascade and inherit through the DOM, can be scoped to selectors and media queries, and can be read/changed with JavaScript. That makes them ideal for theming.

```scss
// Sass: compiled away
$brand: #0a66c2;
.btn { background: $brand; }       // → background: #0a66c2

// CSS custom properties: live at runtime, cascade, themeable
:root { --brand: #0a66c2; }
[data-theme="dark"] { --brand: #66a3ff; }
.btn { background: var(--brand, blue); }
```
```js
document.documentElement.style.setProperty('--brand', 'tomato'); // change at runtime
```

### What are container queries and why do they matter?
They let a component style itself based on the size of its container (`container-type: inline-size` + `@container (min-width: …)`) rather than the viewport. This makes truly reusable components that adapt whether placed in a sidebar or main column.

```css
.card-wrapper { container-type: inline-size; container-name: card; }

.card { display: grid; gap: 1rem; }
@container card (min-width: 480px) {
  .card { grid-template-columns: 160px 1fr; }  /* same component, side-by-side when there's room */
}
.card h2 { font-size: clamp(1rem, 4cqi, 1.75rem); } /* cqi = 1% of container width */
```

### How do you make an image responsive?
`max-width: 100%; height: auto;`, use `srcset`/`sizes` or `<picture>` to serve appropriate files, `aspect-ratio` or width/height attributes to avoid CLS, and `object-fit: cover` for cropping into fixed boxes.

```css
img { max-width: 100%; height: auto; display: block; }
.avatar { width: 64px; aspect-ratio: 1; object-fit: cover; border-radius: 50%; }
.hero   { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
```

### What does `:has()` do?
It's a relational "parent" selector: `.card:has(img)` matches cards that contain an image; `label:has(+ input:invalid)` styles a label based on a sibling. It enables state-based styling that previously required JS.

```css
.card:has(img) { grid-template-rows: 200px auto; }       /* cards with an image */
form:has(input:invalid) button[type=submit] { opacity: .5; }
label:has(+ input:required)::after { content: " *"; color: crimson; }
body:has(dialog[open]) { overflow: hidden; }             /* lock scroll when modal open */
```

### How do you approach mobile-first design?
Write base styles for the smallest screen, then add `min-width` media queries to enhance for larger screens. This keeps mobile CSS lean, forces content prioritisation and aligns with progressive enhancement.

```css
.nav { display: flex; flex-direction: column; }         /* base = phone */

@media (min-width: 768px)  { .nav { flex-direction: row; } }
@media (min-width: 1200px) { .container { max-width: 1140px; margin-inline: auto; } }

@media (hover: hover) { .card:hover { transform: translateY(-2px); } } /* only for mice */
```

## Advanced

### What is a Block Formatting Context and how is it useful?
An independent layout region where block boxes are laid out vertically and floats are contained. Creating one (`display: flow-root`, `overflow: hidden`, flex/grid items, etc.) fixes parent height collapse with floats, stops margin collapsing through the boundary, and prevents content wrapping around floats.

```css
.float-left { float: left; width: 200px; }
.wrapper { display: flow-root; }  /* contains the float, so the wrapper has height */
.text    { overflow: hidden; }    /* BFC next to a float doesn't wrap around it */
```

### Why does `z-index: 9999` sometimes not work?
Because z-index is only compared within the same stacking context. If the element's ancestor creates a stacking context with a lower z-index (or via `transform`/`opacity`), the element can't appear above content in a sibling context. Fix by restructuring, using `isolation`, or rendering in a portal/top-layer (`<dialog>`, popover).

```css
.parent { position: relative; z-index: 1; }    /* context with z-index 1 */
.parent .tooltip { position: absolute; z-index: 9999; } /* 9999 inside "1" */
.sibling { position: relative; z-index: 2; }   /* paints above the whole .parent */
/* Fix: move the tooltip out (portal) or raise .parent's z-index */
```

### Which CSS properties are cheap to animate and why?
`transform` and `opacity` — they can be handled by the compositor thread on the GPU without recalculating layout or repainting. Properties like `width`, `height`, `top`, `margin` trigger layout; `background-color`, `box-shadow` trigger paint.

```css
/* ❌ triggers layout every frame */
.panel.open { left: 0; transition: left .3s; }

/* ✅ compositor only */
.panel      { transform: translateX(-100%); transition: transform .3s, opacity .3s; }
.panel.open { transform: translateX(0); }

@media (prefers-reduced-motion: reduce) { .panel { transition: none; } }
```

### How would you architect CSS for a large application?
Design tokens as custom properties; a component-scoped strategy (CSS Modules, BEM, or utility-first); cascade layers to order reset/base/components/utilities; low, flat specificity; a design system with documented components (Storybook); linting (Stylelint); and purging/critical CSS in the build.

```css
@layer reset, tokens, base, components, utilities;

@layer tokens {
  :root { --space-2: .5rem; --space-4: 1rem; --radius: 8px; --color-primary: #0a66c2; }
}
@layer components {
  .c-button { padding: var(--space-2) var(--space-4); border-radius: var(--radius); }
  .c-button--primary { background: var(--color-primary); color: white; }
}
@layer utilities { .u-mt-4 { margin-top: var(--space-4); } }
```

### Explain cascade layers.
`@layer` defines named layers whose order determines precedence before specificity is considered. Rules in a later layer beat an earlier layer even if less specific; unlayered styles beat all layers. It makes overriding third-party/reset CSS predictable without `!important`.

```css
@layer base, vendor, app;
@import url("bootstrap.css") layer(vendor);

@layer app  { .btn { background: green; } }           /* wins: later layer */
@layer vendor { #form .btn.btn-primary { background: blue; } } /* more specific, still loses */

.btn { background: red; } /* unlayered styles beat ALL layers */
```

### What causes layout shift and how do you prevent it in CSS?
Images/iframes without dimensions, web fonts swapping, dynamically injected content, and animations of layout properties. Prevent with `width`/`height` or `aspect-ratio`, reserved space (min-height) for ads/embeds, `font-display` with `size-adjust` fallback metrics, and animating `transform` instead of position.

```css
img, video { aspect-ratio: attr(width) / attr(height); height: auto; } /* or width/height attrs */
.ad-slot { min-height: 250px; }                 /* reserve space for late content */
@font-face {
  font-family: Inter; src: url(inter.woff2) format("woff2");
  font-display: swap; size-adjust: 107%;        /* fallback metrics close to the web font */
}
```

### What does `content-visibility: auto` do?
Tells the browser to skip layout and paint for off-screen content until it nears the viewport, greatly reducing initial rendering work on long pages. Pair with `contain-intrinsic-size` so the scrollbar doesn't jump.

```css
.comment-section, .article-card {
  content-visibility: auto;
  contain-intrinsic-size: auto 600px;  /* placeholder height so the scrollbar doesn't jump */
}
```

### CSS-in-JS vs CSS Modules vs Tailwind — trade-offs?
CSS-in-JS: co-location and dynamic props, but runtime cost and SSR complexity (zero-runtime libs fix this). CSS Modules: plain CSS with local scoping, no runtime, less dynamic. Tailwind: fast iteration, consistent tokens, tiny output after purge, but verbose markup and a learning curve. Choice depends on team, SSR needs and design system.

```jsx Same button three ways
// CSS Modules
import s from './Button.module.css';      // .primary { background: blue }
<button className={s.primary}>Save</button>

// CSS-in-JS (styled-components)
const Btn = styled.button`background: ${(p) => (p.danger ? 'red' : 'blue')};`;
<Btn danger>Delete</Btn>

// Tailwind
<button className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">Save</button>
```

# Scenario Questions

## Beginner

### The page scrolls horizontally on mobile by a few pixels. How do you find the culprit?
Something is wider than the viewport. In DevTools, add `* { outline: 1px solid red }` or run `[...document.querySelectorAll('*')].filter(e => e.scrollWidth > document.documentElement.clientWidth)` in the console. Usual causes:
- `width: 100vw`, which includes the scrollbar
- fixed widths
- long unbroken words or URLs (use `overflow-wrap: anywhere`)
- negative margins
- images without `max-width: 100%`

Fix the element itself instead of hiding the problem with `overflow-x: hidden` on `body`.

```js Paste in the DevTools console
const w = document.documentElement.clientWidth;
[...document.querySelectorAll('*')]
  .filter((el) => el.getBoundingClientRect().right > w)
  .forEach((el) => { console.log(el); el.style.outline = '2px solid red'; });
```
```css Common fixes
img, video, iframe { max-width: 100%; }
.full-bleed { width: 100%; }  /* not 100vw — 100vw includes the scrollbar */
pre { overflow-x: auto; }
```

### Your `z-index: 9999` modal still appears under the header. Why?
z-index only competes **within the same stacking context**. If the modal sits inside a parent that creates its own stacking context (`transform`, `opacity < 1`, `filter`, `position` with a `z-index`, `isolation: isolate`), it can never rise above siblings of that parent. Render the modal at the root (a React/Vue **portal** or `<dialog>` with `showModal()`, which uses the top layer), or remove the property that creates the context.

```css
.layout { transform: translateZ(0); } /* ← accidental stacking context around the modal */
.layout .modal { position: fixed; z-index: 9999; }
.header { position: sticky; z-index: 100; } /* outside .layout → wins */

/* Fix: render the modal as a direct child of <body> (portal) or use <dialog> (top layer) */
```

## Intermediate

### A card grid needs 4 columns on desktop, 2 on tablet and 1 on mobile, with no media queries. How?
```css
.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
}
```
`auto-fill` with `minmax` creates as many columns as fit, and `min(240px, 100%)` stops overflow on very small screens. Use **container queries** (`@container`) when a component must adapt to its own width instead of the viewport's.

## Advanced

### Animations on your dashboard are janky (dropped frames). How do you diagnose and fix them?
Record in the DevTools **Performance** panel and look for long Layout and Paint events. Animate only `transform` and `opacity`, which the compositor handles, instead of `top`, `left`, `width` or `box-shadow`. Use `will-change` sparingly, avoid layout thrashing (reading `offsetHeight` and then writing styles in a loop), contain expensive areas with `contain: layout paint` or `content-visibility: auto`, and respect `prefers-reduced-motion`.

```css
/* Before: animating height re-layouts the whole grid */
.chart { transition: height .3s; }

/* After */
.chart { transform-origin: bottom; transition: transform .3s; will-change: transform; }
.chart.grow { transform: scaleY(1.5); }
```

# Tricky Questions

## Beginner

### Two sibling divs have `margin-bottom: 30px` and `margin-top: 20px`. What's the gap between them?
**30px**, not 50px. Vertical margins between block elements **collapse** to the larger of the two. They don't collapse in flex or grid containers, between floats, or when padding or a border separates parent and child margins.

```css
.a { margin-bottom: 30px; } .b { margin-top: 20px; }  /* block flow → 30px */
.parent { display: flex; flex-direction: column; }   /* flex → 50px (no collapsing) */
```

### Which color wins?
```css
#nav a { color: red; }
.menu .link:hover { color: blue; }
a { color: green !important; }
```
**Green**, because `!important` beats normal declarations whatever their specificity. Without it, `#nav a` (1,0,1) beats `.menu .link:hover` (0,3,0) even on hover, because a single id outweighs any number of classes.

## Intermediate

### Why doesn't `height: 100%` work on my div?
A percentage height resolves against the parent's **explicit** height. If the parent's height is `auto`, the percentage behaves like `auto`. Give each ancestor a height, or use `min-height: 100dvh`, flexbox (`flex: 1`) or grid instead.

```css
html, body { height: 100%; }     /* every ancestor needs a definite height */
.full { height: 100%; }

.full-modern { min-height: 100dvh; } /* simpler: dynamic viewport height */
```

### `position: sticky` does nothing. What are the common reasons?
- No `top` (or `bottom`) value is set.
- An ancestor has `overflow: hidden`, `auto` or `scroll`, so the element sticks within that ancestor instead of the viewport.
- The parent is only as tall as the sticky element, so there's no room to stick.
- In a flex container, the item is stretched; use `align-self: flex-start`.

```css
.sidebar { position: sticky; top: 0; }          /* top is required */
.wrapper { overflow: hidden; }                  /* ❌ breaks sticky — use overflow: clip */
.wrapper { overflow: clip; }                    /* ✅ clips without a scroll container */
.row { display: flex; align-items: flex-start; }/* stretch makes the item as tall as the row */
```
