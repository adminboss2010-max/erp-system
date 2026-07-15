
/* ════════════════════════════════════════════════════════════════
   🆕 v230.7+ RENTAL VALUES PAGE — مستقل تماماً عن نظام المبيعات
   ════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  function _rentalEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _rentalMap(headers) {
    const m = {};
    headers.forEach(function(h, i) {
      const k = String(h || '').trim();
      if (/^م$|^رقم|^#|^row/i.test(k))                   m.row = i;
      else if (/اسم\s*العميل|العميل|الزبون|client|customer/i.test(k)) m.client = i;
      else if (/قيمة\s*العقد|قيمة\s*الإيجار|contract|rent\s*value/i.test(k))  m.contract = i;
      else if (/الخصم|خصم|discount/i.test(k))             m.discount = i;
      else if (/المجاني|إيجابي|positive/i.test(k))          m.positive = i;  // المجاني أو الإيجابي
      else if (/المجاني\s*2|المجاني2|إيجابي\s*\?|positive\s*\?/i.test(k)) m.positiveQ = i;
      else if (/ملاحظ|notes?|ملاحظات/i.test(k))              m.notes = i;
    });
    return m;
  }

  function _kv(icon, label, value, color) {
    return '<div style="background:var(--c-bg-elevated);border:1px solid var(--c-border);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px">' +
      '<div style="font-size:22px">' + icon + '</div>' +
      '<div>' +
        '<div style="font-size:11px;color:var(--c-fg-muted);font-weight:600">' + _rentalEsc(label) + '</div>' +
        '<div style="font-size:17px;font-weight:900;color:' + color + '">' + _rentalEsc(value) + '</div>' +
      '</div>' +
    '</div>';
  }

  window.pageRentalValues = function(pg) {
    if (!pg) return;
    const cache = window._rentalSheetCache;

    if (!cache) {
      pg.innerHTML = '<div style="padding:60px 24px;text-align:center;color:var(--c-fg-muted)">' +
        '<div style="font-size:48px;margin-bottom:16px">🏠</div>' +
        '<h3 style="color:var(--c-fg);margin:0 0 8px">لا يوجد شيت إيجارات</h3>' +
        '<p>أضيفي شيت باسم "القيمه الايجاريه" في ملف Excel ثم أعيدي رفع الملف.</p>' +
        '<p style="font-size:12px;margin-top:12px;opacity:.7">الأعمدة المتوقعة: م · اسم العميل · قيمة العقد · الخصم · الإيجابي · الإيجابي ؟ · ملاحظات</p>' +
        '<button onclick="document.getElementById(\'xlf\')?.click()" style="margin-top:20px;padding:10px 22px;background:var(--c-primary);color:var(--c-primary-fg);border:none;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit">📁 رفع ملف Excel</button>' +
      '</div>';
      return;
    }

    const headers = cache.headers || [];
    const allRows = cache.rows || [];
    // ✅ cache.rows يحتوي البيانات فقط (الـ headers انتزع في findSheet)
    const data = allRows.filter(function(r) {
      return r && r.length && r.some(function(c) { return c != null && c !== ''; });
    });
    const map = _rentalMap(headers);

    if (map.contract === undefined || map.client === undefined) {
      pg.innerHTML = '<div style="padding:40px 24px;text-align:center;color:#dc2626">' +
        '<div style="font-size:36px">⚠️</div>' +
        '<h3>تعذّر قراءة أعمدة الإيجار</h3>' +
        '<p style="color:var(--c-fg-muted)">الأعمدة الموجودة: ' + headers.map(_rentalEsc).join(' · ') + '</p>' +
        '<p style="font-size:12px;color:var(--c-fg-muted)">المطلوب عمود "اسم العميل" + "قيمة العقد" على الأقل.</p>' +
      '</div>';
      return;
    }

    function num(r, k) { return k === undefined ? 0 : (parseFloat(r[k]) || 0); }

    const totalContract = data.reduce(function(s, r) { return s + num(r, map.contract); }, 0);
    const totalDiscount = data.reduce(function(s, r) { return s + num(r, map.discount); }, 0);
    const totalPositive = data.reduce(function(s, r) { return s + num(r, map.positive); }, 0);
    const netValue = totalContract - totalDiscount;
    const avgValue = data.length ? totalContract / data.length : 0;
    const discountRate = totalContract > 0 ? (totalDiscount / totalContract * 100).toFixed(1) : 0;
    const positiveCount = data.filter(function(r) { return num(r, map.positive) > 0; }).length;

    pg.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center;justify-content:space-between">' +
        '<div style="font-size:12px;color:var(--c-fg-muted)">المصدر: <b>' + _rentalEsc(cache.name) + '</b> · ' + data.length + ' سجل</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button onclick="exportRentalExcel()" style="padding:8px 14px;background:var(--c-primary);color:var(--c-primary-fg);border:none;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit">📊 تصدير Excel</button>' +
          '<button onclick="window.print()" style="padding:8px 14px;background:var(--c-accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit">🖨 طباعة</button>' +
          '<button onclick="document.getElementById(\'xlf\')?.click()" style="padding:8px 14px;background:var(--c-bg-subtle);color:var(--c-fg);border:1px solid var(--c-border);border-radius:8px;cursor:pointer;font-weight:600;font-family:inherit">↻ إعادة الرفع</button>' +
        '</div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px">' +
        _kv('📦', 'عدد العقود', data.length, '#1a2744') +
        _kv('💰', 'إجمالي قيمة العقود', totalContract.toFixed(3), '#059669') +
        _kv('🏷️', 'إجمالي الخصومات', totalDiscount.toFixed(3), '#dc2626') +
        _kv('✅', 'إجمالي الإيجابي', totalPositive.toFixed(3), '#0891b2') +
        _kv('📊', 'الصافي (بعد الخصم)', netValue.toFixed(3), '#7c3aed') +
        _kv('📈', 'متوسط قيمة العقد', avgValue.toFixed(3), '#b45309') +
        _kv('📉', 'نسبة الخصم %', discountRate + '%', '#dc2626') +
        _kv('⭐', 'عقود إيجابية', positiveCount, '#0891b2') +
      '</div>' +

      '<div class="table-card" style="overflow-x:auto">' +
        '<h3>🏠 جدول القيم الإيجارية</h3>' +
        '<table class="data-table" style="width:100%;border-collapse:collapse">' +
          '<thead><tr style="background:var(--c-bg-muted)">' +
            headers.map(function(h) { return '<th style="padding:10px 8px;border-bottom:2px solid var(--c-border);text-align:right;font-size:11px">' + _rentalEsc(h) + '</th>'; }).join('') +
          '</tr></thead>' +
          '<tbody>' +
            data.map(function(r, i) {
              return '<tr style="border-bottom:1px solid var(--c-border)">' +
                headers.map(function(_, j) {
                  const v = r[j];
                  let cls = '';
                  const style = '';
                  if (j === map.contract) cls = 'num'; else
                  if (j === map.discount) cls = 'num'; else
                  if (j === map.positive) cls = 'num';
                  return '<td style="padding:9px 8px;' + style + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + _rentalEsc(v == null ? '—' : v) + '</td>';
                }).join('') +
              '</tr>';
            }).join('') +
          '</tbody>' +
          '<tfoot>' +
            '<tr style="background:var(--c-bg-muted);font-weight:900">' +
              '<td colspan="' + (map.contract !== undefined ? Math.max(map.contract, 1) : 1) + '" style="padding:10px 8px;text-align:left">الإجمالي</td>' +
              (map.contract !== undefined ? '<td class="num" style="padding:10px 8px;font-weight:900;color:#059669">' + totalContract.toFixed(3) + '</td>' : '') +
              (map.discount !== undefined ? '<td class="num" style="padding:10px 8px;font-weight:900;color:#dc2626">' + totalDiscount.toFixed(3) + '</td>' : '') +
              (map.positive !== undefined ? '<td class="num" style="padding:10px 8px;font-weight:900;color:#0891b2">' + totalPositive.toFixed(3) + '</td>' : '') +
              '<td colspan="10"></td>' +
            '</tr>' +
          '</tfoot>' +
        '</table>' +
      '</div>';
  };

  window.exportRentalExcel = function() {
    const cache = window._rentalSheetCache;
    if (!cache) { try { showToast('لا توجد بيانات إيجارات', '', true); } catch(e){} return; }
    if (!window.XLSX) { try { showToast('مكتبة Excel غير محمّلة', '', true); } catch(e){} return; }
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([cache.headers].concat((cache.rows || []).slice(1)));
      XLSX.utils.book_append_sheet(wb, ws, 'القيم الإيجارية');
      const fname = 'rental-values-' + new Date().toISOString().slice(0, 10) + '.xlsx';
      XLSX.writeFile(wb, fname);
      try { showToast('✅ تم التصدير', fname, false); } catch(e){}
    } catch (e) {
      try { showToast('فشل التصدير: ' + e.message, '', true); } catch(_){}
    }
  };

})();
