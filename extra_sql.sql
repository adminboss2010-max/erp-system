-- ============================================================
-- إضافات SQL أخيرة: مقارنة فترات + تنبؤ بمتوسط متحرك + عرض قوالب سير العمل
-- ============================================================

-- دالة مقارنة فترتين (مبيعات، مشتريات، عدد عملاء نشطين)
create or replace function public.compare_periods(
  p_company_id uuid, p_period1_start date, p_period1_end date, p_period2_start date, p_period2_end date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
stable
as $$
declare
  v_p1_sales numeric; v_p2_sales numeric;
  v_p1_purchases numeric; v_p2_purchases numeric;
  v_p1_customers int; v_p2_customers int;
begin
  select coalesce(sum(debit+credit),0) into v_p1_sales from transactions
    where company_id = p_company_id and type = 'sale' and date::date between p_period1_start and p_period1_end;
  select coalesce(sum(debit+credit),0) into v_p2_sales from transactions
    where company_id = p_company_id and type = 'sale' and date::date between p_period2_start and p_period2_end;

  select coalesce(sum(debit+credit),0) into v_p1_purchases from transactions
    where company_id = p_company_id and type = 'purchase' and date::date between p_period1_start and p_period1_end;
  select coalesce(sum(debit+credit),0) into v_p2_purchases from transactions
    where company_id = p_company_id and type = 'purchase' and date::date between p_period2_start and p_period2_end;

  select count(distinct customer_id) into v_p1_customers from transactions
    where company_id = p_company_id and type = 'sale' and date::date between p_period1_start and p_period1_end;
  select count(distinct customer_id) into v_p2_customers from transactions
    where company_id = p_company_id and type = 'sale' and date::date between p_period2_start and p_period2_end;

  return jsonb_build_object(
    'period1', jsonb_build_object('sales', v_p1_sales, 'purchases', v_p1_purchases, 'active_customers', v_p1_customers),
    'period2', jsonb_build_object('sales', v_p2_sales, 'purchases', v_p2_purchases, 'active_customers', v_p2_customers),
    'sales_growth_pct', case when v_p1_sales > 0 then round((v_p2_sales - v_p1_sales) / v_p1_sales * 100, 1) else null end,
    'purchases_growth_pct', case when v_p1_purchases > 0 then round((v_p2_purchases - v_p1_purchases) / v_p1_purchases * 100, 1) else null end
  );
end;
$$;

-- View: مبيعات شهرية (آخر 12 شهر) — أساس التنبؤ بالمتوسط المتحرك
create or replace view monthly_sales_trend as
select
  company_id,
  to_char(date, 'YYYY-MM') as month,
  sum(debit + credit) as total_sales,
  count(distinct doc_no) as invoice_count
from transactions
where type = 'sale'
group by company_id, to_char(date, 'YYYY-MM')
order by month;

grant select on monthly_sales_trend to authenticated;

-- ============================================================
-- View: تصنيف العملاء حسب النمو والخصومات (بديل "عروض الجمعيات")
-- ============================================================
create or replace view customer_offers_segment as
select
  id as customer_id, company_id, name, growth_rate, discount_value, balance,
  case
    when growth_rate >= 20 then 'نامي بقوة — رشّح لعرض توسّع'
    when growth_rate >= 5 then 'نامي — حافظ على الزخم'
    when growth_rate <= -10 then 'متعثر — يحتاج تدخل عاجل'
    else 'مستقر'
  end as recommendation,
  case
    when growth_rate >= 20 then 'growth'
    when growth_rate <= -10 then 'risk'
    else 'stable'
  end as segment_key
from customers;

grant select on customer_offers_segment to authenticated;
