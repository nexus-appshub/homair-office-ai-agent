# Security posture and release checklist

This initial scaffold is setup-only. The dashboard is not an authenticated admin system yet. Do not deploy it as a live customer/payment management system until authentication and server-side RBAC are implemented and tested.

## Secret handling

- Copy `.env.example` to `.env.local` locally.
- Store production secrets in your hosting provider's encrypted environment settings or a managed secret store.
- Never paste secrets into GitHub files, issues, chat, prompts, screenshots, or browser code.
- Keep the Supabase service-role key server-only. Prefer publishable keys for browser auth; enable and test row-level security.
- Rotate a secret immediately if it has been committed or exposed.

## Production gates

- [ ] Authenticated owner bootstrap and MFA for privileged users.
- [ ] Deny-by-default RBAC checks on every server route and job.
- [ ] Database RLS policies tested with multiple roles.
- [ ] Exact-action approval checks on sensitive operations.
- [ ] CSRF, rate limits, security headers and content security policy reviewed.
- [ ] Webhook authenticity checks and replay protection.
- [ ] Outbound requests restricted to an explicit hostname allowlist.
- [ ] Private media ownership checks and upload size/MIME validation.
- [ ] Secrets and personal data redacted from logs and AI context.
- [ ] Backups and restore procedure verified.
- [ ] Dependency and framework security advisories checked immediately before deployment.
- [ ] Security and access-control tests pass.

## Public liveness endpoint

`GET /api/health` intentionally returns only service name, a generic liveness status and a timestamp. Do not expand it to reveal secrets, environment variable values, stack traces, database hosts or internal service topology.
