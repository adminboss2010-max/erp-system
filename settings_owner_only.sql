-- ============================================================
-- تقييد إعدادات الشركة (بيانات الشركة، مفاتيح API، إعدادات واتساب) على المالك بس
-- بالمرة، اكتشفنا واتصلحت 2 bug حقيقيين موجودين من الأساس:
--   1. companies معندهاش UPDATE policy إطلاقًا — زرار "حفظ الإعدادات" كان
--      بيرجع نجاح (ok:true) من غير ما يحفظ أي حاجة فعليًا (فشل صامت).
--   2. whatsapp_settings معندهاش UPDATE policy — أول حفظ (INSERT) بينجح،
--      أي حفظ بعده (UPDATE عبر upsert) بيفشل برسالة RLS صريحة.
-- ============================================================

create or replace function public.is_company_owner(check_company_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from company_users
    where user_id = auth.uid() and company_id = check_company_id and role = 'owner'
  );
$$;

-- companies: أول UPDATE policy على الإطلاق لهذا الجدول
create policy "companies_update_owner_only" on companies
  for update using (is_company_owner(id)) with check (is_company_owner(id) and company_can_write(id));

-- api_keys: كان أي عضو يقدر ينشئ مفتاح API، بقى المالك بس
drop policy if exists "ak_insert" on api_keys;
create policy "ak_insert" on api_keys
  for insert with check (is_company_owner(company_id) and company_can_write(company_id));

-- whatsapp_settings: كان أي عضو يقدر ينشئ، بقى المالك بس + إضافة UPDATE الناقصة
drop policy if exists "ws_insert" on whatsapp_settings;
create policy "ws_insert" on whatsapp_settings
  for insert with check (is_company_owner(company_id) and company_can_write(company_id));
create policy "ws_update_owner_only" on whatsapp_settings
  for update using (is_company_owner(company_id)) with check (is_company_owner(company_id) and company_can_write(company_id));
