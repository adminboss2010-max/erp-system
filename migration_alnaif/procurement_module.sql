-- ============================================================
-- وحدة المشتريات المتقدمة (Procurement + 3-Way Matching) — مستخرجة من غروب النايف
-- الدورة: طلب شراء → أمر شراء (PO) → استلام بضاعة (GR) → فاتورة مورد (VI) → مطابقة ثلاثية
-- ============================================================

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  po_number text not null,
  supplier_id uuid references suppliers(id),
  branch_id uuid,
  currency text default 'KWD',
  trade_discount_pct numeric default 0,
  gross_total numeric not null default 0,
  trade_discount_amount numeric not null default 0,
  net_total numeric not null default 0,
  payment_terms_days int default 30,
  expected_date date,
  notes text,
  is_direct boolean default false,       -- فاتورة مباشرة بدون استلام منفصل
  status text default 'pending_approval' check (status in ('pending_approval','approved','open','partial','closed','cancelled')),
  created_at timestamptz default now(),
  unique(company_id, po_number)
);
alter table purchase_orders enable row level security;
create policy "po_select" on purchase_orders for select using (is_company_member(company_id));
create policy "po_insert" on purchase_orders for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "po_update" on purchase_orders for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  item_id uuid not null references items(id),
  qty numeric not null,
  unit_price numeric not null,
  gross_amount numeric not null,
  discount_amount numeric default 0,
  net_amount numeric not null,
  received_qty numeric default 0,        -- تحدَّث تلقائيًا عند كل استلام
  invoiced_qty numeric default 0,        -- تحدَّث تلقائيًا عند كل فاتورة مورد
  is_free_item boolean default false     -- بضاعة مجانية من المورد (بدون قيمة)
);
alter table purchase_order_lines enable row level security;
create policy "pol_select" on purchase_order_lines for select using (
  exists (select 1 from purchase_orders po where po.id = purchase_order_id and is_company_member(po.company_id))
);

create table if not exists goods_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  gr_number text not null,
  purchase_order_id uuid not null references purchase_orders(id),
  receipt_date date not null default current_date,
  notes text,
  created_at timestamptz default now(),
  unique(company_id, gr_number)
);
alter table goods_receipts enable row level security;
create policy "gr_select" on goods_receipts for select using (is_company_member(company_id));
create policy "gr_insert" on goods_receipts for insert with check (is_company_member(company_id) and company_can_write(company_id));

create table if not exists goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references goods_receipts(id) on delete cascade,
  purchase_order_line_id uuid not null references purchase_order_lines(id),
  item_id uuid not null references items(id),
  received_qty numeric not null
);
alter table goods_receipt_lines enable row level security;
create policy "grl_select" on goods_receipt_lines for select using (
  exists (select 1 from goods_receipts gr where gr.id = goods_receipt_id and is_company_member(gr.company_id))
);

create table if not exists vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  vi_number text not null,
  supplier_id uuid references suppliers(id),
  purchase_order_id uuid references purchase_orders(id),  -- فارغ لو فاتورة مباشرة بدون PO
  invoice_date date not null default current_date,
  gross_total numeric not null,
  net_total numeric not null,
  three_way_matched boolean default false,
  match_variance numeric default 0,       -- الفرق (لو موجود) بين PO والاستلام والفاتورة
  journal_entry_id uuid references journal_entries(id),
  created_at timestamptz default now(),
  unique(company_id, vi_number)
);
alter table vendor_invoices enable row level security;
create policy "vi_select" on vendor_invoices for select using (is_company_member(company_id));
create policy "vi_insert" on vendor_invoices for insert with check (is_company_member(company_id) and company_can_write(company_id));

-- ============================================================
-- دالة إنشاء أمر شراء كامل (مع بنوده)
-- ============================================================
create or replace function public.create_purchase_order(
  p_company_id uuid, p_supplier_id uuid, p_items jsonb,   -- [{item_id, qty, unit_price}]
  p_trade_discount_pct numeric default 0, p_payment_terms_days int default 30,
  p_expected_date date default null, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item jsonb;
  v_gross numeric := 0; v_net numeric := 0; v_disc_amt numeric;
  v_po_id uuid; v_po_number text; v_po_count int;
  v_line_gross numeric; v_line_disc numeric; v_line_net numeric;
begin
  select count(*) into v_po_count from purchase_orders where company_id = p_company_id;
  v_po_number := 'PO-' || extract(year from current_date) || '-' || lpad((v_po_count + 1)::text, 4, '0');

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_gross := (v_item->>'qty')::numeric * (v_item->>'unit_price')::numeric;
    v_gross := v_gross + v_line_gross;
  end loop;
  v_disc_amt := v_gross * p_trade_discount_pct / 100;
  v_net := v_gross - v_disc_amt;

  insert into purchase_orders (company_id, po_number, supplier_id, trade_discount_pct, gross_total, trade_discount_amount, net_total, payment_terms_days, expected_date, notes, status)
  values (p_company_id, v_po_number, p_supplier_id, p_trade_discount_pct, v_gross, v_disc_amt, v_net, p_payment_terms_days, p_expected_date, p_notes, 'approved')
  returning id into v_po_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_line_gross := (v_item->>'qty')::numeric * (v_item->>'unit_price')::numeric;
    v_line_disc := v_line_gross * p_trade_discount_pct / 100;
    v_line_net := v_line_gross - v_line_disc;
    insert into purchase_order_lines (purchase_order_id, item_id, qty, unit_price, gross_amount, discount_amount, net_amount)
    values (v_po_id, (v_item->>'item_id')::uuid, (v_item->>'qty')::numeric, (v_item->>'unit_price')::numeric, v_line_gross, v_line_disc, v_line_net);
  end loop;

  return jsonb_build_object('po_id', v_po_id, 'po_number', v_po_number, 'net_total', v_net);
end;
$$;

-- ============================================================
-- دالة تسجيل استلام بضاعة (يحدّث received_qty فى بنود الـ PO ويزيد المخزون الفعلي)
-- ============================================================
create or replace function public.receive_goods(
  p_company_id uuid, p_purchase_order_id uuid, p_lines jsonb  -- [{po_line_id, received_qty}]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_line jsonb;
  v_po_line record;
  v_gr_id uuid; v_gr_number text; v_gr_count int;
  v_new_status text;
  v_all_received boolean := true;
  v_any_received boolean := false;
begin
  select count(*) into v_gr_count from goods_receipts where company_id = p_company_id;
  v_gr_number := 'GR-' || extract(year from current_date) || '-' || lpad((v_gr_count + 1)::text, 4, '0');

  insert into goods_receipts (company_id, gr_number, purchase_order_id)
  values (p_company_id, v_gr_number, p_purchase_order_id)
  returning id into v_gr_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_po_line from purchase_order_lines where id = (v_line->>'po_line_id')::uuid;

    insert into goods_receipt_lines (goods_receipt_id, purchase_order_line_id, item_id, received_qty)
    values (v_gr_id, v_po_line.id, v_po_line.item_id, (v_line->>'received_qty')::numeric);

    update purchase_order_lines set received_qty = received_qty + (v_line->>'received_qty')::numeric
    where id = v_po_line.id;

    -- زيادة المخزون الفعلي وتسجيل حركة مخزون
    update items set stock_qty = stock_qty + (v_line->>'received_qty')::numeric
    where id = v_po_line.item_id and company_id = p_company_id;

    insert into stock_movements (company_id, item_id, movement_type, qty, unit_cost, reference_doc_no, notes)
    values (p_company_id, v_po_line.item_id, 'purchase_in', (v_line->>'received_qty')::numeric, v_po_line.unit_price, v_gr_number, 'استلام لأمر شراء');
  end loop;

  -- تحديث حالة أمر الشراء (مفتوح/جزئي/مكتمل) حسب نسبة الاستلام الكلية
  select
    bool_and(received_qty >= qty), bool_or(received_qty > 0)
  into v_all_received, v_any_received
  from purchase_order_lines where purchase_order_id = p_purchase_order_id;

  v_new_status := case when v_all_received then 'closed' when v_any_received then 'partial' else 'open' end;
  update purchase_orders set status = v_new_status where id = p_purchase_order_id;

  return jsonb_build_object('gr_id', v_gr_id, 'gr_number', v_gr_number, 'po_status', v_new_status);
end;
$$;

-- ============================================================
-- دالة تسجيل فاتورة مورد + تنفيذ المطابقة الثلاثية (3-Way Match) + قيد محاسبي
-- ============================================================
create or replace function public.post_vendor_invoice(
  p_company_id uuid, p_supplier_id uuid, p_purchase_order_id uuid, p_invoice_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_po record;
  v_vi_id uuid; v_vi_number text; v_vi_count int;
  v_matched boolean; v_variance numeric;
  v_je_id uuid;
begin
  select count(*) into v_vi_count from vendor_invoices where company_id = p_company_id;
  v_vi_number := 'VI-' || extract(year from current_date) || '-' || lpad((v_vi_count + 1)::text, 4, '0');

  select * into v_po from purchase_orders where id = p_purchase_order_id;
  if v_po is null then raise exception 'أمر الشراء غير موجود'; end if;

  -- المطابقة الثلاثية: الفاتورة لازم تساوي (أو قريبة جدًا من) صافي أمر الشراء المستلَم فعليًا
  v_variance := abs(p_invoice_amount - v_po.net_total);
  v_matched := v_variance < 0.01 and v_po.status in ('closed','partial');

  insert into vendor_invoices (company_id, vi_number, supplier_id, purchase_order_id, gross_total, net_total, three_way_matched, match_variance)
  values (p_company_id, v_vi_number, p_supplier_id, p_purchase_order_id, p_invoice_amount, p_invoice_amount, v_matched, v_variance)
  returning id into v_vi_id;

  -- تحديث invoiced_qty لكل بند (نفس الكمية المستلمة بافتراض الفاتورة الكاملة)
  update purchase_order_lines set invoiced_qty = received_qty where purchase_order_id = p_purchase_order_id;

  -- القيد المحاسبي: مدين مخزون (أو مصروف)، دائن ذمم الموردين
  v_je_id := post_journal_entry(
    p_company_id, 'فاتورة مورد ' || v_vi_number || ' - أمر شراء ' || v_po.po_number,
    'vendor_invoice', v_vi_number,
    jsonb_build_array(
      jsonb_build_object('account_code','150701','debit',p_invoice_amount,'credit',0,'description','مخزون بضاعة'),
      jsonb_build_object('account_code','210201','debit',0,'credit',p_invoice_amount,'description','ذمم الموردين المحليين')
    )
  );
  update vendor_invoices set journal_entry_id = v_je_id where id = v_vi_id;

  -- تحديث رصيد المورد (زيادة الالتزام)
  if p_supplier_id is not null then
    update suppliers set balance = balance + p_invoice_amount where id = p_supplier_id and company_id = p_company_id;
  end if;

  return jsonb_build_object('vi_id', v_vi_id, 'vi_number', v_vi_number, 'matched', v_matched, 'variance', v_variance);
end;
$$;
