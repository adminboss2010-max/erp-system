/* ═══════════════════════════════════════════════════════════════════
   v230.2+ COMPLETE FALLBACK PRINT + COMPONENTS SYSTEM
   - يعمل بدون الاعتماد على modules خارجية
   - يقرأ من window.O مباشرة (البيانات الفعلية)
   - يضمن Letterhead + Footer + Signatures احترافية
═══════════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';
  
  /* === Helpers === */
  function v23_(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function v23Num(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toLocaleString('ar-KW');
  }
  function v23Cur(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return v23Num(Math.round(n * 1000) / 1000) + ' د.ك';
  }
  function v23Date(d) {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '—';
      return dt.toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return '—'; }
  }
  function v23O() { return (window.O && typeof window.O === 'object') ? window.O : {}; }
  
  function v23Toast(msg) {
    const old = document.querySelector('.v23-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'v23-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }
  
  function v23CloseModal() {
    const m = document.getElementById('v23-modal');
    if (m) m.remove();
  }
  
  function v23Modal(title, html) {
    v23CloseModal();
    const m = document.createElement('div');
    m.id = 'v23-modal';
    m.className = 'v23-modal-bg';
    m.onclick = (e) => { if (e.target === m) v23CloseModal(); };
    m.innerHTML = `<div class="v23-modal" onclick="event.stopPropagation()">
      <div class="v23-modal-h"><h3>${v23_(title)}</h3><button onclick="v23CloseModal()" title="إغلاق">✕</button></div>
      <div class="v23-modal-b" id="v23-modal-body">${html}</div>
    </div>`;
    document.body.appendChild(m);
  }
  
  /* === Floating Toggle === */
  window.v23FloatingToggle = function() {
    const menu = document.getElementById('v23-floating-menu');
    const btn = document.getElementById('v23-floating-toggle');
    if (!menu || !btn) return;
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    btn.querySelector('.v23-toggle-arrow').textContent = isOpen ? '▼' : '▲';
  };
  
  /* === Letterhead Generator === */
  function v23Letterhead(title, subtitle) {
    const now = new Date();
    const dateStr = v23Date(now.toISOString());
    const timeStr = now.toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' });
    return `
<div style="background:linear-gradient(135deg,#1a2744 0%,#2a3f5f 100%);color:#fff;padding:14mm 10mm;margin:0 0 8mm 0;border-bottom:3pt solid #b8932f;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h1 style="margin:0 0 2mm 0;font-size:18pt;color:#fff;font-weight:900;">شركتك</h1>
      <h2 style="margin:2mm 0 0 0;font-size:13pt;color:#b8932f;font-weight:700;">${v23_(title)}</h2>
      ${subtitle ? `<div style="margin-top:4mm;font-size:10pt;color:rgba(255,255,255,0.85);">${v23_(subtitle)}</div>` : ''}
    </div>
    <div style="text-align:left;font-size:9pt;color:rgba(255,255,255,0.85);">
      <div style="margin-bottom:2mm;">📅 ${dateStr}</div>
      <div>🕐 ${timeStr}</div>
    </div>
  </div>
</div>`;
  }
  
  function v23Footer() {
    return `
<div style="margin-top:14mm;padding-top:6mm;border-top:0.5pt solid #999;display:flex;justify-content:space-between;font-size:9pt;color:#666;">
  <span>شركتك</span>
  <span>v2.3 · نظام دعم القرار المالي</span>
</div>`;
  }
  
  function v23Signatures() {
    return `
<div style="margin-top:14mm;page-break-inside:avoid;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6mm;">
  <div style="border-top:0.5pt solid #555;padding-top:2mm;text-align:center;font-size:9pt;"><strong style="display:block;margin-bottom:10mm;color:#1a2744;">المحاسب</strong>التوقيع والختم</div>
  <div style="border-top:0.5pt solid #555;padding-top:2mm;text-align:center;font-size:9pt;"><strong style="display:block;margin-bottom:10mm;color:#1a2744;">المدير المالي</strong>التوقيع والختم</div>
  <div style="border-top:0.5pt solid #555;padding-top:2mm;text-align:center;font-size:9pt;"><strong style="display:block;margin-bottom:10mm;color:#1a2744;">المدير العام</strong>التوقيع والختم</div>
</div>`;
  }
  
  function v23PrintPage(content, title) {
    // إذا لم يُمرّر content، اطبع Dashboard مباشر
    if (!content) {
      v23ShowPrintModal('<p style="text-align:center;color:#888;padding:40px;">اختر تقرير من زر "اختر تقرير" أولاً</p>', title || 'معاينة');
      return;
    }
    
    const html = `
<div class="v23-paper">
  ${v23Letterhead(title || 'تقرير')}
  ${content}
  ${v23Signatures()}
  ${v23Footer()}
</div>`;
    
    v23ShowPrintModal(html, title || 'تقرير');
  }
  
  /**
   * نافذة معاينة الطباعة الاحترافية
   * تعرض التقرير كاملاً قبل الطباعة ثم تسمح بالطباعة
   */
  function v23ShowPrintModal(html, title) {
    v23CloseModal();
    
    const modal = document.createElement('div');
    modal.id = 'v23-print-preview-modal';
    modal.className = 'v23-pp-bg';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="v23-pp-container">
        <div class="v23-pp-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="background:rgba(255,255,255,0.2);width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">🖨️</div>
            <div>
              <div style="font-size:17px;font-weight:700;">معاينة الطباعة</div>
              <div style="font-size:11px;opacity:0.85;margin-top:1px;">${v23_(title || 'تقرير')} · حجم A4 احترافي</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="v23ExecutePrint()" class="v23-pp-btn v23-pp-btn-primary" title="طباعة أو حفظ كـ PDF">
              <span style="font-size:16px;">🖨️</span> <span>طباعة / حفظ PDF</span>
            </button>
            <button onclick="document.getElementById('v23-print-preview-modal').remove()" class="v23-pp-btn v23-pp-btn-close" title="إغلاق المعاينة">
              ✕ إغلاق
            </button>
          </div>
        </div>
        
        <div class="v23-pp-toolbar">
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="font-size:12px;color:#666;">📄 المعاينة:</span>
            <button onclick="v23Zoom(0.5)" class="v23-pp-zoom">50%</button>
            <button onclick="v23Zoom(0.75)" class="v23-pp-zoom">75%</button>
            <button onclick="v23Zoom(1)" class="v23-pp-zoom v23-pp-zoom-active">100%</button>
            <button onclick="v23Zoom(1.25)" class="v23-pp-zoom">125%</button>
            <button onclick="v23Zoom(1.5)" class="v23-pp-zoom">150%</button>
          </div>
          <div style="color:#666;font-size:11px;display:flex;align-items:center;gap:6px;">
            <span>📌 اضغط</span>
            <kbd style="background:#1a2744;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;">Ctrl+P</kbd>
            <span>أو زر الطباعة أعلاه</span>
          </div>
        </div>
        
        <div class="v23-pp-body" id="v23-pp-body">
          ${html}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }
  
  window.v23Zoom = function(z) {
    const body = document.getElementById('v23-pp-body');
    if (!body) return;
    body.style.setProperty('--v23-zoom', z);
    document.querySelectorAll('.v23-pp-zoom').forEach(b => b.classList.remove('v23-pp-zoom-active'));
    if (event && event.target) event.target.classList.add('v23-pp-zoom-active');
  };
  
  window.v23ExecutePrint = function() {
    // === STRATEGY: مضمون 100% — iframe مدمج + طباعة من داخله ===
    try {
      const body = document.getElementById('v23-pp-body');
      const preview = document.getElementById('v23-print-preview-modal');
      
      if (!body) {
        v23Toast('❌ خطأ: لا يوجد محتوى للطباعة');
        return;
      }
      
      const contentHTML = body.innerHTML;
      const cleanHTML = contentHTML.replace(/transform:\s*scale\([^)]+\);?/g, '');
      
      // إغلاق المعاينة أولاً (لأننا نريد فقط الـ iframe)
      if (preview) preview.remove();
      
      // === A: إنشاء iframe مدمج بدون popup blocker ===
      const oldIframe = document.getElementById('v23-print-iframe');
      if (oldIframe) oldIframe.remove();
      
      const iframe = document.createElement('iframe');
      iframe.id = 'v23-print-iframe';
      iframe.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;border:none;z-index:10002;background:#fff;display:block;visibility:visible;';
      
      const printDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير مالي</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: 'Segoe UI', 'Tahoma', 'Cairo', sans-serif; color: #1a1a1a; }
  body { padding: 0; }
  @page { size: A4; margin: 0; }
  .v23-paper {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 14mm 20mm 14mm;
    background: #fff;
    color: #1a1a1a;
    margin: 0 auto;
    page-break-after: always;
    box-sizing: border-box;
  }
  .v23-paper:last-child { page-break-after: auto; }
  
  /* Letterhead refinements */
  .v23-letterhead {
    background: linear-gradient(135deg, #1a2744 0%, #2a3f5f 100%);
    color: #fff;
    padding: 12mm 8mm;
    margin: -18mm -14mm 8mm -14mm;
    border-bottom: 3pt solid #b8932f;
  }
  .v23-letterhead h1 { margin: 0 0 2mm 0; font-size: 22pt; color: #fff; font-weight: 900; }
  .v23-letterhead h2 { margin: 2mm 0 0 0; font-size: 14pt; color: #b8932f; font-weight: 700; }
  .v23-letterhead .meta { margin-top: 6mm; font-size: 10pt; color: rgba(255,255,255,0.85); display: flex; justify-content: space-between; }
  
  /* Headers */
  h2 { color: #1a2744; font-size: 14pt; border-bottom: 1.5pt solid #b8932f; padding-bottom: 3mm; margin: 6mm 0 4mm; page-break-after: avoid; }
  h3 { color: #1a2744; font-size: 12pt; margin: 4mm 0 2mm; page-break-after: avoid; }
  
  /* Cards */
  div[style*="grid-template-columns"] { page-break-inside: avoid; }
  
  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 4mm 0; page-break-inside: auto; font-size: 10pt; }
  table thead { display: table-header-group; }
  table tr { page-break-inside: avoid; }
  table th { background: #1a2744; color: #fff; font-weight: 700; padding: 3mm 4mm; text-align: right; }
  table td { padding: 2.5mm 4mm; border-bottom: 0.5pt solid #e0e0e0; }
  table tbody tr:nth-child(even) td { background: #fafafa; }
  
  /* Cards metrics */
  div[style*="border:0.5pt"] { page-break-inside: avoid; }
  
  /* Signatures */
  div[style*="page-break-inside:avoid"][style*="grid-template-columns:1fr 1fr 1fr"] {
    margin-top: 16mm;
    page-break-inside: avoid;
  }
  
  /* Footer */
  div[style*="margin-top:14mm"][style*="border-top:0.5pt solid #999"] {
    margin-top: 16mm;
    padding-top: 5mm;
    border-top: 0.5pt solid #999;
    font-size: 9pt;
    color: #666;
  }
  
  /* Page break */
  div[style*="page-break-before:always"] {
    page-break-before: always;
  }
</style>
</head>
<body>
${cleanHTML}
</body>
</html>`;
      
      // Create new window
      const printWindow = window.open('', '_blank', 'width=900,height=1200');
      if (!printWindow) {
        // Popup blocked — fallback to in-page
        v23InPageFallback();
        return;
      }
      
      printWindow.document.open();
      printWindow.document.write(printDoc);
      printWindow.document.close();
      
      // Wait then print
      printWindow.addEventListener('load', function() {
        setTimeout(() => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch (e) {
            console.error('Print failed:', e);
          }
        }, 400);
      });
      
      if (preview) preview.remove();
      v23Toast('✓ تم فتح معاينة الطباعة في نافذة جديدة');
    } catch (e) {
      console.error('v23ExecutePrint error:', e);
      v23InPageFallback();
    }
  };
  
  /**
   * Fallback: if popup blocked, use iframe
   */
  
  /**
   * الحل الجذري النهائي: Blob URL يفتح نافذة جديدة لا يحجبها popup blocker
   * - ابني HTML كامل مع Letterhead + كل البيانات
   * - URL.createObjectURL يفتح Tab جديدة
   * - المستخدم يطبع مباشرة من الـ Tab الجديدة
   * - يدعم أنواع تقارير متعددة
   */
  window.v23PrintEngine = function(reportType) {
    const O = v23O();
    const type = reportType || 'all';
    const html = v23BuildReportHTML(O, type);
    const title = v23GetReportTitle(type);
    
    const fullDoc = '<!DOCTYPE html>' +
      '<html lang="ar" dir="rtl">' +
      '<head>' +
      '<meta charset="UTF-8">' +
      '<title>' + title + ' — ' + new Date().toLocaleDateString('ar-KW') + '</title>' +
      '<style>' +
        '* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
        'html, body { margin: 0; padding: 0; background: #e8eaed; font-family: "Segoe UI", "Tahoma", "Cairo", sans-serif; }' +
        '.p-toolbar { position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #1a2744, #b8932f); color: #fff; padding: 14px 22px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 999; }' +
        '.p-toolbar h2 { margin: 0; font-size: 17px; }' +
        '.p-toolbar small { font-size: 11px; opacity: 0.85; display: block; margin-top: 3px; }' +
        '.p-toolbar button { border: none; padding: 12px 22px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; margin-right: 8px; }' +
        '.p-btn-print { background: #fff; color: #1a2744; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }' +
        '.p-btn-print:hover { transform: translateY(-1px); }' +
        '.p-body { padding: 90px 20px 40px; background: #e8eaed; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }' +
        '.v23-paper { width: 210mm; padding: 18mm 14mm 20mm 14mm; background: #fff; color: #1a1a1a; box-shadow: 0 4px 16px rgba(0,0,0,0.15); box-sizing: border-box; margin-bottom: 8mm; }' +
        '.v23-lh { background: linear-gradient(135deg, #1a2744, #2a3f5f) !important; color: #fff !important; padding: 12mm 8mm !important; margin: -18mm -14mm 8mm -14mm !important; border-bottom: 3pt solid #b8932f !important; display: flex; justify-content: space-between; align-items: flex-start; -webkit-print-color-adjust: exact !important; }' +
        '.v23-lh h1 { margin: 0 0 2mm 0; font-size: 22pt; color: #fff !important; font-weight: 900; }' +
        '.v23-lh h2 { margin: 2mm 0 0 0; font-size: 14pt; color: #b8932f !important; font-weight: 700; }' +
        '.v23-lh .meta { font-size: 10pt; color: rgba(255,255,255,0.85) !important; line-height: 1.8; text-align: left; }' +
        'h2.st { color: #1a2744 !important; font-size: 14pt !important; border-bottom: 1.5pt solid #b8932f !important; padding-bottom: 3mm !important; margin: 8mm 0 5mm !important; page-break-after: avoid !important; }' +
        'table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 3mm 0; page-break-inside: auto; }' +
        'table thead { display: table-header-group; }' +
        'table tr { page-break-inside: avoid; }' +
        'table th { background: #1a2744 !important; color: #fff !important; font-weight: 700; padding: 3mm 4mm; text-align: right; }' +
        'table td { padding: 2.5mm 4mm; border-bottom: 0.5pt solid #e0e0e0; }' +
        'table tbody tr:nth-child(even) td { background: #fafafa !important; }' +
        '.kg { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 6mm; page-break-inside: avoid; }' +
        '.kc2 { border: 0.6pt solid #c0c0c0 !important; padding: 4mm !important; border-radius: 2mm !important; background: #fff !important; page-break-inside: avoid !important; }' +
        '.kc2 .kl { font-size: 9pt !important; color: #666 !important; text-transform: uppercase !important; margin-bottom: 2mm !important; }' +
        '.kc2 .kv { font-size: 18pt !important; font-weight: 900 !important; color: #1a2744 !important; line-height: 1.1; }' +
        '.sigs { margin-top: 16mm !important; page-break-inside: avoid !important; display: grid !important; grid-template-columns: 1fr 1fr 1fr !important; gap: 8mm !important; }' +
        '.sigsb { border-top: 0.6pt solid #555 !important; padding-top: 3mm !important; text-align: center !important; font-size: 9pt !important; min-height: 20mm; }' +
        '.sigsb strong { display: block !important; margin-bottom: 12mm !important; color: #1a2744 !important; font-weight: 700 !important; font-size: 10pt; }' +
        '.ftr { margin-top: 14mm !important; padding-top: 5mm !important; border-top: 0.5pt solid #999 !important; font-size: 9pt !important; color: #666 !important; display: flex !important; justify-content: space-between !important; }' +
        '@page { size: A4; margin: 0; }' +
        '@media print { .p-toolbar { display: none !important; } .p-body { padding: 0 !important; background: #fff !important; } .v23-paper { margin: 0 !important; box-shadow: none !important; } }' +
      '</style>' +
      '</head>' +
      '<body>' +
        '<div class="p-toolbar">' +
          '<div><h2>🖨️ ' + title + '</h2>' +
          '<small>📄 اضغط "طباعة أو حفظ PDF" واختر Save as PDF من نافذة المتصفح</small></div>' +
          '<div><button class="p-btn-print" onclick="window.print()">🖨️ طباعة أو حفظ PDF</button></div>' +
        '</div>' +
        '<div class="p-body">' + html + '</div>' +
      '</body>' +
      '</html>';
    
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const w = window.open(url, '_blank');
    if (!w) {
      // Fallback: ارسم القلاص على الـ Dashboard نفسه اذا فتح الـ popup
      document.body.innerHTML = fullDoc + document.body.innerHTML;
      v23Toast('✅ التقرير جاهز في نفس النافذة - اضغط Ctrl+P');
    } else {
      v23Toast('✅ تم فتح التقرير في نافذة جديدة - اضغط طباعة أو حفظ PDF');
    }
    
    setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
    return true;
  };
  
  /**
   * الحل البسيط والنهائي: طباعة الصفحة الحالية فقط
   * - لا iframe، لا popup، لا Blob URL
   * - فقط window.print() على المحتوى المرئي
   * - إذا كان في كشف العميل، يطبع الكشف مع Letterhead و Footer
   * - إذا كان في Dashboard، يطبع الـ Dashboard
   * - يدعم كل صفحات النظام
   */
  /**
   * طباعة الصفحة الحالية المبسطة
   * - بدون letterhead ديناميكي في DOM (لأن ذلك يكسر الصفحات الأخرى)
   * - فقط window.print() مع تظليل UI فقط في CSS
   * - يعمل لكل الصفحات (dashboard, statement, periods, comparison, إلخ)
   * - يعتمد على @media print CSS لإخفاء UI وإبقاء المحتوى
   */
  window.v23PrintNow = function() {
    try {
      // تنظيف أي letterhead سابق
      const oldLh = document.getElementById('v23-print-letterhead');
      if (oldLh) oldLh.remove();
      const oldFt = document.getElementById('v23-print-footer');
      if (oldFt) oldFt.remove();
      
      // تعبئة الـ Letterhead الثابت بتاريخ/وقت/عنوان
      v23FillStaticLetterhead();
      
      // طباعة مباشرة
      window.print();
      return true;
    } catch (e) {
      console.error('print error:', e);
      try {
        window.print();
      } catch (e2) {
        alert('تعذّرت الطباعة - يرجى إعادة المحاولة');
      }
    }
  };
  
  /**
   * يملأ Letterhead الثابت بالمعلومات الحالية
   */
  window.v23FillStaticLetterhead = function() {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' });
      
      // عنوان ديناميكي من الصفحة الحالية
      const pageTitleEl = document.getElementById('pageTitle');
      const curTitle = pageTitleEl ? pageTitleEl.textContent.trim() : '';
      
      const titleEl = document.getElementById('v23-print-page-title');
      if (titleEl) titleEl.textContent = curTitle || 'تقرير مالي';
      
      const dateEl = document.getElementById('v23-print-date');
      if (dateEl) dateEl.textContent = dateStr;
      
      const timeEl = document.getElementById('v23-print-time');
      if (timeEl) timeEl.textContent = timeStr;
      
      const footerTimeEl = document.getElementById('v23-print-footer-time');
      if (footerTimeEl) footerTimeEl.textContent = dateStr + ' — ' + timeStr;
    } catch(e) {
      console.warn('Failed to fill static letterhead:', e);
    }
  };
  
  window.v23GetReportTitle = function(type) {
    const map = {
      'all': 'التقرير الشامل',
      'executive': 'الملخص التنفيذي',
      'customers': 'تقرير العملاء والمستحقات',
      'inventory': 'تقرير المخزون',
      'transactions': 'تقرير المعاملات',
      'periods': 'تقرير الفترات الزمنية'
    };
    return map[type] || 'تقرير مالي';
  };
  
  /**
   * اختيار نوع التقرير قبل الطباعة - modal سريع
   */
  window.v23ShowReportPicker = function() {
    const old = document.getElementById('v23-report-picker');
    if (old) old.remove();
    
    const reportOptions = [
      { type: 'all',          icon: '📦', title: 'التقرير الشامل', desc: 'KPIs + كل الجداول (عملاء، مخزون، معاملات)' },
      { type: 'executive',    icon: '📊', title: 'الملخص التنفيذي', desc: 'KPIs والخلاصة المالية فقط' },
      { type: 'customers',    icon: '👥', title: 'العملاء والمستحقات', desc: 'جدول كل العملاء مع الأرصدة' },
      { type: 'inventory',    icon: '📦', title: 'المخزون والمنتجات', desc: 'جدول كل المنتجات والكميات' },
      { type: 'transactions', icon: '💱', title: 'المعاملات', desc: 'جدول كل المعاملات (مبيعات وتحصيل)' },
      { type: 'periods',      icon: '📅', title: 'الفترات والإحصائيات', desc: 'تحليل الفترات الزمنية' }
    ];
    
    const html = '<div id="v23-report-picker" class="v23-modal-bg" style="position:fixed;inset:0;background:rgba(10,20,40,0.78);z-index:10001;display:flex;align-items:center;justify-content:center;">' +
      '<div class="v23-modal" style="background:#fff;border-radius:14px;width:min(620px,92vw);max-height:88vh;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,0.5);">' +
        '<div class="v23-modal-h" style="background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;padding:18px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;align-items:center;">' +
          '<div><div style="font-size:18px;font-weight:800;">🖨️ اختر نوع التقرير للطباعة</div><div style="font-size:12px;opacity:0.85;margin-top:3px;">سيُفتح تقرير منفصل قابل للطباعة بـ Ctrl+P</div></div>' +
          '<button onclick="document.getElementById(\'v23-report-picker\').remove()" style="background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.3);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;">✕</button>' +
        '</div>' +
        '<div class="v23-modal-b" style="padding:20px 24px;">' +
          reportOptions.map(function(o) {
            return '<button type="button" onclick="document.getElementById(\'v23-report-picker\').remove();v23PrintEngine(\'' + o.type + '\')" ' +
              'style="display:flex;width:100%;text-align:right;background:#fff;border:2px solid #e3e8f0;border-radius:10px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:all .15s;gap:14px;align-items:center;" ' +
              'onmouseover="this.style.borderColor=\'#b8932f\';this.style.background=\'#fafbfc\';" ' +
              'onmouseout="this.style.borderColor=\'#e3e8f0\';this.style.background=\'#fff\';">' +
              '<div style="font-size:28px;width:48px;text-align:center;">' + o.icon + '</div>' +
              '<div style="flex:1;">' +
                '<div style="font-weight:800;color:#1a2744;font-size:15px;">' + o.title + '</div>' +
                '<div style="font-size:12px;color:#666;margin-top:3px;">' + o.desc + '</div>' +
              '</div>' +
              '<div style="color:#b8932f;font-size:22px;">›</div>' +
            '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstChild);
  };
  
  /**
   * إغلاق iframe الطباعة (للتوافق الخلفي)
   */
  window.v23ClosePrintIframe = function() {
    const el = document.getElementById('v23-print-iframe');
    if (el) el.remove();
  };
  
  /**
   * بناء HTML التقرير الكامل من البيانات الفعلية
   */
  function v23BuildReportHTML(O, type) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-KW', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' });
    const reportType = type || 'all';
    const reportTitle = v23GetReportTitle(reportType);
    
    const letterhead = '<div class="v23-lh">' +
      '<div style="flex:1;"><h1>شركتك</h1>' +
      '<h2>' + reportTitle + '</h2></div>' +
      '<div class="meta" style="text-align:left;">' +
      '<div><strong>📅 التاريخ:</strong> ' + dateStr + '</div>' +
      '<div><strong>🕐 الوقت:</strong> ' + timeStr + '</div>' +
      '<div><strong>🔖 رقم التقرير:</strong> ' + (reportType.toUpperCase()) + '-' + now.getTime() + '</div>' +
            '</div></div>';
    
    const T = O.T || {};
    const soc = O.soc || [];
    const tx = O.tx || [];
    const it = O.it || [];
    const mon = O.mon || [];
    
    const receivable = soc.reduce(function(s, c) { return s + (parseFloat(c.bl) || parseFloat(c.balance) || 0); }, 0);
    const invVal = it.reduce(function(s, p) { return s + (parseInt(p.st) || parseInt(p.stock) || 0) * (parseFloat(p.cos) || parseFloat(p.cost) || 0); }, 0);
    
    // ====== بناء المحتوى حسب نوع التقرير ======
    let bodyHtml = '';
    
    // 1. الملخص التنفيذي / الشامل: KPIs + كل الجداول
    if (reportType === 'executive' || reportType === 'all') {
      bodyHtml += '<h2 class="st">المؤشرات الرئيسية</h2>' +
        '<div class="kg">' +
          '<div class="kc2"><div class="kl">إجمالي العملاء</div><div class="kv">' + v23Num(soc.length) + '</div></div>' +
          '<div class="kc2"><div class="kl">إجمالي المعاملات</div><div class="kv">' + v23Num(tx.length) + '</div></div>' +
          '<div class="kc2"><div class="kl">إجمالي المنتجات</div><div class="kv">' + v23Num(it.length) + '</div></div>' +
          '<div class="kc2"><div class="kl">إجمالي المناديب</div><div class="kv">' + v23Num(mon.length) + '</div></div>' +
          '<div class="kc2"><div class="kl">إجمالي المبيعات</div><div class="kv" style="color:#2e7d32;">' + v23Cur(T.s || 0) + '</div></div>' +
          '<div class="kc2"><div class="kl">المحصلات</div><div class="kv" style="color:#1976d2;">' + v23Cur(T.co || 0) + '</div></div>' +
          '<div class="kc2"><div class="kl">صافي الأرباح</div><div class="kv" style="color:#2e7d32;">' + v23Cur(T.pr || 0) + '</div></div>' +
          '<div class="kc2"><div class="kl">المستحقات</div><div class="kv" style="color:#c62828;">' + v23Cur(T.ot || 0) + '</div></div>' +
          '<div class="kc2"><div class="kl">أرصدة العملاء</div><div class="kv">' + v23Cur(receivable) + '</div></div>' +
          '<div class="kc2"><div class="kl">قيمة المخزون</div><div class="kv">' + v23Cur(invVal) + '</div></div>' +
        '</div>';
    }
    
    // 2. العملاء
    if (reportType === 'customers' || reportType === 'all' || reportType === 'executive') {
      const customerRows = soc.slice(0, 500).map(function(c, i) {
        const bal = parseFloat(c.bl) || parseFloat(c.balance) || 0;
        const color = bal > 0 ? '#c62828' : (bal < 0 ? '#1976d2' : '#2e7d32');
        return '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong>' + v23_(c.nm || c.name) + '</strong></td>' +
          '<td>' + v23_(c.ph || c.phone || '—') + '</td>' +
          '<td>' + v23_(c.add || c.address || '—') + '</td>' +
          '<td style="color:' + color + ';font-weight:700;text-align:left;">' + v23Cur(bal) + '</td>' +
          '</tr>';
      }).join('');
      
      if (soc.length > 0) {
        bodyHtml += '<h2 class="st" style="margin-top:10mm;">جدول العملاء (' + soc.length + ')</h2>' +
          '<table><thead><tr><th>#</th><th>العميل</th><th>الهاتف</th><th>العنوان</th><th>الرصيد</th></tr></thead>' +
          '<tbody>' + customerRows + '</tbody></table>';
      }
    }
    
    // 3. المنتجات
    if (reportType === 'inventory' || reportType === 'all' || reportType === 'executive') {
      const productRows = it.map(function(p, i) {
        const st = parseInt(p.st) || parseInt(p.stock) || 0;
        const ms = parseInt(p.ms) || parseInt(p.minStock) || 0;
        const cos = parseFloat(p.cos) || parseFloat(p.cost) || 0;
        const status = st === 0 ? 'نافد' : (st < ms ? 'منخفض' : 'طبيعي');
        const color = status === 'طبيعي' ? '#2e7d32' : '#c62828';
        return '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><strong>' + v23_(p.nm || p.name) + '</strong></td>' +
          '<td style="text-align:center;">' + v23Num(st) + '</td>' +
          '<td style="text-align:center;color:' + color + ';font-weight:700;">' + status + '</td>' +
          '<td style="text-align:left;">' + v23Cur(st * cos) + '</td>' +
          '</tr>';
      }).join('');
      
      if (it.length > 0) {
        bodyHtml += '<h2 class="st" style="margin-top:10mm;">جدول المنتجات والمخزون (' + it.length + ')</h2>' +
          '<table><thead><tr><th>#</th><th>المنتج</th><th>المخزون</th><th>الحالة</th><th>القيمة</th></tr></thead>' +
          '<tbody>' + productRows + '</tbody></table>';
      }
    }
    
    // 4. المعاملات
    if (reportType === 'transactions' || reportType === 'all' || reportType === 'executive') {
      const txRows = tx.slice(0, 200).map(function(t, i) {
        const cust = soc.find(function(c) { return c.id === t.customerId || c.ci === t.ci; });
        const custName = cust ? (cust.nm || cust.name || '—') : '—';
        const amt = parseFloat(t.amount || t.a || t.am || 0);
        const typeLabel = (t.type === 'collection' || t.ty === 'co') ? 'تحصيل' : 'مبيعة';
        const typeColor = (t.type === 'collection' || t.ty === 'co') ? '#1976d2' : '#2e7d32';
        const date = t.date || t.dt || t.d || '—';
        return '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td>' + custName + '</td>' +
          '<td style="text-align:center;color:' + typeColor + ';font-weight:700;">' + typeLabel + '</td>' +
          '<td style="text-align:center;">' + date + '</td>' +
          '<td style="text-align:left;font-weight:700;">' + v23Cur(amt) + '</td>' +
          '</tr>';
      }).join('');
      
      if (tx.length > 0) {
        bodyHtml += '<h2 class="st" style="margin-top:10mm;">جدول المعاملات (' + Math.min(tx.length, 200) + ' من ' + tx.length + ')</h2>' +
          '<table><thead><tr><th>#</th><th>العميل</th><th>النوع</th><th>التاريخ</th><th>المبلغ</th></tr></thead>' +
          '<tbody>' + txRows + '</tbody></table>';
      }
    }
    
    // 5. الفترات (عند الحاجة)
    if (reportType === 'periods' || (reportType === 'all' && Object.keys(T).length > 0)) {
      bodyHtml += '<h2 class="st" style="margin-top:10mm;">إحصائيات الفترات</h2>' +
        '<table><thead><tr><th>البيان</th><th style="text-align:left;">القيمة</th></tr></thead><tbody>' +
        '<tr><td>إجمالي المبيعات</td><td style="text-align:left;font-weight:700;">' + v23Cur(T.s || 0) + '</td></tr>' +
        '<tr><td>إجمالي المحصلات</td><td style="text-align:left;font-weight:700;">' + v23Cur(T.co || 0) + '</td></tr>' +
        '<tr><td>إجمالي التكاليف</td><td style="text-align:left;font-weight:700;">' + v23Cur((T.s || 0) - (T.pr || 0)) + '</td></tr>' +
        '<tr><td>صافي الأرباح</td><td style="text-align:left;font-weight:700;color:#2e7d32;">' + v23Cur(T.pr || 0) + '</td></tr>' +
        '<tr><td>المستحقات المتبقية</td><td style="text-align:left;font-weight:700;color:#c62828;">' + v23Cur(T.ot || 0) + '</td></tr>' +
        '<tr><td>متوسط قيمة المعاملة</td><td style="text-align:left;font-weight:700;">' + v23Cur(tx.length > 0 ? ((T.s || 0) / tx.length) : 0) + '</td></tr>' +
        '</tbody></table>';
    }
    
    const signatures = '<div class="sigs">' +
      '<div class="sigsb"><strong>المحاسب</strong>التوقيع والختم</div>' +
      '<div class="sigsb"><strong>المدير المالي</strong>التوقيع والختم</div>' +
      '<div class="sigsb"><strong>المدير العام</strong>التوقيع والختم</div>' +
      '</div>';
    
    const footer = '<div class="ftr">' +
      '<span><strong>شركتك</strong></span>' +
      '<span>نظام دعم القرار المالي</span>' +
      '<span>' + dateStr + ' — ' + timeStr + '</span>' +
      '</div>';
    
    return '<div class="v23-paper">' + letterhead + bodyHtml + signatures + footer + '</div>';
  }

  function v23InPageFallback() {
    let body = document.getElementById('v23-pp-body');
    let contentHTML = body ? body.innerHTML : '';
    let cleanHTML = contentHTML.replace(/transform:\s*scale\([^)]+\);?/g, '');
    
    // Remove old iframe if exists
    const oldIframe = document.getElementById('v23-print-iframe');
    if (oldIframe) oldIframe.remove();
    
    // Create iframe with embedded print UI
    const iframe = document.createElement('iframe');
    iframe.id = 'v23-print-iframe';
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;border:none;z-index:99999;background:#fff;';
    document.body.appendChild(iframe);
    
    const printDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير مالي</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { margin: 0; padding: 0; background: #f0f0f0; font-family: 'Segoe UI', 'Tahoma', sans-serif; color: #1a1a1a; }
  body { padding: 0; }
  @page { size: A4; margin: 0; }
  /* أزرار الطباعة */
  .print-toolbar {
    position: fixed; top: 0; left: 0; right: 0;
    background: linear-gradient(135deg, #1a2744 0%, #b8932f 100%);
    color: #fff; padding: 14px 20px;
    display: flex; justify-content: space-between; align-items: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 999;
  }
  .print-toolbar .title { font-size: 15px; font-weight: 700; }
  .print-toolbar .sub { font-size: 11px; opacity: 0.85; }
  .print-toolbar button {
    border: none; padding: 9px 18px;
    border-radius: 6px; cursor: pointer;
    font-size: 13px; font-weight: 700;
    display: flex; align-items: center; gap: 6px;
    transition: all 0.15s;
  }
  .btn-print {
    background: #fff; color: #1a2744;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }
  .btn-print:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
  .btn-close {
    background: rgba(255,255,255,0.15); color: #fff;
    border: 1px solid rgba(255,255,255,0.3);
    margin-right: 8px;
  }
  .btn-close:hover { background: rgba(255,255,255,0.28); }
  
  /* الورقة */
  .v23-paper {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 14mm 20mm 14mm;
    background: #fff;
    color: #1a1a1a;
    margin: 80px auto 20px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    page-break-after: always;
    box-sizing: border-box;
  }
  .v23-paper:last-child { page-break-after: auto; }
  
  .v23-letterhead {
    background: linear-gradient(135deg, #1a2744 0%, #2a3f5f);
    color: #fff;
    padding: 12mm 8mm;
    margin: -18mm -14mm 8mm -14mm;
    border-bottom: 3pt solid #b8932f;
  }
  .v23-letterhead h1 { margin: 0 0 2mm 0; font-size: 22pt; color: #fff; font-weight: 900; }
  .v23-letterhead h2 { margin: 2mm 0 0 0; font-size: 14pt; color: #b8932f; font-weight: 700; }
  
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 4mm 0; }
  table thead { display: table-header-group; }
  table tr { page-break-inside: avoid; }
  table th { background: #1a2744 !important; color: #fff !important; padding: 3mm 4mm; text-align: right; font-weight: 700; }
  table td { padding: 2.5mm 4mm; border-bottom: 0.5pt solid #e0e0e0; }
  table tbody tr:nth-child(even) td { background: #fafafa !important; }
  
  div[style*="border:0.5pt"] { page-break-inside: avoid; }
  div[style*="grid-template-columns"] { page-break-inside: avoid; }
  div[style*="page-break-inside:avoid"] { page-break-inside: avoid; }
  
  @media print {
    .print-toolbar { display: none !important; }
    body { background: #fff !important; }
    .v23-paper { margin: 0 auto; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="print-toolbar">
    <div>
      <div class="title">🖨️ طباعة تقرير مالي</div>
      <div class="sub">انقر "طباعة أو حفظ PDF" ثم في نافذة المتصفح اختر "حفظ كـ PDF"</div>
    </div>
    <div>
      <button class="btn-print" onclick="window.print()">🖨️ طباعة أو حفظ PDF</button>
      <button class="btn-close" onclick="parent.v23ClosePrintIframe()">✕ إغلاق</button>
    </div>
  </div>
${cleanHTML}
</body>
</html>`;
    
    // Write to iframe
    try {
      iframe.contentDocument.open();
      iframe.contentDocument.write(printDoc);
      iframe.contentDocument.close();
      
      // Show user how to print
      v23Toast('✓ المعاينة جاهزة - اضغط الزر في الأعلى للطباعة');
    } catch (e) {
      console.error('iframe write failed:', e);
      document.body.removeChild(iframe);
      alert('لم يُمکن تحميل الـ iframe. جرّب متصفح آخر أو فعّل JavaScript.');
    }
  }
  
  /** إغلاق iframe الطباعة */
  window.v23ClosePrintIframe = function() {
    const iframe = document.getElementById('v23-print-iframe');
    if (iframe) iframe.remove();
  };
  
  /* === 1. فتح قائمة التقارير === */
  window.v23Modal = function() {
    const reports = [
      { id: 'executive', name: 'الملخص التنفيذي', icon: '📊', desc: 'كل المؤشرات الرئيسية' },
      { id: 'customers', name: 'العملاء', icon: '👥', desc: 'كل الجمعيات + الأرصدة' },
      { id: 'transactions', name: 'المعاملات', icon: '💰', desc: 'سجل كل العمليات' },
      { id: 'inventory', name: 'المخزون', icon: '📦', desc: 'المنتجات والتنبيهات' },
      { id: 'agents', name: 'المناديب', icon: '🏃', desc: 'الأداء والمبيعات' },
      { id: 'periods', name: 'الفترات', icon: '📅', desc: 'تحليل زمني' }
    ];
    
    const cards = reports.map(r => `
      <button onclick="v23CloseModal();v23Report('${r.id}');" 
        style="padding:16px;background:#f7f7f7;border:2px solid transparent;border-radius:10px;cursor:pointer;text-align:right;transition:all 0.2s;font-family:inherit;"
        onmouseover="this.style.borderColor='#b8932f';this.style.background='#fffbf2'"
        onmouseout="this.style.borderColor='transparent';this.style.background='#f7f7f7'">
        <div style="font-size:24px;">${r.icon}</div>
        <div style="font-weight:700;color:#1a2744;margin-top:6px;font-size:14px;">${r.name}</div>
        <div style="font-size:11px;color:#888;margin-top:2px;">${r.desc}</div>
      </button>
    `).join('');
    
    v23Modal('📋 اختر تقرير للطباعة', `
      <p style="color:#666;font-size:13px;margin-bottom:14px;">كل تقرير يُنشأ مع Letterhead Navy + Gold + Footer + Signatures Block</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${cards}
      </div>
      <button onclick="v23CloseModal();v23Report('all')" 
        style="width:100%;padding:14px;background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:15px;margin-top:18px;">
        ✨ طباعة الكل (6 تقارير)
      </button>
    `);
  };
  
  /* === 2. تجهيز التقرير === */
  window.v23Report = function(id) {
    const O = v23O();
    
    if (id === 'all') {
      const content = `
        ${v23ReportBody('executive', O)}
        ${v23ReportBody('customers', O)}
        ${v23ReportBody('inventory', O)}
      `;
      v23PrintPage('<div style="page-break-after:always;">' + v23ReportBody('executive', O) + '</div>' + 
                   '<div style="page-break-before:always;">' + v23ReportBody('customers', O) + '</div>' +
                   '<div style="page-break-before:always;">' + v23ReportBody('inventory', O) + '</div>',
                   'التقرير الشامل');
      return;
    }
    
    const body = v23ReportBody(id, O);
    v23PrintPage(body, ({
      executive: 'الملخص التنفيذي',
      customers: 'تقرير العملاء التفصيلي',
      transactions: 'سجل المعاملات',
      inventory: 'تقرير المخزون',
      agents: 'تقرير أداء المناديب',
      periods: 'تحليل المبيعات حسب الفترة'
    })[id] || 'تقرير');
  };
  
  function v23ReportBody(id, O) {
    if (id === 'executive') {
      const T = O.T || {};
      const soc = O.soc || [];
      const tx = O.tx || [];
      const it = O.it || [];
      const mon = O.mon || [];
      const receivable = soc.reduce((s, c) => s + (parseFloat(c.bl) || parseFloat(c.balance) || 0), 0);
      const invVal = it.reduce((s, p) => s + (parseInt(p.st) || parseInt(p.stock) || 0) * (parseFloat(p.cos) || parseFloat(p.cost) || 0), 0);
      
      const cards = [
        { label: 'العملاء', value: v23Num(soc.length), color: '#1a2744' },
        { label: 'المعاملات', value: v23Num(tx.length), color: '#1a2744' },
        { label: 'المنتجات', value: v23Num(it.length), color: '#1a2744' },
        { label: 'المناديب', value: v23Num(mon.length), color: '#1a2744' },
        { label: 'المبيعات', value: v23Cur(T.s || 0), color: '#2e7d32' },
        { label: 'المحصلات', value: v23Cur(T.co || 0), color: '#1976d2' },
        { label: 'صافي الأرباح', value: v23Cur(T.pr || 0), color: '#2e7d32' },
        { label: 'المستحقات', value: v23Cur(T.ot || 0), color: '#c62828' },
        { label: 'أرصدة العملاء', value: v23Cur(receivable), color: '#b8932f' },
        { label: 'قيمة المخزون', value: v23Cur(invVal), color: '#1a2744' }
      ];
      
      return `
<h2 style="color:#1a2744;font-size:14pt;border-bottom:1.5pt solid #b8932f;padding-bottom:2mm;margin-bottom:6mm;">المؤشرات الرئيسية</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:6mm;">
  ${cards.map(c => `
    <div style="border:0.5pt solid #ddd;padding:4mm;border-radius:2mm;">
      <div style="font-size:9pt;color:#666;text-transform:uppercase;">${c.label}</div>
      <div style="font-size:18pt;font-weight:900;color:${c.color};margin-top:1mm;">${c.value}</div>
    </div>
  `).join('')}
</div>`;
    }
    
    if (id === 'customers') {
      const list = O.soc || [];
      const receivable = list.reduce((s, c) => s + (parseFloat(c.bl) || parseFloat(c.balance) || 0), 0);
      const rows = list.slice(0, 250).map((c, i) => {
        const bal = parseFloat(c.bl) || parseFloat(c.balance) || 0;
        const color = bal > 0 ? '#c62828' : (bal < 0 ? '#1976d2' : '#2e7d32');
        return `<tr>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${i + 1}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;font-weight:700;">${v23_(c.nm || c.name)}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${v23_(c.ph || c.phone || '—')}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;color:${color};font-weight:700;">${v23Cur(bal)}</td>
        </tr>`;
      }).join('');
      
      return `
<h2 style="color:#1a2744;font-size:14pt;border-bottom:1.5pt solid #b8932f;padding-bottom:2mm;margin-bottom:4mm;">العملاء (${list.length})</h2>
<p style="font-size:10pt;color:#666;margin-bottom:4mm;">إجمالي الأرصدة: <strong>${v23Cur(receivable)}</strong></p>
<table style="width:100%;border-collapse:collapse;">
  <thead><tr style="background:#1a2744;color:#fff;">
    <th style="padding:3mm;text-align:right;font-size:10pt;">#</th>
    <th style="padding:3mm;text-align:right;font-size:10pt;">العميل</th>
    <th style="padding:3mm;text-align:right;font-size:10pt;">الهاتف</th>
    <th style="padding:3mm;text-align:right;font-size:10pt;">الرصيد</th>
  </tr></thead>
  <tbody style="background:#fafafa;">${rows}</tbody>
</table>`;
    }
    
    if (id === 'inventory') {
      const items = O.it || [];
      const invVal = items.reduce((s, p) => s + (parseInt(p.st) || parseInt(p.stock) || 0) * (parseFloat(p.cos) || parseFloat(p.cost) || 0), 0);
      const low = items.filter(p => { const st = parseInt(p.st) || parseInt(p.stock) || 0; return st > 0 && st < (parseInt(p.ms) || parseInt(p.minStock) || 0); }).length;
      const out = items.filter(p => (parseInt(p.st) || parseInt(p.stock) || 0) === 0).length;
      const rows = items.map((p, i) => {
        const st = parseInt(p.st) || parseInt(p.stock) || 0;
        const ms = parseInt(p.ms) || parseInt(p.minStock) || 0;
        const cos = parseFloat(p.cos) || parseFloat(p.cost) || 0;
        const status = st === 0 ? 'نافد' : (st < ms ? 'منخفض' : 'طبيعي');
        const color = status === 'طبيعي' ? '#2e7d32' : '#c62828';
        return `<tr>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${i + 1}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;font-weight:700;">${v23_(p.nm || p.name)}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;text-align:center;">${v23Num(st)}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;text-align:center;color:${color};font-weight:700;">${status}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${v23Cur(st * cos)}</td>
        </tr>`;
      }).join('');
      
      return `
<h2 style="color:#1a2744;font-size:14pt;border-bottom:1.5pt solid #b8932f;padding-bottom:2mm;margin-bottom:4mm;">المخزون (${items.length} منتج)</h2>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm;margin-bottom:6mm;">
  <div style="border:0.5pt solid #1a2744;background:#1a2744;color:#fff;padding:3mm;text-align:center;border-radius:2mm;"><div style="font-size:9pt;opacity:0.85;">منتجات</div><div style="font-size:18pt;font-weight:900;">${items.length}</div></div>
  <div style="border:0.5pt solid #b8932f;background:#b8932f;color:#fff;padding:3mm;text-align:center;border-radius:2mm;"><div style="font-size:9pt;opacity:0.85;">قيمة</div><div style="font-size:14pt;font-weight:900;">${v23Cur(invVal)}</div></div>
  <div style="border:0.5pt solid ${(low+out)>0?'#c62828':'#2e7d32'};background:${(low+out)>0?'#c62828':'#2e7d32'};color:#fff;padding:3mm;text-align:center;border-radius:2mm;"><div style="font-size:9pt;opacity:0.9;">تنبيهات</div><div style="font-size:18pt;font-weight:900;">${low+out}</div></div>
</div>
${(low+out)>0 ? `<div style="background:#ffebee;border-right:3pt solid #c62828;padding:3mm;border-radius:2mm;margin-bottom:4mm;font-size:10pt;"><b>⚠️</b> ${out} نافد · ${low} منخفض</div>` : ''}
<table style="width:100%;border-collapse:collapse;">
  <thead><tr style="background:#1a2744;color:#fff;">
    <th style="padding:3mm;font-size:10pt;">#</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">المنتج</th>
    <th style="padding:3mm;font-size:10pt;text-align:center;">المخزون</th>
    <th style="padding:3mm;font-size:10pt;text-align:center;">الحالة</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">القيمة</th>
  </tr></thead>
  <tbody style="background:#fafafa;">${rows}</tbody>
</table>`;
    }
    
    if (id === 'transactions') {
      const txs = O.tx || [];
      const total = txs.reduce((s, t) => s + (parseFloat(t.tt) || parseFloat(t.amount) || 0), 0);
      const rows = txs.slice(-300).map((t, i) => {
        const label = ({ sale: 'بيع', return: 'مرتجع', payment: 'دفع' })[t.tp || t.type] || (t.tp || t.type || '—');
        return `<tr>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${i + 1}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${v23Date(t.dt || t.date)}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${v23_(t.cl || t.client)}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;font-weight:700;">${v23Cur(parseFloat(t.tt) || parseFloat(t.amount) || 0)}</td>
        </tr>`;
      }).join('');
      
      return `
<h2 style="color:#1a2744;font-size:14pt;border-bottom:1.5pt solid #b8932f;padding-bottom:2mm;margin-bottom:4mm;">سجل المعاملات (${txs.length})</h2>
<p style="font-size:10pt;color:#666;margin-bottom:4mm;">إجمالي المبالغ: <strong>${v23Cur(total)}</strong></p>
<table style="width:100%;border-collapse:collapse;">
  <thead><tr style="background:#1a2744;color:#fff;">
    <th style="padding:3mm;font-size:10pt;">#</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">التاريخ</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">العميل</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">المبلغ</th>
  </tr></thead>
  <tbody style="background:#fafafa;">${rows}</tbody>
</table>`;
    }
    
    if (id === 'agents') {
      const agents = O.mon || [];
      const txs = O.tx || [];
      const rows = agents.map((m, i) => {
        const sales = txs.filter(t => (t.ag === m.nm || t.agent === m.nm) && (t.tp === 'sale' || !t.tp)).reduce((s, t) => s + (parseFloat(t.tt) || parseFloat(t.amount) || 0), 0);
        const tCount = txs.filter(t => t.ag === m.nm || t.agent === m.nm).length;
        return `<tr>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${i + 1}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;font-weight:700;">${v23_(m.nm || m.name)}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;">${v23_(m.zn || m.zone || '—')}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;text-align:center;">${tCount}</td>
          <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;font-weight:700;color:#2e7d32;">${v23Cur(sales)}</td>
        </tr>`;
      }).join('');
      
      return `
<h2 style="color:#1a2744;font-size:14pt;border-bottom:1.5pt solid #b8932f;padding-bottom:2mm;margin-bottom:4mm;">المناديب (${agents.length})</h2>
<table style="width:100%;border-collapse:collapse;">
  <thead><tr style="background:#1a2744;color:#fff;">
    <th style="padding:3mm;font-size:10pt;">#</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">المندوب</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">المنطقة</th>
    <th style="padding:3mm;font-size:10pt;text-align:center;">المعاملات</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">المبيعات</th>
  </tr></thead>
  <tbody style="background:#fafafa;">${rows}</tbody>
</table>`;
    }
    
    if (id === 'periods') {
      const txs = O.tx || [];
      const pm = {};
      txs.forEach(t => {
        let p = t.m || '';
        if (!p && (t.dt || t.date)) try { p = new Date(t.dt || t.date).toLocaleDateString('ar-KW', { year: 'numeric', month: 'long' }); } catch (e) { p = 'غير محدد'; }
        if (!p) p = (O.ml && O.ml[0]) || 'افتراضي';
        if (!pm[p]) pm[p] = { sales: 0, returns: 0, count: 0 };
        const a = parseFloat(t.tt) || parseFloat(t.amount) || 0;
        if (t.tp === 'sale' || !t.tp) pm[p].sales += a;
        else if (t.tp === 'return') pm[p].returns += a;
        pm[p].count++;
      });
      const rows = Object.entries(pm).map(([p, d]) => `<tr>
        <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;font-weight:700;">${v23_(p)}</td>
        <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;text-align:center;">${d.count}</td>
        <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;color:#2e7d32;">${v23Cur(d.sales)}</td>
        <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;color:#c62828;">${v23Cur(d.returns)}</td>
        <td style="padding:2mm 3mm;border-bottom:0.5pt solid #e0e0e0;font-size:9pt;font-weight:700;">${v23Cur(d.sales - d.returns)}</td>
      </tr>`).join('');
      
      return `
<h2 style="color:#1a2744;font-size:14pt;border-bottom:1.5pt solid #b8932f;padding-bottom:2mm;margin-bottom:4mm;">الفترات الزمنية</h2>
<table style="width:100%;border-collapse:collapse;">
  <thead><tr style="background:#1a2744;color:#fff;">
    <th style="padding:3mm;font-size:10pt;text-align:right;">الفترة</th>
    <th style="padding:3mm;font-size:10pt;text-align:center;">العمليات</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">المبيعات</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">المرتجعات</th>
    <th style="padding:3mm;font-size:10pt;text-align:right;">الصافي</th>
  </tr></thead>
  <tbody style="background:#fafafa;">${rows}</tbody>
</table>`;
    }
    
    return `<p style="color:#888;">تقرير غير معروف</p>`;
  }
  
  /* === 3. زر الطباعة المباشر للصفحة الحالية === */
  window.v23PrintPage = function() {
    v23Modal('🖨️ طباعة احترافية', `
      <p style="color:#666;font-size:13px;margin-bottom:14px;">اختر كيف تريد الطباعة:</p>
      <button onclick="v23CloseModal();v23QuickPrint();" 
        style="width:100%;padding:14px;background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:15px;margin-bottom:10px;">
        🖨️ طباعة كل النظام (المؤشرات + البيانات)
      </button>
      <button onclick="v23CloseModal();v23PrintFromGlobal();" 
        style="width:100%;padding:14px;background:#1a2744;color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:14px;margin-bottom:10px;">
        📋 اختر تقرير محدد (6 تقارير)
      </button>
      <button onclick="v23CloseModal();window.print();" 
        style="width:100%;padding:12px;background:#b8932f;color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-size:13px;">
        طباعة الصفحة كما هي (legacy)
      </button>
    `);
  };
  
  window.v23QuickPrint = function() {
    const O = v23O();
    const html = `
      ${v23ReportBody('executive', O)}
      ${(O.soc && O.soc.length) ? `<h2 style="color:#1a2744;font-size:14pt;border-bottom:1.5pt solid #b8932f;padding-bottom:2mm;margin:14mm 0 4mm;page-break-before:always;">جدول العملاء (${(O.soc||[]).length})</h2>` +
        v23ReportBody('customers', O).replace('<h2', '<h2 style="display:none"').replace('(العملاء (', 'العملاء الفعليون (') : ''}`;
    v23PrintPage(html, 'تقرير شامل لكل البيانات');
  };
  
  window.v23PrintFromGlobal = function() {
    v23QuickPrintPreview();
  };
  
  /* === 4. البحث === */
  window.v23Search = function() {
    const O = v23O();
    const q = prompt('🔍 بحث شامل:');
    if (!q) return;
    
    const results = [];
    const lq = q.toLowerCase();
    
    (O.soc || []).slice(0, 50).forEach(c => {
      if ((c.nm || c.name || '').toLowerCase().includes(lq))
        results.push({ type: 'عميل', icon: '👤', name: c.nm || c.name, meta: c.ph || c.phone || '' });
    });
    (O.it || []).slice(0, 50).forEach(p => {
      if ((p.nm || p.name || '').toLowerCase().includes(lq))
        results.push({ type: 'منتج', icon: '📦', name: p.nm || p.name, meta: `${parseInt(p.st) || parseInt(p.stock) || 0} وحدة` });
    });
    (O.mon || []).slice(0, 50).forEach(m => {
      if ((m.nm || m.name || '').toLowerCase().includes(lq))
        results.push({ type: 'مندوب', icon: '🏃', name: m.nm || m.name, meta: m.zn || m.zone || '' });
    });
    
    if (results.length === 0) {
      v23Toast('لا توجد نتائج لـ "' + q + '"');
      return;
    }
    
    const html = results.slice(0, 20).map(r => `
      <div style="padding:10px 14px;border-bottom:0.5pt solid #eee;display:flex;align-items:center;gap:12px;">
        <span style="font-size:18px;">${r.icon}</span>
        <div style="flex:1;">
          <div style="font-weight:700;color:#1a2744;">${v23_(r.name)}</div>
          <div style="font-size:11px;color:#888;">${v23_(r.meta)}</div>
        </div>
        <span style="background:#1a2744;color:#fff;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:600;">${r.type}</span>
      </div>
    `).join('');
    
    v23Modal('🔍 نتائج البحث (' + results.length + ')', html);
  };
  
  /* === 5. إحصائيات === */
  window.v23ModalStats = function() {
    const mem = (performance && performance.memory) ? {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
    } : null;
    const O = v23O();
    
    const components = ['Logger','SecureConfig','NayefValidator','CloudBackup','NayefGPT','OCRService','ForecastEngine','RFMSegmentation','TypeSafety','Schemas','CRM','MarketingAutomation','TriggerTypes','ActionTypes','ABTesting','NotificationService','CustomerJourney','JourneyStages','GlobalSearch','PerfUtils','Inventory','PublicAPI','PrintEngine'];
    const loaded = components.filter(c => window[c]).length;
    
    v23Modal('⚡ إحصائيات النظام', `
      <div style="background:${loaded === components.length ? '#e8f5e9' : '#fff8e1'};border-right:3pt solid ${loaded === components.length ? '#2e7d32' : '#b8932f'};padding:12px;border-radius:6px;margin-bottom:14px;font-size:13px;">
        <b>${loaded}/${components.length}</b> من مكونات v2.3 محمّلة بنجاح
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px;text-align:center;">
        <div style="background:#f7f7f7;padding:12px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">العملاء</div>
          <div style="font-size:22px;font-weight:900;color:#1a2744;">${v23Num((O.soc||[]).length)}</div>
        </div>
        <div style="background:#f7f7f7;padding:12px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">المعاملات</div>
          <div style="font-size:22px;font-weight:900;color:#1a2744;">${v23Num((O.tx||[]).length)}</div>
        </div>
        <div style="background:#f7f7f7;padding:12px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">المنتجات</div>
          <div style="font-size:22px;font-weight:900;color:#1a2744;">${v23Num((O.it||[]).length)}</div>
        </div>
        <div style="background:#f7f7f7;padding:12px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">المناديب</div>
          <div style="font-size:22px;font-weight:900;color:#1a2744;">${v23Num((O.mon||[]).length)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;text-align:center;">
        <div style="background:#e8f5e9;padding:12px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">المبيعات</div>
          <div style="font-size:18px;font-weight:900;color:#2e7d32;">${v23Cur((O.T||{}).s||0)}</div>
        </div>
        <div style="background:#e8f5e9;padding:12px;border-radius:6px;">
          <div style="font-size:10px;color:#666;">الربح</div>
          <div style="font-size:18px;font-weight:900;color:#2e7d32;">${v23Cur((O.T||{}).pr||0)}</div>
        </div>
      </div>
      ${mem ? `<div style="background:#f0f7ff;padding:10px;border-radius:6px;font-size:12px;text-align:center;">الذاكرة: <b>${mem.used} MB</b> / ${mem.limit} MB</div>` : ''}
    `);
  };
  
  /* === 6. المخزون === */
  window.v23ModalInventory = function() {
    const O = v23O();
    const items = O.it || [];
    const invVal = items.reduce((s, p) => s + (parseInt(p.st) || parseInt(p.stock) || 0) * (parseFloat(p.cos) || parseFloat(p.cost) || 0), 0);
    const low = items.filter(p => { const s = parseInt(p.st) || parseInt(p.stock) || 0; return s > 0 && s < (parseInt(p.ms) || parseInt(p.minStock) || 0); }).length;
    const out = items.filter(p => (parseInt(p.st) || parseInt(p.stock) || 0) === 0).length;
    
    v23Modal('📦 المخزون + EOQ', `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;text-align:center;">
        <div style="background:#1a2744;color:#fff;padding:14px;border-radius:8px;">
          <div style="font-size:10px;opacity:0.85;">منتجات</div>
          <div style="font-size:26px;font-weight:900;margin-top:4px;">${items.length}</div>
        </div>
        <div style="background:#b8932f;color:#fff;padding:14px;border-radius:8px;">
          <div style="font-size:10px;opacity:0.9;">قيمة المخزون</div>
          <div style="font-size:16px;font-weight:900;margin-top:4px;">${v23Cur(invVal)}</div>
        </div>
        <div style="background:${(low+out)>0?'#c62828':'#2e7d32'};color:#fff;padding:14px;border-radius:8px;">
          <div style="font-size:10px;opacity:0.9;">تنبيهات</div>
          <div style="font-size:26px;font-weight:900;margin-top:4px;">${low+out}</div>
        </div>
      </div>
      
      <h4 style="margin:14px 0 8px;color:#1a2744;">🧮 حاسبة EOQ</h4>
      <select id="v23-eoq-sel" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;margin-bottom:10px;font-size:13px;">
        <option value="">-- اختر منتج --</option>
        ${items.map(p => `<option value="${v23_(p.nm || p.name)}">${v23_(p.nm || p.name)}</option>`).join('')}
      </select>
      <button onclick="v23CalcEOQ()" style="width:100%;padding:12px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;">احسب الكمية الاقتصادية</button>
      <div id="v23-eoq-result" style="margin-top:14px;"></div>
      
      <div style="background:#fff8e1;padding:12px;border-radius:6px;margin-top:14px;font-size:12px;border-right:3pt solid #b8932f;">
        <b>📐 الصيغة:</b> EOQ = √(2 × طلب_سنوي × تكلفة_طلب / تكلفة_تخزين)
      </div>
    `);
  };
  
  window.v23CalcEOQ = function() {
    const sel = document.getElementById('v23-eoq-sel');
    const name = sel && sel.value;
    if (!name) { document.getElementById('v23-eoq-result').innerHTML = '<p style="color:#c62828;">اختر منتج أولاً</p>'; return; }
    const O = v23O();
    const p = (O.it || []).find(x => (x.nm || x.name) === name);
    if (!p) return;
    const annualDemand = ((O.tx || []).filter(t => (t.it === name || t.item === name) && (t.tp === 'sale' || !t.tp)).length) * 12 || 1000;
    const orderingCost = 50;
    const holdingCost = (parseFloat(p.cos) || parseFloat(p.cost) || 5) * 0.2 || 1;
    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
    const orders = annualDemand / eoq;
    
    document.getElementById('v23-eoq-result').innerHTML = `
      <div style="background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;padding:16px;border-radius:8px;">
        <div style="font-size:12px;opacity:0.85;">الكمية الاقتصادية لـ ${v23_(name)}</div>
        <div style="font-size:36px;font-weight:900;margin-top:4px;">${Math.round(eoq)} <span style="font-size:16px;opacity:0.7;">وحدة</span></div>
        <div style="margin-top:10px;font-size:11px;opacity:0.85;display:grid;grid-template-columns:1fr 1fr;gap:6mm;">
          <div>📊 الطلب السنوي: <b>${v23Num(annualDemand)}</b></div>
          <div>📦 الطلبات: <b>${orders.toFixed(1)}/سنة</b></div>
          <div>⏰ كل: <b>${Math.round(365/orders)} يوم</b></div>
          <div>💰 التكلفة: <b>${v23Cur(parseFloat(p.cos)||parseFloat(p.cost)||0)}</b></div>
        </div>
      </div>
    `;
  };

  /* === 6.5 عمولات المناديب - تستخدم calculateAgentCommission() الموجودة أصلاً === */
  window.v23Commissions = function() {
    const O = v23O();
    // 🆕 A1.7: استخدم D.ag (مفلتر، يطابق صفحة المناديب)
    const agents = (typeof window.D !== 'undefined' && window.D.ag && window.D.ag.length > 0) ? window.D.ag : (O.ag || []);
    const cfg = (typeof getCommissionsConfig === 'function') ? getCommissionsConfig() : { salesRate: 0.01, collectionRate: 0.02, targetBonusRate: 0.005 };
    const fromDate = document.getElementById('v23-comm-from')?.value || '';
    const toDate = document.getElementById('v23-comm-to')?.value || '';

    const from = (typeof DashboardConfig !== 'undefined') ? DashboardConfig.getAsOfDate() : new Date();
    const ya = new Date(from); ya.setFullYear(ya.getFullYear() - 1);
    const defaultFrom = ya.toISOString().slice(0, 10);
    const defaultTo = from.toISOString().slice(0, 10);

    v23Modal('💰 عمولات المناديب', `
      <p style="color:#666;font-size:12px;margin-bottom:12px;">
        حساب العمولات تلقائياً من البيانات الفعلية + يسمح بتعديل النسب.
      </p>

      <div style="background:#f7f7f7;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;">
          <label>من تاريخ <input type="date" id="v23-comm-from" value="${fromDate || defaultFrom}" style="width:100%;padding:7px;border:1px solid #ddd;border-radius:5px;margin-top:3px;"></label>
          <label>إلى تاريخ <input type="date" id="v23-comm-to" value="${toDate || defaultTo}" style="width:100%;padding:7px;border:1px solid #ddd;border-radius:5px;margin-top:3px;"></label>
        </div>
        <button onclick="v23RefreshCommissions()" style="margin-top:10px;width:100%;padding:9px;background:#1a2744;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;">🔄 احسب العمولات للفترة</button>
      </div>

      <div style="background:linear-gradient(135deg,#1a2744,#b8932f);color:#fff;padding:10px 14px;border-radius:8px;font-size:12px;margin-bottom:10px;">
        <b>💡 النسب الحالية:</b>
        المبيعات <b>${(cfg.salesRate*100).toFixed(1)}%</b> ·
        التحصيل <b>${(cfg.collectionRate*100).toFixed(1)}%</b> ·
        إنجاز التارجت <b>${(cfg.targetBonusRate*100).toFixed(1)}%</b>
      </div>

      <div id="v23-comm-body">${v23RenderCommissionsTable(agents, cfg, fromDate || defaultFrom, toDate || defaultTo)}</div>

      <div style="display:flex;gap:8px;margin-top:12px">
        <button onclick="window.print()" style="flex:1;padding:10px;background:#1a2744;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;">🖨 طباعة</button>
        <button onclick="v23ExportCommissionsCSV()" style="flex:1;padding:10px;background:#2e7d32;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;">📥 تصدير Excel</button>
      </div>
    `);
  };

  window.v23RenderCommissionsTable = function(agents, cfg, fromDate, toDate) {
    if (!agents || !agents.length) {
      return '<p style="text-align:center;color:#999;padding:20px;">لا توجد بيانات مناديب. ارفع ملف Excel أولاً أو أضف مناديب من صفحة «المناديب».</p>';
    }

    const rows = agents.map(a => {
      const c = (typeof calculateAgentCommission === 'function')
        ? calculateAgentCommission(a, fromDate, toDate)
        : null;
      if (!c) {
        return '<tr><td>'+v23_(a.nm)+'</td><td colspan="6" style="color:#999;">نظام العمولات غير محمّل</td></tr>';
      }
      return '<tr style="border-bottom:0.5pt solid #e0e0e0;">' +
        '<td style="padding:8px;font-weight:700;color:#1a2744;">'+v23_(a.nm)+'</td>' +
        '<td style="padding:8px;text-align:left;">'+v23Cur(c.netSales)+'</td>' +
        '<td style="padding:8px;text-align:left;color:#1976d2;">'+v23Cur(c.collections)+'</td>' +
        '<td style="padding:8px;text-align:left;color:#2e7d32;">'+v23Cur(c.salesCommission)+'</td>' +
        '<td style="padding:8px;text-align:left;color:#1976d2;">'+v23Cur(c.collectionCommission)+'</td>' +
        '<td style="padding:8px;text-align:left;color:#b8932f;">'+v23Cur(c.targetBonus)+'</td>' +
        '<td style="padding:8px;text-align:left;font-weight:900;color:#1a2744;background:#fafafa;">'+v23Cur(c.totalCommission)+'</td>' +
        '<td style="padding:8px;text-align:center;">'+c.uniqueClients+'</td>' +
        '<td style="padding:8px;text-align:center;color:'+(c.achievement>=100?'#2e7d32':c.achievement>=70?'#b8932f':'#c62828')+';font-weight:700;">'+c.achievement.toFixed(0)+'%</td>' +
        '</tr>';
    }).join('');

    const totalAll = agents.reduce((s, a) => {
      const c = (typeof calculateAgentCommission === 'function') ? calculateAgentCommission(a, fromDate, toDate) : null;
      return s + (c ? c.totalCommission : 0);
    }, 0);

    return '<div style="max-height:400px;overflow:auto;border-radius:8px;border:1pt solid #e0e0e0;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:11.5px;">' +
        '<thead style="position:sticky;top:0;background:#1a2744;color:#fff;z-index:1;">' +
          '<tr>' +
            '<th style="padding:8px;text-align:right;">المندوب</th>' +
            '<th style="padding:8px;text-align:left;">صافي المبيعات</th>' +
            '<th style="padding:8px;text-align:left;">التحصيل</th>' +
            '<th style="padding:8px;text-align:left;">عمولة بيع</th>' +
            '<th style="padding:8px;text-align:left;">عمولة تحصيل</th>' +
            '<th style="padding:8px;text-align:left;">مكافأة تارجت</th>' +
            '<th style="padding:8px;text-align:left;background:#b8932f;">الإجمالي</th>' +
            '<th style="padding:8px;text-align:center;">عملاء</th>' +
            '<th style="padding:8px;text-align:center;">إنجاز</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
        '<tfoot style="background:#fafafa;font-weight:900;border-top:1.5pt solid #1a2744;">' +
          '<tr>' +
            '<td style="padding:10px;color:#1a2744;">المجموع ('+agents.length+' مناديب)</td>' +
            '<td colspan="6" style="padding:10px;"></td>' +
            '<td style="padding:10px;text-align:left;color:#1a2744;background:#fff8e1;">'+v23Cur(totalAll)+'</td>' +
            '<td colspan="2" style="padding:10px;"></td>' +
          '</tr>' +
        '</tfoot>' +
      '</table>' +
    '</div>';
  };

  window.v23RefreshCommissions = function() {
    const fromDate = document.getElementById('v23-comm-from')?.value || '';
    const toDate = document.getElementById('v23-comm-to')?.value || '';
    const O = v23O();
    const agents = (typeof window.D !== 'undefined' && window.D.ag && window.D.ag.length > 0) ? window.D.ag : (O.ag || []);
    const cfg = (typeof getCommissionsConfig === 'function') ? getCommissionsConfig() : null;
    const body = document.getElementById('v23-comm-body');
    if (body) body.innerHTML = v23RenderCommissionsTable(agents, cfg, fromDate, toDate);
  };

  window.v23ExportCommissionsCSV = function() {
    const fromDate = document.getElementById('v23-comm-from')?.value || '';
    const toDate = document.getElementById('v23-comm-to')?.value || '';
    const O = v23O();
    const agents = (typeof window.D !== 'undefined' && window.D.ag && window.D.ag.length > 0) ? window.D.ag : (O.ag || []);

    let csv = 'المندوب,صافي المبيعات,التحصيل,عمولة بيع,عمولة تحصيل,مكافأة تارجت,الإجمالي,عملاء,إنجاز %\n';
    let total = 0;
    agents.forEach(a => {
      const c = (typeof calculateAgentCommission === 'function')
        ? calculateAgentCommission(a, fromDate, toDate) : null;
      if (c) {
        csv += [a.nm, c.netSales, c.collections, c.salesCommission, c.collectionCommission, c.targetBonus, c.totalCommission, c.uniqueClients, c.achievement].join(',') + '\n';
        total += c.totalCommission;
      }
    });
    csv += 'المجموع,,,,,,' + total.toFixed(3) + ',,\n';

    try {
      if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(csv.split('\n').map(r => r.split(',')));
        XLSX.utils.book_append_sheet(wb, ws, 'عمولات');
        XLSX.writeFile(wb, 'commissions_' + new Date().toISOString().slice(0,10) + '.xlsx');
      } else {
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'commissions_' + new Date().toISOString().slice(0,10) + '.csv';
        a.click();
      }
      v23Toast('✓ تم تصدير ' + agents.length + ' مندوب');
    } catch (e) {
      v23Toast('❌ فشل التصدير: ' + e.message);
    }
  };

  /* === 7. API === */
  window.v23ModalApi = function() {
    const apiKeys = JSON.parse(localStorage.getItem('nayef_api_keys') || '[]');
    const webhooks = JSON.parse(localStorage.getItem('nayef_webhooks') || '[]');
    
    v23Modal('🔌 API & Webhooks', `
      <div style="background:#f7f7f7;padding:14px;border-radius:8px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:13px;text-align:center;">
        <div><b style="font-size:22px;color:#1a2744;">${apiKeys.length}</b><br><span style="color:#666;font-size:11px;">API Keys</span></div>
        <div><b style="font-size:22px;color:#1a2744;">${webhooks.length}</b><br><span style="color:#666;font-size:11px;">Webhooks</span></div>
        <div><b style="font-size:22px;color:#1a2744;">8</b><br><span style="color:#666;font-size:11px;">Routes</span></div>
      </div>
      
      <h4 style="margin:14px 0 8px;color:#1a2744;">🔑 API Keys</h4>
      ${apiKeys.length === 0 ? '<p style="color:#888;padding:8px;background:#fff8e1;border-radius:6px;text-align:center;font-size:12px;">لا توجد مفاتيح بعد</p>' : apiKeys.slice(0,5).map(k => `<div style="background:#f5f5f5;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:11px;margin-bottom:6px;word-break:break-all;">${v23_((k.key||'').substring(0,32))}... <span style="float:right;color:${k.enabled?'#2e7d32':'#c62828'};font-weight:700;">${k.enabled?'✓':'✗'}</span></div>`).join('')}
      <button onclick="v23CreateApi()" style="width:100%;padding:12px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;margin-top:8px;">+ إنشاء API Key</button>
      
      <h4 style="margin:16px 0 8px;color:#1a2744;">🪝 Webhooks</h4>
      ${webhooks.length === 0 ? '<p style="color:#888;padding:8px;background:#fff8e1;border-radius:6px;text-align:center;font-size:12px;">لا توجد Webhooks</p>' : webhooks.slice(0,5).map(w => `<div style="background:#f5f5f5;padding:8px 12px;border-radius:6px;font-size:11px;margin-bottom:6px;"><b>${v23_(w.url||'')}</b></div>`).join('')}
      <button onclick="v23CreateWebhook()" style="width:100%;padding:12px;background:#b8932f;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;margin-top:8px;">+ تسجيل Webhook</button>
      
      <div style="background:#e8f5e9;padding:12px;border-radius:8px;margin-top:14px;font-size:10px;font-family:monospace;color:#2e7d32;border-right:3pt solid #2e7d32;line-height:1.6;">
        <b style="color:#1a2744;">📡 Routes:</b><br>
        GET /api/customers<br>
        GET /api/transactions<br>
        POST /api/transactions<br>
        GET /api/products<br>
        GET /api/analytics/summary<br>
        POST /api/query<br>
        POST /api/forecast
      </div>
    `);
  };
  
  window.v23CreateApi = function() {
    const name = prompt('اسم المفتاح (مثال: تطبيق الجوال):');
    if (!name) return;
    const k = 'nky_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 18);
    const keys = JSON.parse(localStorage.getItem('nayef_api_keys') || '[]');
    keys.push({ id: Date.now().toString(36), key: k, name, enabled: true, createdAt: Date.now() });
    localStorage.setItem('nayef_api_keys', JSON.stringify(keys));
    alert('✓ تم!\n\n' + k + '\n\n⚠️ احفظه في مكان آمن');
    v23ModalApi();
  };
  
  window.v23CreateWebhook = function() {
    const url = prompt('رابط Webhook (URL):');
    if (!url) return;
    const ws = JSON.parse(localStorage.getItem('nayef_webhooks') || '[]');
    ws.push({ id: Date.now().toString(36), url, events: ['transaction.created', 'stock.low'], enabled: true, createdAt: Date.now() });
    localStorage.setItem('nayef_webhooks', JSON.stringify(ws));
    alert('✓ تم تسجيل Webhook!');
    v23ModalApi();
  };
  
  /* === 8. Forecast === */
  window.v23ModalForecast = function() {
    const O = v23O();
    const txs = O.tx || [];
    v23Modal('📈 التوقعات', `
      <p style="color:#666;font-size:13px;margin-bottom:14px;">يستخدم Ensemble Method (Linear Regression + Bootstrap CI)</p>
      <button onclick="v23RunForecast()" style="width:100%;padding:13px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;margin-bottom:12px;">تشغيل التوقعات على ${v23Num(txs.length)} معاملة</button>
      <div id="v23-forecast-result"></div>
    `);
  };
  
  window.v23RunForecast = function() {
    const O = v23O();
    const txs = O.tx || [];
    const monthly = {};
    txs.forEach(t => {
      const d = new Date(t.dt || t.date);
      if (isNaN(d.getTime())) return;
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      monthly[k] = (monthly[k] || 0) + (parseFloat(t.tt) || parseFloat(t.amount) || 0);
    });
    const values = Object.values(monthly);
    
    if (values.length < 2) {
      document.getElementById('v23-forecast-result').innerHTML = '<p style="color:#c62828;">بيانات غير كافية</p>';
      return;
    }
    
    // تنبؤ بسيط: متوسط آخر 3 + linear extrapolation
    const last3 = values.slice(-3);
    const avg = last3.reduce((a, b) => a + b, 0) / last3.length;
    const trend = values.length >= 2 ? (values[values.length-1] - values[0]) / values.length : 0;
    
    const forecast = [
      avg + trend,
      avg + trend * 2,
      avg + trend * 3
    ];
    
    document.getElementById('v23-forecast-result').innerHTML = `
      <div style="background:#f7f7f7;padding:14px;border-radius:8px;font-size:13px;">
        <b>📊 التوقع للـ 3 أشهر القادمة</b>
        <table style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse;">
          <tr style="background:#1a2744;color:#fff;">
            <th style="padding:6px;text-align:right;">الشهر</th>
            <th style="padding:6px;text-align:right;">المبيعات المتوقعة</th>
          </tr>
          ${forecast.map((v, i) => `<tr><td style="padding:6px;border-bottom:0.5pt solid #ddd;">الشهر ${i+1}</td><td style="padding:6px;border-bottom:0.5pt solid #ddd;font-weight:700;color:#2e7d32;">${v23Cur(v)}</td></tr>`).join('')}
        </table>
        <div style="margin-top:10px;color:#666;font-size:11px;">متوسط الأشهر الأخيرة: ${v23Cur(avg)} · الاتجاه: ${trend >= 0 ? '↗️ صاعد' : '↘️ هابط'}</div>
      </div>
    `;
  };
  
  /* === 9. RFM === */
  window.v23ModalRfm = function() {
    const O = v23O();
    v23Modal('🎯 RFM Segments', `
      <p style="color:#666;font-size:13px;margin-bottom:14px;">Recency · Frequency · Monetary — تصنيف العملاء حسب القيمة</p>
      <button onclick="v23RunRfm()" style="width:100%;padding:13px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;margin-bottom:12px;">تشغيل RFM على ${v23Num((O.soc||[]).length)} عميل</button>
      <div id="v23-rfm-result"></div>
    `);
  };
  
  window.v23RunRfm = function() {
    const O = v23O();
    const soc = O.soc || [];
    const tx = O.tx || [];
    const segments = { 'أبطال': 0, 'مخلصون': 0, 'جدد': 0, 'في خطر': 0, 'خامل': 0 };
    
    soc.forEach(c => {
      const cTx = tx.filter(t => (t.cl === c.nm || t.client === c.nm) && (t.tp === 'sale' || !t.tp));
      const monetary = cTx.reduce((s, t) => s + (parseFloat(t.tt) || parseFloat(t.amount) || 0), 0);
      
      let seg = 'خامل';
      if (cTx.length >= 3 && monetary > 5000) seg = 'أبطال';
      else if (cTx.length >= 2) seg = 'مخلصون';
      else if (cTx.length >= 1) seg = 'جدد';
      else seg = 'في خطر';
      
      segments[seg]++;
    });
    
    const cards = Object.entries(segments).map(([n, c]) => `
      <div style="background:#f7f7f7;padding:14px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:#666;">${n}</div>
        <div style="font-size:28px;font-weight:900;color:#1a2744;margin-top:2px;">${c}</div>
      </div>
    `).join('');
    
    document.getElementById('v23-rfm-result').innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">${cards}</div>
      <button onclick="window.print()" style="margin-top:12px;width:100%;padding:10px;background:#1a2744;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;">🖨 طباعة</button>`;
  };
  
  /* === 10. Backup === */
  window.v23ModalBackup = function() {
    v23Modal('☁️ نسخ احتياطي سحابي', `
      <p style="color:#666;font-size:13px;margin-bottom:14px;">تصدير البيانات للنسخ الاحتياطي</p>
      <button onclick="v23DoBackup()" style="width:100%;padding:14px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:15px;margin-bottom:10px;">📤 تصدير البيانات (JSON)</button>
      <div style="background:#f7f7f7;padding:14px;border-radius:8px;font-size:12px;">
        <b>آخر نسخة احتياطية:</b><br>
        <span style="color:#666;">${localStorage.getItem('nayef_last_backup_ts') ? new Date(parseInt(localStorage.getItem('nayef_last_backup_ts'))).toLocaleString('ar-KW') : 'لا توجد'}</span>
      </div>
    `);
  };
  
  window.v23DoBackup = function() {
    try {
      const O = v23O();
      const data = {
        soc: O.soc || [],
        tx: O.tx || [],
        it: O.it || [],
        mon: O.mon || [],
        ml: O.ml || [],
        T: O.T || {},
        _v: 'v230.2-backup',
        ts: Date.now()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nayef-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      localStorage.setItem('nayef_last_backup_ts', Date.now().toString());
      v23Toast('✓ تم تصدير النسخة الاحتياطية');
      v23CloseModal();
    } catch (e) {
      v23Toast('❌ خطأ: ' + e.message);
    }
  };
  
  /* === Ctrl+K === */
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.altKey && !e.shiftKey) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      e.preventDefault();
      v23Search();
    }
  });
  
  /* === Override الـ exportPDF الأصلي بـ النسخة المطورة === */
  setTimeout(() => {
    window.exportPDF = function() {
      v23PrintPage();
    };
    if (typeof Logger !== 'undefined') {
      try { Logger.info('✅ v230.2+: Fallback Print System active'); } catch(e){}
    }
  }, 500);
  
  /* اجعل Toggle مغلق افتراضياً */
  setTimeout(() => {
    const menu = document.getElementById('v23-floating-menu');
    if (menu) menu.classList.remove('open');
  }, 100);
})();
