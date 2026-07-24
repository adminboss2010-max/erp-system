
// v220: مسح إجباري لـ localStorage - مرة واحدة فقط للأبد
// 🛡️ الحارس لازم يكون localStorage نفسه (مش sessionStorage) — sessionStorage بينتهي
// مع كل جلسة متصفح جديدة، فكان بيسبب مسح شامل عند كل فتح جديد للتطبيق
// (بما فيه توكين تسجيل الدخول اللي لسه فُضّ لتوّه)، مش "مرة واحدة" كما هو مقصود.
(function() {
  try {
    if (!localStorage.getItem('v220_cleared')) {
      // مسح شامل لكل المفاتيح - لا يستثني أي شيء
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
      localStorage.setItem('v220_cleared', '1');
      Logger.info('✅ v220: ALL localStorage cleared (' + allKeys.length + ' keys) - using fresh SEED');
    }
  } catch(e) { Logger.warn('v220 clear:', e); }
})();
