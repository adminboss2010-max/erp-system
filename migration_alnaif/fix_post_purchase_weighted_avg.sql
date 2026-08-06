-- ============================================================
-- تصحيح post_purchase_transaction: استخدام المتوسط المرجح الحقيقي (IAS 2)
-- بدل استبدال unit_cost بآخر سعر شراء مباشرة
-- يعتمد على weighted_average_cost() المُنشأة فى inventory_valuation_stdcost_module.sql
-- ============================================================
create or replace function public.post_purchase_transaction(
  p_company_id uuid, p_supplier_id uuid, p_items jsonb, p_is_credit boolean, p_doc_no text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_unit_cost numeric;
  v_tax_rate numeric;
  v_unit_name text;
  v_unit_factor numeric;
  v_base_qty numeric;
  v_generated_doc_no text;
  v_new_transaction_id uuid;
  v_line_amount numeric;
  v_line_tax numeric;
  v_grand_total numeric := 0;
  v_grand_tax numeric := 0;
  v_transaction_ids uuid[] := array[]::uuid[];
  v_items_result jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'الفاتورة يجب أن تحتوي على مصفوفة أصناف';
  end if;

  if p_doc_no is null then
    update companies set last_doc_number = last_doc_number + 1
    where id = p_company_id
    returning last_doc_number into v_generated_doc_no;
  else
    v_generated_doc_no := p_doc_no;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_id := (v_item->>'item_id')::uuid;
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    v_tax_rate := coalesce((v_item->>'tax_rate')::numeric, 0);
    v_unit_name := v_item->>'uom_unit_name';

    if v_item_id is null or v_qty is null or v_qty <= 0 then
      raise exception 'بيانات صنف غير صحيحة داخل الفاتورة';
    end if;

    v_unit_factor := 1;
    if v_unit_name is not null then
      select ugu.conversion_factor into v_unit_factor
      from uom_group_units ugu
      join items i on i.uom_group_id = ugu.uom_group_id
      where i.id = v_item_id and ugu.unit_name = v_unit_name;
      if v_unit_factor is null then
        raise exception 'الوحدة "%" غير معرّفة لهذا الصنف', v_unit_name;
      end if;
    end if;
    v_base_qty := v_qty * v_unit_factor;

    perform 1 from items where id = v_item_id and company_id = p_company_id for update;
    if not found then raise exception 'الصنف % غير موجود', v_item_id; end if;

    -- ✅ تصحيح: متوسط مرجح حقيقي بدل استبدال unit_cost بآخر سعر شراء
    update items set
      unit_cost = weighted_average_cost(stock_qty, unit_cost, v_base_qty, v_unit_cost / nullif(v_unit_factor,0)),
      stock_qty = stock_qty + v_base_qty
    where id = v_item_id and company_id = p_company_id;

    v_line_amount := v_qty * coalesce(v_unit_cost, 0);
    v_line_tax := v_line_amount * v_tax_rate / 100;
    v_grand_total := v_grand_total + v_line_amount;
    v_grand_tax := v_grand_tax + v_line_tax;

    -- 🛠️ إصلاح: عمود credit كان بيتسجل 0 حرفيًا دايمًا (حتى للشراء النقدي)
    insert into transactions (company_id, doc_no, type, supplier_id, item_id, qty, unit_cost, debit, credit, tax_rate, tax_amount)
    values (p_company_id, v_generated_doc_no, 'purchase', p_supplier_id, v_item_id, v_qty, v_unit_cost,
      case when p_is_credit then v_line_amount + v_line_tax else 0 end,
      case when p_is_credit then 0 else v_line_amount + v_line_tax end,
      v_tax_rate, v_line_tax)
    returning id into v_new_transaction_id;

    insert into stock_movements (company_id, item_id, movement_type, qty, unit_cost, reference_doc_no, reference_transaction_id, notes)
    values (p_company_id, v_item_id, 'purchase_in', v_base_qty, v_unit_cost, v_generated_doc_no, v_new_transaction_id,
      case when v_unit_name is not null then 'شراء: ' || v_qty || ' ' || v_unit_name else null end);

    v_transaction_ids := array_append(v_transaction_ids, v_new_transaction_id);
    v_items_result := v_items_result || jsonb_build_object('item_id', v_item_id, 'qty', v_qty, 'unit', v_unit_name, 'transaction_id', v_new_transaction_id);
  end loop;

  if p_is_credit and p_supplier_id is not null then
    update suppliers set balance = balance + v_grand_total + v_grand_tax
    where id = p_supplier_id and company_id = p_company_id;
  end if;

  perform post_journal_entry(
    p_company_id,
    'قيد شراء تلقائى - فاتورة ' || v_generated_doc_no,
    'purchase', v_generated_doc_no,
    (
      select jsonb_agg(line) from (
        select jsonb_build_object('account_code', '1200', 'debit', v_grand_total, 'credit', 0, 'description', 'زيادة المخزون') as line
        union all
        select jsonb_build_object('account_code', '1300', 'debit', v_grand_tax, 'credit', 0, 'description', 'ضريبة مدخلات')
        where v_grand_tax > 0
        union all
        select jsonb_build_object(
          'account_code', case when p_is_credit then '2000' else '1000' end,
          'debit', 0, 'credit', v_grand_total + v_grand_tax, 'description', 'إجمالي فاتورة الشراء'
        )
      ) x
    )
  );

  insert into audit_log (company_id, actor, action, doc_no, details)
  values (p_company_id, 'system', 'post_purchase', v_generated_doc_no,
    jsonb_build_object('items', p_items, 'total_amount', v_grand_total, 'tax_amount', v_grand_tax, 'is_credit', p_is_credit));

  return jsonb_build_object('doc_no', v_generated_doc_no, 'total_amount', v_grand_total, 'tax_amount', v_grand_tax,
    'grand_total', v_grand_total + v_grand_tax, 'transaction_ids', v_transaction_ids, 'items', v_items_result);
end;
$$;
