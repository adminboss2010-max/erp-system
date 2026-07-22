# SUPABASE_MIGRATION_LOG.md — سجل تنفيذ هجرة Supabase

> **لأي AI (Claude أو غيره) يعمل على هذا المشروع لاحقًا**: هذا الملف يوثّق ما تم تنفيذه فعليًا من `خطة_الهجرة_Supabase.md`. اقرأه بعد `AI_CONTEXT.md` مباشرة قبل أي متابعة على هذا المسار.

**القرار الأساسي المتبع**: هجرة موازية، مش استبدال فوري. النظام الحالي (Google Apps Script) لسه شغال زي ما هو ومنلمسوش. النظام الجديد (Supabase) بيتبني جنبه، ومنقرر الانتقال الفعلي بس بعد اختبار كامل.

**⚠️ تصحيح مهم لطبيعة المشروع (اتضح أثناء المرحلة 2)**: النظام مش لجمعية المسايل فقط للاستخدام الداخلي — الهدف الفعلي هو **منتج SaaS** يُباع لشركات تانية. ده كان قرار غائب وقت كتابة `AI_CONTEXT.md` الأصلي، وأثّر بشكل مباشر على تصميم الـ Auth (تسجيل ذاتي مفتوح، مش حسابات تُنشأ يدويًا بس). أي قراءة لهذا الملف يجب أن تأخذ في الاعتبار أن النظام SaaS متعدد المستأجرين للبيع، مش أداة داخلية فقط.

---

## الحالة الحالية: المرحلة 1 — مكتملة ✅

### معلومات المشروع
- **اسم المشروع على Supabase**: `erp-system`
- **Project ID**: `ucgujtkehiihlygykegx`
- **Project URL**: `https://ucgujtkehiihlygykegx.supabase.co`
- **Region**: `ap-northeast-2` (Seoul) — ملاحظة: كانت الخطة الأصلية تقترح Frankfurt، لكن اتعمل المشروع على Seoul. مش مشكلة جوهرية، بس فيه زيادة بسيطة في الـ latency من الكويت. لو حصلت إعادة بناء للمشروع من الصفر مستقبلاً، يُفضّل Frankfurt.
- **Organization**: `prova erp` (Free plan)

### المفاتيح (Publishable key آمن للمشاركة، الباقي لأ)
- **Publishable key**: `sb_publishable_-eZRHFrYinn3WKCWPI_JAg_ltFV_HMX` (آمن، للاستخدام في كود الواجهة الأمامية)
- **Secret key**: محفوظ عند صاحب المشروع فقط، **لا يُكتب في أي كود أو ملف داخل الريبو أبدًا**. يُستخدم مستقبلاً فقط داخل Supabase Edge Functions كـ environment variable.

### السكيمة المنفذة فعليًا (8 جداول)

| الجدول | الغرض | ملاحظة |
|---|---|---|
| `companies` | هوية الشركة الثابتة (اسم، عنوان، رقم ضريبي، حالة) | لا تحتوي إعدادات متغيرة |
| `company_settings` | إعدادات مرنة قابلة للتغيير (عمود `jsonb`) | فُصلت عمدًا عن `companies` لتجنب migrations متكررة |
| `company_users` | ربط مستخدمين بشركات (many-to-many) مع `role` (owner/manager/staff) | أساس آلية الـ multi-tenancy بالكامل |
| `customers` | العملاء | يقابل تاب "العملاء" بالشيت الحالي |
| `agents` | المناديب | يقابل تاب "المناديب" |
| `items` | الأصناف | يقابل تاب "الأصناف" |
| `transactions` | المعاملات (sale/return/payment) | يقابل تاب "المعاملات" |
| `audit_log` | سجل التدقيق | يقابل تاب "AuditLog" |

**قرار متعمد**: تاب "AppState" (المخفي في الشيت الحالي) **لم يُنقل لقاعدة البيانات** — لأنه حالة واجهة بس (آخر شاشة، فلاتر محفوظة)، مش بيانات عمل فعلية. هيفضل محليًا عند المستخدم (localStorage/session) حتى بعد اكتمال الهجرة.

### الأمان (RLS) — مفعّل ومُختبر فعليًا

- RLS مفعّل (`rowsecurity = true`) على كل الجداول الثمانية — تم التحقق منه مباشرة عبر:
  ```sql
  select tablename, rowsecurity from pg_tables where schemaname = 'public';
  ```
- دالة مساعدة موحّدة `is_company_member(check_company_id uuid)` تُستخدم في كل سياسات العزل (بدل تكرار نفس المنطق 8 مرات).
- سياسات عزل منفصلة لكل جدول (`company_isolation_*`).
- **تم اختبار العزل فعليًا وعمليًا** (مش افتراض نظري) عن طريق محاكاة جلسة `authenticated` بـ:
  ```sql
  select set_config('request.jwt.claims', json_build_object('sub', '<user_uid>')::text, true);
  set local role authenticated;
  select * from companies;
  ```
  - مستخدم عضو في شركة → شاف شركته فقط (صف واحد) ✅
  - مستخدم وهمي (UID عشوائي غير موجود) → لم يشاهد أي صف (0 rows) ✅

### أول بيانات تجريبية

- **أول مستخدم (Auth)**: تم إنشاؤه عبر Supabase Authentication → Add user، بـ Auto Confirm.
  - User UID: `bb4ddcdc-5a4d-450f-b365-890a4a646800`
- **أول شركة**: `شركة تجربة MCP` (`name_en: MCP Test Co`)
  - Company ID: `4364d955-c010-4b20-bf10-71597509ef2f`
- **الربط**: المستخدم أعلاه مربوط بالشركة أعلاه بدور `owner` في `company_users`.

---

## المرحلة 2 — المصادقة (Auth) — مكتملة ✅

### القرار النهائي: نموذج onboarding

- **تسجيل ذاتي مفتوح** (self-service signup) — أي حد يقدر يعمل حساب لنفسه من الموقع مباشرة
- **فترة تجربة مجانية 14 يوم** لكل شركة جديدة، بعدها **قفل جزئي (Read-only)** تلقائي لحد ما تشترك (نظام الدفع نفسه لسه مش محدد، هيتقرر لاحقًا وهيتكامل فوق نفس الآلية من غير تعديل جوهري)
- **أول مستخدم يسجل = owner تلقائي** لشركته الجديدة (مفيش مرحلة وسيطة أو موافقة يدوية)

### إعدادات Supabase Auth المفعّلة

- **Allow new users to sign up**: ON (التسجيل الذاتي مفتوح)
- **Confirm email**: ON (لازم تأكيد إيميل — أمان ضروري لنظام عام)
- **Email provider**: Enabled

### آلية "شركة تلقائية لكل مستخدم جديد" (Database Trigger)

عمود جديد أُضيف لجدول `companies`:
```sql
alter table companies add column trial_ends_at timestamptz;
```

دالة + Trigger على `auth.users` (ينفّذ تلقائيًا عند أي `insert` جديد في المستخدمين):
```sql
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_company_id uuid;
begin
  insert into public.companies (name_ar, name_en, status, plan, trial_ends_at)
  values (
    coalesce(new.raw_user_meta_data->>'company_name_ar', 'شركة جديدة'),
    new.raw_user_meta_data->>'company_name_en',
    'active',
    'trial',
    now() + interval '14 days'
  )
  returning id into new_company_id;

  insert into public.company_users (user_id, company_id, role)
  values (new.id, new_company_id, 'owner');

  return new;
end;
$$ language plpgsql security definer
set search_path = public, auth;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**⚠️ درس تقني مهم (لأي تعديل مستقبلي على دوال مشابهة)**: أي دالة بـ `security definer` بتتنفذ ضمن Trigger على `auth.users` **لازم** تستخدم أسماء جداول مؤهّلة بالكامل (`public.companies` مش `companies` بس) + `set search_path = public, auth` صريح في تعريف الدالة. من غيرها بتفشل بخطأ `relation "X" does not exist` رغم إن الجدول موجود فعليًا — لأن مسار البحث الافتراضي لسياق `auth` مابيشملش `public` تلقائيًا. تم اكتشاف المشكلة دي فعليًا وتم حلها (راجع تفاصيل التشخيص في تاريخ الشات لو محتاج).

**ملاحظة**: اسم الشركة (`company_name_ar`) بيجي من "user metadata" وقت التسجيل من نموذج التسجيل في الواجهة الأمامية (لسه مش مبني). لو مفيش اسم مبعوت، بيتحط اسم افتراضي "شركة جديدة".

### آلية القفل الجزئي بعد انتهاء التجربة (Read-only enforcement)

دالة مساعدة:
```sql
create or replace function public.company_can_write(check_company_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.companies
    where id = check_company_id
    and (
      plan <> 'trial'
      or trial_ends_at is null
      or trial_ends_at > now()
    )
  );
$$ language sql security definer stable;
```

السياسات على `customers`, `agents`, `items`, `transactions`, `company_settings` أُعيد بناؤها لفصل القراءة عن الكتابة: `select` مفتوح دايمًا لأي عضو، بينما `insert`/`update`/`delete` بتتطلب `company_can_write` كمان. النمط المستخدم لكل جدول (مثال `customers`):
```sql
create policy "customers_select" on customers for select using (is_company_member(company_id));
create policy "customers_insert" on customers for insert with check (is_company_member(company_id) and company_can_write(company_id));
create policy "customers_update" on customers for update using (is_company_member(company_id)) with check (is_company_member(company_id) and company_can_write(company_id));
create policy "customers_delete" on customers for delete using (is_company_member(company_id) and company_can_write(company_id));
```
نفس النمط تكرر لـ `agents`, `items`, `transactions`, `company_settings` (بدون `delete` لـ `company_settings`).

**قرار متعمد**: جدول `audit_log` **لم يُعدَّل** — سيب سياسة العزل البسيطة القديمة بدون فصل قراءة/كتابة، لأنه سجل تدقيق نظامي مش عملية مستخدم مباشرة، ومنطقيًا ميتقفلش حتى لو الشركة `read-only`.

**قرار مؤجل عمدًا**: نظام الدفع الفعلي (بوابة دفع، فواتير) لسه مش محدد ولا مبني. الآلية الحالية مصممة عشان أي تكامل دفع مستقبلي يحتاج بس يحدّث عمود `plan` في `companies` من غير أي تعديل تاني في منطق القفل نفسه.

### الاختبار الفعلي (End-to-End)، تم وأثبت نجاح الآلية بالكامل

1. **اختبار التسجيل الذاتي**: مستخدم تجريبي (`test@gmail.com`) اتعمل من Authentication → Add user → اتفعّل الـ Trigger أوتوماتيك → شركة "شركة جديدة" اتعملت (`trial`, `trial_ends_at` = +14 يوم) → المستخدم اترتبط كـ `owner`. تم التحقق مباشرة من الجدول. ✅
2. **اختبار القفل بعد انتهاء التجربة**: اتعملت شركة وهمية بـ `trial_ends_at` في الماضي، وربط `test@gmail.com` بيها مؤقتًا، ومحاكاة جلسته:
   - القراءة (`select` من `companies`) → نجحت ✅
   - الكتابة (`insert` في `customers`) → اترفضت فعليًا برسالة `new row violates row-level security policy for table "customers"` ✅
   - بعد الاختبار: تم حذف الربط والشركة الوهمية بالكامل (تنظيف بيانات الاختبار)

---

## الخطوة الجاية (لم تبدأ بعد): المرحلة 3 — API (استبدال Code.gs بـ Edge Functions)

**قبل البدء في المرحلة 3، يجب التأكد من**:
1. هل الملف ده (`SUPABASE_MIGRATION_LOG.md`) اتضاف فعليًا للريبو على GitHub؟
2. هل فيه أي تعديل حصل على السكيمة أو السياسات من وقت كتابة هذا الملف؟ (تحقق مباشرة من Supabase Dashboard)
3. اقرأ `خطة_الهجرة_Supabase.md` قسم "المرحلة 3" قبل أي تنفيذ.
4. نظام الدفع لسه غير محدد — لو اتقرر شكله قبل المرحلة 3، يفيد يُوثّق هنا أول.

---

## ملاحظة تشغيلية مهمة

كل خطوات هذه المرحلة اتنفذت يدويًا عبر واجهة Supabase Dashboard مباشرة (SQL Editor + Authentication) من متصفح المستخدم، **مش عبر أدوات MCP** (لأن الجلسة كانت على claude.ai في المتصفح، وأدوات MCP الموصوفة في `README_MCP_Project.md` تعمل فقط داخل Claude Code). لو حبيت تكمل عبر MCP لاحقًا، لازم تضاف أداة MCP جديدة للتعامل مع Supabase (مش موجودة حاليًا في السيرفر المحلي `D:\erp-mcp-server` — الأدوات الحالية بتاعته لـ GitHub و Google Sheets بس).
