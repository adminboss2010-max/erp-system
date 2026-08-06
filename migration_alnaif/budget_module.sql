-- ============================================================
-- وحدة الموازنة التقديرية (Budget) — مستخرجة من غروب النايف
-- ============================================================

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fiscal_year int not null,
  scenario text not null default 'base' check (scenario in ('base','optimistic','pessimistic')),
  scenario_name text,
  assumptions text,
  approval_status text default 'draft' check (approval_status in ('draft','approved','rejected')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz default now(),
  unique(company_id, fiscal_year, scenario)
);
alter table budgets enable row level security;
create policy "bud_select" on budgets for select using (is_company_member(company_id));
create policy "bud_insert" on budgets for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "bud_update" on budgets for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

-- الموازنة حسب الحساب وحسب الربع (بنية مسطّحة بدل الكائن المتداخل فى النظام الأصلي)
create table if not exists budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  account_id uuid not null references chart_of_accounts(id),
  q1_amount numeric default 0,
  q2_amount numeric default 0,
  q3_amount numeric default 0,
  q4_amount numeric default 0,
  annual_amount numeric generated always as (q1_amount + q2_amount + q3_amount + q4_amount) stored,
  unique(budget_id, account_id)
);
alter table budget_lines enable row level security;
create policy "budl_select" on budget_lines for select using (
  exists (select 1 from budgets b where b.id = budget_id and is_company_member(b.company_id))
);
create policy "budl_insert" on budget_lines for insert with check (
  exists (select 1 from budgets b where b.id = budget_id and is_company_member(b.company_id) and company_can_write(b.company_id))
);

-- ============================================================
-- View: مقارنة الموازنة بالفعلي (Budget vs Actual) — أهم تقرير فى هذه الوحدة
-- ============================================================
create or replace view budget_vs_actual as
select
  b.company_id, b.fiscal_year, b.scenario,
  coa.code as account_code, coa.name_ar as account_name,
  bl.annual_amount as budgeted,
  coalesce(actual.actual_amount, 0) as actual,
  coalesce(actual.actual_amount, 0) - bl.annual_amount as variance,
  case when bl.annual_amount != 0
    then round((coalesce(actual.actual_amount,0) - bl.annual_amount) / abs(bl.annual_amount) * 100, 1)
    else 0 end as variance_pct
from budget_lines bl
join budgets b on b.id = bl.budget_id
join chart_of_accounts coa on coa.id = bl.account_id
left join lateral (
  select sum(jel.debit) - sum(jel.credit) as actual_amount
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  where jel.account_id = coa.id
  and extract(year from je.entry_date) = b.fiscal_year
) actual on true;

grant select on budget_vs_actual to authenticated;
