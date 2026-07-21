/* ════════════════════════════════════════════════════════════════════
   ☁️ Infrastructure Layer - Cloud Sync + Audit + Mobile + Alerts
   الفئة الخامسة - البنية التحتية التقنية
   ✅ append-only - بدون تعديل أي دالة موجودة
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

// 🆕 بيانات الشركة الحقيقية (نفس المصدر اللي بيغذّي هيدر النظام) — تُستخدم
// في كل قوالب الطباعة (كشوف الحساب، الفواتير) بدل الأسماء الوهمية الثابتة
function getRealCompanyBranding() {
  try {
    const c = JSON.parse(localStorage.getItem('erp_company') || 'null');
    if (c && c.name_ar) {
      return {
        name: c.name_ar,
        logo: c.logo || c.name_ar.trim().charAt(0),
        email: c.admin_email || '',
        phone: c.phone || '',
        address: c.address || '',
        cr: c.cr_number || '',
        vat: c.vat_number || '',
        bank: c.bank_info || '',
      };
    }
  } catch (e) {}
  return { name: 'شركتك', logo: 'ش', email: '', phone: '', address: '', cr: '', vat: '', bank: '' };
}

// ════════════════════════════════════════════════════════════════════
// 📋 AUDIT LOG - سجل التدقيق
// ════════════════════════════════════════════════════════════════════

const AuditLog = {
  KEY: 'nayef_audit_log',
  USER_KEY: 'nayef_current_user',
  
  init() {
    // سجل دخول أولي إذا لم يوجد
    if(!localStorage.getItem(this.USER_KEY)) {
      const userId = 'user_' + Date.now().toString(36);
      localStorage.setItem(this.USER_KEY, userId);
      this.log('login', '👋 بداية جلسة جديدة', { userId });
    }
  },
  
  getUser() {
    return localStorage.getItem(this.USER_KEY) || 'guest';
  },
  
  log(action, message, details = {}) {
    try {
      const log = JSON.parse(localStorage.getItem(this.KEY) || '[]');
      const entry = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        action,
        message,
        details,
        user: this.getUser(),
        page: window.location.pathname || 'dashboard'
      };
      log.unshift(entry);
      // حفظ آخر 500 سجل فقط
      if(log.length > 500) log.length = 500;
      localStorage.setItem(this.KEY, JSON.stringify(log));
      return entry;
    } catch(e) {
      Logger.warn('⚠️ AuditLog failed:', e.message);
      return null;
    }
  },
  
  query(filter = 'all', limit = 50) {
    try {
      const log = JSON.parse(localStorage.getItem(this.KEY) || '[]');
      const filtered = filter === 'all' 
        ? log 
        : log.filter(e => {
            if(filter === 'data') return ['data_change', 'data_import', 'data_upload'].includes(e.action);
            if(filter === 'theme') return e.action === 'theme';
            if(filter === 'export') return e.action === 'export';
            if(filter === 'invoice') return e.action === 'invoice';
            if(filter === 'report') return e.action === 'report';
            if(filter === 'login') return e.action === 'login';
            if(filter === 'alert') return e.action === 'alert';
            return true;
          });
      return filtered.slice(0, limit);
    } catch(e) {
      return [];
    }
  },
  
  today() {
    const today = new Date().toISOString().split('T')[0];
    return this.query('all', 500).filter(e => e.timestamp.startsWith(today)).length;
  },
  
  total() {
    try {
      const log = JSON.parse(localStorage.getItem(this.KEY) || '[]');
      return log.length;
    } catch(e) { return 0; }
  },
  
  export() {
    const log = this.query('all', 500);
    const data = JSON.stringify(log, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nayef-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.log('export', '⬇️ تصدير سجل التدقيق', { count: log.length });
  },
  
  clear() {
    if(confirm('⚠️ هل أنت متأكد من مسح كل سجل التدقيق؟')) {
      localStorage.removeItem(this.KEY);
      this.log('system', '🗑️ تم مسح سجل التدقيق');
      this.render();
    }
  },
  
  render() {
    const filter = document.getElementById('auditFilter')?.value || 'all';
    const entries = this.query(filter, 30);
    const list = document.getElementById('auditList');
    if(!list) return;
    
    document.getElementById('auditTotal').textContent = this.total();
    document.getElementById('auditToday').textContent = this.today();
    document.getElementById('auditUser').textContent = this.getUser().substring(0, 12);
    
    if(entries.length === 0) {
      list.innerHTML = '<div class="infra-empty"><div class="infra-empty-icon">📋</div>لا توجد سجلات بعد</div>';
      return;
    }
    
    const actionIcons = {
      login: '🔐', logout: '🚪',
      data_change: '✏️', data_import: '📥', data_upload: '📤',
      theme: '🎨', export: '⬇️',
      invoice: '📄', report: '📑',
      alert: '🚨', system: '⚙️'
    };
    
    list.innerHTML = entries.map(e => {
      const dt = new Date(e.timestamp);
      const timeStr = dt.toLocaleString('ar-KW', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'});
      const icon = actionIcons[e.action] || '📌';
      
      return `<div class="audit-entry">
        <div class="audit-icon">${icon}</div>
        <div class="audit-body">
          <div class="audit-action">${e.message}</div>
          <div class="audit-meta">
            <span>🕐 ${timeStr}</span>
            <span>👤 ${e.user.substring(0,10)}</span>
            ${e.details && Object.keys(e.details).length ? '<span>📎 ' + Object.keys(e.details).length + ' تفاصيل</span>' : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }
};

window.AuditLog = AuditLog;
window.auditRender = () => AuditLog.render();
window.auditExport = () => AuditLog.export();
window.auditClear = () => AuditLog.clear();

// ════════════════════════════════════════════════════════════════════
// ☁️ CLOUD SYNC - المزامنة السحابية
// ════════════════════════════════════════════════════════════════════

const CloudSync = {
  // 🔑 مفاتيح الإعداد (تُحفظ محلياً فقط)
  TOKEN_KEY: 'nayef_cloud_token',
  GIST_ID_KEY: 'nayef_cloud_gist_id',
  FILE_NAME: 'ghuroob-naif-dashboard.json',

  // ⚙️ حالة المزامنة
  _syncing: false,
  _autoSyncEnabled: false,
  _autoSyncInterval: null,
  _lastSyncTs: 0,
  _lastError: null,
  _deviceId: null,

  getDeviceId() {
    if (this._deviceId) return this._deviceId;
    let id = localStorage.getItem('nayef_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('nayef_device_id', id);
    }
    this._deviceId = id;
    return id;
  },

  isConfigured() {
    return !!(this.getToken() && this.getGistId());
  },

  isEnabled() {
    return this._autoSyncEnabled && this.isConfigured();
  },

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || '';
  },

  getGistId() {
    return localStorage.getItem(this.GIST_ID_KEY) || '';
  },

  setToken(token) {
    if (token && token.trim()) {
      localStorage.setItem(this.TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  },

  setGistId(id) {
    if (id && id.trim()) {
      localStorage.setItem(this.GIST_ID_KEY, id.trim());
    } else {
      localStorage.removeItem(this.GIST_ID_KEY);
    }
  },

  disable() {
    this._autoSyncEnabled = false;
    if (this._autoSyncInterval) {
      clearInterval(this._autoSyncInterval);
      this._autoSyncInterval = null;
    }
  },

  async createGist(token, data) {
    const content = JSON.stringify(data, null, 2);
    const payload = {
      description: 'نظام إدارة مالية - الداشبورد المالي (مزامنة تلقائية)',
      public: false,
      files: { [this.FILE_NAME]: { content: content } },
    };
    const resp = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error('فشل إنشاء Gist: ' + resp.status);
    const json = await resp.json();
    return json.id;
  },

  async pushToGist(token, gistId, data) {
    const content = JSON.stringify(data, null, 2);
    const payload = {
      description: 'نظام إدارة مالية - الداشبورد المالي (آخر تحديث: ' + new Date().toLocaleString('ar-KW') + ')',
      files: { [this.FILE_NAME]: { content: content } },
    };
    const resp = await fetch('https://api.github.com/gists/' + gistId, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error('فشل رفع البيانات: ' + resp.status);
    return await resp.json();
  },

  async pullFromGist(token, gistId) {
    const resp = await fetch('https://api.github.com/gists/' + gistId, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
      },
    });
    if (!resp.ok) throw new Error('فشل تحميل البيانات: ' + resp.status);
    const json = await resp.json();
    const file = json.files[this.FILE_NAME] || json.files[Object.keys(json.files)[0]];
    if (!file) throw new Error('لم يُعثر على ملف البيانات');
    return JSON.parse(file.content);
  },

  async sync(force) {
    if (this._syncing) return { ok: false, reason: 'sync_in_progress' };
    if (!this.isConfigured()) return { ok: false, reason: 'not_configured' };

    this._syncing = true;
    this._lastError = null;

    try {
      const token = this.getToken();
      const gistId = this.getGistId();

      let cloudData = null;
      try {
        cloudData = await this.pullFromGist(token, gistId);
      } catch(e) {
        if (e.message.includes('404')) {
          const newId = await this.createGist(token, O);
          this.setGistId(newId);
          this._lastSyncTs = Date.now();
          localStorage.setItem('nayef_last_cloud_sync', String(this._lastSyncTs));
          return { ok: true, action: 'created', newGist: true };
        }
        throw e;
      }

      const cloudTs = (cloudData && cloudData._timestamp) || 0;
      const localTs = parseInt(localStorage.getItem('nayef_last_save') || '0');

      let merged, action;
      if (cloudTs > localTs) {
        merged = cloudData;
        action = 'pulled_from_cloud';
      } else if (localTs > cloudTs) {
        await this.pushToGist(token, gistId, O);
        merged = O;
        action = 'pushed_to_cloud';
      } else {
        const localSize = JSON.stringify(O).length;
        const cloudSize = JSON.stringify(cloudData).length;
        if (cloudSize > localSize * 1.2) {
          merged = cloudData;
          action = 'pulled_from_cloud_larger';
        } else {
          await this.pushToGist(token, gistId, O);
          merged = O;
          action = 'pushed_to_cloud_synced';
        }
      }

      if (action.startsWith('pulled')) {
        try { localStorage.setItem('nayef_pre_cloud_sync_snapshot', JSON.stringify(O)); } catch(e) {}
        if (typeof O === 'object' && merged && typeof merged === 'object') {
          for (const key of Object.keys(merged)) {
            O[key] = merged[key];
          }
          window.O = O;
        }
        if (typeof nayefSaveData === 'function') nayefSaveData();
        if (typeof window !== 'undefined' && window.StorageV2 && window.StorageV2.save) {
          window.StorageV2.save(O).catch(function() {});
        }
      }

      this._lastSyncTs = Date.now();
      localStorage.setItem('nayef_last_cloud_sync', String(this._lastSyncTs));

      return { ok: true, action: action, ts: this._lastSyncTs };
    } catch(e) {
      this._lastError = e.message;
      Logger.error('CloudSync error:', e);
      return { ok: false, error: e.message };
    } finally {
      this._syncing = false;
    }
  },

  startAutoSync(intervalSeconds) {
    intervalSeconds = intervalSeconds || 60;
    if (this._autoSyncInterval) clearInterval(this._autoSyncInterval);
    this._autoSyncEnabled = true;

    setTimeout(() => this.sync().catch(() => {}), 3000);

    this._autoSyncInterval = setInterval(() => {
      if (!navigator.onLine) return;
      this.sync().then(r => {
        if (r.ok) {
          Logger.info('☁️ Auto-sync:', r.action);
          this.updateStatusUI();
        }
      }).catch(() => {});
    }, intervalSeconds * 1000);

    Logger.info('☁️ Cloud sync started, interval:', intervalSeconds, 's');
  },

  hookSaveData() {
    const original = window.nayefSaveData;
    if (!original || original._hooked) return;

    let debounceTimer = null;
    const hooked = function() {
      original.apply(this, arguments);
      if (!CloudSync._autoSyncEnabled) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!navigator.onLine) return;
        CloudSync.sync().then(() => CloudSync.updateStatusUI()).catch(() => {});
      }, 5000);
    };
    hooked._hooked = true;
    window.nayefSaveData = hooked;
    Logger.info('☁️ CloudSync hooked into nayefSaveData');
  },

  getStatus() {
    const lastSync = parseInt(localStorage.getItem('nayef_last_cloud_sync') || '0');
    const ageMs = lastSync ? Date.now() - lastSync : null;
    const ageStr = ageMs === null ? 'لم تتم المزامنة بعد' :
      ageMs < 60000 ? 'قبل لحظات' :
      ageMs < 3600000 ? Math.floor(ageMs/60000) + ' دقيقة' :
      ageMs < 86400000 ? Math.floor(ageMs/3600000) + ' ساعة' :
      Math.floor(ageMs/86400000) + ' يوم';
    return {
      configured: this.isConfigured(),
      enabled: this.isEnabled(),
      online: navigator.onLine,
      syncing: this._syncing,
      lastSync: lastSync,
      lastSyncStr: ageStr,
      lastError: this._lastError,
      deviceId: this.getDeviceId().slice(0, 14),
    };
  },

  updateStatusUI() {
    const indicator = document.getElementById('cloudSyncIndicator');
    if (!indicator) return;
    const s = this.getStatus();
    if (!s.configured) {
      indicator.innerHTML = '☁️⚪';
      indicator.title = 'مزامنة سحابية: غير مُعدة';
      indicator.style.background = '#95a5a6';
    } else if (!s.enabled) {
      indicator.innerHTML = '☁️⏸️';
      indicator.title = 'مزامنة سحابية: مُعدة لكن متوقفة';
      indicator.style.background = '#f39c12';
    } else if (s.syncing) {
      indicator.innerHTML = '☁️⟳';
      indicator.title = 'مزامنة سحابية: قيد المزامنة...';
      indicator.style.background = '#3498db';
    } else if (!s.online) {
      indicator.innerHTML = '☁️📴';
      indicator.title = 'مزامنة سحابية: غير متصل - ستتم عند عودة الإنترنت';
      indicator.style.background = '#e74c3c';
    } else {
      const icon = s.lastError ? '⚠️' : '✅';
      indicator.innerHTML = '☁️' + icon;
      indicator.title = 'مزامنة سحابية: ' + s.lastSyncStr + (s.lastError ? ' (' + s.lastError + ')' : '');
      indicator.style.background = s.lastError ? '#e74c3c' : '#27ae60';
    }
  },

  init() {
    // تهيئة افتراضية
    this.hookSaveData();
    if (this.isConfigured()) {
      setTimeout(() => {
        this.startAutoSync(60);
        this.updateStatusUI();
      }, 5000);
    }
    setInterval(() => this.updateStatusUI(), 30000);
  },
};

window.CloudSync = CloudSync;
window.CloudSync.init && window.CloudSync.init();
// 🆕 v220.7+: أعد توجيه أزرار البنية القديمة إلى النظام الجديد
window.csDisconnect = () => CloudSync.disable();
window.csSyncNow = () => CloudSync.sync().then(r => showToast && showToast('☁️', r.ok ? 'تمت: ' + r.action : ('فشل: ' + r.error), r.ok));
window.csExport = () => StorageV2.exportJSON();
window.csImport = () => { document.getElementById('restoreFileInput') && document.getElementById('restoreFileInput').click(); };
window.csUpdateFields = () => {}; // no-op (UI الجديدة في مركز النسخ)

// ════════════════════════════════════════════════════════════════════
// 📱 MOBILE / MULTI-DEVICE - توليد QR للجوال
// ════════════════════════════════════════════════════════════════════

function infraGenerateQR() {
  const container = document.getElementById('qrCodeContainer');
  if(!container) return;
  
  // توليد QR وهمي للعرض (في الإنتاج: استخدم مكتبة qrcode.js)
  const size = 25;
  const seed = (Date.now() ^ (CloudSync.config?.connectedAt || 'demo')).toString();
  let hash = 0;
  for(let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  
  let html = '';
  for(let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    // زوايا الـ QR
    const isCorner = (x < 7 && y < 7) || (x > size-8 && y < 7) || (x < 7 && y > size-8);
    const isCornerCenter = isCorner && ((x === 0 || x === 6 || x === size-1 || x === size-7) || (y === 0 || y === 6 || y === size-1 || y === size-7));
    const isCornerInner = isCorner && (x >= 2 && x <= 4) && (y >= 2 && y <= 4);
    const isCornerInner2 = isCorner && (x >= size-5 && x <= size-3) && (y >= 2 && y <= 4);
    const isCornerInner3 = isCorner && (x >= 2 && x <= 4) && (y >= size-5 && y <= size-3);
    
    const isFilled = isCornerCenter || isCornerInner || isCornerInner2 || isCornerInner3 || 
                     ((hash >> (i % 31)) & 1) === 1;
    
    html += `<div class="qr-cell${isFilled ? '' : ' qr-cell--empty'}"></div>`;
  }
  container.innerHTML = html;
  
  // تحديث الرابط
  const sessionId = (window.O && window.O._v) || 'nayef-' + Date.now().toString(36);
  const url = `${window.location.origin}${window.location.pathname}?mobile=${sessionId}&token=${Date.now().toString(36)}`;
  const urlInput = document.getElementById('mobileUrl');
  if(urlInput) urlInput.value = url;
}

window.infraGenerateQR = infraGenerateQR;

window.infraCopyMobileUrl = () => {
  const url = document.getElementById('mobileUrl');
  if(url) {
    url.select();
    document.execCommand('copy');
    CloudSync.showToast('✅ تم نسخ الرابط');
    AuditLog.log('system', '📋 نسخ رابط الجوال');
  }
};

// ════════════════════════════════════════════════════════════════════
// 📨 SMART ALERTS - تنبيهات WhatsApp/SMS
// ════════════════════════════════════════════════════════════════════

const SmartAlerts = {
  WHATSAPP_KEY: 'nayef_whatsapp_number',
  TWILIO_KEY: 'nayef_twilio_config',
  
  templates: [
    {
      id: 'critical_collection',
      icon: '💸',
      name: 'تحصيل متأخر (حرج)',
      severity: 'critical',
      generator: (alert) => `🚨 *تنبيه حرج من نظام إدارة مالية*

💸 *تحصيل متأخر*
العميل: ${alert.client || '—'}
المبلغ المستحق: ${alert.amount || '—'} د.ك
آخر تحصيل: قبل ${alert.days || '—'} يوم

⚠️ تجاوز الحد الآمن (5000 د.ك)
🎯 الإجراء: اتصل بالعميل فوراً + أوقف البيع`
    },
    {
      id: 'silent_client',
      icon: '🔇',
      name: 'عميل صامت',
      severity: 'high',
      generator: (alert) => `⚠️ *تنبيه - عميل صامت*

🔇 لم يشترِ منذ ${alert.days || '—'} يوم
العميل: ${alert.client || '—'}
آخر طلب: ${alert.lastOrder || '—'}
قيمة مبيعاته السابقة: ${alert.amount || '—'} د.ك

💡 *الإجراء المقترح:*
تواصل شخصي + عرض خاص لاستعادته`
    },
    {
      id: 'agent_decline',
      icon: '📉',
      name: 'مندوب متراجع',
      severity: 'high',
      generator: (alert) => `📉 *تنبيه أداء - مندوب*

المندوب: ${alert.agent || '—'}
انخفاض: ${alert.decline || '—'}% خلال آخر 3 أشهر
مبيعات الفترة: ${alert.amount || '—'} د.ك

🎯 *يحتاج:*
- مقابلة شخصية
- خطة تحسين
- مراجعة الزيارات`
    },
    {
      id: 'goal_risk',
      icon: '🎯',
      name: 'هدف المبيعات في خطر',
      severity: 'high',
      generator: (alert) => `🎯 *تنبيه - تحقيق الهدف*

الشهر الحالي: ${alert.current || '—'} د.ك
المتوقع: ${alert.target || '—'} د.ك
نسبة التحقيق: ${alert.pct || '—'}%

⚠️ في خطر الوصول للهدف الشهري

💡 *الإجراء:*
حملة تحفيزية + عروض نهاية الشهر`
    },
    {
      id: 'daily_summary',
      icon: '📊',
      name: 'ملخص يومي',
      severity: 'info',
      generator: (k) => `📊 *ملخص اليوم - نظام إدارة مالية*

📅 ${new Date().toLocaleDateString('ar-KW')}
🏥 صحة الشركة: ${k.overall}/100 (${k.grade})
💰 هامش الربح: ${k.margin.toFixed(1)}%
🎯 نسبة التحصيل: ${k.collectionRate.toFixed(1)}%
✅ عملاء نشطون: ${k.activeClients}
⚠️ مخاطر: ${k.riskyClients}

📋 لمزيد من التفاصيل افتح اللوحة`
    },
    {
      id: 'opportunity',
      icon: '💎',
      name: 'فرصة ترقية عميل',
      severity: 'info',
      generator: (alert) => `💎 *فرصة ذهبية*

العميل: ${alert.client || '—'}
مبيعات: ${alert.amount || '—'} د.ك
نسبة تحصيل: ${alert.rate || '—'}%
تصنيف: ⭐ عميل ذهبي مخلص

🎁 *اقتراح:*
عرض حصري + خصم ولاء لترسيخ العلاقة`
    }
  ],
  
  init() {
    this.render();
  },
  
  render() {
    const list = document.getElementById('msgTemplatesList');
    if(!list) return;
    
    const k = (typeof kpi_compute === 'function') ? kpi_compute() : {overall:0, margin:0, collectionRate:0, activeClients:0, riskyClients:0, grade:'—'};
    k.grade = (kpi_grd && typeof kpi_grd === 'function') ? kpi_grd(k.overall).g : '—';
    
    list.innerHTML = this.templates.map(t => {
      let sample;
      try {
        if(t.id === 'daily_summary') sample = t.generator(k);
        else sample = t.generator({client:'جمعية الفجر', amount:'10,000', days:'75', decline:'25', lastOrder:'2026-04-11', current:'45,000', target:'80,000', pct:'56', agent:'أحمد', rate:'95%'});
      } catch(e) { sample = '...'; }
      
      return `<div class="msg-template" onclick="msgSendTemplate('${t.id}')">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:18px">${t.icon}</span>
          <strong style="font-size:13px;color:var(--tx)">${t.name}</strong>
          <span style="margin-right:auto;font-size:10px;padding:2px 6px;background:${
            t.severity==='critical' ? '#c0392b' : 
            t.severity==='high' ? '#e67e22' : 
            t.severity==='medium' ? '#f39c12' : '#1e8449'
          };color:white;border-radius:4px">${t.severity === 'critical' ? '🚨 حرج' : t.severity === 'high' ? '⚠️ عالي' : 'ℹ️ معلومة'}</span>
        </div>
        <div class="msg-template-preview">${sample.replace(/\*/g, '')}</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:8px">
          📱 اضغط للإرسال عبر واتساب
        </div>
      </div>`;
    }).join('');
  },
  
  sendTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if(!template) return;
    
    const k = (typeof kpi_compute === 'function') ? kpi_compute() : {overall:0, margin:0, collectionRate:0, activeClients:0, riskyClients:0, grade:'—'};
    k.grade = (kpi_grd && typeof kpi_grd === 'function') ? kpi_grd(k.overall).g : '—';
    
    let message;
    try {
      if(template.id === 'daily_summary') {
        message = template.generator(k);
      } else {
        // محاولة جلب بيانات حقيقية من الإنذارات
        const alerts = (typeof ews_detect === 'function') ? ews_detect() : [];
        const relatedAlert = alerts.find(a => 
          (template.id === 'critical_collection' && a.title === 'تحصيل متأهر') ||
          (template.id === 'silent_client' && a.title === 'عميل صامت') ||
          (template.id === 'agent_decline' && a.title === 'مندوب متراجع') ||
          (template.id === 'goal_risk' && a.title === 'هدف المبيعات في خطر') ||
          (template.id === 'opportunity' && a.title === 'فرصة ترقية عميل')
        );
        if(relatedAlert) {
          message = template.generator({client:'(انظر اللوحة)', amount:'—', days:'—'});
        } else {
          message = template.generator({});
        }
      }
    } catch(e) {
      message = 'تنبيه من نظام إدارة مالية';
    }
    
    const phone = document.getElementById('msgWhatsapp')?.value || '965';
    const cleanedPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
    AuditLog.log('alert', `📨 إرسال قالب: ${template.name}`);
    CloudSync.showToast('✅ تم فتح واتساب لإرسال الرسالة');
  },
  
  sendCritical() {
    if(typeof ews_detect !== 'function') {
      CloudSync.showToast('⚠️ نظام الإنذارات غير متاح');
      return;
    }
    
    const alerts = ews_detect().filter(a => a.level === 'critical' || a.level === 'high');
    if(alerts.length === 0) {
      CloudSync.showToast('✅ لا توجد إنذارات حرجة لإرسالها');
      return;
    }
    
    // تجميع الإنذارات في رسالة واحدة
    let message = `🚨 *تقرير الإنذارات - نظام إدارة مالية*
📅 ${new Date().toLocaleString('ar-KW')}

`;
    message += `عدد الإنذارات الحرجة: ${alerts.length}

`;
    message += alerts.slice(0, 5).map((a, i) => 
      `${i+1}. ${a.icon} *${a.title}*\n${a.msg.replace(/<[^>]+>/g, '')}\n`
    ).join('\n');
    
    const phone = document.getElementById('msgWhatsapp')?.value || '965';
    const cleanedPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
    AuditLog.log('alert', `🚨 إرسال إنذارات حرجة (${alerts.length})`);
    CloudSync.showToast(`✅ تم فتح واتساب مع ${alerts.length} إنذار`);
  }
};

window.SmartAlerts = SmartAlerts;
window.msgSendTemplate = (id) => SmartAlerts.sendTemplate(id);
window.msgSendCritical = () => SmartAlerts.sendCritical();
window.msgSaveTwilio = () => {
  const cfg = {
    sid: document.getElementById('twilioSid')?.value || '',
    token: document.getElementById('twilioToken')?.value || '',
    from: document.getElementById('twilioFrom')?.value || ''
  };
  localStorage.setItem(SmartAlerts.TWILIO_KEY, JSON.stringify(cfg));
  AuditLog.log('system', '💾 حفظ إعدادات Twilio');
  CloudSync.showToast('✅ تم حفظ إعدادات Twilio');
};

// ════════════════════════════════════════════════════════════════════
// 🎛️ INFRA PANEL CONTROL
// ════════════════════════════════════════════════════════════════════

window.openInfraPanel = function() {
  document.getElementById('infraPanel').classList.add('infra-panel--open');
  CloudSync.updateUI();
  AuditLog.render();
  infraGenerateQR();
  SmartAlerts.render();
  AuditLog.log('system', '🔧 فتح مركز البنية التحتية');
};

window.closeInfraPanel = function() {
  document.getElementById('infraPanel').classList.remove('infra-panel--open');
};

window.infraSwitchTab = function(tabName) {
  document.querySelectorAll('.infra-section').forEach(s => s.classList.remove('infra-section--active'));
  document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('infra-tab--active'));
  document.getElementById('infraSec_' + tabName)?.classList.add('infra-section--active');
  document.getElementById('infraTab_' + tabName)?.classList.add('infra-tab--active');
  
  if(tabName === 'audit') AuditLog.render();
  if(tabName === 'mobile') infraGenerateQR();
  if(tabName === 'alerts') SmartAlerts.render();
};

// ════════════════════════════════════════════════════════════════════
// 🎯 HOOK: تتبع تغييرات البيانات في Audit Log
// ════════════════════════════════════════════════════════════════════

function infraHookDataChanges() {
  // 📡 مصدر حقيقة واحد: O و D فقط (window.O/D مراجع قراءة)
  
  const orig = window.recompute;
  if(typeof orig === 'function' && !orig._infraHooked) {
    window.recompute = function(a, b) {
      const r = orig.apply(this, arguments);
      // 📡 مزامنة window.D فقط (البيانات المفلترة) - window.O تبقى كما هي
      try {
        if(typeof D !== 'undefined') window.D = D;
        if(typeof nayefSaveData === 'function') nayefSaveData();
      } catch(e) {}
      // تسجيل في Audit
      if(Math.random() < 0.1) {
        AuditLog.log('data_change', '🔄 إعادة حساب البيانات', { range: [a, b] });
      }
      return r;
    };
    window.recompute._infraHooked = true;
  }
  
  // تتبع تغيير السمة
  const origSetBg = window.setBgTheme;
  if(typeof origSetBg === 'function' && !origSetBg._hooked) {
    window.setBgTheme = function(theme) {
      AuditLog.log('theme', `🎨 تغيير السمة إلى: ${theme}`);
      return origSetBg.apply(this, arguments);
    };
    window.setBgTheme._hooked = true;
  }
}

// ════════════════════════════════════════════════════════════════════
// 🚀 INITIALIZATION
// ════════════════════════════════════════════════════════════════════

function infraInit() {
  AuditLog.init();
  CloudSync.init();
  SmartAlerts.init();
  MsgBuilder.init();
  infraHookDataChanges();
  
  // تحديث دوري
  setInterval(() => {
    if(document.getElementById('infraPanel').classList.contains('infra-panel--open')) {
      CloudSync.updateUI();
      AuditLog.render();
    }
  }, 5000);
}

if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', infraInit);
} else {
  infraInit();
}



// ════════════════════════════════════════════════════════════════════
// 🛠️ Custom WhatsApp Message Builder - أداة بناء الرسائل المخصصة
// ════════════════════════════════════════════════════════════════════

const MsgBuilder = {
  source: 'client',
  entityId: null,
  selectedFields: new Set(),
  customText: '',
  
  // الحقول المتاحة لكل مصدر
  fieldsMap: {
    client: [
      {key:'nm', label:'اسم العميل', emoji:'👤'},
      {key:'ag', label:'المندوب', emoji:'🚗'},
      {key:'s', label:'إجمالي المبيعات', emoji:'💰', format:'currency'},
      {key:'c', label:'إجمالي التحصيل', emoji:'✅', format:'currency'},
      {key:'ot', label:'الذمم القائمة', emoji:'⏳', format:'currency'},
      {key:'rt', label:'نسبة التحصيل', emoji:'📊', format:'percent'},
      {key:'li', label:'آخر طلب', emoji:'📅', format:'date'},
      {key:'lc', label:'آخر تحصيل', emoji:'💵', format:'date'},
      {key:'pr', label:'الربح', emoji:'📈', format:'currency'},
      {key:'g', label:'تكلفة البضاعة', emoji:'📦', format:'currency'},
    ],
    agent: [
      {key:'nm', label:'اسم المندوب', emoji:'🚗'},
      {key:'cr', label:'معدل التحصيل', emoji:'📊', format:'percent'},
      {key:'totalSales', label:'إجمالي المبيعات', emoji:'💰', format:'currency'},
      {key:'clientsCount', label:'عدد العملاء', emoji:'👥', format:'number'},
      {key:'avgOrder', label:'متوسط الطلبية', emoji:'🛒', format:'currency'},
    ],
    product: [
      {key:'name', label:'اسم المنتج', emoji:'📦'},
      {key:'totalQty', label:'إجمالي الكمية', emoji:'🔢', format:'number'},
      {key:'totalAmount', label:'إجمالي المبيعات', emoji:'💰', format:'currency'},
      {key:'avgPrice', label:'متوسط السعر', emoji:'💲', format:'currency'},
      {key:'txCount', label:'عدد المعاملات', emoji:'📋', format:'number'},
      {key:'lastSold', label:'آخر بيع', emoji:'📅', format:'date'},
    ],
    summary: [
      {key:'period', label:'الفترة الزمنية', emoji:'📅'},
      {key:'totalSales', label:'إجمالي المبيعات', emoji:'💰', format:'currency'},
      {key:'totalCollected', label:'إجمالي التحصيل', emoji:'✅', format:'currency'},
      {key:'outstanding', label:'الذمم القائمة', emoji:'⏳', format:'currency'},
      {key:'margin', label:'هامش الربح', emoji:'📈', format:'percent'},
      {key:'overall', label:'درجة الصحة', emoji:'🏥', format:'grade'},
      {key:'activeClients', label:'العملاء النشطون', emoji:'✅', format:'number'},
      {key:'riskyClients', label:'العملاء عاليو المخاطر', emoji:'⚠️', format:'number'},
      {key:'criticalAlerts', label:'الإنذارات الحرجة', emoji:'🚨', format:'number'},
    ]
  },
  
  // تنسيق القيمة
  format(value, type) {
    if(value === null || value === undefined || value === '') return '—';
    try {
      switch(type) {
        case 'currency':
          if(typeof KD === 'function') {
            // KD يُرجع "85,000 د.ك" بالفعل
            return KD(value);
          }
          return Number(value).toLocaleString() + ' د.ك';
        case 'percent':
          return Number(value).toFixed(1) + '%';
        case 'date':
          return new Date(value).toLocaleDateString('ar-KW');
        case 'number':
          return Number(value).toLocaleString('en');
        case 'grade':
          if(typeof kpi_grd === 'function') {
            const g = kpi_grd(Number(value));
            return g.g + ' (' + value + '/100)';
          }
          return value + '/100';
        default:
          return String(value);
      }
    } catch(e) { return String(value); }
  },
  
  // استخراج البيانات من النظام - يجرب عدة طرق للوصول
  extractData() {
    let O = {}, D = {};
    try {
      // 1) من window (إذا تم تصديرها)
      if(typeof window !== 'undefined') {
        O = window.O || {};
        D = window.D || {};
      }
      
      // 2) محاولة eval للوصول للمتغيرات المحلية
      if(!O.soc || !O.soc.length) {
        try {
          const evalO = (typeof eval !== 'undefined') ? eval('typeof O !== "undefined" ? O : null') : null;
          const evalD = (typeof eval !== 'undefined') ? eval('typeof D !== "undefined" ? D : null') : null;
          if(evalO) O = evalO;
          if(evalD) D = evalD;
        } catch(e) {}
      }
      
      // 3) محاولة globalThis
      if(!O.soc || !O.soc.length) {
        try {
          if(typeof globalThis !== 'undefined') {
            O = globalThis.O || O;
            D = globalThis.D || D;
          }
        } catch(e) {}
      }
      
      // اختيار الأحدث
      const data = (D && D.soc && D.soc.length) ? D : ((O && O.soc && O.soc.length) ? O : {});
      
      if(!data || !data.soc || !data.soc.length) return {};
      
      switch(this.source) {
        case 'client':
          return this.extractClientData(data);
        case 'agent':
          return this.extractAgentData(data);
        case 'product':
          return this.extractProductData(data);
        case 'summary':
          return this.extractSummaryData(data);
      }
    } catch(e) {
      Logger.warn('extractData error:', e);
      return {};
    }
  },
  
  extractClientData(data) {
    if(this.entityId === null) return {};
    // البحث بالاسم (لأن entityId الآن هو الـ name)
    const c = data.soc.find(s => s.nm === this.entityId);
    if(!c) return {};
    
    return {
      nm: c.nm || '—',
      ag: c.ag || '—',
      s: c.s || 0,
      c: c.c || 0,
      ot: c.ot || 0,
      rt: c.rt || 0,
      li: c.li || null,
      lc: c.lc || null,
      pr: c.pr || 0,
      g: c.g || 0,
    };
  },
  
  extractAgentData(data) {
    if(this.entityId === null) return {};
    const a = (data.ag || [])[this.entityId];
    if(!a) return {};
    
    const agentName = a.nm || '—';
    const agentClients = (data.soc || []).filter(s => s.ag === agentName);
    const totalSales = agentClients.reduce((sum, s) => sum + (s.s || 0), 0);
    const avgOrder = agentClients.length > 0 ? totalSales / agentClients.length : 0;
    
    return {
      nm: agentName,
      cr: a.cr || a.rt || 0,
      totalSales: totalSales,
      clientsCount: agentClients.length,
      avgOrder: avgOrder,
    };
  },
  
  extractProductData(data) {
    if(this.entityId === null) return {};
    const items = (data.tx || []).filter(t => t.item);
    const productMap = {};
    
    items.forEach(t => {
      const key = t.item;
      if(!productMap[key]) {
        productMap[key] = {
          name: key,
          totalQty: 0,
          totalAmount: 0,
          txCount: 0,
          dates: []
        };
      }
      productMap[key].totalQty += (parseFloat(t.qty) || parseFloat(t.q) || 1);
      productMap[key].totalAmount += (parseFloat(t.amount) || parseFloat(t.amt) || 0);
      productMap[key].txCount++;
      if(t.dt) productMap[key].dates.push(t.dt);
    });
    
    const products = Object.values(productMap).sort((a,b) => b.totalAmount - a.totalAmount);
    const p = products[this.entityId];
    if(!p) return {};
    
    const lastDate = p.dates.length > 0 ? p.dates.sort().reverse()[0] : null;
    return {
      name: p.name,
      totalQty: p.totalQty,
      totalAmount: p.totalAmount,
      avgPrice: p.totalQty > 0 ? p.totalAmount / p.totalQty : 0,
      txCount: p.txCount,
      lastSold: lastDate,
    };
  },
  
  extractSummaryData(data) {
    const T = data.T || {};
    let margin = 0;
    if(typeof kpi_compute === 'function') {
      try { margin = kpi_compute().margin || 0; } catch(e) {}
    }
    
    let activeClients = 0;
    let riskyClients = 0;
    let criticalAlerts = 0;
    
    try {
      const today = (typeof DashboardConfig !== 'undefined') ? DashboardConfig.getAsOfDate() : new Date();
      (data.soc || []).forEach(s => {
        if(s.li) {
          const days = Math.floor((today - new Date(s.li)) / 864e5);
          if(days <= 60) activeClients++;
        }
        if((s.ot || 0) > 2000 || (s.rt || 0) < 30) riskyClients++;
      });
      
      if(typeof ews_detect === 'function') {
        criticalAlerts = ews_detect().filter(a => a.level === 'critical').length;
      }
    } catch(e) {}
    
    return {
      period: (data.ml && data.ml[0] ? data.ml[0] : '') + ' - ' + (data.ml && data.ml.length ? data.ml[data.ml.length-1] : ''),
      totalSales: T.s || 0,
      totalCollected: T.c || 0,
      outstanding: (data.soc || []).reduce((s, x) => s + (x.ot || 0), 0),
      margin: margin,
      overall: typeof kpi_compute === 'function' ? kpi_compute().overall : 0,
      activeClients: activeClients,
      riskyClients: riskyClients,
      criticalAlerts: criticalAlerts,
    };
  },
  
  // اختيار المصدر
  setSource(source) {
    this.source = source;
    this.entityId = null;
    this.selectedFields.clear();
    
    // تحديث الـ UI
    document.querySelectorAll('.msg-source-btn').forEach(b => {
      b.classList.toggle('msg-source-btn--active', b.dataset.source === source);
    });
    
    this.renderEntitySelector();
    this.renderFields();
    this.updatePreview();
  },
  
  // رسم قائمة الكيانات
  renderEntitySelector() {
    const container = document.getElementById('msgEntitySelector');
    if(!container) return;
    
    let options = [];
    
    try {
      // محاولة الوصول من عدة مصادر
      let O = {};
      if(typeof window !== 'undefined' && window.O) O = window.O;
      if(!O.soc || !O.soc.length) {
        try {
          const evalO = eval('typeof O !== "undefined" ? O : null');
          if(evalO && evalO.soc) O = evalO;
        } catch(e) {}
      }
      
      // تطبيق الفلتر على المعاملات إذا كان مفعّل
      const filteredTx = this.filterTransactions(O.tx || []);
      
      switch(this.source) {
        case 'client':
          if(O.soc && O.soc.length) {
            options = O.soc.map((c) => {
              // حساب مبيعات العميل في الفترة المفلترة
              let periodSales = 0;
              let periodCount = 0;
              if(this.dateFilter.enabled && this.dateFilter.fromDate) {
                filteredTx.forEach(t => {
                  if(t.client === c.nm) {
                    periodSales += (parseFloat(t.amount) || parseFloat(t.amt) || 0);
                    periodCount++;
                  }
                });
              }
              const displayValue = this.dateFilter.enabled && this.dateFilter.fromDate 
                ? periodSales 
                : (c.s || 0);
              const countInfo = this.dateFilter.enabled && periodCount > 0 
                ? ` • ${periodCount} عملية` 
                : '';
              // ✅ نستخدم name كقيمة لتجنب التعارض مع الفلتر
              return {
                value: (c.nm || '').replace(/"/g, '&quot;'),
                label: c.nm || ('عميل ' + (Math.random() * 1000)),
                sub: (c.ag ? c.ag + ' • ' : '') + (typeof KD === 'function' ? KD(displayValue) : displayValue) + ' د.ك' + countInfo
              };
            });
          }
          break;
        case 'agent':
          // ✅ المناديب تأتي فقط من O.ag (صفحة المناديب في الداشبورد)
          // لا نستخدم fallback من soc.ag لأن المستخدم يريد الدقة
          const agentsList = O.ag || [];
          if(agentsList.length === 0) {
            // إذا كانت فارغة، ابحث في D.ag أيضاً
            const D = (typeof window !== 'undefined' && window.D) ? window.D : {};
            const altAgents = D.ag || [];
            if(altAgents.length === 0) {
              // أخيراً، fallback لـ soc.ag فقط كتحذير
              const fallbackAgents = this.uniqueAgents(O.soc || []);
              options = fallbackAgents.map((a, i) => ({
                value: i,
                label: '⚠️ ' + (a.nm || ('مندوب ' + (i+1))),
                sub: 'من soc.ag - تحقق من شيت المناديب'
              }));
            } else {
              options = altAgents.map((a, i) => ({
                value: i,
                label: a.nm || ('مندوب ' + (i+1)),
                sub: 'تحصيل: ' + (a.rt || a.cr || 0) + '%'
              }));
            }
          } else {
            options = agentsList.map((a) => ({
              value: (a.nm || '').replace(/"/g, '&quot;'),
              label: a.nm || ('مندوب ' + (Math.random() * 1000)),
              sub: 'تحصيل: ' + (a.rt || a.cr || 0) + '% • ' + (a.sc || 0) + ' جمعية'
            }));
          }
          break;
        case 'product':
          const products = this.uniqueProducts(O.tx || []);
          options = products.map((p) => ({
            value: (p.name || '').replace(/"/g, '&quot;'),
            label: p.name,
            sub: (typeof KD === 'function' ? KD(p.totalAmount) : p.totalAmount) + ' د.ك'
          }));
          break;
        case 'summary':
          options = [{value: 0, label: '📊 ملخص الفترة الحالية', sub: 'بيانات شاملة'}];
          break;
      }
    } catch(e) {
      Logger.warn('renderEntitySelector:', e);
    }
    
    if(options.length === 0) {
      container.innerHTML = '<div class="msg-empty-entity">⚠️ لا توجد بيانات متاحة. ارفع البيانات أولاً.</div>';
      return;
    }
    
    const selectId = 'msgEntitySelect_' + this.source;
    container.innerHTML = `
      <label style="font-size:12px;font-weight:700;color:var(--tx2);display:block;margin-bottom:8px">🎯 2. اختر الكيان المحدد:</label>
      <select id="${selectId}" onchange="MsgBuilder.setEntity(this.value)" style="width:100%;padding:10px;background:var(--canvas-bg-alt);border:1px solid var(--line-soft);border-radius:10px;color:var(--tx);font-size:13px">
        <option value="">-- اختر --</option>
        ${options.map(o => `<option value="${o.value}">${o.label}${o.sub ? ' — ' + o.sub : ''}</option>`).join('')}
      </select>
      <div id="msgEntityStats"></div>
    `;
  },
  
  uniqueAgents(socs) {
    const seen = new Set();
    const result = [];
    socs.forEach(s => {
      if(s.ag && !seen.has(s.ag)) {
        seen.add(s.ag);
        result.push({nm: s.ag});
      }
    });
    return result;
  },
  
  uniqueProducts(txs) {
    const map = {};
    txs.forEach(t => {
      if(t.item) {
        if(!map[t.item]) map[t.item] = {name: t.item, totalAmount: 0};
        map[t.item].totalAmount += (parseFloat(t.amount) || parseFloat(t.amt) || 0);
      }
    });
    return Object.values(map).sort((a,b) => b.totalAmount - a.totalAmount);
  },
  
  // اختيار الكيان - نحفظ الـ name بدل الـ index لتجنب التعارض
  setEntity(value) {
    // value هو الـ name (وليس الـ index) لتجنب التغير مع الفلتر
    this.entityId = value === '' ? null : value; // حفظ الـ name
    this.selectedFields.clear();
    
    // تفعيل كل الحقول افتراضياً
    const fields = this.fieldsMap[this.source] || [];
    fields.forEach(f => this.selectedFields.add(f.key));
    
    this.renderFields();
    this.renderEntityStats();
    this.updatePreview();
  },
  
  renderEntityStats() {
    const container = document.getElementById('msgEntityStats');
    if(!container) return;
    
    if(this.entityId === null) {
      container.innerHTML = '';
      return;
    }
    
    const data = this.extractData();
    const fields = this.fieldsMap[this.source] || [];
    // تأكد من أن البيانات ليست فارغة قبل عرض البطاقات
    if(!data || Object.keys(data).length === 0) {
      container.innerHTML = '<div class="msg-empty-entity">⚠️ لم يتم العثور على بيانات لهذا الكيان</div>';
      return;
    }
    const stats = fields.slice(0, 4).map(f => ({
      label: f.label,
      value: this.format(data[f.key], f.format)
    }));
    
    container.innerHTML = `<div class="msg-entity-stats">${stats.map(s => `
      <div class="msg-entity-stat">
        <div class="msg-entity-stat-label">${s.label}</div>
        <div class="msg-entity-stat-value">${s.value}</div>
      </div>
    `).join('')}</div>`;
  },
  
  // رسم الحقول
  renderFields() {
    const container = document.getElementById('msgFieldsContainer');
    if(!container) return;
    
    if(this.entityId === null) {
      container.innerHTML = '';
      return;
    }
    
    const fields = this.fieldsMap[this.source] || [];
    container.innerHTML = `
      <label style="font-size:12px;font-weight:700;color:var(--tx2);display:block;margin-bottom:8px">📋 اختر البيانات المراد تضمينها:</label>
      <div class="msg-fields-grid">
        ${fields.map(f => `
          <label class="msg-field-check ${this.selectedFields.has(f.key) ? 'msg-field-check--checked' : ''}" data-field-key="${f.key}">
            <input type="checkbox" ${this.selectedFields.has(f.key) ? 'checked' : ''}>
            <span>${f.emoji} ${f.label}</span>
          </label>
        `).join('')}
      </div>
    `;
    
    // ربط event delegation على الـ container
    container.querySelectorAll('.msg-field-check').forEach(lbl => {
      const key = lbl.dataset.fieldKey;
      const input = lbl.querySelector('input');
      if(!input || !key) return;
      
      // الـ handler يستجيب لتغيير الـ checkbox (وليس الـ label click)
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        if(e.target.checked) {
          this.selectedFields.add(key);
          lbl.classList.add('msg-field-check--checked');
        } else {
          this.selectedFields.delete(key);
          lbl.classList.remove('msg-field-check--checked');
        }
        this.updatePreview();
      });
      
      // منع السلوك الافتراضي للـ label (الذي يقلب الـ checkbox مرتين)
      lbl.addEventListener('click', (e) => {
        // إذا كان النقس على الـ input نفسه، دعه يعمل
        if(e.target === input) return;
        // إذا النقس على أي مكان آخر في الـ label، بدّل يدوياً
        e.preventDefault();
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change'));
      });
    });
  },
  
  toggleField(key, element) {
    if(this.selectedFields.has(key)) {
      this.selectedFields.delete(key);
    } else {
      this.selectedFields.add(key);
    }
    if(element) element.classList.toggle('msg-field-check--checked');
    this.updatePreview();
  },
  
  // تحديث المعاينة
  updatePreview() {
    const preview = document.getElementById('msgPreview');
    if(!preview) return;
    
    if(this.entityId === null) {
      preview.textContent = 'اختر كيان لعرض البيانات...';
      return;
    }
    
    const data = this.extractData();
    const fields = this.fieldsMap[this.source] || [];
    const entityLabel = this.getEntityLabel();
    
    let message = `📊 *بيانات من نظام إدارة مالية*\n\n`;
    message += `🎯 *${entityLabel}*\n\n`;
    
    fields.forEach(f => {
      if(this.selectedFields.has(f.key)) {
        const value = this.format(data[f.key], f.format);
        // إذا كانت القيمة فارغة (لم يجد البيانات)، نتجاهل
        if(value === '—' && !data[f.key]) return;
        message += `${f.emoji} ${f.label}: ${value}\n`;
      }
    });
    
    // إضافة النص المخصص
    const customText = document.getElementById('msgCustomText')?.value?.trim();
    if(customText) {
      message += `\n📝 *ملاحظة:*\n${customText}\n`;
    }
    
    message += `\n— نظام إدارة مالية • ${new Date().toLocaleDateString('ar-KW')}`;
    
    preview.textContent = message.replace(/\\n/g, '\n');
  },
  
  getEntityLabel() {
    try {
      const O = (window.O && window.O.soc) ? window.O : (window.D && window.D.soc ? window.D : {});
      const selectEl = document.querySelector('[id^="msgEntitySelect_"]');
      if(selectEl && selectEl.selectedIndex >= 0) {
        return selectEl.options[selectEl.selectedIndex].text.split('—')[0].trim();
      }
    } catch(e) {}
    return '—';
  },
  
  // إرسال عبر واتساب
  send() {
    const preview = document.getElementById('msgPreview');
    if(!preview) return;
    
    const message = preview.textContent;
    if(!message || message.includes('اختر')) {
      CloudSync.showToast('⚠️ اختر البيانات أولاً');
      return;
    }
    
    const phoneEl = document.getElementById('msgWhatsapp');
    let phone = phoneEl?.value || '965';
    phone = phone.replace(/\D/g, '');
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    AuditLog.log('alert', '📤 إرسال رسالة مخصصة', { 
      source: this.source,
      entity: this.entityId,
      fields: Array.from(this.selectedFields)
    });
    
    CloudSync.showToast('✅ تم فتح واتساب');
  },
  
  // نسخ للحافظة
  copyToClipboard() {
    const preview = document.getElementById('msgPreview');
    if(!preview) return;
    
    const message = preview.textContent;
    if(!message || message.includes('اختر')) {
      CloudSync.showToast('⚠️ لا توجد رسالة لنسخها');
      return;
    }
    
    if(navigator.clipboard) {
      navigator.clipboard.writeText(message).then(() => {
        CloudSync.showToast('✅ تم النسخ');
        AuditLog.log('export', '📋 نسخ رسالة مخصصة');
      });
    } else {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      CloudSync.showToast('✅ تم النسخ');
    }
  },
  
  // إعادة تعيين
  reset() {
    this.entityId = null;
    this.selectedFields.clear();
    const customText = document.getElementById('msgCustomText');
    if(customText) customText.value = '';
    this.renderEntitySelector();
    this.renderFields();
    this.renderEntityStats();
    this.updatePreview();
  },
  

  // فلتر التاريخ
  dateFilter: {
    enabled: true,
    preset: 'lastMonth',
    fromDate: null,
    toDate: null,
  },
  
  // تشغيل/إيقاف فلتر التاريخ
  toggleDateFilter() {
    this.dateFilter.enabled = !this.dateFilter.enabled;
    const toggle = document.getElementById('msgDateToggle');
    const body = document.getElementById('msgDateFilterBody');
    if(toggle) {
      toggle.classList.toggle('msg-date-toggle--active', this.dateFilter.enabled);
      toggle.textContent = this.dateFilter.enabled ? 'مفعّل ✓' : 'موقوف ✕';
    }
    if(body) body.style.display = this.dateFilter.enabled ? 'block' : 'none';
    this.updateEntityData(); // تحديث البيانات بناءً على الفلتر
  },
  
  // تطبيق فلتر جاهز
  setPreset(preset) {
    this.dateFilter.preset = preset;
    
    // تحديث الـ UI
    document.querySelectorAll('.msg-preset-btn').forEach(b => {
      b.classList.toggle('msg-preset-btn--active', b.dataset.preset === preset);
    });
    
    const customRange = document.getElementById('msgCustomRange');
    if(customRange) {
      customRange.style.display = preset === 'custom' ? 'grid' : 'none';
    }
    
    // حساب التواريخ
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if(preset === 'all') {
      this.dateFilter.fromDate = null;
      this.dateFilter.toDate = null;
    } else if(preset === 'thisMonth') {
      this.dateFilter.fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
      this.dateFilter.toDate = today;
    } else if(preset === 'lastMonth') {
      this.dateFilter.fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      this.dateFilter.toDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    } else if(preset === 'lastQuarter') {
      this.dateFilter.fromDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      this.dateFilter.toDate = today;
    } else if(preset === 'thisYear') {
      this.dateFilter.fromDate = new Date(today.getFullYear(), 0, 1);
      this.dateFilter.toDate = today;
    } else if(preset === 'custom') {
      // ابق على التواريخ المدخلة من المستخدم
      this.updateCustomRange();
      return; // لا تحدّث حتى يضغط المستخدم
    }
    
    this.refreshAfterFilter();
  },
  
  updateCustomRange() {
    const fromInput = document.getElementById('msgDateFrom');
    const toInput = document.getElementById('msgDateTo');
    if(fromInput && fromInput.value) {
      this.dateFilter.fromDate = new Date(fromInput.value);
      this.dateFilter.fromDate.setHours(0, 0, 0, 0);
    }
    if(toInput && toInput.value) {
      this.dateFilter.toDate = new Date(toInput.value);
      this.dateFilter.toDate.setHours(23, 59, 59, 999);
    }
    this.refreshAfterFilter();
  },
  
  refreshAfterFilter() {
    this.updateFilterSummary();
    this.renderEntitySelector(); // إعادة رسم القائمة بالبيانات المفلترة
    this.updatePreview();
  },
  
  updateFilterSummary() {
    const summary = document.getElementById('msgFilterSummary');
    if(!summary) return;
    
    if(!this.dateFilter.enabled) {
      summary.innerHTML = '⏸️ الفلتر موقوف - يتم استخدام كل البيانات';
      return;
    }
    
    const labels = {
      all: '📊 كل الفترة',
      thisMonth: '📅 هذا الشهر',
      lastMonth: '📆 الشهر الماضي',
      lastQuarter: '📈 آخر 3 شهور',
      thisYear: '🗓️ هذا العام',
      custom: '⚙️ فترة مخصصة'
    };
    
    const label = labels[this.dateFilter.preset] || 'مخصص';
    let dates = '';
    if(this.dateFilter.fromDate && this.dateFilter.toDate) {
      const fmt = (d) => d.toLocaleDateString('ar-KW', {day: 'numeric', month: 'short', year: 'numeric'});
      dates = `: ${fmt(this.dateFilter.fromDate)} ← ${fmt(this.dateFilter.toDate)}`;
    }
    
    summary.innerHTML = `${label}${dates}`;
  },
  
  // تطبيق الفلتر على tx (المعاملات)
  filterTransactions(txs) {
    if(!this.dateFilter.enabled || !txs) return txs || [];
    if(!this.dateFilter.fromDate || !this.dateFilter.toDate) return txs;
    
    return txs.filter(t => {
      if(!t.dt) return true; // إذا لم يكن هناك تاريخ، نُبقيه
      const txDate = new Date(t.dt);
      return txDate >= this.dateFilter.fromDate && txDate <= this.dateFilter.toDate;
    });
  },
  
  // تطبيق الفلتر على بيانات soc (بناءً على آخر طلب li)
  filterSocsByDate(socs) {
    if(!this.dateFilter.enabled || !socs) return socs || [];
    if(!this.dateFilter.fromDate || !this.dateFilter.toDate) return socs;
    // لا نحذف، فقط نُظهر معلومات إضافية
    return socs;
  },
  
  // تحديث البيانات في الكيان المختار بناءً على الفلتر
  updateEntityData() {
    // إعادة استخراج البيانات
    this.renderEntityStats();
    this.updatePreview();
  },

  init() {
    // ربط حقل النص المخصص
    setTimeout(() => {
      const customText = document.getElementById('msgCustomText');
      if(customText) {
        customText.addEventListener('input', () => this.updatePreview());
      }
      // تطبيق الفلتر الافتراضي
      this.setPreset('lastMonth');
    }, 100);
    
    // العرض الأولي
    this.setSource('client');
  }
};

// إتاحة الدوال عالمياً
window.MsgBuilder = MsgBuilder;
window.msgBuilderSetSource = (s) => MsgBuilder.setSource(s);
window.msgBuilderSend = () => MsgBuilder.send();
window.msgBuilderCopy = () => MsgBuilder.copyToClipboard();
window.msgBuilderReset = () => MsgBuilder.reset();



// 📊 فحص صحة البيانات (متاح عالمياً)
window.dataHealthCheck = function() {
  return {
    timestamp: new Date().toISOString(),
    O: {
      soc: (typeof O !== 'undefined' && O.soc) ? O.soc.length : 0,
      ag: (typeof O !== 'undefined' && O.ag) ? O.ag.length : 0,
      tx: (typeof O !== 'undefined' && O.tx) ? O.tx.length : 0,
      ml: (typeof O !== 'undefined' && O.ml) ? O.ml.length : 0,
      mon: (typeof O !== 'undefined' && O.mon) ? O.mon.length : 0,
    },
    window_O: {
      synced: window.O === (typeof O !== 'undefined' ? O : null),
      soc: window.O?.soc?.length || 0,
      ag: window.O?.ag?.length || 0,
    },
    localStorage: {
      has_backup: !!localStorage.getItem('nayef_data_backup_v220_force'),
      last_save: localStorage.getItem('nayef_data_timestamp_v220_force') 
        ? new Date(parseInt(localStorage.getItem('nayef_data_timestamp_v220_force'))).toLocaleString('ar-KW') 
        : 'لم يحفظ',
    },
  };
};

window.nayefCheckData = function() {
  const box = document.getElementById('dataHealthContent');
  if(!box) return;
  try {
    const h = dataHealthCheck();
    const status = h.O.soc > 0 ? '✅' : '⚠️';
    box.innerHTML = `
      <div>${status} <b>العملاء:</b> ${h.O.soc} | <b>المناديب:</b> ${h.O.ag} | <b>المعاملات:</b> ${h.O.tx}</div>
      <div>📅 <b>الأشهر:</b> ${h.O.ml} | <b>الإحصائيات:</b> ${h.O.mon}</div>
      <div>${h.window_O.synced ? '✅' : '⚠️'} <b>window.O متزامن:</b> ${h.window_O.synced ? 'نعم' : 'لا'}</div>
      <div>💾 <b>آخر حفظ:</b> ${h.localStorage.last_save}</div>
    `;
  } catch(e) {
    box.innerHTML = '⚠️ خطأ في الفحص: ' + e.message;
  }
};


// 📋 Definitions المُضافة - إصلاحات للدوال الناقصة
function renderReportsInvoicesList() {
  try {
    const sel = document.getElementById('invoiceClient');
    if(!sel) return;
    const soc = (typeof D !== 'undefined' && D.soc) ? D.soc : ((typeof window.O !== 'undefined' && window.O.soc) ? window.O.soc : []);
    if(!soc || !soc.length) return;
    
    // مسح الخيارات الحالية (عدا الافتراضي)
    sel.innerHTML = '<option value="">-- اختر العميل --</option>' +
      soc.map(s => {
        const name = (s.nm || '').replace(/"/g, '&quot;');
        return `<option value="${name}">${name}</option>`;
      }).join('');
  } catch(e) {
    Logger.warn('renderReportsInvoicesList:', e.message);
  }
}


// 📋 ملء القوائم في صفحة الفواتير (إصلاحات)
function renderReportsInvoicesList() {
  try {
    const sel = document.getElementById('invoiceClient');
    if(!sel) return;
    // 🔍 بحث ذكي عن البيانات من أي مصدر متاح
    let soc = null;
    try { if(typeof D !== 'undefined' && D.soc && D.soc.length) soc = D.soc; } catch(e) {}
    if(!soc) try { if(typeof O !== 'undefined' && O.soc && O.soc.length) soc = O.soc; } catch(e) {}
    if(!soc) try { if(typeof window.O !== 'undefined' && window.O.soc && window.O.soc.length) soc = window.O.soc; } catch(e) {}
    if(!soc || !soc.length) {
      Logger.warn('⚠️ لا توجد بيانات عملاء لعرضها');
      return;
    }
    sel.innerHTML = '<option value="">-- اختر العميل --</option>' +
      soc.map(s => {
        const name = (s.nm || '').replace(/"/g, '&quot;');
        return `<option value="${name}">${name}</option>`;
      }).join('');
    Logger.info('✅ تم ملء قائمة العملاء:', soc.length, 'عميل');
  } catch(e) { Logger.warn('renderReportsInvoicesList:', e.message); }
}

function populateInvoiceTeamSelect() {
  try {
    const sel = document.getElementById('invoiceTeam') || document.querySelector('[id*="invoiceTeam"]');
    if(!sel) return;
    let ag = null;
    try { if(typeof D !== 'undefined' && D.ag && D.ag.length) ag = D.ag; } catch(e) {}
    if(!ag) try { if(typeof O !== 'undefined' && O.ag && O.ag.length) ag = O.ag; } catch(e) {}
    if(!ag) try { if(typeof window.O !== 'undefined' && window.O.ag && window.O.ag.length) ag = window.O.ag; } catch(e) {}
    if(!ag || !ag.length) return;
    sel.innerHTML = '<option value="">-- اختر الفريق --</option>' +
      ag.map(a => {
        const name = (a.nm || '').replace(/"/g, '&quot;');
        return `<option value="${name}">${name}</option>`;
      }).join('');
  } catch(e) { Logger.warn('populateInvoiceTeamSelect:', e.message); }
}

function populateInvoiceClientSelect() {
  return renderReportsInvoicesList();
}

// إتاحة الدوال عالمياً
window.renderReportsInvoicesList = renderReportsInvoicesList;
window.populateInvoiceTeamSelect = populateInvoiceTeamSelect;
window.populateInvoiceClientSelect = populateInvoiceClientSelect;


// ════════════════════════════════════════════════════════════════════
// 📋 صفحة كشف حساب العميل - تصميم احترافي
// ════════════════════════════════════════════════════════════════════

function pageStatement(pg, S, T) {
  const clients = S || [];
  
  pg.innerHTML = `
    <div class="statement-page" id="statementPage">
      <!-- رأس الصفحة -->
      <div class="statement-header">
        <div class="statement-actions">
          <button class="statement-action-btn" onclick="printStatement()" title="طباعة سريعة (A4)">🖨</button>
          <button class="statement-action-btn" onclick="exportStatementPDF()" title="تصدير PDF عبر المتصفح">📄</button>
          <button class="statement-action-btn" onclick="exportStatementExcel()" title="تصدير Excel">📊</button>
          <button class="statement-action-btn" onclick="(window.PrintEngine&amp;&amp;window.PrintEngine.showPreview?window.PrintEngine.showPreview(['customers'],{search:document.getElementById('statementClient')?.value}):window.print())" title="تقرير عميل شامل" style="background:linear-gradient(135deg,#7d4f9e,#a855f7)">📈</button>
        </div>
        
        <div class="statement-logo">${getRealCompanyBranding().logo}</div>
        <div class="statement-company-info">
          <h1>${getRealCompanyBranding().name}</h1>
          <p class="statement-tagline">كشف حساب العميل والمعاملات المستحقة</p>
          <div class="statement-contact">
            <span>📧 ${getRealCompanyBranding().email || '—'}</span>
            ${getRealCompanyBranding().phone ? '<span>📞 ' + getRealCompanyBranding().phone + '</span>' : ''}
            ${getRealCompanyBranding().address ? '<span>📍 ' + getRealCompanyBranding().address + '</span>' : ''}
          </div>
        </div>
        <div class="statement-title-block">
          <h2>كشف حساب</h2>
          <div class="statement-date" id="statementDate">—</div>
          <div class="statement-ref" id="statementRef">REF: —</div>
        </div>
      </div>
      
      <!-- معلومات العميل -->
      <div class="statement-client-info" id="statementClientInfo">
        <div class="statement-info-card">
          <div class="info-label">اسم العميل</div>
          <div class="info-value" id="clientName">—</div>
        </div>
        <div class="statement-info-card">
          <div class="info-label">المندوب</div>
          <div class="info-value" id="clientAgent">—</div>
        </div>
        <div class="statement-info-card">
          <div class="info-label">رقم العميل</div>
          <div class="info-value" id="clientId">—</div>
        </div>
        <div class="statement-info-card">
          <div class="info-label">حالة الحساب</div>
          <div class="info-value" id="clientStatus">—</div>
        </div>
      </div>
      
      <!-- أدوات التحكم -->
      <div class="statement-controls">
        <div class="statement-control-group">
          <label>🏢 اختر العميل</label>
          <select id="statementClient" onchange="onClientChange()">
            <option value="">— اختر العميل —</option>
            ${clients.map((c, i) => `<option value="${i}" data-agent="${c.ag||''}">${c.nm || ('عميل ' + (i+1))}</option>`).join('')}
          </select>
        </div>
        <div class="statement-control-group">
          <label>👤 اسم المندوب</label>
          <select id="statementAgent" onchange="onAgentChange()">
            <option value="">— الكل (كل المناديب) —</option>
            ${(() => {
              const registeredAgents = (typeof O !== 'undefined' && O.ag ? O.ag : []).map(a => a.nm).filter(Boolean);
              const activeAgents = typeof getActiveAgentsForPeriod === "function" ? getActiveAgentsForPeriod() : [...new Set(clients.map(c => c.ag).filter(Boolean))];
              return Array.from(new Set([...registeredAgents, ...activeAgents])).sort();
            })().map(ag => `<option value="${ag}">${ag}</option>`).join('')}
          </select>
          <small style="color:#999;font-size:11px;display:block;margin-top:4px">يتم اختيار المندوب تلقائياً عند اختيار العميل</small>
        </div>
        <div class="statement-control-group">
          <label>📅 من تاريخ</label>
          <input type="date" id="statementFromDate" onchange="this.dataset.userEdited='1';renderStatement()">
        </div>
        <div class="statement-control-group">
          <label>📅 إلى تاريخ</label>
          <input type="date" id="statementToDate" onchange="this.dataset.userEdited='1';renderStatement()">
        </div>
        <div class="statement-control-group">
          <label>⚡ فلاتر سريعة</label>
          <div class="quick-filters">
            <button class="quick-filter" onclick="setQuickFilter('all')">📋 الكل</button>
            <button class="quick-filter" onclick="setQuickFilter('sales')">🧾 مبيعات</button>
            <button class="quick-filter" onclick="setQuickFilter('payments')">💵 تحصيلات</button>
            <button class="quick-filter" onclick="setQuickFilter('returns')">↩️ مرتجعات</button>
          </div>
        </div>
        <div class="statement-control-group">
          <label>📊 نوع التقرير</label>
          <select id="statementType" onchange="renderStatement()">
            <option value="all">📋 جميع المعاملات</option>
            <option value="sales">🧾 المبيعات فقط</option>
            <option value="payments">💵 التحصيلات فقط</option>
            <option value="returns">↩️ المرتجعات فقط</option>
            <option value="credit_notes">📝 الإشعارات الدائنة</option>
            <option value="debit_notes">📋 الإشعارات المدينة</option>
            <option value="payment_out">💸 المدفوعات الصادرة</option>
            <option value="adjustments">⚖️ قيود التسوية</option>
            <option value="discounts">🎁 الخصومات</option>
          </select>
        </div>
        <button class="statement-btn statement-btn--primary" onclick="renderStatement()">🔄 تحديث</button>
        <button class="statement-btn" onclick="resetStatement()">↺ إعادة تعيين</button>
        <button class="statement-btn statement-btn--warning" onclick="nayefForceRefreshData()" title="إصلاح البيانات القديمة المخزنة">🔧 إصلاح البيانات</button>
        <button class="statement-btn statement-btn--info" onclick="showDataInspector()" title="عرض البيانات الفعلية المفحوصة">🔍 كشف البيانات</button>
        <button class="statement-btn statement-btn--success" onclick="nayefRunAutoRecover()" title="استخراج الفواتير والتحصيلات المفقودة من mon.v">🩹 استخراج الفواتير</button>
        <button class="statement-btn" onclick="togglePrintPreview()" title="معاينة الطباعة">🖨 معاينة</button>
      </div>
      
      <!-- ملخص الحساب -->
      <div class="statement-stats" id="statementStats"></div>
      <div class="statement-summary" id="statementSummary">
        ${renderStatementSummary(null)}
      </div>
      
      <!-- جدول المعاملات -->
      <div class="statement-table-wrap" id="statementTableWrap">
        ${renderStatementTable(null)}
      </div>
      
      <!-- توقيع -->
      <div class="statement-footer">
        <div class="statement-signature">
          <div class="sig-label">المحاسب</div>
          <div class="sig-line">التوقيع: ____________</div>
        </div>
        <div class="statement-signature">
          <div class="sig-label">المدير المعتمد</div>
          <div class="sig-line">التوقيع: ____________</div>
        </div>
      </div>
    </div>
  `;
  
  // 🛡️ FIX v180: استخدام فلتر "تطبيق" العلوي (filterA / filterB)
  const today = (typeof DashboardConfig !== 'undefined') ? DashboardConfig.getAsOfDate() : new Date();
  const fromDateInput = document.getElementById('statementFromDate');
  const toDateInput = document.getElementById('statementToDate');
  
  // 1. أولوية لفلتر "تطبيق" العلوي إن كان موجوداً
  let useGlobalFilter = (typeof _filterA !== 'undefined' && typeof _filterB !== 'undefined' && 
                          typeof O !== 'undefined' && O.ml && O.ml.length > 0 &&
                          _filterA >= 0 && _filterB < O.ml.length && 
                          _filterA < _filterB);
  
  if(useGlobalFilter && fromDateInput && toDateInput) {
    // من الفلتر العلوي: استخدم O.ml[_filterA] (أول يوم في الشهر) → O.ml[_filterB] (آخر يوم في الشهر)
    fromDateInput.value = O.ml[_filterA] + '-01';
    // آخر يوم في الشهر
    const lastMonthKey = O.ml[_filterB];
    const lastMonthDate = new Date(lastMonthKey + '-01');
    lastMonthDate.setMonth(lastMonthDate.getMonth() + 1);
    lastMonthDate.setDate(0);  // آخر يوم في الشهر
    toDateInput.value = lastMonthDate.toISOString().slice(0, 10);
  } else if(toDateInput) {
    toDateInput.value = today.toISOString().slice(0, 10);
  }
  if(fromDateInput && !useGlobalFilter) {
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    fromDateInput.value = yearAgo.toISOString().slice(0, 10);
  }
  
  // عرض افتراضي إذا كان هناك عميل محدد
  if(clients.length > 0) {
    document.getElementById('statementClient').value = 0;
    renderStatement();
  }
}

// ═════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════
// 🆕 v220.5+ STORAGE V2: تخزين مزدوج (localStorage + IndexedDB) + تشفير + نسخ احتياطي
// ═════════════════════════════════════════════════════════════════════════

const StorageV2 = {
  _key: 'GHUROOB_NAIF_2026_VAULT',

  encrypt(data) {
    try {
      const json = JSON.stringify(data);
      let result = '';
      for (let i = 0; i < json.length; i++) {
        result += String.fromCharCode(json.charCodeAt(i) ^ this._key.charCodeAt(i % this._key.length));
      }
      return btoa(unescape(encodeURIComponent(result)));
    } catch(e) { return null; }
  },

  decrypt(encoded) {
    try {
      const raw = decodeURIComponent(escape(atob(encoded)));
      let result = '';
      for (let i = 0; i < raw.length; i++) {
        result += String.fromCharCode(raw.charCodeAt(i) ^ this._key.charCodeAt(i % this._key.length));
      }
      return JSON.parse(result);
    } catch(e) { return null; }
  },

  async save(data) {
    const json = JSON.stringify(data);
    const encrypted = this.encrypt(data);
    const ts = Date.now();
    let lsOk = false, idbOk = false;

    try {
      localStorage.setItem('nayef_data_v2', json);
      if (encrypted) localStorage.setItem('nayef_data_v2_enc', encrypted);
      localStorage.setItem('nayef_data_v2_ts', String(ts));
      lsOk = true;
    } catch(e) {
      Logger.warn('StorageV2 LS failed:', e);
      this._cleanupOldKeys();
    }

    try {
      await this._idbSave('nayef_main', { data: data, ts: ts, encrypted: encrypted });
      idbOk = true;
    } catch(e) {
      Logger.warn('StorageV2 IDB failed:', e);
    }

    // 🌐 مزامنة سحابية (Cloud Sync) — عبر نسخة مؤجلة (debounce) لمنع إرسال عشرات
    // الطلبات لو المستخدم يعدّل بسرعة (كتابة، تعديل جدول، إلخ)؛ يُرسل فقط آخر نسخة
    // من البيانات بعد توقف التعديل لمدة قصيرة، مما يقلل الحمل على السيرفر ويحسّن الاستجابة.
    this._getCloudPushDebounced()(data);

    return { ok: lsOk || idbOk, lsOk: lsOk, idbOk: idbOk, ts: ts, size: json.length };
  },

  // 🆕 يرجّع نسخة مؤجّلة (debounced) من _pushToCloud، تُبنى مرة واحدة وتُعاد نفس النسخة
  // في كل استدعاء لاحق حتى تعمل آلية التأجيل بشكل صحيح (نفس الـ timer يُعاد ضبطه في كل نداء).
  _getCloudPushDebounced() {
    if (!this._cloudPushDebounced) {
      const self = this;
      const pushFn = function (data) { self._pushToCloud(data); };
      this._cloudPushDebounced = (window.PerfUtils && typeof window.PerfUtils.debounce === 'function')
        ? window.PerfUtils.debounce(pushFn, 900)
        : pushFn; // fallback: إرسال فوري لو أداة الـ debounce غير متوفرة لأي سبب
    }
    return this._cloudPushDebounced;
  },

  // 🆕 الرفع الفعلي لآخر نسخة من البيانات إلى السحابة (Google Sheets عبر Apps Script)
  // + حفظ نسخة كاملة (backup سريع الاستعادة) في شيت AppState
  async _pushToCloud(data) {
    try {
      var token = localStorage.getItem('erp_token');
      if (!token) {
        if (window.__setRealCloudBadge) window.__setRealCloudBadge('#dc2626', '#fee2e2', '❌ لا توجد جلسة دخول صالحة — سجّل خروج وادخل تاني');
        return;
      }
      if (!window.ApiClient) {
        if (window.__setRealCloudBadge) window.__setRealCloudBadge('#dc2626', '#fee2e2', '❌ ملف api-client.js مش محمّل');
        return;
      }

      var expectedRev = localStorage.getItem('nayef_state_rev');
      const r = await ApiClient.state.save(data, expectedRev !== null ? Number(expectedRev) : undefined);

      if (r && r.ok) {
        if (r.rev !== undefined) { try { localStorage.setItem('nayef_state_rev', String(r.rev)); } catch (e) {} }
        if (window.__setRealCloudBadge) window.__setRealCloudBadge('#059669', '#dcfce7', '🟢 تم الحفظ في السحابة الآن');
      } else if (r && r.conflict) {
        // 🛡️ تعارض حفظ حقيقي: جهاز/متصفح تاني حفظ بعدك.
        // 🆕 بدل ما نسيب المستخدم يعمل F5 يدوياً (وممكن ما يلاحظ التحذير أصلاً ويكمل يشتغل
        // فوق بيانات قديمة)، نجيب آخر نسخة من السحابة تلقائياً ونحدّث الشاشة والـ rev المحلي،
        // عشان الحفظة الجاية تنجح بدل ما تتكرر نفس المشكلة.
        if (window.__setRealCloudBadge) window.__setRealCloudBadge('#f59e0b', '#fef3c7', '⚠️ فيه تعديل من جهاز تاني — جاري التحديث تلقائياً...');
        try {
          const cr = await this._loadFromCloud();
          if (cr && cr.data && typeof window.O !== 'undefined') {
            Object.assign(window.O, cr.data);
            if (typeof nayefSaveData === 'function') nayefSaveData();
            if (typeof draw === 'function') setTimeout(draw, 300);
          }
        } catch (e) {}
        if (window.__setRealCloudBadge) window.__setRealCloudBadge('#f59e0b', '#fef3c7', '🔄 تم التحديث من جهاز آخر — تأكد من آخر عملية أدخلتها');
        if (typeof showToast === 'function') showToast('⚠️ تعارض بيانات', 'حد تاني حفظ من جهاز مختلف بعد آخر تحميل عندك. تم جلب أحدث نسخة تلقائياً — من فضلك تأكد إن آخر عملية أدخلتها موجودة، وأعد إدخالها لو ما ظهرت', false);
      } else {
        if (window.__setRealCloudBadge) window.__setRealCloudBadge('#dc2626', '#fee2e2', '🔴 فشل حفظ آخر تعديل — ' + (r && r.error ? r.error : 'سبب غير معروف'));
      }

      // 🆕 مزامنة صفوف مقروءة في شيتات الشركة الفعلية (المعاملات/العملاء/المناديب/الأصناف)
      this.syncStructuredSheets(data);
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.warn('Cloud save failed:', e);
      if (window.__setRealCloudBadge) window.__setRealCloudBadge('#dc2626', '#fee2e2', '🔴 فشل الاتصال بالسيرفر أثناء الحفظ');
    }
  },

  // 🆕 يحوّل بيانات النظام (O) لصفوف مقروءة ويكتبها في شيتات الشركة الحقيقية
  // (بدل ما تفضل البيانات محبوسة كـ JSON مضغوط في شيت AppState المخفي فقط)
  syncStructuredSheets(data) {
    try {
      const call = (sheet, rows) => ApiClient.sheet.saveAll(sheet, rows)
        .catch(function (e) { if (typeof Logger !== 'undefined') Logger.warn('sheet sync failed [' + sheet + ']:', e); });

      // المعاملات ← headers: id, date, type, doc_no, customer, debit, credit, qty, discount, free, agent, month, item, item_code, unit_cost
      const txRows = (data.tx || []).map(t => {
        const isCredit = (t.tp === 'return' || t.tp === 'payment');
        const firstItem = (Array.isArray(t.items) && t.items[0]) ? t.items[0] : null;
        return {
          id: t.id || '',
          date: t.dt || '',
          type: t.tp || '',
          doc_no: t.i != null ? t.i : '',
          customer: t.client || t.cl || '',
          debit: isCredit ? '' : (t.amount || 0),
          credit: isCredit ? (t.amount || 0) : '',
          qty: firstItem ? firstItem[1] : '',
          discount: '',
          free: '',
          agent: t.ag || '',
          month: (t.dt || '').slice(0, 7),
          item: firstItem ? firstItem[0] : '',
          item_code: firstItem ? firstItem[0] : '',
          unit_cost: t.cost || ''
        };
      });

      // العملاء ← headers: code, name, phone, address, balance
      const socRows = (data.soc || []).map(s => ({
        code: s.i != null ? String(s.i) : '',
        name: s.nm || '',
        phone: s.phone || '',
        address: s.reg || '',
        balance: (s.ot != null ? s.ot : (s.ob || 0))
      }));

      // المناديب ← headers: code, name, phone, commission_rate
      const agRows = (data.ag || []).map((a, idx) => ({
        code: 'AG-' + (idx + 1),
        name: a.nm || '',
        phone: a.phone || '',
        commission_rate: a.target != null ? a.target : ''
      }));

      // الأصناف ← headers: code, name, category, unit_cost, unit_price
      const itRows = (data.it || []).map(i => ({
        code: i.cd || '',
        name: i.nm || '',
        category: '',
        unit_cost: i.uc || 0,
        unit_price: i.up || 0
      }));

      call('المعاملات', txRows);
      call('العملاء', socRows);
      call('المناديب', agRows);
      call('الأصناف', itRows);
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.warn('syncStructuredSheets:', e);
    }
  },

  // 🆕 opts.forceCloud: لو true، نحاول السحابة أولاً قبل أي مصدر محلي.
  // تُستخدم عند فتح النظام لأول مرة على متصفح/جهاز جديد لا يملك أي كاش محلي بعد،
  // لضمان جلب أحدث بيانات الشركة الحقيقية من السيرفر مباشرة بدل انتظار فشل كل المصادر المحلية.
  async load(opts = {}) {
    let data = null, source = null;
    const forceCloud = !!opts.forceCloud;

    if (forceCloud) {
      const cr = await this._loadFromCloud();
      if (cr.data) return cr;
      // فشلت السحابة (بدون إنترنت مثلاً) → نكمل ونجرب المصادر المحلية كخطة بديلة
    }

    // 1) localStorage plain JSON (fastest)
    try {
      const raw = localStorage.getItem('nayef_data_v2');
      if (raw) {
        data = JSON.parse(raw);
        source = 'localStorage';
      }
    } catch(e) {}

    // 2) IndexedDB backup
    if (!data) {
      try {
        const idbData = await this._idbLoad('nayef_main');
        if (idbData && idbData.data) {
          data = idbData.data;
          source = 'IndexedDB';
          // Repair localStorage from IDB
          try { localStorage.setItem('nayef_data_v2', JSON.stringify(data)); } catch(e) {}
        }
      } catch(e) {}
    }

    // 3) Encrypted localStorage (last resort)
    if (!data) {
      const enc = localStorage.getItem('nayef_data_v2_enc');
      if (enc) {
        data = this.decrypt(enc);
        source = 'encrypted';
      }
    }

    // 4) السحابة (Apps Script backend) — مرجع أخير، ومصدر البيانات الحقيقي لأي جهاز/متصفح جديد
    if (!data) {
      const cr = await this._loadFromCloud();
      if (cr.data) { data = cr.data; source = cr.source; }
    }

    return { data: data, source: source };
  },

  // 🆕 دالة مستقلة لجلب البيانات من السحابة فقط (بدون أي فحص لمصادر محلية)،
  // تُستخدم من load() ومن مسار معالجة تعارض الحفظ في _pushToCloud().
  async _loadFromCloud() {
    try {
      var token = localStorage.getItem('erp_token');
      if (token && window.ApiClient) {
        const json = await ApiClient.state.load();
        if (json && json.ok && json.state && Object.keys(json.state).length) {
          try { localStorage.setItem('nayef_data_v2', JSON.stringify(json.state)); } catch (e) {}
          if (json.rev !== undefined) { try { localStorage.setItem('nayef_state_rev', String(json.rev)); } catch (e) {} }
          return { data: json.state, source: 'cloud' };
        }
        if (json && json.ok && json.rev !== undefined) {
          try { localStorage.setItem('nayef_state_rev', String(json.rev)); } catch (e) {}
        }
      }
    } catch (e) {}
    return { data: null, source: null };
  },

  // 🆕 مراقب خلفي: يفحص بشكل دوري (كل 90 ثانية افتراضياً) هل رقم نسخة البيانات (rev)
  // في السحابة تغيّر عن آخر نسخة عندك — أي إن مستخدم/جهاز آخر حفظ بيانات جديدة بينما
  // أنت شغال. لا يقوم بأي استبدال تلقائي للبيانات أثناء عملك (تفادياً لمقاطعة عملية
  // إدخال جارية)، فقط يعرض شارة تنبيه قابلة للضغط لتحديث الصفحة يدوياً وقت ما يناسبك.
  startBackgroundSyncWatcher(intervalMs = 90000) {
    if (this._watcherStarted) return; // لا تشغّل أكثر من مراقب واحد بالخطأ
    this._watcherStarted = true;

    setInterval(async () => {
      try {
        const token = localStorage.getItem('erp_token');
        if (!token || !window.ApiClient || document.hidden) return; // لا داعي للفحص لو التبويب غير ظاهر

        const json = await ApiClient.state.load();
        if (!json || !json.ok || json.rev === undefined) return;

        const localRev = localStorage.getItem('nayef_state_rev');
        const serverRev = String(json.rev);

        if (localRev !== null && serverRev !== localRev) {
          if (window.__setRealCloudBadge) {
            window.__setRealCloudBadge('#2563eb', '#dbeafe', '🔔 فيه تحديثات جديدة من جهاز آخر — اضغط هنا لتحديث الصفحة');
          }
          if (typeof showToast === 'function' && !this._updateNoticeShown) {
            this._updateNoticeShown = true; // نبيّن التنبيه مرة وحدة بس بالجلسة عشان ما نزعج المستخدم
            showToast('🔔 تحديثات جديدة', 'فيه بيانات جديدة اتحفظت من جهاز/متصفح آخر. حدّث الصفحة (F5) لما تخلص شغلك الحالي عشان تشوفها', true);
          }
        }
      } catch (e) { /* صمت تام هنا: أي خطأ فحص دوري ما يستاهل إزعاج المستخدم */ }
    }, intervalMs);
  },

  async _idbSave(key, value) {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('No IDB'));
      const req = indexedDB.open('ghuroob_naif_db', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) {
          req.result.createObjectStore('kv');
        }
      };
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(value, key);
          tx.oncomplete = () => { req.result.close(); resolve(); };
          tx.onerror = () => { req.result.close(); reject(tx.error); };
        } catch(e) { req.result.close(); reject(e); }
      };
      req.onerror = () => reject(req.error);
    });
  },

  async _idbLoad(key) {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('No IDB'));
      const req = indexedDB.open('ghuroob_naif_db', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) {
          req.result.createObjectStore('kv');
        }
      };
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('kv', 'readonly');
          const get = tx.objectStore('kv').get(key);
          get.onsuccess = () => { req.result.close(); resolve(get.result); };
          get.onerror = () => { req.result.close(); reject(get.error); };
        } catch(e) { req.result.close(); reject(e); }
      };
      req.onerror = () => reject(req.error);
    });
  },

  _cleanupOldKeys() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('nayef_log_') || (k && k.startsWith('nayef_cache_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  },

  exportJSON() {
    const data = JSON.parse(localStorage.getItem('nayef_data_v2') || '{}');
    const backup = {
      _exportedAt: new Date().toISOString(),
      _version: (typeof SEED !== 'undefined' && SEED._v) ? SEED._v : 'unknown',
      _app: 'نظام إدارة مالية - الداشبورد',
      data: data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fname = 'ghuroob-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('⬇️ تم التصدير', 'تم تحميل النسخة: ' + fname, true);
    return backup;
  },

  async importJSON(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;
    if (!data || typeof data !== 'object') throw new Error('ملف غير صالح');
    const result = await this.save(data);
    // Also write to legacy keys so nayefRestoreData picks it up
    try {
      localStorage.setItem('nayef_data_backup_v220_force', JSON.stringify(data));
      localStorage.setItem('nayef_dash_seed', JSON.stringify({ seed: data, fname: 'استعادة يدوية', ts: Date.now() }));
    } catch(e) {}
    return { ok: true, result: result };
  },

  autoBackupCheck() {
    try {
      const last = parseInt(localStorage.getItem('nayef_last_auto_backup') || '0');
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (now - last > sevenDays && (localStorage.getItem('nayef_data_v2') || '').length > 1000) {
        const fname = 'auto-backup-' + new Date().toISOString().slice(0,10) + '.json';
        const data = JSON.parse(localStorage.getItem('nayef_data_v2'));
        const backup = { _exportedAt: new Date().toISOString(), _auto: true, _version: data._v || 'unknown', data: data };
        const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        localStorage.setItem('nayef_last_auto_backup', String(now));
        if (typeof showToast === 'function') {
          showToast('💾 نسخ احتياطي تلقائي', 'تم حفظ نسخة ' + fname, true);
        }
      }
    } catch(e) {}
  },

  getStorageHealth() {
    const lsSize = (localStorage.getItem('nayef_data_v2') || '').length;
    const lsQuota = 5 * 1024 * 1024;
    const lsPercent = (lsSize / lsQuota * 100);
    const lastSave = parseInt(localStorage.getItem('nayef_data_v2_ts') || '0');
    const ageMs = lastSave ? Date.now() - lastSave : null;
    const ageStr = ageMs === null ? 'لم يحفظ بعد' :
      ageMs < 60000 ? 'قبل لحظات' :
      ageMs < 3600000 ? Math.floor(ageMs/60000) + ' دقيقة' :
      ageMs < 86400000 ? Math.floor(ageMs/3600000) + ' ساعة' :
      Math.floor(ageMs/86400000) + ' يوم';
    return {
      sizeKB: (lsSize / 1024).toFixed(1),
      sizeMB: (lsSize / 1024 / 1024).toFixed(2),
      quotaMB: (lsQuota / 1024 / 1024).toFixed(0),
      percent: lsPercent.toFixed(1),
      lastSaveStr: ageStr,
      encrypted: !!localStorage.getItem('nayef_data_v2_enc'),
    };
  }
};

const AuthManager = {
  PIN_KEY: 'nayef_pin_hash_v2',
  DEVICE_KEY: 'nayef_device_fp_v2',

  async hash(str) {
    try {
      const buf = new TextEncoder().encode(str + '|GHUROOB_SALT_2026');
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch(e) {
      // Fallback بسيط لو الـ crypto API غير متوفر
      let h = 0;
      for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      return 'fb_' + Math.abs(h).toString(16);
    }
  },

  async getDeviceFP() {
    const components = [
      navigator.userAgent || '',
      navigator.language || '',
      String(new Date().getTimezoneOffset()),
      String(screen.width) + 'x' + String(screen.height),
      String(screen.colorDepth || 0),
    ].join('|');
    return await this.hash(components);
  },

  async setupPIN(pin) {
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN يجب أن يكون 4-8 أرقام');
    const hash = await this.hash(pin);
    localStorage.setItem(this.PIN_KEY, hash);
    await this.rememberDevice();
    return true;
  },

  async verifyPIN(pin) {
    const stored = localStorage.getItem(this.PIN_KEY);
    if (!stored) return true;
    const hash = await this.hash(pin);
    return hash === stored;
  },

  hasPIN() {
    return !!localStorage.getItem(this.PIN_KEY);
  },

  async rememberDevice() {
    try {
      const fp = await this.getDeviceFP();
      localStorage.setItem(this.DEVICE_KEY, fp);
    } catch(e) {}
  },

  async isTrustedDevice() {
    try {
      const stored = localStorage.getItem(this.DEVICE_KEY);
      if (!stored) return false;
      const current = await this.getDeviceFP();
      return stored === current;
    } catch(e) { return false; }
  },

  async login(pin) {
    const ok = await this.verifyPIN(pin);
    if (ok) await this.rememberDevice();
    return ok;
  },

  removePIN() {
    localStorage.removeItem(this.PIN_KEY);
    localStorage.removeItem(this.DEVICE_KEY);
  }
};

// 🆕 v220.4+ AGENT STATEMENT: كشف حساب المندوب (مبيعات، تحصيل، عمولات)
// ═════════════════════════════════════════════════════════════════════════

const DEFAULT_COMMISSIONS = {
  salesRate: 0.01,
  collectionRate: 0.02,
  targetBonusRate: 0.005,
  newClientBonus: 50,
  minCommission: 0,
};

function getCommissionsConfig() {
  if (!O.commissionsConfig || typeof O.commissionsConfig !== 'object') {
    O.commissionsConfig = JSON.parse(JSON.stringify(DEFAULT_COMMISSIONS));
  }
  return O.commissionsConfig;
}

function calculateAgentCommission(agent, fromDate, toDate) {
  const cfg = getCommissionsConfig();
  const allTx = (window.O && window.O.tx) || [];
  const agentTx = allTx.filter(t => {
    const ag = t.ag || t.agent;
    if (ag !== agent.nm) return false;
    if (!t.dt) return false;
    if (fromDate && t.dt < fromDate) return false;
    if (toDate && t.dt > toDate) return false;
    return true;
  });
  let totalSales = 0, totalCollections = 0, totalReturns = 0;
  const txCount = agentTx.length;
  const clientSet = new Set();
  agentTx.forEach(t => {
    const cls = (typeof classifyTransaction === 'function') ? classifyTransaction(t.tp || t.type) : { affects: 'sales', dir: 'D' };
    const amt = parseFloat(t.amount) || parseFloat(t.amt) || parseFloat(t.db) || parseFloat(t.cr) || 0;
    const cn = t.client || t.cl;
    if (cn) clientSet.add(cn);
    if (cls.affects === 'sales') totalSales += amt;
    else if (cls.affects === 'sales_return') totalReturns += amt;
    else if (cls.affects === 'collections') totalCollections += amt;
  });

  // 🆕 A1.8: تكامل المصادر الثلاثة (O.tx + agentMovement + agentSummary)
  // إذا كان المندوب له بيانات في agentMovement/agentSummary فقط (بدون tx فعلية)
  // اعتمد عليها لتفادي الصفر
  const agentMovement = (window.O && window.O.agentMovement) || [];
  const agentSummary = (window.O && window.O.agentSummary) || [];
  const agentMovementRows = agentMovement.filter(r => {
    const ag = r.agent || r.nm;
    return ag === agent.nm;
  });
  const agentSummaryRows = agentSummary.filter(r => {
    const ag = r.agent || r.nm;
    return ag === agent.nm;
  });

  // دالة مساعدة: هل التاريخ في النطاق؟
  const inRange = (mk) => {
    if (!mk) return false;
    const mkDate = mk + '-01';
    if (fromDate && mkDate < fromDate) return false;
    if (toDate && mkDate > (toDate.slice(0,7) + '-31')) return false;
    return true;
  };

  let movementSales = 0, movementCollections = 0;
  agentMovementRows.forEach(r => {
    if (!inRange(r.mk)) return;
    if (r.achieved) movementSales += parseFloat(r.achieved) || 0;
    if (r.visits) {} // زيارات (لا تحسب في المبيعات)
  });

  let summarySales = 0, summaryCollections = 0;
  agentSummaryRows.forEach(r => {
    if (!inRange(r.mk)) return;
    if (r.achieved) summarySales += parseFloat(r.achieved) || 0;
    if (r.surplus) summaryCollections += parseFloat(r.surplus) || 0;
  });

  // إذا لم تكن في O.tx، استخدم البيانات من المصادر الأخرى
  let effectiveSales = totalSales;
  let effectiveCollections = totalCollections;
  if (totalSales === 0 && (movementSales > 0 || summarySales > 0)) {
    // لم نجد مبيعات في tx، لكن وجدناها في agentMovement/agentSummary
    // نأخذ الأعلى (تمنع التضخيم)
    effectiveSales = Math.max(movementSales, summarySales);
  }
  if (totalCollections === 0 && (movementCollections > 0 || summaryCollections > 0)) {
    effectiveCollections = Math.max(movementCollections, summaryCollections);
  }

  // صافي المبيعات يحسب فعلياً (من tx فقط، الـ achieved من agentMovement يطابق صافي المبيعات)
  const netSales = effectiveSales - totalReturns;
  const salesCommission = +(netSales * cfg.salesRate).toFixed(3);
  const collectionCommission = +(effectiveCollections * cfg.collectionRate).toFixed(3);
  let targetBonus = 0;
  const target = parseFloat(agent.tg) || parseFloat(agent.target) || 0;
  if (target > 0 && netSales >= target) {
    targetBonus = +(netSales * cfg.targetBonusRate).toFixed(3);
  }
  let newClientBonus = 0;
  try {
    const newClients = allTx.filter(t => {
      const ag = t.ag || t.agent;
      return ag === agent.nm && t.source === 'manual' && t.dt &&
        (!fromDate || t.dt >= fromDate) && (!toDate || t.dt <= toDate) &&
        t.tp === 'opening';
    }).length;
    newClientBonus = +(newClients * cfg.newClientBonus).toFixed(3);
  } catch(e) {}
  const totalCommission = salesCommission + collectionCommission + targetBonus + newClientBonus;
  return {
    sales: +totalSales.toFixed(3),
    returns: +totalReturns.toFixed(3),
    netSales: +(netSales).toFixed(3),
    collections: +(effectiveCollections).toFixed(3),
    txCount: txCount,
    uniqueClients: clientSet.size,
    salesCommission: +Math.max(salesCommission, cfg.minCommission).toFixed(3),
    collectionCommission: +Math.max(collectionCommission, 0).toFixed(3),
    targetBonus: +Math.max(targetBonus, 0).toFixed(3),
    newClientBonus: +Math.max(newClientBonus, 0).toFixed(3),
    totalCommission: +Math.max(totalCommission, cfg.minCommission).toFixed(3),
    target: target,
    achievement: target > 0 ? +(netSales / target * 100).toFixed(1) : 0,
  };
}

function pageAgentStatement(pg) {
  // 🆕 A1.7: استخدم D.ag (مُفلتر، فقط النشطين) كمصدر رئيسي - يطابق صفحة المناديب
  // Fallback إلى O.ag إذا كانت D.ag فارغة (يحصل عند عرض أولي قبل التصفية)
  const agents = (typeof D !== 'undefined' && D.ag && D.ag.length > 0) ? D.ag : (O.ag || []);
  const today = (typeof DashboardConfig !== 'undefined') ? DashboardConfig.getAsOfDate() : new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const defaultFrom = yearAgo.toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);
  pg.innerHTML = `
    <div class="statement-page" id="agentStatementPage">
      <div class="statement-header">
        <div class="statement-actions">
          <button class="statement-action-btn" onclick="printAgentStatement()" title="طباعة سريعة (A4)">🖨</button>
          <button class="statement-action-btn" onclick="exportAgentStatementExcel()" title="تصدير Excel">📊</button>
          <button class="statement-action-btn" onclick="(window.PrintEngine&amp;&amp;window.PrintEngine.showPreview?window.PrintEngine.showPreview(['agents'],{search:document.getElementById('agentStmtAgent')?.value||''}):window.print())" title="تقرير مندوب شامل" style="background:linear-gradient(135deg,#7d4f9e,#a855f7)">📈</button>
        </div>
        <div class="statement-logo">${getRealCompanyBranding().logo}</div>
        <div class="statement-company-info">
          <h1>${getRealCompanyBranding().name}</h1>
          <p class="statement-tagline">كشف حساب المندوب والعمولات المستحقة</p>
          <div class="statement-contact">
            <span>📧 ${getRealCompanyBranding().email || '—'}</span>
            ${getRealCompanyBranding().phone ? '<span>📞 ' + getRealCompanyBranding().phone + '</span>' : ''}
            ${getRealCompanyBranding().address ? '<span>📍 ' + getRealCompanyBranding().address + '</span>' : ''}
          </div>
        </div>
        <div class="statement-title-block">
          <h2>كشف حساب مندوب</h2>
          <div class="statement-date" id="agentStmtDate">—</div>
          <div class="statement-ref" id="agentStmtRef">REF: —</div>
        </div>
      </div>
      <div class="statement-controls">
        <div class="statement-control-group">
          <label>👤 اختر المندوب</label>
          <select id="agentStmtAgent" onchange="renderAgentStatement()">
            <option value="">— اختر المندوب —</option>
            <option value="all">👥 كل المناديب (${agents.length})</option>
            ${agents.map((a, i) => '<option value="' + i + '">' + (a.nm || ('مندوب ' + (i+1))) + '</option>').join('')}
          </select>
          ${agents.length === 0 ? '<small style="color:#e74c3c">⚠️ أضف مناديب من صفحة المناديب أولاً</small>' : ''}
        </div>
        <div class="statement-control-group">
          <label>📅 من تاريخ</label>
          <input type="date" id="agentStmtFromDate" value="${defaultFrom}" onchange="this.dataset.userEdited='1';renderAgentStatement()">
        </div>
        <div class="statement-control-group">
          <label>📅 إلى تاريخ</label>
          <input type="date" id="agentStmtToDate" value="${defaultTo}" onchange="this.dataset.userEdited='1';renderAgentStatement()">
        </div>
        <div class="statement-control-group">
          <label>⚙️ إعدادات العمولات</label>
          <button onclick="openCommissionsModal()" style="background:#f39c12;color:#fff;border:none;padding:8px 14px;border-radius:7px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit">💰 تعديل النسب</button>
        </div>
        <button class="statement-btn statement-btn--primary" onclick="renderAgentStatement()">🔄 تحديث</button>
      </div>
      <div class="statement-summary" id="agentStmtSummary">
        ${renderAgentStatementSummary(null)}
      </div>
      <div class="statement-table-wrap" id="agentStmtTableWrap">
        ${renderAgentStatementTable(null)}
      </div>
      <div id="agentStmtMonthlyWrap"></div>
      <div class="statement-footer">
        <div class="statement-signature">
          <div class="sig-label">المندوب</div>
          <div class="sig-line">التوقيع: ____________</div>
        </div>
        <div class="statement-signature">
          <div class="sig-label">المحاسب</div>
          <div class="sig-line">التوقيع: ____________</div>
        </div>
      </div>
    </div>
  `;
  if (agents.length > 0) {
    document.getElementById('agentStmtAgent').value = 0;
    renderAgentStatement();
  }
}

function renderAgentStatementSummary(agent, comp) {
  if (!agent || !comp) {
    return '<div style="text-align:center;padding:40px;color:var(--tx3)">👤 اختر مندوب لعرض كشف الحساب</div>';
  }
  const cfg = getCommissionsConfig();
  return `
    <div style="background:linear-gradient(135deg,#f4ecf7,#e8d8f0);border-right:4px solid #7d4f9e;padding:20px;border-radius:12px;margin:16px 0">
      <h3 style="margin:0 0 16px;color:#5b3578">👤 ${agent.nm}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px">
        <div style="text-align:center"><div style="font-size:11px;color:#5b3578">إجمالي المبيعات</div><div style="font-size:20px;font-weight:900;color:#27ae60">${KD(comp.sales)}</div><div style="font-size:10.5px;color:#5b3578">د.ك</div></div>
        <div style="text-align:center"><div style="font-size:11px;color:#5b3578">المرتجعات</div><div style="font-size:18px;font-weight:700;color:#e74c3c">−${KD(comp.returns)}</div></div>
        <div style="text-align:center"><div style="font-size:11px;color:#5b3578">صافي المبيعات</div><div style="font-size:22px;font-weight:900;color:#1b8a8a">${KD(comp.netSales)}</div></div>
        <div style="text-align:center"><div style="font-size:11px;color:#5b3578">التحصيل</div><div style="font-size:20px;font-weight:900;color:#27ae60">${KD(comp.collections)}</div></div>
        <div style="text-align:center"><div style="font-size:11px;color:#5b3578">العملاء</div><div style="font-size:22px;font-weight:900;color:#f39c12">${comp.uniqueClients}</div><div style="font-size:10.5px;color:#5b3578">عميل</div></div>
        <div style="text-align:center"><div style="font-size:11px;color:#5b3578">الحركات</div><div style="font-size:18px;font-weight:700;color:#5d4037">${comp.txCount}</div></div>
      </div>
      <div style="border-top:1px solid rgba(123,79,158,.3);margin-top:18px;padding-top:18px">
        <h4 style="margin:0 0 12px;color:#5b3578">💰 تفاصيل العمولات المستحقة</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
          <div style="background:rgba(255,255,255,.6);padding:12px;border-radius:8px;border:1px solid rgba(123,79,158,.2)">
            <div style="font-size:11px;color:#5b3578">عمولة المبيعات <span style="color:#7d4f9e">(${(cfg.salesRate*100).toFixed(2)}%)</span></div>
            <div style="font-size:18px;font-weight:800;color:#27ae60">${KD(comp.salesCommission)}</div>
            <div style="font-size:10px;color:#7d4f9e">صافي ${KD(comp.netSales)} × ${(cfg.salesRate*100).toFixed(2)}%</div>
          </div>
          <div style="background:rgba(255,255,255,.6);padding:12px;border-radius:8px;border:1px solid rgba(123,79,158,.2)">
            <div style="font-size:11px;color:#5b3578">عمولة التحصيل <span style="color:#7d4f9e">(${(cfg.collectionRate*100).toFixed(2)}%)</span></div>
            <div style="font-size:18px;font-weight:800;color:#27ae60">${KD(comp.collectionCommission)}</div>
            <div style="font-size:10px;color:#7d4f9e">${KD(comp.collections)} × ${(cfg.collectionRate*100).toFixed(2)}%</div>
          </div>
          <div style="background:rgba(255,255,255,.6);padding:12px;border-radius:8px;border:1px solid rgba(123,79,158,.2)">
            <div style="font-size:11px;color:#5b3578">مكافأة تخطي الهدف</div>
            <div style="font-size:18px;font-weight:800;color:${comp.targetBonus > 0 ? '#27ae60' : '#95a5a6'}">${KD(comp.targetBonus)}</div>
            <div style="font-size:10px;color:#7d4f9e">${comp.target > 0 ? ('هدف ' + KD(comp.target) + '، تحقيق ' + comp.achievement + '%') : 'بلا هدف'}</div>
          </div>
          <div style="background:rgba(255,255,255,.6);padding:12px;border-radius:8px;border:1px solid rgba(123,79,158,.2)">
            <div style="font-size:11px;color:#5b3578">مكافأة عملاء جدد</div>
            <div style="font-size:18px;font-weight:800;color:#f39c12">${KD(comp.newClientBonus)}</div>
            <div style="font-size:10px;color:#7d4f9e">رصيد افتتاحي يدوي × ${cfg.newClientBonus} د.ك</div>
          </div>
        </div>
        <div style="margin-top:14px;background:linear-gradient(135deg,#7d4f9e,#5b3578);color:#fff;padding:14px 20px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div style="font-size:13px;font-weight:700">💎 إجمالي العمولات المستحقة</div>
          <div style="font-size:26px;font-weight:900">${KD(comp.totalCommission)} د.ك</div>
        </div>
      </div>
    </div>
  `;
}

function renderAgentStatementTable(agent, comp, fromDate, toDate) {
  if (!agent || !comp) {
    return '<div style="text-align:center;padding:30px;color:var(--tx3);font-size:13px">اختر مندوب وتواريخ لعرض جدول الحركات</div>';
  }
  const allTx = (window.O && window.O.tx) || [];
  const agentTx = allTx.filter(t => {
    const ag = t.ag || t.agent;
    if (ag !== agent.nm) return false;
    if (!t.dt) return false;
    if (fromDate && t.dt < fromDate) return false;
    if (toDate && t.dt > toDate) return false;
    return true;
  }).sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));

  if (agentTx.length === 0) {
    return '<div style="text-align:center;padding:30px;color:var(--tx3)">لا توجد حركات لهذا المندوب في الفترة المختارة</div>';
  }

  const cfg = getCommissionsConfig();
  return `
    <div style="margin-top:18px">
      <h3 style="margin:0 0 12px;color:var(--tx)">📋 تفاصيل الحركات (${agentTx.length} حركة)</h3>
      <div class="tw">
        <table>
          <thead><tr>
            <th>التاريخ</th><th>العميل</th><th>نوع الحركة</th><th>المبلغ</th><th>العمولة</th>
          </tr></thead>
          <tbody>
            ${agentTx.map(t => {
              const cls = (typeof classifyTransaction === 'function') ? classifyTransaction(t.tp || t.type) : { affects: 'sales', dir: 'D' };
              const amt = parseFloat(t.amount) || parseFloat(t.amt) || parseFloat(t.db) || parseFloat(t.cr) || 0;
              let comm = 0;
              if (cls.affects === 'sales') comm = amt * cfg.salesRate;
              else if (cls.affects === 'collections') comm = amt * cfg.collectionRate;
              const icon = cls.icon || '📌';
              const color = cls.dir === 'D' ? 'var(--gd)' : 'var(--grn)';
              return '<tr>'
                + '<td>' + (t.dt || '—') + '</td>'
                + '<td>' + SN(t.client || t.cl || '—') + '</td>'
                + '<td>' + icon + ' ' + (cls.label || t.tp || '—') + '</td>'
                + '<td style="color:' + color + ';font-weight:700">' + (cls.dir === 'D' ? '+' : '−') + KD(amt) + '</td>'
                + '<td style="color:' + (comm > 0 ? 'var(--grn)' : 'var(--tx3)') + ';font-weight:700">' + (comm > 0 ? '+' + KD(comm) : '—') + '</td>'
              + '</tr>';
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * دالة جديدة (B1.4): تحسب العمولات شهرياً لمندوب معيّن ضمن فترة
 * ترجع مصفوفة: [{ mk: '2025-08', sales, collections, salesCommission, collectionCommission, total }, ...]
 */
window.v23CalculateMonthlyCommissions = function(agent, fromDate, toDate) {
  const cfg = (typeof getCommissionsConfig === 'function') ? getCommissionsConfig() : null;
  const allTx = (window.O && window.O.tx) || [];
  const agentTx = allTx.filter(t => {
    const ag = t.ag || t.agent;
    if (ag !== agent.nm) return false;
    if (!t.dt) return false;
    if (fromDate && t.dt < fromDate) return false;
    if (toDate && t.dt > toDate) return false;
    return true;
  });

  // تجميع حسب الشهر
  const byMonth = {};
  const MK = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const MONTH_NAMES_AR = {'01':'يناير','02':'فبراير','03':'مارس','04':'أبريل','05':'مايو','06':'يونيو','07':'يوليو','08':'أغسطس','09':'سبتمبر','10':'أكتوبر','11':'نوفمبر','12':'ديسمبر'};

  agentTx.forEach(t => {
    if (!t.dt || t.dt.length < 7) return;
    const mk = t.dt.slice(0, 7); // YYYY-MM
    if (!byMonth[mk]) byMonth[mk] = { mk, sales: 0, returns: 0, collections: 0 };
    const cls = (typeof classifyTransaction === 'function') ? classifyTransaction(t.tp || t.type) : { affects: 'sales' };
    const amt = parseFloat(t.amount) || parseFloat(t.amt) || parseFloat(t.db) || parseFloat(t.cr) || 0;
    if (cls.affects === 'sales') byMonth[mk].sales += amt;
    else if (cls.affects === 'sales_return') byMonth[mk].returns += amt;
    else if (cls.affects === 'collections') byMonth[mk].collections += amt;
  });

  // حساب العمولة لكل شهر
  return Object.keys(byMonth).sort().map(mk => {
    const m = byMonth[mk];
    const netSales = m.sales - m.returns;
    const salesComm = netSales * (cfg?.salesRate || 0.01);
    const collComm = m.collections * (cfg?.collectionRate || 0.02);
    return {
      mk,
      monthLabel: (MONTH_NAMES_AR[mk.slice(5,7)] || mk.slice(5,7)) + ' ' + mk.slice(0,4),
      sales: +m.sales.toFixed(3),
      returns: +m.returns.toFixed(3),
      netSales: +netSales.toFixed(3),
      collections: +m.collections.toFixed(3),
      salesCommission: +salesComm.toFixed(3),
      collectionCommission: +collComm.toFixed(3),
      total: +(salesComm + collComm).toFixed(3),
      txCount: agentTx.filter(t => t.dt && t.dt.slice(0,7) === mk).length
    };
  });
};

/**
 * دالة جديدة (B1.4): تعرض جدول العمولات الشهرية لمندوب في الفترة
 * تُستدعى من renderAgentStatement تلقائياً
 */
window.v23RenderMonthlyCommissions = function(agent, fromDate, toDate) {
  if (!agent) return '';
  const monthly = window.v23CalculateMonthlyCommissions(agent, fromDate, toDate);
  if (monthly.length === 0) {
    return '<div style="text-align:center;padding:18px;color:#95a5a6;background:#fafafa;border-radius:8px;margin-top:18px;">لا توجد عمولات في الفترة المختارة</div>';
  }

  const totalSalesComm = monthly.reduce((s, m) => s + m.salesCommission, 0);
  const totalCollComm = monthly.reduce((s, m) => s + m.collectionCommission, 0);
  const totalAll = monthly.reduce((s, m) => s + m.total, 0);

  // أعلى شهر
  const peakMonth = monthly.reduce((max, m) => m.total > max.total ? m : max, monthly[0]);

  const rows = monthly.map(m => {
    const isPeak = m.mk === peakMonth.mk;
    return '<tr style="border-bottom:0.5pt solid #e0e0e0;background:' + (isPeak ? '#fff8e1' : 'transparent') + '">' +
      '<td style="padding:9px 10px;font-weight:700;color:#1a2744;">' + m.monthLabel + (isPeak ? ' ⭐' : '') + '</td>' +
      '<td style="padding:9px 10px;text-align:center;">' + m.txCount + '</td>' +
      '<td style="padding:9px 10px;text-align:left;">' + KD(m.netSales) + '</td>' +
      '<td style="padding:9px 10px;text-align:left;color:#1976d2;">' + KD(m.collections) + '</td>' +
      '<td style="padding:9px 10px;text-align:left;color:#2e7d32;">' + KD(m.salesCommission) + '</td>' +
      '<td style="padding:9px 10px;text-align:left;color:#1976d2;">' + KD(m.collectionCommission) + '</td>' +
      '<td style="padding:9px 10px;text-align:left;font-weight:900;color:#1a2744;">' + KD(m.total) + '</td>' +
      '</tr>';
  }).join('');

  return `
    <div style="margin-top:22px;background:#fff;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-top:3pt solid #b8932f;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
        <div>
          <h3 style="margin:0;color:#1a2744;font-size:15px;">📅 تفاصيل العمولات الشهرية</h3>
          <p style="margin:4px 0 0;color:#666;font-size:11.5px;">للمندوب <b style="color:#1a2744;">${String(agent.nm || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</b> · الفترة <b>${fromDate || 'البداية'}</b> إلى <b>${toDate || 'اليوم'}</b></p>
        </div>
        <div style="display:flex;gap:6px;">
          <span style="background:#fff8e1;padding:5px 10px;border-radius:6px;font-size:11px;color:#5b3578;font-weight:700;">🌟 أعلى شهر: ${peakMonth.monthLabel} (${(typeof KD === 'function' ? KD(peakMonth.total) : peakMonth.total.toFixed(3))})</span>
        </div>
      </div>

      <div style="overflow:auto;border-radius:8px;border:1pt solid #e0e0e0;">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <thead style="background:#1a2744;color:#fff;">
            <tr>
              <th style="padding:10px;text-align:right;">الشهر</th>
              <th style="padding:10px;text-align:center;">حركات</th>
              <th style="padding:10px;text-align:left;">صافي مبيعات</th>
              <th style="padding:10px;text-align:left;">تحصيل</th>
              <th style="padding:10px;text-align:left;">عمولة بيع</th>
              <th style="padding:10px;text-align:left;">عمولة تحصيل</th>
              <th style="padding:10px;text-align:left;background:#b8932f;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot style="background:#fafafa;font-weight:900;border-top:1.5pt solid #1a2744;">
            <tr>
              <td style="padding:10px;color:#1a2744;">المجموع (${monthly.length} شهر)</td>
              <td style="padding:10px;text-align:center;">${monthly.reduce((s,m)=>s+m.txCount,0)}</td>
              <td style="padding:10px;text-align:left;">${KD(monthly.reduce((s,m)=>s+m.netSales,0))}</td>
              <td style="padding:10px;text-align:left;">${KD(monthly.reduce((s,m)=>s+m.collections,0))}</td>
              <td style="padding:10px;text-align:left;color:#2e7d32;">${KD(totalSalesComm)}</td>
              <td style="padding:10px;text-align:left;color:#1976d2;">${KD(totalCollComm)}</td>
              <td style="padding:10px;text-align:left;color:#1a2744;background:#fff8e1;">${KD(totalAll)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${monthly.length > 1 ? `
      <div style="margin-top:14px;">
        <h4 style="margin:0 0 8px;color:#1a2744;font-size:13px;">📊 رسم بياني للعمولات الشهرية</h4>
        ${v23RenderMonthlyCommissionChart(monthly)}
      </div>
      ` : ''}
    </div>
  `;
};

/**
 * دالة مساعدة (B1.4): رسم بياني بسيط للعمولات الشهرية - HTML/CSS
 * (لا يحتاج Canvas - يعمل في print mode أيضاً)
 */
function v23RenderMonthlyCommissionChart(monthly) {
  const max = Math.max(...monthly.map(m => m.total), 1);
  const bars = monthly.map(m => {
    const heightPct = (m.total / max) * 100;
    return '<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:50px;">' +
      '<div style="font-size:10px;color:#1a2744;font-weight:700;margin-bottom:4px;">' + KD(m.total) + '</div>' +
      '<div style="width:100%;max-width:60px;height:' + heightPct + 'px;background:linear-gradient(180deg,#b8932f,#1a2744);border-radius:4px 4px 0 0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;">' + Math.round(heightPct) + '%</div>' +
      '<div style="font-size:10px;color:#666;margin-top:4px;text-align:center;writing-mode:vertical-rl;transform:rotate(180deg);">' + m.mk.slice(0,4) + '/' + m.mk.slice(5,7) + '</div>' +
      '</div>';
  }).join('');

  return '<div style="display:flex;gap:8px;align-items:flex-end;padding:14px;background:#fafafa;border-radius:8px;height:140px;border:1pt solid #e0e0e0;">' +
    bars +
  '</div>';
}

/**
 * B1.5: عرض كشف حساب كل المناديب مجمّعاً
 * - يحسب العمولات لكل مندوب في الفترة
 * - يعرض جدول مقارنة + إجماليات + رسم بياني
 */
window.v23RenderAllAgentsStatement = function(agents, fromDate, toDate) {
  const summaryEl = document.getElementById('agentStmtSummary');
  const tableEl = document.getElementById('agentStmtTableWrap');
  const monthlyEl = document.getElementById('agentStmtMonthlyWrap');

  if (!agents || agents.length === 0) {
    if (summaryEl) summaryEl.innerHTML = '<div style="text-align:center;padding:30px;color:#999;">لا توجد بيانات مناديب.</div>';
    if (tableEl) tableEl.innerHTML = '';
    if (monthlyEl) monthlyEl.innerHTML = '';
    return;
  }

  // حساب العمولات لكل مندوب
  const rows = agents.map(a => {
    const c = (typeof calculateAgentCommission === 'function')
      ? calculateAgentCommission(a, fromDate, toDate) : null;
    if (!c) return null;
    return { agent: a, comp: c };
  }).filter(Boolean).sort((a, b) => b.comp.totalCommission - a.comp.totalCommission);

  // إجماليات الفريق
  const totals = rows.reduce((acc, r) => ({
    sales: acc.sales + r.comp.netSales,
    collections: acc.collections + r.comp.collections,
    salesCommission: acc.salesCommission + r.comp.salesCommission,
    collectionCommission: acc.collectionCommission + r.comp.collectionCommission,
    targetBonus: acc.targetBonus + r.comp.targetBonus,
    totalCommission: acc.totalCommission + r.comp.totalCommission,
    uniqueClients: acc.uniqueClients + r.comp.uniqueClients,
    txCount: acc.txCount + r.comp.txCount
  }), { sales: 0, collections: 0, salesCommission: 0, collectionCommission: 0, targetBonus: 0, totalCommission: 0, uniqueClients: 0, txCount: 0 });

  // أعلى مندوب
  const topAgent = rows[0];
  const topAmount = topAgent ? topAgent.comp.totalCommission : 0;

  // === Summary ===
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;border-radius:12px;padding:20px;margin:16px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0;font-size:18px;">👥 كل المناديب — تقرير مجمّع</h3>
            <p style="margin:4px 0 0;opacity:0.85;font-size:12px;">${rows.length} مندوب · من ${fromDate || 'البداية'} إلى ${toDate || 'اليوم'}</p>
          </div>
          <div style="text-align:left;">
            <div style="font-size:11px;opacity:0.85;">إجمالي عمولات الفريق</div>
            <div style="font-size:30px;font-weight:900;">${(typeof KD === 'function' ? KD(totals.totalCommission) : totals.totalCommission.toFixed(3))} <span style="font-size:13px;opacity:0.85;">د.ك</span></div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px;">
        <div style="background:#fff;border-right:4px solid #2e7d32;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">صافي المبيعات</div>
          <div style="font-size:20px;font-weight:900;color:#2e7d32;">${(typeof KD === 'function' ? KD(totals.sales) : totals.sales.toFixed(3))}</div>
          <div style="font-size:10px;color:#999;">د.ك</div>
        </div>
        <div style="background:#fff;border-right:4px solid #1976d2;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">إجمالي التحصيل</div>
          <div style="font-size:20px;font-weight:900;color:#1976d2;">${(typeof KD === 'function' ? KD(totals.collections) : totals.collections.toFixed(3))}</div>
          <div style="font-size:10px;color:#999;">د.ك</div>
        </div>
        <div style="background:#fff;border-right:4px solid #b8932f;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">عملاء فريدين</div>
          <div style="font-size:20px;font-weight:900;color:#b8932f;">${totals.uniqueClients}</div>
          <div style="font-size:10px;color:#999;">عميل</div>
        </div>
        <div style="background:#fff;border-right:4px solid #5b3578;padding:14px;border-radius:8px;text-align:center;">
          <div style="font-size:11px;color:#666;">عدد المعاملات</div>
          <div style="font-size:20px;font-weight:900;color:#5b3578;">${totals.txCount}</div>
          <div style="font-size:10px;color:#999;">معاملة</div>
        </div>
      </div>

      ${topAgent ? `
      <div style="background:#fff8e1;border-right:4px solid #b8932f;padding:12px 16px;border-radius:8px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:12px;color:#5b3578;font-weight:700;">⭐ أعلى مندوب</div>
          <div style="font-size:15px;color:#1a2744;font-weight:900;margin-top:2px;">${String(topAgent.agent.nm || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>
        </div>
        <div style="font-size:18px;font-weight:900;color:#2e7d32;">${(typeof KD === 'function' ? KD(topAmount) : topAmount.toFixed(3))} د.ك</div>
      </div>
      ` : ''}
    `;
  }

  // === Table ===
  if (tableEl) {
    const tableRows = rows.map((r, idx) => {
      const c = r.comp;
      const a = r.agent;
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx + 1);
      const pct = totals.totalCommission > 0 ? (c.totalCommission / totals.totalCommission * 100) : 0;
      return '<tr style="border-bottom:0.5pt solid #e0e0e0;' + (idx === 0 ? 'background:#fff8e1;' : '') + '">' +
        '<td style="padding:9px;font-weight:700;color:#1a2744;text-align:center;width:36px;">' + medal + '</td>' +
        '<td style="padding:9px;font-weight:700;color:#1a2744;">' + String(a.nm || '').replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</td>' +
        '<td style="padding:9px;text-align:center;">' + c.uniqueClients + '</td>' +
        '<td style="padding:9px;text-align:center;">' + c.txCount + '</td>' +
        '<td style="padding:9px;text-align:left;">' + (typeof KD === 'function' ? KD(c.netSales) : c.netSales.toFixed(3)) + '</td>' +
        '<td style="padding:9px;text-align:left;color:#1976d2;">' + (typeof KD === 'function' ? KD(c.collections) : c.collections.toFixed(3)) + '</td>' +
        '<td style="padding:9px;text-align:left;color:#2e7d32;">' + (typeof KD === 'function' ? KD(c.salesCommission) : c.salesCommission.toFixed(3)) + '</td>' +
        '<td style="padding:9px;text-align:left;color:#1976d2;">' + (typeof KD === 'function' ? KD(c.collectionCommission) : c.collectionCommission.toFixed(3)) + '</td>' +
        '<td style="padding:9px;text-align:left;color:#b8932f;">' + (typeof KD === 'function' ? KD(c.targetBonus) : c.targetBonus.toFixed(3)) + '</td>' +
        '<td style="padding:9px;text-align:left;font-weight:900;color:#1a2744;background:#fafafa;">' + (typeof KD === 'function' ? KD(c.totalCommission) : c.totalCommission.toFixed(3)) + '</td>' +
        '<td style="padding:9px;text-align:center;color:#666;font-size:11px;">' + pct.toFixed(1) + '%</td>' +
        '</tr>';
    }).join('');

    tableEl.innerHTML = `
      <div style="margin-top:18px;">
        <h3 style="margin:0 0 12px;color:#1a2744;font-size:15px;">📋 تفاصيل عمولات المناديب (${rows.length} منديب)</h3>
        <div style="overflow:auto;border-radius:8px;border:1pt solid #e0e0e0;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead style="background:#1a2744;color:#fff;position:sticky;top:0;">
              <tr>
                <th style="padding:9px;text-align:center;">#</th>
                <th style="padding:9px;text-align:right;">المندوب</th>
                <th style="padding:9px;text-align:center;">عملاء</th>
                <th style="padding:9px;text-align:center;">معاملات</th>
                <th style="padding:9px;text-align:left;">مبيعات</th>
                <th style="padding:9px;text-align:left;">تحصيل</th>
                <th style="padding:9px;text-align:left;">عمولة بيع</th>
                <th style="padding:9px;text-align:left;">عمولة تحصيل</th>
                <th style="padding:9px;text-align:left;">تارجت</th>
                <th style="padding:9px;text-align:left;background:#b8932f;">الإجمالي</th>
                <th style="padding:9px;text-align:center;">نسبة</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot style="background:#fafafa;font-weight:900;border-top:1.5pt solid #1a2744;">
              <tr>
                <td colspan="2" style="padding:10px;color:#1a2744;">المجموع (${rows.length} مندوب)</td>
                <td style="padding:10px;text-align:center;">${totals.uniqueClients}</td>
                <td style="padding:10px;text-align:center;">${totals.txCount}</td>
                <td style="padding:10px;text-align:left;">${(typeof KD === 'function' ? KD(totals.sales) : totals.sales.toFixed(3))}</td>
                <td style="padding:10px;text-align:left;">${(typeof KD === 'function' ? KD(totals.collections) : totals.collections.toFixed(3))}</td>
                <td style="padding:10px;text-align:left;color:#2e7d32;">${(typeof KD === 'function' ? KD(totals.salesCommission) : totals.salesCommission.toFixed(3))}</td>
                <td style="padding:10px;text-align:left;color:#1976d2;">${(typeof KD === 'function' ? KD(totals.collectionCommission) : totals.collectionCommission.toFixed(3))}</td>
                <td style="padding:10px;text-align:left;color:#b8932f;">${(typeof KD === 'function' ? KD(totals.targetBonus) : totals.targetBonus.toFixed(3))}</td>
                <td style="padding:10px;text-align:left;color:#1a2744;background:#fff8e1;">${(typeof KD === 'function' ? KD(totals.totalCommission) : totals.totalCommission.toFixed(3))}</td>
                <td style="padding:10px;text-align:center;">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
  }

  // === Monthly (يجمع كل المناديب شهرياً) ===
  if (monthlyEl && typeof window.v23CalculateMonthlyCommissions === 'function') {
    // جمع كل الشهور من كل المناديب
    const monthlyMap = {};
    rows.forEach(r => {
      const m = window.v23CalculateMonthlyCommissions(r.agent, fromDate, toDate);
      m.forEach(month => {
        if (!monthlyMap[month.mk]) monthlyMap[month.mk] = { mk: month.mk, monthLabel: month.monthLabel, sales: 0, collections: 0, salesCommission: 0, collectionCommission: 0, total: 0, txCount: 0 };
        monthlyMap[month.mk].sales += month.sales;
        monthlyMap[month.mk].collections += month.collections;
        monthlyMap[month.mk].salesCommission += month.salesCommission;
        monthlyMap[month.mk].collectionCommission += month.collectionCommission;
        monthlyMap[month.mk].total += month.total;
        monthlyMap[month.mk].txCount += month.txCount;
      });
    });
    const monthly = Object.values(monthlyMap).sort((a, b) => a.mk.localeCompare(b.mk));
    if (monthly.length > 0) {
      const peakMonth = monthly.reduce((max, m) => m.total > max.total ? m : max, monthly[0]);
      const totalAll = monthly.reduce((s, m) => s + m.total, 0);
      const monthRows = monthly.map(m => {
        const isPeak = m.mk === peakMonth.mk;
        return '<tr style="border-bottom:0.5pt solid #e0e0e0;background:' + (isPeak ? '#fff8e1' : 'transparent') + '">' +
          '<td style="padding:9px 10px;font-weight:700;color:#1a2744;">' + m.monthLabel + (isPeak ? ' ⭐' : '') + '</td>' +
          '<td style="padding:9px 10px;text-align:center;">' + m.txCount + '</td>' +
          '<td style="padding:9px 10px;text-align:left;">' + (typeof KD === 'function' ? KD(m.sales - (m.returns || 0)) : (m.sales).toFixed(3)) + '</td>' +
          '<td style="padding:9px 10px;text-align:left;color:#1976d2;">' + (typeof KD === 'function' ? KD(m.collections) : m.collections.toFixed(3)) + '</td>' +
          '<td style="padding:9px 10px;text-align:left;color:#2e7d32;">' + (typeof KD === 'function' ? KD(m.salesCommission) : m.salesCommission.toFixed(3)) + '</td>' +
          '<td style="padding:9px 10px;text-align:left;color:#1976d2;">' + (typeof KD === 'function' ? KD(m.collectionCommission) : m.collectionCommission.toFixed(3)) + '</td>' +
          '<td style="padding:9px 10px;text-align:left;font-weight:900;color:#1a2744;">' + (typeof KD === 'function' ? KD(m.total) : m.total.toFixed(3)) + '</td>' +
          '</tr>';
      }).join('');

      monthlyEl.innerHTML = `
        <div style="margin-top:22px;background:#fff;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-top:3pt solid #b8932f;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
            <div>
              <h3 style="margin:0;color:#1a2744;font-size:15px;">📅 العمولات الشهرية - كل المناديب</h3>
              <p style="margin:4px 0 0;color:#666;font-size:11.5px;">مجموع ${rows.length} مندوب · الفترة ${fromDate || 'البداية'} إلى ${toDate || 'اليوم'}</p>
            </div>
            <div style="display:flex;gap:6px;">
              <span style="background:#fff8e1;padding:5px 10px;border-radius:6px;font-size:11px;color:#5b3578;font-weight:700;">🌟 أعلى شهر: ${peakMonth.monthLabel} (${(typeof KD === 'function' ? KD(peakMonth.total) : peakMonth.total.toFixed(3))})</span>
            </div>
          </div>

          <div style="overflow:auto;border-radius:8px;border:1pt solid #e0e0e0;">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
              <thead style="background:#1a2744;color:#fff;">
                <tr>
                  <th style="padding:10px;text-align:right;">الشهر</th>
                  <th style="padding:10px;text-align:center;">حركات</th>
                  <th style="padding:10px;text-align:left;">صافي مبيعات</th>
                  <th style="padding:10px;text-align:left;">تحصيل</th>
                  <th style="padding:10px;text-align:left;">عمولة بيع</th>
                  <th style="padding:10px;text-align:left;">عمولة تحصيل</th>
                  <th style="padding:10px;text-align:left;background:#b8932f;">الإجمالي</th>
                </tr>
              </thead>
              <tbody>${monthRows}</tbody>
              <tfoot style="background:#fafafa;font-weight:900;border-top:1.5pt solid #1a2744;">
                <tr>
                  <td style="padding:10px;color:#1a2744;">المجموع (${monthly.length} شهر)</td>
                  <td style="padding:10px;text-align:center;">${monthly.reduce((s,m)=>s+m.txCount,0)}</td>
                  <td style="padding:10px;text-align:left;">${(typeof KD === 'function' ? KD(monthly.reduce((s,m)=>s+(m.sales-(m.returns||0)),0)) : '—')}</td>
                  <td style="padding:10px;text-align:left;">${(typeof KD === 'function' ? KD(monthly.reduce((s,m)=>s+m.collections,0)) : '—')}</td>
                  <td style="padding:10px;text-align:left;color:#2e7d32;">${(typeof KD === 'function' ? KD(monthly.reduce((s,m)=>s+m.salesCommission,0)) : '—')}</td>
                  <td style="padding:10px;text-align:left;color:#1976d2;">${(typeof KD === 'function' ? KD(monthly.reduce((s,m)=>s+m.collectionCommission,0)) : '—')}</td>
                  <td style="padding:10px;text-align:left;color:#1a2744;background:#fff8e1;">${(typeof KD === 'function' ? KD(totalAll) : totalAll.toFixed(3))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          ${monthly.length > 1 ? `
          <div style="margin-top:14px;">
            <h4 style="margin:0 0 8px;color:#1a2744;font-size:13px;">📊 رسم بياني - مجموع العمولات الشهرية للفريق</h4>
            ${v23RenderMonthlyCommissionChart(monthly)}
          </div>
          ` : ''}
        </div>
      `;
    } else {
      monthlyEl.innerHTML = '';
    }
  }
};

function renderAgentStatement() {
  const idxRaw = document.getElementById('agentStmtAgent') && document.getElementById('agentStmtAgent').value;
  const fromDate = document.getElementById('agentStmtFromDate') && document.getElementById('agentStmtFromDate').value;
  const toDate = document.getElementById('agentStmtToDate') && document.getElementById('agentStmtToDate').value;
  const agents = (typeof D !== 'undefined' && D.ag && D.ag.length > 0) ? D.ag : (O.ag || []);

  // 🆕 B1.5: خيار "كل المناديب" - يجمع عمولات كل الفريق
  if (idxRaw === 'all') {
    document.getElementById('agentStmtDate').textContent = 'من ' + fromDate + ' إلى ' + toDate + ' (كل المناديب)';
    document.getElementById('agentStmtRef').textContent = 'REF: AG-ALL-' + Date.now().toString(36).toUpperCase();
    if (typeof window.v23RenderAllAgentsStatement === 'function') {
      window.v23RenderAllAgentsStatement(agents, fromDate, toDate);
    } else {
      document.getElementById('agentStmtSummary').innerHTML = '<div style="text-align:center;padding:18px;color:#c62828;">دالة v23RenderAllAgentsStatement غير محمّلة</div>';
    }
    return;
  }

  const idx = parseInt(idxRaw);
  if (isNaN(idx)) {
    document.getElementById('agentStmtSummary').innerHTML = renderAgentStatementSummary(null);
    document.getElementById('agentStmtTableWrap').innerHTML = renderAgentStatementTable(null);
    const mw = document.getElementById('agentStmtMonthlyWrap');
    if (mw) mw.innerHTML = '';
    return;
  }
  const agent = agents[idx];
  if (!agent) return;
  const comp = calculateAgentCommission(agent, fromDate, toDate);
  document.getElementById('agentStmtDate').textContent = 'من ' + fromDate + ' إلى ' + toDate;
  document.getElementById('agentStmtRef').textContent = 'REF: AG-STMT-' + Date.now().toString(36).toUpperCase();
  document.getElementById('agentStmtSummary').innerHTML = renderAgentStatementSummary(agent, comp);
  document.getElementById('agentStmtTableWrap').innerHTML = renderAgentStatementTable(agent, comp, fromDate, toDate);
  // 🆕 B1.4: قسم العمولات الشهرية - مربوط بالفترة تلقائياً
  const mw = document.getElementById('agentStmtMonthlyWrap');
  if (mw && window.v23RenderMonthlyCommissions) {
    try {
      const monthlyHtml = window.v23RenderMonthlyCommissions(agent, fromDate, toDate);
      mw.innerHTML = monthlyHtml || '<div style="text-align:center;padding:18px;color:#999;background:#fafafa;border-radius:8px;margin-top:18px;">القسم غير متوفر حالياً</div>';
    } catch(err) {
      console.error('[B1.4] renderAgentStatement monthly failed:', err);
      mw.innerHTML = '<div style="text-align:center;padding:14px;color:#c62828;background:#ffebee;border-radius:8px;margin-top:18px;font-size:12px;">⚠️ خطأ في تحميل العمولات الشهرية: ' + (err.message || 'unknown') + '</div>';
    }
  }
}

function openCommissionsModal() {
  const cfg = getCommissionsConfig();
  const existing = document.getElementById('commissionsModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'commissionsModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,30,56,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:0;max-width:560px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="background:linear-gradient(135deg,#f39c12,#d35400);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:17px">💰 إعدادات العمولات</h3>
        <button onclick="document.getElementById('commissionsModal').remove()" style="background:rgba(255,255,255,.2);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
      </div>
      <div style="padding:24px">
        <div style="display:grid;gap:14px">
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">نسبة عمولة المبيعات (%)</span>
            <input id="cmSales" type="number" step="0.001" min="0" value="${(cfg.salesRate*100).toFixed(3)}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px">
            <span style="font-size:11px;color:#7f8c8d">تُحسب على صافي المبيعات (مبيعات − مرتجعات)</span>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">نسبة عمولة التحصيل (%)</span>
            <input id="cmColl" type="number" step="0.001" min="0" value="${(cfg.collectionRate*100).toFixed(3)}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px">
            <span style="font-size:11px;color:#7f8c8d">حافز للمندوب لتحصيل الذمم</span>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">مكافأة تخطي الهدف (% إضافية)</span>
            <input id="cmBonus" type="number" step="0.001" min="0" value="${(cfg.targetBonusRate*100).toFixed(3)}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px">
            <span style="font-size:11px;color:#7f8c8d">تُضاف عند تخطي المندوب لهدفه الشهري</span>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">مكافأة العميل الجديد (د.ك)</span>
            <input id="cmNew" type="number" step="1" min="0" value="${cfg.newClientBonus}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px">
            <span style="font-size:11px;color:#7f8c8d">عن كل رصيد افتتاحي يدوي يضيفه المندوب</span>
          </label>
        </div>
        <div style="background:#fff8e1;border-right:4px solid #f39c12;padding:10px 14px;border-radius:6px;margin-top:14px;font-size:12px;color:#5d4037">
          ⚠️ التعديلات تؤثر على كل المناديب وتُحفظ فوراً.
        </div>
        <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end">
          <button onclick="document.getElementById('commissionsModal').remove()" style="padding:10px 20px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إلغاء</button>
          <button onclick="saveCommissionsConfig()" style="padding:10px 22px;background:linear-gradient(135deg,#f39c12,#d35400);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit">💾 حفظ الإعدادات</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveCommissionsConfig() {
  const salesRate = (parseFloat(document.getElementById('cmSales').value) || 0) / 100;
  const collectionRate = (parseFloat(document.getElementById('cmColl').value) || 0) / 100;
  const targetBonusRate = (parseFloat(document.getElementById('cmBonus').value) || 0) / 100;
  const newClientBonus = parseFloat(document.getElementById('cmNew').value) || 0;
  O.commissionsConfig = { salesRate: salesRate, collectionRate: collectionRate, targetBonusRate: targetBonusRate, newClientBonus: newClientBonus, minCommission: 0 };
  try { nayefSaveData(); } catch(e) {}
  if (document.getElementById('commissionsModal')) document.getElementById('commissionsModal').remove();
  if (typeof showToast === 'function') showToast('✅ تم الحفظ', 'تم تحديث نسب العمولات', true);
  renderAgentStatement();
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('commissions_update', '💰 تحديث نسب العمولات', { salesRate: salesRate, collectionRate: collectionRate, targetBonusRate: targetBonusRate, newClientBonus: newClientBonus }); } catch(e) {}
  }
}

function printAgentStatement() {
  window.print();
}

function exportAgentStatementExcel() {
  const idx = parseInt(document.getElementById('agentStmtAgent') && document.getElementById('agentStmtAgent').value);
  if (isNaN(idx)) { showToast('تنبيه', 'اختر مندوب أولاً', false); return; }
  // 🆕 A1.7: استخدم D.ag (مفلتر، يطابق صفحة المناديب)
  const agents = (typeof D !== 'undefined' && D.ag && D.ag.length > 0) ? D.ag : (O.ag || []);
  const agent = agents[idx];
  const fromDate = document.getElementById('agentStmtFromDate') && document.getElementById('agentStmtFromDate').value;
  const toDate = document.getElementById('agentStmtToDate') && document.getElementById('agentStmtToDate').value;
  const comp = calculateAgentCommission(agent, fromDate, toDate);
  const allTx = (window.O && window.O.tx) || [];
  const agentTx = allTx.filter(t => {
    const ag = t.ag || t.agent;
    if (ag !== agent.nm) return false;
    if (!t.dt) return false;
    if (fromDate && t.dt < fromDate) return false;
    if (toDate && t.dt > toDate) return false;
    return true;
  }).sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
  const cfg = getCommissionsConfig();
  let csv = '\uFEFF';
  csv += 'كشف حساب المندوب: ' + agent.nm + '\n';
  csv += 'الفترة: من ' + fromDate + ' إلى ' + toDate + '\n\n';
  csv += 'البيان,القيمة\n';
  csv += 'إجمالي المبيعات,' + comp.sales + '\n';
  csv += 'المرتجعات,' + comp.returns + '\n';
  csv += 'صافي المبيعات,' + comp.netSales + '\n';
  csv += 'التحصيل,' + comp.collections + '\n';
  csv += 'العملاء الفريدون,' + comp.uniqueClients + '\n';
  csv += 'عدد الحركات,' + comp.txCount + '\n';
  csv += 'نسبة التحقيق,' + comp.achievement + '%\n\n';
  csv += 'العمولات\n';
  csv += 'عمولة المبيعات (' + (cfg.salesRate*100).toFixed(2) + '%),' + comp.salesCommission + '\n';
  csv += 'عمولة التحصيل (' + (cfg.collectionRate*100).toFixed(2) + '%),' + comp.collectionCommission + '\n';
  csv += 'مكافأة تخطي الهدف,' + comp.targetBonus + '\n';
  csv += 'مكافأة عملاء جدد,' + comp.newClientBonus + '\n';
  csv += 'إجمالي العمولات,' + comp.totalCommission + '\n\n';
  csv += 'تفاصيل الحركات\n';
  csv += 'التاريخ,العميل,النوع,المبلغ,العمولة\n';
  agentTx.forEach(t => {
    const cls = (typeof classifyTransaction === 'function') ? classifyTransaction(t.tp || t.type) : { affects: 'sales', dir: 'D' };
    const amt = parseFloat(t.amount) || parseFloat(t.amt) || parseFloat(t.db) || parseFloat(t.cr) || 0;
    let comm = 0;
    if (cls.affects === 'sales') comm = amt * cfg.salesRate;
    else if (cls.affects === 'collections') comm = amt * cfg.collectionRate;
    const cells = [t.dt || '', (t.client || t.cl || ''), cls.label || t.tp || '', amt, comm];
    csv += cells.map(c => {
      const s = String(c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',') + '\n';
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'كشف_مندوب_' + agent.nm + '_' + fromDate + '_' + toDate + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  if (typeof showToast === 'function') showToast('⬇️ تم التصدير', 'تم تنزيل كشف ' + agent.nm, true);
}

window.DEFAULT_COMMISSIONS = DEFAULT_COMMISSIONS;
window.getCommissionsConfig = getCommissionsConfig;
window.calculateAgentCommission = calculateAgentCommission;
window.pageAgentStatement = pageAgentStatement;
window.renderAgentStatement = renderAgentStatement;
window.renderAgentStatementSummary = renderAgentStatementSummary;
window.renderAgentStatementTable = renderAgentStatementTable;
window.openCommissionsModal = openCommissionsModal;
window.saveCommissionsConfig = saveCommissionsConfig;
window.printAgentStatement = printAgentStatement;
window.exportAgentStatementExcel = exportAgentStatementExcel;

// ═══════════════════════════════════════════════════════════════════════
// 🆕 v220.5+ STORAGE V2 UI: نافذة النسخ الاحتياطي + PIN
// ═════════════

// expose on window so other scripts can use it
window.StorageV2 = StorageV2;
window.AuthManager = AuthManager;

function openBackupCenter() {
  const existing = document.getElementById('backupCenterModal');
  if (existing) existing.remove();

  const health = StorageV2.getStorageHealth();
  const hasPIN = AuthManager.hasPIN();
  const cloud = CloudSync.getStatus();

  const modal = document.createElement('div');
  modal.id = 'backupCenterModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,30,56,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;max-width:680px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="background:linear-gradient(135deg,#1b8a8a,#0d6868);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:17px">💾 مركز النسخ الاحتياطي والأمان</h3>
        <button onclick="document.getElementById('backupCenterModal').remove()" style="background:rgba(255,255,255,.2);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
      </div>
      <div style="padding:22px">
        <div style="background:linear-gradient(135deg,#e0f7fa,#b2ebf2);border-right:4px solid #1b8a8a;padding:14px 16px;border-radius:8px;margin-bottom:18px">
          <h4 style="margin:0 0 8px;color:#006064">📊 حالة التخزين</h4>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:12px;color:#37474f">
            <div>📦 الحجم المستخدم: <strong>${health.sizeKB} KB</strong> من ${health.quotaMB} MB (${health.percent}%)</div>
            <div>⏰ آخر حفظ: <strong>${health.lastSaveStr}</strong></div>
            <div>🔐 النسخة المشفرة: <strong>${health.encrypted ? '✅ موجودة' : '❌ غير موجودة'}</strong></div>
            <div>🗄️ قاعدة البيانات المحلية: <strong>✅ IndexedDB</strong></div>
          </div>
        </div>

        <div style="margin-bottom:18px">
          <h4 style="margin:0 0 10px;color:#37474f">📤 تصدير / استيراد</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button onclick="window.StorageV2.exportJSON()" style="padding:12px;background:linear-gradient(135deg,#27ae60,#1e8449);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13px">⬇️ تحميل نسخة احتياطية (JSON)</button>
            <label style="padding:12px;background:linear-gradient(135deg,#3498db,#2874a6);color:#fff;border-radius:8px;cursor:pointer;font-weight:700;text-align:center;display:block;font-size:13px">
              ⬆️ استعادة من ملف
              <input type="file" accept=".json" style="display:none" onchange="restoreFromFile(this)">
            </label>
          </div>
          <div style="background:#fff3cd;border-right:4px solid #f39c12;padding:8px 12px;border-radius:6px;margin-top:10px;font-size:11.5px;color:#5d4037">
            💡 ينصح بتحميل نسخة احتياطية أسبوعياً على الأقل. الملف يحتوي كل البيانات ويمكن استعادتها على أي جهاز.
          </div>
        </div>

        <div style="margin-bottom:18px">
          <h4 style="margin:0 0 10px;color:#37474f">🔐 PIN الدخول</h4>
          <div style="display:flex;gap:10px;align-items:center">
            <div style="flex:1;padding:10px 12px;background:${hasPIN ? '#d5f4e6' : '#f8d7da'};border-radius:7px;font-size:13px">
              ${hasPIN ? '✅ مُفعّل — يطلب رمز عند الدخول من جهاز غير معروف' : '⚠️ غير مُفعّل — اضبط رمز لحماية بياناتك'}
            </div>
            <button onclick="setupPINFlow()" style="padding:10px 16px;background:#f39c12;color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit">${hasPIN ? '🔄 تغيير' : '🔐 ضبط'}</button>
            ${hasPIN ? '<button onclick="removePINFlow()" style="padding:10px 14px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إزالة</button>' : ''}
          </div>
        </div>

        <div style="margin-bottom:18px">
          <h4 style="margin:0 0 10px;color:#37474f">🛡️ النسخ الاحتياطي التلقائي</h4>
          <div style="background:#f0f4f8;padding:12px;border-radius:7px;font-size:12px;color:#37474f">
            يتم تنزيل نسخة احتياطية تلقائياً كل <strong>7 أيام</strong> في مجلد التنزيلات.
            آخر نسخة تلقائية: <strong>${(() => { try { const t = parseInt(localStorage.getItem('nayef_last_auto_backup') || '0'); return t ? new Date(t).toLocaleString('ar-KW') : 'لم تُحفظ بعد'; } catch(e) { return '—'; } })()}</strong>
          </div>
        </div>

        <div style="margin-bottom:18px;background:linear-gradient(135deg,#f3e5f5,#e1bee7);padding:14px;border-radius:10px;border-right:4px solid #9b59b6">
          <h4 style="margin:0 0 10px;color:#6a1b9a">☁️ المزامنة السحابية (GitHub Gist)</h4>
          <p style="margin:0 0 10px;font-size:12px;color:#4a148c;line-height:1.6">
            بياناتك تنحفظ تلقائياً في السحابة وتظهر على <strong>جميع أجهزتك</strong> (لابتوب، جوال، أي متصفح) بدون تحميل يدوي.
          </p>
          <div style="background:rgba(255,255,255,.6);padding:10px;border-radius:7px;margin-bottom:10px;font-size:11.5px;color:#37474f">
            <div>📡 الحالة: <strong style="color:${cloud.configured ? (cloud.enabled ? '#27ae60' : '#f39c12') : '#95a5a6'}">${cloud.configured ? (cloud.enabled ? 'مُفعّلة' : 'مُعدة، غير مُفعّلة') : 'غير مُعدة'}</strong></div>
            <div>🌐 الإنترنت: <strong style="color:${cloud.online ? '#27ae60' : '#e74c3c'}">${cloud.online ? 'متصل' : 'غير متصل'}</strong></div>
            <div>🕐 آخر مزامنة: <strong>${cloud.lastSyncStr}</strong></div>
            <div>🆔 معرف الجهاز: <code style="background:#fff;padding:1px 5px;border-radius:3px">${cloud.deviceId}</code></div>
            ${cloud.lastError ? '<div style="color:#e74c3c;margin-top:6px">⚠️ خطأ: ' + cloud.lastError + '</div>' : ''}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${cloud.configured
              ? '<button onclick="cloudSyncNow()" style="padding:8px 14px;background:#9b59b6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit;font-size:12px">🔄 مزامنة الآن</button>'
                + (cloud.enabled
                  ? '<button onclick="cloudDisable()" style="padding:8px 14px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;font-size:12px">⏸️ إيقاف</button>'
                  : '<button onclick="cloudEnable()" style="padding:8px 14px;background:#27ae60;color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit;font-size:12px">▶️ تفعيل</button>')
                + '<button onclick="resetCloudSyncFlow()" style="padding:8px 14px;background:#e74c3c;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;font-size:12px">🗑️ إعادة ضبط</button>'
              : '<button onclick="setupCloudSyncFlow()" style="padding:10px 18px;background:linear-gradient(135deg,#9b59b6,#7d3c98);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13px">⚙️ إعداد GitHub Gist</button>'}
          </div>
          <details style="margin-top:10px">
            <summary style="cursor:pointer;color:#6a1b9a;font-size:12px;font-weight:700">📖 كيف تحصل على GitHub Token؟</summary>
            <ol style="margin:8px 0 0;padding-right:20px;font-size:11.5px;color:#37474f;line-height:1.7">
              <li>سجّل دخول في <a href="https://github.com" target="_blank" style="color:#9b59b6">github.com</a></li>
              <li>اذهب إلى <a href="https://github.com/settings/tokens/new" target="_blank" style="color:#9b59b6">github.com/settings/tokens/new</a></li>
              <li>اختر <strong>Fine-grained token</strong> أو <strong>Classic</strong></li>
              <li>حدد صلاحية <strong>Gists: Read and write</strong> فقط</li>
              <li>اضغط Generate → انسخ الـ Token (يبدأ بـ ghp_)</li>
              <li>الصقه في خانة الإعداد → يبدأ تلقائياً</li>
            </ol>
          </details>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid #ecf0f1;padding-top:14px">
          <button onclick="document.getElementById('backupCenterModal').remove()" style="padding:10px 22px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إغلاق</button>
          <button onclick="window.StorageV2.exportJSON();showToast && showToast('💾 تصدير', 'تم تنزيل النسخة الاحتياطية', true)" style="padding:10px 22px;background:linear-gradient(135deg,#1b8a8a,#0d6868);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit">💾 تصدير الآن</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function restoreFromFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (!confirm('⚠️ استعادة النسخة ستحل محل البيانات الحالية بالكامل. هل أنت متأكد؟')) {
    input.value = '';
    return;
  }
  try {
    const result = await StorageV2.importJSON(file);
    if (typeof showToast === 'function') {
      showToast('✅ تم', 'تمت الاستعادة بنجاح، سيتم إعادة التحميل...', true);
    }
    document.getElementById('backupCenterModal') && document.getElementById('backupCenterModal').remove();
    setTimeout(() => location.reload(), 1500);
  } catch(e) {
    if (typeof showToast === 'function') {
      showToast('❌ خطأ', 'ملف غير صالح: ' + e.message, false);
    }
    input.value = '';
  }
}

async function setupPINFlow() {
  const pin = prompt('أدخل PIN جديد (4-8 أرقام):');
  if (!pin) return;
  const confirmPin = prompt('أكد PIN:');
  if (pin !== confirmPin) {
    if (typeof showToast === 'function') showToast('❌ خطأ', 'الرمزان غير متطابقين', false);
    return;
  }
  try {
    await AuthManager.setupPIN(pin);
    if (typeof showToast === 'function') showToast('✅ تم', 'تم ضبط PIN بنجاح. جهازك محفوظ الآن.', true);
    if (typeof AuditLog !== 'undefined') AuditLog.log('pin_set', '🔐 ضبط PIN الدخول', null);
    openBackupCenter(); // refresh
  } catch(e) {
    if (typeof showToast === 'function') showToast('❌ خطأ', e.message, false);
  }
}

function removePINFlow() {
  if (!confirm('إزالة PIN؟ لن يُطلب منك رمز بعد الآن.')) return;
  AuthManager.removePIN();
  if (typeof showToast === 'function') showToast('✅ تم', 'تم إزالة PIN', true);
  if (typeof AuditLog !== 'undefined') AuditLog.log('pin_remove', '🔓 إزالة PIN', null);
  openBackupCenter();
}

// ───────────────────────────────────────────────────────────────────
// ☁️ Cloud Sync Setup Flow
// ───────────────────────────────────────────────────────────────────

function cloudSyncNow() {
  CloudSync.sync().then(r => {
    if (typeof showToast === 'function') {
      showToast('☁️', r.ok ? ('تمت: ' + r.action) : ('فشل: ' + (r.error || r.reason)), r.ok);
    }
    if (r.ok) openBackupCenter();
  });
}

function cloudEnable() {
  CloudSync.startAutoSync(60);
  CloudSync.updateStatusUI();
  if (typeof showToast === 'function') showToast('☁️', 'تم تفعيل المزامنة', true);
  openBackupCenter();
}

function cloudDisable() {
  CloudSync.disable();
  CloudSync.updateStatusUI();
  if (typeof showToast === 'function') showToast('⏸️', 'المزامنة متوقفة', false);
  openBackupCenter();
}

async function setupCloudSyncFlow() {
  const token = prompt('📋 الصق GitHub Personal Access Token (يبدأ بـ ghp_):\n\n[سيُحفظ محلياً فقط ولا يُرسل لأي خادم خارجي]', '');
  if (!token || !token.trim()) return;
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    if (typeof showToast === 'function') showToast('❌', 'صيغة Token غير صحيحة', false);
    return;
  }

  if (typeof showToast === 'function') showToast('⏳', 'جارٍ الاتصال بـ GitHub...', true);

  try {
    // احفظ الـ token مؤقتاً
    CloudSync.setToken(token);

    // اختبر بإنشاء/جلب Gist
    const existingId = CloudSync.getGistId();
    let gistId;
    if (existingId) {
      // تحقق أنه يعمل
      try {
        await CloudSync.pullFromGist(token, existingId);
        gistId = existingId;
      } catch(e) {
        gistId = await CloudSync.createGist(token, O);
        CloudSync.setGistId(gistId);
      }
    } else {
      gistId = await CloudSync.createGist(token, O);
      CloudSync.setGistId(gistId);
    }

    // فعّل المزامنة
    CloudSync.startAutoSync(60);
    CloudSync.hookSaveData();
    CloudSync.updateStatusUI();

    if (typeof showToast === 'function') {
      showToast('✅', 'تم إعداد المزامنة السحابية بنجاح! بياناتك ستظهر على كل أجهزتك.', true);
    }
    if (typeof AuditLog !== 'undefined') {
      AuditLog.log('cloud_sync_setup', '☁️ إعداد المزامنة السحابية', { gistId: gistId.slice(0, 12) });
    }
    openBackupCenter();
  } catch(e) {
    CloudSync.setToken('');
    if (typeof showToast === 'function') {
      showToast('❌', 'فشل الإعداد: ' + e.message, false);
    }
  }
}

function resetCloudSyncFlow() {
  if (!confirm('⚠️ إزالة المزامنة السحابية وإعداداتها؟\n(لن تُحذف البيانات، فقط المزامنة ستتوقف)')) return;
  CloudSync.disable();
  CloudSync.setToken('');
  CloudSync.setGistId('');
  if (typeof showToast === 'function') showToast('✅', 'تم إزالة المزامنة السحابية', true);
  if (typeof AuditLog !== 'undefined') AuditLog.log('cloud_sync_reset', '🗑️ إزالة المزامنة السحابية', null);
  openBackupCenter();
}

// تهيئة تلقائية عند التحميل
(function autoInitCloudSync() {
  if (typeof CloudSync === 'undefined') return;

  // Hook into nayefSaveData (wrap it)
  CloudSync.hookSaveData();

  // إذا كان مُعداً، فعّل المزامنة الدورية
  if (CloudSync.isConfigured()) {
    // انتظر حتى تكتمل أول مزامنة من ناحية الـ localStorage
    setTimeout(() => {
      CloudSync.startAutoSync(60);
      CloudSync.updateStatusUI();
      Logger.info('☁️ CloudSync auto-resumed');
    }, 5000);
  }

  // حدّث الواجهة عند تغيير حالة الاتصال
  setInterval(() => CloudSync.updateStatusUI(), 30000);
})();

window.openBackupCenter = openBackupCenter;
window.restoreFromFile = restoreFromFile;
window.setupPINFlow = setupPINFlow;
window.removePINFlow = removePINFlow;

// ═══════════════════════════════════════════════════════════════════════
// 🆕 v220.8+ INVOICE BUILDER: تصميم فاتورة احترافي ديناميكي
// ═══════════════════════════════════════════════════════════════════════

const Invoice = {
  KEY: 'nayef_invoices_v1',
  SETTINGS_KEY: 'nayef_invoice_settings',

  // ───────── إعدادات الشركة (للفاتورة) ─────────
  defaultSettings: {
    companyName: 'شركتك', // ✅ محايد - يُغيّره المستخدم
    companyTagline: 'Your Company',
    companyVat: 'رقم ضريبي: —',
    companyCr: 'سجل تجاري: —',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyLogo: 'ش',
    currency: 'د.ك',
    currencyCode: 'KWD',
    taxRate: 0,
    defaultNotes: '1. البضاعة المباعة لا تُرجع إلا بموافقة مسبقة.\n2. أي تلف في البضاعة يُسقط حق المطالبة.\n3. الشكاوى تُقبل خلال 48 ساعة من التسليم.',
    paymentTerms: 'نقدي / تحويل بنكي خلال 30 يوم',
    bankInfo: 'البنك الأهلي الكويتي - حساب: 1234567890',
    thanksMessage: 'شكراً لتعاملكم معنا 🌅 نتطلع لخدمتكم مرة أخرى',
    // 🆕 v220.9.10: نوع الفاتورة - ديناميكي
    invoiceType: 'فاتورة مبيعات',
    invoiceTypeEn: 'Sales Invoice',
    invoiceTypes: [
      { ar: 'فاتورة مبيعات', en: 'Sales Invoice', icon: '🛒' },
      { ar: 'فاتورة ضريبية', en: 'Tax Invoice', icon: '🧾' },
      { ar: 'فاتورة مشتريات', en: 'Purchase Invoice', icon: '📦' },
      { ar: 'فاتورة مرتجعات', en: 'Return Invoice', icon: '↩️' },
      { ar: 'فاتورة عرض سعر', en: 'Quotation', icon: '💼' },
      { ar: 'إشعار دائن', en: 'Credit Note', icon: '📝' },
      { ar: 'إشعار مدين', en: 'Debit Note', icon: '📋' },
      { ar: 'سند قبض', en: 'Receipt Voucher', icon: '💰' },
      { ar: 'سند صرف', en: 'Payment Voucher', icon: '💸' },
      { ar: 'أمر شراء', en: 'Purchase Order', icon: '🛍️' },
      { ar: 'أمر بيع', en: 'Sales Order', icon: '📋' },
      { ar: 'تسليم', en: 'Delivery Note', icon: '🚚' },
      { ar: 'استلام', en: 'Receipt Note', icon: '📥' },
      { ar: 'دفعات مقدمة', en: 'Proforma Invoice', icon: '💳' },
      { ar: 'مخصص', en: 'Custom', icon: '✏️' }
    ]
  },

  // ───────── تحميل البيانات ─────────
  getSettings() {
    // 🆕 لو المستخدم لسه ماخصّصش إعدادات الفاتورة بنفسه، نجيب بيانات شركته
    // الحقيقية (نفس الاسم واللوجو الظاهرين في هيدر النظام) بدل الحقول الوهمية
    let companyDefaults = {};
    try {
      const company = JSON.parse(localStorage.getItem('erp_company') || 'null');
      if (company) {
        companyDefaults = {
          companyName: company.name_ar || this.defaultSettings.companyName,
          companyTagline: company.name_en || '',
          companyLogo: company.logo || (company.name_ar ? company.name_ar.trim().charAt(0) : this.defaultSettings.companyLogo),
          companyEmail: company.admin_email || '',
          companyPhone: company.phone || '',
          companyAddress: company.address || '',
          companyCr: company.cr_number ? ('سجل تجاري: ' + company.cr_number) : this.defaultSettings.companyCr,
          companyVat: company.vat_number ? ('رقم ضريبي: ' + company.vat_number) : this.defaultSettings.companyVat,
          bankInfo: company.bank_info || this.defaultSettings.bankInfo
        };
      }
    } catch (e) {}

    try {
      const saved = JSON.parse(localStorage.getItem(this.SETTINGS_KEY) || 'null');
      return Object.assign({}, this.defaultSettings, companyDefaults, saved || {});
    } catch(e) { return Object.assign({}, this.defaultSettings, companyDefaults); }
  },
  saveSettings(s) {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(s));
  },
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch(e) { return []; }
  },
  saveAll(list) {
    localStorage.setItem(this.KEY, JSON.stringify(list));
    if (typeof nayefSaveData === 'function') nayefSaveData();
  },
  getById(id) {
    return this.getAll().find(inv => inv.id === id);
  },
  upsert(inv) {
    const list = this.getAll();
    const idx = list.findIndex(i => i.id === inv.id);
    if (idx >= 0) list[idx] = inv; else list.unshift(inv);
    this.saveAll(list);
  },
  remove(id) {
    const list = this.getAll().filter(i => i.id !== id);
    this.saveAll(list);
  },
  nextId() {
    const list = this.getAll();
    const year = new Date().getFullYear();
    const yInv = list.filter(i => (i.id || '').includes(String(year)));
    const max = yInv.reduce((m, i) => {
      const n = parseInt((i.id || '').split('-').pop()) || 0;
      return Math.max(m, n);
    }, 0);
    return 'INV-' + year + '-' + String(max + 1).padStart(4, '0');
  },

  // ───────── مساعد: المبلغ بالحروف (عربي) ─────────
  amountInWords(num) {
    if (!num || isNaN(num)) return 'صفر';
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const hundreds = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
    function convertGroup(n) {
      if (n === 0) return '';
      let s = '';
      const h = Math.floor(n / 100);
      const t = Math.floor((n % 100) / 10);
      const o = n % 10;
      if (h) s += hundreds[h] + ' ';
      if (t === 1) s += teens[o] + ' ';
      else { if (t) s += tens[t] + ' '; if (o) s += ones[o] + ' '; }
      return s.trim();
    }
    const dinars = Math.floor(num);
    const fils = Math.round((num - dinars) * 1000);
    let result = '';
    if (dinars > 0) {
      const millions = Math.floor(dinars / 1000000);
      const thousands = Math.floor((dinars % 1000000) / 1000);
      const rest = dinars % 1000;
      if (millions) result += convertGroup(millions) + ' مليون ';
      if (thousands) result += convertGroup(thousands) + ' ألف ';
      if (rest) result += convertGroup(rest);
      result = result.trim() + ' دينار';
    }
    if (fils > 0) {
      if (result) result += ' و';
      result += convertGroup(fils) + ' فلس';
    }
    if (!result) result = 'صفر';
    return result + ' لا غير';
  },

  // ───────── حساب إجماليات العنصر ─────────
  rowTotal(it) {
    const qty = parseFloat(it.qty) || 0;
    const price = parseFloat(it.price) || 0;
    const discount = parseFloat(it.discount) || 0;
    const tax = parseFloat(it.tax) || 0;
    const base = qty * price;
    const discAmt = base * discount / 100;
    const afterDisc = base - discAmt;
    const taxAmt = afterDisc * tax / 100;
    return +(afterDisc + taxAmt).toFixed(3);
  },

  // ───────── حساب إجماليات الفاتورة ─────────
  totals(inv) {
    let subtotal = 0, totalDisc = 0, totalTax = 0;
    (inv.items || []).forEach(it => {
      const qty = parseFloat(it.qty) || 0;
      const price = parseFloat(it.price) || 0;
      const discount = parseFloat(it.discount) || 0;
      const tax = parseFloat(it.tax) || 0;
      const base = qty * price;
      const discAmt = base * discount / 100;
      const afterDisc = base - discAmt;
      const taxAmt = afterDisc * tax / 100;
      subtotal += base;
      totalDisc += discAmt;
      totalTax += taxAmt;
    });
    subtotal = +subtotal.toFixed(3);
    totalDisc = +totalDisc.toFixed(3);
    totalTax = +totalTax.toFixed(3);
    const shipping = +(parseFloat(inv.shipping) || 0).toFixed(3);
    const globalDiscAmt = +(parseFloat(inv.globalDiscount) || 0).toFixed(3);
    const total = +(subtotal - totalDisc + totalTax + shipping - globalDiscAmt).toFixed(3);
    const paid = +(parseFloat(inv.paid) || 0).toFixed(3);
    const due = +(total - paid).toFixed(3);
    return { subtotal, totalDisc, totalTax, shipping, globalDiscount: globalDiscAmt, total, paid, due };
  },

  // ───────── صفحة الفاتورة الرئيسية ─────────
  pageInvoice(pg) {
    pg.innerHTML = `
      <div id="invoicePage">
        <div id="invoiceActionsBar"></div>
        <div id="invoiceListSection"></div>
        <div id="invoiceEditorSection"></div>
      </div>
    `;
    this.renderActionsBar();
    this.renderSavedList();
  },

  renderActionsBar() {
    const el = document.getElementById('invoiceActionsBar');
    if (!el) return;
    const list = this.getAll();
    el.innerHTML = `
      <div class="invoice-actions-bar">
        <div class="left">
          <button class="invoice-btn primary" onclick="Invoice.newInvoice()">➕ فاتورة جديدة</button>
          <button class="invoice-btn secondary" onclick="Invoice.renderSavedList()">🔄 تحديث</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="font-size:13px;color:#7f8c8d;font-weight:700">إجمالي الفواتير: <strong style="color:#1b8a8a">${list.length}</strong></span>
          <button class="invoice-btn info" onclick="Invoice.toggleCompact()" title="تبديل الوضع المضغوط (يؤثر على حجم المحرر فقط)">📐 <span id="compactBtnText">مضغوط</span></button>
          <button class="invoice-btn secondary" onclick="Invoice.openSettings()">⚙️ إعدادات الشركة</button>
        </div>
      </div>
    `;
  },

  renderSavedList() {
    const el = document.getElementById('invoiceListSection');
    if (!el) return;
    const list = this.getAll();
    if (list.length === 0) {
      el.innerHTML = `
        <div class="invoice-saved-list" style="text-align:center;padding:30px">
          <h3>🧾 الفواتير المحفوظة</h3>
          <p style="color:#7f8c8d;margin:14px 0">لا توجد فواتير بعد. اضغط "فاتورة جديدة" للبدء.</p>
          <button class="invoice-btn primary" onclick="Invoice.newInvoice()">➕ إنشاء أول فاتورة</button>
        </div>
      `;
      return;
    }
    const statusLabels = { draft: 'مسودة', issued: 'صادرة', paid: 'مدفوعة', partial: 'مدفوعة جزئياً', overdue: 'متأخرة' };
    el.innerHTML = `
      <div class="invoice-saved-list">
        <h3>
          <span>🧾 الفواتير المحفوظة (${list.length})</span>
          <span style="font-size:12px;color:#7f8c8d;font-weight:600">آخر تعديل: ${list[0].updatedAt ? new Date(list[0].updatedAt).toLocaleString('ar-KW') : '—'}</span>
        </h3>
        <div class="invoice-list-row header">
          <div>الرقم</div><div>العميل</div><div>التاريخ</div><div>الإجمالي</div><div>المتبقي</div><div>الحالة</div><div>إجراءات</div>
        </div>
        ${list.map(inv => {
          const t = this.totals(inv);
          const statusClass = inv.status || 'draft';
          if (inv.deleted) {
            return `
            <div class="invoice-list-row" style="opacity:.55;background:#fdecea">
              <div class="num" style="text-decoration:line-through">${inv.id}</div>
              <div style="text-decoration:line-through">${SN(inv.client || '—')}</div>
              <div>${inv.dt || '—'}</div>
              <div style="text-decoration:line-through">${KD(t.total)}</div>
              <div>—</div>
              <div><span class="invoice-status-pill" style="background:#e74c3c;color:#fff" title="${SN(inv.deleteReason || '')}">🗑 محذوفة</span></div>
              <div class="actions" style="font-size:11px;color:#7f8c8d">${SN(inv.deleteReason || '')}</div>
            </div>
            `;
          }
          return `
            <div class="invoice-list-row">
              <div class="num">${inv.id}</div>
              <div>${SN(inv.client || '—')}</div>
              <div>${inv.dt || '—'}</div>
              <div style="font-weight:700;color:#1b8a8a">${KD(t.total)}</div>
              <div style="color:${t.due > 0 ? '#e74c3c' : '#27ae60'};font-weight:700">${KD(t.due)}</div>
              <div><span class="invoice-status-pill ${statusClass}">${statusLabels[statusClass] || statusClass}</span></div>
              <div class="actions">
                <button onclick="Invoice.editInvoice('${inv.id}')" style="background:#3498db;color:#fff">📝 فتح</button>
                <button onclick="Invoice.duplicateInvoice('${inv.id}')" style="background:#f39c12;color:#fff">📋 نسخ</button>
                <button onclick="Invoice.deleteInvoice('${inv.id}')" style="background:#e74c3c;color:#fff">🗑</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // ───────── فاتورة جديدة ─────────
  newInvoice() {
    const settings = this.getSettings();
    const inv = {
      id: this.nextId(),
      dt: new Date().toISOString().slice(0, 10),
      dueDt: new Date(Date.now() + 30*86400000).toISOString().slice(0, 10),
      client: '',
      clientPhone: '',
      clientVat: '',
      agent: '',
      items: [
        { code: '', nm: '', qty: 1, price: 0, discount: 0, tax: settings.taxRate || 0 },
      ],
      shipping: 0,
      globalDiscount: 0,
      paid: 0,
      status: 'draft',
      notes: settings.defaultNotes || '',
      paymentTerms: settings.paymentTerms || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.editInvoiceObj(inv);
  },

  editInvoice(id) {
    const inv = this.getById(id);
    if (!inv) return;
    if (inv.deleted) { if (typeof showToast === 'function') showToast('⚠️', 'الفاتورة دي محذوفة ومينفعش تتعدّل', false); return; }
    if (!inv.items || inv.items.length === 0) inv.items = [{ code: '', nm: '', qty: 1, price: 0, discount: 0, tax: 0 }];
    this.editInvoiceObj(inv);
  },

  duplicateInvoice(id) {
    const orig = this.getById(id);
    if (!orig) return;
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = this.nextId();
    copy.status = 'draft';
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.paid = 0;
    this.upsert(copy);
    this.renderSavedList();
    if (typeof showToast === 'function') showToast('📋', 'تم نسخ الفاتورة: ' + copy.id, true);
  },

  deleteInvoice(id) {
    const inv = this.getById(id);
    if (!inv) return;
    if (inv.deleted) { if (typeof showToast === 'function') showToast('⚠️', 'الفاتورة دي محذوفة بالفعل', false); return; }

    const reason = prompt('لازم تكتب سبب حذف الفاتورة ' + id + ' (إجباري — للتدقيق):');
    if (reason === null) return; // اتلغى
    if (!reason.trim()) {
      alert('لازم تكتب سبب — الحذف من غير سبب مش مسموح');
      return;
    }

    // 🛡️ حذف ناعم فقط: الفاتورة تفضل في القائمة بعلامة "محذوفة" ورقمها التسلسلي
    // ميترجعش يتستخدم تاني — ده معيار أساسي في أي نظام فوترة رسمي (تدقيق ضريبي/محاسبي)
    inv.deleted = true;
    inv.deleteReason = reason.trim();
    inv.deletedAt = Date.now();
    inv.deletedBy = (function(){ try { return JSON.parse(localStorage.getItem('erp_company')||'{}').admin_email || ''; } catch(e){ return ''; } })();
    this.upsert(inv);

    // إلغاء الأثر المالي المرتبط بيها (لو كانت مسجّلة كحركة)
    if (inv._postedToTx && typeof O !== 'undefined' && O.tx) {
      const idx = O.tx.findIndex(x => x.invoice === inv.id);
      if (idx >= 0) O.tx.splice(idx, 1);
      inv._postedToTx = false;
      if (typeof nayefSaveData === 'function') nayefSaveData();
    }

    if (typeof AuditLog !== 'undefined') {
      try { AuditLog.log('invoice_delete', '🗑 حذف فاتورة', { id: inv.id, reason: inv.deleteReason }); } catch(e) {}
    }

    this.renderSavedList();
    this.renderActionsBar();
    if (typeof showToast === 'function') showToast('🗑', 'تم حذف الفاتورة ' + id + ' (السبب مسجّل)', true);
  },

  // ───────── محرر الفاتورة ─────────
  editInvoiceObj(inv) {
    const settings = this.getSettings();
    const ed = document.getElementById('invoiceEditorSection');
    if (!ed) return;
    ed.innerHTML = this.renderEditorHTML(inv, settings);
    this.bindEditorEvents(inv);
    this.recalcEditor();
    ed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  renderEditorHTML(inv, settings) {
    const itemsHtml = (inv.items || []).map((it, idx) => this.renderItemRow(it, idx)).join('');
    const clientsOptions = (O.soc || []).map(c => `<option value="${SN(c.nm)}" data-phone="${SN(c.phone||'')}">${SN(c.nm)}</option>`).join('');
    const agentsOptions = (O.ag || []).map(a => `<option value="${SN(a.nm)}">${SN(a.nm)}</option>`).join('');
    const itemsOptions = (O.it || []).map(i => {
      const fullNm = String(i.nm||'').trim().replace(/\s+/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
      const escapedNm = fullNm.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      return `<option value="${SN(i.cd||'')}" data-nm="${escapedNm}" data-price="${parseFloat(i.up||i.pr||i.price||0).toFixed(3)}" data-uc="${parseFloat(i.uc||0).toFixed(3)}" data-unit="${SN(i.un||i.unit||'قطعة')}" data-fullnm="${escapedNm}" title="${escapedNm}">${escapedNm}</option>`;
    }).join('');
    const compact = inv._compact !== false; // default ON
    // _compact: false → وضع موسع للمحرر
    const statusLabels = { draft: 'مسودة', issued: 'صادرة', paid: 'مدفوعة', partial: 'مدفوعة جزئياً', overdue: 'متأخرة' };
    return `
      <div class="invoice-app invoice-print-zone ${(localStorage.getItem('nayef_invoice_compact') !== 'false') ? 'compact-mode' : ''}" id="invoiceEditor">
        <div class="invoice-watermark">${settings.companyLogo}</div>
        <div class="invoice-header">
          <div class="invoice-logo">${settings.companyLogo}</div>
          <div class="invoice-company">
            <h1>${settings.companyName}</h1>
            <div class="tagline">${settings.companyTagline}</div>
            <div class="contact">
              <span>📍 ${settings.companyAddress}</span>
              <span>📞 ${settings.companyPhone}</span>
              <span>✉ ${settings.companyEmail}</span>
            </div>
            <div style="font-size:11px;opacity:.85;margin-top:6px">${settings.companyCr} | ${settings.companyVat}</div>
          </div>
          <div class="invoice-meta">
            <h2>${SN(settings.invoiceType||'فاتورة مبيعات')}</h2>
            <div class="id">رقم: <strong>${inv.id}</strong></div>
            <div class="date">التاريخ: <input type="date" id="inv_dt" value="${inv.dt}" style="background:rgba(255,255,255,.2);color:#fff;border:none;padding:3px 8px;border-radius:5px;font-family:inherit;font-size:12px"></div>
            <div class="date">الاستحقاق: <input type="date" id="inv_dueDt" value="${inv.dueDt}" style="background:rgba(255,255,255,.2);color:#fff;border:none;padding:3px 8px;border-radius:5px;font-family:inherit;font-size:12px"></div>
          </div>
        </div>

        <div class="invoice-status-bar ${inv.status||'draft'}">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span style="font-weight:800;font-size:13px">الحالة:</span>
            <select id="inv_status" onchange="Invoice.updateStatusUI(this.value)" style="padding:4px 10px;border-radius:6px;border:1px solid #ddd;font-family:inherit;font-weight:700">
              <option value="draft" ${inv.status==='draft'?'selected':''}>📝 مسودة</option>
              <option value="issued" ${inv.status==='issued'?'selected':''}>📤 صادرة</option>
              <option value="partial" ${inv.status==='partial'?'selected':''}>🟠 مدفوعة جزئياً</option>
              <option value="paid" ${inv.status==='paid'?'selected':''}>✅ مدفوعة</option>
              <option value="overdue" ${inv.status==='overdue'?'selected':''}>🔴 متأخرة</option>
            </select>
          </div>
          <div style="font-size:12px;font-weight:700;color:#7f8c8d">
            ${inv.createdAt ? 'أُنشئت: ' + new Date(inv.createdAt).toLocaleString('ar-KW') : ''}
          </div>
        </div>

        <div class="invoice-info-grid">
          <div class="invoice-info-card">
            <h4>👥 العميل</h4>
            <select id="inv_client" onchange="Invoice.onClientChange()" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-weight:700;margin-bottom:8px">
              <option value="">— اختر عميل —</option>
              ${clientsOptions}
              <option value="__custom__">➕ عميل جديد...</option>
            </select>
            <input type="text" id="inv_client_name" value="${SN(inv.client||'')}" placeholder="اسم العميل" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-weight:700;font-size:15px;margin-bottom:6px">
            <div class="detail">
              <input type="text" id="inv_client_phone" value="${SN(inv.clientPhone||'')}" placeholder="📞 رقم الهاتف" style="width:100%;padding:4px;border:1px solid #eee;border-radius:4px;font-family:inherit;font-size:12px;margin-bottom:4px">
              <input type="text" id="inv_client_vat" value="${SN(inv.clientVat||'')}" placeholder="🏛 الرقم الضريبي (اختياري)" style="width:100%;padding:4px;border:1px solid #eee;border-radius:4px;font-family:inherit;font-size:12px">
            </div>
          </div>
          <div class="invoice-info-card agent">
            <h4>👤 المندوب / المرجع</h4>
            <select id="inv_agent" onchange="document.getElementById('inv_agent_name').value=this.value" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-weight:700;margin-bottom:8px">
              <option value="">— اختر مندوب —</option>
              ${agentsOptions}
            </select>
            <input type="text" id="inv_agent_name" value="${SN(inv.agent||'')}" placeholder="اسم المندوب" style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-weight:700;font-size:15px">
            <div class="detail">
              <div style="margin-top:8px">📌 المرجع: <input type="text" id="inv_ref" value="${SN(inv.ref||'')}" placeholder="رقم طلب / مرجع" style="border:1px solid #eee;border-radius:4px;padding:3px 6px;font-family:inherit;font-size:12px"></div>
            </div>
          </div>
        </div>

        <div class="invoice-items-wrap">
          <table class="invoice-items">
            <thead>
              <tr>
                <th style="width:38px">#</th>
                <th>الصنف / الخدمة</th>
                <th style="width:90px" class="center">الكمية</th>
                <th style="width:110px" class="number">السعر</th>
                <th style="width:80px" class="center">خصم%</th>
                <th style="width:80px" class="center">ضريبة%</th>
                <th style="width:120px" class="number">الإجمالي</th>
                <th style="width:40px"></th>
              </tr>
            </thead>
            <tbody id="invoiceItemsBody">${itemsHtml}</tbody>
          </table>
          <div class="invoice-add-row" onclick="Invoice.addItem()">➕ إضافة سطر جديد</div>
        </div>

        <div class="invoice-totals">
          <div class="invoice-amount-words">
            <strong>💬 المبلغ بالحروف</strong>
            <span id="invoiceAmountWords">—</span>
          </div>
          <div class="invoice-totals-box" id="invoiceTotalsBox"></div>
        </div>

        <div class="invoice-terms">
          <div class="invoice-terms-card">
            <strong>💳 شروط الدفع</strong>
            <textarea id="inv_paymentTerms" rows="2" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:6px;font-family:inherit;font-size:12.5px">${SN(inv.paymentTerms||settings.paymentTerms)}</textarea>
            <div style="margin-top:6px;font-size:11.5px;color:#7f8c8d">🏦 ${settings.bankInfo}</div>
          </div>
          <div class="invoice-terms-card">
            <strong>📝 ملاحظات</strong>
            <textarea id="inv_notes" rows="4" style="width:100%;border:1px solid #ddd;border-radius:4px;padding:6px;font-family:inherit;font-size:12.5px">${SN(inv.notes||settings.defaultNotes)}</textarea>
          </div>
        </div>

        <div class="invoice-footer">
          <div class="invoice-signature">
            <div class="sig-label">توقيع العميل</div>
            <div class="sig-line">الاسم: ${SN(inv.client)}</div>
            <div class="sig-line" style="margin-top:18px">التاريخ: ${inv.dt}</div>
          </div>
          <div class="invoice-signature">
            <div class="sig-label">توقيع البائع / الختم</div>
            <div class="sig-line">${settings.companyName}</div>
            <div class="sig-line" style="margin-top:18px">شكراً لتعاملكم معنا 🌅</div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px" class="no-print">
        <button class="invoice-btn success" onclick="Invoice.saveFromEditor(true)">💾 حفظ + طباعة</button>
        <button class="invoice-btn primary" onclick="Invoice.saveFromEditor(false)">💾 حفظ</button>
        <button class="invoice-btn info" onclick="Invoice.printInvoice()">🖨 طباعة</button>
        <button class="invoice-btn warning" onclick="Invoice.exportPDF()">📄 PDF</button>
        <button class="invoice-btn whatsapp" onclick="Invoice.shareWhatsApp()">📱 واتساب</button>
        <button class="invoice-btn secondary" onclick="Invoice.convertToTransaction()">💼 تسجيل كحركة</button>
        <button class="invoice-btn danger" onclick="Invoice.closeEditor()">✕ إغلاق</button>
      </div>
    `;
  },

  renderItemRow(it, idx) {
    // 🆕 FIX v220.9.9: عرض الاسم الكامل في option (بدون قص) + title tooltip
    const itemsOptions = (O.it || []).map(i => {
      // ضمان الاسم الكامل: trim + استبدال المسافات
      const fullNm = String(i.nm||'').trim().replace(/\s+/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
      const escapedNm = fullNm.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      return `<option value="${SN(i.cd||'')}" data-nm="${escapedNm}" data-price="${parseFloat(i.up||i.pr||i.price||0).toFixed(3)}" data-uc="${parseFloat(i.uc||0).toFixed(3)}" data-unit="${SN(i.un||i.unit||'قطعة')}" data-fullnm="${escapedNm}" title="${escapedNm}" ${(i.cd||'')===(it.code||'')?'selected':''}>${escapedNm}</option>`;
    }).join('');
    // الاسم الحالي (it.nm) - تنظيف أيضاً
    const currentNm = String(it.nm||'').trim().replace(/\s+/g,' ');
    return `
      <tr data-idx="${idx}">
        <td class="col-num" style="text-align:center;width:28px"><span class="item-num">${idx+1}</span></td>
        <td class="col-nm" style="width:auto;min-width:160px">
          <select class="row-item-select" onchange="Invoice.onItemPick(${idx}, this)" style="margin-bottom:4px;width:100%;text-align:right;direction:rtl" data-original-nm="${SN(it.nm||'')}">
            <option value="">— اختر من الأصناف —</option>
            ${itemsOptions}
          </select>
          <input type="text" data-field="nm" class="row-item-nm" value="${SN(currentNm)}" placeholder="اسم الصنف أو الخدمة" title="${SN(currentNm)}" dir="rtl" style="width:100%;min-width:200px;font-size:13px;text-align:right;direction:rtl;font-weight:600;display:block;box-sizing:border-box" oninput="Invoice.onItemEdit(${idx})">
        </td>
        <td class="col-qty" style="width:60px"><input type="number" data-field="qty" class="qty row-item-qty" value="${it.qty}" min="0" step="0.001" style="text-align:center;width:100%;font-weight:700" oninput="Invoice.onItemEdit(${idx})"></td>
        <td class="col-price" style="width:75px"><input type="number" data-field="price" class="price row-item-price" value="${it.price}" min="0" step="0.001" style="text-align:center;width:100%;font-weight:700" oninput="Invoice.onItemEdit(${idx})"></td>
        <td class="col-discount" style="width:55px"><div style="position:relative"><input type="number" data-field="discount" class="discount row-item-discount" value="${it.discount}" min="0" max="100" step="0.01" style="text-align:center;width:100%;font-weight:700;direction:ltr;padding-left:14px" oninput="Invoice.onItemEdit(${idx})"><span style="position:absolute;right:2px;top:50%;transform:translateY(-50%);font-size:9px;color:#666;font-weight:700;pointer-events:none">%</span></div></td>
        <td class="col-tax" style="width:55px"><div style="position:relative"><input type="number" data-field="tax" class="tax row-item-tax" value="${it.tax}" min="0" max="100" step="0.01" style="text-align:center;width:100%;font-weight:700;direction:ltr;padding-left:14px" oninput="Invoice.onItemEdit(${idx})"><span style="position:absolute;right:2px;top:50%;transform:translateY(-50%);font-size:9px;color:#666;font-weight:700;pointer-events:none">%</span></div></td>
        <td class="col-total" style="width:90px"><div class="row-total" data-row-total style="text-align:center;font-weight:800;color:#1b8a8a;font-size:13px">0.000</div></td>
        <td class="col-del" style="width:30px"><button onclick="Invoice.removeItem(${idx})" class="row-del-btn" style="background:#e74c3c;color:#fff;border:none;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:12px;padding:0">×</button></td>
      </tr>
    `;
  },

  // ───────── أحداث المحرر ─────────
  bindEditorEvents(inv) {
    this._currentInv = inv;
  },

  onItemPick(idx, sel) {
    const opt = sel.selectedOptions[0];
    if (!opt || !this._currentInv) return;
    const it = this._currentInv.items[idx];
    if (!it) return;
    it.code = opt.value;
    // 🆕 FIX v220.9.9: الاسم الكامل من data-nm (مع ترميز HTML)
    let dataNm = opt.getAttribute('data-nm') || opt.getAttribute('data-fullnm') || '';
    // فك ترميز HTML entities
    if(dataNm){
      const tmp=document.createElement('textarea');
      tmp.innerHTML=dataNm;
      dataNm=tmp.value;
    }
    it.nm = (dataNm && dataNm.trim()) || (opt.text || '').trim();
    it.price = parseFloat(opt.getAttribute('data-price') || 0);
    it.unit = opt.getAttribute('data-unit') || 'قطعة';
    // جلب بيانات إضافية من O.it
    const fullItem = (O.it || []).find(i => (i.cd || '') === opt.value);
    if (fullItem) {
      it.unit = fullItem.un || fullItem.unit || it.unit;
      it.nameEn = fullItem.nmEn || fullItem.nameEn || '';
      it.uc = fullItem.uc || 0; // تكلفة الوحدة
    }
    // تحديث الـ inputs بصرياً
    const row = sel.closest('tr');
    if (row) {
      const nmInput = row.querySelector('[data-field="nm"]');
      nmInput.value = it.nm;
      // 🆕 FIX: عرض الاسم بالكامل + tooltip (بدون قص)
      nmInput.setAttribute('title', it.nm);
      nmInput.style.direction = 'rtl';
      nmInput.style.textAlign = 'right';
      row.querySelector('[data-field="price"]').value = it.price;
    }
    this.onItemEdit(idx);
    this.recalcEditor();
  },

  onItemEdit(idx) {
    if (!this._currentInv) return;
    const row = document.querySelector(`#invoiceItemsBody tr[data-idx="${idx}"]`);
    if (!row) return;
    const it = this._currentInv.items[idx] || (this._currentInv.items[idx] = { code: '', nm: '', qty: 1, price: 0, discount: 0, tax: 0 });
    it.code = row.querySelector('[data-field="code"]')?.value || it.code;
    it.nm = row.querySelector('[data-field="nm"]').value;
    it.qty = parseFloat(row.querySelector('[data-field="qty"]').value) || 0;
    it.price = parseFloat(row.querySelector('[data-field="price"]').value) || 0;
    it.discount = parseFloat(row.querySelector('[data-field="discount"]').value) || 0;
    it.tax = parseFloat(row.querySelector('[data-field="tax"]').value) || 0;
    this.recalcEditor();
  },

  addItem() {
    if (!this._currentInv) return;
    const settings = this.getSettings();
    this._currentInv.items.push({ code: '', nm: '', qty: 1, price: 0, discount: 0, tax: settings.taxRate || 0 });
    const tbody = document.getElementById('invoiceItemsBody');
    const idx = this._currentInv.items.length - 1;
    const tr = document.createElement('tr');
    tr.setAttribute('data-idx', idx);
    tr.innerHTML = this.renderItemRow(this._currentInv.items[idx], idx).match(/<tr[^>]*>([\s\S]*)<\/tr>/)[1];
    tbody.appendChild(tr);
    // Re-render كل الـ rows للتأكد من الفهارس صحيحة
    this.editInvoiceObj(this._currentInv);
  },

  removeItem(idx) {
    if (!this._currentInv) return;
    if (this._currentInv.items.length <= 1) {
      if (typeof showToast === 'function') showToast('⚠️', 'لا يمكن حذف آخر سطر', false);
      return;
    }
    this._currentInv.items.splice(idx, 1);
    this.editInvoiceObj(this._currentInv);
  },

  onClientChange() {
    const sel = document.getElementById('inv_client');
    if (!sel) return;
    if (sel.value === '__custom__') {
      document.getElementById('inv_client_name').value = '';
      document.getElementById('inv_client_phone').value = '';
      if (this._currentInv) { this._currentInv.client = ''; this._currentInv.clientPhone = ''; }
      this.recalcEditor();
      return;
    }
    document.getElementById('inv_client_name').value = sel.value;
    const opt = sel.selectedOptions[0];
    const phone = opt ? (opt.getAttribute('data-phone') || '') : '';
    document.getElementById('inv_client_phone').value = phone;
    if (opt) {
      const vat = opt.getAttribute('data-vat') || opt.getAttribute('data-vatNo') || '';
      if (vat) {
        const vatEl = document.getElementById('inv_client_vat');
        if (vatEl) vatEl.value = vat;
        if (this._currentInv) this._currentInv.clientVat = vat;
      }
    }
    // 🆕 FIX v220.9.7: حفظ فوري في inv.client
    if (this._currentInv) {
      this._currentInv.client = sel.value;
      this._currentInv.clientPhone = phone;
    }
    this.recalcEditor();
  },

  updateStatusUI(status) {
    if (!this._currentInv) return;
    this._currentInv.status = status;
    const bar = document.querySelector('.invoice-status-bar');
    if (bar) {
      bar.className = 'invoice-status-bar ' + status;
    }
  },

  recalcEditor() {
    if (!this._currentInv) return;
    const inv = this._currentInv;
    // اجمع المدخلات العلوية
    const dtEl = document.getElementById('inv_dt');
    const dueEl = document.getElementById('inv_dueDt');
    if (dtEl) inv.dt = dtEl.value;
    if (dueEl) inv.dueDt = dueEl.value;
    const cName = document.getElementById('inv_client_name');
    if (cName) inv.client = cName.value;
    const cPhone = document.getElementById('inv_client_phone');
    if (cPhone) inv.clientPhone = cPhone.value;
    const cVat = document.getElementById('inv_client_vat');
    if (cVat) inv.clientVat = cVat.value;
    const aName = document.getElementById('inv_agent_name');
    if (aName) inv.agent = aName.value;
    const refEl = document.getElementById('inv_ref');
    if (refEl) inv.ref = refEl.value;
    const ptEl = document.getElementById('inv_paymentTerms');
    if (ptEl) inv.paymentTerms = ptEl.value;
    const nEl = document.getElementById('inv_notes');
    if (nEl) inv.notes = nEl.value;
    // إحصائيات
    const t = this.totals(inv);
    // تحديث الإجماليات في الجدول
    document.querySelectorAll('#invoiceItemsBody tr').forEach((row, idx) => {
      const it = inv.items[idx];
      if (!it) return;
      const cell = row.querySelector('[data-row-total]');
      if (cell) cell.textContent = KD(this.rowTotal(it));
    });
    // تحديث المربع
    const settings = this.getSettings();
    const totalsEl = document.getElementById('invoiceTotalsBox');
    if (totalsEl) {
      totalsEl.innerHTML = `
        <div class="invoice-total-row">
          <span class="label">الإجمالي الفرعي</span>
          <span class="value">${KD(t.subtotal)} ${settings.currency}</span>
        </div>
        ${t.totalDisc > 0 ? `
        <div class="invoice-total-row discount">
          <span class="label">الخصم على الأصناف</span>
          <span class="value">− ${KD(t.totalDisc)} ${settings.currency}</span>
        </div>` : ''}
        <div class="invoice-total-row" style="display:flex;gap:6px;align-items:center;padding-top:10px">
          <span class="label" style="flex:1">خصم إضافي شامل</span>
          <input type="number" id="inv_globalDiscount" value="${inv.globalDiscount||0}" min="0" step="0.001" style="width:100px;padding:4px;border:1px solid #ddd;border-radius:4px;font-family:inherit;font-size:13px" oninput="Invoice.onGlobalChange()">
          <span style="font-size:12px;color:#7f8c8d">${settings.currency}</span>
        </div>
        ${t.totalTax > 0 ? `
        <div class="invoice-total-row tax">
          <span class="label">الضريبة</span>
          <span class="value">${KD(t.totalTax)} ${settings.currency}</span>
        </div>` : ''}
        <div class="invoice-total-row" style="display:flex;gap:6px;align-items:center">
          <span class="label" style="flex:1">الشحن / التوصيل</span>
          <input type="number" id="inv_shipping" value="${inv.shipping||0}" min="0" step="0.001" style="width:100px;padding:4px;border:1px solid #ddd;border-radius:4px;font-family:inherit;font-size:13px" oninput="Invoice.onGlobalChange()">
          <span style="font-size:12px;color:#7f8c8d">${settings.currency}</span>
        </div>
        <div class="invoice-total-row grand">
          <span>الإجمالي النهائي</span>
          <span>${KD(t.total)} ${settings.currency}</span>
        </div>
        <div class="invoice-total-row paid-row">
          <span class="label">المدفوع</span>
          <input type="number" id="inv_paid" value="${inv.paid||0}" min="0" step="0.001" style="width:100px;padding:4px;border:1px solid #27ae60;border-radius:4px;color:#27ae60;font-weight:700;font-family:inherit;font-size:13px" oninput="Invoice.onGlobalChange()">
        </div>
        <div class="invoice-total-row due-row">
          <span class="label">المتبقي</span>
          <span class="value">${KD(t.due)} ${settings.currency}</span>
        </div>
      `;
    }
    // المبلغ بالحروف
    const awEl = document.getElementById('invoiceAmountWords');
    if (awEl) awEl.textContent = 'فقط ' + this.amountInWords(t.total);
  },

  onGlobalChange() {
    if (!this._currentInv) return;
    const gd = document.getElementById('inv_globalDiscount');
    const sh = document.getElementById('inv_shipping');
    const pd = document.getElementById('inv_paid');
    if (gd) this._currentInv.globalDiscount = parseFloat(gd.value) || 0;
    if (sh) this._currentInv.shipping = parseFloat(sh.value) || 0;
    if (pd) this._currentInv.paid = parseFloat(pd.value) || 0;
    this.recalcEditor();
  },

  saveFromEditor(andPrint) {
    if (!this._currentInv) return;
    // اجمع آخر القيم
    const inv = this._currentInv;
    inv.updatedAt = Date.now();
    if (!inv.createdAt) inv.createdAt = Date.now();
    // تحديث الحالة من القيم
    const t = this.totals(inv);
    if (inv.status !== 'draft' && inv.status !== 'issued' && inv.status !== 'overdue') {
      // auto-detect
      if (t.due <= 0) inv.status = 'paid';
      else if (t.paid > 0) inv.status = 'partial';
    }
    this.upsert(inv);

    // 🆕 نظام رسمي بالكامل: أي فاتورة تتحفظ = حركة بيع حقيقية على طول
    // (بتأثر على الرصيد والمخزون والتقارير وتتزامن مع الشيت فورًا)
    this.convertToTransaction(true);

    if (typeof showToast === 'function') {
      showToast('✅', 'تم حفظ الفاتورة ' + inv.id + ' وتسجيلها كحركة بيع', true);
    }
    if (typeof AuditLog !== 'undefined') {
      try { AuditLog.log('invoice_save', '🧾 حفظ فاتورة', { id: inv.id, total: t.total, client: inv.client, status: inv.status }); } catch(e) {}
    }
    this.renderSavedList();
    this.renderActionsBar();
    if (andPrint) setTimeout(() => this.printInvoice(), 400);
  },

  printInvoice() {
    this.saveFromEditor(false);
    window.print();
  },

  exportPDF() {
    if (typeof showToast === 'function') showToast('📄', 'افتح نافذة الطباعة واختر "حفظ كـ PDF"', true);
    setTimeout(() => window.print(), 400);
  },

  shareWhatsApp() {
    if (!this._currentInv) return;
    const inv = this._currentInv;
    const t = this.totals(inv);
    const settings = this.getSettings();
    const lines = [
      '*فاتورة ' + inv.id + '*',
      settings.companyName,
      '',
      'العميل: ' + (inv.client || '—'),
      'التاريخ: ' + inv.dt,
      'الاستحقاق: ' + inv.dueDt,
      '',
      '*الأصناف:*',
    ];
    (inv.items || []).forEach((it, i) => {
      lines.push((i+1) + '. ' + (it.nm || 'صنف') + ' × ' + it.qty + ' = ' + KD(this.rowTotal(it)) + ' ' + settings.currency);
    });
    lines.push('');
    lines.push('*الإجمالي:* ' + KD(t.total) + ' ' + settings.currency);
    if (t.paid > 0) lines.push('المدفوع: ' + KD(t.paid) + ' ' + settings.currency);
    if (t.due > 0) lines.push('*المتبقي: ' + KD(t.due) + ' ' + settings.currency + '*');
    if (inv.clientPhone) {
      const phone = inv.clientPhone.replace(/[^0-9]/g, '');
      const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(lines.join('\n'));
      window.open(url, '_blank');
    } else {
      if (typeof showToast === 'function') showToast('📱', 'لم يُدخل رقم هاتف العميل', false);
      const text = encodeURIComponent(lines.join('\n'));
      window.open('https://wa.me/?text=' + text, '_blank');
    }
  },

  convertToTransaction(silent) {
    if (!this._currentInv) return;
    const inv = this._currentInv;
    const t = this.totals(inv);
    if (!inv.client) {
      if (typeof showToast === 'function') showToast('⚠️', 'أدخل اسم العميل أولاً', false);
      return;
    }
    if (typeof O === 'undefined' || !O.tx) {
      if (typeof showToast === 'function') showToast('❌', 'نظام المعاملات غير جاهز', false);
      return;
    }
    O.tx = O.tx || [];
    // 🛡️ لو الفاتورة دي اتسجّلت كحركة قبل كده، نحدّث نفس الحركة بدل ما نكرّرها
    const existingIdx = O.tx.findIndex(x => x.invoice === inv.id);
    const tx = {
      id: existingIdx >= 0 ? O.tx[existingIdx].id : ('TX-' + Date.now()),
      dt: inv.dt,
      client: inv.client,
      cl: inv.client,
      ag: inv.agent || '',
      tp: 'sale',
      amount: t.total,
      items: inv.items.map(it => ({ nm: it.nm, qty: it.qty, price: it.price })),
      source: 'invoice',
      invoice: inv.id,
      note: 'من فاتورة ' + inv.id,
      ts: Date.now(),
      _v: (typeof SEED !== 'undefined' && SEED._v) || 'auto',
    };
    if (existingIdx >= 0) O.tx[existingIdx] = tx; else O.tx.push(tx);
    inv._postedToTx = true;
    if (typeof nayefSaveData === 'function') nayefSaveData();
    if (!silent && typeof showToast === 'function') showToast('✅', 'تم تسجيل الحركة على حساب ' + inv.client, true);
    if (typeof AuditLog !== 'undefined') {
      try { AuditLog.log('invoice_to_tx', '🧾→💼 تحويل فاتورة لحركة', { invoice: inv.id, client: inv.client, amount: t.total }); } catch(e) {}
    }
  },

  closeEditor() {
    document.getElementById('invoiceEditorSection').innerHTML = '';
  },

  // ───────── إعدادات الشركة ─────────
  openSettings() {
    const s = this.getSettings();
    const existing = document.getElementById('invoiceSettingsModal');
    if (existing) existing.remove();
    const m = document.createElement('div');
    m.id = 'invoiceSettingsModal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(10,30,56,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
    m.innerHTML = `
      <div style="background:#fff;border-radius:14px;max-width:680px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
        <div style="background:linear-gradient(135deg,#1b8a8a,#0d6868);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-size:17px">⚙️ إعدادات الفاتورة (بيانات الشركة)</h3>
          <button onclick="document.getElementById('invoiceSettingsModal').remove()" style="background:rgba(255,255,255,.2);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
        </div>
        <div style="padding:22px;display:grid;gap:14px">
          <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">اسم الشركة</span><input id="set_name" type="text" value="${s.companyName}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">الشعار (حرف أو رمز)</span><input id="set_logo" type="text" value="${s.companyLogo}" maxlength="2" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-size:24px;text-align:center;font-weight:900"></label>
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">العملة</span><input id="set_currency" type="text" value="${s.currency}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
          </div>
          <label style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:12px;font-weight:700;color:#37474f">🏷️ نوع الفاتورة</span>
            <select id="set_invoiceType" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit;font-weight:700;background:#fff">
              ${(s.invoiceTypes||[{ar:'فاتورة مبيعات',en:'Sales Invoice'}]).map(t => `<option value="${t.ar}" ${s.invoiceType===t.ar?'selected':''}>${t.icon||''} ${t.ar} — ${t.en}</option>`).join('')}
            </select>
            <span style="font-size:11px;color:#7f8c8d;margin-top:2px">اختر نوع الفاتورة من القائمة. النوع المحدد يظهر في أعلى الفاتورة.</span>
          </label>
          <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">العنوان</span><input id="set_address" type="text" value="${s.companyAddress}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">الهاتف</span><input id="set_phone" type="text" value="${s.companyPhone}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">البريد الإلكتروني</span><input id="set_email" type="text" value="${s.companyEmail}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">السجل التجاري</span><input id="set_cr" type="text" value="${s.companyCr}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">الرقم الضريبي</span><input id="set_vat" type="text" value="${s.companyVat}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
          </div>
          <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">نسبة الضريبة الافتراضية %</span><input id="set_taxRate" type="number" value="${s.taxRate}" min="0" max="100" step="0.01" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
          <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">شروط الدفع الافتراضية</span><input id="set_paymentTerms" type="text" value="${s.paymentTerms}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
          <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">معلومات الحساب البنكي</span><input id="set_bankInfo" type="text" value="${s.bankInfo}" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit"></label>
          <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700;color:#37474f">ملاحظات افتراضية</span><textarea id="set_defaultNotes" rows="3" style="padding:9px;border:1px solid #ddd;border-radius:6px;font-family:inherit">${s.defaultNotes}</textarea></label>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
            <button onclick="document.getElementById('invoiceSettingsModal').remove()" style="padding:10px 22px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إلغاء</button>
            <button onclick="Invoice.saveSettings()" style="padding:10px 24px;background:linear-gradient(135deg,#1b8a8a,#0d6868);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit">💾 حفظ الإعدادات</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(m);
  },

  saveSettings() {
    const cur = this.getSettings();
    const s = {
      companyName: document.getElementById('set_name').value,
      companyLogo: document.getElementById('set_logo').value || 'ن',
      currency: document.getElementById('set_currency').value || 'د.ك',
      companyAddress: document.getElementById('set_address').value,
      companyPhone: document.getElementById('set_phone').value,
      companyEmail: document.getElementById('set_email').value,
      companyCr: document.getElementById('set_cr').value,
      companyVat: document.getElementById('set_vat').value,
      taxRate: parseFloat(document.getElementById('set_taxRate').value) || 0,
      paymentTerms: document.getElementById('set_paymentTerms').value,
      bankInfo: document.getElementById('set_bankInfo').value,
      defaultNotes: document.getElementById('set_defaultNotes').value,
      // 🆕 v220.9.10: نوع الفاتورة
      invoiceType: document.getElementById('set_invoiceType')?.value || cur.invoiceType || 'فاتورة مبيعات',
      invoiceTypes: cur.invoiceTypes,
      companyTagline: this.getSettings().companyTagline,
      thanksMessage: this.getSettings().thanksMessage,
    };
    this.saveSettings = this.saveSettings; // ensure context
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(s));
    document.getElementById('invoiceSettingsModal').remove();
    if (typeof showToast === 'function') showToast('✅', 'تم حفظ الإعدادات', true);
    // إعادة فتح المحرر لو كان مفتوح
    if (this._currentInv) this.editInvoiceObj(this._currentInv);
  },
};

window.Invoice = Invoice;

Invoice.toggleCompact = function() {
  const cur = localStorage.getItem('nayef_invoice_compact');
  const next = cur === 'false' ? 'true' : 'false';
  localStorage.setItem('nayef_invoice_compact', next);
  if (Invoice._currentInv) {
    Invoice._currentInv._compact = next === 'true';
    Invoice.editInvoiceObj(Invoice._currentInv);
  }
  if (typeof showToast === 'function') {
    showToast('📐', next === 'true' ? 'وضع مضغوط (مثالي للطباعة)' : 'وضع موسع', true);
  }
};
window.setupCloudSyncFlow = setupCloudSyncFlow;
window.resetCloudSyncFlow = resetCloudSyncFlow;
window.cloudSyncNow = cloudSyncNow;
window.cloudEnable = cloudEnable;
window.cloudDisable = cloudDisable;
window.CloudSync = CloudSync;




// ════════════════════════════════════════════════════════════════════
// 🛡️ SELF-HEALING: Auto-migrate legacy data
// يكشف البيانات القديمة (soc.s يحوي opening) ويصلحها تلقائياً
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// 🔧 إصلاح البيانات القديمة (Force Refresh)
// يمسح localStorage ويعيد تحميل البيانات من المصدر
// ════════════════════════════════════════════════════════════════════
function nayefForceRefreshData() {
  if(!confirm('⚠️ سيتم مسح البيانات المخزنة مؤقتاً. سيتم إعادة تحميل البيانات من ملف Excel عند فتح الداشبورد. هل تريد المتابعة؟')) return;
  
  // مسح البيانات القديمة
  try {
    localStorage.removeItem('nayef_data_backup_v220_force');
    localStorage.removeItem('nayef_data_timestamp_v220_force');
    if(typeof showToast === 'function') {
      showToast('🔧 تم مسح البيانات المؤقتة. أعد رفع ملف Excel لتطبيق الإصلاحات الجديدة.', 'success', false);
    } else {
      alert('🔧 تم مسح البيانات المؤقتة. أعد رفع ملف Excel لتطبيق الإصلاحات الجديدة.');
    }
  } catch(e) {
    Logger.warn('Clear localStorage failed:', e);
  }
  
  // إعادة تحميل الصفحة
  setTimeout(() => location.reload(), 1500);
}

function nayefMigrateLegacyData(O) {
  if(!O || !O.soc) return O;
  let migrated = false;
  
  O.soc.forEach(s => {
    // إذا soc.s يحوي opening tx (له ob مخفي في s)
    if(!s.ob || s.ob === 0) {
      const openingTx = (O.tx || []).find(t => 
        (t.client === s.nm || t.cl === s.nm) && 
        (t.type === 'opening' || t.tp === 'رصيد افتتاحي' || 
         (t.tp && (t.tp.indexOf('افتتاحي') >= 0 || t.tp.indexOf('افتتاح') >= 0)))
      );
      
      if(openingTx) {
        const openingAmount = parseFloat(openingTx.amount) || parseFloat(openingTx.db) || parseFloat(openingTx.cr) || 0;
        if(openingAmount > 0 && s.s > openingAmount) {
          Logger.warn(`🔧 Auto-migrating ${s.nm}: soc.s=${s.s}, detected opening=${openingAmount}`);
          s.ob = openingAmount;
          s.s = +(s.s - openingAmount).toFixed(2);
          s.ot = +(s.ob + s.s - s.c).toFixed(2);
          // تحديث rate أيضاً
          s.rt = s.s > 0 ? +(s.c / s.s * 100).toFixed(1) : 0;
          migrated = true;
        }
      }
    }
  });
  
  if(migrated) {
    Logger.info('✅ Auto-migration completed');
  }
  return O;
}

// تشغيل تلقائي عند تحميل البيانات
if(typeof O !== 'undefined') {
  nayefMigrateLegacyData(O);
}

// 💰 حساب الرصيد الافتتاحي (قبل تاريخ البداية)
// 💰 حساب الرصيد الافتتاحي (قبل تاريخ البداية)
// 🛡️ FIX الجذري: tx فقط - لا mon.v في كشف الحساب
// mon.v (المندوب) لا يدخل في كشف الحساب نهائياً
function calculateOpeningBalance(client, fromDate) {
  if(!client || !fromDate) return 0;
  
  const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
  const allTx = (O.tx || []).filter(t => {
    const cn = t.client || t.cl;
    return cn === client.nm;
  });
  
  let opening = 0;
  
  // 1) إضافة tx.opening (صف منفصل في tx)
  const openingTx = allTx.find(t => t.type === 'opening' || t.tp === 'رصيد افتتاحي');
  if(openingTx && openingTx.dt && openingTx.dt <= fromDate) {
    const openingAmount = parseFloat(openingTx.amount) || parseFloat(openingTx.db) || parseFloat(openingTx.cr) || 0;
    const cls = classifyTransaction(openingTx.tp || openingTx.type);
    if(cls.dir === 'D') opening += openingAmount;
    else opening -= openingAmount;
  }
  
  // 2) إضافة المعاملات العادية (sales/payments) قبل fromDate
  const priorTx = allTx.filter(t => {
    return t.dt && t.dt < fromDate && t.type !== 'opening' && t.tp !== 'رصيد افتتاحي';
  });
  priorTx.forEach(t => {
    const cls = classifyTransaction(t.tp || t.type);
    const amount = parseFloat(t.amount) || parseFloat(t.amt) || parseFloat(t.db) || parseFloat(t.cr) || 0;
    if(cls.dir === 'D') opening += amount;
    else opening -= amount;
  });
  
  return Math.round(opening * 100) / 100;  // تقريب لأقرب فلس
}

// ملخص الكشف - يستخدم Ledger Engine الجديد
function renderStatementSummary(client) {
  if(!client) {
    return `
      <div class="statement-summary-card" style="--card-color:var(--tx3)">
        <div class="label">اختر عميل</div>
        <div class="value">—</div>
        <div class="sub">من القائمة أعلاه</div>
      </div>
    `;
  }
  
  const fromDate = document.getElementById('statementFromDate')?.value;
  const toDate = document.getElementById('statementToDate')?.value;
  
  // 🏛️ استخدام Ledger Engine لحساب كل شيء بشكل محاسبي صحيح
  const ledger = ledgerCompute(client, fromDate, toDate);
  const opening = ledger.opening;
  const totalDebit = ledger.totalDebit;
  const totalCredit = ledger.totalCredit;
  const closingBalance = ledger.closing;
  const totals = ledger.totals;
  const periodSales = totalDebit; // للتوافق
  const periodCollected = totalCredit;
  
  // 🛡️ FIX: استخدم tx المفصلة أولاً، وإذا غير موجودة استخدم mon
  const allTx = O.tx || [];
  const closing = closingBalance;
  
  // تنسيق الأرقام بشكل احترافي
  const fmt = (v) => typeof KD === 'function' ? KD(v) : Number(v).toLocaleString('en');
  const opSign = opening > 0 ? '+ ' : (opening < 0 ? '- ' : '');
  const clSign = closing > 0 ? '+ ' : (closing < 0 ? '- ' : '');
  
  return `
    <div class="statement-summary-card" style="--card-color:#3498db">
      <div class="label">📊 رصيد افتتاحي</div>
      <div class="value">${opSign}${fmt(Math.abs(opening))}</div>
      <div class="sub">قبل ${fromDate || 'بداية المدة'}</div>
    </div>
    <div class="statement-summary-card" style="--card-color:#c0392b">
      <div class="label">💰 إجمالي المدين</div>
      <div class="value">${fmt(periodSales)}</div>
      <div class="sub">مبيعات الفترة</div>
    </div>
    <div class="statement-summary-card" style="--card-color:#1e8449">
      <div class="label">✅ إجمالي الدائن</div>
      <div class="value">${fmt(periodCollected)}</div>
      <div class="sub">تحصيل الفترة</div>
    </div>
    <div class="statement-summary-card" style="--card-color:${closing > 0 ? '#c0392b' : '#1e8449'}">
      <div class="label">💼 رصيد ختامي</div>
      <div class="value">${clSign}${fmt(Math.abs(closingBalance))}</div>
      <div class="sub">${closingBalance > 0 ? 'مستحق على العميل' : 'العميل مسدد'}</div>
    </div>
  `;
}

// جدول المعاملات - يولّد المعاملات من البيانات الشهرية (O.mon) إن لم توجد tx مفصلة
// شريط إحصائيات أنواع الحركات
function populateStatementStats(client, totals) {
  const statsBox = document.getElementById('statementStats');
  if(!statsBox) return;
  
  if(!totals || Object.keys(totals).length === 0) {
    statsBox.innerHTML = '<div class="statement-stat-item"><span class="icon">📊</span><div><div class="value">0</div><div class="label">لا توجد حركات</div></div></div>';
    return;
  }
  
  let html = '';
  const order = ['sales', 'sales_return', 'credit_notes', 'debit_notes', 'collections', 'payments_out', 'adjustments', 'discounts', 'opening'];
  
  order.forEach(key => {
    const t = totals[key];
    if(!t || t.count === 0) return;
    const net = t.debit - t.credit;
    html += `
      <div class="statement-stat-item" style="border-right: 4px solid ${t.icon === '🧾' ? '#c0392b' : t.icon === '💵' ? '#27ae60' : t.icon === '↩️' ? '#16a085' : '#3498db'}">
        <span class="icon">${t.icon}</span>
        <div>
          <div class="value">${net.toFixed(0)}</div>
          <div class="label">${t.label} (${t.count})</div>
        </div>
      </div>
    `;
  });
  
  statsBox.innerHTML = html || '<div class="statement-stat-item"><span class="icon">📊</span><div><div class="value">0</div><div class="label">لا توجد حركات</div></div></div>';
}
window.populateStatementStats = populateStatementStats;

function renderStatementTable(client) {
  if(!client) {
    return `
      <div class="statement-empty">
        <div class="statement-empty-icon">📋</div>
        <div class="statement-empty-msg">اختر عميل لعرض كشف الحساب</div>
        <div class="statement-empty-sub">سيتم عرض جميع المعاملات مع الرصيد الجاري</div>
      </div>
    `;
  }
  
  const fromDate = document.getElementById('statementFromDate')?.value;
  const toDate = document.getElementById('statementToDate')?.value;
  const type = document.getElementById('statementType')?.value || 'all';
  
  // 📊 بناء المعاملات من O.mon (شهرية) إن لم تكن O.tx موجودة
  let transactions = [];
  
  // 1) أولوية للمعاملات المفصلة
  const allTx = (typeof window.O !== 'undefined' && window.O.tx) ? window.O.tx : [];
  // 🛡️ FIX: دعم t.client و t.cl (الحقول البديلة)
  const directTx = allTx.filter(t => {
    const clientName = t.client || t.cl;
    return clientName === client.nm;
  }).map(t => {
    // تطبيع الحقول: دعم كلا البنيتين
    const qty = parseFloat(t.qty) || parseFloat(t.q) || 0;
    const price = parseFloat(t.price) || parseFloat(t.p) || 0;
    // المبلغ الموحد: من amount، أو من db (مبيعات) أو cr (تحصيل)
    const amount = parseFloat(t.amount) || parseFloat(t.amt) || parseFloat(t.db) || parseFloat(t.cr) || 0;
    // النوع الموحد
    const type = t.type || (t.tp === 'شيك' ? 'payment' : (t.tp === 'فاتوره' || t.tp === 'رصيد افتتاحي' ? 'sale' : 'other'));
    
    // رقم الفاتورة / المرجع
    const invoice = t.invoice || String(t.ref || '').trim() || (type === 'sale' ? 'INV-' + (t.dt || '').replace(/-/g,'') : 'PAY-' + (t.dt || '').replace(/-/g,''));
    
    // البيان / الوصف = نوع الحركة + رقم الحركة
    // (لا نعرض اسم الصنف - موجود في التفاصيل)
    // 🏛️ استخدام Ledger Engine لتحديد نوع الحركة وأيقونتها ولونها
    const cls = classifyTransaction(t.tp || t.type);
    const affects = cls.affects;
    const isAuto = t._auto ? ' statement-badge--auto' : '';
    
    let item;
    if(affects === 'opening') {
      item = `<span class="statement-badge statement-badge--opening">🏁 رصيد افتتاحي</span>`;
    } else if(affects === 'sales') {
      item = `<span class="statement-badge statement-badge--sale${isAuto}">🧾 فاتورة مبيعات${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    } else if(affects === 'sales_return') {
      item = `<span class="statement-badge statement-badge--return${isAuto}">↩️ مرتجع${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    } else if(affects === 'credit_notes') {
      item = `<span class="statement-badge statement-badge--credit_note${isAuto}">📝 إشعار دائن${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    } else if(affects === 'debit_notes') {
      item = `<span class="statement-badge statement-badge--debit_note${isAuto}">📋 إشعار مدين${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    } else if(affects === 'collections') {
      item = `<span class="statement-badge statement-badge--collection${isAuto}">💵 تحصيل${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    } else if(affects === 'payments_out') {
      item = `<span class="statement-badge statement-badge--payment_out${isAuto}">💸 شيك صادر${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    } else if(affects === 'adjustments') {
      item = `<span class="statement-badge statement-badge--adjustment${isAuto}">⚖️ قيد تسوية${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    } else if(affects === 'discounts') {
      item = `<span class="statement-badge statement-badge--discount${isAuto}">🎁 خصم ممنوح${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    } else {
      item = `<span class="statement-badge${isAuto}">${cls.icon} ${cls.label}${invoice && invoice !== '—' ? ' #' + invoice : ''}</span>`;
    }
    
    // التفاصيل: الكمية والسعر فقط (لا نكرر اسم الصنف - موجود في البيان)
    let detail = '';
    const parts = [];
    if(qty > 0) {
      // تنسيق الكمية بفاصلة
      const qtyFormatted = qty % 1 === 0 ? qty.toLocaleString('en') : qty.toFixed(1);
      parts.push('الكمية: ' + qtyFormatted);
    }
    if(price > 0) {
      parts.push('السعر: ' + price.toFixed(3));
    }
    detail = parts.join(' • ');
    
    // إذا لا توجد تفاصيل (تحصيل نقدي بدون صنف)، اعرض نوع المستند
    if(!detail) {
      if(type === 'payment') detail = 'دفعة نقدية';
      else if(type === 'opening') detail = 'رصيد افتتاحي';
      else if(type === 'return') detail = 'مرتجع بضاعة';
      else detail = 'فاتورة مبيعات';
    }
    
    return {
      ...t,
      qty: qty,
      price: price,
      amount: amount,
      type: type,
      invoice: invoice,
      item: item,
      detail: detail,  // ← منطق التفاصيل المُحسَّن أعلاه
      client: client.nm,
      // للمدين والدائن
      debit: type === 'sale' ? amount : 0,
      credit: type === 'payment' ? amount : 0,
    };
  });
  
  if(directTx.length > 0) {
    // 🛡️ FIX: تصفية 'رصيد افتتاحي' + تطبيق فلتر التاريخ + فلتر النوع
    transactions = directTx.filter(t => {
      if(t.type === 'opening' || t.tp === 'رصيد افتتاحي') return false;
      // تطبيق فلتر التاريخ
      if(fromDate && t.dt && t.dt < fromDate) return false;
      if(toDate && t.dt && t.dt > toDate) return false;
      // 🆕 تطبيق فلتر نوع الحركة (إذا لم يكن 'all')
      if(type && type !== 'all') {
        const cls = classifyTransaction(t.tp || t.type);
        const typeMap = {
          'sales': 'sales',
          'payments': 'collections',
          'returns': 'sales_return',
          'credit_notes': 'credit_notes',
          'debit_notes': 'debit_notes',
          'payment_out': 'payments_out',
          'adjustments': 'adjustments',
          'discounts': 'discounts',
        };
        const expectedAffects = typeMap[type] || type;
        if(cls.affects !== expectedAffects) return false;
      }
      return true;
    });
    // 🛡️ FIX: ترتيب تصاعدي حسب التاريخ (الأقدم أولاً)
    // إذا التاريخ متساوي، نرتب حسب رقم الفاتورة تصاعدياً
    transactions.sort((a, b) => {
      const dtA = a.dt || '';
      const dtB = b.dt || '';
      if(dtA !== dtB) return dtA.localeCompare(dtB);
      // نفس التاريخ - رتب حسب رقم الفاتورة
      const invA = String(a.invoice || a.ref || '');
      const invB = String(b.invoice || b.ref || '');
      // مقارنة رقمية إن أمكن
      const numA = parseInt(invA);
      const numB = parseInt(invB);
      if(!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return invA.localeCompare(invB);
    });
  } else {
    // 2) توليد من البيانات الشهرية
    const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
    const mon = O.mon || [];
    const ml = O.ml || [];
    const mk = O.mk || [];
    
    // ابحث عن العميل في mon
    const clientMon = mon.find(m => m.nm === client.nm);
    if(clientMon && (clientMon.v || clientMon.c)) {
      // ولّد معاملة لكل شهر
      const monthsData = clientMon.v || [];
      const collectionsData = clientMon.c || [];
      
      // تحويل mk إلى تواريخ تقريبية (مثلاً: 2026-01)
      const getMonthDate = (k) => {
        if(mk && mk[k]) {
          // mk هو 'YYYY-MM'
          const [y, m] = mk[k].split('-');
          return `${y}-${m}-15`; // منتصف الشهر
        }
        // fallback: استخدم اسم الشهر + السنة الحالية
        if(ml && ml[k]) {
          const months = {'يناير':1,'فبراير':2,'مارس':3,'أبريل':4,'مايو':5,'يونيو':6,'يوليو':7,'أغسطس':8,'سبتمبر':9,'أكتوبر':10,'نوفمبر':11,'ديسمبر':12};
          const m = months[ml[k]] || (k+1);
          return `2026-${String(m).padStart(2,'0')}-15`;
        }
        return null;
      };
      
      // حساب عدد معاملات الفترة للعميل (لإضافة تفاصيل)
      const clientTx = (O.tx || []).filter(t => (t.client || t.cl) === client.nm);
      
      monthsData.forEach((sales, k) => {
        const salesAmount = parseFloat(sales) || 0;
        const collAmount = parseFloat(collectionsData[k]) || 0;
        const date = getMonthDate(k);
        if(!date) return;
        
        // تصفية بالتاريخ
        if(fromDate && date < fromDate) return;
        if(toDate && date > toDate) return;
        
        // عدد معاملات هذا الشهر (لإضافة تفاصيل)
        const monthTx = clientTx.filter(t => t.dt && t.dt.startsWith(mk[k] || ''));
        const txCount = monthTx.length;
        const itemsSet = new Set(monthTx.map(t => t.item).filter(Boolean));
        const itemsCount = itemsSet.size;
        
        // تنسيق التاريخ بالعربي
        const [yy, mm] = (mk[k] || '2026-01').split('-');
        const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        const monthName = monthsAr[parseInt(mm) - 1] || ml[k] || mm;
        
        // إضافة المبيعات (مدين) مع تفاصيل
        if(salesAmount > 0 && (type === 'all' || type === 'sales')) {
          const detail = txCount > 0 
            ? `${txCount} عملية` 
            : 'مبيعات شهرية';
          transactions.push({
            dt: date,
            amount: salesAmount,
            type: 'sale',
            invoice: 'INV-' + String(k+1).padStart(4, '0'),
            item: `مبيعات ${monthName} ${yy}`,
            detail: detail,
            month: mk[k],
            monthName: monthName,
            year: yy,
            txCount: txCount,
            itemsCount: itemsCount,
          });
        }
        // إضافة التحصيل (دائن) مع تفاصيل
        if(collAmount > 0 && (type === 'all' || type === 'payments')) {
          const detail = txCount > 0 
            ? `${txCount} دفعة` 
            : 'تحصيل شهري';
          transactions.push({
            dt: date,
            amount: collAmount,
            type: 'payment',
            invoice: 'PAY-' + String(k+1).padStart(4, '0'),
            item: `تحصيل ${monthName} ${yy}`,
            detail: detail,
            month: mk[k],
            monthName: monthName,
            year: yy,
            txCount: txCount,
            itemsCount: itemsCount,
          });
        }
      });
      
      // ترتيب حسب التاريخ
      transactions.sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
    }
  }
  
  if(transactions.length === 0) {
    // حتى لو لم توجد معاملات في الفترة، نعرض الرصيد الافتتاحي
    const openingFromDate = document.getElementById('statementFromDate')?.value;
    const opening = calculateOpeningBalance(client, openingFromDate);
    if(opening !== 0) {
      const fmtBalance = typeof KD === 'function' ? KD(Math.abs(opening)) : Math.abs(opening).toLocaleString('en', {minimumFractionDigits: 3});
      const signClass = opening > 0 ? 'balance-debit' : 'balance-credit';
      const signSymbol = opening > 0 ? '+' : '−';
      return `
        <table class="statement-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>رقم الفاتورة</th>
              <th>البيان</th>
              <th>مدين</th>
              <th>دائن</th>
              <th>الرصيد</th>
            </tr>
          </thead>
          <tbody>
            <tr class="statement-opening-row">
              <td class="col-date">—</td>
              <td class="col-invoice">—</td>
              <td class="col-desc">💼 رصيد افتتاحي (ما قبل ${openingFromDate || 'الفترة'})</td>
              <td class="col-debit">—</td>
              <td class="col-credit">—</td>
              <td class="col-balance ${signClass}">${signSymbol} ${fmtBalance}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:center">الإجمالي</td>
              <td>0.000</td>
              <td>0.000</td>
              <td class="col-balance ${signClass}">${signSymbol} ${fmtBalance}</td>
            </tr>
          </tfoot>
        </table>
      `;
    }
    return `
      <div class="statement-empty">
        <div class="statement-empty-icon">📭</div>
        <div class="statement-empty-msg">لا توجد معاملات في هذه الفترة</div>
        <div class="statement-empty-sub">جرّب توسيع نطاق التاريخ أو اختر عميل آخر</div>
      </div>
    `;
  }
  
  // حساب الرصيد الجاري
  // نبدأ بالرصيد الافتتاحي (ما قبل تاريخ البداية)
  let balance = calculateOpeningBalance(client, fromDate);
  let totalDebit = 0, totalCredit = 0;
  
  // صف الرصيد الافتتاحي
  let openingRow = '';
  if(balance !== 0) {
    const fmtBalance = typeof KD === 'function' ? KD(Math.abs(balance)) : Math.abs(balance).toLocaleString('en', {minimumFractionDigits: 3});
    const signClass = balance > 0 ? 'balance-debit' : 'balance-credit';
    const signSymbol = balance > 0 ? '+' : '−';
    openingRow = `
      <tr class="statement-opening-row">
        <td class="col-date">—</td>
        <td class="col-invoice">—</td>
        <td class="col-desc">💼 رصيد افتتاحي (ما قبل ${fromDate || 'بداية الفترة'})</td>
        <td class="col-detail">—</td>
        <td class="col-debit">—</td>
        <td class="col-credit">—</td>
        <td class="col-balance ${signClass}">${signSymbol} ${fmtBalance}</td>
      </tr>
    `;
  }
  
  const rows = transactions.map((t, i) => {
    const amount = parseFloat(t.amount) || 0;
    let debit = 0, credit = 0;
    
    // 🏛️ استخدام Ledger Engine لتحديد مدين/دائن
    const cls = classifyTransaction(t.tp || t.type);
    if(cls.dir === 'C') {
      credit = amount;
      balance -= amount;
      totalCredit += amount;
    } else {
      debit = amount;
      balance += amount;
      totalDebit += amount;
    }
    
    // تنسيق الرصيد بطريقة احترافية
    const absBalance = Math.abs(balance);
    const fmtBalance = typeof KD === 'function' ? KD(absBalance) : absBalance.toLocaleString('en', {minimumFractionDigits: 3, maximumFractionDigits: 3});
    const signClass = balance > 0 ? 'balance-debit' : (balance < 0 ? 'balance-credit' : 'balance-zero');
    const signSymbol = balance > 0 ? '+' : (balance < 0 ? '−' : '');
    
    return `
      <tr>
        <td class="col-date">${t.dt || '—'}</td>
        <td class="col-invoice">${t.invoice || ('TX-' + String(i+1).padStart(4, '0'))}</td>
        <td class="col-desc"><strong>${t.item || 'معاملة'}</strong></td>
        <td class="col-detail"><span class="detail-qty">${t.detail || '—'}</span></td>
        <td class="col-debit">${debit > 0 ? (typeof KD === 'function' ? KD(debit) : debit.toFixed(3)) : '—'}</td>
        <td class="col-credit">${credit > 0 ? (typeof KD === 'function' ? KD(credit) : credit.toFixed(3)) : '—'}</td>
        <td class="col-balance ${signClass}">${signSymbol} ${fmtBalance}</td>
      </tr>
    `;
  }).join('');
  
  const finalBalance = balance;
  
  return `
    <table class="statement-table">
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>رقم المستند</th>
          <th>البيان</th>
          <th>📋 تفاصيل</th>
          <th>مدين</th>
          <th>دائن</th>
          <th>الرصيد</th>
        </tr>
      </thead>
      <tbody>${openingRow}${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:center">الإجمالي (${transactions.length} معاملة)</td>
          <td>${typeof KD === 'function' ? KD(totalDebit) : totalDebit.toFixed(3)}</td>
          <td>${typeof KD === 'function' ? KD(totalCredit) : totalCredit.toFixed(3)}</td>
          <td class="col-balance ${finalBalance > 0 ? 'balance-debit' : 'balance-credit'}">${finalBalance > 0 ? '+' : '−'} ${typeof KD === 'function' ? KD(Math.abs(finalBalance)) : Math.abs(finalBalance).toLocaleString('en', {minimumFractionDigits: 3})}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

// تحديث الصفحة
function renderStatement() {
  // 🛡️ FIX v180: تحديث التواريخ بناءً على فلتر "تطبيق" العلوي (إن تغيّر)
  // (يُستدعى من statementClient onchange لكن الفلتر العلوي قد يتغيّر بين الفترات)
  try {
    if(typeof _filterA !== 'undefined' && typeof O !== 'undefined' && O.ml && O.ml.length > 0) {
      const fa = document.getElementById('statementFromDate');
      const fb = document.getElementById('statementToDate');
      if(fa && fb && !fa.dataset.userEdited && !fb.dataset.userEdited) {
        fa.value = O.ml[_filterA] + '-01';
        const lastMonthDate = new Date(O.ml[_filterB] + '-01');
        lastMonthDate.setMonth(lastMonthDate.getMonth() + 1);
        lastMonthDate.setDate(0);
        fb.value = lastMonthDate.toISOString().slice(0, 10);
      }
    }
  } catch(e) {}

  const idx = parseInt(document.getElementById('statementClient')?.value);
  if(isNaN(idx)) {
    document.getElementById('statementSummary').innerHTML = renderStatementSummary(null);
    document.getElementById('statementTableWrap').innerHTML = renderStatementTable(null);
    document.getElementById('clientName').textContent = '—';
    document.getElementById('clientAgent').textContent = '—';
    document.getElementById('clientId').textContent = '—';
    document.getElementById('clientStatus').textContent = '—';
    return;
  }
  
  const S = (typeof D !== 'undefined' && D.soc) ? D.soc : ((typeof window.O !== 'undefined' && window.O.soc) ? window.O.soc : []);
  const client = S[idx];
  if(!client) return;
  
  // تحديث معلومات العميل
  document.getElementById('clientName').textContent = client.nm || '—';
  // 🆕 v220.1+: استخدم المندوب المختار من الـ dropdown (الذي يقرأ من شيت المناديب حسب الفترة)
  // بدلاً من client.ag الثابت - لضمان التطابق بين البطاقتين
  const agentSel = document.getElementById('statementAgent');
  let agentToShow = client.ag || 'غير محدد';
  if(agentSel && agentSel.value && agentSel.value !== '') {
    // المستخدم اختار مندوباً محدداً من الـ dropdown
    agentToShow = agentSel.value;
  } else {
    // لم يختر - استخدم getAgentForPeriod حسب الفترة
    const fromD = document.getElementById('statementFromDate')?.value || '';
    const toD = document.getElementById('statementToDate')?.value || '';
    const fromM = fromD ? fromD.slice(0, 7) : '';
    const toM = toD ? toD.slice(0, 7) : '';
    if(typeof getAgentForPeriod === 'function') {
      const periodAgent = getAgentForPeriod(client.nm, fromM, toM);
      if(periodAgent) agentToShow = periodAgent;
    }
  }
  document.getElementById('clientAgent').textContent = agentToShow;
  document.getElementById('clientId').textContent = client.id ? ('#' + client.id) : ('#' + (idx + 1));
  
  // 🛡️ FIX: استخدم الرصيد الفعلي (المُحسَب) وليس client.ot المخزن
  // لأن الرصيد قد يتغير بسبب الفترة المختارة
  const fromDate = document.getElementById('statementFromDate')?.value;
  const toDate = document.getElementById('statementToDate')?.value;
  
  // حساب سريع للرصيد الختامي للفترة المختارة
  let closingForStatus = client.ot || 0;
  try {
    // استخدم calculateOpeningBalance + period sales/collected من tx
    const ob = calculateOpeningBalance(client, fromDate);
    let ps = 0, pc = 0;
    const allTx = (window.O?.tx || []).filter(t => {
      const cn = t.client || t.cl;
      return cn === client.nm;
    }).filter(t => t.type !== 'opening' && t.tp !== 'رصيد افتتاحي');
    
    allTx.forEach(t => {
      if(!t.dt) return;
      if(fromDate && t.dt < fromDate) return;
      if(toDate && t.dt > toDate) return;
      const amount = parseFloat(t.amount) || parseFloat(t.amt) || parseFloat(t.db) || parseFloat(t.cr) || 0;
      const type = t.type || (t.tp === 'شيك' ? 'payment' : 'sale');
      if(type === 'payment') pc += amount;
      else ps += amount;
    });
    closingForStatus = ob + ps - pc;
  } catch(e) {
    closingForStatus = client.ot || 0;
  }
  
  const status = closingForStatus > 5000 ? '🔴 متأخر' : (closingForStatus > 0 ? '🟡 له رصيد' : '🟢 مسدد');
  document.getElementById('clientStatus').textContent = status;
  
  // تحديث التاريخ ورقم المرجع
  // 🛡️ FIX: استخدم toDate (آخر يوم في الفترة) بدلاً من today
  const toDateValue = toDate || ((typeof DashboardConfig !== 'undefined') ? DashboardConfig.getAsOfDate() : new Date());
  const dateObj = (toDateValue instanceof Date) ? toDateValue : new Date(toDateValue);
  document.getElementById('statementDate').textContent = 'حتى تاريخ: ' + dateObj.toLocaleDateString('ar-KW');
  document.getElementById('statementRef').textContent = 'REF: STMT-' + Date.now().toString(36).toUpperCase();
  
  // إعادة رسم الملخص والجدول
  document.getElementById('statementSummary').innerHTML = renderStatementSummary(client);
  document.getElementById('statementTableWrap').innerHTML = renderStatementTable(client);
  
  // 🏛️ إضافة شريط الإحصائيات
  try {
    const fromDateS = document.getElementById('statementFromDate')?.value;
    const toDateS = document.getElementById('statementToDate')?.value;
    const ledger = ledgerCompute(client, fromDateS, toDateS);
    populateStatementStats(client, ledger.totals);
  } catch(e) {
    Logger.warn('⚠️ إحصائيات:', e.message);
  }
}

// إعادة تعيين

// ════════════════════════════════════════════════════════════════
// 🆕 v220.1+: تفاعل ذكي بين dropdown العميل والمندوب
// ════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 🆕 v220.1+: قراءة اسم المندوب حسب الفترة المختارة من شيت المناديب
// ═══════════════════════════════════════════════════════════════
window.getAgentForPeriod = function(clientName, fromMonth, toMonth) {
  if(!clientName) return '';
  // 1) الإعداد الافتراضي: المندوب الثابت من بيانات العميل
  const soc = (typeof O !== "undefined" && O.soc) ? O.soc.find(s => s.nm === clientName) : null;
  const defaultAgent = (soc && soc.ag) ? soc.ag : '';
  
  if(typeof O === "undefined") return defaultAgent;
  
  // 2) البحث في agentSummary: يربط المندوب بالفترة (achieved في فترة معينة)
  // agentSummary يحوي: nm, target, achieved, pct, surplus
  // لكن لا يحوي فترة، لذا نستخدم الفترة لمعرفة أي المناديب نشط في تلك الفترة
  const summary = O.agentSummary || [];
  
  // 3) البحث في agentMovement: يربط المندوب بالفترة عبر المبيعات (tx)
  // ابحث عن معاملات هذا العميل في الفترة المحددة، واستخرج اسم المندوب
  if(O.tx && O.tx.length > 0) {
    const clientTxs = O.tx.filter(t => {
      const cn = t.client || t.cl;
      if(cn !== clientName) return false;
      if(!t.dt) return false;
      const txMonth = t.dt.slice(0, 7);
      if(fromMonth && txMonth < fromMonth) return false;
      if(toMonth && txMonth > toMonth) return false;
      return true;
    });
    if(clientTxs.length > 0) {
      // اجمع المناديب من المعاملات
      const agents = {};
      clientTxs.forEach(t => {
        if(t.ag && t.ag !== 'إدخال يدوي') {
          agents[t.ag] = (agents[t.ag] || 0) + 1;
        }
      });
      // اختر المندوب الأكثر تكراراً في تلك الفترة
      const agentNames = Object.keys(agents);
      if(agentNames.length > 0) {
        const topAgent = agentNames.sort((a, b) => agents[b] - agents[a])[0];
        return topAgent;
      }
    }
  }
  
  // 4) fallback: agentSummary - ابحث عن مندوب حقق مبيعات قريبة من مبيعات العميل
  // (نستخدم هذا إذا لم نجد في tx)
  if(summary.length > 0) {
    // إذا كان المندوب الثابت موجود في الملخص، استخدمه
    if(defaultAgent) {
      const found = summary.find(s => s.nm === defaultAgent);
      if(found && (found.achieved || 0) > 0) {
        return defaultAgent;
      }
    }
  }
  
  // 5) Fallback نهائي: المندوب الثابت من s.ag
  return defaultAgent;
}

// قائمة المناديب النشطين في فترة معينة
window.getActiveAgentsForPeriod = function(fromMonth, toMonth) {
  const summary = (typeof O !== "undefined" && O.agentSummary) ? O.agentSummary : [];
  const movement = (typeof O !== "undefined" && O.agentMovement) ? O.agentMovement : [];
  
  // ابدأ بـ agentSummary (فيه achieved per period)
  const activeFromSummary = summary
    .filter(s => (s.achieved || 0) > 0)
    .map(s => s.nm || s.agent);
  
  // أضف من agentMovement
  const activeFromMovement = movement
    .filter(m => (m.visits || 0) > 0 || (m.orders || 0) > 0)
    .map(m => m.agent);
  
  // دمج وفلترة بناءً على tx في الفترة
  const allAgents = new Set([...activeFromSummary, ...activeFromMovement]);
  if(O && O.tx) {
    const txAgents = new Set();
    O.tx.forEach(t => {
      if(!t.dt) return;
      const txMonth = t.dt.slice(0, 7);
      if(fromMonth && txMonth < fromMonth) return;
      if(toMonth && txMonth > toMonth) return;
      if(t.ag) txAgents.add(t.ag);
    });
    // أضف مناديب من tx
    txAgents.forEach(a => allAgents.add(a));
  }
  
  return Array.from(allAgents).filter(Boolean).sort();
}


window.onClientChange = function() {
  const clientSel = document.getElementById('statementClient');
  const agentSel = document.getElementById('statementAgent');
  if(!clientSel || !agentSel) return;
  const selectedOption = clientSel.options[clientSel.selectedIndex];
  if(!selectedOption) return;
  // 🆕 v220.1+: قراءة اسم المندوب من شيت المناديب حسب الفترة المختارة
  const clientName = selectedOption.text || '';
  const fromDate = (document.getElementById('statementFromDate') || {}).value || '';
  const toDate = (document.getElementById('statementToDate') || {}).value || '';
  const fromMonth = fromDate ? fromDate.slice(0, 7) : '';
  const toMonth = toDate ? toDate.slice(0, 7) : '';
  // قراءة من شيت المناديب حسب الفترة
  const agent = (typeof getAgentForPeriod === "function") 
    ? getAgentForPeriod(clientName, fromMonth, toMonth) 
    : (selectedOption.getAttribute('data-agent') || '');
  // اختيار المندوب تلقائياً
  if(agent) {
    let found = false;
    for(let i = 0; i < agentSel.options.length; i++) {
      if(agentSel.options[i].value === agent) {
        agentSel.value = agent;
        found = true;
        break;
      }
    }
    if(!found) {
      const newOpt = document.createElement('option');
      newOpt.value = agent;
      newOpt.textContent = agent + ' (من الفترة)';
      agentSel.appendChild(newOpt);
      agentSel.value = agent;
    }
  } else {
    agentSel.value = '';
  }
  if(typeof renderStatement === 'function') renderStatement();
};

window.onAgentChange = function() {
  const clientSel = document.getElementById('statementClient');
  const agentSel = document.getElementById('statementAgent');
  if(!clientSel || !agentSel) return;
  const selectedAgent = agentSel.value;
  if(!selectedAgent) {
    // عند اختيار "الكل"، نظهر كل العملاء
    if(typeof renderStatement === 'function') renderStatement();
    return;
  }
  // 🆕 تصفية العملاء حسب المندوب المختار
  const clients = (typeof D !== 'undefined' && D.soc) ? D.soc : (typeof O !== 'undefined' && O.soc ? O.soc : []);
  const filtered = clients.filter(c => c.ag === selectedAgent);
  // ابحث عن أول عميل من هذا المندوب واختره تلقائياً
  if(filtered.length > 0) {
    const firstClient = filtered[0];
    const idx = clients.findIndex(c => c.nm === firstClient.nm);
    if(idx >= 0) {
      clientSel.value = idx;
    }
  } else {
    clientSel.value = '';
  }
  if(typeof renderStatement === 'function') renderStatement();
};


function resetStatement() {
  document.getElementById('statementClient').value = '';
  const today = (typeof DashboardConfig !== 'undefined') ? DashboardConfig.getAsOfDate() : new Date();
  const fromDate = new Date(today);
  fromDate.setFullYear(fromDate.getFullYear() - 1);
  document.getElementById('statementFromDate').value = fromDate.toISOString().slice(0, 10);
  document.getElementById('statementToDate').value = today.toISOString().slice(0, 10);
  document.getElementById('statementType').value = 'all';
  renderStatement();
}

// طباعة
// فلتر سريع
function setQuickFilter(type) {
  const sel = document.querySelector('#statementType');
  if(sel) {
    sel.value = type;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
window.setQuickFilter = setQuickFilter;

// 🖨️ تبديل وضع معاينة الطباعة
function togglePrintPreview() {
  const isActive = document.body.classList.toggle('printing-statement');
  if(isActive) {
    if(typeof showToast === 'function') showToast('🖨️ وضع المعاينة - اضغط Escape للخروج', '', false);
    window.scrollTo(0, 0);
  }
}
window.togglePrintPreview = togglePrintPreview;

function printStatement() {
  // 🎨 قبل الطباعة، نُضيف class خاص للـ body لتحسين العرض
  document.body.classList.add('printing-statement');
  
  // نطبع اسم العميل في الـ header
  const idx = parseInt(document.getElementById('statementClient')?.value);
  if(!isNaN(idx)) {
    const S = (typeof D !== 'undefined' && D.soc) ? D.soc : ((typeof window.O !== 'undefined' && window.O.soc) ? window.O.soc : []);
    const client = S[idx];
    if(client) {
      const titleEl = document.getElementById('pageTitle');
      if(titleEl) titleEl.textContent = `كشف حساب: ${client.nm}`;
    }
  }
  
  setTimeout(() => window.print(), 100);
  setTimeout(() => {
    document.body.classList.remove('printing-statement');
    const titleEl = document.getElementById('pageTitle');
    if(titleEl) titleEl.textContent = 'كشف حساب';
  }, 1000);
}

// تصدير PDF (يستخدم نفس وظيفة الطباعة للحفظ كـ PDF)
function exportStatementPDF() {
  if(typeof showToast === 'function') {
    showToast('💡 استخدم طباعة المتصفح → حفظ كـ PDF', '', false);
  }
  setTimeout(() => window.print(), 500);
}

// تصدير Excel
function exportStatementExcel() {
  try {
    const idx = parseInt(document.getElementById('statementClient')?.value);
    if(isNaN(idx)) {
      if(typeof showToast === 'function') showToast('⚠️ اختر عميل أولاً', '', true);
      return;
    }
    
    const S = (typeof D !== 'undefined' && D.soc) ? D.soc : ((typeof window.O !== 'undefined' && window.O.soc) ? window.O.soc : []);
    const client = S[idx];
    if(!client) return;
    
    const allTx = (typeof window.O !== 'undefined' && window.O.tx) ? window.O.tx : [];
    const fromDate = document.getElementById('statementFromDate')?.value;
    const toDate = document.getElementById('statementToDate')?.value;
    
    let tx = allTx.filter(t => t.client === client.nm);
    if(fromDate) tx = tx.filter(t => t.dt >= fromDate);
    if(toDate) tx = tx.filter(t => t.dt <= toDate);
    
    // بناء CSV
    let csv = 'التاريخ,رقم الفاتورة,البيان,مدين,دائن,الرصيد\n';
    let balance = 0;
    tx.forEach((t, i) => {
      const amount = parseFloat(t.amount) || 0;
      balance += amount;
      csv += `${t.dt || ''},${t.invoice || 'TX-' + (i+1)},${t.item || 'مبيعات'},${amount},0,${balance}\n`;
    });
    
    // تنزيل
    const blob = new Blob(['\ufeff' + csv], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف_حساب_${client.nm || 'عميل'}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    if(typeof showToast === 'function') showToast('✅ تم تصدير الكشف', '', false);
    if(typeof AuditLog !== 'undefined') AuditLog.log('export', '📊 تصدير كشف حساب', { client: client.nm });
  } catch(e) {
    Logger.error('exportStatementExcel:', e);
    if(typeof showToast === 'function') showToast('❌ خطأ في التصدير', '', true);
  }
}

// ربط الصفحة
window.pageStatement = pageStatement;
window.renderStatement = renderStatement;
window.resetStatement = resetStatement;
window.printStatement = printStatement;
window.exportStatementPDF = exportStatementPDF;
window.exportStatementExcel = exportStatementExcel;



// ════════════════════════════════════════════════════════════════════════
// 🔄 v160: resetToSeed + diagnoseData - الحد الأدنى بدون IIFE جديد
// ════════════════════════════════════════════════════════════════════════
async function resetToSeed() {
  if(typeof SafeConfirm !== 'undefined') {
    const confirmed = await SafeConfirm.confirmDestructive('🔄 إعادة تعيين البيانات', {
      keyword: 'إعادة تعيين',
      description: 'سيتم حذف البيانات المحفوظة والعودة للبيانات التجريبية المدمجة.',
      affectedItems: 'nayef_dash_seed',
      countdownSeconds: 3
    });
    if(!confirmed) return;
  } else if(!confirm('سيتم حذف البيانات المحفوظة. متأكد؟')) return;
  
  try {
    localStorage.removeItem('nayef_dash_seed');
    sessionStorage.removeItem('nayef_excel_file');
    if(typeof _lastFname !== 'undefined') _lastFname = '';
    if(typeof showToast === 'function') showToast('✅ تم إعادة التعيين', 'جاري إعادة التحميل...', false);
    setTimeout(() => location.reload(true), 800);
  } catch(e) {
    if(typeof showToast === 'function') showToast('❌ فشل', e.message, true);
  }
}

function diagnoseData() {
  const lines = [];
  lines.push('═══════════════════════════════════════════');
  lines.push('🔍 فحص البيانات - ' + new Date().toLocaleString('ar-KW'));
  lines.push('═══════════════════════════════════════════');
  
  const O = window.O || {};
  const D = window.D || {};
  
  lines.push('window.O موجود: ' + !!window.O);
  lines.push('window.D موجود: ' + !!window.D);
  lines.push('');
  lines.push('--- O.soc ---');
  lines.push('العدد: ' + (O.soc ? O.soc.length : 0));
  if(O.soc && O.soc.length > 0) {
    lines.push('العينة الأولى: ' + JSON.stringify(O.soc[0]).substring(0, 200));
  }
  lines.push('');
  lines.push('--- O.tx ---');
  lines.push('العدد: ' + (O.tx ? O.tx.length : 0));
  if(O.tx && O.tx.length > 0) {
    lines.push('العينة الأولى: ' + JSON.stringify(O.tx[0]).substring(0, 200));
    // التحقق من شكل البيانات
    const tpTypes = {};
    O.tx.forEach(t => {
      const k = JSON.stringify(Object.keys(t).sort());
      tpTypes[k] = (tpTypes[k] || 0) + 1;
    });
    lines.push('أن tx keys: ' + JSON.stringify(tpTypes));
  }
  lines.push('');
  lines.push('--- O.mon ---');
  lines.push('العدد: ' + (O.mon ? O.mon.length : 0));
  if(O.mon && O.mon.length > 0) {
    lines.push('العينة: ' + JSON.stringify(O.mon[0]).substring(0, 200));
  }
  lines.push('');
  lines.push('--- O.T ---');
  lines.push(JSON.stringify(O.T));
  lines.push('');
  lines.push('--- localStorage ---');
  try {
    const saved = localStorage.getItem('nayef_dash_seed');
    if(saved) {
      const p = JSON.parse(saved);
      lines.push('محفوظ: نعم');
      lines.push('fname: ' + (p.fname || '(فارغ)'));
      lines.push('ts: ' + (p.ts ? new Date(p.ts).toLocaleString('ar-KW') : '(فارغ)'));
      if(p.seed) {
        lines.push('seed.soc.length: ' + (p.seed.soc ? p.seed.soc.length : 0));
        lines.push('seed.tx.length: ' + (p.seed.tx ? p.seed.tx.length : 0));
        lines.push('seed._v: ' + (p.seed._v || '(فارغ)'));
      }
    } else {
      lines.push('محفوظ: لا');
    }
  } catch(e) {
    lines.push('خطأ في قراءة localStorage: ' + e.message);
  }
  
  // فتح modal
  const existing = document.getElementById('diagModal');
  if(existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'diagModal';
  modal.style.cssText = 'position:fixed;top:5%;left:5%;right:5%;bottom:5%;background:#1a1a1a;border:3px solid #8e44ad;border-radius:14px;padding:0;z-index:999999;overflow:hidden;font-family:monospace;box-shadow:0 10px 50px rgba(0,0,0,0.4);display:flex;flex-direction:column';
  
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:linear-gradient(135deg,#8e44ad,#6c3483);color:#fff;font-family:Tajawal,sans-serif';
  header.innerHTML = '<div style="font-size:18px;font-weight:800">🔍 فحص البيانات</div><button onclick="document.getElementById(\'diagModal\').remove()" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;font-family:Tajawal,sans-serif">✕ إغلاق</button>';
  
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow:auto;padding:20px;background:#1a1a1a;color:#0f0;font-family:monospace;font-size:13px;direction:ltr;text-align:left;white-space:pre';
  body.textContent = lines.join('\n');
  
  modal.appendChild(header);
  modal.appendChild(body);
  document.body.appendChild(modal);
  
  Logger.info(lines.join('\n'));
}

window.resetToSeed = resetToSeed;
window.diagnoseData = diagnoseData;

})();
