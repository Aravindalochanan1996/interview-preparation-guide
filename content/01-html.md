---
id: html
title: HTML
short: HTML
category: Web Foundations
order: 1
color: #e34c26
icon: H
summary: Document structure, semantics, forms, accessibility, SEO and how the browser turns markup into pixels.
---

# Beginner

## How the Web Delivers a Page

HTML (HyperText Markup Language) describes the **structure and meaning** of content. CSS describes presentation, JavaScript adds behaviour. Interviewers like candidates who keep these three responsibilities separate.

### What happens when you open a URL

1. The browser resolves the domain via **DNS** to an IP address.
2. It opens a **TCP** connection (plus a **TLS** handshake for HTTPS).
3. It sends an **HTTP request**; the server returns an HTML document.
4. The browser **parses HTML into the DOM**, CSS into the **CSSOM**, runs scripts, builds the **render tree**, computes **layout**, then **paints** and **composites** layers.

### Anatomy of a document

```html index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My first page</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <h1>Hello, world</h1>
    <p>This is a <strong>paragraph</strong>.</p>
    <script src="app.js" defer></script>
  </body>
</html>
```

- `<!DOCTYPE html>` switches the browser into **standards mode** (without it you get "quirks mode", which emulates old, buggy layout behaviour).
- `lang` helps screen readers and translation tools.
- `<meta charset>` must be within the first 1024 bytes.
- The **viewport meta** tag is what makes a page responsive on phones.

> [!INTERVIEW]
> "What does DOCTYPE do?" — It is not an HTML tag; it is an instruction that tells the browser to render in standards mode.

## Elements, Attributes and Nesting

An **element** = start tag + content + end tag. **Attributes** add information: `<a href="/about" title="About us">About</a>`.

### Void elements

Some elements have no content and no closing tag: `<img>`, `<br>`, `<hr>`, `<input>`, `<meta>`, `<link>`, `<source>`.

### Block vs inline

| Block-level (start on a new line, take full width) | Inline (flow inside text) |
|---|---|
| `div`, `p`, `h1`–`h6`, `ul`, `ol`, `li`, `section`, `article`, `table`, `form` | `span`, `a`, `strong`, `em`, `code`, `img`, `label`, `button` |

Strictly, HTML5 replaced "block/inline" with *content categories* (flow, phrasing, interactive…), but the CSS `display` value is what really controls layout.

### Global attributes worth knowing

- `id` — unique per page; used for fragment links and labels.
- `class` — space-separated list for styling/JS hooks.
- `data-*` — custom data, read in JS via `el.dataset.userId`.
- `hidden`, `tabindex`, `title`, `lang`, `dir`, `contenteditable`, `draggable`.

```html
<button class="btn primary" data-user-id="42">Follow</button>
<script>
  document.querySelector('button').dataset.userId; // "42"
</script>
```

## Text, Links, Images and Lists

### Headings
Use exactly one logical `<h1>` per page and never skip levels for styling — screen-reader users navigate by heading outline.

### Links
```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer">External</a>
<a href="#pricing">Jump to section</a>
<a href="mailto:me@example.com">Email</a>
<a href="/report.pdf" download>Download</a>
```

> [!WARN]
> `target="_blank"` without `rel="noopener"` historically let the new page access `window.opener` (reverse tabnabbing). Modern browsers imply `noopener`, but writing it is still expected.

### Images
```html
<img src="cat.jpg" alt="Orange cat asleep on a laptop" width="640" height="480" loading="lazy">
```
- `alt` is mandatory. Decorative images use `alt=""` so screen readers skip them.
- `width`/`height` let the browser reserve space → prevents **layout shift (CLS)**.
- `loading="lazy"` defers off-screen images.

### Lists
`<ul>` unordered, `<ol>` ordered (`start`, `reversed`), `<dl>` description list (`<dt>` term, `<dd>` description).

## Semantic HTML

Semantic elements describe *meaning*, not appearance.

```html
<header>Logo and site nav</header>
<nav aria-label="Primary">…</nav>
<main>
  <article>
    <h1>Blog post</h1>
    <section><h2>Intro</h2>…</section>
    <aside>Related links</aside>
  </article>
</main>
<footer>© 2026</footer>
```

| Element | Use when |
|---|---|
| `<main>` | The unique main content of the page (one per page) |
| `<article>` | Self-contained content that makes sense syndicated (post, comment, card) |
| `<section>` | A thematic grouping, normally with a heading |
| `<aside>` | Tangential content (sidebar, callout) |
| `<nav>` | Major navigation blocks |
| `<figure>`/`<figcaption>` | Image/diagram/code with a caption |
| `<time datetime="2026-10-21">` | Machine-readable dates |

**Why it matters:** accessibility (landmarks for screen readers), SEO (search engines understand structure), maintainability, and default browser behaviour (e.g. a `<button>` is focusable and keyboard-activatable; a `<div>` is not).

> [!INTERVIEW]
> "`div` vs `section`?" — `div` has no meaning; use it only for styling/grouping. `section` represents a thematic part of the document and should have a heading.

## Forms Basics

```html
<form action="/signup" method="post">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required autocomplete="email">

  <label for="pw">Password</label>
  <input id="pw" name="password" type="password" minlength="8" required>

  <fieldset>
    <legend>Plan</legend>
    <label><input type="radio" name="plan" value="free" checked> Free</label>
    <label><input type="radio" name="plan" value="pro"> Pro</label>
  </fieldset>

  <select name="country"><option value="in">India</option><option value="us">USA</option></select>
  <textarea name="bio" rows="3"></textarea>
  <button type="submit">Create account</button>
</form>
```

- Only fields with a **`name`** are submitted.
- `GET` puts data in the URL query string (idempotent, bookmarkable). `POST` puts it in the body.
- Input types: `text, email, password, number, tel, url, date, time, checkbox, radio, file, range, color, search, hidden`.
- A `<button>` inside a form defaults to `type="submit"` — a classic bug. Use `type="button"` for non-submit buttons.

# Intermediate

## Forms: Validation and Behaviour

### Built-in constraint validation
Attributes: `required`, `min`, `max`, `minlength`, `maxlength`, `pattern`, `step`, `type`.

```html
<input name="zip" pattern="\d{6}" title="6-digit PIN code" required>
```

CSS pseudo-classes: `:valid`, `:invalid`, `:user-invalid` (only after interaction), `:required`, `:placeholder-shown`.

JS Constraint Validation API:
```js
const input = document.querySelector('#email');
input.setCustomValidity(isTaken ? 'Email already registered' : '');
input.reportValidity();
form.checkValidity(); // boolean
```

`novalidate` on the form disables native UI so you can render your own messages.

### Labels
- Explicit: `<label for="id">` + `id` on the input.
- Implicit: wrap the input inside `<label>`.
- `placeholder` is **not** a label — it disappears and has poor contrast.

### File uploads
Need `method="post"` and `enctype="multipart/form-data"`. `accept="image/*"` filters the picker; `multiple` allows several files.

### `FormData`
```js
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  await fetch('/api/signup', { method: 'POST', body: data });
});
```

## Accessibility (a11y) Essentials

Accessibility is frequently a deciding factor for frontend roles.

### Core rules
1. **Use native elements first.** A `<button>` gives you focus, Enter/Space activation and the correct role for free.
2. Every form control needs an accessible name (label, `aria-label`, or `aria-labelledby`).
3. All functionality must work with the **keyboard** only. Don't remove focus outlines without a visible replacement (`:focus-visible`).
4. Colour contrast ≥ **4.5:1** for normal text (WCAG AA), 3:1 for large text.
5. Don't convey information by colour alone.
6. Provide text alternatives (`alt`, captions, transcripts).

### ARIA
ARIA = Accessible Rich Internet Applications. It changes the **accessibility tree** only — never behaviour.

- **Roles**: `role="dialog"`, `tablist`, `tab`, `alert`, `navigation`.
- **States/properties**: `aria-expanded`, `aria-selected`, `aria-hidden`, `aria-live`, `aria-describedby`, `aria-controls`.

> [!WARN]
> The first rule of ARIA: *don't use ARIA if a native element does the job.* `<div role="button">` still needs `tabindex="0"` and key handlers — so just use `<button>`.

### Live regions
```html
<div aria-live="polite" id="status"></div>
<!-- JS: status.textContent = '3 results found' — screen readers announce it -->
```

### Skip link
```html
<a class="skip" href="#main">Skip to content</a>
```

### Focus management
Modals should trap focus, return focus to the trigger on close, and close on Escape. The native `<dialog>` element with `showModal()` handles most of this.

## Media, Tables and Embeds

### Responsive images
```html
<!-- Resolution switching: browser picks the best file -->
<img src="hero-800.jpg"
     srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1600.jpg 1600w"
     sizes="(max-width: 600px) 100vw, 50vw" alt="Mountains">

<!-- Art direction / format fallback -->
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Mountains">
</picture>
```

### Audio/video
```html
<video controls width="640" poster="thumb.jpg" preload="metadata">
  <source src="talk.webm" type="video/webm">
  <source src="talk.mp4" type="video/mp4">
  <track kind="captions" src="talk.en.vtt" srclang="en" label="English">
</video>
```
Autoplay is only allowed when `muted`.

### Tables — for tabular data only
```html
<table>
  <caption>Quarterly revenue</caption>
  <thead><tr><th scope="col">Quarter</th><th scope="col">Revenue</th></tr></thead>
  <tbody><tr><th scope="row">Q1</th><td>$10k</td></tr></tbody>
</table>
```
`scope` and `<caption>` make tables understandable to screen readers. Never use tables for page layout.

### iframes
`<iframe src="…" sandbox loading="lazy" title="Map">`. `sandbox` restricts scripts/forms/navigation; `allow` grants specific features (camera, fullscreen).

## Script Loading, Meta Tags and SEO

### `async` vs `defer`

| | Download | Executes | Order preserved | Blocks parser |
|---|---|---|---|---|
| `<script>` | blocking | immediately | yes | **yes** |
| `async` | in parallel | as soon as downloaded | **no** | only while executing |
| `defer` | in parallel | after HTML parsed, before `DOMContentLoaded` | yes | no |
| `type="module"` | in parallel | deferred by default | yes | no |

Rule of thumb: app code → `defer` or `module`; independent third-party (analytics) → `async`.

### Resource hints
```html
<link rel="preconnect" href="https://api.example.com">
<link rel="dns-prefetch" href="https://cdn.example.com">
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="prefetch" href="/next-page.js">
```

### SEO and social meta
```html
<title>Running Shoes – Acme</title>
<meta name="description" content="Lightweight running shoes…">
<link rel="canonical" href="https://acme.com/shoes">
<meta property="og:title" content="Running Shoes">
<meta property="og:image" content="https://acme.com/og.png">
<meta name="robots" content="noindex">
```
Structured data with JSON-LD (`<script type="application/ld+json">`) enables rich results.

# Advanced

## The Critical Rendering Path

How bytes become pixels — essential for performance questions.

1. **Parse HTML → DOM.** The parser is incremental; a classic `<script>` pauses it.
2. **Parse CSS → CSSOM.** CSS is **render-blocking**: nothing paints until the CSSOM for the current stylesheets is ready. CSS also blocks script execution (scripts might read styles).
3. **Render tree** = visible DOM nodes + computed styles (`display:none` nodes excluded).
4. **Layout (reflow)** computes geometry.
5. **Paint** fills pixels into layers.
6. **Composite** combines layers on the GPU.

```html Keep the critical path short
<head>
  <link rel="preconnect" href="https://cdn.example.com">
  <style>/* inline critical above-the-fold CSS */ header{display:flex}</style>
  <link rel="preload" href="/css/main.css" as="style" onload="this.rel='stylesheet'">
  <link rel="preload" href="/hero.avif" as="image" fetchpriority="high">
  <script src="/js/app.js" defer></script>   <!-- doesn't block the parser -->
</head>
```

### Optimising it
- Inline critical CSS, load the rest asynchronously.
- `defer` scripts; avoid long main-thread tasks.
- Preload hero images/fonts; use `fetchpriority="high"` on the LCP image.
- Avoid **layout thrashing**: don't interleave DOM reads (`offsetHeight`) and writes in a loop.
- Animate `transform`/`opacity` (composite-only) instead of `top`/`width` (layout).

### Core Web Vitals
| Metric | Measures | Good |
|---|---|---|
| **LCP** Largest Contentful Paint | loading | ≤ 2.5 s |
| **INP** Interaction to Next Paint | responsiveness (replaced FID in 2024) | ≤ 200 ms |
| **CLS** Cumulative Layout Shift | visual stability | ≤ 0.1 |

## Web Components and the Shadow DOM

Web Components are native, framework-agnostic reusable elements.

```js counter.js
class MyCounter extends HTMLElement {
  static observedAttributes = ['count'];
  #count = 0;
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>button { font: inherit; }</style>
      <button part="btn"><slot>Clicks</slot>: <span>0</span></button>`;
  }
  connectedCallback() { this.shadowRoot.querySelector('button').onclick = () => this.setAttribute('count', ++this.#count); }
  attributeChangedCallback(name, _old, value) { this.shadowRoot.querySelector('span').textContent = value; }
}
customElements.define('my-counter', MyCounter);
```
```html
<my-counter>Likes</my-counter>
```

- **Custom Elements** — lifecycle: `constructor`, `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`, `adoptedCallback`.
- **Shadow DOM** — encapsulated DOM + scoped CSS. Outside styles don't leak in (except inherited properties and CSS custom properties); `::part()` exposes styling hooks.
- **`<template>` and `<slot>`** — inert markup and content projection.

Angular's `ViewEncapsulation.ShadowDom` and Lit are built on these primitives.

## Security in Markup

- **XSS**: never inject untrusted strings with `innerHTML`. Use `textContent`, framework escaping, or a sanitizer (DOMPurify).
- **Content-Security-Policy** (header or meta) restricts where scripts/styles can load from — the strongest XSS mitigation. Avoid `unsafe-inline`; use nonces or hashes.
- **Subresource Integrity**: `<script src="https://cdn…/lib.js" integrity="sha384-…" crossorigin="anonymous">` makes the browser reject tampered CDN files.
- **Clickjacking**: prevent framing with `Content-Security-Policy: frame-ancestors 'none'` (or legacy `X-Frame-Options: DENY`).
- **`rel="noopener noreferrer"`** on untrusted external links.
- **Form security**: CSRF tokens or `SameSite` cookies; `autocomplete="one-time-code"` for OTPs.
- **`iframe sandbox`** for untrusted embeds.

```html
<!-- CSP: only scripts from our origin, no inline script -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; object-src 'none'">

<!-- External links: no access to window.opener -->
<a href="https://other.site" target="_blank" rel="noopener noreferrer">Docs</a>

<!-- Third-party content in a sandbox -->
<iframe src="https://widget.example" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>

<script>
  el.textContent = userInput;                    // safe
  el.innerHTML = DOMPurify.sanitize(userHtml);   // only if you must render HTML
</script>
```

## Modern HTML Features

- **`<dialog>`** — `showModal()` gives a top-layer modal with backdrop, focus handling and Escape-to-close.
- **Popover API** — `<button popovertarget="menu">` + `<div id="menu" popover>`: light-dismiss popovers with no JS.
- **`<details>`/`<summary>`** — native disclosure widget; the `name` attribute makes an exclusive accordion.
- **`inert`** attribute — makes a subtree non-interactive and hidden from assistive tech (great behind modals).
- **`loading="lazy"`** on images and iframes, **`fetchpriority`**, **`decoding="async"`**.
- **`<search>`** element as a landmark for search forms.
- **Declarative Shadow DOM** — `<template shadowrootmode="open">` lets server-rendered HTML contain shadow roots.
- **`enterkeyhint`, `inputmode`** — control the mobile keyboard.

```html
<dialog id="confirm">
  <form method="dialog">
    <p>Delete this file?</p>
    <button value="cancel">Cancel</button>
    <button value="ok">Delete</button>
  </form>
</dialog>
<script>
  confirm.showModal();
  confirm.addEventListener('close', () => console.log(confirm.returnValue));
</script>
```

# Interview Questions

## Beginner

### What is the difference between HTML elements and tags?
A **tag** is the markup syntax (`<p>`, `</p>`). An **element** is the whole thing: start tag, content and end tag, which becomes a node in the DOM. Void elements like `<img>` are elements with only a start tag.

```html
<p class="intro">Hello</p>
<!-- <p class="intro"> = start tag, </p> = end tag
     the whole thing (tags + content) = the <p> element → one node in the DOM -->
<img src="logo.png" alt="Logo">  <!-- void element: a tag with no end tag -->
```

### What is the purpose of `<!DOCTYPE html>`?
It tells the browser to use **standards mode**. Without it, browsers fall back to quirks mode, which emulates legacy rendering bugs (e.g., different box model in tables). It is a declaration, not an element.

```html
<!DOCTYPE html>          <!-- must be the first line: standards mode -->
<html lang="en">
  <head><meta charset="utf-8"><title>Page</title></head>
  <body></body>
</html>
<script>console.log(document.compatMode); // "CSS1Compat" = standards, "BackCompat" = quirks</script>
```

### What are semantic elements and why use them?
Elements whose name describes their meaning — `header`, `nav`, `main`, `article`, `section`, `aside`, `footer`, `figure`, `time`. Benefits: **accessibility** (landmark navigation), **SEO**, readability and free built-in behaviour.

```html
<header><nav aria-label="Main"><a href="/">Home</a></nav></header>
<main>
  <article>
    <h1>Release notes</h1>
    <time datetime="2026-10-01">1 Oct 2026</time>
    <section><h2>New features</h2><p>…</p></section>
    <figure><img src="chart.png" alt="Signups up 30%"><figcaption>Q3 signups</figcaption></figure>
  </article>
  <aside>Related posts</aside>
</main>
<footer>© 2026</footer>
```

### Difference between `<div>` and `<span>`?
Both are generic, meaningless containers. `div` is block-level by default, `span` is inline. Prefer semantic elements when one fits.

```html
<div>Block: starts on a new line and fills the width</div>
<p>Inline: <span class="price">€19</span> sits inside the text flow</p>
```

### Why is the `alt` attribute important?
It is read by screen readers, shown when the image fails to load, and used by search engines. Decorative images should have `alt=""` so assistive tech ignores them. Omitting `alt` entirely makes screen readers read the file name.

```html
<img src="ceo.jpg" alt="Jane Doe, CEO, speaking at the 2026 summit">  <!-- informative -->
<img src="divider.svg" alt="">                                       <!-- decorative: ignored -->
<a href="/"><img src="logo.svg" alt="Acme home"></a>                 <!-- describe the link's purpose -->
```

### What's the difference between `id` and `class`?
`id` must be unique on a page and has high CSS specificity; it is used for fragment links, label association and ARIA references. `class` can be reused and applied multiple times; it is the normal hook for styling.

```html
<label for="email">Email</label>
<input id="email" class="field field--wide">   <!-- id: unique, used by label/ARIA/#links -->
<input id="phone" class="field">               <!-- class: reusable styling hook -->
<a href="#email">Jump to email</a>
<style>
  .field { padding: .5rem; }   /* specificity 0,1,0 */
  #email { border: 2px solid; } /* specificity 1,0,0 — hard to override */
</style>
```

### GET vs POST in forms?
`GET` appends data to the URL (visible, cached, bookmarkable, length-limited, should be idempotent — use for searches). `POST` sends data in the request body — use for creating/changing data and for sensitive or large payloads. Neither is encrypted without HTTPS.

```html
<!-- GET: /search?q=shoes — bookmarkable, idempotent -->
<form action="/search" method="get">
  <input name="q" type="search"><button>Search</button>
</form>

<!-- POST: data in the body, changes state -->
<form action="/orders" method="post">
  <input type="hidden" name="csrf" value="…">
  <input name="qty" type="number"><button>Buy</button>
</form>
```

### What are `data-*` attributes?
Custom attributes for storing extra information on elements without non-standard attributes. In JS they're available through `element.dataset` (kebab-case becomes camelCase: `data-user-id` → `dataset.userId`).

```html
<button data-product-id="42" data-in-stock="true">Add</button>
<script>
  const btn = document.querySelector('button');
  btn.dataset.productId;          // "42" (kebab-case → camelCase, always a string)
  btn.dataset.inStock === 'true';
  btn.dataset.clicked = 'yes';    // adds data-clicked="yes"
</script>
<style>[data-in-stock="false"] { opacity: .5; }</style>
```

### What is the viewport meta tag?
`<meta name="viewport" content="width=device-width, initial-scale=1">` tells mobile browsers to use the device width instead of a ~980px virtual desktop viewport. Without it, media queries don't behave as expected on phones.

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Don't add maximum-scale=1 / user-scalable=no: it blocks pinch-zoom (accessibility failure) -->
```

### What are void (self-closing) elements?
Elements that can't have children: `img, br, hr, input, meta, link, area, base, col, embed, source, track, wbr`. In HTML the trailing slash (`<br />`) is optional and ignored.

```html
<img src="a.png" alt="A">
<br>
<input type="text" name="q">
<meta charset="utf-8">
<!-- <br/> is also valid; <div/> is NOT self-closing in HTML — it's parsed as an open <div> -->
```

## Intermediate

### Explain `async` vs `defer`.
Both download the script in parallel with parsing. `async` executes as soon as it arrives (order not guaranteed, may interrupt parsing) — good for independent scripts like analytics. `defer` executes after parsing finishes, in document order, before `DOMContentLoaded` — best for app code. Module scripts are deferred by default.

```html
<script src="analytics.js" async></script>  <!-- runs when downloaded, any order -->
<script src="vendor.js" defer></script>     <!-- runs after parsing, in order -->
<script src="app.js" defer></script>        <!-- guaranteed after vendor.js -->
<script type="module" src="main.js"></script> <!-- modules are deferred by default -->
```

### How do you make a website accessible?
Semantic HTML and native controls; labels for every input; keyboard support with visible focus; sufficient colour contrast; alt text and captions; a logical heading order; ARIA only to fill gaps (e.g., `aria-expanded`, live regions); manage focus in modals; test with a screen reader (NVDA/VoiceOver) and tools like Lighthouse/axe.

```html
<a class="skip" href="#main">Skip to content</a>
<main id="main">
  <h1>Checkout</h1>
  <label for="card">Card number</label>
  <input id="card" inputmode="numeric" autocomplete="cc-number" aria-describedby="card-hint">
  <p id="card-hint">16 digits, no spaces</p>
  <button type="submit">Pay €20</button>
  <p role="alert" id="error"></p>   <!-- announced when text is inserted -->
</main>
<style>:focus-visible { outline: 3px solid #1a73e8; }</style>
```

### What is ARIA and when should you use it?
A set of attributes that modify the accessibility tree: roles, states and properties. Use it only when native HTML can't express the widget (tabs, comboboxes, live updates). It doesn't add behaviour — you still implement keyboard handling. "No ARIA is better than bad ARIA."

```html
<!-- Native first: no ARIA needed -->
<button>Save</button>

<!-- Custom widget: ARIA describes role and state -->
<div role="tablist" aria-label="Settings">
  <button role="tab" id="t1" aria-selected="true"  aria-controls="p1">General</button>
  <button role="tab" id="t2" aria-selected="false" aria-controls="p2" tabindex="-1">Privacy</button>
</div>
<div role="tabpanel" id="p1" aria-labelledby="t1">…</div>
<button aria-expanded="false" aria-controls="menu">Menu</button>
```

### What is the difference between `<section>`, `<article>` and `<div>`?
`article` is self-contained and independently distributable (blog post, comment). `section` groups thematically related content, typically with a heading. `div` has no semantics and is used purely for styling or scripting hooks.

```html
<article>                       <!-- makes sense on its own (could be syndicated) -->
  <h2>How we cut build time</h2>
  <section><h3>Background</h3>…</section>   <!-- thematic group with a heading -->
  <section><h3>Results</h3>…</section>
</article>
<div class="grid">…</div>        <!-- purely for styling/layout -->
```

### How do `srcset` and `sizes` work?
`srcset` lists candidate images with their widths (`w`) or pixel densities (`x`). `sizes` tells the browser how wide the image will be displayed at each breakpoint. The browser combines these with device pixel ratio and network conditions to choose the most appropriate file before CSS is even loaded.

```html
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1600.jpg 1600w"
  sizes="(max-width: 600px) 100vw, 50vw"
  width="1600" height="900" alt="Mountain lake">
<!-- On a 375px phone at 2x DPR: needs 750px → picks photo-800.jpg -->

<picture>
  <source type="image/avif" srcset="photo.avif">
  <img src="photo.jpg" alt="Mountain lake">
</picture>
```

### What's the difference between `localStorage`, `sessionStorage` and cookies?
`localStorage`: ~5–10 MB, persists until cleared, per origin. `sessionStorage`: per tab, cleared when the tab closes. Cookies: ~4 KB, sent with every HTTP request to the domain, can be `HttpOnly`, `Secure`, `SameSite`, and have expiry. Store auth tokens in `HttpOnly` cookies, not localStorage, to reduce XSS exposure.

```js
localStorage.setItem('theme', 'dark');          // survives restarts
sessionStorage.setItem('step', '2');            // this tab only
document.cookie = 'lang=en; Max-Age=31536000; Path=/; SameSite=Lax; Secure';
// Auth session cookie should be set by the server so JS can't read it:
// Set-Cookie: sid=abc; HttpOnly; Secure; SameSite=Strict
JSON.parse(localStorage.getItem('cart') ?? '[]'); // storage only holds strings
```

### What is the DOM?
The Document Object Model: a tree of objects the browser builds from HTML that scripts can read and modify. It's a live, language-independent API; the HTML source is just the initial input.

```js
const list = document.querySelector('ul#todos');
const li = document.createElement('li');
li.textContent = 'Write tests';
list.append(li);                       // DOM changes, HTML source doesn't
console.log(list.children.length);     // live view of the tree
document.body.parentNode === document.documentElement; // true
```

### How does form validation work natively?
Attributes like `required`, `type="email"`, `pattern`, `min/max` define constraints. On submit the browser checks them, shows messages and blocks submission. CSS can style `:invalid`/`:user-invalid`, and JS can use `checkValidity()`, `reportValidity()` and `setCustomValidity()`.

```html
<form id="signup">
  <input type="email" name="email" required>
  <input name="zip" pattern="\d{5}" title="5 digits">
  <input type="number" name="age" min="18" max="120">
  <button>Sign up</button>
</form>
<style>input:user-invalid { border-color: crimson; }</style>
<script>
  const pw = document.querySelector('[name=zip]');
  pw.addEventListener('input', () =>
    pw.setCustomValidity(pw.value === '00000' ? 'Invalid ZIP' : ''));
  document.querySelector('#signup').checkValidity(); // true/false
</script>
```

### What is the purpose of `<label>`?
It gives a form control an accessible name and enlarges the click target (clicking a label focuses/toggles its control). Associate via `for`/`id` or by wrapping.

```html
<label for="news">Subscribe to newsletter</label>
<input type="checkbox" id="news">

<!-- implicit association by wrapping -->
<label><input type="radio" name="plan" value="pro"> Pro plan</label>
```

### What are `preload`, `prefetch` and `preconnect`?
`preconnect` opens DNS+TCP+TLS early to a host. `preload` fetches a resource needed **for the current page** with high priority (fonts, hero image). `prefetch` fetches something likely needed for the **next navigation** at low priority.

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>     <!-- warm up connection -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin> <!-- needed now -->
<link rel="prefetch" href="/checkout.js">                                <!-- probably needed next -->
<link rel="dns-prefetch" href="https://api.example.com">
```

## Advanced

### Describe the critical rendering path and how to optimise it.
HTML → DOM, CSS → CSSOM, combined into the render tree → layout → paint → composite. CSS is render-blocking and parser-blocking scripts pause DOM building. Optimise by inlining critical CSS, deferring JS, preloading key assets, reducing DOM size, avoiding layout thrashing, and animating only `transform`/`opacity`.

```html
<head>
  <style>/* critical CSS inlined */</style>
  <link rel="stylesheet" href="print.css" media="print">  <!-- non-blocking for screen -->
  <script src="app.js" defer></script>
</head>
<body>
  <img src="hero.avif" fetchpriority="high" width="1200" height="600" alt="">
  <img src="footer.jpg" loading="lazy" alt="">
</body>
```

### What are Core Web Vitals and how do you improve each?
**LCP** (≤2.5s): optimise server response, preload & prioritise the hero image, use a CDN, avoid render-blocking resources. **INP** (≤200ms): break up long tasks, defer non-critical JS, use web workers, reduce hydration cost. **CLS** (≤0.1): set dimensions on images/embeds, reserve space for ads, use `font-display: optional/swap` with metric-matched fallbacks.

```js Measure them in the field
import { onLCP, onINP, onCLS } from 'web-vitals';
const send = (m) => navigator.sendBeacon('/vitals', JSON.stringify({ name: m.name, value: m.value }));
onLCP(send); onINP(send); onCLS(send);

// INP fix: yield to the main thread during long work
for (const chunk of chunks) { process(chunk); await scheduler.yield?.() ?? new Promise(r => setTimeout(r)); }
```

### What are reflow and repaint?
**Reflow (layout)** recalculates element geometry — triggered by changing size, position, content, fonts, or reading layout properties after a write. **Repaint** redraws pixels without geometry change (colour, visibility). Reflow is more expensive and can cascade to the whole tree. Batch reads/writes and prefer compositor-only properties.

```js
// BAD: layout thrashing — read/write interleaved forces reflow every iteration
items.forEach((el) => { el.style.width = el.offsetWidth + 10 + 'px'; });

// GOOD: batch reads, then batch writes
const widths = items.map((el) => el.offsetWidth);
requestAnimationFrame(() => items.forEach((el, i) => (el.style.width = widths[i] + 10 + 'px')));

el.style.transform = 'translateX(100px)'; // composite only — no reflow, no repaint
```

### Explain Shadow DOM and its benefits.
A scoped DOM subtree attached to an element. Styles inside don't leak out and outside selectors don't reach in (except inherited properties, CSS custom properties and `::part`). It enables truly encapsulated components. `mode: 'open'` exposes `element.shadowRoot`; `closed` hides it.

```js
class UserBadge extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>span { color: var(--badge-color, teal); font-weight: 600 }</style>
      <span><slot>Anonymous</slot></span>`;
  }
}
customElements.define('user-badge', UserBadge);
// <user-badge>Ada</user-badge> — page CSS for "span" won't affect it
```

### How do you prevent XSS at the HTML level?
Escape output by context (frameworks do this by default), avoid `innerHTML`/`dangerouslySetInnerHTML`/`v-html` with untrusted data or sanitize with DOMPurify, set a strict CSP with nonces, use `HttpOnly` cookies, validate URLs (block `javascript:`), and use Trusted Types in modern browsers.

```js
const comment = '<img src=x onerror="alert(1)">';
div.innerHTML = comment;                       // ❌ executes
div.textContent = comment;                     // ✅ rendered as text
div.innerHTML = DOMPurify.sanitize(comment);   // ✅ strips onerror
// Server header: Content-Security-Policy: script-src 'self' 'nonce-r4nd0m'; object-src 'none'
```

### What is Subresource Integrity (SRI)?
An `integrity` attribute containing a cryptographic hash of the expected file. The browser refuses to execute a script/stylesheet whose content doesn't match — protecting you if a CDN is compromised. Requires `crossorigin` for cross-origin resources.

```html
<script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
        integrity="sha384-…base64hash…"
        crossorigin="anonymous"></script>
```
```bash Generate the hash
curl -s https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

### How does SSR affect HTML and SEO?
Server-side rendering ships fully formed HTML so crawlers and users see content immediately (better LCP and SEO). The client then **hydrates** it by attaching event handlers. Trade-offs: server cost, Time-to-First-Byte, hydration mismatches. Alternatives: SSG (pre-render at build), ISR, streaming SSR, islands/partial hydration.

```html What the crawler receives with SSR vs a pure SPA
<!-- SSR -->
<div id="root"><h1>Blue running shoes</h1><p>€89 · In stock</p></div>
<script src="/client.js" defer></script>   <!-- hydrates the markup -->

<!-- CSR SPA -->
<div id="root"></div>                      <!-- empty until JS runs -->
<script src="/bundle.js"></script>
```

### What does the `inert` attribute do?
It makes an element and its descendants non-focusable, non-clickable and hidden from the accessibility tree. It's ideal for disabling background content while a custom modal is open.

```html
<main id="page">…</main>
<div class="drawer" role="dialog" aria-modal="true">…</div>
<script>
  const page = document.getElementById('page');
  page.inert = true;   // open drawer: background can't be focused or clicked
  // close drawer:
  page.inert = false;
</script>
```

### How would you build an accessible modal?
Prefer native `<dialog>` with `showModal()`: it renders in the top layer, makes the rest of the page inert, closes on Escape, and supports `::backdrop`. Also give it an accessible name (`aria-labelledby`), move focus to the first meaningful element, and return focus to the trigger on close.

```html
<button id="open">Delete account</button>
<dialog id="confirm" aria-labelledby="dlg-title">
  <form method="dialog">
    <h2 id="dlg-title">Delete account?</h2>
    <p>This can't be undone.</p>
    <button value="cancel" autofocus>Cancel</button>
    <button value="ok">Delete</button>
  </form>
</dialog>
<script>
  const dlg = document.getElementById('confirm');
  document.getElementById('open').onclick = () => dlg.showModal(); // focus trap + Esc + inert page
  dlg.addEventListener('close', () => console.log(dlg.returnValue)); // "ok" | "cancel"
</script>
```

# Scenario Questions

## Beginner

### Clicking "Search" reloads the whole page instead of running your JavaScript. Why?
A `<button>` inside a `<form>` defaults to `type="submit"`, so clicking it submits the form and navigates away. Either handle the form's `submit` event and call `event.preventDefault()` (better, because it also covers pressing Enter), or set `type="button"` on buttons that shouldn't submit.

```html
<form id="search">
  <input name="q">
  <button>Search</button>   <!-- type="submit" by default -->
</form>
<script>
  document.getElementById('search').addEventListener('submit', (e) => {
    e.preventDefault();                       // stop navigation
    runSearch(new FormData(e.target).get('q'));
  });
</script>
<!-- For a non-submitting button: <button type="button"> -->
```

### An accessibility audit says your icon-only buttons have "no accessible name". How do you fix it?
A screen reader announces just "button". Give the button a name: `<button aria-label="Close dialog">` with `aria-hidden="true"` on the decorative SVG, or include visually hidden text (`<span class="sr-only">Close</span>`). Use a real `<button>`, not a clickable `<div>`, so you get keyboard focus and Enter/Space handling for free.

```html
<button aria-label="Close dialog">
  <svg aria-hidden="true" focusable="false"><use href="#icon-x"/></svg>
</button>

<!-- or visually hidden text -->
<button><svg aria-hidden="true">…</svg><span class="sr-only">Close dialog</span></button>
<style>.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}</style>
```

## Intermediate

### Your landing page has a poor Largest Contentful Paint (LCP) because of the hero image. What do you change in the HTML?
- Don't lazy-load the hero image. Add `fetchpriority="high"`, and `<link rel="preload" as="image">` if the browser discovers it late (for example from CSS).
- Serve a responsive, modern format with `<picture>`/`srcset` and `sizes` (AVIF/WebP).
- Set `width` and `height` to reserve space, which also prevents layout shift.
- Defer or async non-critical scripts so they don't block the parser.

```html
<link rel="preload" as="image" href="/hero-1200.avif"
      imagesrcset="/hero-600.avif 600w, /hero-1200.avif 1200w" imagesizes="100vw">
<img src="/hero-1200.avif"
     srcset="/hero-600.avif 600w, /hero-1200.avif 1200w" sizes="100vw"
     width="1200" height="600" fetchpriority="high" decoding="async" alt="Product hero">
<!-- NOT loading="lazy" on the LCP image -->
```

## Advanced

### A third-party chat widget slows down your page and sometimes breaks your styles. How do you isolate it?
- Load it **after** the critical content (`defer`, on interaction, or with `requestIdleCallback`).
- Isolate its DOM and styles in a **Shadow DOM**, or in an `<iframe>` with `sandbox` and a restrictive `allow` attribute.
- Restrict what it can load with a **Content-Security-Policy**.
- Use `rel="preconnect"` to its origin only if you load it early. Measure the effect in Lighthouse and in your Real User Monitoring (RUM) data.

```js
// Load only when the user shows intent
chatButton.addEventListener('click', () => {
  const s = document.createElement('script');
  s.src = 'https://chat.vendor.com/widget.js';
  s.async = true;
  document.body.append(s);
}, { once: true });

// Or render it inside a shadow root so its CSS can't leak
const host = document.getElementById('chat-host').attachShadow({ mode: 'open' });
```

# Tricky Questions

## Beginner

### What does the browser render for `<p>Hello <div>World</div></p>`?
Two paragraphs and a div: `<p>Hello </p><div>World</div><p></p>`. A `<p>` can't contain block content, so the parser closes it implicitly when it meets `<div>`, and the stray `</p>` creates an empty paragraph. This is a classic cause of React hydration mismatches.

```js
document.body.innerHTML = '<p>Hello <div>World</div></p>';
console.log(document.body.innerHTML);
// "<p>Hello </p><div>World</div><p></p>"
```

### Is `<input disabled>` value sent when the form submits? What about `readonly`?
A **disabled** control is not submitted and can't receive focus. A **readonly** control is submitted and can receive focus. Use `readonly` when you want the user to see a value that must still reach the server.

```html
<form action="/save">
  <input name="a" value="1" disabled>   <!-- NOT submitted -->
  <input name="b" value="2" readonly>   <!-- submitted: ?b=2 -->
</form>
<script>console.log([...new FormData(document.forms[0])]); // [["b","2"]]</script>
```

## Intermediate

### What happens to scripts here, and in what order do they run?
```html
<script src="a.js" async></script>
<script src="b.js" defer></script>
<script src="c.js" defer></script>
<script src="d.js"></script>
```
`d.js` blocks the parser and runs as soon as it downloads. `a.js` runs whenever it finishes downloading, in any order relative to the others. `b.js` and then `c.js` run **in document order** after parsing finishes, just before `DOMContentLoaded`. Use `defer` for app code that depends on the DOM and on other scripts, and `async` for independent scripts such as analytics.

### Two `id="price"` elements exist on the page. What do `getElementById` and the `label for` attribute do?
The page is invalid HTML, but browsers tolerate it. `getElementById` returns the **first** match, and `<label for="price">` binds to the first match too, so the second field loses its label. Keep ids unique. This matters for accessibility and for test selectors.

```html
<label for="price">Price</label>
<input id="price">          <!-- label binds here -->
<input id="price">          <!-- unreachable via label / getElementById -->
<script>
  document.getElementById('price');         // first one
  document.querySelectorAll('#price').length; // 2 — find duplicates this way
</script>
```
