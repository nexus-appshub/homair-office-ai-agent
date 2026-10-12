# Deployment guide

## Status

This is a deployment guide for the current setup-mode foundation, not a claim that the service is deployed or ready to process production business data.

## Recommended shape

- Node.js web service running the Next.js application.
- Supabase managed PostgreSQL and Auth.
- Later: isolated background worker and durable queue for scheduled tasks and long-running media jobs.
- Later: private object storage for media assets.
- Provider tokens stored only in hosting secrets or a managed secret vault.

## Deploying the current scaffold

1. Connect `nexus-appshub/homair-office-ai-agent` to a Node.js hosting platform that supports the chosen Next.js release.
2. Use Node.js 22 or later.
3. Install with `npm install`; commit the generated lockfile after validating it locally/through CI.
4. Configure at minimum `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Run the SQL migration and create the first owner profile before exposing authenticated routes.
6. Configure the production application URL and Supabase Auth redirect/site URL settings.
7. Run `npm run typecheck`, `npm run lint`, and `npm run build`.
8. Deploy and smoke test login, inactive-profile denial, permission checks, headers, and `GET /api/health`.
9. Keep AI integrations and all mutation endpoints disabled until their backend implementations and tests exist.

## Environment variables

| Variable | Purpose | Current status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project endpoint | Required for authentication |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key | Required for authentication |
| `GEMINI_API_KEY` | AI task planning and generation | Required for Phase 2 |
| `TELEGRAM_BOT_TOKEN` | Telegram support bot | Optional until support integration is implemented |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook validation | Optional until webhook is configured |
| `SUPABASE_SERVICE_ROLE_KEY` | Future server-only maintenance integrations | Do not configure until explicitly required |
| `REDIS_URL` | Durable background job queue | Required only if BullMQ/Redis is selected |
| `OBJECT_STORAGE_*` | Private creative asset storage | Required for persistent media generation |
| `APPLICATION_BASE_URL` | Absolute callbacks and link generation | Set to production URL when needed |

Use hosting dashboard secrets for confidential values. Do not expose server-only values via `NEXT_PUBLIC_*`.

## Production security gates

- Disable public Auth sign-up and manually provision workspace users.
- Review role permissions and RLS policies with test users for every role.
- Set up MFA for privileged accounts where supported.
- Verify backup and restore before importing customer/payment records.
- Confirm security headers and deploy a compatible Content Security Policy.
- Set platform request/body size limits, rate limits and alerting.
- Configure a lockfile and check all direct and transitive package advisories.
- Recheck current Next.js, React, Supabase SDK, and dependency advisories immediately before deploying.
- Deploy background workers separately; do not rely on an in-process timer for scheduled jobs.
- Do not expose any customer/payment mutation endpoint without authorization, validation, approval, and audit logging.

## Rollback

Keep the previous verified deployment available. For database changes, use forward-compatible migrations and test rollback or restoration in a non-production environment. Do not delete or rewrite production data during a rollback.
