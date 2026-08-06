-- ============================================================
-- وحدة الموارد البشرية والرواتب (قانون العمل الكويتي) — مستخرجة من غروب النايف
-- ============================================================

create table if not exists hr_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  social_security_employer_rate numeric not null default 0.105,  -- 10.5% حصة جهة العمل
  social_security_employee_rate numeric not null default 0.05,   -- 5% حصة الموظف
  work_hours_per_month numeric not null default 192,
  standard_overtime_multiplier numeric not null default 1.5,
  unique(company_id)
);
alter table hr_settings enable row level security;
create policy "hrs_select" on hr_settings for select using (is_company_member(company_id));
create policy "hrs_insert" on hr_settings for insert with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  position text,
  department text,
  basic_salary numeric not null,
  hire_date date not null,
  termination_date date,
  nationality text default 'كويتي',
  civil_id text,
  allowance_housing numeric default 0,
  allowance_transport numeric default 0,
  allowance_phone numeric default 0,
  allowance_other numeric default 0,
  status text default 'active' check (status in ('active','terminated','on_leave')),
  leave_balance_annual numeric default 30,
  leave_balance_sick numeric default 14,
  leave_balance_emergency numeric default 5,
  created_at timestamptz default now(),
  unique(company_id, code)
);
alter table employees enable row level security;
create policy "emp_select" on employees for select using (is_company_member(company_id));
create policy "emp_insert" on employees for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "emp_update" on employees for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period text not null,             -- 'YYYY-MM'
  run_date date not null default current_date,
  employees_count int not null,
  gross_total numeric not null,
  deductions_total numeric not null,
  net_total numeric not null,
  employer_ss_total numeric not null,
  total_cost numeric not null,
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz default now(),
  unique(company_id, period)
);
alter table payroll_runs enable row level security;
create policy "pr_select" on payroll_runs for select using (is_company_member(company_id));

create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references payroll_runs(id) on delete cascade,
  employee_id uuid not null references employees(id),
  basic_salary numeric not null,
  allowances_total numeric not null default 0,
  gross_earnings numeric not null,
  employee_ss_deduction numeric not null,
  other_deductions numeric default 0,
  net_salary numeric not null,
  employer_ss_cost numeric not null,
  total_employer_cost numeric not null
);
alter table payslips enable row level security;
create policy "ps_select" on payslips for select using (
  exists (select 1 from payroll_runs pr where pr.id = payroll_run_id and is_company_member(pr.company_id))
);

-- سجل احتساب مكافآت نهاية الخدمة (لا يُحذف أبدًا - مرجع قانوني)
create table if not exists eosb_calculations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id),
  end_date date not null,
  years_of_service numeric not null,
  basic_salary numeric not null,
  eosb_amount numeric not null,
  calculation_note text,
  created_at timestamptz default now()
);
alter table eosb_calculations enable row level security;
create policy "eosb_select" on eosb_calculations for select using (is_company_member(company_id));
create policy "eosb_insert" on eosb_calculations for insert with check (is_company_member(company_id) and company_can_write(company_id));

create or replace function public.seed_default_hr_settings(p_company_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into hr_settings (company_id) values (p_company_id) on conflict (company_id) do nothing;
end;
$$;

-- ============================================================
-- حساب مكافأة نهاية الخدمة (EOSB) وفق قانون العمل الكويتي بالضبط:
-- أول 5 سنوات: نصف شهر عن كل سنة | ما بعد 5 سنوات: شهر كامل عن كل سنة
-- ============================================================
create or replace function public.calculate_eosb(p_employee_id uuid, p_end_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_emp record;
  v_years numeric;
  v_full_years int;
  v_partial_year numeric;
  v_eosb numeric;
  v_note text;
begin
  select * into v_emp from employees where id = p_employee_id;
  if v_emp is null then raise exception 'الموظف غير موجود'; end if;

  v_years := extract(epoch from (p_end_date - v_emp.hire_date)) / (365.25 * 86400);
  v_full_years := floor(v_years);
  v_partial_year := v_years - v_full_years;

  if v_full_years <= 5 then
    v_eosb := (v_emp.basic_salary / 2) * v_full_years;
    v_note := v_full_years || ' سنوات × نصف شهر';
  else
    v_eosb := (v_emp.basic_salary / 2) * 5 + v_emp.basic_salary * (v_full_years - 5);
    v_note := '5 سنوات × نصف شهر + ' || (v_full_years - 5) || ' سنوات × شهر كامل';
  end if;

  -- إضافة الجزء النسبي من السنة الحالية
  if v_full_years < 5 then
    v_eosb := v_eosb + (v_emp.basic_salary / 2) * v_partial_year;
  else
    v_eosb := v_eosb + v_emp.basic_salary * v_partial_year;
  end if;

  insert into eosb_calculations (company_id, employee_id, end_date, years_of_service, basic_salary, eosb_amount, calculation_note)
  values (v_emp.company_id, p_employee_id, p_end_date, v_years, v_emp.basic_salary, v_eosb, v_note);

  return jsonb_build_object(
    'employee_name', v_emp.name, 'years_of_service', round(v_years,2),
    'basic_salary', v_emp.basic_salary, 'eosb_amount', round(v_eosb,3), 'calculation', v_note
  );
end;
$$;

-- ============================================================
-- تشغيل رواتب شهر كامل لكل الموظفين النشطين + قيد محاسبي تلقائي
-- ============================================================
create or replace function public.run_monthly_payroll(p_company_id uuid, p_period text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_emp record;
  v_settings record;
  v_gross numeric := 0; v_deductions numeric := 0; v_net numeric := 0;
  v_employer_ss numeric := 0; v_total_cost numeric := 0;
  v_emp_count int := 0;
  v_run_id uuid;
  v_je_id uuid;
  v_allowances numeric; v_emp_gross numeric; v_emp_ss_deduct numeric; v_emp_net numeric; v_emp_employer_ss numeric;
begin
  select * into v_settings from hr_settings where company_id = p_company_id;
  if v_settings is null then raise exception 'إعدادات الموارد البشرية غير مهيأة'; end if;

  if exists (select 1 from payroll_runs where company_id = p_company_id and period = p_period) then
    raise exception 'تم تشغيل رواتب هذا الشهر بالفعل';
  end if;

  -- إنشاء رأس الدورة أولًا (بقيم صفرية، نحدّثها فى النهاية)
  insert into payroll_runs (company_id, period, employees_count, gross_total, deductions_total, net_total, employer_ss_total, total_cost)
  values (p_company_id, p_period, 0, 0, 0, 0, 0, 0)
  returning id into v_run_id;

  for v_emp in select * from employees where company_id = p_company_id and status = 'active' loop
    v_allowances := coalesce(v_emp.allowance_housing,0) + coalesce(v_emp.allowance_transport,0) + coalesce(v_emp.allowance_phone,0) + coalesce(v_emp.allowance_other,0);
    v_emp_gross := v_emp.basic_salary + v_allowances;
    v_emp_ss_deduct := v_emp.basic_salary * v_settings.social_security_employee_rate;
    v_emp_net := v_emp_gross - v_emp_ss_deduct;
    v_emp_employer_ss := v_emp.basic_salary * v_settings.social_security_employer_rate;

    insert into payslips (payroll_run_id, employee_id, basic_salary, allowances_total, gross_earnings, employee_ss_deduction, net_salary, employer_ss_cost, total_employer_cost)
    values (v_run_id, v_emp.id, v_emp.basic_salary, v_allowances, v_emp_gross, v_emp_ss_deduct, v_emp_net, v_emp_employer_ss, v_emp_gross + v_emp_employer_ss);

    v_gross := v_gross + v_emp_gross;
    v_deductions := v_deductions + v_emp_ss_deduct;
    v_net := v_net + v_emp_net;
    v_employer_ss := v_employer_ss + v_emp_employer_ss;
    v_total_cost := v_total_cost + v_emp_gross + v_emp_employer_ss;
    v_emp_count := v_emp_count + 1;
  end loop;

  if v_emp_count = 0 then
    delete from payroll_runs where id = v_run_id;
    raise exception 'لا يوجد موظفون نشطون لتشغيل الرواتب';
  end if;

  -- القيد المحاسبي الكامل (5 أسطر، نفس منطق النظام الأصلي بالضبط)
  v_je_id := post_journal_entry(
    p_company_id, 'الرواتب والمستحقات عن شهر ' || p_period, 'payroll', p_period,
    jsonb_build_array(
      jsonb_build_object('account_code','330101','debit',v_gross,'credit',0,'description','رواتب وأجور'),
      jsonb_build_object('account_code','2103','debit',0,'credit',v_net,'description','صافي الرواتب المستحقة'),
      jsonb_build_object('account_code','2104','debit',0,'credit',v_deductions,'description','تأمينات مستحقة (حصة الموظف)'),
      jsonb_build_object('account_code','330106','debit',v_employer_ss,'credit',0,'description','تأمينات اجتماعية (حصة جهة العمل)'),
      jsonb_build_object('account_code','2104','debit',0,'credit',v_employer_ss,'description','تأمينات مستحقة (حصة جهة العمل)')
    )
  );

  update payroll_runs set
    employees_count = v_emp_count, gross_total = v_gross, deductions_total = v_deductions,
    net_total = v_net, employer_ss_total = v_employer_ss, total_cost = v_total_cost, journal_entry_id = v_je_id
  where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id, 'employees', v_emp_count, 'gross', v_gross,
    'deductions', v_deductions, 'net', v_net, 'employer_ss', v_employer_ss, 'total_cost', v_total_cost
  );
end;
$$;
