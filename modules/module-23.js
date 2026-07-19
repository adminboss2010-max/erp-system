// 🔐 بوابة الدخول — لازم توكن صالح قبل ما النظام يفتح
  (function () {
    var token = localStorage.getItem('erp_token');
    if (!token) {
      window.location.href = './index.html';
      return;
    }
    // ملاحظة: زرار الخروج بقى في الشريط العلوي بدل الزرار العائم القديم
  })();
