# Home Air AI Office implementation plan

## Current repository status

The repository was initially empty. The first foundation adds a responsive setup dashboard, safety conventions, a public liveness endpoint, an environment template, and setup documentation. It is **not production-ready** and does not yet perform authenticated business operations.

## Phase 1 — Secure foundation

- [ ] Select and create the authoritative PostgreSQL/Supabase project.
- [ ] Implement email/password admin sign-in and cookie-based server-side session verification.
- [ ] Create profiles, roles, permissions, and RLS policies; deny access by default.
- [ ] Add an audited first-owner bootstrap procedure without a hardcoded password.
- [ ] Add database migrations and seed scripts.
- [ ] Protect private pages and every mutation endpoint server-side.
- [ ] Add automated tests for login, authorization, audit logging, and approval policy.

## Phase 2 — AI core and approvals

- [ ] Use the official `@google/genai` server SDK.
- [ ] Implement a typed tool registry and allowlist; no arbitrary SQL, shell, or unrestricted URL fetches.
- [ ] Persist tasks, task steps, approvals, and results.
- [ ] Bind approvals to exact action payloads; reject stale, expired, modified, and replayed actions.
- [ ] Track model usage, timeouts, retries, and sanitized errors.

## Phase 3 — Customer support and operations

- [ ] Ticketing, FAQ knowledge base, Bengali/English drafts, escalation.
- [ ] Telegram webhook authenticity validation, deduplication and rate limiting.
- [ ] Connect a verified customer/package database and map its schema.
- [ ] Payment verification using provider records; manual review when unavailable.
- [ ] Role-protected package, subscription, order, and payment workflows.

## Phase 4 — Marketing and creative studio

- [ ] Campaigns, calendar, bilingual copy, draft revisions, approval and publishing queue.
- [ ] Official social provider integration where the account and permissions are eligible.
- [ ] Image/video provider adapters, private object storage and asset ownership.
- [ ] Verify publication results with provider responses; never report assumed success.

## Phase 5 — Monitoring and office automation

- [ ] Monitor only admin-allowlisted Home Air health endpoints.
- [ ] Durable queue/worker, retries with backoff, idempotency, and dead-letter review.
- [ ] Incident alerting, daily/weekly reports, notifications, and Asia/Dhaka schedule support.
- [ ] Backup/restore exercises and incident-response procedure.

## Phase 6 — Release readiness

- [ ] Unit/integration/browser tests and strict typecheck.
- [ ] Dependency audit and current framework security patch verification.
- [ ] Production headers/CSP review, secret rotation, RLS review, rate limits and upload controls.
- [ ] Deployment, worker, migration, backup and rollback instructions.
- [ ] Deploy and smoke-test only after owner credentials and target hosting are configured.

## Must remain disabled until configured and tested

- Public registration and privileged account creation.
- Customer, package, order, payment and subscription mutations.
- Social publishing and bulk messaging.
- Production code changes and deployment.
- Arbitrary outbound URL fetching or AI-triggered shell/SQL.
