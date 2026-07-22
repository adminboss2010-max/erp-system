# SUPABASE_MIGRATION_LOG.md — سجل تنفيذ هجرة Supabase

> **لأي AI (Claude أو غيره) يعمل على هذا المشروع لاحقًا**: هذا الملف يوثّق ما تم تنفيذه فعليًا من `خطة_الهجرة_Supabase.md`. اقرأه بعد `AI_CONTEXT.md` مباشرة قبل أي متابعة على هذا المسار.

**القرار الأساسي المتبع**: هجرة موازية، مش استبدال فوري. النظام الحالي (Google Apps Script) لسه شغال زي ما هو ومنلمسوش. النظام الجديد (Supabase) بيتبني جنبه، ومنقرر الانتقال الفعلي بس بعد اختبار كامل.

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

## الخطوة الجاية (لم تبدأ بعد): المرحلة 2 — المصادقة (Auth)

القرار المطروح في خطة الهجرة (لم يُحسم بعد وقت كتابة هذا الملف): استخدام Supabase Auth مباشرة (موصى به) بدل محاكاة نفس منطق الجلسات القديم من `Code.gs`.

**قبل البدء في المرحلة 2، يجب التأكد من**:
1. هل الملف ده (`SUPABASE_MIGRATION_LOG.md`) اتضاف فعليًا للريبو على GitHub؟
2. هل فيه أي تعديل حصل على السكيمة من وقت كتابة هذا الملف؟ (تحقق مباشرة من Supabase Dashboard → Table Editor)
3. اقرأ `خطة_الهجرة_Supabase.md` قسم "المرحلة 2" قبل أي تنفيذ.

---

## ملاحظة تشغيلية مهمة

كل خطوات هذه المرحلة اتنفذت يدويًا عبر واجهة Supabase Dashboard مباشرة (SQL Editor + Authentication) من متصفح المستخدم، **مش عبر أدوات MCP** (لأن الجلسة كانت على claude.ai في المتصفح، وأدوات MCP الموصوفة في `README_MCP_Project.md` تعمل فقط داخل Claude Code). لو حبيت تكمل عبر MCP لاحقًا، لازم تضاف أداة MCP جديدة للتعامل مع Supabase (مش موجودة حاليًا في السيرفر المحلي `D:\erp-mcp-server` — الأدوات الحالية بتاعته لـ GitHub و Google Sheets بس).
