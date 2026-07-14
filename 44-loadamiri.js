
// NAIF Font Loader - يحقن خط Amiri للعربية في print
(function() {
  'use strict';
  
  const AMIRI_B64 = window.__AMIRI_FONT_B64__ || '';
  
  // إذا لم يكن الخط محمّل، حاول التحميل
  function loadAmiri() {
    if (typeof FontFace === 'undefined') {
      console.warn('⚠️ [NAIF] FontFace API غير مدعوم في هذا المتصفح');
      return;
    }
    if (!AMIRI_B64) {
      console.warn('⚠️ [NAIF] خط Amiri غير محمّل - يحاول استخدام الخط المثبت');
      return;
    }
    try {
      const font = new FontFace('AmiriArabic', 'url(data:font/ttf;base64,' + AMIRI_B64 + ')');
      font.load().then(function() {
        document.fonts.add(font);
        document.documentElement.classList.add('amiri-loaded');
        console.log('✅ [NAIF] خط Amiri محمّل - العربية ستظهر في الطباعة');
      }).catch(function(e) {
        console.error('❌ [NAIF] فشل تحميل Amiri:', e.message);
      });
    } catch (e) {
      console.error('❌ [NAIF] خطأ في FontFace:', e.message);
    }
  }
  
  // تحميل فوري
  loadAmiri();
  
  // تحميل مرة أخرى قبل الطباعة
  if (window.matchMedia) {
    window.matchMedia('print').addEventListener('change', function(e) {
      if (e.matches) {
        console.log('🖨️ [NAIF] بدء الطباعة - الخط جاهز');
      }
    });
  }
  
  // @font-face عبر CSS كـ fallback
  const style = document.createElement('style');
  style.id = 'naif-print-font';
  style.textContent = `
@font-face {
  font-family: 'AmiriArabic';
  src: local('Amiri'), local('Amiri-Regular'), local('Tahoma'), local('Arial Unicode MS'), local('Geeza Pro');
  font-display: block;
}
@media print {
  @font-face {
    font-family: 'AmiriArabic';
    src: local('Amiri'), local('Amiri-Regular'), local('Tahoma'), local('Arial Unicode MS');
  }
  * { font-family: 'AmiriArabic', 'Tahoma', 'Arial', sans-serif !important; }
  .print-page, .statement-page, .print-preview-pages {
    font-family: 'AmiriArabic', 'Tahoma', 'Arial', sans-serif !important;
  }
  body, html {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
* { font-family: 'AmiriArabic', 'Tahoma', Arial, sans-serif; }
.print-page, .statement-page { 
  font-family: 'AmiriArabic', 'Tahoma', Arial, sans-serif !important;
}
`;
  document.head.appendChild(style);
  console.log('✅ [NAIF] Print font CSS أُضيف');
})();
