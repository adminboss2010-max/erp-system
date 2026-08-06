-- ============================================================
-- وحدة تحليلات قيمة العميل مدى الحياة (Customer Lifetime Value - CLV)
-- ============================================================
create or replace view customer_clv as
select
  c.company_id, c.id as customer_id, c.name,
  case when c.invoices_count > 0 then c.s_gross_total / c.invoices_count else 0 end as avg_order_value,
  -- ملاحظة: gross_margin الافتراضي 40% كما فى النظام الأصلي (تقدير عام، قابل للتخصيص لاحقًا لكل شركة)
  (case when c.invoices_count > 0 then c.balance / c.invoices_count else 0 end) * (c.invoices_count / 19.0 * 12) * 5 * 0.40 as estimated_clv,
  case
    when (case when c.invoices_count > 0 then c.balance / c.invoices_count else 0 end) * (c.invoices_count / 19.0 * 12) * 5 * 0.40 >= 50000 then 'VIP'
    when (case when c.invoices_count > 0 then c.balance / c.invoices_count else 0 end) * (c.invoices_count / 19.0 * 12) * 5 * 0.40 >= 20000 then 'Gold'
    when (case when c.invoices_count > 0 then c.balance / c.invoices_count else 0 end) * (c.invoices_count / 19.0 * 12) * 5 * 0.40 >= 5000 then 'Silver'
    else 'Bronze'
  end as segment
from (select id, company_id, name, balance, invoices_count, balance as s_gross_total from customers) c;
-- ⚠️ ملاحظة دقة: المعادلة الأصلية معقدة وتعتمد على قيم مُقدَّرة (19 كنسبة تكرار سنوية، هامش 40% ثابت)
-- هذا استخراج مبدئي يحتاج ضبط القيم الفعلية (معدل الشراء الحقيقي وهامش الربح الفعلي لكل شركة) فى مرحلة التنقيح النهائية

grant select on customer_clv to authenticated;

-- ============================================================
-- وحدة الزيارات الميدانية للمناديب (GPS Field Visits)
-- ============================================================
create table if not exists field_visits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  agent_id uuid not null references agents(id),
  customer_id uuid references customers(id),
  visit_date date not null default current_date,
  planned_time time,
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  gps_lat numeric,
  gps_lng numeric,
  notes text,
  status text default 'planned' check (status in ('planned','checked_in','completed','missed')),
  created_at timestamptz default now()
);
alter table field_visits enable row level security;
create policy "fv_select" on field_visits for select using (is_company_member(company_id));
create policy "fv_insert" on field_visits for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "fv_update" on field_visits for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

-- ============================================================
-- وحدة جدولة التقارير التلقائية بالإيميل (بنية تخزين الإعدادات فقط — الإرسال الفعلي يحتاج Edge Function + خدمة بريد لاحقًا)
-- ============================================================
create table if not exists report_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  frequency text not null check (frequency in ('daily','weekly','monthly')),
  send_time time not null default '08:00',
  day_of_week text,          -- لو weekly
  day_of_month int,          -- لو monthly
  recipients text[] not null,
  report_type text,          -- 'trial_balance' / 'customer_statement' / 'sales_summary' إلخ
  is_active boolean default true,
  last_sent_at timestamptz,
  created_at timestamptz default now()
);
alter table report_schedules enable row level security;
create policy "rs_select" on report_schedules for select using (is_company_member(company_id));
create policy "rs_insert" on report_schedules for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- ============================================================
-- إعدادات تكامل واتساب (بنية تخزين فقط — التفعيل الفعلي يحتاج حساب WhatsApp Business API حقيقي)
-- ============================================================
create table if not exists whatsapp_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  is_enabled boolean default false,
  auto_send boolean default false,
  api_provider text default 'whatsapp-business',
  phone_number_id text,
  access_token_encrypted text,     -- ⚠️ يجب تشفيره فعليًا، لا يُخزَّن نص صريح أبدًا فى الإنتاج
  unique(company_id)
);
alter table whatsapp_settings enable row level security;
create policy "ws_select" on whatsapp_settings for select using (is_company_member(company_id));
create policy "ws_insert" on whatsapp_settings for insert with check (is_company_member(company_id) and company_can_write(company_id));
