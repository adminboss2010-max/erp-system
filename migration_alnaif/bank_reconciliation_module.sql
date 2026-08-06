-- ============================================================
-- وحدة البنك والتسوية البنكية (IAS 7) — مستخرجة من نظام غروب النايف
-- ============================================================

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  account_code text not null,          -- كود الحساب فى دليل الحسابات (150201 مثلًا)
  bank_name text not null,
  account_number_masked text,
  currency text default 'KWD',
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(company_id, account_code)
);
alter table bank_accounts enable row level security;
create policy "ba_select" on bank_accounts for select using (is_company_member(company_id));
create policy "ba_insert" on bank_accounts for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- كشف حساب بنكي مستورد (شهري)
create table if not exists bank_statements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  opening_balance numeric not null default 0,
  closing_balance numeric not null default 0,
  created_at timestamptz default now(),
  unique(bank_account_id, period_year, period_month)
);
alter table bank_statements enable row level security;
create policy "bs_select" on bank_statements for select using (is_company_member(company_id));
create policy "bs_insert" on bank_statements for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- بنود كشف الحساب البنكي (كل سطر حركة فى الكشف)
create table if not exists bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  bank_statement_id uuid not null references bank_statements(id) on delete cascade,
  line_date date not null,
  description text,
  reference text,
  debit numeric default 0,
  credit numeric default 0,
  matched boolean default false        -- تمت مطابقتها مع دفاتر الشركة؟
);
alter table bank_statement_lines enable row level security;
create policy "bsl_select" on bank_statement_lines for select using (
  exists (select 1 from bank_statements bs where bs.id = bank_statement_id and is_company_member(bs.company_id))
);

-- التسوية البنكية الشهرية (النتيجة النهائية + بنودها)
create table if not exists bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  balance_per_bank numeric not null,
  balance_per_book numeric not null,
  reconciled boolean default false,
  notes text,
  created_at timestamptz default now(),
  unique(bank_account_id, period_year, period_month)
);
alter table bank_reconciliations enable row level security;
create policy "br_select" on bank_reconciliations for select using (is_company_member(company_id));
create policy "br_insert" on bank_reconciliations for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "br_update" on bank_reconciliations for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

-- بنود التسوية (4 أنواع فى نفس الجدول، مميّزة بعمود item_type)
create table if not exists bank_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  bank_reconciliation_id uuid not null references bank_reconciliations(id) on delete cascade,
  item_type text not null check (item_type in ('outstanding_check','deposit_in_transit','bank_charge','bank_interest')),
  reference text,
  description text,
  amount numeric not null
);
alter table bank_reconciliation_items enable row level security;
create policy "bri_select" on bank_reconciliation_items for select using (
  exists (select 1 from bank_reconciliations br where br.id = bank_reconciliation_id and is_company_member(br.company_id))
);

-- ============================================================
-- دالة حساب التسوية البنكية الكاملة (نفس معادلة IAS 7 المستخرجة من النظام الأصلي)
-- ============================================================
create or replace function public.compute_bank_reconciliation(p_reconciliation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_rec record;
  v_dit numeric; v_oc numeric; v_interest numeric; v_charges numeric;
  v_adj_bank numeric; v_adj_book numeric;
begin
  select * into v_rec from bank_reconciliations where id = p_reconciliation_id;
  if v_rec is null then raise exception 'التسوية غير موجودة'; end if;

  select coalesce(sum(amount),0) into v_dit from bank_reconciliation_items where bank_reconciliation_id = p_reconciliation_id and item_type = 'deposit_in_transit';
  select coalesce(sum(amount),0) into v_oc from bank_reconciliation_items where bank_reconciliation_id = p_reconciliation_id and item_type = 'outstanding_check';
  select coalesce(sum(amount),0) into v_interest from bank_reconciliation_items where bank_reconciliation_id = p_reconciliation_id and item_type = 'bank_interest';
  select coalesce(sum(amount),0) into v_charges from bank_reconciliation_items where bank_reconciliation_id = p_reconciliation_id and item_type = 'bank_charge';

  -- الرصيد المعدّل حسب البنك = رصيد البنك + إيداعات فى الطريق − شيكات معلقة
  v_adj_bank := v_rec.balance_per_bank + v_dit - v_oc;
  -- الرصيد المعدّل حسب الدفاتر = رصيد الدفاتر + فوائد دائنة − رسوم بنكية
  v_adj_book := v_rec.balance_per_book + v_interest - v_charges;

  update bank_reconciliations set reconciled = (abs(v_adj_bank - v_adj_book) < 0.01)
  where id = p_reconciliation_id;

  return jsonb_build_object(
    'deposits_in_transit', v_dit, 'outstanding_checks', v_oc,
    'bank_interest', v_interest, 'bank_charges', v_charges,
    'adjusted_bank_balance', v_adj_bank, 'adjusted_book_balance', v_adj_book,
    'balanced', abs(v_adj_bank - v_adj_book) < 0.01,
    'difference', v_adj_bank - v_adj_book
  );
end;
$$;
