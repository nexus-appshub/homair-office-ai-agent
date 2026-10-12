-- Home Air AI Office: initial role, audit, task and business schema.
-- Apply through the Supabase SQL editor or the project's migration runner.
-- No production secrets or real customer data belong in this migration.

create extension if not exists pgcrypto;

do $$ begin
  create type public.office_role as enum (
    'owner','administrator','support_agent','marketing_manager',
    'creative_editor','finance_reviewer','technical_operator','read_only_auditor'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role public.office_role not null default 'read_only_auditor',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_permissions (
  permission_key text primary key,
  description text not null
);

create table if not exists public.office_role_permissions (
  role public.office_role not null,
  permission_key text not null references public.office_permissions(permission_key) on delete cascade,
  primary key (role, permission_key)
);

insert into public.office_permissions(permission_key, description) values
  ('dashboard.read','Read workspace overview'),
  ('support.read','Read support tickets and conversations'),
  ('support.reply','Draft or send approved support responses'),
  ('customers.read','Read customer records'),
  ('customers.update','Update permitted customer profile fields'),
  ('packages.read','Read package catalog'),
  ('packages.manage','Create or modify packages and subscription entitlements'),
  ('orders.read','Read order records'),
  ('payments.read','Read payment records'),
  ('payments.verify','Verify payments against trusted records'),
  ('payments.refund','Initiate an approved refund'),
  ('marketing.read','Read campaigns and content calendar'),
  ('marketing.draft','Create or edit marketing drafts'),
  ('marketing.approve','Approve public-facing content'),
  ('marketing.publish','Publish previously approved content'),
  ('creative.read','Read creative jobs and private assets'),
  ('creative.generate','Request image/video generation'),
  ('tasks.read','Read office tasks'),
  ('tasks.create','Create office tasks'),
  ('tasks.manage','Manage and cancel permitted tasks'),
  ('approvals.read','Read approval queue'),
  ('approvals.approve','Approve or reject eligible actions'),
  ('monitoring.read','Read service health and incidents'),
  ('incidents.manage','Manage technical incidents'),
  ('reports.read','Read reports and scheduled report results'),
  ('integrations.read','Read safe integration status'),
  ('settings.manage','Manage non-secret workspace settings'),
  ('users.manage','Manage user roles and access'),
  ('audit.read','Read the audit trail')
on conflict (permission_key) do nothing;

-- Owner receives every currently registered permission.
insert into public.office_role_permissions(role, permission_key)
select 'owner'::public.office_role, permission_key from public.office_permissions
on conflict do nothing;

-- Administrator can operate the workspace but financial refunds remain finance/owner controlled.
insert into public.office_role_permissions(role, permission_key)
select 'administrator'::public.office_role, permission_key
from public.office_permissions
where permission_key not in ('payments.refund')
on conflict do nothing;

insert into public.office_role_permissions(role, permission_key) values
  ('support_agent','dashboard.read'),
  ('support_agent','support.read'),
  ('support_agent','support.reply'),
  ('support_agent','customers.read'),
  ('support_agent','packages.read'),
  ('support_agent','orders.read'),
  ('support_agent','tasks.read'),
  ('support_agent','tasks.create'),
  ('support_agent','approvals.read'),
  ('support_agent','reports.read'),
  ('marketing_manager','dashboard.read'),
  ('marketing_manager','marketing.read'),
  ('marketing_manager','marketing.draft'),
  ('marketing_manager','marketing.approve'),
  ('marketing_manager','creative.read'),
  ('marketing_manager','creative.generate'),
  ('marketing_manager','tasks.read'),
  ('marketing_manager','tasks.create'),
  ('marketing_manager','approvals.read'),
  ('marketing_manager','reports.read'),
  ('creative_editor','dashboard.read'),
  ('creative_editor','creative.read'),
  ('creative_editor','creative.generate'),
  ('creative_editor','marketing.read'),
  ('creative_editor','marketing.draft'),
  ('creative_editor','tasks.read'),
  ('creative_editor','tasks.create'),
  ('finance_reviewer','dashboard.read'),
  ('finance_reviewer','customers.read'),
  ('finance_reviewer','packages.read'),
  ('finance_reviewer','orders.read'),
  ('finance_reviewer','payments.read'),
  ('finance_reviewer','payments.verify'),
  ('finance_reviewer','payments.refund'),
  ('finance_reviewer','approvals.read'),
  ('finance_reviewer','approvals.approve'),
  ('finance_reviewer','reports.read'),
  ('technical_operator','dashboard.read'),
  ('technical_operator','monitoring.read'),
  ('technical_operator','incidents.manage'),
  ('technical_operator','integrations.read'),
  ('technical_operator','tasks.read'),
  ('technical_operator','tasks.create'),
  ('technical_operator','tasks.manage'),
  ('technical_operator','reports.read'),
  ('read_only_auditor','dashboard.read'),
  ('read_only_auditor','support.read'),
  ('read_only_auditor','customers.read'),
  ('read_only_auditor','packages.read'),
  ('read_only_auditor','orders.read'),
  ('read_only_auditor','payments.read'),
  ('read_only_auditor','marketing.read'),
  ('read_only_auditor','creative.read'),
  ('read_only_auditor','tasks.read'),
  ('read_only_auditor','approvals.read'),
  ('read_only_auditor','monitoring.read'),
  ('read_only_auditor','reports.read'),
  ('read_only_auditor','integrations.read'),
  ('read_only_auditor','audit.read')
on conflict do nothing;

create or replace function public.is_office_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.user_id = auth.uid()
      and p.is_active = true
      and p.role in ('owner'::public.office_role, 'administrator'::public.office_role)
  );
$$;

create or replace function public.has_office_permission(requested_permission text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    join public.office_role_permissions rp on rp.role = p.role
    where p.user_id = auth.uid()
      and p.is_active = true
      and rp.permission_key = requested_permission
  );
$$;

revoke all on function public.is_office_admin() from public, anon;
revoke all on function public.has_office_permission(text) from public, anon;
grant execute on function public.is_office_admin() to authenticated;
grant execute on function public.has_office_permission(text) to authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user','system','agent','integration')),
  event_type text not null,
  resource_type text,
  resource_id text,
  outcome text not null default 'success' check (outcome in ('success','failure','denied','pending')),
  correlation_id text,
  approval_id uuid,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.office_tasks (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null check (length(title) between 1 and 240),
  description text,
  department text not null default 'operations',
  status text not null default 'queued' check (status in ('queued','planning','awaiting_approval','running','succeeded','failed','cancelled','expired')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  requires_approval boolean not null default false,
  idempotency_key text unique,
  result_summary text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.office_tasks(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  approver_user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  resource_type text,
  resource_id text,
  explanation text not null,
  action_payload jsonb not null,
  payload_hash text not null,
  risk_level text not null check (risk_level in ('low','medium','high','critical')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','executing','completed','failed','cancelled')),
  expires_at timestamptz not null,
  decision_at timestamptz,
  execution_result jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  display_name text not null,
  connection_status text not null default 'not_connected' check (connection_status in ('not_connected','connected','degraded','disabled')),
  last_checked_at timestamptz,
  last_error_safe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- Intentionally no credential/token columns. Secrets belong in secret management.
);

create table if not exists public.customer_records (
  id uuid primary key default gen_random_uuid(),
  external_customer_id text unique,
  display_name text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','suspended','closed','unknown')),
  source_system text not null default 'manual-review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_minor_units bigint,
  currency char(3) not null default 'BDT',
  duration_days integer,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_minor_units is null or price_minor_units >= 0),
  check (duration_days is null or duration_days > 0)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_records(id) on delete restrict,
  package_id uuid references public.packages(id) on delete set null,
  external_subscription_id text unique,
  status text not null default 'pending' check (status in ('pending','active','expired','suspended','cancelled','unknown')),
  starts_at timestamptz,
  ends_at timestamptz,
  source_system text not null default 'manual-review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_records(id) on delete restrict,
  external_order_id text unique,
  amount_minor_units bigint not null check (amount_minor_units >= 0),
  currency char(3) not null default 'BDT',
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded','disputed','unknown')),
  source_system text not null default 'manual-review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete restrict,
  external_payment_id text unique,
  provider text,
  payment_reference text,
  amount_minor_units bigint check (amount_minor_units is null or amount_minor_units >= 0),
  currency char(3) not null default 'BDT',
  status text not null default 'unverified' check (status in ('unverified','pending','verified','failed','disputed','refunded')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  source_system text not null default 'manual-review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customer_records(id) on delete set null,
  external_ticket_id text unique,
  channel text not null default 'internal',
  subject text not null,
  body_summary text,
  category text not null default 'general',
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_customer','escalated','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  objective text,
  language text not null default 'bn',
  status text not null default 'draft' check (status in ('draft','in_review','approved','scheduled','publishing','published','failed','cancelled')),
  planned_start_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  platform text not null,
  content_type text not null default 'post',
  caption text not null default '',
  hashtags text[] not null default '{}',
  asset_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','in_review','approved','scheduled','published','rejected','failed')),
  scheduled_at timestamptz,
  external_post_id text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creative_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete set null,
  provider text not null,
  job_type text not null check (job_type in ('image','video','script','storyboard')),
  prompt text not null,
  aspect_ratio text,
  status text not null default 'queued' check (status in ('queued','running','awaiting_configuration','succeeded','failed','cancelled')),
  provider_job_id text,
  error_code text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  creative_job_id uuid references public.creative_jobs(id) on delete set null,
  storage_key text not null unique,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  checksum_sha256 text,
  visibility text not null default 'private' check (visibility in ('private','approved_public')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.service_monitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hostname text not null,
  path text not null default '/',
  is_enabled boolean not null default false,
  interval_seconds integer not null default 300 check (interval_seconds between 60 and 86400),
  timeout_ms integer not null default 8000 check (timeout_ms between 1000 and 30000),
  last_status text not null default 'unknown' check (last_status in ('unknown','healthy','degraded','down')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  -- A worker must validate hostname against an administrator-managed allowlist before fetching.
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid references public.service_monitors(id) on delete set null,
  severity text not null default 'warning' check (severity in ('info','warning','high','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved','ignored')),
  title text not null,
  safe_summary text,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  period_start timestamptz,
  period_end timestamptz,
  generated_at timestamptz,
  safe_summary text,
  error_code text,
  created_at timestamptz not null default now()
);

-- RLS is enabled from the start. Business mutations should be implemented in
-- audited server-side services, not directly from a browser using the service role.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'user_profiles','office_permissions','office_role_permissions','audit_logs',
    'office_tasks','approval_requests','integration_connections','customer_records',
    'packages','subscriptions','orders','payment_records','support_tickets',
    'campaigns','content_drafts','creative_jobs','media_assets','service_monitors',
    'incidents','report_runs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists "profile self or admin read" on public.user_profiles;
create policy "profile self or admin read" on public.user_profiles
for select to authenticated
using (user_id = auth.uid() or public.is_office_admin());

drop policy if exists "admin manages profiles" on public.user_profiles;
-- Intentionally no authenticated INSERT or UPDATE policy for user_profiles.
-- Do not allow a browser session to grant roles or activate accounts. Role changes
-- remain an owner-only SQL-editor operation until an audited admin service exists.

drop policy if exists "admin reads permission catalog" on public.office_permissions;
create policy "admin reads permission catalog" on public.office_permissions
for select to authenticated using (public.is_office_admin());

drop policy if exists "admin reads role permissions" on public.office_role_permissions;
create policy "admin reads role permissions" on public.office_role_permissions
for select to authenticated using (public.is_office_admin());

drop policy if exists "audit read permission" on public.audit_logs;
create policy "audit read permission" on public.audit_logs
for select to authenticated using (public.has_office_permission('audit.read'));

drop policy if exists "tasks read permission" on public.office_tasks;
create policy "tasks read permission" on public.office_tasks
for select to authenticated
using (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or public.has_office_permission('tasks.manage')
  or public.has_office_permission('audit.read')
);

drop policy if exists "tasks create own" on public.office_tasks;
-- Task creation goes through create_planned_task(), which validates permission
-- and writes the task + audit event in one database transaction.

drop policy if exists "tasks manage permission" on public.office_tasks;
create policy "tasks manage permission" on public.office_tasks
for update to authenticated
using (public.has_office_permission('tasks.manage'))
with check (public.has_office_permission('tasks.manage'));

drop policy if exists "approvals read permission" on public.approval_requests;
create policy "approvals read permission" on public.approval_requests
for select to authenticated
using (public.has_office_permission('approvals.read'));

drop policy if exists "integration read permission" on public.integration_connections;
create policy "integration read permission" on public.integration_connections
for select to authenticated
using (public.has_office_permission('integrations.read') or public.has_office_permission('settings.manage'));

drop policy if exists "customers read permission" on public.customer_records;
create policy "customers read permission" on public.customer_records
for select to authenticated using (public.has_office_permission('customers.read'));

drop policy if exists "packages read permission" on public.packages;
create policy "packages read permission" on public.packages
for select to authenticated using (public.has_office_permission('packages.read'));

drop policy if exists "subscriptions read permission" on public.subscriptions;
create policy "subscriptions read permission" on public.subscriptions
for select to authenticated using (public.has_office_permission('customers.read'));

drop policy if exists "orders read permission" on public.orders;
create policy "orders read permission" on public.orders
for select to authenticated using (public.has_office_permission('orders.read'));

drop policy if exists "payments read permission" on public.payment_records;
create policy "payments read permission" on public.payment_records
for select to authenticated using (public.has_office_permission('payments.read'));

drop policy if exists "support tickets read permission" on public.support_tickets;
create policy "support tickets read permission" on public.support_tickets
for select to authenticated using (public.has_office_permission('support.read'));

drop policy if exists "campaigns read permission" on public.campaigns;
create policy "campaigns read permission" on public.campaigns
for select to authenticated using (public.has_office_permission('marketing.read'));

drop policy if exists "content drafts read permission" on public.content_drafts;
create policy "content drafts read permission" on public.content_drafts
for select to authenticated using (public.has_office_permission('marketing.read'));

drop policy if exists "creative jobs read permission" on public.creative_jobs;
create policy "creative jobs read permission" on public.creative_jobs
for select to authenticated using (public.has_office_permission('creative.read'));

drop policy if exists "media assets read permission" on public.media_assets;
create policy "media assets read permission" on public.media_assets
for select to authenticated using (public.has_office_permission('creative.read'));

drop policy if exists "monitors read permission" on public.service_monitors;
create policy "monitors read permission" on public.service_monitors
for select to authenticated using (public.has_office_permission('monitoring.read'));

drop policy if exists "incidents read permission" on public.incidents;
create policy "incidents read permission" on public.incidents
for select to authenticated using (public.has_office_permission('monitoring.read'));

drop policy if exists "reports read permission" on public.report_runs;
create policy "reports read permission" on public.report_runs
for select to authenticated using (public.has_office_permission('reports.read'));

create index if not exists idx_office_tasks_status_created on public.office_tasks(status, created_at desc);
create index if not exists idx_approval_requests_status_expiry on public.approval_requests(status, expires_at);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_support_tickets_status_priority on public.support_tickets(status, priority, created_at desc);
create index if not exists idx_subscriptions_status_ends_at on public.subscriptions(status, ends_at);
create index if not exists idx_orders_customer_created on public.orders(customer_id, created_at desc);
create index if not exists idx_payment_records_status_created on public.payment_records(status, created_at desc);
create index if not exists idx_campaigns_status_schedule on public.campaigns(status, planned_start_at);
create index if not exists idx_content_drafts_status_schedule on public.content_drafts(status, scheduled_at);

-- updated_at timestamps should be assigned explicitly by server services or a future trigger.


-- Create a planning record and its audit event in one transaction. This RPC
-- does not execute downstream actions; it only persists a validated AI plan.
create or replace function public.create_planned_task(
  p_title text,
  p_description text,
  p_department text,
  p_priority text,
  p_requires_approval boolean,
  p_result jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.office_tasks%rowtype;
  v_reused boolean := false;
  v_requires_approval boolean;
  v_priority text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not public.has_office_permission('tasks.create') then
    raise exception using errcode = '42501', message = 'Task creation permission required';
  end if;

  if p_title is null or length(trim(p_title)) < 1 or length(p_title) > 160 then
    raise exception using errcode = '22023', message = 'Invalid task title';
  end if;
  if p_description is null or length(p_description) > 3000 then
    raise exception using errcode = '22023', message = 'Invalid task description';
  end if;
  if p_department not in ('support','marketing','creative','customers','finance','technical','operations') then
    raise exception using errcode = '22023', message = 'Invalid department';
  end if;
  if p_priority not in ('low','medium','high','critical') then
    raise exception using errcode = '22023', message = 'Invalid task priority';
  end if;
  if jsonb_typeof(p_result) <> 'object' or pg_column_size(p_result) > 16000 then
    raise exception using errcode = '22023', message = 'Invalid task result';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using errcode = '22023', message = 'Invalid idempotency key';
  end if;

  -- Enforce approval flags in the database as well as the route. The AI cannot
  -- suppress approval by returning a low-risk classification for sensitive work.
  v_requires_approval :=
    coalesce(p_requires_approval, false)
    or lower(coalesce(p_result->>'requiresApproval', 'false')) = 'true'
    or coalesce(p_result->>'riskLevel', 'low') <> 'low'
    or p_description ~* '\m(publish|post|send|refund|payment|financial|package|subscription|suspend|restore|delete|deploy|production|customer data|bulk|spend|campaign launch|social media|change settings)\M';

  v_priority := case
    when coalesce(p_result->>'riskLevel', 'low') = 'critical' then 'critical'
    when coalesce(p_result->>'riskLevel', 'low') = 'high'
      or p_description ~* '\m(publish|post|send|refund|payment|financial|package|subscription|suspend|restore|delete|deploy|production|customer data|bulk|spend|campaign launch|social media|change settings)\M'
      then 'high'
    else p_priority
  end;

  insert into public.office_tasks (
    created_by, title, description, department, status, priority,
    requires_approval, idempotency_key, result_summary
  ) values (
    auth.uid(), trim(p_title), p_description, p_department, 'succeeded', v_priority,
    v_requires_approval, p_idempotency_key, p_result::text
  )
  on conflict (idempotency_key) do nothing
  returning * into v_task;

  if not found then
    select * into v_task
    from public.office_tasks t
    where t.idempotency_key = p_idempotency_key
      and t.created_by = auth.uid();

    if v_task.id is null then
      raise exception using errcode = '42501', message = 'Idempotency key belongs to another task';
    end if;

    v_reused := true;
  else
    insert into public.audit_logs (
      actor_user_id, actor_type, event_type, resource_type, resource_id,
      outcome, correlation_id, safe_metadata
    ) values (
      auth.uid(), 'user', 'task.plan.saved', 'office_task', v_task.id::text,
      'success', p_idempotency_key,
      jsonb_build_object(
        'title', left(v_task.title, 120),
        'department', v_task.department,
        'priority', v_task.priority,
        'requires_approval', v_task.requires_approval,
        'status', v_task.status
      )
    );
  end if;

  return jsonb_build_object(
    'task', jsonb_build_object(
      'id', v_task.id,
      'title', v_task.title,
      'department', v_task.department,
      'status', v_task.status,
      'priority', v_task.priority,
      'requires_approval', v_task.requires_approval,
      'created_at', v_task.created_at
    ),
    'plan', coalesce(v_task.result_summary::jsonb, '{}'::jsonb),
    'reused', v_reused,
    'note', 'Plan generated and saved. No external action was executed.'
  );
end;
$$;

revoke all on function public.create_planned_task(text,text,text,text,boolean,jsonb,text) from public, anon;
grant execute on function public.create_planned_task(text,text,text,text,boolean,jsonb,text) to authenticated;


-- Persistent per-user AI budget guard: max 10 plans per hour. The quota is
-- consumed atomically before the model is called and cannot be reset by a process restart.
create table if not exists public.ai_usage_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, operation, window_start)
);
alter table public.ai_usage_windows enable row level security;
-- No direct client read/write policy; only the quota RPC may mutate the table.

create or replace function public.consume_ai_plan_quota()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not public.has_office_permission('tasks.create') then
    raise exception using errcode = '42501', message = 'Task creation permission required';
  end if;

  insert into public.ai_usage_windows(user_id, operation, window_start, request_count)
  values (v_user_id, 'ai.plan', v_window, 1)
  on conflict (user_id, operation, window_start)
  do update set request_count = public.ai_usage_windows.request_count + 1
    where public.ai_usage_windows.request_count < 10
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_ai_plan_quota() from public, anon;
grant execute on function public.consume_ai_plan_quota() to authenticated;
