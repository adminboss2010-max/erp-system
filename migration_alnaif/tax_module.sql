-- ============================================================
-- وحدة الالتزامات الضريبية الكويتية — مستخرجة من نظام غروب النايف
-- ============================================================

create table if not exists tax_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  zakat_rate numeric not null default 0.025,       -- الزكاة الشرعية 2.5%
  kfas_rate numeric not null default 0.01,         -- مؤسسة الكويت للتقدم العلمي 1%
  nlsc_rate numeric not null default 0.025,        -- دعم العمالة الوطنية 2.5%
  income_tax_rate numeric not null default 0.15,   -- للشركات الأجنبية (15% نموذجي)
  unique(company_id)
);
alter table tax_settings enable row level security;
create policy "ts_select" on tax_settings for select using (is_company_member(company_id));
create policy "ts_insert" on tax_settings for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "ts_update" on tax_settings for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists tax_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fiscal_year int not null,
  tax_type text not null check (tax_type in ('zakat','kfas','nlsc','income_tax')),
  base_amount numeric not null,
  rate numeric not null,
  amount numeric not null,
  journal_entry_id uuid references journal_entries(id),
  posted boolean default false,
  created_at timestamptz default now()
);
alter table tax_history enable row level security;
create policy "th_select" on tax_history for select using (is_company_member(company_id));

create or replace function public.seed_default_tax_settings(p_company_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into tax_settings (company_id) values (p_company_id) on conflict (company_id) do nothing;
end;
$$;

-- ============================================================
-- دالة عامة لجلب رصيد حساب من دليل الحسابات (تُستخدم فى كل حسابات الضرائب)
-- ============================================================
create or replace function public.get_account_balance(p_company_id uuid, p_account_code text)
returns numeric
language sql
security definer
set search_path to 'public'
stable
as $$
  select coalesce(sum(jel.debit) - sum(jel.credit), 0)
  from journal_entry_lines jel
  join journal_entries je on je.id = jel.journal_entry_id
  join chart_of_accounts coa on coa.id = jel.account_id
  where je.company_id = p_company_id and coa.code = p_account_code;
$$;

-- ============================================================
-- حساب الزكاة الشرعية (2.5% من رأس المال + الاحتياطيات + الأرباح المرحّلة)
-- ============================================================
create or replace function public.calculate_zakat(p_company_id uuid, p_fiscal_year int, p_post boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rate numeric;
  v_capital numeric; v_reserves numeric; v_retained numeric;
  v_base numeric; v_amount numeric;
  v_je_id uuid; v_history_id uuid;
begin
  select zakat_rate into v_rate from tax_settings where company_id = p_company_id;
  v_rate := coalesce(v_rate, 0.025);

  v_capital := abs(get_account_balance(p_company_id, '230101')) + abs(get_account_balance(p_company_id, '230102'));
  v_reserves := abs(get_account_balance(p_company_id, '230301')) + abs(get_account_balance(p_company_id, '230302'));
  v_retained := abs(get_account_balance(p_company_id, '230401')) + abs(get_account_balance(p_company_id, '2305'));

  v_base := v_capital + v_reserves + v_retained;
  v_amount := v_base * v_rate;

  if p_post and v_amount > 0 then
    v_je_id := post_journal_entry(
      p_company_id, 'استحقاق الزكاة عن السنة ' || p_fiscal_year, 'zakat', p_fiscal_year::text,
      jsonb_build_array(
        jsonb_build_object('account_code', '360101', 'debit', v_amount, 'credit', 0, 'description', 'مصروف الزكاة'),
        jsonb_build_object('account_code', '210602', 'debit', 0, 'credit', v_amount, 'description', 'مخصص الزكاة المستحقة')
      )
    );
  end if;

  insert into tax_history (company_id, fiscal_year, tax_type, base_amount, rate, amount, journal_entry_id, posted)
  values (p_company_id, p_fiscal_year, 'zakat', v_base, v_rate, v_amount, v_je_id, v_je_id is not null)
  returning id into v_history_id;

  return jsonb_build_object('type','zakat','base',v_base,'rate',v_rate,'amount',v_amount,'journal_entry_id',v_je_id);
end;
$$;

-- ============================================================
-- حساب حصة مؤسسة الكويت للتقدم العلمي (KFAS) - 1% من صافي الربح
-- ============================================================
create or replace function public.calculate_kfas(p_company_id uuid, p_fiscal_year int, p_post boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rate numeric; v_net_profit numeric; v_amount numeric; v_je_id uuid;
begin
  select kfas_rate into v_rate from tax_settings where company_id = p_company_id;
  v_rate := coalesce(v_rate, 0.01);

  v_net_profit := greatest(0, abs(get_account_balance(p_company_id, '2305')));
  v_amount := v_net_profit * v_rate;

  if p_post and v_amount > 0 then
    v_je_id := post_journal_entry(
      p_company_id, 'استحقاق حصة KFAS عن السنة ' || p_fiscal_year, 'kfas', p_fiscal_year::text,
      jsonb_build_array(
        jsonb_build_object('account_code', '360103', 'debit', v_amount, 'credit', 0, 'description', 'مصروف KFAS'),
        jsonb_build_object('account_code', '210603', 'debit', 0, 'credit', v_amount, 'description', 'مخصص KFAS مستحق')
      )
    );
  end if;

  insert into tax_history (company_id, fiscal_year, tax_type, base_amount, rate, amount, journal_entry_id, posted)
  values (p_company_id, p_fiscal_year, 'kfas', v_net_profit, v_rate, v_amount, v_je_id, v_je_id is not null);

  return jsonb_build_object('type','kfas','base',v_net_profit,'rate',v_rate,'amount',v_amount,'journal_entry_id',v_je_id);
end;
$$;

-- ============================================================
-- حساب ضريبة دعم العمالة الوطنية (NLSC) - 2.5% من صافي الربح
-- ============================================================
create or replace function public.calculate_nlsc(p_company_id uuid, p_fiscal_year int, p_post boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rate numeric; v_net_profit numeric; v_amount numeric; v_je_id uuid;
begin
  select nlsc_rate into v_rate from tax_settings where company_id = p_company_id;
  v_rate := coalesce(v_rate, 0.025);

  v_net_profit := greatest(0, abs(get_account_balance(p_company_id, '2305')));
  v_amount := v_net_profit * v_rate;

  if p_post and v_amount > 0 then
    v_je_id := post_journal_entry(
      p_company_id, 'استحقاق NLSC عن السنة ' || p_fiscal_year, 'nlsc', p_fiscal_year::text,
      jsonb_build_array(
        jsonb_build_object('account_code', '360102', 'debit', v_amount, 'credit', 0, 'description', 'مصروف دعم العمالة الوطنية'),
        jsonb_build_object('account_code', '210604', 'debit', 0, 'credit', v_amount, 'description', 'مخصص دعم العمالة مستحق')
      )
    );
  end if;

  insert into tax_history (company_id, fiscal_year, tax_type, base_amount, rate, amount, journal_entry_id, posted)
  values (p_company_id, p_fiscal_year, 'nlsc', v_net_profit, v_rate, v_amount, v_je_id, v_je_id is not null);

  return jsonb_build_object('type','nlsc','base',v_net_profit,'rate',v_rate,'amount',v_amount,'journal_entry_id',v_je_id);
end;
$$;

-- ============================================================
-- دالة شاملة: احتساب وترحيل كل الالتزامات الضريبية الثلاثة دفعة واحدة
-- ============================================================
create or replace function public.calculate_all_taxes(p_company_id uuid, p_fiscal_year int, p_post boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_zakat jsonb; v_kfas jsonb; v_nlsc jsonb;
begin
  v_zakat := calculate_zakat(p_company_id, p_fiscal_year, p_post);
  v_kfas := calculate_kfas(p_company_id, p_fiscal_year, p_post);
  v_nlsc := calculate_nlsc(p_company_id, p_fiscal_year, p_post);
  return jsonb_build_object(
    'zakat', v_zakat, 'kfas', v_kfas, 'nlsc', v_nlsc,
    'total', (v_zakat->>'amount')::numeric + (v_kfas->>'amount')::numeric + (v_nlsc->>'amount')::numeric
  );
end;
$$;
