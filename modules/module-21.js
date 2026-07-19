(function() {
    'use strict';

    // 🛠️ إصلاح حرج: كان هنا كود بيعمل unregister للـ Service Worker في كل
    // مرة الصفحة تفتح — ده كان بيلغي نظام الكاش والتحديث الإجباري بالكامل
    // من غير ما يظهر أي خطأ. اتشال خالص.

    // 🛠️ تنظيف: زرار التثبيت (📲) بقى متعامل معاه من app.html نفسه
    // (في قائمة "المزيد") — الكود القديم هنا كان بيعمل نفس الحاجة تاني
    // بطريقة تانية وبيتعارض معاه، فاتشال.

    // كشف وضع عدم الاتصال وإظهار شريط
    window.addEventListener('online', function() {
      const bar = document.getElementById('offlineBar');
      if (bar) bar.style.display = 'none';
      if (window.showToast) showToast('🌐', 'تم استعادة الاتصال', true);
    });
    window.addEventListener('offline', function() {
      const bar = document.getElementById('offlineBar');
      if (bar) bar.style.display = 'flex';
      else if (window.showToast) showToast('📴', 'أنت غير متصل - وضع القراءة فقط', false);
    });
  })();
