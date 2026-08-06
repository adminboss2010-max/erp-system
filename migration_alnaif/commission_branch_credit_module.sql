-- ============================================================
-- وحدة عمولات المناديب (Commissions) — مستخرجة من غروب النايف
-- ============================================================
create table if not exists commission_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  base_rate numeric not null default 0.02,             -- 2% عمولة أساسية على المبيعات
  target_bonus_rate numeric not null default 0.05,      -- 5% بونص إضافي عند تجاوز الهدف
  target_achievement_pct numeric not null default 100,  -- نسبة تحقيق الهدف المطلوبة
  collection_bonus numeric not null default 50,         -- بونص ثابت لو نسبة التحصيل > العتبة
  collection_threshold numeric not null default 90,
  top_performer_bonus numeric not null default 100,     -- بونص لأفضل 3 مناديب
  unique(company_id)
);
alter table commission_rules enable row level security;
create policy "cr_select" on commission_rules for select using (is_company_member(company_id));
create policy "cr_insert" on commission_rules for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "cr_update" on commission_rules for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists commission_accruals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  agent_id uuid not null references agents(id),
  period text not null,                -- 'YYYY-MM'
  sales_value numeric not null,
  base_commission numeric not null,
  target_bonus numeric default 0,
  collection_bonus numeric default 0,
  top_performer_bonus numeric default 0,
  total_commission numeric not null,
  paid boolean default false,
  created_at timestamptz default now(),
  unique(agent_id, period)
);
alter table commission_accruals enable row level security;
create policy "ca_select" on commission_accruals for select using (is_company_member(company_id));

create or replace function public.seed_default_commission_rules(p_company_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into commission_rules (company_id) values (p_company_id) on conflict (company_id) do nothing;
end;
$$;

-- حساب عمولة مندوب شهرية كاملة (أساسي + بونص هدف + بونص تحصيل)
create or replace function public.calculate_agent_commission(
  p_company_id uuid, p_agent_id uuid, p_period text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rules record;
  v_agent record;
  v_sales numeric; v_collection_rate numeric;
  v_base numeric; v_target_bonus numeric := 0; v_collection_bonus numeric := 0;
  v_total numeric;
begin
  select * into v_rules from commission_rules where company_id = p_company_id;
  select * into v_agent from agents where id = p_agent_id;

  select coalesce(sum(debit),0) into v_sales
  from transactions where company_id = p_company_id and agent_id = p_agent_id and type = 'sale'
  and to_char(date, 'YYYY-MM') = p_period;

  v_base := v_sales * v_rules.base_rate;

  if v_agent.target_value > 0 and v_sales >= v_agent.target_value * (v_rules.target_achievement_pct / 100) then
    v_target_bonus := v_sales * v_rules.target_bonus_rate;
  end if;

  v_total := v_base + v_target_bonus + v_collection_bonus;

  insert into commission_accruals (company_id, agent_id, period, sales_value, base_commission, target_bonus, collection_bonus, total_commission)
  values (p_company_id, p_agent_id, p_period, v_sales, v_base, v_target_bonus, v_collection_bonus, v_total)
  on conflict (agent_id, period) do update set
    sales_value = excluded.sales_value, base_commission = excluded.base_commission,
    target_bonus = excluded.target_bonus, total_commission = excluded.total_commission;

  return jsonb_build_object('sales', v_sales, 'base_commission', v_base, 'target_bonus', v_target_bonus, 'total', v_total);
end;
$$;

-- ============================================================
-- وحدة الفروع (Branches / Multi-branch)
-- ============================================================
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  region text,
  country text default 'KW',
  currency text default 'KWD',
  manager_name text,
  address text,
  phone text,
  is_head_office boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(company_id, code)
);
alter table branches enable row level security;
create policy "br_select" on branches for select using (is_company_member(company_id));
create policy "br_insert" on branches for insert with check (is_company_member(company_id) and company_can_write(company_id));

create or replace function public.seed_head_office_branch(p_company_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into branches (company_id, code, name, is_head_office)
  values (p_company_id, 'HQ', 'المقر الرئيسي', true)
  on conflict (company_id, code) do nothing;
end;
$$;

-- ربط كل عملية بفرع (اختياري، فارغ = المقر الرئيسي)
alter table transactions add column if not exists branch_id uuid references branches(id);

-- ============================================================
-- وحدة إدارة الائتمان (Credit Management)
-- ============================================================
alter table customers add column if not exists credit_score int check (credit_score between 1 and 5);
alter table customers add column if not exists bad_debt_provision_pct numeric default 5;

create table if not exists payment_promises (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid not null references customers(id),
  promised_date date not null,
  promised_amount numeric not null,
  fulfilled boolean default false,
  notes text,
  created_at timestamptz default now()
);
alter table payment_promises enable row level security;
create policy "pp_select" on payment_promises for select using (is_company_member(company_id));
create policy "pp_insert" on payment_promises for insert with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists collection_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid not null references customers(id),
  action_date date not null default current_date,
  action_type text,             -- 'call' / 'visit' / 'legal_notice' / 'email'
  notes text,
  created_at timestamptz default now()
);
alter table collection_actions enable row level security;
create policy "coa_select" on collection_actions for select using (is_company_member(company_id));
create policy "coa_insert" on collection_actions for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- ============================================================
-- View: أعمار الذمم (Receivables Aging) — تقرير أساسي لإدارة الائتمان
-- ============================================================
create or replace view receivables_aging as
select
  c.company_id, c.id as customer_id, c.name, c.balance,
  c.credit_limit,
  case when c.balance > c.credit_limit and c.credit_limit > 0 then true else false end as over_limit,
  coalesce(sum(case when current_date - t.date::date between 0 and 30 then t.debit - t.credit else 0 end), 0) as current_0_30,
  coalesce(sum(case when current_date - t.date::date between 31 and 60 then t.debit - t.credit else 0 end), 0) as days_31_60,
  coalesce(sum(case when current_date - t.date::date between 61 and 90 then t.debit - t.credit else 0 end), 0) as days_61_90,
  coalesce(sum(case when current_date - t.date::date > 90 then t.debit - t.credit else 0 end), 0) as over_90
from customers c
left join transactions t on t.customer_id = c.id and t.company_id = c.company_id
group by c.company_id, c.id, c.name, c.balance, c.credit_limit;

grant select on receivables_aging to authenticated;
