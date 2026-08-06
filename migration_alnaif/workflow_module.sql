-- ============================================================
-- وحدة سير العمل والموافقات (Approval Workflows) — من غروب النايف
-- ============================================================
create table if not exists workflow_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  template_key text not null,        -- 'WF-PURCHASE', 'WF-LEAVE', إلخ
  name text not null,
  created_at timestamptz default now(),
  unique(company_id, template_key)
);
alter table workflow_templates enable row level security;
create policy "wft_select" on workflow_templates for select using (is_company_member(company_id));
create policy "wft_insert" on workflow_templates for insert with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_template_id uuid not null references workflow_templates(id) on delete cascade,
  step_order int not null,
  step_name text not null,
  approver_role text not null,        -- 'manager' / 'cfo' / 'ceo' / 'requester' / 'employee'
  sla_days int default 1,
  amount_threshold numeric,           -- الحد الأدنى للمبلغ اللي يستوجب هذه الخطوة (null = دايمًا مطلوبة)
  unique(workflow_template_id, step_order)
);
alter table workflow_steps enable row level security;
create policy "wfs_select" on workflow_steps for select using (
  exists (select 1 from workflow_templates wt where wt.id = workflow_template_id and is_company_member(wt.company_id))
);

-- طلبات الموافقة الفعلية (أي نوع: أمر شراء، إجازة، إلخ)
create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  workflow_template_id uuid not null references workflow_templates(id),
  reference_type text not null,       -- 'purchase_order' / 'leave_request' / إلخ
  reference_id uuid,
  amount numeric,
  requested_by uuid,
  current_step_order int not null default 1,
  status text default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz default now()
);
alter table approval_requests enable row level security;
create policy "ar_select" on approval_requests for select using (is_company_member(company_id));
create policy "ar_insert" on approval_requests for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "ar_update" on approval_requests for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists approval_actions (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references approval_requests(id) on delete cascade,
  step_order int not null,
  actor_user_id uuid,
  action text not null check (action in ('approved','rejected')),
  notes text,
  created_at timestamptz default now()
);
alter table approval_actions enable row level security;
create policy "aa_select" on approval_actions for select using (
  exists (select 1 from approval_requests r where r.id = approval_request_id and is_company_member(r.company_id))
);

-- تأسيس قالبي الموافقة الافتراضيين (أمر شراء + إجازة) بنفس عتبات المبالغ الأصلية
create or replace function public.seed_default_workflow_templates(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_wf_id uuid;
begin
  insert into workflow_templates (company_id, template_key, name) values (p_company_id, 'WF-PURCHASE', 'اعتماد أمر شراء')
  on conflict (company_id, template_key) do nothing
  returning id into v_wf_id;

  if v_wf_id is not null then
    insert into workflow_steps (workflow_template_id, step_order, step_name, approver_role, sla_days, amount_threshold) values
      (v_wf_id, 1, 'طلب الشراء', 'requester', 1, null),
      (v_wf_id, 2, 'موافقة المدير المباشر', 'manager', 2, 1000),
      (v_wf_id, 3, 'موافقة المدير المالي', 'cfo', 1, 5000),
      (v_wf_id, 4, 'موافقة المدير العام', 'ceo', 2, 20000);
  end if;

  insert into workflow_templates (company_id, template_key, name) values (p_company_id, 'WF-LEAVE', 'طلب إجازة')
  on conflict (company_id, template_key) do nothing
  returning id into v_wf_id;

  if v_wf_id is not null then
    insert into workflow_steps (workflow_template_id, step_order, step_name, approver_role, sla_days) values
      (v_wf_id, 1, 'طلب الموظف', 'employee', 0),
      (v_wf_id, 2, 'موافقة المدير', 'manager', 1);
  end if;
end;
$$;

-- إنشاء طلب موافقة جديد (يحدد الخطوات المطلوبة فعليًا حسب المبلغ مقابل amount_threshold)
create or replace function public.create_approval_request(
  p_company_id uuid, p_template_key text, p_reference_type text, p_reference_id uuid,
  p_amount numeric default null, p_requested_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_template_id uuid;
  v_request_id uuid;
begin
  select id into v_template_id from workflow_templates where company_id = p_company_id and template_key = p_template_key;
  if v_template_id is null then raise exception 'قالب سير العمل غير موجود'; end if;

  insert into approval_requests (company_id, workflow_template_id, reference_type, reference_id, amount, requested_by)
  values (p_company_id, v_template_id, p_reference_type, p_reference_id, p_amount, p_requested_by)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- تنفيذ إجراء موافقة/رفض على خطوة معينة، والانتقال للخطوة التالية تلقائيًا (متجاوزًا أي خطوة عتبتها أعلى من المبلغ)
create or replace function public.act_on_approval(
  p_approval_request_id uuid, p_actor_user_id uuid, p_action text, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_req record;
  v_next_step record;
begin
  select * into v_req from approval_requests where id = p_approval_request_id;
  if v_req is null then raise exception 'طلب الموافقة غير موجود'; end if;
  if v_req.status != 'pending' then raise exception 'هذا الطلب لم يعد قيد الموافقة'; end if;

  insert into approval_actions (approval_request_id, step_order, actor_user_id, action, notes)
  values (p_approval_request_id, v_req.current_step_order, p_actor_user_id, p_action, p_notes);

  if p_action = 'rejected' then
    update approval_requests set status = 'rejected' where id = p_approval_request_id;
    return jsonb_build_object('status', 'rejected');
  end if;

  -- أوجد الخطوة التالية اللي فعليًا مطلوبة (بتخطي أي خطوة عتبتها أعلى من المبلغ)
  select * into v_next_step from workflow_steps
  where workflow_template_id = v_req.workflow_template_id
  and step_order > v_req.current_step_order
  and (amount_threshold is null or v_req.amount >= amount_threshold)
  order by step_order limit 1;

  if v_next_step is null then
    update approval_requests set status = 'approved' where id = p_approval_request_id;
    return jsonb_build_object('status', 'approved');
  else
    update approval_requests set current_step_order = v_next_step.step_order where id = p_approval_request_id;
    return jsonb_build_object('status', 'pending', 'next_step', v_next_step.step_name);
  end if;
end;
$$;
