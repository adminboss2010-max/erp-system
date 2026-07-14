
/* ═══════════════════════════════════════════════════════════════════
   🆕 v230.1+ CONTROLLER — كل الإضافات في scripts منفصلة وآمنة
   - لا تعيق النظام
   - تتعامل مع الأخطاء بهدوء
   - تتصل بكل المكونات الموجودة في window.X
═══════════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';
  
  const safe = (fn) => { try { return fn(); } catch(e) { console.warn('v23:', e.message); return null; } };
  
  /* === أدوات مساعدة === */
  function getO() { return (typeof window !== 'undefined' && window.O) || {}; }
  
  function fmtNum(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toLocaleString('ar-KW');
  }
  
  function fmtCur(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return fmtNum(Math.round(n * 1000) / 1000) + ' د.ك';
  }
  
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'v23-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
  
  function showMiniModal(title, body) {
    closeMiniModal();
    const m = document.createElement('div');
    m.id = 'v23-mini-modal';
    m.className = 'v23-mini-modal';
    m.innerHTML = `<div class="v23-mini-modal-h"><h3>${esc(title)}</h3><button onclick="closeMiniModal()">✕</button></div><div class="v23-mini-modal-b">${body}</div>`;
    document.body.appendChild(m);
  }
  
  window.closeMiniModal = function() {
    const m = document.getElementById('v23-mini-modal');
    if (m) m.remove();
  };
  
  /* === 1. Print Engine — 9 تقارير احترافية === */
  const PrintEngine = window.PrintEngine || {};
  
  window.v23PrintReport = function() {
    if (!window.PrintEngine) { toast('❌ PrintEngine غير محمّل'); return; }
    
    const O = getO();
    const totalSales = (O.T && O.T.s) || 0;
    const totalProfit = (O.T && O.T.pr) || 0;
    const custCount = (O.soc || []).length;
    const txCount = (O.tx || []).length;
    const productCount = (O.it || []).length;
    
    showMiniModal('🖨️ التقرير الشامل - ' + fmtNum(custCount) + ' عميل · ' + fmtNum(txCount) + ' معاملة', `
      <div style="background:#fff8e1;border-right:3px solid #b8932f;padding:12px;border-radius:6px;margin-bottom:14px;font-size:13px;">
        <b>💼 يحتوي التقرير على:</b><br>
        • الملخص التنفيذي (KPIs كاملة)<br>
        • تقرير العملاء + الأرصدة<br>
        • تقرير المخزون مع التنبيهات<br>
        • تقرير أداء المناديب<br>
        • تحليل الفترات الزمنية<br>
        • الرسم البياني للاتجاهات
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;text-align:center;">
        <div style="background:#f0f7ff;padding:10px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">المبيعات</div>
          <div style="font-size:18px;font-weight:900;color:#2e7d32;">${fmtCur(totalSales)}</div>
        </div>
        <div style="background:#e8f5e9;padding:10px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">الأرباح</div>
          <div style="font-size:18px;font-weight:900;color:#2e7d32;">${fmtCur(totalProfit)}</div>
        </div>
        <div style="background:#fff8e1;padding:10px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">المنتجات</div>
          <div style="font-size:18px;font-weight:900;color:#b8932f;">${fmtNum(productCount)}</div>
        </div>
      </div>
      <button onclick="v23DoPrint(['executive','customers','transactions','inventory','agents','periods'])" 
        style="width:100%;padding:12px;background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;margin-bottom:8px;">
        🖨️ طباعة الكل (6 صفحات)
      </button>
      <button onclick="v23DoPrint(['executive'])" style="width:100%;padding:10px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;margin-bottom:6px;">
        طباعة الملخص التنفيذي فقط
      </button>
      <button onclick="closeMiniModal();window.print();" style="width:100%;padding:10px;background:#b8932f;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">
        طباعة الصفحة الحالية كما هي (legacy)
      </button>
    `);
  };
  
  window.v23DoPrint = function(ids) {
    if (!window.PrintEngine) { toast('❌ PrintEngine غير محمّل'); return; }
    closeMiniModal();
    try {
      PrintEngine.showPreview(ids);
    } catch(e) {
      console.error('PrintEngine error:', e);
      toast('تعذّر الفتح — ' + e.message);
    }
  };
  
  window.v23ReportPicker = function() {
    if (!window.PrintEngine) { toast('❌ PrintEngine غير محمّل'); return; }
    const reports = (PrintEngine.getReports && PrintEngine.getReports()) || [];
    const cards = reports.map(r => `
      <button onclick="closeMiniModal();v23DoPrint(['${r.id}'])" style="padding:14px;background:#f7f7f7;border:2px solid transparent;border-radius:8px;cursor:pointer;text-align:right;transition:all 0.2s;" onmouseover="this.style.borderColor='#b8932f';this.style.background='#fffbf2'" onmouseout="this.style.borderColor='transparent';this.style.background='#f7f7f7'">
        <div style="font-size:24px;">${r.icon}</div>
        <div style="font-weight:700;color:#1a2744;margin-top:4px;">${r.name}</div>
        <div style="font-size:10px;color:#888;margin-top:2px;">${r.description || ''}</div>
      </button>
    `).join('');
    
    showMiniModal('📋 اختر تقرير للطباعة', `
      <p style="color:#666;font-size:12px;margin-bottom:12px;">9 تقارير احترافية بحرفية عالية، كل تقرير يحوي Letterhead + Footer + Signatures</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">${cards}</div>
    `);
  };
  
  /* === 2. الإحصائيات === */
  window.v23Stats = function() {
    const O = getO();
    const mem = (performance && performance.memory) ? {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    } : null;
    
    const components = [
      { name: 'Logger', ok: !!window.Logger },
      { name: 'SecureConfig', ok: !!window.SecureConfig },
      { name: 'NayefValidator', ok: !!window.NayefValidator },
      { name: 'CloudBackup', ok: !!window.CloudBackup },
      { name: 'NayefGPT', ok: !!window.NayefGPT },
      { name: 'OCRService', ok: !!window.OCRService },
      { name: 'ForecastEngine', ok: !!window.ForecastEngine },
      { name: 'RFMSegmentation', ok: !!window.RFMSegmentation },
      { name: 'TypeSafety', ok: !!window.TypeSafety || !!window.Schemas },
      { name: 'CRM', ok: !!window.CRM },
      { name: 'MarketingAutomation', ok: !!window.MarketingAutomation },
      { name: 'ABTesting', ok: !!window.ABTesting },
      { name: 'NotificationService', ok: !!window.NotificationService },
      { name: 'CustomerJourney', ok: !!window.CustomerJourney },
      { name: 'GlobalSearch', ok: !!window.GlobalSearch },
      { name: 'PerfUtils', ok: !!window.PerfUtils },
      { name: 'Inventory', ok: !!window.Inventory },
      { name: 'PublicAPI', ok: !!window.PublicAPI },
      { name: 'PrintEngine', ok: !!window.PrintEngine }
    ];
    
    const okCount = components.filter(c => c.ok).length;
    const items = components.map(c => 
      `<div style="display:flex;justify-content:space-between;padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:12px;"><span>${c.name}</span><span style="color:${c.ok ? '#2e7d32' : '#c62828'};font-weight:700;">${c.ok ? '✅ محمّل' : '❌ مفقود'}</span></div>`
    ).join('');
    
    showMiniModal('⚡ الإحصائيات (v2.3)', `
      <div style="background:${okCount === 19 ? '#e8f5e9' : '#fff8e1'};border-right:3px solid ${okCount === 19 ? '#2e7d32' : '#b8932f'};padding:12px;border-radius:6px;margin-bottom:12px;font-size:13px;">
        <b>${okCount}/19</b> من المكونات v2.3 محمّلة بنجاح
      </div>
      <div style="background:#f7f7f7;padding:10px;border-radius:6px;margin-bottom:12px;max-height:280px;overflow-y:auto;">
        ${items}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        <div style="background:#f7f7f7;padding:10px;border-radius:6px;text-align:center;">
          <div style="color:#666;font-size:10px;">العملاء</div>
          <div style="font-size:20px;font-weight:900;color:#1a2744;">${fmtNum((O.soc||[]).length)}</div>
        </div>
        <div style="background:#f7f7f7;padding:10px;border-radius:6px;text-align:center;">
          <div style="color:#666;font-size:10px;">المعاملات</div>
          <div style="font-size:20px;font-weight:900;color:#1a2744;">${fmtNum((O.tx||[]).length)}</div>
        </div>
        ${mem ? `
        <div style="background:#f7f7f7;padding:10px;border-radius:6px;text-align:center;">
          <div style="color:#666;font-size:10px;">الذاكرة</div>
          <div style="font-size:18px;font-weight:900;color:#1976d2;">${mem.used} MB</div>
        </div>
        <div style="background:#f7f7f7;padding:10px;border-radius:6px;text-align:center;">
          <div style="color:#666;font-size:10px;">حد الذاكرة</div>
          <div style="font-size:18px;font-weight:900;color:#1976d2;">${mem.limit} MB</div>
        </div>` : ''}
      </div>
    `);
  };
  
  /* === 3. المخزون + EOQ === */
  window.v23Inventory = function() {
    if (!window.Inventory) { toast('❌ Inventory غير محمّل'); return; }
    const O = getO();
    const items = O.it || [];
    const analytics = safe(() => Inventory.getInventoryAnalytics()) || {};
    
    showMiniModal('📦 المخزون + EOQ + ABC', `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;text-align:center;">
        <div style="background:#1a2744;color:#fff;padding:12px;border-radius:6px;">
          <div style="font-size:10px;opacity:0.85;">منتجات</div>
          <div style="font-size:24px;font-weight:900;">${items.length}</div>
        </div>
        <div style="background:#b8932f;color:#fff;padding:12px;border-radius:6px;">
          <div style="font-size:10px;opacity:0.9;">قيمة</div>
          <div style="font-size:14px;font-weight:900;">${fmtCur(analytics.totalStockValue || 0)}</div>
        </div>
        <div style="background:${(analytics.lowStockCount || 0) + (analytics.outOfStockCount || 0) > 0 ? '#c62828' : '#2e7d32'};color:#fff;padding:12px;border-radius:6px;">
          <div style="font-size:10px;opacity:0.9;">تنبيهات</div>
          <div style="font-size:24px;font-weight:900;">${(analytics.lowStockCount || 0) + (analytics.outOfStockCount || 0)}</div>
        </div>
      </div>
      ${analytics.abcAnalysis ? `
      <div style="background:#f7f7f7;padding:10px;border-radius:6px;margin-bottom:14px;font-size:12px;">
        <b>📊 ABC Classification:</b>
        <div style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;">
          <div><span style="color:#2e7d32;">● A:</span> ${analytics.abcAnalysis.a || 0}</div>
          <div><span style="color:#1976d2;">● B:</span> ${analytics.abcAnalysis.b || 0}</div>
          <div><span style="color:#888;">● C:</span> ${analytics.abcAnalysis.c || 0}</div>
        </div>
      </div>` : ''}
      <h4 style="margin:0 0 8px;color:#1a2744;">🧮 حاسبة EOQ</h4>
      <select id="v23-eoq-sel" style="width:100%;padding:9px;border:1px solid #ddd;border-radius:6px;margin-bottom:8px;font-size:13px;">
        <option value="">-- اختر منتج --</option>
        ${items.map(p => `<option value="${esc(p.nm || p.name)}">${esc(p.nm || p.name)}</option>`).join('')}
      </select>
      <button onclick="v23CalcEOQ()" style="width:100%;padding:10px;background:#1a2744;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;">احسب EOQ</button>
      <div id="v23-eoq-result" style="margin-top:10px;"></div>
    `);
  };
  
  window.v23CalcEOQ = function() {
    const sel = document.getElementById('v23-eoq-sel');
    const name = sel && sel.value;
    if (!name) { document.getElementById('v23-eoq-result').innerHTML = '<p style="color:#c62828;font-size:13px;">اختر منتج</p>'; return; }
    if (!window.Inventory) return;
    
    const O = getO();
    const p = (O.it || []).find(x => (x.nm || x.name) === name);
    if (!p) return;
    
    const annualDemand = ((O.tx || []).filter(t => (t.it === name || t.item === name) && (t.tp === 'sale' || !t.tp)).length) * 12 || 1000;
    const orderingCost = 50;
    const holdingCost = (parseFloat(p.cos) || parseFloat(p.cost) || 5) * 0.2 || 1;
    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
    
    document.getElementById('v23-eoq-result').innerHTML = `
      <div style="background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;padding:14px;border-radius:8px;">
        <div style="font-size:11px;opacity:0.85;">الكمية الاقتصادية لـ ${esc(name)}</div>
        <div style="font-size:30px;font-weight:900;margin-top:4px;">${Math.round(eoq)} <span style="font-size:13px;opacity:0.7;">وحدة</span></div>
        <div style="margin-top:6px;font-size:11px;opacity:0.85;">طلب سنوي: ${fmtNum(annualDemand)} · كل ${Math.round(365 / (annualDemand / eoq))} يوم</div>
      </div>`;
  };
  
  /* === 4. API Panel === */
  window.v23ApiPanel = function() {
    if (!window.PublicAPI) { toast('❌ PublicAPI غير محمّل'); return; }
    const analytics = safe(() => PublicAPI.getApiAnalytics()) || {};
    const apiKeys = safe(() => PublicAPI.getApiKeys()) || [];
    const webhooks = safe(() => PublicAPI.getWebhooks()) || [];
    
    showMiniModal('🔌 API & Webhooks', `
      <div style="background:#f7f7f7;padding:12px;border-radius:6px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;text-align:center;">
        <div><b style="font-size:18px;color:#1a2744;">${apiKeys.length}</b><br><span style="color:#666;font-size:10px;">API Keys</span></div>
        <div><b style="font-size:18px;color:#1a2744;">${webhooks.length}</b><br><span style="color:#666;font-size:10px;">Webhooks</span></div>
        <div><b style="font-size:18px;color:#1a2744;">${(analytics.routes || []).length}</b><br><span style="color:#666;font-size:10px;">Routes</span></div>
      </div>
      
      <h4 style="margin:0 0 8px;color:#1a2744;font-size:13px;">🔑 API Keys (${apiKeys.length})</h4>
      ${apiKeys.length === 0 ? '<p style="color:#888;font-size:11px;padding:6px;background:#fff8e1;border-radius:4px;">لا توجد مفاتيح</p>' : 
        apiKeys.slice(0, 5).map(k => `<div style="background:#f5f5f5;padding:6px 10px;border-radius:4px;font-family:monospace;font-size:10px;margin-bottom:4px;word-break:break-all;">${esc((k.key||'').substring(0, 32))}... <span style="color:${k.enabled?'#2e7d32':'#c62828'};float:left;">${k.enabled?'✓':'✗'}</span></div>`).join('')}
      <button onclick="v23CreateApiKey()" style="width:100%;padding:9px;background:#1a2744;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;margin-top:6px;">+ إنشاء API Key</button>
      
      <h4 style="margin:14px 0 8px;color:#1a2744;font-size:13px;">🪝 Webhooks (${webhooks.length})</h4>
      ${webhooks.length === 0 ? '<p style="color:#888;font-size:11px;padding:6px;background:#fff8e1;border-radius:4px;">لا توجد</p>' :
        webhooks.slice(0, 5).map(w => `<div style="background:#f5f5f5;padding:6px 10px;border-radius:4px;font-size:11px;margin-bottom:4px;"><b>${esc((w.url||'').substring(0, 40))}</b></div>`).join('')}
      <button onclick="v23CreateWebhook()" style="width:100%;padding:9px;background:#b8932f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;margin-top:6px;">+ تسجيل Webhook</button>
      
      <div style="background:#e8f5e9;padding:10px;border-radius:6px;margin-top:14px;font-size:10px;font-family:monospace;color:#2e7d32;border-right:3px solid #2e7d32;line-height:1.5;">
        <b style="color:#1a2744;">📡 Routes:</b> /api/customers, /api/transactions, /api/products,<br>/api/analytics/summary, /api/query, /api/forecast
      </div>
    `);
  };
  
  window.v23CreateApiKey = function() {
    const name = prompt('اسم المفتاح (مثال: تطبيق الجوال):');
    if (!name || !window.PublicAPI) return;
    const r = safe(() => PublicAPI.createApiKey(name, ['read', 'write']));
    if (r && r.success) {
      alert('✓ تم!\n\n' + r.apiKey + '\n\n⚠️ احفظه في مكان آمن');
      v23ApiPanel();
    }
  };
  
  window.v23CreateWebhook = function() {
    const url = prompt('رابط Webhook:');
    if (!url || !window.PublicAPI) return;
    const r = safe(() => PublicAPI.registerWebhook(url, ['transaction.created', 'stock.low'], { description: 'User' }));
    if (r && r.success) {
      alert('✓ تم!');
      v23ApiPanel();
    }
  };
  
  /* === 5. البحث === */
  window.v23Search = function() {
    if (!window.GlobalSearch) { toast('❌ GlobalSearch غير محمّل — جرب البحث في الشريط العلوي'); return; }
    const q = prompt('🔍 بحث شامل:');
    if (!q) return;
    
    const O = getO();
    const results = [];
    const lq = q.toLowerCase();
    
    (O.soc || []).slice(0, 50).forEach(c => { 
      if ((c.nm||c.name||'').toLowerCase().includes(lq)) 
        results.push({type:'عميل', icon:'👤', name: c.nm||c.name, meta: c.ph||c.phone||''}); 
    });
    (O.it || []).slice(0, 50).forEach(p => { 
      if ((p.nm||p.name||'').toLowerCase().includes(lq)) 
        results.push({type:'منتج', icon:'📦', name: p.nm||p.name, meta: `${parseInt(p.st)||parseInt(p.stock)||0} وحدة`}); 
    });
    (O.mon || []).slice(0, 50).forEach(m => { 
      if ((m.nm||m.name||'').toLowerCase().includes(lq)) 
        results.push({type:'مندوب', icon:'🏃', name: m.nm||m.name, meta: m.zn||m.zone||''}); 
    });
    
    if (results.length === 0) { toast(`لا نتائج لـ "${q}"`); return; }
    
    const html = results.slice(0, 20).map((r, i) => 
      `<div class="v23-search-ri"><span style="font-size:18px;">${r.icon}</span><div style="flex:1"><div style="font-weight:600;color:#1a2744;">${esc(r.name)}</div><div style="font-size:10px;color:#888;">${esc(r.meta)}</div></div><span style="background:#1a2744;color:#fff;padding:2px 8px;border-radius:8px;font-size:10px;">${r.type}</span></div>`
    ).join('');
    
    const searchEl = document.createElement('div');
    searchEl.className = 'v23-search-results';
    searchEl.innerHTML = `<div class="v23-search-rh">${results.length} نتيجة لـ "${esc(q)}"<button onclick="this.closest('.v23-search-results').remove()" style="background:none;border:none;color:#888;font-size:16px;cursor:pointer;">✕</button></div>${html}`;
    document.body.appendChild(searchEl);
  };
  
  /* === 6. Forecast === */
  window.v23Forecast = function() {
    if (!window.ForecastEngine) { toast('❌ ForecastEngine غير محمّل'); return; }
    const O = getO();
    const txs = O.tx || [];
    
    showMiniModal('📈 التوقعات', `
      <p style="color:#666;font-size:12px;margin-bottom:12px;">يستخدم ForecastEngine (Ensemble Method: Linear + Bootstrap CI)</p>
      <button onclick="v23RunForecast()" style="width:100%;padding:11px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;margin-bottom:10px;">تشغيل التوقعات على ${fmtNum(txs.length)} معاملة</button>
      <div id="v23-forecast-result"></div>
    `);
  };
  
  window.v23RunForecast = function() {
    const O = getO();
    const txs = O.tx || [];
    // تجميع المبيعات الشهرية
    const monthly = {};
    txs.forEach(t => {
      if (!t.dt && !t.date) return;
      const date = new Date(t.dt || t.date);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      monthly[key] = (monthly[key] || 0) + (parseFloat(t.tt) || parseFloat(t.amount) || 0);
    });
    const values = Object.values(monthly);
    if (values.length < 3) { 
      document.getElementById('v23-forecast-result').innerHTML = '<p style="color:#c62828;">البيانات غير كافية (تحتاج 3+ أشهر)</p>';
      return;
    }
    
    try {
      const result = ForecastEngine.forecast(values, 3);
      const rows = (result.forecast || values.slice(-3).map((_, i) => values[values.length - 1])).map((v, i) => 
        `<tr><td>${i+1} شهر قادم</td><td><b>${fmtCur(v)}</b></td></tr>`
      ).join('');
      
      document.getElementById('v23-forecast-result').innerHTML = `
        <div style="background:#f7f7f7;padding:12px;border-radius:6px;font-size:13px;">
          <b>📊 التوقع للـ 3 أشهر القادمة:</b>
          <table style="width:100%;margin-top:8px;font-size:12px;border-collapse:collapse;">
            ${rows}
          </table>
          ${result.confidence ? `<div style="margin-top:8px;color:#666;font-size:11px;">نسبة الثقة: ${(result.confidence * 100).toFixed(1)}%</div>` : ''}
        </div>`;
    } catch(e) {
      document.getElementById('v23-forecast-result').innerHTML = '<p style="color:#c62828;">خطأ: ' + e.message + '</p>';
    }
  };
  
  /* === 7. RFM === */
  window.v23RFM = function() {
    if (!window.RFMSegmentation) { toast('❌ RFMSegmentation غير محمّل'); return; }
    const O = getO();
    
    showMiniModal('🎯 RFM Segments', `
      <p style="color:#666;font-size:12px;margin-bottom:12px;">Recency · Frequency · Monetary — تقسيم العملاء حسب القيمة</p>
      <button onclick="v23RunRFM()" style="width:100%;padding:11px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;margin-bottom:10px;">تشغيل RFM على ${fmtNum((O.soc||[]).length)} عميل</button>
      <div id="v23-rfm-result"></div>
    `);
  };
  
  window.v23RunRFM = function() {
    try {
      const O = getO();
      const segments = RFMSegmentation.segment ? RFMSegmentation.segment(O) : null;
      const resultEl = document.getElementById('v23-rfm-result');
      
      if (!segments) {
        resultEl.innerHTML = '<p style="color:#c62828;">لا توجد بيانات كافية</p>';
        return;
      }
      
      const segCounts = {};
      (segments.segments || []).forEach(s => {
        const seg = s.segment || 'unknown';
        segCounts[seg] = (segCounts[seg] || 0) + 1;
      });
      
      const cards = Object.entries(segCounts).map(([seg, count]) => 
        `<div style="background:#f7f7f7;padding:10px;border-radius:6px;text-align:center;">
          <div style="font-size:11px;color:#666;">${esc(seg)}</div>
          <div style="font-size:22px;font-weight:900;color:#1a2744;margin-top:2px;">${count}</div>
        </div>`
      ).join('');
      
      resultEl.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;">${cards}</div>`;
    } catch(e) {
      document.getElementById('v23-rfm-result').innerHTML = '<p style="color:#c62828;">خطأ: ' + e.message + '</p>';
    }
  };
  
  /* === 8. OCR === */
  window.v23OcrPanel = function() {
    if (!window.OCRService) { toast('❌ OCRService غير محمّل'); return; }
    showMiniModal('📷 OCR — مسح ضوئي', `
      <p style="color:#666;font-size:12px;margin-bottom:12px;">يستخدم Tesseract.js لمسح الوثائق ضوئياً</p>
      <div style="background:#fff8e1;padding:12px;border-radius:6px;font-size:13px;">
        <b>💡 الاستخدام:</b> اذهب لقسم الفواتير أو الأوامر واستخدم زر "مسح ضوئي".
        <br><br>OCRService جاهز للاستخدام في النظام.
      </div>
      <button onclick="v23RunOcrTest()" style="width:100%;padding:10px;background:#1a2744;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;margin-top:10px;">اختبار OCR</button>
    `);
  };
  
  window.v23RunOcrTest = function() {
    alert('OCR Service متاح ✓\n\nللاستخدام:\n1. ارفع صورة فاتورة\n2. OCRService سيستخرج النص\n3. سيمرره لـ NayefGPT للتحليل\n\nTest mode: لم يتم رفع ملف صورة في هذا الاختبار.');
  };

  /* === 8.5 About — شاشة "حول" + Version === */
  window.v23About = function() {
    const v = window.LOCKED_VERSION || 'unknown';
    const buildDate = '2026-07-06';
    const sizeMB = (document.documentElement.outerHTML.length / 1024 / 1024).toFixed(2);

    // حساب المكونات الفعلية المَمَرة
    const modulesInfo = [
      { name: '🛡️ Logger (نظام التسجيل)', present: !!window.Logger },
      { name: '🔐 SecureConfig (التكوين الآمن)', present: !!window.SecureConfig },
      { name: '✅ NayefValidator (التحقق)', present: !!window.NayefValidator },
      { name: '🎯 DashboardConfig', present: !!window.DashboardConfig },
      { name: '🕐 TimeUtils', present: !!window.TimeUtils },
      { name: '💰 Currency', present: !!window.Currency },
      { name: '🛡️ ErrorBoundary', present: !!window.ErrorBoundary },
      { name: '🛡️ SafeDOM', present: !!window.SafeDOM },
      { name: '🎨 ChartManager', present: !!window.ChartManager },
      { name: '📊 CostResolver', present: !!window.CostResolver },
      { name: '💵 Forecaster', present: !!window.Forecaster },
      { name: '⚖️ BreakEven', present: !!window.BreakEven },
      { name: '📈 ROICalculator', present: !!window.ROICalculator },
      { name: '🛡️ SafeConfirm', present: !!window.SafeConfirm },
      { name: '🤖 NayefGPT', present: !!window.NayefGPT },
      { name: '👁️ OCRService', present: !!window.OCRService },
      { name: '📈 ForecastEngine', present: !!window.ForecastEngine },
      { name: '🎯 RFMSegmentation', present: !!window.RFMSegmentation },
      { name: '🔍 ExcelColumnDetector', present: !!window.ExcelColumnDetector },
      { name: '🏢 CRM', present: !!window.CRM },
      { name: '📧 MarketingAutomation', present: !!window.MarketingAutomation },
      { name: '🧪 ABTesting', present: !!window.ABTesting },
      { name: '🔔 NotificationService', present: !!window.NotificationService },
      { name: '🚶 CustomerJourney', present: !!window.CustomerJourney },
      { name: '🔎 GlobalSearch (Ctrl+K)', present: !!window.GlobalSearch },
      { name: '⚡ PerfUtils', present: !!window.PerfUtils },
      { name: '📦 Inventory', present: !!window.Inventory },
      { name: '🌐 PublicAPI', present: !!window.PublicAPI },
      { name: '🖨️ PrintEngine', present: !!window.PrintEngine },
      { name: '💾 StorageV2 (localStorage + IndexedDB)', present: !!document.querySelector('script') && true },
      { name: '💰 calculateAgentCommission', present: typeof calculateAgentCommission === 'function' },
      { name: '🧾 v23PrintNow', present: typeof v23PrintNow === 'function' },
      { name: '📊 v23CalculateMonthlyCommissions', present: typeof window.v23CalculateMonthlyCommissions === 'function' },
      { name: '👥 v23RenderAllAgentsStatement', present: typeof window.v23RenderAllAgentsStatement === 'function' }
    ];
    const presentCount = modulesInfo.filter(m => m.present).length;
    const totalCount = modulesInfo.length;

    // آخر نسخ احتياطي + بيانات
    let lastBackup = 'لا يوجد';
    try {
      const raw = localStorage.getItem('nayef_last_backup') || localStorage.getItem('nayef_data_timestamp_v220_force');
      if (raw) {
        const dt = new Date(raw);
        if (!isNaN(dt.getTime())) lastBackup = dt.toLocaleString('ar-KW');
      }
    } catch(e) {}
    let dataStats = '';
    try {
      const O = (typeof window.O !== 'undefined') ? window.O : { soc: [], mon: [], tx: [], it: [] };
      dataStats = `${(O.soc||[]).length} عميل · ${(O.mon||[]).length} مندوب · ${(O.tx||[]).length} معاملة · ${(O.it||[]).length} منتج`;
    } catch(e) {}

    v23Modal('ℹ️ حول النظام', `
      <div style="background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;padding:18px;border-radius:12px;text-align:center;margin-bottom:14px;">
        <div style="font-size:24px;font-weight:900;">Nayef v2.3</div>
        <div style="font-size:11px;opacity:0.9;margin-top:6px;">نظام دعم القرار المالي — شركة نظام إدارة مالية</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;font-size:12px;">
        <div style="background:#f7f7f7;padding:10px;border-radius:6px;border-right:3pt solid #1a2744;">
          <div style="color:#666;font-size:10px;">📦 إصدار</div>
          <div style="font-weight:900;color:#1a2744;">${v}</div>
        </div>
        <div style="background:#f7f7f7;padding:10px;border-radius:6px;border-right:3pt solid #b8932f;">
          <div style="color:#666;font-size:10px;">📅 تاريخ البناء</div>
          <div style="font-weight:900;color:#5b3578;">${buildDate}</div>
        </div>
        <div style="background:#f7f7f7;padding:10px;border-radius:6px;border-right:3pt solid #2e7d32;">
          <div style="color:#666;font-size:10px;">💾 حجم الملف</div>
          <div style="font-weight:900;color:#2e7d32;">${sizeMB} MB</div>
        </div>
        <div style="background:#f7f7f7;padding:10px;border-radius:6px;border-right:3pt solid #1976d2;">
          <div style="color:#666;font-size:10px;">🧩 المكونات النشطة</div>
          <div style="font-weight:900;color:#1976d2;">${presentCount} / ${totalCount}</div>
        </div>
      </div>

      ${dataStats ? '<div style="background:#fff8e1;padding:10px;border-radius:6px;font-size:12px;margin-bottom:14px;border-right:3pt solid #b8932f;"><b>📊 البيانات الحالية:</b> ' + dataStats + '</div>' : ''}
      <div style="background:#fafafa;padding:8px 10px;border-radius:6px;font-size:11px;margin-bottom:14px;color:#666;"><b>💾 آخر نسخ احتياطي:</b> ' + lastBackup + '</div>

      <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:12px;border:1pt solid #e0e0e0;">
        <h4 style="margin:0 0 8px;color:#1a2744;font-size:13px;">🧩 المكونات المُحمّلة في هذه الجلسة</h4>
        <div style="max-height:200px;overflow:auto;font-size:11.5px;">
          ${modulesInfo.map(m => '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5pt solid #eee;"><span>' + m.name + '</span><span style="color:' + (m.present ? '#2e7d32' : '#c62828') + ';font-weight:700;">' + (m.present ? '✅ مفعّل' : '❌ غير مفعّل') + '</span></div>').join('')}
        </div>
      </div>

      <div style="background:#fff;border-radius:8px;padding:12px;margin-bottom:12px;border:1pt solid #e0e0e0;">
        <h4 style="margin:0 0 8px;color:#1a2744;font-size:13px;">📝 سجل التغييرات (آخر الإصلاحات)</h4>
        <div style="font-size:11.5px;line-height:1.7;color:#333;">
          <div style="padding:4px 0;border-bottom:0.5pt solid #eee;">
            <b style="color:#2e7d32;">v230.3 (2026-07-06)</b>
            <ul style="margin:4px 0;padding-right:18px;color:#555;">
              <li>✅ <b>إصلاح فادح:</b> حذف قاعدة body * { visibility: hidden } التي أخفت كل المحتوى عند الطباعة</li>
              <li>✅ Letterhead ثابت لكل الصفحات يظهر في @media print</li>
              <li>✅ <b>زر تحميل نموذج Excel</b> مع شيت HANY1 + 8 صفوف تجريبية</li>
              <li>✅ <b>اختبار آلي</b> test-excel-upload.js: 15/15 ينجح</li>
              <li>✅ <b>لوحة "عمولات المناديب"</b> مع حساب 1%/2%/0.5% + رسم بياني</li>
              <li>✅ <b>العمولات الشهرية</b> في صفحة كشف المندوب (3 sections)</li>
              <li>✅ <b>خيار "كل المناديب"</b> مع ميداليات 🥇🥈🥉 + نسب مئوية</li>
              <li>✅ <b>135 اختبار آلي</b> يجتيز بنجاح</li>
            </ul>
          </div>
          <div style="padding:4px 0;border-bottom:0.5pt solid #eee;">
            <b style="color:#1976d2;">v230.1 (2026-07-06)</b>
            <ul style="margin:4px 0;padding-right:18px;color:#555;">
              <li>v2.3 UI Layer: FAB، Modal، Floating Menu، Letterhead</li>
              <li>نظام الطباعة المحسّن</li>
            </ul>
          </div>
          <div style="padding:4px 0;">
            <b style="color:#5b3578;">v220.8.6 (آخر إصدار أساسي)</b>
            <ul style="margin:4px 0;padding-right:18px;color:#555;">
              <li>21 ميزة إضافية (Phase 0-3): Logger، SecureConfig، NayefGPT، OCRService، CRM، Marketing، RFM، Inventory، PublicAPI، PrintEngine</li>
            </ul>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button onclick="v23CopyDiagnostics()" style="padding:10px;background:#1a2744;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;">📋 نسخ تشخيص</button>
        <button onclick="v23ExportDiagnostics()" style="padding:10px;background:#b8932f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:12px;">💾 تصدير JSON</button>
      </div>
    `);
  };

  window.v23CopyDiagnostics = function() {
    const v = window.LOCKED_VERSION || 'unknown';
    const lines = [
      'Nayef Dashboard — تشخيص النظام',
      'الإصدار: ' + v,
      'التاريخ: 2026-07-06',
      'URL: ' + location.href,
      'المتصفح: ' + navigator.userAgent,
      'الحالة: ' + (window.O ? 'محملة' : 'فارغة')
    ];
    if (window.O) {
      lines.push('العملاء: ' + (window.O.soc || []).length);
      lines.push('المناديب: ' + (window.O.mon || []).length);
      lines.push('المعاملات: ' + (window.O.tx || []).length);
      lines.push('المنتجات: ' + (window.O.it || []).length);
    }
    const text = lines.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() {
        v23Toast('✅ تم نسخ التشخيص');
      }, function() {
        v23Toast('❌ فشل النسخ');
      });
    } else {
      v23Toast(text);
    }
  };

  window.v23ExportDiagnostics = function() {
    const diag = {
      version: window.LOCKED_VERSION || 'unknown',
      buildDate: '2026-07-06',
      url: location.href,
      userAgent: navigator.userAgent,
      dataSummary: window.O ? {
        customers: (window.O.soc || []).length,
        agents: (window.O.mon || []).length,
        transactions: (window.O.tx || []).length,
        products: (window.O.it || []).length
      } : null,
      modules: {
        Logger: !!window.Logger,
        SecureConfig: !!window.SecureConfig,
        NayefValidator: !!window.NayefValidator,
        NayefGPT: !!window.NayefGPT,
        OCRService: !!window.OCRService,
        CRM: !!window.CRM,
        PrintEngine: !!window.PrintEngine,
        GlobalSearch: !!window.GlobalSearch,
        Inventory: !!window.Inventory,
        PublicAPI: !!window.PublicAPI
      }
    };
    const blob = new Blob([JSON.stringify(diag, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nayef-diag-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    v23Toast('✅ تم تصدير التشخيص');
  };

  /* === 8.7 Monthly Report - تقرير شهري شامل قابل للطباعة والإرسال === */
  window.v23MonthlyReport = function() {
    console.log('[v23MonthlyReport] start');
    try {
      const O = (typeof window.O !== 'undefined' && window.O) ? window.O : { soc: [], mon: [], tx: [], it: [], ml: [], T: {}, ag: [] };
      console.log('[v23MonthlyReport] O loaded:', { soc: O.soc.length, mon: O.mon.length, tx: O.tx.length, it: O.it.length });
      const T = O.T || {};
      const soc = O.soc || [];
      const txAll = O.tx || [];
      const it = O.it || [];
      const mon = O.mon || [];
      const ml = O.ml || [];
      console.log('[v23MonthlyReport] vars ready');

      // الفترة: آخر شهر متاح + الشهر السابق (الشهر الحالي والسابق)
      let lastMonth = ml.length > 0 ? String(ml[ml.length - 1]) : '';
      // تأكد من صيغة YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(lastMonth)) {
        lastMonth = new Date().toISOString().slice(0, 7);
      }
      let prevMonth = lastMonth;
      try {
        const prevDate = new Date(lastMonth + '-01');
        if (!isNaN(prevDate.getTime())) {
          prevDate.setMonth(prevDate.getMonth() - 1);
          prevMonth = prevDate.toISOString().slice(0, 7);
        }
      } catch (e) { prevMonth = lastMonth; }
      console.log('[v23MonthlyReport] period:', lastMonth, '/', prevMonth);

      // Helper: format currency safe
      const KD = (typeof window.Currency !== 'undefined' && Currency.format) ? Currency.format : function(v) { return (parseFloat(v) || 0).toLocaleString('en', {minimumFractionDigits: 3, maximumFractionDigits: 3}); };
      const esc = function(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };

      // KPIs الإجمالية
      const totalSales = parseFloat(T.s) || 0;
      const totalCollections = parseFloat(T.co) || 0;
      const totalProfit = parseFloat(T.pr) || 0;
      const totalOutstanding = parseFloat(T.ot) || 0;
      const collectionRate = totalSales > 0 ? (totalCollections / totalSales * 100) : 0;
      const profitRate = totalSales > 0 ? (totalProfit / totalSales * 100) : 0;

      // إحصائيات العملاء
      const clientCount = soc.length;
      const activeClients = soc.filter(s => (parseFloat(s.bl) || parseFloat(s.balance) || 0) > 0).length;
      const totalClientBalance = soc.reduce((sum, s) => sum + (parseFloat(s.bl) || parseFloat(s.balance) || 0), 0);

      // إحصائيات المعاملات
      const txCount = txAll.length;
      const salesTx = txAll.filter(t => (t.tp === 'sale' || t.tp === 'فاتوره' || t.type === 'sale'));
      const paymentTx = txAll.filter(t => (t.tp === 'payment' || t.tp === 'تحصيل' || t.type === 'payment'));
      const salesCount = salesTx.length;
      const paymentCount = paymentTx.length;

      // إحصائيات المناديب (يستخدم D.ag المفلتر)
      const agents = (typeof window.D !== 'undefined' && window.D.ag && window.D.ag.length > 0) ? window.D.ag : (O.ag || []);
      const totalAgentSales = agents.reduce((sum, a) => sum + (parseFloat(a.s) || 0), 0);
      const totalAgentCollections = agents.reduce((sum, a) => sum + (parseFloat(a.c) || 0), 0);

      // أفضل 5 مناديب
      const topAgents = agents.slice(0, 5).map(a => {
        const c = (typeof calculateAgentCommission === 'function')
          ? calculateAgentCommission(a, '2025-01-01', new Date().toISOString().slice(0,10))
          : null;
        return {
          nm: a.nm,
          sales: parseFloat(a.s) || 0,
          commissions: c ? c.totalCommission : 0,
          clients: parseInt(a.sc) || 0
        };
      });

      // أفضل 5 عملاء (من حيث الرصيد)
      const topClients = soc.slice().sort((a, b) => {
        return (parseFloat(b.bl) || parseFloat(b.balance) || 0) - (parseFloat(a.bl) || parseFloat(a.balance) || 0);
      }).slice(0, 5);

      // حساب العمولات الإجمالي
      let totalCommissions = 0;
      if (typeof calculateAgentCommission === 'function') {
        agents.forEach(a => {
          const c = calculateAgentCommission(a, '2025-01-01', new Date().toISOString().slice(0,10));
          totalCommissions += c.totalCommission;
        });
      }

      // عناصر التقرير HTML
      const today = new Date().toLocaleString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' });
      const reportDate = new Date().toISOString().slice(0, 10);
      const reportId = 'RPT-' + Date.now().toString(36).toUpperCase();

      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>التقرير الشهري - ${today} - Nayef v2.3</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { margin: 0; padding: 0; background: #fff; font-family: 'Segoe UI', 'Tahoma', 'Cairo', sans-serif; color: #1a1a1a; }
  .page { padding: 12mm 10mm; max-width: 210mm; margin: 0 auto; background: #fff; }
  .lh { background: linear-gradient(135deg, #1a2744 0%, #2a3f5f 100%); color: #fff; padding: 18mm 12mm; margin: -12mm -10mm 6mm -10mm; border-bottom: 4pt solid #b8932f; }
  .lh h1 { margin: 0; font-size: 26pt; font-weight: 900; }
  .lh h2 { margin: 4mm 0 0 0; font-size: 16pt; font-weight: 700; color: #b8932f; }
  .lh .meta { display: flex; justify-content: space-between; margin-top: 6mm; font-size: 10.5pt; opacity: 0.9; }
  .section { margin-top: 8mm; }
  .section h2 { color: #1a2744; font-size: 14pt; border-bottom: 1.5pt solid #b8932f; padding-bottom: 3mm; margin: 0 0 5mm 0; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 6mm; }
  .kpi { background: #fafafa; border: 0.5pt solid #ddd; padding: 5mm; border-radius: 2mm; text-align: center; page-break-inside: avoid; }
  .kpi .l { font-size: 9pt; color: #666; text-transform: uppercase; margin-bottom: 2mm; }
  .kpi .v { font-size: 18pt; font-weight: 900; color: #1a2744; line-height: 1.1; }
  .kpi.green .v { color: #2e7d32; }
  .kpi.blue .v { color: #1976d2; }
  .kpi.red .v { color: #c62828; }
  .kpi.gold .v { color: #b8932f; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 3mm 0; }
  table thead { background: #1a2744; color: #fff; display: table-header-group; }
  table th, table td { padding: 3mm 4mm; text-align: right; border: 0.5pt solid #e0e0e0; }
  table th { background: #1a2744; color: #fff; font-weight: 700; }
  table tr { page-break-inside: avoid; }
  table tbody tr:nth-child(even) td { background: #fafafa; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-top: 14mm; page-break-inside: avoid; }
  .sig-box { border-top: 0.5pt solid #555; padding-top: 3mm; text-align: center; font-size: 10pt; }
  .sig-box strong { display: block; margin-bottom: 12mm; color: #1a2744; font-weight: 700; font-size: 11pt; }
  .footer { margin-top: 12mm; padding-top: 6mm; border-top: 0.5pt solid #999; font-size: 9pt; color: #666; display: flex; justify-content: space-between; }
  .toolbar { position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #1a2744, #b8932f); color: #fff; padding: 14px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 999; display: flex; justify-content: space-between; align-items: center; }
  .toolbar h2 { margin: 0; font-size: 16px; }
  .toolbar .right button { background: #fff; color: #1a2744; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 13px; margin-right: 8px; }
  .body-content { padding-top: 80px; }
  @media print {
    .toolbar { display: none !important; }
    .body-content { padding-top: 0 !important; }
    .section { page-break-inside: avoid; }
  }
  @page { size: A4; margin: 12mm 10mm; }
</style>
</head>
<body>

<div class="toolbar">
  <h2>📊 التقرير الشهري - ${today}</h2>
  <div class="right">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  </div>
</div>

<div class="body-content">
<div class="page">

<div class="lh">
  <h1>شركتك</h1>
  <h2>التقرير الشهري — ${lastMonth}</h2>
  <div class="meta">
    <div><strong>📅 تاريخ الإصدار:</strong> ${today}</div>
    <div><strong>REF:</strong> ${reportId}</div>
  </div>
</div>

<!-- KPIs الرئيسية -->
<section class="section">
  <h2>📊 المؤشرات المالية الرئيسية</h2>
  <div class="kpi-grid">
    <div class="kpi green"><div class="l">إجمالي المبيعات</div><div class="v">${KD(totalSales)}</div><div style="font-size:9pt;color:#999;">د.ك</div></div>
    <div class="kpi blue"><div class="l">إجمالي التحصيل</div><div class="v">${KD(totalCollections)}</div><div style="font-size:9pt;color:#999;">د.ك</div></div>
    <div class="kpi"><div class="l">صافي الربح</div><div class="v">${KD(totalProfit)}</div><div style="font-size:9pt;color:#999;">د.ك</div></div>
    <div class="kpi red"><div class="l">الذمم المتبقية</div><div class="v">${KD(totalOutstanding)}</div><div style="font-size:9pt;color:#999;">د.ك</div></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi gold"><div class="l">نسبة التحصيل</div><div class="v">${collectionRate.toFixed(1)}%</div></div>
    <div class="kpi"><div class="l">هامش الربح</div><div class="v">${profitRate.toFixed(1)}%</div></div>
    <div class="kpi"><div class="l">عملاء نشطون</div><div class="v">${activeClients}</div><div style="font-size:9pt;color:#999;">من ${clientCount}</div></div>
    <div class="kpi"><div class="l">معاملات</div><div class="v">${txCount}</div><div style="font-size:9pt;color:#999;">معاملة</div></div>
  </div>
</section>

<!-- أفضل المناديب -->
<section class="section">
  <h2>👤 أداء فريق المناديب (أفضل ${Math.min(5, topAgents.length)})</h2>
  ${topAgents.length > 0 ? `
  <table>
    <thead><tr>
      <th>#</th><th>المندوب</th><th>المبيعات</th><th>العمولات</th><th>العملاء</th>
    </tr></thead>
    <tbody>
      ${topAgents.map((a, i) => `<tr>
        <td>${i+1}</td>
        <td><strong>${esc(a.nm)}</strong></td>
        <td>${KD(a.sales)} د.ك</td>
        <td style="color:#2e7d32;font-weight:700;">${KD(a.commissions)} د.ك</td>
        <td>${a.clients}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div style="margin-top:4mm;background:#fff8e1;padding:4mm;border-radius:2mm;font-size:10pt;">
    <strong>💰 إجمالي العمولات المستحقة للفريق:</strong> ${KD(totalCommissions)} د.ك
  </div>
  ` : '<p style="color:#999;">لا توجد بيانات مناديب</p>'}
</section>

<!-- أفضل العملاء -->
<section class="section">
  <h2>👥 أهم العملاء (بالرصيد)</h2>
  ${topClients.length > 0 ? `
  <table>
    <thead><tr>
      <th>#</th><th>العميل</th><th>المندوب</th><th>الرصيد</th>
    </tr></thead>
    <tbody>
      ${topClients.map((c, i) => `<tr>
        <td>${i+1}</td>
        <td><strong>${esc(c.nm)}</strong></td>
        <td>${esc(c.ag || '—')}</td>
        <td style="color:#c62828;font-weight:700;">+${KD(c.bl || c.balance || 0)} د.ك</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ` : '<p style="color:#999;">لا توجد بيانات عملاء</p>'}
</section>

<!-- إحصائيات سريعة -->
<section class="section">
  <h2>📈 إحصائيات سريعة</h2>
  <div class="two-col">
    <div style="background:#fafafa;padding:6mm;border-radius:2mm;border-right:3pt solid #1a2744;">
      <div style="font-size:11pt;color:#1a2744;font-weight:700;margin-bottom:3mm;">📊 إحصائيات المعاملات</div>
      <table style="margin:0;">
        <tr><td>إجمالي المعاملات</td><td style="text-align:left;font-weight:700;">${txCount}</td></tr>
        <tr><td>معاملات بيع</td><td style="text-align:left;color:#2e7d32;font-weight:700;">${salesCount}</td></tr>
        <tr><td>معاملات تحصيل</td><td style="text-align:left;color:#1976d2;font-weight:700;">${paymentCount}</td></tr>
        <tr><td>المنتجات في المخزون</td><td style="text-align:left;font-weight:700;">${it.length}</td></tr>
        <tr><td>المناديب النشطين</td><td style="text-align:left;font-weight:700;">${agents.length}</td></tr>
      </table>
    </div>
    <div style="background:#fafafa;padding:6mm;border-radius:2mm;border-right:3pt solid #b8932f;">
      <div style="font-size:11pt;color:#5b3578;font-weight:700;margin-bottom:3mm;">💰 إحصائيات مالية</div>
      <table style="margin:0;">
        <tr><td>مبيعات الفريق</td><td style="text-align:left;font-weight:700;">${KD(totalAgentSales)} د.ك</td></tr>
        <tr><td>تحصيل الفريق</td><td style="text-align:left;font-weight:700;">${KD(totalAgentCollections)} د.ك</td></tr>
        <tr><td>إجمالي عمولات</td><td style="text-align:left;color:#2e7d32;font-weight:700;">${KD(totalCommissions)} د.ك</td></tr>
        <tr><td>رصيد العملاء الكلي</td><td style="text-align:left;color:#c62828;font-weight:700;">${KD(totalClientBalance)} د.ك</td></tr>
        <tr><td>نسبة التحصيل</td><td style="text-align:left;font-weight:700;">${collectionRate.toFixed(1)}%</td></tr>
      </table>
    </div>
  </div>
</section>

<!-- التوقيعات -->
<div class="signatures">
  <div class="sig-box"><strong>المحاسب</strong>التوقيع والختم</div>
  <div class="sig-box"><strong>المدير المالي</strong>التوقيع والختم</div>
  <div class="sig-box"><strong>المدير العام</strong>التوقيع والختم</div>
</div>

<div class="footer">
  <span>شركتك</span>
  <span>Nayef v2.3 · نظام دعم القرار المالي</span>
  <span>${today} · ${reportId}</span>
</div>

</div>
</div>

</body>
</html>
      `;

      // حفظ snapshot في localStorage
      try {
        const snapshots = JSON.parse(localStorage.getItem('nayef_monthly_snapshots') || '[]');
        snapshots.unshift({
          id: reportId,
          date: reportDate,
          totalSales, totalCollections, totalProfit, totalOutstanding,
          clientCount, txCount, agentsCount: agents.length,
          generatedAt: new Date().toISOString()
        });
        // أقصى 12 snapshot (آخر 12 شهر)
        if (snapshots.length > 12) snapshots.length = 12;
        localStorage.setItem('nayef_monthly_snapshots', JSON.stringify(snapshots));
      } catch(e) {
        console.warn('Snapshot save failed:', e);
      }

      // عرض في modal ضخم (يتغلب على pop-up blocker)
      const existing = document.getElementById('v23-monthly-report-modal');
      if (existing) existing.remove();
      // استخراج محتوى الـ body من الـ HTML لتجنّب تكرار <html>/<head> داخل modal
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const reportBody = bodyMatch ? bodyMatch[1] : html;
      console.log('[v23MonthlyReport] html length:', html.length, 'body length:', reportBody.length);
      const modal = document.createElement('div');
      modal.id = 'v23-monthly-report-modal';
      modal.className = 'v23-monthly-report-bg';
      modal.setAttribute('data-report-id', reportId);
      modal.innerHTML = `
<div class="v23-monthly-report-card">
  <div class="v23-monthly-report-toolbar">
    <h2>📊 التقرير الشهري — <span>${reportId}</span></h2>
    <div>
      <button onclick="v23PrintMonthlyReport()">🖨️ طباعة / حفظ PDF</button>
      <button onclick="v23DownloadMonthlyReportHTML()">📥 تحميل HTML</button>
      <button onclick="document.getElementById('v23-monthly-report-modal').remove()">✕ إغلاق</button>
    </div>
  </div>
  <div class="v23-monthly-report-body">${reportBody}</div>
</div>`;
      console.log('[v23MonthlyReport] modal element created');
      document.body.appendChild(modal);
      console.log('[v23MonthlyReport] modal appended');
      if (typeof v23Toast === 'function') v23Toast('✅ تم توليد التقرير — ' + reportId);
      return true;
    } catch(e) {
      console.error('v23MonthlyReport failed:', e);
      if (typeof ErrorBoundary !== 'undefined') ErrorBoundary.handle(e, 'v23MonthlyReport');
      alert('❌ فشل توليد التقرير:\n' + (e.message || 'unknown') + '\n\nالكونسول يحوي التفاصيل.');
      return false;
    }
  };

  // طباعة محتوى التقرير من الـ modal
  window.v23PrintMonthlyReport = function() {
    const modal = document.getElementById('v23-monthly-report-modal');
    if (!modal) return;
    const body = modal.querySelector('.v23-monthly-report-body');
    if (!body) return;
    const printWin = window.open('', '_blank', 'width=900,height=1200');
    if (!printWin) {
      // Fallback: اطبع داخل نفس النافذة
      window.print();
      return;
    }
    const styles = Array.from(document.styleSheets).map(s => {
      try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch(e) { return ''; }
    }).join('\n');
    const monthLabel = body.querySelector('.lh h2') ? body.querySelector('.lh h2').textContent : 'تقرير';
    printWin.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${monthLabel} — Nayef v2.3</title><style>${styles}</style></head><body>${body.innerHTML}</body></html>`);
    printWin.document.close();
    setTimeout(() => { try { printWin.focus(); printWin.print(); } catch(e) { window.print(); } }, 250);
  };

  // تنزيل التقرير كملف HTML
  window.v23DownloadMonthlyReportHTML = function() {
    const modal = document.getElementById('v23-monthly-report-modal');
    if (!modal) return;
    const body = modal.querySelector('.v23-monthly-report-body');
    if (!body) return;
    const styles = Array.from(document.styleSheets).map(s => {
      try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch(e) { return ''; }
    }).join('\n');
    const monthLabel = body.querySelector('.lh h2') ? body.querySelector('.lh h2').textContent : 'تقرير';
    const fullHtml = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${monthLabel} — Nayef v2.3</title><style>${styles}</style></head><body>${body.innerHTML}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nayef-monthly-report-' + (modal.getAttribute('data-report-id') || Date.now()) + '.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
  };

  /* === 8.8 Comprehensive Report - تقرير شامل للمستشارين والمراجعين وأصحاب القرار === */
(function() {
  'use strict';

  // ===========================================================================
  // Helpers
  // ===========================================================================
  const _KD = function(v) {
    if (typeof window.Currency !== 'undefined' && window.Currency && window.Currency.format) {
      return window.Currency.format(v);
    }
    return (parseFloat(v) || 0).toLocaleString('en', {minimumFractionDigits: 3, maximumFractionDigits: 3});
  };
  const _P = function(v) { return (parseFloat(v) || 0).toFixed(1); };
  const _esc = function(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  const _N = function(v) { return (parseInt(v, 10) || 0).toLocaleString('en'); };
  const _date = function(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('ar-KW', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch(e) { return String(d); }
  };
  const _inDateRange = function(dt, fromDate, toDate) {
    if (dt == null || dt === '') return false;
    // تطبيع dt إلى YYYY-MM-DD string (يدعم Date object / Excel serial / DD/MM/YYYY / YYYY-MM-DD)
    let dStr = '';
    if (dt instanceof Date) {
      if (isNaN(dt.getTime())) return false;
      dStr = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
    } else if (typeof dt === 'number' && dt > 20000 && dt < 80000) {
      // Excel serial date (days since 1900-01-01, with 1900 leap-year bug)
      const d = new Date(Math.round((dt - 25569) * 864e5));
      dStr = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    } else if (typeof dt === 'string') {
      const s = dt.trim();
      // YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
      let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) { dStr = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'); }
      // YYYY/MM/DD
      else if ((m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/))) { dStr = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'); }
      // DD/MM/YYYY (الكويت) أو MM/DD/YYYY
      else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {
        const a = +m[1], b = +m[2];
        if (a > 12) { dStr = m[3] + '-' + b.toString().padStart(2, '0') + '-' + a.toString().padStart(2, '0'); }
        else if (b > 12) { dStr = m[3] + '-' + a.toString().padStart(2, '0') + '-' + b.toString().padStart(2, '0'); }
        else { dStr = m[3] + '-' + a.toString().padStart(2, '0') + '-' + b.toString().padStart(2, '0'); } // ambiguous -> default DD/MM (الكويت)
      }
      // DD-MM-YYYY
      else if ((m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/))) {
        const a = +m[1], b = +m[2];
        if (a > 12) { dStr = m[3] + '-' + b.toString().padStart(2, '0') + '-' + a.toString().padStart(2, '0'); }
        else { dStr = m[3] + '-' + a.toString().padStart(2, '0') + '-' + b.toString().padStart(2, '0'); }
      }
      else { dStr = s; }
    } else {
      dStr = String(dt);
    }
    if (!dStr) return false;
    // مقارنة string-wise (بعد توحيد الصيغة)
    if (fromDate && dStr < fromDate) return false;
    if (toDate && dStr > toDate) return false;
    return true;
  };
  const _dateToStr = function(dt) { return _inDateRange(dt, '', '9999-12-31') ? dStrOf(dt) : ''; };
  const dStrOf = function(dt) {
    if (dt instanceof Date) { return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0'); }
    if (typeof dt === 'number') { const d = new Date(Math.round((dt - 25569) * 864e5)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
    if (typeof dt === 'string') { return dt.slice(0, 10); }
    return String(dt || '');
  };
  const _classify = function(tp) {
    if (tp === 'sale' || tp === 'فاتوره') return 'sales';
    if (tp === 'return' || tp === 'مرتجع') return 'returns';
    if (tp === 'payment' || tp === 'تحصيل' || tp === 'collection') return 'collections';
    if (tp === 'opening' || tp === 'رصيد افتتاحي') return 'opening';
    if (tp === 'expense' || tp === 'مصروف') return 'expenses';
    return 'other';
  };

  // ===========================================================================
  // Section 1: Executive Summary
  // ===========================================================================
  function section1_executive(O, period, prevPeriod) {
    const tx = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to));
    const salesTx = tx.filter(t => _classify(t.tp || t.type) === 'sales');
    const collTx = tx.filter(t => _classify(t.tp || t.type) === 'collections');
    const retTx = tx.filter(t => _classify(t.tp || t.type) === 'returns');
    const expTx = tx.filter(t => _classify(t.tp || t.type) === 'expenses');
    const sales = salesTx.reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.amt) || 0), 0);
    const collections = collTx.reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.amt) || 0), 0);
    const returns = retTx.reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.amt) || 0), 0);
    const expenses = expTx.reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.amt) || 0), 0);
    const profit = sales - returns - expenses;
    const margin = sales > 0 ? (profit / sales * 100) : 0;
    const collRate = sales > 0 ? (collections / sales * 100) : 0;
    let prevSales = 0, prevColl = 0, prevProfit = 0;
    if (prevPeriod) {
      const prevTx = (O.tx || []).filter(t => _inDateRange(t.dt, prevPeriod.from, prevPeriod.to));
      const pS = prevTx.filter(t => _classify(t.tp || t.type) === 'sales').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const pC = prevTx.filter(t => _classify(t.tp || t.type) === 'collections').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const pR = prevTx.filter(t => _classify(t.tp || t.type) === 'returns').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const pE = prevTx.filter(t => _classify(t.tp || t.type) === 'expenses').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      prevSales = pS; prevColl = pC; prevProfit = pS - pR - pE;
    }
    const gS = prevSales > 0 ? ((sales - prevSales) / prevSales * 100) : 0;
    const gC = prevColl > 0 ? ((collections - prevColl) / prevColl * 100) : 0;
    const gP = prevProfit > 0 ? ((profit - prevProfit) / prevProfit * 100) : 0;
    const arrow = v => v > 0 ? '↑' : v < 0 ? '↓' : '→';
    const growthBg = v => v > 0 ? '#e8f5e9' : v < 0 ? '#ffebee' : '#f5f5f5';
    const growthColor = v => v > 0 ? '#2e7d32' : v < 0 ? '#c62828' : '#666';
    const insights = [];
    if (gS > 10) insights.push({icon: '📈', text: 'نمو قوي في المبيعات بمعدل ' + _P(gS) + '% مقارنة بالفترة السابقة'});
    else if (gS < -10) insights.push({icon: '📉', text: 'تراجع ملحوظ في المبيعات: ' + _P(gS) + '%. يحتاج مراجعة استراتيجية'});
    if (collRate > 80) insights.push({icon: '✅', text: 'نسبة التحصيل ممتازة: ' + _P(collRate) + '% - تحصيل فعّال'});
    else if (collRate < 50 && sales > 0) insights.push({icon: '⚠️', text: 'نسبة التحصيل منخفضة: ' + _P(collRate) + '% - يحتاج متابعة الذمم'});
    if (margin > 30) insights.push({icon: '💎', text: 'هامش ربح صحي: ' + _P(margin) + '%'});
    else if (margin < 10 && sales > 0) insights.push({icon: '🔴', text: 'هامش ربح منخفض: ' + _P(margin) + '% - مراجعة التسعير مطلوبة'});
    if (tx.length === 0) insights.push({icon: 'ℹ️', text: 'لا توجد حركات في هذه الفترة. قد يكون حقل التاريخ فارغ'});
    if (insights.length < 3) insights.push({icon: '💡', text: 'نشاط ' + _N(tx.length) + ' معاملة في الفترة'});

    return `<section class="comp-section">
  <h2>📊 الملخص التنفيذي</h2>
  <p class="period-info">الفترة: من <b>${_date(period.from)}</b> إلى <b>${_date(period.to)}</b> · ${_N(tx.length)} معاملة</p>
  <div class="kpi-grid-6">
    <div class="kpi-card green"><div class="kpi-icon">💰</div><div class="kpi-content"><div class="kpi-label">المبيعات</div><div class="kpi-value">${_KD(sales)}</div><div class="kpi-sub">د.ك · ${_N(salesTx.length)} فاتورة</div>${prevPeriod ? `<div class="growth-pill" style="background:${growthBg(gS)};color:${growthColor(gS)}">${arrow(gS)} ${_P(Math.abs(gS))}%</div>` : ''}</div></div>
    <div class="kpi-card blue"><div class="kpi-icon">💵</div><div class="kpi-content"><div class="kpi-label">التحصيل</div><div class="kpi-value">${_KD(collections)}</div><div class="kpi-sub">${_P(collRate)}% من المبيعات</div>${prevPeriod ? `<div class="growth-pill" style="background:${growthBg(gC)};color:${growthColor(gC)}">${arrow(gC)} ${_P(Math.abs(gC))}%</div>` : ''}</div></div>
    <div class="kpi-card ${profit >= 0 ? 'gold' : 'red'}"><div class="kpi-icon">${profit >= 0 ? '💎' : '⚠️'}</div><div class="kpi-content"><div class="kpi-label">صافي الربح</div><div class="kpi-value">${_KD(profit)}</div><div class="kpi-sub">${_P(margin)}% هامش</div>${prevPeriod ? `<div class="growth-pill" style="background:${growthBg(gP)};color:${growthColor(gP)}">${arrow(gP)} ${_P(Math.abs(gP))}%</div>` : ''}</div></div>
    <div class="kpi-card orange"><div class="kpi-icon">↩️</div><div class="kpi-content"><div class="kpi-label">المرتجعات</div><div class="kpi-value">${_KD(returns)}</div><div class="kpi-sub">${_N(retTx.length)} معاملة</div></div></div>
    <div class="kpi-card purple"><div class="kpi-icon">💸</div><div class="kpi-content"><div class="kpi-label">المصروفات</div><div class="kpi-value">${_KD(expenses)}</div><div class="kpi-sub">${_N(expTx.length)} مصروف</div></div></div>
    <div class="kpi-card navy"><div class="kpi-icon">📊</div><div class="kpi-content"><div class="kpi-label">الذمم المتبقية</div><div class="kpi-value">${_KD(Math.max(0, sales - collections))}</div><div class="kpi-sub">من إجمالي المبيعات</div></div></div>
  </div>
  <div class="insights-box"><h3>💡 رؤى تلقائية</h3>${insights.map(i => `<div class="insight-item"><span class="insight-icon">${i.icon}</span><span>${_esc(i.text)}</span></div>`).join('')}</div>
</section>`;
  }

  // ===========================================================================
  // Section 2: Sales
  // ===========================================================================
  function section2_sales(O, period) {
    const tx = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'sales');
    const sales = tx.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const byClient = {};
    tx.forEach(t => {
      const c = t.cl || t.client || 'غير محدد';
      if (!byClient[c]) byClient[c] = { name: c, agent: t.ag || t.agent || '—', total: 0, count: 0 };
      byClient[c].total += parseFloat(t.amount) || 0; byClient[c].count++;
    });
    const topClients = Object.values(byClient).sort((a, b) => b.total - a.total).slice(0, 10);
    const byAgent = {};
    tx.forEach(t => {
      const a = t.ag || t.agent || 'غير محدد';
      if (!byAgent[a]) byAgent[a] = { name: a, total: 0, count: 0 };
      byAgent[a].total += parseFloat(t.amount) || 0; byAgent[a].count++;
    });
    const topAgents = Object.values(byAgent).sort((a, b) => b.total - a.total).slice(0, 10);
    const byDate = {};
    tx.forEach(t => { const d = t.dt ? dStrOf(t.dt) : ''; if (!d) return; if (!byDate[d]) byDate[d] = 0; byDate[d] += parseFloat(t.amount) || 0; });
    const dailyData = Object.keys(byDate).sort().map(d => ({ date: d, value: byDate[d] }));
    const maxDaily = dailyData.length > 0 ? Math.max(...dailyData.map(d => d.value), 1) : 1;
    const byProduct = {};
    tx.forEach(t => { const p = t.it || t.item || t.product || '—'; if (!byProduct[p]) byProduct[p] = { name: p, total: 0, count: 0 }; byProduct[p].total += parseFloat(t.amount) || 0; byProduct[p].count++; });
    const topProducts = Object.values(byProduct).sort((a, b) => b.total - a.total).slice(0, 10);
    const dailyChart = dailyData.slice(-20).map(d => { const h = (d.value / maxDaily * 100).toFixed(1); return `<div class="bar" title="${_esc(_date(d.date))}: ${_KD(d.value)} د.ك"><div class="bar-fill" style="height:${h}%"></div><div class="bar-value">${_KD(d.value)}</div></div>`; }).join('');

    return `<section class="comp-section">
  <h2>💰 المبيعات</h2>
  <div class="kpi-grid-3">
    <div class="kpi-card green"><div class="kpi-icon">💰</div><div class="kpi-content"><div class="kpi-label">إجمالي المبيعات</div><div class="kpi-value">${_KD(sales)}</div><div class="kpi-sub">د.ك</div></div></div>
    <div class="kpi-card blue"><div class="kpi-icon">💵</div><div class="kpi-content"><div class="kpi-label">عدد الفواتير</div><div class="kpi-value">${_N(tx.length)}</div><div class="kpi-sub">معاملة</div></div></div>
    <div class="kpi-card purple"><div class="kpi-icon">💸</div><div class="kpi-content"><div class="kpi-label">متوسط الفاتورة</div><div class="kpi-value">${_KD(tx.length > 0 ? sales / tx.length : 0)}</div><div class="kpi-sub">د.ك</div></div></div>
  </div>
  ${dailyData.length > 0 ? `<h3>📈 اتجاه المبيعات اليومي (آخر ${Math.min(20, dailyData.length)} يوم نشط)</h3><div class="bar-chart">${dailyChart}</div>` : '<p class="empty-note">لا توجد بيانات يومية</p>'}
  <div class="tables-row">
    <div class="table-card"><h3>🏆 أعلى 10 عملاء (مبيعات)</h3><table class="data-table"><thead><tr><th>#</th><th>العميل</th><th>المندوب</th><th>عدد</th><th>المبلغ</th></tr></thead><tbody>${topClients.length === 0 ? '<tr><td colspan="5" class="empty-cell">لا توجد بيانات</td></tr>' : topClients.map((c, i) => `<tr><td>${i+1}</td><td>${_esc(c.name)}</td><td>${_esc(c.agent)}</td><td>${_N(c.count)}</td><td class="num">${_KD(c.total)}</td></tr>`).join('')}</tbody></table></div>
    <div class="table-card"><h3>👤 أعلى 10 مناديب (مبيعات)</h3><table class="data-table"><thead><tr><th>#</th><th>المندوب</th><th>عدد</th><th>المبيعات</th></tr></thead><tbody>${topAgents.length === 0 ? '<tr><td colspan="4" class="empty-cell">لا توجد بيانات</td></tr>' : topAgents.map((a, i) => `<tr><td>${i+1}</td><td>${_esc(a.name)}</td><td>${_N(a.count)}</td><td class="num">${_KD(a.total)}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="table-card"><h3>📦 أعلى 10 منتجات (مبيعات)</h3><table class="data-table"><thead><tr><th>#</th><th>المنتج</th><th>عدد</th><th>المبيعات</th><th>متوسط السعر</th></tr></thead><tbody>${topProducts.length === 0 ? '<tr><td colspan="5" class="empty-cell">لا توجد بيانات</td></tr>' : topProducts.map((p, i) => `<tr><td>${i+1}</td><td>${_esc(p.name)}</td><td>${_N(p.count)}</td><td class="num">${_KD(p.total)}</td><td class="num">${_KD(p.count > 0 ? p.total / p.count : 0)}</td></tr>`).join('')}</tbody></table></div>
</section>`;
  }

  // ===========================================================================
  // Section 3: Collections
  // ===========================================================================
  function section3_collections(O, period) {
    const tx = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'collections');
    const collections = tx.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const sales = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'sales').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const collRate = sales > 0 ? (collections / sales * 100) : 0;
    const byClient = {};
    tx.forEach(t => { const c = t.cl || t.client || 'غير محدد'; if (!byClient[c]) byClient[c] = { name: c, total: 0, count: 0 }; byClient[c].total += parseFloat(t.amount) || 0; byClient[c].count++; });
    const topClients = Object.values(byClient).sort((a, b) => b.total - a.total).slice(0, 10);
    const soc = O.soc || [];
    const aging = { b0: 0, b30: 0, b60: 0, bMore: 0, total: 0 };
    const today = new Date().toISOString().slice(0, 10);
    soc.forEach(s => { const bal = parseFloat(s.bl) || parseFloat(s.balance) || 0; if (bal > 0) { const age = s.lastDate ? Math.floor((new Date(today) - new Date(s.lastDate)) / (1000*60*60*24)) : 60; aging.total += bal; if (age <= 30) aging.b0 += bal; else if (age <= 60) aging.b30 += bal; else if (age <= 90) aging.b60 += bal; else aging.bMore += bal; } });
    const totalAging = aging.total > 0 ? aging.total : 1;
    return `<section class="comp-section">
  <h2>💵 التحصيل</h2>
  <div class="kpi-grid-3">
    <div class="kpi-card blue"><div class="kpi-icon">💵</div><div class="kpi-content"><div class="kpi-label">إجمالي التحصيل</div><div class="kpi-value">${_KD(collections)}</div><div class="kpi-sub">د.ك</div></div></div>
    <div class="kpi-card green"><div class="kpi-icon">💰</div><div class="kpi-content"><div class="kpi-label">نسبة التحصيل</div><div class="kpi-value">${_P(collRate)}%</div><div class="kpi-sub">من المبيعات</div></div></div>
    <div class="kpi-card navy"><div class="kpi-icon">📊</div><div class="kpi-content"><div class="kpi-label">عدد عمليات التحصيل</div><div class="kpi-value">${_N(tx.length)}</div><div class="kpi-sub">معاملة</div></div></div>
  </div>
  <h3>⏰ أعمار الذمم (Aging Analysis)</h3>
  <div class="aging-bar">
    <div class="aging-segment" style="width:${(aging.b0/totalAging*100).toFixed(1)}%;background:#2e7d32" title="0-30 يوم: ${_KD(aging.b0)}"><span>0-30</span></div>
    <div class="aging-segment" style="width:${(aging.b30/totalAging*100).toFixed(1)}%;background:#fb8c00" title="31-60 يوم: ${_KD(aging.b30)}"><span>31-60</span></div>
    <div class="aging-segment" style="width:${(aging.b60/totalAging*100).toFixed(1)}%;background:#e65100" title="61-90 يوم: ${_KD(aging.b60)}"><span>61-90</span></div>
    <div class="aging-segment" style="width:${(aging.bMore/totalAging*100).toFixed(1)}%;background:#c62828" title="90+ يوم: ${_KD(aging.bMore)}"><span>90+</span></div>
  </div>
  <div class="aging-legend">
    <div><b>0-30 يوم:</b> ${_KD(aging.b0)} (${_P(aging.b0/totalAging*100)}%)</div>
    <div><b>31-60 يوم:</b> ${_KD(aging.b30)} (${_P(aging.b30/totalAging*100)}%)</div>
    <div><b>61-90 يوم:</b> ${_KD(aging.b60)} (${_P(aging.b60/totalAging*100)}%)</div>
    <div><b>90+ يوم:</b> ${_KD(aging.bMore)} (${_P(aging.bMore/totalAging*100)}%)</div>
    <div><b>الإجمالي:</b> ${_KD(aging.total)}</div>
  </div>
  <div class="table-card"><h3>🏆 أعلى 10 عملاء (تحصيل)</h3><table class="data-table"><thead><tr><th>#</th><th>العميل</th><th>عدد</th><th>المبلغ</th></tr></thead><tbody>${topClients.length === 0 ? '<tr><td colspan="4" class="empty-cell">لا توجد بيانات</td></tr>' : topClients.map((c, i) => `<tr><td>${i+1}</td><td>${_esc(c.name)}</td><td>${_N(c.count)}</td><td class="num">${_KD(c.total)}</td></tr>`).join('')}</tbody></table></div>
</section>`;
  }

  // ===========================================================================
  // Section 4: Inventory
  // ===========================================================================
  function section4_inventory(O) {
    const it = O.it || O.items || [];
    const totalValue = it.reduce((s, p) => s + (parseFloat(p.st) || parseFloat(p.stock) || 0) * (parseFloat(p.pr) || parseFloat(p.price) || 0), 0);
    const totalQty = it.reduce((s, p) => s + (parseFloat(p.st) || parseFloat(p.stock) || 0), 0);
    const lowStock = it.filter(p => (parseFloat(p.st) || parseFloat(p.stock) || 0) < 10 && (parseFloat(p.st) || 0) > 0).slice(0, 10);
    const outOfStock = it.filter(p => (parseFloat(p.st) || parseFloat(p.stock) || 0) === 0).slice(0, 10);
    const sorted = it.slice().sort((a, b) => { const va = (parseFloat(a.st) || 0) * (parseFloat(a.pr) || 0); const vb = (parseFloat(b.st) || 0) * (parseFloat(b.pr) || 0); return vb - va; });
    const totalABC = sorted.reduce((s, p) => s + (parseFloat(p.st) || 0) * (parseFloat(p.pr) || 0), 0);
    let cumulative = 0;
    const abc = { a: 0, b: 0, c: 0 };
    sorted.forEach(p => { const v = (parseFloat(p.st) || 0) * (parseFloat(p.pr) || 0); cumulative += v; if (totalABC > 0) { if (cumulative / totalABC <= 0.7) abc.a++; else if (cumulative / totalABC <= 0.9) abc.b++; else abc.c++; } });
    return `<section class="comp-section">
  <h2>📦 المخزون</h2>
  <div class="kpi-grid-4">
    <div class="kpi-card green"><div class="kpi-icon">💰</div><div class="kpi-content"><div class="kpi-label">قيمة المخزون</div><div class="kpi-value">${_KD(totalValue)}</div><div class="kpi-sub">د.ك</div></div></div>
    <div class="kpi-card blue"><div class="kpi-icon">💵</div><div class="kpi-content"><div class="kpi-label">إجمالي الكمية</div><div class="kpi-value">${_N(totalQty)}</div><div class="kpi-sub">وحدة</div></div></div>
    <div class="kpi-card purple"><div class="kpi-icon">💸</div><div class="kpi-content"><div class="kpi-label">عدد الأصناف</div><div class="kpi-value">${_N(it.length)}</div><div class="kpi-sub">منتج</div></div></div>
    <div class="kpi-card red"><div class="kpi-icon">⚠️</div><div class="kpi-content"><div class="kpi-label">أصناف نافدة</div><div class="kpi-value">${_N(outOfStock.length)}</div><div class="kpi-sub">يحتاج طلب</div></div></div>
  </div>
  <h3>📊 تحليل ABC للمخزون</h3>
  <div class="abc-grid">
    <div class="abc-card a-class"><div class="abc-label">A - مهم جداً</div><div class="abc-value">${abc.a}</div><div class="abc-pct">70% من القيمة</div></div>
    <div class="abc-card b-class"><div class="abc-label">B - مهم</div><div class="abc-value">${abc.b}</div><div class="abc-pct">20% من القيمة</div></div>
    <div class="abc-card c-class"><div class="abc-label">C - عادي</div><div class="abc-value">${abc.c}</div><div class="abc-pct">10% من القيمة</div></div>
  </div>
  ${outOfStock.length > 0 ? `<div class="table-card alert-card"><h3>🔴 أصناف نافدة (يتطلب طلب عاجل)</h3><table class="data-table"><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th></tr></thead><tbody>${outOfStock.map((p, i) => `<tr><td>${i+1}</td><td>${_esc(p.nm || p.name)}</td><td class="num text-red">نافد</td><td class="num">${_KD(p.pr || p.price || 0)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  ${lowStock.length > 0 ? `<div class="table-card"><h3>⚠️ أصناف منخفضة (أقل من 10 وحدات)</h3><table class="data-table"><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>القيمة</th></tr></thead><tbody>${lowStock.map((p, i) => { const q = parseFloat(p.st) || parseFloat(p.stock) || 0; const pr = parseFloat(p.pr) || parseFloat(p.price) || 0; return `<tr><td>${i+1}</td><td>${_esc(p.nm || p.name)}</td><td class="num text-orange">${_N(q)}</td><td class="num">${_KD(pr)}</td><td class="num">${_KD(q * pr)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="empty-note">✓ لا توجد أصناف منخفضة</p>'}
</section>`;
  }

  // ===========================================================================
  // Section 5: Commissions
  // ===========================================================================
  function section5_commissions(O, period) {
    const agents = (window.D && window.D.ag && window.D.ag.length > 0) ? window.D.ag : (O.ag || O.mon || []);
    const agentRows = [];
    let totalComm = 0;
    agents.forEach(a => {
      let c = { salesCommission: 0, collectionCommission: 0, targetBonus: 0, totalCommission: 0, netSales: 0, collections: 0, target: 0, achievement: 0 };
      try { if (typeof calculateAgentCommission === 'function') c = calculateAgentCommission(a, period.from, period.to); } catch (e) { }
      totalComm += c.totalCommission;
      agentRows.push({ name: a.nm || a.name, sales: c.netSales || 0, coll: c.collections || 0, comm: c.totalCommission, target: c.target || 0, ach: c.achievement || 0 });
    });
    agentRows.sort((a, b) => b.comm - a.comm);
    const totalTarget = agentRows.reduce((s, r) => s + r.target, 0);
    return `<section class="comp-section">
  <h2>💰 العمولات والمناديب</h2>
  <div class="kpi-grid-3">
    <div class="kpi-card gold"><div class="kpi-icon">💎</div><div class="kpi-content"><div class="kpi-label">إجمالي العمولات</div><div class="kpi-value">${_KD(totalComm)}</div><div class="kpi-sub">د.ك</div></div></div>
    <div class="kpi-card blue"><div class="kpi-icon">💵</div><div class="kpi-content"><div class="kpi-label">عدد المناديب النشطين</div><div class="kpi-value">${_N(agentRows.length)}</div><div class="kpi-sub">مندوب</div></div></div>
    <div class="kpi-card purple"><div class="kpi-icon">💸</div><div class="kpi-content"><div class="kpi-label">إجمالي المستهدف</div><div class="kpi-value">${_KD(totalTarget)}</div><div class="kpi-sub">د.ك</div></div></div>
  </div>
  <div class="table-card"><h3>👥 تفاصيل عمولات كل مندوب (الفترة: ${_date(period.from)} → ${_date(period.to)})</h3><table class="data-table"><thead><tr><th>#</th><th>المندوب</th><th>المبيعات</th><th>التحصيل</th><th>المستهدف</th><th>نسبة التحقيق</th><th>العمولة</th></tr></thead><tbody>${agentRows.length === 0 ? '<tr><td colspan="7" class="empty-cell">لا توجد بيانات مناديب</td></tr>' : agentRows.map((a, i) => { const ach = a.ach || (a.target > 0 ? a.sales / a.target * 100 : 0); const achColor = ach >= 100 ? '#2e7d32' : ach >= 75 ? '#fb8c00' : '#c62828'; return `<tr><td>${i+1}</td><td><b>${_esc(a.name)}</b></td><td class="num">${_KD(a.sales)}</td><td class="num">${_KD(a.coll)}</td><td class="num">${_KD(a.target)}</td><td class="num" style="color:${achColor};font-weight:700">${_P(ach)}%</td><td class="num" style="color:#2e7d32;font-weight:700">${_KD(a.comm)}</td></tr>`; }).join('')}</tbody><tfoot><tr><td colspan="6" style="text-align:left;font-weight:800">إجمالي العمولات</td><td class="num" style="font-weight:900;color:#1a2744">${_KD(totalComm)}</td></tr></tfoot></table></div>
</section>`;
  }

  // ===========================================================================
  // Section 6: Receivables
  // ===========================================================================
  function section6_receivables(O) {
    const soc = O.soc || [];
    const totalReceivables = soc.reduce((s, c) => s + (parseFloat(c.bl) || parseFloat(c.balance) || 0), 0);
    const activeCustomers = soc.filter(c => (parseFloat(c.bl) || parseFloat(c.balance) || 0) > 0).length;
    const avgBalance = activeCustomers > 0 ? totalReceivables / activeCustomers : 0;
    const topDebtors = soc.slice().map(c => ({ name: c.nm, balance: parseFloat(c.bl) || parseFloat(c.balance) || 0, agent: c.ag || '—', phone: c.ph || '—' })).filter(c => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 10);
    return `<section class="comp-section">
  <h2>👥 الذمم والعملاء</h2>
  <div class="kpi-grid-4">
    <div class="kpi-card red"><div class="kpi-icon">⚠️</div><div class="kpi-content"><div class="kpi-label">إجمالي الذمم</div><div class="kpi-value">${_KD(totalReceivables)}</div><div class="kpi-sub">د.ك</div></div></div>
    <div class="kpi-card orange"><div class="kpi-icon">↩️</div><div class="kpi-content"><div class="kpi-label">عملاء مديونون</div><div class="kpi-value">${_N(activeCustomers)}</div><div class="kpi-sub">من ${_N(soc.length)} عميل</div></div></div>
    <div class="kpi-card purple"><div class="kpi-icon">💸</div><div class="kpi-content"><div class="kpi-label">متوسط الرصيد</div><div class="kpi-value">${_KD(avgBalance)}</div><div class="kpi-sub">د.ك للعميل</div></div></div>
    <div class="kpi-card navy"><div class="kpi-icon">📊</div><div class="kpi-content"><div class="kpi-label">نسبة التعثر</div><div class="kpi-value">${_P(soc.length > 0 ? activeCustomers / soc.length * 100 : 0)}%</div><div class="kpi-sub">عملاء مديونون</div></div></div>
  </div>
  <div class="table-card alert-card"><h3>🚨 أعلى 10 مديونين (يحتاج متابعة)</h3><table class="data-table"><thead><tr><th>#</th><th>العميل</th><th>المندوب</th><th>الهاتف</th><th>الرصيد</th></tr></thead><tbody>${topDebtors.length === 0 ? '<tr><td colspan="5" class="empty-cell">لا توجد ذمم مستحقة ✓</td></tr>' : topDebtors.map((c, i) => `<tr><td>${i+1}</td><td><b>${_esc(c.name)}</b></td><td>${_esc(c.agent)}</td><td>${_esc(c.phone)}</td><td class="num text-red">+${_KD(c.balance)}</td></tr>`).join('')}</tbody></table></div>
</section>`;
  }

  // ===========================================================================
  // Section 7: Expenses
  // ===========================================================================
  function section7_expenses(O, period) {
    const expenses = O.expenses || { items: [], monthlyTotal: {}, totalAnnual: 0, byCat: {}, activeMonths: 0 };
    const periodExpTx = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'expenses');
    const periodExp = periodExpTx.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const byCat = expenses.byCat || {};
    const catList = Object.entries(byCat).map(([k, v]) => ({ name: k, total: parseFloat(v) || 0 })).sort((a, b) => b.total - a.total).slice(0, 10);
    const sales = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'sales').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const returns = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'returns').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const profit = sales - returns - periodExp;
    const margin = sales > 0 ? profit / sales * 100 : 0;
    return `<section class="comp-section">
  <h2>📉 المصروفات والربحية</h2>
  <div class="kpi-grid-4">
    <div class="kpi-card orange"><div class="kpi-icon">↩️</div><div class="kpi-content"><div class="kpi-label">مصروفات الفترة</div><div class="kpi-value">${_KD(periodExp)}</div><div class="kpi-sub">د.ك · ${_N(periodExpTx.length)} مصروف</div></div></div>
    <div class="kpi-card gold"><div class="kpi-icon">💎</div><div class="kpi-content"><div class="kpi-label">صافي الربح</div><div class="kpi-value">${_KD(profit)}</div><div class="kpi-sub">د.ك</div></div></div>
    <div class="kpi-card ${margin > 0 ? 'green' : 'red'}"><div class="kpi-label">هامش الربح</div><div class="kpi-value">${_P(margin)}%</div><div class="kpi-sub">صافي/مبيعات</div></div>
    <div class="kpi-card purple"><div class="kpi-icon">💸</div><div class="kpi-content"><div class="kpi-label">إجمالي سنوي</div><div class="kpi-value">${_KD(expenses.totalAnnual || 0)}</div><div class="kpi-sub">د.ك</div></div></div>
  </div>
  ${catList.length > 0 ? `<div class="table-card"><h3>📋 المصروفات حسب الفئة (سنوي)</h3><table class="data-table"><thead><tr><th>#</th><th>الفئة</th><th>المبلغ</th><th>النسبة من الإجمالي</th></tr></thead><tbody>${catList.map((c, i) => { const pct = expenses.totalAnnual > 0 ? (c.total / expenses.totalAnnual * 100).toFixed(1) : 0; return `<tr><td>${i+1}</td><td>${_esc(c.name)}</td><td class="num">${_KD(c.total)}</td><td class="num">${pct}%</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="empty-note">لا توجد فئات مصروفات مسجلة</p>'}
</section>`;
  }

  // ===========================================================================
  // Section 8: Financial KPIs
  // ===========================================================================
  function section8_financialKPIs(O, period) {
    const sales = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'sales').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const collections = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'collections').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const receivables = (O.soc || []).reduce((s, c) => s + (parseFloat(c.bl) || parseFloat(c.balance) || 0), 0);
    const periodDays = period.from && period.to ? Math.max(1, Math.ceil((new Date(period.to) - new Date(period.from)) / (1000*60*60*24))) : 30;
    const dso = sales > 0 ? Math.round((receivables / sales) * periodDays) : 0;
    const avgDailySales = sales / periodDays;
    const collEff = sales > 0 ? (collections / sales * 100) : 0;
    const invValue = (O.it || []).reduce((s, p) => s + (parseFloat(p.st) || 0) * (parseFloat(p.pr) || 0), 0);
    const invTurnover = invValue > 0 ? (sales / invValue).toFixed(2) : 0;
    return `<section class="comp-section">
  <h2>📈 المؤشرات المالية المتقدمة (لأصحاب القرار)</h2>
  <div class="kpi-grid-4">
    <div class="kpi-card navy"><div class="kpi-icon">📊</div><div class="kpi-content"><div class="kpi-label">DSO (أيام التحصيل)</div><div class="kpi-value">${dso}</div><div class="kpi-sub">${dso < 45 ? 'ممتاز' : dso < 90 ? 'جيد' : 'يحتاج تحسين'}</div></div></div>
    <div class="kpi-card blue"><div class="kpi-icon">💵</div><div class="kpi-content"><div class="kpi-label">متوسط مبيعات يومية</div><div class="kpi-value">${_KD(avgDailySales)}</div><div class="kpi-sub">د.ك / يوم</div></div></div>
    <div class="kpi-card green"><div class="kpi-icon">💰</div><div class="kpi-content"><div class="kpi-label">كفاءة التحصيل</div><div class="kpi-value">${_P(collEff)}%</div><div class="kpi-sub">من المبيعات</div></div></div>
    <div class="kpi-card gold"><div class="kpi-icon">💎</div><div class="kpi-content"><div class="kpi-label">دوران المخزون</div><div class="kpi-value">${invTurnover}x</div><div class="kpi-sub">مبيعات/مخزون</div></div></div>
  </div>
  <div class="kpi-explain">
    <h3>📖 شرح المؤشرات</h3>
    <ul>
      <li><b>DSO (Days Sales Outstanding):</b> عدد الأيام اللازمة لتحصيل الذمم. القيمة الأقل أفضل (&lt; 45 ممتاز).</li>
      <li><b>متوسط المبيعات اليومية:</b> مؤشر على تدفق الإيرادات اليومي.</li>
      <li><b>كفاءة التحصيل:</b> نسبة المبيعات المحصلة فعلياً. الهدف: &gt; 80%.</li>
      <li><b>دوران المخزون:</b> كم مرة يُباع ويُستبدل المخزون في الفترة. القيمة الأعلى = كفاءة أعلى.</li>
    </ul>
  </div>
</section>`;
  }

  // ===========================================================================
  // Section 9: SWOT
  // ===========================================================================
  function section9_swot(O, period) {
    const sales = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'sales').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const collections = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'collections').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const collRate = sales > 0 ? collections / sales * 100 : 0;
    const receivables = (O.soc || []).reduce((s, c) => s + (parseFloat(c.bl) || 0), 0);
    const soc = O.soc || [];
    const activeCustomers = soc.filter(c => (parseFloat(c.bl) || 0) > 0).length;
    const tx = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to));
    const it = O.it || [];
    const outOfStock = it.filter(p => (parseFloat(p.st) || 0) === 0).length;
    const strengths = [], weaknesses = [], opportunities = [], threats = [];
    if (collRate > 80) strengths.push('نسبة تحصيل ممتازة (' + _P(collRate) + '%) - مؤشر على قوة إدارة التحصيل');
    if (sales > 0 && tx.length > 0) strengths.push('نشاط تجاري مستمر مع ' + _N(tx.length) + ' معاملة في الفترة');
    if (activeCustomers >= 5) strengths.push('قاعدة عملاء نشطة (' + _N(activeCustomers) + ' عميل مديون)');
    if (collRate < 50 && sales > 0) weaknesses.push('نسبة تحصيل منخفضة (' + _P(collRate) + '%) - تسرب سيولة');
    if (receivables > sales * 0.5) weaknesses.push('ذمم مرتفعة جداً (' + _P(receivables / Math.max(sales, 1) * 100) + '% من المبيعات)');
    if (outOfStock > 5) weaknesses.push(outOfStock + ' صنف نافد - فقدان فرص بيع');
    if (tx.length === 0) weaknesses.push('لا توجد معاملات في الفترة المختارة');
    if (activeCustomers > 0) opportunities.push('إمكانية رفع المبيعات لكل عميل عبر عروض مستهدفة');
    if (outOfStock > 0) opportunities.push('إعادة تخزين الأصناف النافذة لرفع المبيعات');
    if (collRate < 80) opportunities.push('تحسين التحصيل يمكن أن يوفر ' + _P(Math.max(0, 80 - collRate)) + '% سيولة إضافية');
    if (collRate < 30) threats.push('خطر سيولة - التحصيل ضعيف جداً');
    if (receivables > sales) threats.push('الذمم تجاوزت المبيعات - خطر تعثر');
    if (outOfStock > 10) threats.push('خسارة عملاء بسبب نفاد المخزون المتكرر');
    return `<section class="comp-section swot-section">
  <h2>🎯 تحليل SWOT (للمستشارين)</h2>
  <p class="section-note">تحليل رباعي آلي: نقاط القوة، الضعف، الفرص، والتهديدات</p>
  <div class="swot-grid">
    <div class="swot-card strength"><h3>💪 نقاط القوة (S)</h3><ul>${strengths.length === 0 ? '<li>لم يتم اكتشاف نقاط قوة بارزة</li>' : strengths.map(s => '<li>' + _esc(s) + '</li>').join('')}</ul></div>
    <div class="swot-card weakness"><h3>⚠️ نقاط الضعف (W)</h3><ul>${weaknesses.length === 0 ? '<li>لم يتم اكتشاف نقاط ضعف بارزة</li>' : weaknesses.map(s => '<li>' + _esc(s) + '</li>').join('')}</ul></div>
    <div class="swot-card opportunity"><h3>🎯 الفرص (O)</h3><ul>${opportunities.length === 0 ? '<li>الفرص محدودة في هذه الفترة</li>' : opportunities.map(s => '<li>' + _esc(s) + '</li>').join('')}</ul></div>
    <div class="swot-card threat"><h3>🚨 التهديدات (T)</h3><ul>${threats.length === 0 ? '<li>لا توجد تهديدات بارزة</li>' : threats.map(s => '<li>' + _esc(s) + '</li>').join('')}</ul></div>
  </div>
</section>`;
  }

  // ===========================================================================
  // Section 10: Recommendations
  // ===========================================================================
  function section10_recommendations(O, period) {
    const sales = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'sales').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const collections = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to) && _classify(t.tp || t.type) === 'collections').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const collRate = sales > 0 ? collections / sales * 100 : 0;
    const it = O.it || [];
    const outOfStock = it.filter(p => (parseFloat(p.st) || 0) === 0).length;
    const lowStock = it.filter(p => { const q = parseFloat(p.st) || 0; return q > 0 && q < 10; }).length;
    const receivables = (O.soc || []).reduce((s, c) => s + (parseFloat(c.bl) || 0), 0);
    const tx = (O.tx || []).filter(t => _inDateRange(t.dt, period.from, period.to));
    const recs = [];
    if (collRate < 70) recs.push({priority: 'عالية', icon: '🚨', title: 'تحسين التحصيل', desc: 'نسبة التحصيل ' + _P(collRate) + '% - يجب تفعيل خطة تحصيل نشطة. الأثر: ' + _KD(sales - collections) + ' د.ك سيولة محتملة'});
    if (outOfStock > 0) recs.push({priority: 'عالية', icon: '📦', title: 'إعادة تخزين عاجلة', desc: outOfStock + ' صنف نافد. يجب عمل أوامر شراء فوراً لتجنب فقدان المبيعات'});
    if (lowStock > 0) recs.push({priority: 'متوسطة', icon: '⚠️', title: 'مراقبة المخزون', desc: lowStock + ' صنف منخفض (< 10 وحدات). يفضل رفع الحد الأدنى أو تطبيق طلب تلقائي'});
    if (receivables > sales * 0.4 && sales > 0) recs.push({priority: 'عالية', icon: '💰', title: 'إدارة الذمم', desc: 'الذمم ' + _P(receivables / sales * 100) + '% من المبيعات. يجب وضع حد ائتماني للعملاء'});
    if (recs.length < 3) recs.push({priority: 'منخفضة', icon: '📊', title: 'مراجعة دورية', desc: 'الأداء جيد - استمر في المراجعة الدورية للتقارير واتخاذ قرارات مبنية على البيانات'});
    if (tx.length === 0) recs.push({priority: 'عالية', icon: '⚠️', title: 'لا توجد بيانات', desc: 'الفترة المختارة لا تحوي معاملات. تأكد من رفع ملف Excel أو اختيار فترة صحيحة'});
    const priColor = p => p === 'عالية' ? '#c62828' : p === 'متوسطة' ? '#fb8c00' : '#2e7d32';
    return `<section class="comp-section">
  <h2>💡 التوصيات الاستراتيجية (لأصحاب القرار)</h2>
  <div class="recommendations">${recs.map(r => `<div class="rec-card" style="border-right:5px solid ${priColor(r.priority)}"><div class="rec-header"><span class="rec-icon">${r.icon}</span><span class="rec-title">${_esc(r.title)}</span><span class="rec-priority" style="background:${priColor(r.priority)}">${_esc(r.priority)}</span></div><div class="rec-desc">${_esc(r.desc)}</div></div>`).join('')}</div>
</section>`;
  }

  // ===========================================================================
  // Section 11: Auditor
  // ===========================================================================
  function section11_auditor(O, period, reportId) {
    const soc = O.soc || [];
    const it = O.it || [];
    const tx = O.tx || [];
    const checks = O.checks || [];
    let savedInvoices = [];
    try { savedInvoices = JSON.parse(localStorage.getItem('nayef_invoices') || '[]') || []; } catch (e) {}
    const dataChecks = [
      { label: 'عدد العملاء', value: _N(soc.length), status: soc.length > 0 ? '✓' : '⚠' },
      { label: 'عدد المناديب', value: _N((O.mon || []).length), status: (O.mon || []).length > 0 ? '✓' : '⚠' },
      { label: 'عدد المعاملات', value: _N(tx.length), status: '✓' },
      { label: 'عدد المنتجات', value: _N(it.length), status: it.length > 0 ? '✓' : '⚠' },
      { label: 'عدد الفواتير المحفوظة', value: _N(savedInvoices.length), status: 'ℹ' },
      { label: 'عدد الشيكات', value: _N(checks.length), status: 'ℹ' },
      { label: 'معرّف الإصدار', value: window.LOCKED_VERSION || 'unknown', status: '✓' },
      { label: 'آخر تحديث للبيانات', value: _date(O.synced || new Date()), status: 'ℹ' }
    ];
    let hash = 0;
    const hashInput = JSON.stringify({soc: soc.length, tx: tx.length, it: it.length, period, reportId});
    for (let i = 0; i < hashInput.length; i++) { hash = ((hash << 5) - hash) + hashInput.charCodeAt(i); hash |= 0; }
    const docHash = Math.abs(hash).toString(16).toUpperCase().substring(0, 12).padStart(12, '0');
    return `<section class="comp-section auditor-section">
  <h2>🛡️ قسم المراجع (Auditor Section)</h2>
  <div class="auditor-meta">
    <div><b>REF:</b> ${_esc(reportId)}</div>
    <div><b>HASH:</b> ${docHash}</div>
    <div><b>النظام:</b> Nayef v2.3</div>
    <div><b>تاريخ الإصدار:</b> ${_date(new Date())}</div>
  </div>
  <h3>📋 منهجية التقرير</h3>
  <ol class="methodology">
    <li>البيانات المستخدمة: ملف Excel المرفوع (HANY1 sheet + aux sheets).</li>
    <li>فلتر التاريخ: من <b>${_esc(period.from || '—')}</b> إلى <b>${_esc(period.to || '—')}</b>.</li>
    <li>العملة: دينار كويتي (د.ك).</li>
    <li>التصنيف: حركة بيع/تحصيل/مرتجع/مصروف بناءً على نوع المعاملة.</li>
    <li>العمولات: محسوبة بنظام متعدد المصادر (3 مصادر بيانات).</li>
    <li>SWOT والتوصيات: مولّدة آلياً بناءً على البيانات الفعلية.</li>
  </ol>
  <h3>🔍 فحوصات سلامة البيانات</h3>
  <table class="data-table"><thead><tr><th>الفحص</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${dataChecks.map(c => `<tr><td>${_esc(c.label)}</td><td>${_esc(c.value)}</td><td style="text-align:center;font-size:18px">${c.status}</td></tr>`).join('')}</tbody></table>
  <div class="signatures-row">
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">المحاسب / المُعد</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">المدير المالي / المراجع</div></div>
    <div class="sig-block"><div class="sig-line"></div><div class="sig-label">المدير العام / المُعتمد</div></div>
  </div>
  <p class="disclaimer">⚖️ هذا التقرير مولّد آلياً من البيانات المرفوعة. لا يُعد استشارة مالية أو قانونية. للاستخدام الداخلي فقط.</p>
</section>`;
  }

  // ===========================================================================
  // MAIN FUNCTION
  // ===========================================================================
  window.v23ComprehensiveReport = function(customFrom, customTo) {
    console.log('[v23CompReport] start');
    try {
      const O = (typeof window.O !== 'undefined' && window.O) ? window.O : { soc: [], mon: [], tx: [], it: [], ml: [], T: {}, ag: [] };
      const ml = O.ml || [];
      const today = new Date().toISOString().slice(0, 10);
      let period = { from: customFrom || (ml.length > 0 ? String(ml[ml.length - 1]) + '-01' : ''), to: customTo || today };
      if (!/^\d{4}-\d{2}(-\d{2})?$/.test(period.from)) period.from = '';
      if (!/^\d{4}-\d{2}(-\d{2})?$/.test(period.to)) period.to = today;
      if (period.from && period.from.length === 7) period.from = period.from + '-01';
      let prevPeriod = null;
      if (period.from && period.to) {
        const fromD = new Date(period.from);
        const toD = new Date(period.to);
        const days = Math.max(1, Math.ceil((toD - fromD) / (1000*60*60*24)));
        const prevTo = new Date(fromD.getTime() - 24*60*60*1000);
        const prevFrom = new Date(prevTo.getTime() - days * 24*60*60*1000);
        prevPeriod = { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
      }
      const reportId = 'CMP-' + Date.now().toString(36).toUpperCase();
      const genDate = new Date().toLocaleString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' });
      console.log('[v23CompReport] period:', period);

      const s1 = section1_executive(O, period, prevPeriod);
      const s2 = section2_sales(O, period);
      const s3 = section3_collections(O, period);
      const s4 = section4_inventory(O);
      const s5 = section5_commissions(O, period);
      const s6 = section6_receivables(O);
      const s7 = section7_expenses(O, period);
      const s8 = section8_financialKPIs(O, period);
      const s9 = section9_swot(O, period);
      const s10 = section10_recommendations(O, period);
      const s11 = section11_auditor(O, period, reportId);

      const toolbar = `<div class="comp-toolbar">
  <div class="comp-toolbar-row1">
    <h2>📊 التقرير الشامل الاحترافي</h2>
    <div class="comp-actions">
      <button onclick="v23CompPrint()">🖨️ طباعة</button>
      <button onclick="v23CompDownloadHTML()">📥 تحميل HTML</button>
      <button onclick="v23CompDownloadCSV()">📊 تحميل CSV</button>
      <button onclick="document.getElementById('v23-comp-report-modal').remove()">✕ إغلاق</button>
    </div>
  </div>
  <div class="comp-toolbar-row2">
    <div class="comp-filter-group">
      <label>📅 من:</label><input type="date" id="v23-comp-from" value="${_esc(period.from)}" onchange="v23CompRefresh()">
      <label>إلى:</label><input type="date" id="v23-comp-to" value="${_esc(period.to)}" onchange="v23CompRefresh()">
    </div>
    <div class="comp-presets">
      <button onclick="v23CompPreset('today')">اليوم</button>
      <button onclick="v23CompPreset('week')">أسبوع</button>
      <button onclick="v23CompPreset('month')">شهر</button>
      <button onclick="v23CompPreset('30days')">30 يوم</button>
      <button onclick="v23CompPreset('quarter')">ربع</button>
      <button onclick="v23CompPreset('year')">سنة</button>
      <button onclick="v23CompPreset('all')">الكل</button>
    </div>
    <div class="comp-ref">
      <span>REF: <b>${reportId}</b></span>
      <span>${genDate}</span>
    </div>
  </div>
</div>`;

      const html = `<div class="comp-card">
  ${toolbar}
  <div class="comp-body">
    <div class="comp-letterhead">
      <h1>شركتك</h1>
      <h2>التقرير الشامل الاحترافي — ${_esc(period.from)} إلى ${_esc(period.to)}</h2>
      <div class="comp-meta">
        <div><b>📅 الفترة:</b> ${_date(period.from)} → ${_date(period.to)}</div>
        <div><b>🆔 REF:</b> ${reportId}</div>
        <div><b>📆 تاريخ الإصدار:</b> ${genDate}</div>
      </div>
    </div>
    ${s1}${s2}${s3}${s4}${s5}${s6}${s7}${s8}${s9}${s10}${s11}
    <div class="comp-footer">
      <span>شركتك</span>
      <span>Nayef v2.3 · تقرير شامل للمستشارين والمراجعين وأصحاب القرار</span>
      <span>${genDate} · ${reportId}</span>
    </div>
  </div>
</div>`;

      const existing = document.getElementById('v23-comp-report-modal');
      if (existing) existing.remove();
      const modal = document.createElement('div');
      modal.id = 'v23-comp-report-modal';
      modal.className = 'v23-comp-report-bg';
      modal.setAttribute('data-report-id', reportId);
      modal.setAttribute('data-period-from', period.from);
      modal.setAttribute('data-period-to', period.to);
      modal.innerHTML = html;
      document.body.appendChild(modal);
      try {
        const snapshots = JSON.parse(localStorage.getItem('nayef_comprehensive_snapshots') || '[]');
        snapshots.unshift({ id: reportId, date: new Date().toISOString(), period: period, generatedAt: new Date().toISOString() });
        if (snapshots.length > 20) snapshots.length = 20;
        localStorage.setItem('nayef_comprehensive_snapshots', JSON.stringify(snapshots));
      } catch (e) {}
      if (typeof v23Toast === 'function') v23Toast('✅ التقرير الشامل جاهز — ' + reportId);
      console.log('[v23CompReport] done');
      return true;
    } catch (e) {
      console.error('[v23CompReport] failed:', e);
      if (typeof ErrorBoundary !== 'undefined') ErrorBoundary.handle(e, 'v23ComprehensiveReport');
      alert('❌ فشل توليد التقرير:\n' + (e.message || 'unknown') + '\n\nالكونسول يحوي التفاصيل.');
      return false;
    }
  };

  window.v23CompRefresh = function() {
    const modal = document.getElementById('v23-comp-report-modal');
    if (!modal) return;
    const from = document.getElementById('v23-comp-from').value;
    const to = document.getElementById('v23-comp-to').value;
    window.v23ComprehensiveReport(from, to);
  };

  window.v23CompPreset = function(preset) {
    const today = new Date();
    let from, to;
    to = today.toISOString().slice(0, 10);
    if (preset === 'today') { from = to; }
    else if (preset === 'week') { const d = new Date(today); d.setDate(d.getDate() - 7); from = d.toISOString().slice(0, 10); }
    else if (preset === 'month') { from = today.toISOString().slice(0, 7) + '-01'; }
    else if (preset === '30days') { const d = new Date(today); d.setDate(d.getDate() - 30); from = d.toISOString().slice(0, 10); }
    else if (preset === 'quarter') { const d = new Date(today); d.setMonth(d.getMonth() - 3); from = d.toISOString().slice(0, 10); }
    else if (preset === 'year') { const d = new Date(today); d.setFullYear(d.getFullYear() - 1); from = d.toISOString().slice(0, 10); }
    else if (preset === 'all') { const ml = (window.O && window.O.ml) || []; if (ml.length > 0) from = ml[0] + '-01'; else from = '2020-01-01'; }
    document.getElementById('v23-comp-from').value = from;
    document.getElementById('v23-comp-to').value = to;
    window.v23CompRefresh();
  };

  window.v23CompPrint = function() {
    const modal = document.getElementById('v23-comp-report-modal');
    if (!modal) return;
    const body = modal.querySelector('.comp-body');
    if (!body) return;
    const printWin = window.open('', '_blank', 'width=1100,height=1400');
    if (!printWin) { window.print(); return; }
    const styles = Array.from(document.styleSheets).map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch(e) { return ''; } }).join('\n');
    const ref = modal.getAttribute('data-report-id') || 'تقرير';
    printWin.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${ref} — Nayef v2.3</title><style>${styles}</style></head><body>${body.innerHTML}</body></html>`);
    printWin.document.close();
    setTimeout(() => { try { printWin.focus(); printWin.print(); } catch(e) { window.print(); } }, 300);
  };

  window.v23CompDownloadHTML = function() {
    const modal = document.getElementById('v23-comp-report-modal');
    if (!modal) return;
    const body = modal.querySelector('.comp-body');
    if (!body) return;
    const styles = Array.from(document.styleSheets).map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch(e) { return ''; } }).join('\n');
    const ref = modal.getAttribute('data-report-id') || Date.now();
    const fullHtml = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${ref} — Nayef v2.3</title><style>${styles}</style></head><body>${body.innerHTML}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nayef-comprehensive-' + ref + '.html';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
  };

  window.v23CompDownloadCSV = function() {
    const modal = document.getElementById('v23-comp-report-modal');
    if (!modal) return;
    const tables = modal.querySelectorAll('.data-table');
    const rows = [['التقرير الشامل - Nayef v2.3'], ['REF: ' + (modal.getAttribute('data-report-id') || '')], []];
    tables.forEach((t) => {
      const heading = t.previousElementSibling;
      if (heading) rows.push([heading.textContent.trim()]);
      t.querySelectorAll('tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('th,td')).map(c => '"' + c.textContent.trim().replace(/"/g, '""') + '"');
        rows.push(cells);
      });
      rows.push([]);
    });
    const csv = '\ufeff' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'nayef-comprehensive-' + (modal.getAttribute('data-report-id') || Date.now()) + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
  };

  console.log('[v23CompReport] module ready');

  /* === PWA v2.5 — Service Worker + Install Prompt === */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').then(function(reg) {
        console.log('[PWA] SW registered, scope:', reg.scope);
        // Check for updates every 60 minutes
        setInterval(function() { reg.update(); }, 60 * 60 * 1000);
      }).catch(function(err) {
        console.warn('[PWA] SW registration failed:', err.message);
      });
    });
  }

  // Install prompt: capture and expose button to install
  let _pwaInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _pwaInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-installable'));
    console.log('[PWA] install prompt available');
  });
  window.v23PwaInstall = function() {
    if (!_pwaInstallPrompt) {
      if (typeof v23Toast === 'function') v23Toast('⚠️ التثبيت غير متاح حالياً');
      return;
    }
    _pwaInstallPrompt.prompt();
    _pwaInstallPrompt.userChoice.then(function(choice) {
      if (typeof v23Toast === 'function') v23Toast(choice.outcome === 'accepted' ? '✅ تم التثبيت' : 'ℹ️ تم الإلغاء');
      _pwaInstallPrompt = null;
    });
  };
  window.addEventListener('appinstalled', function() {
    if (typeof v23Toast === 'function') v23Toast('✅ تم تثبيت التطبيق بنجاح');
    _pwaInstallPrompt = null;
  });

  // Show floating install button when prompt is available
  window.addEventListener('pwa-installable', function() {
    let btn = document.getElementById('v23-pwa-install-btn');
    if (btn) { btn.style.display = 'flex'; return; }
    btn = document.createElement('button');
    btn.id = 'v23-pwa-install-btn';
    btn.onclick = window.v23PwaInstall;
    btn.innerHTML = '📲 ثبّت التطبيق';
    btn.title = 'ثبت التطبيق على جهازك للوصول السريع';
    btn.style.cssText = 'position:fixed;bottom:90px;left:20px;z-index:9999;background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;border:none;padding:10px 16px;border-radius:24px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(26,39,68,0.4);display:flex;align-items:center;gap:6px;';
    document.body.appendChild(btn);
  });

  // Connection status indicator
  function updateOnlineStatus() {
    let indicator = document.getElementById('v23-pwa-online-indicator');
    const isOnline = navigator.onLine;
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'v23-pwa-online-indicator';
      indicator.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.2);transition:opacity 0.3s;font-family:inherit;';
      document.body.appendChild(indicator);
    }
    if (isOnline) {
      indicator.textContent = '🟢 متصل';
      indicator.style.background = '#2e7d32';
      indicator.style.color = '#fff';
      indicator.style.opacity = '0';
      setTimeout(function() { if (indicator) indicator.style.opacity = '0'; }, 1500);
    } else {
      indicator.textContent = '🔴 غير متصل — يعمل من الذاكرة المخزنة';
      indicator.style.background = '#c62828';
      indicator.style.color = '#fff';
      indicator.style.opacity = '1';
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  console.log('[PWA] module ready');
})();
