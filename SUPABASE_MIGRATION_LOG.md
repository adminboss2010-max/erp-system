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

## المرحلة 3 — API (استبدال Code.gs بـ Edge Functions) — بدأت فعليًا 🔶

### قرار معماري أساسي: مش كل شيء يحتاج Edge Function

- العمليات البسيطة على جدول واحد (إضافة عميل، تعديل صنف، عرض قائمة) → **تُستخدم PostgREST التلقائي** من Supabase مباشرة من الواجهة الأمامية، بدون أي كود سيرفر إضافي، لأن الأمان مضمون بالكامل عبر RLS من المرحلة 1
- **Edge Functions تُبنى فقط للعمليات المركّبة (composite/atomic)** التي تلمس أكثر من جدول ويجب أن تنجح أو تفشل ككل — بديل مباشر لمنطق `Code.gs` القديم

### أدوات التطوير المحلية (على جهاز المستخدم، Windows)

- **Supabase CLI** مثبت عبر `npm install -g supabase` — تم تغيير مسار تثبيت npm العام إلى `D:\npm-global` (بدل المسار الافتراضي على C) بسبب ضيق مساحة C. الخطوات: `npm config set prefix "D:\npm-global"` + إضافة المسار لمتغير `Path` في Windows Environment Variables + إعادة فتح الـ Terminal.
- تسجيل الدخول: `supabase login`
- الريبو محمّل محليًا في: **`D:\erp-system-main`**
- تم الربط بمشروع Supabase الفعلي داخل هذا المجلد عبر: `supabase init` ثم `supabase link --project-ref ucgujtkehiihlygykegx`
- **⚠️ ملاحظة بيئة**: PowerShell (مش CMD) هو الـ shell المستخدم فعليًا على جهاز المستخدم. أمر `cd /d D:\...` الخاص بـ CMD **لا يعمل في PowerShell** — استُخدم بدلاً منه `cd D:\...` مباشرة (بدون `/d`). أي تعليمات مستقبلية يجب أن تفترض PowerShell كـ shell افتراضي على هذا الجهاز، لا CMD.
- `git` غير متاح حاليًا في PATH بتاع PowerShell على هذا الجهاز (لم يُحل بعد، لم يكن ضروريًا لأن الريبو كان محمّلاً مسبقًا يدويًا وليس عبر `git clone`).

### أول Edge Function مبنية بالكامل ومُختبرة: `post-sale`

**الموقع**: `D:\erp-system-main\supabase\functions\post-sale\index.ts`

**الوظيفة**: تسجيل معاملة بيع كاملة بشكل ذري (atomic): التحقق من المخزون → تحديث المخزون → تحديث رصيد العميل (لو بيع بالآجل) → تسجيل المعاملة → تسجيل audit_log — كل هذا في استدعاء واحد عبر دالة قاعدة بيانات RPC اسمها `post_sale_transaction` (وليس منطق JavaScript متفرق، لضمان الذرية الحقيقية عبر transaction واحدة في PostgreSQL نفسه).

**قرارات عمل حُسمت أثناء البناء**:
- **اتجاه رصيد العميل عند البيع**: بيع بالآجل (`is_credit = true`) → رصيد العميل **يزيد** (مديون للشركة، Accounts Receivable). بيع نقدي → الرصيد لا يتأثر.
- **سياسة نفاد المخزون**: **رفض العملية بالكامل** (لا بيع بالسالب) — قرار مبني على أن الغرض الأساسي للنظام هو شركات المواد الغذائية (تجارة تجزئة/جملة)، وليس خدمات. هذه السياسة **قابلة للتغيير مستقبلاً لكل شركة على حدة** عبر `company_settings` لو احتجنا مرونة لاحقًا لأنواع نشاط مختلفة، لكن القيمة الافتراضية الحالية صارمة (strict).
- **ترقيم المستندات (`doc_no`)**: توليد **تلقائي تسلسلي لكل شركة على حدة** (وليس تسلسل عام مشترك بين كل شركات الـ SaaS) — أُضيف عمود `last_doc_number` في جدول `companies` لهذا الغرض، ويتم تحديثه ذريًا داخل نفس الدالة.
- **قفل الصف (`for update`) على الصنف وقت التحقق من المخزون** — لمنع Race Condition لو حصل بيعان لنفس الصنف في نفس اللحظة بالضبط.

**كود قاعدة البيانات (SQL Editor)**:
```sql
alter table companies add column if not exists last_doc_number integer not null default 0;
-- + دالة post_sale_transaction الكاملة (راجع ملف post_sale_transaction.sql المرفق بالمحادثة الأصلية لو احتجت إعادة تشغيلها)
```

**النشر**: `supabase functions deploy post-sale` من داخل `D:\erp-system-main` (لاحظ تحذير "Docker is not running" أثناء النشر — تحذير غير ضار، خاص بالتطوير المحلي فقط، لا يمنع النشر السحابي المباشر).

**الاختبار الفعلي (End-to-End) الذي تم وأثبت نجاح الآلية بالكامل**:
1. إنشاء صنف تجريبي (`ITM001`, `stock_qty = 100`) بشركة "شركة تجربة MCP"
2. استدعاء الدالة عبر HTTP فعلي (`Invoke-RestMethod` من PowerShell) لبيع 10 وحدات → نجح: `doc_no=1`, `total_amount=150`, `remaining_stock=90`. تم التحقق من قاعدة البيانات مباشرة (join بين `items`, `transactions`, `audit_log`) وتطابقت كل القيم. ✅
3. محاولة بيع كمية أكبر من المخزون المتاح (`qty=999999`) → رُفضت العملية بكود `409 Conflict`، وتم التأكد أن `stock_qty` بقي **90** بدون أي تغيير جزئي (إثبات فعلي للذرية، وليس افتراضًا نظريًا). ✅

**كيفية استدعاء الدالة (مرجع سريع — قديم/تاريخي، كانت هذه نسخة صنف واحد فقط، راجع التصحيح أدناه)**:
```
POST https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-sale
Headers: Authorization: Bearer <publishable_key>, Content-Type: application/json
Body: { company_id, customer_id?, agent_id?, item_id, qty, unit_cost?, unit_price?, is_credit?, doc_no? }
```

**ملاحظة غير مكتملة بعد**: حقل `actor` في `audit_log` مسجّل حاليًا بقيمة ثابتة `'system'` — لم تُربط الدالة بعد بهوية المستخدم الفعلي المستدعي (JWT الخاص بالمستخدم). هذا يحتاج تعديل عند ربط الـ Edge Functions بطبقة الـ Auth بشكل كامل (على الأرجح عند بناء الواجهة الأمامية في المرحلة 4، حيث سيُمرَّر JWT المستخدم الحقيقي بدل الـ service_role مباشرة، أو يُستخرج من الطلب).

### ⚠️ تصحيح مهم (المرحلة 4): الشكل الصحيح لـ payload الخاص بـ `post-sale` تغيّر عن الموثّق أعلاه

الوصف والمثال في القسم أعلاه كانوا صحيحين وقت اختبار المرحلة 3 (نسخة صنف واحد بس)، لكن الدالة **اتطورت لاحقًا في المرحلة 4** (أثناء بناء `sales.html` / `SalesClient.postSale` في `supabase-client.js`) لتدعم **فاتورة متعددة الأصناف في نفس الطلب**. هذا التحديث لم يكن موثّقًا هنا وهو سبب محتمل لأخطاء عند بناء شاشات جديدة تعتمد على الشكل القديم. تم التحقق من الشكل الحالي الفعلي مباشرة عبر استعلام SQL حي على السيرفر (`SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'post_sale_transaction'`) وعبر قراءة كود `supabase/functions/post-sale/index.ts` الفعلي، بتاريخ 2026-07-24:

**الشكل الصحيح الحالي للـ payload**:
```
POST https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-sale
Headers: Authorization: Bearer <session_access_token>, Content-Type: application/json
Body: {
  company_id,
  customer_id?,
  agent_id?,
  items: [ { item_id, qty, unit_cost?, unit_price? }, ... ],   // مصفوفة إلزامية، صنف واحد أو أكثر — وليس item_id/qty كحقول مفردة
  is_credit?,
  doc_no?
}
```

**الشكل الصحيح الحالي للرد (نجاح)**:
```json
{
  "success": true,
  "transaction": {
    "doc_no": "...",
    "total_amount": 0,
    "transaction_ids": ["..."],
    "items": [ { "item_id": "...", "qty": 0, "remaining_stock": 0, "transaction_id": "..." } ]
  }
}
```
أي قراءة للرد **لازم تمر عبر `result.transaction.doc_no`** وليس `result.doc_no` مباشرة (نفس الأمر لـ `total_amount` وباقي الحقول).

**⚠️ تنبيه مهم لأي شاشة قادمة (`post-return`, `post-payment`)**: هذا التطور لـ payload متعدد الأصناف **حصل لـ `post-sale` فقط حتى الآن**. تم التحقق مباشرة من كود `post-return/index.ts` و`post-payment/index.ts` الفعلي بنفس التاريخ (2026-07-24) وهما **لسه على الشكل القديم بحقول مفردة**، لم يتحولوا لمصفوفة `items[]`:
- `post-return`: لسه بياخد `item_id`, `qty` كحقول مفردة مباشرة (زي ما هو موثّق في قسمه تحت) — **مش** `items[]`. لو حصل تطوير مستقبلي ليدعم مرتجع متعدد الأصناف، لازم يتحدّث هنا وقتها.
- `post-payment`: أصلاً معندوش أي مفهوم "صنف" (`item`) من الأساس، مفيش داعي لـ `items[]` فيه إطلاقًا.

**لكن نقطة الرد (response) بتنطبق على الثلاثة**: الثلاث دوال ترجع نفس الشكل المغلّف `{ success: true, transaction: {...} }` — مش حقول مفردة على المستوى الأول (زي ما كان موثّق سابقًا في أمثلة الاختبار تحت لـ `post-return` و`post-payment`، اللي كانت بتكتب `doc_no=2` أو `new_balance=150` كأنها مباشرة على مستوى الرد — الصح إنها جوه `result.transaction.doc_no` وهكذا).

### ثاني Edge Function مبنية بالكامل ومُختبرة: `post-return`

**الموقع**: `D:\erp-system-main\supabase\functions\post-return\index.ts`

**الوظيفة**: تسجيل مرتجع بشكل ذري — عكس منطق البيع: زيادة المخزون + تقليل رصيد العميل (لو الفاتورة الأصلية كانت بالآجل)، عبر دالة RPC اسمها `post_return_transaction`.

**قرارات عمل حُسمت أثناء البناء**:
- **عمود جديد**: `transactions.ref_doc_no` — يربط أي مرتجع برقم فاتورة البيع الأصلية إلزاميًا (`ref_doc_no` مطلوب في كل استدعاء)
- **تحقق إلزامي**: الدالة ترفض أي مرتجع لو رقم الفاتورة الأصلية (`ref_doc_no`) غير موجود فعليًا كبيع سابق (`type = 'sale'`) لنفس الشركة — يمنع مرتجعات وهمية أو غير مرتبطة بعملية حقيقية
- **الترقيم**: المرتجع ياخذ رقم مستند جديد خاص به من نفس تسلسل `last_doc_number` (وليس نفس رقم الفاتورة الأصلية)

**الاختبار الفعلي (End-to-End)**:
1. مرتجع صحيح لـ 3 وحدات من فاتورة البيع رقم 1 (المخزون كان 90) → نجح: `doc_no=2`, `ref_doc_no=1`, `total_amount=45` → تم التحقق من قاعدة البيانات: `stock_qty` رجع لـ **93** بالضبط ✅
2. محاولة مرتجع برقم فاتورة أصلية غير موجودة (`ref_doc_no="999"`) → رُفضت بكود `422` كما هو متوقع ✅

**كيفية استدعاء الدالة (مرجع سريع)** — الشكل ده لسه صحيح حاليًا (`item_id`/`qty` مفردين، مش `items[]`، راجع التصحيح في قسم `post-sale` أعلاه):
```
POST https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-return
Body: { company_id, customer_id?, agent_id?, item_id, qty, unit_cost?, unit_price?, is_credit?, ref_doc_no (مطلوب) }
```
**الرد**: `{ success: true, transaction: { doc_no, ref_doc_no, total_amount, ... } }` — القيم جوه `transaction`، مش على المستوى الأول مباشرة (مثال الاختبار تحت مكتوب مختصرًا `doc_no=2` لكن المقصود `transaction.doc_no`).

### ثالث Edge Function مبنية بالكامل ومُختبرة: `post-payment`

**الموقع**: `D:\erp-system-main\supabase\functions\post-payment\index.ts`

**الوظيفة**: تسجيل سداد دفعة من عميل — تقليل `balance` مباشرة + تسجيل معاملة `type='payment'` + audit_log، بلا علاقة بالمخزون أو أي صنف، عبر دالة RPC `post_payment_transaction`.

**قرار عمل**: لا يوجد منع لو الرصيد أصبح سالبًا بعد الدفعة (على عكس منع نفاد المخزون في البيع) — لأن دفعة زائدة عن المستحق سيناريو طبيعي (دفعة مقدمة)، وليست خطأ يستوجب الرفض.

**الاختبار الفعلي**: عميل تجريبي (`CUST001`) برصيد ابتدائي 200 → دفعة 50 → نجحت: `doc_no=3`, `new_balance=150` → تم التحقق من قاعدة البيانات مباشرة وتطابقت القيمة. ✅

**كيفية الاستدعاء (مرجع سريع)** — الشكل ده صحيح حاليًا (لا يوجد `items` أصلاً لعدم وجود مفهوم صنف هنا):
```
POST https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-payment
Body: { company_id, customer_id (مطلوب), agent_id?, amount (مطلوب، > 0) }
```
**الرد**: `{ success: true, transaction: { doc_no, new_balance, ... } }` — القيم جوه `transaction`، مش على المستوى الأول مباشرة (مثال الاختبار تحت مكتوب مختصرًا `doc_no=3` لكن المقصود `transaction.doc_no`).

---

## المرحلة 3 — مكتملة رسميًا ✅

ثلاث Edge Functions مبنية بنفس النمط المثبت (دالة RPC ذرية في PostgreSQL + طبقة Edge Function رقيقة تستدعيها وتتحقق من صلاحية الشركة للكتابة أولاً)، والثلاثة مُختبرة end-to-end بنجاح كامل مع تحقق فعلي من قاعدة البيانات في كل مرة، وليس افتراضًا نظريًا:

| الدالة | الغرض | الحالة |
|---|---|---|
| `post-sale` | تسجيل بيع (يقلل مخزون، يزيد رصيد عميل لو آجل) | ✅ منشورة ومُختبرة |
| `post-return` | تسجيل مرتجع (يزيد مخزون، يقلل رصيد عميل لو آجل، يتطلب ربط بفاتورة بيع أصلية) | ✅ منشورة ومُختبرة |
| `post-payment` | تسجيل سداد دفعة (يقلل رصيد عميل فقط) | ✅ منشورة ومُختبرة |

**نمط ثابت يمكن تكراره لأي عملية مركّبة مستقبلية**:
1. دالة PostgreSQL (`security definer`, `set search_path = public`) تنفّذ كل الخطوات كمعاملة ذرية واحدة
2. Edge Function رقيقة (TypeScript/Deno) تتحقق من صحة المدخلات + صلاحية الشركة للكتابة (`company_can_write`) ثم تستدعي الدالة عبر `.rpc()`
3. نشر عبر `supabase functions deploy <name>` من داخل `D:\erp-system-main`
4. اختبار حقيقي عبر `Invoke-RestMethod` من PowerShell + تحقق مباشر من قاعدة البيانات (وليس الاكتفاء برد الدالة فقط)

**⚠️ ملاحظة غير مكتملة بعد (تنطبق على الثلاث دوال)**: حقل `actor` في `audit_log` مسجّل حاليًا بقيمة ثابتة `'system'` في الثلاث دوال — لم تُربط بعد بهوية المستخدم الفعلي المستدعي (JWT). يُفترض حلها عند بناء الواجهة الأمامية (المرحلة 4)، حين سيُمرَّر JWT المستخدم الحقيقي بدل استخدام `service_role` مباشرة من كل استدعاء، أو يُستخرج معرّف المستخدم من الطلب ويُمرَّر صراحة للدالة.

### ملاحظات بيئة عمل مهمة (لأي جلسة مستقبلية)

- الـ shell المستخدم فعليًا هو **PowerShell**، وليس CMD — تركيب أوامر CMD مثل `cd /d` لا يعمل، الصيغة الصحيحة `cd D:\...` مباشرة
- الريبو محلي في `D:\erp-system-main`، ومربوط فعليًا بمشروع Supabase عبر `supabase link`
- عند أي Edge Function جديدة: `supabase functions new <name>` → كتابة الكود يدويًا (نسخ/لصق من الملف المُجهَّز) → `supabase functions deploy <name>`
- تحذير "Docker is not running" أثناء `deploy` **غير ضار** ولا يمنع النشر السحابي المباشر

---

## المرحلة 4 — بدأت 🔶

### أول اختبار Auth end-to-end من كود فرونت إند حقيقي — نجح بالكامل

**الملفات**:
- `D:\erp-system-main\supabase-client.js` — أول نسخة من طبقة الاتصال بـ Supabase من الواجهة الأمامية (`AuthClientV2`)، بتستخدم `@supabase/supabase-js@2` عبر CDN مباشرة (`window.supabase.createClient`)
- `D:\erp-system-main\test-auth.html` — صفحة اختبار مستقلة (RTL) بفورمين بسيطين (تسجيل / دخول) وزرار لجلب بيانات الشركة، بتستدعي `AuthClientV2` وتعرض النتيجة الخام (`JSON.stringify`) في `<pre>`

**الدوال المبنية في `AuthClientV2`**:
- `register(companyNameAr, email, password)` → `supabaseClient.auth.signUp()` مع تمرير `company_name_ar` في `options.data` (نفس الحقل اللي يقرأه الـ Trigger `handle_new_user` من المرحلة 2 عبر `raw_user_meta_data`)
- `login(email, password)` → `supabaseClient.auth.signInWithPassword()`
- `logout()` → `supabaseClient.auth.signOut()`
- `getCurrentCompany()` → `supabaseClient.auth.getUser()` ثم `select('company_id, role, companies(name_ar, name_en, plan, trial_ends_at)')` من `company_users` مع `join` مباشر لجدول `companies` (PostgREST nested select)، محمي بالكامل عبر RLS من المرحلة 1 بدون أي كود سيرفر إضافي

**الاختبار الفعلي (End-to-End) اللي تم فعليًا من المتصفح على `test-auth.html`، ونجح بالكامل**:
1. **تسجيل حساب جديد** (`register`) → نجح، Trigger `handle_new_user` اشتغل تلقائي وأنشأ شركة جديدة وربط المستخدم كـ `owner` (نفس الآلية المُختبرة في المرحلة 2، بس دلوقتي من مسار تسجيل حقيقي من الواجهة مش من Dashboard يدويًا) ✅
2. **تأكيد الإيميل** (Confirm email) → وصل فعليًا واتأكد بنجاح (إعداد `Confirm email: ON` من المرحلة 2 شغال صح مع مسار تسجيل حقيقي) ✅
3. **تسجيل الدخول** (`login`) → نجح بعد التأكيد، ورجّع `session` صالحة ✅
4. **جلب بيانات الشركة** (`getCurrentCompany`) → نجح، ورجّع اسم الشركة + الدور (`owner`) + بيانات الخطة (`plan`, `trial_ends_at`) عبر الـ join، مما يثبت إن RLS + العلاقة بين `company_users` و`companies` شغالة صح من طلب فرونت إند حقيقي (مش من SQL Editor أو محاكاة جلسة زي المرحلة 1) ✅

**دلالة النتيجة**: هذا أول إثبات فعلي إن سلسلة كاملة — تسجيل ذاتي → Trigger إنشاء شركة → تأكيد إيميل → تسجيل دخول → قراءة بيانات محمية بـ RLS عبر join — شغالة end-to-end من كود فرونت إند حقيقي بيستخدم الـ publishable key بس، بدون أي طبقة سيرفر وسيطة. هذا يفتح الطريق لبناء باقي `api-client.js` بنفس الاستراتيجية (نفس أسماء الدوال القديمة، تواصل مباشر مع Supabase من الداخل) زي ما هو موثّق في `خطة_الهجرة_Supabase.md` قسم "المرحلة 4".

**ملاحظة**: `test-auth.html` و`supabase-client.js` ملفات اختبار/بداية أولية، ولسه المفروض تتدمج أو تتوسع لتغطي باقي احتياجات `api-client.js` الفعلي (قائمة العملاء، الأصناف، المعاملات... إلخ) قبل اعتبار المرحلة 4 مكتملة.

---

## المرحلة 4 — قسم المشتريات ✅

توسعة كاملة للنظام لتغطية دورة الشراء (عكس دورة البيع)، بنفس الأنماط المعمارية المثبتة سابقًا (RPC ذرية + Edge Function رقيقة + RLS). **الكود مكتمل ومُختبر end-to-end بنجاح فعلي** (راجع القسم الأخير تحت).

### تعديلات السكيمة (تم التحقق منها مباشرة من قاعدة البيانات الحية)

**جدول جديد**: `suppliers` (الموردين) — RLS مفعّل (`rowsecurity = true`، تم التأكيد مباشرة):

| العمود | النوع | ملاحظة |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `company_id` | uuid | عزل multi-tenant، نفس نمط باقي الجداول |
| `code` | text | |
| `name` | text | |
| `phone` | text | |
| `address` | text | |
| `tax_number` | text | اختياري |
| `balance` | numeric | افتراضي `0` — رصيد المورد (له، Accounts Payable) |
| `created_at` | timestamptz | `now()` |

**توسعة `companies`**: أعمدة جديدة `currency` (text), `tax_number` (text), `cr_number` (text) — بيانات هوية/ضريبية إضافية للشركة (السجل التجاري والرقم الضريبي والعملة)، منفصلة عن `company_settings` لأنها بيانات هوية شبه ثابتة مش إعدادات متغيرة.

**توسعة `items`**: عمود جديد `tax_rate` (numeric) — نسبة الضريبة الافتراضية للصنف.

**توسعة `transactions`**: أعمدة جديدة `supplier_id` (uuid)، `tax_rate` (numeric)، `tax_amount` (numeric) — لدعم ربط معاملة الشراء بالمورد وتسجيل تفاصيل الضريبة لكل سطر معاملة.

**⚠️ تعديل مهم كان لازم يحصل ولولاه كانت كل عمليات الشراء هترفض**: جدول `transactions` عنده check constraint اسمه `transactions_type_check` كان بيسمح بس بالقيم `sale`, `return`, `payment` (من المرحلة 3). تم توسيعه ليشمل `purchase` و`purchase_return` كمان (الأخيرة محجوزة لمرتجع مشتريات مستقبلي لسه مش مبني). التعريف الحالي المُتحقق منه مباشرة من قاعدة البيانات الحية:
```sql
CHECK (type = ANY (ARRAY['sale'::text, 'return'::text, 'payment'::text, 'purchase'::text, 'purchase_return'::text]))
```

### دالة `post_purchase_transaction` (RPC) ومنطقها

**الاسم**: `post_purchase_transaction(p_company_id uuid, p_supplier_id uuid, p_items jsonb, p_is_credit boolean, p_doc_no text)` — `security definer`, `set search_path = 'public'`.

**الفرق الجوهري عن `post_sale_transaction`**:
- **الشراء مسموح دايمًا بدون فحص كفاية مخزون** (عكس البيع تمامًا) — منطقيًا مفيش حد أعلى منطقي لكمية الشراء، فمفيش داعي لرفض العملية.
- **تحديث `unit_cost` تلقائيًا لآخر سعر شراء**: كل عملية شراء لصنف بتحدّث `items.unit_cost` لأحدث سعر تكلفة مُدخل (`coalesce(v_unit_cost, unit_cost)`)، وده قرار عمل متعمد إن سعر التكلفة المعروض للصنف يعكس آخر سعر شراء فعلي، مش متوسط تكلفة مرجّح (FIFO/Weighted Average لسه مش مطبّق).
- **زيادة المخزون** (`stock_qty = stock_qty + qty`) بدل تقليله.
- **دعم ضريبة لكل سطر صنف** (`tax_rate` اختياري لكل صنف في `items[]`، افتراضي `0`) — بيتحسب منها `tax_amount` لكل سطر، ويتجمّع في `v_grand_tax` على مستوى الفاتورة كاملة.
- **اتجاه رصيد المورد عند شراء بالآجل** (`is_credit = true`): رصيد المورد **يزيد** بإجمالي الفاتورة شامل الضريبة (`v_grand_total + v_grand_tax`) — الشركة مديونة للمورد (Accounts Payable)، عكس اتجاه رصيد العميل في البيع.
- **قفل الصف** (`for update`) على الصنف وقت التحديث، بنفس منطق منع Race Condition من `post_sale_transaction`.
- **الترقيم**: نفس تسلسل `last_doc_number` لكل شركة (مشترك مع البيع/المرتجع/الدفعة، وليس تسلسل منفصل للمشتريات).

**شكل الرد (نجاح)** — لاحظ حقل إضافي `grand_total` (شامل الضريبة) غير موجود في رد `post-sale`:
```json
{
  "success": true,
  "transaction": {
    "doc_no": "...",
    "total_amount": 0,
    "tax_amount": 0,
    "grand_total": 0,
    "transaction_ids": ["..."],
    "items": [ { "item_id": "...", "qty": 0, "transaction_id": "..." } ]
  }
}
```

### Edge Function: `post-purchase`

**الموقع**: `D:\erp-system-main\supabase\functions\post-purchase\index.ts`

بنفس النمط الرقيق المعتاد: تحقق من `company_id` و`items[]`، تحقق من `company_can_write` (نفس فحص `plan`/`trial_ends_at`)، ثم استدعاء `post_purchase_transaction` عبر `.rpc()`. المدخلات: `{ company_id, supplier_id?, items: [{item_id, qty, unit_cost?, tax_rate?}], is_credit?, doc_no? }` — نفس نمط `items[]` الصحيح المستخدم في `post-sale` الحالي (راجع تصحيح المرحلة 4 السابق في هذا الملف)، **وليس** حقول مفردة.

**⚠️ نفس ملاحظة `actor` غير المكتملة**: مسجّل حاليًا بقيمة ثابتة `'system'` في `audit_log`، بنفس الوضع في باقي الدوال.

### واجهة أمامية: `suppliers.html` و`purchases.html`

- **`suppliers.html`**: صفحة CRUD بسيطة للموردين (إضافة + عرض قائمة)، بنفس نمط `items.html`/`customers.html` بالظبط. بتستخدم `SuppliersClient.list()` و`SuppliersClient.create()` الجديدين في `supabase-client.js`.
- **`purchases.html`**: فورم تسجيل عملية شراء — قوائم منسدلة للمورد والصنف (بتتحمّل من `SuppliersClient.list()` و`ItemsClient.list()` معًا عبر `Promise.all`)، حقول كمية/سعر تكلفة/نسبة ضريبة/شراء بالآجل، وبتستدعي `PurchasesClient.postPurchase()` الجديد (بنفس نمط `SalesClient.postSale`: بتجيب `session.access_token` وتبعته كـ `Bearer` للـ Edge Function مباشرة، مش عبر PostgREST).
- تمت إضافة روابط `suppliers.html` و`purchases.html` في شريط التنقل (`app-nav`) في كل صفحات الواجهة الحالية.

### قسم المشتريات — مكتمل ومُختبر end-to-end بنجاح ✅

**تم التحقق منه بالفعل** (عبر استعلامات SQL مباشرة على القاعدة الحية بتاريخ 2026-07-24، مش افتراضًا):
- الأعمدة الجديدة على `companies`, `items`, `transactions` موجودة فعليًا بالأنواع الصحيحة
- جدول `suppliers` موجود وRLS مفعّل عليه
- تعريف دالة `post_purchase_transaction` منشور فعليًا ومطابق للمنطق الموصوف أعلاه
- توسعة `transactions_type_check` لتشمل `purchase`/`purchase_return` (راجع قسم تعديلات السكيمة أعلاه)

**الاختبار الفعلي (End-to-End) اللي تم فعليًا من المتصفح، ونجح بالكامل — فاتورة شراء `doc_no = 2`**:
1. تسجيل دخول (جلسة حقيقية عبر `AuthClientV2`) ✅
2. إضافة مورد جديد من `suppliers.html` (المورد `البشمشى`, كود `0002`) ✅
3. تسجيل عملية شراء من `purchases.html` — صنف `حسام` (كود `1`), كمية `1`, سعر تكلفة `1` ✅
4. **التحقق المباشر من قاعدة البيانات** (وليس الاكتفاء برد الدالة فقط) أثبت:
   - صف جديد في `transactions`: `doc_no=2`, `type='purchase'`, `supplier_id` مربوط صح بالمورد، `item_id` مربوط صح بالصنف، `qty=1`, `unit_cost=1`, `tax_rate=0`, `tax_amount=0` ✅
   - `items.stock_qty` زاد فعليًا (كان قبلها أقل، بقى `2` بعد الشراء) ✅
   - `items.unit_cost` اتحدّث لآخر سعر شراء (`1`) كما هو متوقع من منطق `post_purchase_transaction` ✅
   - العملية كانت **شراء نقدي** (`is_credit=false`, `debit=0`, `credit=0`) → رصيد المورد فضل **0** بدون تغيير، وده سلوك صحيح ومتوقع (رصيد المورد ميتأثرش إلا لو شراء بالآجل، بنفس منطق البيع) ✅

**النتيجة**: نفس درجة الصرامة المتبعة في كل مراحل هذا المشروع — تحقق فعلي من قاعدة البيانات في كل خطوة، مش افتراض نظري ولا اكتفاء برد الواجهة فقط. قسم المشتريات (`suppliers`, `purchases`, `post-purchase`) **يُعتبر الآن مكتملًا رسميًا**.

---

## نظام المحاسبة (Accounting) ✅

طبقة محاسبة حقيقية بالقيد المزدوج (double-entry bookkeeping) اتبنت فوق العمليات التجارية الموجودة (بيع/شراء/دفعة)، بدون ما تغيّر أي منطق تجاري قائم — كل عملية تجارية بقت **كمان** تُنشئ قيدها المحاسبي المقابل تلقائيًا وذريًا في نفس المعاملة.

### الجداول الجديدة (تم التحقق منها مباشرة من قاعدة البيانات الحية بتاريخ 2026-07-24)

**`chart_of_accounts`** (دليل الحسابات):

| العمود | النوع | ملاحظة |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `company_id` | uuid | دليل حسابات منفصل لكل شركة (multi-tenant) |
| `code` | text | كود الحساب (مثال `1000`, `4000`) |
| `name_ar` / `name_en` | text | |
| `account_type` | text | `asset` / `liability` / `equity` / `revenue` / `expense` |
| `parent_id` | uuid | لدعم تسلسل هرمي مستقبلي (حسابات فرعية) |
| `is_system` | boolean | افتراضي `false` — الحسابات الأساسية المزروعة تلقائيًا بتتحط `true` لتمييزها عن حسابات يضيفها المستخدم لاحقًا |
| `is_active` | boolean | افتراضي `true` |

**`journal_entries`** (رأس القيد): `company_id`, `entry_date` (افتراضي `now()`), `entry_no`, `description`, `source_type`, `source_doc_no` (يربط القيد بمصدره التجاري — `sale`/`purchase`/`payment` + رقم المستند)، `created_by`.

**`journal_entry_lines`** (سطور القيد): `journal_entry_id`, `account_id`, `debit` (افتراضي `0`), `credit` (افتراضي `0`), `description`.

### دالة `seed_default_chart_of_accounts(p_company_id uuid)` — تُنفَّذ تلقائيًا لكل شركة جديدة

بتزرع دليل حسابات افتراضي جاهز (12 حساب أساسي، `is_system = true`) عند إنشاء أي شركة، بـ `on conflict (company_id, code) do nothing` لمنع التكرار:

| الكود | الحساب | النوع |
|---|---|---|
| `1000` | النقدية والبنوك | أصل |
| `1100` | العملاء (ذمم مدينة) | أصل |
| `1200` | المخزون | أصل |
| `1300` | ضريبة مدخلات (قابلة للاسترداد) | أصل |
| `2000` | الموردون (ذمم دائنة) | خصم |
| `2100` | ضريبة مخرجات مستحقة | خصم |
| `3000` | رأس مال المالك | حقوق ملكية |
| `3100` | الأرباح المرحّلة | حقوق ملكية |
| `4000` | إيرادات المبيعات | إيراد |
| `4100` | مردودات ومسموحات المبيعات | إيراد |
| `5000` | تكلفة البضاعة المباعة (COGS) | مصروف |
| `5100` | مصروفات تشغيلية عامة | مصروف |

**الربط التلقائي**: دالة `handle_new_user` (Trigger على `auth.users` من المرحلة 2) بقت تنادي `perform public.seed_default_chart_of_accounts(new_company_id)` بعد إنشاء الشركة وربط المستخدم كـ `owner` مباشرة — فأي مستخدم جديد يسجل بياخد دليل حسابات جاهز من غير أي خطوة يدوية إضافية.

### دالة `post_journal_entry` العامة — نواة النظام المحاسبي

**التوقيع**: `post_journal_entry(p_company_id uuid, p_description text, p_source_type text, p_source_doc_no text, p_lines jsonb) RETURNS uuid` — `security definer`.

**منطقها**:
1. **تفحص توازن القيد قبل أي إدراج فعلي** — بتجمع كل `debit` و`credit` في `p_lines` وتقارنهم (`round(..., 3)` لتفادي مشاكل الفاصلة العائمة)، ولو مش متساويين بترفض العملية كاملة بـ `raise exception 'القيد غير متوازن: مدين % لا يساوي دائن %'` — **قاعدة محاسبية أساسية مفروضة على مستوى قاعدة البيانات نفسها**، مش على مستوى الواجهة فقط.
2. لو متوازن: تنشئ صف في `journal_entries`، وبعدها تلف على كل سطر وتربطه بحساب فعلي من `chart_of_accounts` عبر `account_code` (وترفض لو الكود مش موجود: `'الحساب بكود % غير موجود فى دليل الحسابات'`)، وتُدرج سطور `journal_entry_lines` المقابلة.

### الدمج داخل دوال المعاملات التجارية الثلاث

**`post_sale_transaction`** — بقت تنشئ **قيدين منفصلين** لكل فاتورة بيع، بعد إدراج صفوف `transactions` وقبل `audit_log`، في نفس المعاملة الذرية:
- **قيد الإيراد**: مدين `1100` (عملاء، لو آجل) أو `1000` (نقدية) بإجمالي شامل الضريبة ← دائن `4000` (إيراد المبيعات) بالإجمالي قبل الضريبة + دائن `2100` (ضريبة مخرجات) لو فيه ضريبة.
- **قيد COGS منفصل** (بس لو `v_grand_cost > 0`): مدين `5000` (تكلفة البضاعة المباعة) ← دائن `1200` (تخفيض المخزون)، بقيمة التكلفة الفعلية للأصناف المباعة (`unit_cost × qty`)، مش سعر البيع.

**`post_purchase_transaction`** — قيد واحد لكل فاتورة شراء: مدين `1200` (زيادة المخزون) + مدين `1300` (ضريبة مدخلات، لو فيه ضريبة) ← دائن `2000` (موردون، لو آجل) أو `1000` (نقدية).

**`post_payment_transaction`** — قيد واحد لكل سداد: مدين `1000` (زيادة النقدية) ← دائن `1100` (تخفيض ذمم العميل).

**ملاحظة معمارية**: القيد المحاسبي بيتولّد عبر `perform post_journal_entry(...)` **داخل نفس دالة PostgreSQL** للمعاملة التجارية (مش نداء منفصل من الـ Edge Function) — فلو القيد فشل (مثلاً بسبب عدم توازن غير متوقع أو حساب ناقص)، الفاتورة التجارية كلها بترجع بالكامل (rollback) بنفس آلية الذرية المستخدمة من الأساس، مفيش سيناريو "فاتورة اتسجلت بس من غير قيد محاسبي".

### الاختبار الفعلي — الميزان اتحقق منه فعليًا وطلع متوازن ✅

**View مساعد**: `trial_balance` — بيجمع `debit`/`credit` لكل حساب من `journal_entry_lines` مجمّعة حسب `company_id, code`، وبيحسب `balance = total_debit - total_credit` لكل حساب.

**الاختبار** (بعد تنفيذ عمليات بيع وشراء حقيقية سابقة على نفس الشركة، مش بيانات وهمية):
```sql
SELECT company_id, sum(total_debit), sum(total_credit), sum(total_debit) - sum(total_credit) AS difference
FROM trial_balance GROUP BY company_id;
```
**النتيجة الفعلية**: لشركة الاختبار النشطة (`company_id = 6e17de64-...`) — `total_debit = 52.5`, `total_credit = 52.5`, **`difference = 0`** ✅. باقي الشركات (بدون عمليات بعد) رجعت أصفار متطابقة برضه (`0 = 0`)، وده متوقع ومنطقي.

**دلالة النتيجة**: الميزان اتزن فعليًا عبر تراكم قيود حقيقية من عمليتي بيع وشراء منفصلتين (مش قيد واحد مصطنع للاختبار)، وده إثبات عملي إن منطق `post_journal_entry` + القيود المدمجة في الدوال الثلاث بيحافظ على معادلة القيد المزدوج الأساسية (مجموع المدين = مجموع الدائن) عبر عمليات متعددة ومتتالية، بنفس معيار التحقق المباشر من قاعدة البيانات المتبع في كل مراحل هذا المشروع.

---

## نظام المخزون الاحترافي ✅

توسعة كاملة لإدارة المخزون فوق ما بُني في المراحل السابقة — تعدد مخازن، تصنيف أصناف هرمي، بيانات صنف كاملة، وسجل حركة مخزون تفصيلي (Stock Ledger) لكل حركة بدل الاكتفاء برقم `stock_qty` النهائي فقط. كل الأرقام والتعريفات تحت تم التحقق منها مباشرة من قاعدة البيانات الحية بتاريخ 2026-07-24.

### الجداول الجديدة

**`warehouses`** (المخازن): `id`, `company_id`, `code`, `name`, `is_default` (افتراضي `false`), `is_active` (افتراضي `true`), `created_at`. RLS مفعّل.

**مخزن افتراضي تلقائي لكل شركة جديدة**: دالة `handle_new_user` (نفس الـ Trigger من المرحلة 2، بعد `seed_default_chart_of_accounts`) بقت كمان تنفّذ:
```sql
insert into public.warehouses (company_id, code, name, is_default)
values (new_company_id, 'MAIN', 'المخزن الرئيسي', true);
```
فأي شركة جديدة بتاخد مخزن رئيسي جاهز (`MAIN`) من غير أي خطوة يدوية، بنفس فلسفة دليل الحسابات الافتراضي.

**`item_categories`** (تصنيفات الأصناف): `id`, `company_id`, `name`, `parent_id` (لدعم تصنيفات فرعية هرمية)، `created_at`. RLS مفعّل.

**توسعة `items`** بأعمدة جديدة لبيانات صنف كاملة: `category_id` (uuid → `item_categories`)، `barcode` (text)، `unit` (text, افتراضي `'قطعة'`)، `brand` (text)، `description` (text)، `image_url` (text)، `min_stock_level` (numeric, افتراضي `0`)، `max_stock_level` (numeric)، `is_active` (boolean, افتراضي `true`)، `item_type` (text, افتراضي `'product'`)، `default_warehouse_id` (uuid → `warehouses`).

**`stock_movements`** (سجل حركة المخزون التفصيلي): `id`, `company_id`, `item_id`, `warehouse_id`, `movement_type` (نص حر: `sale_out`, `purchase_in`, `adjustment_in`, `adjustment_out`, `write_off`, ...)، `qty`, `unit_cost`, `reference_doc_no`, `reference_transaction_id` (uuid → `transactions`)، `notes`, `created_at`, `created_by`.

**⚠️ قرار أمان متعمد ومُتحقق منه فعليًا**: جدول `stock_movements` RLS مفعّل عليه بس بسياسة **قراءة فقط** (`sm_select` باستخدام `is_company_member(company_id)`، أمر `select` حصرًا). **لا توجد أي سياسة `insert`/`update`/`delete` على الإطلاق** — تم التأكد من ده مباشرة عبر `pg_policy`. يعني حتى لو استُخدم مفتاح المستخدم العادي (مش `service_role`)، محدش يقدر يسجّل حركة مخزون مباشرة من الواجهة أو PostgREST؛ الكتابة الوحيدة الممكنة هي عبر دوال `security definer` (`post_sale_transaction`, `post_purchase_transaction`, `adjust_stock`, `write_off_stock`) اللي بتتحكم في صحة البيانات المُدرجة. ده يمنع أي تلاعب مباشر في سجل الحركة من كود فرونت إند أو نداء API عشوائي.

### دالتا التصحيح اليدوي: `adjust_stock` و`write_off_stock`

**`adjust_stock(p_company_id uuid, p_item_id uuid, p_new_qty numeric, p_reason text)`** — تصحيح جرد (Stock Count Adjustment): بتاخد الكمية **الفعلية الجديدة** (مش الفرق) وتقارنها بـ `stock_qty` الحالي:
- لو الفرق `= 0` بترجع من غير أي تعديل.
- لو فيه فرق: بتحدّث `items.stock_qty` مباشرة، وتسجّل حركة `adjustment_in` (لو زيادة) أو `adjustment_out` (لو نقص) في `stock_movements`.
- **قيد محاسبي تلقائي** لو قيمة الفرق (`|diff| × unit_cost`) أكبر من صفر: زيادة جرد → مدين `1200` (المخزون) / دائن `5100` (فرق جرد)؛ عجز جرد → مدين `5100` (خسارة عجز) / دائن `1200` (تخفيض المخزون).

**`write_off_stock(p_company_id uuid, p_item_id uuid, p_qty numeric, p_reason text)`** — إتلاف مخزون (تلف، انتهاء صلاحية، إلخ): بترفض العملية لو الكمية المطلوب إتلافها أكبر من المتاح فعليًا (`raise exception`)، وإلا بتقلل `stock_qty`، تسجّل حركة `write_off`، وتنشئ **قيد محاسبي إلزامي** (مش شرطي زي `adjust_stock`): مدين `5100` (خسارة إتلاف) / دائن `1200` (تخفيض المخزون).

كلتا الدالتين `security definer`، وبتستخدما `for update` على صف الصنف لمنع Race Condition، وبتولّدا رقم مستند جديد من نفس تسلسل `last_doc_number` لكل شركة.

### الربط مع `post_sale_transaction` و`post_purchase_transaction`

الدالتان اتعدّلتا (فوق منطق البيع/الشراء والقيود المحاسبية الموجودة من قبل) عشان تسجّلا حركة مخزون تفصيلية لكل سطر صنف، **قبل** إنشاء القيد المحاسبي وبعد إدراج صف `transactions` مباشرة، في نفس المعاملة الذرية:
```sql
-- post_sale_transaction (لكل صنف فى الفاتورة)
insert into stock_movements (company_id, item_id, movement_type, qty, unit_cost, reference_doc_no, reference_transaction_id)
values (p_company_id, v_item_id, 'sale_out', v_qty, v_unit_cost, v_generated_doc_no, v_new_transaction_id);

-- post_purchase_transaction (لكل صنف فى الفاتورة)
insert into stock_movements (company_id, item_id, movement_type, qty, unit_cost, reference_doc_no, reference_transaction_id)
values (p_company_id, v_item_id, 'purchase_in', v_qty, v_unit_cost, v_generated_doc_no, v_new_transaction_id);
```
بكده أي عملية بيع أو شراء بقت بتترك أثر مزدوج: قيد محاسبي (`journal_entries`) + حركة مخزون تفصيلية (`stock_movements`)، وكلاهما مربوط بنفس `reference_doc_no`/`reference_transaction_id` للتتبع الكامل.

### الاختبار الفعلي — end-to-end، والميزان لسه متوازن بعد كل التعديلات ✅

**تم التحقق مباشرة من `stock_movements`**: حركتان فعليتان من نوع `sale_out` مسجّلتان لنفس الصنف (`item_id = ff0ea548-...`)، مرتبطتان بفاتورتي بيع حقيقيتين (`reference_doc_no = 5` و`6`, كل واحدة `qty = 10`, `unit_cost = 1`) — مش بيانات وهمية أو Placeholder.

**تم التحقق مباشرة من `trial_balance` بعد كل التعديلات دي** (توسعة السكيمة + تعديل الدالتين + إضافة `adjust_stock`/`write_off_stock`):
```sql
SELECT company_id, sum(total_debit), sum(total_credit), sum(total_debit) - sum(total_credit) AS difference
FROM trial_balance GROUP BY company_id;
```
**النتيجة**: لشركة الاختبار النشطة — `total_debit = 102.5`, `total_credit = 102.5`, **`difference = 0`** ✅ (ارتفعت من `52.5` السابقة بعد عمليات بيع إضافية، والميزان فضل متوازن تمامًا رغم كل التوسعات الجديدة في السكيمة والمنطق).

**دلالة النتيجة**: توسعة نظام المخزون (مخازن، تصنيفات، بيانات صنف، سجل حركة، تصحيح جرد، إتلاف) اتضافت **من غير ما تكسر** أي من ضمانات الذرية أو توازن القيد المزدوج المُثبتة سابقًا في نظام المحاسبة — كل حركة مخزون وكل قيد محاسبي ارتبطا صح ببعض ومع المعاملات التجارية الأصلية، وتم التحقق من النتيجتين مباشرة من قاعدة البيانات، مش افتراضًا نظريًا.

---

## وحدات القياس المتعددة (UoM) ✅

طبقة تحويل وحدات قياس عامة (Unit of Measure) بتسمح للصنف الواحد يتباع أو يتشترى بأكتر من وحدة (قطعة/شد/كرتون...) مع تحويل تلقائي وموثوق للوحدة الأساسية المخزّنة فعليًا في `items.stock_qty`. كل التفاصيل تحت تم التحقق منها مباشرة من قاعدة البيانات الحية بتاريخ 2026-07-24.

### الجداول: `uom_groups` و`uom_group_units` — نموذج قابل لإعادة الاستخدام

**قرار تصميم متعمد**: مجموعة الوحدات (`uom_groups`) منفصلة عن الصنف نفسه، ومربوطة بيه عبر `items.uom_group_id` — يعني مجموعة وحدات واحدة (مثلاً "كرتون-شد-قطعة") ممكن تتعرّف **مرة واحدة** وتتربط بأي عدد من الأصناف اللي بتتباع بنفس منطق التعبئة، بدل ما كل صنف يعرّف وحداته من الصفر.

**`uom_groups`**: `id`, `company_id`, `name` (اسم المجموعة، مثال `"كرتون-شد-قطعة"`), `created_at`. RLS مفعّل.

**`uom_group_units`**: `id`, `uom_group_id` (→ `uom_groups`), `unit_name` (نص، مثال `"كرتون"`), `conversion_factor` (numeric — كام وحدة أساسية تساوي وحدة واحدة من دي), `is_base_unit` (افتراضي `false` — وحدة واحدة بس فى كل مجموعة المفروض تكون `true` بمعامل `1`), `sort_order` (لترتيب العرض فى الواجهة). RLS مفعّل.

**مثال فعلي مُتحقق منه من قاعدة البيانات** (مجموعة "كرتون-شد-قطعة" الحقيقية المستخدمة فى الاختبار):

| `unit_name` | `conversion_factor` | `is_base_unit` |
|---|---|---|
| قطعة | 1 | `true` |
| شد | 6 | `false` |
| كرتون | 72 | `false` |

### دالة `create_uom_group(p_company_id uuid, p_group_name text, p_units jsonb)`

`security definer` — بتنشئ صف فى `uom_groups`، وبعدين تلف على `p_units` (مصفوفة `[{unit_name, conversion_factor, is_base_unit?}, ...]`) وتُدرج سطر `uom_group_units` لكل وحدة، مع `sort_order` تلقائي حسب ترتيب ورودها فى المصفوفة. بترجع `uuid` المجموعة الجديدة عشان تتربط مباشرة بـ `items.uom_group_id`.

### التعديل على `post_sale_transaction` و`post_purchase_transaction`: دعم `uom_unit_name` مع تحويل تلقائي

كل صنف فى `items[]` بقى يقبل حقل اختياري جديد `uom_unit_name`. المنطق المضاف (قبل أي فحص أو تحديث مخزون):
```sql
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
```
- لو `uom_unit_name` مش موجود فى الطلب أصلًا، `v_unit_factor = 1` والسلوك زي ما كان بالظبط (توافق كامل مع الفواتير القديمة اللي مالهاش وحدات).
- لو موجود لكن مش معرّف فعليًا لمجموعة وحدات الصنف، الدالة **ترفض العملية بالكامل** (`raise exception`) بدل ما تفترض قيمة خاطئة.
- **كل عمليات المخزون والتكلفة بعد كده بتشتغل بـ `v_base_qty`** (الكمية بالوحدة الأساسية)، مش `v_qty` (الكمية اللي كتبها المستخدم بوحدته المختارة) — فـ `items.stock_qty`, `stock_movements.qty`, وفحص كفاية المخزون فى البيع، كلها بالوحدة الأساسية دايمًا، بغض النظر عن الوحدة اللي اتباعت أو اتشترت بيها فعليًا.
- **فى الشراء تحديدًا**: `unit_cost` الجديد المسجّل على الصنف بيتحسب بالوحدة الأساسية دايمًا (`unit_cost ÷ v_unit_factor`) — يعني لو اشتريت كرتون بـ 72 جنيه ومعامل التحويل 72، سعر التكلفة المسجّل للصنف هيبقى 1 جنيه للقطعة الواحدة، مش 72.
- `stock_movements.notes` بيسجّل وصف مقروء للحركة بالوحدة الأصلية المُدخلة (مثال: `"شراء: 2 كرتون"` أو `"بيع: 1 كرتون"`) عشان سجل الحركة يفضل مفهوم للمستخدم حتى لو الرقم المخزّن فعليًا بالوحدة الأساسية.

### الاختبار الفعلي — Round-trip كامل، ورجع المخزون لنفس القيمة بالظبط ✅

**السيناريو الفعلي المُختبر** (مُتحقق منه مباشرة من `stock_movements`، مش افتراضًا):
1. **شراء 2 كرتون** (`uom_unit_name = 'كرتون'`, معامل تحويل `72`) → حركة `purchase_in` بـ `qty = 144` (بالوحدة الأساسية "قطعة")، `reference_doc_no = 7` ✅
2. **بيع 1 كرتون** مرتين متتاليتين (فاتورتين منفصلتين) → حركتا `sale_out` بـ `qty = 72` لكل واحدة، `reference_doc_no = 8` و`9` ✅ — إجمالي المبيع = `72 + 72 = 144`، بالظبط نفس الكمية اللي دخلت بالشراء.
3. **النتيجة الصافية**: `144` داخل (شراء) − `144` خارج (بيع) = **صفر فرق صافي** — المخزون رجع تمامًا لنفس القيمة اللي كانت قبل بداية دورة الاختبار، مؤكَّد مباشرة من عمود `items.stock_qty` الحالي للصنف.
4. **سعر التكلفة اتسجل صح بالوحدة الأساسية**: بعد شراء الكرتون بـ 72 جنيه، `items.unit_cost` بقى `1` (72 ÷ 72)، مش `72` — يعني التحويل اشتغل صح فى اتجاه السعر برضه مش بس الكمية.

**الميزان فضل متوازن بعد كل ده أيضًا** ✅ — نفس استعلام `trial_balance` المُستخدم فى كل الاختبارات السابقة:
```sql
SELECT company_id, sum(total_debit), sum(total_credit), sum(total_debit) - sum(total_credit) AS difference
FROM trial_balance GROUP BY company_id;
```
النتيجة لشركة الاختبار: `total_debit = 10814.5`, `total_credit = 10814.5`, **`difference = 0`** ✅ (ارتفع الرقم بشكل كبير عن الاختبارات السابقة بسبب تراكم عمليات بيع/شراء إضافية بقيم أعلى أثناء اختبار الـ UoM، لكن التوازن فضل تام).

**دلالة النتيجة**: منطق التحويل بين وحدات القياس بيشتغل صح فى الاتجاهين (كمية وتكلفة)، وبيحافظ على دقة كاملة عبر دورة شراء/بيع متعددة الخطوات (round-trip)، من غير ما يكسر توازن القيد المزدوج فى نظام المحاسبة القائم من قبل.

---

## استيراد/تصدير الأصناف من إكسل ✅

ميزة استيراد أصناف بالجملة من ملف إكسل، لتسريع إدخال بيانات الأصناف لشركة جديدة بدل الإدخال اليدوي واحد واحد من `items.html`.

### الملفات

- **`ItemsImportExportClient`** — معرّفة فى كل من `supabase-client.js` (تُستخدم فعليًا من `import-items.html`) وفى `api-client.js` (نسخة مطابقة بانتظار الدمج فى مسار `api-client.js` الرسمي لاحقًا).
- **`import-items.html`** — صفحة مستقلة بخطوتين: تحميل القالب، ثم رفع الملف المعبّأ، مع تقرير أخطاء تفصيلي بعد الاستيراد. بتحمّل مكتبة [`xlsx@0.18.5`](https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js) من CDN لقراءة/كتابة ملفات إكسل فى المتصفح مباشرة (بدون أي كود سيرفر).

### القالب — ملف إكسل ثنائي الشيت (`downloadTemplate`)

**شيت "تعليمات"**: تعليمات نصية للمستخدم (الحقول الإلزامية، تحذير عدم تغيير أسماء الأعمدة، إلخ).

**شيت "الأصناف"**: صف رؤوس أعمدة + صف مثال واحد فقط. الأعمدة: `الكود *`, `الاسم *` (إلزاميان)، `التصنيف`, `الماركة`, `الوحدة`, `الباركود`, `سعر التكلفة`, `سعر البيع`, `الكمية الابتدائية`, `الحد الأدنى للمخزون`, `الحد الأقصى للمخزون`, `الوصف`.

### القراءة والاستيراد (`parseFile` + `importItems`)

- **`parseFile(file)`**: بتقرأ الملف المرفوع عبر `FileReader` + `XLSX.read`، بتدوّر تحديدًا على شيت اسمه `"الأصناف"` (أو أول شيت لو الاسم مختلف)، وبتفلتر أي صف من غير كود أو اسم.
- **`importItems(companyId, items)`**: بتستورد كل صنف فعليًا فى جدول `items` عبر `supabaseClient.from('items').insert(...)`:
  - **إنشاء تصنيفات تلقائي**: لو الصنف عنده اسم تصنيف (`categoryName`) مش موجود مسبقًا فى `item_categories` لنفس الشركة، بتتنشئ تلقائيًا (مع كاش محلي `categoryCache` لتفادي تكرار نفس التصنيف لعدة أصناف فى نفس عملية الاستيراد).
  - بترجع تقرير مفصّل: `{ success, failed, errors: [] }` — كل صف فاشل بيتسجل بسبب الفشل (بدل ما العملية كلها تتوقف عند أول خطأ).

**ملاحظة معمارية**: الاستيراد بيحصل عبر PostgREST مباشرة (`insert` صف بصف) مش عبر Edge Function أو RPC ذرية واحدة — يعني لو حصل فشل فى نص عملية استيراد ملف فيه مئات الأصناف، الأصناف اللي نجحت قبل الفشل بتفضل متسجلة (مش rollback كامل زي دوال المعاملات التجارية). ده قرار مقبول هنا لأن الاستيراد عملية إعداد أولي (setup) مش معاملة محاسبية، لكنه يستاهل التوثيق كفرق جوهري عن باقي عمليات النظام.

---

## الخطوة الجاية: استكمال المرحلة 4 — باقي الواجهة الأمامية

**قبل الاستكمال، يجب التأكد من**:
1. هل الملف ده (`SUPABASE_MIGRATION_LOG.md`) اتضاف فعليًا للريبو على GitHub؟ (لم يُؤكد بعد وقت كتابة هذا التحديث — كل الملفات لسه بس على جهاز المستخدم محليًا وعلى claude.ai، لم تُدفع (push) للريبو البعيد بعد)
2. هل فيه أي تعديل حصل على السكيمة أو الدوال أو Edge Functions من وقت كتابة هذا الملف؟
3. اقرأ `خطة_الهجرة_Supabase.md` قسم "المرحلة 4" قبل أي تنفيذ — الاستراتيجية المقترحة هناك: بناء `api-client.js` جديد بنفس أسماء الدوال القديمة بالضبط، لكنه يتواصل مع Supabase من الداخل، لتقليل التعديلات المطلوبة في باقي ملفات `modules/`.
4. نظام الدفع الفعلي لسه غير محدد — الآلية الحالية (قفل جزئي تلقائي بعد 14 يوم) مصممة لتستقبل أي نظام دفع مستقبلي بتحديث عمود `plan` فقط، دون تعديل جوهري.
5. ✅ **تم**: كل ملفات `supabase/` (السكيمة، config، الثلاث Edge Functions) تم رفعها فعليًا للريبو البعيد على GitHub عبر `git push` (commit: `1176da0`). المجلد المحلي `D:\erp-system-main` كان في الأصل تحميل ZIP وليس `git clone` حقيقي — تم تحويله لريبو Git فعلي عبر `git init` + `git remote add origin` + `git fetch` + `git reset --mixed origin/main` قبل الرفع، لضمان عدم فقد أو تعارض مع أي محتوى موجود على GitHub مسبقًا. كذلك تم تثبيت Git نفسه على الجهاز (لم يكن مثبتًا من الأساس) وتسجيل هوية Git المحلية (`user.name`/`user.email`) لأول مرة.
6. **ملاحظة بسيطة غير حرجة**: مجلد `supabase/.temp/` (معلومات اتصال مؤقتة غير حساسة) اترفع مع باقي الملفات لعدم وجود `.gitignore` مضبوط بعد. يُفضّل إضافة `.gitignore` مناسب لمجلد `supabase/` مستقبلاً، لكن هذا غير عاجل ولا يمثل خطورة أمنية.

---

## ملاحظة تشغيلية مهمة

كل خطوات هذه المرحلة اتنفذت يدويًا عبر واجهة Supabase Dashboard مباشرة (SQL Editor + Authentication) من متصفح المستخدم، **مش عبر أدوات MCP** (لأن الجلسة كانت على claude.ai في المتصفح، وأدوات MCP الموصوفة في `README_MCP_Project.md` تعمل فقط داخل Claude Code). لو حبيت تكمل عبر MCP لاحقًا، لازم تضاف أداة MCP جديدة للتعامل مع Supabase (مش موجودة حاليًا في السيرفر المحلي `D:\erp-mcp-server` — الأدوات الحالية بتاعته لـ GitHub و Google Sheets بس).