#!/usr/bin/env node
/*
 * Converts content/*.md into app/data.js so the app runs straight from
 * index.html (no server, no dependencies).
 *
 * Topic file format:
 *   ---                         front matter (key: value)
 *   # Beginner | # Intermediate | # Advanced
 *   ## Lesson title             each H2 under a level is one lesson
 *   # Interview Questions
 *   ## Beginner | ...           level of the questions below
 *   ### Question text           answer is everything until the next ###
 *   # Scenario Questions        same layout as Interview Questions, for
 *                               "what would you do if…" real-world problems
 *   # Tricky Questions          same layout: predict-the-output, spot-the-bug
 *                               and gotcha puzzles (shown with scenarios)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'app', 'data.js');
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
// H1 sections holding question banks -> kind of question they contain
const QA_SECTIONS = { 'Interview Questions': 'q', 'Scenario Questions': 'scenario', 'Tricky Questions': 'tricky' };

const slugify = (s) =>
  s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- inline markdown ----------
function inline(text) {
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const ext = /^https?:/.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}

// ---------- block markdown ----------
// highlight.js language names for fence labels it doesn't know
const LANG_ALIAS = {
  vue: 'xml', jsx: 'javascript', tsx: 'typescript', text: 'plaintext', toml: 'ini', sh: 'bash',
  dockerfile: 'bash', hcl: 'ini', bicep: 'typescript', kql: 'sql', vb: 'vbnet', http: 'plaintext',
  gherkin: 'plaintext', powershell: 'bash', cs: 'csharp',
  promql: 'plaintext', logql: 'plaintext', jinja: 'xml', django: 'xml', nginx: 'plaintext', groovy: 'java', properties: 'ini',
};

const CALLOUTS = { TIP: 'Tip', NOTE: 'Note', WARN: 'Watch out', INTERVIEW: 'Interview angle', EXAMPLE: 'Example' };

function markdown(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;

  const isBlockStart = (l) =>
    /^```/.test(l) || /^#{2,6}\s/.test(l) || /^\s*([-*]|\d+\.)\s+/.test(l) || /^>/.test(l) || /^\|/.test(l) || /^---+\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // fenced code
    const fence = line.match(/^```\s*([\w+#-]*)\s*(.*)$/);
    if (fence) {
      const lang = LANG_ALIAS[fence[1]] || fence[1] || 'plaintext';
      const title = fence[2] ? fence[2].trim() : '';
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(
        `<div class="code"><div class="code-head"><span>${esc(title || lang)}</span><button class="copy" type="button">Copy</button></div>` +
          `<pre><code class="language-${lang}">${esc(buf.join('\n'))}</code></pre></div>`
      );
      continue;
    }

    // headings (H1/H2 are structural and handled by the parser)
    const h = line.match(/^(#{3,6})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(h[1].length, 4);
      out.push(`<h${lvl} id="${slugify(h[2])}">${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // blockquote / callout
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      const m = buf[0].match(/^\[!(\w+)\]\s*(.*)$/);
      if (m && CALLOUTS[m[1]]) {
        const rest = [m[2], ...buf.slice(1)].join('\n');
        out.push(`<div class="callout ${m[1].toLowerCase()}"><div class="callout-title">${CALLOUTS[m[1]]}</div>${markdown(rest)}</div>`);
      } else {
        out.push(`<blockquote>${markdown(buf.join('\n'))}</blockquote>`);
      }
      continue;
    }

    // table
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|\s*$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, '|')));
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
          body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') +
          '</tbody></table></div>'
      );
      continue;
    }

    // lists (supports one level of nesting via indentation)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      out.push(list(lines, i, (next) => (i = next)));
      continue;
    }

    // paragraph
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++].trim());
    if (!buf.length) { buf.push(lines[i++].trim()); }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function list(lines, start, setNext) {
  const indentOf = (l) => l.match(/^\s*/)[0].length;
  const baseIndent = indentOf(lines[start]);
  const ordered = /^\s*\d+\./.test(lines[start]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) {
      // blank line ends the list unless the next line continues it
      if (i + 1 < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i + 1]) && indentOf(lines[i + 1]) >= baseIndent) { i++; continue; }
      break;
    }
    const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (m && m[1].length === baseIndent) {
      items.push({ text: m[3], children: [] });
      i++;
    } else if (indentOf(l) > baseIndent && items.length) {
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        let next = i;
        items[items.length - 1].children.push(list(lines, i, (n) => (next = n)));
        i = next;
      } else {
        items[items.length - 1].text += ' ' + l.trim();
        i++;
      }
    } else break;
  }
  setNext(i);
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((it) => `<li>${inline(it.text)}${it.children.join('')}</li>`).join('')}</${tag}>`;
}

const plain = (md) =>
  md.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`|\-[\]()!]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- topic parser ----------
function parseTopic(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${file}: missing front matter`);
  const meta = {};
  fm[1].split('\n').forEach((l) => {
    const m = l.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  });
  const body = raw.slice(fm[0].length);

  const lessons = [];
  const questions = [];
  const scenarios = [];
  let section = null; // level name or 'Interview Questions'
  let qLevel = 'Beginner';
  let cur = null;

  const flush = () => {
    if (!cur) return;
    const md = cur.md.join('\n').trim();
    if (cur.kind === 'lesson') {
      lessons.push({ slug: slugify(cur.title), title: cur.title, level: cur.level, html: markdown(md), text: plain(md).slice(0, 4000), minutes: Math.max(2, Math.round(md.split(/\s+/).length / 180)) });
    } else {
      const q = { id: slugify(cur.title), q: cur.title, level: cur.level, html: markdown(md), text: plain(md).slice(0, 1500) };
      if (cur.kind === 'q') questions.push(q);
      else scenarios.push({ ...q, type: cur.kind });
    }
    cur = null;
  };

  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^```/.test(line)) inFence = !inFence;
    const h1 = !inFence && line.match(/^#\s+(.*)$/);
    const h2 = !inFence && line.match(/^##\s+(.*)$/);
    const h3 = !inFence && line.match(/^###\s+(.*)$/);
    if (h1) { flush(); section = h1[1].trim(); continue; }
    if (QA_SECTIONS[section]) {
      if (h2) { flush(); qLevel = h2[1].trim(); continue; }
      if (h3) { flush(); cur = { kind: QA_SECTIONS[section], title: h3[1].trim(), level: qLevel, md: [] }; continue; }
    } else if (h2 && LEVELS.includes(section)) {
      flush();
      cur = { kind: 'lesson', title: h2[1].trim(), level: section, md: [] };
      continue;
    }
    if (cur) cur.md.push(line);
  }
  flush();

  // de-duplicate slugs (scenario + tricky questions share their own namespace)
  for (const arr of [lessons.concat(questions), scenarios]) {
    const seen = {};
    for (const x of arr) {
      const key = x.slug || x.id;
      seen[key] = (seen[key] || 0) + 1;
      if (seen[key] > 1) x[x.slug ? 'slug' : 'id'] = `${key}-${seen[key]}`;
    }
  }

  return {
    id: meta.id,
    title: meta.title,
    short: meta.short || meta.title,
    category: meta.category || 'Other',
    order: +(meta.order || 99),
    color: meta.color || '#0f9d58',
    icon: meta.icon || meta.title.slice(0, 2),
    summary: meta.summary || '',
    lessons,
    questions,
    scenarios,
  };
}

const topics = fs
  .readdirSync(CONTENT)
  .filter((f) => f.endsWith('.md'))
  .map((f) => parseTopic(path.join(CONTENT, f)))
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

// Learning paths: resolve each step to concrete lesson slugs so the app can show progress.
const byTopic = Object.fromEntries(topics.map((t) => [t.id, t]));
const paths = JSON.parse(fs.readFileSync(path.join(CONTENT, 'paths.json'), 'utf8')).paths.map((p) => ({
  ...p,
  steps: p.steps.map((s, i) => {
    const t = byTopic[s.topic];
    if (!t) throw new Error(`paths.json: ${p.id} step ${i + 1}: unknown topic "${s.topic}"`);
    let lessons = t.lessons;
    if (s.levels) {
      for (const l of s.levels) if (!LEVELS.includes(l)) throw new Error(`paths.json: ${p.id} step ${i + 1}: bad level "${l}"`);
      lessons = lessons.filter((l) => s.levels.includes(l.level));
    }
    if (s.lessons) {
      for (const slug of s.lessons) if (!t.lessons.some((l) => l.slug === slug)) throw new Error(`paths.json: ${p.id} step ${i + 1}: unknown lesson "${slug}"`);
      lessons = t.lessons.filter((l) => s.lessons.includes(l.slug));
    }
    if (!lessons.length) throw new Error(`paths.json: ${p.id} step ${i + 1}: selects no lessons`);
    return { ...s, slugs: lessons.map((l) => l.slug) };
  }),
}));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `/* Generated by scripts/build.js — edit content/*.md instead. */\nwindow.IPG_DATA = ${JSON.stringify({ built: new Date().toISOString(), topics, paths })};\n`);

let L = 0, Q = 0, S = 0;
for (const t of topics) {
  L += t.lessons.length; Q += t.questions.length; S += t.scenarios.length;
  console.log(`${t.title.padEnd(26)} ${String(t.lessons.length).padStart(3)} lessons ${String(t.questions.length).padStart(4)} questions ${String(t.scenarios.length).padStart(3)} scenarios`);
}
console.log(`\n${topics.length} topics, ${L} lessons, ${Q} interview questions, ${S} scenario questions, ${paths.length} learning paths -> ${path.relative(ROOT, OUT)}`);
