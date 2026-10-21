# PrepStack — Interview Preparation Kit

A learn-only, W3Schools-style study app for technical interviews. Every track goes
**Beginner → Intermediate → Advanced** and ends with a bank of interview questions with model answers,
plus scenario-based and tricky questions.

## Learning paths

Role-based roadmaps that take you from zero to job-ready, end to end, in order, with progress per step.
When you study inside a path, "Mark complete" moves you to the next lesson in the path.

Frontend Developer · Full-Stack JavaScript · Python Backend · Enterprise Full-Stack (Angular + Java/.NET) ·
DevOps & Cloud · QA / SDET · RPA Developer · AI Engineer · 2-Week Interview Sprint

Paths are defined in `content/paths.json`.

## Scenario & tricky questions

A separate 🧩 menu (`#/scenarios`) collects two kinds of practical questions from every track:

- **🧩 Scenario**: a real production problem ("pods are in CrashLoopBackOff", "the API double-charges on retry"). How would you debug, design or fix it?
- **🧠 Tricky**: predict the output, spot the bug, explain the gotcha (event-loop ordering, Python default arguments, SQL `NOT IN` with NULLs, `Integer` caching…).

Filter them by track, level and type, mark them as mastered, find them in search, or mix them into flashcards. Each track also has its own page at `#/t/<track>/scenarios`.

## Tracks

| Category | Tracks |
|---|---|
| Learning Paths & Projects | End-to-End Projects (10 capstones: portfolio → full-stack + Docker → test framework → RPA bot → Kubernetes/OpenShift GitOps → Terraform cloud infra → RAG AI assistant → system design) |
| Web Foundations | HTML, CSS, JavaScript, TypeScript, Web/HTTP & Security |
| Frontend Frameworks | React, Angular, Vue.js |
| Backend | Node.js & Express, Python, Django, FastAPI, SQL & Databases, Java & Spring Boot, C# & .NET |
| DevOps & Cloud | Docker, Kubernetes, OpenShift, Git & CI/CD, Linux & Shell |
| Cloud Platforms | AWS, Azure, Google Cloud, Terraform & IaC |
| Testing & Automation | Software Testing & QA, Test Automation & E2E (Playwright, Cypress, Selenium), RPA (UiPath, Power Automate, Automation Anywhere) |
| Artificial Intelligence | AI & Machine Learning, Generative AI & LLMs |
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
- 🧩 Scenario & tricky questions across all tracks, with track, level and type filters
- 🧭 Learning paths with ordered steps, progress and "next in path" navigation
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

# Scenario Questions
## Intermediate
### Production problem: what would you do?
Approach and answer.

# Tricky Questions
## Beginner
### What does this print?
Output and explanation.
```
