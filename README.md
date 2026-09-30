# FAIR

**Understand how AI represents your business, verify what it gets right, and identify what needs human judgment.**

> **Live Demo:** fair-deploy.vercel.app

FAIR helps small and medium-sized businesses measure and improve how AI systems describe and recommend them. It combines verified business information, controlled benchmark questions, preserved model evidence, deterministic evaluation, and a human review layer in one hosted workflow.

## Try FAIR

No local setup is required to evaluate the hosted competition submission.

1. Open the live deployed site.
2. Choose the Franklin Barbecue demo or select **Use My Business**.
3. Review the verified information in **Truth Hub**.
4. Refresh or inspect the controlled customer questions in **Queries**.
5. Run the benchmark.
6. Review the results in **Metrics**.
7. Inspect uncertain or conflicting findings in **Human Review**.

**Note**: Live benchmark runs can take about 30–90 seconds to complete because FAIR queries multiple AI benchmark questions sequentially and evaluates each response before updating the dashboard.

## What FAIR does

Businesses know their own products, services, prices, hours, availability, and policies. AI systems may represent that information incompletely or incorrectly. FAIR creates a traceable way to compare the two:

- The business records verified information in Truth Hub.
- FAIR generates realistic customer questions from that information.
- The application submits those questions to an AI model from the server.
- FAIR preserves each raw response as benchmark evidence.
- Application logic evaluates mentions, recommendations, positions, and factual claims.
- The resulting metrics summarize performance across the controlled benchmark.
- Evidence that cannot be resolved confidently is available for human specialist review.

FAIR's measurements describe performance within its saved benchmark. They are not universal market-share, search-volume, or population-level visibility estimates.

## Product flow

```text
Overview -> Truth Hub -> Queries -> Metrics -> Human Review
   |            |           |          |             |
 summary     verified    controlled  deterministic  specialist
             business    scenarios   measurements   judgment
             truth
```

### Overview

See the latest benchmark summary, evidence coverage, and visibility breakdowns at a glance.

### Truth Hub

Maintain the verified source of truth for the business, its offerings, supporting facts, and sources. Only verified, explicitly linked facts are eligible for factual comparison.

### Queries

Review controlled customer scenarios generated from Truth Hub data. Each question carries a category, audience, selected evaluation dimensions, and links to the facts it is intended to test.

### Metrics

Run the benchmark and inspect deterministic measurements derived from the latest completed run and the current active question set. Raw answers and claim-level evidence remain available for traceability.

### Human Review

Review conflicts and uncertain evidence that require judgment. Human Review is the customer-facing specialist-support layer, keeping ambiguity visible instead of forcing it into an artificial score.

## Key features

- Verified, structured business truth with source references
- Realistic benchmark questions tied to business facts
- Server-side OpenAI requests with secrets kept out of the browser
- Raw-response and claim-level evidence preservation
- Deterministic identity, recommendation, position, and fact evaluation
- Category, audience, offering, and test coverage views
- Browser-isolated workspaces for each evaluator
- Specialist review for conflicting or inconclusive findings

## Benchmark and metric methodology

Each benchmark run selects up to 15 active questions. Every selected question produces one monitored-model response. FAIR then evaluates that response with application code. It does not ask a second LLM to grade the first model's answer.

Only unambiguous factual comparisons are included in accuracy and conflict denominators. Evidence that cannot be matched confidently is marked for review and remains inspectable. Headline metrics use the current active benchmark set and the latest completed run.

| Metric | Definition within FAIR's controlled benchmark |
| --- | --- |
| **Mention Rate** | Tested responses that mention the business divided by all tested responses. |
| **Recommendation Rate** | Tested responses that recommend the business divided by all tested responses. |
| **Top Recommendation Rate** | Tested responses that place the business first divided by all tested responses. |
| **Average Recommendation Position** | Mean of the explicit, non-null positions assigned to the business in recommendation lists. |
| **Fact Accuracy** | Verified comparable claims divided by all comparable claims checked. |
| **Conflict Rate** | Conflicting comparable claims divided by all comparable claims checked. |
| **Test Coverage** | Active questions represented in the latest completed run divided by all current active questions. |
| **Offering Coverage** | Linked offerings represented by tested active questions divided by linked offerings represented by all active questions. |
| **Category Visibility** | Mention Rate grouped by the saved question category. |
| **Audience Visibility** | Mention Rate grouped by the saved customer audience. |

## Demo experience

FAIR includes a prefilled Franklin Barbecue workspace so judges can explore the full experience immediately. The preset contains business facts, offerings, sources, benchmark questions, and sample evidence suitable for demonstrating the workflow.

Franklin Barbecue is only bundled demo data. It uses the same generic data model and product flow as any other business. There is no Franklin-specific evaluation logic.

Evaluators can instead choose **Use My Business** to create a blank, browser-local workspace and enter their own business information. Each browser stores its workspace separately, so one evaluator's changes do not alter another evaluator's session.

## Architecture

```text
Browser-local workspace
  |  Truth Hub facts + benchmark definitions
  v
Next.js server action
  |  server-only OpenAI API key
  v
Monitored AI response
  |  raw response preserved
  v
Deterministic application evaluation
  |  mention + recommendation + position + factual evidence
  v
Metrics and Human Review
```

The active competition experience persists each evaluator's workspace in browser `localStorage`. Benchmark execution still occurs through a server action, so the OpenAI API key is never sent to browser code. Completed evidence is returned to and stored in that isolated workspace.

The repository also contains Supabase integration and migrations for a broader server-persisted architecture. Supabase is not required for the active browser-local competition workflow.

## Tech stack

- **Next.js 16** with the App Router and server actions
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **OpenAI API** for question generation and monitored benchmark responses
- **Zod** for server-boundary validation
- Browser **`localStorage`** for isolated competition workspaces
- **Supabase** integration for the broader server-persistence path, separate from the active browser-local workflow

## Competition context

FAIR was developed for the **HSI Battle of the Brains** by students representing the **University of California, Merced**.

## Optional local development

Local setup is only necessary for reviewers who want to inspect or run the source code.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To generate benchmark questions or run live AI benchmarks locally, create `.env.local` with a server-side OpenAI API key:

```bash
OPENAI_API_KEY=your_key_here
```

Do not use a `NEXT_PUBLIC_` prefix. The browser-local demo can otherwise be explored without Supabase configuration. A live benchmark run makes one OpenAI request per selected question, up to 15 questions per run.
