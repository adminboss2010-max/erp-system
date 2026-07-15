/**
 * ============================================================
 * ApiClient — طبقة اتصال موحّدة مع الـ Backend (Google Apps Script)
 * ============================================================
 *
 * الهدف: أي صفحة أو موديول في الواجهة يتعامل مع السيرفر من هنا بس —
 * بدل ما كل جزء من الكود يعمل fetch() بنفسه ويعرف تفاصيل الـ action
 * والـ token والرابط. ده بيدّي فايدتين:
 *
 *  1) لو غيّرنا شكل الاتصال بالسيرفر مستقبلاً (مثلاً هجرة من Apps Script
 *     لـ backend تاني)، بنعدّل في الملف ده بس — من غير ما نلمس أي صفحة.
 *  2) كل نقاط الاتصال بقت مكان واحد، سهل مراجعتها وتتبع الأخطاء فيها.
 *
 * الملف ده لازم يتحمّل بعد config.js (عشان window.APPS_SCRIPT_URL يكون
 * موجود) وقبل أي كود بينادي عليه.
 */

const ApiClient = {

  _url() {
    return window.APPS_SCRIPT_URL;
  },

  _token() {
    return localStorage.getItem('erp_token');
  },

  // نداء عام لأي action على الـ backend. لو includeToken=false، مش بيبعت
  // التوكين (مستخدم في login/register/ping قبل ما يكون فيه جلسة أصلاً)
  async _call(action, payload, includeToken = true) {
    const body = Object.assign({ action }, payload || {});
    if (includeToken) {
      const token = this._token();
      if (token) body.token = token;
    }
    try {
      const res = await fetch(this._url(), {
        method: 'POST',
        // text/plain يتفادى CORS preflight مع Apps Script
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'تعذّر الاتصال بالسيرفر' };
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
    }
  },

  // ---------------- State (نسخة كاملة، للتحميل السريع) ----------------
  state: {
    save(state) {
      return ApiClient._call('saveState', { state });
    },
    load() {
      return ApiClient._call('loadState', {});
    }
  },

  // ---------------- Sheet Data (وصول عام لأي شيت بالاسم) ----------------
  sheet: {
    get(sheetName) {
      return ApiClient._call('getData', { sheet: sheetName });
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
    // tx: { id, dt, client, i, tp, amount, ag, items, nt, ... }
    postTransaction(tx) {
      return ApiClient._call('postTransaction', tx);
    }
  },

  // ---------------- Audit Log (جاهزة لأي لوحة تحكم مستقبلية) ----------------
  audit: {
    get(limit) {
      return ApiClient._call('getAuditLog', { limit: limit || 200 });
    }
  },

  // ---------------- Platform Admin (يوزر يشوف كل الشركات) ----------------
  admin: {
    login(email, password) {
      return ApiClient._call('adminLogin', { email, password }, false);
    },
    listCompanies() {
      return ApiClient._call('adminListCompanies', {});
    },
    setCompanyStatus(companyId, status) {
      return ApiClient._call('adminSetCompanyStatus', { companyId, status });
    },
    createCompany(name_ar, admin_email, password, logo, name_en) {
      return ApiClient._call('adminCreateCompany', { name_ar, admin_email, password, logo: logo || '', name_en: name_en || '' });
    },
    deleteCompany(companyId) {
      return ApiClient._call('adminDeleteCompany', { companyId });
    }
  }
};

if (typeof window !== 'undefined') window.ApiClient = ApiClient;
