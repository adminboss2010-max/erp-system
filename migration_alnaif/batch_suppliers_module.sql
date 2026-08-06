-- ============================================================
-- وحدة تتبع دفعات الإنتاج والصلاحية (Batch/Lot Tracking) — من غروب النايف
-- ============================================================
create table if not exists item_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  batch_number text not null,
  qty_produced numeric not null,
  qty_remaining numeric not null,
  production_date date not null,
  expiry_date date,
  status text default 'active' check (status in ('active','expired','recalled','depleted')),
  created_at timestamptz default now(),
  unique(item_id, batch_number)
);
alter table item_batches enable row level security;
create policy "ib_select" on item_batches for select using (is_company_member(company_id));
create policy "ib_insert" on item_batches for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "ib_update" on item_batches for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

-- View: تنبيه الدفعات القريبة من انتهاء الصلاحية (خلال 30 يوم)
create or replace view expiring_batches_alert as
select company_id, item_id, batch_number, qty_remaining, expiry_date,
  (expiry_date - current_date) as days_remaining
from item_batches
where status = 'active' and qty_remaining > 0
and expiry_date is not null and expiry_date <= current_date + interval '30 days'
order by expiry_date;

grant select on expiring_batches_alert to authenticated;

-- ============================================================
-- توسعة جدول الموردين (Suppliers) بحقول إضافية مكتشفة
-- ============================================================
alter table suppliers add column if not exists payment_terms_days int default 30;
alter table suppliers add column if not exists rating int check (rating between 1 and 5);   -- تقييم أداء المورد
alter table suppliers add column if not exists on_time_delivery_pct numeric default 100;
alter table suppliers add column if not exists is_active boolean default true;
