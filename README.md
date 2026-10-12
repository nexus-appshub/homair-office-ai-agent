# Home Air AI Office

A security-first foundation for Home Air's AI-powered business operations dashboard.

> **Current state:** setup-mode scaffold. The responsive dashboard, private sign-in UI, Supabase session gate, initial RLS/schema migration, and liveness endpoint are in place. AI execution, Telegram replies, social publishing, customer/payment mutations, media generation, and scheduled jobs are **not yet enabled**. Do not treat this scaffold as a finished production admin system.

## Modules in scope

- AI command center and specialist-agent orchestration
- Customer support, FAQ, ticketing, and escalation
- Marketing, content calendar, and approval-gated social publishing
- Creative production for posters, banners, thumbnails, and reels
- Customers, packages, subscriptions, orders, and payment verification
- Technical monitoring, incidents, daily reports, and reminders
- Integrations, user administration, RBAC, and audit logs

See [implementation plan](docs/IMPLEMENTATION_PLAN.md), [security posture](docs/SECURITY.md), and [deployment guide](docs/DEPLOYMENT.md).

## Local development

Requirements: Node.js 22 or later and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without Supabase configuration, development shows a setup preview and does not enable AI or business mutations.

Validation commands:

```bash
npm run typecheck
npm run lint
npm run build
```

The repository CI workflow runs these checks on pushes and pull requests.

## Supabase setup (required for authenticated access)

1. Create a Supabase project.
2. In Supabase Authentication, disable public sign-up and manually invite/create only the intended owner and staff accounts.
3. Open the SQL Editor and run `supabase/migrations/202610120001_initial_office_schema.sql`.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to local/hosting environment settings. The publishable key is designed for client use; access must still be controlled by Auth and RLS.
5. Create the first owner profile for an already-created Auth user using the SQL Editor. Replace the email literal with the exact owner account email:

```sql
insert into public.user_profiles (user_id, email, display_name, role, is_active)
select id, email, 'Home Air Owner', 'owner', true
from auth.users
where lower(email) = lower('YOUR_OWNER_EMAIL')
on conflict (user_id) do update
set role = 'owner', is_active = true, updated_at = now();
```

Run that statement only as the project owner in the trusted Supabase SQL Editor. Do not create a public endpoint that allows users to assign themselves the owner role.

6. Set the same public Supabase variables in your local `.env.local` and deployment environment, restart/redeploy, then test login and authorization.

The production proxy redirects to `/setup-required` if Supabase configuration or the role table is unavailable. An authenticated user without an active profile is redirected to `/no-access`. The `/api/health` endpoint only reports basic liveness.

## Credentials and secrets

Never commit or paste API keys, service-role keys, Telegram bot tokens, passwords, payment credentials, or database connection strings into source files or chat. Add secrets through the relevant hosting environment's encrypted secret settings.

Required later for the full product:
- `GEMINI_API_KEY`: server-side AI planning/content generation.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`: support bot; keep optional until webhook validation is implemented and tested.
- A trusted Home Air customer/package/payment data source and documentation of its read/write APIs.
- Social account/provider permissions for any required publishing integration.
- Private asset storage and an actual image/video generation provider.
- A durable queue/worker provider if scheduled tasks are enabled.

The `SUPABASE_SERVICE_ROLE_KEY` variable is included only as a future server-only integration placeholder. Do not set or use it in browser code. Keep it unset unless a reviewed server-only service explicitly requires it.

## Safety rules

- Important actions require explicit human approval.
- Payment verification must rely on trusted provider records, not screenshots alone.
- Do not publish social content or send bulk customer messages until a human has approved the exact content and target.
- Do not execute arbitrary model-generated SQL, shell commands, or unrestricted URL requests.
- Monitor only service hostnames explicitly authorized by the owner.
- Do not claim integrations, test suites, or deployment are working until they have been verified.

## Version and security upkeep

Before production deployment, install current patched dependencies, inspect upstream security advisories, regenerate and commit a lockfile, and verify the CI build. Do not rely on a broad dependency range alone as a substitute for an audited lockfile.
