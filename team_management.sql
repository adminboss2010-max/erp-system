-- ============================================================
-- إدارة فريق العمل: عرض الأعضاء، دعوة عضو موجود بالفعل، تغيير دور، إزالة عضو
-- company_users سياسة RLS الوحيدة عليها حاليًا SELECT بس على صف المستخدم نفسه،
-- ومفيش أي INSERT/UPDATE/DELETE policy إطلاقًا — فأي تعديل لازم يمر بدالة
-- security definer بتتحقق من صلاحية المستدعي يدويًا قبل التنفيذ.
-- ============================================================

create or replace function public.list_company_team(p_company_id uuid)
returns table(id uuid, user_id uuid, role text, email text, created_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from company_users cu2 where cu2.company_id = p_company_id and cu2.user_id = auth.uid()
  ) then
    raise exception 'غير مصرح لك بعرض فريق هذه الشركة';
  end if;

  return query
  select cu.id, cu.user_id, cu.role, u.email::text, cu.created_at
  from company_users cu
  join auth.users u on u.id = cu.user_id
  where cu.company_id = p_company_id
  order by cu.created_at asc;
end;
$$;

create or replace function public.invite_user_to_company(p_company_id uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_target_user_id uuid;
begin
  if not exists (
    select 1 from company_users where company_id = p_company_id and user_id = auth.uid() and role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'error', 'فقط مالك الشركة يقدر يضيف أعضاء');
  end if;

  if p_role not in ('owner','manager','staff') then
    return jsonb_build_object('ok', false, 'error', 'دور غير صحيح');
  end if;

  select id into v_target_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_target_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'مفيش حساب مسجل بهذا الإيميل — لازم الشخص يعمل تسجيل حساب أولاً من صفحة التسجيل، وبعدها تقدر تضيفه');
  end if;

  if exists (select 1 from company_users where company_id = p_company_id and user_id = v_target_user_id) then
    return jsonb_build_object('ok', false, 'error', 'المستخدم عضو بالفعل فى هذه الشركة');
  end if;

  insert into company_users (user_id, company_id, role) values (v_target_user_id, p_company_id, p_role);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.update_team_member_role(p_company_id uuid, p_target_user_id uuid, p_new_role text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner_count int;
begin
  if not exists (
    select 1 from company_users where company_id = p_company_id and user_id = auth.uid() and role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'error', 'فقط مالك الشركة يقدر يغيّر الأدوار');
  end if;

  if p_new_role not in ('owner','manager','staff') then
    return jsonb_build_object('ok', false, 'error', 'دور غير صحيح');
  end if;

  if p_new_role <> 'owner' then
    select count(*) into v_owner_count from company_users
    where company_id = p_company_id and role = 'owner' and user_id <> p_target_user_id;
    if v_owner_count = 0 then
      return jsonb_build_object('ok', false, 'error', 'لازم يفضل مالك واحد على الأقل للشركة');
    end if;
  end if;

  update company_users set role = p_new_role
  where company_id = p_company_id and user_id = p_target_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_team_member(p_company_id uuid, p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner_count int;
begin
  if not exists (
    select 1 from company_users where company_id = p_company_id and user_id = auth.uid() and role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'error', 'فقط مالك الشركة يقدر يشيل أعضاء');
  end if;

  if exists (select 1 from company_users where company_id = p_company_id and user_id = p_target_user_id and role = 'owner') then
    select count(*) into v_owner_count from company_users
    where company_id = p_company_id and role = 'owner' and user_id <> p_target_user_id;
    if v_owner_count = 0 then
      return jsonb_build_object('ok', false, 'error', 'لازم يفضل مالك واحد على الأقل للشركة');
    end if;
  end if;

  delete from company_users where company_id = p_company_id and user_id = p_target_user_id;
  return jsonb_build_object('ok', true);
end;
$$;
