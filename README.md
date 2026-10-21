# PrepStack — Interview Preparation Kit

A learn-only, W3Schools-style study app for technical interviews. Every track goes
**Beginner → Intermediate → Advanced** and ends with a bank of interview questions with model answers.

## Tracks

| Category | Tracks |
|---|---|
| Web Foundations | HTML, CSS, JavaScript, TypeScript, Web/HTTP & Security |
| Frontend Frameworks | React, Angular, Vue.js |
| Backend | Node.js & Express (+ NestJS), Python, Django (+ DRF), FastAPI (+ Flask), SQL & Databases (+ Redis/NoSQL) |
| DevOps & Cloud | Docker, Kubernetes, OpenShift, Git & CI/CD |
| Artificial Intelligence | AI & Machine Learning, Generative AI & LLMs (RAG, agents, MCP) |
| Architecture | System Design, DSA for coding rounds |

## Run it

No dependencies needed (Node 18+).

```bash
npm start          # builds content and serves at http://localhost:4321
```

You can also open `index.html` directly in a browser after running `npm run build` once.

## Features

- Sidebar per track with lessons grouped by level, prev/next navigation, reading time
- "Mark complete" for lessons and "Mark as mastered" for questions — progress saved in your browser
- Interview Q&A per track with level filters, text filter and expand-all
- ⚡ Flashcard practice across any tracks/levels, focusing on questions you haven't mastered
- Global search (`/` or `Ctrl+K`) across all lessons and questions
- Light/dark theme, mobile layout, syntax highlighting with copy buttons

## Adding or editing content

Content lives in `content/*.md` — one file per track. After editing, run `npm run build`
to regenerate `app/data.js`.

```markdown
---
id: react
title: React
category: Frontend Frameworks
order: 6
color: #149eca
icon: Re
summary: One-line description shown on the home card.
---

# Beginner
## Lesson title
Lesson body in Markdown (code fences, tables, lists, > [!TIP] / [!WARN] / [!INTERVIEW] callouts).

# Intermediate
## …

# Advanced
## …

# Interview Questions
## Beginner
### Question text?
Model answer.
```
