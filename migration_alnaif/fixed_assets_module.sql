-- ============================================================
-- وحدة الأصول الثابتة والإهلاك (IAS 16) — مستخرجة من نظام غروب النايف
-- ============================================================

-- فئات الأصول (قابلة للتخصيص لكل شركة، لكن بقيم افتراضية جاهزة)
create table if not exists asset_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category_key text not null,           -- 'buildings' / 'vehicles' / 'furniture' / 'equipment' / 'intangible'
  name_ar text not null,
  useful_life_years int not null,
  dep_method text not null default 'straight-line'
    check (dep_method in ('straight-line','declining-balance','double-declining','units-of-production','sum-of-years')),
  salvage_pct numeric not null default 0,     -- نسبة القيمة التخريدية من التكلفة
  asset_account_code text,                     -- كود حساب الأصل فى الدليل
  accum_dep_account_code text,                 -- كود حساب مجمع الإهلاك
  dep_expense_account_code text,               -- كود حساب مصروف الإهلاك
  unique(company_id, category_key)
);
alter table asset_categories enable row level security;
create policy "acat_select" on asset_categories for select using (is_company_member(company_id));
create policy "acat_insert" on asset_categories for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- سجل الأصول الثابتة الفعلي
create table if not exists fixed_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  asset_code text not null,             -- يقابل كود حساب الأصل فى دليل الحسابات (مثال: 110301)
  category_key text not null,
  name_ar text not null,
  acquire_date date not null,
  cost numeric not null,                -- التكلفة الأصلية
  salvage_value numeric not null default 0,
  useful_life_years int not null,
  dep_method text not null default 'straight-line',
  is_disposed boolean not null default false,
  disposal_date date,
  disposal_value numeric,
  created_at timestamptz default now(),
  unique(company_id, asset_code)
);
alter table fixed_assets enable row level security;
create policy "fa_select" on fixed_assets for select using (is_company_member(company_id));
create policy "fa_insert" on fixed_assets for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "fa_update" on fixed_assets for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

-- سجل تشغيل الإهلاك (كل عملية إهلاك دورية منفذة، مع القيد المحاسبي المرتبط)
create table if not exists depreciation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fixed_asset_id uuid not null references fixed_assets(id) on delete cascade,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  depreciation_amount numeric not null,
  accumulated_after numeric not null,   -- إجمالي الإهلاك المتراكم بعد هذه الدفعة
  book_value_after numeric not null,    -- القيمة الدفترية المتبقية بعد هذه الدفعة
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz default now(),
  unique(fixed_asset_id, period_year, period_month)
);
alter table depreciation_runs enable row level security;
create policy "dr_select" on depreciation_runs for select using (is_company_member(company_id));

-- ============================================================
-- تأسيس فئات الأصول الافتراضية الخمسة لأي شركة جديدة
-- ============================================================
create or replace function public.seed_default_asset_categories(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into asset_categories (company_id, category_key, name_ar, useful_life_years, dep_method, salvage_pct, asset_account_code, accum_dep_account_code, dep_expense_account_code)
  values
    (p_company_id, 'buildings', 'مباني', 20, 'straight-line', 5, '110201', '110701', '330201'),
    (p_company_id, 'vehicles', 'سيارات', 5, 'straight-line', 10, '110301', '110702', '330202'),
    (p_company_id, 'furniture', 'أثاث ومفروشات', 10, 'straight-line', 5, '110401', '110703', '330203'),
    (p_company_id, 'equipment', 'أجهزة وحاسبات', 4, 'straight-line', 5, '110502', '110704', '330204'),
    (p_company_id, 'intangible', 'أصول غير ملموسة', 5, 'straight-line', 0, '110504', '1209', '330205')
  on conflict (company_id, category_key) do nothing;
end;
$$;

-- ============================================================
-- دالة تشغيل الإهلاك الشهري لأصل واحد (طريقة القسط الثابت — الأكثر استخدامًا فى الملف الأصلي)
-- ملاحظة: الطرق الأربعة الأخرى (متناقص، متناقص مضاعف، وحدات إنتاج، مجموع أرقام السنين)
-- تحتاج معاملات إضافية (نسبة تناقص، وحدات منتجة) — تُبنى فى دالة موسّعة لاحقًا عند الحاجة الفعلية
-- ============================================================
create or replace function public.run_monthly_depreciation(
  p_company_id uuid, p_fixed_asset_id uuid, p_year int, p_month int
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_asset record;
  v_cat record;
  v_monthly_dep numeric;
  v_prior_accum numeric;
  v_new_accum numeric;
  v_book_value numeric;
  v_depreciable_base numeric;
  v_run_id uuid;
  v_je_id uuid;
begin
  select * into v_asset from fixed_assets where id = p_fixed_asset_id and company_id = p_company_id;
  if v_asset is null then raise exception 'الأصل غير موجود'; end if;
  if v_asset.is_disposed then raise exception 'لا يمكن إهلاك أصل تم استبعاده بالفعل'; end if;

  select * into v_cat from asset_categories where company_id = p_company_id and category_key = v_asset.category_key;
  if v_cat is null then raise exception 'فئة الأصل غير معرّفة'; end if;

  -- القسط الثابت الشهري = (التكلفة - القيمة التخريدية) ÷ (العمر الإنتاجي بالسنوات × 12)
  v_depreciable_base := v_asset.cost - v_asset.salvage_value;
  v_monthly_dep := round(v_depreciable_base / (v_asset.useful_life_years * 12), 3);

  select coalesce(sum(depreciation_amount), 0) into v_prior_accum
  from depreciation_runs where fixed_asset_id = p_fixed_asset_id;

  v_new_accum := v_prior_accum + v_monthly_dep;
  -- لا يتجاوز الإهلاك المتراكم القيمة القابلة للإهلاك (حماية من إهلاك زائد عن التكلفة)
  if v_new_accum > v_depreciable_base then
    v_monthly_dep := v_depreciable_base - v_prior_accum;
    v_new_accum := v_depreciable_base;
  end if;
  v_book_value := v_asset.cost - v_new_accum;

  -- القيد المحاسبي: مدين مصروف إهلاك، دائن مجمع إهلاك
  v_je_id := post_journal_entry(
    p_company_id,
    'قيد إهلاك شهري - ' || v_asset.name_ar || ' - ' || p_year || '/' || p_month,
    'depreciation', v_asset.asset_code,
    jsonb_build_array(
      jsonb_build_object('account_code', v_cat.dep_expense_account_code, 'debit', v_monthly_dep, 'credit', 0, 'description', 'مصروف إهلاك'),
      jsonb_build_object('account_code', v_cat.accum_dep_account_code, 'debit', 0, 'credit', v_monthly_dep, 'description', 'مجمع إهلاك')
    )
  );

  insert into depreciation_runs (company_id, fixed_asset_id, period_year, period_month, depreciation_amount, accumulated_after, book_value_after, journal_entry_id)
  values (p_company_id, p_fixed_asset_id, p_year, p_month, v_monthly_dep, v_new_accum, v_book_value, v_je_id)
  returning id into v_run_id;

  return jsonb_build_object('run_id', v_run_id, 'depreciation_amount', v_monthly_dep, 'accumulated', v_new_accum, 'book_value', v_book_value);
end;
$$;
