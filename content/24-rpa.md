---
id: rpa
title: RPA (UiPath, Power Automate, Automation Anywhere)
short: RPA
category: Testing & Automation
order: 17.93
color: #fa4616
icon: RPA
summary: Robotic Process Automation from process selection to production — UiPath Studio, selectors, REFramework, Orchestrator, queues, Power Automate, Automation Anywhere, document understanding and agentic automation.
---

# Beginner

## What RPA Is and When to Use It

**Robotic Process Automation (RPA)** uses software "robots" to mimic human actions on computer UIs and systems — clicking, typing, reading screens, moving data between applications, reading emails and files — to automate **rule-based, repetitive** business processes.

### RPA vs traditional automation vs AI
| | RPA | API/integration automation | AI / intelligent automation |
|---|---|---|---|
| Works through | the UI (and APIs where available) | system APIs | models that understand documents, language, decisions |
| Best for | legacy apps without APIs, quick wins | robust system-to-system integration | unstructured data, judgement-based steps |
| Change sensitivity | UI changes can break bots | stable contracts | needs training/monitoring |

Modern platforms combine all three ("hyperautomation" / "agentic automation").

### Good RPA candidates
- **Rule-based** with clear logic, few exceptions.
- **High volume / repetitive**, done frequently.
- **Structured, digital inputs** (Excel, forms, emails with fixed format).
- **Stable** applications and processes.
- Measurable benefit: time saved, error reduction, compliance, 24×7 processing.

Examples: invoice processing, employee onboarding (create accounts in multiple systems), bank reconciliation, order entry from emails into ERP, report generation, data migration, claims processing, KYC checks.

### Benefits and limits
Benefits: speed, accuracy, auditability, scalability, no change to underlying systems, fast ROI. Limits: brittle against UI changes, not a fix for bad processes ("automating a mess gives a faster mess"), needs governance and maintenance.

## Types of Bots and the RPA Platform Landscape

### Attended vs unattended
| | Attended | Unattended |
|---|---|---|
| Runs on | user's desktop, triggered by the user | virtual machines/servers, triggered by schedules/queues/events |
| Human involvement | works alongside a person (front office, call centre) | none during execution (back office) |
| Example | agent clicks a button to auto-fill a customer form | nightly bot processes 5,000 invoices |

Also: **hybrid** processes (unattended bot hands off exceptions to a human via Action Center).

### Major platforms
- **UiPath** — market leader: Studio/StudioX (design), Robot (execution), **Orchestrator** (management), Action Center, Document Understanding, Integration Service, Agentic automation.
- **Microsoft Power Automate** — cloud flows (API connectors) + desktop flows (RPA), tight Microsoft 365/Dataverse integration.
- **Automation Anywhere** — cloud-native Automation 360: Bot Creator, Control Room, Bot Runners, IQ Bot/Document Automation.
- **Blue Prism (SS&C)** — enterprise, object/process studio, strong governance.
- Others: Robocorp/Robot Framework (Python, open-source-friendly), WorkFusion, Pega Robotics.

## RPA Project Lifecycle

1. **Discovery & assessment** — identify candidates (process mining/task mining tools like UiPath Process Mining, Celonis), score feasibility and ROI.
2. **Process analysis** — document AS-IS process; create the **PDD (Process Definition Document)**: steps, screenshots, rules, exceptions, inputs/outputs, volumes, SLAs.
3. **Solution design** — **SDD (Solution Design Document)**: architecture, workflows, queues, credentials, error handling, logging, environments.
4. **Development** — build workflows using best practices and frameworks (REFramework).
5. **Testing** — unit tests of workflows, SIT, **UAT** with business users, test cases for exceptions.
6. **Deployment** — publish packages to Orchestrator/Control Room, configure assets, queues, triggers and robots.
7. **Hypercare & support** — monitor, fix issues, measure benefits; hand over to support (runbook).

### Roles
Business Analyst (PDD), Solution Architect (SDD), RPA Developer, Tester, CoE lead, Infrastructure/Orchestrator admin, Process owner.

## UiPath Studio Basics

### Project types and workflow types
- **Sequence** — linear steps (simple UI interactions).
- **Flowchart** — branching logic and decisions.
- **State Machine** — states and transitions (used by REFramework).
- **Global Exception Handler** — catch unhandled errors project-wide.

### Core concepts
- **Activities** — building blocks: Click, Type Into, Get Text, Use Application/Browser, Excel activities, Send Outlook Mail, HTTP Request, Invoke Workflow File.
- **Variables** (scope-based) and **arguments** (`In`, `Out`, `In/Out`) to pass data between workflows.
- **Data types**: String, Int32, Boolean, DateTime, Array, List, Dictionary, **DataTable** (core for tabular data), GenericValue.
- **Control flow**: If, Switch, For Each, For Each Row in Data Table, While/Do While, Parallel, Retry Scope, Try Catch.
- **Expressions**: VB.NET (classic) or C# (newer projects): `row("Amount").ToString`, `String.Format(...)`, LINQ on DataTables.

### Recorders
Basic/desktop/web/Citrix recorders generate activities from your actions — a starting point, always cleaned up afterwards. The **App/Web Recorder** and **Modern** activities use unified targets (selectors + fuzzy + image anchors).

### UI automation input methods
| Method | Speed | Background | Hotkeys | Notes |
|---|---|---|---|---|
| Default (hardware events) | slower | ❌ | ✅ | most compatible |
| SendWindowMessages | fast | ✅ | ✅ | not all apps |
| Simulate | fastest | ✅ | ❌ | best for web/desktop apps that support it |
| ChromiumAPI | fast | ✅ | ✅ | browsers via extension |

# Intermediate

## Selectors and UI Automation Reliability

A **selector** is an XML fragment identifying a UI element by attributes:
```xml
<html app='chrome.exe' title='Invoices - ACME ERP' />
<webctrl tag='INPUT' id='invoiceNumber' />
```

### Full vs partial selectors
- **Full selector** — includes the top-level window; used in standalone activities.
- **Partial selector** — inside a container (`Use Application/Browser`, `Attach Window`), omitting the window part.

### Making selectors robust
- Use **stable attributes** (id, name, aaname) and remove volatile ones (`idx`, dynamic titles, session ids).
- **Wildcards**: `*` (any characters) and `?` (one character) — `title='Invoice * - ACME'`.
- **Dynamic selectors** with variables: `<webctrl tag='TD' innertext='{{InvoiceNo}}' />`.
- **Anchors** — locate an element relative to a stable label ("Anchor Base", or anchors in modern targets).
- **Fuzzy selectors** and **Object Repository** (central, reusable UI element library — update in one place when UI changes).
- **UI Explorer** to inspect and refine selectors.

### Citrix / virtual environments
Images only (no DOM): use **image** and **OCR/text** automation, keyboard shortcuts, or install the UiPath Remote Runtime to get native selectors on Citrix/RDP.

### Waiting and synchronisation
Activity properties: `WaitForReady` (Interactive/Complete), `Timeout`, `DelayBefore/After`. Prefer **Check App State / Element Exists / Retry Scope** over fixed `Delay`.

## Robotic Enterprise Framework (REFramework)

UiPath's template for production-grade **transactional** processes, built as a **State Machine**.

```text
     ┌─────────┐   success   ┌──────────────────────┐  no more data  ┌──────┐
     │  Init   │────────────▶│ Get Transaction Data │───────────────▶│ End  │
     └─────────┘             └──────────────────────┘                └──────┘
         ▲  system error              │ new transaction                   ▲
         │                            ▼                                   │
         │                   ┌──────────────────────┐                     │
         └───────────────────│ Process Transaction  │─────────────────────┘
          (retry / re-init)  └──────────────────────┘  (fatal error in Init)
```

### States
1. **Init** — read `Config.xlsx` (settings, constants, Orchestrator asset names), initialise applications, kill stray processes.
2. **Get Transaction Data** — fetch the next item (queue item from Orchestrator by default, or a DataTable row).
3. **Process Transaction** — run the business logic for one item; classify outcome:
   - **Success** → mark item Successful.
   - **Business Rule Exception** (e.g., invoice amount missing) → mark Failed (Business), **no retry**, notify business.
   - **System/Application Exception** (e.g., app crashed, selector not found) → **retry** (per MaxRetryNumber / queue retry), close and re-initialise applications.
4. **End** — close applications, final reporting.

### Why use it
Built-in logging, exception handling, retries, screenshot on error, configuration management, queue integration — consistent, maintainable, scalable bots. **Dispatcher–Performer** model: a dispatcher bot loads work items into a queue; one or many performer bots (REFramework) process them in parallel.

## Orchestrator, Queues and Assets

**UiPath Orchestrator** (cloud or on-prem) is the central control room.

| Feature | Purpose |
|---|---|
| **Folders / tenants** | organise and secure processes, robots, assets per team |
| **Packages & processes** | versioned published projects and their deployments |
| **Robots / machines** | runtime capacity (attended, unattended, licences) |
| **Jobs** | executions, with logs and status |
| **Triggers** | time (cron) triggers, **queue triggers** (start bots when items arrive), event triggers (email, API) |
| **Queues** | store transaction items: status (New, In Progress, Successful, Failed, Abandoned, Retried), priority, deadlines, auto-retry, SLA |
| **Assets** | shared config: text, integer, boolean, **credential** (stored securely, retrieved with Get Credential) |
| **Storage buckets** | files for processes |
| **Logs & monitoring** | robot logs, alerts, dashboards (Insights) |
| **Action Center** | human-in-the-loop tasks (validation, approvals) for long-running workflows |

### Queue item best practices
Use a meaningful **Reference** (invoice number) for tracking and duplicate prevention (unique reference), store input data in SpecificContent, set output data on completion, use priorities and deadlines, and configure auto-retry for system exceptions.

### Credentials
Never hard-code passwords — store in Orchestrator credential assets or external vaults (CyberArk, Azure Key Vault, HashiCorp Vault) and use `SecureString`.

## Working with Excel, Email, PDFs and Data

### Excel
- **Excel activities** (Use Excel File, Read Range, Write Range, Filter, Insert Row) — need Excel installed for some features.
- **Workbook activities** — work on files without Excel installed.
- Prefer reading into a **DataTable**, manipulating in memory (LINQ/Filter Data Table/Join), and writing once — much faster than cell-by-cell UI work.

```vb
' LINQ: sum amounts of unpaid invoices in a DataTable
dt.AsEnumerable().Where(Function(r) r("Status").ToString = "Unpaid") _
  .Sum(Function(r) CDec(r("Amount")))
```

### Email
Get Outlook/IMAP/Exchange/Gmail/Microsoft 365 messages, filter by subject/sender, save attachments, send mail with templates. Integration Service connectors for Microsoft 365 and Gmail use APIs (more robust than UI).

### PDFs and documents
- Native PDFs: Read PDF Text; scanned: Read PDF with OCR.
- **Document Understanding**: taxonomy → digitise (OCR) → classify → extract (template, ML or generative extractors) → **validation station** for low-confidence fields (human in the loop) → export.

### APIs and databases
HTTP Request activity / Integration Service connectors for REST APIs; Database activities (Connect, Execute Query, Execute Non Query) for SQL. **Prefer APIs over UI** when available.

# Advanced

## Exception Handling, Logging and Best Practices

### Exceptions
- **System exceptions** — technical: selector not found, timeout, app crash → retry, recover (restart app).
- **Business rule exceptions** — data/business: invalid PO, missing approval → don't retry, report to business.
- Use **Try Catch**, **Throw/Rethrow**, **Retry Scope**, Global Exception Handler; take screenshots on failure; send notification emails.

### Logging
`Log Message` with levels (Trace, Info, Warn, Error, Fatal), and **Add Log Fields** to include transaction ids. Logs go to Orchestrator/Elasticsearch; build dashboards (Insights/Kibana). Never log sensitive data (passwords, PII) — use Private properties.

### Development best practices
- Modular workflows (one responsibility each) invoked with arguments; reusable libraries (published as packages).
- Naming conventions (`in_InvoicePath`, `out_Total`, `io_Data`, `dt_Invoices`), annotations, no unused variables.
- Config-driven (Config.xlsx + assets), no hard-coded values.
- Workflow Analyzer rules and code reviews; source control (Git) integrated in Studio.
- Test workflows with **UiPath Test Suite** (test cases, mocking, data-driven, coverage).
- Use Object Repository and modern activities; prefer API/integration over UI.
- Clean environments: kill processes in Init; close apps in End.

## Microsoft Power Automate

### Cloud flows
Event-driven automations using **connectors** (1,000+: SharePoint, Outlook, Teams, Dataverse, SQL, Salesforce).
- **Automated** (trigger: "When a new email arrives"), **instant** (button), **scheduled** (recurrence).
- Actions, conditions, loops (Apply to each), expressions (`formatDateTime(utcNow(), 'yyyy-MM-dd')`), variables, scopes for try/catch (configure "run after"), approvals.

### Desktop flows (Power Automate Desktop)
RPA for desktop and web UI, with UI element selectors, Excel/PDF/OCR actions, and attended/unattended runs via machine groups. Triggered from cloud flows.

### Ecosystem
Power Apps (low-code apps), Dataverse (data), **AI Builder** (form processing, classification), Copilot Studio (agents), Process Mining. Governance: **environments**, **DLP policies** (which connectors can be combined), Center of Excellence (CoE) Starter Kit, solutions for ALM (dev → test → prod via pipelines).

### Power Automate vs UiPath
Power Automate: best in Microsoft-centric organisations, low cost for M365 users, strong API connectors and citizen development. UiPath: richer enterprise RPA (complex UI automation, Citrix, REFramework, Orchestrator queues, document understanding, testing), broader platform for large CoEs.

## Automation Anywhere and Blue Prism Essentials

### Automation Anywhere (Automation 360)
- **Bot Creator** (web-based designer), **Control Room** (deploy, schedule, credentials via **Credential Vault**, workload management queues), **Bot Runner** (attended/unattended execution).
- Bot types: **Task Bots** (core automation), **Meta Bots** (legacy reusable components; now packages/subtasks), **IQ Bot / Document Automation** (AI for documents).
- Packages and actions, recorder (universal/object cloning), variables (String, Number, List, Dictionary, Table, Record), error handler (Try/Catch/Finally), Workload Management for queue-based scaling.

### Blue Prism
- **Object Studio** — application models (business objects with actions on a specific application).
- **Process Studio** — business process logic calling objects.
- **Control Room** — scheduling, work queues, sessions; **Application Modeller** spies elements (Win32, HTML, UIA, Java, Region modes).
- Strong separation of objects and processes, centralised, audit-friendly — popular in banking.

## Governance, CoE, Scaling and Agentic Automation

### Center of Excellence (CoE)
Governance model for automation at scale: pipeline of opportunities, prioritisation, standards and reusable components, security reviews, licences, support model, benefits tracking. Models: centralised, federated, hybrid.

### Security and compliance
Least-privilege robot accounts, credential vaults, segregation of duties, audit logs, encrypted data, no PII in logs, change management, bot access reviews.

### Scaling
Dispatcher–performer with queues, multiple unattended robots on VMs, high-density robots, elastic robot orchestration (cloud robots auto-scaled), workload balancing by priority/SLA, monitoring and alerting.

### Measuring success
Hours saved / FTE equivalents, cost savings, processing time, accuracy (error rate), SLA adherence, bot utilisation, exception rates, ROI and payback period.

### Agentic automation (current direction)
Combining **AI agents** (LLMs that reason, use tools and handle unstructured inputs) with **robots** (deterministic execution) and **humans** (approvals), orchestrated end-to-end — e.g., UiPath Agent Builder + Maestro, Power Automate + Copilot Studio, Automation Anywhere AI Agent Studio. Robots remain essential for reliable execution in systems; agents handle judgement steps like classifying emails or resolving exceptions, with guardrails and human review.

# Interview Questions

## Beginner

### What is RPA?
Robotic Process Automation uses software robots to mimic human interactions with digital systems — clicking, typing, reading and moving data — to automate repetitive, rule-based processes without changing the underlying applications.

### What kinds of processes are good candidates for RPA?
Rule-based, repetitive, high-volume processes with structured digital inputs, stable applications, few exceptions and measurable benefits — for example invoice entry, report generation, data migration and account provisioning.

### Attended vs unattended bots?
Attended bots run on a user's machine and are triggered by the user to assist with tasks in real time. Unattended bots run independently on servers or VMs, triggered by schedules, queues or events, typically for back-office processing.

### What are the main UiPath components?
Studio (design workflows), Robot (execute them), Orchestrator (deploy, schedule, monitor, manage queues and assets) and Action Center (human-in-the-loop tasks), plus Document Understanding, Integration Service and Test Suite.

### Sequence vs flowchart vs state machine?
A sequence runs activities linearly — good for simple step-by-step tasks. A flowchart supports branching and multiple decision paths — good for business logic. A state machine moves between defined states via transitions — used for complex, transactional processes like REFramework.

### What is a PDD and SDD?
The Process Definition Document captures the as-is business process: steps, rules, exceptions, inputs, outputs and volumes. The Solution Design Document describes how the automation will be built: architecture, workflows, components, queues, error handling and environments.

## Intermediate

### What is a selector and how do you make it reliable?
An XML fragment identifying a UI element through its attributes and parents. Make it reliable by using stable attributes, removing volatile ones like `idx`, using wildcards and dynamic variables, adding anchors, using the Object Repository and validating with UI Explorer.

### Explain REFramework.
A UiPath state machine template for transactional processes with Init, Get Transaction Data, Process Transaction and End states. It provides configuration management, queue integration, logging, screenshots on errors, and differentiated handling of business exceptions (no retry) versus system exceptions (retry and re-initialise applications).

### Business exception vs system exception?
A business rule exception is caused by data or business rules — e.g., a missing PO number — and is not retried; the business is notified. A system exception is technical — timeouts, application crashes, missing elements — and is usually retried after recovering the environment.

### What are Orchestrator queues and why use them?
Queues store work items with data, status, priority, deadlines and references. They enable dispatcher–performer architectures, parallel processing across multiple robots, automatic retries, SLA tracking, reporting and preventing duplicate processing.

### How do you store credentials securely in RPA?
Use Orchestrator credential assets or Control Room Credential Vaults, or integrate external vaults like CyberArk or Azure Key Vault. Retrieve them at runtime as SecureString, never hard-code or log them, and apply least-privilege access to robot accounts.

### How do you automate applications in Citrix?
Since there's no DOM access, use image recognition, OCR-based text activities, keyboard shortcuts and relative anchors, or install UiPath Remote Runtime on the Citrix server to enable native selectors, which is far more reliable.

### What is the dispatcher–performer model?
A dispatcher process collects input data (from Excel, email, databases) and adds items to a queue. Performer processes (often REFramework) pick items from the queue and process them independently, allowing scaling across many robots and isolating failures per item.

## Advanced

### How do you make RPA bots resilient to application changes?
Robust selectors with anchors and Object Repository, modular reusable components, configuration-driven values, retry scopes and application state checks, preferring APIs or connectors over UI, automated regression tests for bots, monitoring with alerts, and change management with application owners.

### How would you design an invoice processing automation end to end?
Dispatcher monitors a mailbox and downloads invoices into a storage bucket and queue; performers run Document Understanding to classify and extract fields, route low-confidence results to Action Center for validation, validate against PO/vendor master data via API or ERP UI, post the invoice into the ERP, handle business exceptions by notifying AP, log every step, and report throughput, accuracy and savings.

### How do you set up governance for enterprise RPA?
Establish a Center of Excellence with an opportunity pipeline and ROI-based prioritisation, development standards and code reviews, reusable libraries, security policies (credential vaults, least privilege, audits), environment separation and release management, licence and capacity management, support runbooks and benefits tracking.

### How do AI and agents change RPA?
AI extends RPA to unstructured data (documents, emails, conversations) and judgement-based steps. Agentic automation orchestrates LLM agents that decide and use tools, robots that execute deterministic system actions, and humans who approve exceptions — enabling end-to-end automation of processes that RPA alone couldn't handle, with guardrails and auditability.

### UiPath vs Power Automate vs Automation Anywhere?
UiPath is the most comprehensive enterprise RPA platform with strong UI automation, Orchestrator, REFramework and AI capabilities. Power Automate excels in Microsoft ecosystems with low-cost cloud connectors and citizen development. Automation Anywhere offers a cloud-native, web-based platform with strong document automation. Choice depends on ecosystem, process complexity, scale, governance and licensing.

# Scenario Questions

## Beginner

### Your bot breaks every time the target web app changes slightly. How do you make it more resilient?
- Use **stable selectors**: anchor-based, attribute-based (id, name, aaname) rather than index or position, with wildcards for dynamic parts.
- Prefer APIs or database access over UI automation when they're available.
- Add retry scopes and checks that the element exists.
- Centralise selectors in an object repository so one fix updates every workflow.

## Intermediate

### An invoice bot processes 2,000 items a day but crashes midway, and restarting duplicates work. How do you redesign it?
Use the **REFramework / dispatcher–performer** pattern:
- A dispatcher adds each invoice to an **Orchestrator queue**, with a unique reference so duplicates are rejected.
- Performers process one transaction at a time, with status, retries and exception handling (business versus system exceptions).
- Robots can scale horizontally.
- Failed items are retried or routed to a human, and restarts pick up where they left off.

### How do you handle credentials securely in an attended or unattended bot?
Store them in **Orchestrator Assets / Credential Manager**, or an external vault (CyberArk, Azure Key Vault). Never put them in workflows or config files. Use least-privilege service accounts, rotate passwords, mask them in logs, and use `SecureString` in variables.

## Advanced

### The business wants to automate a process with scanned invoices in 50 different layouts. What's your approach?
- Use **Intelligent Document Processing** (UiPath Document Understanding or AI Center, Azure AI Document Intelligence): OCR, classification, and ML extractors trained per document type.
- Route low-confidence fields to a **human-in-the-loop** validation station.
- Feed corrections back for retraining.
- Measure straight-through processing rate and accuracy per vendor.

# Tricky Questions

## Intermediate

### Business exception vs system exception: which one should be retried?
**System exceptions** (an app timeout, a selector not found, a network failure) are worth retrying, often after restarting the application. **Business exceptions** (invalid invoice data, a missing PO number) won't succeed on retry, so flag them and send them to a human or the business.

### Is every repetitive process a good RPA candidate?
No. Good candidates are **rule-based**, stable, high-volume, use digital and structured inputs, and have few exceptions. A process that changes often or relies heavily on judgement makes a fragile bot. Sometimes fixing the process or using an API integration is better than automating a bad process.
