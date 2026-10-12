-- Home Air AI Office phase 2: durable task review and approval decisions.
-- Safe to apply after 202610120001_initial_office_schema.sql.
-- This migration never executes external actions or writes Home Air TV business data.

alter table public.approval_requests
  add column if not exists decision_note text;

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
  v_risk_level text;
  v_approval_id uuid;
  v_payload jsonb;
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

  -- The database independently enforces the review flag; AI output cannot
  -- downgrade sensitive work to an unreviewed action.
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

  v_risk_level := case
    when coalesce(p_result->>'riskLevel', 'low') in ('low','medium','high','critical')
      then p_result->>'riskLevel'
    when p_description ~* '\m(publish|post|send|refund|payment|financial|package|subscription|suspend|restore|delete|deploy|production|customer data|bulk|spend|campaign launch|social media|change settings)\M'
      then 'high'
    else 'medium'
  end;
  if v_requires_approval and v_risk_level = 'low' then
    v_risk_level := 'medium';
  end if;

  insert into public.office_tasks (
    created_by, title, description, department, status, priority,
    requires_approval, idempotency_key, result_summary
  ) values (
    auth.uid(), trim(p_title), p_description, p_department,
    case when v_requires_approval then 'awaiting_approval' else 'succeeded' end,
    v_priority, v_requires_approval, p_idempotency_key, p_result::text
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
    select a.id into v_approval_id
    from public.approval_requests a
    where a.task_id = v_task.id and a.status in ('pending','approved','rejected','expired')
    order by a.created_at desc
    limit 1;
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

    if v_requires_approval then
      v_payload := jsonb_build_object(
        'mode', 'manual_review_only',
        'task_id', v_task.id,
        'title', v_task.title,
        'department', v_task.department,
        'plan', p_result,
        'execution_note', 'Approval records review only. No external action is executed by this workflow.'
      );

      insert into public.approval_requests (
        task_id, requester_user_id, action_type, resource_type, resource_id,
        explanation, action_payload, payload_hash, risk_level, status, expires_at
      ) values (
        v_task.id, auth.uid(), 'task.plan.review', 'office_task', v_task.id::text,
        'Review this proposed plan before any separate implementation or external action.',
        v_payload, encode(digest(v_payload::text, 'sha256'), 'hex'),
        v_risk_level, 'pending', now() + interval '24 hours'
      )
      returning id into v_approval_id;

      insert into public.audit_logs (
        actor_user_id, actor_type, event_type, resource_type, resource_id,
        outcome, correlation_id, approval_id, safe_metadata
      ) values (
        auth.uid(), 'user', 'approval.requested', 'approval_request', v_approval_id::text,
        'pending', p_idempotency_key, v_approval_id,
        jsonb_build_object(
          'task_id', v_task.id,
          'action_type', 'task.plan.review',
          'risk_level', v_risk_level,
          'expires_at', now() + interval '24 hours',
          'execution_enabled', false
        )
      );
    end if;
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
    'approval_id', v_approval_id,
    'plan', coalesce(v_task.result_summary::jsonb, '{}'::jsonb),
    'reused', v_reused,
    'note', case
      when v_requires_approval then 'Plan saved for human review. Approval does not execute an external action.'
      else 'Plan generated and saved. No external action was executed.'
    end
  );
end;
$$;

revoke all on function public.create_planned_task(text,text,text,text,boolean,jsonb,text) from public, anon;
grant execute on function public.create_planned_task(text,text,text,text,boolean,jsonb,text) to authenticated;

create or replace function public.decide_office_approval(
  p_approval_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approval public.approval_requests%rowtype;
  v_task public.office_tasks%rowtype;
  v_note text := left(trim(coalesce(p_note, '')), 1000);
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not public.has_office_permission('approvals.approve') then
    raise exception using errcode = '42501', message = 'Approval permission required';
  end if;
  if p_decision not in ('approve','reject') then
    raise exception using errcode = '22023', message = 'Decision must be approve or reject';
  end if;

  select * into v_approval
  from public.approval_requests
  where id = p_approval_id
  for update;

  if v_approval.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Approval request not found');
  end if;
  if v_approval.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'not_pending', 'message', 'Approval request is no longer pending');
  end if;
  if encode(digest(v_approval.action_payload::text, 'sha256'), 'hex') <> v_approval.payload_hash then
    update public.approval_requests
      set status = 'failed', decision_at = now(), approver_user_id = auth.uid(),
          decision_note = 'Payload integrity check failed'
      where id = p_approval_id;
    insert into public.audit_logs (
      actor_user_id, actor_type, event_type, resource_type, resource_id,
      outcome, approval_id, safe_metadata
    ) values (
      auth.uid(), 'user', 'approval.payload_integrity_failed', 'approval_request', p_approval_id::text,
      'failure', p_approval_id,
      jsonb_build_object('reason', 'payload_hash_mismatch')
    );
    return jsonb_build_object('ok', false, 'code', 'payload_mismatch', 'message', 'Approval payload integrity check failed');
  end if;
  if v_approval.expires_at <= now() then
    update public.approval_requests
      set status = 'expired', decision_at = now(), approver_user_id = auth.uid(),
          decision_note = nullif(v_note, '')
      where id = p_approval_id;
    insert into public.audit_logs (
      actor_user_id, actor_type, event_type, resource_type, resource_id,
      outcome, approval_id, safe_metadata
    ) values (
      auth.uid(), 'user', 'approval.expired', 'approval_request', p_approval_id::text,
      'failure', p_approval_id,
      jsonb_build_object('reason', 'expired_before_decision')
    );
    return jsonb_build_object('ok', false, 'code', 'expired', 'message', 'Approval request has expired');
  end if;
  if v_approval.requester_user_id = auth.uid() and v_approval.risk_level in ('high','critical') then
    raise exception using errcode = '42501', message = 'High-risk and critical requests require a different approver';
  end if;

  update public.approval_requests
    set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
        approver_user_id = auth.uid(),
        decision_at = now(),
        decision_note = nullif(v_note, '')
    where id = p_approval_id
    returning * into v_approval;

  if v_approval.task_id is not null then
    select * into v_task from public.office_tasks where id = v_approval.task_id for update;
    if found and p_decision = 'reject' then
      update public.office_tasks
        set status = 'cancelled', updated_at = now()
        where id = v_task.id and status = 'awaiting_approval';
    elsif found and p_decision = 'approve' then
      -- This marks review complete only. It does not start a worker or execute
      -- the proposed plan; a separately reviewed executor would be required.
      update public.office_tasks
        set status = 'queued', updated_at = now()
        where id = v_task.id and status = 'awaiting_approval';
    end if;
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_type, event_type, resource_type, resource_id,
    outcome, approval_id, safe_metadata
  ) values (
    auth.uid(), 'user',
    case when p_decision = 'approve' then 'approval.approved' else 'approval.rejected' end,
    'approval_request', p_approval_id::text,
    'success', p_approval_id,
    jsonb_build_object(
      'task_id', v_approval.task_id,
      'action_type', v_approval.action_type,
      'risk_level', v_approval.risk_level,
      'decision', p_decision,
      'note', nullif(v_note, ''),
      'execution_enabled', false
    )
  );

  return jsonb_build_object(
    'ok', true,
    'approval_id', v_approval.id,
    'status', v_approval.status,
    'task_id', v_approval.task_id,
    'execution_enabled', false,
    'message', 'Decision recorded. No external action was executed.'
  );
end;
$$;

revoke all on function public.decide_office_approval(uuid,text,text) from public, anon;
grant execute on function public.decide_office_approval(uuid,text,text) to authenticated;
