---
id: genai
title: Generative AI & LLMs
short: GenAI / LLMs
category: Artificial Intelligence
order: 19
color: #c2410c
icon: AI
summary: How LLMs work, tokens & context, prompt engineering, embeddings, RAG, vector databases, fine-tuning (LoRA), tool use, agents, MCP, evaluation, safety and LLMOps.
---

# Beginner

## How Large Language Models Work

A **Large Language Model** is a (usually decoder-only) **Transformer** trained to **predict the next token** given previous tokens, on a massive text corpus. Generating text = repeatedly predicting a token, appending it and predicting again (**autoregressive** decoding).

### Training stages
1. **Pre-training** — self-supervised next-token prediction on trillions of tokens → broad knowledge and language ability (a "base model").
2. **Supervised fine-tuning (SFT) / instruction tuning** — curated prompt→response pairs teach the model to follow instructions.
3. **Preference alignment** — **RLHF** (reinforcement learning from human feedback with a reward model), **DPO**, or Constitutional AI / RLAIF — making responses helpful, honest and harmless.
4. Increasingly, **reinforcement learning on verifiable tasks** (math, code) to improve reasoning.

### Why LLMs can be wrong
They model *plausible* text, not verified truth → **hallucinations**; knowledge has a **training cutoff**; they can't access private/current data unless you provide it (prompt, RAG, tools).

## Tokens, Context Windows and Sampling

### Tokens
Text is split into **tokens** (sub-word pieces via BPE/SentencePiece). Roughly **1 token ≈ 4 characters ≈ ¾ of an English word**. Pricing, rate limits and context size are measured in tokens.

### Context window
The maximum number of tokens (prompt + output) the model can attend to at once — from a few thousand to hundreds of thousands or more. Everything the model "knows" about your conversation must be in this window; the model is **stateless** between API calls (chat apps resend history).

### Decoding parameters
| Parameter | Effect |
|---|---|
| **temperature** | randomness: 0 → focused/deterministic-ish, higher → more creative/diverse |
| **top_p** (nucleus) | sample only from the smallest set of tokens whose probabilities sum to p |
| **top_k** | sample only from the k most likely tokens |
| **max_tokens** | cap output length |
| **stop sequences** | stop generation when a string appears |

Low temperature for extraction/classification/code; higher for brainstorming.

### Calling an LLM API
```python
import anthropic
client = anthropic.Anthropic()        # reads ANTHROPIC_API_KEY

msg = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    system="You are a concise senior backend engineer.",
    messages=[{"role": "user", "content": "Explain idempotency keys in 3 bullet points."}],
)
print(msg.content[0].text)
```
Messages have **roles**: `system` (instructions/persona), `user`, `assistant`. Streaming returns tokens incrementally (Server-Sent Events) for better perceived latency.

## Prompt Engineering Fundamentals

Prompting is the first lever — cheapest and fastest to iterate.

### Principles
1. **Be clear and specific** — state the task, audience, format, length, constraints.
2. **Give context** — why the task matters, who the output is for.
3. **Provide examples** (**few-shot**) of input → desired output.
4. **Structure the prompt** — separate instructions, context and data with headings or XML-style tags.
5. **Specify the output format** — JSON schema, markdown table, bullet list.
6. **Let the model think** — ask for reasoning before the answer for complex tasks (chain-of-thought), or use models with built-in extended thinking.
7. **Assign a role** in the system prompt.
8. **Tell it what to do when unsure** — "If the answer is not in the documents, say you don't know."

```text
<role>You are a support assistant for Acme's billing product.</role>

<instructions>
Classify the customer message into one of: billing_issue, bug_report, feature_request, other.
Return JSON: {"category": "...", "urgency": "low|medium|high", "summary": "<one sentence>"}
</instructions>

<examples>
Message: "I was charged twice this month!!"
Output: {"category": "billing_issue", "urgency": "high", "summary": "Customer was double-charged."}
</examples>

<message>{{customer_message}}</message>
```

### Common techniques
- **Zero-shot / few-shot** prompting.
- **Chain-of-thought** — "think step by step"; or structured `<thinking>` then `<answer>`.
- **Prompt chaining** — split complex tasks into sequential calls (extract → analyse → write).
- **Self-consistency** — sample multiple answers, choose the majority.
- **Prefilling** the assistant response (e.g., start with `{`) to force a format.
- **Structured outputs / JSON mode / tool schemas** for reliable machine-readable responses.

# Intermediate

## Embeddings and Semantic Search

An **embedding** is a dense vector (e.g., 768–3072 floats) representing the *meaning* of text (or images). Similar meanings → nearby vectors.

```python
docs = ["Reset your password from Settings > Security", "Invoices are emailed monthly", ...]
doc_vecs = embed(docs)                       # embedding model API / sentence-transformers
q_vec = embed(["how do I change my password?"])[0]
scores = cosine_similarity(q_vec, doc_vecs)  # rank by similarity
```

- **Similarity metrics**: cosine similarity (most common), dot product, Euclidean distance.
- **Keyword search (BM25)** matches exact terms; **semantic search** matches meaning. **Hybrid search** combines both (often best) and fuses results (Reciprocal Rank Fusion).
- **Re-rankers** (cross-encoders) re-score the top-k candidates for higher precision.

### Vector databases
Store embeddings and perform fast **Approximate Nearest Neighbour (ANN)** search using indexes like **HNSW** (graph-based) or **IVF** (clustered), often with quantization (PQ) to save memory. Options: **pgvector** (Postgres), Pinecone, Weaviate, Qdrant, Milvus, Chroma, Elasticsearch/OpenSearch, Redis. They also support metadata filtering (tenant, date, permissions).

## Retrieval-Augmented Generation (RAG)

RAG grounds an LLM's answer in **your** data by retrieving relevant content and putting it in the prompt.

```text
Indexing (offline):  documents → parse → chunk → embed → store in vector DB (+ metadata)
Query (online):      question → (rewrite) → embed → retrieve top-k → (re-rank) → prompt LLM with context → answer + citations
```

```python
def answer(question: str) -> str:
    chunks = vector_db.search(embed(question), top_k=20, filter={"tenant": user.tenant})
    chunks = reranker.rank(question, chunks)[:5]
    context = "\n\n".join(f"<doc id='{c.id}' source='{c.source}'>{c.text}</doc>" for c in chunks)
    prompt = f"""Answer using ONLY the documents below. Cite doc ids like [doc-3].
If the documents don't contain the answer, say "I don't know."

<documents>{context}</documents>
<question>{question}</question>"""
    return llm(prompt)
```

### Why RAG?
Up-to-date and private knowledge without retraining, fewer hallucinations, **citations** for trust, access control per user, cheaper than fine-tuning for knowledge.

### Chunking strategies
Fixed-size with overlap (e.g., 500–1000 tokens, 10–20% overlap), recursive/structure-aware (headings, paragraphs, code blocks), semantic chunking, and **contextual retrieval** (prepend a short summary of the document to each chunk before embedding). Keep metadata (title, URL, section, date, ACLs).

### Improving retrieval quality
Hybrid search (BM25 + vectors), re-ranking, query rewriting / multi-query / HyDE (embed a hypothetical answer), metadata filters, parent-document retrieval (retrieve small chunks, pass larger context), better embedding models, and evaluating retrieval separately from generation.

## Fine-Tuning vs RAG vs Prompting

| Approach | Best for | Not for |
|---|---|---|
| **Prompt engineering** | most tasks; fast iteration | very long-tail specialised behaviour |
| **RAG** | injecting **knowledge** (docs, policies, fresh data), citations | teaching a new style/format at scale |
| **Fine-tuning** | consistent **behaviour/style/format**, domain jargon, smaller cheaper model for a narrow task, latency | adding frequently changing facts |

Rule of thumb: **prompt → RAG → fine-tune**, and combine them when needed.

### Parameter-efficient fine-tuning (PEFT)
- **LoRA** — freeze base weights; train small low-rank matrices (A·B) added to attention/MLP layers. Tiny adapters, cheap training, swappable per task.
- **QLoRA** — LoRA on a 4-bit quantized base model → fine-tune large models on a single GPU.
- Full fine-tuning updates all weights — expensive, risk of catastrophic forgetting.
- Data quality matters more than quantity: hundreds to thousands of high-quality examples.

### Model optimisation for serving
**Quantization** (FP16 → INT8/INT4: GPTQ, AWQ, GGUF), **distillation** (train a small model to mimic a large one), **KV-cache**, continuous batching, speculative decoding, serving engines (**vLLM**, TGI, TensorRT-LLM, llama.cpp, Ollama).

## Tool Use (Function Calling) and Structured Output

LLMs can't act by themselves — you give them **tools** described by JSON Schema; the model decides when to call a tool and with what arguments; **your code executes it** and returns the result.

```python
tools = [{
    "name": "get_order_status",
    "description": "Get the shipping status of an order by its ID.",
    "input_schema": {
        "type": "object",
        "properties": {"order_id": {"type": "string", "description": "e.g. ORD-1234"}},
        "required": ["order_id"],
    },
}]

messages = [{"role": "user", "content": "Where is my order ORD-1234?"}]
resp = client.messages.create(model="claude-sonnet-5-5", max_tokens=1024, tools=tools, messages=messages)

while resp.stop_reason == "tool_use":
    messages.append({"role": "assistant", "content": resp.content})
    results = []
    for block in resp.content:
        if block.type == "tool_use":
            output = run_tool(block.name, block.input)           # your code
            results.append({"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(output)})
    messages.append({"role": "user", "content": results})
    resp = client.messages.create(model="claude-sonnet-5-5", max_tokens=1024, tools=tools, messages=messages)

print(resp.content[0].text)
```

Good tool design: clear names and descriptions (they *are* the prompt), minimal well-typed parameters, helpful error messages the model can recover from, and idempotent/safe operations with confirmations for destructive actions.

# Advanced

## AI Agents

An **agent** is an LLM running in a **loop**: it observes, decides the next action (often a tool call), executes, observes the result, and continues until the goal is reached.

```text
while not done:
    thought/plan  ← LLM(goal, history, tool results)
    action        ← choose tool + args (or final answer)
    observation   ← execute tool
    history += action + observation
```

### Patterns (from simple to complex)
1. **Augmented LLM** — single call with retrieval/tools.
2. **Workflows** (predefined code paths): prompt chaining, **routing** (classify then dispatch), **parallelization** (sectioning or voting), **orchestrator–workers**, **evaluator–optimizer** (generate → critique → refine).
3. **Autonomous agents** — the model directs its own process and tool usage for open-ended tasks (coding agents, research agents).

Start with the simplest thing that works; add autonomy only when the task needs it — agents trade cost, latency and predictability for flexibility.

### Key components
- **Memory**: short-term (conversation/context), long-term (vector store, files, databases), summarisation/compaction of long histories.
- **Planning / reflection**: ReAct (reason + act interleaved), plan-then-execute, self-critique.
- **Multi-agent systems**: specialised sub-agents with a coordinator; isolate contexts to keep each focused.
- **Guardrails**: max steps, budgets, sandboxed execution, human-in-the-loop approval for risky actions, permission scopes.

### Frameworks
Anthropic Claude Agent SDK, OpenAI Agents SDK, LangGraph/LangChain, LlamaIndex, CrewAI, AutoGen, Semantic Kernel, Pydantic AI — or a plain loop in your own code.

## Model Context Protocol (MCP)

**MCP** is an open protocol (introduced by Anthropic, now widely adopted) that standardises how AI applications connect to tools and data — "USB-C for AI integrations".

- **Hosts/clients** — AI apps (Claude, IDEs, agent frameworks).
- **Servers** — expose capabilities:
  - **Tools** — functions the model can call (create ticket, query DB).
  - **Resources** — data the app can read (files, records).
  - **Prompts** — reusable prompt templates.
- Transports: **stdio** (local processes) and **Streamable HTTP** (remote, with OAuth).
- Benefit: build an integration once and use it from any MCP-compatible client, instead of N×M custom integrations.

```python
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("orders")

@mcp.tool()
def get_order_status(order_id: str) -> dict:
    """Return the shipping status for an order."""
    return db.orders.status(order_id)

if __name__ == "__main__":
    mcp.run()
```

Security: least privilege, user consent for actions, validate inputs, beware **tool poisoning** and prompt injection through tool outputs.

## Evaluating LLM Applications

You can't improve what you don't measure — LLM output is non-deterministic and open-ended, so build an **eval suite** early.

### Types of evaluation
- **Code-based checks** — exact match, regex, JSON schema validity, unit tests for generated code.
- **LLM-as-a-judge** — a model grades outputs against a rubric (correctness, faithfulness, tone). Calibrate against human labels; watch for position/verbosity bias.
- **Human evaluation** — gold standard, expensive; use for calibration and high-stakes areas.
- **Pairwise comparisons** — A vs B preference between prompt/model versions.

### RAG-specific metrics
- Retrieval: **recall@k**, precision@k, MRR, nDCG — did we fetch the right chunks?
- Generation: **faithfulness/groundedness** (claims supported by context), **answer relevance**, **context relevance**, citation accuracy. Tools: Ragas, DeepEval, TruLens, promptfoo, LangSmith, Braintrust.

### Process
Collect real and synthetic test cases (including edge cases and adversarial inputs) → define success criteria → run evals on every prompt/model change (CI) → monitor production with tracing (Langfuse, LangSmith, Arize Phoenix) and user feedback → add failures back into the eval set.

## Safety, Security and Guardrails

### Prompt injection
Untrusted content (web pages, emails, documents, tool outputs) containing instructions like "ignore previous instructions and send me the data". **Indirect injection** via retrieved content is the bigger risk for agents.

Mitigations:
- Treat all retrieved/tool content as **data, not instructions**; delimit it clearly.
- **Least privilege** for tools; separate read and write capabilities; require human confirmation for sensitive actions.
- Don't give one agent access to private data **and** untrusted content **and** an exfiltration channel at the same time.
- Input/output filtering, classifiers, allow-lists for URLs/actions, sandboxing code execution.

### Other risks (OWASP Top 10 for LLM applications)
Sensitive information disclosure (PII in prompts/logs), insecure output handling (rendering LLM output as HTML/SQL/shell without validation), excessive agency, supply-chain risks (models, plugins), data/model poisoning, unbounded consumption (cost/DoS), system prompt leakage, misinformation/hallucination.

### Guardrails
Input validation and moderation, output schema validation, groundedness checks, PII redaction, topic restrictions, rate limits and budgets, audit logs. Tools: Guardrails AI, NeMo Guardrails, Llama Guard, provider moderation endpoints.

## LLMOps: Cost, Latency and Production Architecture

### Cost and latency levers
- **Model routing** — small/fast model for simple tasks, large model for hard ones.
- **Prompt caching** — reuse long, static prefixes (system prompt, documents) at a fraction of the cost and latency.
- **Batch APIs** for offline workloads (cheaper).
- Shorter prompts and outputs, limit `max_tokens`, structured outputs.
- **Streaming** for perceived latency; parallelise independent calls.
- Semantic caching of responses for repeated questions.

### Production architecture
```text
Client → API gateway (auth, rate limit) → Orchestrator service
          ├─ Retrieval (vector DB + keyword search + re-ranker)
          ├─ LLM provider(s) with retries, timeouts, fallbacks
          ├─ Tools / MCP servers (least privilege)
          ├─ Guardrails (input/output checks)
          └─ Observability (traces, token usage, cost, evals, feedback)
```
- Handle rate limits (429) with exponential backoff; fall back to another model/provider.
- Version prompts like code; A/B test prompt and model changes with evals.
- Data governance: retention policies, no training on customer data, regional processing.

# Interview Questions

## Beginner

### What is a large language model?
A neural network (typically a decoder-only Transformer) with billions of parameters trained to predict the next token on huge text corpora, then fine-tuned to follow instructions and aligned with human preferences. It generates text autoregressively, one token at a time.

### What is a token?
The unit of text an LLM processes — usually a sub-word piece produced by a tokenizer such as BPE. About 4 characters or ¾ of an English word on average. Context limits, costs and rate limits are measured in tokens.

### What is a context window?
The maximum number of tokens (input plus output) a model can consider in one request. Information outside it is invisible to the model, which is stateless across calls — applications must resend conversation history or retrieve relevant information.

### What does temperature do?
It scales the probability distribution over next tokens. Low temperature makes outputs more deterministic and focused; high temperature increases randomness and diversity. Use low values for factual or structured tasks and higher for creative work.

### What is a hallucination and how do you reduce it?
A confident but false or unsupported output. Reduce it with grounding (RAG with citations), instructing the model to say "I don't know", lower temperature, tool use for facts and calculations, verification steps, and evals that measure faithfulness.

### What is prompt engineering?
Designing inputs to get reliable, high-quality outputs: clear instructions, context, examples (few-shot), structure (tags), defined output formats, roles, and encouraging step-by-step reasoning for complex problems.

## Intermediate

### What is RAG and why use it?
Retrieval-Augmented Generation retrieves relevant documents (via vector/keyword search) and includes them in the prompt so the model answers from that context. It provides up-to-date and private knowledge, citations, access control and fewer hallucinations without retraining the model.

### What are embeddings?
Dense numeric vectors representing semantic meaning, produced by embedding models. Texts with similar meaning have vectors close together (cosine similarity), enabling semantic search, clustering, recommendations and RAG retrieval.

### How do vector databases search so fast?
They use approximate nearest neighbour indexes like HNSW (navigable small-world graphs) or IVF (cluster-based partitions), often with vector quantization, trading a tiny amount of recall for orders-of-magnitude faster search than brute force. They also support metadata filtering.

### How would you choose a chunking strategy for RAG?
Match the document structure: split on headings/paragraphs (recursive or structure-aware), keep chunks large enough to be self-contained but small enough to be specific (often a few hundred to ~1000 tokens with overlap), preserve metadata, and consider adding document context to each chunk. Validate choices with retrieval metrics on real queries.

### RAG vs fine-tuning?
RAG adds knowledge at query time — ideal for facts that change, private documents and citations. Fine-tuning changes the model's behaviour — style, format, domain-specific patterns, or making a smaller model good at a narrow task. They're complementary; most knowledge problems should start with RAG.

### What is LoRA?
Low-Rank Adaptation: a parameter-efficient fine-tuning method that freezes the base model and trains small low-rank matrices injected into its layers. It drastically reduces memory and compute, produces small adapter files, and allows swapping adapters per task. QLoRA does this on a 4-bit quantized base.

### How does function calling / tool use work?
You describe tools with names, descriptions and JSON-schema parameters. The model responds with a structured tool call when appropriate; your application executes the function and returns the result as a message; the model then continues, possibly calling more tools, until it produces a final answer.

### How do you get reliable JSON output from an LLM?
Use structured output features or tool schemas, give an explicit schema and examples, prefill the opening brace, set low temperature, validate with a schema (Pydantic/Zod), and retry with the validation error on failure.

## Advanced

### What is an AI agent and how is it different from a workflow?
A workflow orchestrates LLM calls and tools through predefined code paths (chaining, routing, parallelisation). An agent lets the LLM dynamically decide its next steps and tool calls in a loop until the goal is achieved. Agents handle open-ended tasks but are costlier, slower and less predictable, so use the simplest pattern that works.

### What is the Model Context Protocol?
An open standard for connecting AI applications to external tools, data and prompts. MCP servers expose tools, resources and prompts over stdio or HTTP; any MCP-compatible client can use them. It replaces bespoke integrations per app/tool pair with a common interface.

### What is prompt injection and how do you defend against it?
Malicious instructions embedded in user input or in content the model reads (web pages, documents, tool results) that try to override the system's instructions. Defend by treating external content as data, separating privileges, requiring human approval for sensitive actions, limiting tool scopes and egress, filtering inputs/outputs, and never combining untrusted input, sensitive data and exfiltration capability in one agent.

### How do you evaluate a RAG system?
Separately evaluate retrieval (recall@k, precision, MRR on a labelled question→relevant-chunks set) and generation (faithfulness to context, answer relevance, correctness, citation accuracy) using code checks, LLM-as-judge calibrated with human labels, and user feedback. Run the suite in CI on every change and monitor production traces.

### How do you reduce latency and cost in an LLM application?
Route easy requests to smaller models, use prompt caching for static prefixes, trim prompts and limit output tokens, stream responses, parallelise independent calls, cache repeated answers, use batch APIs for offline jobs, and for self-hosting apply quantization, continuous batching and speculative decoding.

### Explain RLHF.
Reinforcement Learning from Human Feedback: humans rank model responses; a reward model is trained to predict those preferences; the LLM is then optimised (e.g., with PPO) to maximise the reward while a KL penalty keeps it close to the original model. Alternatives like DPO optimise directly on preference pairs without a separate reward model.

### How would you design a customer-support chatbot with company knowledge?
Ingest help-center docs and tickets into a hybrid search index with metadata and access controls; on each question retrieve, re-rank and ground the answer with citations; use tools for account-specific data (order status) with user authentication; add guardrails (PII redaction, topic limits, escalation to humans when unsure); log traces, collect feedback, and evaluate continuously with a test set of real questions.
