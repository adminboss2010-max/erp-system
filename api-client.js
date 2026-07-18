/**
 * ============================================================
 * ApiClient — طبقة اتصال موحّدة وآمنة مع الـ Backend (Google Apps Script)
 * ============================================================
 */

const ApiClient = {

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
    ping() {
      return ApiClient._call('ping', {}, false);
    },
    login(admin_email, password) {
      return ApiClient._call('login', { admin_email, password }, false);
    },
    register(name_ar, admin_email, password, logo) {
      return ApiClient._call('register', { name_ar, admin_email, password, logo: logo || '' }, false);
    },
    // دالة تسجيل خروج حقيقية لإبلاغ السيرفر وتنظيف الكاش المحلي فوراً
    async logout() {
      const res = await ApiClient._call('logout', {});
      localStorage.removeItem('erp_token');
      return res;
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
    // معالجة وإرسال الفواتير والعمليات الحسابية بدعم الـ Idempotency الحرج لمنع التكرار
    postTransaction(tx) {
      if (!tx.i) {
        console.warn("تنبيه أمني: يفضل توليد رقم مستند (doc_no) فريد لمنع تكرار الفاتورة.");
      }
      return ApiClient._call('postTransaction', tx);
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
