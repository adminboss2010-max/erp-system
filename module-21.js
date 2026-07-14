
  // 🆕 v230.1+ SERVICE WORKER DISABLED (يؤرشف نسخ قديمة)
  (function() {
    'use strict';
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
          regs.forEach(function(r) { r.unregister(); });
          Logger.info('🔓 v2.3: Service Workers unregistered');
        });
      });
    }

    // زر "تثبيت كتطبيق" يظهر عند توفر beforeinstallprompt
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-installable', { detail: { available: true } }));
      Logger.info('💡 PWA: install prompt available');
    });

    window.addEventListener('appinstalled', function() {
      deferredPrompt = null;
      Logger.info('✅ PWA: app installed');
      window.dispatchEvent(new CustomEvent('pwa-installed'));
    });

    window.pwaInstall = async function() {
      if (!deferredPrompt) {
        if (window.showToast) showToast('💡', 'التثبيت غير متاح حالياً (قد يكون مُثبَّتاً بالفعل)', false);
        return false;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      Logger.info('PWA install outcome:', outcome);
      deferredPrompt = null;
      return outcome === 'accepted';
    };

    // عند توفر prompt التثبيت، أظهر الزر
    window.addEventListener('pwa-installable', function() {
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) {
        btn.style.display = 'inline-block';
        btn.title = '📲 ثبّت كتطبيق على جهازك (يعمل بدون إنترنت)';
      }
    });
    window.addEventListener('pwa-installed', function() {
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.style.display = 'none';
      if (window.showToast) showToast('✅', 'تم تثبيت التطبيق بنجاح!', true);
    });


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
  