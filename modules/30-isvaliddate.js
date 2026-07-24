/* ════════════════════════════════════════════════════════════════════════
   🛡️ الإصلاحات الجذرية — مُدمجة مع الكود الأصلي
   ════════════════════════════════════════════════════════════════════════ */
/**
 * ════════════════════════════════════════════════════════════════════════
 *  🛡️ الإصلاحات الجذرية — داشبورد نظام إدارة مالية
 *  ──────────────────────────────────────────────────────────────────────
 *  حلول دفاعية متعددة الطبقات (Defense in Depth)
 *  
 *  الترتيب:
 *   1. DashboardConfig (التاريخ الديناميكي)
 *   2. TimeUtils (حسابات زمنية دقيقة)
 *   3. Currency (تنسيق العملة الكويتية)
 *   4. ErrorBoundary (نظام تسجيل الأخطاء)
 *   5. SafeDOM (حماية XSS)
 *   6. CostResolver (حلّال تكلفة متعدد المصادر)
 *   7. ChartManager (مدير الرسوم مع LRU)
 *   8. ExcelColumnDetector (كشف تلقائي للأعمدة)
 *   9. Forecaster (تنبؤ مع الموسمية)
 *  10. BreakEven (نقطة التعادل)
 *  11. ROICalculator (عائد الاستثمار)
 *  12. SafeConfirm (تأكيد متعدد الخطوات)
 * ════════════════════════════════════════════════════════════════════════
 */

// ════════════════════════════════════════════════════════════════════════
//  1) DASHBOARD CONFIG — التاريخ الديناميكي (6 طبقات دفاع)
// ════════════════════════════════════════════════════════════════════════
const DashboardConfig = (function() {
  'use strict';
  
  const STORAGE_KEYS = {
    AS_OF_DATE: 'nayef_as_of_date',
    DATA_STALENESS_DAYS: 'nayef_stale_threshold'
  };
  
  // الحد الافتراضي للاعتبار البيانات قديمة: 60 يوماً
  const DEFAULT_STALE_DAYS = 60;
  const MIN_YEAR = 2000;
  const MAX_YEAR = 2100;
  
  /**
   * الطبقة 1: تحقق صارم من صحة التاريخ
   * - لا يقبل NaN
   * - لا يقبل سنوات خارج النطاق
   * - يقبل صيغ متعددة
   */
  function _isValidDate(d) {
    if (!d) return false;
    if (!(d instanceof Date)) d = new Date(d);
    if (isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    return y >= MIN_YEAR && y <= MAX_YEAR;
  }
  
  /**
   * الطبقة 2: استخراج آخر تاريخ في البيانات (لا اعتماد على واحد فقط)
   */
  function _getLatestDataDate() {
    const candidates = [];
    
    // المصدر 1: تواريخ الفواتير (li)
    if (typeof O !== 'undefined' && O.soc) {
      O.soc.forEach(s => {
        if (s.li && _isValidDate(s.li)) candidates.push(new Date(s.li));
        if (s.lc && _isValidDate(s.lc)) candidates.push(new Date(s.lc));
        if (s.dates && Array.isArray(s.dates)) {
          s.dates.forEach(d => { if (_isValidDate(d)) candidates.push(new Date(d)); });
        }
      });
    }
    
    // المصدر 2: تواريخ المعاملات (tx)
    if (typeof O !== 'undefined' && O.tx) {
      O.tx.forEach(t => {
        if (t.dt && _isValidDate(t.dt)) candidates.push(new Date(t.dt));
      });
    }
    
    // المصدر 3: تواريخ الشيكات (checks)
    if (typeof O !== 'undefined' && O.checks) {
      O.checks.forEach(c => {
        if (c.dt && _isValidDate(c.dt)) candidates.push(new Date(c.dt));
      });
    }
    
    if (candidates.length === 0) return null;
    return new Date(Math.max(...candidates.map(d => d.getTime())));
  }
  
  /**
   * الطبقة 3: الحصول على التاريخ المرجعي بـ 6 طبقات دفاع
   * 
   * الأولوية (من الأعلى للأدنى):
   *   1. تجاوز المستخدم (للتقارير بتاريخ سابق)
   *   2. التاريخ الحقيقي الحالي
   *   3. تعديل إذا كانت البيانات قديمة (حماية من "365+ يوم")
   *   4. آخر تاريخ في البيانات + عتبة آمنة
   *   5. تاريخ بدء النظام
   *   6. تاريخ افتراضي آمن (1 يناير 2024)
   */
  function getAsOfDate() {
    try {
      // ─── الطبقة 1: تجاوز المستخدم ───
      const userOverride = _safeLocalStorageGet(STORAGE_KEYS.AS_OF_DATE);
      if (userOverride && _isValidDate(userOverride)) {
        return new Date(userOverride);
      }
      
      // ─── الطبقة 2: التاريخ الحقيقي ───
      const realNow = new Date();
      if (!_isValidDate(realNow)) {
        // احتمالية ضعيفة جداً: ساعة النظام فاسدة
        Logger.warn('⚠️ ساعة النظام غير صالحة، استخدام البديل');
        return _fallbackDate();
      }
      
      // ─── الطبقة 3: كشف البيانات القديمة ───
      const latestDataDate = _getLatestDataDate();
      if (latestDataDate) {
        const daysSinceData = (realNow - latestDataDate) / 864e5;
        const staleThreshold = parseInt(_safeLocalStorageGet(STORAGE_KEYS.DATA_STALENESS_DAYS)) || DEFAULT_STALE_DAYS;
        
        // إذا البيانات أحدث من اليوم الحقيقي (مستقبلية - خطأ بشري)
        if (daysSinceData < -7) {
          Logger.warn('⚠️ تواريخ مستقبلية مكتشفة، استخدام التاريخ الحقيقي');
          return realNow;
        }
        
        // إذا البيانات قديمة بأكثر من العتبة (60 يوم افتراضياً)
        if (daysSinceData > staleThreshold) {
          // استخدم تاريخ البيانات + فترة آمنة (شهر) لمنع حسابات "365+ يوم"
          Logger.info(`ℹ️ البيانات قديمة بـ ${Math.floor(daysSinceData)} يوم، استخدام تاريخ محسوب`);
          return new Date(latestDataDate.getTime() + 30 * 864e5);
        }
      }
      
      return realNow;
    } catch (e) {
      ErrorBoundary.report('getAsOfDate', e);
      return _fallbackDate();
    }
  }
  
  /**
   * الطبقة 4: تاريخ احتياطي آمن (آخر ملجأ)
   */
  function _fallbackDate() {
    return new Date('2024-01-01T00:00:00Z');
  }
  
  /**
   * الطبقة 5: تخزين آمن في localStorage
   */
  function _safeLocalStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  
  /**
   * الطبقة 6: تعيين التاريخ المرجعي
   */
  function setAsOfDate(dateStr) {
    if (!_isValidDate(dateStr)) return { ok: false, error: 'تاريخ غير صالح' };
    try {
      localStorage.setItem(STORAGE_KEYS.AS_OF_DATE, new Date(dateStr).toISOString());
      return { ok: true, date: new Date(dateStr) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  
  function clearAsOfDate() {
    try { localStorage.removeItem(STORAGE_KEYS.AS_OF_DATE); return true; }
    catch (e) { return false; }
  }
  
  return { getAsOfDate, setAsOfDate, clearAsOfDate, _isValidDate };
})();


// ════════════════════════════════════════════════════════════════════════
//  2) TIME UTILS — حسابات زمنية دقيقة (3 طبقات دفاع)
// ════════════════════════════════════════════════════════════════════════
const TimeUtils = (function() {
  'use strict';
  
  // متوسط دقيق للشهر (365.25 / 12 = 30.4375)
  const AVG_DAYS_PER_MONTH = 30.4375;
  const WEEKEND_DAYS_KW = [5, 6]; // الجمعة والسبت (عطلة نهاية الأسبوع في الكويت)
  
  function _isValidDate(d) {
    return d && d instanceof Date && !isNaN(d.getTime());
  }
  
  /**
   * أيام منذ تاريخ معين - مع 3 طبقات حماية
   */
  function daysSince(dateStr) {
    // الحماية 1: قيمة فارغة
    if (!dateStr) return 999;
    
    // الحماية 2: تاريخ غير صالح
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 999;
    
    // الحماية 3: تاريخ مستقبلي (خطأ بشري)
    const today = DashboardConfig.getAsOfDate();
    if (d > today) return 0;
    
    return Math.floor((today - d) / 864e5);
  }
  
  /**
   * أيام بين تاريخين (مع مراعاة أيام العمل)
   */
  function daysBetween(start, end, businessDaysOnly = false) {
    if (!_isValidDate(start) || !_isValidDate(end)) return 0;
    
    const diff = (end - start) / 864e5;
    if (!businessDaysOnly) return Math.floor(diff);
    
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      if (!WEEKEND_DAYS_KW.includes(cur.getDay())) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }
  
  /**
   * حساب DSO بدقة عالية
   */
  function calculateDSO(receivables, sales, months) {
    if (!receivables || !sales || !months || months <= 0) return 0;
    const totalDays = months * AVG_DAYS_PER_MONTH;
    const dailySales = sales / totalDays;
    if (dailySales <= 0) return 0;
    return Math.round(receivables / dailySales);
  }
  
  /**
   * تنسيق الفترة بالعربية
   */
  function formatPeriod(months) {
    if (!months || months < 1) return '0 يوم';
    const m = Math.floor(months);
    const d = Math.round((months - m) * AVG_DAYS_PER_MONTH);
    const parts = [];
    if (m > 0) parts.push(`${m} شهر`);
    if (d > 0) parts.push(`${d} يوم`);
    return parts.join(' و ');
  }
  
  return { daysSince, daysBetween, calculateDSO, formatPeriod, AVG_DAYS_PER_MONTH };
})();


// ════════════════════════════════════════════════════════════════════════
//  3) CURRENCY — تنسيق العملة الكويتية (طبقتان دفاع)
// ════════════════════════════════════════════════════════════════════════
const Currency = (function() {
  'use strict';
  
  const SYMBOL = 'د.ك';
  const DECIMALS = 3; // الدينار الكويتي يُعرض عادة بـ 3 أرقام عشرية
  const DISPLAY_DECIMALS = 0; // لكن للوحات التنفيذية نكتفي بأعداد صحيحة
  
  function _toSafeNumber(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return isNaN(n) || !isFinite(n) ? 0 : n;
  }
  
  /**
   * تنسيق رقم كعملة
   * - يتعامل مع الأرقام العربية
   * - يتعامل مع القيم null/undefined/NaN
   */
  function format(value, options = {}) {
    const n = _toSafeNumber(value);
    const decimals = options.decimals !== undefined ? options.decimals : DISPLAY_DECIMALS;
    const showSymbol = options.showSymbol !== false;
    const showSign = options.showSign === true;
    
    const rounded = decimals === 0 ? Math.round(n) : Number(n.toFixed(decimals));
    const formatted = rounded.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    
    const sign = showSign && n > 0 ? '+' : '';
    return showSymbol ? `${sign}${formatted} ${SYMBOL}` : `${sign}${formatted}`;
  }
  
  /**
   * تنسيق نسبة مئوية
   */
  function percent(value, decimals = 1) {
    const n = _toSafeNumber(value);
    return `${n.toFixed(decimals)}%`;
  }
  
  /**
   * تنسيق رقم عادي (بدون عملة)
   */
  function number(value) {
    return Math.round(_toSafeNumber(value)).toLocaleString('en-US');
  }
  
  return { format, percent, number, SYMBOL };
})();


// ════════════════════════════════════════════════════════════════════════
//  4) ERROR BOUNDARY — نظام تسجيل الأخطاء المركزي (3 طبقات)
// ════════════════════════════════════════════════════════════════════════
const ErrorBoundary = (function() {
  'use strict';
  
  const MAX_LOGS = 100;
  const logs = [];
  
  function report(context, error, extra = {}) {
    const entry = {
      ts: new Date().toISOString(),
      context,
      message: error.message || String(error),
      stack: error.stack || null,
      extra,
      userAgent: navigator.userAgent
    };
    
    logs.unshift(entry);
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
    
    // في التطوير: console.error
    // في الإنتاج: إرسال للخادم
    if (window.console && console.error) {
      Logger.error(`[${context}]`, error, extra);
    }
  }
  
  function getLogs(limit = 20) {
    return logs.slice(0, limit);
  }
  
  function clear() {
    logs.length = 0;
  }
  
  // التقاط الأخطاء العامة
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
      report('window.onerror', e.error || new Error(e.message), {
        filename: e.filename,
        lineno: e.lineno
      });
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      report('unhandledrejection', e.reason || new Error('Promise rejection'));
    });
  }
  
  return { report, getLogs, clear };
})();


// ════════════════════════════════════════════════════════════════════════
//  5) SAFE DOM — حماية شاملة من XSS (5 طبقات دفاع)
// ════════════════════════════════════════════════════════════════════════
const SafeDOM = (function() {
  'use strict';
  
  // قائمة الأحداث الخطرة التي يجب منعها
  const DANGEROUS_PATTERNS = [
    /javascript:/i,
    /on\w+\s*=/i,         // onclick=, onerror=, etc
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:text\/html/i,
    /vbscript:/i
  ];
  
  // الأحرف الخاصة في HTML
  const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };
  
  /**
   * الطبقة 1+2: التحقق من النص الخطر + التنظيف
   */
  function _sanitize(str) {
    if (str === null || str === undefined) return '';
    let s = String(str);
    
    // تطبيق الهروب الأساسي
    s = s.replace(/[&<>"'`=\/]/g, c => HTML_ESCAPES[c]);
    
    // كشف الأنماط الخطرة وإزالتها
    DANGEROUS_PATTERNS.forEach(pattern => {
      if (pattern.test(s)) {
        Logger.warn('⚠️ محتوى مشبوه تم إزالته:', s.substring(0, 50));
        s = s.replace(pattern, '');
      }
    });
    
    return s;
  }
  
  /**
   * إدراج نص آمن في HTML
   */
  function text(value) {
    return _sanitize(value);
  }
  
  /**
   * إدراج سمة HTML آمنة
   */
  function attr(value) {
    return _sanitize(value).replace(/"/g, '&quot;');
  }
  
  /**
   * بناء عنصر HTML من قالب مع تمرير متغيرات آمنة
   */
  function template(strings, ...values) {
    let result = '';
    strings.forEach((str, i) => {
      result += str;
      if (i < values.length) {
        const v = values[i];
        result += (v && typeof v === 'object' && v.__safe) ? v.value : _sanitize(v);
      }
    });
    return result;
  }
  
  /**
   * علامة للنص الذي تم التحقق منه مسبقاً (مثل المحتوى من الكود)
   */
  function raw(htmlString) {
    return { __safe: true, value: htmlString };
  }
  
  /**
   * التحقق من أن النص لا يحتوي على محتوى خطير
   */
  function isSafe(str) {
    if (!str) return true;
    const s = String(str);
    return !DANGEROUS_PATTERNS.some(p => p.test(s));
  }
  
  return { text, attr, template, raw, isSafe };
})();


// ════════════════════════════════════════════════════════════════════════
//  6) COST RESOLVER — حلّال تكلفة متعدد المصادر (5 طبقات)
// ════════════════════════════════════════════════════════════════════════
const CostResolver = (function() {
  'use strict';
  
  /**
   * حلّال التكلفة الأساسي بـ 5 طبقات:
   * 1. شيت الأصناف (المرجع الأساسي)
   * 2. بيانات تاريخية من نفس الصنف
   * 3. متوسط مرجّح بالصنف المماثل
   * 4. هامش مفترض (55%) من المبيعات
   * 5. تقدير متحفّظ (70% هامش)
   */
  function resolve(itemCode, itemName, qty, salesValue, context = {}) {
    const result = { cost: 0, source: 'unknown', confidence: 0, warnings: [] };
    
    if (!itemCode && !itemName) return result;
    
    // ─── الطبقة 1: شيت الأصناف (المرجع الأساسي) ───
    if (context.itemMaster && context.itemMaster[itemCode]) {
      const master = context.itemMaster[itemCode];
      if (master.uc && master.uc > 0) {
        return { cost: master.uc, source: 'item_master', confidence: 1.0, warnings: [] };
      }
    }
    
    // ─── الطبقة 2: بيانات تاريخية لنفس الصنف ───
    if (context.history && context.history[itemCode]) {
      const hist = context.history[itemCode];
      if (hist.totalQty > 0 && hist.totalCost > 0) {
        const histCost = hist.totalCost / hist.totalQty;
        if (histCost > 0 && isFinite(histCost)) {
          return { cost: histCost, source: 'historical', confidence: 0.85, warnings: [] };
        }
      }
    }
    
    // ─── الطبقة 3: متوسط مرجّح بالصنف المماثل ───
    if (context.itemMaster) {
      const prefix = (itemCode || '').substring(0, 3);
      const similarCosts = [];
      let totalQty = 0;
      
      Object.entries(context.itemMaster).forEach(([code, master]) => {
        if (code !== itemCode && code.startsWith(prefix) && master.uc > 0 && master.sl > 0) {
          similarCosts.push({ cost: master.uc, weight: master.sl });
        }
      });
      
      if (similarCosts.length > 0) {
        const totalWeight = similarCosts.reduce((s, c) => s + c.weight, 0);
        const weightedCost = similarCosts.reduce((s, c) => s + c.cost * c.weight, 0) / totalWeight;
        
        if (weightedCost > 0) {
          return { 
            cost: weightedCost, 
            source: 'weighted_similar', 
            confidence: 0.7, 
            warnings: [`استخدام متوسط الصنف المماثل لـ ${itemCode}`] 
          };
        }
      }
    }
    
    // ─── الطبقة 4: هامش مفترض (55%) - محمي ───
    if (salesValue > 0 && qty > 0) {
      let impliedCost = salesValue * 0.45 / qty;
      if (impliedCost > 1000) impliedCost = 1000;
      if (impliedCost < 0.001 && impliedCost > 0) impliedCost = 0.001;
      if (impliedCost > 0 && isFinite(impliedCost)) {
        return { 
          cost: impliedCost, 
          source: 'implied_55_margin', 
          confidence: 0.4,
          warnings: [`تكلفة مقدّرة بهامش 55% لـ ${itemCode}`]
        };
      }
    }
    
    // ─── الطبقة 5: تقدير متحفّظ (70% هامش) ───
    if (salesValue > 0 && qty > 0) {
      const conservativeCost = salesValue * 0.30 / qty;
      if (conservativeCost > 0 && isFinite(conservativeCost)) {
        return { 
          cost: conservativeCost, 
          source: 'conservative_70_margin', 
          confidence: 0.2,
          warnings: [`تقدير متحفّظ بهامش 70% لـ ${itemCode}`]
        };
      }
    }
    
    return result;
  }
  
  /**
   * حلّال مجمع مع تجميع التحذيرات
   */
  function resolveBatch(items, context = {}) {
    const warnings = [];
    const resolved = items.map(item => {
      const r = resolve(item.cd, item.nm, item.sl || 0, item.ns || 0, context);
      if (r.warnings && r.warnings.length) {
        warnings.push({
          code: item.cd,
          name: item.nm,
          source: r.source,
          confidence: r.confidence,
          warnings: r.warnings
        });
      }
      return { 
        ...item, 
        uc: r.cost, 
        _costSource: r.source, 
        _costConfidence: r.confidence 
      };
    });
    
    return { items: resolved, warnings };
  }
  
  return { resolve, resolveBatch };
})();


// ════════════════════════════════════════════════════════════════════════
//  7) CHART MANAGER — مدير الرسوم مع LRU وتنظيف تلقائي (5 طبقات)
// ════════════════════════════════════════════════════════════════════════
const ChartManager = (function() {
  'use strict';
  
  const charts = new Map(); // id -> {chart, lastUsed}
  const MAX_CHARTS = 25;        // حد أقصى للرسوم المخزنة
  const CLEANUP_THRESHOLD = 30; // عتبة التنبيه
  
  function _isChartValid(chart) {
    return chart && typeof chart.destroy === 'function' && chart.canvas;
  }
  
  /**
   * إنشاء رسم بياني مع تنظيف تلقائي
   */
  function create(id, config) {
    try {
      const canvas = document.getElementById(id);
      if (!canvas) return null;
      
      // تنظيف الرسم القديم إن وُجد
      if (charts.has(id)) {
        _safeDestroy(id);
      }
      
      // التحقق من توفر Chart.js
      if (typeof Chart === 'undefined') {
        canvas.insertAdjacentHTML('afterend', 
          '<p style="color:var(--tx3);text-align:center;padding:16px;font-size:12px">⚠ يحتاج اتصال إنترنت لعرض الرسوم</p>');
        return null;
      }
      
      const chart = new Chart(canvas, config);
      charts.set(id, { chart, lastUsed: Date.now() });
      
      // LRU eviction
      _enforceLimit();
      
      return chart;
    } catch (e) {
      ErrorBoundary.report('ChartManager.create', e, { id });
      return null;
    }
  }
  
  function _safeDestroy(id) {
    const entry = charts.get(id);
    if (entry && _isChartValid(entry.chart)) {
      try { entry.chart.destroy(); } catch (e) { /* ignore */ }
    }
    charts.delete(id);
  }
  
  function _enforceLimit() {
    if (charts.size <= MAX_CHARTS) return;
    
    // ترتيب حسب آخر استخدام
    const sorted = Array.from(charts.entries())
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    
    // إزالة الأقدم حتى نصل للحد
    const toRemove = sorted.slice(0, charts.size - MAX_CHARTS);
    toRemove.forEach(([id]) => _safeDestroy(id));
    
    if (charts.size >= CLEANUP_THRESHOLD) {
      Logger.info(`ℹ️ تم تنظيف ${toRemove.length} رسم قديم`);
    }
  }
  
  /**
   * تدمير الرسوم بالـ prefix
   */
  function destroyByPrefix(prefix) {
    for (const [id] of charts.entries()) {
      if (id.startsWith(prefix)) {
        _safeDestroy(id);
      }
    }
  }
  
  /**
   * تدمير رسم محدد
   */
  function destroy(id) {
    _safeDestroy(id);
  }
  
  /**
   * تدمير كل الرسوم
   */
  function destroyAll() {
    for (const [id] of charts.entries()) {
      _safeDestroy(id);
    }
  }
  
  /**
   * مراقبة ذاكرة المتصفح (طبقة إضافية)
   */
  function setupMemoryMonitoring() {
    if (!('memory' in performance)) return;
    
    setInterval(() => {
      const mem = performance.memory;
      if (mem.usedJSHeapSize > mem.jsHeapSizeLimit * 0.9) {
        Logger.warn('⚠️ ذاكرة قاربت الحد، تنظيف الرسوم البيانية');
        // إبقاء آخر 5 فقط
        const sorted = Array.from(charts.entries())
          .sort((a, b) => b[1].lastUsed - a[1].lastUsed);
        sorted.slice(5).forEach(([id]) => _safeDestroy(id));
      }
    }, 30000);
  }
  
  /**
   * معلومات تشخيصية
   */
  function stats() {
    return {
      count: charts.size,
      max: MAX_CHARTS,
      ids: Array.from(charts.keys())
    };
  }
  
  // بدء المراقبة
  if (typeof window !== 'undefined') {
    if (document.readyState === 'complete') {
      setupMemoryMonitoring();
    } else {
      window.addEventListener('load', setupMemoryMonitoring);
    }
  }
  
  return { create, destroy, destroyByPrefix, destroyAll, stats };
})();


// ════════════════════════════════════════════════════════════════════════
//  8) EXCEL COLUMN DETECTOR — كشف تلقائي للأعمدة (4 طبقات)
// ════════════════════════════════════════════════════════════════════════
const ExcelColumnDetector = (function() {
  'use strict';
  
  // أنماط البحث لكل حقل (مع التطبيع العربي)
  const PATTERNS = {
    date:       ['التاريخ', 'تاريخ', 'date', 'tarikh'],
    txType:     ['نوع الحركة', 'النوع', 'البيان', 'نوع', 'type'],
    ref:        ['رقم', 'مرجع', 'رقم الفاتورة', 'ref'],
    client:     ['العميل', 'الجمعية', 'العميل/الجمعية', 'client', 'customer', 'العميل '],
    debit:      ['مدين', 'مبلغ', 'debit', 'مدين (د)'],
    credit:     ['دائن', 'دائن (د)', 'credit'],
    qty:        ['الكمية', 'كمية', 'qty', 'quantity'],
    discount:   ['الخصم', 'خصم', 'discount'],
    free:       ['مجاني', 'بضاعة مجانية', 'free'],
    agent:      ['المندوب', 'وكيل', 'agent'],
    itemCode:   ['كود', 'كود الصنف', 'item code'],
    itemName:   ['الصنف', 'اسم الصنف', 'item', 'product'],
    unitCost:   ['تكلفة الوحدة', 'تكلفة', 'cost', 'uc'],
    unitPrice:  ['سعر الوحدة', 'سعر البيع', 'price', 'سعر']
  };
  
  function _normalize(s) {
    return String(s || '')
      .replace(/[\u064B-\u0652\u0670]/g, '')   // التشكيل
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
  
  /**
   * كشف الأعمدة من صف العناوين
   */
  function detect(headers) {
    const mapping = {};
    const normalized = headers.map(h => _normalize(h));
    
    Object.entries(PATTERNS).forEach(([field, patterns]) => {
      const normalizedPatterns = patterns.map(_normalize);
      
      for (let i = 0; i < normalized.length; i++) {
        const h = normalized[i];
        if (!h) continue;
        if (normalizedPatterns.some(p => h.includes(p))) {
          if (!(field in mapping)) {
            mapping[field] = i;
            break;
          }
        }
      }
    });
    
    return mapping;
  }
  
  /**
   * التحقق من اكتمال الحقول المطلوبة
   */
  function validate(mapping) {
    const required = ['date', 'txType', 'client', 'debit'];
    const warnings = [];
    
    required.forEach(field => {
      if (!(field in mapping)) {
        warnings.push({
          severity: 'error',
          field,
          message: `لم يُعثر على عمود "${field}" المطلوب لتحليل البيانات`
        });
      }
    });
    
    // تحذيرات للحقول الموصى بها
    const recommended = ['credit', 'qty', 'agent'];
    recommended.forEach(field => {
      if (!(field in mapping)) {
        warnings.push({
          severity: 'warning',
          field,
          message: `عمود "${field}" غير موجود - بعض التحليلات لن تعمل`
        });
      }
    });
    
    return warnings;
  }
  
  /**
   * البحث الذكي عن شيت المعاملات
   */
  function findSheet(workbook) {
    // 🆕 v230.7+ أولاً: كشف شيت الإيجارات (إذا وجد، نخزّنه منفصل)
    // يبحث في كل الشيتات: اسم العميل + (قيمة العقد OR الإيجار)
    window._rentalSheetCache = null;

    // المحاولة A: الأسماء المعروفة (مع دعم المسافة في الآخر!)
    const rentalKnownNames = ['القيمه الايجاريه', 'القيمه الايجاريه ', 'القيمة الإيجارية', 'القيم الإيجارية', 'rentals', 'rental'];
    for (const rn of rentalKnownNames) {
      if (workbook.Sheets[rn]) {
        try {
          const tmp = XLSX.utils.sheet_to_json(workbook.Sheets[rn], { header: 1, cellDates: true, range: 0 });
          // قد يكون الصف الأول فارغ والـ header في صف 2
          let headerRow = 0;
          if (!tmp[0] || tmp[0].every(c => c == null || String(c).trim() === '' || String(c).trim() === '—')) {
            // ابحث عن أول صف فيه مكلمات دالة
            for (let i = 0; i < Math.min(5, tmp.length); i++) {
              if (tmp[i] && tmp[i].some(h => /اسم\s*العميل/.test(String(h||'')))) {
                headerRow = i;
                break;
              }
            }
          }
          const headers = (tmp[headerRow] || []).map(h => String(h || '').trim());
          const dataRows = tmp.slice(headerRow + 1);
          window._rentalSheetCache = { name: rn, headers, rows: dataRows, headerRow };
          Logger.info(`📋 شيت الإيجارات: "${rn}" (header في صف ${headerRow + 1}، ${dataRows.length} صف بيانات)`);
        } catch (e) {}
        break;
      }
    }

    // المحاولة 1: الأسماء المعروفة
    const knownNames = ['HANY1', 'hany1', 'الحركات', 'المعاملات', 'transactions', 'sales'];
    for (const name of knownNames) {
      if (workbook.Sheets[name]) return workbook.Sheets[name];
    }
    
    // المحاولة 2: البحث في كل الشيتات عن أعمدة معروفة
    for (const name of Object.keys(workbook.Sheets)) {
      try {
        const tmp = XLSX.utils.sheet_to_json(workbook.Sheets[name], { 
          header: 1, cellDates: true, range: 0 
        });
        if (tmp.length < 2 || !tmp[0]) continue;
        
        // 🆕 كشف الإيجارات (اسم العميل + قيمة العقد) - يبحث حتى في صف 2 إن كان الأول فارغ
        if (!window._rentalSheetCache) {
          let headerRow = 0;
          if (!tmp[0] || tmp[0].every(c => c == null || String(c).trim() === '' || String(c).trim() === '—')) {
            for (let i = 0; i < Math.min(5, tmp.length); i++) {
              if (tmp[i] && tmp[i].some(h => /اسم\s*العميل/.test(String(h||'')))) {
                headerRow = i;
                break;
              }
            }
          }
          const hdrR = (tmp[headerRow] || []).map(h => String(h || '').trim());
          const hasNameR  = hdrR.some(h => /اسم\s*العميل|العميل|client|customer/i.test(h));
          const hasValueR = hdrR.some(h => /قيمة\s*العقد|قيمة\s*الإيجار|contract|rent/i.test(h));
          if (hasNameR && hasValueR && name !== 'HANY1') {  // استثناء HANY1 لو فيه كلتا الميزتين
            const dataRows = tmp.slice(headerRow + 1);
            window._rentalSheetCache = { name, headers: hdrR, rows: dataRows, headerRow };
            Logger.info(`📋 شيت الإيجارات (تلقائي): "${name}" (${dataRows.length} صف)`);
            continue;
          }
        }

        const mapping = detect(tmp[0]);
        if (mapping.date !== undefined && mapping.client !== undefined) {
          Logger.info(`ℹ️ تم العثور على شيت المعاملات تلقائياً: "${name}"`);
          return workbook.Sheets[name];
        }
      } catch (e) {
        // ignore
      }
    }
    
    return null;
  }
  
  return { detect, validate, findSheet };
})();


// ════════════════════════════════════════════════════════════════════════
//  9) FORECASTER — تنبؤ مع الموسمية (4 طبقات)
// ════════════════════════════════════════════════════════════════════════
const Forecaster = (function() {
  'use strict';
  
  /**
   * تفكيك السلسلة الزمنية: اتجاه + موسمية + متبقي
   */
  function decompose(values, seasonLength = 12) {
    const n = values.length;
    
    if (n < seasonLength * 2) {
      // بيانات غير كافية للموسمية - رجوع للوضع البسيط
      return { 
        trend: values.slice(), 
        seasonal: new Array(n).fill(1), 
        residual: new Array(n).fill(0),
        hasSeasonality: false,
        seasonLength: 0
      };
    }
    
    // الخطوة 1: حساب الاتجاه (متوسط متحرك مركزي)
    const trend = new Array(n).fill(null);
    const halfSeason = Math.floor(seasonLength / 2);
    
    for (let i = halfSeason; i < n - halfSeason; i++) {
      let sum = 0, count = 0;
      const windowStart = i - halfSeason;
      const windowEnd = i + halfSeason + 1;
      for (let j = windowStart; j < windowEnd && j < n; j++) {
        if (values[j] !== null && !isNaN(values[j])) {
          sum += values[j];
          count++;
        }
      }
      if (count > 0) trend[i] = sum / count;
    }
    
    // ملء الفراغات بـ interpolation
    for (let i = 0; i < n; i++) {
      if (trend[i] === null) {
        let leftIdx = i - 1, rightIdx = i + 1;
        while (leftIdx >= 0 && trend[leftIdx] === null) leftIdx--;
        while (rightIdx < n && trend[rightIdx] === null) rightIdx++;
        if (leftIdx >= 0 && rightIdx < n) {
          trend[i] = (trend[leftIdx] + trend[rightIdx]) / 2;
        } else if (leftIdx >= 0) {
          trend[i] = trend[leftIdx];
        } else if (rightIdx < n) {
          trend[i] = trend[rightIdx];
        } else {
          trend[i] = 0;
        }
      }
    }
    
    // الخطوة 2: إزالة الاتجاه (Detrend)
    const detrended = values.map((v, i) => {
      if (trend[i] && trend[i] > 0) return v / trend[i];
      return 0;
    });
    
    // الخطوة 3: حساب المؤشرات الموسمية
    const seasonal = new Array(n).fill(1);
    for (let s = 0; s < seasonLength; s++) {
      let sum = 0, count = 0;
      for (let i = s; i < n; i += seasonLength) {
        if (detrended[i] && !isNaN(detrended[i]) && isFinite(detrended[i])) {
          sum += detrended[i];
          count++;
        }
      }
      const seasonalIdx = count > 0 ? sum / count : 1;
      for (let i = s; i < n; i += seasonLength) {
        seasonal[i] = seasonalIdx;
      }
    }
    
    // تطبيع المؤشرات الموسمية (المتوسط = 1)
    const seasonalAvg = seasonal.reduce((a, b) => a + b, 0) / seasonal.length;
    if (seasonalAvg > 0) {
      for (let i = 0; i < seasonal.length; i++) {
        seasonal[i] = seasonal[i] / seasonalAvg;
      }
    }
    
    // الخطوة 4: حساب المتبقي
    const residual = values.map((v, i) => {
      if (trend[i] !== null && seasonal[i]) {
        return v - (trend[i] * seasonal[i]);
      }
      return 0;
    });
    
    return { trend, seasonal, residual, hasSeasonality: true, seasonLength };
  }
  
  /**
   * انحدار خطي بسيط
   */
  function linearRegression(values) {
    const n = values.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    
    const xs = values.map((_, i) => i);
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = values.reduce((a, b) => a + b, 0);
    const sxy = xs.reduce((a, x, i) => a + x * values[i], 0);
    const sxx = xs.reduce((a, x) => a + x * x, 0);
    
    const denom = n * sxx - sx * sx;
    const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
    const intercept = (sy - slope * sx) / n;
    
    return { slope, intercept };
  }
  
  /**
   * تنبؤ مجمّع (Ensemble) مع 4 طرق
   */
  function forecast(historical, periods = 3, options = {}) {
    const seasonLength = options.seasonLength || 12;
    const decomp = decompose(historical, seasonLength);
    const n = historical.length;
    
    if (n < 3) {
      // بيانات غير كافية
      const avg = historical.reduce((a, b) => a + b, 0) / Math.max(n, 1);
      return {
        forecast: new Array(periods).fill(avg),
        method: 'simple_average',
        confidence: 0,
        hasSeasonality: false,
        message: 'بيانات غير كافية للتنبؤ الموثوق'
      };
    }
    
    // ──── الطريقة 1: انحدار خطي على الاتجاه ────
    const validTrend = decomp.trend.filter(v => v !== null && !isNaN(v));
    const linear = linearRegression(validTrend);
    const linearFc = [];
    for (let k = 1; k <= periods; k++) {
      const v = linear.intercept + linear.slope * (n + k - 1);
      linearFc.push(Math.max(0, v));
    }
    
    // ──── الطريقة 2: تنعيم أسي ────
    const alpha = 0.3;
    let smoothed = historical[0] || 0;
    for (let i = 1; i < historical.length; i++) {
      smoothed = alpha * (historical[i] || 0) + (1 - alpha) * smoothed;
    }
    const expFc = new Array(periods).fill(smoothed);
    
    // ──── الطريقة 3: متوسط مرجّح للأشهر الثلاثة الأخيرة ────
    const last3 = historical.slice(-3);
    const weights = [0.5, 0.3, 0.2];
    const wmaValue = last3.reduce((a, b, i) => a + (b || 0) * (weights[i] || 0), 0);
    const wmaFc = new Array(periods).fill(wmaValue);
    
    // ──── الطريقة 4: تنبؤ موسمي (إذا توفرت بيانات كافية) ────
    let seasonalFc = [];
    if (decomp.hasSeasonality && n >= seasonLength) {
      const lastSeasonalIdx = (n - 1) % seasonLength;
      for (let k = 1; k <= periods; k++) {
        const seasonIdx = (lastSeasonalIdx + k) % seasonLength;
        const seasonalValue = decomp.seasonal[seasonIdx] || 1;
        const trendValue = linear.intercept + linear.slope * (n + k - 1);
        seasonalFc.push(Math.max(0, trendValue * seasonalValue));
      }
    } else {
      seasonalFc = linearFc.slice();
    }
    
    // ──── التجميع (Ensemble) ────
    const ensemble = [];
    for (let k = 0; k < periods; k++) {
      const value = (
        0.30 * linearFc[k] +        // الانحدار الخطي
        0.25 * seasonalFc[k] +      // الموسمية
        0.25 * wmaFc[k] +           // المتوسط المرجح
        0.20 * expFc[k]             // التنعيم الأسي
      );
      ensemble.push(Math.max(0, value));
    }
    
    // ──── حساب فترات الثقة ────
    const residualValues = decomp.residual.filter(v => !isNaN(v) && isFinite(v));
    const residualStd = residualValues.length > 0
      ? Math.sqrt(residualValues.reduce((a, b) => a + b * b, 0) / residualValues.length)
      : 0;
    
    return {
      forecast: ensemble,
      components: {
        linear: linearFc,
        seasonal: seasonalFc,
        weightedAvg: wmaFc,
        exponential: expFc
      },
      confidence: {
        std: residualStd,
        lower95: ensemble.map(v => Math.max(0, v - 1.96 * residualStd)),
        upper95: ensemble.map(v => v + 1.96 * residualStd),
        level: residualStd < ensemble[0] * 0.1 ? 'high' : 
               residualStd < ensemble[0] * 0.25 ? 'medium' : 'low'
      },
      method: 'ensemble_v2_seasonal',
      hasSeasonality: decomp.hasSeasonality,
      trend: { slope: linear.slope, direction: linear.slope > 0 ? 'صاعد' : linear.slope < 0 ? 'هابط' : 'مستقر' }
    };
  }
  
  return { forecast, decompose, linearRegression };
})();


// ════════════════════════════════════════════════════════════════════════
//  10) BREAK-EVEN — نقطة التعادل (3 طبقات)
// ════════════════════════════════════════════════════════════════════════
const BreakEven = (function() {
  'use strict';
  
  function calculate({ fixedCosts, variableCostPerUnit, pricePerUnit, currentUnits, periodMonths = 1 }) {
    // الحماية 1: تحقق من المدخلات
    if (typeof fixedCosts !== 'number' || fixedCosts < 0) {
      return { ok: false, error: 'تكاليف ثابتة غير صالحة' };
    }
    
    if (typeof variableCostPerUnit !== 'number' || variableCostPerUnit < 0) {
      return { ok: false, error: 'تكلفة متغيرة غير صالحة' };
    }
    
    if (typeof pricePerUnit !== 'number' || pricePerUnit <= 0) {
      return { ok: false, error: 'سعر البيع يجب أن يكون موجباً' };
    }
    
    const contributionMargin = pricePerUnit - variableCostPerUnit;
    
    // الحماية 2: تحقق من هامش المساهمة
    if (contributionMargin <= 0) {
      return {
        ok: false,
        error: 'هامش المساهمة سالب — لا يمكن تحقيق التعادل',
        details: {
          pricePerUnit,
          variableCostPerUnit,
          contributionMargin,
          message: 'سعر البيع أقل من أو يساوي التكلفة المتغيرة للوحدة'
        }
      };
    }
    
    const breakEvenUnits = fixedCosts / contributionMargin;
    const breakEvenRevenue = breakEvenUnits * pricePerUnit;
    
    // هامش الأمان
    let marginOfSafety = null;
    let marginOfSafetyPct = null;
    let currentProfit = null;
    
    if (typeof currentUnits === 'number' && currentUnits > 0) {
      marginOfSafety = currentUnits - breakEvenUnits;
      marginOfSafetyPct = (marginOfSafety / currentUnits) * 100;
      currentProfit = (currentUnits * contributionMargin) - fixedCosts;
    }
    
    // الحماية 3: تحقق من معقولية النتيجة
    if (!isFinite(breakEvenUnits) || breakEvenUnits < 0) {
      return { ok: false, error: 'نقطة التعادل غير محسوبة بشكل صحيح' };
    }
    
    return {
      ok: true,
      units: Math.ceil(breakEvenUnits),
      revenue: breakEvenRevenue,
      contributionMargin,
      contributionMarginRatio: (contributionMargin / pricePerUnit) * 100,
      marginOfSafetyUnits: marginOfSafety,
      marginOfSafetyPct,
      currentProfit,
      monthlyBreakEven: breakEvenUnits / periodMonths,
      evaluation: marginOfSafetyPct !== null ? (
        marginOfSafetyPct > 30 ? 'آمن — هامش أمان كبير' :
        marginOfSafetyPct > 15 ? 'مقبول — راقب الأداء' :
        marginOfSafetyPct > 0 ? 'حذر — قريب من نقطة التعادل' :
        'خطر — تحت نقطة التعادل'
      ) : null
    };
  }
  
  return { calculate };
})();


// ════════════════════════════════════════════════════════════════════════
//  11) ROI CALCULATOR — عائد الاستثمار للحملات (3 طبقات)
// ════════════════════════════════════════════════════════════════════════
const ROICalculator = (function() {
  'use strict';
  
  function calculate({ offerCost, expectedUpliftPct, currentRevenue, currentMarginPct, discountPct = 0 }) {
    // الحماية 1: تحقق من المدخلات
    if (offerCost < 0 || expectedUpliftPct < 0 || currentRevenue < 0) {
      return { ok: false, error: 'قيم سالبة غير مسموحة' };
    }
    
    if (currentMarginPct < 0 || currentMarginPct >= 100) {
      return { ok: false, error: 'هامش غير صالح (0-100%)' };
    }
    
    if (discountPct < 0 || discountPct >= 100) {
      return { ok: false, error: 'خصم غير صالح (0-100%)' };
    }
    
    // حساب الإيرادات الإضافية المتوقعة
    const additionalRevenue = currentRevenue * (expectedUpliftPct / 100);
    
    // حساب الربح الإضافي مع مراعاة الخصم
    const effectiveMarginPct = currentMarginPct - discountPct;
    const additionalProfit = additionalRevenue * (effectiveMarginPct / 100);
    
    // صافي الربح بعد تكلفة الحملة
    const netProfit = additionalProfit - offerCost;
    
    // عائد الاستثمار
    const roi = offerCost > 0 ? (netProfit / offerCost) * 100 : null;
    
    // نقطة التعادل للحملة
    const breakEvenUplift = currentRevenue > 0 && currentMarginPct > 0 
      ? (offerCost / (currentRevenue * (currentMarginPct / 100))) * 100 
      : null;
    
    // فترة الاسترداد (بالأشهر إذا كانت الحملة شهرية)
    const monthlyOfferCost = offerCost; // تكلفة الحملة
    const monthlyAdditionalProfit = additionalProfit;
    const paybackMonths = monthlyAdditionalProfit > 0 
      ? monthlyOfferCost / monthlyAdditionalProfit 
      : null;
    
    return {
      ok: true,
      additionalRevenue,
      additionalProfit,
      offerCost,
      netProfit,
      roi,
      roiEvaluation: roi !== null ? (
        roi > 200 ? 'ممتاز — استثمار سريع' :
        roi > 100 ? 'جيد جداً' :
        roi > 50 ? 'جيد' :
        roi > 0 ? 'مقبول' :
        'خاسر — لا تنفّذ'
      ) : null,
      breakEvenUpliftPct: breakEvenUplift,
      paybackMonths,
      effectiveMarginPct,
      isProfitable: netProfit > 0
    };
  }
  
  return { calculate };
})();


// ════════════════════════════════════════════════════════════════════════
//  12) SAFE CONFIRM — تأكيد متعدد الخطوات (4 طبقات)
// ════════════════════════════════════════════════════════════════════════
const SafeConfirm = (function() {
  'use strict';
  
  /**
   * تأكيد متعدد الخطوات للعمليات المدمّرة:
   * 1. تحذير أولي
   * 2. طلب كتابة كلمة تأكيد
   * 3. عد تنازلي 5 ثوان
   * 4. تسجيل العملية
   */
  async function confirmDestructive(action, options = {}) {
    const {
      keyword = 'تأكيد',
      description = 'هذه العملية لا يمكن التراجع عنها.',
      affectedItems = '',
      showCountdown = true,
      countdownSeconds = 5
    } = options;
    
    // ──── الطبقة 1: تحذير أولي ────
    let msg = `⚠️ تحذير: ${action}\n\n${description}`;
    if (affectedItems) msg += `\n\nالعناصر المتأثرة: ${affectedItems}`;
    msg += '\n\nهل تريد المتابعة؟';
    
    if (!confirm(msg)) return false;
    
    // ──── الطبقة 2: طلب كلمة التأكيد ────
    const input = prompt(
      `🚨 تأكيد نهائي\n\n` +
      `للمتابعة، اكتب "${keyword}" بالضبط في الحقل أدناه:\n\n` +
      `(اكتب "إلغاء" أو اتركه فارغاً للإلغاء)`
    );
    
    if (!input || input !== keyword) {
      if (input !== null) {
        alert('كلمة التأكيد غير صحيحة. تم الإلغاء.');
      }
      return false;
    }
    
    // ──── الطبقة 3: عد تنازلي ────
    if (showCountdown) {
      const confirmed = await _countdown(countdownSeconds);
      if (!confirmed) return false;
    }
    
    // ──── الطبقة 4: تسجيل العملية ────
    _logDestructive(action, options);
    
    return true;
  }
  
  function _countdown(seconds) {
    return new Promise(resolve => {
      let remaining = seconds;
      const interval = setInterval(() => {
        if (remaining <= 0) {
          clearInterval(interval);
          resolve(true);
          return;
        }
        if (!confirm(`⏱️ سيتم التنفيذ خلال ${remaining} ثانية...\nاضغط "موافق" للمتابعة أو "إلغاء" للإيقاف.`)) {
          clearInterval(interval);
          resolve(false);
          return;
        }
        remaining--;
      }, 1000);
    });
  }
  
  function _logDestructive(action, options) {
    const log = {
      ts: new Date().toISOString(),
      action,
      options,
      userAgent: navigator.userAgent
    };
    
    try {
      const logs = JSON.parse(localStorage.getItem('nayef_destructive_log') || '[]');
      logs.push(log);
      // الاحتفاظ بآخر 50 عملية فقط
      if (logs.length > 50) logs.shift();
      localStorage.setItem('nayef_destructive_log', JSON.stringify(logs));
    } catch (e) {
      // ignore
    }
  }
  
  function getDestructiveLog() {
    try {
      return JSON.parse(localStorage.getItem('nayef_destructive_log') || '[]');
    } catch (e) {
      return [];
    }
  }
  
  return { confirmDestructive, getDestructiveLog };
})();


// ════════════════════════════════════════════════════════════════════════
//  نقطة الدخول — تثبيت الإصلاحات
// ════════════════════════════════════════════════════════════════════════
(function installFixes() {
  'use strict';
  
  Logger.info('🛡️ جاري تثبيت الإصلاحات الجذرية...');
  
  // إصلاح 1: استبدال TODAY فور التحميل
  if (typeof window !== 'undefined') {
    window.DashboardConfig = DashboardConfig;
    window.TimeUtils = TimeUtils;
    window.Currency = Currency;
    window.ErrorBoundary = ErrorBoundary;
    window.SafeDOM = SafeDOM;
    window.CostResolver = CostResolver;
    window.ChartManager = ChartManager;
    window.ExcelColumnDetector = ExcelColumnDetector;
    window.Forecaster = Forecaster;
    window.BreakEven = BreakEven;
    window.ROICalculator = ROICalculator;
    window.SafeConfirm = SafeConfirm;
  }
  
  Logger.info('✅ تم تثبيت 12 وحدة إصلاح');




// ════════════════════════════════════════════════════════════════════════
//  🧾 INVOICE V2 — قارئ البيانات الحقيقي من الداشبورد
//  ────────────────────────────────────────────────────────────────────
//  ✅ يقرأ D.soc + O.tx + O.items
//  ✅ إدخال يدوي (اسم الصنف + الكمية)
//  ✅ خصم / مجاني
//  ✅ بدون ضرائب (لا VAT في الكويت)
// ════════════════════════════════════════════════════════════════════════
const InvoiceEngine = (function() {
  'use strict';

  const STORAGE_KEY = 'nayef_invoices';
  const ITEMS_PER_PAGE = 10;

  // ═══ إعدادات الشركة ═══
  const COMPANY = {
    nameAr: 'شركتك',
    nameEn: 'Your Company',
    addressAr: 'الكويت · السالمية · شارع سالم المبارك',
    addressEn: 'Kuwait · Salmiya · Salem Al-Mubarak St.',
    phone: '+965 2222 3333',
    mobile: '+965 9999 8888',
    email: 'info@yourcompany.com',
    website: 'www.yourcompany.com',
    bankName: 'بنك الكويت الوطني · National Bank of Kuwait',
    bankAccount: 'KW81 NBOK 0000 0000 0000 0100 1234 567',
    iban: 'KW81 NBOK 0000 0000 0000 0100 1234 567',
    swift: 'NBOKKWKW',
    logo: 'ن',
    taxNote: 'معفى من الضريبة · Tax Exempt',
  };

  // ═══ استخراج البيانات الحقيقية من الداشبورد ═══
  function getDashboardData() {
    return {
      soc: (typeof D !== 'undefined' && D.soc) ? D.soc : [],
      tx:  (typeof O !== 'undefined' && O.tx)  ? O.tx  : [],
      items: (typeof O !== 'undefined' && O.items) ? O.items : [],
      checks: (typeof O !== 'undefined' && O.checks) ? O.checks : [],
      ml: (typeof O !== 'undefined' && O.ml) ? O.ml : [],
      filterA: (typeof _filterA !== 'undefined') ? _filterA : 0,
      filterB: (typeof _filterB !== 'undefined') ? _filterB : (typeof O !== 'undefined' && O.ml ? O.ml.length - 1 : 0),
    };
  }

  // ═══ استخراج معاملات العميل من O.tx ═══
  function getClientTransactions(clientName, data) {
    if (!data.tx || data.tx.length === 0) return [];
    return data.tx.filter(t => {
      const tClient = t.client || t.cl || t.c || '';
      return tClient === clientName || String(tClient).includes(clientName);
    });
  }

  // ═══ استخراج المنتجات الحقيقية من معاملات العميل ═══
  function extractItemsFromTransactions(clientName, options = {}) {
    const data = getDashboardData();
    const txs = getClientTransactions(clientName, data);
    
    if (txs.length === 0) {
      // محاولة: البحث في D.soc عن العناصر
      const socEntry = data.soc.find(s => s.nm === clientName);
      if (socEntry && socEntry.items && Array.isArray(socEntry.items)) {
        return socEntry.items.map((it, idx) => ({
          no: idx + 1,
          code: it.code || it.cd || `GEN-${String(idx+1).padStart(3, '0')}`,
          name: it.nm || it.name || 'صنف',
          nameEn: it.nameEn || '',
          unit: it.unit || it.u || 'قطعة',
          quantity: parseFloat(it.q || it.qty || 1),
          unitPrice: parseFloat(it.p || it.price || 0),
          discount: 0,
          isFree: false,
          notes: '',
          source: 'soc.items',
        }));
      }
      return [];
    }

    // تجميع المعاملات حسب الصنف
    const grouped = {};
    txs.forEach(tx => {
      const itemName = tx.item || tx.itm || tx.product || tx.desc || 'صنف';
      const key = itemName;
      if (!grouped[key]) {
        grouped[key] = {
          name: itemName,
          nameEn: tx.itemEn || '',
          code: tx.code || tx.cd || '',
          unit: tx.unit || tx.u || 'قطعة',
          quantity: 0,
          total: 0,
          unitPrice: 0,
          isFree: false,
          count: 0,
          dates: [],
        };
      }
      const qty = parseFloat(tx.qty || tx.q || 1);
      const price = parseFloat(tx.price || tx.p || tx.amount / qty || 0);
      const amount = parseFloat(tx.amount || tx.amt || qty * price);
      
      grouped[key].quantity += qty;
      grouped[key].total += amount;
      grouped[key].count += 1;
      grouped[key].unitPrice = price;
      if (tx.isFree || amount === 0) grouped[key].isFree = true;
      if (tx.dt) grouped[key].dates.push(tx.dt);
    });

    return Object.values(grouped).map((g, idx) => ({
      no: idx + 1,
      code: g.code || `TX-${String(idx+1).padStart(3, '0')}`,
      name: g.name,
      nameEn: g.nameEn,
      unit: g.unit,
      quantity: g.quantity,
      unitPrice: g.unitPrice,
      discount: 0,
      isFree: g.isFree,
      notes: '',
      source: 'transactions',
      dates: g.dates,
    }));
  }

  // ═══ توليد رقم فاتورة احترافي ═══
  function generateInvoiceNumber(prefix = 'INV') {
    const now = new Date();
    const year = now.getFullYear();
    const sequence = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  // ═══ تنسيق الأرقام ═══
  function formatNumber(num) {
    if (typeof num !== 'number') num = parseFloat(num) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  function formatArabicDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch(e) { return dateStr; }
  }

  // ═══ بناء الفاتورة مع دعم الإعدادات اليدوية ═══
  function buildInvoice(clientName, customData = {}) {
    const data = getDashboardData();
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + (customData.dueDays || 30));
    
    // البحث عن العميل في D.soc
    const socEntry = data.soc.find(s => s.nm === clientName) || {};
    
    // استخراج المنتجات
    let items;
    if (customData.items && Array.isArray(customData.items) && customData.items.length > 0) {
      // استخدام المنتجات المُدخلة يدوياً
      items = customData.items.map((it, idx) => ({
        no: idx + 1,
        code: it.code || `MAN-${String(idx+1).padStart(3, '0')}`,
        name: it.name || 'صنف',
        nameEn: it.nameEn || '',
        unit: it.unit || 'قطعة',
        quantity: parseFloat(it.quantity) || 0,
        unitPrice: parseFloat(it.unitPrice) || 0,
        discount: parseFloat(it.discount) || 0,
        isFree: it.isFree || (parseFloat(it.unitPrice) === 0 && parseFloat(it.quantity) > 0),
        notes: it.notes || '',
      }));
    } else {
      // استخراج تلقائي من البيانات
      items = extractItemsFromTransactions(clientName, customData);
      if (items.length === 0) {
        // Fallback: عنصر واحد إجمالي
        items = [{
          no: 1,
          code: 'GEN-001',
          name: 'مشتريات الفترة',
          nameEn: 'Period Purchases',
          unit: 'طرد',
          quantity: parseFloat(socEntry.q || 1),
          unitPrice: parseFloat(socEntry.s || 0),
          discount: 0,
          isFree: false,
          notes: '',
        }];
      }
    }
    
    // حساب الإجماليات (بدون ضرائب)
    let subtotal = 0;
    let totalDiscount = 0;
    items.forEach(it => {
      const lineTotal = it.quantity * it.unitPrice;
      const discountAmount = (lineTotal * it.discount) / 100;
      subtotal += lineTotal;
      totalDiscount += discountAmount;
    });
    
    const afterDiscount = subtotal - totalDiscount;
    const received = parseFloat(socEntry.c) || 0;
    const outstanding = afterDiscount - received;
    
    // تحديد الحالة
    let status = 'pending';
    if (outstanding <= 0.001) status = 'paid';
    else if (received > 0) status = 'partial';
    
    // تصنيف العميل
    let clientTier = 'regular';
    if (afterDiscount > 50000) clientTier = 'vip';
    else if (afterDiscount > 20000) clientTier = 'gold';
    else if (afterDiscount > 5000) clientTier = 'silver';
    
    return {
      id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      number: generateInvoiceNumber(customData.prefix || 'INV'),
      date: today.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      createdAt: today.toISOString(),
      client: {
        id: socEntry.id || clientName,
        name: clientName,
        agent: socEntry.ag || 'غير محدد',
        phone: socEntry.phone || socEntry.tel || '+965 XXXX XXXX',
        email: socEntry.email || '',
        address: socEntry.address || '',
        tier: clientTier,
        rawData: socEntry,
      },
      period: {
        from: data.ml[data.filterA] || '',
        to: data.ml[data.filterB] || '',
      },
      items: items,
      totals: {
        subtotal: subtotal,
        discount: totalDiscount,
        afterDiscount: afterDiscount,
        // بدون ضرائب في الكويت
      },
      payments: {
        received: received,
        outstanding: outstanding,
        percentPaid: afterDiscount > 0 ? (received / afterDiscount * 100) : 0,
      },
      status: status,
      notes: customData.notes || '',
      type: 'sales',
    };
  }

  // ═══ توليد HTML للفاتورة بدون ضرائب ═══
  
// 🛡️ FIX: بناء HTML للفاتورة عبر <template> tag (محمي من CDN)
window.buildInvoiceHTML = function(pagesHTML, invoice, s) {
  const tpl = window.__INVOICE_TEMPLATE__;
  if(!tpl) {
    // 🛡️ FIX: fallback DOM-safe بدون HTML literal
    return buildInvoiceHTMLSafe(pagesHTML, invoice, s);
  }
  
  // نستخدم template element ونستخرج النص
  const tempEl = document.createElement('template');
  tempEl.innerHTML = tpl;
  const content = tempEl.content;
  
  // استبدال placeholders بطريقة DOM-safe
  const titleEl = content.querySelector('title');
  if(titleEl) titleEl.textContent = 'فاتورة ' + (invoice.number || '') + ' · ' + (invoice.client.name || '');
  
  const invoiceNumberEls = content.querySelectorAll('.no-print-bar strong');
  invoiceNumberEls.forEach(el => el.textContent = '🧾 فاتورة ' + (invoice.number || ''));
  
  const containerEl = content.querySelector('.invoice-container');
  if(containerEl) containerEl.innerHTML = pagesHTML;
  
  const statusEl = content.querySelector('.watermark');
  if(statusEl) {
    statusEl.className = 'watermark watermark--' + (invoice.status || 'regular');
  }
  
  const iconEl = content.querySelector('.watermark-icon');
  if(iconEl) iconEl.textContent = (s && s.icon) || '';
  
  const arEl = content.querySelector('.watermark-text > div:first-child');
  if(arEl) arEl.textContent = (s && s.ar) || '';
  
  const enEl = content.querySelector('.watermark-en');
  if(enEl) enEl.textContent = (s && s.en) || '';
  
  // نُسلسل الـ DOM كنص
  const serializer = new XMLSerializer();
  let result = '';
  content.childNodes.forEach(node => {
    result += serializer.serializeToString(node);
  });
  return '<!DOCTYPE html>' + result;
};

// 🆕 v220.1+ LOCKED: استدعاءات إضافية (الـ AuditLog الأصلي موجود بالفعل)
window.AuditLogEnhanced = {
  // امتداد للدالة الأصلية لإضافة ميزات جديدة
  logWithUI(action, details) {
    if(typeof window.AuditLog !== 'undefined' && window.AuditLog.log) {
      window.AuditLog.log(action, details);
    }
  },
  show() {
    // عرض السجلات في modal (نستخدم الدالة الأصلية render)
    if(typeof window.AuditLog !== 'undefined' && window.AuditLog.render) {
      // ابحث عن لوحة المراجعة وافتحها
      if(typeof sw === 'function') sw('clients360');
    } else {
      alert('AuditLog غير متاح');
    }
  }
};

Logger.info('✅ AuditLog enhanced ready');

// ════════════════════════════════════════════════════════════════════
// 🆕 v220.1+ LOCKED: نسخ احتياطي تلقائي
// ════════════════════════════════════════════════════════════════════
window.AutoBackup = {
  // حفظ نسخة احتياطية بتاريخ
  save() {
    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
      
      // حفظ النسخة اليومية
      const backup = {
        version: 'v220.1+LOCKED',
        timestamp,
        date: dateKey,
        soc: O.soc,
        ag: O.ag,
        tx: O.tx,
        mon: O.mon,
        ml: O.ml,
        mk: O.mk,
        T: O.T
      };
      localStorage.setItem('nayef_daily_backup_' + dateKey, JSON.stringify(backup));
      
      // حفظ آخر نسخة (للاستعادة السريعة)
      localStorage.setItem('nayef_latest_backup', JSON.stringify(backup));
      
      // تنظيف النسخ القديمة (الاحتفاظ بآخر 30 يوم)
      this.cleanOldBackups();
      
      Logger.info('💾 Auto backup saved:', dateKey);
      return true;
    } catch(e) {
      Logger.error('⚠️ Auto backup error:', e);
      return false;
    }
  },
  
  // حذف النسخ الأقدم من 30 يوم
  cleanOldBackups() {
    try {
      const now = Date.now();
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      Object.keys(localStorage).forEach(key => {
        if(key.startsWith('nayef_daily_backup_')) {
          const date = key.replace('nayef_daily_backup_', '');
          const backupDate = new Date(date).getTime();
          if(now - backupDate > THIRTY_DAYS) {
            localStorage.removeItem(key);
            Logger.info('🗑️ Cleaned old backup:', date);
          }
        }
      });
    } catch(e) { Logger.warn('cleanOldBackups:', e); }
  },
  
  // استعادة من تاريخ معين
  restoreFromDate(dateKey) {
    try {
      const data = localStorage.getItem('nayef_daily_backup_' + dateKey);
      if(!data) { alert('لا توجد نسخة احتياطية لهذا التاريخ'); return; }
      const backup = JSON.parse(data);
      if(!confirm('سيتم استبدال كل البيانات بنسخة ' + dateKey + '. متابعة؟')) return;
      O.soc = backup.soc || [];
      O.ag = backup.ag || [];
      O.tx = backup.tx || [];
      O.mon = backup.mon || [];
      O.ml = backup.ml || [];
      O.mk = backup.mk || [];
      O.T = backup.T || {};
      nayefSaveData();
      location.reload();
    } catch(e) {
      alert('خطأ: ' + e.message);
    }
  },
  
  // عرض قائمة النسخ المتاحة
  listAvailable() {
    const backups = [];
    Object.keys(localStorage).forEach(key => {
      if(key.startsWith('nayef_daily_backup_')) {
        const date = key.replace('nayef_daily_backup_', '');
        try {
          const data = JSON.parse(localStorage.getItem(key));
          backups.push({
            date,
            version: data.version,
            soc_count: data.soc?.length || 0,
            tx_count: data.tx?.length || 0,
            size: (localStorage.getItem(key).length / 1024).toFixed(1) + ' KB'
          });
        } catch(e) {}
      }
    });
    return backups.sort((a, b) => b.date.localeCompare(a.date));
  },
  
  // بدء النسخ التلقائي
  start() {
    // حفظ أولي
    this.save();
    // كل ساعة
    setInterval(() => this.save(), 60 * 60 * 1000);
    Logger.info('✅ Auto backup started (every hour)');
  }
};

// ابدأ النسخ التلقائي
setTimeout(() => AutoBackup.start(), 5000);

Logger.info('✅ AutoBackup system ready');

// ════════════════════════════════════════════════════════════════════
// 🆕 v220.1+ LOCKED: تصدير/استيراد JSON
// ════════════════════════════════════════════════════════════════════
window.exportJSONBackup = function() {
  try {
    const backup = {
      version: 'v220.1+LOCKED',
      timestamp: new Date().toISOString(),
      type: 'full_backup',
      data: {
        soc: O.soc,
        ag: O.ag,
        tx: O.tx,
        mon: O.mon,
        ml: O.ml,
        mk: O.mk,
        T: O.T,
        checks: O.checks || [],
        expenses: O.expenses || null,
        agentMovement: O.agentMovement || [],
        agentSummary: O.agentSummary || []
      },
      metadata: {
        tx_count: O.tx?.length || 0,
        soc_count: O.soc?.length || 0,
        exported_by: localStorage.getItem('nayef_current_user') || 'admin',
        exported_at: new Date().toLocaleString('ar-KW', {hour12: false})
      }
    };
    
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type: 'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nayef_backup_${new Date().toISOString().slice(0,10)}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    if(typeof AuditLog !== 'undefined') AuditLog.log('backup_export', { size: (json.length/1024).toFixed(1) + ' KB' });
    if(typeof showToast === 'function') showToast('✅ تم التصدير', 'تم تنزيل النسخة الاحتياطية', true);
  } catch(e) {
    alert('❌ خطأ في التصدير: ' + e.message);
  }
};

window.importJSONBackup = function(file) {
  if(!file) return;
  if(!file.name.endsWith('.json')) {
    alert('⚠️ يجب أن يكون الملف بصيغة JSON');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const backup = JSON.parse(e.target.result);
      
      if(!backup.data) {
        alert('⚠️ ملف النسخة الاحتياطية غير صالح');
        return;
      }
      
      const txCount = backup.data.tx?.length || 0;
      const socCount = backup.data.soc?.length || 0;
      const version = backup.version || 'غير معروف';
      
      if(!confirm('سيتم استبدال كل البيانات الحالية بنسخة:\n\n' +
        '📦 الإصدار: ' + version + '\n' +
        '📅 التاريخ: ' + (backup.timestamp || 'غير معروف') + '\n' +
        '🏢 الجمعيات: ' + socCount + '\n' +
        '📋 المعاملات: ' + txCount + '\n\n' +
        'هل تريد المتابعة؟')) return;
      
      // استبدال البيانات
      O.soc = backup.data.soc || [];
      O.ag = backup.data.ag || [];
      O.tx = backup.data.tx || [];
      O.mon = backup.data.mon || [];
      O.ml = backup.data.ml || [];
      O.mk = backup.data.mk || [];
      O.T = backup.data.T || {};
      O.checks = backup.data.checks || [];
      O.expenses = backup.data.expenses || null;
      O.agentMovement = backup.data.agentMovement || [];
      O.agentSummary = backup.data.agentSummary || [];
      
      nayefSaveData();
      if(typeof AuditLog !== 'undefined') AuditLog.log('backup_import', { version, tx_count: txCount });
      
      if(typeof showToast === 'function') {
        showToast('✅ تم الاستيراد', 'تم استبدال البيانات بنجاح', true);
      }
      
      setTimeout(() => location.reload(), 1500);
    } catch(err) {
      alert('❌ خطأ في قراءة الملف: ' + err.message);
    }
  };
  reader.readAsText(file);
};

Logger.info('✅ JSON Backup system ready');

// ════════════════════════════════════════════════════════════════════
// 🆕 v220.1+ LOCKED: نظام التحقق الصارم من البيانات
// ════════════════════════════════════════════════════════════════════
// [v220.9+] حفظ Validator الموجود قبل الاستبدال
window._legacyValidator = window.Validator || {};

window.Validator = {
  // [v220.9+] إبقاء الدوال القديمة + إضافة الجديدة
  ...(window._legacyValidator || {}),
  
  // التحقق من معاملة
  validateTx(tx) {
    const errors = [];
    const warnings = [];
    
    // الحقول المطلوبة
    if(!tx.dt) errors.push('التاريخ مطلوب');
    else if(!/^\d{4}-\d{2}-\d{2}$/.test(tx.dt)) errors.push('صيغة التاريخ غير صحيحة (YYYY-MM-DD)');
    
    if(!tx.client && !tx.cl) errors.push('اسم العميل مطلوب');
    
    if(!tx.amount && tx.amount !== 0) errors.push('المبلغ مطلوب');
    else if(isNaN(tx.amount)) errors.push('المبلغ يجب أن يكون رقماً');
    else if(tx.amount < 0) errors.push('المبلغ لا يمكن أن يكون سالباً');
    else if(tx.amount > 1000000) warnings.push('المبلغ كبير جداً (> مليون د.ك)');
    
    if(!tx.tp) errors.push('نوع الحركة مطلوب');
    else {
      const validTypes = ['sale', 'return', 'payment', 'opening', 'credit_note', 'debit_note'];
      if(!validTypes.includes(tx.tp)) warnings.push('نوع غير معروف: ' + tx.tp);
    }
    
    // تحذيرات
    if(tx.dt) {
      const txDate = new Date(tx.dt);
      const today = new Date();
      if(txDate > today) errors.push('التاريخ في المستقبل');
      
      // تحذير إذا التاريخ أقدم من 5 سنوات
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      if(txDate < fiveYearsAgo) warnings.push('التاريخ أقدم من 5 سنوات');
    }
    
    // التحقق من وجود العميل
    if((tx.client || tx.cl) && O && O.soc) {
      const clientExists = O.soc.some(s => s.nm === (tx.client || tx.cl));
      if(!clientExists) warnings.push('العميل "' + (tx.client || tx.cl) + '" غير موجود - سيتم إضافته');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  },
  
  // التحقق من عميل
  validateClient(client) {
    const errors = [];
    const warnings = [];
    
    if(!client.nm) errors.push('اسم العميل مطلوب');
    else if(client.nm.length < 2) errors.push('اسم العميل قصير جداً');
    
    if(client.ob !== undefined && isNaN(client.ob)) errors.push('الرصيد الافتتاحي يجب أن يكون رقماً');
    
    if(client.phone && !/^[+\d\s\-()]{0,30}$/.test(client.phone)) {
      warnings.push('صيغة الهاتف غير معتادة');
    }
    
    // تحذير من تكرار الاسم
    if(client.nm && O && O.soc) {
      const duplicate = O.soc.find(s => s.nm === client.nm);
      if(duplicate) errors.push('يوجد عميل بنفس الاسم: ' + client.nm);
    }
    
    return { valid: errors.length === 0, errors, warnings };
  },
  
  // عرض التحذيرات في alert احترافي
  showResult(result) {
    if(result.errors.length > 0) {
      let msg = '❌ أخطاء:\n\n' + result.errors.map((e, i) => (i+1) + '. ' + e).join('\n');
      if(result.warnings.length > 0) {
        msg += '\n\n⚠️ تحذيرات:\n' + result.warnings.map((w, i) => (i+1) + '. ' + w).join('\n');
      }
      alert(msg);
      return false;
    } else if(result.warnings.length > 0) {
      let msg = '⚠️ تحذيرات:\n\n' + result.warnings.map((w, i) => (i+1) + '. ' + w).join('\n');
      msg += '\n\nهل تريد المتابعة؟';
      return confirm(msg);
    }
    return true;
  }
};

Logger.info('✅ Validator system ready');





function generateInvoiceHTML(invoice) {
    const C = COMPANY;
    const tierLabel = { vip: 'VIP', gold: 'GOLD', silver: 'SILVER', regular: 'REGULAR' };
    const tierColor = { 
      vip: 'linear-gradient(135deg,#FFD700,#FFA500)', 
      gold: 'linear-gradient(135deg,#D4AF37,#B8860B)', 
      silver: 'linear-gradient(135deg,#C0C0C0,#A8A8A8)', 
      regular: 'linear-gradient(135deg,#8B7355,#6B5640)' 
    };
    const statusInfo = {
      paid:    { ar: 'مدفوعة بالكامل',  en: 'PAID IN FULL',    color: '#10b981', icon: '✓' },
      partial: { ar: 'دفع جزئي',         en: 'PARTIAL PAYMENT', color: '#f59e0b', icon: '◐' },
      pending: { ar: 'مستحقة الدفع',     en: 'PAYMENT PENDING', color: '#ef4444', icon: '⏳' },
    };
    const s = statusInfo[invoice.status];
    
    const pageCount = Math.ceil(invoice.items.length / ITEMS_PER_PAGE);
    
    let pagesHTML = '';
    for (let p = 0; p < pageCount; p++) {
      const start = p * ITEMS_PER_PAGE;
      const end = Math.min(start + ITEMS_PER_PAGE, invoice.items.length);
      const pageItems = invoice.items.slice(start, end);
      
      pagesHTML += `
        <div class="invoice-page">
          ${p === 0 ? generateInvoiceHeader(invoice, C, tierColor, s, tierLabel) : ''}
          ${p === 0 ? generateClientSection(invoice, tierColor, tierLabel) : ''}
          
          <table class="items-table">
            <thead>
              <tr>
                <th style="width:35px" class="t-c">#</th>
                <th style="width:75px" class="t-c">Code / الكود</th>
                <th>Description / البيان</th>
                <th style="width:60px" class="t-c">Unit</th>
                <th style="width:65px" class="t-c">Qty</th>
                <th style="width:90px" class="t-l">Price</th>
                <th style="width:50px" class="t-c">Disc%</th>
                <th style="width:100px" class="t-l">Total</th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.map(it => {
                const lineTotal = it.quantity * it.unitPrice;
                const discountAmount = (lineTotal * it.discount) / 100;
                const finalTotal = lineTotal - discountAmount;
                return `
                  <tr ${it.isFree ? 'class="row-free"' : ''}>
                    <td class="t-c">${it.no}</td>
                    <td class="t-c"><code>${escapeHtml(it.code)}</code></td>
                    <td>
                      <div class="item-name-ar">${escapeHtml(it.name)}${it.isFree ? ' <span class="free-tag">🎁 مجاني</span>' : ''}</div>
                      ${it.nameEn ? `<div class="item-name-en">${escapeHtml(it.nameEn)}</div>` : ''}
                      ${it.notes ? `<div class="item-notes">📝 ${escapeHtml(it.notes)}</div>` : ''}
                    </td>
                    <td class="t-c">${escapeHtml(it.unit)}</td>
                    <td class="t-c"><b>${formatNumber(it.quantity)}</b></td>
                    <td class="t-l">${it.isFree ? '<span class="free-text">مجاني</span>' : formatNumber(it.unitPrice)}</td>
                    <td class="t-c">${it.discount > 0 ? it.discount + '%' : '—'}</td>
                    <td class="t-l"><b>${formatNumber(finalTotal)}</b></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          ${p === pageCount - 1 ? generateTotalsSection(invoice, s) : `
            <div class="page-indicator">
              <span>صفحة ${p + 1} من ${pageCount} · Page ${p + 1} of ${pageCount}</span>
            </div>
          `}
          
          ${p === pageCount - 1 ? generateFooter(invoice, C) : ''}
        </div>
      `;
    }
    
    // 🛡️ FIX النهائي: لا نُرجع HTML كنص - نستخدم template element
    // نحفظ الـ pagesHTML في window لتُستخدم لاحقاً
    window.__LAST_INVOICE_PAGES__ = pagesHTML;
    window.__LAST_INVOICE_DATA__ = invoice;
    window.__LAST_INVOICE_S__ = s;
    
    // نُرجع HTML بسيط جداً مع placeholder فقط
    return generateInvoiceStyles() + window.buildInvoiceHTML(pagesHTML, invoice, s);
  }

  // ═══ Helper - escape HTML ═══
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  // ═══ رأس الفاتورة ═══
  function generateInvoiceHeader(invoice, C, tierColor, s, tierLabel) {
    return `
<div class="invoice-header">
  <div class="header-brand">
    <div class="company-logo"><span class="logo-letter">${C.logo}</span></div>
    <div class="company-info">
      <h1 class="company-name">${C.nameAr}</h1>
      <p class="company-name-en">${C.nameEn}</p>
      <span class="company-tax-note">${C.taxNote}</span>
    </div>
  </div>

  <div class="header-meta">
    <div class="invoice-title-badge">
      <span class="invoice-title-ar">فاتورة مبيعات</span>
      <span class="invoice-title-en">Sales Invoice</span>
    </div>
    
    <div class="invoice-number-box">
      <div class="inv-label">رقم الفاتورة / Invoice No.</div>
      <div class="inv-number">${invoice.number}</div>
    </div>
    
    <div class="status-badge" style="background:${hexToRgba(s.color, 0.1)};border-color:${s.color};color:${s.color}">
      <span class="status-icon">${s.icon}</span>
      <div>
        <div class="status-text-ar">${s.ar}</div>
        <div class="status-text-en">${s.en}</div>
      </div>
    </div>
  </div>
</div>

<div class="info-bar">
  <div class="info-cell">
    <div class="info-icon">📅</div>
    <div>
      <div class="info-label-ar">تاريخ الإصدار</div>
      <div class="info-label-en">Issue Date</div>
      <div class="info-value">${formatArabicDate(invoice.date)}</div>
    </div>
  </div>
  <div class="info-cell">
    <div class="info-icon">⏰</div>
    <div>
      <div class="info-label-ar">تاريخ الاستحقاق</div>
      <div class="info-label-en">Due Date</div>
      <div class="info-value">${formatArabicDate(invoice.dueDate)}</div>
    </div>
  </div>
  <div class="info-cell">
    <div class="info-icon">📞</div>
    <div>
      <div class="info-label-ar">رقم الشركة</div>
      <div class="info-label-en">Company</div>
      <div class="info-value">${C.phone}</div>
    </div>
  </div>
  <div class="info-cell">
    <div class="info-icon">📍</div>
    <div>
      <div class="info-label-ar">العنوان</div>
      <div class="info-label-en">Address</div>
      <div class="info-value">${C.addressAr}</div>
    </div>
  </div>
</div>
    `;
  }

  // ═══ قسم العميل ═══
  function generateClientSection(invoice, tierColor, tierLabel) {
    const tierStyle = tierColor[invoice.client.tier] || tierColor.regular;
    return `
<div class="client-section">
  <div class="client-header">
    <span class="client-label-ar">فاتورة إلى</span>
    <span class="client-label-en">Bill To</span>
  </div>
  <div class="client-body">
    <div class="client-main">
      <div class="client-name-row">
        <span class="client-tier-badge" style="background:${tierStyle}">${tierLabel[invoice.client.tier]}</span>
        <span class="client-name">${escapeHtml(invoice.client.name)}</span>
      </div>
      <div class="client-details">
        ${invoice.client.phone ? `<div class="client-detail"><span>📞</span> ${escapeHtml(invoice.client.phone)}</div>` : ''}
        ${invoice.client.email ? `<div class="client-detail"><span>📧</span> ${escapeHtml(invoice.client.email)}</div>` : ''}
        ${invoice.client.address ? `<div class="client-detail"><span>📍</span> ${escapeHtml(invoice.client.address)}</div>` : ''}
      </div>
    </div>
    <div class="client-period">
      <div class="period-label-ar">الفترة / Period</div>
      <div class="period-dates">${escapeHtml(invoice.period.from)} → ${escapeHtml(invoice.period.to)}</div>
      <div class="agent-label">المندوب / Sales Agent</div>
      <div class="agent-name">${escapeHtml(invoice.client.agent)}</div>
    </div>
  </div>
</div>
    `;
  }

  // ═══ قسم الإجماليات (بدون ضرائب) ═══
  function generateTotalsSection(invoice, s) {
    const collected = invoice.payments.percentPaid;
    return `
<div class="totals-section">
  <!-- شريط تقدم التحصيل -->
  <div class="collection-progress">
    <div class="progress-label">
      <span>نسبة التحصيل / Collection Progress</span>
      <span class="progress-percent">${collected.toFixed(1)}%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${Math.min(100, collected)}%;background:${s.color}">
        <span>${collected.toFixed(1)}%</span>
      </div>
    </div>
  </div>
  
  <!-- ملخص المبالغ -->
  <div class="totals-grid">
    <div class="totals-card">
      <div class="totals-card-icon">📊</div>
      <div class="totals-card-content">
        <div class="totals-label">المجموع / Subtotal</div>
        <div class="totals-value">${formatNumber(invoice.totals.subtotal)} <span class="currency">د.ك</span></div>
      </div>
    </div>
    ${invoice.totals.discount > 0 ? `
    <div class="totals-card totals-card--discount">
      <div class="totals-card-icon">🏷️</div>
      <div class="totals-card-content">
        <div class="totals-label">الخصم / Discount</div>
        <div class="totals-value">−${formatNumber(invoice.totals.discount)} <span class="currency">د.ك</span></div>
      </div>
    </div>` : ''}
    <div class="totals-card totals-card--total">
      <div class="totals-card-icon">💰</div>
      <div class="totals-card-content">
        <div class="totals-label">الإجمالي / Total</div>
        <div class="totals-value">${formatNumber(invoice.totals.afterDiscount)} <span class="currency">د.ك</span></div>
      </div>
    </div>
    <div class="totals-card totals-card--paid">
      <div class="totals-card-icon">✅</div>
      <div class="totals-card-content">
        <div class="totals-label">المدفوع / Paid</div>
        <div class="totals-value">${formatNumber(invoice.payments.received)} <span class="currency">د.ك</span></div>
      </div>
    </div>
    <div class="totals-card ${invoice.status === 'paid' ? 'totals-card--paid' : 'totals-card--pending'}">
      <div class="totals-card-icon">${invoice.status === 'paid' ? '🎉' : '⏳'}</div>
      <div class="totals-card-content">
        <div class="totals-label">المتبقي / Outstanding</div>
        <div class="totals-value">${formatNumber(invoice.payments.outstanding)} <span class="currency">د.ك</span></div>
      </div>
    </div>
  </div>
  
  <!-- ملاحظة الإعفاء الضريبي -->
  <div class="tax-note-bar">
    <span>ℹ️</span>
    <span>المبلغ النهائي لا يشمل ضريبة - معفى من الضريبة حسب قوانين دولة الكويت</span>
    <span class="tax-note-en">Tax-Exempt under Kuwait Law</span>
  </div>
</div>
    `;
  }

  // ═══ تذييل الفاتورة ═══
  function generateFooter(invoice, C) {
    return `
<div class="footer-section">
  <div class="bank-qr-grid">
    <div class="bank-info">
      <h3 class="bank-title">
        <span class="bank-icon">🏦</span>
        <span>تفاصيل الحساب البنكي / Bank Details</span>
      </h3>
      <div class="bank-details">
        <div class="bank-row"><span>اسم البنك / Bank:</span><b>${C.bankName}</b></div>
        <div class="bank-row"><span>رقم الحساب / Account:</span><b>${C.bankAccount}</b></div>
        <div class="bank-row"><span>IBAN:</span><b>${C.iban}</b></div>
        <div class="bank-row"><span>SWIFT:</span><b>${C.swift}</b></div>
      </div>
    </div>
    <div class="qr-section">
      <div class="qr-code">${generateQRCode(invoice.number + '|' + invoice.totals.afterDiscount)}</div>
      <div class="qr-label">امسح للتحقق / Scan to Verify</div>
    </div>
  </div>
  
  <div class="terms-section">
    <h3 class="terms-title">📜 الشروط والأحكام / Terms & Conditions</h3>
    <ol class="terms-list">
      <li>الدفع خلال ${Math.round((new Date(invoice.dueDate) - new Date(invoice.date)) / (1000 * 60 * 60 * 24))} يوماً من تاريخ الإصدار.</li>
      <li>Payment is due within ${Math.round((new Date(invoice.dueDate) - new Date(invoice.date)) / (1000 * 60 * 60 * 24))} days from issue date.</li>
      <li>تأخر السداد قد يؤدي لرسوم إضافية. Late payment may incur additional fees.</li>
      <li>البضاعة المباعة لا ترد ولا تستبدل بعد 7 أيام. Goods sold are non-refundable after 7 days.</li>
      <li>معفى من الضريبة - الكويت لا تفرض ضريبة على هذا النوع من المعاملات.</li>
      <li>Tax-exempt - Kuwait does not levy VAT on these transactions.</li>
      <li>أي نزاع يخضع لقوانين دولة الكويت. Any dispute subject to Kuwait law.</li>
    </ol>
  </div>
  
  <div class="signatures-section">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">توقيع المستلم / Customer Signature</div>
      <div class="signature-name">${escapeHtml(invoice.client.name)}</div>
    </div>
    <div class="signature-stamp">
      <div class="stamp-circle">
        <div class="stamp-inner">
          <div class="stamp-text">ختم الشركة</div>
          <div class="stamp-text-en">STAMP</div>
        </div>
      </div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">المدير المالي / Financial Manager</div>
      <div class="signature-name">${C.nameAr}</div>
    </div>
  </div>
  
  <div class="invoice-footer">
    <div class="footer-info">
      <span>📍 ${C.addressAr}</span>
    </div>
    <div class="footer-info">
      <span>📞 ${C.phone}</span>
      <span>· ${C.mobile}</span>
      <span>· ✉️ ${C.email}</span>
      <span>· 🌐 ${C.website}</span>
    </div>
    <div class="footer-thanks">
      شكراً لتعاملكم معنا · Thank you for your business
    </div>
  </div>
</div>
    `;
  }

  // ═══ QR Code مدمج ═══
  function generateQRCode(data, size = 90) {
    const cells = 21;
    const cellSize = size / cells;
    let rects = '';
    let seed = 0;
    for (let i = 0; i < data.length; i++) seed += data.charCodeAt(i);
    
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const value = ((x * 7 + y * 13 + seed + x * y) % 3) === 0;
        const isCorner = (x < 7 && y < 7) || (x >= cells - 7 && y < 7) || (x < 7 && y >= cells - 7);
        if (value || (isCorner && (x === 0 || x === 6 || y === 0 || y === 6 || 
            (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
            (x === cells-1 || x === cells-7 || y === cells-1 || y === cells-7)))) {
          rects += `<rect x="${(x * cellSize).toFixed(1)}" y="${(y * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="#1a1a1a"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${rects}</svg>`;
  }

  // ═══ hex to rgba ═══
  function hexToRgba(hex, alpha = 1) {
    if (!hex || !hex.startsWith('#')) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ═══ CSS بدون ضرائب ═══
  function generateInvoiceStyles() {
    return `
<style>
  @page { size: A4 portrait; margin: 1cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Tajawal', 'Inter', sans-serif; 
    background: #f5f1e8; 
    color: #1a1a1a;
    padding: 0;
    font-size: 11px;
    line-height: 1.4;
    -webkit-font-smoothing: antialiased;
  }
  
  /* Print Bar */
  .no-print-bar {
    background: linear-gradient(135deg, #1f2937, #111827);
    color: white;
    padding: 12px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .no-print-actions { display: flex; gap: 8px; }
  .no-print-actions button {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    font-weight: 700;
    font-size: 13px;
    transition: all 0.2s;
  }
  .btn-print { background: linear-gradient(135deg, hsl(43,80%,55%), hsl(43,80%,45%)); color: white; }
  .btn-print:hover { transform: translateY(-1px); box-shadow: 0 4px 12px hsla(43,80%,50%,0.4); }
  .btn-close { background: rgba(255,255,255,0.1); color: white; }
  .btn-close:hover { background: rgba(255,255,255,0.2); }
  
  /* Invoice Container */
  .invoice-container {
    max-width: 900px;
    margin: 20px auto;
    padding: 0 20px;
    position: relative;
  }
  
  .invoice-page {
    background: white;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    padding: 36px;
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;
    min-height: 1100px;
  }
  
  .invoice-page::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 200px;
    height: 200px;
    background: radial-gradient(circle at top right, hsla(43,80%,70%,0.15) 0%, transparent 70%);
    pointer-events: none;
  }
  .invoice-page::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle at bottom left, hsla(80,60%,70%,0.1) 0%, transparent 70%);
    pointer-events: none;
  }
  
  /* Header */
  .invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 24px;
    border-bottom: 2px solid hsl(43, 70%, 55%);
    margin-bottom: 24px;
    position: relative;
    z-index: 1;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .company-logo {
    width: 72px;
    height: 72px;
    background: linear-gradient(135deg, hsl(43, 80%, 55%), hsl(35, 70%, 45%));
    border-radius: 18px;
    display: grid;
    place-items: center;
    color: white;
    font-size: 36px;
    font-weight: 900;
    box-shadow: 0 8px 24px hsla(43, 70%, 50%, 0.3);
    position: relative;
  }
  .company-logo::after {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: 16px;
    border: 2px solid rgba(255,255,255,0.3);
  }
  .logo-letter { line-height: 1; }
  
  .company-name {
    font-size: 22px;
    font-weight: 900;
    color: hsl(80, 45%, 15%);
    margin: 0;
    line-height: 1.2;
  }
  .company-name-en {
    font-size: 12px;
    color: hsl(43, 70%, 35%);
    font-weight: 600;
    margin: 4px 0;
  }
  .company-tax-note {
    display: inline-block;
    background: linear-gradient(135deg, hsl(140, 60%, 92%), hsl(140, 60%, 88%));
    color: hsl(140, 60%, 25%);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    margin-top: 2px;
  }
  
  /* Header Meta */
  .header-meta {
    text-align: left;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
  .invoice-title-badge {
    background: linear-gradient(135deg, hsl(43, 70%, 50%), hsl(43, 70%, 40%));
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 4px 12px hsla(43, 70%, 50%, 0.3);
  }
  .invoice-title-ar { 
    font-size: 16px; 
    font-weight: 900; 
    display: block;
  }
  .invoice-title-en { 
    font-size: 10px; 
    font-weight: 500; 
    opacity: 0.9;
    display: block;
    margin-top: 2px;
  }
  
  .invoice-number-box {
    background: hsl(80, 30%, 97%);
    padding: 8px 16px;
    border-radius: 8px;
    border-right: 3px solid hsl(43, 70%, 50%);
  }
  .inv-label {
    font-size: 9px;
    color: hsl(80, 30%, 40%);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .inv-number {
    font-size: 18px;
    font-weight: 900;
    color: hsl(80, 45%, 15%);
    font-family: 'Inter', monospace;
    margin-top: 2px;
  }
  
  .status-badge {
    padding: 8px 14px;
    border-radius: 8px;
    border: 2px solid;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status-icon { font-size: 16px; }
  .status-text-ar {
    font-size: 12px;
    font-weight: 800;
  }
  .status-text-en {
    font-size: 9px;
    font-weight: 600;
    opacity: 0.8;
  }
  
  /* Info Bar */
  .info-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .info-cell {
    background: linear-gradient(135deg, hsl(80, 30%, 98%), hsl(43, 40%, 97%));
    padding: 12px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid hsl(80, 30%, 90%);
  }
  .info-icon {
    font-size: 22px;
    width: 36px;
    height: 36px;
    background: white;
    border-radius: 8px;
    display: grid;
    place-items: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }
  .info-label-ar {
    font-size: 9px;
    color: hsl(80, 30%, 40%);
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .info-label-en {
    font-size: 8px;
    color: hsl(80, 30%, 50%);
    opacity: 0.7;
    font-weight: 600;
  }
  .info-value {
    font-size: 11px;
    font-weight: 700;
    color: hsl(80, 45%, 15%);
    margin-top: 2px;
  }
  
  /* Client Section */
  .client-section {
    background: linear-gradient(135deg, hsla(43, 60%, 96%, 0.8), hsla(80, 40%, 96%, 0.8));
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 24px;
    border: 1px solid hsla(43, 50%, 85%, 0.6);
    backdrop-filter: blur(10px);
  }
  .client-header {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
  }
  .client-label-ar {
    font-size: 10px;
    color: hsl(80, 30%, 35%);
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .client-label-en {
    font-size: 9px;
    color: hsl(80, 30%, 50%);
    font-weight: 600;
  }
  .client-body {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
  }
  .client-main {
    flex: 1;
  }
  .client-name-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .client-tier-badge {
    color: white;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }
  .client-name {
    font-size: 18px;
    font-weight: 800;
    color: hsl(80, 45%, 15%);
  }
  .client-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px 16px;
  }
  .client-detail {
    font-size: 11px;
    color: hsl(80, 30%, 30%);
  }
  .client-detail span {
    margin-right: 4px;
  }
  
  .client-period {
    text-align: left;
    min-width: 200px;
  }
  .period-label-ar {
    font-size: 9px;
    color: hsl(80, 30%, 40%);
    text-transform: uppercase;
    font-weight: 700;
  }
  .period-dates {
    font-size: 12px;
    font-weight: 700;
    color: hsl(80, 45%, 15%);
    margin: 4px 0 12px;
    font-family: 'Inter', monospace;
  }
  .agent-label {
    font-size: 9px;
    color: hsl(80, 30%, 40%);
    text-transform: uppercase;
    font-weight: 700;
  }
  .agent-name {
    font-size: 13px;
    font-weight: 700;
    color: hsl(43, 70%, 35%);
    margin-top: 4px;
  }
  
  /* Items Table */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .items-table thead {
    background: linear-gradient(135deg, hsl(43, 70%, 45%), hsl(35, 70%, 35%));
    color: white;
  }
  .items-table th {
    padding: 12px 10px;
    text-align: right;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.3px;
  }
  .items-table th.t-c { text-align: center; }
  .items-table th.t-l { text-align: left; }
  .items-table td {
    padding: 10px;
    border-bottom: 1px solid hsl(80, 30%, 92%);
    font-size: 11px;
    color: hsl(80, 30%, 15%);
  }
  .items-table tbody tr:nth-child(even) { background: hsl(80, 30%, 98%); }
  .items-table tbody tr:hover { background: hsla(43, 60%, 90%, 0.3); }
  .items-table tbody tr.row-free {
    background: linear-gradient(90deg, hsla(140, 60%, 95%, 0.5), transparent);
    border-left: 3px solid hsl(140, 60%, 50%);
  }
  .items-table td.t-c { text-align: center; }
  .items-table td.t-l { text-align: left; font-family: 'Inter', monospace; }
  .items-table code {
    background: hsl(80, 30%, 92%);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    color: hsl(80, 30%, 25%);
    font-family: 'Inter', monospace;
  }
  .item-name-ar {
    font-weight: 700;
    color: hsl(80, 45%, 15%);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .item-name-en {
    font-size: 9px;
    color: hsl(80, 30%, 50%);
    font-style: italic;
    margin-top: 2px;
  }
  .item-notes {
    font-size: 9px;
    color: hsl(43, 70%, 35%);
    margin-top: 2px;
    font-style: italic;
  }
  .free-tag {
    background: linear-gradient(135deg, hsl(140, 60%, 50%), hsl(140, 60%, 40%));
    color: white;
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.3px;
  }
  .free-text {
    color: hsl(140, 60%, 35%);
    font-weight: 700;
    font-size: 10px;
  }
  
  .page-indicator {
    text-align: center;
    padding: 16px;
    color: hsl(80, 30%, 50%);
    font-size: 11px;
    font-weight: 600;
    border-top: 1px dashed hsl(80, 30%, 85%);
  }
  
  /* Totals Section */
  .totals-section {
    margin-bottom: 24px;
  }
  .collection-progress {
    background: hsl(80, 30%, 97%);
    padding: 12px 16px;
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 6px;
    color: hsl(80, 45%, 20%);
  }
  .progress-percent {
    font-size: 14px;
    font-weight: 900;
    color: hsl(43, 70%, 40%);
  }
  .progress-bar {
    height: 12px;
    background: hsl(80, 30%, 90%);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
  }
  .progress-fill {
    height: 100%;
    border-radius: 6px;
    transition: width 0.5s ease;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 8px;
    color: white;
    font-size: 10px;
    font-weight: 800;
    box-shadow: inset 0 1px 2px rgba(255,255,255,0.3);
  }
  
  .totals-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }
  .totals-card {
    background: white;
    border: 1px solid hsl(80, 30%, 88%);
    border-radius: 10px;
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.2s;
  }
  .totals-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.08);
  }
  .totals-card-icon {
    font-size: 24px;
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, hsl(80, 30%, 96%), hsl(43, 40%, 95%));
    border-radius: 10px;
    display: grid;
    place-items: center;
  }
  .totals-card--discount .totals-card-icon { background: linear-gradient(135deg, hsl(0, 60%, 96%), hsl(0, 60%, 92%)); }
  .totals-card--total { 
    background: linear-gradient(135deg, hsl(43, 70%, 96%), hsl(43, 70%, 92%));
    border-color: hsl(43, 70%, 70%);
  }
  .totals-card--total .totals-card-icon {
    background: linear-gradient(135deg, hsl(43, 80%, 55%), hsl(43, 80%, 45%));
    color: white;
  }
  .totals-card--paid {
    background: linear-gradient(135deg, hsl(140, 60%, 96%), hsl(140, 60%, 92%));
    border-color: hsl(140, 60%, 70%);
  }
  .totals-card--pending {
    background: linear-gradient(135deg, hsl(0, 60%, 96%), hsl(0, 60%, 92%));
    border-color: hsl(0, 60%, 70%);
  }
  .totals-card-content {
    flex: 1;
    min-width: 0;
  }
  .totals-label {
    font-size: 9px;
    color: hsl(80, 30%, 40%);
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .totals-value {
    font-size: 16px;
    font-weight: 900;
    color: hsl(80, 45%, 15%);
    margin-top: 2px;
    font-family: 'Inter', monospace;
  }
  .currency {
    font-size: 10px;
    color: hsl(80, 30%, 50%);
    font-weight: 600;
  }
  
  /* Tax Note Bar */
  .tax-note-bar {
    background: linear-gradient(135deg, hsl(140, 60%, 96%), hsl(140, 60%, 92%));
    border: 1px solid hsl(140, 60%, 80%);
    border-radius: 8px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 11px;
    color: hsl(140, 60%, 25%);
    font-weight: 600;
  }
  .tax-note-en {
    opacity: 0.7;
    font-weight: 500;
    border-left: 1px solid hsl(140, 60%, 70%);
    padding-left: 8px;
    margin-left: 4px;
  }
  
  /* Footer */
  .footer-section {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 2px dashed hsl(80, 30%, 88%);
  }
  
  .bank-qr-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
    align-items: center;
    margin-bottom: 24px;
    background: linear-gradient(135deg, hsl(80, 30%, 98%), hsl(43, 40%, 97%));
    padding: 16px;
    border-radius: 10px;
  }
  .bank-title {
    font-size: 12px;
    font-weight: 800;
    color: hsl(80, 45%, 15%);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .bank-icon { font-size: 16px; }
  .bank-details { display: flex; flex-direction: column; gap: 4px; }
  .bank-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: hsl(80, 30%, 35%);
    padding: 4px 8px;
    background: white;
    border-radius: 4px;
    border-right: 2px solid hsl(43, 70%, 50%);
  }
  .bank-row b {
    color: hsl(80, 45%, 15%);
    font-family: 'Inter', monospace;
    font-size: 9px;
  }
  
  .qr-section {
    text-align: center;
  }
  .qr-code {
    background: white;
    padding: 8px;
    border-radius: 8px;
    border: 2px solid hsl(43, 70%, 50%);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    display: inline-block;
  }
  .qr-code svg { display: block; }
  .qr-label {
    font-size: 9px;
    color: hsl(80, 30%, 40%);
    margin-top: 6px;
    font-weight: 600;
  }
  
  .terms-section {
    background: hsl(80, 30%, 97%);
    padding: 12px 16px;
    border-radius: 10px;
    margin-bottom: 20px;
  }
  .terms-title {
    font-size: 11px;
    font-weight: 800;
    color: hsl(80, 45%, 15%);
    margin-bottom: 8px;
  }
  .terms-list {
    padding-right: 16px;
    font-size: 10px;
    color: hsl(80, 30%, 30%);
    line-height: 1.6;
  }
  .terms-list li { margin-bottom: 4px; }
  
  .signatures-section {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 24px;
    align-items: center;
    margin-bottom: 20px;
  }
  .signature-box { text-align: center; }
  .signature-line {
    border-bottom: 2px solid hsl(80, 45%, 15%);
    height: 50px;
    margin-bottom: 4px;
    position: relative;
  }
  .signature-line::after {
    content: '✕';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    color: hsl(80, 30%, 70%);
    font-size: 16px;
  }
  .signature-label {
    font-size: 10px;
    color: hsl(80, 30%, 40%);
    font-weight: 600;
  }
  .signature-name {
    font-size: 9px;
    color: hsl(80, 30%, 50%);
    margin-top: 2px;
  }
  
  .signature-stamp {
    width: 80px;
    height: 80px;
    position: relative;
  }
  .stamp-circle {
    width: 100%;
    height: 100%;
    border: 3px solid hsl(43, 70%, 40%);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: white;
    box-shadow: inset 0 0 8px hsla(43, 70%, 50%, 0.15);
    position: relative;
  }
  .stamp-circle::before {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1px dashed hsl(43, 70%, 40%);
    border-radius: 50%;
  }
  .stamp-inner {
    text-align: center;
    transform: rotate(-15deg);
  }
  .stamp-text {
    font-size: 9px;
    font-weight: 800;
    color: hsl(43, 70%, 40%);
    line-height: 1.2;
  }
  .stamp-text-en {
    font-size: 7px;
    font-weight: 600;
    color: hsl(43, 70%, 50%);
    margin-top: 2px;
  }
  
  .invoice-footer {
    background: linear-gradient(135deg, hsl(80, 45%, 15%), hsl(80, 45%, 20%));
    color: white;
    padding: 16px;
    border-radius: 10px;
    text-align: center;
  }
  .footer-info {
    font-size: 10px;
    color: hsla(0, 0%, 100%, 0.85);
    margin-bottom: 6px;
    line-height: 1.6;
  }
  .footer-info span { margin: 0 4px; }
  .footer-thanks {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid hsla(0, 0%, 100%, 0.2);
    font-size: 11px;
    font-weight: 700;
    color: hsl(43, 80%, 70%);
  }
  
  /* Watermark */
  .watermark {
    position: fixed;
    bottom: 40px;
    left: 40px;
    pointer-events: none;
    z-index: 0;
    opacity: 0.08;
    transform: rotate(-15deg);
  }
  .watermark--paid { color: #10b981; }
  .watermark--partial { color: #f59e0b; }
  .watermark--pending { color: #ef4444; }
  .watermark-icon {
    font-size: 80px;
    display: inline-block;
    margin-right: 16px;
  }
  .watermark-text {
    display: inline-block;
    font-size: 64px;
    font-weight: 900;
    line-height: 1;
    vertical-align: middle;
  }
  .watermark-en {
    font-size: 32px;
    font-weight: 700;
    margin-top: 8px;
    opacity: 0.8;
  }
  
  /* Print */
  @media print {
  /* إخفاء كل شيء ما عدا كشف الحساب */
  body.printing-statement * {
    visibility: hidden;
  }
  body.printing-statement .statement-page,
  body.printing-statement .statement-page * {
    visibility: visible;
  }
  
  /* تنسيق الصفحة */
  body.printing-statement {
    margin: 0 !important;
    padding: 8mm !important;
    background: white !important;
    font-size: 10px !important;
    color: #000 !important;
  }
  
  /* صفحة كشف الحساب */
  body.printing-statement .statement-page {
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    top: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
    page-break-inside: auto;
  }
  
  /* رأس الصفحة */
  body.printing-statement .statement-header {
    padding: 4px 8px !important;
    margin-bottom: 4px !important;
    background: #f8f8f8 !important;
    border: 1px solid #ddd !important;
    min-height: auto !important;
    gap: 8px !important;
  }
  body.printing-statement .statement-company-info h1 {
    font-size: 16px !important;
    margin: 0 !important;
  }
  body.printing-statement .statement-tagline,
  body.printing-statement .statement-contact {
    font-size: 9px !important;
    margin: 2px 0 !important;
  }
  body.printing-statement .statement-logo {
    width: 32px !important;
    height: 32px !important;
    font-size: 12px !important;
  }
  
  /* معلومات العميل */
  body.printing-statement .statement-info-grid {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 4px !important;
    padding: 6px !important;
    margin-bottom: 6px !important;
  }
  body.printing-statement .statement-info-card {
    padding: 3px 6px !important;
    background: #fafafa !important;
    border: 1px solid #eee !important;
    min-height: auto !important;
  }
  body.printing-statement .info-label,
  body.printing-statement .info-value {
    font-size: 9px !important;
    margin: 0 !important;
    padding: 1px 0 !important;
  }
  
  /* أدوات التحكم - إخفاء */
  body.printing-statement .statement-controls,
  body.printing-statement .quick-filters,
  body.printing-statement .statement-stats {
    display: none !important;
  }
  
  /* الجدول - مضغوط */
  body.printing-statement .statement-table {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: 9px !important;
    page-break-inside: auto;
  }
  body.printing-statement .statement-table th {
    background: #34495e !important;
    color: white !important;
    padding: 4px 6px !important;
    font-size: 9px !important;
    font-weight: 700 !important;
    border: 1px solid #2c3e50 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body.printing-statement .statement-table td {
    padding: 3px 5px !important;
    font-size: 9px !important;
    border: 1px solid #ddd !important;
    line-height: 1.3 !important;
  }
  
  /* صف الافتتاح */
  body.printing-statement .statement-opening-row {
    background: #f0f8ff !important;
    font-weight: 700 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  /* Badges - بحجم صغير */
  body.printing-statement .statement-badge {
    padding: 1px 4px !important;
    font-size: 8px !important;
    border-radius: 6px !important;
  }
  
  /* صف الإجمالي */
  body.printing-statement .statement-table tfoot tr {
    background: #ecf0f1 !important;
    font-weight: 700 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body.printing-statement .statement-table tfoot td {
    padding: 4px 6px !important;
    font-size: 10px !important;
  }
  
  /* الملخص - ملخص صغير في الأعلى */
  body.printing-statement .statement-summary {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 4px !important;
    padding: 4px !important;
    margin-bottom: 8px !important;
    page-break-after: avoid;
  }
  body.printing-statement .statement-summary-card {
    padding: 6px 8px !important;
    font-size: 9px !important;
  }
  body.printing-statement .statement-summary-card .label {
    font-size: 8px !important;
    margin-bottom: 2px !important;
  }
  body.printing-statement .statement-summary-card .value {
    font-size: 14px !important;
    font-weight: 800 !important;
  }
  body.printing-statement .statement-summary-card .sub {
    font-size: 7px !important;
  }
  
  /* منع كسر الصفوف */
  body.printing-statement tr {
    page-break-inside: avoid !important;
  }
  
  /* حجم صفحة A4 */
  @page {
    size: A4;
    margin: 8mm;
  }
}
    .invoice-page {
      box-shadow: none;
      border-radius: 0;
      margin-bottom: 0;
      page-break-after: always;
      min-height: auto;
    }
    .invoice-page:last-child { page-break-after: auto; }
  }
</style>
    `;
  }

  // ═══ إنشاء وعرض فاتورة واحدة ═══
  function createAndShowInvoice(clientName, options = {}) {
    const invoice = buildInvoice(clientName, options);
    const html = generateInvoiceHTML(invoice);
    const w = window.open('', '_blank');
    if (!w) {
      if (typeof showToast === 'function') {
        showToast('فشل فتح النافذة', 'الرجاء السماح بالنوافذ المنبثقة', true);
      }
      return null;
    }
    w.document.write(html);
    w.document.close();
    saveInvoice(invoice);
    return invoice;
  }

  // ═══ إنشاء فواتير لفريق ═══
  function createTeamInvoices(team = 'all', options = {}) {
    const data = getDashboardData();
    let clients = [];
    if (team === 'all') clients = data.soc;
    else if (team === 'high-debt') clients = data.soc.filter(s => (s.s - s.c) > 1000);
    else if (team === 'active') clients = data.soc.filter(s => s.s > 0);
    else clients = data.soc.filter(s => s.ag === team);
    
    return clients.map(c => buildInvoice(c.nm, options));
  }

  // ═══ فتح فواتير متعددة ═══
  function createBulkInvoices(team = 'all', options = {}) {
    const invoices = createTeamInvoices(team, options);
    if (invoices.length === 0) {
      if (typeof showToast === 'function') {
        showToast('لا توجد فواتير', 'لا يوجد عملاء في هذا الفريق', true);
      }
      return;
    }
    
    invoices.forEach(inv => saveInvoice(inv));
    invoices.slice(0, 5).forEach((inv, idx) => {
      setTimeout(() => {
        const html = generateInvoiceHTML(inv);
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
        }
      }, idx * 300);
    });
    
    if (typeof showToast === 'function') {
      showToast('تم إنشاء الفواتير', `${invoices.length} فاتورة (أول 5 تم فتحها)`, false);
    }
  }

  // ═══ الحصول على عملاء الفريق ═══
  function getTeamClients(team) {
    const data = getDashboardData();
    if (!data.soc) return [];
    if (team === 'all') return data.soc;
    if (team === 'high-debt') return data.soc.filter(s => (s.s - s.c) > 1000);
    if (team === 'active') return data.soc.filter(s => s.s > 0);
    if (team === 'dormant') return data.soc.filter(s => !s.s || s.s === 0);
    return data.soc.filter(s => s.ag === team);
  }

  // ═══ الحصول على المنتجات التلقائية لعميل ═══
  function getAutoItemsForClient(clientName) {
    return extractItemsFromTransactions(clientName);
  }

  // ═══ حفظ في localStorage ═══
  function saveInvoice(invoice) {
    let invoices = [];
    try { invoices = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) {}
    invoices.unshift(invoice);
    if (invoices.length > 200) invoices = invoices.slice(0, 200);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices)); } catch(e) {}
    return invoices;
  }

  function getInvoices() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { return []; }
  }

  function clearInvoices() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  }

  // ═══ الفرق المتاحة ═══
  function getAvailableTeams() {
    const data = getDashboardData();
    const teams = [{ id: 'all', name: 'كل العملاء', count: data.soc.length }];
    if (data.soc.length > 0) {
      const agents = [...new Set(data.soc.map(s => s.ag).filter(Boolean))];
      agents.forEach(a => {
        teams.push({
          id: a,
          name: `مندوب: ${a}`,
          count: data.soc.filter(s => s.ag === a).length
        });
      });
      teams.push({ id: 'high-debt', name: 'ذمم مرتفعة', count: data.soc.filter(s => (s.s - s.c) > 1000).length });
      teams.push({ id: 'active', name: 'عملاء نشطون', count: data.soc.filter(s => s.s > 0).length });
    }
    return teams;
  }

  return {
    COMPANY,
    getDashboardData,
    getClientTransactions,
    extractItemsFromTransactions,
    getAutoItemsForClient,
    generateInvoiceNumber,
    formatNumber,
    formatArabicDate,
    buildInvoice,
    generateInvoiceHTML,
    createAndShowInvoice,
    createTeamInvoices,
    createBulkInvoices,
    getTeamClients,
    saveInvoice,
    getInvoices,
    clearInvoices,
    getAvailableTeams,
    generateInvoiceStyles,
  };
})();

window.InvoiceEngine = InvoiceEngine;



// ════════════════════════════════════════════════════════════════════════
//  📐 ICON ENGINE — مكتبة أيقونات SVG احترافية
//  ──────────────────────────────────────────────────────────────────────
//  استبدال الإيموجي بأيقونات SVG قابلة للتخصيص (لون، حجم، دوران)
// ════════════════════════════════════════════════════════════════════════
const ICON_LIB = {
  // Navigation
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>',
  agents: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
  items: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>',
  behavior: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8M12 22v-8M2 12h8M22 12h-8M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/></svg>',
  receivables: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  profitability: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  forecast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  offers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>',
  decisions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>',
  compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5"/><path d="M21 3L14 10M3 21l7-7M3 3l7 7M21 21l-7-7"/></svg>',
  strategic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  // Actions
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15l3-3 3 3M12 12v9M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5-5 5 5"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 13h6M9 17h4"/></svg>',
  excel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13l2 2 4-4M8 17h8"/></svg>',
  schedule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

function renderIcon(name, size = 18, color = 'currentColor') {
  const svg = ICON_LIB[name];
  if (!svg) return '';
  return svg.replace('<svg', `<svg width="${size}" height="${size}" style="color:${color}" `);
}

// 🛡️ FIX: استبدال دالة قديمة (إن وُجدت)
window.renderIcon = renderIcon;
window.ICON_LIB = ICON_LIB;



// ════════════════════════════════════════════════════════════════════════
//  ⚡ MEMOIZATION ENGINE — تحسين الأداء
//  ──────────────────────────────────────────────────────────────────────
//  تخزين نتائج الدوال الثقيلة لإعادة استخدامها
// ════════════════════════════════════════════════════════════════════════
const Memo = (function() {
  const cache = new Map();
  const stats = { hits: 0, misses: 0, clears: 0 };

  function memoize(fn, keyFn) {
    return function(...args) {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      if (cache.has(key)) {
        stats.hits++;
        return cache.get(key);
      }
      stats.misses++;
      const result = fn.apply(this, args);
      cache.set(key, result);
      // منع النمو اللانهائي
      if (cache.size > 500) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      return result;
    };
  }

  function clear() {
    cache.clear();
    stats.clears++;
  }

  function invalidate(predicate) {
    let count = 0;
    for (const key of cache.keys()) {
      if (!predicate || predicate(key)) {
        cache.delete(key);
        count++;
      }
    }
    return count;
  }

  function getStats() {
    return {
      ...stats,
      size: cache.size,
      hitRate: stats.hits + stats.misses > 0
        ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  return { memoize, clear, invalidate, getStats };
})();

// تطبيق Memoization على الدوال الثقيلة
const _originalPageOV = pageOV;
const _originalPageClients360 = pageClients360;
const _originalPageStrategic = pageStrategic;

window.Memo = Memo;

// إضافة invalidate عند تحديث البيانات
const _originalRecompute = recompute;
function recomputeMemoized(a, b) {
  const result = _originalRecompute(a, b);
  Memo.clear(); // مسح الكاش عند تغيير البيانات
  return result;
}



// ════════════════════════════════════════════════════════════════════════
//  📊 REPORTS ENGINE — نظام التقارير المتقدم
//  ──────────────────────────────────────────────────────────────────────
//  PDF • Excel • Email-ready HTML • Scheduled • Templates
// ════════════════════════════════════════════════════════════════════════
const ReportsEngine = (function() {
  'use strict';

  const STORAGE_KEY = 'nayef_reports';
  const SCHEDULE_KEY = 'nayef_report_schedules';

  // ═══ قوالب التقارير ═══
  const TEMPLATES = {
    executive: {
      id: 'executive',
      name: 'الملخص التنفيذي',
      icon: 'dashboard',
      description: 'نظرة شاملة على الأداء المالي',
      sections: ['kpi', 'topClients', 'topAgents', 'collectionRate', 'risks']
    },
    collection: {
      id: 'collection',
      name: 'تقرير التحصيل',
      icon: 'receivables',
      description: 'تفاصيل التحصيل والذمم وأعمارها',
      sections: ['kpi', 'aging', 'risks', 'topDebtors']
    },
    sales: {
      id: 'sales',
      name: 'تقرير المبيعات',
      icon: 'chart',
      description: 'تحليل المبيعات حسب الجمعية والمندوب',
      sections: ['kpi', 'byClient', 'byAgent', 'byMonth', 'forecast']
    },
    profitability: {
      id: 'profitability',
      name: 'تقرير الربحية',
      icon: 'profitability',
      description: 'قائمة الدخل، المصاريف، صافي الربح',
      sections: ['kpi', 'incomeStatement', 'expenses', 'breakEven']
    },
    agents: {
      id: 'agents',
      name: 'تقرير المناديب',
      icon: 'agents',
      description: 'أداء فريق المبيعات',
      sections: ['kpi', 'ranking', 'achievements', 'risks']
    }
  };

  // ═══ توليد محتوى التقرير (HTML) ═══
  function generateContent(templateId, period = 'current') {
    const T = TEMPLATES[templateId];
    if (!T) throw new Error(`قالب غير موجود: ${templateId}`);
    const S = D.soc || [];
    const Tt = D.T || {};

    let html = `
      <div class="report-header" style="text-align:center;border-bottom:3px solid var(--brand-500);padding-bottom:20px;margin-bottom:24px">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px">
          <div style="width:48px;height:48px;background:linear-gradient(135deg,var(--brand-400),var(--brand-600));border-radius:12px;display:grid;place-items:center;color:white;font-weight:900">ن</div>
          <div style="text-align:right">
            <h1 style="font-size:24px;font-weight:900;color:var(--text-uniform);margin:0">شركتك</h1>
            <p style="font-size:13px;color:var(--text-uniform-2);margin:4px 0 0;opacity:.7">${T.name}</p>
          </div>
        </div>
        <p style="font-size:12px;color:var(--text-uniform-2);margin:8px 0 0;opacity:.7">
          الفترة: ${O.ml[_filterA]} ← ${O.ml[_filterB]} · تاريخ الإصدار: ${new Date().toLocaleDateString('ar-KW', { year:'numeric', month:'long', day:'numeric' })}
        </p>
      </div>
    `;

    // إضافة الأقسام حسب القالب
    if (T.sections.includes('kpi')) {
      html += generateKPISection();
    }
    if (T.sections.includes('topClients')) {
      html += generateClientsSection(S);
    }
    if (T.sections.includes('aging')) {
      html += generateAgingSection(S);
    }
    if (T.sections.includes('risks')) {
      html += generateRisksSection(S);
    }
    if (T.sections.includes('incomeStatement')) {
      html += generateIncomeSection(Tt);
    }
    // ... المزيد حسب القالب

    return html;
  }

  function generateKPISection() {
    const Tt = D.T || {};
    const mg = Tt.s ? (Tt.pr / Tt.s * 100).toFixed(1) : 0;
    const cr = Tt.s ? (Tt.c / Tt.s * 100).toFixed(1) : 0;
    return `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
        <div style="background:var(--surface-default);border:1px solid var(--line-soft);border-radius:12px;padding:20px;text-align:center">
          <div style="font-size:11px;color:var(--text-uniform-2);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:8px">إجمالي المبيعات</div>
          <div style="font-size:24px;font-weight:900;color:var(--text-uniform);font-variant-numeric:tabular-nums">${Currency.format(Tt.s || 0)}</div>
        </div>
        <div style="background:var(--surface-default);border:1px solid var(--line-soft);border-radius:12px;padding:20px;text-align:center">
          <div style="font-size:11px;color:var(--text-uniform-2);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:8px">صافي الربح</div>
          <div style="font-size:24px;font-weight:900;color:var(--success-600);font-variant-numeric:tabular-nums">${Currency.format(Tt.pr || 0)}</div>
          <div style="font-size:11px;color:var(--text-uniform-2);margin-top:4px">هامش ${mg}%</div>
        </div>
        <div style="background:var(--surface-default);border:1px solid var(--line-soft);border-radius:12px;padding:20px;text-align:center">
          <div style="font-size:11px;color:var(--text-uniform-2);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:8px">التحصيل</div>
          <div style="font-size:24px;font-weight:900;color:var(--info-600);font-variant-numeric:tabular-nums">${Currency.format(Tt.c || 0)}</div>
          <div style="font-size:11px;color:var(--text-uniform-2);margin-top:4px">نسبة ${cr}%</div>
        </div>
        <div style="background:var(--surface-default);border:1px solid var(--line-soft);border-radius:12px;padding:20px;text-align:center">
          <div style="font-size:11px;color:var(--text-uniform-2);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:8px">الذمم القائمة</div>
          <div style="font-size:24px;font-weight:900;color:var(--danger-600);font-variant-numeric:tabular-nums">${Currency.format((Tt.s||0) - (Tt.c||0))}</div>
        </div>
      </div>
    `;
  }

  function generateClientsSection(S) {
    const top = S.slice(0, 10);
    return `
      <div style="margin-bottom:24px">
        <h3 style="font-size:18px;font-weight:800;color:var(--text-uniform);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line-soft)">أعلى 10 جمعيات أداءً</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--canvas-bg-alt)">
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">#</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">الجمعية</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">المبيعات</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">الربح</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">التحصيل</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">النسبة</th>
            </tr>
          </thead>
          <tbody>
            ${top.map((s, i) => `
              <tr style="border-bottom:1px solid var(--line-soft)">
                <td style="padding:10px;color:var(--text-uniform-2)">${i + 1}</td>
                <td style="padding:10px;color:var(--text-uniform);font-weight:600">${SafeDOM.text(s.nm)}</td>
                <td style="padding:10px;color:var(--text-uniform);font-variant-numeric:tabular-nums">${Currency.format(s.s)}</td>
                <td style="padding:10px;color:var(--success-600);font-variant-numeric:tabular-nums">${Currency.format(s.pr)}</td>
                <td style="padding:10px;color:var(--info-600);font-variant-numeric:tabular-nums">${Currency.format(s.c)}</td>
                <td style="padding:10px;color:var(--text-uniform);font-variant-numeric:tabular-nums">${PC(s.rt || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function generateAgingSection(S) {
    const aged = S.filter(s => s.ot > 0).map(s => ({
      ...s,
      risk: riskScore(s),
      cycle: purchaseCycle(s)
    })).sort((a, b) => b.risk.score - a.risk.score).slice(0, 15);

    return `
      <div style="margin-bottom:24px">
        <h3 style="font-size:18px;font-weight:800;color:var(--text-uniform);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line-soft)">أعلى الجمعيات مخاطراً ائتمانياً</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--canvas-bg-alt)">
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">الجمعية</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">الذمم</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">الحد</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">الاستغلال</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">النقاط</th>
              <th style="padding:10px;text-align:right;font-weight:700;color:var(--text-uniform-2)">التصنيف</th>
            </tr>
          </thead>
          <tbody>
            ${aged.map(s => `
              <tr style="border-bottom:1px solid var(--line-soft)">
                <td style="padding:10px;color:var(--text-uniform);font-weight:600">${SafeDOM.text(s.nm)}</td>
                <td style="padding:10px;color:var(--danger-600);font-variant-numeric:tabular-nums">${Currency.format(s.ot)}</td>
                <td style="padding:10px;color:var(--text-uniform-2);font-variant-numeric:tabular-nums">${Currency.format(s.risk.creditLimit)}</td>
                <td style="padding:10px;color:${s.risk.util >= 100 ? 'var(--danger-600)' : s.risk.util >= 70 ? '#f39c12' : 'var(--success-600)'};font-variant-numeric:tabular-nums">${s.risk.util}%</td>
                <td style="padding:10px;color:${s.risk.color};font-weight:700">${s.risk.score}</td>
                <td style="padding:10px;color:${s.risk.color}">${s.risk.level}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function generateRisksSection(S) {
    const risky = S.filter(s => s.rt < 30 && s.s > 0).slice(0, 8);
    return `
      <div style="margin-bottom:24px">
        <h3 style="font-size:18px;font-weight:800;color:var(--text-uniform);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line-soft)">تنبيهات وتوصيات</h3>
        <ul style="list-style:none;padding:0;margin:0">
          ${risky.map(s => `
            <li style="padding:12px;background:var(--danger-50);border:1px solid var(--danger-200);border-radius:8px;margin-bottom:8px;color:var(--text-uniform)">
              ⚠️ <b>${SafeDOM.text(s.nm)}</b>: نسبة تحصيل منخفضة (${PC(s.rt)}) — يحتاج متابعة عاجلة
            </li>
          `).join('')}
          ${risky.length === 0 ? '<li style="padding:12px;background:var(--olive-50);border:1px solid var(--olive-200);border-radius:8px;color:var(--text-uniform)">✅ لا توجد تنبيهات حرجة</li>' : ''}
        </ul>
      </div>
    `;
  }

  function generateIncomeSection(Tt) {
    const exp = (D.expenses && D.expenses.items) ? D.expenses.items : [];
    const totalExp = D.expenses ? D.expenses.totalAnnual : 0;
    const net = (Tt.pr || 0) - totalExp;
    return `
      <div style="margin-bottom:24px">
        <h3 style="font-size:18px;font-weight:800;color:var(--text-uniform);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line-soft)">قائمة الدخل</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:var(--canvas-bg-alt)"><td style="padding:12px;font-weight:600;color:var(--text-uniform)">صافي المبيعات</td><td style="padding:12px;text-align:left;color:var(--text-uniform);font-weight:700">${Currency.format(Tt.s || 0)}</td></tr>
          <tr><td style="padding:12px;color:var(--text-uniform-2)">− تكلفة المباع</td><td style="padding:12px;text-align:left;color:var(--danger-600)">(${Currency.format(Tt.co || 0)})</td></tr>
          <tr style="background:var(--olive-50)"><td style="padding:12px;font-weight:700;color:var(--text-uniform)">= مجمل الربح</td><td style="padding:12px;text-align:left;color:var(--text-uniform);font-weight:700">${Currency.format(Tt.pr || 0)}</td></tr>
          <tr><td style="padding:12px;color:var(--text-uniform-2)">− المصاريف التشغيلية</td><td style="padding:12px;text-align:left;color:var(--danger-600)">(${Currency.format(totalExp)})</td></tr>
          <tr style="background:linear-gradient(135deg,var(--olive-50),transparent);border-top:2px solid var(--brand-500)"><td style="padding:14px;font-weight:900;color:var(--text-uniform);font-size:18px">= صافي الربح</td><td style="padding:14px;text-align:left;color:${net >= 0 ? 'var(--success-600)' : 'var(--danger-600)'};font-weight:900;font-size:18px">${Currency.format(net)}</td></tr>
        </table>
      </div>
    `;
  }

  // ═══ التصدير إلى Excel ═══
  function exportExcel(templateId) {
    if (typeof XLSX === 'undefined') {
      showToast('مكتبة Excel غير محملة', 'يرجى التحقق من الاتصال بالإنترنت', true);
      return;
    }
    const T = TEMPLATES[templateId];
    const S = D.soc || [];
    const Tt = D.T || {};
    const wb = XLSX.utils.book_new();

    const periodStr = (O && O.ml) ? (O.ml[_filterA] + ' - ' + O.ml[_filterB]) : '';

    // الشيت 1: الملخص
    const summaryData = [
      ['شركتك'],
      [T.name],
      [],
      ['الفترة', periodStr],
      ['تاريخ الإصدار', new Date().toLocaleDateString('ar-KW')],
      [],
      ['المؤشر', 'القيمة'],
      ['إجمالي المبيعات', Tt.s || 0],
      ['إجمالي التكلفة', Tt.co || 0],
      ['مجمل الربح', Tt.pr || 0],
      ['إجمالي التحصيل', Tt.c || 0],
      ['الذمم القائمة', (Tt.s||0) - (Tt.c||0)],
      ['عدد الجمعيات', S.length],
      ['هامش الربح %', Tt.s ? (Tt.pr / Tt.s * 100).toFixed(2) : 0],
      ['نسبة التحصيل %', Tt.s ? (Tt.c / Tt.s * 100).toFixed(2) : 0],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'الملخص');

    // الشيت 2: الجمعيات
    const clientsData = [
      ['#', 'الجمعية', 'المندوب', 'المبيعات', 'التكلفة', 'الربح', 'التحصيل', 'نسبة التحصيل %', 'الذمم', 'الكمية']
    ];
    S.forEach((s, i) => {
      clientsData.push([
        i + 1, s.nm, s.ag || '-', s.s, s.co, s.pr, s.c, s.rt || 0, s.ot || 0, s.q || 0
      ]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(clientsData);
    ws2['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'الجمعيات');

    // حفظ
    const filename = 'naif_' + templateId + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    XLSX.writeFile(wb, filename);

    showToast('تم التصدير إلى Excel', filename, false);
    return filename;
  }

  
  function exportPDF(templateId) { showToast("PDF export under maintenance", "", true); return; }

    function exportEmail(templateId) {
    try {
      const content = generateContent(templateId);
      const dateStr = new Date().toLocaleDateString('ar-KW');
      // 🛡️ FIX: بناء HTML عبر DOM بدلاً من string concat
      const doc = document.implementation.createHTMLDocument('');
      doc.documentElement.setAttribute('dir', 'rtl');
      const head = doc.createElement('head');
      const meta = doc.createElement('meta');
      meta.setAttribute('charset', 'UTF-8');
      head.appendChild(meta);
      doc.documentElement.appendChild(head);
      const body = doc.createElement('body');
      body.style.cssText = 'font-family:Tajawal,Arial,sans-serif;direction:rtl;background:#f6f3ec;padding:20px';
      const wrapper = doc.createElement('div');
      wrapper.style.cssText = 'max-width:800px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.08)';
      wrapper.innerHTML = content;
      body.appendChild(wrapper);
      const hr = doc.createElement('hr');
      hr.style.cssText = 'margin:32px 0;border:none;border-top:1px solid #e4ddcf';
      body.appendChild(hr);
      const footer = doc.createElement('p');
      footer.style.cssText = 'font-size:12px;color:#6b6354;text-align:center;margin:0';
      footer.textContent = 'صادر من نظام نظام إدارة مالية لإدارة القرار المالي - ' + dateStr;
      body.appendChild(footer);
      doc.documentElement.appendChild(body);
      const html = '<!DOCTYPE html>' + new XMLSerializer().serializeToString(doc.documentElement);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(html).then(function() {
          showToast('تم نسخ HTML للبريد', 'الصقه في برنامج البريد', false);
        }).catch(function() {
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'email_' + templateId + '_' + Date.now() + '.html';
          a.click();
          URL.revokeObjectURL(url);
        });
      } else {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'email_' + templateId + '_' + Date.now() + '.html';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      showToast('فشل الإرسال', e.message, true);
    }
  }

  // ═══ حفظ في السجل ═══
  function saveToHistory(templateId, format) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) {}
    history.unshift({
      id: 'rpt_' + Date.now(),
      template: templateId,
      format,
      timestamp: new Date().toISOString(),
      period: `${O.ml[_filterA]} ← ${O.ml[_filterB]}`
    });
    if (history.length > 50) history = history.slice(0, 50);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch(e) {}
    return history;
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e) { return []; }
  }

  function clearHistory() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  }

  // ═══ التقارير المجدولة ═══
  function scheduleReport(config) {
    let schedules = [];
    try { schedules = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]'); } catch(e) {}
    schedules.push({
      id: 'sch_' + Date.now(),
      ...config,
      createdAt: new Date().toISOString(),
      active: true
    });
    try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules)); } catch(e) {}
    return schedules;
  }

  function getSchedules() {
    try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]'); } catch(e) { return []; }
  }

  function removeSchedule(id) {
    let schedules = getSchedules();
    schedules = schedules.filter(s => s.id !== id);
    try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules)); } catch(e) {}
    return schedules;
  }

  return {
    TEMPLATES,
    generateContent,
    exportExcel,
    exportPDF,
    exportEmail,
    saveToHistory,
    getHistory,
    clearHistory,
    scheduleReport,
    getSchedules,
    removeSchedule
  };
})();

window.ReportsEngine = ReportsEngine;


// DUPLICATE REMOVED

function renderIcon(name, size = 18, color = 'currentColor') {
  const svg = ICON_LIB[name];
  if (!svg) return '';
  return svg.replace('<svg', `<svg width="${size}" height="${size}" style="color:${color}" `);
}

// 🛡️ FIX: استبدال دالة قديمة (إن وُجدت)
window.renderIcon = renderIcon;
window.ICON_LIB = ICON_LIB;

})();

/* ════════════════════════════════════════════════════════════════════════
   كود الداشبورد الأصلي (مع تعديلات الإصلاح)
   ════════════════════════════════════════════════════════════════════════ */



// ══ DATA ══
// SEED v160: بيانات تجريبية - 20 جمعية · 84 صنف · 8 مناديب · 1982 معاملة
const SEED = {"soc":[],"mon":[],"ml":["2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07","2024-08","2024-09","2024-10","2024-11","2024-12","2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"],"mk":["2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07","2024-08","2024-09","2024-10","2024-11","2024-12","2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"],"mt":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"mc":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"T":{"s":0,"co":0,"pr":0,"c":0,"ot":0,"q":0,"cn":0},"it":[],"im":{},"ag":[],"tx":[],"checks":[],"expenses":{"items":[],"monthlyTotal":{},"totalAnnual":0,"byCat":{},"activeMonths":0},"agentMovement":[],"agentSummary":[],"txTypes":[],"_v":"v220.8.6+QA-MENU","_empty":true,"_demoData":false,"_note":"Quick actions menu + ultra-compact + nav tabs + A4 invoice + PWA + cloud sync"};
// ══ STATE ══
let O=JSON.parse(JSON.stringify(SEED)); // ORIG
let D=JSON.parse(JSON.stringify(SEED)); // filtered
// 📡 مصدر حقيقة واحد: window.O/D مراجع قراءة فقط
window.O = O;
window.D = D;

// 🛡️ حفظ واسترجاع تلقائي
const DATA_BACKUP_KEY = 'nayef_data_backup_v220_force';
const DATA_TIMESTAMP_KEY = 'nayef_data_timestamp_v220_force';

function nayefSaveData() {
  try {
    // 🔍 تدقيق البيانات قبل الحفظ (منطق المدقق المالي)
    if(typeof auditAndRecomputeTotals === 'function') {
      try { auditAndRecomputeTotals(O); } catch(e) {}
    }
    const snapshot = {
      soc: O.soc || [],
      ag: O.ag || [],
      tx: O.tx || [],
      mon: O.mon || [],
      ml: O.ml || [],
      mk: O.mk || [],
      T: O.T || {},
      it: O.it || [],
      im: O.im || {},
      // 🆕 v220.1+ DYNAMIC: احفظ الحقول الإضافية ليتم قبول البيانات على أنها حديثة
      expenses: O.expenses || {items:[], monthlyTotal:{}, totalAnnual:0, byCat:{}, activeMonths:0},
      agentMovement: O.agentMovement || [],
      agentSummary: O.agentSummary || [],
      checks: O.checks || [],
      // 🆕 v220.1+ DYNAMIC: احفظ أنواع الحركات المُعرّفة من المستخدم
      txTypes: (typeof getTxTypes === 'function' && Array.isArray(O.txTypes)) ? O.txTypes : (typeof DEFAULT_TX_TYPES !== 'undefined' ? DEFAULT_TX_TYPES : []),
      // 🆕 v220.1+ DYNAMIC: استخدم إصدار SEED الحالي ليتم قبول الاستعادة عند reload
      _v: (typeof SEED !== 'undefined' && SEED._v) ? SEED._v : (O._v || 'auto-save'),  // يستخدم SEED._v مباشرة
      _timestamp: Date.now(),
    };
    localStorage.setItem(DATA_BACKUP_KEY, JSON.stringify(snapshot));
    localStorage.setItem(DATA_TIMESTAMP_KEY, Date.now().toString());
    
    // 🆕 v220.1+ DYNAMIC: احفظ في nayef_dash_seed أيضاً ليتم اكتشافها من loadData()
    try {
      const dynPayload = { seed: snapshot, fname: 'بيانات يدوية', ts: Date.now() };
      localStorage.setItem('nayef_dash_seed', JSON.stringify(dynPayload));
    } catch(e) { Logger.warn('⚠️ nayefSaveData dyn:', e.message); }

    // 🆕 v220.5+ STORAGE V2: حفظ مزدوج (localStorage + IndexedDB) + تشفير
    if (typeof window !== 'undefined' && window.StorageV2 && window.StorageV2.save) {
      try {
        window.StorageV2.save(snapshot).catch(function(e) { Logger.warn('StorageV2 save:', e && e.message); });
      } catch(e) {}
    }
  } catch(e) {
    Logger.warn('⚠️ nayefSaveData:', e.message);
  }
}

function nayefRestoreData() {
  try {
    const saved = localStorage.getItem(DATA_BACKUP_KEY);
    if(!saved) return false;
    const data = JSON.parse(saved);
    
    // 🛡️ FIX: دعم البنيتين (مباشرة أو seed wrapper)
    const seed = data.seed || data;
    
    // تحقق من صحة البيانات
    if(!seed.soc || !Array.isArray(seed.soc) || seed.soc.length === 0) {
      // 🆕 v220.1+ DYNAMIC: اسمح بالاستعادة حتى لو الجمعيات فارغة، طالما في أصناف أو معاملات
      const hasItems = (seed.it && Array.isArray(seed.it) && seed.it.length > 0) || (seed.im && Object.keys(seed.im).length > 0);
      const hasTx = (seed.tx && Array.isArray(seed.tx) && seed.tx.length > 0);
      if(!hasItems && !hasTx) return false;
      Logger.info('🔄 nayefRestoreData: empty soc but found items/tx — restoring partial data');
    }
    if(!seed.ml || !Array.isArray(seed.ml) || seed.ml.length === 0) {
      // بدون أشهر — استخدم الافتراضي
      seed.ml = ['2024-01','2024-02','2024-03','2024-04','2024-05','2024-06','2024-07','2024-08','2024-09','2024-10','2024-11','2024-12','2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06'];
    }
    
    Logger.info('🔄 nayefRestoreData: found', seed.soc.length, 'cooperatives in storage');
    
    // استعادة البيانات إلى O المحلي (مصدر الحقيقة)
    O.soc.length = 0;
    seed.soc.forEach(s => O.soc.push(s));
    O.ag.length = 0;
    (seed.ag || []).forEach(a => O.ag.push(a));
    O.tx.length = 0;
    (seed.tx || []).forEach(t => O.tx.push(t));
    O.mon.length = 0;
    (seed.mon || []).forEach(m => O.mon.push(m));
    O.ml = seed.ml.slice();
    O.mk = (seed.mk || []).slice();
    O.T = seed.T || {};
    O.it = seed.it || [];
    O.im = seed.im || {};
    // 🆕 v220.1+ DYNAMIC: استعد أنواع الحركات أو استخدم الافتراضية
    O.txTypes = (Array.isArray(seed.txTypes) && seed.txTypes.length > 0)
      ? seed.txTypes
      : (typeof DEFAULT_TX_TYPES !== 'undefined' ? JSON.parse(JSON.stringify(DEFAULT_TX_TYPES)) : []);
    O._v = seed._v || 'restored';
    
    Logger.info('✅ تم استرجاع البيانات:', O.soc.length, 'عميل،', O.tx.length, 'معاملة');
    
    // 🔍 تدقيق البيانات بعد الاسترجاع
    if(typeof auditAndRecomputeTotals === 'function') {
      try { auditAndRecomputeTotals(O); } catch(e) { Logger.warn('audit failed:', e); }
    }
    
    // 🛡️ Self-Healing: إذا البيانات قديمة (soc.s يحوي opening)
    if(typeof nayefMigrateLegacyData === 'function') {
      try { 
        nayefMigrateLegacyData(O);
        Logger.info('✅ تم تصحيح البيانات القديمة');
      } catch(e) { Logger.warn('Migration failed:', e); }
    }
    
    // ✅ window.O يشير لنفس O المحلي (مرجع قراءة)
    window.O = O;
    window.D = D;
    return true;
  } catch(e) {
    Logger.warn('⚠️ nayefRestoreData:', e.message);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════
// 🛡️ SELF-HEALING: Auto-migrate legacy data (مُعرّف هنا قبل nayefRestoreData)
// يكشف البيانات القديمة (soc.s يحوي opening) ويصلحها تلقائياً
// ════════════════════════════════════════════════════════════════════
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
          s.rt = s.s > 0 ? +(s.c / s.s * 100).toFixed(1) : 0;
          migrated = true;
        }
      }
    }
  });
  
  if(migrated) {
    Logger.info('✅ Auto-migration completed - all data corrected');
  }
  return O;
}


// ════════════════════════════════════════════════════════════════════
// 🔍 DATA INSPECTOR: أداة فحص البيانات الفعلية
// تكشف كل البيانات في النظام وتظهرها للمستخدم
// ════════════════════════════════════════════════════════════════════
function nayefDataInspector() {
  const O = (typeof window !== 'undefined') ? window.O : null;
  if(!O) return '⚠️ لا توجد بيانات';
  
  const lines = [];
  lines.push('═'.repeat(70));
  lines.push('🔍 DATA INSPECTOR - تقرير فحص البيانات الفعلي');
  lines.push('═'.repeat(70));
  lines.push('');
  
  // 1) ملخص عام
  lines.push('📊 ملخص:');
  lines.push(`   - الجمعيات: ${(O.soc || []).length}`);
  lines.push(`   - المعاملات: ${(O.tx || []).length}`);
  lines.push(`   - المناديب: ${(O.ag || []).length}`);
  lines.push(`   - الأشهر: ${(O.mk || []).length}`);
  lines.push('');
  
  // 2) لكل جمعية
  (O.soc || []).forEach((s, idx) => {
    lines.push('─'.repeat(70));
    lines.push(`🏢 [${idx + 1}] ${s.nm}`);
    lines.push(`   - المندوب: ${s.ag || 'غير محدد'}`);
    lines.push(`   - المبيعات: ${s.s} | التحصيل: ${s.c} | الافتتاح: ${s.ob || 0} | الذمم: ${s.ot}`);
    lines.push(`   - نسبة التحصيل: ${s.rt || 0}%`);
    
    // جلب معاملات هذه الجمعية
    const txs = (O.tx || []).filter(t => 
      (t.client === s.nm || t.cl === s.nm)
    ).sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
    
    if(txs.length === 0) {
      lines.push('   ⚠️ لا توجد معاملات لهذه الجمعية!');
    } else {
      const sales = txs.filter(t => t.type === 'sale' || t.tp === 'فاتوره');
      const payments = txs.filter(t => t.type === 'payment' || t.tp === 'شيك');
      const openings = txs.filter(t => t.type === 'opening' || t.tp === 'رصيد افتتاحي');
      const salesSum = sales.reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.db) || 0), 0);
      const paySum = payments.reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.cr) || 0), 0);
      const opSum = openings.reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.db) || 0), 0);
      
      lines.push(`   - عدد المعاملات: ${txs.length}`);
      lines.push(`     • مبيعات: ${sales.length} معاملة بمجموع ${salesSum.toFixed(2)} د.ك`);
      lines.push(`     • تحصيلات: ${payments.length} معاملة بمجموع ${paySum.toFixed(2)} د.ك`);
      lines.push(`     • افتتاحية: ${openings.length} معاملة بمجموع ${opSum.toFixed(2)} د.ك`);
      
      // تحذير إذا ob في soc لا يطابق tx.opening
      if(Math.abs(N(s.ob || 0) - opSum) > 0.01) {
        lines.push(`   ⚠️ تحذير: soc.ob=${N(s.ob || 0)} ≠ مجموع tx.opening=${opSum.toFixed(2)}`);
        lines.push(`   💡 الافتتاح يحوي ${(N(s.ob || 0) - opSum).toFixed(2)} د.ك إضافي قد تكون فواتير مدمجة`);
      }
    }
    lines.push('');
  });
  
  return lines.join('\n');
}

// زر لعرض الـ Data Inspector
function showDataInspector() {
  const report = nayefDataInspector();
  
  // عرض في modal
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:5%;left:5%;right:5%;bottom:5%;background:#fff;border:2px solid #0a1e38;border-radius:12px;padding:20px;z-index:999999;overflow:auto;font-family:monospace;font-size:12px;line-height:1.6;color:#0a1e38;box-shadow:0 10px 50px rgba(0,0,0,0.3)';
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕ إغلاق';
  closeBtn.style.cssText = 'position:sticky;top:0;left:90%;background:#0a1e38;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;margin-bottom:12px;';
  closeBtn.onclick = () => modal.remove();
  
  const content = document.createElement('pre');
  content.style.cssText = 'white-space:pre-wrap;direction:rtl;text-align:right;font-family:inherit';
  content.textContent = report;
  
  modal.appendChild(closeBtn);
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // طباعة في console أيضاً
  Logger.info(report);
  
  return report;
}

// ════════════════════════════════════════════════════════════════════
// 🩹 AUTO RECOVER: استخراج الفواتير المفقودة من mon.v
// عندما mon.v يحوي مبيعات أكثر من tx، نضيف الفواتير المفقودة
// ════════════════════════════════════════════════════════════════════
function nayefAutoRecoverInvoices() {
  const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
  if(!O.soc || !O.soc.length || !O.mon || !O.mk) return { recovered: 0, details: [] };
  
  let recoveredCount = 0;
  const details = [];
  
  O.soc.forEach(client => {
    const clientMon = O.mon.find(m => m.nm === client.nm);
    if(!clientMon || !clientMon.v) return;
    
    // لكل شهر في mon.v
    O.mk.forEach((mkStr, k) => {
      const monSales = parseFloat(clientMon.v[k]) || 0;
      const monColl = parseFloat(clientMon.c?.[k]) || 0;
      if(monSales === 0 && monColl === 0) return;
      
      // حساب مجموع tx في هذا الشهر
      // 🔍 كشف شهر الافتتاح (لاستثنائه من mon.v comparison)
      const openingTxsForClient = (O.tx || []).filter(t => {
        const cn = t.client || t.cl;
        return cn === client.nm && (t.type === 'opening' || t.tp === 'رصيد افتتاحي');
      });
      const openingMonth = openingTxsForClient[0]?.dt?.slice(0, 7);
      
      // 🛡️ FIX: تخطي شهر الافتتاح تماماً (لأنه محسوب في opening)
      if(mkStr === openingMonth) return;
      
      const monthTx = (O.tx || []).filter(t => {
        const cn = t.client || t.cl;
        if(cn !== client.nm) return false;
        if(!t.dt) return false;
        const txMonth = t.dt.slice(0, 7);
        return txMonth === mkStr;
      });
      
      const txSalesSum = monthTx.filter(t => {
        const cls = classifyTransaction(t.tp || t.type);
        return cls.dir === 'D' && cls.affects !== 'opening';
      }).reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.db) || 0), 0);
      
      const txCollSum = monthTx.filter(t => {
        const cls = classifyTransaction(t.tp || t.type);
        return cls.dir === 'C';
      }).reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.cr) || 0), 0);
      
      // 🔍 كشف الفجوات في الاتجاهين
      const salesGap = monSales - txSalesSum;
      const collGap = monColl - txCollSum;
      
      // ⚠️ إذا tx يحوي أكثر من mon.v (الفجوة سلبية)
      // هذا يعني mon.v ناقص (بيانات مفقودة في mon.v، ليس العكس)
      // أو tx يحوي فواتير مكررة
      if(salesGap < -50) {
        Logger.warn(`⚠️ ${client.nm} ${mkStr}: tx يحوي ${txSalesSum.toFixed(2)} لكن mon.v يحوي ${monSales.toFixed(2)} - mon.v ناقص!`);
        return; // لا نستخرج
      }
      if(collGap < -50) {
        Logger.warn(`⚠️ ${client.nm} ${mkStr}: tx collects ${txCollSum.toFixed(2)} لكن mon.v يحوي ${monColl.toFixed(2)}`);
        return;
      }
      
      // إذا الفجوة في المبيعات > 50 د.ك، نضيف فاتورة وهمية
      if(salesGap > 50) {
        const [y, m] = mkStr.split('-');
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        const recoveryDate = `${mkStr}-${String(Math.min(lastDay, 28)).padStart(2, '0')}`;
        
        // إضافة فاتورة وهمية للمبيعات
        const syntheticTx = {
          dt: recoveryDate,
          cl: client.nm,
          client: client.nm,
          db: salesGap,
          cr: 0,
          amount: salesGap,
          type: 'sale',
          tp: 'فاتوره',
          invoice: 'AUTO-' + mkStr.replace('-', '') + '-' + k,
          qty: salesGap / 1.5, // افتراض سعر 1.5 د.ك
          price: 1.5,
          _auto: true,  // marker لتمييزها
        };
        
        O.tx.push(syntheticTx);
        recoveredCount++;
        details.push({
          client: client.nm,
          month: mkStr,
          type: 'sale',
          amount: salesGap,
          invoice: syntheticTx.invoice,
        });
        Logger.info(`🩹 استخراج فاتورة: ${client.nm} ${mkStr} = ${salesGap.toFixed(2)} د.ك (فاتورة ${syntheticTx.invoice})`);
      }
      
      // إذا الفجوة في التحصيل > 50 د.ك
      if(collGap > 50) {
        const [y, m] = mkStr.split('-');
        const recoveryDate = `${mkStr}-15`;
        
        const syntheticTx = {
          dt: recoveryDate,
          cl: client.nm,
          client: client.nm,
          db: 0,
          cr: collGap,
          amount: collGap,
          type: 'payment',
          tp: 'شيك',
          invoice: 'AUTO-CHQ-' + mkStr.replace('-', '') + '-' + k,
          _auto: true,
        };
        
        O.tx.push(syntheticTx);
        recoveredCount++;
        details.push({
          client: client.nm,
          month: mkStr,
          type: 'payment',
          amount: collGap,
          invoice: syntheticTx.invoice,
        });
        Logger.info(`🩹 استخراج تحصيل: ${client.nm} ${mkStr} = ${collGap.toFixed(2)} د.ك`);
      }
    });
  });
  
  return { recovered: recoveredCount, details };
}

window.nayefAutoRecoverInvoices = nayefAutoRecoverInvoices;

// 🩹 زر الاستخراج التلقائي
function nayefRunAutoRecover() {
  const result = nayefAutoRecoverInvoices();
  
  if(result.recovered === 0) {
    alert('✅ لا توجد فواتير مفقودة للاستخراج');
    return;
  }
  
  const details = result.details.map(d => 
    `• ${d.client} - ${d.month}: ${d.type === 'sale' ? 'فاتورة' : 'تحصيل'} ${d.amount.toFixed(2)} د.ك (${d.invoice})`
  ).join('\n');
  
  if(confirm(`🩹 تم استخراج ${result.recovered} فاتورة/تحصيل:\n\n${details}\n\nهل تريد إعادة عرض كشف الحساب؟`)) {
    renderStatement();
  }
}

window.nayefRunAutoRecover = nayefRunAutoRecover;





// ════════════════════════════════════════════════════════════════════
// 🏛️ LEDGER ENGINE: نظام شامل لدفتر الأستاذ
// يتعامل مع كل أنواع الحركات بشكل محاسبي صحيح
// ════════════════════════════════════════════════════════════════════

const LEDGER_TYPES = {
  // ═══ المبيعات (مدين - يزيد رصيد العميل) ═══
  'sale':            { dir: 'D', label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', affects: 'sales' },
  'فاتوره':          { dir: 'D', label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', affects: 'sales' },
  'فاتورة':          { dir: 'D', label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', affects: 'sales' },
  'فاتورة مبيعات':   { dir: 'D', label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', affects: 'sales' },
  'invsale':         { dir: 'D', label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', affects: 'sales' },
  'invoice':         { dir: 'D', label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', affects: 'sales' },
  'بيع':             { dir: 'D', label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', affects: 'sales' },
  
  // ═══ المرتجعات (دائن - ينقص رصيد العميل) ═══
  'return':          { dir: 'C', label: 'مرتجع مبيعات', icon: '↩️', color: '#16a085', affects: 'sales_return' },
  'مرتجع':          { dir: 'C', label: 'مرتجع مبيعات', icon: '↩️', color: '#16a085', affects: 'sales_return' },
  'مرتجع مبيعات':   { dir: 'C', label: 'مرتجع مبيعات', icon: '↩️', color: '#16a085', affects: 'sales_return' },
  'مرتجعات':        { dir: 'C', label: 'مرتجع مبيعات', icon: '↩️', color: '#16a085', affects: 'sales_return' },
  'invreturn':       { dir: 'C', label: 'مرتجع مبيعات', icon: '↩️', color: '#16a085', affects: 'sales_return' },
  
  // ═══ الإشعارات (دائن - ينقص) ═══
  'credit_note':     { dir: 'C', label: 'إشعار دائن', icon: '📝', color: '#2980b9', affects: 'credit_notes' },
  'إشعار دائن':     { dir: 'C', label: 'إشعار دائن', icon: '📝', color: '#2980b9', affects: 'credit_notes' },
  'اشعار دائن':     { dir: 'C', label: 'إشعار دائن', icon: '📝', color: '#2980b9', affects: 'credit_notes' },
  'إشعار':          { dir: 'C', label: 'إشعار دائن', icon: '📝', color: '#2980b9', affects: 'credit_notes' },
  'اشعار':          { dir: 'C', label: 'إشعار دائن', icon: '📝', color: '#2980b9', affects: 'credit_notes' },
  
  // ═══ الإشعارات المدينة (مدين - يزيد) ═══
  'debit_note':      { dir: 'D', label: 'إشعار مدين', icon: '📋', color: '#d35400', affects: 'debit_notes' },
  'إشعار مدين':     { dir: 'D', label: 'إشعار مدين', icon: '📋', color: '#d35400', affects: 'debit_notes' },
  'اشعار مدين':     { dir: 'D', label: 'إشعار مدين', icon: '📋', color: '#d35400', affects: 'debit_notes' },
  
  // ═══ التحصيلات (دائن - ينقص رصيد العميل) ═══
  'payment':         { dir: 'C', label: 'تحصيل (شيك/نقدي)', icon: '💵', color: '#27ae60', affects: 'collections' },
  'شيك':            { dir: 'C', label: 'تحصيل (شيك/نقدي)', icon: '💵', color: '#27ae60', affects: 'collections' },
  'تحصيل':          { dir: 'C', label: 'تحصيل (شيك/نقدي)', icon: '💵', color: '#27ae60', affects: 'collections' },
  'سند قبض':        { dir: 'C', label: 'سند قبض', icon: '💵', color: '#27ae60', affects: 'collections' },
  'نقدي':           { dir: 'C', label: 'تحصيل نقدي', icon: '💵', color: '#27ae60', affects: 'collections' },
  'cash':            { dir: 'C', label: 'تحصيل نقدي', icon: '💵', color: '#27ae60', affects: 'collections' },
  'cheque':          { dir: 'C', label: 'شيك', icon: '💵', color: '#27ae60', affects: 'collections' },
  'شيك صادر':       { dir: 'D', label: 'شيك صادر', icon: '💸', color: '#c0392b', affects: 'payments_out' },
  'سند صرف':        { dir: 'D', label: 'سند صرف', icon: '💸', color: '#c0392b', affects: 'payments_out' },
  
  // ═══ قيود التسوية (دائن - تنقص رصيد العميل) ═══
  // مدير الحسابات: قيد التسوية عادةً يكون لتصحيح أو خصم = دائن
  'adjustment':      { dir: 'C', label: 'قيد تسوية', icon: '⚖️', color: '#8e44ad', affects: 'adjustments' },
  'قيد تسوية':      { dir: 'C', label: 'قيد تسوية', icon: '⚖️', color: '#8e44ad', affects: 'adjustments' },
  'قيد تسويه':      { dir: 'C', label: 'قيد تسوية', icon: '⚖️', color: '#8e44ad', affects: 'adjustments' },
  'تسوية':          { dir: 'C', label: 'قيد تسوية', icon: '⚖️', color: '#8e44ad', affects: 'adjustments' },
  'تسويه':          { dir: 'C', label: 'قيد تسوية', icon: '⚖️', color: '#8e44ad', affects: 'adjustments' },
  'قيد تسوية +':    { dir: 'D', label: 'قيد تسوية (إضافة)', icon: '⬆️', color: '#8e44ad', affects: 'adjustments' },
  'قيد تسوية -':    { dir: 'C', label: 'قيد تسوية (خصم)', icon: '⬇️', color: '#8e44ad', affects: 'adjustments' },
  
  // ═══ الأرصدة الافتتاحية ═══
  'opening':         { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'رصيد افتتاحي':   { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'رصيدافتتاحي':    { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'رصيد اول المدة':  { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'رصيد أول المدة':  { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'رصيد اولي':      { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'افتتاح':         { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'opening_balance': { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'OPENING':         { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  'Opening':         { dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', affects: 'opening' },
  
  // ═══ إشعارات الخصم (دائن - تنقص رصيد العميل) ═══
  'إشعار خصم':      { dir: 'C', label: 'إشعار خصم', icon: '🎟️', color: '#16a085', affects: 'discounts' },
  'اشعار خصم':      { dir: 'C', label: 'إشعار خصم', icon: '🎟️', color: '#16a085', affects: 'discounts' },
  'إشعار الخصم':    { dir: 'C', label: 'إشعار الخصم', icon: '🎟️', color: '#16a085', affects: 'discounts' },
  'اشعار الخصم':    { dir: 'C', label: 'إشعار الخصم', icon: '🎟️', color: '#16a085', affects: 'discounts' },
  'discount_note':   { dir: 'C', label: 'إشعار خصم', icon: '🎟️', color: '#16a085', affects: 'discounts' },
  
  // ═══ الخصومات ═══
  'discount':        { dir: 'C', label: 'خصم ممنوح', icon: '🎁', color: '#16a085', affects: 'discounts' },
  'خصم':            { dir: 'C', label: 'خصم ممنوح', icon: '🎁', color: '#16a085', affects: 'discounts' },
  'خصم ممنوح':      { dir: 'C', label: 'خصم ممنوح', icon: '🎁', color: '#16a085', affects: 'discounts' },
  'discount_given':  { dir: 'C', label: 'خصم ممنوح', icon: '🎁', color: '#16a085', affects: 'discounts' },
};

// ═══ دالة التصنيف الرئيسية - تُحوّل أي نص إلى نوع محاسبي مع اتجاه ═══
function classifyTransaction(tp) {
  if(!tp) return { type: 'other', affects: 'other', dir: 'D', label: 'غير محدد', icon: '❓', color: '#7f8c8d' };
  
  const normalized = String(tp).trim();
  
  // محاولة المطابقة المباشرة
  if(LEDGER_TYPES[normalized]) {
    return { 
      type: LEDGER_TYPES[normalized].affects, 
      affects: LEDGER_TYPES[normalized].affects,
      dir: LEDGER_TYPES[normalized].dir, 
      label: LEDGER_TYPES[normalized].label, 
      icon: LEDGER_TYPES[normalized].icon, 
      color: LEDGER_TYPES[normalized].color, 
      raw: normalized 
    };
  }
  
  // محاولة المطابقة بدون مسافات
  const noSpace = normalized.replace(/\s+/g, '');
  for(const key in LEDGER_TYPES) {
    if(key.replace(/\s+/g, '') === noSpace) {
      return { 
        type: LEDGER_TYPES[key].affects, 
        affects: LEDGER_TYPES[key].affects,
        dir: LEDGER_TYPES[key].dir, 
        label: LEDGER_TYPES[key].label, 
        icon: LEDGER_TYPES[key].icon, 
        color: LEDGER_TYPES[key].color, 
        raw: normalized 
      };
    }
  }
  
  // محاولة المطابقة الجزئية (contains)
  const lower = normalized.toLowerCase();
  if(lower.includes('مرتجع') || lower.includes('return')) return { type: 'sales_return', affects: 'sales_return', dir: 'C', label: 'مرتجع مبيعات', icon: '↩️', color: '#16a085', raw: normalized };
  if(lower.includes('فاتورة') || lower.includes('فاتوره') || lower.includes('sale') || lower.includes('بيع')) return { type: 'sales', affects: 'sales', dir: 'D', label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', raw: normalized };
  if(lower.includes('إشعار دائن') || lower.includes('اشعار دائن') || lower.includes('credit')) return { type: 'credit_notes', affects: 'credit_notes', dir: 'C', label: 'إشعار دائن', icon: '📝', color: '#2980b9', raw: normalized };
  if(lower.includes('إشعار مدين') || lower.includes('اشعار مدين') || lower.includes('debit')) return { type: 'debit_notes', affects: 'debit_notes', dir: 'D', label: 'إشعار مدين', icon: '📋', color: '#d35400', raw: normalized };
  if(lower.includes('إشعار') || lower.includes('اشعار')) return { type: 'credit_notes', affects: 'credit_notes', dir: 'C', label: 'إشعار', icon: '📝', color: '#2980b9', raw: normalized };
  if(lower.includes('شيك') || lower.includes('cheque') || lower.includes('تحصيل') || lower.includes('نقدي') || lower.includes('سند قبض')) return { type: 'collections', affects: 'collections', dir: 'C', label: 'تحصيل', icon: '💵', color: '#27ae60', raw: normalized };
  if(lower.includes('صرف')) return { type: 'payments_out', affects: 'payments_out', dir: 'D', label: 'سند صرف', icon: '💸', color: '#c0392b', raw: normalized };
  if(lower.includes('تسوية +') || lower.includes('تسوية +') || lower.includes('تسويه +')) return { type: 'adjustments', affects: 'adjustments', dir: 'D', label: 'قيد تسوية (إضافة)', icon: '⬆️', color: '#8e44ad', raw: normalized };
  if(lower.includes('تسوية') || lower.includes('تسويه') || lower.includes('adjustment')) return { type: 'adjustments', affects: 'adjustments', dir: 'C', label: 'قيد تسوية', icon: '⚖️', color: '#8e44ad', raw: normalized };
  if(lower.includes('افتتاح') || lower.includes('opening') || lower.includes('رصيد')) return { type: 'opening', affects: 'opening', dir: 'D', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', raw: normalized };
  if(lower.includes('إشعار خصم') || lower.includes('اشعار خصم')) return { type: 'discounts', affects: 'discounts', dir: 'C', label: 'إشعار خصم', icon: '🎟️', color: '#16a085', raw: normalized };
  if(lower.includes('خصم') || lower.includes('discount')) return { type: 'discounts', affects: 'discounts', dir: 'C', label: 'خصم', icon: '🎁', color: '#16a085', raw: normalized };
  
  // افتراضي: مدين (سلامة)
  Logger.warn(`⚠️ نوع حركة غير معروف: "${normalized}" - يُعتبر مدين`);
  return { type: 'other', affects: 'other', dir: 'D', label: normalized, icon: '❓', color: '#7f8c8d', raw: normalized };
}

// ═══ دالة استخراج المبلغ من الحركة (مدين أو دائن) ═══
function extractAmount(t) {
  // الأولوية: db > cr > amount > amt
  // db = مدين (debit) = يزيد الرصيد
  // cr = دائن (credit) = ينقص الرصيد
  const db = parseFloat(t.db) || 0;
  const cr = parseFloat(t.cr) || 0;
  const amount = parseFloat(t.amount || t.amt) || 0;
  
  if(db > 0 && cr === 0) return { debit: db, credit: 0, total: db };
  if(cr > 0 && db === 0) return { debit: 0, credit: cr, total: cr };
  if(amount > 0) {
    // استخدم التصنيف لتحديد الاتجاه
    const cls = classifyTransaction(t.tp || t.type);
    if(cls.dir === 'C') return { debit: 0, credit: amount, total: amount };
    return { debit: amount, credit: 0, total: amount };
  }
  return { debit: 0, credit: 0, total: 0 };
}

// ═══ المحرك الأساسي: حساب الرصيد لكل حركة في كشف الحساب ═══
function ledgerCompute(client, fromDate, toDate) {
  const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
  const allTx = O.tx || [];
  
  // 1) رصيد افتتاحي (قبل fromDate)
  let opening = 0;
  const openingTxs = allTx.filter(t => {
    const cn = t.client || t.cl;
    return cn === client.nm && (t.type === 'opening' || t.tp === 'رصيد افتتاحي' || classifyTransaction(t.tp || t.type).affects === 'opening');
  });
  
  openingTxs.forEach(t => {
    const cls = classifyTransaction(t.tp || t.type);
    const amt = extractAmount(t);
    // الرصيد الافتتاحي دائماً مدين (إلا إذا كان سالب)
    if(cls.dir === 'D') opening += amt.total;
    else opening -= amt.total;
  });
  
  // 🛡️ FIX الجذري: لا mon.v في كشف الحساب - tx فقط هو المرجع
  // mon.v (المندوب) لا يدخل في كشف الحساب نهائياً
  
  // إضافة حركات أخرى قبل fromDate
  const priorTx = allTx.filter(t => {
    const cn = t.client || t.cl;
    return cn === client.nm && t.dt && t.dt < fromDate && (t.type !== 'opening' && t.tp !== 'رصيد افتتاحي' && classifyTransaction(t.tp || t.type).affects !== 'opening');
  });
  
  priorTx.forEach(t => {
    const cls = classifyTransaction(t.tp || t.type);
    const amt = extractAmount(t);
    if(cls.dir === 'D') opening += amt.total;
    else opening -= amt.total;
  });
  
  // 2) حركات الفترة [fromDate, toDate]
  const periodTx = allTx.filter(t => {
    const cn = t.client || t.cl;
    if(cn !== client.nm) return false;
    if(!t.dt) return false;
    if(fromDate && t.dt < fromDate) return false;
    if(toDate && t.dt > toDate) return false;
    // استثناء الرصيد الافتتاحي (يُحسب في opening)
    const cls = classifyTransaction(t.tp || t.type);
    return cls.affects !== 'opening';
  }).sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
  

  
    // 3) حساب الإجماليات حسب النوع
  const totals = {};
  let totalDebit = 0, totalCredit = 0;
  let runningBalance = opening;
  
  // إضافة صف الرصيد الافتتاحي
  const rows = [];
  if(opening !== 0) {
    rows.push({
      type: 'opening',
      tp: 'رصيد افتتاحي',
      dt: '',
      invoice: '',
      detail: `ما قبل ${fromDate || 'بداية الفترة'}`,
      debit: opening,
      credit: 0,
      balance: opening,
      cls: classifyTransaction('رصيد افتتاحي'),
    });
  }
  
  periodTx.forEach(t => {
    const cls = classifyTransaction(t.tp || t.type);
    const amt = extractAmount(t);
    
    const debit = cls.dir === 'D' ? amt.total : 0;
    const credit = cls.dir === 'C' ? amt.total : 0;
    runningBalance += debit - credit;
    
    if(!totals[cls.affects]) {
      totals[cls.affects] = { count: 0, debit: 0, credit: 0, label: cls.label, icon: cls.icon };
    }
    totals[cls.affects].count++;
    totals[cls.affects].debit += debit;
    totals[cls.affects].credit += credit;
    
    // 🛡️ FIX: لا نضيف الأرصدة الافتتاحية للإجماليات (لأنها جزء من opening)
    if(cls.affects !== 'opening') {
      totalDebit += debit;
      totalCredit += credit;
    }
    
    rows.push({
      type: cls.affects,
      tp: t.tp || t.type,
      dt: t.dt,
      invoice: t.invoice || '',
      detail: t.detail || t.desc || '',
      debit,
      credit,
      balance: runningBalance,
      cls,
    });
  });
  
  // 🛡️ FIX الجذري: لا mon.v في كشف الحساب - tx فقط
  // mon.v (المندوب) لا يدخل في كشف الحساب نهائياً
  // tx.sales و tx.payments هما المرجع الوحيد
  
    return {
    opening,
    rows,
    totals,
    totalDebit,
    totalCredit,
    closing: runningBalance,
    periodTx,
  };
}

// إتاحة عامة
window.LedgerEngine = { classifyTransaction, extractAmount, ledgerCompute, LEDGER_TYPES };
window.classifyTransaction = classifyTransaction;
window.extractAmount = extractAmount;
window.ledgerCompute = ledgerCompute;



// ════════════════════════════════════════════════════════════════════
// 🔍 SMART PARSER: كاشف ذكي لأنواع الحركات من Excel
// يكتشف الأعمدة تلقائياً ويصنّف كل صف بشكل صحيح
// ════════════════════════════════════════════════════════════════════
const LEDGER_COLUMN_PATTERNS = {
  // اسم العميل
  client: ['cl', 'client', 'customer', 'name', 'اسم', 'العميل', 'الزبون', 'اسم العميل', 'الحساب'],
  // التاريخ
  date: ['dt', 'date', 'تاريخ', 'التاريخ', 'doc_date', 'trans_date'],
  // نوع الحركة
  type: ['tp', 'type', 'doc_type', 'transaction_type', 'kind', 'النوع', 'نوع الحركة', 'نوع المستند'],
  // المبلغ
  amount: ['amount', 'total', 'value', 'مبلغ', 'القيمة', 'الإجمالي', 'الاجمالي', 'المجموع'],
  // المبلغ المدين (debit)
  debit: ['db', 'debit', 'مدين', 'الدائن', 'دائن', 'مدين', 'credit_dr'],
  // المبلغ الدائن (credit)
  credit: ['cr', 'credit', 'دائن', 'مدين', 'credit_cr', 'مدين'],
  // رقم المستند
  invoice: ['invoice', 'ref', 'doc_no', 'reference', 'رقم', 'رقم الفاتورة', 'المرجع', 'رقم المستند'],
  // الكمية
  qty: ['qty', 'q', 'quantity', 'الكمية', 'كمية'],
  // السعر
  price: ['price', 'p', 'unit_price', 'السعر', 'سعر الوحدة'],
  // اسم الصنف
  item: ['item', 'product', 'الصنف', 'المنتج', 'البضاعة'],
};

// اكتشاف تلقائي للأعمدة بناءً على رؤوس الأعمدة
function detectColumns(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    const normalized = String(h || '').trim().toLowerCase();
    if(!normalized) return;
    
    for(const [field, patterns] of Object.entries(LEDGER_COLUMN_PATTERNS)) {
      if(map[field] !== undefined) continue;
      if(patterns.some(p => normalized === p || normalized.includes(p))) {
        map[field] = idx;
        break;
      }
    }
  });
  return map;
}

// تطبيع صف Excel إلى tx object
function normalizeRow(row, colMap, rowIdx) {
  const get = (field) => {
    const idx = colMap[field];
    return (idx !== undefined && row[idx] !== undefined) ? row[idx] : null;
  };
  
  const tp = String(get('type') || '').trim();
  const cls = classifyTransaction(tp);
  
  // استخراج المبلغ من مصادر متعددة
  let amount = parseFloat(get('amount')) || 0;
  const debit = parseFloat(get('debit')) || 0;
  const credit = parseFloat(get('credit')) || 0;
  
  // إذا لم يكن هناك amount، نحسبه من db/cr
  if(!amount) {
    if(debit > 0 && credit === 0) amount = debit;
    else if(credit > 0 && debit === 0) amount = credit;
    else if(cls.dir === 'D') amount = debit;
    else amount = credit;
  }
  
  return {
    dt: formatDate(get('date')),
    cl: String(get('client') || '').trim(),
    client: String(get('client') || '').trim(),
    db: cls.dir === 'D' ? amount : debit,
    cr: cls.dir === 'C' ? amount : credit,
    amount: amount,
    type: cls.affects,
    tp: tp,
    invoice: String(get('invoice') || '').trim(),
    qty: parseFloat(get('qty')) || 0,
    price: parseFloat(get('price')) || 0,
    item: String(get('item') || '').trim(),
    cls: cls,
    _rowIdx: rowIdx,
  };
}

// تنسيق التاريخ من أي صيغة
function formatDate(val) {
  if(!val) return '';
  if(val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if(typeof val === 'number' && val > 20000 && val < 60000) {
    // Excel serial date
    const d = new Date(Math.round((val - 25569) * 864e5));
    return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  // محاولة yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  // محاولة dd/mm/yyyy أو mm/dd/yyyy
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if(m) {
    // افترض dd/mm/yyyy (الخليج)
    return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }
  // محاولة Date.parse
  const d = new Date(s);
  if(!isNaN(d) && d.getFullYear() > 2000) {
    return d.toISOString().slice(0, 10);
  }
  return s;
}

// إتاحة عامة
window.detectColumns = detectColumns;
window.normalizeRow = normalizeRow;
window.formatDate = formatDate;
window.LEDGER_COLUMN_PATTERNS = LEDGER_COLUMN_PATTERNS;

// سجل معلومات التشخيص
Logger.info('🔍 Smart Parser loaded - detects:', Object.keys(LEDGER_COLUMN_PATTERNS).join(', '));


function nayefForceRefreshData() {
  if(!confirm('⚠️ سيتم مسح البيانات المخزنة مؤقتاً. سيتم إعادة تحميل البيانات من ملف Excel عند فتح الداشبورد. هل تريد المتابعة؟')) return;
  
  try {
    localStorage.removeItem('nayef_data_backup_v220_force');
    localStorage.removeItem('nayef_data_timestamp_v220_force');
    if(typeof showToast === 'function') {
      showToast('🔧 تم مسح البيانات المؤقتة. أعد رفع ملف Excel لتطبيق الإصلاحات.', 'success', false);
    } else {
      alert('🔧 تم مسح البيانات المؤقتة. أعد رفع ملف Excel لتطبيق الإصلاحات.');
    }
  } catch(e) {
    Logger.warn('Clear localStorage failed:', e);
  }
  
  setTimeout(() => location.reload(), 1500);
}

// 🔄 مزامنة window.O → O (إذا وضع المستخدم البيانات في window.O)
function syncFromWindow() {
  if(!window.O || !window.O.soc || window.O.soc.length === 0) return false;
  if(window.O === O) return false; // مزامن بالفعل
  
  // نقل من window.O إلى O المحلي
  try {
    O.soc = window.O.soc;
    O.ag = window.O.ag || [];
    O.tx = window.O.tx || [];
    O.mon = window.O.mon || [];
    O.ml = window.O.ml || [];
    O.mk = window.O.mk || [];
    O.T = window.O.T || {};
    O.it = window.O.it || [];
    O.im = window.O.im || {};
    
    // الآن window.O يشير لنفس O
    window.O = O;
    nayefSaveData();
    return true;
  } catch(e) {
    return false;
  }
}

// 🛡️ ضمان: مزامنة دورية بين window.O و O المحلي
setInterval(() => {
  if(typeof O === 'undefined') return;
  
  // 📡 مزامنة فورية - ضمان أن window.O = O دائماً
  if(window.O !== O) {
    if(window.O?.soc?.length > 0 && (!O?.soc || O.soc.length === 0)) {
      // window.O فيه بيانات لكن O المحلي فارغ → استورد من window.O
      syncFromWindow();
    } else {
      // العكس: window.O = O (توحيد)
      window.O = O;
    }
  }
}, 1000); // كل ثانية (بدلاً من 5) للاستجابة الأسرع

// استرجاع فوري عند التحميل (محلي — سريع، بس ممكن يكون قديم)
const wasRestored = nayefRestoreData();

// 🛠️ إصلاح جذري: السحابة لازم تتفحص دايمًا (مش بس لو الاسترجاع المحلي فشل).
// قبل كده: لو أي جهاز لقى أي نسخة محلية عنده (حتى لو قديمة جدًا)، كان
// النظام بيوقف عند كده ومبيسألش السحابة خالص — يعني نفس الجهاز يفضل
// "متقفل" على آخر نسخة شافها هو بس، وميشوفش تعديلات أي جهاز تاني أبدًا.
// دلوقتي: السحابة بتتفحص كل مرة، ولو فيها بيانات، بتحل محل النسخة
// المحلية القديمة فورًا مع إعادة رسم الشاشة.
if (typeof window !== 'undefined' && window.StorageV2) {
  window.StorageV2.load().then(r => {
    if (r && r.data && (r.data.soc || r.data.it || r.data.tx) && r.source === 'cloud') {
      Logger.info('☁️ تحديث من السحابة (المصدر الحقيقي) — استبدال أي نسخة محلية قديمة');
      try {
        Object.assign(O, r.data);
        window.O = O;
        if (typeof auditAndRecomputeTotals === 'function') { try { auditAndRecomputeTotals(O); } catch(e) {} }
        if (typeof recompute === 'function') { try { recompute(); } catch(e) {} }
        setTimeout(() => { if (typeof draw === 'function') draw(); }, 100);
      } catch(e) { Logger.warn('Cloud override failed:', e); }
    } else if (!wasRestored && r && r.data && (r.data.soc || r.data.it || r.data.tx)) {
      // مفيش سحابة (أوفلاين) ومفيش نسخة محلية أصلاً — نستخدم أي نسخة احتياطية لقيناها (IndexedDB/مشفّرة)
      Logger.info('✅ StorageV2: استعادة من', r.source);
      try {
        Object.assign(O, r.data);
        window.O = O;
        if (typeof nayefSaveData === 'function') nayefSaveData();
        if (typeof showToast === 'function') showToast('📦 استعادة', 'تم استرجاع البيانات من ' + r.source, true);
        setTimeout(() => { if (typeof draw === 'function') draw(); }, 500);
      } catch(e) { Logger.warn('StorageV2 restore:', e); }
    }
  }).catch(e => {});

  // Auto-backup أسبوعي
  setTimeout(() => window.StorageV2 && window.StorageV2.autoBackupCheck(), 3000);
}

if(wasRestored) {
  Logger.info('✅ تم استرجاع البيانات من النسخة الاحتياطية');
  Logger.info('   O.soc.length =', O.soc?.length);
  Logger.info('   window.O === O?', window.O === O);
  
  // 📡 مزامنة فورية لـ window.O (بدلاً من انتظار setInterval 5 ثوانٍ)
  try {
    window.O = O;
    window.D = D;
    Logger.info('✅ تم تحديث window.O فوراً');
  } catch(e) {
    Logger.warn('⚠️ فشلت المزامنة الفورية:', e.message);
  }
  
  // 🛡️ إصلاح جذري: بعد restore، window.O يجب أن يشير لنفس O
  // لكن بعض الكود قد يحل محل O بعد ذلك بـ SEED فارغ
  // لذا نضع مراقب يعيد O إلى بياناته إذا فُرغ
  const restoreGuard = setInterval(() => {
    // 🆕 v220.1+ LOCKED: لا تستعيد إذا كان URL يحوي reset (المستخدم مسح عمداً)
    if(window.location.search.includes('reset=') || window.location.search.includes('quick-')) {
      Logger.info('🚫 restoreGuard: تم تعطيل الاستعادة (المستخدم مسح البيانات)');
      clearInterval(restoreGuard);
      return;
    }
    if(O.soc?.length === 0 && localStorage.getItem('nayef_data_backup_v220_force')) {
      try {
        const data = JSON.parse(localStorage.getItem('nayef_data_backup_v220_force'));
        if(data.soc?.length > 0) {
          Logger.warn('⚠️ تم اكتشاف فقدان البيانات بعد restore - إعادة الاسترجاع');
          O.soc = data.soc;
          O.ag = data.ag || [];
          O.tx = data.tx || [];
          O.ml = data.ml;
          O.T = data.T || {};
          window.O = O;
        } else if ((data.it && data.it.length > 0) || Object.keys(data.im || {}).length > 0) {
          // 🆕 v220.1+ DYNAMIC: استعد الأصناف حتى لو الجمعيات فارغة
          Logger.warn('⚠️ استعادة الأصناف بعد فقدان البيانات');
          O.it = data.it || [];
          O.im = data.im || {};
          window.O = O;
        }
      } catch(e) {}
    } else {
      clearInterval(restoreGuard);
    }
  }, 1000);
  
  // توقف بعد 10 ثوان
  setTimeout(() => clearInterval(restoreGuard), 10000);
}

// حفظ تلقائي عند إغلاق الصفحة
window.addEventListener('beforeunload', nayefSaveData);

// حفظ تلقائي كل 30 ثانية
setInterval(() => {
  if(O && O.soc && O.soc.length > 0) nayefSaveData();
}, 30000);
let CUR='ov';
let _filterA=0,_filterB=99;
const CH={};
const PAL=['#b8932f','#2563a8','#1e8449','#c0392b','#7d4f9e','#1b8a8a','#cc7722','#a0397a','#9a7a23','#3a5a8c','#c0622b','#1b8a6a'];

// ══ UTILS ══
const $=id=>document.getElementById(id);
const N=v=>isNaN(+v)?0:+v;
const fmt=v=>Math.round(N(v)).toLocaleString('en');
const KD=v=>Currency.format(v);  // 🛡️ FIX: استبدال Currency.format الآمن
const PC=v=>{const n=N(v);if(!isFinite(n))return'∞%';if(n>1000)return'>1000%';if(n<-1000)return'<-1000%';return n.toFixed(1)+'%';};;
const SN=n=>String(n||'').replace(/جمعية /g,'').replace(/ التعاونية/g,'').replace(/التعاونية/g,'').replace(/سوق /g,'').slice(0,14);

function MK(id,cfg){
  // 🛡️ FIX: استخدام ChartManager مع LRU وتنظيف الذاكرة
  try{
    const chart = ChartManager.create(id, cfg);
    if(chart) CH[id] = chart;
  }catch(e){Logger.warn('chart',id,e.message);}
}

function KC(lbl,val,sub,col){
  return `<div class="kc" style="border-top-color:${col||'var(--gd)'}">
    <div class="kl">${lbl}</div><div class="kv" style="color:${col||'var(--gd)'}">${val}</div>
    ${sub?`<div class="ks">${sub}</div>`:''}
  </div>`;
}

function TB(rows,cols){
  if(!rows||!rows.length) return '<p style="color:var(--tx3);padding:8px;font-size:12px">لا توجد بيانات</p>';
  let h='<div class="tw"><table><thead><tr>'+cols.map(c=>`<th>${c[0]}</th>`).join('')+'</tr></thead><tbody>';
  rows.forEach(r=>{h+='<tr>'+cols.map(c=>`<td>${c[1](r)}</td>`).join('')+'</tr>';});
  return h+'</tbody></table></div>';
}

function PB(lbl,v,mx,col){
  const p=mx>0?Math.min(v/mx*100,100):0;
  return `<div class="pb"><div class="pbn" title="${lbl}">${lbl}</div>
    <div class="pbt"><div class="pbf" style="width:${p}%;background:${col||'var(--gd)'}"></div></div>
    <div class="pbv">${KD(v)}</div></div>`;
}

// ══ FILTER ══
function initFilter(){
  const fa=$('fA'),fb=$('fB'); if(!fa||!fb) return;
  const M=O.ml||[];
  _filterA=0;
  _filterB=Math.max(0, M.length-1);
  fa.innerHTML=M.map((m,i)=>`<option value="${i}"${i===0?' selected':''}>${m}</option>`).join('');
  fb.innerHTML=M.map((m,i)=>`<option value="${i}"${i===M.length-1?' selected':''}>${m}</option>`).join('');
  $('frng').textContent='الكامل: '+M[0]+' ← '+M[M.length-1];
  fa.onchange=fb.onchange=()=>applyF();
}

function applyF(){
  const a=+$('fA').value, b=+$('fB').value;
  _filterA=a; _filterB=b;          // ← تحديث متغيرات الفلتر (ضروري لجداول المناديب وغيرها)
  recompute(a,b);
  $('frng').textContent='الفترة: '+O.ml[a]+' ← '+O.ml[b]+(b-a+1<O.ml.length?' ('+(b-a+1)+' شهر)':'');
  draw(CUR);
}

function resetF(){
  _filterA=0;_filterB=O.ml.length-1;
  D=JSON.parse(JSON.stringify(O));
  $('fA').value=0; $('fB').value=O.ml.length-1;
  $('frng').textContent='الكامل: '+O.ml[0]+' ← '+O.ml[O.ml.length-1];
  draw(CUR);
}


// ════════════════════════════════════════════════════════════════════
// 🔍 تدقيق مالي: حساب المجاميع (T, mt, mc) من مصادرها الصحيحة
// يُستدعى تلقائياً بعد تحميل البيانات
// ════════════════════════════════════════════════════════════════════
function auditAndRecomputeTotals(O) {
  if(!O || !O.soc) return O;
  
  // 1) إجماليات الجمعيات
  // 🔑 منطق المدقق المالي: mon هو مصدر الحقيقة للمجاميع الشهرية
  // لأن mon.v و mon.c تحتوي على 12 شهر مفصلة (الدقة أعلى)
  // و soc.s / soc.c يجب أن تكون مجموع mon.v / mon.c
  let T = { s: 0, co: 0, pr: 0, c: 0, ot: 0, q: 0 };
  
  // أولاً: حدّث soc.s و soc.c من mon (لو متوفر)
  O.soc.forEach(s => {
    const mon = O.mon?.find(m => m.nm === s.nm);
    if(mon) {
      const monSumV = +(mon.v || []).reduce((t, v) => t + N(v), 0).toFixed(2);
      const monSumC = +(mon.c || []).reduce((t, v) => t + N(v), 0).toFixed(2);
      const monSumQ = +((mon.q || []).reduce((t, v) => t + N(v), 0)).toFixed(1);
      
      // 🆕 v220.1+ LOCKED: احترم s.s و s.c الأصليين
      // القاعدة: mon.v يحوي opening + مبيعات (sum شامل)
      // s.s يحوي المبيعات فقط (net sales)
      // لذلك monSumV > s.s دائماً بشكل طبيعي - لا نستبدل!
      // نستبدل فقط إذا s.s = 0 (بيانات ناقصة)
      if(monSumV > 0 && N(s.s) === 0) {
        Logger.info(`✅ s مُعاد تعبئته من mon.v لـ ${s.nm}: s=${monSumV} (كان 0)`);
        s.s = monSumV;
      } else if(monSumV > 0 && Math.abs(monSumV - N(s.s)) > 0.01) {
        // الاختلاف طبيعي (opening vs net) - لا نسجّل تحذير
        Logger.info(`📊 ${s.nm}: mon.v=${monSumV} vs s.s=${N(s.s)} (اختلاف طبيعي - opening في mon.v)`);
      }
      if(monSumC > 0 && N(s.c) === 0) {
        Logger.info(`✅ c مُعاد تعبئته من mon.v لـ ${s.nm}: c=${monSumC} (كان 0)`);
        s.c = monSumC;
      } else if(monSumC > 0 && Math.abs(monSumC - N(s.c)) > 0.01) {
        Logger.info(`📊 ${s.nm}: mon.c=${monSumC} vs s.c=${N(s.c)} (اختلاف طبيعي)`);
      }
      if(monSumQ > 0 && N(s.q) === 0) {
        s.q = monSumQ;
      }
    }
  });
  
  O.soc.forEach(s => {
    T.s  += N(s.s);
    T.co += N(s.co);
    T.pr += N(s.pr);
    T.c  += N(s.c);
    T.ot += N(s.ot);
    T.q  += N(s.q);
    
    // 🛡️ FIX الجذري: ot = ob + s - c
    const calcOt = +(N(s.ob || 0) + N(s.s) - N(s.c)).toFixed(2);
    if(Math.abs(calcOt - N(s.ot)) > 0.01) {
      Logger.warn(`🔍 تدقيق ${s.nm}: ot=${s.ot} → مصحح إلى ${calcOt}`);
      s.ot = calcOt;
    }
    
    // 🛡️ FIX الجذري 1: كشف الفواتير المدمجة في opening
    const txOpeningTxs = (O.tx || []).filter(t => 
      (t.client === s.nm || t.cl === s.nm) && 
      (t.type === 'opening' || t.tp === 'رصيد افتتاحي')
    );
    const txOpeningSum = txOpeningTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.db) || 0), 0);
    
    // 🛡️ FIX الجذري 2: حساب المبيعات الحقيقية من tx
    const txSalesTxs = (O.tx || []).filter(t => 
      (t.client === s.nm || t.cl === s.nm) && 
      (t.type === 'sale' || t.tp === 'فاتوره' || t.tp === 'فاتورة')
    );
    const txSalesSum = txSalesTxs.reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.db) || 0), 0);
    
    // 🛡️ FIX 3: كشف الفواتير المدمجة - إذا tx.opening > 0 وكان أول فاتورة بعده في نفس اليوم أو اليوم التالي
    if(txOpeningTxs.length > 0 && txSalesTxs.length > 0) {
      // نرتب المبيعات حسب التاريخ
      const sortedSales = [...txSalesTxs].sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
      const openingDt = txOpeningTxs[0].dt;
      const firstSaleDt = sortedSales[0].dt;
      
      // إذا الفاتورة الأولى بعد الافتتاح مباشرة (≤ 7 أيام)
      if(openingDt && firstSaleDt) {
        const opDate = new Date(openingDt);
        const firstSaleDate = new Date(firstSaleDt);
        const daysDiff = (firstSaleDate - opDate) / (1000 * 60 * 60 * 24);
        
        // إذا كان الفرق كبير (الافتتاح في فترة سابقة) ولكن tx.opening كبير جداً
        // نقارن tx.opening مع soc.ob المتوقع (بناءً على البيانات الأخرى)
        // في هذه الحالة: إذا كان tx.opening يشمل مبيعات، نكتشف ذلك
        
        // محاولات كشف الفواتير المدمجة:
        // 1) إذا tx.opening / mon.v[opening_month] > 0.9 (أي mon.v[opening_month] = opening)
        if(s.mon && s.mon !== undefined) {
          // soc.ob مضخم ومبني على mon.v[opening_month]
          // في هذه الحالة tx.opening مضخم أيضاً
          // يجب تنبيه المستخدم
        }
      }
    }
    
    // 🆕 v220.1+ LOCKED FIX: احترام البيانات الأصلية - لا تستبدل إلا إذا mon.v فارغ
    if(txOpeningSum > 0 && Math.abs(N(s.ob) - txOpeningSum) > 0.01) {
      const clientMon = (O.mon || []).find(m => m.nm === s.nm);
      if(!clientMon || !clientMon.v || clientMon.v.every(v => N(v) === 0)) {
        const diff = N(s.ob) - txOpeningSum;
        Logger.warn(`🔧 إصلاح ob: ${s.nm}: ob=${N(s.ob)} → ${txOpeningSum.toFixed(2)} (mon.v فارغ)`);
        s.ob = +txOpeningSum.toFixed(2);
      } else {
        Logger.info(`✅ ob محفوظ لـ ${s.nm}: ob=${N(s.ob)} (mon.v فيه بيانات)`);
      }
    }
    
    // 🆕 v220.1+ LOCKED: لا تستبدل s.s إلا إذا mon.v فارغ
    if(txSalesSum > 0 && Math.abs(N(s.s) - txSalesSum) > 0.01) {
      const oldS = N(s.s);
      const clientMon = (O.mon || []).find(m => m.nm === s.nm);
      if(!clientMon || !clientMon.v || clientMon.v.every(v => N(v) === 0)) {
        s.s = +txSalesSum.toFixed(2);
        Logger.info(`🔧 إصلاح s: ${s.nm}: s=${oldS} → ${txSalesSum.toFixed(2)} (mon.v فارغ)`);
      } else {
        Logger.info(`✅ s محفوظ لـ ${s.nm}: s=${oldS} (mon.v فيه ${clientMon.v.filter(v => N(v) > 0).length} أشهر نشطة)`);
      }
    }
    
    // 🛡️ FIX 6: ot = ob + s - c
    s.ot = +(N(s.ob) + N(s.s) - N(s.c)).toFixed(2);
    
    // 🛡️ FIX الجذري 7: mon.v هو مصدر الحقيقة
    // mon.v يحوي opening + مبيعات شهرية
    // tx يحوي opening ومبيعات مفصلة
    // إذا كان هناك تناقض، نستخدم mon.v للحسابات النهائية
    
    const clientMon = (O.mon || []).find(m => m.nm === s.nm);
    if(clientMon && clientMon.v && clientMon.v.length > 0 && txOpeningTxs.length > 0) {
      // تحديد شهر الافتتاح
      const openingDt = txOpeningTxs[0].dt;
      const openingMonthIdx = (O.mk || []).findIndex(mk => {
        if(!openingDt) return -1;
        return mk === openingDt.slice(0, 7);
      });
      
      if(openingMonthIdx >= 0 && clientMon.v[openingMonthIdx] !== undefined) {
        const monOpeningValue = clientMon.v[openingMonthIdx];
        
        // mon.v[opening_month] = opening الحقيقي
        // إذا كان مختلف عن txOpeningSum، استخدم mon.v
        if(Math.abs(monOpeningValue - txOpeningSum) > 1) {
          Logger.info(`📊 mon.v vs tx.opening: mon=${monOpeningValue} vs tx=${txOpeningSum.toFixed(2)} (فرق ${(monOpeningValue - txOpeningSum).toFixed(2)})`);
        }
        
        // ob = mon.v[opening_month] (إذا كان أصغر من tx.opening)
        if(monOpeningValue > 0 && Math.abs(N(s.ob) - monOpeningValue) > 1) {
          Logger.warn(`🔧 إصلاح ob من mon.v: ${s.nm}: ob=${N(s.ob)} → ${monOpeningValue} (من mon.v)`);
          s.ob = +monOpeningValue.toFixed(2);
        }
        
        // s = sum(mon.v) - mon.v[opening_month]
        const monSalesSum = clientMon.v.reduce((sum, v, idx) => {
          if(idx === openingMonthIdx) return sum; // استثناء شهر الافتتاح
          return sum + (parseFloat(v) || 0);
        }, 0);
        
        if(monSalesSum > 0 && Math.abs(N(s.s) - monSalesSum) > 1) {
          Logger.warn(`🔧 إصلاح s من mon.v: ${s.nm}: s=${N(s.s)} → ${monSalesSum.toFixed(2)} (من mon.v)`);
          s.s = +monSalesSum.toFixed(2);
        }
      }
    }
    // التحقق: rate = c/s * 100
    if(N(s.s) > 0) {
      const calcRt = +(N(s.c) / N(s.s) * 100).toFixed(1);
      if(Math.abs(calcRt - N(s.rt)) > 0.1) {
        Logger.warn(`🔍 تدقيق ${s.nm}: rt=${s.rt} → مصحح إلى ${calcRt}`);
        s.rt = calcRt;
      }
    } else {
      s.rt = 0;
    }
    // التحقق: pr = s - co
    const calcPr = +(N(s.s) - N(s.co)).toFixed(2);
    if(Math.abs(calcPr - N(s.pr)) > 0.01) {
      Logger.warn(`🔍 تدقيق ${s.nm}: pr=${s.pr} → مصحح إلى ${calcPr}`);
      s.pr = calcPr;
    }
    // التحقق: إذا لم يوجد co، احسبه من g+d+fv
    if(N(s.co) === 0 && (N(s.g) > 0 || N(s.d) > 0 || N(s.fv) > 0)) {
      s.co = +(N(s.g) + N(s.d) + N(s.fv)).toFixed(2);
      s.pr = +(N(s.s) - N(s.co)).toFixed(2);
    }
    
    // التحقق: li (آخر شراء) - إذا فارغ، احسبه من آخر شهر بمبيعات
    if(!s.li || s.li === '') {
      const mon = O.mon?.find(m => m.nm === s.nm);
      if(mon && O.mk && O.mk.length) {
        let lastIdx = -1;
        for(let k = (mon.v||[]).length - 1; k >= 0; k--) {
          if(N((mon.v||[])[k]) > 0) { lastIdx = k; break; }
        }
        if(lastIdx >= 0 && O.mk[lastIdx]) {
          s.li = O.mk[lastIdx] + '-15'; // منتصف الشهر
        }
      }
    }
    // التحقق: lc (آخر تحصيل)
    if(!s.lc || s.lc === '') {
      const mon = O.mon?.find(m => m.nm === s.nm);
      if(mon && O.mk && O.mk.length) {
        let lastIdx = -1;
        for(let k = (mon.c||[]).length - 1; k >= 0; k--) {
          if(N((mon.c||[])[k]) > 0) { lastIdx = k; break; }
        }
        if(lastIdx >= 0 && O.mk[lastIdx]) {
          s.lc = O.mk[lastIdx] + '-20';
        }
      }
    }
  });
  
  T.s  = +T.s.toFixed(2);
  T.co = +T.co.toFixed(2);
  T.pr = +T.pr.toFixed(2);
  T.c  = +T.c.toFixed(2);
  T.ot = +T.ot.toFixed(2);
  T.q  = +T.q.toFixed(1);
  
  O.T = T;
  
  // 2) متجهات الشهرية
  if(O.mon && O.mk) {
    O.mt = O.mk.map(mk => +O.mon.reduce((t, x) => t + N((x.v||[])[O.mk.indexOf(mk)]), 0).toFixed(2));
    O.mc = O.mk.map(mk => +O.mon.reduce((t, x) => t + N((x.c||[])[O.mk.indexOf(mk)]), 0).toFixed(2));
  }
  
  // 3) إصلاح المناديب - التحقق من sales و collections
  if(O.ag) {
    O.ag.forEach(ag => {
      if(N(ag.s) === 0 && ag.sv && ag.sv.length) {
        ag.s = +ag.sv.reduce((t, v) => t + N(v), 0).toFixed(2);
      }
      if(N(ag.c) === 0 && ag.cv && ag.cv.length) {
        ag.c = +ag.cv.reduce((t, v) => t + N(v), 0).toFixed(2);
      }
      if(N(ag.s) > 0) {
        ag.rt = +(N(ag.c) / N(ag.s) * 100).toFixed(1);
      }
    });
  }
  
  Logger.info('🔍 التدقيق اكتمل:', { T, mt_len: O.mt?.length, ag_count: O.ag?.length });
  return O;
}


// ═══════════════════════════════════════════════════════════════
// 🆕 LOCKED v220.1+: حساب الإشعارات الدائنة من O.tx
// ═══════════════════════════════════════════════════════════════
function classifyTxForReceivables(tp) {
  // نستخدم نفس LEDGER_TYPES الموجودة
  if(typeof LEDGER_TYPES === "undefined" || !LEDGER_TYPES) return null;
  const norm = String(tp||"").trim();
  if(LEDGER_TYPES[norm]) return LEDGER_TYPES[norm];
  const noSpace = norm.replace(/\s+/g, "");
  for(const key in LEDGER_TYPES) {
    if(key.replace(/\s+/g, "") === noSpace) return LEDGER_TYPES[key];
  }
  // بدائل نصية
  const lower = norm.toLowerCase();
  if(lower.includes("مرتجع") || lower.includes("return")) return { dir: "C", affects: "sales_return", label: "مرتجع" };
  if(lower.includes("إشعار دائن") || lower.includes("اشعار دائن") || lower.includes("credit")) return { dir: "C", affects: "credit_notes", label: "إشعار دائن" };
  if(lower.includes("شيك") || lower.includes("تحصيل") || lower.includes("نقدي") || lower.includes("سند قبض")) return { dir: "C", affects: "collections", label: "تحصيل" };
  if(lower.includes("فاتورة") || lower.includes("بيع") || lower.includes("sale")) return { dir: "D", affects: "sales", label: "مبيعات" };
  return null;
}

// حساب إجمالي الإشعارات الدائنة لعميل معيّن
function getClientCreditNotes(clientName, fromMonth, toMonth) {
  if(!O || !O.tx) return 0;
  let total = 0;
  O.tx.forEach(t => {
    if(!t) return;
    const cn = t.client || t.cl;
    if(cn !== clientName) return;
    if(!t.dt) return;
    if(fromMonth && t.dt.slice(0,7) < fromMonth) return;
    if(toMonth && t.dt.slice(0,7) > toMonth) return;
    // 🆕 v220.1+: تصنيف نوع الحركة
    const cls = classifyTxForReceivables(t.tp || t.type);
    let isCreditNote = false;
    if(cls && cls.affects === "credit_notes" && cls.dir === "C") {
      isCreditNote = true;
    } else {
      // بديل: التحقق من نوع الحركة بنص
      const tpText = String(t.tp || t.type || "").trim();
      if(tpText.includes("إشعار") || tpText.includes("اشعار") || 
         tpText.includes("credit") || tpText.includes("دائن") ||
         tpText.toLowerCase().includes("cr")) {
        // تحقق إضافي: إذا كان رصيد دائن موجب (وليس مدين)
        if(N(t.cr) > 0 && N(t.db || 0) === 0) isCreditNote = true;
        // أو إذا كان tp = "إشعار" صراحةً
        if(tpText === "إشعار" || tpText === "اشعار" || tpText === "إشعار دائن" || tpText === "اشعار دائن") {
          isCreditNote = true;
        }
      }
    }
    if(isCreditNote) {
      // قراءة القيمة: من cr أولاً (رصيد الدائن)، ثم amount، ثم أي حقل آخر
      const crAmt = N(t.cr || 0);
      const dbAmt = N(t.db || 0);
      const amount = N(t.amount || 0);
      // القيمة الفعلية: الفرق بين الدائن والمدين (صافي الدائن)
      let value = 0;
      if(crAmt > 0) value = crAmt - dbAmt; // صافي الرصيد الدائن
      else value = amount;
      if(value > 0) total += value;
    }
  });
  return +total.toFixed(2);
}

// حساب إجمالي الإشعارات الدائنة لكل العملاء (يُحدّث s.cn)
function recomputeCreditNotesAll() {
  if(!O || !O.soc) return 0;
  let grandTotal = 0;
  let totalCNCount = 0;
  if(O.tx) {
    O.tx.forEach(t => {
      if(!t) return;
      const cls = classifyTxForReceivables(t.tp || t.type);
      if(cls && cls.affects === "credit_notes" && cls.dir === "C") {
        totalCNCount++;
      }
    });
  }
  O.soc.forEach(s => {
    if(!s.nm) return;
    const cn = getClientCreditNotes(s.nm);
    s.cn = cn;
    grandTotal += cn;
  });
  // حفظ عدد الإشعارات للعرض
  if(typeof window !== "undefined") window.__cnCount = totalCNCount;
  return +grandTotal.toFixed(2);
}


function recompute(a,b){
  // جمعيات
  const isFullPeriod=a===0&&b>=O.ml.length-1;
  const soc=O.soc.map(s=>{
    const mr=O.mon.find(m=>m.nm===s.nm)||{v:[],c:[],q:[]};
    let sales=0,coll=0,qSold=0;
    for(let k=a;k<=b;k++){sales+=N(mr.v[k]);coll+=N(mr.c[k]);qSold+=N((mr.q||[])[k]);}
    // نسبة مبيعات الفترة من الكلي (لتجزئة مكوّنات التكلفة بدقة)
    const ratio=s.s>0?sales/s.s:0;
    // إصلاح: استخدام fallback chain للتكلفة
    // 1) من المكوّنات المفصلة (g, d, fv) - الأكثر دقة
    // 2) من s.co مباشرة - إذا لم تتوفر المكوّنات
    // 3) 0 - كحل أخير
    const periodG=+(N(s.g)*ratio).toFixed(2);
    const periodD=+(N(s.d)*ratio).toFixed(2);
    const periodFv=+(N(s.fv)*ratio).toFixed(2);
    let cost;
    if(N(s.g)>0 || N(s.d)>0 || N(s.fv)>0) {
      // مكونات التكلفة متوفرة - استخدمها
      cost=+(periodG+periodD+periodFv).toFixed(2);
    } else if(N(s.co)>0) {
      // لا مكونات مفصلة لكن co موجود - اجزئه بنفس النسبة
      cost=+(N(s.co)*ratio).toFixed(2);
    } else {
      cost=0;
    }
    // 🛡️ FIX: الذمم = ob + s - c - الإشعارات الدائنة (v220.1+ LOCKED)
    const openingBalance = N(s.ob || 0);
    let cnAmt = 0;
    try { cnAmt = getClientCreditNotes(s.nm) || 0; } catch(e) { Logger.error('❌ getClientCreditNotes:', e); }
    const realOut = +(openingBalance + s.s - s.c - cnAmt).toFixed(2);
    return{...s,s:+sales.toFixed(2),co:+cost.toFixed(2),pr:+(sales-cost).toFixed(2),
           g:periodG,d:periodD,fv:periodFv,
           cn:+cnAmt.toFixed(2),
           c:+coll.toFixed(2),
           q:+qSold.toFixed(1),
           rt:sales>0?+(coll/sales*100).toFixed(1):0,
           ot:realOut,
           // قيم الفترة الصريحة
           periodSales:+sales.toFixed(2),periodColl:+coll.toFixed(2),
           // الإجماليات الكلية للمرجع
           totSales:s.s,totColl:s.c,totOut:+(s.s-s.c).toFixed(2)};
  }).sort((x,y)=>y.s-x.s);
  // 🛡️ FIX: تحديث O.soc[i].ot بقيمة realOut المحسوبة
  // السبب: display في الـ KPIs يستخدم O.soc مباشرة، فإذا ot غير محدّث يظهر خاطئ
  soc.forEach(filteredS => {
    const origS = O.soc.find(s => s.nm === filteredS.nm);
    if(origS) {
      origS.ot = filteredS.ot;
      origS.totOut = filteredS.totOut;
      origS.periodSales = filteredS.periodSales;
      origS.periodColl = filteredS.periodColl;
    }
  });
  
  const T={s:+soc.reduce((t,x)=>t+x.s,0).toFixed(2),co:+soc.reduce((t,x)=>t+x.co,0).toFixed(2),
           pr:+soc.reduce((t,x)=>t+x.pr,0).toFixed(2),c:+soc.reduce((t,x)=>t+x.c,0).toFixed(2),
           ob:+soc.reduce((t,x)=>t+(x.ob||0),0).toFixed(2),
           ot:+soc.reduce((t,x)=>t+(x.ot||0),0).toFixed(2)};
  const mt=O.ml.map((_,k)=>k>=a&&k<=b?N(O.mt[k]):0);
  const mc=O.ml.map((_,k)=>k>=a&&k<=b?N(O.mc[k]):0);
  // أصناف
  let items=O.it;
  const isAll=a===0&&b>=O.ml.length-1;
  if(!isAll&&O.im&&Object.keys(O.im).length){
    const fi=Object.values(O.im).map(im=>{
      let s=0,q=0,c=0;
      for(let k=a;k<=b;k++){s+=N(im.sv[k]);q+=N(im.qv[k]);c+=N(im.cv[k]);}
      const orig=O.it.find(x=>x.cd===im.cd)||{uc:0,up:0,rm:0};
      return{...orig,cd:im.cd,nm:im.nm,ns:+s.toFixed(2),g:+c.toFixed(2),pr:+(s-c).toFixed(2),sl:+q.toFixed(1)};
    }).filter(x=>x.ns>0);
    if(fi.length) items=fi;
  }
  // مناديب — مع التارجت الشهري حسب الفترة
  // 🛠️ إصلاح: الفلتر القديم كان بيشيل أي مندوب جديد لسه ملوش مبيعات/هدف
  // (يعني أي مندوب جديد يتضاف بيختفي من القائمة رغم إنه محفوظ فعليًا)
  const agents=(O.ag||[]).map(ag=>{
    let s=0,c=0,tgt=0;
    for(let k=a;k<=b;k++){s+=N((ag.sv||[])[k]);c+=N((ag.cv||[])[k]);tgt+=N((ag.tv||[])[k]);}
    const diff=+(s-tgt).toFixed(2);
    return{...ag,s:+s.toFixed(2),c:+c.toFixed(2),
           tg:+tgt.toFixed(2),ac:+s.toFixed(2),
           diff,achPct:tgt>0?+(s/tgt*100).toFixed(1):0,
           rt:s>0?+(c/s*100).toFixed(1):0};
  }).sort((x,y)=>y.s-x.s);
  // ── المصاريف مفلترة بنطاق التاريخ [a,b] ──
  let fExpenses=O.expenses;
  if(O.expenses&&O.expenses.items){
    const monKeys=O.mk||[];
    const activeKeys=new Set();
    for(let k=a;k<=b;k++){if(monKeys[k])activeKeys.add(monKeys[k]);}
    // أعد بناء كل بند بقيمه ضمن النطاق فقط
    const fItems=O.expenses.items.map(it=>{
      const fmonthly={}; let fannual=0;
      Object.entries(it.monthly||{}).forEach(([mk,v])=>{if(activeKeys.has(mk)){fmonthly[mk]=v;fannual+=v;}});
      return{name:it.name,cat:it.cat,monthly:fmonthly,annual:+fannual.toFixed(2)};
    }).filter(it=>it.annual>0);
    const fMonthlyTotal={}; fItems.forEach(it=>{Object.entries(it.monthly).forEach(([mk,v])=>{fMonthlyTotal[mk]=(fMonthlyTotal[mk]||0)+v;});});
    const fByCat={}; fItems.forEach(it=>{fByCat[it.cat]=(fByCat[it.cat]||0)+it.annual;});
    const fTotalAnnual=fItems.reduce((t,it)=>t+it.annual,0);
    fExpenses={items:fItems,monthlyTotal:fMonthlyTotal,totalAnnual:+fTotalAnnual.toFixed(2),
      byCat:fByCat,activeMonths:Object.keys(fMonthlyTotal).length};
  }
  D={...O,soc,T,mt,mc,it:items,ag:agents,expenses:fExpenses};
}

// ══ NAVIGATION ══
const PAGE_TITLES={
  ov:['نظرة عامة','الملخص التنفيذي الشامل لأداء الشركة'],
  cl:['الجمعيات','تحليل أداء العملاء والربحية'],
  clients360:['الجمعيات ٣٦٠°','أداء الجمعيات وتكلفتها وتصنيفها ABC'],
  behavior:['سلوك الجمعيات','النمو والتعثر ودورة المشتريات والخمول'],
  mo:['التحليل الشهري','تطور المبيعات والتحصيل عبر الزمن'],
  ag:['المناديب','أداء فريق المبيعات والأهداف'],
  it:['الأصناف','ربحية المنتجات وحركة المخزون'],
  txTypes:['أنواع الحركات','تصنيف الحركات على حساب العميل (مدين/دائن)'],
  statement:['كشف الحساب','كشف حساب العميل التفصيلي مع كل الحركات'],
  agentStatement:['كشف حساب المندوب','مبيعات، تحصيل، عمولات مستحقة مع تفاصيل كل حركة'],
  invoice:['الفواتير','إنشاء وطباعة فواتير احترافية مع حفظ تلقائي وربط بالحركات'],
  co:['تكلفة الجمعية','التكلفة الحقيقية وتأثير الخصومات'],
  receivables:['التحصيل والمخاطر','التحصيل والذمم وأعمارها وتقييم المخاطر الائتمانية'],
  lg:['سجل المعاملات','الحركات التفصيلية مع البحث'],
  cp:['مقارنة الفترات','مقارنة الأداء بين فترتين زمنيتين'],
  fc:['التنبؤ','توقعات المبيعات للأشهر القادمة'],
  offers:['عروض الجمعيات','تصنيف الجمعيات والعروض المقترحة وحاسبة أثر الخصم'],
  decisions:['القرارات الاستراتيجية','المخاطر والفرص الحرجة مع توصيات تنفيذية آلية'],
  cycle:['دورة المشتريات','رادار الجمعيات الخاملة وإيقاع الشراء'],
  growth:['النمو والتعثر','كشف العملاء النامين والمتعثرين'],
  abc:['تحليل ABC','تصنيف باريتو للعملاء (80/20)'],
  al:['التنبيهات','الإنذارات والمؤشرات الحرجة'],
  action:['قرارات اليوم','التوصيات التنفيذية ذات الأولوية'],
  profitability:['الربحية وصافي الربح','قائمة الدخل الكاملة: من المبيعات إلى صافي الربح والربح النقدي'],
  strategic:['تحليلات استراتيجية','تآكل الربحية · مصفوفة BCG · أداء المناديب · إنذار الفقدان · سيناريوهات التنبؤ'],
  rentals:['القيم الإيجارية 🏠','عقود الإيجار: إجمالي القيمة · الخصومات · الصافي · الإيجابي']
};
function sw(id,el){
  CUR=id;
  document.querySelectorAll('.navpill').forEach(t=>t.classList.remove('on'));
  const navEl=el||document.querySelector('.navpill[data-pg="'+id+'"]');
  if(navEl){navEl.classList.add('on');
    try{navEl.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});}catch(e){}}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  const pg=$('p_'+id); if(pg) pg.classList.add('on');
  const t=PAGE_TITLES[id]||['',''];
  const tEl=$('pageTitle'), sEl=$('pageSub');
  if(tEl) tEl.textContent=t[0];
  if(sEl) sEl.textContent=t[1];
  window.scrollTo({top:0,behavior:'smooth'});
  draw(id);
}
function draw(id){
  const pg=$('p_'+id); if(!pg) return;
  // مسح رسوم الصفحة + رسوم الأقسام الفرعية في الصفحات المدمجة
  const chartPrefixes=id==='ov'?['ov_','act_','al_']:id==='receivables'?['tc_','credit_','aging_']:id==='profitability'?['prof_','cp_','exp_']:id==='clients360'?['cl_','co_','abc_']:id==='behavior'?['gr_','cyc_','growth_']:id==='strategic'?['leak_','bcg_','agtg_','chk_','churn_','fcs_']:[id+'_'];
  Object.keys(CH).filter(k=>chartPrefixes.some(p=>k.startsWith(p))).forEach(k=>{try{CH[k].destroy();}catch(e){}delete CH[k];});
  const S=D.soc||[], T=D.T||{}, M=O.ml, MT=D.mt||[], MC=D.mc||[];
  if(id==='ov') pageExecutive(pg,S,T,M,MT,MC);
  else if(id==='clients360') pageClients360(pg,S,T);
  else if(id==='mo') pageMO(pg,S,M,MT,MC);
  else if(id==='ag') pageAG(pg);
  else if(id==='it') pageIT(pg);
  else if(id==='txTypes') pageTxTypes(pg);
  else if(id==='behavior') pageBehavior(pg,S,T);
  else if(id==='receivables') pageReceivables(pg,S,T);
  else if(id==='lg') pageLG(pg);
  else if(id==='rentals') pageRentalValues(pg);
  else if(id==='cp') pageCP(pg);
  else if(id==='fc') pageFC(pg,M,MT);
  else if(id==='offers') pageOffers(pg,S,T);
  else if(id==='decisions') pageDecisions(pg,S,T);
  else if(id==='profitability') pageProfitability(pg,S,T);
  else if(id==='strategic') pageStrategic(pg,S,T);
  else if(id==='statement') pageStatement(pg,S,T);
  else if(id==='agentStatement') pageAgentStatement(pg);
  else if(id==='invoice') Invoice.pageInvoice(pg);
}

// ══════════ PAGES ══════════

// ════════════════════════════════════════════
// القيادة التنفيذية الموحّدة (دمج: نظرة عامة + قرارات اليوم + التنبيهات)
// ════════════════════════════════════════════
function pageExecutive(pg,S,T,M,MT,MC){
  pg.innerHTML=`
    <div class="quick-nav">
      <button class="qn-btn" onclick="scrollToSec('sec_ov')"><span>📊</span> نظرة عامة</button>
      <button class="qn-btn" onclick="scrollToSec('sec_action')"><span>⚡</span> قرارات اليوم</button>
      <button class="qn-btn" onclick="scrollToSec('sec_al')"><span>🔔</span> التنبيهات</button>
      <button class="qn-btn" onclick="scrollToSec('sec_kpi')"><span>📈</span> المؤشرات التنفيذية</button>
    </div>
    <div id="kpiExecutiveScorecard"></div>
    <div class="merge-sec" id="sec_kpi"><span class="merge-tag">📈 لوحة المؤشرات التنفيذية</span></div>
    <div id="sub_ov"></div>
    <div class="merge-sec" id="sec_action"><span class="merge-tag">⚡ قرارات اليوم</span></div>
    <div id="sub_action"></div>
    <div class="merge-sec" id="sec_al"><span class="merge-tag">🔔 التنبيهات والمؤشرات الحرجة</span></div>
    <div id="sub_al"></div>`;
  // وضع علامة قسم على بداية محتوى النظرة العامة (للتنقل السريع)
  const ovBox=document.getElementById('sub_ov'); ovBox.id='sub_ov';
  try {
    pageOV(ovBox,S,T,M,MT,MC);
    ovBox.setAttribute('id','sec_ov');
  } catch(e) { Logger.error('❌ pageOV:', e); ovBox.innerHTML='<div style="padding:40px;color:red">⚠️ خطأ في تحميل نظرة عامة: '+e.message+'</div>'; }
  try { pageAction(document.getElementById('sub_action'),S,T); } catch(e) { Logger.error('❌ pageAction:', e); }
  try { pageAL(document.getElementById('sub_al'),S); } catch(e) { Logger.error('❌ pageAL:', e); }
}
// ═══════════ لوحة الملخص التنفيذي الشاملة (تجمع كل التبويبات) ═══════════
// ═══════════ لوحة الملخص التنفيذي الشاملة (نسخة احترافية متقدمة) ═══════════
function gauge(pct,col,size){
  // حلقة تقدّم دائرية SVG — نصف قطر ثابت، شريط محيطي
  size=size||72;const r=size/2-6;const c=2*Math.PI*r;const off=c*(1-Math.max(0,Math.min(100,pct))/100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .9s ease"/>
  </svg>`;
}
function execSummaryHTML(S,T,M,MT,MC){
  // === حسابات (نفس المنطق المُتحقَّق منه) ===
  // 🆕 v220.1+ LOCKED: حساب الإشعارات الدائنة محلياً (آمن)
  let totalCN = 0;
  try { totalCN = (typeof recomputeCreditNotesAll === "function" ? recomputeCreditNotesAll() : 0) || 0; } catch(e) { Logger.error('CN err:', e); }
  try { if(T) T.cn = totalCN; } catch(e) { Logger.error('T.cn err:', e); }
  const mg=T.s>0?T.pr/T.s*100:0;
  // ── المصاريف: تُطابَق مع الفترة المعروضة (مبدأ المقابلة المحاسبي) ──
  // عند الفلترة نطرح مصاريف نفس الأشهر فقط، لا المصاريف السنوية الكاملة.
  const fa=(typeof _filterA==='number')?_filterA:0;
  const fb=(typeof _filterB==='number')?_filterB:(O.ml.length-1);
  const isFullP=(fa===0&&fb>=O.ml.length-1);
  let netExp=0;
  const expM=(O.expenses&&O.expenses.monthlyTotal)?O.expenses.monthlyTotal:null;
  if(expM){
    // اجمع مصاريف الأشهر ضمن النطاق المفلتر فقط
    for(let k=fa;k<=fb;k++){const mk=O.mk[k];if(mk&&expM[mk]!=null)netExp+=N(expM[mk]);}
  }else{
    netExp=(O.expenses&&O.expenses.totalAnnual)?O.expenses.totalAnnual:0;
  }
  const net=T.pr-netExp;
  const netMg=T.s>0?net/T.s*100:0;
  const recv=T.s-T.c-(totalCN||0);
  const collRate=T.s>0?T.c/T.s*100:0;
  const tg=S.reduce((a,s)=>a+N(s.g),0), td=S.reduce((a,s)=>a+N(s.d),0), tfv=S.reduce((a,s)=>a+N(s.fv),0), tret=S.reduce((a,s)=>a+N(s.ret),0);
  const sorted=S.slice().sort((a,b)=>b.s-a.s);
  const top3=sorted.slice(0,3).reduce((a,s)=>a+s.s,0);
  const conc=T.s>0?top3/T.s*100:0;
  const noCollect=S.filter(s=>s.rt===0&&s.s>0).length;
  const items=O.it||[];
  const topItem=items.slice().sort((a,b)=>N(b.pr)-N(a.pr))[0];
  // ── أعلى مندوب: من ملخص حركة المناديب الشهرية (agentSummary) — الأعلى محقّقاً ضمن الفترة المفلترة ──
  const _summ=O.agentSummary||[];
  const _rangeKeys=new Set();for(let k=fa;k<=fb;k++)if(O.mk[k])_rangeKeys.add(O.mk[k]);
  const _byAgent={};
  _summ.filter(r=>_rangeKeys.has(r.mk)).forEach(r=>{
    if(!_byAgent[r.agent])_byAgent[r.agent]={achieved:0,target:0};
    _byAgent[r.agent].achieved+=N(r.achieved);_byAgent[r.agent].target+=N(r.target);
  });
  const _agRows=Object.entries(_byAgent).map(([nm,v])=>({nm,achieved:v.achieved,target:v.target,pct:v.target>0?v.achieved/v.target*100:0})).sort((a,b)=>b.achieved-a.achieved);
  const topAg=_agRows[0]||null;                                                    // الأعلى محقّقاً بالقيمة
  const topAgPct=_agRows.filter(a=>a.target>0).slice().sort((a,b)=>b.pct-a.pct)[0]||null;  // الأعلى نسبة تحقيق
  const checks=O.checks||[];
  const chkTot=checks.reduce((a,c)=>a+N(c.cr),0);
  const chkPct=T.c>0?Math.min(100,chkTot/T.c*100):0;
  const leak=td+tfv;
  const leakPct=T.s>0?leak/T.s*100:0;
  const topSoc=sorted[0];
  const qty=S.reduce((a,s)=>a+N(s.q),0);
  // ألوان حالة
  const hue=(g,w,v,inv)=>{const x=inv?-v:v;const gg=inv?-g:g,ww=inv?-w:w;return x>=gg?'var(--grn)':x>=ww?'#e0902c':'var(--red)';};
  const collCol=hue(70,50,collRate), mgCol=hue(50,35,mg), concCol=hue(40,60,conc,true);
  // نسب تفكيك التكلفة
  const tco=T.co||1;
  const pG=tg/tco*100, pD=td/tco*100, pFv=tfv/tco*100;

  return `
  <div class="xboard">

    <!-- صف ١: بطاقة البطل + الحلقات -->
    <div class="xrow xrow-hero">
      <!-- بطاقة البطل: صافي الربح -->
      <div class="xhero">
        <div class="xhero-glow"></div>
        <div class="xhero-top">
          <span class="xhero-tag">صافي الربح</span>
          <span class="xhero-trend" style="color:${net>=0?'var(--grn)':'var(--red)'}">${net>=0?'▲ ربحية':'▼ خسارة'}</span>
        </div>
        <div class="xhero-val">${KD(net)}</div>
        <div class="xhero-sub">هامش صافٍ <b style="color:${net>=0?'var(--grn)':'var(--red)'}">${netMg.toFixed(1)}%</b> · من مبيعات ${KD(T.s)}</div>
        <div class="xhero-bar">
          <div class="xhero-seg" style="width:${T.s>0?T.co/T.s*100:0}%;background:linear-gradient(90deg,#cc7722,#e08e3c)" title="التكلفة"></div>
          <div class="xhero-seg" style="width:${T.s>0?netExp/T.s*100:0}%;background:linear-gradient(90deg,#a0397a,#c0508f)" title="المصاريف"></div>
          <div class="xhero-seg" style="width:${T.s>0?Math.max(0,net)/T.s*100:0}%;background:linear-gradient(90deg,#1e8449,#27ae60)" title="صافي الربح"></div>
        </div>
        <div class="xhero-legend">
          <span><i style="background:#cc7722"></i>تكلفة ${KD(T.co)}</span>
          <span><i style="background:#a0397a"></i>مصاريف ${KD(netExp)}</span>
          <span><i style="background:#1e8449"></i>صافي ${KD(net)}</span>
        </div>
      </div>

      <!-- ٣ حلقات: التحصيل · الهامش · التركّز -->
      <div class="xgauges">
        <div class="xgauge">
          <div class="xgauge-ring">${gauge(collRate,collCol)}<div class="xgauge-c" style="color:${collCol}">${collRate.toFixed(0)}%</div></div>
          <div class="xgauge-lbl">نسبة التحصيل</div>
          <div class="xgauge-sub">${KD(T.c)}</div>
        </div>
        <div class="xgauge">
          <div class="xgauge-ring">${gauge(mg,mgCol)}<div class="xgauge-c" style="color:${mgCol}">${mg.toFixed(0)}%</div></div>
          <div class="xgauge-lbl">هامش الربح</div>
          <div class="xgauge-sub">${KD(T.pr)}</div>
        </div>
        <div class="xgauge">
          <div class="xgauge-ring">${gauge(conc,concCol)}<div class="xgauge-c" style="color:${concCol}">${conc.toFixed(0)}%</div></div>
          <div class="xgauge-lbl">تركّز أكبر ٣</div>
          <div class="xgauge-sub">${conc<40?'موزّع':conc<60?'متوسط':'مرتفع'}</div>
        </div>
      </div>
    </div>

    <!-- صف ٢: أربع بطاقات تفصيلية -->
    <div class="xrow xrow-cards">
      <div class="xc xc-blue">
        <div class="xc-h"><span>💳</span> التحصيل والسيولة</div>
        <div class="xc-big" style="color:var(--blu)">${KD(T.c)}</div>
        <div class="xc-rows">
          <div><span>الذمم القائمة</span><b style="color:var(--red)">${KD(recv)}</b></div>
          <div><span>تحصيل بالشيكات</span><b style="color:var(--gd)">${KD(chkTot)}</b></div>
          <div><span>عدد الشيكات</span><b>${checks.length}</b></div>
        </div>
      </div>

      <!-- 🆕 v220.1+ LOCKED: بطاقة الإشعارات الدائنة -->
      <div class="xc xc-cyan" style="background:linear-gradient(135deg,#e8f4f8,#d6eaf3);border-left:4px solid #2980b9">
        <div class="xc-h"><span>📝</span> الإشعارات الدائنة</div>
        <div class="xc-big" style="color:#2980b9">${KD(totalCN)}</div>
        <div class="xc-rows">
          <div><span>عدد الإشعارات</span><b style="color:#2980b9">${window.__cnCount||((O.tx||[]).filter(t=>{const c=classifyTxForReceivables(t.tp||t.type);return c&&c.affects==='credit_notes'&&c.dir==='C';}).length)}</b></div>
          <div><span>تأثير على الذمم</span><b style="color:var(--red)">↓ تُخصم</b></div>
          <div><span>الذمم بدون إشعارات</span><b style="color:var(--tx3)">${KD(T.s-T.c)}</b></div>
        </div>
      </div>

      <div class="xc xc-orange">
        <div class="xc-h"><span>🧮</span> تفكيك التكلفة</div>
        <div class="xc-big" style="color:var(--red)">${KD(T.co)}</div>
        <div class="xc-stack">
          <div class="xc-stack-bar">
            <div style="width:${pG}%;background:#6b6354" title="البضاعة ${KD(tg)}"></div>
            <div style="width:${pD}%;background:#cc7722" title="الخصم ${KD(td)}"></div>
            <div style="width:${pFv}%;background:#7d4f9e" title="المجاني ${KD(tfv)}"></div>
          </div>
        </div>
        <div class="xc-rows">
          <div><span><i class="xdot" style="background:#6b6354"></i>البضاعة</span><b>${KD(tg)}</b></div>
          <div><span><i class="xdot" style="background:#cc7722"></i>الخصم المسموح</span><b style="color:var(--orn)">${KD(td)}</b></div>
          <div><span><i class="xdot" style="background:#7d4f9e"></i>المجاني</span><b style="color:var(--pur)">${KD(tfv)}</b></div>
        </div>
      </div>

      <div class="xc xc-red">
        <div class="xc-h"><span>🛡️</span> المخاطر والتركّز</div>
        <div class="xc-big" style="color:${leakPct>8?'var(--red)':leakPct>5?'var(--orn)':'var(--grn)'}">${leakPct.toFixed(1)}%</div>
        <div class="xc-big-sub">تآكل الربحية · ${KD(leak)}</div>
        <div class="xc-rows">
          <div><span>تركّز أكبر ٣</span><b style="color:${concCol}">${conc.toFixed(1)}%</b></div>
          <div><span>جمعيات بلا تحصيل</span><b style="color:${noCollect>0?'var(--red)':'var(--grn)'}">${noCollect}</b></div>
          <div><span>إجمالي الجمعيات</span><b style="color:var(--blu)">${S.length}</b></div>
        </div>
      </div>

      <div class="xc xc-gold">
        <div class="xc-h"><span>🏆</span> الأبرز أداءً</div>
        <div class="xc-rows xc-rows-top">
          <div><span>🏢 أعلى جمعية</span><b style="color:var(--gd)" title="${topSoc?topSoc.nm:''}">${topSoc?SN(topSoc.nm):'—'}</b></div>
          <div><span>👤 أعلى مندوب (قيمة)</span><b style="color:var(--pur)" title="${topAg?topAg.nm+' · محقق '+KD(topAg.achieved):'من ملخص حركة المناديب'}">${topAg?topAg.nm+' · '+KD(topAg.achieved):'—'}</b></div>
          <div><span>🎯 أعلى مندوب (نسبة)</span><b style="color:var(--cyan)" title="${topAgPct?topAgPct.nm+' · تحقيق '+topAgPct.pct.toFixed(0)+'%':'من ملخص حركة المناديب'}">${topAgPct?topAgPct.nm+' · '+topAgPct.pct.toFixed(0)+'%':'—'}</b></div>
          <div><span>📦 أعلى صنف ربحاً</span><b style="color:var(--grn)" title="${topItem?topItem.nm:''}">${topItem?SN(topItem.nm):'—'}</b></div>
          <div><span>⚖️ الكمية المباعة</span><b style="color:var(--blu)">${fmt(qty)}</b></div>
        </div>
      </div>
    </div>
  </div>`;
}


function pageOV(pg,S,T,M,MT,MC){
  const mg=T.s>0?(T.pr/T.s*100).toFixed(1):0;
  const cr=T.s>0?(T.c/T.s*100).toFixed(1):0;
  // 🆕 v220.1+: حساب الإشعارات الدائنة من O.tx
  let totalCN = 0;
  try { totalCN = recomputeCreditNotesAll() || 0; } catch(e) { Logger.error('❌ recomputeCreditNotesAll:', e); }
  try { T.cn = totalCN; } catch(e) { Logger.error('❌ T.cn assignment:', e); }
  // ── مؤشر DSO: أيام التحصيل المستحقة = (الذمم ÷ المبيعات السنوية) × 365 ──
  // يُحسب على أساس متوسط المبيعات اليومية عبر فترة النشاط الفعلية
  const activeMonths=(M&&M.length)?M.length:1;
  const receivables=T.s-T.c-totalCN;
  // 🛡️ FIX: استخدام TimeUtils.calculateDSO بدقة عالية (30.4375 يوم/شهر بدلاً من 30)
  const dso = TimeUtils.calculateDSO(receivables, T.s, activeMonths);
  const dsoColor=dso<=45?'var(--grn)':dso<=90?'#f39c12':'var(--red)';
  const dsoLabel=dso<=45?'تحصيل سريع':dso<=90?'مقبول':'بطء تحصيل — متابعة';
  // ── مؤشر تركّز المخاطر: نسبة المبيعات من أكبر ٣ جمعيات ──
  const sortedBySales=S.slice().sort((a,b)=>b.s-a.s);
  const top3Sales=sortedBySales.slice(0,3).reduce((t,s)=>t+s.s,0);
  const concentration=T.s>0?top3Sales/T.s*100:0;
  const concColor=concentration<40?'var(--grn)':concentration<60?'#f39c12':'var(--red)';
  const concLabel=concentration<40?'موزّع جيد':concentration<60?'تركّز متوسط':'تركّز مرتفع — خطر';
  pg.innerHTML=`
  <div class="pulse"><div class="pi">⚡</div><div>
    <div class="pt">الملخص التنفيذي</div>
    <div class="pd">مبيعات <b style="color:var(--gd)">${KD(T.s)}</b> · ربح <b style="color:var(--grn)">${KD(T.pr)}</b> (${mg}%) · تحصيل <b style="color:var(--blu)">${PC(cr)}</b> · إشعارات دائنة <b style="color:#2980b9">${KD(totalCN)}</b> · ذمم <b style="color:var(--red)">${KD(T.s-T.c-totalCN)}</b> · ${S.filter(s=>s.rt===0&&s.s>0).length} جمعية بدون تحصيل</div>
  </div></div>
  <div class="navgrid-title">⚡ الوصول السريع — انتقل لأي تحليل بنقرة</div>
  <div class="navgrid">
    ${[
      ['mo','📈','التحليل الشهري','المبيعات والتحصيل','#b8932f','rgba(184,147,47,.12)'],
      ['clients360','🏢','الجمعيات ٣٦٠°','الأداء والتكلفة وABC','#2563a8','rgba(37,99,168,.12)'],
      ['ag','👥','المناديب','أداء الفريق','#7d4f9e','rgba(125,79,158,.12)'],
      ['statement','📋','كشف الحساب','كشف حساب العميل','#2563a8','rgba(37,99,168,.12)'],
      ['it','📦','الأصناف','ربحية المنتجات','#1b8a8a','rgba(27,138,138,.12)'],
      ['behavior','🌱','سلوك الجمعيات','النمو ودورة الشراء','#1e8449','rgba(30,132,73,.12)'],
      ['receivables','💳','التحصيل والمخاطر','الذمم والائتمان والأعمار','#c0392b','rgba(192,57,43,.12)'],
      ['profitability','💰','الربحية وصافي الربح','قائمة الدخل الكاملة','#1e8449','rgba(30,132,73,.12)'],
      ['strategic','🎯','تحليلات استراتيجية','تآكل الربحية وBCG والتنبؤ','#cc7722','rgba(204,119,34,.12)'],
      ['fc','🔮','التنبؤ','توقعات المبيعات','#7d4f9e','rgba(125,79,158,.12)'],
      ['cp','⚖️','المقارنة','بين الفترات','#2563a8','rgba(37,99,168,.12)'],
      ['lg','📋','السجل','المعاملات','#6b6354','rgba(107,99,84,.12)'],
    ].map(([id,ic,lbl,sub,col,bg])=>`<div class="navtile" style="--tile-c:${col};--tile-bg:${bg}" onclick="sw('${id}')"><div class="navtile-ico">${ic}</div><div class="navtile-lbl">${lbl}</div><div class="navtile-sub">${sub}</div></div>`).join('')}
  </div>
  <div class="navgrid-title">📋 الملخص التنفيذي الشامل — كل البيانات في لمحة</div>
  ${execSummaryHTML(S,T,M,MT,MC)}
  <div class="g2">
    <div class="dc"><h3>📊 مبيعات الجمعيات</h3><canvas id="ov_1"></canvas></div>
    <div class="dc"><h3>📅 الاتجاه الشهري</h3><canvas id="ov_2"></canvas></div>
  </div>
  <div class="g2">
    <div class="dc"><h3>💳 المبيعات مقابل التحصيل</h3><canvas id="ov_3"></canvas></div>
    <div class="dc"><h3>🏆 أعلى الجمعيات</h3>${S.slice(0,8).map(s=>PB(SN(s.nm),s.s,S[0].s,'var(--gd)')).join('')}</div>
  </div>`;
  const lb=S.slice(0,12).map(s=>SN(s.nm));
  setTimeout(()=>{
    MK('ov_1',{type:'bar',data:{labels:lb,datasets:[{data:S.slice(0,12).map(s=>s.s),backgroundColor:'#b8932f',borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9},color:'#6a7a90'}}}}});
    MK('ov_2',{type:'line',data:{labels:M,datasets:[{label:'مبيعات',data:MT,borderColor:'#b8932f',backgroundColor:'rgba(184,147,47,.15)',fill:true,tension:.35,pointRadius:2},{label:'تحصيل',data:MC,borderColor:'#1e8449',backgroundColor:'rgba(30,132,73,.12)',fill:true,tension:.35,pointRadius:2}]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{ticks:{font:{size:9}}}}}});
    MK('ov_3',{type:'bar',data:{labels:lb,datasets:[{label:'مبيعات',data:S.slice(0,12).map(s=>s.s),backgroundColor:'rgba(26,39,68,.85)'},{label:'محصّل',data:S.slice(0,12).map(s=>s.c),backgroundColor:'#1e8449',borderRadius:3}]},options:{scales:{x:{ticks:{font:{size:9}}}}}});
  },30);
}

// ════════════════════════════════════════════
// الجمعيات ٣٦٠° الموحّدة (دمج: الجمعيات + التكلفة + تحليل ABC)
// ════════════════════════════════════════════
function pageClients360(pg,S,T){
  pg.innerHTML=`
    ${periodBadge()}
    <div class="quick-nav">
      <button class="qn-btn" onclick="scrollToSec('sec_cl')"><span>🏢</span> أداء الجمعيات</button>
      <button class="qn-btn" onclick="scrollToSec('sec_co')"><span>🧮</span> التكلفة والخصومات</button>
      <button class="qn-btn" onclick="scrollToSec('sec_abc')"><span>🎯</span> تصنيف ABC</button>
    </div>
    <div id="sub_cl"></div>
    <div class="merge-sec" id="sec_co"><span class="merge-tag">🧮 التكلفة الحقيقية وتأثير الخصومات</span></div>
    <div id="sub_co"></div>
    <div class="merge-sec" id="sec_abc"><span class="merge-tag">🎯 تصنيف ABC (باريتو 80/20)</span></div>
    <div id="sub_abc"></div>`;
  const clBox=document.getElementById('sub_cl');
  pageCL(clBox,S,T);
  clBox.setAttribute('id','sec_cl');
  pageCO(document.getElementById('sub_co'),S,T);
  pageABC(document.getElementById('sub_abc'),S,T);
}
function pageCL(pg,S,T){
  const isFiltered=S.length&&S[0].periodSales!==undefined&&!(_filterA===0&&_filterB>=O.ml.length-1);
  const totOut=S.reduce((a,s)=>a+(s.totOut!==undefined?s.totOut:(s.s-s.c)),0);
  pg.innerHTML=`
  <div class="kg">
    ${KC('عدد الجمعيات',S.length,'','var(--blu)')}
    ${KC('مبيعات الفترة',KD(T.s),isFiltered?'حسب الفلتر':'الكل','var(--gd)')}
    ${KC('إجمالي الكمية المباعة',fmt(S.reduce((a,s)=>a+(s.q||0),0)),'وحدة','var(--blu)')}
    ${KC('تحصيل الفترة',KD(T.c),'الشيكات المستلمة','var(--grn)')}
    ${KC('الذمم القائمة الكلية',KD(totOut),'الرصيد الفعلي المستحق','var(--red)')}
  </div>
  ${isFiltered?`<div class="ali yel" style="margin-bottom:16px"><span>ℹ️</span><div style="line-height:1.7"><b>عرض مفلتر:</b> "مبيعات الفترة" و"تحصيل الفترة" يخصّان الأشهر المختارة فقط. أما <b>الذمم القائمة الكلية</b> فهي الرصيد الفعلي المستحق على الجمعية من كامل تعاملها (لا يتجزأ بفترة). نسبة التحصيل هنا = تحصيل الفترة ÷ مبيعات الفترة، وقد تتجاوز 100% إذا وصلت شيكات لفواتير قديمة.</div></div>`:''}
  <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-bottom:14px">
    <button onclick="openCoopModal()" style="background:linear-gradient(135deg,#2563a8,#1a4480);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit">➕ إضافة جمعية</button>
    <button onclick="openTxModal()" style="background:linear-gradient(135deg,#c0392b,#922b21);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit">💸 إضافة حركة</button>
  </div>
  ${(()=>{const tg=S.reduce((a,s)=>a+(s.g||0),0),td=S.reduce((a,s)=>a+(s.d||0),0),tfv=S.reduce((a,s)=>a+(s.fv||0),0),tretVal=S.reduce((a,s)=>a+(s.retVal||0),0),tco=tg+td+tfv;return `
  <div class="dc" style="margin-bottom:16px"><h3>🧮 تفكيك التكلفة الحقيقية (من واقع ملف Excel)</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px">
      <div style="text-align:center;padding:12px;background:rgba(107,99,84,.08);border-radius:12px"><div style="font-size:11px;color:var(--tx3)">COGS (تكلفة البضاعة)</div><div style="font-size:20px;font-weight:900;color:var(--tx2)">${KD(tg)}</div><div style="font-size:11px;color:var(--tx3)">${PC(tco?tg/tco*100:0)} من التكلفة</div></div>
      <div style="text-align:center;padding:12px;background:rgba(204,119,34,.08);border-radius:12px"><div style="font-size:11px;color:var(--tx3)">تكلفة الخصم المسموح</div><div style="font-size:20px;font-weight:900;color:var(--orn)">${KD(td)}</div><div style="font-size:11px;color:var(--tx3)">${PC(tco?td/tco*100:0)} من التكلفة</div></div>
      <div style="text-align:center;padding:12px;background:rgba(125,79,158,.08);border-radius:12px"><div style="font-size:11px;color:var(--tx3)">تكلفة البضاعة المجانية</div><div style="font-size:20px;font-weight:900;color:var(--pur)">${KD(tfv)}</div><div style="font-size:11px;color:var(--tx3)">${PC(tco?tfv/tco*100:0)} من التكلفة</div></div>
      <div style="text-align:center;padding:12px;background:rgba(192,57,43,.08);border-radius:12px;border:1px solid rgba(192,57,43,.2)"><div style="font-size:11px;color:var(--tx3)">التكلفة الحقيقية الكلية</div><div style="font-size:20px;font-weight:900;color:var(--red)">${KD(tco)}</div><div style="font-size:11px;color:var(--tx3)">COGS + خصم + مجاني</div></div>
      <div style="text-align:center;padding:12px;background:rgba(30,132,73,.08);border-radius:12px;border:1px solid rgba(30,132,73,.2)"><div style="font-size:11px;color:var(--tx3)">مرتجعات المبيعات (تُخصم من المبيعات)</div><div style="font-size:20px;font-weight:900;color:var(--grn)">−${KD(tretVal)}</div><div style="font-size:11px;color:var(--tx3)">تخفّض صافي المبيعات</div></div>
    </div>
    <div style="font-size:12px;color:var(--tx3);margin-top:12px;line-height:1.7">💡 <b>منهجية الحساب (تدقيق):</b> التكلفة الحقيقية = تكلفة البضاعة المباعة (الكمية × تكلفة الوحدة) + الخصم المسموح + قيمة البضاعة المجانية بسعر التكلفة. <b>مرتجعات المبيعات</b> تُعامَل كبند خصم من إجمالي المبيعات (مثل الخصم والمجاني من حيث أثرها على الربح) للوصول إلى <b>صافي المبيعات</b> = إجمالي المبيعات − المرتجعات. مجمل الربح = صافي المبيعات − التكلفة الحقيقية.</div>
  </div>`;})()}
  ${TB(S,[
    ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
    ['المندوب',r=>r.ag?`<span class="bd bb">${r.ag}</span>`:'—'],
    ['مبيعات الفترة',r=>`<b style="color:var(--gd)">${KD(r.s)}</b>`],
    ['الكمية المباعة',r=>`<span style="color:var(--blu)">${fmt(r.q||0)}</span>`],
    ['COGS (ت.البضاعة)',r=>`<span style="color:var(--tx2)">${KD(r.g||0)}</span>`],
    ['تكلفة الخصم',r=>{const d=r.d||0;return d>0?`<span style="color:var(--orn)">${KD(d)}</span>`:'<span style="color:var(--tx3)">—</span>'}],
    ['تكلفة المجاني',r=>{const fv=r.fv||0;return fv>0?`<span style="color:var(--pur)">${KD(fv)}</span>`:'<span style="color:var(--tx3)">—</span>'}],
    ['التكلفة الكلية',r=>`<b style="color:var(--red)">${KD(r.co)}</b>`],
    ['الربح',r=>`<span style="color:var(--grn)">${KD(r.pr)}</span>`],
    ['الهامش',r=>PC(r.s?r.pr/r.s*100:0)],
    ['تحصيل الفترة',r=>KD(r.c)],
    ['نسبة التحصيل',r=>{const p=r.rt||0;return`<span class="bd ${p>=70?'bg':p>=40?'by':'br'}">${PC(p)}</span>`}],
    ['الذمم الكلية',r=>{const o=r.totOut!==undefined?r.totOut:r.ot;return`<span style="color:${o>0?'var(--red)':'var(--grn)'}">${KD(o)}</span>`}],
    ['آخر فاتورة',r=>displayDate(r.li)],
    ['الفواتير',r=>r.inv||0],
    ['إجراءات',r=>`<button onclick="openCoopModal('${(r.nm||'').replace(/'/g,"\\'")}')" title="تعديل" style="background:#f39c12;color:#fff;border:none;padding:4px 9px;border-radius:4px;cursor:pointer;font-size:11px;margin-left:3px;font-family:inherit">✏️</button><button onclick="confirmDeleteCoop('${(r.nm||'').replace(/'/g,"\\'")}')" title="حذف" style="background:#c0392b;color:#fff;border:none;padding:4px 9px;border-radius:4px;cursor:pointer;font-size:11px;font-family:inherit">🗑️</button>`],
  ])}`;
}

function pageMO(pg,S,M,MT,MC){
  const bi=MT.indexOf(Math.max(...MT.filter(v=>v>0)));
  const av=MT.filter(v=>v>0).reduce((a,b)=>a+b,0)/Math.max(MT.filter(v=>v>0).length,1);
  const MON=D.mon||O.mon;
  const totSales=MT.reduce((a,b)=>a+b,0);
  const totColl=MC.reduce((a,b)=>a+b,0);
  const netFlow=totColl-totSales;
  pg.innerHTML=`
  <div class="kg">
    ${KC('إجمالي المبيعات',KD(totSales),M.length+' شهر','var(--gd)')}
    ${KC('متوسط شهري',KD(av),'للأشهر النشطة','var(--blu)')}
    ${KC('أعلى شهر',M[bi]||'—',KD(MT[bi]||0),'var(--grn)')}
    ${KC('إجمالي التحصيل',KD(totColl),'مبالغ الشيكات المستلمة','#1abc9c')}
  </div>
  <div class="ali yel" style="margin-bottom:18px"><span>ℹ️</span><div style="line-height:1.7">
    <b>ملاحظة محاسبية:</b> التحصيل يُسجّل في شهر <b>استلام الشيك</b>، وقد يسدّد فواتير من أشهر سابقة. لذلك قد يتجاوز تحصيل شهرٍ مبيعاته (شيكات قديمة وصلت)، أو يقلّ عنها (فواتير لم تُحصّل بعد). للحكم الصحيح على كفاءة التحصيل، انظر <b>النسبة التراكمية</b> أدناه لا الشهرية المتقطّعة.
  </div></div>
  <div class="dc"><h3>📈 المبيعات والتحصيل الشهري</h3><canvas id="mo_1" height="90"></canvas></div>
  <div class="dc"><h3>📊 المبيعات الشهرية لكل جمعية</h3>
    <div class="tw"><table><thead><tr><th>الجمعية</th>${M.map(m=>`<th>${m}</th>`).join('')}<th>الإجمالي</th></tr></thead><tbody>
    ${MON.filter(mr=>{const s=S.find(x=>x.nm===mr.nm);return s&&s.s>0;}).map(mr=>{
      const s=S.find(x=>x.nm===mr.nm)||{s:0};
      return`<tr><td><b>${SN(mr.nm)}</b></td>${mr.v.map(v=>`<td style="color:${v>0?'var(--gd)':'var(--tx3)'}">${v>0?fmt(v):'—'}</td>`).join('')}<td style="color:var(--gd);font-weight:700">${KD(s.s)}</td></tr>`;
    }).join('')}
    <tr style="background:#0a1e38;font-weight:700"><td>الإجمالي</td>${MT.map(v=>`<td style="color:var(--gd2)">${v>0?fmt(v):'—'}</td>`).join('')}<td style="color:var(--gd2)">${KD(MT.reduce((a,b)=>a+b,0))}</td></tr>
    </tbody></table></div>
  </div>
  <div class="dc"><h3>💳 المبيعات مقابل التحصيل (تراكمي ونسبة صحيحة)</h3>
    <div class="tw"><table><thead><tr><th>الشهر</th><th>مبيعات الشهر</th><th>تحصيل الشهر</th><th>صافي التدفق</th><th>مبيعات تراكمية</th><th>تحصيل تراكمي</th><th>نسبة التحصيل التراكمية</th></tr></thead><tbody>
    ${(()=>{let cs=0,cc=0;return M.map((m,k)=>{cs+=MT[k]||0;cc+=MC[k]||0;const net=(MC[k]||0)-(MT[k]||0);const cumRate=cs>0?cc/cs*100:0;return`<tr><td><b>${m}</b></td><td style="color:var(--gd)">${MT[k]>0?fmt(MT[k]):'—'}</td><td style="color:#1abc9c">${MC[k]>0?fmt(MC[k]):'—'}</td><td style="color:${net>=0?'var(--grn)':'var(--red)'}">${net>=0?'+':''}${fmt(net)}</td><td>${fmt(cs)}</td><td>${fmt(cc)}</td><td><span class="bd ${cumRate>=70?'bg':cumRate>=40?'by':'br'}">${cumRate.toFixed(1)}%</span></td></tr>`;}).join('');})()}
    </tbody></table></div>
    <div style="font-size:12px;color:var(--tx3);margin-top:10px">صافي التدفق = تحصيل الشهر − مبيعات الشهر. القيمة الموجبة تعني تحصيل ديون قديمة، والسالبة تعني بيع آجل جديد. النسبة التراكمية هي المقياس الصحيح لكفاءة التحصيل عبر الفترة.</div>
  </div>`;
  setTimeout(()=>MK('mo_1',{type:'bar',data:{labels:M,datasets:[{type:'bar',label:'مبيعات',data:MT,backgroundColor:'rgba(184,147,47,.75)',borderRadius:3},{type:'line',label:'تحصيل',data:MC,borderColor:'#1e8449',backgroundColor:'transparent',tension:.4,pointRadius:3}]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{ticks:{font:{size:9}}}}}}),30);
}


function pageAG(pg){
  const AG=D.ag||[];
  const isFiltered=!(_filterA===0&&_filterB>=O.ml.length-1);
  if(!AG.length){
    pg.innerHTML=`
    <div style="text-align:center;padding:36px 20px;border:2px dashed var(--gold-soft);border-radius:12px;background:var(--surf2);color:var(--tx2);max-width:600px;margin:0 auto">
      <div style="font-size:48px;margin-bottom:12px">👥</div>
      <h4 style="margin:0 0 8px;color:var(--gd)">لا توجد بيانات مناديب بعد</h4>
      <p style="margin:0 0 16px;font-size:13.5px">ابدأ بإضافة مناديبك من الزر أدناه، أو ارفع ملف Excel.</p>
      <button onclick="openAgentModal()" style="background:linear-gradient(135deg,#7d4f9e,#5b3578);color:#fff;border:none;padding:10px 22px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13.5px;font-family:inherit">➕ إضافة مندوب</button>
    </div>`;
    return;
  }
  const tS=AG.reduce((a,x)=>a+x.s,0),tC=AG.reduce((a,x)=>a+x.c,0);
  const tTg=AG.reduce((a,x)=>a+(x.tg||0),0);
  const tDiff=tS-tTg;
  pg.innerHTML=`
  ${periodBadge()}
  ${isFiltered?`<div class="ali yel" style="margin-bottom:16px"><span>ℹ️</span><div>يظهر المندوب الحقيقي للجمعية حتى لو لم تكن له مبيعات في الفترة المختارة (مبيعاته تظهر صفراً).</div></div>`:''}
  <div class="kg">
    ${KC('مبيعات الفريق',KD(tS),AG.length+' مناديب','var(--gd)')}
    ${KC('تارجت الفريق',tTg>0?KD(tTg):'بلا هدف',tTg>0?'للفترة المختارة':'','var(--blu)')}
    ${KC(tDiff>=0?'الفائض':'العجز',tTg>0?KD(Math.abs(tDiff)):'—',tTg>0?(tDiff>=0?'▲ تجاوز الهدف':'▼ دون الهدف'):'',tDiff>=0?'var(--grn)':'var(--red)')}
    ${KC('نسبة الإنجاز',tTg>0?PC(tS/tTg*100):'—','للفريق','var(--pur)')}
  </div>
  <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-bottom:14px">
    <button onclick="openAgentModal()" style="background:linear-gradient(135deg,#7d4f9e,#5b3578);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit">➕ إضافة مندوب</button>
  </div>
  <div class="g2">
    <div class="dc"><h3>مساهمة المناديب</h3><canvas id="ag_1"></canvas></div>
    <div class="dc"><h3>الاتجاه الشهري للمناديب</h3><canvas id="ag_2"></canvas></div>
  </div>
  ${(()=>{
    // ── جدولا حركة المندوب من شيت الإكسل (A:H تفصيلي، J:P ملخص) مع فلترة بالتاريخ ──
    const mov=O.agentMovement||[], summ=O.agentSummary||[];
    if(!mov.length&&!summ.length)return '';
    // مفاتيح الأشهر ضمن الفترة المختارة
    const keys=O.mk||[]; const activeKeys=new Set();
    for(let k=_filterA;k<=_filterB;k++){if(keys[k])activeKeys.add(keys[k]);}
    const inRange=mk=>activeKeys.size===0||!mk||activeKeys.has(mk);
    const MLBL={'01':'يناير','02':'فبراير','03':'مارس','04':'أبريل','05':'مايو','06':'يونيو','07':'يوليو','08':'أغسطس','09':'سبتمبر','10':'أكتوبر','11':'نوفمبر','12':'ديسمبر'};
    const mlbl=mk=>{if(!mk)return '—';const[y,m]=mk.split('-');return (MLBL[m]||m)+' '+(y||'');};
    const pctBadge=p=>{const c=p>=100?'bg':p>=70?'by':'br';return`<span class="bd ${c}">${PC(p)}</span>`;};
    // فلترة + ترتيب بالشهر ثم المندوب (لإبراز ربط كل مندوب خلال الفترة)
    const fMov=mov.filter(r=>inRange(r.mk)).sort((a,b)=>(a.mk||'').localeCompare(b.mk||'')||a.agent.localeCompare(b.agent)||(b.achieved-a.achieved));
    const fSumm=summ.filter(r=>inRange(r.mk)&&r.agent).sort((a,b)=>(a.mk||'').localeCompare(b.mk||'')||a.agent.localeCompare(b.agent));
    // ── إصلاح جذري 2026: دمج الجدولين في جدول واحد موحد ──
    // المشكلة: الجدولان منفصلان فيظهران في قسميّن منفصلين، فيخفي أحدهما ما يعرضه الآخر.
    // الحل: ندمج كل سجلات agentSummary و agentMovement في جدول موحد،
    //      ثم نلغي أي سجلات في agentMovement موجودة في agentSummary لنفس (شهر، مندوب).
    const unifiedRows=[];
    const summKeys=new Set();
    fSumm.forEach(r=>{
      const key=(r.mk||'')+'|'+(r.agent||'');
      summKeys.add(key);
      unifiedRows.push({...r,_origin:'summary',_key:key});
    });
    fMov.forEach(r=>{
      const key=(r.mk||'')+'|'+(r.agent||'');
      if(summKeys.has(key))return; // مكررة مع ملخص — تجاهل
      unifiedRows.push({
        mk:r.mk,agent:r.agent,
        target:+r.target||0,achieved:+r.achieved||0,
        remaining:+r.remaining||0,surplus:+r.surplus||0,
        pct:+r.pct||0,
        _origin:'movement',_key:key
      });
    });
    unifiedRows.sort((a,b)=>(a.mk||'').localeCompare(b.mk||'')||a.agent.localeCompare(b.agent));
    // ── ملء أي شهر مفقود في fSumm من agentMovement التفصيلي ──
    // يحل مشكلة: لو agentSummary يفتقد سجلات لشهر معيّن (مثل مايو أو يونيو)
    // فيُنشئ سجلاً بديلاً مُجمَّعاً من الحركة التفصيلية.
    try{
      const have=new Set(fSumm.map(r=>r.mk+'|'+r.agent));
      const agents=new Set(fMov.map(r=>r.agent));
      agents.forEach(ag=>{
        activeKeys.forEach(mk=>{
          if(have.has(mk+'|'+ag))return;
          const recs=fMov.filter(r=>r.mk===mk&&r.agent===ag);
          if(!recs.length)return;
          const tg=recs.reduce((t,r)=>t+(+r.target||0),0);
          const ac=recs.reduce((t,r)=>t+(+r.achieved||0),0);
          fSumm.push({mk,agent:ag,target:+tg.toFixed(2),achieved:+ac.toFixed(2),
            remaining:+Math.max(0,tg-ac).toFixed(2),
            surplus:+Math.max(0,ac-tg).toFixed(2),
            pct:tg>0?+(ac/tg*100).toFixed(2):0});
        });
      });
      fSumm.sort((a,b)=>(a.mk||'').localeCompare(b.mk||'')||a.agent.localeCompare(b.agent));
    }catch(e){Logger.warn('fillMissingSummaryMonths:',e);}
    // كشف الازدواج: جمعية مرتبطة بأكثر من مندوب في نفس الشهر
    const linkMap={}; fMov.forEach(r=>{const k=r.mk+'|'+r.soc;(linkMap[k]=linkMap[k]||new Set()).add(r.agent);});
    const dupKeys=new Set(Object.keys(linkMap).filter(k=>linkMap[k].size>1));
    const isDup=r=>dupKeys.has(r.mk+'|'+r.soc);
    // إجماليات
    const movTot=fMov.reduce((t,r)=>({target:t.target+r.target,achieved:t.achieved+r.achieved}),{target:0,achieved:0});
    const summTot=fSumm.reduce((t,r)=>({target:t.target+r.target,achieved:t.achieved+r.achieved}),{target:0,achieved:0});
    // ── النطاق الفعلي لبيانات حركة المناديب في الإكسل (مفاتيح الأشهر الموجودة فعلاً) ──
    const movMonthKeys=[...new Set([...mov,...summ].map(r=>r.mk).filter(Boolean))].sort();
    const dataFirst=movMonthKeys[0], dataLast=movMonthKeys[movMonthKeys.length-1];
    const isFiltered=!(_filterA===0&&_filterB>=(O.ml.length-1));
    // تنبيه احترافي: الفترة المختارة لا تتقاطع مع نطاق بيانات الحركة المتاحة
    let html='';
    if(!fMov.length&&!fSumm.length){
      // لا حركة في الفترة المختارة — وضّح السبب الحقيقي بدل الاختفاء الصامت
      html+=`<div class="dc" style="border-right:3px solid var(--blu)"><div style="display:flex;gap:10px;align-items:flex-start">
        <span style="font-size:20px">📅</span><div>
        <div style="font-weight:800;color:var(--blu);margin-bottom:4px">جدول حركة المناديب غير متاح للفترة المختارة</div>
        <div style="font-size:12.5px;color:var(--tx2);line-height:1.9">
          شيت «المناديب» في ملف Excel يسجّل حركة الأهداف والمحقق لكل مندوب×جمعية ضمن فترة محددة فقط:
          <b style="color:var(--gd)">${dataFirst?mlbl(dataFirst):'—'} ← ${dataLast?mlbl(dataLast):'—'}</b>
          (${movMonthKeys.length} ${movMonthKeys.length===1?'شهر':'أشهر'}).<br>
          الفترة التي اخترتها <b>${O.ml[_filterA]} ← ${O.ml[_filterB]}</b> تقع خارج هذا النطاق، لذلك لا توجد سجلات حركة لعرضها — وهذا مطابق لبياناتك الفعلية وليس خطأً.<br>
          <span style="color:var(--tx3)">ملاحظة: مبيعات المناديب الإجمالية أعلى الصفحة مستمدة من سجل المعاملات (HANY1) وتغطي كل الفترات، أما جدول الحركة التفصيلي فمصدره شيت «المناديب» المحدود بالفترة أعلاه. لإظهار جداول الحركة اختر فترة تشمل ${dataFirst?mlbl(dataFirst):''} حتى ${dataLast?mlbl(dataLast):''}.</span>
        </div>
        </div></div></div>`;
      return html;
    }
    // إذا كان الفلتر نشطاً ويعرض جزءاً فقط من نطاق الحركة — تنويه خفيف
    if(isFiltered&&(fMov.length||fSumm.length)){
      html+=`<div class="ali" style="margin-bottom:14px;background:rgba(37,99,168,.07);border-color:rgba(37,99,168,.2)"><span>📅</span><div style="font-size:12px;line-height:1.7">جداول الحركة أدناه تعرض الفترة المختارة <b style="color:var(--gd)">${O.ml[_filterA]} ← ${O.ml[_filterB]}</b> فقط. النطاق الكامل لبيانات حركة المناديب في ملفك: <b>${dataFirst?mlbl(dataFirst):'—'} ← ${dataLast?mlbl(dataLast):'—'}</b>.</div></div>`;
    }
    // تنبيه ازدواج إن وُجد
    if(dupKeys.size){
      html+=`<div class="dc" style="border-right:3px solid var(--red)"><div style="display:flex;gap:10px;align-items:flex-start">
        <span style="font-size:20px">🔎</span><div>
        <div style="font-weight:800;color:var(--red);margin-bottom:4px">تنبيه تدقيقي: ازدواج في تسجيل المندوب</div>
        <div style="font-size:12.5px;color:var(--tx2);line-height:1.8">${dupKeys.size} حالة: نفس الجمعية مسجّلة لأكثر من مندوب في نفس الشهر داخل شيت المناديب. الداشبورد يعرض السجلات كما هي في ملفك (مميّزة بعلامة ⚠️ في الجدول أدناه). راجِع هذه الحالات في Excel للتأكد من صحة الإسناد.</div>
        </div></div></div>`;
    }
    // ── الجدول الموحد الجديد: يدمج الملخص الشهري مع الحركة التفصيلية ──
    // يحلّ مشكلة: لو الجدولان منفصلان في شيت الإكسل (ملخص يفقد شهر، تفصيلي يفقد شهر آخر)
    // الجدول الموحد يضمن ظهور كل الأشهر بشكل متكامل بدون انقسام.
    if(unifiedRows.length){
      const uniTot=unifiedRows.reduce((t,r)=>({target:t.target+(+r.target||0),achieved:t.achieved+(+r.achieved||0)}),{target:0,achieved:0});
      html+=`<div class="dc"><h3>🎯 الحركة الشهرية للمناديب (مدمجة: ملخص + تفصيلي)</h3>
        <div class="pd" style="margin-bottom:10px">هذا الجدول يدمج بيانات الملخص الشهري (J:P) والحركة التفصيلية (A:H) من شيت المناديب — لذا تظهر كل الأشهر بشكل موحّد. ${unifiedRows.length} سجل ضمن الفترة المختارة.</div>
        ${TB(unifiedRows,[
          ['الشهر',r=>`<span style="white-space:nowrap">${mlbl(r.mk)}</span>`],
          ['المندوب',r=>`<b>${r.agent}</b>`],
          ['المصدر',r=>`<span class="bd ${r._origin==='summary'?'bb':'by'}" style="font-size:10px">${r._origin==='summary'?'ملخص':'تفصيلي'}</span>`],
          ['الهدف',r=>KD(r.target)],
          ['المحقق',r=>`<span style="color:var(--gd)">${KD(r.achieved)}</span>`],
          ['المتبقي',r=>r.remaining>0?`<span style="color:var(--red)">${KD(r.remaining)}</span>`:'—'],
          ['الفائض',r=>r.surplus>0?`<span style="color:var(--grn)">${KD(r.surplus)}</span>`:'—'],
          ['النسبة',r=>pctBadge(r.pct)],
        ])}
        <div class="exp-tot">الإجمالي: الهدف ${KD(uniTot.target)} · المحقق <span style="color:var(--gd)">${KD(uniTot.achieved)}</span> · نسبة التحقيق ${pctBadge(uniTot.target>0?uniTot.achieved/uniTot.target*100:0)}</div>
      </div>`;
    }
    // جدول الملخص الشهري (J:P)
    if(fSumm.length){
      html+=`<div class="dc"><h3>📒 ملخص حركة المندوب الشهري (من شيت المناديب)</h3>
        <div class="pd" style="margin-bottom:10px">القيم الفعلية المسجّلة في ملف Excel — الهدف الشهري الإجمالي لكل مندوب مقابل المحقق ونسبة التحقق، مرتبطة بالتاريخ الفعلي. ${fSumm.length} سجل ضمن الفترة المختارة.</div>
        ${TB(fSumm,[
          ['الشهر',r=>`<span style="white-space:nowrap">${mlbl(r.mk)}</span>`],
          ['المندوب',r=>`<b>${r.agent}</b>`],
          ['الهدف الشهري',r=>KD(r.target)],
          ['المحقق',r=>`<span style="color:var(--gd)">${KD(r.achieved)}</span>`],
          ['المتبقي',r=>r.remaining>0?`<span style="color:var(--red)">${KD(r.remaining)}</span>`:'—'],
          ['الفائض',r=>r.surplus>0?`<span style="color:var(--grn)">${KD(r.surplus)}</span>`:'—'],
          ['نسبة التحقق',r=>pctBadge(r.pct)],
        ])}
        <div class="exp-tot">الإجمالي: الهدف ${KD(summTot.target)} · المحقق <span style="color:var(--gd)">${KD(summTot.achieved)}</span> · نسبة التحقق ${pctBadge(summTot.target>0?summTot.achieved/summTot.target*100:0)}</div>
      </div>`;
    }
    // جدول الحركة التفصيلية (A:H)
    if(fMov.length){
      html+=`<div class="dc"><h3>🗂️ الحركة الشهرية التفصيلية: المندوب × الجمعية (من شيت المناديب)</h3>
        <div class="pd" style="margin-bottom:10px">القيم الفعلية المسجّلة في ملف Excel — أداء كل مندوب في كل جمعية على حدة بالتاريخ الفعلي: الهدف والمحقق ونسبة التحقيق. مرتّبة بالشهر ثم المندوب. ${fMov.length} سجل ضمن الفترة المختارة.</div>
        ${TB(fMov,[
          ['الشهر',r=>`<span style="white-space:nowrap">${mlbl(r.mk)}</span>`],
          ['المندوب',r=>`<b>${r.agent}</b>`],
          ['الجمعية',r=>`<span title="${r.soc}">${SN(r.soc)}${isDup(r)?' <span title="مسجّلة لأكثر من مندوب هذا الشهر" style="color:var(--red)">⚠️</span>':''}</span>`],
          ['الهدف',r=>KD(r.target)],
          ['المحقق',r=>`<span style="color:var(--gd)">${KD(r.achieved)}</span>`],
          ['المتبقي',r=>r.remaining>0?`<span style="color:var(--red)">${KD(r.remaining)}</span>`:'—'],
          ['الفائض',r=>r.surplus>0?`<span style="color:var(--grn)">${KD(r.surplus)}</span>`:'—'],
          ['النسبة',r=>pctBadge(r.pct)],
        ])}
        <div class="exp-tot">الإجمالي: الهدف ${KD(movTot.target)} · المحقق <span style="color:var(--gd)">${KD(movTot.achieved)}</span> · نسبة التحقيق ${pctBadge(movTot.target>0?movTot.achieved/movTot.target*100:0)}</div>
      </div>`;
    }
    return html;
  })()}
  <div class="dc"><h3>🎯 جدول حركة المندوب خلال الفترة (المبيعات · التارجت · المحقق · الفائض/العجز · النسبة)</h3>
    ${(()=>{const totTg=AG.reduce((a,x)=>a+(x.tg||0),0),totAc=AG.reduce((a,x)=>a+(x.s||0),0),totDiff=totAc-totTg;
    return `<div class="ali ${totDiff>=0?'grn':'red'}" style="margin-bottom:14px"><span>${totDiff>=0?'📈':'📉'}</span><div style="line-height:1.7">
      <b>إجمالي الفريق:</b> التارجت ${KD(totTg)} · المحقق ${KD(totAc)} · ${totDiff>=0?'<b style="color:var(--grn)">فائض</b>':'<b style="color:var(--red)">عجز</b>'} ${KD(Math.abs(totDiff))} · نسبة الإنجاز ${PC(totTg>0?totAc/totTg*100:0)}
      ${totTg===0?'<br><span style="color:var(--tx3)">⚠️ لا يوجد تارجت محدد للفترة المختارة (التارجت متاح من يناير 2026)</span>':''}
    </div></div>`;})()}
    ${TB(AG,[
      ['المندوب',r=>`<b>${r.nm}</b>`],
      ['الجمعيات',r=>`<span class="bd bb">${r.sc||0}</span>`],
      ['المبيعات (المحقق)',r=>`<b style="color:var(--gd)">${KD(r.s)}</b>`],
      ['التارجت',r=>r.tg>0?KD(r.tg):'<span style="color:var(--tx3)">—</span>'],
      ['الفائض / العجز',r=>{if(!r.tg)return'<span style="color:var(--tx3)">—</span>';const d=r.diff!==undefined?r.diff:(r.s-r.tg);return`<b style="color:${d>=0?'var(--grn)':'var(--red)'}">${d>=0?'▲ +':'▼ '}${KD(Math.abs(d))}</b>`}],
      ['نسبة الإنجاز',r=>{if(!r.tg)return'<span style="color:var(--tx3)">—</span>';const p=r.achPct!==undefined?r.achPct:(r.tg>0?r.s/r.tg*100:0);return`<span class="bd ${p>=100?'bg':p>=80?'by':'br'}">${PC(p)}</span>`}],
      ['التحصيل',r=>KD(r.c)],
      ['نسبة التحصيل',r=>{const p=r.rt||0;return`<span class="bd ${p>=70?'bg':p>=40?'by':'br'}">${PC(p)}</span>`}],
      ['التقييم',r=>{if(!r.tg)return'<span class="bd bb">بلا هدف</span>';const p=r.tg>0?r.s/r.tg*100:0;return p>=100?'<span class="bd bg">🏆 متجاوز</span>':p>=80?'<span class="bd by">✓ قريب</span>':p>=50?'<span class="bd by">⚠️ متأخر</span>':'<span class="bd br">⛔ ضعيف</span>'}],
      ['إجراءات',r=>`<button onclick="openAgentModal('${(r.nm||'').replace(/'/g,"\\'")}')" title="تعديل" style="background:#f39c12;color:#fff;border:none;padding:4px 9px;border-radius:4px;cursor:pointer;font-size:11px;margin-left:3px;font-family:inherit">✏️</button><button onclick="confirmDeleteAgent('${(r.nm||'').replace(/'/g,"\\'")}')" title="حذف" style="background:#c0392b;color:#fff;border:none;padding:4px 9px;border-radius:4px;cursor:pointer;font-size:11px;font-family:inherit">🗑️</button>`],
    ])}
  </div>
  <div class="dc"><h3>📊 الفائض / العجز لكل مندوب</h3><canvas id="ag_3" height="80"></canvas></div>

  <div class="stitle">① جودة المبيعات — الكفاءة والمحفظة والتحصيل النسبي</div>
  <div class="dc"><h3>🎯 كفاءة المندوب وعمق المحفظة</h3>
    <div class="pd" style="margin-bottom:14px">الكمية ليست كل شيء: متوسط الفاتورة يقيس قوة البيع، والمبيعات لكل جمعية تقيس عمق الاختراق، وتوزيع ABC يكشف جودة المحفظة.</div>
    ${TB(AG.map(a=>({...a,ds:agentDeepStats(a)})),[
      ['المندوب',r=>`<b>${r.nm}</b>`],
      ['عدد الجمعيات',r=>`<span class="bd bb">${r.ds.count}</span>`],
      ['متوسط الفاتورة',r=>KD(r.ds.avgInvoice)],
      ['عدد الفواتير',r=>fmt(r.ds.totInv)],
      ['مبيعات/جمعية',r=>`<span style="color:var(--gd)">${KD(r.ds.salesPerSoc)}</span>`],
      ['جمعيات A',r=>r.ds.aCount?`<span class="bd bg">${r.ds.aCount}</span>`:'—'],
      ['جمعيات B',r=>r.ds.bCount?`<span class="bd by">${r.ds.bCount}</span>`:'—'],
      ['جمعيات C',r=>r.ds.cCount?`<span class="bd br">${r.ds.cCount}</span>`:'—'],
      ['نوع المحفظة',r=>{const a=r.ds.aCount,n=r.ds.count;if(n>0&&a/n>=0.4)return'<span class="bd bg">عميقة (جمعيات كبيرة)</span>';if(n>=8)return'<span class="bd bb">واسعة (انتشار)</span>';return'<span class="bd by">متوازنة</span>';}],
    ])}
  </div>
  <div class="dc"><h3>💰 جودة التحصيل والربحية النسبية</h3>
    <div class="pd" style="margin-bottom:14px">مندوب بمبيعات عالية وتحصيل ضعيف يبني ذمماً خطرة. والربح أهم من المبيعات — مندوب يبيع أقل بهامش أعلى قد يكون أنفع للشركة.</div>
    ${(()=>{const avgColl=AG.reduce((a,x)=>a+agentDeepStats(x).collRate,0)/Math.max(AG.length,1);return TB(AG.map(a=>({...a,ds:agentDeepStats(a)})),[
      ['المندوب',r=>`<b>${r.nm}</b>`],
      ['المبيعات',r=>`<span style="color:var(--gd)">${KD(r.ds.totSales)}</span>`],
      ['الربح',r=>`<span style="color:var(--grn)">${KD(r.ds.totProfit)}</span>`],
      ['هامش الربح',r=>{const m=r.ds.profitMargin;return`<span class="bd ${m>=58?'bg':m>=50?'by':'br'}">${PC(m)}</span>`}],
      ['التحصيل',r=>KD(r.ds.totColl)],
      ['نسبة التحصيل',r=>{const p=r.ds.collRate;return`<span class="bd ${p>=70?'bg':p>=50?'by':'br'}">${PC(p)}</span>`}],
      ['مقابل المتوسط',r=>{const d=r.ds.collRate-avgColl;return`<span style="color:${d>=0?'var(--grn)':'var(--red)'}">${d>=0?'▲ +':'▼ '}${PC(Math.abs(d))}</span>`}],
      ['الذمم المبنية',r=>`<span style="color:var(--red)">${KD(r.ds.totOut)}</span>`],
    ]);})()}
  </div>

  <div class="stitle">② الاتجاه والثبات — هل المندوب في صعود؟ وهل يُعتمد عليه؟</div>
  <div class="g2">
    <div class="dc"><h3>📈 اتجاه أداء المناديب (Momentum)</h3>
      ${AG.map(a=>{const m=agentMomentum(a);const c=m.dir==='صاعد'?'grn':m.dir==='هابط'?'red':'yel';const ic=m.dir==='صاعد'?'▲':m.dir==='هابط'?'▼':'▬';return `<div class="ali ${c}"><span>${ic}</span><div><b>${a.nm}</b> — ${m.dir} ${m.pct>=0?'+':''}${m.pct.toFixed(1)}% <span style="color:var(--tx3)">(آخر 3 أشهر ${KD(m.recent)} مقابل ${KD(m.prev)})</span></div></div>`;}).join('')}
    </div>
    <div class="dc"><h3>⚖️ ثبات الأداء (Consistency)</h3>
      ${AG.map(a=>{const cn=agentConsistency(a);const col=cn.score>=70?'#1e8449':cn.score>=45?'#b8932f':'#c0392b';return `<div class="pb"><div class="pbn">${a.nm}</div><div class="pbt"><div class="pbf" style="width:${cn.score}%;background:${col}"></div></div><div class="pbv">${cn.score} (${cn.level})</div></div>`;}).join('')}
      <div style="font-size:12px;color:var(--tx3);margin-top:10px">كلما علت النقاط، كان أداء المندوب أكثر ثباتاً وأسهل في التخطيط والتنبؤ.</div>
    </div>
  </div>
  <div class="dc"><h3>🔥 خريطة الأداء الشهرية (مبيعات كل مندوب لكل شهر)</h3>
    <div class="tw"><table><thead><tr><th>المندوب</th>${O.ml.map(m=>`<th>${m}</th>`).join('')}</tr></thead><tbody>
    ${AG.map(a=>{const sv=a.sv||[];const mx=Math.max(...sv,1);return `<tr><td><b>${a.nm}</b></td>${sv.map(v=>{const intensity=v/mx;const bg=v<=0?'transparent':`rgba(30,132,73,${(0.15+intensity*0.65).toFixed(2)})`;return `<td style="background:${bg};text-align:center;color:${intensity>0.5?'#fff':'var(--tx2)'};font-weight:${v>0?'700':'400'}">${v>0?fmt(v):'—'}</td>`;}).join('')}</tr>`;}).join('')}
    </tbody></table></div>
    <div style="font-size:12px;color:var(--tx3);margin-top:10px">كلما اشتد اللون الأخضر، علت مبيعات ذلك الشهر. تكشف الخريطة الأنماط الموسمية ومن يتعثر باستمرار.</div>
  </div>

  <div class="stitle">③ النمو التسويقي — الاكتساب والفقدان والاختراق</div>
  <div class="dc"><h3>🌱 اكتساب وفقدان الجمعيات</h3>
    <div class="pd" style="margin-bottom:14px">النمو الحقيقي = اكتساب جمعيات جديدة + الحفاظ على النشطة. الجمعيات المتوقفة خسارة صامتة تحتاج تدخلاً.</div>
    ${TB(AG.map(a=>({...a,acq:agentAcquisition(a)})),[
      ['المندوب',r=>`<b>${r.nm}</b>`],
      ['إجمالي الجمعيات',r=>r.acq.total],
      ['نشطة',r=>`<span class="bd bg">${r.acq.active}</span>`],
      ['متباطئة',r=>r.acq.slowing?`<span class="bd by">${r.acq.slowing}</span>`:'—'],
      ['متوقفة (مفقودة)',r=>r.acq.lost?`<span class="bd br">${r.acq.lost}</span>`:'<span class="bd bg">0</span>'],
      ['جديدة نسبياً',r=>r.acq.newly?`<span class="bd bb">${r.acq.newly}</span>`:'—'],
      ['معدل النشاط',r=>{const p=r.acq.total>0?r.acq.active/r.acq.total*100:0;return`<span class="bd ${p>=80?'bg':p>=60?'by':'br'}">${PC(p)}</span>`}],
      ['التوصية',r=>{if(r.acq.lost>=2)return'<span style="color:var(--red)">⚡ إعادة تنشيط عاجلة</span>';if(r.acq.slowing>=2)return'<span style="color:#cc7722">👁️ متابعة المتباطئة</span>';return'<span style="color:var(--grn)">✅ محفظة صحية</span>';}],
    ])}
  </div>

  <div class="stitle">④ بطاقة التقييم الشاملة — القرار الإداري لكل مندوب</div>
  <div class="dc"><h3>🏅 بطاقة الأداء المركّبة (Scorecard)</h3>
    <div class="pd" style="margin-bottom:14px">نقاط مركّبة: الإنجاز 30% + التحصيل 25% + النمو 20% + الثبات 15% + الربحية 10% → تصنيف نهائي وتوصية إدارية.</div>
    ${AG.map(a=>{const sc=agentScorecard(a);const b=sc.breakdown;return `
    <div class="dc" style="margin-bottom:14px;border-right:4px solid ${sc.color};background:var(--surf2)">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px">
        <div style="font-size:34px;font-weight:900;color:${sc.color};line-height:1">${sc.total}</div>
        <div style="flex:1;min-width:160px">
          <div style="font-size:16px;font-weight:900;color:${sc.color}">${a.nm} — ${sc.rank}</div>
          <div style="font-size:12.5px;color:var(--tx2);margin-top:3px">${sc.advice}</div>
        </div>
        <div style="text-align:left;font-size:12px;color:var(--tx3)">
          مبيعات ${KD(sc.stats.totSales)} · ربح ${KD(sc.stats.totProfit)}<br>${sc.stats.count} جمعية · ${sc.mom.dir}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
        ${[['الإنجاز',b.achievement,30],['التحصيل',b.collection,25],['النمو',b.growth,20],['الثبات',b.consistency,15],['الربحية',b.profitability,10]].map(([lbl,val,mx])=>`<div style="background:var(--surf);border:1px solid var(--line);border-radius:8px;padding:8px;text-align:center"><div style="font-size:10.5px;color:var(--tx3)">${lbl}</div><div style="font-size:17px;font-weight:800;color:var(--gold,var(--gd))">${val}<span style="font-size:11px;color:var(--tx3)">/${mx}</span></div></div>`).join('')}
      </div>
    </div>`;}).join('')}
  </div>
  `;
  const M=O.ml;
  setTimeout(()=>{
    MK('ag_1',{type:'doughnut',data:{labels:AG.map(a=>a.nm),datasets:[{data:AG.map(a=>a.s),backgroundColor:PAL}]},options:{plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}});
    MK('ag_2',{type:'line',data:{labels:M,datasets:AG.map((a,i)=>({label:a.nm,data:a.sv||[],borderColor:PAL[i%PAL.length],backgroundColor:'transparent',tension:.35,pointRadius:2}))},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{ticks:{font:{size:9}}}}}});
    // رسم الفائض/العجز
    const hasTgt=AG.some(a=>a.tg>0);
    if(hasTgt){
      MK('ag_3',{type:'bar',data:{labels:AG.map(a=>a.nm),datasets:[
        {label:'المحقق',data:AG.map(a=>a.s),backgroundColor:'rgba(184,147,47,.75)',borderRadius:3},
        {label:'التارجت',data:AG.map(a=>a.tg||0),backgroundColor:'rgba(26,39,68,.55)',borderRadius:3},
        {label:'الفائض/العجز',data:AG.map(a=>a.diff!==undefined?a.diff:(a.s-(a.tg||0))),backgroundColor:AG.map(a=>{const d=a.diff!==undefined?a.diff:(a.s-(a.tg||0));return d>=0?'rgba(30,132,73,.75)':'rgba(192,57,43,.75)';}),borderRadius:3}
      ]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{ticks:{font:{size:10}}}}}});
    } else {
      const el=$('ag_3');if(el)el.parentNode.innerHTML='<p style="color:var(--tx3);text-align:center;padding:20px;font-size:13px">⚠️ لا يوجد تارجت محدد للفترة المختارة. التارجت متاح من يناير 2026 — اختر فترة تشمل أشهر 2026.</p>';
    }
  },30);
}

function pageIT(pg){
  // 🆕 v220.1+ DYNAMIC: استخدم O.it مباشرة (مصدر الحقيقة) مع اعتبار الفلتر
  // إذا الفلتر على "كامل الفترة" نعرض كل الأصناف
  const fa=(typeof _filterA!=='undefined')?_filterA:0;
  const fb=(typeof _filterB!=='undefined')?_filterB:((O.ml?.length||1)-1);
  const isAll=fa===0&&fb>=(O.ml?.length||1)-1;
  let IT = (D.it && D.it.length > 0) ? D.it : (O.it || []);
  // إذا الفلتر نشط، حاول فلترة حسب فترة الأشهر (fallback إلى O.im لو متوفر)
  if(!isAll && O.im && Object.keys(O.im).length > 0 && O.ml){
    const filtered = (O.it||[]).filter(it => {
      const im = O.im[it.cd];
      if(!im) return true; // بدون بيانات شهرية، يبقى ظاهر
      // تحقق من وجود أي نشاط في الفترة المختارة
      for(let k=fa;k<=fb;k++){
        if((im.sv && im.sv[k] && im.sv[k] > 0) || (im.qv && im.qv[k] && im.qv[k] > 0)) return true;
      }
      return false;
    });
    if(filtered.length > 0) IT = filtered;
  }
  const tS=IT.reduce((a,x)=>a+(x.ns||0),0),tP=IT.reduce((a,x)=>a+(x.pr||0),0);
  pg.innerHTML=`
  ${periodBadge()}
  <div class="kg">
    ${KC('عدد الأصناف',IT.length,'','var(--pur)')}
    ${KC('صافي المبيعات',KD(tS),'','var(--gd)')}
    ${KC('إجمالي الربح',KD(tP),PC(tS?tP/tS*100:0)+' هامش','var(--grn)')}
    ${KC('المتبقي',fmt(IT.reduce((a,x)=>a+(x.rm||0),0)),'وحدة','var(--blu)')}
  </div>
  <div class="g2">
    <div class="dc"><h3>صافي مبيعات كل صنف</h3><canvas id="it_1"></canvas></div>
    <div class="dc"><h3>مساهمة كل صنف في الربح</h3><canvas id="it_2"></canvas></div>
  </div>
  <div class="dc">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <h3 style="margin:0">📦 دليل الأصناف</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="openItemModal()" style="background:linear-gradient(135deg,#1e8449,#27ae60);color:#fff;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;box-shadow:0 3px 8px rgba(30,132,73,.3);font-family:inherit">➕ إضافة صنف</button>
        <button onclick="exportItemsCSV()" style="background:#7f8c8d;color:#fff;border:none;padding:9px 14px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit">⬇️ تصدير CSV</button>
      </div>
    </div>
    ${IT.length===0 ? `
      <div style="text-align:center;padding:36px 20px;border:2px dashed var(--gold-soft);border-radius:12px;background:var(--surf2);color:var(--tx2)">
        <div style="font-size:48px;margin-bottom:12px">📦</div>
        <h4 style="margin:0 0 8px;color:var(--gd)">لا توجد أصناف بعد</h4>
        <p style="margin:0 0 16px;font-size:13.5px">ابدأ بإضافة أصنافك من زر <b>«➕ إضافة صنف»</b> أعلاه، أو ارفع ملف Excel.</p>
      </div>
    ` : TB(IT,[
      ['الكود',r=>`<span style="font-family:monospace;color:var(--tx2)">${r.cd||'—'}</span>`],
      ['الصنف',r=>`<b>${r.nm||'—'}</b>`],
      ['التكلفة',r=>(r.uc||0).toFixed(3)],
      ['السعر',r=>(r.up||0).toFixed(3)],
      ['المباع',r=>fmt(r.sl||0)],
      ['المتبقي',r=>fmt(r.rm||0)],
      ['صافي المبيعات',r=>`<span style="color:var(--gd);font-weight:700">${KD(r.ns||0)}</span>`],
      ['COGS',r=>KD(r.g||0)],
      ['الربح',r=>`<span style="color:var(--grn);font-weight:700">${KD(r.pr||0)}</span>`],
      ['الهامش',r=>PC((r.ns||0)>0?(r.pr||0)/(r.ns||1)*100:0)],
      ['إجراءات',r=>`
        <button onclick="openItemModal('${(r.cd||'').replace(/'/g,"\\'")}')" title="تعديل" style="background:#f39c12;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;margin-left:4px;font-family:inherit">✏️</button>
        <button onclick="duplicateItem('${(r.cd||'').replace(/'/g,"\\'")}')" title="تكرار" style="background:#3498db;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;margin-left:4px;font-family:inherit">📋</button>
        <button onclick="confirmDeleteItem('${(r.cd||'').replace(/'/g,"\\'")}')" title="حذف" style="background:#c0392b;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit">🗑️</button>
      `],
    ])}
  </div>`;
  setTimeout(()=>{
    MK('it_1',{type:'bar',data:{labels:IT.map(i=>i.cd||i.nm.slice(0,10)),datasets:[{data:IT.map(i=>i.ns||0),backgroundColor:'#b8932f',borderRadius:4}]},options:{plugins:{legend:{display:false}}}});
    MK('it_2',{type:'doughnut',data:{labels:IT.map(i=>i.cd+': '+i.nm.slice(0,12)),datasets:[{data:IT.map(i=>i.pr||0),backgroundColor:PAL}]},options:{plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}});
  },30);
}

// ═════════════════════════════════════════════════════════════════════════
// 🆕 v220.1+ DYNAMIC ITEMS — نظام CRUD يدوي للأصناف (تلقائي + ديناميكي)
// ═════════════════════════════════════════════════════════════════════════

function openItemModal(cdOrNull) {
  const isEdit = !!cdOrNull;
  const item = isEdit ? O.it.find(x => x.cd === cdOrNull) : null;
  
  // تنظيف مودال سابق إن وُجد
  const existing = document.getElementById('itemModal');
  if (existing) existing.remove();
  
  const cdVal = item?.cd || '';
  const nmVal = item?.nm || '';
  const ucVal = item?.uc ?? '';
  const upVal = item?.up ?? '';
  const slVal = item?.sl ?? '';
  const rmVal = item?.rm ?? '';
  const nsVal = item?.ns ?? '';
  const gVal  = item?.g  ?? '';
  const prVal = item?.pr ?? '';
  const dcVal = item?.dc ?? '';
  
  const modal = document.createElement('div');
  modal.id = 'itemModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,30,56,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:0;max-width:680px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="background:linear-gradient(135deg,#1b8a8a,#0d6868);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:17px">${isEdit ? '✏️ تعديل صنف' : '➕ إضافة صنف جديد'}</h3>
        <button onclick="document.getElementById('itemModal').remove()" style="background:rgba(255,255,255,.2);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
      </div>
      <div style="padding:24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الكود *</span>
            <input id="iCd" type="text" value="${cdVal.replace(/"/g,'&quot;')}" ${isEdit?'readonly style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;background:#eceff1;color:#607d8b;font-family:monospace"':'style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:monospace"'} placeholder="مثال: RZ01">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">اسم الصنف *</span>
            <input id="iNm" type="text" value="${nmVal.replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="مثال: أرز بسمتي 5كجم">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">تكلفة الوحدة (د.ك)</span>
            <input id="iUc" type="number" step="0.001" min="0" value="${ucVal}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="0.000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">سعر البيع (د.ك)</span>
            <input id="iUp" type="number" step="0.001" min="0" value="${upVal}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="0.000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الكمية المباعة</span>
            <input id="iSl" type="number" step="0.1" min="0" value="${slVal}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="0">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الكمية المتبقية</span>
            <input id="iRm" type="number" step="0.1" min="0" value="${rmVal}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="0">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">صافي المبيعات (د.ك) *</span>
            <input id="iNs" type="number" step="0.001" min="0" value="${nsVal}" style="width:100%;padding:9px;border:2px solid #1b8a8a;border-radius:7px;background:#f0fafa;font-weight:700" placeholder="0.000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">COGS — تكلفة المباع (د.ك)</span>
            <input id="iG" type="number" step="0.001" min="0" value="${gVal}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="0.000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الربح (د.ك) <span style="color:#90a4ae;font-weight:400;font-size:11px">— يُحسب تلقائي</span></span>
            <input id="iPr" type="number" step="0.001" value="${prVal}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;background:#f5f5f5" placeholder="0.000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الخصم (د.ك)</span>
            <input id="iDc" type="number" step="0.001" min="0" value="${dcVal}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="0.000">
          </label>
        </div>
        <div style="background:linear-gradient(135deg,#fff8e1,#fff3cd);border-right:4px solid #f39c12;padding:12px 16px;border-radius:7px;margin-top:18px;font-size:12.5px;color:#5d4037;line-height:1.7">
          💡 <b>تلميح:</b> صافي المبيعات (<code>ns</code>) لازم يكون أكبر من 0 — هذا اللي يخلي الصنف يظهر في الداشبورد.
          ${isEdit ? '<br>📝 الكود ثابت في التعديل.' : '<br>📝 الكود لازم يكون فريد — ما يتكرر بين الأصناف.'}
          <br>⚡ الحفظ تلقائي ويتحدث في كل الشاشات فوراً.
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
          <button onclick="document.getElementById('itemModal').remove()" style="padding:10px 22px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إلغاء</button>
          ${isEdit ? `<button onclick="confirmDeleteItem('${cdVal.replace(/'/g,"\\'")}')" style="padding:10px 22px;background:#c0392b;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;margin-left:auto">🗑️ حذف</button>` : ''}
          <button onclick="saveItem(${isEdit ? `'${cdVal.replace(/'/g,"\\'")}'` : 'null'})" style="padding:10px 26px;background:linear-gradient(135deg,#1b8a8a,#0d6868);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13.5px">💾 ${isEdit ? 'حفظ التعديل' : 'إضافة الصنف'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Auto-compute profit when ns or g changes
  const $ns = document.getElementById('iNs');
  const $g  = document.getElementById('iG');
  const $pr = document.getElementById('iPr');
  function autoProfit() {
    const ns = parseFloat($ns.value) || 0;
    const g  = parseFloat($g.value)  || 0;
    // احسب الربح تلقائياً دائماً (إلا إذا المستخدم كتبه يدوياً)
    $pr.value = (ns - g).toFixed(3);
  }
  $ns.addEventListener('input', autoProfit);
  $g.addEventListener('input', autoProfit);
  
  // اضغط Enter للحفظ السريع
  modal.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveItem(isEdit ? cdVal : null);
    }
  });
  
  // focus على أول حقل فاضي
  setTimeout(() => {
    const firstInput = isEdit ? document.getElementById('iNm') : document.getElementById('iCd');
    if (firstInput) firstInput.focus();
  }, 50);
}

function saveItem(originalCd) {
  const isEdit = !!originalCd;
  const cd = (document.getElementById('iCd').value || '').trim();
  const nm = (document.getElementById('iNm').value || '').trim();
  const uc = parseFloat(document.getElementById('iUc').value) || 0;
  const up = parseFloat(document.getElementById('iUp').value) || 0;
  const sl = parseFloat(document.getElementById('iSl').value) || 0;
  const rm = parseFloat(document.getElementById('iRm').value) || 0;
  const ns = parseFloat(document.getElementById('iNs').value) || 0;
  const g  = parseFloat(document.getElementById('iG').value)  || 0;
  const pr = parseFloat(document.getElementById('iPr').value) || (ns - g);
  const dc = parseFloat(document.getElementById('iDc').value) || 0;
  
  // تحقق من المدخلات
  if (!cd) { showToast('خطأ', 'يرجى إدخال كود الصنف', false); document.getElementById('iCd').focus(); return; }
  if (!nm) { showToast('خطأ', 'يرجى إدخال اسم الصنف', false); document.getElementById('iNm').focus(); return; }
  if (ns <= 0) { showToast('خطأ', 'صافي المبيعات لازم يكون أكبر من صفر', false); document.getElementById('iNs').focus(); return; }
  
  const item = {
    cd,
    nm,
    uc: +uc.toFixed(3),
    up: +up.toFixed(3),
    sl: +sl.toFixed(1),
    rm: +rm.toFixed(1),
    ns: +ns.toFixed(2),
    g:  +g.toFixed(2),
    pr: +pr.toFixed(2),
    dc: +dc.toFixed(2),
  };
  
  // ضمان وجود O.it
  if (!Array.isArray(O.it)) O.it = [];
  if (!O.im || typeof O.im !== 'object') O.im = {};
  
  if (isEdit) {
    const idx = O.it.findIndex(x => x.cd === originalCd);
    if (idx >= 0) O.it[idx] = item;
    else O.it.push(item);
    // تحديث im — إذا تغيّر الكود، انقل السجل
    if (originalCd !== cd && O.im[originalCd]) {
      O.im[cd] = { ...O.im[originalCd], nm };
      delete O.im[originalCd];
    } else {
      if (!O.im[cd]) O.im[cd] = { nm, sv: {}, qv: {}, cv: {} };
      else O.im[cd].nm = nm;
    }
    showToast('✅ تم التعديل', `تم تحديث الصنف: ${nm}`, true);
  } else {
    if (O.it.some(x => x.cd === cd)) {
      showToast('خطأ', `كود "${cd}" موجود مسبقاً — استخدم كود آخر`, false);
      document.getElementById('iCd').focus();
      return;
    }
    O.it.push(item);
    if (!O.im[cd]) O.im[cd] = { nm, sv: {}, qv: {}, cv: {} };
    showToast('✅ تمت الإضافة', `تمت إضافة الصنف: ${nm}`, true);
  }
  
  // حفظ → إعادة حساب → إعادة رسم
  try { nayefSaveData(); } catch(e) { Logger.warn('saveData:', e); }
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) { Logger.warn('recompute:', e); }
  
  document.getElementById('itemModal')?.remove();
  
  // 🆕 v220.1+ DYNAMIC: أعد حساب D ليتزامن مع O
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) { Logger.warn('recompute:', e); }
  
  // أعد الرسم على الصفحة الحالية + الصفحات المرتبطة
  try { draw('it'); } catch(e) { Logger.warn('draw it:', e); }
  // حدّث الكاشات في الصفحات الأخرى عند عودتها (لا نرسم الكل هنا لأسباب أداء)
  
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log(isEdit ? 'item_edit' : 'item_add', { cd, nm, ns }); } catch(e) {}
  }
}

function confirmDeleteItem(cd) {
  const item = O.it.find(x => x.cd === cd);
  if (!item) { showToast('خطأ', 'الصنف غير موجود', false); return; }
  if (!confirm(`هل تريد حذف الصنف "${item.nm}" (${cd})؟\n\nهذا الإجراء نهائي ويُحذف من كل الداشبورد.`)) return;
  deleteItem(cd);
}

function deleteItem(cd) {
  const item = O.it.find(x => x.cd === cd);
  if (!item) return;
  O.it = O.it.filter(x => x.cd !== cd);
  if (O.im && O.im[cd]) delete O.im[cd];
  
  try { nayefSaveData(); } catch(e) { Logger.warn('saveData:', e); }
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) { Logger.warn('recompute:', e); }
  
  document.getElementById('itemModal')?.remove();
  
  // 🆕 v220.1+ DYNAMIC: أعد حساب D
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) { Logger.warn('recompute:', e); }
  
  try { draw('it'); } catch(e) { Logger.warn('draw it:', e); }
  showToast('🗑️ تم الحذف', `تم حذف الصنف: ${item.nm}`, true);
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('item_delete', { cd, nm: item.nm }); } catch(e) {}
  }
}

function duplicateItem(cd) {
  const src = O.it.find(x => x.cd === cd);
  if (!src) { showToast('خطأ', 'الصنف غير موجود', false); return; }
  // ولّد كود فريد
  let newCd = cd + '-CPY';
  let i = 1;
  while (O.it.some(x => x.cd === newCd)) { i++; newCd = cd + '-CPY' + i; }
  const copy = JSON.parse(JSON.stringify(src));
  copy.cd = newCd;
  copy.nm = (src.nm || '') + ' (نسخة)';
  O.it.push(copy);
  if (!O.im[newCd]) O.im[newCd] = { nm: copy.nm, sv: {}, qv: {}, cv: {} };
  
  try { nayefSaveData(); } catch(e) {}
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) {}
  
  // أعد الرسم على الصفحة الحالية
  try { draw('it'); } catch(e) {}
  showToast('📋 تم النسخ', `تم تكرار الصنف بكود: ${newCd}`, true);
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('item_duplicate', { from: cd, to: newCd }); } catch(e) {}
  }
}

function exportItemsCSV() {
  if (!O.it || !O.it.length) {
    showToast('تنبيه', 'لا توجد أصناف لتصديرها', false);
    return;
  }
  const headers = ['الكود','الصنف','التكلفة','السعر','المباع','المتبقي','صافي المبيعات','COGS','الربح','الخصم'];
  const rows = O.it.map(r => [
    r.cd||'', r.nm||'', r.uc||0, r.up||0, r.sl||0, r.rm||0, r.ns||0, r.g||0, r.pr||0, r.dc||0
  ]);
  // BOM لتعرف Excel على UTF-8
  let csv = '\uFEFF' + headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => {
      const s = String(cell);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(',') + '\n';
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `الأصناف_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇️ تم التصدير', `تم تنزيل ${O.it.length} صنف بصيغة CSV`, true);
}

// ═════════════════════════════════════════════════════════════════════════
// 🆕 v220.3+ DYNAMIC: نظام المعاملات اليدوي على حساب العميل
// ═════════════════════════════════════════════════════════════════════════

let _editTxId = null;

function openTxModal(preset) {
  // تنظيف أي مودال سابق
  const existing = document.getElementById('txModal');
  if (existing) existing.remove();
  
  const today = new Date().toISOString().slice(0, 10);
  const types = (typeof getTxTypes === 'function') ? getTxTypes() : [];
  const clients = O.soc || [];
  
  // preset: {client, type, dt, amount} للاختصارات السريعة
  preset = preset || {};
  
  const modal = document.createElement('div');
  modal.id = 'txModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,30,56,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:0;max-width:680px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="background:linear-gradient(135deg,#c0392b,#922b21);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:17px">💸 إضافة حركة على حساب العميل</h3>
        <button onclick="document.getElementById('txModal').remove()" style="background:rgba(255,255,255,.2);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
      </div>
      <div style="padding:24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <label style="display:flex;flex-direction:column;gap:5px;grid-column:span 2">
            <span style="font-size:12px;color:#37474f;font-weight:700">العميل / الجمعية *</span>
            <select id="txClient" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit">
              <option value="">— اختر العميل —</option>
              ${clients.map(c => `<option value="${(c.nm||'').replace(/"/g,'&quot;')}" ${preset.client===c.nm?'selected':''}>${c.nm}</option>`).join('')}
            </select>
            ${clients.length === 0 ? '<span style="font-size:11px;color:#e74c3c">⚠️ أضف عميل أولاً من صفحة الجمعيات</span>' : ''}
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">نوع الحركة *</span>
            <select id="txType" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit">
              ${types.map(t => `<option value="${(t.code||t.id||'').replace(/"/g,'&quot;')}" dir="${t.dir}" ${preset.type===t.code?'selected':''}>${t.icon||''} ${t.label} (${t.dir==='D'?'مدين':'دائن'})</option>`).join('')}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">التاريخ *</span>
            <input id="txDate" type="date" value="${preset.dt || today}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">المبلغ (د.ك) *</span>
            <input id="txAmount" type="number" step="0.001" min="0" value="${preset.amount || ''}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-weight:700;font-size:15px" placeholder="0.000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">رقم الفاتورة / المرجع</span>
            <input id="txInvoice" type="text" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="اختياري">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">المندوب</span>
            <select id="txAgent" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit">
              <option value="">— غير محدد —</option>
              ${(O.ag||[]).map(a => `<option value="${(a.nm||'').replace(/"/g,'&quot;')}">${a.nm}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الصنف (اختياري)</span>
            <select id="txItem" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit">
              <option value="">— بدون —</option>
              ${(O.it||[]).map(it => `<option value="${(it.cd||'').replace(/"/g,'&quot;')}">${it.cd} - ${it.nm}</option>`).join('')}
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الكمية</span>
            <input id="txQty" type="number" step="0.1" min="0" value="1" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="1">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px;grid-column:span 2">
            <span style="font-size:12px;color:#37474f;font-weight:700">ملاحظات</span>
            <textarea id="txNotes" rows="2" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit;resize:vertical" placeholder="اختياري"></textarea>
          </label>
        </div>
        <div id="txBalancePreview" style="background:linear-gradient(135deg,#e8f4fd,#d6eaf8);border-right:4px solid #2563a8;padding:12px 16px;border-radius:7px;margin-top:18px;font-size:12.5px;color:#1a4480;line-height:1.7;display:none">
          <b>الرصيد الحالي للعميل:</b> <span id="txCurrentBalance">—</span>
        </div>
        <div style="background:linear-gradient(135deg,#fff8e1,#fff3cd);border-right:4px solid #f39c12;padding:12px 16px;border-radius:7px;margin-top:12px;font-size:12.5px;color:#5d4037;line-height:1.7">
          💡 <b>ملاحظة:</b> الحركة تُحفظ في السجل وتُحدّث رصيد العميل تلقائياً. نوع <b>مدين</b> يزيد الذمم، نوع <b>دائن</b> ينقصها (مثل التحصيل).
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
          <button onclick="document.getElementById('txModal').remove()" style="padding:10px 22px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إلغاء</button>
          <button onclick="saveTx()" style="padding:10px 26px;background:linear-gradient(135deg,#c0392b,#922b21);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13.5px">💾 حفظ الحركة</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // عند تغيير العميل، عرض رصيده الحالي
  const clientSelect = document.getElementById('txClient');
  clientSelect.addEventListener('change', updateTxBalancePreview);
  updateTxBalancePreview();
  
  // اضغط Enter للحفظ
  modal.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      saveTx();
    }
  });
  
  setTimeout(() => document.getElementById('txAmount')?.focus(), 50);
}

function updateTxBalancePreview() {
  const clientName = document.getElementById('txClient').value;
  const preview = document.getElementById('txBalancePreview');
  if (!clientName || !preview) { 
    if (preview) preview.style.display = 'none';
    return;
  }
  const c = O.soc.find(x => x.nm === clientName);
  if (!c) { preview.style.display = 'none'; return; }
  const balance = c.s - c.c; // ذمم = مبيعات - تحصيل
  preview.style.display = 'block';
  document.getElementById('txCurrentBalance').innerHTML = 
    `<b style="color:${balance>0?'#c0392b':'#27ae60'}">${balance.toFixed(3)} د.ك</b>` +
    ` <span style="font-size:11px;color:#5d4037">(مبيعات: ${(c.s||0).toFixed(3)} | تحصيل: ${(c.c||0).toFixed(3)})</span>`;
}

function saveTx() {
  const clientName = document.getElementById('txClient').value;
  const tp = document.getElementById('txType').value;
  const dt = document.getElementById('txDate').value;
  const amount = parseFloat(document.getElementById('txAmount').value) || 0;
  const invoice = document.getElementById('txInvoice').value.trim();
  const ag = document.getElementById('txAgent').value;
  const itemCd = document.getElementById('txItem').value;
  const qty = parseFloat(document.getElementById('txQty').value) || 1;
  const notes = document.getElementById('txNotes').value.trim();
  
  if (!clientName) { showToast('خطأ', 'يرجى اختيار العميل', false); return; }
  if (!tp) { showToast('خطأ', 'يرجى اختيار نوع الحركة', false); return; }
  if (!dt) { showToast('خطأ', 'يرجى تحديد التاريخ', false); return; }
  if (amount <= 0) { showToast('خطأ', 'المبلغ يجب أن يكون أكبر من صفر', false); return; }
  
  // توليد المعرّف الفريد
  const txId = 'TX-MAN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  
  const tx = {
    id: txId,
    dt,
    client: clientName,
    cl: clientName,
    tp,
    amount: +amount.toFixed(3),
    i: invoice ? (parseInt(invoice.replace(/\D/g, '')) || 0) : 0,
    invoice: invoice,
    ag: ag,
    items: itemCd ? [[itemCd, qty, amount, amount]] : [['MANUAL', qty, amount, amount]],
    qty,
    cost: 0,
    source: 'manual',
    nt: notes,
    ts: Date.now(),
    _v: 'manual-v1'
  };
  
  if (!Array.isArray(O.tx)) O.tx = [];
  O.tx.push(tx);
  
  // 🆕 تحديث O.mon (التجميع الشهري) حتى تُحسب الحركة في KPIs والرسوم
  try {
    const monthKey = dt.slice(0, 7); // "YYYY-MM"
    let monthIdx = (O.mk || []).indexOf(monthKey);
    
    // إذا الأشهر غير موجودة (نظام جديد) - أضف الشهر الحالي كحد أدنى
    if (!O.mk || O.mk.length === 0) {
      // إنشاء الأشهر من رصيد افتتاحي إلى اليوم
      const todayMonth = new Date().toISOString().slice(0, 7);
      const startMonth = '2024-01';
      const months = [];
      const sm = startMonth.split('-').map(Number);
      const em = todayMonth.split('-').map(Number);
      let y = sm[0], m = sm[1];
      while (y < em[0] || (y === em[0] && m <= em[1])) {
        months.push(`${y}-${String(m).padStart(2,'0')}`);
        m++; if (m > 12) { m = 1; y++; }
      }
      O.mk = months;
      O.ml = months.slice();
      O.mt = months.map(() => 0);
      O.mc = months.map(() => 0);
      monthIdx = O.mk.indexOf(monthKey);
    }
    
    if (monthIdx >= 0) {
      let mon = O.mon.find(m => m.nm === clientName);
      if (!mon) {
        const len = O.mk.length || 1;
        mon = { nm: clientName, v: new Array(len).fill(0), c: new Array(len).fill(0), q: new Array(len).fill(0) };
        O.mon.push(mon);
      }
      const typeInfo = (typeof getTxTypes === 'function') ? getTxTypes().find(t => t.code === tp || t.id === tp) : null;
      const aff = typeInfo?.affects || 'sales';
      if (aff === 'sales' || aff === 'opening' || aff === 'debit_notes' || aff === 'payments_out') {
        mon.v[monthIdx] = (mon.v[monthIdx] || 0) + amount;
      } else if (aff === 'collections') {
        mon.c[monthIdx] = (mon.c[monthIdx] || 0) + amount;
      } else if (aff === 'sales_return') {
        mon.v[monthIdx] = (mon.v[monthIdx] || 0) - amount;
      } else {
        mon.v[monthIdx] = (mon.v[monthIdx] || 0) + amount;
      }
      mon.q[monthIdx] = (mon.q[monthIdx] || 0) + qty;
      
      // تحديث soc.s و soc.c الكليين
      const soc = O.soc.find(x => x.nm === clientName);
      if (soc) {
        if (aff === 'sales' || aff === 'opening' || aff === 'debit_notes' || aff === 'payments_out') {
          soc.s = +(soc.s || 0) + amount;
          soc.q = +(soc.q || 0) + qty;
        } else if (aff === 'collections') {
          soc.c = +(soc.c || 0) + amount;
        } else if (aff === 'sales_return') {
          soc.s = +(soc.s || 0) - amount;
        } else {
          soc.s = +(soc.s || 0) + amount;
        }
      }
    }
  } catch(e) { Logger.warn('mon update:', e); }
  
  // حفظ وتحديث
  try { nayefSaveData(); } catch(e) { Logger.warn('save:', e); }
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) { Logger.warn('recompute:', e); }
  
  document.getElementById('txModal')?.remove();
  
  // عرض في الصفحة الحالية
  try { draw(CUR); } catch(e) {}
  
  const typeInfo = (typeof getTxTypes === 'function') ? getTxTypes().find(t => t.code === tp || t.id === tp) : null;
  const typeName = typeInfo?.label || tp;
  showToast('✅ تمت الإضافة', `${typeName}: ${amount.toFixed(3)} د.ك على ${clientName}`, true);
  
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('tx_add', '💸 إضافة حركة يدوية', { client: clientName, tp, amount, dt }); } catch(e) {}
  }
}

// اختصارات سريعة
function quickAddPayment() {
  openTxModal({ type: 'payment' });
}

function quickAddSale() {
  openTxModal({ type: 'sale' });
}

// ═════════════════════════════════════════════════════════════════════════
// 🆕 v220.1+ DYNAMIC: إدارة أنواع الحركات (CRUD)
// ═════════════════════════════════════════════════════════════════════════

const DEFAULT_TX_TYPES = [
  { id: 'sale',    code: 'sale',    label: 'فاتورة مبيعات', icon: '🧾', color: '#c0392b', dir: 'D', affects: 'sales',         affectsLabel: 'مبيعات' },
  { id: 'return',  code: 'return',  label: 'مرتجع مبيعات', icon: '↩️', color: '#16a085', dir: 'C', affects: 'sales_return',  affectsLabel: 'مرتجعات' },
  { id: 'payment', code: 'payment', label: 'تحصيل (شيك/نقدي)', icon: '💵', color: '#27ae60', dir: 'C', affects: 'collections',  affectsLabel: 'تحصيلات' },
  { id: 'opening', code: 'opening', label: 'رصيد افتتاحي', icon: '🏁', color: '#34495e', dir: 'D', affects: 'opening',       affectsLabel: 'أرصدة افتتاحية' },
  { id: 'credit',  code: 'credit',  label: 'إشعار دائن',    icon: '📝', color: '#2980b9', dir: 'C', affects: 'credit_notes',  affectsLabel: 'إشعارات دائنة' },
  { id: 'debit',   code: 'debit',   label: 'إشعار مدين',    icon: '📋', color: '#d35400', dir: 'D', affects: 'debit_notes',   affectsLabel: 'إشعارات مدينة' },
  { id: 'disc',    code: 'disc',    label: 'خصم ممنوح',     icon: '🎁', color: '#16a085', dir: 'C', affects: 'discounts',     affectsLabel: 'خصومات' },
  { id: 'adj',     code: 'adj',     label: 'قيد تسوية',     icon: '⚖️', color: '#8e44ad', dir: 'C', affects: 'adjustments',   affectsLabel: 'تسويات' },
  { id: 'payout',  code: 'payout',  label: 'سند صرف',       icon: '💸', color: '#c0392b', dir: 'D', affects: 'payments_out',  affectsLabel: 'مدفوعات صادرة' },
];

function getTxTypes() {
  if (!Array.isArray(O.txTypes) || !O.txTypes.length) {
    O.txTypes = JSON.parse(JSON.stringify(DEFAULT_TX_TYPES));
  }
  return O.txTypes;
}

function pageTxTypes(pg) {
  const types = getTxTypes();
  const debit = types.filter(t => t.dir === 'D').length;
  const credit = types.filter(t => t.dir === 'C').length;
  pg.innerHTML = `
  <div class="kg">
    ${KC('إجمالي الأنواع', types.length, 'نوع حركة معرّف', 'var(--blu)')}
    ${KC('حركات مدينة', debit, 'تزيد رصيد العميل', 'var(--red)')}
    ${KC('حركات دائنة', credit, 'تنقص رصيد العميل', 'var(--grn)')}
    ${KC('الأثر المحاسبي', 'مدين/دائن', 'يحدد أثر الحركة', 'var(--pur)')}
  </div>
  <div class="dc">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <h3 style="margin:0">⚙️ دليل أنواع الحركات على حساب العميل</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="openTxTypeModal()" style="background:linear-gradient(135deg,#1e8449,#27ae60);color:#fff;border:none;padding:9px 18px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit">➕ إضافة نوع</button>
        <button onclick="resetTxTypesToDefault()" style="background:#7f8c8d;color:#fff;border:none;padding:9px 14px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit">↺ إعادة الافتراضي</button>
      </div>
    </div>
    <div class="pd" style="margin-bottom:14px">
      💡 <b>أنواع الحركات</b> تحدد كيف تُسجَّل كل عملية على حساب العميل. كل نوع له:
      <b>الكود</b> (المعرّف الفريد)،
      <b>الاتجاه</b> (مدين يزيد الذمم، أو دائن ينقصها)، و
      <b>الأثر المحاسبي</b> (مبيعات، تحصيلات، تسويات...).
      <br>⚠️ تغيير نوع حركة لا يعدّل الحركات السابقة — فقط يحدّد كيف تُفسّر الحركات الجديدة.
    </div>
    ${TB(types, [
      ['الأيقونة', r => `<span style="font-size:22px">${r.icon || '📌'}</span>`],
      ['الكود', r => `<span style="font-family:monospace;color:var(--tx2);background:var(--surf2);padding:2px 8px;border-radius:4px">${r.code || '—'}</span>`],
      ['الاسم المعروض', r => `<b>${r.label || '—'}</b>`],
      ['الاتجاه', r => r.dir === 'D'
        ? `<span class="bd br">⬆️ مدين</span>`
        : `<span class="bd bg">⬇️ دائن</span>`],
      ['الأثر', r => `<span class="bd bb">${r.affectsLabel || r.affects || '—'}</span>`],
      ['اللون', r => `<span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${r.color || '#999'};border:1px solid var(--line-soft)"></span><code style="font-size:11px;color:var(--tx3)">${r.color || '—'}</code></span>`],
      ['الإجراءات', r => `
        <button onclick="openTxTypeModal('${(r.id||'').replace(/'/g,"\\'")}')" title="تعديل" style="background:#f39c12;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;margin-left:4px;font-family:inherit">✏️</button>
        <button onclick="duplicateTxType('${(r.id||'').replace(/'/g,"\\'")}')" title="تكرار" style="background:#3498db;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;margin-left:4px;font-family:inherit">📋</button>
        <button onclick="confirmDeleteTxType('${(r.id||'').replace(/'/g,"\\'")}')" title="حذف" style="background:#c0392b;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;font-family:inherit">🗑️</button>
      `],
    ])}
  </div>`;
}

function openTxTypeModal(idOrNull) {
  const isEdit = !!idOrNull;
  const types = getTxTypes();
  const t = isEdit ? types.find(x => x.id === idOrNull) : null;
  
  const existing = document.getElementById('txTypeModal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'txTypeModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,30,56,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:0;max-width:600px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="background:linear-gradient(135deg,#8e44ad,#6c3483);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:17px">${isEdit ? '✏️ تعديل نوع حركة' : '➕ إضافة نوع حركة جديد'}</h3>
        <button onclick="document.getElementById('txTypeModal').remove()" style="background:rgba(255,255,255,.2);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
      </div>
      <div style="padding:24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الكود (معرّف فريد) *</span>
            <input id="ttCode" type="text" value="${(t?.code||'').replace(/"/g,'&quot;')}" ${isEdit?'readonly style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;background:#eceff1;color:#607d8b;font-family:monospace"':'style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:monospace"'} placeholder="مثال: sale, return, شيك">
            <span style="font-size:11px;color:#90a4ae">يُستخدم في البيانات المستوردة للتعرّف على النوع</span>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الاسم المعروض *</span>
            <input id="ttLabel" type="text" value="${(t?.label||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="مثال: فاتورة مبيعات">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الأيقونة (Emoji)</span>
            <input id="ttIcon" type="text" value="${t?.icon||''}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;text-align:center;font-size:18px" placeholder="🧾" maxlength="4">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">اللون</span>
            <input id="ttColor" type="color" value="${t?.color||'#2980b9'}" style="width:100%;padding:4px;border:1px solid #cfd8dc;border-radius:7px;height:42px;cursor:pointer">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الاتجاه المحاسبي</span>
            <select id="ttDir" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit">
              <option value="D" ${(t?.dir||'D')==='D'?'selected':''}>⬆️ مدين — يزيد رصيد العميل (ذمم)</option>
              <option value="C" ${t?.dir==='C'?'selected':''}>⬇️ دائن — ينقص رصيد العميل (تحصيل/خصم)</option>
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الأثر المحاسبي</span>
            <select id="ttAffects" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit">
              <option value="sales"         ${t?.affects==='sales'?'selected':''}>مبيعات</option>
              <option value="sales_return"  ${t?.affects==='sales_return'?'selected':''}>مرتجعات</option>
              <option value="collections"   ${t?.affects==='collections'?'selected':''}>تحصيلات</option>
              <option value="opening"       ${t?.affects==='opening'?'selected':''}>أرصدة افتتاحية</option>
              <option value="credit_notes"  ${t?.affects==='credit_notes'?'selected':''}>إشعارات دائنة</option>
              <option value="debit_notes"   ${t?.affects==='debit_notes'?'selected':''}>إشعارات مدينة</option>
              <option value="discounts"     ${t?.affects==='discounts'?'selected':''}>خصومات</option>
              <option value="adjustments"   ${t?.affects==='adjustments'?'selected':''}>تسويات</option>
              <option value="payments_out"  ${t?.affects==='payments_out'?'selected':''}>مدفوعات صادرة</option>
              <option value="other"         ${t?.affects==='other'?'selected':''}>أخرى</option>
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px;grid-column:span 2">
            <span style="font-size:12px;color:#37474f;font-weight:700">وصف مختصر للأثر</span>
            <input id="ttAffectsLabel" type="text" value="${(t?.affectsLabel||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="مثال: مبيعات، تحصيلات، تسويات...">
          </label>
        </div>
        <div style="background:linear-gradient(135deg,#fff8e1,#fff3cd);border-right:4px solid #f39c12;padding:12px 16px;border-radius:7px;margin-top:18px;font-size:12.5px;color:#5d4037;line-height:1.7">
          💡 <b>أمثلة على الكود:</b>
          <code style="background:#fff;padding:2px 6px;border-radius:4px;margin:0 4px">فاتوره</code> أو
          <code style="background:#fff;padding:2px 6px;border-radius:4px;margin:0 4px">شيك</code> أو
          <code style="background:#fff;padding:2px 6px;border-radius:4px;margin:0 4px">sale</code>.
          <br>📐 <b>الاتجاه:</b> مدين ← يزيد الذمم على العميل (مثل فاتورة)، دائن ← ينقصها (مثل تحصيل).
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
          <button onclick="document.getElementById('txTypeModal').remove()" style="padding:10px 22px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إلغاء</button>
          ${isEdit ? `<button onclick="confirmDeleteTxType('${(t?.id||'').replace(/'/g,"\\'")}')" style="padding:10px 22px;background:#c0392b;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;margin-left:auto">🗑️ حذف</button>` : ''}
          <button onclick="saveTxType(${isEdit ? `'${(t?.id||'').replace(/'/g,"\\'")}'` : 'null'})" style="padding:10px 26px;background:linear-gradient(135deg,#8e44ad,#6c3483);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13.5px">💾 ${isEdit ? 'حفظ التعديل' : 'إضافة النوع'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  setTimeout(() => {
    const firstInput = isEdit ? document.getElementById('ttLabel') : document.getElementById('ttCode');
    if (firstInput) firstInput.focus();
  }, 50);
  
  modal.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveTxType(isEdit ? t.id : null);
    }
  });
}

function saveTxType(originalId) {
  const isEdit = !!originalId;
  const types = getTxTypes();
  const code = (document.getElementById('ttCode').value || '').trim();
  const label = (document.getElementById('ttLabel').value || '').trim();
  const icon = (document.getElementById('ttIcon').value || '📌').trim();
  const color = document.getElementById('ttColor').value || '#2980b9';
  const dir = document.getElementById('ttDir').value;
  const affects = document.getElementById('ttAffects').value;
  const affectsLabel = (document.getElementById('ttAffectsLabel').value || affects).trim();
  
  if (!code) { showToast('خطأ', 'يرجى إدخال كود النوع', false); document.getElementById('ttCode').focus(); return; }
  if (!label) { showToast('خطأ', 'يرجى إدخال الاسم المعروض', false); document.getElementById('ttLabel').focus(); return; }
  
  if (isEdit) {
    const idx = types.findIndex(t => t.id === originalId);
    if (idx >= 0) {
      types[idx] = { ...types[idx], code, label, icon, color, dir, affects, affectsLabel };
      showToast('✅ تم التعديل', `تم تحديث: ${label}`, true);
    }
  } else {
    const id = code.toLowerCase().replace(/\s+/g, '_');
    if (types.some(t => t.code === code || t.id === id)) {
      showToast('خطأ', `الكود "${code}" موجود مسبقاً`, false);
      document.getElementById('ttCode').focus();
      return;
    }
    types.push({ id, code, label, icon, color, dir, affects, affectsLabel });
    showToast('✅ تمت الإضافة', `تمت إضافة نوع: ${label}`, true);
  }
  
  try { nayefSaveData(); } catch(e) { Logger.warn('saveData:', e); }
  document.getElementById('txTypeModal')?.remove();
  draw('txTypes');
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log(isEdit ? 'txtype_edit' : 'txtype_add', { code, label }); } catch(e) {}
  }
}

function confirmDeleteTxType(id) {
  const types = getTxTypes();
  const t = types.find(x => x.id === id);
  if (!t) { showToast('خطأ', 'النوع غير موجود', false); return; }
  if (!confirm(`هل تريد حذف نوع الحركة "${t.label}" (${t.code})؟\n\nملاحظة: الحركات السابقة المسجّلة بهذا النوع تبقى كما هي.`)) return;
  deleteTxType(id);
}

function deleteTxType(id) {
  const types = getTxTypes();
  const t = types.find(x => x.id === id);
  if (!t) return;
  O.txTypes = types.filter(x => x.id !== id);
  try { nayefSaveData(); } catch(e) {}
  document.getElementById('txTypeModal')?.remove();
  draw('txTypes');
  showToast('🗑️ تم الحذف', `تم حذف: ${t.label}`, true);
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('txtype_delete', { code: t.code, label: t.label }); } catch(e) {}
  }
}

function duplicateTxType(id) {
  const types = getTxTypes();
  const src = types.find(t => t.id === id);
  if (!src) { showToast('خطأ', 'النوع غير موجود', false); return; }
  let newCode = src.code + '_CPY';
  let i = 1;
  while (types.some(t => t.code === newCode)) { i++; newCode = src.code + '_CPY' + i; }
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = newCode.toLowerCase().replace(/\s+/g, '_');
  copy.code = newCode;
  copy.label = (src.label || '') + ' (نسخة)';
  types.push(copy);
  try { nayefSaveData(); } catch(e) {}
  draw('txTypes');
  showToast('📋 تم النسخ', `تم تكرار النوع بكود: ${newCode}`, true);
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('txtype_duplicate', { from: src.code, to: newCode }); } catch(e) {}
  }
}

function resetTxTypesToDefault() {
  if (!confirm('سيتم استبدال جميع الأنواع بالقائمة الافتراضية. هل أنت متأكد؟')) return;
  O.txTypes = JSON.parse(JSON.stringify(DEFAULT_TX_TYPES));
  try { nayefSaveData(); } catch(e) {}
  draw('txTypes');
  showToast('↺ تم الإعادة', 'تم استعادة قائمة الأنواع الافتراضية', true);
}

// ═════════════════════════════════════════════════════════════════════════
// 🆕 v220.1+ DYNAMIC: CRUD الجمعيات (العملاء)
// ═════════════════════════════════════════════════════════════════════════

function openCoopModal(nmOrNull) {
  const isEdit = !!nmOrNull;
  const c = isEdit ? O.soc.find(x => x.nm === nmOrNull) : null;
  
  const existing = document.getElementById('coopModal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'coopModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,30,56,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:0;max-width:680px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="background:linear-gradient(135deg,#2563a8,#1a4480);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:17px">${isEdit ? '✏️ تعديل جمعية / عميل' : '➕ إضافة جمعية / عميل جديد'}</h3>
        <button onclick="document.getElementById('coopModal').remove()" style="background:rgba(255,255,255,.2);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
      </div>
      <div style="padding:24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <label style="display:flex;flex-direction:column;gap:5px;grid-column:span 2">
            <span style="font-size:12px;color:#37474f;font-weight:700">اسم الجمعية / العميل *</span>
            <input id="cNm" type="text" value="${(c?.nm||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="مثال: جمعية الفحيحيل التعاونية">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">المنطقة</span>
            <input id="cReg" type="text" value="${(c?.reg||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="الكويت، الأحمدي، حولي...">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">المندوب</span>
            <input id="cAg" type="text" value="${(c?.ag||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="اسم المندوب">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">رقم الهاتف</span>
            <input id="cPhone" type="text" value="${(c?.phone||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="+965 90000000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">البريد الإلكتروني</span>
            <input id="cEmail" type="email" value="${(c?.email||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="info@example.com">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الرصيد الافتتاحي (د.ك)</span>
            <input id="cOb" type="number" step="0.001" value="${c?.ob ?? c?.op ?? 0}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="0.000">
            <span style="font-size:11px;color:#90a4ae">الذمم المستحقة على العميل قبل بداية الفترة</span>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">تصنيف العميل</span>
            <select id="cTier" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit">
              <option value="">— غير محدد —</option>
              <option value="vip" ${c?.tier==='vip'?'selected':''}>⭐ VIP</option>
              <option value="gold" ${c?.tier==='gold'?'selected':''}>🥇 Gold</option>
              <option value="silver" ${c?.tier==='silver'?'selected':''}>🥈 Silver</option>
              <option value="regular" ${c?.tier==='regular'?'selected':''}>عادي</option>
            </select>
          </label>
          <label style="display:flex;flex-direction:column;gap:5px;grid-column:span 2">
            <span style="font-size:12px;color:#37474f;font-weight:700">ملاحظات</span>
            <textarea id="cNotes" rows="2" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit;resize:vertical">${(c?.nt||c?.notes||'').replace(/</g,'&lt;')}</textarea>
          </label>
        </div>
        <div style="background:linear-gradient(135deg,#e8f4fd,#d6eaf8);border-right:4px solid #2563a8;padding:12px 16px;border-radius:7px;margin-top:18px;font-size:12.5px;color:#1a4480;line-height:1.7">
          💡 <b>المبيعات/التحصيل/الذمم</b> تُحسب تلقائياً من المعاملات. هنا فقط البيانات الثابتة (الاسم، المنطقة، المندوب، الرصيد الافتتاحي).
          <br>⚠️ تعديل الاسم سيُحدّث اسم العميل في كل المعاملات المرتبطة.
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
          <button onclick="document.getElementById('coopModal').remove()" style="padding:10px 22px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إلغاء</button>
          ${isEdit ? `<button onclick="confirmDeleteCoop('${(c?.nm||'').replace(/'/g,"\\'")}')" style="padding:10px 22px;background:#c0392b;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;margin-left:auto">🗑️ حذف</button>` : ''}
          <button onclick="saveCoop(${isEdit ? `'${(c?.nm||'').replace(/'/g,"\\'")}'` : 'null'})" style="padding:10px 26px;background:linear-gradient(135deg,#2563a8,#1a4480);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13.5px">💾 ${isEdit ? 'حفظ التعديل' : 'إضافة الجمعية'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('cNm')?.focus(), 50);
  modal.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveCoop(isEdit ? c.nm : null);
    }
  });
}

function saveCoop(originalNm) {
  const isEdit = !!originalNm;
  const nm = (document.getElementById('cNm').value || '').trim();
  const reg = (document.getElementById('cReg').value || '').trim();
  const ag = (document.getElementById('cAg').value || '').trim();
  const phone = (document.getElementById('cPhone').value || '').trim();
  const email = (document.getElementById('cEmail').value || '').trim();
  const ob = parseFloat(document.getElementById('cOb').value) || 0;
  const tier = document.getElementById('cTier').value;
  const notes = (document.getElementById('cNotes').value || '').trim();
  
  if (!nm) { showToast('خطأ', 'يرجى إدخال اسم الجمعية', false); document.getElementById('cNm').focus(); return; }
  
  if (isEdit) {
    const idx = O.soc.findIndex(x => x.nm === originalNm);
    if (idx >= 0) {
      const oldNm = O.soc[idx].nm;
      O.soc[idx].nm = nm;
      O.soc[idx].reg = reg;
      O.soc[idx].ag = ag;
      O.soc[idx].phone = phone;
      O.soc[idx].email = email;
      O.soc[idx].ob = ob;
      O.soc[idx].op = ob;
      O.soc[idx].tier = tier;
      O.soc[idx].nt = notes;
      // تحديث اسم العميل في كل المعاملات
      if (oldNm !== nm) {
        O.tx.forEach(tx => {
          if (tx.client === oldNm) tx.client = nm;
          if (tx.cl === oldNm) tx.cl = nm;
        });
      }
      showToast('✅ تم التعديل', `تم تحديث: ${nm}`, true);
    }
  } else {
    if (O.soc.some(s => s.nm === nm)) {
      showToast('خطأ', `الاسم "${nm}" موجود مسبقاً`, false);
      document.getElementById('cNm').focus();
      return;
    }
    O.soc.push({
      i: O.soc.length + 1,
      nm, reg, ag, phone, email, ob, op: ob, tier,
      s: 0, co: 0, pr: 0, c: 0, ot: ob, q: 0, rt: 1,
      li: '', lc: '', nt: notes
    });
    showToast('✅ تمت الإضافة', `تمت إضافة: ${nm}`, true);
  }
  
  try { nayefSaveData(); } catch(e) {}
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) {}
  
  document.getElementById('coopModal')?.remove();
  try { draw('clients360'); } catch(e) {}
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log(isEdit ? 'coop_edit' : 'coop_add', { nm }); } catch(e) {}
  }
}

function confirmDeleteCoop(nm) {
  const c = O.soc.find(x => x.nm === nm);
  if (!c) { showToast('خطأ', 'الجمعية غير موجودة', false); return; }
  if (!confirm(`هل تريد حذف "${nm}"؟\n\n⚠️ سيتم حذف كل بياناتها: مبيعات، تحصيلات، معاملات، رصيد افتتاحي.\nهذا الإجراء نهائي!`)) return;
  deleteCoop(nm);
}

function deleteCoop(nm) {
  const c = O.soc.find(x => x.nm === nm);
  if (!c) return;
  // حذف الجمعية
  O.soc = O.soc.filter(x => x.nm !== nm);
  // حذف كل معاملاتها (اختياري — نتركها للمراجعة)
  // O.tx = O.tx.filter(t => t.client !== nm && t.cl !== nm);
  
  try { nayefSaveData(); } catch(e) {}
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) {}
  
  document.getElementById('coopModal')?.remove();
  try { draw('clients360'); } catch(e) {}
  showToast('🗑️ تم الحذف', `تم حذف: ${c.nm}`, true);
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('coop_delete', { nm: c.nm }); } catch(e) {}
  }
}

// ═════════════════════════════════════════════════════════════════════════
// 🆕 v220.1+ DYNAMIC: CRUD المناديب
// ═════════════════════════════════════════════════════════════════════════

function openAgentModal(nmOrNull) {
  const isEdit = !!nmOrNull;
  const a = isEdit ? O.ag.find(x => x.nm === nmOrNull) : null;
  
  const existing = document.getElementById('agentModal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'agentModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(10,30,56,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:0;max-width:640px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="background:linear-gradient(135deg,#7d4f9e,#5b3578);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:17px">${isEdit ? '✏️ تعديل مندوب' : '➕ إضافة مندوب جديد'}</h3>
        <button onclick="document.getElementById('agentModal').remove()" style="background:rgba(255,255,255,.2);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
      </div>
      <div style="padding:24px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <label style="display:flex;flex-direction:column;gap:5px;grid-column:span 2">
            <span style="font-size:12px;color:#37474f;font-weight:700">اسم المندوب *</span>
            <input id="aNm" type="text" value="${(a?.nm||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="مثال: محمد العتيبي">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">رقم الهاتف</span>
            <input id="aPhone" type="text" value="${(a?.phone||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="+965 90000000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">البريد الإلكتروني</span>
            <input id="aEmail" type="email" value="${(a?.email||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="agent@example.com">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">المنطقة المخصصة</span>
            <input id="aReg" type="text" value="${(a?.reg||'').replace(/"/g,'&quot;')}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="الكويت، الأحمدي...">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px">
            <span style="font-size:12px;color:#37474f;font-weight:700">الهدف الشهري (د.ك)</span>
            <input id="aTarget" type="number" step="0.001" value="${a?.tg ?? a?.target ?? 0}" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px" placeholder="0.000">
          </label>
          <label style="display:flex;flex-direction:column;gap:5px;grid-column:span 2">
            <span style="font-size:12px;color:#37474f;font-weight:700">ملاحظات</span>
            <textarea id="aNotes" rows="2" style="width:100%;padding:9px;border:1px solid #cfd8dc;border-radius:7px;font-family:inherit;resize:vertical">${(a?.nt||a?.notes||'').replace(/</g,'&lt;')}</textarea>
          </label>
        </div>
        <div style="background:linear-gradient(135deg,#f4ecf7,#e8d8f0);border-right:4px solid #7d4f9e;padding:12px 16px;border-radius:7px;margin-top:18px;font-size:12.5px;color:#4a2c63;line-height:1.7">
          💡 <b>المبيعات والتحصيل</b> تُحسب من الجمعيات المربوطة بهذا المندوب. الهدف الشهري هدف مرجعي للحساب.
          <br>⚠️ تعديل الاسم سيُحدّث اسم المندوب في كل الجمعيات والمعاملات المرتبطة.
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
          <button onclick="document.getElementById('agentModal').remove()" style="padding:10px 22px;background:#95a5a6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit">إلغاء</button>
          ${isEdit ? `<button onclick="confirmDeleteAgent('${(a?.nm||'').replace(/'/g,"\\'")}')" style="padding:10px 22px;background:#c0392b;color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:inherit;margin-left:auto">🗑️ حذف</button>` : ''}
          <button onclick="saveAgent(${isEdit ? `'${(a?.nm||'').replace(/'/g,"\\'")}'` : 'null'})" style="padding:10px 26px;background:linear-gradient(135deg,#7d4f9e,#5b3578);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13.5px">💾 ${isEdit ? 'حفظ التعديل' : 'إضافة المندوب'}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('aNm')?.focus(), 50);
  modal.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveAgent(isEdit ? a.nm : null);
    }
  });
}

function saveAgent(originalNm) {
  const isEdit = !!originalNm;
  const nm = (document.getElementById('aNm').value || '').trim();
  const phone = (document.getElementById('aPhone').value || '').trim();
  const email = (document.getElementById('aEmail').value || '').trim();
  const reg = (document.getElementById('aReg').value || '').trim();
  const tg = parseFloat(document.getElementById('aTarget').value) || 0;
  const notes = (document.getElementById('aNotes').value || '').trim();
  
  if (!nm) { showToast('خطأ', 'يرجى إدخال اسم المندوب', false); document.getElementById('aNm').focus(); return; }
  
  if (isEdit) {
    const idx = O.ag.findIndex(x => x.nm === originalNm);
    if (idx >= 0) {
      const oldNm = O.ag[idx].nm;
      O.ag[idx].nm = nm;
      O.ag[idx].phone = phone;
      O.ag[idx].email = email;
      O.ag[idx].reg = reg;
      O.ag[idx].tg = tg;
      O.ag[idx].target = tg;
      O.ag[idx].nt = notes;
      // تحديث اسم المندوب في كل الجمعيات والمعاملات
      if (oldNm !== nm) {
        O.soc.forEach(s => { if (s.ag === oldNm) s.ag = nm; });
        O.tx.forEach(tx => { if (tx.ag === oldNm) tx.ag = nm; });
        if (Array.isArray(O.agentMovement)) O.agentMovement.forEach(r => { if (r.agent === oldNm) r.agent = nm; });
        if (Array.isArray(O.agentSummary)) O.agentSummary.forEach(r => { if (r.agent === oldNm) r.agent = nm; });
      }
      showToast('✅ تم التعديل', `تم تحديث: ${nm}`, true);
    }
  } else {
    if (O.ag.some(x => x.nm === nm)) {
      showToast('خطأ', `الاسم "${nm}" موجود مسبقاً`, false);
      document.getElementById('aNm').focus();
      return;
    }
    O.ag.push({
      nm, phone, email, reg, tg, target: tg, nt: notes,
      sv: O.ml ? O.ml.map(() => 0) : [],
      cv: O.ml ? O.ml.map(() => 0) : [],
      tv: O.ml ? O.ml.map(() => 0) : [],
      socs: new Set ? new Set() : []
    });
    showToast('✅ تمت الإضافة', `تمت إضافة: ${nm}`, true);
  }
  
  try { nayefSaveData(); } catch(e) {}
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) {}
  
  document.getElementById('agentModal')?.remove();
  try { draw('ag'); } catch(e) {}
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log(isEdit ? 'agent_edit' : 'agent_add', { nm }); } catch(e) {}
  }
}

function confirmDeleteAgent(nm) {
  const a = O.ag.find(x => x.nm === nm);
  if (!a) { showToast('خطأ', 'المندوب غير موجود', false); return; }
  if (!confirm(`هل تريد حذف المندوب "${nm}"؟\n\n⚠️ هذا سيلغي ربط الجمعيات بهذا المندوب (الجمعيات تبقى لكن بدون مندوب).`)) return;
  deleteAgent(nm);
}

function deleteAgent(nm) {
  const a = O.ag.find(x => x.nm === nm);
  if (!a) return;
  O.ag = O.ag.filter(x => x.nm !== nm);
  // فك ربط الجمعيات
  O.soc.forEach(s => { if (s.ag === nm) s.ag = ''; });
  
  try { nayefSaveData(); } catch(e) {}
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) {}
  
  document.getElementById('agentModal')?.remove();
  try { draw('ag'); } catch(e) {}
  showToast('🗑️ تم الحذف', `تم حذف: ${a.nm}`, true);
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('agent_delete', { nm: a.nm }); } catch(e) {}
  }
}

function pageCO(pg,S,T){
  pg.innerHTML=`
  <div class="kg">
    ${KC('صافي المبيعات',KD(T.s),'','var(--gd)')}
    ${KC('تكلفة المباع',KD(T.co),'COGS+خصم+مجاني','var(--red)')}
    ${KC('مجمل الربح',KD(T.pr),PC(T.s?T.pr/T.s*100:0),'var(--grn)')}
    ${KC('هامش الربح',PC(T.s?T.pr/T.s*100:0),'متوسط','var(--pur)')}
  </div>
  <div class="dc"><h3>📊 المبيعات والتكلفة والربح لكل جمعية</h3><canvas id="co_1" height="90"></canvas></div>
  <div class="dc"><h3>🧮 تفصيل التكلفة الحقيقية (COGS + خصم + قيمة مجاني)</h3>
    ${TB(S,[
      ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المندوب',r=>r.ag||'—'],
      ['صافي المبيعات',r=>`<span style="color:var(--gd)">${KD(r.s)}</span>`],
      ['الكمية المباعة',r=>`<span style="color:var(--blu)">${fmt(r.q||0)}</span>`],
      ['COGS',r=>KD(r.g||0)],
      ['الخصم',r=>KD(r.d||0)],
      ['قيمة المجاني',r=>KD(r.fv||0)],
      ['مرتجعات المبيعات',r=>r.retVal>0?`<span style="color:var(--grn)">−${KD(r.retVal)}</span>`:'—'],
      ['إجمالي التكلفة',r=>`<span style="color:var(--red)">${KD(r.co)}</span>`],
      ['مجمل الربح',r=>`<span style="color:var(--grn)">${KD(r.pr)}</span>`],
      ['الهامش',r=>PC(r.s?r.pr/r.s*100:0)],
    ])}
  </div>
  <div class="dc"><h3>💸 تأثير الخصومات والبضاعة المجانية على الربح</h3>
    <div class="pd" style="margin-bottom:12px">الجمعيات التي تستهلك الخصم والمجاني نسبة كبيرة من ربحها الإجمالي تحتاج مراجعة سياسة التسعير</div>
    ${TB(S.map(s=>({...s,imp:discountImpact(s)})).sort((a,b)=>b.imp.erosion-a.imp.erosion).filter(s=>s.imp.discCost>0),[
      ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['الربح قبل الخصم',r=>KD(r.imp.grossProfit)],
      ['تكلفة الخصم',r=>KD(r.d||0)],
      ['قيمة المجاني',r=>KD(r.fv||0)],
      ['إجمالي التنازل',r=>`<span style="color:#f39c12">${KD(r.imp.discCost)}</span>`],
      ['الربح الصافي',r=>`<span style="color:var(--grn)">${KD(r.imp.netProfit)}</span>`],
      ['نسبة التآكل',r=>{const e=r.imp.erosion;return`<span class="bd ${e>30?'br':e>15?'by':'bg'}">${PC(e)}</span>`}],
      ['التقييم',r=>{const e=r.imp.erosion;if(e>30)return'<span style="color:var(--red)">⚠️ مراجعة عاجلة</span>';if(e>15)return'<span style="color:#f39c12">👁️ مراقبة</span>';return'<span style="color:var(--grn)">✅ صحي</span>';}],
    ])}
  </div>`;
  const top=S.slice(0,12);
  setTimeout(()=>MK('co_1',{type:'bar',data:{labels:top.map(s=>SN(s.nm)),datasets:[{label:'مبيعات',data:top.map(s=>s.s),backgroundColor:'rgba(184,147,47,.7)',borderRadius:3},{label:'تكلفة',data:top.map(s=>s.co),backgroundColor:'rgba(192,57,43,.65)',borderRadius:3},{label:'ربح',data:top.map(s=>s.pr),backgroundColor:'rgba(30,132,73,.65)',borderRadius:3}]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{ticks:{font:{size:9}}}}}}),30);
}

// ════════════════════════════════════════════
// صفحة التحصيل والمخاطر الموحّدة (دمج: التحصيل + الائتمان والمخاطر + أعمار الذمم)
// تستدعي الدوال الثلاث الأصلية في حاويات فرعية — يحافظ على منطقها المُختبَر بالكامل
// ════════════════════════════════════════════
// تمرير سلس إلى قسم داخل صفحة مدمجة + إبراز مؤقت
function scrollToSec(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'start'});
  el.classList.remove('sec-flash');void el.offsetWidth;el.classList.add('sec-flash');
}
// شارة الفترة النشطة الموحّدة — تُظهر للمستخدم أي فترة يشاهد (مرتبطة بفلتر التاريخ)
function periodBadge(){
  const fa=(typeof _filterA==='number')?_filterA:0;
  const fb=(typeof _filterB==='number')?_filterB:(O.ml.length-1);
  const isFull=(fa===0&&fb>=O.ml.length-1);
  const lbl=isFull?('كامل الفترة · '+O.ml[0]+' ← '+O.ml[O.ml.length-1]):(O.ml[fa]+' ← '+O.ml[fb]+' · '+(fb-fa+1)+' شهر');
  return `<div class="period-badge"><span class="pb-ico">📅</span><span class="pb-txt">${lbl}</span>${isFull?'':'<span class="pb-flag">مفلتر</span>'}</div>`;
}
function pageReceivables(pg,S,T){
  pg.innerHTML=`
    ${periodBadge()}
    <div class="quick-nav">
      <button class="qn-btn" onclick="scrollToSec('sec_tc')"><span>💳</span> التحصيل والذمم</button>
      <button class="qn-btn" onclick="scrollToSec('sec_credit')"><span>🛡️</span> الائتمان والمخاطر</button>
      <button class="qn-btn" onclick="scrollToSec('sec_aging')"><span>⏳</span> أعمار الذمم</button>
    </div>
    <div class="merge-sec" id="sec_tc"><span class="merge-tag">١ · التحصيل والذمم</span></div>
    <div id="sub_tc"></div>
    <div class="merge-sec" id="sec_credit"><span class="merge-tag">٢ · الائتمان وتقييم المخاطر</span></div>
    <div id="sub_credit"></div>
    <div class="merge-sec" id="sec_aging"><span class="merge-tag">٣ · أعمار الذمم</span></div>
    <div id="sub_aging"></div>`;
  pageTC(document.getElementById('sub_tc'),S,T);
  pageCredit(document.getElementById('sub_credit'),S,T);
  pageAging(document.getElementById('sub_aging'),S,T);
}
function pageTC(pg,S,T){
  const cr=T.s>0?(T.c/T.s*100).toFixed(1):0;
  pg.innerHTML=`
  <div class="kg">
    ${KC('نسبة التحصيل',PC(cr),'','var(--blu)')}
    ${KC('إجمالي المحصّل',KD(T.c),'','var(--grn)')}
    ${KC('الذمم القائمة',KD(T.s-T.c),S.filter(s=>s.ot>0).length+' جمعية','var(--red)')}
    ${KC('إجمالي المبيعات',KD(T.s),'','var(--gd)')}
  </div>
  <div class="g2">
    <div class="dc"><h3>المبيعات مقابل التحصيل</h3><canvas id="tc_1"></canvas></div>
    <div class="dc"><h3>نسبة التحصيل لكل جمعية</h3>
      ${S.slice(0,12).map(s=>{const p=s.rt||0;return PB(SN(s.nm),p,100,p>=70?'#2ecc71':p>=40?'#c9a84c':'#e74c3c');}).join('')}
    </div>
  </div>
  <div class="dc"><h3>📊 تفاصيل التحصيل والذمم</h3>
    ${TB(S,[
      ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المبيعات',r=>KD(r.s)],
      ['المحصّل',r=>`<span style="color:var(--grn)">${KD(r.c)}</span>`],
      ['نسبة التحصيل',r=>{const p=r.rt||0;return`<span class="bd ${p>=70?'bg':p>=40?'by':'br'}">${PC(p)}</span>`}],
      ['الذمم',r=>`<span style="color:var(--red)">${KD(r.ot)}</span>`],
      ['آخر شيك',r=>r.lc||'—'],
      ['الحالة',r=>{const p=r.rt||0;return p>=70?'<span class="bd bg">ممتاز</span>':p>=40?'<span class="bd by">متوسط</span>':'<span class="bd br">يحتاج متابعة</span>'}],
    ])}
  </div>`;
  const lb=S.slice(0,12).map(s=>SN(s.nm));
  setTimeout(()=>MK('tc_1',{type:'bar',data:{labels:lb,datasets:[{label:'مبيعات',data:S.slice(0,12).map(s=>s.s),backgroundColor:'rgba(26,39,68,.85)'},{label:'محصّل',data:S.slice(0,12).map(s=>s.c),backgroundColor:'#1e8449',borderRadius:3}]},options:{scales:{x:{ticks:{font:{size:9}}}}}}),30);
}


// ═══════════════ تحليلات استراتيجية ═══════════════
function pageStrategic(pg,S,T){
  // حدود الفلتر النشط (من فترة إلى فترة)
  const fa=(typeof _filterA==='number')?_filterA:0;
  const fb=(typeof _filterB==='number')?_filterB:(O.ml.length-1);
  const isFull=(fa===0&&fb>=O.ml.length-1);
  const periodLabel=isFull?('كامل الفترة: '+O.ml[0]+' ← '+O.ml[O.ml.length-1]):('الفترة: '+O.ml[fa]+' ← '+O.ml[fb]+' ('+(fb-fa+1)+' شهر)');
  // ════════ شريط تنقّل سريع + شارة الفترة ════════
  pg.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <span style="background:linear-gradient(135deg,var(--navy),var(--navy2));color:var(--gold-bright);padding:7px 16px;border-radius:20px;font-size:12.5px;font-weight:800;display:inline-flex;align-items:center;gap:7px">📅 ${periodLabel}</span>
      <span style="color:var(--tx3);font-size:11.5px">كل التحليلات أدناه مرتبطة بفلتر التاريخ أعلى الصفحة</span>
    </div>
    <div class="quick-nav" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
      <button class="qn-btn" onclick="scrollToSec('sec_leak')">💸 تآكل الربحية</button>
      <button class="qn-btn" onclick="scrollToSec('sec_bcg')">📊 مصفوفة BCG</button>
      <button class="qn-btn" onclick="scrollToSec('sec_agtg')">🎯 أداء المناديب</button>
      <button class="qn-btn" onclick="scrollToSec('sec_checks')">💵 التحصيل بالشيكات</button>
      <button class="qn-btn" onclick="scrollToSec('sec_churn')">⚠️ إنذار الفقدان</button>
      <button class="qn-btn" onclick="scrollToSec('sec_fcs')">🔮 سيناريوهات التنبؤ</button>
    </div>
    <div id="sec_leak"></div>
    <div id="sec_bcg" style="margin-top:26px"></div>
    <div id="sec_agtg" style="margin-top:26px"></div>
    <div id="sec_checks" style="margin-top:26px"></div>
    <div id="sec_churn" style="margin-top:26px"></div>
    <div id="sec_fcs" style="margin-top:26px"></div>`;

  stratLeakage($('sec_leak'),S,T);          // يعمل على D المفلتر تلقائياً
  stratBCG($('sec_bcg'),S,T,fa,fb);
  stratAgentPerf($('sec_agtg'),fa,fb);
  stratChecks($('sec_checks'),fa,fb);
  stratChurn($('sec_churn'),S,fa,fb);
  stratForecast($('sec_fcs'),fa,fb);
}

// ═══════════ ١) تآكل الربحية (Margin Leakage) ═══════════
function stratLeakage(box,S,T){
  // التسريب = الخصم المسموح (d) + تكلفة البضاعة المجانية (fv) لكل جمعية
  const rows=S.map(s=>{
    const leak=N(s.d)+N(s.fv);
    const leakPct=s.s>0?leak/s.s*100:0;
    const gpPct=s.s>0?s.pr/s.s*100:0;
    return {nm:s.nm,s:s.s,disc:N(s.d),free:N(s.fv),leak,leakPct,gpPct};
  }).filter(r=>r.s>0).sort((a,b)=>b.leakPct-a.leakPct);

  const totLeak=rows.reduce((a,r)=>a+r.leak,0);
  const totDisc=rows.reduce((a,r)=>a+r.disc,0);
  const totFree=rows.reduce((a,r)=>a+r.free,0);
  const avgLeakPct=T.s>0?totLeak/T.s*100:0;
  // فرصة: لو خُفّض تسريب الجمعيات فوق المتوسط إلى المتوسط
  const opportunity=rows.filter(r=>r.leakPct>avgLeakPct).reduce((a,r)=>a+(r.leak-r.s*avgLeakPct/100),0);

  let h=`<div class="merge-sec"><span class="merge-tag">💸 تحليل ١</span><h2 style="margin:0">تآكل الربحية — أين تتسرّب أرباحك؟</h2></div>
  <p style="color:var(--tx2);font-size:13px;margin:-6px 0 16px;line-height:1.8">كل دينار خصم مسموح أو بضاعة مجانية يقلّل ربحك مباشرة. هذا التحليل يرتّب الجمعيات حسب <b>نسبة التسريب</b> (الخصم + المجاني ÷ مبيعاتها) لكشف الحسابات الأعلى استنزافاً.</p>
  <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px">
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">إجمالي التسريب السنوي</div><div style="font-size:22px;font-weight:900;color:var(--orn)">${KD(totLeak)}</div><div style="font-size:11px;color:var(--tx3)">${PC(avgLeakPct)} من المبيعات</div></div>
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">الخصم المسموح</div><div style="font-size:22px;font-weight:900;color:var(--tx)">${KD(totDisc)}</div></div>
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">تكلفة البضاعة المجانية</div><div style="font-size:22px;font-weight:900;color:var(--tx)">${KD(totFree)}</div></div>
    <div class="dc" style="text-align:center;border:1px solid rgba(30,132,73,.4)"><div style="font-size:11px;color:var(--tx3)">فرصة استرداد سنوية</div><div style="font-size:22px;font-weight:900;color:var(--grn)">${KD(opportunity)}</div><div style="font-size:11px;color:var(--tx3)">بضبط الأعلى للمتوسط</div></div>
  </div>
  <div class="dc"><div style="overflow-x:auto"><table class="tbl"><thead><tr>
    <th>#</th><th>الجمعية</th><th>المبيعات</th><th>الخصم</th><th>المجاني</th><th>إجمالي التسريب</th><th>نسبة التسريب</th><th>هامش الربح</th>
  </tr></thead><tbody>`;
  rows.forEach((r,i)=>{
    const hot=r.leakPct>=10?'color:var(--red);font-weight:800':r.leakPct>=avgLeakPct?'color:var(--orn);font-weight:700':'color:var(--tx2)';
    const bar=Math.min(100,r.leakPct/15*100);
    h+=`<tr>
      <td style="color:var(--tx3)">${i+1}</td>
      <td style="font-weight:600">${SN(r.nm)}</td>
      <td>${KD(r.s)}</td>
      <td>${KD(r.disc)}</td>
      <td>${KD(r.free)}</td>
      <td style="font-weight:700">${KD(r.leak)}</td>
      <td><div style="display:flex;align-items:center;gap:6px"><span style="${hot}">${PC(r.leakPct)}</span><div style="flex:1;height:5px;background:var(--surf2);border-radius:3px;min-width:34px"><div style="width:${bar}%;height:100%;background:${r.leakPct>=10?'var(--red)':r.leakPct>=avgLeakPct?'var(--orn)':'var(--grn)'};border-radius:3px"></div></div></div></td>
      <td style="color:${r.gpPct>=55?'var(--grn)':r.gpPct>=45?'var(--tx2)':'var(--red)'}">${PC(r.gpPct)}</td>
    </tr>`;
  });
  h+=`</tbody></table></div></div>`;
  // توصية تنفيذية
  const top3=rows.slice(0,3);
  h+=`<div class="ali" style="margin-top:14px;background:rgba(204,119,34,.07);border-color:rgba(204,119,34,.25)"><span>🎯</span><div style="font-size:12.5px;line-height:1.85"><b>توصية تنفيذية:</b> الجمعيات الثلاث الأعلى تسريباً (${top3.map(r=>SN(r.nm)).join('، ')}) تستنزف ${PC(top3.reduce((a,r)=>a+r.leakPct,0)/3)} من مبيعاتها وسطياً. مراجعة سياسة الخصم/المجاني معها — أو ربطها بحجم شراء أعلى — قد تسترد حتى <b style="color:var(--grn)">${KD(opportunity)}</b> سنوياً دون خسارة مبيعات.</div></div>`;
  box.innerHTML=h;
}

// ═══════════ ٢) مصفوفة BCG (نمو × ربحية) ═══════════
function stratBCG(box,S,T,fa,fb){
  fa=fa||0; fb=(fb!=null)?fb:(O.ml.length-1);
  // النمو: يُقارن ضمن النطاق المفلتر فقط — النصف الأخير من الفترة مقابل النصف الأول
  const monMap={}; (O.mon||[]).forEach(m=>monMap[m.nm]=m.v||[]);
  const ml=O.ml||[];
  // آخر شهر نشط ضمن النطاق المفلتر
  let lastActive=fb;
  while(lastActive>fa){const any=(O.mon||[]).some(m=>(m.v||[])[lastActive]>0);if(any)break;lastActive--;}
  const span=fb-fa+1;
  const half=Math.max(1,Math.floor(span/2));   // حجم نافذة المقارنة (نصف الفترة)
  const avgGP=T.s>0?T.pr/T.s*100:0;  // متوسط الهامش (من D المفلتر)
  const medSales=(()=>{const a=S.map(s=>s.s).sort((x,y)=>x-y);return a[Math.floor(a.length/2)]||0;})();

  const pts=S.filter(s=>s.s>0).map(s=>{
    const v=monMap[s.nm]||[];
    // نمو: مجموع النصف الأخير من النطاق مقابل النصف الأول
    let recent=0,prev=0;
    for(let k=fb-half+1;k<=fb;k++)recent+=N(v[k]);
    for(let k=fb-2*half+1;k<=fb-half;k++)prev+=N(v[k]);
    const growth=prev>0?(recent-prev)/prev*100:(recent>0?100:0);
    const gp=s.s>0?s.pr/s.s*100:0;
    let quad,col,ico;
    if(s.s>=medSales&&gp>=avgGP){quad='نجم';col='#1e8449';ico='⭐';}
    else if(s.s>=medSales&&gp<avgGP){quad='بقرة نقدية';col='#2563a8';ico='🐄';}
    else if(s.s<medSales&&gp>=avgGP){quad='علامة استفهام';col='#cc7722';ico='❓';}
    else{quad='كلب';col='#c0392b';ico='🐕';}
    return {nm:s.nm,s:s.s,gp,growth,quad,col,ico};
  });

  const counts={};pts.forEach(p=>counts[p.quad]=(counts[p.quad]||0)+1);
  let h=`<div class="merge-sec"><span class="merge-tag">📊 تحليل ٢</span><h2 style="margin:0">مصفوفة BCG — تصنيف الجمعيات استراتيجياً</h2></div>
  <p style="color:var(--tx2);font-size:13px;margin:-6px 0 16px;line-height:1.8">كل جمعية تُصنّف حسب <b>حجم مبيعاتها</b> (مقابل الوسيط ${KD(medSales)}) و<b>هامش ربحها</b> (مقابل المتوسط ${PC(avgGP)}). يوجّه أين تستثمر جهد المناديب وأين تتفاوض.</p>
  <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div class="dc" style="text-align:center;border-top:3px solid #1e8449"><div style="font-size:20px">⭐</div><div style="font-size:12px;color:var(--tx3)">نجوم</div><div style="font-size:22px;font-weight:900;color:#1e8449">${counts['نجم']||0}</div><div style="font-size:10px;color:var(--tx3)">حجم+هامش عاليان</div></div>
    <div class="dc" style="text-align:center;border-top:3px solid #2563a8"><div style="font-size:20px">🐄</div><div style="font-size:12px;color:var(--tx3)">أبقار نقدية</div><div style="font-size:22px;font-weight:900;color:#2563a8">${counts['بقرة نقدية']||0}</div><div style="font-size:10px;color:var(--tx3)">حجم عالٍ/هامش أقل</div></div>
    <div class="dc" style="text-align:center;border-top:3px solid #cc7722"><div style="font-size:20px">❓</div><div style="font-size:12px;color:var(--tx3)">علامات استفهام</div><div style="font-size:22px;font-weight:900;color:#cc7722">${counts['علامة استفهام']||0}</div><div style="font-size:10px;color:var(--tx3)">هامش جيد/حجم صغير</div></div>
    <div class="dc" style="text-align:center;border-top:3px solid #c0392b"><div style="font-size:20px">🐕</div><div style="font-size:12px;color:var(--tx3)">كلاب</div><div style="font-size:22px;font-weight:900;color:#c0392b">${counts['كلب']||0}</div><div style="font-size:10px;color:var(--tx3)">حجم+هامش منخفضان</div></div>
  </div>
  <div class="dc"><canvas id="bcg_scatter" height="300"></canvas></div>
  <div class="dc" style="margin-top:14px"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>الجمعية</th><th>التصنيف</th><th>المبيعات</th><th>الهامش</th><th>النمو (٣ش)</th></tr></thead><tbody>`;
  pts.sort((a,b)=>b.s-a.s).forEach(p=>{
    h+=`<tr><td style="font-weight:600">${SN(p.nm)}</td><td><span style="color:${p.col};font-weight:700">${p.ico} ${p.quad}</span></td><td>${KD(p.s)}</td><td>${PC(p.gp)}</td><td style="color:${p.growth>=0?'var(--grn)':'var(--red)'}">${p.growth>=0?'▲':'▼'} ${PC(Math.abs(p.growth))}</td></tr>`;
  });
  h+=`</tbody></table></div></div>`;
  box.innerHTML=h;

  // رسم scatter
  const byQuad={};pts.forEach(p=>{(byQuad[p.quad]=byQuad[p.quad]||[]).push({x:p.s,y:p.gp,nm:SN(p.nm)});});
  const qcol={'نجم':'#1e8449','بقرة نقدية':'#2563a8','علامة استفهام':'#cc7722','كلب':'#c0392b'};
  MK('bcg_scatter',{type:'scatter',data:{datasets:Object.keys(byQuad).map(q=>({label:q,data:byQuad[q],backgroundColor:qcol[q],pointRadius:7,pointHoverRadius:10}))},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{family:'Tajawal'}}},tooltip:{callbacks:{label:c=>c.raw.nm+': '+fmt(c.raw.x)+' د.ك / '+c.raw.y.toFixed(1)+'%'}}},
    scales:{x:{title:{display:true,text:'المبيعات (د.ك)',font:{family:'Tajawal'}},ticks:{font:{family:'Tajawal'}}},y:{title:{display:true,text:'هامش الربح %',font:{family:'Tajawal'}},ticks:{font:{family:'Tajawal'}}}}}});
}

// ═══════════ ٦) أداء المناديب عبر الزمن (اتجاه التحقيق) ═══════════
function stratAgentPerf(box,fa,fb){
  fa=fa||0; fb=(fb!=null)?fb:(O.ml.length-1);
  // مفاتيح الأشهر ضمن النطاق المفلتر
  const rangeKeys=new Set();for(let k=fa;k<=fb;k++)if(O.mk[k])rangeKeys.add(O.mk[k]);
  const summ=(O.agentSummary||[]).filter(r=>rangeKeys.has(r.mk));
  if(!summ.length){box.innerHTML='<div class="merge-sec"><span class="merge-tag">🎯 تحليل ٣</span><h2 style="margin:0">أداء المناديب عبر الزمن</h2></div><div class="ali" style="background:rgba(37,99,168,.07);border-color:rgba(37,99,168,.2)"><span>📅</span><div style="font-size:12.5px;line-height:1.7">لا تتوفر بيانات أهداف/تحقيق للمناديب ضمن الفترة المختارة (<b>'+O.ml[fa]+' ← '+O.ml[fb]+'</b>). بيانات أهداف المناديب متاحة من يناير حتى مايو 2026 — اختر فترة تتقاطع معها.</div></div>';return;}
  // الأشهر المتاحة مرتبة
  const months=[...new Set(summ.map(r=>r.mk))].sort();
  const agents=[...new Set(summ.map(r=>r.agent))];
  // لكل مندوب: سلسلة نسبة التحقيق شهرياً + الاتجاه
  const series=agents.map(ag=>{
    const pts=months.map(m=>{const rec=summ.find(r=>r.agent===ag&&r.mk===m);return rec?{target:rec.target,achieved:rec.achieved,pct:rec.pct}:null;});
    const validPts=pts.filter(p=>p&&p.target>0);
    const avgPct=validPts.length?validPts.reduce((a,p)=>a+p.pct,0)/validPts.length:0;
    // الاتجاه: مقارنة آخر نقطة صالحة بأول نقطة صالحة
    const first=validPts[0], last=validPts[validPts.length-1];
    const trend=(first&&last)?last.pct-first.pct:0;
    const totTarget=validPts.reduce((a,p)=>a+p.target,0);
    const totAch=validPts.reduce((a,p)=>a+p.achieved,0);
    return {ag,pts,avgPct,trend,totTarget,totAch,cumPct:totTarget>0?totAch/totTarget*100:0};
  }).sort((a,b)=>b.cumPct-a.cumPct);

  let h=`<div class="merge-sec"><span class="merge-tag">🎯 تحليل ٣</span><h2 style="margin:0">أداء المناديب عبر الزمن — اتجاه تحقيق الأهداف</h2></div>
  <p style="color:var(--tx2);font-size:13px;margin:-6px 0 16px;line-height:1.8">نسبة تحقيق كل مندوب لهدفه شهرياً، مع <b>اتجاه الأداء</b> (هل يتحسّن أم يتراجع) ومعدل التحقيق <b>التراكمي</b>. الفترة: ${months[0]} ← ${months[months.length-1]}.</p>
  <div class="dc"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>المندوب</th><th>الهدف التراكمي</th><th>المحقق التراكمي</th><th>نسبة التحقيق</th><th>الاتجاه</th>${months.map(m=>`<th style="font-size:10px">${m.slice(5)}</th>`).join('')}</tr></thead><tbody>`;
  series.forEach(s=>{
    const tcol=s.trend>5?'var(--grn)':s.trend<-5?'var(--red)':'var(--tx3)';
    const tico=s.trend>5?'▲ متحسّن':s.trend<-5?'▼ متراجع':'■ مستقر';
    const pcol=s.cumPct>=80?'var(--grn)':s.cumPct>=50?'var(--orn)':'var(--red)';
    h+=`<tr><td style="font-weight:700">${s.ag}</td><td>${KD(s.totTarget)}</td><td>${KD(s.totAch)}</td>
      <td><span style="color:${pcol};font-weight:800">${PC(s.cumPct)}</span></td>
      <td style="color:${tcol};font-weight:700">${tico}</td>`;
    s.pts.forEach(p=>{
      if(!p||p.target===0){h+=`<td style="color:var(--tx3)">—</td>`;}
      else{const c=p.pct>=80?'var(--grn)':p.pct>=50?'var(--orn)':'var(--red)';h+=`<td style="color:${c};font-size:11px">${Math.round(p.pct)}%</td>`;}
    });
    h+=`</tr>`;
  });
  h+=`</tbody></table></div></div>
  <div class="dc" style="margin-top:14px"><canvas id="agtg_trend" height="260"></canvas></div>`;
  box.innerHTML=h;

  MK('agtg_trend',{type:'line',data:{labels:months.map(m=>m.slice(5)),datasets:series.map((s,i)=>({label:s.ag,data:s.pts.map(p=>p&&p.target>0?+p.pct.toFixed(1):null),borderColor:PAL[i%PAL.length],backgroundColor:'transparent',tension:.3,spanGaps:true,pointRadius:4}))},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{family:'Tajawal'}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.parsed.y+'%'}}},scales:{y:{title:{display:true,text:'نسبة التحقيق %',font:{family:'Tajawal'}},ticks:{font:{family:'Tajawal'}}},x:{ticks:{font:{family:'Tajawal'}}}}}});
}

// ═══════════ ٧) إنذار الفقدان المبكر (Churn Risk) ═══════════
function stratChurn(box,S,fa,fb){
  fa=fa||0; fb=(fb!=null)?fb:(O.ml.length-1);
  const ml=O.ml||[];
  // آخر شهر نشط ضمن النطاق المفلتر (لا يتجاوز fb)
  let lastActive=fb;
  while(lastActive>fa){const any=(O.mon||[]).some(m=>(m.v||[])[lastActive]>0);if(any)break;lastActive--;}
  const monMap={};(O.mon||[]).forEach(m=>monMap[m.nm]=m.v||[]);

  const risk=S.filter(s=>s.s>0).map(s=>{
    const v=monMap[s.nm]||[];
    // آخر 3 أشهر نشطة ضمن النطاق (لا تنزل تحت fa)
    const g=k=>(k>=fa&&k<=fb)?N(v[k]):0;
    const m1=g(lastActive), m2=g(lastActive-1), m3=g(lastActive-2);
    const m4=g(lastActive-3), m5=g(lastActive-4), m6=g(lastActive-5);
    const recent3=m1+m2+m3, prev3=m4+m5+m6;
    // إشارات الخطر
    const declining=(m3>m2&&m2>m1&&m1>=0);  // انخفاض متتالي 3 أشهر
    const dropPct=prev3>0?(recent3-prev3)/prev3*100:0;
    const zeroLast=m1===0&&m2>0;  // توقف في آخر شهر
    const zeroStreak=(m1===0?1:0)+(m1===0&&m2===0?1:0);
    // درجة الخطر 0-100
    let score=0;
    if(declining)score+=35;
    if(dropPct<=-50)score+=35;else if(dropPct<=-30)score+=25;else if(dropPct<=-15)score+=15;
    if(zeroLast)score+=20;
    if(m1===0&&m2===0)score+=30;
    score=Math.min(100,score);
    let level,col;
    if(score>=60){level='حرج';col='#c0392b';}
    else if(score>=35){level='مرتفع';col='#cc7722';}
    else if(score>=15){level='متابعة';col='#b8932f';}
    else{level='مستقر';col='#1e8449';}
    return {nm:s.nm,s:s.s,m1,m2,m3,recent3,prev3,dropPct,declining,zeroLast,score,level,col};
  }).sort((a,b)=>b.score-a.score);

  const atRisk=risk.filter(r=>r.score>=35);
  const atRiskSales=atRisk.reduce((a,r)=>a+r.s,0);
  const totSales=risk.reduce((a,r)=>a+r.s,0);

  let h=`<div class="merge-sec"><span class="merge-tag">⚠️ تحليل ٤</span><h2 style="margin:0">إنذار الفقدان المبكر — جمعيات معرّضة للتعثّر</h2></div>
  <p style="color:var(--tx2);font-size:13px;margin:-6px 0 16px;line-height:1.8">كشف وقائي للجمعيات التي تُظهر <b>انخفاضاً متتالياً</b> أو <b>توقفاً</b> في الشراء — قبل فقدانها نهائياً. درجة الخطر تجمع: الانخفاض المتتالي، نسبة التراجع، والتوقف الأخير.</p>
  <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px">
    <div class="dc" style="text-align:center;border:1px solid rgba(192,57,43,.4)"><div style="font-size:11px;color:var(--tx3)">جمعيات في خطر</div><div style="font-size:22px;font-weight:900;color:var(--red)">${atRisk.length}</div><div style="font-size:11px;color:var(--tx3)">من ${risk.length}</div></div>
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">مبيعات معرّضة</div><div style="font-size:22px;font-weight:900;color:var(--orn)">${KD(atRiskSales)}</div><div style="font-size:11px;color:var(--tx3)">${PC(totSales>0?atRiskSales/totSales*100:0)} من الإجمالي</div></div>
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">حالات حرجة</div><div style="font-size:22px;font-weight:900;color:var(--red)">${risk.filter(r=>r.level==='حرج').length}</div></div>
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">مستقرة</div><div style="font-size:22px;font-weight:900;color:var(--grn)">${risk.filter(r=>r.level==='مستقر').length}</div></div>
  </div>
  <div class="dc"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>الجمعية</th><th>الخطر</th><th>الدرجة</th><th>المبيعات السنوية</th><th>آخر ٣ أشهر</th><th>التغيّر</th><th>الإشارات</th></tr></thead><tbody>`;
  risk.filter(r=>r.score>=15).forEach(r=>{
    const signals=[];if(r.declining)signals.push('انخفاض متتالٍ');if(r.zeroLast)signals.push('توقف أخير');if(r.dropPct<=-30)signals.push('تراجع حاد');
    h+=`<tr><td style="font-weight:600">${SN(r.nm)}</td>
      <td><span style="color:${r.col};font-weight:800">${r.level}</span></td>
      <td><div style="display:flex;align-items:center;gap:6px"><span style="font-weight:700;color:${r.col}">${r.score}</span><div style="flex:1;height:5px;background:var(--surf2);border-radius:3px;min-width:30px"><div style="width:${r.score}%;height:100%;background:${r.col};border-radius:3px"></div></div></div></td>
      <td>${KD(r.s)}</td><td>${KD(r.recent3)}</td>
      <td style="color:${r.dropPct>=0?'var(--grn)':'var(--red)'}">${r.dropPct>=0?'▲':'▼'} ${PC(Math.abs(r.dropPct))}</td>
      <td style="font-size:11px;color:var(--tx3)">${signals.join(' · ')||'—'}</td></tr>`;
  });
  h+=`</tbody></table></div></div>`;
  if(atRisk.length){
    h+=`<div class="ali" style="margin-top:14px;background:rgba(192,57,43,.07);border-color:rgba(192,57,43,.25)"><span>🚨</span><div style="font-size:12.5px;line-height:1.85"><b>تنبيه تنفيذي:</b> ${atRisk.length} جمعية تمثّل ${KD(atRiskSales)} (${PC(totSales>0?atRiskSales/totSales*100:0)} من مبيعاتك) في خطر التعثّر. أولوية التدخّل: ${atRisk.slice(0,3).map(r=>SN(r.nm)).join('، ')}. زيارة ميدانية أو عرض تحفيزي قبل الفقدان الكامل.</div></div>`;
  }
  box.innerHTML=h;
}

// ═══════════ ٨) سيناريوهات التنبؤ (متفائل/أساسي/متحفظ) ═══════════
function stratForecast(box,fa,fb){
  fa=fa||0; fb=(fb!=null)?fb:(O.ml.length-1);
  const ml=O.ml||[], mt=O.mt||[];
  // آخر شهر نشط ضمن النطاق المفلتر
  let lastActive=fb;
  while(lastActive>fa){if((mt[lastActive]||0)>0)break;lastActive--;}
  // سلسلة المبيعات الشهرية النشطة ضمن النطاق المفلتر فقط
  const hist=[];for(let i=fa;i<=lastActive;i++)hist.push({lbl:ml[i],v:mt[i]||0});
  const activeHist=hist.filter(h=>h.v>0);
  if(activeHist.length<3){box.innerHTML='<div class="merge-sec"><span class="merge-tag">🔮 تحليل ٥</span><h2 style="margin:0">سيناريوهات التنبؤ</h2></div><div class="ali" style="background:rgba(37,99,168,.07);border-color:rgba(37,99,168,.2)"><span>📊</span><div style="font-size:12.5px;line-height:1.7">تحتاج ٣ أشهر نشطة على الأقل لبناء تنبؤ موثوق. الفترة المختارة (<b>'+O.ml[fa]+' ← '+O.ml[fb]+'</b>) تحتوي '+activeHist.length+' شهر نشط فقط — وسّع الفترة.</div></div>';return;}

  // الانحدار الخطي على آخر حتى 6 أشهر نشطة
  const window=activeHist.slice(-6);
  const n=window.length;
  const xs=window.map((_,i)=>i), ys=window.map(h=>h.v);
  const sx=xs.reduce((a,b)=>a+b,0), sy=ys.reduce((a,b)=>a+b,0);
  const sxy=xs.reduce((a,x,i)=>a+x*ys[i],0), sxx=xs.reduce((a,x)=>a+x*x,0);
  const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx||1);
  const intercept=(sy-slope*sx)/n;
  // الانحراف المعياري للبواقي (لبناء النطاقات)
  const resid=ys.map((y,i)=>y-(intercept+slope*i));
  const stdErr=Math.sqrt(resid.reduce((a,r)=>a+r*r,0)/Math.max(1,n-2));
  const avgV=sy/n;

  // توقع 3 أشهر قادمة
  const FCN=3;
  const fc=[];
  for(let k=1;k<=FCN;k++){
    const base=Math.max(0,intercept+slope*(n-1+k));
    fc.push({
      lbl:'+'+k,
      base:base,
      opt:base+stdErr*1.2,
      cons:Math.max(0,base-stdErr*1.2)
    });
  }
  const sumBase=fc.reduce((a,f)=>a+f.base,0);
  const sumOpt=fc.reduce((a,f)=>a+f.opt,0);
  const sumCons=fc.reduce((a,f)=>a+f.cons,0);
  const trendTxt=slope>0?'صاعد':slope<0?'هابط':'مستقر';

  let h=`<div class="merge-sec"><span class="merge-tag">🔮 تحليل ٥</span><h2 style="margin:0">سيناريوهات التنبؤ — ٣ أشهر قادمة</h2></div>
  <p style="color:var(--tx2);font-size:13px;margin:-6px 0 16px;line-height:1.8">توقع المبيعات بثلاثة سيناريوهات بناءً على اتجاه آخر ${n} أشهر نشطة (الاتجاه: <b>${trendTxt}</b>). النطاقات محسوبة من تذبذب الأداء الفعلي (الانحراف المعياري ${KD(stdErr)}).</p>
  <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
    <div class="dc" style="text-align:center;border-top:3px solid #1e8449"><div style="font-size:12px;color:var(--tx3)">📈 متفائل (٣ أشهر)</div><div style="font-size:22px;font-weight:900;color:#1e8449">${KD(sumOpt)}</div></div>
    <div class="dc" style="text-align:center;border-top:3px solid #2563a8"><div style="font-size:12px;color:var(--tx3)">📊 أساسي (٣ أشهر)</div><div style="font-size:22px;font-weight:900;color:#2563a8">${KD(sumBase)}</div></div>
    <div class="dc" style="text-align:center;border-top:3px solid #cc7722"><div style="font-size:12px;color:var(--tx3)">📉 متحفّظ (٣ أشهر)</div><div style="font-size:22px;font-weight:900;color:#cc7722">${KD(sumCons)}</div></div>
  </div>
  <div class="dc"><canvas id="fcs_chart" height="280"></canvas></div>
  <div class="dc" style="margin-top:14px"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>الشهر</th><th>متحفّظ</th><th>أساسي</th><th>متفائل</th></tr></thead><tbody>`;
  fc.forEach(f=>h+=`<tr><td style="font-weight:600">الشهر ${f.lbl}</td><td style="color:#cc7722">${KD(f.cons)}</td><td style="color:#2563a8;font-weight:700">${KD(f.base)}</td><td style="color:#1e8449">${KD(f.opt)}</td></tr>`);
  h+=`</tbody></table></div></div>
  <div class="ali" style="margin-top:14px;background:rgba(37,99,168,.07);border-color:rgba(37,99,168,.25)"><span>💡</span><div style="font-size:12.5px;line-height:1.85"><b>للتخطيط:</b> استخدم السيناريو <b>المتحفّظ (${KD(sumCons)})</b> لالتزامات السيولة والمخزون الآمن، و<b>الأساسي (${KD(sumBase)})</b> للموازنة التشغيلية، و<b>المتفائل (${KD(sumOpt)})</b> لتحديد سقف الطاقة. الفجوة بين المتحفّظ والمتفائل (${KD(sumOpt-sumCons)}) تقيس عدم اليقين الحالي.</div></div>`;
  box.innerHTML=h;

  // رسم: تاريخي + 3 سيناريوهات
  const histLabels=window.map(h=>h.lbl);
  const fcLabels=fc.map(f=>'الشهر '+f.lbl);
  const allLabels=[...histLabels,...fcLabels];
  const histData=[...ys,...Array(FCN).fill(null)];
  const baseData=[...Array(n).fill(null),...fc.map(f=>+f.base.toFixed(0))];baseData[n-1]=ys[n-1];
  const optData=[...Array(n).fill(null),...fc.map(f=>+f.opt.toFixed(0))];optData[n-1]=ys[n-1];
  const consData=[...Array(n).fill(null),...fc.map(f=>+f.cons.toFixed(0))];consData[n-1]=ys[n-1];
  MK('fcs_chart',{type:'line',data:{labels:allLabels,datasets:[
    {label:'فعلي',data:histData,borderColor:'#1F2A44',backgroundColor:'transparent',tension:.3,pointRadius:4,borderWidth:2.5},
    {label:'متفائل',data:optData,borderColor:'#1e8449',borderDash:[5,4],backgroundColor:'transparent',tension:.3,pointRadius:3},
    {label:'أساسي',data:baseData,borderColor:'#2563a8',borderDash:[5,4],backgroundColor:'transparent',tension:.3,pointRadius:3},
    {label:'متحفّظ',data:consData,borderColor:'#cc7722',borderDash:[5,4],backgroundColor:'transparent',tension:.3,pointRadius:3}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{family:'Tajawal'}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+(c.parsed.y!=null?fmt(c.parsed.y)+' د.ك':'—')}}},scales:{y:{ticks:{font:{family:'Tajawal'}}},x:{ticks:{font:{family:'Tajawal'}}}}}});
}



// ═══════════ ٤) تحليل التحصيل بالشيكات ═══════════
function stratChecks(box,fa,fb){
  fa=fa||0; fb=(fb!=null)?fb:(O.ml.length-1);
  // مفاتيح الأشهر ضمن النطاق المفلتر — تُقصر الشيكات على الفترة المختارة
  const rangeKeys=new Set();for(let k=fa;k<=fb;k++)if(O.mk[k])rangeKeys.add(O.mk[k]);
  const allChecks=O.checks||[];
  const checks=allChecks.filter(c=>rangeKeys.has(c.mk));
  if(!checks.length){box.innerHTML='<div class="merge-sec"><span class="merge-tag">💵 تحليل ٦</span><h2 style="margin:0">تحليل التحصيل بالشيكات</h2></div><div class="ali" style="background:rgba(184,147,47,.08);border-color:rgba(184,147,47,.25)"><span>📄</span><div style="font-size:12.5px;line-height:1.7">لا توجد شيكات مسجّلة ضمن الفترة المختارة (<b>'+O.ml[fa]+' ← '+O.ml[fb]+'</b>). جرّب فترة أوسع.</div></div>';return;}
  const totChk=checks.reduce((a,c)=>a+N(c.cr),0);
  const totCollect=N((D.T||O.T||{}).c)||0;
  const chkPct=totCollect>0?totChk/totCollect*100:0;
  const avgChk=totChk/checks.length;

  // التوزيع الشهري
  const byMonth={};
  checks.forEach(c=>{const m=c.mk||'غير محدد';byMonth[m]=(byMonth[m]||0)+N(c.cr);});
  const monthsSorted=Object.keys(byMonth).filter(m=>m!=='غير محدد').sort();
  // اتجاه التحصيل (آخر 3 مقابل سابقتها)
  const mVals=monthsSorted.map(m=>byMonth[m]);
  const recent3=mVals.slice(-3).reduce((a,b)=>a+b,0);
  const prev3=mVals.slice(-6,-3).reduce((a,b)=>a+b,0);
  const trend=prev3>0?(recent3-prev3)/prev3*100:0;

  // حسب الجمعية
  const byClient={};
  checks.forEach(c=>{const k=c.cl||'—';if(!byClient[k])byClient[k]={sum:0,cnt:0};byClient[k].sum+=N(c.cr);byClient[k].cnt++;});
  const clientRows=Object.entries(byClient).map(([k,v])=>({nm:k,sum:v.sum,cnt:v.cnt})).sort((a,b)=>b.sum-a.sum);

  let h=`<div class="merge-sec"><span class="merge-tag">💵 تحليل ٦</span><h2 style="margin:0">تحليل التحصيل بالشيكات</h2></div>
  <p style="color:var(--tx2);font-size:13px;margin:-6px 0 16px;line-height:1.8">الشيكات هي القناة الرئيسية لتحصيل الذمم. هذا التحليل يكشف <b>حجم وإيقاع</b> التحصيل بالشيكات، أي الجمعيات تدفع بها، واتجاه التحصيل عبر الزمن — من سجل الحركات الفعلي (نوع الحركة «شيك»).</p>
  <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:18px">
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">إجمالي الشيكات</div><div style="font-size:22px;font-weight:900;color:var(--gd)">${KD(totChk)}</div><div style="font-size:11px;color:var(--tx3)">${checks.length} شيك</div></div>
    <div class="dc" style="text-align:center;border:1px solid rgba(30,132,73,.35)"><div style="font-size:11px;color:var(--tx3)">نسبة من التحصيل</div><div style="font-size:22px;font-weight:900;color:var(--grn)">${PC(chkPct)}</div><div style="font-size:11px;color:var(--tx3)">من ${KD(totCollect)}</div></div>
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">متوسط قيمة الشيك</div><div style="font-size:22px;font-weight:900;color:var(--tx)">${KD(avgChk)}</div></div>
    <div class="dc" style="text-align:center"><div style="font-size:11px;color:var(--tx3)">اتجاه التحصيل</div><div style="font-size:22px;font-weight:900;color:${trend>=0?'var(--grn)':'var(--red)'}">${trend>=0?'▲':'▼'} ${PC(Math.abs(trend))}</div><div style="font-size:11px;color:var(--tx3)">آخر ٣ أشهر</div></div>
  </div>
  <div class="dc"><h3 style="margin:0 0 12px;font-size:15px;color:var(--gd)">📈 التحصيل الشهري بالشيكات</h3><canvas id="chk_monthly" height="240"></canvas></div>
  <div class="dc" style="margin-top:14px"><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>#</th><th>الجمعية</th><th>عدد الشيكات</th><th>إجمالي القيمة</th><th>متوسط الشيك</th><th>نسبة</th></tr></thead><tbody>`;
  clientRows.forEach((r,i)=>{
    const pct=totChk>0?r.sum/totChk*100:0;
    h+=`<tr><td style="color:var(--tx3)">${i+1}</td><td style="font-weight:600">${SN(r.nm)}</td><td>${r.cnt}</td><td style="font-weight:700">${KD(r.sum)}</td><td>${KD(r.sum/r.cnt)}</td>
      <td><div style="display:flex;align-items:center;gap:6px"><span>${PC(pct)}</span><div style="flex:1;height:5px;background:var(--surf2);border-radius:3px;min-width:30px"><div style="width:${Math.min(100,pct*2.5)}%;height:100%;background:var(--gd);border-radius:3px"></div></div></div></td></tr>`;
  });
  h+=`</tbody></table></div></div>
  <div class="ali" style="margin-top:14px;background:rgba(184,147,47,.08);border-color:rgba(184,147,47,.28)"><span>💡</span><div style="font-size:12.5px;line-height:1.85"><b>رؤية مالية:</b> ${PC(chkPct)} من تحصيلك يتم عبر الشيكات — قناة شبه وحيدة. أعلى ٣ جمعيات (${clientRows.slice(0,3).map(r=>SN(r.nm)).join('، ')}) تمثّل ${PC(totChk>0?clientRows.slice(0,3).reduce((a,r)=>a+r.sum,0)/totChk*100:0)} من قيمة الشيكات. مراقبة انتظام شيكات هذه الجمعيات حيوية لاستقرار السيولة.</div></div>`;
  box.innerHTML=h;

  // رسم شهري
  MK('chk_monthly',{type:'bar',data:{labels:monthsSorted,datasets:[{label:'تحصيل بالشيكات (د.ك)',data:monthsSorted.map(m=>+byMonth[m].toFixed(0)),backgroundColor:'#b8932f',borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmt(c.parsed.y)+' د.ك'}}},scales:{y:{ticks:{font:{family:'Tajawal'}}},x:{ticks:{font:{family:'Tajawal'}}}}}});
}


function pageLG(pg){
  const TX=O.tx||[];
  const manualCount = TX.filter(t => t.source === 'manual' || (t.id && t.id.startsWith('TX-MAN'))).length;
  pg.innerHTML=`
  <div class="dc">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <h3 style="margin:0">📋 سجل المعاملات (${fmt(O.txn||TX.length)} معاملة${manualCount?'، '+manualCount+' يدوية':''})</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="openTxModal()" style="background:linear-gradient(135deg,#c0392b,#922b21);color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit">💸 إضافة حركة يدوية</button>
        <button onclick="quickAddPayment()" style="background:#27ae60;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit">⚡ تحصيل سريع</button>
        <button onclick="quickAddSale()" style="background:#d35400;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit">⚡ فاتورة سريعة</button>
      </div>
    </div>
    <input type="text" id="txs" placeholder="بحث بالجمعية أو نوع المعاملة...">
    <div id="tbl">${renderTX(TX.slice(0,150))}</div>
  </div>`;
  $('txs').oninput=function(){
    const q=this.value.trim().toLowerCase();
    const f=q?TX.filter(t=>(t.cl||'').toLowerCase().includes(q)||(t.tp||'').includes(q)):TX;
    $('tbl').innerHTML=renderTX(f.slice(0,150));
  };
}
function renderTX(rows){
  // دالة لتحديد الأيقونة/اللون من نوع الحركة
  const typeBadge = (tp) => {
    const types = (typeof getTxTypes === 'function') ? getTxTypes() : [];
    const t = types.find(x => x.code === tp || x.id === tp);
    const icon = t?.icon || '📌';
    const color = t?.dir === 'D' ? 'by' : t?.dir === 'C' ? 'bg' : 'bb';
    return `<span class="bd ${color}" title="${tp}">${icon} ${t?.label || tp}</span>`;
  };
  // دالة لعرض المبلغ حسب الاتجاه
  const amount = (r) => {
    const types = (typeof getTxTypes === 'function') ? getTxTypes() : [];
    const t = types.find(x => x.code === r.tp || x.id === r.tp);
    const amt = r.amount || r.db || r.cr || 0;
    if (amt <= 0) return '—';
    const isDebit = t?.dir === 'D' || (!t && (r.db > 0 || r.tp === 'فاتوره' || r.tp === 'opening'));
    return `<b style="color:${isDebit ? 'var(--gd)' : 'var(--grn)'}">${KD(amt)}</b>`;
  };
  const isManual = (r) => (r.source === 'manual' || (r.id && r.id.startsWith('TX-MAN')));
  return TB(rows,[
    ['التاريخ', r => r.dt || '—'],
    ['البيان', r => typeBadge(r.tp) + (isManual(r) ? ' <span style="background:#f39c12;color:#fff;padding:1px 5px;border-radius:4px;font-size:9px;margin-right:4px">يدوي</span>' : '')],
    ['الجمعية', r => `<span title="${r.cl}">${SN(r.cl || '')}</span>`],
    ['المندوب', r => r.ag || '—'],
    ['المبلغ', r => amount(r)],
    ['الفاتورة', r => r.i || r.invoice || '—'],
    ['الإجراءات', r => {
      if (!r.id) return '—';
      return `<button onclick="deleteTx('${r.id.replace(/'/g,"\\'")}')" title="حذف" style="background:#c0392b;color:#fff;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;font-family:inherit">🗑️</button>`;
    }],
  ]);
}

function deleteTx(txId) {
  const tx = O.tx.find(t => t.id === txId);
  if (!tx) { showToast('خطأ', 'المعاملة غير موجودة', false); return; }
  if (!confirm(`هل تريد حذف هذه المعاملة؟\n\n${tx.tp} - ${tx.cl} - ${(tx.amount||0).toFixed(3)} د.ك\nهذا الإجراء نهائي!`)) return;
  
  // عكس التأثير على O.mon و O.soc
  try {
    const monthKey = (tx.dt || '').slice(0, 7);
    const monthIdx = (O.mk || []).indexOf(monthKey);
    if (monthIdx >= 0) {
      const typeInfo = (typeof getTxTypes === 'function') ? getTxTypes().find(t => t.code === tx.tp || t.id === tx.tp) : null;
      const aff = typeInfo?.affects || 'sales';
      const amount = tx.amount || 0;
      const qty = tx.qty || tx.q || 0;
      const mon = O.mon.find(m => m.nm === (tx.client || tx.cl));
      if (mon) {
        if (aff === 'sales' || aff === 'opening' || aff === 'debit_notes' || aff === 'payments_out') {
          mon.v[monthIdx] = (mon.v[monthIdx] || 0) - amount;
        } else if (aff === 'collections') {
          mon.c[monthIdx] = (mon.c[monthIdx] || 0) - amount;
        } else if (aff === 'sales_return') {
          mon.v[monthIdx] = (mon.v[monthIdx] || 0) + amount;
        } else {
          mon.v[monthIdx] = (mon.v[monthIdx] || 0) - amount;
        }
        mon.q[monthIdx] = (mon.q[monthIdx] || 0) - qty;
      }
      const soc = O.soc.find(x => x.nm === (tx.client || tx.cl));
      if (soc) {
        if (aff === 'sales' || aff === 'opening' || aff === 'debit_notes' || aff === 'payments_out') {
          soc.s = +(soc.s || 0) - amount;
          soc.q = +(soc.q || 0) - qty;
        } else if (aff === 'collections') {
          soc.c = +(soc.c || 0) - amount;
        } else if (aff === 'sales_return') {
          soc.s = +(soc.s || 0) + amount;
        } else {
          soc.s = +(soc.s || 0) - amount;
        }
      }
    }
  } catch(e) { Logger.warn('reverse:', e); }
  
  O.tx = O.tx.filter(t => t.id !== txId);
  try { nayefSaveData(); } catch(e) {}
  try {
    const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
    const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
    if (typeof recompute === 'function') recompute(a, b);
  } catch(e) {}
  draw('lg');
  showToast('🗑️ تم الحذف', `${tx.tp} - ${tx.cl}`, true);
  if (typeof AuditLog !== 'undefined') {
    try { AuditLog.log('tx_delete', '🗑️ حذف معاملة', { id: txId, tp: tx.tp, cl: tx.cl, amount: tx.amount }); } catch(e) {}
  }
}

function pageCP(pg){
  const M=O.ml, n=M.length;
  const half=Math.floor(n/2);
  pg.innerHTML=`
  <div class="dc"><h3>⚖️ مقارنة فترتين</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">
      <div style="border:1px solid var(--brd);border-radius:8px;padding:11px">
        <div style="color:var(--blu);font-weight:700;margin-bottom:7px">📊 الفترة أ</div>
        من <select class="fsel" id="cA1">${M.map((m,i)=>`<option value="${i}" ${i===0?'selected':''}>${m}</option>`).join('')}</select>
        إلى <select class="fsel" id="cA2">${M.map((m,i)=>`<option value="${i}" ${i===half-1?'selected':''}>${m}</option>`).join('')}</select>
      </div>
      <div style="border:1px solid var(--brd);border-radius:8px;padding:11px">
        <div style="color:var(--gd);font-weight:700;margin-bottom:7px">📈 الفترة ب</div>
        من <select class="fsel" id="cB1">${M.map((m,i)=>`<option value="${i}" ${i===half?'selected':''}>${m}</option>`).join('')}</select>
        إلى <select class="fsel" id="cB2">${M.map((m,i)=>`<option value="${i}" ${i===n-1?'selected':''}>${m}</option>`).join('')}</select>
      </div>
    </div>
    <button class="fbtn" onclick="runCP()">مقارنة ◀</button>
  </div>
  <div id="cpr"></div>`;
}
function runCP(){
  const a1=+$('cA1').value,a2=+$('cA2').value,b1=+$('cB1').value,b2=+$('cB2').value;
  // مصاريف فترة [f,t] من O.expenses (مجموع الأشهر ضمن النطاق)
  const expOf=(f,t)=>{
    if(!O.expenses||!O.expenses.monthlyTotal)return 0;
    const keys=O.mk||[]; let e=0;
    for(let k=f;k<=t;k++){const mk=keys[k];if(mk&&O.expenses.monthlyTotal[mk])e+=O.expenses.monthlyTotal[mk];}
    return +e.toFixed(2);
  };
  const calc=(f,t)=>{
    let s=0,c=0;
    O.soc.forEach(sc=>{
      const mr=O.mon.find(m=>m.nm===sc.nm)||{v:[],c:[]};
      for(let k=f;k<=t;k++){s+=N(mr.v[k]);c+=N(mr.c[k]);}
    });
    const r=O.T.s>0?O.T.co/O.T.s:0;
    const gross=+(s-s*r).toFixed(2);
    const exp=expOf(f,t);
    const net=+(gross-exp).toFixed(2);
    return{s:+s.toFixed(2),co:+(s*r).toFixed(2),pr:gross,c:+c.toFixed(2),exp,net,lb:O.ml[f]+' ← '+O.ml[t]};
  };
  const A=calc(a1,a2),B=calc(b1,b2);
  const pct=(b,a)=>a>0?((b-a)/a*100).toFixed(1):'—';
  const col=(b,a)=>b>=a?'var(--grn)':'var(--red)';
  $('cpr').innerHTML=`
  <div class="g2">
    ${[['أ',A,'var(--blu)'],['ب',B,'var(--gd)']].map(([l,P,c])=>`
    <div class="dc"><h3 style="color:${c}">الفترة ${l}: ${P.lb}</h3>
      <div class="kg" style="grid-template-columns:1fr 1fr">
        ${KC('المبيعات',KD(P.s),'',c)}
        ${KC('مجمل الربح',KD(P.pr),PC(P.s?P.pr/P.s*100:0),'var(--grn)')}
        ${KC('المصاريف',KD(P.exp),'تشغيلية','var(--red)')}
        ${KC('صافي الربح',KD(P.net),PC(P.s?P.net/P.s*100:0),P.net>=0?'var(--grn)':'var(--red)')}
        ${KC('التحصيل',KD(P.c),PC(P.s?P.c/P.s*100:0),'#1abc9c')}
        ${KC('الذمم',KD(P.s-P.c),'','var(--red)')}
      </div>
    </div>`).join('')}
  </div>
  <div class="dc"><h3>نتيجة المقارنة ب مقابل أ</h3>
    <div class="kg">
      ${KC('تغيّر المبيعات',`<span style="color:${col(B.s,A.s)}">${B.s>=A.s?'▲':'▼'} ${pct(B.s,A.s)}%</span>`,KD(B.s-A.s),'var(--blu)')}
      ${KC('تغيّر مجمل الربح',`<span style="color:${col(B.pr,A.pr)}">${B.pr>=A.pr?'▲':'▼'} ${pct(B.pr,A.pr)}%</span>`,KD(B.pr-A.pr),'var(--pur)')}
      ${KC('تغيّر المصاريف',`<span style="color:${col(A.exp,B.exp)}">${B.exp>=A.exp?'▲':'▼'} ${pct(B.exp,A.exp)}%</span>`,KD(B.exp-A.exp),'var(--red)')}
      ${KC('تغيّر صافي الربح',`<span style="color:${col(B.net,A.net)}">${B.net>=A.net?'▲':'▼'} ${pct(B.net,A.net)}%</span>`,KD(B.net-A.net),'var(--grn)')}
      ${KC('تغيّر التحصيل',`<span style="color:${col(B.c,A.c)}">${B.c>=A.c?'▲':'▼'} ${pct(B.c,A.c)}%</span>`,KD(B.c-A.c),'#1abc9c')}
    </div>
    <canvas id="cp_c" height="70"></canvas>
  </div>`;
  setTimeout(()=>MK('cp_c',{type:'bar',data:{labels:['المبيعات','مجمل الربح','المصاريف','صافي الربح','التحصيل'],datasets:[{label:'الفترة أ',data:[A.s,A.pr,A.exp,A.net,A.c],backgroundColor:'#2563a8',borderRadius:4},{label:'الفترة ب',data:[B.s,B.pr,B.exp,B.net,B.c],backgroundColor:'#b8932f',borderRadius:4}]},options:{plugins:{legend:{labels:{font:{size:11}}}}}}),30);
}

function pageFC(pg,M,MT){
  // ════════════════════════════════════════════════════════════════════
  // صفحة التنبؤ — خطة احترافية لتقدير تارجت كل جمعية للأشهر القادمة
  // المنهجية: استبعاد الرصيد الافتتاحي، ثم مزج 4 نماذج (اتجاه خطي + متوسط
  // مرجّح بالأحدث + متوسط متحرك + وسيط) مع تصنيف الثقة حسب التشتت، وثلاثة
  // سيناريوهات (متحفظ / واقعي / طموح). كل القرارات على بيانات الجمعيات.
  // ════════════════════════════════════════════════════════════════════
  const S=D.soc||[], mon=O.mon||[];
  const monMap={}; mon.forEach(m=>monMap[m.nm]=m.v||[]);
  const ml=O.ml||[];
  // أداة الانحدار الخطي والمؤشرات لجمعية واحدة
  function median(arr){const a=arr.slice().sort((x,y)=>x-y);const n=a.length;if(!n)return 0;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;}
  function modelSoc(v){
    if(!v||!v.length)return null;
    // استبعاد أول شهر إن كان رصيداً افتتاحياً مرتفعاً شاذاً (> 2.5× متوسط الباقي)
    let series=v.slice();
    const restAvg=series.slice(1).reduce((a,b)=>a+b,0)/Math.max(1,series.length-1);
    if(series.length>4 && series[0]>2.5*restAvg && restAvg>0) series=series.slice(1);
    const nz=series.filter(x=>x>0);
    if(nz.length<3)return null;
    const n=series.length, xs=series.map((_,i)=>i);
    const sx=xs.reduce((a,b)=>a+b,0), sy=series.reduce((a,b)=>a+b,0);
    const sxy=xs.reduce((a,x,i)=>a+x*series[i],0), sxx=xs.reduce((a,x)=>a+x*x,0);
    const slope=(n*sxx-sx*sx)?(n*sxy-sx*sy)/(n*sxx-sx*sx):0;
    const ic=(sy-slope*sx)/n;
    const trend=Math.max(0,slope*n+ic);
    const ma3=series.slice(-3).reduce((a,b)=>a+b,0)/3;
    const last6=series.slice(-6), w=last6.map((_,i)=>i+1);
    const wma=last6.reduce((a,b,i)=>a+b*w[i],0)/w.reduce((a,b)=>a+b,0);
    const med6=median(last6);
    const base=0.35*trend+0.30*wma+0.20*ma3+0.15*med6;
    const mean=sy/n;
    const sd=Math.sqrt(series.reduce((a,b)=>a+(b-mean)**2,0)/n);
    const cv=mean?sd/mean:0;
    return {base:Math.max(0,base),trend,wma,ma3,med:med6,slope,cv,avg:mean,last:series[series.length-1],n:nz.length};
  }
  // احسب لكل جمعية
  let rows=S.map(s=>{const m=modelSoc(monMap[s.nm]);return m?{nm:s.nm,...m}:null;}).filter(Boolean)
            .sort((a,b)=>b.base-a.base);
  if(rows.length<1){pg.innerHTML='<div class="dc"><p style="color:var(--tx3)">يلزم 3 أشهر تشغيلية على الأقل لكل جمعية للتنبؤ بالتارجت.</p></div>';return;}
  // معامل السيناريو (افتراضي: واقعي) — يُحدّث عبر الأزرار
  const scen=window._fcScen||'real';
  const SCN={cons:{f:0.85,lbl:'متحفّظ',col:'var(--grn)'},real:{f:1.0,lbl:'واقعي',col:'var(--blu)'},amb:{f:1.15,lbl:'طموح',col:'var(--gd)'}};
  const sf=SCN[scen].f;
  const tgt=r=>Math.round(r.base*sf/5)*5; // تقريب لأقرب 5 د.ك
  // مستوى الثقة من معامل التشتت
  const conf=cv=>cv<0.35?{l:'مرتفعة',c:'var(--grn)',b:'bg'}:cv<0.65?{l:'متوسطة',c:'var(--gd)',b:'by'}:{l:'منخفضة',c:'var(--red)',b:'br'};
  const totBase=rows.reduce((a,r)=>a+r.base,0);
  const totTgt=rows.reduce((a,r)=>a+tgt(r),0);
  const totQ=totTgt*3;
  const highConf=rows.filter(r=>r.cv<0.35).length;
  const lowConf=rows.filter(r=>r.cv>=0.65).length;
  // الشهر القادم اسماً
  const MN=['ين','فب','مار','أبر','مايو','يون','يول','أغس','سبت','أكت','نوف','ديس'];
  function nextM(lbl,k){let fi=MN.findIndex(x=>lbl&&lbl.startsWith(x));if(fi<0)return'الشهر +'+k;let yr=parseInt((lbl||'').replace(MN[fi],''))||26;let mo=(fi+k)%12;return MN[mo]+(yr+Math.floor((fi+k)/12));}
  const lastLbl=ml[ml.length-1]||'';
  const nx=[nextM(lastLbl,1),nextM(lastLbl,2),nextM(lastLbl,3)];

  pg.innerHTML=`
  <div class="kg">
    ${KC('تارجت الشركة المقترح',KD(totTgt),'شهري · سيناريو '+SCN[scen].lbl,SCN[scen].col)}
    ${KC('تارجت ربع سنوي',KD(totQ),nx[0]+' ← '+nx[2],'var(--gd)')}
    ${KC('جمعيات ثقة مرتفعة',highConf+' / '+rows.length,'تشتت < 35%','var(--grn)')}
    ${KC('جمعيات تحتاج مراجعة',lowConf+' / '+rows.length,'تشتت ≥ 65%','var(--red)')}
  </div>

  <div class="dc" style="border-right:3px solid var(--gd)">
    <h3>🎯 سيناريو التنبؤ بالتارجت</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 12px">
      ${Object.keys(SCN).map(k=>`<button onclick="window._fcScen='${k}';draw('fc')" 
        style="padding:8px 18px;border-radius:8px;cursor:pointer;border:1.5px solid ${SCN[k].col};
        background:${scen===k?SCN[k].col:'transparent'};color:${scen===k?'#fff':SCN[k].col};font-weight:700;font-size:13px">
        ${SCN[k].lbl} (×${SCN[k].f})</button>`).join('')}
    </div>
    <div style="font-size:12.5px;color:var(--tx2);line-height:2">
      <b>المنهجية:</b> لكل جمعية نُحلّل سلسلتها الشهرية بعد استبعاد الرصيد الافتتاحي، ثم نمزج أربعة نماذج:
      <b style="color:var(--gd)">35% اتجاه خطّي</b> + <b style="color:var(--blu)">30% متوسط مرجّح بالأحدث</b> +
      <b style="color:var(--pur)">20% متوسط متحرك (3 أشهر)</b> + <b style="color:#1abc9c">15% وسيط</b>،
      ثم نضرب في معامل السيناريو ونقرّب لأقرب 5 د.ك. مستوى الثقة يُشتق من معامل التشتت (CV).
    </div>
  </div>

  <div class="dc"><h3>📈 إجمالي المبيعات الفعلية والتارجت المتوقع للشركة</h3><canvas id="fc_1" height="90"></canvas></div>

  <div class="dc">
    <h3>📋 خطة تارجت الجمعيات — سيناريو ${SCN[scen].lbl}</h3>
    <div class="ali blu" style="margin-bottom:12px"><span>💡</span><div style="font-size:12.5px;line-height:1.8">
      التارجت أدناه لكل جمعية للشهر الواحد. الأعمدة: المتوسط التاريخي، الاتجاه، أساس النموذج، التارجت المعتمد، والثقة.
      الجمعيات منخفضة الثقة (تشتّت عالٍ) تحتاج تقديراً يدوياً أو تثبيت تارجت محافظ.
    </div></div>
    ${TB(rows,[
      ['الجمعية',r=>`<b>${SN(r.nm)}</b>`],
      ['متوسط تاريخي',r=>KD(Math.round(r.avg))],
      ['الاتجاه',r=>`<span style="color:${r.slope>=0?'var(--grn)':'var(--red)'}">${r.slope>=0?'▲':'▼'} ${KD(Math.round(r.trend))}</span>`],
      ['أساس النموذج',r=>KD(Math.round(r.base))],
      ['🎯 التارجت المقترح',r=>`<b style="color:${SCN[scen].col};font-size:14px">${KD(tgt(r))}</b>`],
      ['تارجت ربع سنوي',r=>KD(tgt(r)*3)],
      ['الثقة',r=>{const c=conf(r.cv);return `<span class="bd ${c.b}">${c.l}</span> <span style="color:var(--tx3);font-size:11px">${(r.cv*100).toFixed(0)}%</span>`;}]
    ])}
    <div class="ali grn" style="margin-top:12px"><span>📊</span><div style="font-size:13px">
      <b>الإجمالي:</b> تارجت شهري للشركة <b style="color:${SCN[scen].col}">${KD(totTgt)}</b> ·
      ربع سنوي <b style="color:var(--gd)">${KD(totQ)}</b> · عدد الجمعيات ${rows.length}
    </div></div>
  </div>

  <div class="dc"><h3>🏆 أعلى 10 جمعيات في التارجت المقترح</h3><canvas id="fc_2" height="120"></canvas></div>`;

  const top10=rows.slice(0,10);
  setTimeout(()=>{
    // إجمالي الشركة: فعلي + متوقع 3 أشهر (مجموع تارجت الجمعيات)
    const MT2=O.mt||MT;
    const fSum=totTgt;
    MK('fc_1',{type:'line',data:{labels:[...ml,...nx],
      datasets:[
        {label:'فعلي',data:[...MT2,null,null,null],borderColor:'#b8932f',backgroundColor:'rgba(184,147,47,.15)',fill:true,tension:.35,pointRadius:2},
        {label:'تارجت متوقع',data:[...Array(MT2.length-1).fill(null),MT2[MT2.length-1],fSum,fSum,fSum],borderColor:SCN[scen].col,borderDash:[5,3],tension:.2,pointRadius:4,pointBackgroundColor:SCN[scen].col}
      ]},options:{plugins:{legend:{labels:{font:{size:11}}}},scales:{x:{ticks:{font:{size:9}}}}}});
    MK('fc_2',{type:'bar',data:{labels:top10.map(r=>SN(r.nm)),
      datasets:[
        {label:'متوسط تاريخي',data:top10.map(r=>Math.round(r.avg)),backgroundColor:'rgba(120,120,120,.45)',borderRadius:3},
        {label:'التارجت المقترح',data:top10.map(r=>tgt(r)),backgroundColor:SCN[scen].col,borderRadius:3}
      ]},options:{plugins:{legend:{labels:{font:{size:11}}}},scales:{x:{ticks:{font:{size:9}}}}}});
  },30);
}


function pageOffers(pg,S,T){
  // ════════════════════════════════════════════════════════════════════
  // صفحة عروض الجمعيات — تصنيف آلي لكل جمعية إلى شريحة + العرض المقترح +
  // حاسبة أثر الخصم على الهامش. كل التصنيف مبني على بيانات الجمعيات الفعلية.
  // ════════════════════════════════════════════════════════════════════
  const mon=O.mon||[]; const monMap={}; mon.forEach(m=>monMap[m.nm]=m.v||[]);
  const socs=D.soc||S||[];
  // الهامش العام (يحدّد قدرة الاستيعاب)
  const totSales=socs.reduce((a,s)=>a+(+s.s||0),0);
  const totGP=socs.reduce((a,s)=>a+(+s.pr||0),0);
  const gMargin=totSales? totGP/totSales*100 : 0;
  // اقتصاديات الوحدة من بيانات الأصناف (للحاسبة) — متوسط مرجّح بالمبيعات
  const items=O.it||[];
  let wuc=0.48, wup=1.488; // قيم افتراضية احتياطية
  if(items.length){const sl=items.reduce((a,x)=>a+(+x.sl||0),0)||1;
    wuc=items.reduce((a,x)=>a+(+x.uc||0)*(+x.sl||0),0)/sl;
    wup=items.reduce((a,x)=>a+(+x.up||0)*(+x.sl||0),0)/sl;}
  const unitMargin=wup>0?(wup-wuc)/wup*100:0;   // هامش المنتج (قبل المرتجعات)

  // تشخيص كل جمعية
  function diag(s){
    const v=monMap[s.nm]||[]; const op=v.slice(1); // استبعاد الرصيد الافتتاحي
    const nz=op.filter(x=>x>0);
    const last6=op.slice(-6), prev6=op.length>=12?op.slice(-12,-6):op.slice(0,-6);
    const l6=last6.reduce((a,b)=>a+b,0), p6=prev6.reduce((a,b)=>a+b,0);
    const growth = p6>0 ? (l6-p6)/p6*100 : null;
    const lastActive = op.reduce((acc,x,i)=>x>0?i:acc,-1);
    const dormant = lastActive>=0 ? op.length-1-lastActive : 99;
    const avg = op.length? op.reduce((a,b)=>a+b,0)/op.length : 0;
    const sd = op.length? Math.sqrt(op.reduce((a,b)=>a+(b-avg)**2,0)/op.length):0;
    const cv = avg? sd/avg : 0;
    const margin = s.s? (s.pr||0)/s.s*100 : 0;
    return {l6,p6,growth,dormant,avg,cv,margin};
  }
  // التصنيف إلى شرائح
  function segment(s,d){
    if(d.dormant>=2) return 'D';                     // خاملة
    if(d.growth!==null && d.growth<=-25) return 'C'; // متراجعة
    if(d.growth!==null && d.growth>=25) return 'B';  // نامية
    return 'A';                                       // مستقرة/محرّكة
  }
  const SEG={
    A:{name:'المحرّكات والمستقرة',ico:'🏛️',col:'var(--gd)',
       offer:'النمو التصاعدي: خصم على التجاوز فقط (تجاوز 10%←3% · 20%←5%)',
       disc:5, note:'الخصم على الكمية الزائدة عن الهدف — يحمي الهامش بالكامل'},
    B:{name:'النامية',ico:'🚀',col:'var(--grn)',
       offer:'كسر الحاجز: +25% ربع سنوي ← بضاعة مجانية بقيمة 5% (لا خصم نقدي)',
       disc:5, note:'بضاعة مجانية تحافظ على السعر المرجعي وتثبّت الزخم'},
    C:{name:'المتعثرة',ico:'📉',col:'var(--red)',
       offer:'الاستعادة: خصم 8% لمدة شهرين مشروط بعودة الطلب لمتوسط 12 شهراً',
       disc:8, note:'الهامش يبقى ~51% — آمن · أولوية تنفيذ عاجلة'},
    D:{name:'الخاملة',ico:'💤',col:'var(--pur)',
       offer:'إعادة التفعيل: أول طلبية بخصم 10% + توصيل مجاني + زيارة مندوب',
       disc:10, note:'إيراد نائم يُوقَظ بتكلفة زهيدة'}
  };
  let rows=socs.map(s=>{const d=diag(s);const seg=segment(s,d);return {nm:s.nm,s:+s.s||0,...d,seg};})
               .sort((a,b)=>b.s-a.s);
  const cnt={A:0,B:0,C:0,D:0}; const segSales={A:0,B:0,C:0,D:0};
  rows.forEach(r=>{cnt[r.seg]++;segSales[r.seg]+=r.s;});

  // الأثر المالي المتوقع لكل سيناريو
  function impact(upliftPct){
    // افتراض: زيادة المبيعات upliftPct% مع خصم متوسط مرجّح بالشريحة
    const newSales=totSales*(1+upliftPct/100);
    // متوسط خصم مرجّح (تقريبي على الجزء المتأثر فقط ~ نصف المحفظة)
    const wDisc=(segSales.A*0.025+segSales.B*0+segSales.C*0.08+segSales.D*0.10)/totSales;
    const newGP=newSales*(gMargin/100 - wDisc*0.5);
    return {newSales,newGP,dGP:newGP-totGP};
  }
  const scC=impact(7), scR=impact(13), scA=impact(20);

  pg.innerHTML=`
  <div class="dc" style="border-right:3px solid #e67e22">
    <h3>🎪 حاسبة المهرجان الشهري — خصم فاتورة أو بضاعة مجانية</h3>
    <div style="font-size:12.5px;color:var(--tx2);line-height:1.9;margin-bottom:12px">
      اقتصاديات منتجك: تكلفة الوحدة <b style="color:var(--gd)">${wuc.toFixed(2)} د.ك</b> ·
      سعر البيع <b style="color:var(--gd)">${wup.toFixed(2)} د.ك</b> ·
      هامش المنتج <b style="color:var(--grn)">${unitMargin.toFixed(0)}%</b>.
      المبدأ الذهبي: <b>البضاعة المجانية أرخص عليك</b> لأن الوحدة المجانية تكلّفك ${wuc.toFixed(2)} فقط لا السعر الكامل.
    </div>

    <div class="ali grn" style="margin-bottom:14px"><span>⭐</span><div style="font-size:12.5px;line-height:1.8">
      <b>التوصية الذكية:</b> اجعل عرض «اشترِ 10+1» أساس المهرجان لكل الجمعيات (خصم فعلي 9% · هامش 65% · يكلّفك ${wuc.toFixed(2)} د.ك للوحدة المجانية فقط).
      خصّص «5+1» للجمعيات النامية، و«3+1» للكبرى أو تصريف المخزون، وأضف خصم نقدي 5% للدفع الفوري لتحسين السيولة.
    </div>

    <!-- نوع العرض -->
    <div style="margin-bottom:10px;font-weight:700;color:var(--tx1);font-size:13px">١) اختر نوع العرض:</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      ${['inv','free'].map(t=>{const sel=(window._fsType||'free')===t;const lbl=t==='inv'?'💰 خصم على الفاتورة':'🎁 بضاعة مجانية (اشترِ X+Y)';
        return `<button onclick="window._fsType='${t}';draw('offers')"
        style="padding:9px 18px;border-radius:8px;cursor:pointer;border:1.5px solid #e67e22;
        background:${sel?'#e67e22':'transparent'};color:${sel?'#fff':'#e67e22'};font-weight:700;font-size:13px">${lbl}</button>`;}).join('')}
    </div>

    ${(()=>{
      const type=window._fsType||'free';
      if(type==='inv'){
        // خصم على الفاتورة
        const dz=window._fsDisc||10;
        const newPrice=wup*(1-dz/100);
        const newProfit=newPrice-wuc;
        const newMargin=newPrice>0?newProfit/newPrice*100:0;
        const uplift=newProfit>0?((wup-wuc)/newProfit-1)*100:999;
        const safe=newMargin>=55?{t:'آمن جداً',c:'var(--grn)'}:newMargin>=45?{t:'آمن',c:'var(--gd)'}:{t:'حذر — يحتاج شرط حجم',c:'var(--red)'};
        return `<div style="margin-bottom:10px;font-weight:700;font-size:13px">٢) نسبة الخصم على الفاتورة:</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">
          ${[5,8,10,12,15,20,25].map(d=>{const s=dz===d;return `<button onclick="window._fsDisc=${d};draw('offers')"
            style="padding:8px 15px;border-radius:8px;cursor:pointer;border:1.5px solid #e67e22;
            background:${s?'#e67e22':'transparent'};color:${s?'#fff':'#e67e22'};font-weight:700;font-size:13px">${d}%</button>`;}).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px">
          ${KC('السعر بعد الخصم',newPrice.toFixed(2)+' د.ك','كان '+wup.toFixed(2),'#e67e22')}
          ${KC('ربح الوحدة',newProfit.toFixed(2)+' د.ك','كان '+(wup-wuc).toFixed(2),'var(--gd)')}
          ${KC('الهامش الجديد',newMargin.toFixed(0)+'%',safe.t,safe.c)}
          ${KC('حاجز التعادل','+'+uplift.toFixed(0)+'%','زيادة الكمية المطلوبة','var(--blu)')}
        </div>
        <div class="ali ${newMargin>=45?'grn':'yel'}" style="margin-top:12px"><span>💡</span><div style="font-size:12.5px;line-height:1.7">
          بخصم فاتورة <b>${dz}%</b> يصبح السعر <b>${newPrice.toFixed(2)} د.ك</b> والهامش <b style="color:${safe.c}">${newMargin.toFixed(0)}%</b>.
          تحتاج زيادة الكمية <b>+${uplift.toFixed(0)}%</b> فقط لتعادل الربح — وكل ما فوقها ربح صافٍ.
          ${dz>15?'<b style="color:var(--red)"> ⚠️ خصم مرتفع: اربطه بحدّ أدنى للكمية أو الدفع النقدي.</b>':''}
        </div>
        <div style="background:linear-gradient(135deg,#e67e2215,transparent);border:1px dashed #e67e22;border-radius:10px;padding:14px;margin-top:12px">
          <div style="font-weight:800;color:#e67e22;font-size:13.5px;margin-bottom:10px">🔢 مثال رقمي — خصم فاتورة ${dz}% على 100 وحدة</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;color:var(--tx1);line-height:1.9">
            <div>• قبل الخصم: <b>${(100*wup).toFixed(0)} د.ك</b></div>
            <div>• بعد الخصم: <b style="color:#e67e22">${(100*newPrice).toFixed(0)} د.ك</b></div>
            <div>• قيمة الخصم: <b>${(100*(wup-newPrice)).toFixed(0)} د.ك</b></div>
            <div>• تكلفتك: <b>${(100*wuc).toFixed(0)} د.ك</b></div>
            <div>• ربحك: <b style="color:var(--gd)">${(100*newProfit).toFixed(0)} د.ك</b></div>
            <div>• الهامش: <b style="color:${safe.c}">${newMargin.toFixed(0)}%</b></div>
          </div>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd);font-size:12px;color:var(--tx2);line-height:1.7">
            خصم الفاتورة يأكل من السعر الكامل، لذا غالباً تكون <b>البضاعة المجانية أوفر</b> لنفس القيمة المعروضة على الجمعية.
          </div>
        </div></div>`;
      } else {
        // بضاعة مجانية: اشترِ buy + free مجاناً
        const buy=window._fsBuy||10, free=window._fsFree||1;
        const total=buy+free;
        const effDisc=free/total*100;                 // الخصم الفعلي على الإيراد
        const rev=buy*wup, cost=total*wuc, profit=rev-cost;
        const effProfitUnit=profit/total;             // ربح فعلي لكل وحدة مُسلّمة
        const effMargin=rev>0?profit/rev*100:0;
        const dealCost=free*wuc;                       // تكلفة الوحدات المجانية
        // المقارنة الحقيقية: لإعطاء الجمعية نفس القيمة (Y وحدة مجاناً = free×سعر البيع)
        // عبر خصم فاتورة، يكلّفك ذلك free×wup من ربحك؛ أما المجاني فيكلّفك free×wuc فقط.
        const valueToClient=free*wup;                  // القيمة التي تراها الجمعية
        const savingVsInv=valueToClient-dealCost;       // كم توفّره مقابل منح نفس القيمة بخصم فاتورة
        const safe=effMargin>=55?{t:'آمن جداً',c:'var(--grn)'}:effMargin>=45?{t:'آمن',c:'var(--gd)'}:{t:'حذر',c:'var(--red)'};
        const presets=[[12,1],[10,1],[6,1],[5,1],[4,1],[3,1]];
        return `<div style="margin-bottom:10px;font-weight:700;font-size:13px">٢) صيغة العرض (اشترِ X + Y مجاناً):</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">
          ${presets.map(([b,f])=>{const s=buy===b&&free===f;return `<button onclick="window._fsBuy=${b};window._fsFree=${f};draw('offers')"
            style="padding:8px 14px;border-radius:8px;cursor:pointer;border:1.5px solid #e67e22;
            background:${s?'#e67e22':'transparent'};color:${s?'#fff':'#e67e22'};font-weight:700;font-size:12.5px">اشترِ ${b}+${f}</button>`;}).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px">
          ${KC('الخصم الفعلي',effDisc.toFixed(1)+'%','مقابل '+total+' وحدة','#e67e22')}
          ${KC('ربح الوحدة الفعلي',effProfitUnit.toFixed(2)+' د.ك','بعد المجاني','var(--gd)')}
          ${KC('الهامش الفعلي',effMargin.toFixed(0)+'%',safe.t,safe.c)}
          ${KC('تكلفة العرض',dealCost.toFixed(2)+' د.ك','الوحدات المجانية','var(--pur)')}
        </div>
        <div class="ali grn" style="margin-top:12px"><span>🎯</span><div style="font-size:12.5px;line-height:1.7">
          عرض <b>اشترِ ${buy}+${free}</b> = خصم فعلي <b>${effDisc.toFixed(1)}%</b> لكنه يكلّفك <b>${dealCost.toFixed(2)} د.ك</b> فقط (تكلفة المجاني).
          الجمعية تراها قيمة <b>${valueToClient.toFixed(2)} د.ك</b> (بسعر البيع)، فتوفّر <b style="color:var(--grn)">${savingVsInv.toFixed(2)} د.ك</b> لكل صفقة مقابل منح نفس القيمة عبر خصم فاتورة — لأن المجاني بسعر التكلفة لا سعر البيع.
          ${effDisc>20?'<b style="color:var(--gd)"> 📦 عرض سخي: خصّصه للجمعيات الكبرى أو لتصريف المخزون.</b>':''}
        </div>
        <div style="background:linear-gradient(135deg,#e67e2215,transparent);border:1px dashed #e67e22;border-radius:10px;padding:14px;margin-top:12px">
          <div style="font-weight:800;color:#e67e22;font-size:13.5px;margin-bottom:10px">🔢 مثال رقمي — ماذا يعني «اشترِ ${buy}+${free}» عملياً؟</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;color:var(--tx1);line-height:1.9">
            <div>• الجمعية تدفع ثمن: <b>${buy} وحدة</b></div>
            <div>• تستلم فعلياً: <b style="color:var(--grn)">${total} وحدة</b></div>
            <div>• تدفع: <b>${(buy*wup).toFixed(2)} د.ك</b> (${buy}×${wup.toFixed(2)})</div>
            <div>• تكلفتك: <b>${(total*wuc).toFixed(2)} د.ك</b> (${total}×${wuc.toFixed(2)})</div>
            <div>• ربحك من الصفقة: <b style="color:var(--gd)">${(buy*wup-total*wuc).toFixed(2)} د.ك</b></div>
            <div>• الوحدات المجانية تكلّفك: <b>${dealCost.toFixed(2)} د.ك</b> فقط</div>
          </div>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--bd);font-size:12px;color:var(--tx2);line-height:1.7">
            «الوحدة» تحددها أنت (كرتون / برطمان / وحدة بيعك). الجمعية مضطرة لشراء <b>${buy}</b> لتحصل على المجاني،
            فيرتفع حجم الطلبية. خصم فعلي <b>${effDisc.toFixed(1)}%</b> بهامش يبقى <b style="color:var(--grn)">${effMargin.toFixed(0)}%</b>.
          </div>
        </div></div>`;
      }
    })()}
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--bd)">
      <div style="font-weight:800;color:#e67e22;font-size:13.5px;margin-bottom:10px">💡 أفكار إضافية لتعظيم أثر المهرجان</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;font-size:12px;line-height:1.6">
        <div style="background:var(--cardbg,transparent);border:1px solid var(--bd);border-radius:9px;padding:11px">
          <b style="color:var(--gd)">🎯 عرض الكمية المتدرّج</b><br>كل ما زادت الكمية زاد المجاني: 10+1، 20+3، 50+8 — يدفع لطلبيات أكبر.</div>
        <div style="background:var(--cardbg,transparent);border:1px solid var(--bd);border-radius:9px;padding:11px">
          <b style="color:var(--blu)">⏱️ مدة محدودة</b><br>اجعل المهرجان أسبوعاً واحداً شهرياً — يخلق إلحاحاً ويمنع إدمان الخصم.</div>
        <div style="background:var(--cardbg,transparent);border:1px solid var(--bd);border-radius:9px;padding:11px">
          <b style="color:var(--grn)">🏆 مكافأة الأوائل</b><br>أول 5 جمعيات تتجاوز هدفها تحصل على مجاني إضافي — ينشّط المنافسة.</div>
        <div style="background:var(--cardbg,transparent);border:1px solid var(--bd);border-radius:9px;padding:11px">
          <b style="color:var(--pur)">📦 عرض إيقاظ الخاملة</b><br>للجمعيات الخاملة: «3+1» + توصيل مجاني لأول طلبية بعد العودة.</div>
        <div style="background:var(--cardbg,transparent);border:1px solid var(--bd);border-radius:9px;padding:11px">
          <b style="color:#e67e22">💳 مزج العرضين</b><br>«10+1» + خصم نقدي 3% للدفع الفوري — يجمع بين الحجم والسيولة.</div>
        <div style="background:var(--cardbg,transparent);border:1px solid var(--bd);border-radius:9px;padding:11px">
          <b style="color:var(--red)">📊 القياس بعده</b><br>تابع في صفحة المناديب (المحقق مقابل الهدف) أي عرض رفع المبيعات فعلاً وثبّته.</div>
      </div>
    </div>
  </div>

  <div class="kg">
    ${KC('الهامش الإجمالي الحالي',gMargin.toFixed(0)+'%',KD(totGP)+' ربح','var(--grn)')}
    ${KC('جمعيات نامية (B)',cnt.B,'فرصة تسريع','var(--grn)')}
    ${KC('جمعيات متعثرة (C)',cnt.C,'تحتاج استعادة','var(--red)')}
    ${KC('جمعيات خاملة (D)',cnt.D,'إيراد نائم','var(--pur)')}
  </div>

  <div class="dc" style="border-right:3px solid var(--gd)">
    <h3>🎯 استراتيجية العروض حسب الشريحة</h3>
    <div style="font-size:12.5px;color:var(--tx2);line-height:1.9;margin-bottom:10px">
      هامشك المرتفع (<b style="color:var(--grn)">${gMargin.toFixed(0)}%</b>) يمنح مساحة مناورة واسعة:
      خصم 5% يبقي الهامش ~${(gMargin-5).toFixed(0)}% ويحتاج فقط +9% حجماً ليُعوّض نفسه. أي زيادة فوق ذلك ربح صافٍ.
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">
      ${Object.keys(SEG).map(k=>`
        <div style="border:1.5px solid ${SEG[k].col};border-radius:10px;padding:12px;background:linear-gradient(135deg,${SEG[k].col}11,transparent)">
          <div style="font-size:15px;font-weight:800;color:${SEG[k].col};margin-bottom:4px">${SEG[k].ico} شريحة ${k} — ${SEG[k].name}</div>
          <div style="font-size:11px;color:var(--tx3);margin-bottom:6px">${cnt[k]} جمعية · ${KD(Math.round(segSales[k]))} مبيعات</div>
          <div style="font-size:12.5px;color:var(--tx1);font-weight:600;line-height:1.6;margin-bottom:5px">🎁 ${SEG[k].offer}</div>
          <div style="font-size:11px;color:var(--tx2);line-height:1.5">${SEG[k].note}</div>
        </div>`).join('')}
    </div>
  </div>

  <div class="dc"><h3>📊 توزيع المبيعات على الشرائح</h3><canvas id="offers_1" height="100"></canvas></div>

  <div class="dc">
    <h3>📋 العرض المقترح لكل جمعية</h3>
    ${TB(rows,[
      ['الجمعية',r=>`<b>${SN(r.nm)}</b>`],
      ['المبيعات',r=>KD(Math.round(r.s))],
      ['آخر 6 أشهر',r=>KD(Math.round(r.l6))],
      ['النمو',r=>r.growth===null?'<span style="color:var(--tx3)">جديدة</span>':`<span style="color:${r.growth>=0?'var(--grn)':'var(--red)'}">${r.growth>=0?'▲':'▼'} ${Math.abs(r.growth).toFixed(0)}%</span>`],
      ['الشريحة',r=>`<span style="color:${SEG[r.seg].col};font-weight:800">${SEG[r.seg].ico} ${r.seg}</span>`],
      ['🎁 العرض المقترح',r=>`<span style="font-size:11.5px;color:var(--tx1)">${SEG[r.seg].offer}</span>`]
    ])}
  </div>

  <div class="dc" style="border-right:3px solid var(--blu)">
    <h3>🧮 حاسبة أثر الخصم على الهامش</h3>
    <div style="font-size:12.5px;color:var(--tx2);margin-bottom:10px">اختر نسبة الخصم لترى أثره على الهامش وحجم البيع الإضافي المطلوب لتعويضه:</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${[3,5,8,10,12,15].map(dz=>{const sel=(window._offDisc||5)===dz;return `<button onclick="window._offDisc=${dz};draw('offers')"
        style="padding:8px 16px;border-radius:8px;cursor:pointer;border:1.5px solid var(--blu);
        background:${sel?'var(--blu)':'transparent'};color:${sel?'#fff':'var(--blu)'};font-weight:700;font-size:13px">${dz}%</button>`;}).join('')}
    </div>
    ${(()=>{const dz=window._offDisc||5;const nm=gMargin-dz;const uplift=nm>0?(gMargin/nm-1)*100:999;
      const safe=nm>=50?'آمن جداً':nm>=45?'آمن':'يحتاج شرط حجم';const sc=nm>=50?'var(--grn)':nm>=45?'var(--gd)':'var(--red)';
      return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
        ${KC('الخصم المختار',dz+'%','على السعر','var(--blu)')}
        ${KC('الهامش بعد الخصم',nm.toFixed(0)+'%',safe,sc)}
        ${KC('الزيادة المطلوبة',(uplift>0?'+':'')+uplift.toFixed(0)+'%','لتعويض الخصم','var(--gd)')}
        ${KC('ربح كل 1000 د.ك',KD(Math.round(10*nm)),'بعد الخصم','var(--pur)')}
      </div>
      <div class="ali ${nm>=45?'grn':'yel'}" style="margin-top:12px"><span>💡</span><div style="font-size:12.5px;line-height:1.7">
        بخصم <b>${dz}%</b> يبقى هامشك عند <b style="color:${sc}">${nm.toFixed(0)}%</b>.
        لتحافظ على نفس الربح المطلق تحتاج زيادة الحجم <b>+${uplift.toFixed(0)}%</b> فقط — وكل ما زاد فوق ذلك ربح إضافي صافٍ.
      </div></div>`;})()}
  </div>

  ${(()=>{
    // 🛡️ FIX: حاسبة ROI للحملات والعروض
    const dz = window._offDisc || 5;
    const offerCost = window._roiCost || 500;  // تكلفة الحملة (افتراضي)
    const expectedUplift = window._roiUplift || 15; // نمو متوقع (افتراضي)
    const roi = ROICalculator.calculate({
      offerCost: offerCost,
      expectedUpliftPct: expectedUplift,
      currentRevenue: totSales || 1,
      currentMarginPct: gMargin,
      discountPct: dz
    });
    if(!roi.ok) return '';
    const roiColor = roi.isProfitable ? (roi.roi > 100 ? 'var(--grn)' : roi.roi > 50 ? 'var(--gd)' : '#f39c12') : 'var(--red)';
    return `
  <div class="dc" style="border-right:3px solid ${roiColor}">
    <h3>💎 حاسبة ROI للحملة التسويقية — 🛡️ جديد</h3>
    <div class="pd" style="margin-bottom:12px">أدخل تكلفة الحملة المتوقعة والنمو المرجو لترى العائد على الاستثمار الحقيقي وهل تستحق التنفيذ.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:12px">
      <div style="background:var(--surf2);border:1px solid var(--line);border-radius:10px;padding:10px">
        <div style="font-size:11.5px;color:var(--tx3);margin-bottom:6px">تكلفة الحملة (د.ك):</div>
        <input type="number" id="roiCost" value="${offerCost}" min="0" style="width:100%;padding:8px;border:1px solid var(--line2);border-radius:8px;font-family:inherit;font-weight:700;color:var(--gold)" oninput="window._roiCost=parseFloat(this.value)||0;draw('offers')">
      </div>
      <div style="background:var(--surf2);border:1px solid var(--line);border-radius:10px;padding:10px">
        <div style="font-size:11.5px;color:var(--tx3);margin-bottom:6px">النمو المتوقع في المبيعات (%):</div>
        <input type="number" id="roiUplift" value="${expectedUplift}" min="0" max="100" style="width:100%;padding:8px;border:1px solid var(--line2);border-radius:8px;font-family:inherit;font-weight:700;color:var(--gold)" oninput="window._roiUplift=parseFloat(this.value)||0;draw('offers')">
      </div>
      <div style="background:var(--surf2);border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:11.5px;color:var(--tx3);margin-bottom:4px">هامشك الحالي:</div>
        <div style="font-size:18px;font-weight:900;color:var(--gd)">${gMargin.toFixed(1)}%</div>
      </div>
    </div>
    <div class="kg">
      <div class="kc" style="border-top-color:var(--grn)">
        <div class="kl">الإيراد الإضافي المتوقع</div>
        <div class="kv" style="color:var(--grn)">${KD(roi.additionalRevenue)}</div>
        <div class="ks">+${expectedUplift}% من المبيعات الحالية</div>
      </div>
      <div class="kc" style="border-top-color:${roiColor}">
        <div class="kl">صافي الربح من الحملة</div>
        <div class="kv" style="color:${roiColor}">${roi.netProfit >= 0 ? '+' : ''}${KD(roi.netProfit)}</div>
        <div class="ks">${roi.roiEvaluation || ''}</div>
      </div>
      <div class="kc" style="border-top-color:${roiColor}">
        <div class="kl">عائد الاستثمار (ROI)</div>
        <div class="kv" style="color:${roiColor}">${roi.roi !== null ? roi.roi.toFixed(0) + '%' : '—'}</div>
        <div class="ks">${roi.paybackMonths !== null ? 'استرداد في ' + roi.paybackMonths.toFixed(1) + ' شهر' : ''}</div>
      </div>
      <div class="kc" style="border-top-color:var(--blu)">
        <div class="kl">نقطة التعادل للحملة</div>
        <div class="kv" style="color:var(--blu)">${roi.breakEvenUpliftPct !== null ? roi.breakEvenUpliftPct.toFixed(1) + '%' : '—'}</div>
        <div class="ks">أدنى نمو يلزم</div>
      </div>
    </div>
    <div class="ali ${roi.isProfitable ? 'grn' : 'red'}" style="margin-top:12px">
      <span>${roi.isProfitable ? '✅' : '⛔'}</span>
      <div style="font-size:12.5px;line-height:1.8">
        <b>التوصية:</b> ${roi.isProfitable ? 
          `الحملة مربحة. صافي ربح ${KD(roi.netProfit)} (ROI ${roi.roi.toFixed(0)}%). نقطة التعادل عند نمو ${roi.breakEvenUpliftPct.toFixed(1)}% فقط — حقق أكثر من ذلك وازدد ربحاً.` :
          `الحملة خاسرة. صافي خسارة ${KD(Math.abs(roi.netProfit))}. تحتاج نمو >${roi.breakEvenUpliftPct.toFixed(1)}% لتكون مربحة. أعد المعطيات أو اختر شريحة أخرى.`}
      </div>
    </div>
  </div>`;
  })()}

  <div class="dc"><h3>📈 الأثر المالي المتوقع للسيناريوهات</h3>
    ${TB([
      {k:'متحفّظ (تفعيل A+C)',u:'+7%',sc:scC},
      {k:'واقعي (كل الشرائح)',u:'+13%',sc:scR},
      {k:'طموح (+ تنشيط D)',u:'+20%',sc:scA}
    ],[
      ['السيناريو',r=>`<b>${r.k}</b>`],
      ['نمو المبيعات',r=>`<span style="color:var(--grn)">${r.u}</span>`],
      ['المبيعات المتوقعة',r=>KD(Math.round(r.sc.newSales))],
      ['الربح المتوقع',r=>KD(Math.round(r.sc.newGP))],
      ['Δ الربح',r=>`<b style="color:${r.sc.dGP>=0?'var(--grn)':'var(--red)'}">${r.sc.dGP>=0?'+':''}${KD(Math.round(r.sc.dGP))}</b>`]
    ])}
    <div class="ali blu" style="margin-top:10px"><span>📌</span><div style="font-size:12px;line-height:1.7">
      تقديرات إرشادية مبنية على هامشك الحالي ومتوسط خصم مرجّح بالشريحة. النتائج الفعلية تُقاس شهرياً في صفحة المناديب (المحقق مقابل الهدف).
    </div></div>

  

  </div>`;

  setTimeout(()=>{
    MK('offers_1',{type:'bar',data:{labels:['A المحرّكات','B النامية','C المتعثرة','D الخاملة'],
      datasets:[{label:'المبيعات (د.ك)',data:[segSales.A,segSales.B,segSales.C,segSales.D].map(x=>Math.round(x)),
        backgroundColor:['rgba(184,147,47,.8)','rgba(30,132,73,.8)','rgba(192,57,43,.8)','rgba(125,79,158,.8)'],borderRadius:5}]},
      options:{plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:11}}}}}});
  },30);
}

function pageDecisions(pg,S,T){
  // ════════════════════════════════════════════════════════════════════
  // لوحة القرارات الاستراتيجية — تحسب المخاطر والفرص الحرجة من البيانات الفعلية
  // وتقدّم توصية تنفيذية آلية لكل بند. كل المؤشرات حيّة من بيانات الشركة.
  // ════════════════════════════════════════════════════════════════════
  const socs=D.soc||S||[]; const items=O.it||[]; const mon=O.mon||[];
  const monMap={}; mon.forEach(m=>monMap[m.nm]=m.v||[]);
  const Tt=D.T||T||{};
  const totS=socs.reduce((a,s)=>a+(+s.s||0),0);
  const totGP=socs.reduce((a,s)=>a+(+s.pr||0),0);
  const totC=socs.reduce((a,s)=>a+(+s.c||0),0);
  const gMargin=totS?totGP/totS*100:0;

  // 1) تركّز المنتج
  const itSales=items.reduce((a,x)=>a+(+x.sl||0),0)||1;
  const itRanked=items.slice().sort((a,b)=>(b.sl||0)-(a.sl||0));
  const topItemPct=itRanked.length?(itRanked[0].sl||0)/itSales*100:0;
  // 2) تركّز العملاء
  const socRanked=socs.slice().sort((a,b)=>(b.s||0)-(a.s||0));
  const top5Pct=totS?socRanked.slice(0,5).reduce((a,s)=>a+(s.s||0),0)/totS*100:0;
  const top1Pct=totS?(socRanked[0]?.s||0)/totS*100:0;
  // 3) فجوة التحصيل
  const collRate=totS?totC/totS*100:0;
  const uncollected=Math.max(0,totS-totC);
  // 4) الجمعيات منخفضة الهامش
  const loMargin=socs.filter(s=>s.s>0 && (s.pr||0)/s.s*100<55)
                     .map(s=>({nm:s.nm,m:(s.pr||0)/s.s*100,s:s.s})).sort((a,b)=>a.m-b.m);
  // 5) الجمعيات الخاملة
  function dormancy(s){const v=monMap[s.nm]||[];const op=v.slice(1);
    const la=op.reduce((acc,x,i)=>x>0?i:acc,-1);return la>=0?op.length-1-la:99;}
  const dormant=socs.map(s=>({nm:s.nm,d:dormancy(s),s:s.s})).filter(x=>x.d>=2).sort((a,b)=>b.d-a.d);
  // 6) اتجاه المبيعات
  const mt=D.mt||O.mt||[]; const op=mt.slice(1);
  const last6=op.slice(-6).reduce((a,b)=>a+b,0), prev6=op.slice(-12,-6).reduce((a,b)=>a+b,0);
  const trendPct=prev6>0?(last6-prev6)/prev6*100:0;

  // مستوى الخطورة لكل مؤشر
  const risk=(v,hi,mid)=>v>=hi?{l:'مرتفع',c:'var(--red)',b:'br'}:v>=mid?{l:'متوسط',c:'var(--gd)',b:'by'}:{l:'منخفض',c:'var(--grn)',b:'bg'};
  const rItem=risk(topItemPct,80,60);
  const rColl=risk(100-collRate,40,25);     // كلما قل التحصيل زاد الخطر
  const rCust=risk(top5Pct,60,45);

  pg.innerHTML=`
  <div class="ali yel" style="margin-bottom:14px"><span>🧭</span><div style="font-size:13px;line-height:1.8">
    <b>لوحة القرارات الاستراتيجية:</b> ملخص تنفيذي للمخاطر والفرص الحرجة المستخرجة آلياً من بياناتك،
    مع توصية لكل بند. الأولوية بالألوان: 🔴 عاجل · 🟡 قريب · 🟢 لاحق.
  </div></div>

  <div class="kg">
    ${KC('تركّز المنتج',topItemPct.toFixed(0)+'%','أكبر صنف من المبيعات',rItem.c)}
    ${KC('فجوة التحصيل',KD(Math.round(uncollected)),'نسبة التحصيل '+collRate.toFixed(0)+'%',rColl.c)}
    ${KC('تركّز العملاء',top5Pct.toFixed(0)+'%','أكبر 5 جمعيات',rCust.c)}
    ${KC('اتجاه المبيعات',(trendPct>=0?'+':'')+trendPct.toFixed(0)+'%','آخر 6 أشهر',trendPct>=0?'var(--grn)':'var(--red)')}
  </div>

  <div class="dc" style="border-right:3px solid var(--red)">
    <h3>🔴 المخاطر الحرجة — قرارات عاجلة</h3>

    <div style="border:1px solid var(--bd);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <b style="font-size:14px">📦 خطر تركّز المنتج</b>
        <span class="bd ${rItem.b}">خطر ${rItem.l}</span>
      </div>
      <div style="font-size:12.5px;color:var(--tx2);line-height:1.8;margin-top:6px">
        <b style="color:${rItem.c}">${topItemPct.toFixed(0)}%</b> من مبيعاتك من صنف واحد. أي اضطراب (منافس · توريد · ذوق · سعر مدخلات) يهدد الشركة كلها.
        <br><b style="color:var(--gd)">🎯 القرار:</b> تنويع المحفظة — أضف 2–3 أصناف مكمّلة عبر نفس الجمعيات الـ${socs.length}. هدف: خفض الصنف الواحد إلى < 70% خلال سنة.
      </div>
    </div>

    <div style="border:1px solid var(--bd);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <b style="font-size:14px">💰 فجوة التحصيل</b>
        <span class="bd ${rColl.b}">خطر ${rColl.l}</span>
      </div>
      <div style="font-size:12.5px;color:var(--tx2);line-height:1.8;margin-top:6px">
        نسبة التحصيل <b style="color:${rColl.c}">${collRate.toFixed(0)}%</b> فقط، أي <b>${KD(Math.round(uncollected))}</b> ذمم غير محصّلة — رأس مال مجمّد يخنق التوسع.
        <br><b style="color:var(--gd)">🎯 القرار:</b> خصم سداد مبكر 2% (يموّل نفسه من هامشك ${gMargin.toFixed(0)}%) · سقف ائتماني لكل جمعية · تنبيه عند 60 يوماً · ربط جزء من عمولة المندوب بالتحصيل.
      </div>
    </div>

    <div style="border:1px solid var(--bd);border-radius:10px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <b style="font-size:14px">🏢 تركّز العملاء</b>
        <span class="bd ${rCust.b}">خطر ${rCust.l}</span>
      </div>
      <div style="font-size:12.5px;color:var(--tx2);line-height:1.8;margin-top:6px">
        أكبر 5 جمعيات = <b style="color:${rCust.c}">${top5Pct.toFixed(0)}%</b> من المبيعات (أكبر جمعية ${top1Pct.toFixed(0)}%). فقدان جمعية كبرى مؤلم.
        <br><b style="color:var(--gd)">🎯 القرار:</b> برنامج ولاء للكبار (شروط تفضيلية · أولوية توريد) + تنمية الشريحة المتوسطة لتقليل الاعتماد.
      </div>
    </div>
  </div>

  <div class="dc" style="border-right:3px solid var(--grn)">
    <h3>🟢 الفرص غير المستغلّة</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">
      <div style="border:1px solid var(--bd);border-radius:10px;padding:13px">
        <b style="color:var(--pur);font-size:13.5px">💤 إيقاظ الجمعيات الخاملة</b>
        <div style="font-size:12px;color:var(--tx2);line-height:1.7;margin-top:5px">
          <b>${dormant.length}</b> جمعية خاملة (≥ شهرين بلا طلب) = إيراد نائم.
          <b style="color:var(--gd)">القرار:</b> حملة استعادة «3+1» + زيارة مندوب — عائد سريع بتكلفة زهيدة.
          ${dormant.length?'<br><span style="color:var(--tx3);font-size:11px">أبرزها: '+dormant.slice(0,3).map(d=>SN(d.nm)).join(' · ')+'</span>':''}
        </div>
      </div>
      <div style="border:1px solid var(--bd);border-radius:10px;padding:13px">
        <b style="color:var(--blu);font-size:13.5px">🏷️ مراجعة التسعير</b>
        <div style="font-size:12px;color:var(--tx2);line-height:1.7;margin-top:5px">
          <b>${loMargin.length}</b> جمعية بهامش < 55% (المتوسط ${gMargin.toFixed(0)}%).
          <b style="color:var(--gd)">القرار:</b> رفع 3–5% غالباً لن يؤثر على الطلب ويحسّن الربح مباشرة.
          ${loMargin.length?'<br><span style="color:var(--tx3);font-size:11px">أدناها: '+loMargin.slice(0,3).map(d=>SN(d.nm)+' ('+d.m.toFixed(0)+'%)').join(' · ')+'</span>':''}
        </div>
      </div>
      <div style="border:1px solid var(--bd);border-radius:10px;padding:13px">
        <b style="color:#e67e22;font-size:13.5px">📅 الذروات الموسمية</b>
        <div style="font-size:12px;color:var(--tx2);line-height:1.7;margin-top:5px">
          مبيعاتك متذبذبة موسمياً. <b style="color:var(--gd)">القرار:</b> خطّط المخزون والعروض (المهرجان) حول الذروات (رمضان/الأعياد) لتعظيم الأشهر القوية.
        </div>
      </div>
      <div style="border:1px solid var(--bd);border-radius:10px;padding:13px">
        <b style="color:var(--grn);font-size:13.5px">🗺️ التوسع الجغرافي</b>
        <div style="font-size:12px;color:var(--tx2);line-height:1.7;margin-top:5px">
          ${socs.length} جمعية حالياً. <b style="color:var(--gd)">القرار:</b> بعد تثبيت التحصيل والتنويع، ادرس جمعيات/أسواق جديدة بنفس النموذج الناجح.
        </div>
      </div>
    </div>
  </div>

  <div class="dc">
    <h3>📋 مصفوفة القرارات حسب الأولوية والأثر</h3>
    ${TB([
      {k:'سياسة التحصيل (تحرير '+KD(Math.round(uncollected))+')',u:'🔴 عاجل',i:'عالٍ جداً',e:'متوسط'},
      {k:'تنويع المنتج',u:'🔴 عاجل',i:'عالٍ جداً',e:'عالٍ'},
      {k:'مراجعة تسعير '+loMargin.length+' جمعية',u:'🟡 قريب',i:'متوسط',e:'منخفض'},
      {k:'استعادة '+dormant.length+' جمعية خاملة',u:'🟡 قريب',i:'متوسط',e:'منخفض'},
      {k:'برنامج ولاء الجمعيات الكبرى',u:'🟢 متوسط',i:'عالٍ',e:'متوسط'},
      {k:'التوسع الجغرافي',u:'🟢 لاحق',i:'عالٍ',e:'عالٍ'}
    ],[
      ['القرار',r=>`<b>${r.k}</b>`],
      ['الإلحاح',r=>r.u],
      ['الأثر',r=>r.i],
      ['الجهد',r=>r.e]
    ])}
  </div>

  <div class="dc" style="border-right:3px solid var(--gd)">
    <h3>🗓️ خارطة طريق 12 شهراً</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
      ${[
        ['الربع 1 — تثبيت الأساس','سياسة التحصيل + مراجعة التسعير + استعادة الخاملة — مكاسب سريعة تموّل الباقي','var(--red)'],
        ['الربع 2 — التنويع','إدخال أول صنفين جديدين عبر الجمعيات القائمة','var(--blu)'],
        ['الربع 3 — الولاء','برنامج الجمعيات الكبرى + ترسيخ المهرجان الشهري','var(--pur)'],
        ['الربع 4 — التوسع','دراسة الأسواق الجديدة بناءً على البيانات المتراكمة','var(--grn)']
      ].map((q,idx)=>`<div style="border:1px solid var(--bd);border-right:3px solid ${q[2]};border-radius:10px;padding:13px">
        <b style="color:${q[2]};font-size:13px">${q[0]}</b>
        <div style="font-size:12px;color:var(--tx2);line-height:1.6;margin-top:5px">${q[1]}</div></div>`).join('')}
    </div>
    <div class="ali blu" style="margin-top:12px"><span>📌</span><div style="font-size:12px;line-height:1.7">
      المؤشرات محسوبة آلياً من بياناتك وتتحدّث مع كل رفع. القرارات النهائية — خاصة التسعير والائتمان والتنويع — تخضع لحكمك التجاري وظروف السوق.
    </div></div>
  </div>`;
}

function pageAL(pg,S){
  // 🛡️ FIX: استخدام التاريخ الديناميكي بدلاً من الثابت 2026-06-11
  const today = DashboardConfig.getAsOfDate();
  const al=[];
  S.forEach(s=>{
    const ot=s.ot||0,rt=s.rt||0,li=s.li||'';
    const days=li?Math.floor((today-new Date(li))/864e5):999;
    if(ot>5000) al.push({c:'red',i:'🔴',m:`<b>${SN(s.nm)}</b> — ذمم عالية: ${KD(ot)}`});
    else if(ot>2000) al.push({c:'yel',i:'🟡',m:`<b>${SN(s.nm)}</b> — ذمم متوسطة: ${KD(ot)}`});
    if(rt===0&&s.s>0) al.push({c:'red',i:'🚫',m:`<b>${SN(s.nm)}</b> — لا يوجد تحصيل على الإطلاق`});
    else if(rt<30&&s.s>0) al.push({c:'yel',i:'⚠️',m:`<b>${SN(s.nm)}</b> — نسبة تحصيل منخفضة: ${PC(rt)}`});
    if(days>90&&s.s>0) al.push({c:'yel',i:'📅',m:`<b>${SN(s.nm)}</b> — لم تشترِ منذ ${days} يوم (${li})`});
  });
  pg.innerHTML=`
  <div class="ews-tabs">
    <button class="ews-tab ews-tab--active" id="ewsBtn_traditional" onclick="ews_switchTab('traditional')">
      🔔 تنبيهات تقليدية <span class="ews-tab-badge">${al.length}</span>
    </button>
    <button class="ews-tab" id="ewsBtn_early" onclick="ews_switchTab('early')">
      ⚡ إنذارات مبكرة <span class="ews-tab-badge" id="ewsBadgeEarly">0</span>
    </button>
  </div>
  
  <div class="ews-content ews-content--active" id="ewsTab_traditional">
    <div class="kg">
      ${KC('تنبيهات حرجة',al.filter(a=>a.c==='red').length,'','var(--red)')}
      ${KC('تحذيرات',al.filter(a=>a.c==='yel').length,'','#f39c12')}
      ${KC('ذمم > 5000',S.filter(s=>s.ot>5000).length,'جمعية','var(--red)')}
      ${KC('تحصيل < 30%',S.filter(s=>s.rt<30&&s.s>0).length,'جمعية','#f39c12')}
    </div>
    <div class="dc"><h3>🔔 قائمة التنبيهات</h3>
      ${al.length?al.map(a=>`<div class="ali ${a.c}"><span>${a.i}</span><div>${a.m}</div></div>`).join(''):
        '<div class="ali grn"><span>✅</span><div>لا توجد تنبيهات — كل شيء طبيعي</div></div>'}
    </div>
  </div>
  
  <div class="ews-content" id="ewsTab_early">
    <div id="ewsEarlyWarnings"></div>
  </div>
  
  <script>
    // تحديث عدد الإنذارات في الـ badge بعد عرض المحتوى
    setTimeout(function() {
      try {
        if (typeof ews_detect === 'function' && typeof ews_render === 'function') {
          var c = document.getElementById('ewsEarlyWarnings');
          if (c) ews_render(c);
          var alerts = ews_detect();
          var badge = document.getElementById('ewsBadgeEarly');
          if (badge) badge.textContent = alerts.length;
        }
      } catch(e) {
        Logger.warn('EWS inline init:', e.message);
      }
    }, 250);
`;
}


// ════════════════════════════════════════════
// محرك التحليل المتقدم (Decision Support Engine)
// ════════════════════════════════════════════
// 🛡️ FIX: التاريخ الديناميكي مع 6 طبقات حماية (تجاوز المستخدم + التاريخ الحقيقي + كشف البيانات القديمة + ...)
// const TODAY = DashboardConfig.getAsOfDate();  // ← يتم حسابه عند الاستخدام

function daysSince(dateStr){
  // 🛡️ FIX: استخدام TimeUtils.daysSince مع حماية شاملة (تاريخ ديناميكي + حماية القيم الفارغة + التواريخ المستقبلية)
  return TimeUtils.daysSince(dateStr);
}

// نقاط مخاطر الائتمان (0-100): كلما زادت زاد الخطر
function riskScore(s){
  // حد ائتمان مقترح = متوسط مبيعات شهرين
  const monthsActive = O.ml.length;
  const creditLimit = Math.max(s.s / Math.max(monthsActive,1) * 2, 500);
  // 1) نسبة الذمم من حد الائتمان (40%)
  const utilRatio = Math.min(s.ot / creditLimit, 1.5);
  const utilScore = Math.min(utilRatio / 1.5 * 40, 40);
  // 2) أيام منذ آخر تحصيل (35%)
  const daysCol = daysSince(s.lc);
  const daysScore = Math.min(daysCol / 120, 1) * 35;
  // 3) نسبة التحصيل المنخفضة (25%)
  const colScore = (1 - Math.min((s.rt||0)/100, 1)) * 25;
  const total = Math.round(utilScore + daysScore + colScore);
  let level, color;
  if(total >= 70){ level='خطر مرتفع'; color='var(--red)'; }
  else if(total >= 45){ level='مراقبة'; color='#f39c12'; }
  else if(total >= 25){ level='منخفض'; color='var(--gd)'; }
  else { level='آمن'; color='var(--grn)'; }
  return { score:total, level, color, creditLimit:Math.round(creditLimit), util:Math.round(utilRatio*100), daysCol };
}

// أعمار الذمم: توزيع على فترات
function agingBuckets(s){
  // نقدّر عمر الذمم من آخر تحصيل (تقريب عملي)
  const days = daysSince(s.lc);
  const out = s.ot || 0;
  // إذا التحصيل حديث، الذمم حديثة؛ إذا قديم، الذمم متقادمة
  let b0=0, b30=0, b60=0, b90=0;
  if(out > 0){
    if(days <= 30) b0 = out;
    else if(days <= 60) b30 = out;
    else if(days <= 90) b60 = out;
    else b90 = out;
  }
  return { b0, b30, b60, b90, days };
}

// اتجاه الجمعية: صاعد/هابط/مستقر بالانحدار الخطي على آخر 6 أشهر
function trendOf(name){
  const mr = O.mon.find(m => m.nm === name);
  if(!mr) return { dir:'—', slope:0, pct:0, recent:0, prev:0 };
  // النطاق المفلتر (من فترة إلى فترة)
  const fa=(typeof _filterA==='number')?_filterA:0;
  const fb=(typeof _filterB==='number')?_filterB:(mr.v.length-1);
  const seg = mr.v.slice(fa, fb+1);   // قيم الفترة المختارة فقط
  const vals = seg.filter(v => v > 0);
  if(vals.length < 3) return { dir:'جديد', slope:0, pct:0, recent:0, prev:0 };
  const recent = seg.slice(-3).reduce((a,b)=>a+b,0);
  const prev = seg.slice(-6,-3).reduce((a,b)=>a+b,0);
  const last6 = seg.slice(-6);
  const n = last6.length;
  const xs = last6.map((_,i)=>i);
  const sx=xs.reduce((a,b)=>a+b,0), sy=last6.reduce((a,b)=>a+b,0);
  const sxy=xs.reduce((a,x,i)=>a+x*last6[i],0), sxx=xs.reduce((a,x)=>a+x*x,0);
  const slope = (n*sxy - sx*sy)/(n*sxx - sx*sx || 1);
  const pct = prev > 0 ? ((recent - prev)/prev*100) : (recent > 0 ? 100 : 0);
  let dir;
  if(pct > 15) dir = 'صاعد';
  else if(pct < -15) dir = 'هابط';
  else dir = 'مستقر';
  return { dir, slope, pct, recent, prev };
}

// كشف التعثر/الانسحاب (Churn)
function churnRisk(name){
  const mr = O.mon.find(m => m.nm === name);
  if(!mr) return { risk:'—', emptyMonths:0 };
  // النطاق المفلتر
  const fa=(typeof _filterA==='number')?_filterA:0;
  const fb=(typeof _filterB==='number')?_filterB:(mr.v.length-1);
  const seg = mr.v.slice(fa, fb+1);
  // عدد الأشهر الأخيرة بدون شراء ضمن الفترة المختارة
  let emptyMonths = 0;
  for(let i = seg.length-1; i >= 0; i--){
    if(seg[i] > 0) break;
    emptyMonths++;
  }
  let risk;
  if(emptyMonths >= 3) risk = 'متوقف';
  else if(emptyMonths === 2) risk = 'خطر انسحاب';
  else if(emptyMonths === 1) risk = 'تباطؤ';
  else risk = 'نشط';
  return { risk, emptyMonths };
}

// تصنيف ABC (باريتو)
function abcClassify(arr){
  const sorted = [...arr].sort((a,b) => b.s - a.s);
  const total = sorted.reduce((sum,s) => sum + s.s, 0);
  let cum = 0;
  return sorted.map(s => {
    cum += s.s;
    const cumPct = total > 0 ? cum/total*100 : 0;
    let cls;
    if(cumPct <= 80) cls = 'A';
    else if(cumPct <= 95) cls = 'B';
    else cls = 'C';
    return { ...s, cumPct: +cumPct.toFixed(1), cls };
  });
}

// تأثير الخصم والمجاني على الربح
function discountImpact(s){
  const grossProfit = s.s - (s.g || 0); // ربح قبل الخصم والمجاني
  const discCost = (s.d || 0) + (s.fv || 0);
  const netProfit = s.pr;
  const erosion = grossProfit > 0 ? discCost/grossProfit*100 : 0;
  return { grossProfit, discCost, netProfit, erosion };
}



// ══════════ صفحة الائتمان والمخاطر ══════════
function pageCredit(pg,S,T){
  const scored = S.map(s => ({ ...s, risk: riskScore(s) })).sort((a,b) => b.risk.score - a.risk.score);
  const high = scored.filter(s => s.risk.score >= 70);
  const watch = scored.filter(s => s.risk.score >= 45 && s.risk.score < 70);
  const totalRisk = scored.filter(s=>s.risk.score>=45).reduce((sum,s)=>sum+s.ot,0);
  pg.innerHTML = `
  <div class="pulse"><div class="pi">🛡️</div><div>
    <div class="pt">تقييم المخاطر الائتمانية</div>
    <div class="pd">${high.length} جمعية خطر مرتفع · ${watch.length} تحت المراقبة · إجمالي الذمم المعرّضة للخطر <b style="color:var(--red)">${KD(totalRisk)}</b></div>
  </div></div>
  <div class="kg">
    ${KC('خطر مرتفع', high.length, 'تحتاج إيقاف/مراجعة', 'var(--red)')}
    ${KC('تحت المراقبة', watch.length, '', '#f39c12')}
    ${KC('ذمم معرّضة', KD(totalRisk), 'خطر+مراقبة', 'var(--red)')}
    ${KC('آمنة', scored.filter(s=>s.risk.score<25).length, 'جمعية', 'var(--grn)')}
  </div>
  <div class="g2">
    <div class="dc"><h3>🎯 مصفوفة القرار: الربحية × المخاطرة</h3><canvas id="credit_1"></canvas></div>
    <div class="dc"><h3>⚠️ أعلى الجمعيات خطورة</h3>
      ${scored.slice(0,8).map(s=>PB(SN(s.nm), s.risk.score, 100, s.risk.color)).join('')}
    </div>
  </div>
  <div class="dc"><h3>📋 بطاقة المخاطر الائتمانية لكل جمعية</h3>
    ${TB(scored,[
      ['الجمعية', r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المندوب', r=>r.ag||'—'],
      ['الذمم', r=>`<span style="color:var(--red)">${KD(r.ot)}</span>`],
      ['حد الائتمان', r=>KD(r.risk.creditLimit)],
      ['نسبة الاستغلال', r=>{const u=r.risk.util;return`<span class="bd ${u>=100?'br':u>=70?'by':'bg'}">${u}%</span>`}],
      ['أيام بلا تحصيل', r=>{const d=r.risk.daysCol;return`<span style="color:${d>90?'var(--red)':d>60?'#f39c12':'var(--tx2)'}">${d>900?'—':d}</span>`}],
      ['نقاط المخاطر', r=>`<b style="color:${r.risk.color}">${r.risk.score}</b>`],
      ['التصنيف', r=>`<span class="bd" style="background:${r.risk.color}22;color:${r.risk.color}">${r.risk.level}</span>`],
      ['القرار المقترح', r=>{
        if(r.risk.score>=70) return '<span style="color:var(--red)">⛔ إيقاف الائتمان</span>';
        if(r.risk.score>=45) return '<span style="color:#f39c12">⚠️ متابعة عاجلة</span>';
        if(r.risk.score>=25) return '<span style="color:var(--gd)">👁️ مراقبة</span>';
        return '<span style="color:var(--grn)">✅ تمديد ممكن</span>';
      }],
    ])}
  </div>`;
  // مصفوفة الربحية × المخاطرة (scatter)
  setTimeout(()=>MK('credit_1',{type:'scatter',data:{datasets:[
    {label:'آمن (نمِّ)', data:scored.filter(s=>s.risk.score<45).map(s=>({x:s.risk.score,y:s.s})), backgroundColor:'#1e8449', pointRadius:6},
    {label:'خطر (راقب)', data:scored.filter(s=>s.risk.score>=45).map(s=>({x:s.risk.score,y:s.s})), backgroundColor:'#e74c3c', pointRadius:6}
  ]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{title:{display:true,text:'نقاط المخاطر ←',color:'#a8b4c8',font:{size:10}},min:0,max:100},y:{title:{display:true,text:'المبيعات (د.ك) ↑',color:'#a8b4c8',font:{size:10}}}}}}),30);
}

// ══════════ صفحة أعمار الذمم ══════════
function pageAging(pg,S,T){
  const aged = S.filter(s=>s.ot>0).map(s=>({...s, aging:agingBuckets(s)}));
  const tot = {b0:0,b30:0,b60:0,b90:0};
  aged.forEach(s=>{tot.b0+=s.aging.b0;tot.b30+=s.aging.b30;tot.b60+=s.aging.b60;tot.b90+=s.aging.b90;});
  const totalOut = tot.b0+tot.b30+tot.b60+tot.b90;
  const critical = tot.b90;
  pg.innerHTML = `
  <div class="pulse"><div class="pi">⏳</div><div>
    <div class="pt">تحليل أعمار الذمم المدينة</div>
    <div class="pd">إجمالي الذمم <b style="color:var(--gd)">${KD(totalOut)}</b> · الديون الحرجة (+90 يوم) <b style="color:var(--red)">${KD(critical)}</b> (${PC(totalOut?critical/totalOut*100:0)}) — أولوية التحصيل القصوى</div>
  </div></div>
  <div class="kg">
    ${KC('0-30 يوم', KD(tot.b0), PC(totalOut?tot.b0/totalOut*100:0), 'var(--grn)')}
    ${KC('31-60 يوم', KD(tot.b30), PC(totalOut?tot.b30/totalOut*100:0), 'var(--gd)')}
    ${KC('61-90 يوم', KD(tot.b60), PC(totalOut?tot.b60/totalOut*100:0), '#f39c12')}
    ${KC('+90 يوم (حرج)', KD(tot.b90), PC(totalOut?tot.b90/totalOut*100:0), 'var(--red)')}
  </div>
  <div class="g2">
    <div class="dc"><h3>📊 توزيع الذمم على الأعمار</h3><canvas id="aging_1"></canvas></div>
    <div class="dc"><h3>🔴 أقدم الديون (الأولوية القصوى)</h3>
      ${aged.sort((a,b)=>b.aging.days-a.aging.days).slice(0,8).map(s=>
        `<div class="pb"><div class="pbn" title="${s.nm}">${SN(s.nm)}</div><div class="pbt"><div class="pbf" style="width:${Math.min(s.aging.days/120*100,100)}%;background:${s.aging.days>90?'var(--red)':s.aging.days>60?'#f39c12':'var(--gd)'}"></div></div><div class="pbv">${s.aging.days>900?'—':s.aging.days+' يوم'}</div></div>`
      ).join('')}
    </div>
  </div>
  <div class="dc"><h3>📋 تفصيل أعمار الذمم لكل جمعية</h3>
    ${TB(aged.sort((a,b)=>b.ot-a.ot),[
      ['الجمعية', r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['إجمالي الذمم', r=>`<b style="color:var(--red)">${KD(r.ot)}</b>`],
      ['آخر تحصيل', r=>{if(typeof r.lc==='string'&&r.lc)return r.lc;if(r.lc instanceof Date)return r.lc.toISOString().slice(0,10);if(r.lc&&typeof r.lc==='object'&&r.lc.dt)return String(r.lc.dt);return '—';}],
      ['عمر الدين', r=>{const d=r.aging.days;return`<span style="color:${d>90?'var(--red)':d>60?'#f39c12':'var(--grn)'}">${d>900?'—':d+' يوم'}</span>`}],
      ['الفئة', r=>{const d=r.aging.days;const lbl=d<=30?'0-30':d<=60?'31-60':d<=90?'61-90':'+90';const cl=d<=30?'bg':d<=60?'by':d<=90?'by':'br';return`<span class="bd ${cl}">${lbl} يوم</span>`}],
      ['نسبة التحصيل', r=>PC(r.rt||0)],
      ['الإجراء', r=>{const d=r.aging.days;if(d>90)return'<span style="color:var(--red)">📞 تحصيل فوري</span>';if(d>60)return'<span style="color:#f39c12">📨 إنذار</span>';return'<span style="color:var(--grn)">✅ طبيعي</span>';}],
      ['تعديل آخر تحصيل', r=>`<button onclick="editLastCollectionV220('${r.nm.replace(/'/g, "\\'")}')" style="background:#f39c12;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:bold">✏️ تعديل التاريخ</button>`],
    ])}
  </div>`;
  setTimeout(()=>MK('aging_1',{type:'doughnut',data:{labels:['0-30 يوم','31-60 يوم','61-90 يوم','+90 يوم'],datasets:[{data:[tot.b0,tot.b30,tot.b60,tot.b90],backgroundColor:['#1e8449','#b8932f','#fb923c','#ef4f5a']}]},options:{plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}}),30);
}

// ══════════ صفحة النمو والتعثر ══════════
// ════════════════════════════════════════════
// سلوك الجمعيات الموحّد (دمج: النمو والتعثر + دورة المشتريات)
// ════════════════════════════════════════════
function pageBehavior(pg,S,T){
  pg.innerHTML=`
    ${periodBadge()}
    <div class="quick-nav">
      <button class="qn-btn" onclick="scrollToSec('sec_growth')"><span>🌱</span> النمو والتعثر</button>
      <button class="qn-btn" onclick="scrollToSec('sec_cycle')"><span>🔄</span> دورة المشتريات</button>
    </div>
    <div id="sub_growth"></div>
    <div class="merge-sec" id="sec_cycle"><span class="merge-tag">🔄 دورة المشتريات ورادار الخمول</span></div>
    <div id="sub_cycle"></div>`;
  const grBox=document.getElementById('sub_growth');
  pageGrowth(grBox,S);
  grBox.setAttribute('id','sec_growth');
  pageCycle(document.getElementById('sub_cycle'),S,T);
}
function pageGrowth(pg,S){
  const analyzed = S.map(s=>({...s, trend:trendOf(s.nm), churn:churnRisk(s.nm)}));
  const growing = analyzed.filter(s=>s.trend.dir==='صاعد');
  const declining = analyzed.filter(s=>s.trend.dir==='هابط');
  const churning = analyzed.filter(s=>s.churn.risk==='خطر انسحاب'||s.churn.risk==='متوقف');
  pg.innerHTML = `
  <div class="pulse"><div class="pi">📊</div><div>
    <div class="pt">تحليل النمو وكشف التعثر</div>
    <div class="pd"><b style="color:var(--grn)">${growing.length}</b> جمعية في نمو · <b style="color:var(--red)">${declining.length}</b> في تراجع · <b style="color:#f39c12">${churning.length}</b> معرّضة للانسحاب — تحرّك قبل فوات الأوان</div>
  </div></div>
  <div class="kg">
    ${KC('جمعيات نامية', growing.length, '▲ صاعدة', 'var(--grn)')}
    ${KC('جمعيات متراجعة', declining.length, '▼ هابطة', 'var(--red)')}
    ${KC('خطر انسحاب', churning.length, 'توقفت/تتباطأ', '#f39c12')}
    ${KC('مستقرة', analyzed.filter(s=>s.trend.dir==='مستقر').length, '', 'var(--blu)')}
  </div>
  <div class="g2">
    <div class="dc"><h3>🚀 أعلى الجمعيات نمواً</h3>
      ${growing.sort((a,b)=>b.trend.pct-a.trend.pct).slice(0,6).map(s=>
        `<div class="ali grn"><span>▲</span><div><b>${SN(s.nm)}</b> — نمو ${PC(s.trend.pct)} (${KD(s.trend.prev)} ← ${KD(s.trend.recent)})</div></div>`
      ).join('')||'<p style="color:var(--tx3)">لا توجد</p>'}
    </div>
    <div class="dc"><h3>📉 جمعيات تحتاج تدخّل</h3>
      ${declining.concat(churning).filter((v,i,a)=>a.findIndex(x=>x.nm===v.nm)===i).sort((a,b)=>a.trend.pct-b.trend.pct).slice(0,6).map(s=>
        `<div class="ali red"><span>▼</span><div><b>${SN(s.nm)}</b> — ${s.churn.risk==='متوقف'?'متوقفة منذ '+s.churn.emptyMonths+' أشهر':s.trend.dir==='هابط'?'تراجع '+PC(Math.abs(s.trend.pct)):s.churn.risk}</div></div>`
      ).join('')||'<p style="color:var(--tx3)">لا توجد</p>'}
    </div>
  </div>
  <div class="dc"><h3>📋 اتجاه وحالة كل جمعية</h3>
    ${TB(analyzed.sort((a,b)=>b.s-a.s),[
      ['الجمعية', r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المندوب', r=>r.ag||'—'],
      ['المبيعات', r=>KD(r.s)],
      ['آخر 3 أشهر', r=>KD(r.trend.recent)],
      ['الـ3 السابقة', r=>KD(r.trend.prev)],
      ['التغيّر', r=>{const p=r.trend.pct;const c=p>15?'var(--grn)':p<-15?'var(--red)':'var(--tx2)';return`<span style="color:${c}">${p>=0?'▲':'▼'} ${PC(Math.abs(p))}</span>`}],
      ['الاتجاه', r=>{const d=r.trend.dir;const cl=d==='صاعد'?'bg':d==='هابط'?'br':d==='جديد'?'bp':'bb';return`<span class="bd ${cl}">${d}</span>`}],
      ['حالة النشاط', r=>{const ch=r.churn.risk;const cl=ch==='نشط'?'bg':ch==='متوقف'?'br':'by';return`<span class="bd ${cl}">${ch}</span>`}],
    ])}
  </div>`;
}

// ══════════ صفحة تحليل ABC ══════════
function pageABC(pg,S,T){
  const classified = abcClassify(S);
  const a = classified.filter(s=>s.cls==='A');
  const b = classified.filter(s=>s.cls==='B');
  const cc = classified.filter(s=>s.cls==='C');
  const aSales = a.reduce((sum,s)=>sum+s.s,0);
  pg.innerHTML = `
  <div class="pulse"><div class="pi">🎯</div><div>
    <div class="pt">تحليل باريتو (ABC) — قاعدة 80/20</div>
    <div class="pd"><b style="color:var(--gd)">${a.length}</b> جمعية (فئة A) تصنع <b style="color:var(--gd)">${PC(T.s?aSales/T.s*100:0)}</b> من المبيعات — ركّز جهدك هنا</div>
  </div></div>
  <div class="kg">
    ${KC('فئة A (الأهم)', a.length, PC(T.s?aSales/T.s*100:0)+' من المبيعات', 'var(--grn)')}
    ${KC('فئة B (متوسطة)', b.length, '', 'var(--gd)')}
    ${KC('فئة C (صغيرة)', cc.length, '', 'var(--tx3)')}
    ${KC('تركيز المبيعات', PC(T.s?aSales/T.s*100:0), 'في فئة A', 'var(--pur)')}
  </div>
  <div class="g2">
    <div class="dc"><h3>📈 منحنى باريتو</h3><canvas id="abc_1"></canvas></div>
    <div class="dc"><h3>🥧 توزيع المبيعات حسب الفئة</h3><canvas id="abc_2"></canvas></div>
  </div>
  <div class="dc"><h3>📋 تصنيف ABC لكل جمعية</h3>
    ${TB(classified,[
      ['الترتيب', (r,i)=>'#'],
      ['الجمعية', r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المبيعات', r=>`<b style="color:var(--gd)">${KD(r.s)}</b>`],
      ['الربح', r=>`<span style="color:var(--grn)">${KD(r.pr)}</span>`],
      ['نسبة التحصيل', r=>PC(r.rt||0)],
      ['التراكمي %', r=>PC(r.cumPct)],
      ['الفئة', r=>{const cl=r.cls==='A'?'bg':r.cls==='B'?'by':'bb';return`<span class="bd ${cl}">فئة ${r.cls}</span>`}],
      ['الاستراتيجية', r=>{
        if(r.cls==='A') return '<span style="color:var(--grn)">🌟 حماية + تنمية</span>';
        if(r.cls==='B') return '<span style="color:var(--gd)">📈 ترقية لـ A</span>';
        return '<span style="color:var(--tx3)">⚙️ كفاءة التكلفة</span>';
      }],
    ])}
  </div>`;
  const sorted = classified;
  setTimeout(()=>{
    MK('abc_1',{type:'line',data:{labels:sorted.map((s,i)=>'#'+(i+1)),datasets:[{label:'التراكمي %',data:sorted.map(s=>s.cumPct),borderColor:'#b8932f',backgroundColor:'rgba(184,147,47,.15)',fill:true,tension:.2,pointRadius:2},{label:'حد 80%',data:sorted.map(()=>80),borderColor:'#e74c3c',borderDash:[5,3],pointRadius:0}]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{ticks:{font:{size:8}}},y:{max:100}}}});
    MK('abc_2',{type:'doughnut',data:{labels:['فئة A','فئة B','فئة C'],datasets:[{data:[aSales,b.reduce((s,x)=>s+x.s,0),cc.reduce((s,x)=>s+x.s,0)],backgroundColor:['#1e8449','#b8932f','#2563a8']}]},options:{plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}});
  },30);
}

// ══════════ شاشة قرارات اليوم ══════════

// ════════════════════════════════════════════
// محرك دورة المشتريات (Purchase Cycle Engine)
// ════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
// 🛡️ FIX v170: تطبيع التواريخ - يحل [object Object] و NaN
// ════════════════════════════════════════════════════════════════════════
function normalizeDate(v) {
  if(v == null || v === '') return '';
  if(typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toISOString().slice(0, 10);
  }
  if(v instanceof Date) {
    return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  }
  if(typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  if(typeof v === 'object') {
    if(v.dt) return normalizeDate(v.dt);
    if(v.date) return normalizeDate(v.date);
    if(v.year !== undefined) {
      const y = v.year || v.y || 2024;
      const m = String(v.month || v.m || 1).padStart(2, '0');
      const d = String(v.day || v.d || 1).padStart(2, '0');
      return y + '-' + m + '-' + d;
    }
    if(Array.isArray(v) && v.length >= 3) {
      return v[0] + '-' + String(v[1]).padStart(2,'0') + '-' + String(v[2]).padStart(2,'0');
    }
    try { return JSON.stringify(v); } catch(e) { return ''; }
  }
  return String(v);
}
function displayDate(v) {
  const norm = normalizeDate(v);
  if(!norm || norm.startsWith('{') || norm.startsWith('[')) return '—';
  return norm;
}
function safeDays(li, today) {
  const norm = normalizeDate(li);
  if(!norm || norm.startsWith('{') || norm.startsWith('[')) return 999;
  const d = new Date(norm);
  if(isNaN(d.getTime())) return 999;
  return Math.floor((today - d) / 864e5);
}

function purchaseCycle(s){
  const mr=(O.mon||[]).find(m=>m.nm===s.nm);
  // 🛡️ FIX: استخدام التاريخ الديناميكي بدلاً من الثابت 2026-06-11
  const today = DashboardConfig.getAsOfDate();
  // 🛡️ FIX v170: تطبيع s.li (يقبل string/object/Date)
  let li = normalizeDate(s.li);
  // إذا لا يزال فارغاً، ابحث في tx
  if(!li && O.tx) {
    const ctx = O.tx.filter(t => (t.client === s.nm || t.cl === s.nm) && (t.tp === 'sale' || t.tp === 'فاتورة' || t.tp === 'فاتوره'));
    if(ctx.length) { ctx.sort((a,b) => String(b.dt||'').localeCompare(String(a.dt||''))); li = normalizeDate(ctx[0].dt); }
  }
  if(!li && mr && mr.v && O.ml) {
    for(let k = mr.v.length-1; k>=0; k--) if(Number(mr.v[k])>0 && O.ml[k]) { li = O.ml[k] + '-15'; break; }
  }
  const daysSinceLast = li ? (Math.floor((today - new Date(li)) / 864e5)) : 999;
  if(!mr){return{cadence:0,activeMonths:0,monthsIdle:99,daysSinceLast,status:'بيانات ناقصة',color:'var(--tx3)',ratio:0,expected:0};}
  // الأشهر النشطة
  const active=[];
  mr.v.forEach((v,i)=>{if(v>0)active.push(i);});
  const activeMonths=active.length;
  // إيقاع الشراء = متوسط الفجوة بين أشهر الشراء (بالأشهر)
  let cadence=1;
  if(active.length>=2){
    let gaps=0;for(let i=1;i<active.length;i++)gaps+=active[i]-active[i-1];
    cadence=gaps/(active.length-1);
  }
  // كم شهر منذ آخر شراء
  const lastActive=active.length?active[active.length-1]:-1;
  const monthsIdle=lastActive>=0?(O.ml.length-1-lastActive):99;
  // النسبة: الخمول الحالي مقابل إيقاعه الطبيعي
  const expected=Math.max(cadence,0.5);
  const ratio=daysSinceLast/(expected*30); // كم ضعف دورته الطبيعية
  // التصنيف الذكي: يقارن خموله بنمطه هو لا بمعيار ثابت
  let status,color;
  if(daysSinceLast>=90){status='متوقفة (90+ يوم)';color='var(--red)';}
  else if(daysSinceLast>=60){status='خاملة (60+ يوم)';color='#cc7722';}
  else if(ratio>=2.5){status='شاذة عن نمطها';color='#cc7722';}
  else if(daysSinceLast>=35||ratio>=1.8){status='تأخّر ملحوظ';color='#b8932f';}
  else{status='منتظمة';color='var(--grn)';}
  return{cadence:+cadence.toFixed(1),activeMonths,monthsIdle,daysSinceLast:isNaN(daysSinceLast)?999:daysSinceLast,status,color,ratio:isNaN(ratio)?0:+ratio.toFixed(1),expected:+(expected*30).toFixed(0)};
}

// قيمة الجمعية المعرّضة للخطر (للأولوية)
function valueAtRisk(s){
  // القيمة الشهرية المتوقعة × احتمال الفقدان
  const pc=purchaseCycle(s);
  const monthlyValue=s.s/Math.max(pc.activeMonths,1);
  const lossProb=Math.min(pc.daysSinceLast/120,1);
  return monthlyValue*lossProb;
}


// ══════════ صفحة دورة المشتريات ══════════
function pageCycle(pg,S,T){
  const analyzed=(O.soc||[]).map(s=>({...s,pc:purchaseCycle(s),var:valueAtRisk(s)}));
  // التصنيف حسب الخمول
  const stopped=analyzed.filter(s=>s.pc.daysSinceLast>=90);
  const idle=analyzed.filter(s=>s.pc.daysSinceLast>=60&&s.pc.daysSinceLast<90);
  const late=analyzed.filter(s=>(s.pc.daysSinceLast>=35&&s.pc.daysSinceLast<60)||s.pc.status==='شاذة عن نمطها'||s.pc.status==='تأخّر ملحوظ');
  const regular=analyzed.filter(s=>s.pc.status==='منتظمة');
  // القيمة المعرّضة للخطر الكلية
  const totalAtRisk=stopped.concat(idle).reduce((a,s)=>a+s.s,0);
  const lostMonthly=stopped.reduce((a,s)=>a+(s.s/Math.max(s.pc.activeMonths,1)),0);

  pg.innerHTML=`
  <div class="pulse"><div class="pi">🔄</div><div>
    <div class="pt">رادار دورة المشتريات</div>
    <div class="pd"><b style="color:var(--red)">${stopped.length}</b> جمعية متوقفة (+90 يوم) · <b style="color:#cc7722">${idle.length}</b> خاملة (60-90 يوم) · <b style="color:var(--gd)">${late.length}</b> متأخرة عن نمطها — قيمة معرّضة للخطر <b style="color:var(--red)">${KD(totalAtRisk)}</b></div>
  </div></div>
  <div class="kg">
    ${KC('متوقفة',stopped.length,'+90 يوم بلا شراء','var(--red)')}
    ${KC('خاملة',idle.length,'60-90 يوم','#cc7722')}
    ${KC('متأخرة عن نمطها',late.length,'تجاوزت إيقاعها','var(--gd)')}
    ${KC('منتظمة',regular.length,'ضمن دورتها','var(--grn)')}
  </div>
  <div class="g2">
    <div class="dc"><h3>📊 توزيع الجمعيات حسب الخمول</h3><canvas id="cyc_1"></canvas></div>
    <div class="dc"><h3>⏱️ خريطة الخمول (الأيام منذ آخر شراء)</h3>
      ${analyzed.sort((a,b)=>b.pc.daysSinceLast-a.pc.daysSinceLast).slice(0,12).map(s=>{const d=s.pc.daysSinceLast;const col=d>=90?'var(--red)':d>=60?'#cc7722':d>=35?'#b8932f':'var(--grn)';return `<div class="pb"><div class="pbn" title="${s.nm}">${SN(s.nm)}</div><div class="pbt"><div class="pbf" style="width:${Math.min(d/120*100,100)}%;background:${col}"></div></div><div class="pbv">${(isNaN(d)||d>900)?'—':d+' يوم'}</div></div>`;}).join('')}
    </div>
  </div>
  ${stopped.length?`<div class="stitle" style="color:var(--red)">🔴 جمعيات متوقفة — تدخّل عاجل (+90 يوم)</div>
  <div class="dc">${TB(stopped.sort((a,b)=>b.s-a.s),[
    ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
    ['المندوب',r=>r.ag||'—'],
    ['آخر فاتورة',r=>displayDate(r.li)],
    ['أيام التوقف',r=>`<b style="color:var(--red)">${isNaN(r.pc.daysSinceLast)?'—':r.pc.daysSinceLast} يوم</b>`],
    ['إيقاعها الطبيعي',r=>r.pc.cadence>0?`كل ${r.pc.cadence} شهر`:'—'],
    ['مبيعاتها السابقة',r=>`<span style="color:var(--gd)">${KD(r.s)}</span>`],
    ['الذمم',r=>r.ot>0?`<span style="color:var(--red)">${KD(r.ot)}</span>`:'—'],
    ['القرار',r=>'<span style="color:var(--red)">📞 زيارة استرداد فورية</span>'],
  ])}</div>`:''}
  ${idle.length?`<div class="stitle" style="color:#cc7722">🟠 جمعيات خاملة — متابعة هذا الأسبوع (60-90 يوم)</div>
  <div class="dc">${TB(idle.sort((a,b)=>b.s-a.s),[
    ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
    ['المندوب',r=>r.ag||'—'],
    ['آخر فاتورة',r=>displayDate(r.li)],
    ['أيام الخمول',r=>`<b style="color:#cc7722">${isNaN(r.pc.daysSinceLast)?'—':r.pc.daysSinceLast} يوم</b>`],
    ['إيقاعها الطبيعي',r=>r.pc.cadence>0?`كل ${r.pc.cadence} شهر`:'—'],
    ['مبيعاتها',r=>`<span style="color:var(--gd)">${KD(r.s)}</span>`],
    ['القرار',r=>'<span style="color:#cc7722">📨 اتصال + عرض تنشيط</span>'],
  ])}</div>`:''}
  ${late.length?`<div class="stitle" style="color:var(--gd)">🟡 متأخرة عن نمطها — راقب (تجاوزت إيقاعها المعتاد)</div>
  <div class="dc">${TB(late.sort((a,b)=>b.pc.ratio-a.pc.ratio),[
    ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
    ['المندوب',r=>r.ag||'—'],
    ['أيام منذ آخر شراء',r=>`${isNaN(r.pc.daysSinceLast)?'—':r.pc.daysSinceLast} يوم`],
    ['إيقاعها الطبيعي',r=>r.pc.cadence>0?`كل ${r.pc.cadence} شهر`:'—'],
    ['التأخر النسبي',r=>{const x=r.pc.ratio;return`<span class="bd ${x>=2.5?'br':x>=1.8?'by':'bg'}">${x}× دورتها</span>`}],
    ['مبيعاتها',r=>KD(r.s)],
    ['الحالة',r=>`<span class="bd by">${r.pc.status}</span>`],
  ])}</div>`:''}
  <div class="dc"><h3>📋 السجل الكامل لدورة المشتريات لكل الجمعيات</h3>
    ${TB(analyzed.sort((a,b)=>b.pc.daysSinceLast-a.pc.daysSinceLast),[
      ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المندوب',r=>r.ag||'—'],
      ['آخر فاتورة',r=>displayDate(r.li)],
      ['أيام منذ آخر شراء',r=>{const d=r.pc.daysSinceLast;if(isNaN(d))return'<span style="color:var(--tx3)">—</span>';return`<span style="color:${d>=90?'var(--red)':d>=60?'#cc7722':d>=35?'var(--gd)':'var(--grn)'}">${d>900?'—':d}</span>`}],
      ['أشهر نشطة',r=>`${r.pc.activeMonths}/${O.ml.length}`],
      ['إيقاع الشراء',r=>r.pc.cadence>0?`${r.pc.cadence} شهر`:'—'],
      ['مبيعاتها',r=>KD(r.s)],
      ['الحالة',r=>`<span class="bd" style="background:${r.pc.color}22;color:${r.pc.color}">${r.pc.status}</span>`],
    ])}
    <div style="font-size:12px;color:var(--tx3);margin-top:10px">"إيقاع الشراء" = متوسط الفترة بين مشترياتها. "التأخر النسبي" يقارن خمولها الحالي بإيقاعها الطبيعي — جمعية تشتري أسبوعياً وتأخرت شهرين أخطر من جمعية تشتري كل شهرين بطبيعتها.</div>
  </div>`;
  setTimeout(()=>MK('cyc_1',{type:'doughnut',data:{labels:['متوقفة (+90)','خاملة (60-90)','متأخرة','منتظمة'],datasets:[{data:[stopped.length,idle.length,late.length,regular.length],backgroundColor:['#c0392b','#cc7722','#b8932f','#1e8449']}]},options:{plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}}),30);
}

function pageAction(pg,S,T){
  const actions = [];
  // 1) قرارات الائتمان
  S.forEach(s=>{
    const r = riskScore(s);
    if(r.score >= 70) actions.push({pri:1, icon:'⛔', cat:'ائتمان', color:'var(--red)',
      title:`أوقف الائتمان عن ${SN(s.nm)}`, detail:`نقاط مخاطر ${r.score} · ذمم ${KD(s.ot)} · ${r.daysCol>900?'لا تحصيل':r.daysCol+' يوم بلا تحصيل'}`});
  });
  // 2) قرارات التحصيل (ديون قديمة)
  S.forEach(s=>{
    const days = daysSince(s.lc);
    if(days > 90 && s.ot > 2000) actions.push({pri:1, icon:'📞', cat:'تحصيل', color:'var(--red)',
      title:`اتصل لتحصيل ${SN(s.nm)}`, detail:`ذمم ${KD(s.ot)} متأخرة ${days} يوماً — خطر تعثّر`});
  });
  // 3) قرارات التعثر (جمعيات متوقفة)
  S.forEach(s=>{
    const ch = churnRisk(s.nm);
    if(ch.risk === 'متوقف' && s.s > 3000) actions.push({pri:2, icon:'🔄', cat:'تنشيط', color:'#f39c12',
      title:`أعد تنشيط ${SN(s.nm)}`, detail:`متوقفة منذ ${ch.emptyMonths} أشهر · مبيعات سابقة ${KD(s.s)} — عرض إعادة تنشيط`});
    else if(ch.risk === 'خطر انسحاب' && s.s > 2000) actions.push({pri:2, icon:'⚠️', cat:'احتفاظ', color:'#f39c12',
      title:`تابع ${SN(s.nm)} قبل الانسحاب`, detail:`تباطؤ الشراء — زيارة عاجلة`});
  });
  // 4) قرارات النمو (مكافأة)
  const ag = D.ag || [];
  ag.forEach(a=>{
    if((a.tg||0) > 0 && (a.ac||0)/(a.tg||1) >= 1) actions.push({pri:3, icon:'🏆', cat:'مكافأة', color:'var(--grn)',
      title:`كافئ المندوب ${a.nm}`, detail:`حقق ${PC((a.ac||0)/(a.tg||1)*100)} من الهدف`});
  });
  // 5) فرص نمو (جمعيات صاعدة كبيرة)
  S.forEach(s=>{
    const t = trendOf(s.nm);
    if(t.dir === 'صاعد' && t.pct > 30 && s.s > 5000) actions.push({pri:3, icon:'🚀', cat:'فرصة', color:'var(--grn)',
      title:`استثمر في نمو ${SN(s.nm)}`, detail:`نمو ${PC(t.pct)} — زِد المخزون/الزيارات`});
  });
  // 6) دورة المشتريات — جمعيات متوقفة/خاملة (رؤية جديدة)
  (O.soc||[]).forEach(s=>{
    const pc=purchaseCycle(s);
    if(pc.daysSinceLast>=90&&s.s>1500) actions.push({pri:1,icon:'🔄',cat:'استرداد',color:'var(--red)',
      title:`استرد ${SN(s.nm)} قبل فقدانها`,detail:`متوقفة ${pc.daysSinceLast} يوماً (إيقاعها المعتاد كل ${pc.cadence} شهر) · مبيعات سابقة ${KD(s.s)}`});
    else if(pc.daysSinceLast>=60&&pc.daysSinceLast<90&&s.s>2000) actions.push({pri:2,icon:'📨',cat:'تنشيط',color:'#f39c12',
      title:`نشّط ${SN(s.nm)}`,detail:`خاملة ${pc.daysSinceLast} يوماً — اتصال + عرض قبل التوقف الكامل`});
    else if(pc.status==='شاذة عن نمطها'&&s.s>3000) actions.push({pri:2,icon:'⏱️',cat:'مراقبة',color:'#f39c12',
      title:`راقب ${SN(s.nm)} — تأخر عن نمطها`,detail:`تجاوزت إيقاعها ${pc.ratio}× (المعتاد كل ${pc.cadence} شهر)`});
  });
  // 7) فرص بيع إضافي (اختراق منخفض داخل محفظة منتظمة)
  (O.soc||[]).forEach(s=>{
    const pc=purchaseCycle(s);
    const avgMonthly=s.s/Math.max(pc.activeMonths,1);
    if(pc.status==='منتظمة'&&avgMonthly<800&&pc.activeMonths>=6&&s.rt>=50) actions.push({pri:3,icon:'📈',cat:'بيع إضافي',color:'var(--grn)',
      title:`زِد اختراق ${SN(s.nm)}`,detail:`عميل منتظم لكن متوسطه الشهري منخفض (${KD(avgMonthly)}) — فرصة عرض أصناف إضافية`});
  });
  // 8) تنبيه تركّز المبيعات (مخاطرة استراتيجية)
  (()=>{const sorted=[...(O.soc||[])].sort((a,b)=>b.s-a.s);const totS=sorted.reduce((a,s)=>a+s.s,0);let cum=0,top3=0;sorted.slice(0,3).forEach(s=>top3+=s.s);
    if(totS>0&&top3/totS>0.4) actions.push({pri:2,icon:'⚖️',cat:'مخاطرة تركّز',color:'#f39c12',
      title:'خطر تركّز المبيعات',detail:`أكبر 3 جمعيات تشكّل ${PC(top3/totS*100)} من المبيعات — وسّع القاعدة لتقليل المخاطرة`});})();
  // 9) مراجعة تسعير (تآكل ربح عالٍ من الخصومات)
  (O.soc||[]).forEach(s=>{
    const imp=discountImpact(s);
    if(imp.erosion>35&&s.s>3000) actions.push({pri:2,icon:'💸',cat:'تسعير',color:'#f39c12',
      title:`راجع تسعير ${SN(s.nm)}`,detail:`الخصومات والمجاني تستهلك ${PC(imp.erosion)} من ربحها — هامش غير صحي`});
  });
  actions.sort((a,b)=>a.pri-b.pri);
  const p1 = actions.filter(a=>a.pri===1);
  const p2 = actions.filter(a=>a.pri===2);
  const p3 = actions.filter(a=>a.pri===3);
  pg.innerHTML = `
  <div class="pulse"><div class="pi">⚡</div><div>
    <div class="pt">مركز القرارات — ما الذي يحتاج تحرّكك اليوم</div>
    <div class="pd"><b style="color:var(--red)">${p1.length}</b> قرار عاجل · <b style="color:#f39c12">${p2.length}</b> متابعة · <b style="color:var(--grn)">${p3.length}</b> فرصة — مرتبة حسب الأولوية المالية</div>
  </div></div>
  ${(()=>{
    // حساب الأثر المالي
    const atRiskColl=(O.soc||[]).filter(s=>daysSince(s.lc)>90&&s.ot>0).reduce((a,s)=>a+s.ot,0);
    const atRiskChurn=(O.soc||[]).filter(s=>purchaseCycle(s).daysSinceLast>=60).reduce((a,s)=>a+(s.s/Math.max(purchaseCycle(s).activeMonths,1)),0);
    return `<div class="kg">
    ${KC('قرارات عاجلة', p1.length, 'ائتمان + تحصيل + استرداد', 'var(--red)')}
    ${KC('متابعات', p2.length, 'تنشيط + تسعير + مراقبة', '#f39c12')}
    ${KC('فرص ومكافآت', p3.length, 'نمو + بيع إضافي', 'var(--grn)')}
    ${KC('إجمالي الإجراءات', actions.length, 'قرار اليوم', 'var(--gd)')}
  </div>
  <div class="g2">
    <div class="dc" style="border-right:4px solid var(--red)"><h3>💰 الأثر المالي المعرّض للخطر</h3>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div style="flex:1;min-width:150px"><div style="font-size:12px;color:var(--tx3)">ذمم متعثّرة (+90 يوم)</div><div style="font-size:24px;font-weight:900;color:var(--red)">${KD(atRiskColl)}</div><div style="font-size:11px;color:var(--tx3)">عرضة للتحصيل المتعثّر</div></div>
        <div style="flex:1;min-width:150px"><div style="font-size:12px;color:var(--tx3)">إيراد شهري معرّض للفقدان</div><div style="font-size:24px;font-weight:900;color:#cc7722">${KD(atRiskChurn)}</div><div style="font-size:11px;color:var(--tx3)">من جمعيات خاملة/متوقفة</div></div>
      </div>
    </div>
    <div class="dc" style="border-right:4px solid var(--grn)"><h3>📈 توزيع القرارات حسب النوع</h3><canvas id="act_1" height="120"></canvas></div>
  </div>`;})()}
  ${p1.length?`<div class="stitle" style="color:var(--red)">🔴 عاجل — تحرّك الآن</div>${p1.map(actionCard).join('')}`:''}
  ${p2.length?`<div class="stitle" style="color:#f39c12">🟡 متابعة هذا الأسبوع</div>${p2.map(actionCard).join('')}`:''}
  ${p3.length?`<div class="stitle" style="color:var(--grn)">🟢 فرص ومكافآت</div>${p3.map(actionCard).join('')}`:''}
  ${actions.length===0?'<div class="ali grn"><span>✅</span><div>لا توجد قرارات عاجلة — الوضع مستقر</div></div>':''}
  `;
  setTimeout(()=>{
    const cats={};actions.forEach(a=>{cats[a.cat]=(cats[a.cat]||0)+1;});
    MK('act_1',{type:'bar',data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:'#b8932f',borderRadius:4}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}}},y:{ticks:{font:{size:11}}}}}});
  },30);
}

// ════════════════════════════════════════════
// صفحة الربح النقدي: الربح المحقق نقداً مقابل المحتجز في الذمم
// ════════════════════════════════════════════
function pageCashProfit(pg,S,T){
  const rows=S.map(s=>{
    const collRate=s.s>0?Math.min(s.c/s.s,1):0;
    const realizedProfit=s.pr*collRate;
    const trappedProfit=s.pr-realizedProfit;
    const trapPct=s.pr>0?trappedProfit/s.pr*100:0;
    return {...s,collRate:collRate*100,realizedProfit,trappedProfit,trapPct};
  });
  const totalBookProfit=rows.reduce((t,r)=>t+r.pr,0);
  const totalRealized=rows.reduce((t,r)=>t+r.realizedProfit,0);
  const totalTrapped=rows.reduce((t,r)=>t+r.trappedProfit,0);
  const realizationRate=totalBookProfit>0?totalRealized/totalBookProfit*100:0;
  const trapped=rows.filter(r=>r.trappedProfit>0).sort((a,b)=>b.trappedProfit-a.trappedProfit);
  const cashHeroes=rows.filter(r=>r.realizedProfit>0).sort((a,b)=>b.realizedProfit-a.realizedProfit);

  pg.innerHTML=`
  <div class="kg">
    ${KC('الربح الدفتري',KD(totalBookProfit),'مجمل الربح المحاسبي','var(--gd)')}
    ${KC('الربح المحقق نقداً',KD(totalRealized),PC(realizationRate)+' من الدفتري','var(--grn)')}
    ${KC('الربح المحتجز',KD(totalTrapped),'حبيس في الذمم','var(--red)')}
    ${KC('نسبة تحويل الربح لنقد',PC(realizationRate),realizationRate>=70?'صحي':realizationRate>=50?'متوسط':'منخفض',realizationRate>=70?'var(--grn)':realizationRate>=50?'#f39c12':'var(--red)')}
  </div>

  <div class="dc"><h3>💰 الربح المحقق نقداً مقابل المحتجز — لكل جمعية</h3>
    <div class="pd" style="margin-bottom:12px">الربح الدفتري لا يعني نقداً في الخزينة. كل جمعية يتحوّل ربحها لنقد بنسبة تحصيلها فقط — والباقي محتجز كذمم معرّضة للخطر.</div>
    <canvas id="cp_stack" height="95"></canvas>
  </div>

  <div class="dc"><h3>🔒 الربح المحتجز في الذمم — ترتيب حسب الأولوية</h3>
    <div class="pd" style="margin-bottom:12px">هذه الجمعيات تظهر مربحة على الورق لكن ربحها لم يتحوّل لنقد بعد. كل دينار هنا ربح حققته الشركة فعلاً لكنه لم يصل للخزينة — تحصيله أولوية قصوى.</div>
    ${TB(trapped,[
      ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المندوب',r=>r.ag||'—'],
      ['الربح الدفتري',r=>`<span style="color:var(--gd)">${KD(r.pr)}</span>`],
      ['نسبة التحصيل',r=>{const e=r.collRate;return`<span class="bd ${e>=70?'bg':e>=50?'by':'br'}">${PC(e)}</span>`}],
      ['الربح المحقق',r=>`<span style="color:var(--grn)">${KD(r.realizedProfit)}</span>`],
      ['الربح المحتجز',r=>`<span style="color:var(--red)">${KD(r.trappedProfit)}</span>`],
      ['نسبة الاحتجاز',r=>{const e=r.trapPct;return`<span class="bd ${e>50?'br':e>30?'by':'bg'}">${PC(e)}</span>`}],
      ['الأولوية',r=>{if(r.trappedProfit>1500)return'<span style="color:var(--red)">🔴 عاجل</span>';if(r.trappedProfit>500)return'<span style="color:#f39c12">🟡 متابعة</span>';return'<span style="color:var(--grn)">🟢 عادي</span>';}],
    ])}
  </div>

  <div class="dc"><h3>🏆 أبطال النقد — الربح الفعلي في الخزينة</h3>
    <div class="pd" style="margin-bottom:12px">الجمعيات التي تجمع بين الربحية العالية والتحصيل الجيد — هي المحرّك الحقيقي للسيولة، وتستحق الحفاظ عليها وتنميتها.</div>
    ${TB(cashHeroes.slice(0,12),[
      ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المندوب',r=>r.ag||'—'],
      ['المبيعات',r=>KD(r.s)],
      ['الربح الدفتري',r=>`<span style="color:var(--gd)">${KD(r.pr)}</span>`],
      ['نسبة التحصيل',r=>{const e=r.collRate;return`<span class="bd ${e>=70?'bg':e>=50?'by':'br'}">${PC(e)}</span>`}],
      ['الربح المحقق نقداً',r=>`<span style="color:var(--grn)">${KD(r.realizedProfit)}</span>`],
    ])}
  </div>`;

  const top=rows.slice().sort((a,b)=>b.pr-a.pr).slice(0,14);
  setTimeout(()=>MK('cp_stack',{type:'bar',data:{labels:top.map(s=>SN(s.nm)),datasets:[
    {label:'ربح محقق نقداً',data:top.map(s=>+s.realizedProfit.toFixed(0)),backgroundColor:'rgba(30,132,73,.75)',borderRadius:3},
    {label:'ربح محتجز',data:top.map(s=>+s.trappedProfit.toFixed(0)),backgroundColor:'rgba(192,57,43,.7)',borderRadius:3}
  ]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{stacked:true,ticks:{font:{size:9}}},y:{stacked:true,ticks:{font:{size:10}}}}}}),30);
}

// ════════════════════════════════════════════
// صفحة المصاريف وصافي الربح الحقيقي
// ════════════════════════════════════════════
function pageExpenses(pg,S,T){
  const ex=D.expenses||O.expenses;
  if(!ex||!ex.items||!ex.items.length){
    pg.innerHTML=`<div class="dc"><h3>🧾 المصاريف وصافي الربح</h3>
      <div class="pd">لم يُعثر على بيانات في شيت <b>"المصاريف الشهرية"</b> داخل ملف Excel، أو أن البنود فارغة (كل القيم صفر).<br>
      تأكد من تعبئة المصاريف الشهرية في الملف ثم أعد رفعه — وستظهر هنا تلقائياً مع حساب صافي الربح الحقيقي.</div></div>`;
    return;
  }
  const grossProfit=T.pr||0;                          // مجمل الربح من الداشبورد (بيانات موحّدة)
  const totalExp=ex.totalAnnual||0;                    // إجمالي المصاريف المصروفة فعلاً
  const netProfit=grossProfit-totalExp;               // صافي الربح الحقيقي
  const netMargin=T.s>0?netProfit/T.s*100:0;          // هامش صافي الربح
  const expRatio=grossProfit>0?totalExp/grossProfit*100:0; // المصاريف كنسبة من مجمل الربح
  const avgMonthly=ex.activeMonths>0?totalExp/ex.activeMonths:0;

  // ترتيب البنود تنازلياً
  const items=ex.items.slice().filter(i=>i.annual>0).sort((a,b)=>b.annual-a.annual);
  // الفئات
  const cats=Object.entries(ex.byCat).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  // الاتجاه الشهري (محاذٍ لمحور زمن الداشبورد O.mk)
  const monLabels=O.ml||[], monKeys=O.mk||[];
  const expByMonth=monKeys.map(mk=>+(ex.monthlyTotal[mk]||0).toFixed(2));

  pg.innerHTML=`
  <div class="kg">
    ${KC('مجمل الربح',KD(grossProfit),'قبل المصاريف','var(--gd)')}
    ${KC('إجمالي المصاريف',KD(totalExp),ex.activeMonths+' أشهر مصروفة','var(--red)')}
    ${KC('صافي الربح الحقيقي',KD(netProfit),PC(netMargin)+' هامش صافي',netProfit>=0?'var(--grn)':'var(--red)')}
    ${KC('المصاريف ÷ مجمل الربح',PC(expRatio),expRatio<40?'صحي':expRatio<70?'مقبول':'مرتفع',expRatio<40?'var(--grn)':expRatio<70?'#f39c12':'var(--red)')}
  </div>

  <div class="dc"><h3>📉 المصاريف الشهرية مقابل مجمل الربح التراكمي</h3>
    <div class="pd" style="margin-bottom:12px">متوسط المصاريف الشهرية ${KD(avgMonthly)} عبر ${ex.activeMonths} أشهر مصروفة. تتبّع إيقاع المصاريف يكشف أي قفزة غير معتادة تستدعي المراجعة.</div>
    <canvas id="exp_trend" height="90"></canvas>
  </div>

  <div class="dc"><h3>🗂️ المصاريف حسب الفئة</h3>
    <div class="exp-cat-grid">
      ${cats.map(([c,v])=>{const p=totalExp>0?v/totalExp*100:0;
        return `<div class="exp-cat"><div class="exp-cat-name">${c}</div>
          <div class="exp-cat-val">${KD(v)}</div>
          <div class="exp-cat-bar"><div style="width:${Math.min(p,100)}%"></div></div>
          <div class="exp-cat-pct">${PC(p)} من الإجمالي</div></div>`;}).join('')}
    </div>
  </div>

  <div class="dc"><h3>📋 تفصيل بنود المصاريف</h3>
    ${TB(items,[
      ['البند',r=>r.name],
      ['الفئة',r=>`<span class="bd by">${r.cat}</span>`],
      ['الإجمالي المصروف',r=>`<span style="color:var(--red)">${KD(r.annual)}</span>`],
      ['متوسط شهري',r=>{const m=Object.keys(r.monthly).length;return KD(m>0?r.annual/m:0);}],
      ['% من المصاريف',r=>{const p=totalExp>0?r.annual/totalExp*100:0;return`<span class="bd ${p>25?'br':p>10?'by':'bg'}">${PC(p)}</span>`;}],
    ])}
  </div>

  <div class="dc"><h3>🧮 قائمة الدخل المبسّطة (من بياناتك الفعلية)</h3>
    <div class="income-stmt">
      <div class="is-row"><span>صافي المبيعات</span><span style="color:var(--gd)">${KD(T.s)}</span></div>
      <div class="is-row"><span>− تكلفة المباع (COGS + خصم + مجاني)</span><span style="color:var(--red)">(${KD(T.co)})</span></div>
      <div class="is-row is-sub"><span>= مجمل الربح</span><span style="color:var(--gd)">${KD(grossProfit)}</span></div>
      <div class="is-row"><span>− المصاريف التشغيلية</span><span style="color:var(--red)">(${KD(totalExp)})</span></div>
      <div class="is-row is-total"><span>= صافي الربح الحقيقي</span><span style="color:${netProfit>=0?'var(--grn)':'var(--red)'}">${KD(netProfit)}</span></div>
      <div class="is-row is-margin"><span>هامش صافي الربح</span><span>${PC(netMargin)}</span></div>
    </div>
    <div class="pd" style="margin-top:12px">ملاحظة تدقيقية: مجمل الربح أعلاه محسوب من بيانات المبيعات الموحّدة في الداشبورد (شيت HANY1)، والمصاريف من شيت "المصاريف الشهرية". إذا كان شيت المصاريف يعرض رقم مجمل ربح مختلفاً، فهو مرتبط بخلية قديمة في الملف وينبغي تحديث ربطها لتطابق هذا الرقم.</div>
  </div>`;

  setTimeout(()=>MK('exp_trend',{type:'bar',data:{labels:monLabels,datasets:[
    {type:'line',label:'مجمل الربح التراكمي',data:(O.mt||[]).map((v,i,a)=>+a.slice(0,i+1).reduce((t,x)=>t+(x||0),0).toFixed(0)),borderColor:'#b8932f',backgroundColor:'rgba(184,147,47,.08)',borderWidth:2,fill:true,tension:.3,yAxisID:'y1',pointRadius:2},
    {type:'bar',label:'المصاريف الشهرية',data:expByMonth,backgroundColor:'rgba(192,57,43,.7)',borderRadius:3,yAxisID:'y'}
  ]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{ticks:{font:{size:9}}},y:{position:'right',ticks:{font:{size:9}}},y1:{position:'left',ticks:{font:{size:9}},grid:{display:false}}}}}),30);
}
// ════════════════════════════════════════════
// صفحة الربحية الموحّدة: قائمة الدخل + الربح النقدي + المصاريف
// (دمج الربح النقدي + المصاريف وصافي الربح في سرد مالي متدرّج)
// ════════════════════════════════════════════
function pageProfitability(pg,S,T){
  // ── حسابات الربح النقدي (لكل جمعية) ──
  const rows=S.map(s=>{
    const collRate=s.s>0?Math.min(s.c/s.s,1):0;
    const realizedProfit=s.pr*collRate;
    const trappedProfit=s.pr-realizedProfit;
    const trapPct=s.pr>0?trappedProfit/s.pr*100:0;
    return {...s,collRate:collRate*100,realizedProfit,trappedProfit,trapPct};
  });
  const totalBookProfit=rows.reduce((t,r)=>t+r.pr,0);
  const totalRealized=rows.reduce((t,r)=>t+r.realizedProfit,0);
  const totalTrapped=rows.reduce((t,r)=>t+r.trappedProfit,0);
  const realizationRate=totalBookProfit>0?totalRealized/totalBookProfit*100:0;
  const trapped=rows.filter(r=>r.trappedProfit>0).sort((a,b)=>b.trappedProfit-a.trappedProfit);
  const cashHeroes=rows.filter(r=>r.realizedProfit>0).sort((a,b)=>b.realizedProfit-a.realizedProfit);

  // ── حسابات المصاريف ──
  const ex=D.expenses||O.expenses;
  const hasExp=!!(ex&&ex.items&&ex.items.length);
  const grossProfit=T.pr||0;
  // ── المصاريف تُطابَق مع الفترة المعروضة (مبدأ المقابلة) ──
  const _fa=(typeof _filterA==='number')?_filterA:0;
  const _fb=(typeof _filterB==='number')?_filterB:((O.ml||[]).length-1);
  const _isFullP=(_fa===0&&_fb>=((O.ml||[]).length-1));
  let totalExp=0, expMonthsCount=0;
  if(hasExp){
    if(ex.monthlyTotal&&!_isFullP){
      // مجموع مصاريف الأشهر ضمن النطاق المفلتر فقط
      for(let k=_fa;k<=_fb;k++){const mk=(O.mk||[])[k];if(mk&&ex.monthlyTotal[mk]!=null){totalExp+=N(ex.monthlyTotal[mk]);expMonthsCount++;}}
    }else{
      totalExp=ex.totalAnnual||0;
      expMonthsCount=ex.activeMonths||0;
    }
  }
  const netProfit=grossProfit-totalExp;
  const netMargin=T.s>0?netProfit/T.s*100:0;
  const expRatio=grossProfit>0?totalExp/grossProfit*100:0;
  const avgMonthly=(hasExp&&expMonthsCount>0)?totalExp/expMonthsCount:0;
  const items=hasExp?ex.items.slice().filter(i=>i.annual>0).sort((a,b)=>b.annual-a.annual):[];
  const cats=hasExp?Object.entries(ex.byCat).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]):[];
  const monLabels=O.ml||[], monKeys=O.mk||[];
  const expByMonth=hasExp?monKeys.map(mk=>+(ex.monthlyTotal[mk]||0).toFixed(2)):[];

  pg.innerHTML=`
  ${periodBadge()}
  <div class="kg">
    ${KC('مجمل الربح',KD(grossProfit),'مبيعات − تكلفة','var(--gd)')}
    ${KC('الربح المحقق نقداً',KD(totalRealized),PC(realizationRate)+' من الدفتري','var(--grn)')}
    ${KC('إجمالي المصاريف',KD(totalExp),hasExp?ex.activeMonths+' أشهر مصروفة':'لا بيانات','var(--red)')}
    ${KC('صافي الربح الحقيقي',KD(netProfit),PC(netMargin)+' هامش صافي',netProfit>=0?'var(--grn)':'var(--red)')}
  </div>

  <div class="quick-nav">
    <button class="qn-btn" onclick="scrollToSec('sec_income')"><span>🧮</span> قائمة الدخل</button>
    <button class="qn-btn" onclick="scrollToSec('sec_cash')"><span>💰</span> الربح النقدي</button>
    <button class="qn-btn" onclick="scrollToSec('sec_exp')"><span>🧾</span> المصاريف</button>
  </div>

  <div class="dc" id="sec_income"><h3>🧮 قائمة الدخل المتدرّجة (من بياناتك الفعلية)</h3>
    <div class="pd" style="margin-bottom:12px">المسار المالي الكامل من المبيعات إلى صافي الربح: كل سطر مبني على بياناتك الموحّدة من شيت HANY1 وشيت المصاريف الشهرية.</div>
    <div class="income-stmt">
      <div class="is-row"><span>صافي المبيعات</span><span style="color:var(--gd)">${KD(T.s)}</span></div>
      <div class="is-row"><span>− تكلفة المباع (COGS + خصم + مجاني)</span><span style="color:var(--red)">(${KD(T.co)})</span></div>
      <div class="is-row is-sub"><span>= مجمل الربح</span><span style="color:var(--gd)">${KD(grossProfit)}</span></div>
      <div class="is-row"><span>− المصاريف التشغيلية</span><span style="color:var(--red)">(${KD(totalExp)})</span></div>
      <div class="is-row is-total"><span>= صافي الربح الحقيقي</span><span style="color:${netProfit>=0?'var(--grn)':'var(--red)'}">${KD(netProfit)}</span></div>
      <div class="is-row is-margin"><span>هامش صافي الربح</span><span>${PC(netMargin)}</span></div>
      <div class="is-sep">الواقع النقدي — كم تحوّل فعلاً إلى الخزينة</div>
      <div class="is-row is-margin"><span>الربح المحقق نقداً (بعد التحصيل)</span><span style="color:var(--grn)">${KD(totalRealized)}</span></div>
      <div class="is-row is-margin"><span>الربح المحتجز في الذمم</span><span style="color:var(--red)">${KD(totalTrapped)}</span></div>
    </div>
  </div>

  ${(()=>{
    // 🛡️ FIX: حساب نقطة التعادل (Break-Even) من المصاريف التشغيلية + متوسط ربح الوحدة
    if(!hasExp || totalExp <= 0 || T.s <= 0) return '';
    const activeMonths = O.ml.length || 1;
    const monthlyExp = totalExp / activeMonths;
    // متوسط سعر الوحدة وتكلفتها من الأصناف
    let avgPrice = 1, avgCost = 0.5;
    if(O.it && O.it.length){
      const totalQty = O.it.reduce((a,x)=>a+(+x.sl||0),0) || 1;
      avgPrice = O.it.reduce((a,x)=>a+(+x.up||0)*(+x.sl||0),0) / totalQty;
      avgCost = O.it.reduce((a,x)=>a+(+x.uc||0)*(+x.sl||0),0) / totalQty;
    }
    if(avgPrice <= avgCost) return ''; // لا يمكن حساب التعادل
    const currentUnits = activeMonths > 0 ? T.s / avgPrice : 0;
    const be = BreakEven.calculate({
      fixedCosts: monthlyExp,
      variableCostPerUnit: avgCost,
      pricePerUnit: avgPrice,
      currentUnits: currentUnits,
      periodMonths: 1
    });
    if(!be.ok) return '';
    const beColor = be.marginOfSafetyPct > 30 ? 'var(--grn)' : be.marginOfSafetyPct > 0 ? '#f39c12' : 'var(--red)';
    return `
  <div class="dc" style="border-right:3px solid ${beColor}">
    <h3>⚖️ نقطة التعادل الشهري (Break-Even Analysis) — 🛡️ جديد</h3>
    <div class="pd" style="margin-bottom:12px">تحليل نقطة التعادل بناءً على المصاريف التشغيلية الشهرية ومتوسط ربح الوحدة. يكشف المسافة الآمنة بين أدائك الحالي وهامش الخسارة.</div>
    <div class="kg">
      <div class="kc" style="border-top-color:${beColor}">
        <div class="kl">نقطة التعادل الشهرية</div>
        <div class="kv" style="color:${beColor}">${fmt(be.units)}</div>
        <div class="ks">وحدة / شهر</div>
      </div>
      <div class="kc" style="border-top-color:var(--gd)">
        <div class="kl">إيراد التعادل</div>
        <div class="kv" style="color:var(--gd)">${KD(be.revenue)}</div>
        <div class="ks">لتحقيق التعادل</div>
      </div>
      <div class="kc" style="border-top-color:${beColor}">
        <div class="kl">هامش الأمان</div>
        <div class="kv" style="color:${beColor}">${be.marginOfSafetyPct.toFixed(1)}%</div>
        <div class="ks">${be.evaluation || ''}</div>
      </div>
      <div class="kc" style="border-top-color:var(--blu)">
        <div class="kl">هامش المساهمة</div>
        <div class="kv" style="color:var(--blu)">${be.contributionMarginRatio.toFixed(1)}%</div>
        <div class="ks">من سعر البيع</div>
      </div>
    </div>
    <div class="pd" style="margin-top:10px;font-size:12px;color:var(--tx2);line-height:1.8">
      <b>كيف نقراها:</b> تحتاج بيع <b style="color:${beColor}">${fmt(be.units)} وحدة/شهر</b> بإيراد <b>${KD(be.revenue)}</b> لتغطية المصاريف التشغيلية البالغة <b>${KD(monthlyExp)}</b>. أداؤك الحالي <b>${fmt(currentUnits)} وحدة</b> يحقق هامش أمان <b style="color:${beColor}">${be.marginOfSafetyPct.toFixed(1)}%</b> فوق نقطة التعادل.
    </div>
  </div>`;
  })()}

  <div class="dc" id="sec_cash"><h3>💰 الربح المحقق نقداً مقابل المحتجز — لكل جمعية</h3>
    <div class="pd" style="margin-bottom:12px">الربح الدفتري لا يعني نقداً في الخزينة. كل جمعية يتحوّل ربحها لنقد بنسبة تحصيلها فقط — والباقي محتجز كذمم معرّضة للخطر. نسبة التحويل الكلية: ${PC(realizationRate)}.</div>
    <canvas id="prof_stack" height="95"></canvas>
  </div>

  <div class="dc"><h3>🔒 الربح المحتجز في الذمم — ترتيب حسب الأولوية</h3>
    <div class="pd" style="margin-bottom:12px">جمعيات مربحة على الورق لكن ربحها لم يتحوّل لنقد بعد. كل دينار هنا ربح حققته الشركة فعلاً لكنه لم يصل للخزينة — تحصيله أولوية.</div>
    ${TB(trapped,[
      ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المندوب',r=>r.ag||'—'],
      ['الربح الدفتري',r=>`<span style="color:var(--gd)">${KD(r.pr)}</span>`],
      ['نسبة التحصيل',r=>{const e=r.collRate;return`<span class="bd ${e>=70?'bg':e>=50?'by':'br'}">${PC(e)}</span>`}],
      ['الربح المحقق',r=>`<span style="color:var(--grn)">${KD(r.realizedProfit)}</span>`],
      ['الربح المحتجز',r=>`<span style="color:var(--red)">${KD(r.trappedProfit)}</span>`],
      ['نسبة الاحتجاز',r=>{const e=r.trapPct;return`<span class="bd ${e>50?'br':e>30?'by':'bg'}">${PC(e)}</span>`}],
      ['الأولوية',r=>{if(r.trappedProfit>1500)return'<span style="color:var(--red)">🔴 عاجل</span>';if(r.trappedProfit>500)return'<span style="color:#f39c12">🟡 متابعة</span>';return'<span style="color:var(--grn)">🟢 عادي</span>';}],
    ])}
  </div>

  <div class="dc"><h3>🏆 أبطال النقد — الربح الفعلي في الخزينة</h3>
    <div class="pd" style="margin-bottom:12px">جمعيات تجمع بين الربحية العالية والتحصيل الجيد — المحرّك الحقيقي للسيولة.</div>
    ${TB(cashHeroes.slice(0,12),[
      ['الجمعية',r=>`<span title="${r.nm}">${SN(r.nm)}</span>`],
      ['المندوب',r=>r.ag||'—'],
      ['المبيعات',r=>KD(r.s)],
      ['الربح الدفتري',r=>`<span style="color:var(--gd)">${KD(r.pr)}</span>`],
      ['نسبة التحصيل',r=>{const e=r.collRate;return`<span class="bd ${e>=70?'bg':e>=50?'by':'br'}">${PC(e)}</span>`}],
      ['الربح المحقق نقداً',r=>`<span style="color:var(--grn)">${KD(r.realizedProfit)}</span>`],
    ])}
  </div>

  ${hasExp?`
  <div class="dc" id="sec_exp"><h3>📉 المصاريف الشهرية مقابل مجمل الربح التراكمي</h3>
    <div class="pd" style="margin-bottom:12px">متوسط المصاريف الشهرية ${KD(avgMonthly)} عبر ${ex.activeMonths} أشهر مصروفة. المصاريف ÷ مجمل الربح = ${PC(expRatio)} (${expRatio<40?'صحي':expRatio<70?'مقبول':'مرتفع'}).</div>
    <canvas id="prof_exptrend" height="90"></canvas>
  </div>

  <div class="dc"><h3>🗂️ المصاريف حسب الفئة</h3>
    <div class="exp-cat-grid">
      ${cats.map(([c,v])=>{const p=totalExp>0?v/totalExp*100:0;
        return `<div class="exp-cat"><div class="exp-cat-name">${c}</div>
          <div class="exp-cat-val">${KD(v)}</div>
          <div class="exp-cat-bar"><div style="width:${Math.min(p,100)}%"></div></div>
          <div class="exp-cat-pct">${PC(p)} من الإجمالي</div></div>`;}).join('')}
    </div>
  </div>

  <div class="dc"><h3>📋 تفصيل بنود المصاريف</h3>
    ${TB(items,[
      ['البند',r=>r.name],
      ['الفئة',r=>`<span class="bd by">${r.cat}</span>`],
      ['الإجمالي المصروف',r=>`<span style="color:var(--red)">${KD(r.annual)}</span>`],
      ['متوسط شهري',r=>{const m=Object.keys(r.monthly).length;return KD(m>0?r.annual/m:0);}],
      ['% من المصاريف',r=>{const p=totalExp>0?r.annual/totalExp*100:0;return`<span class="bd ${p>25?'br':p>10?'by':'bg'}">${PC(p)}</span>`;}],
    ])}
    <div class="pd" style="margin-top:12px">ملاحظة تدقيقية: مجمل الربح محسوب من بيانات المبيعات الموحّدة (HANY1)، والمصاريف من شيت "المصاريف الشهرية". إن عرض شيت المصاريف رقم مجمل ربح مختلفاً فهو مرتبط بخلية قديمة في الملف.</div>
  </div>`:`
  <div class="dc"><h3>🧾 المصاريف</h3>
    <div class="pd">لم يُعثر على بيانات في شيت "المصاريف الشهرية" داخل ملف Excel، أو أن البنود فارغة. تأكد من تعبئتها وأعد الرفع لتظهر هنا.</div>
  </div>`}`;

  // الرسوم
  const top=rows.slice().sort((a,b)=>b.pr-a.pr).slice(0,14);
  setTimeout(()=>{
    MK('prof_stack',{type:'bar',data:{labels:top.map(s=>SN(s.nm)),datasets:[
      {label:'ربح محقق نقداً',data:top.map(s=>+s.realizedProfit.toFixed(0)),backgroundColor:'rgba(30,132,73,.75)',borderRadius:3},
      {label:'ربح محتجز',data:top.map(s=>+s.trappedProfit.toFixed(0)),backgroundColor:'rgba(192,57,43,.7)',borderRadius:3}
    ]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{stacked:true,ticks:{font:{size:9}}},y:{stacked:true,ticks:{font:{size:10}}}}}});
    if(hasExp){
      MK('prof_exptrend',{type:'bar',data:{labels:monLabels,datasets:[
        {type:'line',label:'مجمل الربح التراكمي',data:(O.mt||[]).map((v,i,a)=>+a.slice(0,i+1).reduce((t,x)=>t+(x||0),0).toFixed(0)),borderColor:'#b8932f',backgroundColor:'rgba(184,147,47,.08)',borderWidth:2,fill:true,tension:.3,yAxisID:'y1',pointRadius:2},
        {type:'bar',label:'المصاريف الشهرية',data:expByMonth,backgroundColor:'rgba(192,57,43,.7)',borderRadius:3,yAxisID:'y'}
      ]},options:{plugins:{legend:{labels:{font:{size:10}}}},scales:{x:{ticks:{font:{size:9}}},y:{position:'right',ticks:{font:{size:9}}},y1:{position:'left',ticks:{font:{size:9}},grid:{display:false}}}}});
    }
  },30);
}
function actionCard(a){
  return `<div class="dc" style="padding:12px 16px;margin-bottom:8px;border-right:3px solid ${a.color};display:flex;gap:12px;align-items:center">
    <span style="font-size:22px">${a.icon}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:700;color:${a.color}">${a.title}</div>
      <div style="font-size:12px;color:var(--tx2);margin-top:2px">${a.detail}</div>
    </div>
    <span class="bd" style="background:${a.color}22;color:${a.color}">${a.cat}</span>
  </div>`;
}



// ════════════════════════════════════════════
// محرك تحليل المناديب المتقدم (Sales Manager Engine)
// ════════════════════════════════════════════

// إحصاءات شاملة لكل مندوب من بيانات الجمعيات + الشهرية
function agentDeepStats(ag){
  // جمعيات هذا المندوب من البيانات الكاملة
  const mySocs = O.soc.filter(s => s.ag === ag.nm);
  const totSales = mySocs.reduce((a,s)=>a+s.s,0);
  const totProfit = mySocs.reduce((a,s)=>a+(s.pr||0),0);
  const totInv = mySocs.reduce((a,s)=>a+(s.inv||0),0);
  const totColl = mySocs.reduce((a,s)=>a+(s.c||0),0);
  const totOut = mySocs.reduce((a,s)=>a+(s.ot||(s.s-s.c)),0);
  const avgInvoice = totInv>0 ? totSales/totInv : 0;
  const salesPerSoc = mySocs.length>0 ? totSales/mySocs.length : 0;
  const profitMargin = totSales>0 ? totProfit/totSales*100 : 0;
  const collRate = totSales>0 ? totColl/totSales*100 : 0;
  // تصنيف ABC لجمعيات المندوب
  const classified = abcClassify(O.soc);
  const myClassified = classified.filter(s => s.ag === ag.nm);
  const aCount = myClassified.filter(s=>s.cls==='A').length;
  const bCount = myClassified.filter(s=>s.cls==='B').length;
  const cCount = myClassified.filter(s=>s.cls==='C').length;
  return {socs:mySocs, count:mySocs.length, totSales, totProfit, totInv, totColl, totOut,
    avgInvoice, salesPerSoc, profitMargin, collRate, aCount, bCount, cCount};
}

// اتجاه المندوب (Momentum) — انحدار خطي على آخر 6 أشهر
function agentMomentum(ag){
  const sv = ag.sv || [];
  const active = sv.filter(v=>v>0);
  if(active.length < 3) return {dir:'جديد', slope:0, pct:0, recent:0, prev:0};
  const recent = sv.slice(-3).reduce((a,b)=>a+b,0);
  const prev = sv.slice(-6,-3).reduce((a,b)=>a+b,0);
  const last6 = sv.slice(-6);
  const n = last6.length;
  const xs = last6.map((_,i)=>i);
  const sx=xs.reduce((a,b)=>a+b,0), sy=last6.reduce((a,b)=>a+b,0);
  const sxy=xs.reduce((a,x,i)=>a+x*last6[i],0), sxx=xs.reduce((a,x)=>a+x*x,0);
  const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx||1);
  const pct = prev>0 ? ((recent-prev)/prev*100) : (recent>0?100:0);
  let dir;
  if(pct>15) dir='صاعد';
  else if(pct<-15) dir='هابط';
  else dir='مستقر';
  return {dir, slope, pct, recent, prev};
}

// ثبات الأداء (Consistency) — معامل التشتت العكسي
function agentConsistency(ag){
  let sv = (ag.sv||[]).filter(v=>v>0);
  if(sv.length < 3) return {score:0, cv:0, level:'غير كافٍ'};
  // استبعاد الرصيد الافتتاحي: إذا كانت القيمة الأولى شاذة جداً (> 3x متوسط الباقي) نحذفها
  if(sv.length > 4){
    const rest = sv.slice(1);
    const restMean = rest.reduce((a,b)=>a+b,0)/rest.length;
    if(sv[0] > restMean*3) sv = rest;
  }
  const mean = sv.reduce((a,b)=>a+b,0)/sv.length;
  const variance = sv.reduce((a,b)=>a+(b-mean)**2,0)/sv.length;
  const cv = mean>0 ? Math.sqrt(variance)/mean : 1;
  const score = Math.max(0, Math.round((1-Math.min(cv,1))*100));
  let level;
  if(cv < 0.25) level='ممتاز';
  else if(cv < 0.5) level='جيد';
  else if(cv < 0.75) level='متذبذب';
  else level='غير منتظم';
  return {score, cv, level, mean};
}

// اكتساب وفقدان الجمعيات (Acquisition/Churn)
function agentAcquisition(ag){
  const mySocs = O.soc.filter(s => s.ag === ag.nm);
  let active=0, slowing=0, lost=0, newly=0;
  const half = Math.floor(O.ml.length/2);
  mySocs.forEach(s => {
    const mr = O.mon.find(m=>m.nm===s.nm);
    if(!mr) return;
    // كم شهر أخير بلا شراء
    let emptyTail=0;
    for(let i=mr.v.length-1;i>=0;i--){ if(mr.v[i]>0) break; emptyTail++; }
    // متى أول شراء
    let firstBuy=-1;
    for(let i=0;i<mr.v.length;i++){ if(mr.v[i]>0){firstBuy=i;break;} }
    if(emptyTail >= 3) lost++;
    else if(emptyTail >= 1) slowing++;
    else active++;
    if(firstBuy >= half) newly++; // بدأ الشراء في النصف الثاني = جمعية جديدة نسبياً
  });
  return {active, slowing, lost, newly, total:mySocs.length};
}

// بطاقة التقييم الشاملة (Scorecard)
function agentScorecard(ag){
  const stats = agentDeepStats(ag);
  const mom = agentMomentum(ag);
  const cons = agentConsistency(ag);
  // حساب التارجت الكلي والإنجاز
  const totTgt = (ag.tv||[]).reduce((a,b)=>a+b,0);
  const achPct = totTgt>0 ? Math.min(ag.s/totTgt*100, 150) : (stats.totSales>0?100:0);
  // النقاط المركّبة (0-100)
  const sAchievement = Math.min(achPct, 100) * 0.30;
  const sCollection = Math.min(stats.collRate, 100) * 0.25;
  const sGrowth = (mom.dir==='صاعد'?100 : mom.dir==='مستقر'?65 : mom.dir==='هابط'?30 : 50) * 0.20;
  const sConsistency = cons.score * 0.15;
  const sProfitability = Math.min(stats.profitMargin/60*100, 100) * 0.10; // 60% هامش = ممتاز
  const total = Math.round(sAchievement + sCollection + sGrowth + sConsistency + sProfitability);
  let rank, color, advice;
  if(total >= 75){ rank='نجم 🌟'; color='var(--grn)'; advice='حافظ عليه، وكافئه، وكلّفه بجمعيات نمو'; }
  else if(total >= 55){ rank='موثوق ✓'; color='var(--blu)'; advice='أداء جيد، ادعمه لرفع نقطة ضعفه الأساسية'; }
  else if(total >= 40){ rank='يحتاج دعم'; color='var(--gd)'; advice='حدّد الفجوة (تحصيل/نمو) ووفّر تدريباً موجّهاً'; }
  else { rank='تحت المراقبة ⚠️'; color='var(--red)'; advice='مراجعة عاجلة للأهداف والمحفظة والدعم'; }
  return {total, rank, color, advice, stats, mom, cons, achPct,
    breakdown:{achievement:Math.round(sAchievement), collection:Math.round(sCollection),
      growth:Math.round(sGrowth), consistency:Math.round(sConsistency), profitability:Math.round(sProfitability)}};
}



function showToast(title,sub,isErr){
  const t=$('toast');if(!t)return;
  $('toastIco').textContent=isErr?'⚠️':'✅';
  $('toastTitle').textContent=title;
  $('toastSub').textContent=sub||'';
  t.classList.toggle('err',!!isErr);
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>t.classList.remove('show'),isErr?5000:4000);
}

// ══ READ FILE ══
// تحويل أي قيمة تاريخ (Date / نص ISO / رقم Excel) إلى مفتاح شهر YYYY-MM بثبات
function toMonthKey(v){
  if(!v)return '';
  // كائن Date — استخدم UTC لتفادي انحراف المنطقة الزمنية
  if(typeof v==='object'&&typeof v.getFullYear==='function'){
    const y=v.getUTCFullYear();
    const m=v.getUTCMonth()+1;
    if(y<2000||y>2040)return '';
    return y+'-'+String(m).padStart(2,'0');
  }
  // رقم تسلسلي من Excel
  if(typeof v==='number'&&v>20000&&v<80000){
    const d=new Date(Math.round((v-25569)*864e5));
    return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
  }
  const s=String(v).trim();
  // صيغة ISO: 2026-01-01 أو 2026-05
  let m=s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/); if(m)return m[1]+'-'+m[2].padStart(2,'0');
  // صيغة d/m/yyyy أو m/d/yyyy
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m)return m[3]+'-'+m[2].padStart(2,'0');
  // صيغة yyyy/m
  m=s.match(/^(\d{4})\/(\d{1,2})$/); if(m)return m[1]+'-'+m[2].padStart(2,'0');
  // كحل أخير: جرّب Date()
  const d=new Date(s);
  if(!isNaN(d)&&d.getFullYear()>2000)return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
  return '';
}

/**
 * تحميل نموذج Excel فارغ مع شيت "HANY1" + بيانات تجريبية
 * - يحوي الـ schema الكامل الذي يتعرف عليه ExcelColumnDetector
 * - 8 صفوف تجريبية (عملاء + معاملات + أصناف)
 * - يكتب الملف باستخدام XLSX.writeFile
 */
function downloadExcelTemplate(){
  try {
    if(typeof XLSX === 'undefined'){
      showToast('⚠️ مكتبة XLSX غير محمّلة','المعذرة، يرجى إعادة تحميل الصفحة',true);
      return;
    }

    const wb = XLSX.utils.book_new();

    // === HANY1 sheet === (الحركات الرئيسية)
    const txHeader = ['التاريخ','النوع','رقم الوثيقة','العميل','مدين','دائن','كمية','خصم','فلا','المندوب','الشهر','الصنف','كود الصنف'];
    const txSample = [
      ['2025-08-18','فاتوره','832','جمعية النهضة التجارية',150,0,1,0,0,'محمود سمير','2025-08','الكمبية 100','CB100'],
      ['2025-09-09','فاتوره','793','جمعية النهضة التجارية',150,0,1,0,0,'محمود سمير','2025-09','الكمبية 100','CB100'],
      ['2025-09-12','تحصيل','857','جمعية النهضة التجارية',0,45,0,0,0,'محمود سمير','2025-09','-','-'],
      ['2025-10-01','فاتوره','928','جمعية النهضة التجارية',45,0,0.3,0,0,'محمود سمير','2025-10','الكمبية 30','CB30'],
      ['2025-11-14','فاتوره','953','جمعية النهضة التجارية',150,0,1,0,0,'محمود سمير','2025-11','الكمبية 100','CB100'],
      ['2026-01-09','فاتوره','1026','جمعية النهضة التجارية',150,0,1,0,0,'محمود سمير','2026-01','الكمبية 100','CB100'],
      ['2026-02-17','فاتوره','1103','جمعية النهضة التجارية',225,0,1.5,0,0,'أحمد العلي','2026-02','الكمبية 150','CB150'],
      ['2026-06-20','فاتوره','1240','جمعية النهضة التجارية',45,0,0.3,0,0,'محمود سمير','2026-06','الكمبية 30','CB30']
    ];
    const ws1 = XLSX.utils.aoa_to_sheet([txHeader, ...txSample]);
    ws1['!cols'] = [{wch:12},{wch:10},{wch:10},{wch:25},{wch:8},{wch:8},{wch:8},{wch:6},{wch:6},{wch:15},{wch:9},{wch:18},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws1, 'HANY1');

    // === الرصيد الافتتاحي sheet ===
    const openHeader = ['العميل','الرصيد','تاريخ'];
    const openSample = [
      ['جمعية النهضة التجارية',2072,'2025-09-01'],
      ['مؤسسة الفجر التجارية',1500,'2025-09-01'],
      ['شركة الإخاء',3200,'2025-09-01']
    ];
    const ws2 = XLSX.utils.aoa_to_sheet([openHeader, ...openSample]);
    ws2['!cols'] = [{wch:25},{wch:10},{wch:12}];
    XLSX.utils.book_append_sheet(wb, ws2, 'الرصيد الافتتاحي');

    // === الأصناف sheet ===
    const itemsHeader = ['كود','الصنف','الكمية','التكلفة','سعر البيع'];
    const itemsSample = [
      ['CB100','الكمبية 100',50,1.5,1.8],
      ['CB30','الكمبية 30',100,0.5,0.6],
      ['CB150','الكمبية 150',30,2.25,2.7]
    ];
    const ws3 = XLSX.utils.aoa_to_sheet([itemsHeader, ...itemsSample]);
    ws3['!cols'] = [{wch:10},{wch:18},{wch:8},{wch:10},{wch:10}];
    XLSX.utils.book_append_sheet(wb, ws3, 'الأصناف');

    // كتابة وتحميل
    const fname = 'nayef_template_' + new Date().toISOString().slice(0,10) + '.xlsx';
    XLSX.writeFile(wb, fname);
    showToast('✅ تم تحميل النموذج', fname + ' — ارفعه الآن لاختبار النظام', false);
  } catch(e) {
    if(typeof ErrorBoundary !== 'undefined'){
      ErrorBoundary.handle(e, 'downloadExcelTemplate');
    } else {
      console.error('Template download failed:', e);
    }
    showToast('❌ فشل تحميل النموذج', e.message || 'خطأ غير معروف', true);
  }
}
window.downloadExcelTemplate = downloadExcelTemplate;

function readFile(file){
  const r=new FileReader();
  r.onload=function(e){
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
      const MLBL={'01':'ين','02':'فب','03':'مار','04':'أبر','05':'مايو','06':'يون','07':'يول','08':'أغس','09':'سبت','10':'أكت','11':'نوف','12':'ديس'};
      function fd(v){
        if(!v) return '';
        if(v instanceof Date){const y=v.getFullYear();if(y<2000||y>2040)return'';return y+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');}
        if(typeof v==='number'&&v>20000&&v<60000){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10);}
        const s=String(v).trim();
        let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
        const d=new Date(s);if(!isNaN(d)&&d.getFullYear()>2000)return d.toISOString().slice(0,10);
        return '';
      }
      // 🛡️ FIX: استخدام ExcelColumnDetector.findSheet() للبحث الذكي عن شيت المعاملات
      const hsh = ExcelColumnDetector.findSheet(wb);
      if(!hsh){showToast('لم يُعثر على شيت المعاملات','تأكد من وجود شيت باسم HANY1 أو يحتوي على أعمدة التاريخ والعميل والمبلغ',true);return;}
      const H=XLSX.utils.sheet_to_json(hsh,{header:1,raw:true,cellDates:true});
      let hdr=4;
      for(let i=0;i<Math.min(H.length,8);i++){if(H[i]&&String(H[i].join('|')).includes('التاريخ')){hdr=i+1;break;}}
      const socs={},im={},allm=new Set();
      // 🛡️ FIX: بناء قاموس تكلفة الوحدة من شيت الأصناف لاستخدامه في CostResolver كاحتياط
      const _costItemMaster = (() => {
        const master = {};
        const ash = wb.Sheets['الأصناف'];
        if(!ash) return master;
        try {
          const A = XLSX.utils.sheet_to_json(ash, {header:1, raw:true});
          for(let i=1; i<A.length; i++){
            const r = A[i];
            if(r && r[1] && r[2]){
              const code = String(r[1]).trim();
              const ucVal = +r[3]||0;
              const slVal = +r[6]||0;
              if(code && ucVal > 0){
                master[code] = {uc: ucVal, sl: slVal};
              }
            }
          }
        } catch(e){ Logger.warn('build _costItemMaster:', e); }
        return master;
      })();
      const txns=[];
      const checks=[];
      const mk0soc=()=>({s:0,c:0,ob:0,g:0,d:0,fv:0,q:0,inv:0,ag:'',dates:[],cdates:[],m:{},mc:{},mq:{}});
      for(let i=hdr;i<H.length;i++){
        const row=H[i];if(!row||!row.length)continue;
        const cl=row[3];if(!cl)continue;
        const nm=String(cl).trim();
        const tp=String(row[1]||'').trim();
        if(!tp&&!row[4]&&!row[5])continue;
        const db=+row[4]||0,cr=+row[5]||0;
        let qty=+row[6]||0,disc=+row[7]||0,free=+row[8]||0;
        const ag=String(row[9]||'').trim();
        const ic=String(row[12]||'').trim(),inm=String(row[11]||'').trim();
        let uc=+row[14]||0;
        // 🛡️ NAIF MINIMAL: حماية بسيطة ضد الأرقام الفلكية
        if(qty > 100000) qty = 100000;
        if(disc > db * 0.5 && db > 0) disc = db * 0.5;
        if(free > db * 0.3 && db > 0) free = db * 0.3;
        if(uc > 1000 || (uc > 0 && uc < 0.001)) uc = 0;
        if(uc===0 && ic){
          const _costResolution = CostResolver.resolve(ic, inm, qty, db, {
            itemMaster: _costItemMaster || {}
          });
          if(_costResolution.cost > 0 && _costResolution.cost <= 1000){
            uc = _costResolution.cost;
            if(_costResolution.confidence < 0.5){
              Logger.warn(`⚠️ تكلفة مفقودة لـ ${ic}، استخدام ${_costResolution.source} (ثقة ${(_costResolution.confidence*100).toFixed(0)}%): ${uc.toFixed(3)}`);
            }
          }
        }
        const ds=fd(row[0]);
        const mk=toMonthKey(row[10])||(ds?ds.slice(0,7):'');
        if(mk)allm.add(mk);
        if(!socs[nm])socs[nm]=mk0soc();
        const x=socs[nm];
        if(ag&&!x.ag)x.ag=ag;
        // 🛡️ FIX الجذري: فصل 'رصيد افتتاحي' عن 'فاتوره'
        if(tp==='فاتوره'){
          x.s+=db;x.q+=qty;x.d+=disc;x.g+=qty*uc;x.fv+=free*uc;x.inv++;
          // حفظ تفاصيل الفاتورة
          if(ds){
            x.dates.push({
              dt:ds,
              invoice:String(row[2]||'').trim(),
              item:inm,
              itemCode:ic,
              qty:+qty.toFixed(1),
              price:qty>0?+(db/qty).toFixed(3):0,
              amount:+db.toFixed(2),
              type:'sale'
            });
          }
          if(mk){x.m[mk]=(x.m[mk]||0)+db;x.mq[mk]=(x.mq[mk]||0)+qty;}
          if(ic){if(!im[ic])im[ic]={nm:inm||ic,sv:{},qv:{},cv:{}};
            if(mk){im[ic].sv[mk]=(im[ic].sv[mk]||0)+db;im[ic].qv[mk]=(im[ic].qv[mk]||0)+qty;im[ic].cv[mk]=(im[ic].cv[mk]||0)+qty*uc;}}
        // 🛡️ FIX: دعم أشكال متعددة لـ "رصيد افتتاحي"
        // قد يأتي بأي من: "رصيد افتتاحي"، "رصيدافتتاحي"، "opening"، "رصيد اول المدة"، إلخ
        } else if(tp === 'رصيد افتتاحي' || tp === 'رصيدافتتاحي' || tp === 'Opening' || tp === 'OPENING' ||
                   tp === 'رصيد اول المدة' || tp === 'رصيد أول المدة' || tp === 'رصيد اولي' || tp === 'افتتاح' ||
                   tp.indexOf('رصيد افتتاحي') >= 0 || tp.indexOf('افتتاح') >= 0) {
          // الرصيد الافتتاحي منفصل تماماً - لا يُضاف للمبيعات
          x.ob = (x.ob || 0) + db;
          x.invOpening = (x.invOpening || 0) + 1;
          Logger.info(`💼 رصيد افتتاحي للجمعية ${nm}: ${db} د.ك`);
        } else if(tp === 'فاتوره' || tp === 'فاتورة' || tp.indexOf('فاتورة') >= 0) {
          // فاتورة عادية - تُحسب كمبيعات
          x.s += db;
          x.q += qty;
          x.d += disc;
          x.g += qty * uc;
          x.fv += free * uc;
          x.inv++;
          // حفظ تفاصيل الفاتورة
          if(ds) {
            x.dates.push({
              dt: ds,
              invoice: String(row[2] || '').trim(),
              item: inm,
              itemCode: ic,
              qty: +qty.toFixed(1),
              price: qty > 0 ? +(db / qty).toFixed(3) : 0,
              amount: +db.toFixed(2),
              type: 'sale'
            });
          }
          if(mk) {
            x.m[mk] = (x.m[mk] || 0) + db;
            x.mq[mk] = (x.mq[mk] || 0) + qty;
          }
          if(ic) {
            if(!im[ic]) im[ic] = {nm: inm || ic, sv: {}, qv: {}, cv: {}};
            if(mk) {
              im[ic].sv[mk] = (im[ic].sv[mk] || 0) + db;
              im[ic].qv[mk] = (im[ic].qv[mk] || 0) + qty;
              im[ic].cv[mk] = (im[ic].cv[mk] || 0) + qty * uc;
            }
          }
        }
        // المرتجعات: البضاعة تعود للمخزون فتُخفّض تكلفة المبيعات الفعلية بتكلفة البضاعة المرتجعة.
        // المرتجع مسجّل بقيمته النقدية (دائن = سعر بيع)؛ تكلفته = القيمة × نسبة (تكلفة الوحدة ÷ سعر الوحدة).
        if(tp==='مرتجع'){
          const up=+row[15]||0;
          const retVal=cr>0?cr:db;                      // قيمة المرتجع (سعر البيع)
          const costRatio=(up>0&&uc>0)?uc/up:0;          // نسبة التكلفة للسعر
          const retCost=retVal*costRatio;                // تكلفة البضاعة المرتجعة
          x.ret=(x.ret||0)+retCost;                      // إجمالي تكلفة المرتجعات للجمعية
          x.retVal=(x.retVal||0)+retVal;                 // قيمة المرتجعات (سعر بيع) للمرجع
          if(mk)x.mret=(x.mret||{}),x.mret[mk]=(x.mret[mk]||0)+retCost;
        }
        // التحصيل النقدي الفعلي = الشيكات المحصّلة فقط (تُستبعد إشعارات الخصم والمرتجعات والتسويات لأنها قيود محاسبية لا نقد فعلي)
        if(tp==='شيك'&&cr>0){
          x.c+=cr;
          // 🛡️ FIX: حفظ تفاصيل التحصيل
          if(ds){
            x.cdates.push({
              dt:ds,
              ref:String(row[2]||'').trim(),
              amount:+cr.toFixed(2),
              type:'payment'
            });
          }
          if(mk)x.mc[mk]=(x.mc[mk]||0)+cr;
        }
        if(tp==='شيك'&&cr>0){checks.push({dt:ds,mk:mk||(ds?ds.slice(0,7):''),cl:nm,cr:+cr.toFixed(2),ref:String(row[2]||'').trim()});}
        // 🛡️ FIX: حد أقصى مرتفع (50,000) لحفظ كل المعاملات من HANY1
      if(txns.length<50000)txns.push({
        dt:ds,
        tp,
        cl:nm,
        // حقول بديلة للتوافق
        client:nm,
        // المدين (مبيعات)
        db:+db.toFixed(2),
        // الدائن (تحصيل)
        cr:+cr.toFixed(2),
        // الكمية
        q:+qty.toFixed(1),
        qty:+qty.toFixed(1),
        // المندوب
        ag,
        // الصنف + رقم الفاتورة + السعر
        item:inm,
        itemCode:ic,
        invoice:String(row[2]||'').trim(),
        // السعر للوحدة (مدين / كمية)
        price:qty>0?+(db/qty).toFixed(3):0,
        // الخصم والمجاني
        disc:+disc.toFixed(2),
        free:+free.toFixed(2),
        // المبلغ الموحد (مبيعات > 0, تحصيل > 0)
        amount:(db>0?+db.toFixed(2):+cr.toFixed(2)),
        // النوع الموحد (sale/payment/return/opening)
        type:(tp==='فاتوره'||tp==='رصيد افتتاحي')?'sale':(tp==='شيك'?'payment':(tp==='مرتجع'?'return':(tp||'other').toLowerCase())),
      });
      }
      txns.sort((a,b)=>(b.dt||'').localeCompare(a.dt||''));
      // مناديب — بحث مرن عن الشيت في كل أوراق العمل
      const agmap={},agtgt={},agMonthlyTgt={};
      const agentMovement=[]; // جدول A:H — حركة المندوب×الجمعية الشهرية (كما في الإكسل)
      const agentSummary=[];  // جدول J:P — ملخص حركة المندوب الشهري (كما في الإكسل)
      // ── إصلاح جذري 2026: بحث مرن عن شيت المناديب بمفاتيح متعددة ──
      const _norm=s=>String(s||'').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,'').replace(/^[\u0627\u0623\u0622]/,'ا').replace(/\u0629$/,'ه');
      const _sheetKeys={'المناديب':1,'العملاء':1,'التارجت':1,'الهدف':1,'المندوب':1,'الفا':1,'targets':1,'agents':1,'agent':1};
      let msh=null;let mshName='';
      // 1) بحث بمطابقة تامة
      for(const name of Object.keys(wb.Sheets)){
        if(_sheetKeys[_norm(name)]){msh=wb.Sheets[name];mshName=name;break;}
      }
      // 2) بحث بمرونة (يحتوي على كلمة مناديب/مندوب/وكيل/تارجت)
      if(!msh){
        for(const name of Object.keys(wb.Sheets)){
          const nm=_norm(name);
          if(nm.includes('مناديب')||nm.includes('مندوب')||nm.includes('وكيل')||nm.includes('تارجت')||nm.includes('هدف')||nm.includes('هادفلوكلاء')){
            msh=wb.Sheets[name];mshName=name;break;
          }
        }
      }
      // 3) Fallback: أكبر شيت يحتوي على أعمدة "المندوب" و "الجمعية"
      if(!msh){
        let best=null;let bestRows=0;
        for(const name of Object.keys(wb.Sheets)){
          if(name==='HANY1'||name==='FILTER'||name==='الأصناف')continue;
          try{
            const tmp=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,cellDates:true});
            const hasAgentCol=tmp.some(r=>r&&r.some(c=>String(c||'').includes('المندوب')||String(c||'').includes('وكيل')));
            if(hasAgentCol&&tmp.length>bestRows){best=wb.Sheets[name];bestRows=tmp.length;mshName=name;}
          }catch(e){}
        }
        if(best){msh=best;}
      }
      Logger.info('[مناديب] تم العثور على الشيت:',mshName||'(لم يُعثر)','— الحالة:',msh?'موجود':'مفقود');
      if(msh){const MA=XLSX.utils.sheet_to_json(msh,{header:1,cellDates:true,cellFormula:true});
        // ── إصلاح جذري 2026: حساب القيم من جدول A:H مباشرة ──
        // السبب: جدول J:P في ملفك يحوي صيغ (=SUMIFS) لم تُقيّم بعد، فتعطي 0.
        // الحل: نحسب المجاميع من جدول A:H مباشرة بنفس منطق SUMIFS.
        for(let i=2;i<MA.length;i++){const row=MA[i];if(!row)continue;
          if(row[1]&&row[2])agmap[String(row[2]).trim()]=String(row[1]).trim();
          // ── جدول 1 (A:H): الحركة الشهرية للمندوب×الجمعية ──
          if(row[0]&&row[1]&&row[2]){
            const mmk=toMonthKey(row[0]);
            agentMovement.push({
              mk:mmk, agent:String(row[1]).trim(), soc:String(row[2]).trim(),
              target:+row[3]||0, achieved:+row[4]||0, remaining:+row[5]||0,
              surplus:+row[6]||0, pct:(+row[7]||0)*100
            });
          }
          // ── جدول 2 (J:P): ملخص حركة المندوب الشهري ──
          // إصلاح جذري 2026: نُسجّل فقط وجود السجل لتجنّب التكرار، ونحسب القيم لاحقاً من A:H.
          if(row[9]&&row[10]){
            agentSummary.push({
              mk:toMonthKey(row[9]), agent:String(row[10]).trim(),
              target:0, achieved:0, remaining:0, surplus:0, pct:0,
              _placeholder:true
            });
          }
          if(row[10]&&row[11]){
            const ag=String(row[10]).trim();
            if(!agtgt[ag])agtgt[ag]={t:0,a:0};agtgt[ag].t+=+row[11]||0;agtgt[ag].a+=+row[12]||0;
            const td=row[9];let tmk=toMonthKey(td);
            if(tmk){if(!agMonthlyTgt[ag])agMonthlyTgt[ag]={};agMonthlyTgt[ag][tmk]=(agMonthlyTgt[ag][tmk]||0)+(+row[11]||0);}
          }
        }
      }
      // ── إصلاح جذري 2026: حساب agentSummary من agentMovement مباشرة ──
      // السبب: جدول J:P في ملفك يحوي صيغ (=SUMIFS) لم تُقيّم، فيُسجّل قيم صفر.
      // الحل: نُسجّل فقط تواريخ+أسماء المناديب من J:P (كمكانس للأسماء الإضافية مثل احمد ماهر)
      //      ثم نحسب القيم الفعلية من جدول A:H التفصيلي.
      if(msh){
        // أولاً: مسح الـ placeholders السابقة (لإعادة حساب نظيف)
        agentSummary.length = 0;
        // ثانياً: حساب المجاميع من agentMovement لكل (شهر، مندوب)
        const sumMap = {};
        agentMovement.forEach(r => {
          const key = (r.mk||'') + '|' + (r.agent||'');
          if (!sumMap[key]) sumMap[key] = { mk: r.mk, agent: r.agent, target: 0, achieved: 0 };
          sumMap[key].target += (+r.target)||0;
          sumMap[key].achieved += (+r.achieved)||0;
        });
        // ثالثاً: إدراج سجل لكل (شهر، مندوب) موجود في agentMovement
        const seenKeys = new Set();
        Object.values(sumMap).forEach(s => {
          seenKeys.add((s.mk||'') + '|' + (s.agent||''));
          const T = s.target, A = s.achieved;
          agentSummary.push({
            mk: s.mk, agent: s.agent,
            target: +T.toFixed(2),
            achieved: +A.toFixed(2),
            remaining: +Math.max(0, T-A).toFixed(2),
            surplus: +Math.max(0, A-T).toFixed(2),
            pct: T>0 ? +(A/T*100).toFixed(2) : 0,
            _source: 'computed-from-movement'
          });
        });
        // رابعاً: لأي (شهر، مندوب) في J:P غير موجود في A:H (مثل احمد ماهر في مايو)، أضفه من agentMovement
        // إذا كان غير موجود في A:H أصلاً، قيمه = 0
        if (typeof msh !== 'undefined' && msh) {
          try {
            const MAextra = XLSX.utils.sheet_to_json(msh, {header:1, cellDates:true});
            for (let i = 2; i < MAextra.length; i++) {
              const row = MAextra[i]; if (!row) continue;
              if (row[9] && row[10]) {
                const mkE = toMonthKey(row[9]);
                const agE = String(row[10]).trim();
                const keyE = mkE + '|' + agE;
                if (!seenKeys.has(keyE)) {
                  agentSummary.push({
                    mk: mkE, agent: agE,
                    target: 0, achieved: 0, remaining: 0, surplus: 0, pct: 0,
                    _source: 'j-p-only'
                  });
                  seenKeys.add(keyE);
                }
              }
            }
          } catch(e) {}
        }
        Logger.info('[مناديب] agentSummary محسوب:', agentSummary.length, 'سجل');
      }
      // توحيد ذكي: ادمج أسماء التارجت غير الموجودة في المبيعات مع أقرب اسم مبيعات يشترك بنفس الجمعيات
      const salesAgents=new Set(Object.values(socs).map(s=>s.ag).filter(Boolean));
      Object.keys(agMonthlyTgt).forEach(tgtName=>{
        if(salesAgents.has(tgtName))return; // الاسم موجود في المبيعات — لا حاجة
        // ابحث عن اسم مبيعات يشترك بجمعيات هذا المندوب في كتلة التفاصيل
        let bestMatch=null,bestOverlap=0;
        const tgtClients=new Set();
        if(msh){const MA=XLSX.utils.sheet_to_json(msh,{header:1});
          for(let i=2;i<MA.length;i++){const row=MA[i];if(row&&row[1]&&row[2]&&String(row[1]).trim()===tgtName)tgtClients.add(String(row[2]).trim());}
        }
        salesAgents.forEach(sa=>{
          let overlap=0;
          Object.values(socs).forEach(s=>{if(s.ag===sa&&tgtClients.has(s.nm))overlap++;});
          if(overlap>bestOverlap){bestOverlap=overlap;bestMatch=sa;}
        });
        if(bestMatch){
          // ادمج التارجت تحت اسم المبيعات
          if(!agMonthlyTgt[bestMatch])agMonthlyTgt[bestMatch]={};
          Object.keys(agMonthlyTgt[tgtName]).forEach(mk=>{agMonthlyTgt[bestMatch][mk]=(agMonthlyTgt[bestMatch][mk]||0)+agMonthlyTgt[tgtName][mk];});
          if(!agtgt[bestMatch])agtgt[bestMatch]={t:0,a:0};
          agtgt[bestMatch].t+=agtgt[tgtName].t;agtgt[bestMatch].a+=agtgt[tgtName].a;
          delete agMonthlyTgt[tgtName];delete agtgt[tgtName];
        }
      });
      Object.keys(socs).forEach(nm=>{if(agmap[nm]&&!socs[nm].ag)socs[nm].ag=agmap[nm];});
      // ── إصلاح جذري: ضمّ كل أشهر شيت «المناديب» (الحركة + الملخص) إلى المحور الزمني العام ──
      // كان allm يُبنى من HANY1 فقط، فإذا وُجد شهر في المناديب بلا حركة بيع مطابقة في HANY1
      // (مثل مايو 2026) كان يسقط من المحور ويختفي من صفحة المندوب. الآن نضمّ كل المفاتيح.
      agentMovement.forEach(r=>{if(r.mk)allm.add(r.mk);});
      agentSummary.forEach(r=>{if(r.mk)allm.add(r.mk);});
      // بناء الشهور
      const months=Array.from(allm).sort();
      const ml=months.map(m=>{const[y,mo]=m.split('-');return(MLBL[mo]||mo)+y.slice(2);});
      // جمعيات
      const soc=[],mon=[];
      Object.keys(socs).sort((a,b)=>socs[b].s-socs[a].s).forEach(nm=>{
        const x=socs[nm];
        const retVal=+(x.retVal||0).toFixed(2);               // قيمة المرتجعات (سعر بيع) — تُخصم من صافي المبيعات
        const netSales=+(x.s-retVal).toFixed(2);              // صافي المبيعات بعد المرتجعات
        const cost=+(x.g+x.d+x.fv).toFixed(2);                // التكلفة (المرتجع لا يُخصم منها — يُعالَج من جهة المبيعات)
        const dd=x.dates.sort(),cd=x.cdates.sort();
        // 🛡️ FIX الجذري: ot = ob + s - c (وليس s - c فقط)
        const opening = +(x.ob||0).toFixed(2);
        const outstanding = +(opening + netSales - x.c).toFixed(2);
        soc.push({nm,s:netSales,sGross:+x.s.toFixed(2),co:cost,pr:+(netSales-cost).toFixed(2),
          g:+x.g.toFixed(2),d:+x.d.toFixed(2),fv:+x.fv.toFixed(2),ret:+(x.ret||0).toFixed(2),retVal:retVal,
          c:+x.c.toFixed(2),
          ob:opening,  // 🛡️ الرصيد الافتتاحي منفصل
          rt:netSales>0?+(x.c/netSales*100).toFixed(1):0,
          ot:outstanding,  // 🛡️ يشمل الافتتاحي
          q:+x.q.toFixed(1),inv:x.inv,ag:x.ag,
          li:dd.length?dd[dd.length-1]:'',lc:cd.length?cd[cd.length-1]:''});
        mon.push({nm,v:months.map(m=>+(x.m[m]||0).toFixed(2)),c:months.map(m=>+(x.mc[m]||0).toFixed(2)),q:months.map(m=>+(x.mq[m]||0).toFixed(1))});
      });
      // 🛡️ FIX: T.ob مجموع الأرصدة الافتتاحية
      const T={s:+soc.reduce((t,x)=>t+x.s,0).toFixed(2),
               co:+soc.reduce((t,x)=>t+x.co,0).toFixed(2),
               pr:+soc.reduce((t,x)=>t+x.pr,0).toFixed(2),
               c:+soc.reduce((t,x)=>t+x.c,0).toFixed(2),
               ob:+soc.reduce((t,x)=>t+(x.ob||0),0).toFixed(2),
               ot:+soc.reduce((t,x)=>t+(x.ot||x.s-x.c),0).toFixed(2)};
      const mt=months.map((_,k)=>+mon.reduce((t,x)=>t+(x.v[k]||0),0).toFixed(2));
      const mc=months.map((_,k)=>+mon.reduce((t,x)=>t+(x.c[k]||0),0).toFixed(2));
      // أصناف - قراءة HEADER-BASED (يحل مشكلة ترتيب الأعمدة)
      let it=[];
      const ash=wb.Sheets['الأصناف'];
      if(ash){
        const A=XLSX.utils.sheet_to_json(ash,{header:1,raw:true,defval:'',rawNumbers:false});
        // 🆕 FIX v220.9.9: HEADER-BASED column detection
        // البحث عن صف العناوين (يحتوي على "كود" أو "الصنف")
        let headerRow=-1;
        for(let i=0;i<Math.min(A.length,10);i++){
          if(A[i]&&A[i].some(c=>{
            const s=String(c||'').trim();
            return s.includes('كود')||s==='الكود'||s.includes('الصنف')||s==='اسم الصنف'||s.includes('المنتج');
          })){headerRow=i;break;}
        }
        if(headerRow>=0){
          const hdr=A[headerRow].map(h=>String(h||'').trim());
          // 🆕 FIX: البحث عن الأعمدة بالاسم (ليس بالموقع)
          const colIdx={
            cd: hdr.findIndex(h=>h==='الكود'||h==='كود'||h.includes('كود')),
            nm: hdr.findIndex(h=>h==='الصنف'||h==='اسم الصنف'||h.includes('الصنف')||h.includes('المنتج')||h.includes('البضاعة')),
            uc: hdr.findIndex(h=>h.includes('تكلفة')||h.includes('التكلفة')||h.includes('سعر تكلفة')),
            up: hdr.findIndex(h=>h.includes('سعر')||h.includes('السعر')||h.includes('سعر البيع')||h.includes('بيع')),
            sl: hdr.findIndex(h=>h.includes('المباع')||h.includes('مبيعات')||h.includes('كمية مباعة')),
            rm: hdr.findIndex(h=>h.includes('المتبقي')||h.includes('متبقي')||h.includes('الكمية المتبقية')),
            ns: hdr.findIndex(h=>h.includes('صافي')||h.includes('صافي المبيعات')||h.includes('إجمالي المبيعات')),
            g: hdr.findIndex(h=>h==='COGS'||h==='cogs'||h.includes('تكلفة المباع')||h.includes('تكلفة البضاعة')),
            pr: hdr.findIndex(h=>h==='الربح'||h.includes('الربح')||h.includes('ربح')),
            dc: hdr.findIndex(h=>h.includes('خصم')||h.includes('الخصم')||h.includes('نسبة الخصم')),
            un: hdr.findIndex(h=>h==='الوحدة'||h.includes('الوحدة')||h.includes('وحدة'))
          };
          // 🆕 FIX: fallback - إذا لم يجد الأعمدة، استخدم الموقع الافتراضي
          if(colIdx.cd<0)colIdx.cd=1;
          if(colIdx.nm<0)colIdx.nm=2;
          if(colIdx.uc<0)colIdx.uc=3;
          if(colIdx.up<0)colIdx.up=4;
          if(colIdx.sl<0)colIdx.sl=6;
          if(colIdx.rm<0)colIdx.rm=10;
          if(colIdx.ns<0)colIdx.ns=11;
          if(colIdx.g<0)colIdx.g=12;
          if(colIdx.pr<0)colIdx.pr=13;
          if(colIdx.dc<0)colIdx.dc=8;
          
          // 🆕 FIX: تنظيف الأعمدة المكتشفة
          for(let i=headerRow+1;i<A.length;i++){
            const r=A[i];
            if(!r||!r[colIdx.cd]||!r[colIdx.nm])continue;
            const ns=+r[colIdx.ns]||0;
            if(ns<=0&&!r[colIdx.cd])continue;  // تخطي الصفوف الفارغة
            // 🆕 FIX v220.9.9: اسم الصنف - قراءة كاملة بدون قص
            // استخدام .toString().trim() بدلاً من String() 
            // لأن String() قد يحول القيم الفارغة إلى "undefined"
            const rawNm=r[colIdx.nm];
            const fullNm=rawNm===undefined||rawNm===null?'':String(rawNm).trim().replace(/\s+/g,' ');
            if(!fullNm)continue;  // تخطي إذا الاسم فارغ
            const cd=String(r[colIdx.cd]).trim();
            it.push({
              cd: cd,
              nm: fullNm,
              uc: +r[colIdx.uc]||0,
              up: +r[colIdx.up]||0,
              sl:+(+r[colIdx.sl]).toFixed(1),
              rm:+(+r[colIdx.rm]).toFixed(1),
              ns:+(+r[colIdx.ns]).toFixed(2),
              g:+(+r[colIdx.g]).toFixed(2),
              pr:+(+r[colIdx.pr]).toFixed(2),
              dc:+(+r[colIdx.dc]).toFixed(2),
              un: colIdx.un>=0?String(r[colIdx.un]||'').trim():'قطعة'
            });
          }
          // 🆕 FIX: تشخيص - عدد الأصناف المقروءة
          if(typeof Logger!=='undefined'){
            Logger.info(`📦 [الأصناف] تم قراءة ${it.length} صنف من الشيت | عينة: ${it[0]?JSON.stringify({cd:it[0].cd,nm:it[0].nm,nmLen:it[0].nm.length,up:it[0].up}):'فارغ'}`);
          }
        }
      }
      if(!it.length)it=Object.entries(im).map(([cd,v])=>({cd,nm:v.nm,
        ns:+Object.values(v.sv).reduce((a,b)=>a+b,0).toFixed(2),
        g:+Object.values(v.cv).reduce((a,b)=>a+b,0).toFixed(2),
        pr:0,uc:0,up:0,sl:0,rm:0,dc:0})).filter(x=>x.ns>0);
      // itemMonthly
      const imOut={};
      Object.entries(im).forEach(([cd,v])=>{imOut[cd]={cd,nm:v.nm,
        sv:months.map(m=>+(v.sv[m]||0).toFixed(2)),
        qv:months.map(m=>+(v.qv[m]||0).toFixed(1)),
        cv:months.map(m=>+(v.cv[m]||0).toFixed(2))};});
      // ════════════════════════════════════════════════════════════════════
      // مناديب — كل القرارات والتحليلات تُبنى على شيت «المناديب» (الهدف + المحقق + الجمعيات)
      // والتحصيل فقط يُؤخذ من شيت HANY1 (حسب متطلبات العمل).
      // ════════════════════════════════════════════════════════════════════
      const monthIdx={}; months.forEach((m,k)=>monthIdx[m]=k);
      // (1) التحصيل الشهري لكل مندوب من HANY1 (عبر جمعياته) — هذا فقط مصدره HANY1
      const collByAgent={};   // {agent: [..months]}
      soc.forEach((s,si)=>{const ag=s.ag;if(!ag)return;
        if(!collByAgent[ag])collByAgent[ag]=months.map(()=>0);
        mon[si].c.forEach((v,k)=>{collByAgent[ag][k]+=(+v||0);});
      });
      // كمية HANY1 لكل مندوب (مرجعية فقط) — لا تؤثر على قرارات المناديب
      const qtyByAgent={};
      soc.forEach(s=>{const ag=s.ag;if(!ag)return;qtyByAgent[ag]=(qtyByAgent[ag]||0)+(+s.q||0);});
      // (2) المبيعات (المحقق) + الهدف + الجمعيات لكل مندوب من شيت «المناديب» (agentMovement = جدول A:H)
      const agD={};
      const ensure=ag=>{if(!agD[ag])agD[ag]={nm:ag,sv:months.map(()=>0),tv:months.map(()=>0),
        cv:(collByAgent[ag]?collByAgent[ag].slice():months.map(()=>0)),socs:new Set(),q:+(qtyByAgent[ag]||0)};return agD[ag];};
      // الحركة التفصيلية (مندوب × جمعية × شهر): المحقق → sv، الهدف → tv، الجمعية → socs
      agentMovement.forEach(r=>{const ag=r.agent;if(!ag)return;const a=ensure(ag);
        const k=monthIdx[r.mk]; if(k===undefined)return;
        a.sv[k]+=(+r.achieved||0); a.tv[k]+=(+r.target||0);
        if(r.soc)a.socs.add(r.soc);
      });
      // الملخص الشهري (J:P): يكمّل الأهداف الشهرية لمن ليس له حركة تفصيلية في شهر ما
      agentSummary.forEach(r=>{const ag=r.agent;if(!ag)return;const a=ensure(ag);
        const k=monthIdx[r.mk]; if(k===undefined)return;
        // لا نُضاعف: إن لم يوجد هدف تفصيلي لهذا الشهر، خذ هدف/محقق الملخص
        if(a.tv[k]===0&&(+r.target||0)>0)a.tv[k]=(+r.target||0);
        if(a.sv[k]===0&&(+r.achieved||0)>0)a.sv[k]=(+r.achieved||0);
      });
      // اضمن إدراج كل مندوب له هدف شهري مُجمَّع (احتياط)
      Object.keys(agMonthlyTgt).forEach(ag=>{const a=ensure(ag);
        Object.keys(agMonthlyTgt[ag]).forEach(m=>{const k=monthIdx[m];if(k!==undefined&&a.tv[k]===0)a.tv[k]=+(agMonthlyTgt[ag][m]||0);});
      });
      const ag=Object.values(agD).map(a=>{
        const totS=a.sv.reduce((t,v)=>t+v,0);     // إجمالي المحقق (من المناديب)
        const totTg=a.tv.reduce((t,v)=>t+v,0);     // إجمالي الهدف (من المناديب)
        const totC=a.cv.reduce((t,v)=>t+v,0);      // إجمالي التحصيل (من HANY1)
        return{nm:a.nm,
               s:+totS.toFixed(2),               // المبيعات = المحقق (المناديب)
               c:+totC.toFixed(2),               // التحصيل (HANY1)
               q:+(a.q||0).toFixed(1),
               sc:a.socs.size,                   // عدد الجمعيات (المناديب)
               tg:+totTg.toFixed(2),             // الهدف (المناديب)
               ac:+totS.toFixed(2),              // المحقق (المناديب)
               rt:totS>0?+(totC/totS*100).toFixed(1):0,   // نسبة التحصيل = تحصيل HANY1 ÷ محقق المناديب
               sv:a.sv.map(v=>+v.toFixed(2)),    // متجه المحقق الشهري (المناديب)
               cv:a.cv.map(v=>+v.toFixed(2)),    // متجه التحصيل الشهري (HANY1)
               tv:a.tv.map(v=>+v.toFixed(2))};   // متجه الهدف الشهري (المناديب)
      }).sort((x,y)=>y.s-x.s);
      // ══ قراءة المصاريف الشهرية (من شيت "المصاريف الشهرية") ══
      let expenses=null;
      const exh=wb.Sheets['المصاريف الشهرية'];
      if(exh){
        const E=XLSX.utils.sheet_to_json(exh,{header:1,raw:true,cellDates:true});
        // الصف 0 = العناوين. الأعمدة من index 3 = شهور. نلتقط مفاتيح الشهور YYYY-MM
        const hdrRow=E[0]||[];
        const exMonCols=[]; // [{ci, mk}]
        for(let ci=3;ci<hdrRow.length;ci++){
          let h=hdrRow[ci];
          if(!h)continue;
          const hs=String(h);
          if(hs.includes('إجمالي')||hs.includes('متوسط'))continue;
          let mk='';
          if(h instanceof Date){mk=h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0');}
          else{const m=hs.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)mk=m[3]+'-'+m[2].padStart(2,'0');
               else{const m2=hs.match(/(\d{4})-(\d{1,2})/);if(m2)mk=m2[1]+'-'+m2[2].padStart(2,'0');}}
          if(mk)exMonCols.push({ci,mk});
        }
        // البنود: صفوف فيها رقم تسلسلي (index 0) واسم بند (index 1) وفئة (index 2)
        const items=[]; let curCat='';
        for(let i=1;i<E.length;i++){
          const r=E[i];if(!r)continue;
          const label=String(r[1]||'').trim();
          // صف فاصل فئة مثل "─── 💼 رواتب وعمولات ───"
          if(label.includes('───')){curCat=label.replace(/[─💼🏢🚚📋\s]/g,'').trim();continue;}
          if(label.includes('إجمالي')||label.includes('صافي')||label.includes('مجمل')||label.includes('هامش')||label.includes('المصاريف الشهرية المتوسطة')||label.includes('المصاريف السنوية'))continue;
          const cat=String(r[2]||curCat||'أخرى').trim();
          if(!label||!cat)continue;
          // اجمع قيم الشهور المتاحة فقط
          const monthly={}; let annual=0;
          exMonCols.forEach(({ci,mk})=>{const v=+r[ci]||0;if(v){monthly[mk]=(monthly[mk]||0)+v;annual+=v;}});
          if(annual>0||Object.keys(monthly).length)items.push({name:label,cat,monthly,annual:+annual.toFixed(2)});
        }
        // إجمالي شهري عبر كل البنود
        const monthlyTotal={};
        items.forEach(it=>{Object.entries(it.monthly).forEach(([mk,v])=>{monthlyTotal[mk]=(monthlyTotal[mk]||0)+v;});});
        const totalAnnual=items.reduce((t,it)=>t+it.annual,0);
        // إجمالي حسب الفئة
        const byCat={};
        items.forEach(it=>{byCat[it.cat]=(byCat[it.cat]||0)+it.annual;});
        if(items.length)expenses={items,monthlyTotal,totalAnnual:+totalAnnual.toFixed(2),byCat,
          activeMonths:Object.keys(monthlyTotal).length};
      }
      // تحديث البيانات — مع ختم إصدار زمني (أحدث دائماً من المضمّن) ليُعتمد المرفوع لاحقاً
      O=JSON.parse(JSON.stringify({soc,mon,ml,mk:months,mt,mc,T,it,im:imOut,ag,tx:txns,txn:txns.length,expenses,agentMovement,agentSummary,checks,_v:'upload-'+Date.now()}));
      // 📡 Sync to window for infrastructure modules
      window.O = O;
      window.D = D;
      D=JSON.parse(JSON.stringify(O));
      // ── إصلاح جذري 2026: مسح كل البيانات المخزنة قبل حفظ الجديد ──
      // يحلّ مشكلة البيانات القديمة في IndexedDB التي تبقى وتسبب تعارض
      try{localStorage.removeItem('nayef_dash_seed');}catch(e){}
      try{const dbreq=indexedDB.open('nayef_dash',1);dbreq.onsuccess=()=>{try{const db=dbreq.result;const tx=db.transaction('data','readwrite');tx.objectStore('data').delete('seed');tx.oncomplete=()=>{db.close();};}catch(e){};};}catch(e){}
      // ── خيار: الحفظ التلقائي معطّل افتراضياً — يسأل المستخدم ──
      if(localStorage.getItem('nayef_autosave')==='1'){
        saveData(O,file.name||'ملف Excel');
        $('upd2').textContent+=' · 💾 محفوظ تلقائياً';
      }else{
        $('upd2').textContent+=' · ⚠️ لم يُحفظ تلقائياً';
      }
      _lastFname=file.name||'ملف Excel';
      if(typeof updateRefreshBtn==='function')updateRefreshBtn();
      $('upd').textContent='محدّث: '+new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'})+' ← '+file.name;
      $('upd2').textContent='✅ '+soc.length+' جمعية | '+ml.length+' شهر | '+ag.length+' مندوب | مبيعات '+Math.round(T.s).toLocaleString()+' د.ك';
      // ── إصلاح جذري: إعادة التعيين الكاملة بعد كل رفع ملف ──
      _filterA=0;
      _filterB=Math.max(0,(O.ml||[]).length-1);
      initFilter();
      draw(CUR);
      const btn=document.querySelector('.upload-btn');if(btn)btn.classList.remove('loading');
      showToast('تم تحديث الداشبورد بنجاح',soc.length+' جمعية · '+ml.length+' شهر · '+ag.length+' مندوب · مبيعات '+Math.round(T.s).toLocaleString()+' د.ك',false);
    }catch(err){Logger.error(err);
      const btn=document.querySelector('.upload-btn');if(btn)btn.classList.remove('loading');
      showToast('تعذّر قراءة الملف',err.message,true);}
  };
  r.readAsArrayBuffer(file);
}


// ════════════════════════════════════════════
// نظام حفظ البيانات في المتصفح (IndexedDB)
// ════════════════════════════════════════════
const DB_NAME='nayef_dash',STORE='data',DB_KEY='seed';
function openDB(){
  return new Promise((res,rej)=>{
    try{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
      req.onsuccess=e=>res(e.target.result);
      req.onerror=e=>rej(e.target.error);
      req.onblocked=()=>rej(new Error('blocked'));
    }catch(e){rej(e);} // IndexedDB قد يكون محظوراً على file:// في بعض المتصفحات
  });
}
// ── التخزين: localStorage أساساً (يعمل حتى على file://) + IndexedDB احتياطياً ──
const LS_KEY='nayef_dash_seed';
async function saveData(seed,fname){
  const payload={seed,fname,ts:Date.now()};
  let lsOk=false;
  // 1) localStorage — متزامن ويعمل على file:// (البيانات المجمّعة ~100KB، أقل بكثير من الحد)
  try{localStorage.setItem(LS_KEY,JSON.stringify(payload));lsOk=true;}catch(e){Logger.warn('localStorage حفظ فشل',e);}
  // 2) IndexedDB — نسخة احتياطية إضافية (لا توقف العملية إن فشلت)
  try{const db=await openDB();const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(payload,DB_KEY);await new Promise(res=>{tx.oncomplete=()=>res();tx.onerror=()=>res();});}catch(e){Logger.warn('IndexedDB حفظ فشل',e);}
  return lsOk;
}
async function loadData(){
  // إصدار البيانات المضمّنة الحالي — أي نسخة محفوظة بإصدار مختلف وليست رفعاً يدوياً تُعتبر قديمة وتُمسح.
  const EMB_V=(typeof SEED!=='undefined'&&SEED._v)?SEED._v:'';
  function uploadTs(v){const m=String(v||'').match(/^upload-(\d+)/);return m?+m[1]:0;}
  function isStale(p){
    if(!p||!p.seed)return false;
    const sv=p.seed._v||'';
    // إصلاح جذري (3): إن كان المضمّن والمحفوظ كلاهما رفعاً، يفوز الأحدث زمنياً.
    // كان الكاش يفوز دائماً ولو كان أقدم، فتبقى بيانات مناديب/أشهر قديمة بعد كل تحديث.
    if(sv.indexOf('upload-')===0){
      const embTs=uploadTs(EMB_V), savTs=uploadTs(sv);
      if(embTs>savTs)return true;                    // المضمّن أحدث = المحفوظ قديم
      return false;                                  // المحفوظ أحدث أو مساوٍ — يُحترم
    }
    return EMB_V && sv!==EMB_V;                       // إصدار مختلف عن المضمّن (أو بلا إصدار) = قديم
  }
  // 1) جرّب localStorage أولاً (الأسرع والأوثق على file://)
  try{const raw=localStorage.getItem(LS_KEY);if(raw){const p=JSON.parse(raw);
    if(p&&p.seed){
      if(isStale(p)){ await clearData(); }   // امسح القديم من كل المصادر ثم اسقط لـ SEED المضمّن
      else return p;
    }
  }}catch(e){Logger.warn('localStorage قراءة فشلت',e);}
  // 2) ارجع لـ IndexedDB إن لم يوجد شيء صالح في localStorage
  try{const db=await openDB();const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(DB_KEY);const r=await new Promise(res=>{req.onsuccess=()=>res(req.result||null);req.onerror=()=>res(null);});
    if(r&&r.seed){
      if(isStale(r)){ await clearData(); return null; }   // نسخة IndexedDB قديمة — امسحها واستخدم SEED المضمّن
      // إن وُجد في IndexedDB فقط وكان حديثاً، انسخه إلى localStorage ليُسترجع أسرع لاحقاً
      try{localStorage.setItem(LS_KEY,JSON.stringify(r));}catch(e){}
      return r;
    }
    return null;}catch(e){return null;}
}
async function clearData(){
  try{localStorage.removeItem(LS_KEY);}catch(e){}
  try{const db=await openDB();const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(DB_KEY);await new Promise(res=>{tx.oncomplete=()=>res();tx.onerror=()=>res();});}catch(e){}
  return true;
}
let _lastFname='';
function updateRefreshBtn(){
  const rb=document.getElementById('autoBtn');
  const wc=document.getElementById('watchChip');
  if(rb){if(_lastFname||_fileHandle){rb.style.display='flex';rb.title='إعادة قراءة: '+(_lastFname||'الملف المرتبط');}else{rb.style.display='none';}}
  if(wc){wc.style.display=(_fileHandle?'flex':'none');}
}
function clearSavedData(){
  // 🛡️ FIX: تأكيد متعدد الخطوات (تحذير → كلمة → عداد)
  SafeConfirm.confirmDestructive('مسح البيانات المحفوظة', {
    keyword: 'مسح',
    description: 'سيتم مسح البيانات المحفوظة في المتصفح وستعود الداشبورد للبيانات الافتراضية.',
    showCountdown: false
  }).then(ok => {
    if(!ok) return;
    clearData().then(()=>{_lastFname='';updateRefreshBtn();showToast('تم مسح البيانات المحفوظة','أعد رفع ملف Excel للتحديث',false);$('upd2').textContent='';});
  });
}
// ═══ إعادة تعيين كاملة وجذرية: تمسح كل شيء وتعيد التحميل من SEED المضمّن ═══
async function hardReset(){
  // 🛡️ FIX: تأكيد متعدد الخطوات (تحذير → كلمة → عداد تنازلي 5 ثوان)
  const confirmed = await SafeConfirm.confirmDestructive('إعادة تعيين كاملة', {
    keyword: 'إعادة تعيين',
    description: 'سيتم مسح كل البيانات المحفوظة، ستفقد أي ملف Excel مرفوع، وستعود لآخر بيانات مضمّنة في الداشبورد.',
    affectedItems: 'localStorage + IndexedDB + Cache API + sessionStorage'
  });
  if(!confirmed) return;
  try{
    // مسح كل مصادر البيانات بشكل جذري
    localStorage.clear();
    try{localStorage.removeItem('nayef_dash_seed');localStorage.removeItem('nayef_theme');}catch(e){}
    // حذف قاعدة بيانات IndexedDB بالكامل
    try{
      const dbreq=indexedDB.deleteDatabase('nayef_dash');
      await new Promise(r=>{dbreq.onsuccess=()=>r();dbreq.onerror=()=>r();dbreq.onblocked=()=>r();});
    }catch(e){}
    // مسح كاش المتصفح للصفحة الحالية
    try{
      if('caches' in self){const keys=await caches.keys();for(const k of keys)await caches.delete(k);}
    }catch(e){}
    // إعادة تحميل الصفحة مع كاش نظيف
    showToast('جارٍ إعادة التعيين الكاملة','سيتم إعادة تحميل الداشبورد بالبيانات المضمّنة',false);
    setTimeout(()=>{location.reload(true);},800);
  }catch(e){
    Logger.error('hardReset failed:',e);
    showToast('فشل إعادة التعيين','حاول يدوياً: Ctrl+Shift+R',true);
  }
}
// ═══ زر “حذف كل البيانات” — يمسح أي أثر للداشبورد من المتصفح ═══
// ═══ تشغيل/تعطيل الحفظ التلقائي بعد رفع الملف ═══
function toggleAutosave(){
  const cur=localStorage.getItem('nayef_autosave');
  const enabled=cur==='1';
  localStorage.setItem('nayef_autosave',enabled?'0':'1');
  const btn=$('autosaveBtn');
  if(btn){
    btn.textContent=enabled?'💾 معطّل':'💾 مُفعّل';
    btn.style.background=enabled?'#666':'#1e8449';
  }
  showToast(enabled?'تم تعطيل الحفظ التلقائي':'تم تفعيل الحفظ التلقائي','',false);
}
// ── ضبط الحالة الأولية لزر الحفظ التلقائي ──
(function initAutosaveBtn(){
  setTimeout(()=>{
    const btn=$('autosaveBtn');
    if(!btn)return;
    const enabled=localStorage.getItem('nayef_autosave')==='1';
    btn.textContent=enabled?'💾 مُفعّل':'💾 معطّل';
    btn.style.background=enabled?'#1e8449':'#666';
  },500);
})();
async function purgeEverything(){
  // 🛡️ FIX: تأكيد متعدد الخطوات مع كلمة مرور وعداد تنازلي 5 ثوان
  const confirmed = await SafeConfirm.confirmDestructive('🔥 حذف كامل لكل البيانات', {
    keyword: 'حذف نهائي',
    description: 'سيتم مسح كل مفاتيح localStorage، قاعدة بيانات IndexedDB بالكامل، كاش المتصفح، وأي ملف Excel مرتبط.',
    affectedItems: 'localStorage + IndexedDB + Cache API + sessionStorage',
    countdownSeconds: 5
  });
  if(!confirmed) return;
  let log=[];
  try{
    // 1) localStorage: امسح مفاتيح الداشبورد أو كلها
    try{localStorage.removeItem('nayef_dash_seed');log.push('✓ nayef_dash_seed');}catch(e){log.push('✗ nayef_dash_seed: '+e.message);}
    try{localStorage.removeItem('nayef_theme');log.push('✓ nayef_theme');}catch(e){log.push('✗ nayef_theme: '+e.message);}
    try{localStorage.clear();log.push('✓ localStorage كامل');}catch(e){log.push('✗ localStorage: '+e.message);}
    // 2) IndexedDB: احذف قاعدة بيانات nayef_dash بالكامل
    try{
      const req=indexedDB.deleteDatabase('nayef_dash');
      await new Promise(r=>{req.onsuccess=()=>r();req.onerror=()=>r();req.onblocked=()=>r();});
      log.push('✓ IndexedDB nayef_dash');
    }catch(e){log.push('✗ IndexedDB: '+e.message);}
    // 3) Cache API
    try{if('caches' in self){const ks=await caches.keys();for(const k of ks)await caches.delete(k);log.push('✓ Cache API ('+ks.length+' كاش)');}}catch(e){log.push('✗ Cache: '+e.message);}
    // 4) sessionStorage (احتياط)
    try{sessionStorage.clear();log.push('✓ sessionStorage');}catch(e){log.push('✗ sessionStorage: '+e.message);}
    // 5) مسح متغيرات JS العامة المرتبطة بالبيانات
    try{O=null;D=null;_lastFname='';_filterA=0;_filterB=0;log.push('✓ متغيرات JS');}catch(e){log.push('✗ JS vars: '+e.message);}
    showToast('تم مسح كل البيانات',log.join(' | '),false);
    Logger.info('[purgeEverything] نتائج المسح:\n'+log.join('\n'));
    // إعادة تحميل بعد تأخير قصير
    setTimeout(()=>{location.reload(true);},1200);
  }catch(err){
    Logger.error('purgeEverything failed:',err);
    showToast('فشل المسح','راجع الـ Console للتفاصيل',true);
  }
}



// ════════════════════════════════════════════
// البحث الشامل (جمعيات + أصناف + مناديب)
// ════════════════════════════════════════════
function runGlobalSearch(q){
  const box=$('searchResults'), clr=$('searchClear');
  q=(q||'').trim().toLowerCase();
  if(clr)clr.style.display=q?'block':'none';
  if(!q){if(box)box.style.display='none';return;}
  const norm=s=>String(s||'').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
  const qn=norm(q);
  // ابحث في الجمعيات
  const socs=(O.soc||[]).filter(s=>norm(s.nm).includes(qn)).slice(0,6).map(s=>({
    type:'جمعية',ico:'🏢',col:'#2563a8',nm:s.nm,
    sub:`${s.ag||'—'} · مبيعات ${KD(s.s)} · كمية ${fmt(s.q||0)}`,
    val:KD(s.s),page:'cl'}));
  // ابحث في الأصناف
  const items=(O.it||[]).filter(s=>norm(s.nm).includes(qn)||norm(s.cd).includes(qn)).slice(0,6).map(s=>({
    type:'صنف',ico:'📦',col:'#1b8a8a',nm:s.nm,
    sub:`كود ${s.cd} · سعر ${KD(s.up)} · متاح ${fmt(s.rm||0)}`,
    val:KD(s.ns||0),page:'it'}));
  // ابحث في المناديب
  const ags=(O.ag||[]).filter(s=>norm(s.nm).includes(qn)).slice(0,4).map(s=>({
    type:'مندوب',ico:'👤',col:'#7d4f9e',nm:s.nm,
    sub:`${s.sc||0} جمعية · مبيعات ${KD(s.s)} · تحصيل ${PC(s.rt||0)}`,
    val:KD(s.s),page:'ag'}));
  const all=[...socs,...items,...ags];
  if(!box)return;
  if(!all.length){box.innerHTML='<div class="sr-empty">لا توجد نتائج لـ "'+q+'"</div>';box.style.display='block';return;}
  let html='';
  const groups=[['جمعيات',socs],['أصناف',items],['مناديب',ags]];
  groups.forEach(([title,arr])=>{
    if(!arr.length)return;
    html+=`<div class="sr-group"><div class="sr-group-title">${arr[0].ico} ${title} (${arr.length})</div>`;
    arr.forEach(r=>{
      html+=`<div class="sr-item" onclick="goToResult('${r.page}')"><div class="sr-ico" style="background:${r.col}1a">${r.ico}</div><div class="sr-main"><div class="sr-name">${r.nm}</div><div class="sr-sub">${r.sub}</div></div><div class="sr-val">${r.val}</div></div>`;
    });
    html+='</div>';
  });
  box.innerHTML=html;box.style.display='block';
}
function goToResult(page){
  clearGlobalSearch();
  sw(page);
}
function clearGlobalSearch(){
  const inp=$('globalSearch'),box=$('searchResults'),clr=$('searchClear');
  if(inp)inp.value='';
  if(box)box.style.display='none';
  if(clr)clr.style.display='none';
}

// ════════════════════════════════════════════
// تصدير PDF / طباعة
// ════════════════════════════════════════════
function exportPDF(){
  // Override بطباعة احترافية باستخدام PrintEngine v220.9+
  if (window.PrintEngine) {
    Logger.info('Enhanced Print: شامل متعدد الأقسام');
    return PrintEngine.printMainMenu({
      showPeriod: true,
      title: 'التقرير الشامل',
      subtitle: 'ملخص أداء كامل'
    });
  }
  
  // Fallback للطريقة القديمة
  const t=PAGE_TITLES[CUR]||['',''];
  const pg=$('p_'+CUR);
  if(pg){
    let ph=pg.querySelector('.print-header');
    if(!ph){ph=document.createElement('div');ph.className='print-header';pg.insertBefore(ph,pg.firstChild);}
    const now=new Date().toLocaleDateString('ar-KW',{year:'numeric',month:'long',day:'numeric'});
    const period=(_filterA===0&&_filterB>=O.ml.length-1)?'كل الفترات':(O.ml[_filterA]+' ← '+O.ml[_filterB]);
    ph.innerHTML='<div style="font-size:20px;font-weight:900;color:#1a2744">شركتك</div><div style="font-size:15px;font-weight:700;color:#b8932f;margin-top:4px">'+t[0]+' — '+t[1]+'</div><div style="font-size:12px;color:#666;margin-top:6px">الفترة: '+period+' · تاريخ الطباعة: '+now+'</div>';
  }
  showToast('جارٍ تجهيز الطباعة','اختر "حفظ كـ PDF" من نافذة الطباعة',false);
  setTimeout(()=>window.print(),300);
}


// ════════════════════════════════════════════
// نظام السمات (3 وضعيات خلفية)
// ════════════════════════════════════════════
const THEMES=['light','navy','dark'];
const THEME_NAMES={light:'فاتح عاجي',navy:'كحلي فاخر',dark:'داكن فحمي'};
let _theme='light';
function applyTheme(t){
  _theme=t;
  if(t==='light')document.body.removeAttribute('data-theme');
  else document.body.setAttribute('data-theme',t);
  try{localStorage.setItem('nayef_theme',t);}catch(e){}
  // 🆕 تحديث أيقونة الوضع الداكن
  try{
    const btn=document.getElementById('darkModeBtn');
    if(btn){
      const isDark=(t==='dark'||t==='navy');
      btn.textContent=isDark?'☀️':'🌙';
      btn.title=isDark?'الوضع الفاتح':'الوضع الداكن';
    }
  }catch(e){}
}
function cycleTheme(){
  const i=THEMES.indexOf(_theme);
  const next=THEMES[(i+1)%THEMES.length];
  applyTheme(next);
  updateChartColors();
  showToast('تم تغيير الخلفية',THEME_NAMES[next],false);
  setTimeout(()=>draw(CUR),100);
}

// 🆕 v220.3+ DYNAMIC: تبديل سريع بين الوضع الفاتح والداكن
function toggleDarkMode(){
  const isDark = (_theme === 'dark' || _theme === 'navy');
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  updateChartColors();
  // تحديث أيقونة الزر
  const btn = document.getElementById('darkModeBtn');
  if(btn){
    btn.textContent = isDark ? '🌙' : '☀️';
    btn.title = isDark ? 'الوضع الفاتح' : 'الوضع الداكن';
  }
  showToast(isDark ? 'تم التبديل للوضع الفاتح' : 'تم التبديل للوضع الداكن', '', false);
  setTimeout(()=>draw(CUR),100);
}
function updateChartColors(){
  if(typeof Chart==='undefined')return;
  const dark=(_theme==='navy'||_theme==='dark');
  // نظام موحّد - يتكيف مع السمة
  Chart.defaults.color=dark?'#aeb9d0':'hsl(80, 45%, 7%)';           // Olive 900 light / neutral-300 dark
  Chart.defaults.borderColor=dark?'rgba(255,255,255,.08)':'hsl(80, 22%, 72%)';  // Olive 200
  Chart.defaults.plugins.tooltip.backgroundColor=dark?'#1a2744':'hsl(80, 45%, 7%)';
  Chart.defaults.plugins.tooltip.titleColor=dark?'#d4af37':'hsl(80, 22%, 94%)';
  Chart.defaults.plugins.tooltip.bodyColor=dark?'#fffdf8':'hsl(80, 22%, 86%)';
  Chart.defaults.plugins.tooltip.borderColor=dark?'#b8932f':'hsl(80, 30%, 32%)';
}
// ══ INTENSITY CONTROL: تبديل كثافة اللون ══
let _intensity=1;
const INTENSITY_LABELS=['أفتح جداً','متوازن','أغمق','عميق','عميق جداً ⭐'];
function setIntensity(level){
  _intensity=level;
  document.body.setAttribute('data-intensity',level);
  document.querySelectorAll('.intensity-btn').forEach(btn=>{
    btn.classList.toggle('intensity-btn--active',btn.dataset.level==level);
  });
  try{localStorage.setItem('nayef_intensity',level);}catch(e){}
  showToast('كثافة اللون: '+INTENSITY_LABELS[level],'',false);
  // تحديث الـ charts لتطابق الكثافة الجديدة
  setTimeout(()=>{if(typeof updateChartColors==='function')updateChartColors();},50);
  // إعادة رسم الصفحات لتطبيق التغييرات
  setTimeout(()=>draw(CUR),100);
}

function initTheme(){
  try{
    const saved=localStorage.getItem('nayef_theme');
    if(saved&&THEMES.includes(saved))applyTheme(saved);
  }catch(e){}
  // استرجاع الكثافة المحفوظة
  try{
    const savedIntensity=localStorage.getItem('nayef_intensity');
    if(savedIntensity!==null){
      _intensity=parseInt(savedIntensity);
      document.body.setAttribute('data-intensity',_intensity);
      document.querySelectorAll('.intensity-btn').forEach(btn=>{
        btn.classList.toggle('intensity-btn--active',btn.dataset.level==_intensity);
      });
    }
  }catch(e){}
  if(typeof updateChartColors==='function')updateChartColors();
}

// ════════════════════════════════════════════
// نظام التحديث التلقائي (File System Access API)
// ════════════════════════════════════════════
let _fileHandle=null;       // مقبض الملف المرتبط
let _watchTimer=null;        // مؤقّت المراقبة
let _lastModified=0;         // آخر وقت تعديل معروف
const SUPPORTS_FSA='showOpenFilePicker' in window;

// ربط ملف عبر File System Access API (يتذكّر الملف)
async function pickFileHandle(){
  if(!SUPPORTS_FSA){document.getElementById('xlf').click();return;}
  try{
    const [handle]=await window.showOpenFilePicker({
      types:[{description:'Excel',accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx','.xlsm','.xls']}}]
    });
    _fileHandle=handle;
    await saveHandle(handle);
    await readFromHandle();
  }catch(e){if(e.name!=='AbortError')Logger.warn(e);}
}

// قراءة الملف من المقبض المحفوظ
async function readFromHandle(){
  if(!_fileHandle)return;
  try{
    // تأكّد من صلاحية الوصول
    const perm=await _fileHandle.queryPermission({mode:'read'});
    if(perm!=='granted'){
      const req=await _fileHandle.requestPermission({mode:'read'});
      if(req!=='granted'){showToast('يلزم إذن الوصول للملف','اضغط تحديث وامنح الإذن',true);return;}
    }
    const file=await _fileHandle.getFile();
    _lastModified=file.lastModified;
    const btn=document.getElementById('autoBtn');if(btn)btn.classList.add('loading');
    readFile(file);
  }catch(e){Logger.warn('قراءة المقبض فشلت',e);showToast('تعذّر قراءة الملف','قد يكون نُقل أو حُذف',true);}
}

// زر التحديث التلقائي
async function autoUpdate(){
  if(_fileHandle){await readFromHandle();}
  else if(SUPPORTS_FSA){await pickFileHandle();}
  else{document.getElementById('xlf').click();}
}

// المراقبة التلقائية (تفحص تغيّر الملف كل 10 ثوانٍ)
function toggleWatch(){
  const chk=document.getElementById('watchChk');
  if(chk&&chk.checked){
    if(!_fileHandle){showToast('اربط ملفاً أولاً','اضغط "تحديث تلقائي" واختر الملف',true);chk.checked=false;return;}
    _watchTimer=setInterval(checkFileChanged,10000);
    showToast('المراقبة التلقائية مفعّلة','سيُحدّث تلقائياً عند تغيّر الملف',false);
    const ab=document.getElementById('autoBtn');if(ab)ab.classList.add('autoBtn-live');
  }else{
    if(_watchTimer){clearInterval(_watchTimer);_watchTimer=null;}
    const ab=document.getElementById('autoBtn');if(ab)ab.classList.remove('autoBtn-live');
  }
}
async function checkFileChanged(){
  if(!_fileHandle)return;
  try{
    const file=await _fileHandle.getFile();
    if(file.lastModified>_lastModified){
      _lastModified=file.lastModified;
      showToast('رُصد تغيّر في الملف','جارٍ التحديث التلقائي...',false);
      readFile(file);
    }
  }catch(e){}
}

// حفظ/استرجاع مقبض الملف في IndexedDB
async function saveHandle(handle){
  try{const db=await openDB();const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(handle,'fileHandle');return new Promise(r=>{tx.oncomplete=()=>r(true);tx.onerror=()=>r(false);});}catch(e){return false;}
}
async function loadHandle(){
  try{const db=await openDB();const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get('fileHandle');return new Promise(r=>{req.onsuccess=()=>r(req.result||null);req.onerror=()=>r(null);});}catch(e){return null;}
}

// ══ INIT ══
document.addEventListener('DOMContentLoaded',function(){
  if(typeof Chart!=='undefined'){
    // نظام موحّد للرسوم البيانية - زيتوني
    Chart.defaults.font.family='"Tajawal","Segoe UI",Tahoma,Arial,sans-serif';
    Chart.defaults.color='hsl(80, 45%, 7%)';  // نص موحّد (Olive 900)
    Chart.defaults.font.size=11;
    Chart.defaults.borderColor='hsl(80, 22%, 72%)';  // حدود زيتونية (Olive 200)
    Chart.defaults.plugins.tooltip={
      backgroundColor:'hsl(80, 45%, 7%)',  // خلفية زيتوني داكن (Olive 900)
      titleColor:'hsl(80, 22%, 94%)',      // نص فاتح (Olive 50)
      bodyColor:'hsl(80, 22%, 86%)',        // نص ثانوي (Olive 100)
      borderColor:'hsl(80, 30%, 32%)',     // حد زيتوني (Olive 500)
      borderWidth:1,
      padding:11,
      cornerRadius:9,
      titleFont:{size:12,weight:'800'},
      bodyFont:{size:12}
    };
  }
  initTheme();
  // استرجاع مقبض الملف المرتبط (للتحديث التلقائي)
  loadHandle().then(h=>{
    if(h){_fileHandle=h;
      const ab=document.getElementById('autoBtn');if(ab)ab.style.display='flex';
      const wc=document.getElementById('watchChip');if(wc)wc.style.display='flex';
      const pb=document.getElementById('pickBtn');if(pb)pb.innerHTML='📂 تغيير الملف';
    }
  }).catch(()=>{});
  loadData().then(async saved=>{
    // ── إصلاح جذري 2026: إذا لم تكن هناك بيانات محفوظة ولا SEED مدمج (أو فارغ) ──
    // لا نُحمّل أي شيء تلقائياً — نطلب من المستخدم رفع ملف
    const embeddedIsEmpty = (typeof SEED==='undefined') || (SEED&&SEED._empty===true) || (SEED&&(!SEED.soc||SEED.soc.length===0)&&(!SEED.ag||SEED.ag.length===0));
    if(!saved&&embeddedIsEmpty){
      // عرض رسالة "ارفع ملف" بدلاً من تحميل SEED
      try{
        const emp=O={soc:[],mon:[],ml:[],mk:[],mt:[],mc:[],T:{s:0,co:0,pr:0,c:0},it:[],im:{},ag:[],tx:[],checks:[],agentMovement:[],agentSummary:[]};
        D=JSON.parse(JSON.stringify(emp));
        $('upd2').textContent='📁 لا توجد بيانات — ارفع ملف Excel لبدء التحليل';
        const pgOv=$('p_ov');if(pgOv){
          pgOv.innerHTML='<div class="dc" style="text-align:center;padding:60px 20px;border:2px dashed var(--gold-soft);border-radius:16px;background:var(--surf2)"><div style="font-size:64px;margin-bottom:20px">📊</div><h2 style="color:var(--gd);margin-bottom:12px">مرحباً بك في داشبورد نظام إدارة مالية</h2><p style="color:var(--tx2);font-size:15px;line-height:1.9;max-width:600px;margin:0 auto 24px">الداشبورد فارغ. اختر طريقة البدء:<br><b>📂 ارفع ملف Excel</b> للتحليل الشامل، أو<br><b>📦 أضف أصناف يدوياً</b> من صفحة «الأصناف» في القائمة الجانبية.</p><div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><div style="display:inline-block;background:var(--gold);color:#fff;padding:12px 24px;border-radius:12px;font-weight:700">📂 ربط ملف Excel</div><div style="display:inline-block;background:#1b8a8a;color:#fff;padding:12px 24px;border-radius:12px;font-weight:700">📦 صفحة الأصناف ➕</div></div></div>';
        }
        initFilter();sw('ov');updateRefreshBtn();
        return;
      }catch(e){Logger.warn('empty state failed',e);}
    }
    if(saved&&saved.seed){
      // فحص الإصدار: النسخ القديمة المحفوظة قبل أحدث الميزات تنقصها حقول جديدة.
      // نقبل المحفوظ فقط إذا احتوى كل الحقول الحديثة (المصاريف + جدولا المناديب). غير ذلك نطلب رفعاً جديداً.
      const seed=saved.seed;
      const hasExpensesKey=Object.prototype.hasOwnProperty.call(seed,'expenses');
      const hasAgentTables=Object.prototype.hasOwnProperty.call(seed,'agentMovement')&&Object.prototype.hasOwnProperty.call(seed,'agentSummary');
      // ── إصلاح جذري (2026): فحص صحة البيانات المحفوظة ──
      // لو كانت البيانات المحفوظة تحتوي على تواريخ غير صالحة في agentSummary (مثل "2025-12" بدل "2026-01")
      // أو لا تحتوي على الأشهر المتوقعة (مايو، يونيو 2026)، نتجاهلها ونستخدم SEED المضمّن.
      let agentSummaryCorrupted=false;
      try{
        const summ=seed.agentSummary||[];
        const mks=new Set(summ.map(r=>r.mk));
        // إذا لم يحتوِ agentSummary على الأشهر المتوقعة، فهو فاسد أو قديم
        const expectedMks=['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06'];
        const missing=expectedMks.filter(mk=>!mks.has(mk));
        if(summ.length>0 && missing.length>=3){agentSummaryCorrupted=true; Logger.warn('Saved agentSummary missing months:',missing);}
        // إذا كان أول شهر في agentSummary قبل 2026-01، فهو فاسد
        const firstMk=[...mks].sort()[0];
        if(firstMk&&firstMk<'2026-01'){agentSummaryCorrupted=true; Logger.warn('Saved agentSummary first month too old:',firstMk);}
      }catch(e){Logger.warn('Corruption check failed',e);}
      // ── فحص إصدار البيانات: إذا كان SEED المضمّن أحدث من المحفوظ، استخدم المضمّن مباشرة (بلا طلب رفع) ──
      // هذا يضمن أن أي تحديث للبيانات المضمّنة في الملف يَظهر فوراً حتى لو كان في المتصفح نسخة محفوظة أقدم.
      const embeddedV=(typeof SEED!=='undefined'&&SEED._v)?SEED._v:'';
      const savedV=seed._v||'';
      // نعتمد المحفوظ إذا: طابق إصدار المضمّن، أو كان رفعاً يدوياً حديثاً من المستخدم (upload-*).
      // غير ذلك (إصدار قديم/مفقود) نستخدم SEED المضمّن الأحدث مباشرة بلا طلب رفع.
      const savedIsUserUpload=savedV.indexOf('upload-')===0;
      const savedMatchesEmbedded=embeddedV&&savedV===embeddedV;
      // إصلاح جذري (3ب): إن كان المضمّن رفعاً أحدث زمنياً من المحفوظ، اعتمد المضمّن.
      const _ut=v=>{const m=String(v||'').match(/^upload-(\d+)/);return m?+m[1]:0;};
      const embeddedIsNewer=_ut(embeddedV)>_ut(savedV);
      // v210: حل جذري - أي إصدار محفوظ لا يطابق SEED الحالي يتم تجاهله
      // لأن المستخدم يريد رؤية البيانات المضمّنة المحدثة
      const savedNeedsForceReload = embeddedV && savedV !== embeddedV && savedV !== 'restored';
      if(agentSummaryCorrupted||savedNeedsForceReload||(embeddedV&&!savedMatchesEmbedded&&(!savedIsUserUpload||embeddedIsNewer))){
        try{
          // مسح البيانات الفاسدة أولاً
          await clearData();
          O=JSON.parse(JSON.stringify(SEED));
          D=JSON.parse(JSON.stringify(O));
          saveData(O,_lastFname||'بيانات محدّثة مضمّنة');
          $('upd2').textContent='⚠️ تم تجاهل بيانات قديمة فاسدة وتحميل أحدث البيانات المضمّنة';
          initFilter();sw('ov');updateRefreshBtn();
          try{showToast('تم إصلاح البيانات','تم اكتشاف بيانات قديمة وفاسدة، تم استبدالها بأحدث بيانات مضمّنة',true);}catch(e){}
        }catch(e){Logger.warn('تحميل SEED المضمّن فشل',e);initFilter();sw('ov');updateRefreshBtn();}
        return;
      }
      if(!hasExpensesKey||!hasAgentTables){
        // بيانات قديمة — تجاهلها واطلب رفعاً جديداً ليُقرأ شيت المصاريف وجداول المناديب
        $('upd2').textContent='⚠️ بياناتك المحفوظة قديمة — أعد رفع ملف Excel لتفعيل صفحات المصاريف وحركة المناديب';
        initFilter();sw('ov');updateRefreshBtn();
        try{showToast('تحديث مطلوب','أعد رفع ملف Excel مرة واحدة لتفعيل صفحة المصاريف وجداول حركة المناديب',false);}catch(e){}
        return;
      }
      try{
        O=JSON.parse(JSON.stringify(saved.seed));
        D=JSON.parse(JSON.stringify(O));
        _lastFname=saved.fname||'';
        const dt=new Date(saved.ts);
        $('upd2').textContent='💾 محفوظ: '+(saved.fname||'')+' ('+dt.toLocaleDateString('ar')+')';
        initFilter();sw('ov');updateRefreshBtn();return;
      }catch(e){Logger.warn('استعادة فشلت',e);}
    }
    
// ═══════════════════════════════════════════════════════════════
// v200: أدوات استيراد وإدارة البيانات
// ═══════════════════════════════════════════════════════════════

function importExcelFile() {
  const input = document.getElementById('excelFileInput');
  if (input) input.click();
  else showToast('خطأ', 'عنصر الملف غير موجود', false);
}

async function handleExcelFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  showToast('جاري القراءة...', 'يتم قراءة ملف ' + file.name, false);
  try {
    if (typeof XLSX === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rows || rows.length < 2) {
      showToast('خطأ', 'الملف فارغ أو لا يحتوي على بيانات', false);
      return;
    }
    let added = 0;
    const headers = rows[0].map(h => String(h || '').trim());
    const dateCol = headers.findIndex(h => h.includes('تاريخ') || h.toLowerCase().includes('date'));
    const invCol = headers.findIndex(h => h.includes('فاتورة') || h.includes('رقم') || h.toLowerCase().includes('invoice'));
    const clientCol = headers.findIndex(h => h.includes('عميل') || h.includes('جمعية') || h.toLowerCase().includes('client'));
    const amountCol = headers.findIndex(h => h.includes('مبلغ') || h.includes('مدين') || h.includes('دائن') || h.toLowerCase().includes('amount'));
    const typeCol = headers.findIndex(h => h.includes('نوع') || h.includes('بيان') || h.toLowerCase().includes('type'));
    if (dateCol === -1 || invCol === -1 || amountCol === -1) {
      showToast('تنسيق غير معروف', 'يرجى التأكد من أن الملف يحتوي على أعمدة: التاريخ، رقم الفاتورة، المبلغ، العميل', false);
      return;
    }
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const dt = row[dateCol];
      const inv = row[invCol];
      const amount = row[amountCol];
      const client = clientCol >= 0 ? row[clientCol] : '';
      const type = typeCol >= 0 ? row[typeCol] : '';
      if (!dt || !inv || amount === undefined) continue;
      let dateStr;
      if (typeof dt === 'number') {
        const d = new Date((dt - 25569) * 86400 * 1000);
        dateStr = d.toISOString().slice(0, 10);
      } else if (typeof dt === 'string') {
        dateStr = dt.slice(0, 10);
      } else {
        continue;
      }
      const clientName = String(client || '').trim() || 'غير محدد';
      const tp = String(type || '').includes('مرتجع') ? 'return' :
                 String(type || '').includes('دفع') || String(type || '').includes('شيك') || String(type || '').includes('تحصيل') ? 'payment' : 'sale';
      O.tx.push({
        id: 'TX-IMP-' + Date.now() + '-' + i,
        dt: dateStr,
        client: clientName,
        cl: clientName,
        i: typeof inv === 'number' ? inv : parseInt(String(inv).replace(/\D/g, '')) || 0,
        items: [['R-IMP', 1, +amount, +amount]],
        amount: +amount,
        cost: 0,
        tp: tp,
        ag: 'مستورد'
      });
      added++;
    }
    nayefSaveData();
    // 🆕 v220.1+ LOCKED FIX: استدعاء recompute لتحديث D وإلا sw('ov') يعرض بيانات قديمة
    try {
      if(typeof recompute === 'function') {
        const a = (typeof _filterA !== 'undefined') ? _filterA : 0;
        const b = (typeof _filterB !== 'undefined') ? _filterB : (O.ml?.length - 1 || 0);
        recompute(a, b);
      }
    } catch(e) { Logger.warn('⚠️ recompute after import:', e); }
    initFilter();
    sw('ov');
    updateRefreshBtn();
    showToast('✅ تم الاستيراد', 'تم إضافة ' + added + ' معاملة من الملف', true);
  } catch (err) {
    Logger.error('Excel import error:', err);
    showToast('خطأ', 'فشل قراءة الملف: ' + err.message, false);
  }
  event.target.value = '';
}

function resetLocalData() {
  if (!confirm('هل أنت متأكد من مسح كل البيانات المحلية والعودة إلى البيانات المضمّنة في الملف؟ لن يمكن التراجع!')) return;
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (k.startsWith('nayef_') || k.includes('dash') || k.includes('data_backup')) {
        localStorage.removeItem(k);
      }
    });
    showToast('✅ تم المسح', 'تم مسح كل البيانات المحلية. سيتم إعادة التحميل...', true);
    setTimeout(() => window.location.reload(), 1500);
  } catch (e) {
    Logger.error('resetLocalData:', e);
    showToast('خطأ', 'فشل المسح: ' + e.message, false);
  }
}


function openAddClientModal() {
  const modal = document.createElement('div');
  modal.id = 'addClientModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:500px;width:100%;max-height:90vh;overflow:auto">' +
    '<h3 style="margin:0 0 16px;color:#2980b9;border-bottom:2px solid #2980b9;padding-bottom:8px">🏢 إضافة عميل جديد</h3>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    '<label>اسم العميل: <input type="text" id="newClNm" placeholder="مثال: جمعية الفحيحيل التعاونية" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"></label>' +
    '<label>رقم الهاتف: <input type="text" id="newClPhone" placeholder="+965 90000000" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"></label>' +
    '<label>المنطقة: <input type="text" id="newClReg" placeholder="الكويت" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"></label>' +
    '<label>المندوب: <input type="text" id="newClAg" placeholder="محمد العتيبي" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"></label>' +
    '<label>الرصيد الافتتاحي: <input type="number" step="0.001" id="newClOb" value="0" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"></label>' +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">' +
    '<button onclick="document.getElementById(\'addClientModal\').remove()" style="padding:10px 20px;background:#95a5a6;color:#fff;border:none;border-radius:6px;cursor:pointer">إلغاء</button>' +
    '<button onclick="saveNewClient()" style="padding:10px 20px;background:#2980b9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold">💾 حفظ</button>' +
    '</div></div>';
  document.body.appendChild(modal);
}

function saveNewClient() {
  const nm = document.getElementById('newClNm').value.trim();
  const phone = document.getElementById('newClPhone').value.trim();
  const reg = document.getElementById('newClReg').value.trim();
  const ag = document.getElementById('newClAg').value.trim();
  const ob = parseFloat(document.getElementById('newClOb').value) || 0;
  
  if (!nm) { showToast('خطأ', 'يرجى إدخال اسم العميل', false); return; }
  
  const newClient = {
    i: O.soc.length + 1,
    nm: nm,
    phone: phone,
    op: ob,
    ob: ob,
    s: 0, co: 0, pr: 0, c: 0, ot: ob, q: 0, rt: 1,
    li: '', lc: '', ag: ag, reg: reg,
    nt: 'عميل جديد'
  };
  O.soc.push(newClient);
  nayefSaveData();
  initFilter();
  sw('ov');
  updateRefreshBtn();
  document.getElementById('addClientModal').remove();
  showToast('✅ تمت الإضافة', 'تمت إضافة العميل: ' + nm, true);
}



// ✏️ تعديل صف
function editRow(rowId) {
  const tx = O.tx.find(t => t.id === rowId);
  if (!tx) { showToast('خطأ', 'لم يتم العثور على المعاملة', false); return; }
  
  const modal = document.createElement("div");
  modal.id = "editTxModal";
  modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px";
  modal.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:500px;width:100%">' +
    '<h3 style="margin:0 0 16px;color:#f39c12;border-bottom:2px solid #f39c12;padding-bottom:8px">✏️ تعديل معاملة</h3>' +
    '<div style="display:flex;flex-direction:column;gap:12px">' +
    '<label>التاريخ: <input type="date" id="edTxDate" value="' + tx.dt + '" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"></label>' +
    '<label>رقم الفاتورة: <input type="number" id="edTxInv" value="' + tx.i + '" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"></label>' +
    '<label>المبلغ: <input type="number" step="0.001" id="edTxAmount" value="' + tx.amount + '" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"></label>' +
    '<label>النوع: <select id="edTxType" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px"><option value="sale"' + (tx.tp==='sale'?' selected':'') + '>فاتورة</option><option value="return"' + (tx.tp==='return'?' selected':'') + '>مرتجع</option><option value="payment"' + (tx.tp==='payment'?' selected':'') + '>شيك/تحصيل</option></select></label>' +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:20px;justify-content:space-between">' +
    '<button onclick="deleteRow("' + rowId + '")" style="padding:10px 20px;background:#c0392b;color:#fff;border:none;border-radius:6px;cursor:pointer">🗑️ حذف</button>' +
    '<div style="display:flex;gap:10px"><button onclick="document.getElementById(\'editTxModal\').remove()" style="padding:10px 20px;background:#95a5a6;color:#fff;border:none;border-radius:6px;cursor:pointer">إلغاء</button>' +
    '<button onclick="saveEditRow("' + rowId + '")" style="padding:10px 20px;background:#f39c12;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold">💾 حفظ</button></div>' +
    '</div></div>';
  document.body.appendChild(modal);
}

function saveEditRow(rowId) {
  const tx = O.tx.find(t => t.id === rowId);
  if (!tx) return;
  tx.dt = document.getElementById('edTxDate').value;
  tx.i = parseInt(document.getElementById('edTxInv').value) || 0;
  tx.amount = parseFloat(document.getElementById('edTxAmount').value) || 0;
  tx.tp = document.getElementById('edTxType').value;
  nayefSaveData();
  initFilter();
  sw('ov');
  updateRefreshBtn();
  const modal = document.getElementById('editTxModal');
  if (modal) modal.remove();
  showToast('✅ تم التعديل', 'تم تحديث المعاملة', true);
}

function deleteRow(rowId) {
  if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟')) return;
  O.tx = O.tx.filter(t => t.id !== rowId);
  nayefSaveData();
  initFilter();
  sw('ov');
  updateRefreshBtn();
  const modal = document.getElementById('editTxModal');
  if (modal) modal.remove();
  showToast('✅ تم الحذف', 'تم حذف المعاملة', true);
}

initFilter();sw('ov');updateRefreshBtn();
  });
});
