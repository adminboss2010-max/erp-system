-- ============================================================
-- وحدة عروض الأسعار (Quotations) — مستخرجة من غروب النايف
-- ============================================================
create table if not exists quotation_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  valid_days int not null default 30,
  terms text,
  created_at timestamptz default now()
);
alter table quotation_templates enable row level security;
create policy "qt_select" on quotation_templates for select using (is_company_member(company_id));
create policy "qt_insert" on quotation_templates for insert with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  quote_number text not null,
  customer_id uuid references customers(id),
  quote_date date not null default current_date,
  valid_until date,
  status text default 'draft' check (status in ('draft','sent','accepted','rejected','expired','converted')),
  total_amount numeric default 0,
  terms text,
  converted_sale_doc_no text,     -- رقم فاتورة البيع لو اتحول العرض لفاتورة فعلية
  created_at timestamptz default now(),
  unique(company_id, quote_number)
);
alter table quotations enable row level security;
create policy "q_select" on quotations for select using (is_company_member(company_id));
create policy "q_insert" on quotations for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "q_update" on quotations for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists quotation_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  item_id uuid not null references items(id),
  qty numeric not null,
  unit_price numeric not null,
  line_total numeric generated always as (qty * unit_price) stored
);
alter table quotation_lines enable row level security;
create policy "ql_select" on quotation_lines for select using (
  exists (select 1 from quotations q where q.id = quotation_id and is_company_member(q.company_id))
);

create or replace function public.seed_default_quotation_templates(p_company_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into quotation_templates (company_id, name, valid_days, terms) values
    (p_company_id, 'عرض قياسي', 30, 'الدفع خلال 30 يوم. التسليم خلال 7 أيام.'),
    (p_company_id, 'عرض VIP', 60, 'خصم 5% إضافي. الدفع خلال 60 يوم. أولوية التسليم.'),
    (p_company_id, 'عرض نقدي', 14, 'خصم 3% للدفع النقدي. صالح لأسبوعين.');
end;
$$;

-- تحويل عرض سعر مقبول لفاتورة بيع فعلية (يستدعي post_sale_transaction الموجودة بالفعل)
create or replace function public.convert_quotation_to_sale(p_quotation_id uuid, p_is_credit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_quote record;
  v_items jsonb;
  v_result jsonb;
begin
  select * into v_quote from quotations where id = p_quotation_id;
  if v_quote is null then raise exception 'عرض السعر غير موجود'; end if;
  if v_quote.status = 'converted' then raise exception 'هذا العرض تم تحويله لفاتورة بالفعل'; end if;

  select jsonb_agg(jsonb_build_object('item_id', ql.item_id, 'qty', ql.qty, 'unit_price', ql.unit_price, 'unit_cost', i.unit_cost))
  into v_items
  from quotation_lines ql join items i on i.id = ql.item_id
  where ql.quotation_id = p_quotation_id;

  v_result := post_sale_transaction(v_quote.company_id, v_quote.customer_id, null, v_items, p_is_credit, null);

  update quotations set status = 'converted', converted_sale_doc_no = v_result->>'doc_no' where id = p_quotation_id;

  return v_result;
end;
$$;

-- ============================================================
-- وحدة العملات الأجنبية (FX) — مستخرجة من غروب النايف
-- ============================================================
create table if not exists fx_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  currency_code text not null,       -- USD, EUR, GBP, AED, SAR, JOD, EGP
  rate_to_base numeric not null,     -- سعر الصرف مقابل الدينار الكويتي (عملة الأساس)
  rate_date date not null default current_date,
  source text default 'CBK',         -- بنك الكويت المركزي
  created_at timestamptz default now()
);
alter table fx_rates enable row level security;
create policy "fx_select" on fx_rates for select using (is_company_member(company_id));
create policy "fx_insert" on fx_rates for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- بنود مفتوحة بعملة أجنبية (ذمم/التزامات) تحتاج إعادة تقييم دورية
create table if not exists fx_open_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  reference_type text,        -- 'customer' / 'supplier'
  reference_id uuid,
  currency_code text not null,
  original_amount numeric not null,
  original_rate numeric not null,
  is_settled boolean default false,
  created_at timestamptz default now()
);
alter table fx_open_items enable row level security;
create policy "fxoi_select" on fx_open_items for select using (is_company_member(company_id));

create table if not exists fx_revaluation_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  revaluation_date date not null default current_date,
  fx_open_item_id uuid references fx_open_items(id),
  old_rate numeric not null,
  new_rate numeric not null,
  gain_loss_amount numeric not null,     -- موجب = ربح، سالب = خسارة
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz default now()
);
alter table fx_revaluation_log enable row level security;
create policy "fxrl_select" on fx_revaluation_log for select using (is_company_member(company_id));

-- أسعار الصرف الافتراضية (آخر سعر معروف من بنك الكويت المركزي وقت بناء النظام الأصلي)
create or replace function public.seed_default_fx_rates(p_company_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into fx_rates (company_id, currency_code, rate_to_base, source) values
    (p_company_id, 'USD', 0.3075, 'CBK'),
    (p_company_id, 'EUR', 0.3340, 'CBK'),
    (p_company_id, 'GBP', 0.2440, 'CBK'),
    (p_company_id, 'AED', 1.1290, 'CBK'),
    (p_company_id, 'SAR', 1.1530, 'CBK'),
    (p_company_id, 'JOD', 0.2173, 'CBK'),
    (p_company_id, 'EGP', 14.92, 'CBK');
end;
$$;

-- دالة إعادة تقييم بند مفتوح بعملة أجنبية + قيد فروق عملة تلقائي
create or replace function public.revalue_fx_item(p_fx_open_item_id uuid, p_new_rate numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item record;
  v_gain_loss numeric;
  v_je_id uuid;
begin
  select * into v_item from fx_open_items where id = p_fx_open_item_id;
  if v_item is null then raise exception 'البند غير موجود'; end if;

  v_gain_loss := v_item.original_amount * (p_new_rate - v_item.original_rate);

  if abs(v_gain_loss) > 0.001 then
    v_je_id := post_journal_entry(
      v_item.company_id, 'إعادة تقييم عملة أجنبية - ' || v_item.currency_code, 'fx_revaluation', null,
      case when v_gain_loss > 0 then
        jsonb_build_array(
          jsonb_build_object('account_code', case when v_item.reference_type='customer' then '1100' else '2000' end, 'debit', v_gain_loss, 'credit', 0, 'description', 'فرق عملة'),
          jsonb_build_object('account_code', '420108', 'debit', 0, 'credit', v_gain_loss, 'description', 'أرباح فروق عملة')
        )
      else
        jsonb_build_array(
          jsonb_build_object('account_code', '340104', 'debit', abs(v_gain_loss), 'credit', 0, 'description', 'خسائر فروق عملة'),
          jsonb_build_object('account_code', case when v_item.reference_type='customer' then '1100' else '2000' end, 'debit', 0, 'credit', abs(v_gain_loss), 'description', 'فرق عملة')
        )
      end
    );
  end if;

  insert into fx_revaluation_log (company_id, fx_open_item_id, old_rate, new_rate, gain_loss_amount, journal_entry_id)
  values (v_item.company_id, p_fx_open_item_id, v_item.original_rate, p_new_rate, v_gain_loss, v_je_id);

  return jsonb_build_object('gain_loss', v_gain_loss, 'journal_entry_id', v_je_id);
end;
$$;
