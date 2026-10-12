# Home Air AI Office implementation plan

## Current repository status

The repository was initially empty. The first foundation adds a responsive setup dashboard, safety conventions, a public liveness endpoint, an environment template, and setup documentation. It is **not production-ready** and does not yet perform authenticated business operations.

## Foundation endpoints and dashboard state

The foundation now includes:
- `GET /api/session`: returns the signed-in user's safe identity and role after the server-side `dashboard.read` permission check.
- `GET /api/dashboard/summary`: returns aggregate counts for support tickets, customer records, pending approvals, and scheduled campaigns using the signed-in user's Supabase session and RLS policies. Restricted/unavailable metrics are represented as unavailable, not as zero.
- `POST /api/auth/signout`: ends the current Supabase session.
- Dashboard wiring for the authenticated identity and aggregate metrics when the database and policies are available.

These are foundation capabilities, not evidence that a real Supabase project has been connected or that production authorization has been security-tested. The task/approval phase adds `GET /api/tasks`, `GET /api/approvals`, and `POST /api/approvals/{approvalId}/decision`, plus migration `202610120002_task_approval_workflows.sql`. Review decisions are permission-checked, expiry-aware, audited, and never execute an external action. Customer business records, social publishing, Telegram replies, media rendering, and scheduled execution remain disabled until their separate workflows are built and verified. See [integration intake](INTEGRATION_INTAKE.md) for required owner inputs.

## Phase 1 — Secure foundation

- [ ] Select and create the authoritative PostgreSQL/Supabase project.
- [ ] Implement email/password admin sign-in and cookie-based server-side session verification.
- [ ] Create profiles, roles, permissions, and RLS policies; deny access by default.
- [ ] Add an audited first-owner bootstrap procedure without a hardcoded password.
- [ ] Add database migrations and seed scripts.
- [ ] Protect private pages and every mutation endpoint server-side.
- [ ] Add automated tests for login, authorization, audit logging, and approval policy.

## Phase 2 — AI core and approvals

- [x] Use the official `@google/genai` server SDK for planning only.
- [ ] Implement a typed tool registry and allowlist; no arbitrary SQL, shell, or unrestricted URL fetches.
- [x] Persist task plans, approval requests, decisions, and audit results.
- [x] Bind review requests to a SHA-256 hash of the stored review payload and reject stale/expired/non-pending decisions.
- [ ] Add tests proving modified/replayed payloads cannot be executed; no executor exists yet.
- [ ] Track model usage, timeouts, retries, and sanitized errors.

**Boundary:** the current approval endpoint records a human decision only. It cannot publish, send messages, change business records, issue refunds, or deploy code.

## Phase 3 — Customer support and operations

- [ ] Ticketing, FAQ knowledge base, Bengali/English drafts, escalation.
- [ ] Telegram webhook authenticity validation, deduplication and rate limiting.
- [ ] Treat Supabase as the future business system of record only after the owner approves a staged migration.
- [ ] Inventory Firebase/Firestore/Railway schemas; map external IDs and field semantics without changing production.
- [ ] Back up and record baseline counts, then dry-run an import into isolated staging; reconcile duplicates, statuses, timestamps, amounts, and relationships.
- [ ] Verify RLS/role behavior with representative roles and run record-level reconciliation before requesting cutover approval.
- [ ] Fix and independently review existing Home Air TV backend JWT signature validation and hard-coded fallback credentials before any privileged source connection.
- [ ] Owner-approved maintenance-window cutover with rollback checkpoint, no dual-writes, and post-cutover reconciliation.
- [ ] Payment verification using trusted provider records; manual review when unavailable.
- [ ] Role-protected package, subscription, order, and payment workflows only after the cutover is verified.

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
