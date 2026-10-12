# Home Air AI Office — Integration Intake

This checklist identifies the exact decisions and configuration needed to turn the setup-stage scaffold into an operational workspace. Do not send secrets in GitHub issues, repository files, screenshots, prompts, or chat. Add secret values directly to the selected hosting platform's encrypted environment settings.

## Immediate prerequisites

### 1. Supabase authentication and PostgreSQL

- [ ] Create/select the authoritative Supabase project.
- [ ] Apply the migrations in `supabase/migrations/` in order.
- [ ] Disable public sign-up; invite/create only intended staff accounts.
- [ ] Create the first owner profile using the trusted SQL Editor procedure in `README.md`.
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to local/deployment environment settings.
- [ ] Verify owner sign-in, an inactive-user denial, and role-specific RLS behavior.

No service-role key is currently required by the dashboard session or aggregate-metrics endpoints. Keep `SUPABASE_SERVICE_ROLE_KEY` unset unless a reviewed server-only feature establishes a real need.

### 2. Gemini AI planner

- [ ] Create an API key in Google AI Studio.
- [ ] Set `GEMINI_API_KEY` in the server-side environment; do not prefix it with `NEXT_PUBLIC_`.
- [ ] Keep `GEMINI_MODEL=gemini-3.8-flash` unless the account or current provider documentation requires a change.
- [ ] Verify the plan-only endpoint and check usage limits before enabling other AI features.

The current AI endpoint generates and stores a plan only. It does not execute external actions.

## Existing Home Air TV system discovered during repository review

The existing `nexus-appshub/x-space-xubitv` repository appears to use Firebase Realtime Database, Firestore, and a Railway backend. The code contains VIP configuration and VIP-order workflows, including route handlers for VIP status/config/order lookup and an order-approval operation.

This is a candidate integration, not yet an approved or security-verified API contract. Before using it:
- Review the route-level authentication and authorization for each endpoint.
- Confirm whether order/customer data is read from durable storage or an in-memory collection.
- Verify endpoint response schemas, error behavior, and user/administrator identity checks.
- Create a restricted server-to-server integration credential or signed authentication mechanism if the existing backend supports one; do not rely on caller-supplied email alone.
- Start with read-only lookups. Do not enable VIP grants/extensions/suspensions or payment approval until exact-action approval, permissions, idempotency, and audit logging are implemented and tested.

**Latest requested target architecture: Supabase becomes the future system of record for customer, package, subscription, order, and payment data.** This is a migration target, not permission to change production records now.

Until the owner approves a cutover:
- The existing Home Air TV Firebase/Firestore/Railway system remains the current production source of truth.
- Do not connect AI Office to privileged Home Air TV endpoints until its JWT signature-validation fallback and hard-coded authentication fallbacks have been fixed, rotated, and reviewed.
- Do not import, mirror, update, or delete production business records yet.
- Supabase remains the active store for office staff login, roles, tasks, approvals, campaign drafts, integration health, and office audit events.

The eventual migration must be staged and reversible: inventory/schema mapping, encrypted backup and baseline counts, dry-run import into an isolated staging project, deterministic external-ID mapping, duplicate detection, record-level reconciliation, role/RLS verification, owner sign-off, maintenance-window cutover, rollback checkpoint, and post-cutover reconciliation. Keep source provenance and original external IDs. Do not dual-write both systems during migration. The owner must approve the migration plan and reconciliation results before production cutover.

## Customer, package, subscription, order, and payment source

Before these workflows are implemented, identify the single authoritative data source.

Provide non-secret information:
- System/repository or service name and owner.
- API base URL or repository link.
- API documentation/OpenAPI specification or example endpoint definitions.
- Redacted example responses for customer lookup, package list, subscription status, order lookup, and payment verification.
- Supported operations and which operations are read-only versus write-enabled.
- Authentication type (for example, bearer token, OAuth, signed request, or service-specific mechanism).
- Rate limits, pagination, webhook support, idempotency support, and error response conventions.

Put credentials only in the target backend's encrypted secret settings. Initially implement read-only lookup and verification; keep package changes, entitlements, refunds, and payment state changes disabled until their approval and audit workflow is tested.

If this data is in the Home Air TV backend, provide that repository URL and the relevant API route documentation. Do not provide production database passwords or dump real customer records.

## Telegram customer support

- [ ] Create/select the official Home Air support bot in Telegram.
- [ ] Decide whether it serves private chats, a support group, or both.
- [ ] Define escalation rules and which questions may receive automatic FAQ responses.
- [ ] Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in encrypted server environment settings only after webhook signature/secret validation, deduplication, and rate limiting are implemented.
- [ ] Supply the bot username and non-secret support workflow requirements.

Do not share the bot token in chat or commit it.

## Social publishing and analytics

List the social platforms and official Home Air accounts that need support (for example, Facebook Page, Instagram professional account, YouTube channel, or TikTok account).

For each platform, confirm:
- Account/page/channel identity.
- Whether you control the account and can authorize an official integration.
- Whether draft-only export is enough for the first release or API-based scheduling is required.
- Which team member may approve public posts.

Do not supply social account passwords. Use OAuth or the platform's official permissions, and configure resulting tokens as encrypted secrets. Posts must remain draft-only until provider eligibility and approval logic are verified.

## Creative media generation and storage

- [ ] Choose an image-generation provider.
- [ ] Choose a video-generation provider, if automatic video rendering is required.
- [ ] Select private storage for generated assets (Supabase Storage or another supported object store).
- [ ] Confirm retention rules and maximum asset sizes.

Without a configured provider, the application should create prompts/scripts and mark media rendering as awaiting configuration, never as completed.

## Hosting and domain

- [ ] Confirm the target hosting platform (for example, Vercel, Railway, Render, or another Node.js host).
- [ ] Confirm the production application URL/domain.
- [ ] Confirm whether the host supports long-running background workers and a durable queue.
- [ ] Set the app URL and Supabase Auth redirect/site URLs to match the deployed domain.
- [ ] Keep production migrations, environment settings, and deployment actions owner-controlled.

Background workers and scheduled tasks must not rely on an in-memory timer inside a serverless web request.

## Monitoring allowlist

Provide only Home Air services you own or are explicitly authorized to monitor:
- Service display name.
- Health-check URL/path.
- Expected response and desired check interval.
- Alert destination.

Only the hostname/path explicitly approved for monitoring should be probed. Do not configure arbitrary AI-supplied URLs.

## Credentials checklist (values must stay in hosting secrets)

| Variable | Needed for | Current use |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Session and data access |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase | Browser-safe project key; RLS is still required |
| `GEMINI_API_KEY` | Gemini | Existing AI plan-only endpoint |
| `TELEGRAM_BOT_TOKEN` | Telegram | Later support integration |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram | Later webhook validation |
| `REDIS_URL` | Queue provider | Only after a durable worker is implemented |
| `OBJECT_STORAGE_*` | Private media storage | Only after the asset provider is implemented |

Do not configure the Supabase service-role key unless a specific, reviewed server-only operation requires it. Never return secret values to the browser.

## Integration acceptance criteria

An integration is considered connected only after a real provider check succeeds. The application should distinguish:
- Not configured.
- Configured but not verified.
- Connected and verified.
- Degraded/unavailable.
- Disabled.

Before enabling any consequential action, verify authentication, server-side RBAC, approval tied to the exact action payload, idempotent execution, audit logging, failure handling, and tests.
