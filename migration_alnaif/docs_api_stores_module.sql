-- ============================================================
-- وحدة إدارة المستندات المرفقة (Document Attachments)
-- ============================================================
create table if not exists document_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entity_type text not null,      -- 'customer' / 'supplier' / 'purchase_order' / 'employee' إلخ
  entity_id uuid,
  file_name text not null,
  category text default 'مستند',   -- عقد / فاتورة / سند / شهادة / مراسلة
  file_size_kb numeric,
  storage_path text,               -- مسار الملف الفعلي (Supabase Storage bucket)
  uploaded_by uuid,
  approved boolean default false,
  approved_by uuid,
  created_at timestamptz default now()
);
alter table document_attachments enable row level security;
create policy "da_select" on document_attachments for select using (is_company_member(company_id));
create policy "da_insert" on document_attachments for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- ============================================================
-- وحدة مفاتيح API والـ Webhooks (للتكاملات الخارجية: تطبيق موبايل، بوابة عملاء)
-- ============================================================
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  token text not null unique,
  is_active boolean default true,
  last_used_at timestamptz,
  created_at timestamptz default now()
);
alter table api_keys enable row level security;
create policy "ak_select" on api_keys for select using (is_company_member(company_id));
create policy "ak_insert" on api_keys for insert with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  event_name text not null,        -- 'invoice.created' / 'payment.received' إلخ
  target_url text not null,
  is_active boolean default true,
  last_triggered_at timestamptz,
  created_at timestamptz default now()
);
alter table webhooks enable row level security;
create policy "wh_select" on webhooks for select using (is_company_member(company_id));
create policy "wh_insert" on webhooks for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- ============================================================
-- مخازن فرعية لكل فرع (Store per Branch) — يكمّل جدول warehouses الموجود
-- ============================================================
alter table warehouses add column if not exists branch_id uuid references branches(id);
alter table warehouses add column if not exists store_type text default 'main' check (store_type in ('main','transit','damaged'));

-- تأسيس مخزن رئيسي تلقائي لأي فرع جديد
create or replace function public.seed_default_store_for_branch(p_company_id uuid, p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_branch record;
begin
  select * into v_branch from branches where id = p_branch_id;
  insert into warehouses (company_id, code, name, branch_id, store_type, is_default)
  values (p_company_id, v_branch.code || '-MAIN', 'مخزن ' || v_branch.name, p_branch_id, 'main', false)
  on conflict do nothing;
end;
$$;
