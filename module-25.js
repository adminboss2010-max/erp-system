
// v220: مسح إجباري لـ localStorage - مرة واحدة فقط
(function() {
  try {
    if (!sessionStorage.getItem('v220_cleared')) {
      // مسح شامل لكل المفاتيح - لا يستثني أي شيء
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
      // مسح sessionStorage أيضاً
      try { Object.keys(sessionStorage).forEach(k => sessionStorage.removeItem(k)); } catch(e){}
      sessionStorage.setItem('v220_cleared', '1');
      Logger.info('✅ v220: ALL localStorage cleared (' + allKeys.length + ' keys) - using fresh SEED');
    }
  } catch(e) { Logger.warn('v220 clear:', e); }
})();
