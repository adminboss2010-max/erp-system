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

**كيفية استدعاء الدالة (مرجع سريع)**:
```
POST https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-sale
Headers: Authorization: Bearer <publishable_key>, Content-Type: application/json
Body: { company_id, customer_id?, agent_id?, item_id, qty, unit_cost?, unit_price?, is_credit?, doc_no? }
```

**ملاحظة غير مكتملة بعد**: حقل `actor` في `audit_log` مسجّل حاليًا بقيمة ثابتة `'system'` — لم تُربط الدالة بعد بهوية المستخدم الفعلي المستدعي (JWT الخاص بالمستخدم). هذا يحتاج تعديل عند ربط الـ Edge Functions بطبقة الـ Auth بشكل كامل (على الأرجح عند بناء الواجهة الأمامية في المرحلة 4، حيث سيُمرَّر JWT المستخدم الحقيقي بدل الـ service_role مباشرة، أو يُستخرج من الطلب).

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

**كيفية استدعاء الدالة (مرجع سريع)**:
```
POST https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-return
Body: { company_id, customer_id?, agent_id?, item_id, qty, unit_cost?, unit_price?, is_credit?, ref_doc_no (مطلوب) }
```

### ثالث Edge Function مبنية بالكامل ومُختبرة: `post-payment`

**الموقع**: `D:\erp-system-main\supabase\functions\post-payment\index.ts`

**الوظيفة**: تسجيل سداد دفعة من عميل — تقليل `balance` مباشرة + تسجيل معاملة `type='payment'` + audit_log، بلا علاقة بالمخزون أو أي صنف، عبر دالة RPC `post_payment_transaction`.

**قرار عمل**: لا يوجد منع لو الرصيد أصبح سالبًا بعد الدفعة (على عكس منع نفاد المخزون في البيع) — لأن دفعة زائدة عن المستحق سيناريو طبيعي (دفعة مقدمة)، وليست خطأ يستوجب الرفض.

**الاختبار الفعلي**: عميل تجريبي (`CUST001`) برصيد ابتدائي 200 → دفعة 50 → نجحت: `doc_no=3`, `new_balance=150` → تم التحقق من قاعدة البيانات مباشرة وتطابقت القيمة. ✅

**كيفية الاستدعاء (مرجع سريع)**:
```
POST https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-payment
Body: { company_id, customer_id (مطلوب), agent_id?, amount (مطلوب، > 0) }
```

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

## الخطوة الجاية (لم تبدأ بعد): المرحلة 4 — الواجهة الأمامية

**قبل البدء في المرحلة 4، يجب التأكد من**:
1. هل الملف ده (`SUPABASE_MIGRATION_LOG.md`) اتضاف فعليًا للريبو على GitHub؟ (لم يُؤكد بعد وقت كتابة هذا التحديث — كل الملفات لسه بس على جهاز المستخدم محليًا وعلى claude.ai، لم تُدفع (push) للريبو البعيد بعد)
2. هل فيه أي تعديل حصل على السكيمة أو الدوال أو Edge Functions من وقت كتابة هذا الملف؟
3. اقرأ `خطة_الهجرة_Supabase.md` قسم "المرحلة 4" قبل أي تنفيذ — الاستراتيجية المقترحة هناك: بناء `api-client.js` جديد بنفس أسماء الدوال القديمة بالضبط، لكنه يتواصل مع Supabase من الداخل، لتقليل التعديلات المطلوبة في باقي ملفات `modules/`.
4. نظام الدفع الفعلي لسه غير محدد — الآلية الحالية (قفل جزئي تلقائي بعد 14 يوم) مصممة لتستقبل أي نظام دفع مستقبلي بتحديث عمود `plan` فقط، دون تعديل جوهري.
5. **ملف واحد لسه ناقص توثيقه هنا**: هل تم `git push` لأي من ملفات `supabase/` (السكيمة، الدوال) للريبو البعيد على GitHub؟ يُنصح بعمل ذلك قبل الانتقال للمرحلة 4 لتجنب فقد العمل لو حصل أي عطل في الجهاز المحلي.

---

## ملاحظة تشغيلية مهمة

كل خطوات هذه المرحلة اتنفذت يدويًا عبر واجهة Supabase Dashboard مباشرة (SQL Editor + Authentication) من متصفح المستخدم، **مش عبر أدوات MCP** (لأن الجلسة كانت على claude.ai في المتصفح، وأدوات MCP الموصوفة في `README_MCP_Project.md` تعمل فقط داخل Claude Code). لو حبيت تكمل عبر MCP لاحقًا، لازم تضاف أداة MCP جديدة للتعامل مع Supabase (مش موجودة حاليًا في السيرفر المحلي `D:\erp-mcp-server` — الأدوات الحالية بتاعته لـ GitHub و Google Sheets بس).