# OUTCOME

**Don't pay for promises. Pay for verified outcomes.**

OUTCOME turns a natural-language work request into an agreement with measurable acceptance criteria, records a PayPal authorization, collects delivery evidence, asks an LLM to evaluate that evidence, and allows an operator to capture or void the authorization.

This repository keeps the supplied Next.js frontend and adds the backend as Next.js Route Handlers. No separate Express service is required.

try it out : [Outcome](https://outcome-75u6.onrender.com/)

Temporary Model Availability Issues

You may occasionally encounter the following message:

This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.

This message indicates that the AI model provider is experiencing unusually high traffic or temporary capacity constraints.

Please note:

This is generally a temporary issue on the model provider's side.
It does not necessarily indicate a problem with the application or its configuration.
Requests may fail temporarily during periods of high demand.
If this happens, wait a few moments and retry your request.

We recommend implementing retry logic with a short delay to handle these temporary availability issues gracefully.


## What is implemented

- **Persistent outcomes:** SQLite database with agreements, acceptance criteria, evidence and audit events. Set `OUTCOME_DB_PATH` to a persistent mounted volume in production.
- **AI contract builder:** Gemini converts a description into a short list of testable acceptance criteria. Without a Gemini key, a basic text parser is used for criteria generation.
- **PayPal Sandbox:** server-side OAuth, `AUTHORIZE` order creation, buyer approval, authorization confirmation, authorization capture and authorization void. The browser only receives the public client ID.
- **Evidence collection:** evidence URLs and notes can be submitted from the Verification Center. Postman and KERNEL reports can also be ingested through dedicated integration endpoints.
- **AI verification:** Gemini evaluates criteria against submitted evidence and returns PASS / FAIL / REVIEW. Missing AI configuration or ambiguous evidence returns REVIEW.
- **Human-controlled settlement:** even a PASS is only a recommendation. The operator must sign in and explicitly confirm before the backend captures funds. Void also requires operator confirmation.
- **Audit trail:** important lifecycle events are recorded. Verification documents can be indexed in Elasticsearch.
- **Automation:** Zapier webhook events are sent after verification and payment capture.
- **Dashboard:** existing AG Grid dashboard is connected to persisted API data. A timeline JSON endpoint is available for a Bryntum Scheduler integration.

## Important payment semantics

PayPal authorization is **not escrow**. It places a temporary authorization hold on the buyer's funding source; it does not transfer funds to a segregated escrow account and it can expire or be declined. OUTCOME captures the authorization only after a PASS verification and explicit operator confirmation. If the authorization expires, the buyer may need to authorize again. This prototype does not yet implement refunds for captured payments, chargeback handling, production identity verification, or a full dispute-resolution process.

## Requirements

- Node.js 22.13 or newer (`node:sqlite` is used for the local prototype database)
- npm
- PayPal Developer Sandbox app
- Gemini API key for actual AI parsing and verification

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Fill `.env.local`:

1. Create a PayPal REST app in the PayPal Developer Dashboard and copy the **Sandbox Client ID** and **Sandbox Secret**.
2. Set `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_ID` to the Sandbox Client ID.
3. Set `PAYPAL_CLIENT_SECRET` to the Sandbox Secret.
4. Keep `PAYPAL_ENVIRONMENT=sandbox` and `NEXT_PUBLIC_PAYPAL_ENVIRONMENT=sandbox`.
5. Add `GEMINI_API_KEY` and optionally choose `GEMINI_MODEL`.
6. Set a strong `OUTCOME_ACCESS_PASSWORD` and a separate random `OUTCOME_SESSION_SECRET`. The password is requested when an operator creates an agreement, submits evidence, runs verification, authorizes checkout, captures, or voids a payment.
7. Optionally configure Elasticsearch and Zapier.

Open `http://localhost:3000`. Create an outcome, select it in Contracts, authorize the payment with a PayPal Sandbox buyer account, then open Verification to submit evidence and run verification. Only a PASS result reveals the capture action.

## How to Use OUTCOME

OUTCOME connects payment authorization, deliverable evidence, and AI-powered verification in one workflow.

1. Create an Outcome

Open the dashboard.

Describe the task or service being commissioned.

Enter the payment amount and relevant agreement details.

Let Gemini transform the task description into structured acceptance criteria.

2. Authorize Payment

Select the newly created agreement.

Choose the PayPal checkout option.

Approve the payment using a PayPal Sandbox buyer account.

PayPal authorizes the transaction without immediately capturing the payment.

3. Submit Deliverable Evidence

Open the Verification section.

Select the authorized agreement.

Submit evidence of completed work, such as a deployment URL, notes, or structured test results.

4. Run AI Verification

Trigger AI verification.

Gemini evaluates the submitted evidence against the original acceptance criteria.

The system returns one of three outcomes: PASS, FAIL, or REVIEW.

5. Settle the Payment

For a PASS result, an authenticated operator can confirm payment capture.

If the deliverable is rejected, the operator can void the uncaptured authorization.

Cases requiring further assessment can be sent for human review.

Important: OUTCOME uses PayPal payment authorization and capture, not a traditional escrow account. Authorizations are temporary and subject to PayPal's validity rules.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Yes for checkout | Public PayPal SDK client ID |
| `NEXT_PUBLIC_PAYPAL_ENVIRONMENT` | Yes for checkout | `sandbox` or `production` |
| `PAYPAL_CLIENT_ID` | Yes for PayPal API | Server-side REST client ID |
| `PAYPAL_CLIENT_SECRET` | Yes for PayPal API | Server-only REST secret |
| `PAYPAL_ENVIRONMENT` | Yes for PayPal API | `sandbox` or `production` |
| `GEMINI_API_KEY` | Recommended | AI contract parsing and verification |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `OUTCOME_ACCESS_PASSWORD` | Required for operator actions | Operator password |
| `OUTCOME_SESSION_SECRET` | Required for operator actions | HMAC signing secret for HttpOnly operator session |
| `OUTCOME_DB_PATH` | No | SQLite file path; defaults to `./data/outcome.sqlite` |
| `ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY` | No | Index verification evidence |
| `ZAPIER_WEBHOOK_URL` | No | Receive `outcome.verified` and `outcome.paid` events |
| `POSTMAN_WEBHOOK_SECRET` | Recommended | Bearer token for Postman test-result ingestion |
| `KERNEL_WEBHOOK_SECRET` | Recommended | Bearer token for KERNEL browser-report ingestion |

## API

### Outcomes

- `GET /api/outcomes` — list workspace outcomes
- `POST /api/outcomes` — operator session required; create an outcome and generate acceptance criteria
- `GET /api/outcomes/:id` — outcome, evidence and audit history
- `GET /api/outcomes/:id/timeline` — lifecycle events suitable for a Bryntum timeline
- `POST /api/outcomes/:id/evidence` — operator session required; submit evidence `{ kind, url?, notes?, payload? }`
- `POST /api/outcomes/:id/verify` — operator session required; evaluate submitted evidence with Gemini
- `POST /api/outcomes/:id/settle` — capture authorization; requires `{ "confirm": true }`, an operator session and a PASS result
- `POST /api/outcomes/:id/void` — void authorization; requires `{ "confirm": true }` and an operator session

### PayPal

- `POST /api/paypal/orders` — operator session required; body `{ "outcomeId": "OUT-..." }`; amount is read from the database, not trusted from the browser
- `POST /api/paypal/orders/:orderId/authorize` — operator session required; body `{ "outcomeId": "OUT-..." }`; confirms the buyer-approved order with PayPal

### Operator session

- `GET /api/session` — reports whether the current browser has an operator session
- `POST /api/session` — body `{ "password": "..." }`; creates an HttpOnly, SameSite=Lax, eight-hour operator cookie

### Sponsor integration endpoints

- `POST /api/integrations/postman` — ingest a Postman run. Body includes `outcomeId` and a `run` or `stats` object. Set `Authorization: Bearer $POSTMAN_WEBHOOK_SECRET`.
- `POST /api/integrations/kernel` — ingest browser checks from a KERNEL agent. Body: `{ "outcomeId": "...", "url": "https://...", "summary": "...", "checks": [{ "name": "pricing page", "status": "PASS", "details": "..." }] }`. Set `Authorization: Bearer $KERNEL_WEBHOOK_SECRET`.

## Sponsor/tool mapping

| Tool | Current role |
|---|---|
| PayPal | Real Sandbox order authorization, capture and void |
| Gemini | Natural-language criteria generation and evidence reasoning |
| AG Grid | Existing dashboard grid, now fed from the backend |
| Postman | Test-run evidence ingestion endpoint; use a Postman collection to publish run results |
| KERNEL | Browser-agent evidence ingestion endpoint; a KERNEL agent posts its browser checks |
| Elastic | Verification document indexing when credentials are configured |
| Zapier | Outbound workflow triggers after verification and capture |
| Bryntum | Timeline endpoint provided; add the licensed/trial Bryntum React component when package access is available |
| APIMatic | Use the PayPal API context/plugin during development to ground API implementation; it is a development-time tool, not a runtime service |
| Render | Hosting target; use a persistent disk for SQLite |
| Astropods | Can host/publish the contract or verifier agent; the core API currently runs the agent logic in the Next.js server |
| Channel3 | Deliberately deferred from this first vertical. It belongs in a later commerce mode, not the freelance-deliverable MVP |

Some sponsor integrations are **adapters**, not a claim that a sponsor agent has already been provisioned. To activate Postman/KERNEL ingestion, configure their webhook secrets and have the respective tool post the documented payload. The actual browser/API execution remains the responsibility of those agents/runners.

## Render deployment

A `render.yaml` is included. It mounts a persistent disk at `/var/data` and stores SQLite there. Configure the secret environment variables in the Render dashboard. Set `OUTCOME_DB_PATH=/var/data/outcome.sqlite`.

## Security and production gaps

This is a hackathon prototype, not production payment infrastructure. Before production: add real user authentication/authorization and tenant isolation, PayPal webhook signature verification and reconciliation, rate limiting, request idempotency and replay controls, encrypted evidence storage, SSRF-safe browser execution, audit-log tamper protection, refund/dispute workflows, legal/compliance review, and a managed PostgreSQL database. Never use production PayPal credentials until those controls have been implemented and reviewed.

## Limitations 
a working prototype with a real PayPal Sandbox payment flow-not a fully production-ready escrow platform.

1. AI verification is evidence-based, not a full independent website audit.

Gemini receives the acceptance criteria, evidence URLs, notes and payloads. The current implementation does not independently browse the submitted website or execute its functionality. For stronger verification, connect KERNEL or another testing agent and submit its actual results.

2. Evidence uploads are not file uploads.

The current interface accepts evidence URLs and notes, plus structured evidence through the API. It doesn't implement direct document or screenshot storage.

3. Elastic and Zapier are optional.

They won't affect the core payment workflow if left unconfigured. Their webhook/indexing calls are best-effort.

4. PayPal authorization is not escrow.

The authorization is a temporary hold, subject to PayPal's validity period and funding-source rules. It isn't an escrow account or a guarantee that funds remain available indefinitely.
