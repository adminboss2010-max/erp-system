-- ============================================================
-- Storage bucket للوجوهات الشركات: رفع المالك فقط، قراءة عامة
-- (اللوجو مش بيانات حساسة، ولازم يظهر فى صفحات الطباعة المستقلة)
-- المسار المتوقع لكل ملف: {company_id}/logo.<ext>
-- ============================================================

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

create policy "company_logos_public_read" on storage.objects
  for select using (bucket_id = 'company-logos');

create policy "company_logos_owner_write" on storage.objects
  for insert with check (
    bucket_id = 'company-logos'
    and is_company_owner((storage.foldername(name))[1]::uuid)
  );

create policy "company_logos_owner_update" on storage.objects
  for update using (
    bucket_id = 'company-logos'
    and is_company_owner((storage.foldername(name))[1]::uuid)
  );

create policy "company_logos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'company-logos'
    and is_company_owner((storage.foldername(name))[1]::uuid)
  );
