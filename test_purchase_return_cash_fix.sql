SELECT post_purchase_return_transaction(
  p_company_id := '4364d955-c010-4b20-bf10-71597509ef2f'::uuid,
  p_supplier_id := null,
  p_items := '[{"item_id":"c139ded7-457f-4c0b-b3ca-a056e7882766","qty":1,"unit_cost":5}]'::jsonb,
  p_is_credit := false,
  p_ref_doc_no := '6'
);
