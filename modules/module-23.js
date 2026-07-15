
  // 🔐 بوابة الدخول — لازم توكن صالح قبل ما النظام يفتح
  (function () {
    var token = localStorage.getItem('erp_token');
    if (!token) {
      window.location.href = './index.html';
      return;
    }
    window.addEventListener('DOMContentLoaded', function () {
      var btn = document.createElement('button');
      btn.textContent = '⏻ خروج';
      btn.title = 'تسجيل الخروج من هذا الحساب';
      btn.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:99999;background:#1F3D2B;color:#F6F3EC;border:none;border-radius:20px;padding:8px 16px;font-size:12px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);';
      btn.onclick = function () {
        if (confirm('هيتم تسجيل خروجك. البيانات محفوظة على السيرفر ومش هتضيع. متأكد؟')) {
          localStorage.removeItem('erp_token');
          localStorage.removeItem('erp_company');
          window.location.href = './index.html';
        }
      };
      document.body.appendChild(btn);
    });
  })();
