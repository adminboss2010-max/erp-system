/**
 * ============================================================
 * version-check.js — تحديث إجباري تلقائي
 * ============================================================
 *
 * الفكرة: كل صفحة (index.html, app.html, admin.html) بتفحص
 * version.json (بدون كاش) كل ما تفتح، وبشكل دوري كمان.
 * لو رقم النسخة اتغيّر عن اللي المتصفح فاكره، النظام تلقائيًا:
 *   1) يمسح كاش الـ Service Worker بالكامل
 *   2) يلغي تسجيل الـ Service Worker القديم
 *   3) يعمل Reload كامل للصفحة
 *
 * يعني أي تحديث بتعمله وترفعه، أي حد فاتح النظام (حتى لو
 * كان فاتحه من قبل ومخزّن نسخة قديمة) هياخد آخر نسخة أوتوماتيك
 * من غير ما يحتاج يمسح الكاش يدوي أو يعمل حاجة.
 */
(function () {
  var VERSION_URL = 'version.json';
  var STORAGE_KEY = 'app_build_version';
  var CHECK_INTERVAL_MS = 5 * 60 * 1000; // فحص كل 5 دقايق لو الصفحة فاضلة مفتوحة

  function forceUpdate(newVersion) {
    try { localStorage.setItem(STORAGE_KEY, newVersion); } catch (e) {}

    var cleanupTasks = [];

    if ('serviceWorker' in navigator) {
      cleanupTasks.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        }).catch(function () {})
      );
    }

    if (window.caches) {
      cleanupTasks.push(
        caches.keys().then(function (names) {
          return Promise.all(names.map(function (n) { return caches.delete(n); }));
        }).catch(function () {})
      );
    }

    Promise.all(cleanupTasks).finally(function () {
      // location.reload(true) اختياري في المتصفحات الحديثة، بس بنضيف
      // كسر كاش على الرابط نفسه كضمان إضافي
      var sep = window.location.href.indexOf('?') === -1 ? '?' : '&';
      window.location.href = window.location.href.split('#')[0] + sep + '_v=' + Date.now();
    });
  }

  function checkVersion() {
    fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.version) return;
        var current = localStorage.getItem(STORAGE_KEY);
        if (!current) {
          // أول مرة النظام يفتح — نسجّل النسخة الحالية من غير تحديث إجباري
          try { localStorage.setItem(STORAGE_KEY, data.version); } catch (e) {}
          return;
        }
        if (current !== data.version) {
          forceUpdate(data.version);
        }
      })
      .catch(function () { /* فشل فحص النسخة مش لازم يوقف الصفحة */ });
  }

  checkVersion();
  setInterval(checkVersion, CHECK_INTERVAL_MS);
})();
