/**
 * ============================================================
 * ApiClient — طبقة اتصال موحّدة وآمنة مع الـ Backend (Google Apps Script)
 * ============================================================
 */

const ApiClient = {

  // عميل Supabase (المرحلة 4 من الهجرة) — يُستخدم تدريجيًا بدل Apps Script، دالة بدالة
  _supabase: (typeof window !== 'undefined' && window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null,

  _url() {
    if (!window.APPS_SCRIPT_URL) {
      console.error("ApiClient Error: window.APPS_SCRIPT_URL غير معرّف! تأكد من تحميل config.js أولاً.");
    }
    return window.APPS_SCRIPT_URL;
  },

  _token() {
    return localStorage.getItem('erp_token');
  },

  _adminToken() {
    return localStorage.getItem('erp_admin_token');
  },

  // نداء عام آمن ومحمي لجميع طلبات الـ POST (يمنع تسريب التوكين في الـ URL)
  async _call(action, payload, includeToken = true) {
    // بناء الـ Body ليكون POST حصراً دون الدمج مع الـ URL params
    const body = Object.assign({ action: action }, payload || {});
    
    if (includeToken) {
      const token = this._token();
      if (!token) {
        return { ok: false, error: 'انتهت الجلسة، يرجى إعادة تسجيل الدخول.' };
      }
      body.token = token;
    }

    return this._safeFetch(body);
  },

  // نداء خاص بعمليات الأدمن المنفصلة وحمايتها
  async _callAdmin(action, payload) {
    const body = Object.assign({ action: action }, payload || {});
    const token = this._adminToken();
    
    if (!token) {
      return { ok: false, error: 'صلاحيات المسؤول مطلوبة.' };
    }
    body.token = token;

    return this._safeFetch(body);
  },

  // دالة موحدة لمعالجة الـ Fetch والـ try-catch لمنع انهيار الـ JSON Parsing
  async _safeFetch(bodyData) {
    try {
      const res = await fetch(this._url(), {
        method: 'POST',
        // text/plain يتفادى مشاكل الـ CORS preflight مع بيئة Google Apps Script
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(bodyData)
      });

      if (!res.ok) {
        return { ok: false, error: `خطأ في السيرفر: ${res.status}` };
      }

      const textResponse = await res.text();
      // حماية الـ JSON.parse لمنع تجمّد الواجهة في حال حدوث خطأ غير متوقع بالخلفية
      try {
        return JSON.parse(textResponse);
      } catch (parseError) {
        console.error("استجابة غير صالحة من السيرفر:", textResponse);
        return { ok: false, error: 'استجابة السيرفر غير مفهومة أو تحتوي على خطأ داخلي.' };
      }

    } catch (e) {
      console.error("ApiClient Fetch Error:", e);
      return { ok: false, error: (e && e.message) || 'تعذّر الاتصال بالسيرفر، تحقق من الإنترنت.' };
    }
  },

  // ---------------- Authentication ----------------
  auth: {
    // فحص اتصال حقيقي بـ Supabase (بدل ping القديم على Apps Script)
    async ping() {
      try {
        const res = await fetch(window.SUPABASE_URL + '/auth/v1/health', {
          headers: { apikey: window.SUPABASE_ANON_KEY }
        });
        if (!res.ok) return { ok: false, error: `خطأ في السيرفر: ${res.status}` };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e && e.message) || 'تعذّر الاتصال بالسيرفر، تحقق من الإنترنت.' };
      }
    },
    // دخول حقيقي عبر Supabase Auth + جلب الشركة المرتبطة بالمستخدم من company_users
    async login(admin_email, password) {
      const supabase = ApiClient._supabase;
      if (!supabase) {
        return { ok: false, error: 'تعذّر تحميل مكتبة Supabase.' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: admin_email,
        password: password
      });

      if (error) {
        const map = {
          'Invalid login credentials': 'بيانات الدخول غير صحيحة',
          'Email not confirmed': 'يرجى تأكيد بريدك الإلكتروني أولاً'
        };
        return { ok: false, error: map[error.message] || error.message };
      }

      const { data: membership, error: memErr } = await supabase
        .from('company_users')
        .select('role, companies(*)')
        .eq('user_id', data.user.id)
        .limit(1)
        .maybeSingle();

      if (memErr || !membership || !membership.companies) {
        await supabase.auth.signOut();
        return { ok: false, error: 'الحساب غير مرتبط بأي شركة.' };
      }

      const company = Object.assign({}, membership.companies, {
        admin_email: data.user.email,
        role: membership.role
      });

      return { ok: true, token: data.session.access_token, company: company };
    },
    async register(name_ar, admin_email, password) {
      const supabase = ApiClient._supabase;
      if (!supabase) return { ok: false, error: 'تعذّر تحميل مكتبة Supabase.' };

      const { data, error } = await supabase.auth.signUp({
        email: admin_email,
        password: password,
        options: { data: { company_name_ar: name_ar } }
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true, user: data.user, needsEmailConfirmation: !data.session };
    },
    // دالة تسجيل خروج حقيقية لإبلاغ السيرفر وتنظيف الكاش المحلي فوراً
    async logout() {
      const supabase = ApiClient._supabase;
      if (supabase) await supabase.auth.signOut();
      localStorage.removeItem('erp_token');
      return { ok: true };
    }
  },

  // ---------------- State (إدارة وحفظ حالة النظام المتزامنة) ----------------
  state: {
    save(state, expectedRev) {
      const payload = { state: state };
      if (expectedRev !== undefined && expectedRev !== null) {
        payload.expectedRev = expectedRev;
      }
      return ApiClient._call('saveState', payload);
    },
    load() {
      return ApiClient._call('loadState', {});
    }
  },

  // ---------------- Sheet Data (التعامل مع الشيتات بدعم الترقيم والـ Pagination) ----------------
  sheet: {
    // إضافة دعم الـ limit والـ offset لمنع بطء تحميل الجداول الضخمة
    get(sheetName, limit = 1000, offset = 0) {
      return ApiClient._call('getData', { sheet: sheetName, limit, offset });
    },
    appendRow(sheetName, row) {
      return ApiClient._call('appendRow', { sheet: sheetName, row });
    },
    saveAll(sheetName, rows) {
      return ApiClient._call('saveData', { sheet: sheetName, rows });
    }
  },

  // ---------------- Business Engine ----------------
  sales: {
    // تسجيل فاتورة بيع (صنف واحد أو أكثر) بشكل ذري فعلي عبر Edge Function الحقيقية —
    // بتخصم من المخزون فعليًا في PostgreSQL، مش تسجيل محلي فقط
    // payload: { company_id, customer_id?, agent_id?, items:[{item_id,qty,unit_cost?,unit_price?}], is_credit?, doc_no? }
    async postSale(payload) {
      try {
        const res = await fetch(window.SUPABASE_URL + '/functions/v1/post-sale', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + ApiClient._token()
          },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          return { ok: false, error: json.error || `خطأ في السيرفر: ${res.status}`, details: json.details };
        }
        return Object.assign({ ok: true }, json.transaction);
      } catch (e) {
        return { ok: false, error: (e && e.message) || 'تعذّر الاتصال بالسيرفر، تحقق من الإنترنت.' };
      }
    }
  },

  // ---------------- Company Profile ----------------
  company: {
    updateProfile(fields) {
      return ApiClient._call('updateCompanyProfile', fields);
    }
  },

  // ---------------- Audit Log ----------------
  audit: {
    // دعم الـ limit والـ offset لـ سجل العمليات لضمان سرعة تحميل لوحة التحكم
    get(limit = 200, offset = 0) {
      return ApiClient._call('getAuditLog', { limit, offset });
    }
  },

  // ---------------- Platform Admin (لوحة تحكم النظام الشاملة للشركات) ----------------
  admin: {
    login(email, password) {
      return ApiClient._call('adminLogin', { email, password }, false);
    },
    listCompanies() {
      return ApiClient._callAdmin('adminListCompanies', {});
    },
    setCompanyStatus(companyId, status) {
      return ApiClient._callAdmin('adminSetCompanyStatus', { companyId, status });
    },
    createCompany(name_ar, admin_email, password, logo, name_en) {
      return ApiClient._callAdmin('adminCreateCompany', { name_ar, admin_email, password, logo: logo || '', name_en: name_en || '' });
    },
    deleteCompany(companyId) {
      return ApiClient._callAdmin('adminDeleteCompany', { companyId });
    },
    // دالة لتسجيل خروج مدير المنصة وتطهير التوكين الخاص به
    logout() {
      localStorage.removeItem('erp_admin_token');
      return { ok: true };
    }
  }
};

if (typeof window !== 'undefined') window.ApiClient = ApiClient;

// مزامنة erp_token مع جلسة Supabase الحقيقية (بما فيها التجديد التلقائي بعد انتهاء صلاحية التوكين)
// عشان الكود القديم اللي بيفحص localStorage['erp_token'] كـ truthy check (مثل 33-infragenerateqr.js) يفضل شغال بدون أي تعديل فيه
if (ApiClient._supabase) {
  ApiClient._supabase.auth.onAuthStateChange((_event, session) => {
    if (session && session.access_token) {
      localStorage.setItem('erp_token', session.access_token);
    } else {
      localStorage.removeItem('erp_token');
    }
  });
}

const ItemsImportExportClient = {
  // تحميل قالب إكسل فاضي بكل أعمدة النظام + شيت شرح
  downloadTemplate() {
    const headers = [
      'الكود *', 'الاسم *', 'التصنيف', 'الماركة', 'الوحدة',
      'الباركود', 'سعر التكلفة', 'سعر البيع', 'الكمية الابتدائية',
      'الحد الأدنى للمخزون', 'الحد الأقصى للمخزون', 'الوصف'
    ];
    const exampleRow = [
      'ITM001', 'مثال: أرز بسمتي 5 كجم', 'مواد غذائية', 'الملكة', 'كرتونة',
      '6281234567890', '1.500', '2.200', '100', '10', '500', 'وصف اختياري للصنف'
    ];

    const wsData = [headers, exampleRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));

    const instructionsData = [
      ['تعليمات استخدام قالب prova لاستيراد الأصناف'],
      [''],
      ['1. الحقول المعلّم عليها بـ * إلزامية (الكود والاسم)'],
      ['2. لا تغيّر أسماء الأعمدة فى الصف الأول'],
      ['3. احذف صف المثال قبل رفع الملف الحقيقي، أو استبدله ببياناتك'],
      ['4. الأسعار والكميات أرقام فقط (بدون رموز عملة أو فواصل)'],
      ['5. لو الصنف عنده تصنيف جديد غير موجود بالنظام، سيتم إنشاؤه تلقائيًا'],
      ['6. الحد الأقصى للمخزون اختياري، اتركه فارغًا إذا لم يكن محددًا'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'تعليمات');
    XLSX.utils.book_append_sheet(wb, ws, 'الأصناف');
    XLSX.writeFile(wb, 'قالب_استيراد_الأصناف_prova.xlsx');
  },

  // قراءة ملف مرفوع وتحويله لمصفوفة كائنات جاهزة للاستيراد
  async parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames.includes('الأصناف') ? 'الأصناف' : workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          const items = rows
            .filter(r => r['الكود *'] || r['الكود'])
            .map(r => ({
              code: String(r['الكود *'] || r['الكود'] || '').trim(),
              name: String(r['الاسم *'] || r['الاسم'] || '').trim(),
              categoryName: String(r['التصنيف'] || '').trim(),
              brand: String(r['الماركة'] || '').trim(),
              unit: String(r['الوحدة'] || 'قطعة').trim(),
              barcode: String(r['الباركود'] || '').trim(),
              unit_cost: parseFloat(r['سعر التكلفة']) || 0,
              unit_price: parseFloat(r['سعر البيع']) || 0,
              stock_qty: parseFloat(r['الكمية الابتدائية']) || 0,
              min_stock_level: parseFloat(r['الحد الأدنى للمخزون']) || 0,
              max_stock_level: r['الحد الأقصى للمخزون'] ? parseFloat(r['الحد الأقصى للمخزون']) : null,
              description: String(r['الوصف'] || '').trim(),
            }));
          resolve(items);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  // استيراد فعلي لقاعدة البيانات — ينشئ التصنيفات الناقصة تلقائيًا، ويتجاهل صفوف بدون كود/اسم
  async importItems(companyId, items) {
    const results = { success: 0, failed: 0, errors: [] };
    const categoryCache = {};

    // تحميل التصنيفات الموجودة مسبقًا
    const { data: existingCats } = await supabaseClient
      .from('item_categories').select('id, name').eq('company_id', companyId);
    (existingCats || []).forEach(c => categoryCache[c.name] = c.id);

    for (const item of items) {
      try {
        if (!item.code || !item.name) {
          results.failed++;
          results.errors.push(`صف بدون كود أو اسم تم تجاهله`);
          continue;
        }

        let categoryId = null;
        if (item.categoryName) {
          if (!categoryCache[item.categoryName]) {
            const { data: newCat } = await supabaseClient
              .from('item_categories')
              .insert({ company_id: companyId, name: item.categoryName })
              .select().single();
            categoryCache[item.categoryName] = newCat.id;
          }
          categoryId = categoryCache[item.categoryName];
        }

        const { error } = await supabaseClient.from('items').insert({
          company_id: companyId,
          code: item.code, name: item.name, category_id: categoryId,
          brand: item.brand || null, unit: item.unit, barcode: item.barcode || null,
          unit_cost: item.unit_cost, unit_price: item.unit_price, stock_qty: item.stock_qty,
          min_stock_level: item.min_stock_level, max_stock_level: item.max_stock_level,
          description: item.description || null,
        });

        if (error) { results.failed++; results.errors.push(`${item.code}: ${error.message}`); }
        else results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`${item.code || '؟'}: ${e.message}`);
      }
    }
    return results;
  }
};