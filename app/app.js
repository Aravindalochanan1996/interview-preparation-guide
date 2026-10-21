(() => {
  'use strict';

  const DATA = window.IPG_DATA || { topics: [] };
  const TOPICS = DATA.topics;
  const byId = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
  const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
  const PATHS = DATA.paths || [];
  const pathById = Object.fromEntries(PATHS.map((p) => [p.id, p]));
  TOPICS.forEach((t) => (t.scenarios = t.scenarios || []));
  const SCEN_TOPICS = TOPICS.filter((t) => t.scenarios.length);
  const TYPES = { scenario: '🧩 Scenario', tricky: '🧠 Tricky' };

  const $ = (s, el = document) => el.querySelector(s);
  const main = $('#main');
  const sidebar = $('#sidebar');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // titles may contain `inline code` from the markdown source
  const fmt = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

  // ---------- persistent state ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ipg.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ipg.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const done = new Set(store.get('done', []));
  const mastered = new Set(store.get('mastered', []));
  const save = () => { store.set('done', [...done]); store.set('mastered', [...mastered]); };

  // scenario/tricky ids live in their own namespace, so their mastery keys do too
  const scenKey = (t, x) => `${t.id}/scenario/${x.id}`;
  const topicProgress = (t) => {
    const total = t.lessons.length + t.questions.length + t.scenarios.length;
    const d = t.lessons.filter((l) => done.has(`${t.id}/${l.slug}`)).length;
    const m = t.questions.filter((q) => mastered.has(`${t.id}/${q.id}`)).length;
    const s = t.scenarios.filter((x) => mastered.has(scenKey(t, x))).length;
    return { lessons: d, questions: m, scenarios: s, pct: total ? Math.round(((d + m + s) / total) * 100) : 0 };
  };

  // ---------- theme ----------
  const applyHljsTheme = () => {
    const dark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark && !document.documentElement.dataset.theme) document.documentElement.dataset.theme = 'dark';
    $('#hljs-light').disabled = dark;
    $('#hljs-dark').disabled = !dark;
  };
  applyHljsTheme();
  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    try { localStorage.setItem('ipg.theme', next); } catch (e) { /* ignore */ }
    applyHljsTheme();
  });

  // ---------- top nav ----------
  $('#topnav').innerHTML = TOPICS.map((t) => `<a href="#/t/${t.id}" data-id="${t.id}">${esc(t.short)}</a>`).join('');
  $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));

  const icon = (t, cls = '') => `<span class="t-icon ${cls}" style="background:${t.color}">${esc(t.icon)}</span>`;
  const lvl = (l) => `<span class="lvl ${l}"><span class="dot ${l}"></span>${l}</span>`;

  // ---------- views ----------
  function homeSidebar() {
    const cats = groupBy(TOPICS, (t) => t.category);
    return `<div class="side-group"><a class="side-link special" href="#/">⌂ Home</a><a class="side-link special" href="#/paths">🧭 Learning paths</a><a class="side-link special" href="#/scenarios">🧩 Scenario &amp; tricky questions</a><a class="side-link special" href="#/practice">⚡ Flashcard practice</a></div>` +
      Object.entries(cats).map(([c, ts]) => `<div class="side-group"><h3>${esc(c)}</h3>${ts.map((t) => {
        const p = topicProgress(t);
        return `<a class="side-link" href="#/t/${t.id}"><span class="dot" style="background:${t.color}"></span>${esc(t.title)}<span class="count">${p.pct}%</span></a>`;
      }).join('')}</div>`).join('');
  }

  function renderHome() {
    const L = TOPICS.reduce((a, t) => a + t.lessons.length, 0);
    const Q = TOPICS.reduce((a, t) => a + t.questions.length, 0);
    const S = TOPICS.reduce((a, t) => a + t.scenarios.length, 0);
    const doneCount = done.size, masteredCount = mastered.size;
    const cats = groupBy(TOPICS, (t) => t.category);
    sidebar.innerHTML = homeSidebar();
    main.innerHTML = `<div class="wide">
      <section class="hero">
        <div>
          <h1>Your interview preparation kit</h1>
          <p>Learn every topic from the fundamentals up to the questions senior interviewers actually ask. Each track goes <strong>Beginner → Intermediate → Advanced</strong>, then finishes with a bank of interview questions and model answers. Follow a <strong>learning path</strong> to go end to end — from zero to building and shipping real projects.</p>
          <div class="btn-row">
            ${activePath()
              ? `<a class="btn" href="${pathResumeLink(activePath())}">Continue ${esc(activePath().title)} →</a>`
              : `<a class="btn" href="#/paths">🧭 Choose a learning path</a>`}
            <a class="btn ghost" href="${resumeLink()}">${doneCount ? 'Continue last track' : 'Browse tracks'}</a>
            <a class="btn ghost" href="#/scenarios">🧩 Scenario &amp; tricky Qs</a>
            <a class="btn ghost" href="#/practice">⚡ Flashcards</a>
          </div>
        </div>
        <div class="hero-stats">
          <div class="stat"><b>${TOPICS.length}</b><span>Tracks</span></div>
          <div class="stat"><b>${L}</b><span>Lessons</span></div>
          <div class="stat"><b>${Q}</b><span>Interview Q&amp;A</span></div>
          <div class="stat"><b>${S}</b><span>Scenario &amp; tricky</span></div>
          <div class="stat"><b>${doneCount}</b><span>Lessons done</span></div>
          <div class="stat"><b>${masteredCount}</b><span>Q mastered</span></div>
          <div class="stat"><b>${Math.round(((doneCount + masteredCount) / Math.max(1, L + Q + S)) * 100)}%</b><span>Overall</span></div>
        </div>
      </section>

      <div class="section-title"><h2>Learning paths</h2><a href="#/paths">${PATHS.length} role-based roadmaps →</a></div>
      <div class="grid">${PATHS.map(pathCard).join('')}</div>

      <div class="section-title"><h2>How to use this kit</h2><span>a study loop that works</span></div>
      <div class="roadmap">
        <div class="road-step"><h4>Read the lesson</h4><p>Go level by level. Beginner lessons fix the vocabulary interviewers expect you to use precisely.</p></div>
        <div class="road-step"><h4>Say it out loud</h4><p>After each lesson, explain the "Interview angle" box in your own words in under 60 seconds.</p></div>
        <div class="road-step"><h4>Drill the Q&amp;A</h4><p>Open the topic's interview questions. Answer before revealing; mark the ones you nail as mastered.</p></div>
        <div class="road-step"><h4>Solve scenarios</h4><p>Work through 🧩 scenario and 🧠 tricky questions — production problems and predict-the-output puzzles that test real understanding.</p></div>
        <div class="road-step"><h4>Flashcards daily</h4><p>Use ⚡ Practice to mix questions across topics — it surfaces what you have not mastered yet.</p></div>
      </div>

      ${Object.entries(cats).map(([c, ts]) => `
        <div class="section-title"><h2>${esc(c)}</h2><span>${ts.length} track${ts.length > 1 ? 's' : ''}</span></div>
        <div class="grid">${ts.map(card).join('')}</div>`).join('')}
    </div>`;
  }

  function card(t) {
    const p = topicProgress(t);
    return `<a class="card" href="#/t/${t.id}">
      <div class="card-head">${icon(t)}<div><h3>${esc(t.title)}</h3><small style="color:var(--muted)">${t.lessons.length} lessons · ${t.questions.length} questions</small></div></div>
      <p>${esc(t.summary)}</p>
      <div class="progress"><span style="width:${p.pct}%"></span></div>
      <div class="card-meta"><span>${p.lessons}/${t.lessons.length} lessons · ${p.questions}/${t.questions.length} mastered</span><span>${p.pct}%</span></div>
    </a>`;
  }

  // ---------- learning paths ----------
  const stepKeys = (s) => s.slugs.map((slug) => `${s.topic}/${slug}`);
  const stepProgress = (s) => {
    const keys = stepKeys(s);
    const d = keys.filter((k) => done.has(k)).length;
    return { done: d, total: keys.length, pct: Math.round((d / keys.length) * 100) };
  };
  const pathProgress = (p) => {
    const keys = [...new Set(p.steps.filter((s) => !s.optional).flatMap(stepKeys))];
    const d = keys.filter((k) => done.has(k)).length;
    return { done: d, total: keys.length, pct: keys.length ? Math.round((d / keys.length) * 100) : 0 };
  };
  const activePath = () => pathById[store.get('path', '')] || null;
  const stepLink = (s) => {
    const slug = s.slugs.find((x) => !done.has(`${s.topic}/${x}`)) || s.slugs[0];
    return `#/t/${s.topic}/${slug}`;
  };
  function pathResumeLink(p) {
    const step = p.steps.find((s) => !s.optional && stepProgress(s).pct < 100) || p.steps[0];
    return stepLink(step);
  }
  function stepLabel(s) {
    const t = byId[s.topic];
    if (s.lessons) return s.slugs.map((slug) => t.lessons.find((l) => l.slug === slug).title).join(' + ');
    return `${t.title}${s.levels ? ` — ${s.levels.join(', ')}` : ' — all levels'}`;
  }

  function pathCard(p) {
    const pr = pathProgress(p);
    return `<a class="card" href="#/paths/${p.id}">
      <div class="card-head"><span class="t-icon" style="background:${p.color}">${p.icon}</span><div><h3>${esc(p.title)}</h3><small style="color:var(--muted)">${p.steps.length} steps · ${esc(p.duration)}</small></div></div>
      <p>${esc(p.summary)}</p>
      <div class="progress"><span style="width:${pr.pct}%"></span></div>
      <div class="card-meta"><span>${pr.done}/${pr.total} lessons</span><span>${pr.pct}%</span></div>
    </a>`;
  }

  function renderPaths() {
    sidebar.innerHTML = homeSidebar();
    main.innerHTML = `<div class="wide">
      <div class="crumbs"><a href="#/">Home</a>›<span>Learning paths</span></div>
      <header class="article-head"><h1>🧭 Learning paths</h1></header>
      <div class="article-meta"><span>Pick the role you're preparing for. Each path orders the tracks and levels you need, from zero to job-ready, and ends with hands-on projects you build end to end.</span></div>
      <div class="grid">${PATHS.map(pathCard).join('')}</div>
    </div>`;
  }

  function renderPath(p) {
    store.set('path', p.id);
    const pr = pathProgress(p);
    const next = p.steps.findIndex((s) => !s.optional && stepProgress(s).pct < 100);
    sidebar.innerHTML = `<div class="side-topic"><span class="t-icon" style="background:${p.color}">${p.icon}</span><div><h2>${esc(p.title)}</h2><small>${esc(p.duration)}</small></div></div>
      <div class="side-progress">${pr.done}/${pr.total} lessons · ${pr.pct}%<div class="progress"><span style="width:${pr.pct}%"></span></div></div>
      <div class="side-group"><h3>Steps</h3>${p.steps.map((s, i) => {
        const sp = stepProgress(s);
        return `<a class="side-link ${sp.pct === 100 ? 'done' : ''}" href="${stepLink(s)}"><span class="tick">${sp.pct === 100 ? '✓' : i + 1}</span>${fmt(stepLabel(s))}</a>`;
      }).join('')}</div>
      <div class="side-group"><a class="side-link" href="#/paths">← All paths</a></div>`;
    main.innerHTML = `<div class="content">
      <div class="crumbs"><a href="#/">Home</a>›<a href="#/paths">Learning paths</a>›<span>${esc(p.title)}</span></div>
      <header class="article-head"><h1>${p.icon} ${esc(p.title)}</h1></header>
      <div class="article-meta"><span>${p.steps.length} steps</span><span>~${esc(p.duration)} at 8–10 hrs/week</span><span>${pr.pct}% complete</span></div>
      <p class="path-summary">${esc(p.summary)}</p>
      <div class="btn-row" style="margin:16px 0 26px"><a class="btn" href="${pathResumeLink(p)}">${pr.done ? 'Continue path' : 'Start path'} →</a><a class="btn ghost" href="#/practice">⚡ Practise questions</a></div>
      <ol class="path-steps">${p.steps.map((s, i) => {
        const t = byId[s.topic];
        const sp = stepProgress(s);
        const state = sp.pct === 100 ? 'done' : i === next ? 'current' : '';
        return `<li class="path-step ${state}">
          <span class="step-num">${sp.pct === 100 ? '✓' : i + 1}</span>
          <div class="step-body">
            <div class="step-head">${icon(t, 'small')}<a href="${stepLink(s)}"><b>${fmt(stepLabel(s))}</b></a>${s.optional ? '<span class="tag">optional</span>' : ''}${t.id === 'projects' ? '<span class="tag">hands-on</span>' : ''}</div>
            <p>${esc(s.why)}</p>
            <div class="step-meta"><div class="progress"><span style="width:${sp.pct}%"></span></div><span>${sp.done}/${sp.total} lessons</span>${t.questions.length && t.id !== 'projects' ? `<a href="#/t/${t.id}/interview">🎯 ${t.questions.length} questions</a>` : ''}</div>
          </div>
        </li>`;
      }).join('')}</ol>
    </div>`;
  }

  // Where this lesson sits in the active path, for the "next in path" banner.
  function pathContext(topicId, slug) {
    const p = activePath();
    if (!p) return null;
    const i = p.steps.findIndex((s) => s.topic === topicId && s.slugs.includes(slug));
    if (i < 0) return null;
    const flat = p.steps.flatMap((s, si) => s.slugs.map((x) => ({ key: `${s.topic}/${x}`, href: `#/t/${s.topic}/${x}`, si })));
    const pos = flat.findIndex((f) => f.key === `${topicId}/${slug}` && f.si === i);
    const next = flat.slice(pos + 1).find((f) => !done.has(f.key) && !p.steps[f.si].optional);
    return { p, i, next, nextStep: next && p.steps[next.si] };
  }

  function resumeLink() {
    for (const t of TOPICS) for (const l of t.lessons) if (!done.has(`${t.id}/${l.slug}`) && t.lessons.some((x) => done.has(`${t.id}/${x.slug}`))) return `#/t/${t.id}/${l.slug}`;
    return TOPICS[0] ? `#/t/${TOPICS[0].id}` : '#/';
  }

  function topicSidebar(t, active) {
    const p = topicProgress(t);
    const groups = LEVELS.map((L) => {
      const ls = t.lessons.filter((l) => l.level === L);
      if (!ls.length) return '';
      return `<div class="side-group"><h3><span class="dot ${L}"></span>${L}</h3>${ls.map((l) => {
        const isDone = done.has(`${t.id}/${l.slug}`);
        return `<a class="side-link ${isDone ? 'done' : ''} ${active === l.slug ? 'active' : ''}" href="#/t/${t.id}/${l.slug}"><span class="tick">${isDone ? '✓' : ''}</span>${fmt(l.title)}</a>`;
      }).join('')}</div>`;
    }).join('');
    return `<div class="side-topic">${icon(t)}<div><h2>${esc(t.title)}</h2><small>${esc(t.category)}</small></div></div>
      <div class="side-progress">${p.lessons}/${t.lessons.length} lessons · ${p.questions + p.scenarios}/${t.questions.length + t.scenarios.length} Q mastered<div class="progress"><span style="width:${p.pct}%"></span></div></div>
      <div class="side-group"><a class="side-link special ${active === 'interview' ? 'active' : ''}" href="#/t/${t.id}/interview">🎯 Interview Questions<span class="count">${t.questions.length}</span></a>${t.scenarios.length
        ? `<a class="side-link special ${active === 'scenarios' ? 'active' : ''}" href="#/t/${t.id}/scenarios">🧩 Scenario &amp; Tricky<span class="count">${t.scenarios.length}</span></a>` : ''}</div>
      ${groups}
      <div class="side-group"><a class="side-link" href="#/">← All tracks</a></div>`;
  }

  function renderLesson(t, slug) {
    const idx = Math.max(0, t.lessons.findIndex((l) => l.slug === slug));
    const l = t.lessons[idx];
    if (!l) return renderInterview(t);
    const key = `${t.id}/${l.slug}`;
    const prev = t.lessons[idx - 1], next = t.lessons[idx + 1];
    const ctx = pathContext(t.id, l.slug);
    // inside a path, "complete" advances along the path rather than the track
    const advanceTo = ctx ? ctx.next?.href : next && `#/t/${t.id}/${next.slug}`;
    store.set('last', key);
    sidebar.innerHTML = topicSidebar(t, l.slug);
    main.innerHTML = `<article class="content">
      ${ctx ? `<a class="path-banner" href="#/paths/${ctx.p.id}">🧭 <b>${esc(ctx.p.title)}</b> · step ${ctx.i + 1} of ${ctx.p.steps.length}: ${fmt(stepLabel(ctx.p.steps[ctx.i]))}</a>` : ''}
      <div class="crumbs"><a href="#/">Home</a>›<a href="#/t/${t.id}">${esc(t.title)}</a>›<span>${l.level}</span></div>
      <header class="article-head"><h1>${fmt(l.title)}</h1></header>
      <div class="article-meta">${lvl(l.level)}<span>Lesson ${idx + 1} of ${t.lessons.length}</span><span>~${l.minutes} min read</span></div>
      <div class="prose">${l.html}</div>
      <footer class="article-foot">
        <div class="complete-row"><button class="btn ${done.has(key) ? 'ghost' : ''}" id="doneBtn">${done.has(key) ? '✓ Completed — mark as not done' : 'Mark lesson as complete'}</button></div>
        <nav class="pager">
          ${prev ? `<a href="#/t/${t.id}/${prev.slug}"><small>← Previous</small>${fmt(prev.title)}</a>` : ''}
          ${next ? `<a class="next" href="#/t/${t.id}/${next.slug}"><small>Next →</small>${fmt(next.title)}</a>`
                 : `<a class="next" href="#/t/${t.id}/interview"><small>Next →</small>🎯 ${esc(t.title)} interview questions</a>`}
        </nav>
        ${ctx ? `<a class="path-next" href="${ctx.next ? ctx.next.href : `#/paths/${ctx.p.id}`}"><small>Next in your path →</small>${ctx.next
          ? (ctx.nextStep === ctx.p.steps[ctx.i] ? fmt(byId[ctx.nextStep.topic].lessons.find((x) => `${ctx.nextStep.topic}/${x.slug}` === ctx.next.key).title) : `Step ${ctx.p.steps.indexOf(ctx.nextStep) + 1}: ${fmt(stepLabel(ctx.nextStep))}`)
          : '🎉 Path complete — review your progress'}</a>` : ''}
      </footer>
    </article>`;
    $('#doneBtn').addEventListener('click', () => {
      if (done.has(key)) done.delete(key);
      else { done.add(key); if (advanceTo) { save(); location.hash = advanceTo; return; } }
      save();
      renderLesson(t, l.slug);
    });
    enhance();
  }

  // Shared question-bank view: level (and type) chips, text filter, expand-all and mastery.
  // items: [{ t, x, key }]; opts: { stateKey, types, grouped, onMaster }
  function mountQA(box, items, opts) {
    const state = { level: 'All', type: 'All', q: '', ...store.get(opts.stateKey, {}) };
    const count = (f) => items.filter(f).length;
    box.innerHTML = `<div class="toolbar" id="qaBar">
        ${['All', ...LEVELS].map((L) => `<button class="chip ${state.level === L ? 'on' : ''}" data-level="${L}">${L} <span style="opacity:.7">${count((i) => L === 'All' || i.x.level === L)}</span></button>`).join('')}
        ${opts.types ? ['All', ...Object.keys(TYPES)].map((T) => `<button class="chip ${state.type === T ? 'on' : ''}" data-type="${T}">${T === 'All' ? 'All types' : TYPES[T]} <span style="opacity:.7">${count((i) => T === 'All' || i.x.type === T)}</span></button>`).join('') : ''}
        <input class="filter-input" id="qaFilter" placeholder="Filter questions…" value="${esc(state.q)}">
        <button class="chip" id="expandAll">Expand all</button>
      </div>
      <div id="qaList"></div>`;

    const row = ({ t, x, key }, n) => `<details class="qa ${mastered.has(key) ? 'mastered' : ''}" data-key="${key}">
        <summary><span class="num">${n}.</span><span class="qtext">${fmt(x.q)}</span>${x.type ? `<span class="tag">${TYPES[x.type]}</span>` : ''}${lvl(x.level)}<span class="chev">›</span></summary>
        <div class="answer prose">${x.html}
          <div class="answer-foot"><button class="btn small ${mastered.has(key) ? 'ghost' : ''}" data-master="${key}">${mastered.has(key) ? '✓ Mastered' : 'Mark as mastered'}</button></div>
        </div></details>`;

    const draw = () => {
      const q = state.q.trim().toLowerCase();
      const list = items.filter(({ x }) => (state.level === 'All' || x.level === state.level) &&
        (!opts.types || state.type === 'All' || x.type === state.type) &&
        (!q || (x.q + ' ' + x.text).toLowerCase().includes(q)));
      let n = 0;
      $('#qaList').innerHTML = !list.length ? '<div class="empty">No questions match.</div>'
        : opts.grouped
          ? Object.values(groupBy(list, (i) => i.t.id)).map((g) => `<div class="qa-group">
              <h2>${icon(g[0].t, 'small')}<a href="#/t/${g[0].t.id}/scenarios">${esc(g[0].t.title)}</a><span>${g.length}</span></h2>
              ${g.map((i) => row(i, ++n)).join('')}</div>`).join('')
          : list.map((i) => row(i, ++n)).join('');
      enhance();
    };
    draw();

    $('#qaBar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-level],[data-type]');
      if (!b) return;
      const attr = b.dataset.level ? 'level' : 'type';
      state[attr] = b.dataset[attr]; store.set(opts.stateKey, state);
      box.querySelectorAll(`[data-${attr}]`).forEach((c) => c.classList.toggle('on', c === b));
      draw();
    });
    $('#qaFilter').addEventListener('input', (e) => { state.q = e.target.value; store.set(opts.stateKey, state); draw(); });
    $('#expandAll').addEventListener('click', (e) => {
      const all = [...document.querySelectorAll('.qa')];
      const open = !all.every((d) => d.open);
      all.forEach((d) => (d.open = open));
      e.target.textContent = open ? 'Collapse all' : 'Expand all';
    });
    $('#qaList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-master]');
      if (!b) return;
      const key = b.dataset.master;
      mastered.has(key) ? mastered.delete(key) : mastered.add(key);
      save();
      const d = b.closest('.qa');
      d.classList.toggle('mastered', mastered.has(key));
      b.classList.toggle('ghost', mastered.has(key));
      b.textContent = mastered.has(key) ? '✓ Mastered' : 'Mark as mastered';
      opts.onMaster && opts.onMaster();
    });
  }

  function renderInterview(t) {
    sidebar.innerHTML = topicSidebar(t, 'interview');
    main.innerHTML = `<div class="content">
      <div class="crumbs"><a href="#/">Home</a>›<a href="#/t/${t.id}">${esc(t.title)}</a>›<span>Interview questions</span></div>
      <header class="article-head"><h1>${esc(t.title)} interview questions</h1></header>
      <div class="article-meta"><span>${t.questions.length} questions with model answers</span><span>Answer out loud first, then reveal.</span>${t.scenarios.length ? `<a href="#/t/${t.id}/scenarios">🧩 ${t.scenarios.length} scenario &amp; tricky questions →</a>` : ''}</div>
      <div id="qaWrap"></div>
    </div>`;
    mountQA($('#qaWrap'), t.questions.map((x) => ({ t, x, key: `${t.id}/${x.id}` })), {
      stateKey: 'qaFilter', onMaster: () => (sidebar.innerHTML = topicSidebar(t, 'interview')),
    });
  }

  function renderTopicScenarios(t) {
    if (!t.scenarios.length) return renderInterview(t);
    sidebar.innerHTML = topicSidebar(t, 'scenarios');
    main.innerHTML = `<div class="content">
      <div class="crumbs"><a href="#/">Home</a>›<a href="#/scenarios">Scenario questions</a>›<span>${esc(t.title)}</span></div>
      <header class="article-head"><h1>${esc(t.title)} scenario &amp; tricky questions</h1></header>
      <div class="article-meta"><span>${t.scenarios.filter((x) => x.type === 'scenario').length} real-world scenarios · ${t.scenarios.filter((x) => x.type === 'tricky').length} tricky puzzles</span><span>Work it out before you reveal the answer.</span></div>
      <div id="qaWrap"></div>
    </div>`;
    mountQA($('#qaWrap'), t.scenarios.map((x) => ({ t, x, key: scenKey(t, x) })), {
      stateKey: 'scenFilter', types: true, onMaster: () => (sidebar.innerHTML = topicSidebar(t, 'scenarios')),
    });
  }

  // Scenario hub: every track's scenario + tricky questions in one place, filterable by track.
  function renderScenarios() {
    const sel = store.get('scenTopics', []).filter((id) => byId[id]);
    const total = SCEN_TOPICS.reduce((a, t) => a + t.scenarios.length, 0);
    sidebar.innerHTML = homeSidebar();
    main.innerHTML = `<div class="wide">
      <div class="crumbs"><a href="#/">Home</a>›<span>Scenario questions</span></div>
      <header class="article-head"><h1>🧩 Scenario &amp; tricky questions</h1></header>
      <div class="article-meta"><span>${total} questions across ${SCEN_TOPICS.length} tracks.</span><span><b>🧩 Scenario</b> — a real production problem: how would you debug, design or fix it?</span><span><b>🧠 Tricky</b> — predict the output, spot the bug, explain the gotcha.</span></div>
      <div class="toolbar" id="sTopics">
        <button class="chip ${sel.length ? '' : 'on'}" data-t="">All tracks</button>
        ${SCEN_TOPICS.map((t) => `<button class="chip ${sel.includes(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.short)}</button>`).join('')}
      </div>
      <div id="qaWrap"></div>
    </div>`;
    const draw = () => {
      const ts = sel.length ? SCEN_TOPICS.filter((t) => sel.includes(t.id)) : SCEN_TOPICS;
      mountQA($('#qaWrap'), ts.flatMap((t) => t.scenarios.map((x) => ({ t, x, key: scenKey(t, x) }))), { stateKey: 'scenHub', types: true, grouped: true });
    };
    $('#sTopics').addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const id = b.dataset.t;
      if (!id) sel.length = 0;
      else if (sel.includes(id)) sel.splice(sel.indexOf(id), 1);
      else sel.push(id);
      document.querySelectorAll('#sTopics .chip').forEach((c) => c.classList.toggle('on', c.dataset.t ? sel.includes(c.dataset.t) : !sel.length));
      store.set('scenTopics', sel); draw();
    });
    draw();
  }

  // ---------- flashcard practice ----------
  function renderPractice() {
    const cfg = { topics: [], level: 'All', unmasteredOnly: true, scenarios: false, ...store.get('practice', {}) };
    let session = { seen: 0, known: 0 };
    sidebar.innerHTML = homeSidebar();

    const pool = () => {
      const ts = cfg.topics.length ? TOPICS.filter((t) => cfg.topics.includes(t.id)) : TOPICS;
      const out = [];
      const add = (t, q, key) => {
        if (cfg.level !== 'All' && q.level !== cfg.level) return;
        if (cfg.unmasteredOnly && mastered.has(key)) return;
        out.push({ t, q, key });
      };
      ts.forEach((t) => {
        t.questions.forEach((q) => add(t, q, `${t.id}/${q.id}`));
        if (cfg.scenarios) t.scenarios.forEach((q) => add(t, q, scenKey(t, q)));
      });
      return out;
    };

    main.innerHTML = `<div class="content">
      <div class="crumbs"><a href="#/">Home</a>›<span>Practice</span></div>
      <header class="article-head"><h1>⚡ Flashcard practice</h1></header>
      <div class="article-meta"><span>Random questions across your chosen tracks. Answer aloud, reveal, then grade yourself honestly.</span></div>
      <div class="toolbar" id="pTopics">
        <button class="chip ${cfg.topics.length ? '' : 'on'}" data-t="">All tracks</button>
        ${TOPICS.map((t) => `<button class="chip ${cfg.topics.includes(t.id) ? 'on' : ''}" data-t="${t.id}">${esc(t.short)}</button>`).join('')}
      </div>
      <div class="toolbar" id="pLevels">
        ${['All', ...LEVELS].map((L) => `<button class="chip ${cfg.level === L ? 'on' : ''}" data-l="${L}">${L}</button>`).join('')}
        <label style="font-size:14px;display:flex;gap:6px;align-items:center;margin-left:auto"><input type="checkbox" id="pScen" ${cfg.scenarios ? 'checked' : ''}> Include scenario &amp; tricky</label>
        <label style="font-size:14px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="pUnm" ${cfg.unmasteredOnly ? 'checked' : ''}> Only questions I haven't mastered</label>
      </div>
      <div id="flash"></div>
    </div>`;

    const next = () => {
      const p = pool();
      const box = $('#flash');
      if (!p.length) {
        box.innerHTML = `<div class="flash"><div class="empty">🎉 Nothing left in this selection. Pick more tracks or include mastered questions.</div></div>`;
        return;
      }
      const { t, q, key } = p[Math.floor(Math.random() * p.length)];
      box.innerHTML = `<div class="flash">
        <div class="flash-meta">${icon(t, '')}<span>${esc(t.title)}</span>${q.type ? `<span class="tag">${TYPES[q.type]}</span>` : ''}${lvl(q.level)}<span style="margin-left:auto">${p.length} in pool</span></div>
        <div class="q">${fmt(q.q)}</div>
        <div class="flash-actions" id="revealRow"><button class="btn" id="reveal">Reveal answer <kbd>Space</kbd></button><button class="btn ghost" id="skip">Skip</button></div>
        <div class="answer prose" id="ans" hidden>${q.html}
          <div class="flash-actions"><button class="btn" id="knew">✓ I knew it (mark mastered)</button><button class="btn ghost" id="again">↻ Review again later</button></div>
        </div>
      </div>
      <div class="score"><span>This session: ${session.seen} seen</span><span>${session.known} known</span><span>${session.seen ? Math.round((session.known / session.seen) * 100) : 0}% recall</span></div>`;
      box.querySelector('.t-icon').style.cssText += ';width:28px;height:28px;font-size:11px;border-radius:7px';
      const reveal = () => { $('#ans').hidden = false; $('#revealRow').hidden = true; enhance(); };
      $('#reveal').onclick = reveal;
      $('#skip').onclick = next;
      $('#knew').onclick = () => { mastered.add(key); save(); session.seen++; session.known++; next(); };
      $('#again').onclick = () => { session.seen++; next(); };
      box.reveal = reveal;
    };

    $('#pTopics').addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const id = b.dataset.t;
      if (!id) cfg.topics = [];
      else cfg.topics = cfg.topics.includes(id) ? cfg.topics.filter((x) => x !== id) : [...cfg.topics, id];
      document.querySelectorAll('#pTopics .chip').forEach((c) => c.classList.toggle('on', c.dataset.t ? cfg.topics.includes(c.dataset.t) : !cfg.topics.length));
      store.set('practice', cfg); next();
    });
    $('#pLevels').addEventListener('click', (e) => {
      const b = e.target.closest('[data-l]'); if (!b) return;
      cfg.level = b.dataset.l;
      document.querySelectorAll('#pLevels .chip').forEach((c) => c.classList.toggle('on', c === b));
      store.set('practice', cfg); next();
    });
    $('#pScen').addEventListener('change', (e) => { cfg.scenarios = e.target.checked; store.set('practice', cfg); next(); });
    $('#pUnm').addEventListener('change', (e) => { cfg.unmasteredOnly = e.target.checked; store.set('practice', cfg); next(); });
    next();
  }

  // ---------- search ----------
  const index = [];
  TOPICS.forEach((t) => {
    t.lessons.forEach((l) => index.push({ kind: 'Lesson', t, title: l.title.replace(/`/g, ''), level: l.level, href: `#/t/${t.id}/${l.slug}`, hay: (l.title + ' ' + t.title).toLowerCase().replace(/`/g, ''), body: l.text.toLowerCase(), raw: l.text }));
    t.questions.forEach((q) => index.push({ kind: 'Question', t, title: q.q.replace(/`/g, ''), level: q.level, href: `#/t/${t.id}/interview`, qid: q.id, hay: (q.q + ' ' + t.title).toLowerCase().replace(/`/g, ''), body: q.text.toLowerCase(), raw: q.text }));
    t.scenarios.forEach((q) => index.push({ kind: q.type === 'tricky' ? 'Tricky' : 'Scenario', t, title: q.q.replace(/`/g, ''), level: q.level, href: `#/t/${t.id}/scenarios`, qid: q.id, hay: (q.q + ' ' + t.title).toLowerCase().replace(/`/g, ''), body: q.text.toLowerCase(), raw: q.text }));
  });
  const modal = $('#searchModal'), input = $('#searchInput'), results = $('#searchResults');
  let sel = 0, hits = [];
  const openSearch = () => { modal.hidden = false; input.value = ''; drawResults(); input.focus(); };
  const closeSearch = () => { modal.hidden = true; };
  const hl = (s, terms) => terms.reduce((acc, w) => acc.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>'), esc(s));

  function drawResults() {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      results.innerHTML = `<div class="empty">Type to search ${index.length} lessons, interview, scenario and tricky questions. Try “closure”, “useEffect”, “ORM”, “pod”.</div>`;
      hits = []; return;
    }
    hits = index.map((r) => {
      let score = 0;
      for (const w of terms) {
        if (r.hay.includes(w)) score += 10;
        else if (r.body.includes(w)) score += 2;
        else return null;
      }
      if (r.title.toLowerCase().includes(terms.join(' '))) score += 15;
      if (r.kind === 'Lesson') score += 1;
      return { r, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 40).map((x) => x.r);
    sel = 0;
    results.innerHTML = hits.length ? hits.map((r, i) => {
      const pos = r.body.indexOf(terms[0]);
      const snip = pos >= 0 ? (pos > 50 ? '…' : '') + r.raw.slice(Math.max(0, pos - 50), pos + 130) + '…' : '';
      return `<a href="${r.href}" data-i="${i}" ${r.qid ? `data-q="${r.qid}"` : ''} class="${i === 0 ? 'sel' : ''}">
        <div class="r-title">${hl(r.title, terms)}</div>
        <div class="r-sub"><span class="tag">${r.kind}</span> ${esc(r.t.title)} · ${r.level}</div>
        ${snip ? `<div class="r-snip">${hl(snip, terms)}</div>` : ''}</a>`;
    }).join('') : '<div class="empty">No results.</div>';
  }
  input.addEventListener('input', drawResults);
  input.addEventListener('keydown', (e) => {
    const links = [...results.querySelectorAll('a')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!links.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((a, i) => a.classList.toggle('sel', i === sel));
      links[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && links[sel]) {
      e.preventDefault(); links[sel].click();
    }
  });
  results.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a) return;
    if (a.dataset.q) pendingQuestion = a.dataset.q;
    closeSearch();
    // same-hash links don't fire hashchange, so route manually
    if (a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeSearch(); });
  $('#searchBtn').addEventListener('click', openSearch);
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (e.key === 'Escape') { closeSearch(); document.body.classList.remove('nav-open'); }
    else if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); openSearch(); }
    else if (e.key === ' ' && !typing && $('#flash') && $('#flash').reveal && $('#reveal')) { e.preventDefault(); $('#flash').reveal(); }
  });

  // ---------- helpers ----------
  function groupBy(arr, fn) { return arr.reduce((acc, x) => ((acc[fn(x)] = acc[fn(x)] || []).push(x), acc), {}); }

  function enhance() {
    if (window.hljs) main.querySelectorAll('pre code:not(.hljs)').forEach((el) => {
      if (el.closest('details:not([open])') || el.closest('[hidden]')) return;
      try { window.hljs.highlightElement(el); } catch (e) { /* unknown language */ }
    });
  }
  main.addEventListener('toggle', (e) => { if (e.target.open) enhance(); }, true);
  main.addEventListener('click', (e) => {
    const b = e.target.closest('.copy'); if (!b) return;
    const code = b.closest('.code').querySelector('code').innerText;
    navigator.clipboard?.writeText(code).then(() => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1200); });
  });

  // ---------- router ----------
  let pendingQuestion = null;
  function route() {
    document.body.classList.remove('nav-open');
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    let activeTopic = null;
    const render = () => {
      if (parts[0] === 't' && byId[parts[1]]) {
        const t = byId[parts[1]];
        activeTopic = t.id;
        if (parts[2] === 'interview') renderInterview(t);
        else if (parts[2] === 'scenarios') renderTopicScenarios(t);
        else renderLesson(t, parts[2] || firstUnread(t));
      } else if (parts[0] === 'practice') renderPractice();
      else if (parts[0] === 'scenarios') renderScenarios();
        else if (parts[0] === 'paths' && pathById[parts[1]]) renderPath(pathById[parts[1]]);
      else if (parts[0] === 'paths') renderPaths();
      else renderHome();
    };
    render();

    document.querySelectorAll('#topnav a').forEach((a) => a.classList.toggle('active', a.dataset.id === activeTopic));
    const act = $(`#topnav a[data-id="${activeTopic}"]`); act && act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const sideAct = $('.side-link.active', sidebar); sideAct && sideAct.scrollIntoView({ block: 'nearest' });

    if (pendingQuestion) {
      const d = main.querySelector(`.qa[data-key$="/${CSS.escape(pendingQuestion)}"]`);
      if (!d) {
        // question may be hidden by a filter — reset filters and retry
        ['qaFilter', 'scenFilter'].forEach((k) => store.set(k, {}));
        render();
      }
      const d2 = main.querySelector(`.qa[data-key$="/${CSS.escape(pendingQuestion)}"]`);
      if (d2) { d2.open = true; enhance(); setTimeout(() => d2.scrollIntoView({ block: 'start' }), 30); }
      pendingQuestion = null;
    } else {
      window.scrollTo(0, 0);
    }
  }
  function firstUnread(t) {
    const l = t.lessons.find((x) => !done.has(`${t.id}/${x.slug}`)) || t.lessons[0];
    return l && l.slug;
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('load', enhance);
  route();
})();
