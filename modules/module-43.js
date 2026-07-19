// NAIF v2.3 Standalone Print (يعمل 100% بدون script 38)
(function() {
  'use strict';
  
  // v23FillStaticLetterhead - نسخة مبسّطة ومستقلة
  window.v23FillStaticLetterhead = function() {
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      
      const pageTitleEl = document.getElementById('pageTitle');
      const curTitle = pageTitleEl ? pageTitleEl.textContent.trim() : 'تقرير';
      
      const titleEl = document.getElementById('v23-print-page-title');
      if (titleEl) titleEl.textContent = curTitle;
      
      const dateEl = document.getElementById('v23-print-date');
      if (dateEl) dateEl.textContent = dateStr;
      
      console.log('✅ [NAIF] Letterhead filled for: ' + curTitle);
    } catch(e) {
      console.warn('⚠️ v23FillStaticLetterhead:', e.message);
    }
  };
  
  // v23PrintNow - الطباعة الفورية
  window.v23PrintNow = function() {
    console.log('🖨️ [NAIF] v23PrintNow called');
    try {
      // تنظيف letterhead قديم
      const oldLh = document.getElementById('v23-print-letterhead');
      if (oldLh) oldLh.remove();
      const oldFt = document.getElementById('v23-print-footer');
      if (oldFt) oldFt.remove();
      
      // إنشاء letterhead جديد
      if (typeof window.v23FillStaticLetterhead === 'function') {
        window.v23FillStaticLetterhead();
      }
      
      // طباعة مباشرة
      window.print();
      console.log('✅ [NAIF] window.print() invoked');
      return true;
    } catch (e) {
      console.error('❌ [NAIF] v23PrintNow error:', e);
      try { window.print(); } catch (e2) { alert('تعذّرت الطباعة'); }
    }
  };
  
  // v23FloatingToggle - فتح/إغلاق قائمة v2.3
  window.v23FloatingToggle = function() {
    const menu = document.getElementById('v23-floating-menu');
    const btn = document.getElementById('v23-floating-toggle');
    if (!menu || !btn) {
      console.warn('⚠️ v23 floating elements not in DOM');
      return;
    }
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    const arrow = btn.querySelector('.v23-toggle-arrow');
    if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
    console.log('🆕 [NAIF] v23 menu ' + (isOpen ? 'opened' : 'closed'));
  };
  
  // v23Modal - يفتح PrintEngine أو طباعة
  // 🛠️ إصلاح: كان اسمها v23Modal وده كان بيبوّظ الدالة الأصلية v23Modal(title, html)
  // المستخدمة في عمولات المناديب وRFM وAPI — استخدام مباشر (زرار report picker اتشال أصلاً)
  window.v23QuickPrintPreview = function() {
    if (window.PrintEngine && window.PrintEngine.showPreview) {
      window.PrintEngine.showPreview(['executive']);
    } else {
      window.v23PrintNow();
    }
  };
  
    // naifPrintReports - زر التقارير الشامل
  window.naifPrintReports = function() {
    console.log('📊 [NAIF] naifPrintReports called');
    try {
      if (window.PrintEngine && typeof window.PrintEngine.printMainMenu === 'function') {
        console.log('✅ [NAIF] PrintEngine.printMainMenu متاح - يفتح التقرير الشامل');
        window.PrintEngine.printMainMenu({
          showPeriod: true,
          title: 'التقرير الشامل',
          subtitle: 'ملخص أداء كامل'
        });
      } else if (window.PrintEngine && typeof window.PrintEngine.showPreview === 'function') {
        console.log('⚠️ [NAIF] printMainMenu غير متاح - يستخدم showPreview');
        window.PrintEngine.showPreview(['executive', 'financial', 'customers', 'transactions', 'inventory', 'agents']);
      } else {
        console.warn('⚠️ [NAIF] PrintEngine غير محمّل - fallback window.print()');
        window.print();
      }
    } catch (e) {
      console.error('❌ [NAIF] naifPrintReports error:', e);
      try { window.print(); } catch (e2) { console.error('❌ window.print failed:', e2); }
    }
  };

  console.log('%c✅ [NAIF v2.3] Standalone print system loaded', 'color:#059669;font-weight:bold');
})();
