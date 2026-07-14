
    function toggleThemeDropdown() {
      const dd = document.getElementById('themeDropdown');
      if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    }
    // إغلاق عند النقر خارج
    document.addEventListener('click', function(e) {
      const wrap = document.getElementById('themeDropdownWrap');
      if (wrap && !wrap.contains(e.target)) {
        const dd = document.getElementById('themeDropdown');
        if (dd) dd.style.display = 'none';
      }
    });
    