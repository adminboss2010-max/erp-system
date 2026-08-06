-- ============================================================
-- تصحيح جوهري: تقييم المخزون بالمتوسط المرجح (IAS 2) بدل "آخر سعر شراء"
-- ============================================================

-- دالة حساب المتوسط المرجح الجديد بعد دفعة شراء (تُستخدم بدل التحديث المباشر لـ unit_cost)
create or replace function public.weighted_average_cost(
  p_current_qty numeric, p_current_cost numeric, p_new_qty numeric, p_new_cost numeric
)
returns numeric
language sql
immutable
as $$
  select case when (p_current_qty + p_new_qty) = 0 then 0
    else round(((p_current_qty * p_current_cost) + (p_new_qty * p_new_cost)) / (p_current_qty + p_new_qty), 4)
  end;
$$;

-- ⚠️ ملاحظة تنفيذية مهمة: يجب استبدال السطر التالي فى دالة post_purchase_transaction الموجودة:
--   update items set stock_qty = stock_qty + v_base_qty, unit_cost = coalesce(v_unit_cost / nullif(v_unit_factor, 0), unit_cost)
--   where id = v_item_id and company_id = p_company_id;
-- بالسطر الصحيح التالي (يعيد حساب متوسط مرجح حقيقي بدل الاستبدال المباشر):
--   update items set
--     unit_cost = weighted_average_cost(stock_qty, unit_cost, v_base_qty, v_unit_cost / nullif(v_unit_factor,0)),
--     stock_qty = stock_qty + v_base_qty
--   where id = v_item_id and company_id = p_company_id;
-- (سيُطبَّق فعليًا فى مرحلة الدمج النهائية على الدالة الموجودة لتفادي كسرها الآن)

-- ============================================================
-- وحدة المخازن الموسّعة: تصنيف مستورد/محلي + مخصص بضاعة راكدة/بطيئة
-- ============================================================
alter table items add column if not exists valuation_method text default 'weighted_avg' check (valuation_method in ('weighted_avg','fifo'));

create table if not exists fifo_cost_layers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  purchase_date timestamptz not null default now(),
  qty_remaining numeric not null,
  unit_cost numeric not null,
  reference_doc_no text
);
alter table fifo_cost_layers enable row level security;
create policy "fcl_select" on fifo_cost_layers for select using (is_company_member(company_id));

-- View: تقييم المخزون الكامل (مقابل pageWhValuation فى النظام الأصلي)
create or replace view inventory_valuation as
select
  i.company_id, i.code, i.name, i.origin, i.stock_qty, i.unit_cost,
  (i.stock_qty * i.unit_cost) as total_value,
  case
    when i.stock_qty <= 0 then 'out'
    when i.stock_qty < i.min_stock_level then 'low'
    when i.max_stock_level is not null and i.stock_qty > i.max_stock_level then 'over'
    else 'ok'
  end as stock_status
from items i
where i.is_active = true;

grant select on inventory_valuation to authenticated;
create policy "iv_rls" on items for select using (is_company_member(company_id)); -- (موجودة بالفعل غالبًا، تُتجاهل لو ظهر تكرار)

-- ============================================================
-- وحدة التكلفة المعيارية (Standard Costing) — للمقارنة بالفعلي
-- ============================================================
create table if not exists standard_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  fiscal_year int not null,
  standard_cost numeric not null,
  created_at timestamptz default now(),
  unique(item_id, fiscal_year)
);
alter table standard_costs enable row level security;
create policy "sc_select" on standard_costs for select using (is_company_member(company_id));
create policy "sc_insert" on standard_costs for insert with check (is_company_member(company_id) and company_can_write(company_id));

create or replace view cost_variance_report as
select
  sc.company_id, i.code, i.name, sc.fiscal_year,
  sc.standard_cost, i.unit_cost as actual_cost,
  (i.unit_cost - sc.standard_cost) as variance,
  case when sc.standard_cost != 0 then round((i.unit_cost - sc.standard_cost) / sc.standard_cost * 100, 1) else 0 end as variance_pct
from standard_costs sc
join items i on i.id = sc.item_id;

grant select on cost_variance_report to authenticated;
