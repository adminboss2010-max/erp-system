-- ============================================================
-- توسعة جدول customers (الجمعيات) بكل الحقول المكتشفة من نظام غروب النايف
-- ============================================================
alter table customers add column if not exists agent_name text;              -- ag: اسم المندوب المرتبط
alter table customers add column if not exists credit_limit numeric default 0; -- li
alter table customers add column if not exists last_collection_date date;      -- lc
alter table customers add column if not exists growth_rate numeric default 0;  -- g: نسبة النمو
alter table customers add column if not exists discount_value numeric default 0; -- d: قيمة الخصومات الممنوحة
alter table customers add column if not exists free_goods_value numeric default 0; -- fv: قيمة البضاعة المجانية
alter table customers add column if not exists returns_count integer default 0;    -- ret
alter table customers add column if not exists returns_value numeric default 0;    -- retVal
alter table customers add column if not exists collection_rate numeric default 0;  -- rt: نسبة التحصيل %
alter table customers add column if not exists invoices_count integer default 0;   -- inv

-- سجل شهري لكل عميل (مبيعات/تحصيل/كمية لكل شهر) — بديل مصفوفة O.mon فى النظام القديم
create table if not exists customer_monthly_stats (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  sales_value numeric default 0,
  collection_value numeric default 0,
  qty numeric default 0,
  unique(customer_id, year, month)
);
alter table customer_monthly_stats enable row level security;
create policy "cms_select" on customer_monthly_stats for select using (is_company_member(company_id));

-- ============================================================
-- توسعة جدول items (الأصناف) بكل الحقول المكتشفة
-- ============================================================
alter table items add column if not exists margin_pct numeric default 0;        -- marginPct
alter table items add column if not exists tax_mode text default 'exclusive' check (tax_mode in ('inclusive','exclusive'));
alter table items add column if not exists min_price numeric default 0;         -- minPrice: أقل سعر بيع مسموح
alter table items add column if not exists unit_profit numeric default 0;       -- unitProfit
alter table items add column if not exists origin text default 'local' check (origin in ('local','imported'));
alter table items add column if not exists country_origin text;                -- countryOrigin
alter table items add column if not exists supplier_name text;                 -- supplier (نص حر، غير مربوط بجدول suppliers بالضرورة)
alter table items add column if not exists reorder_level numeric default 0;    -- reorderLevel (نفس min_stock_level عندنا تقريبًا، لازم توحيد)
alter table items add column if not exists max_stock numeric;                  -- maxStock
alter table items add column if not exists expiry_days integer;                -- expiryDays
alter table items add column if not exists batch_tracked boolean default false; -- batchTracked
alter table items add column if not exists cost_breakdown jsonb;               -- costBreakdown التفصيلي (شحن، جمارك، تخليص، إلخ)

-- ============================================================
-- توسعة جدول agents (المناديب) بحقول التتبع الشهري
-- ============================================================
alter table agents add column if not exists target_value numeric default 0;    -- tg: الهدف الشهري
alter table agents add column if not exists active_status boolean default true; -- ac

create table if not exists agent_monthly_stats (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  sales_value numeric default 0,
  collection_value numeric default 0,
  unique(agent_id, year, month)
);
alter table agent_monthly_stats enable row level security;
create policy "ams_select" on agent_monthly_stats for select using (is_company_member(company_id));
