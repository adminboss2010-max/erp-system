const CACHE_NAME = 'erp-shell-v3';
const APP_SHELL = [
  './',
  './index.html',
  './app.html',
  './config.js',
  './api-client.js',
  './manifest.json',
  './modules/module-01.js',
  './modules/02-sendtosentry.js',
  './modules/module-03.js',
  './modules/module-04.js',
  './modules/05-saferender.js',
  './modules/06-calculatechecksum.js',
  './modules/07-fmtcurrency.js',
  './modules/08-extractfromtext.js',
  './modules/09-mean.js',
  './modules/10-getdata.js',
  './modules/11-calls.js',
  './modules/12-loadstore.js',
  './modules/13-loadstore.js',
  './modules/14-loadstore.js',
  './modules/15-loadstore.js',
  './modules/16-normalizearabic.js',
  './modules/17-debounce.js',
  './modules/18-loadstore.js',
  './modules/19-loadstore.js',
  './modules/20-loadstore.js',
  './modules/module-21.js',
  './modules/module-22.js',
  './modules/module-23.js',
  './modules/24-updatestatus.js',
  './modules/module-25.js',
  './modules/26-forcefullreset.js',
  './modules/module-27.js',
  './modules/28-togglethemedropdown.js',
  './modules/29-navshowcategory.js',
  './modules/30-isvaliddate.js',
  './modules/31-openreportscenter.js',
  './modules/32-kpi-n.js',
  './modules/33-infragenerateqr.js',
  './modules/35-togglequickactions.js',
  './modules/module-36.js',
  './modules/37-geto.js',
  './modules/38-v23search.js',
  './modules/39-v23.js',
  './modules/40-apply.js',
  './modules/41-rentalesc.js',
  './modules/module-43.js',
  './modules/44-loadamiri.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // نكاش كل ملف لوحده — لو ملف واحد ناقص أو فيه 404، الباقي يتخزن عادي
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((e) => console.warn('[SW] تعذّر كاش:', url, e && e.message))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // لا تخزّن أبداً طلبات الـ API (بيانات حية دايماً)
  if (url.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // version.json و version-check.js لازم يوصلوا مباشرة من السيرفر دايماً
  if (url.includes('version.json') || url.includes('version-check.js')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // 🛠️ إصلاح جذري: Network-first بدل Cache-first لكل ملفات النظام.
  // السبب: Cache-first كان بيخلي كل متصفح/جهاز يفضل شغّال على نسخة كود
  // مختلفة حسب امتى فتح النظام أول مرة — نفس الشركة ممكن تشوف نتائج
  // مختلفة تمامًا من براوزر لبراوزر. دلوقتي: نجيب النسخة الحيّة من
  // السيرفر كل مرة، ونستخدم الكاش كـ fallback بس لو النت مقطوع فعليًا.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
