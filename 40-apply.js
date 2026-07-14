
/* ════════════════════════════════════════════════════════════════
   🆕 v230.7+ THEME CONTROLLER — Professional ERP
   Compatible مع applyTheme() القديم + Theme system الجديد
   ════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  const STORAGE_KEY = 'nayef_theme_v3';
  const DEFAULTS = { mode: 'light', theme: 'emerald', bg: 'clean' };
  const THEME_NAMES = {
    navy: 'أزرق مؤسسات', emerald: 'زمردي مالي', purple: 'بنفسجي ملكي',
    teal: 'فيروزي هادئ', indigo: 'نيلي تقني', amber: 'كهرماني دافئ',
    rose: 'وردي جريء', charcoal: 'رمادي محايد'
  };
  const BG_NAMES = {
    clean: 'نظيف', slate: 'انسيابي', mesh: 'شبكة ناعمة',
    dots: 'نقاط', grid: 'شبكة', aurora: 'شفق'
  };

  let state = Object.assign({}, DEFAULTS);
  let panel = null;

  function apply() {
    document.documentElement.setAttribute('data-mode', state.mode);
    document.documentElement.setAttribute('data-theme', state.theme);
    document.body.setAttribute('data-bg', state.bg);
    document.body.style.colorScheme = (state.mode === 'light') ? 'light' : 'dark';

    // Synch with legacy theme vars so existing charts stay consistent
    try {
      if (typeof _theme !== 'undefined') _theme = (state.mode === 'dark') ? 'dark' : 'light';
      try { localStorage.setItem('nayef_theme', (state.mode === 'dark') ? 'dark' : 'light'); } catch(e){}
    } catch(e){}

    if (!panel) return;
    panel.querySelectorAll('[data-mode]').forEach(function(b) {
      b.setAttribute('aria-checked', b.dataset.mode === state.mode ? 'true' : 'false');
    });
    panel.querySelectorAll('[data-theme]').forEach(function(b) {
      b.setAttribute('aria-checked', b.dataset.theme === state.theme ? 'true' : 'false');
    });
    panel.querySelectorAll('[data-bg]').forEach(function(b) {
      b.setAttribute('aria-checked', b.dataset.bg === state.bg ? 'true' : 'false');
    });
    var cn = document.getElementById('thColorName');
    var bn = document.getElementById('thBgName');
    if (cn) cn.textContent = THEME_NAMES[state.theme] || '';
    if (bn) bn.textContent = BG_NAMES[state.bg] || '';
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){}
  }
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') state = Object.assign({}, DEFAULTS, saved);
    } catch(e){}
  }

  window.thOpen = function() {
    if (!panel) return;
    panel.hidden = false;
    document.body.classList.add('th-open');
    apply();
  };
  window.thClose = function() {
    if (!panel) return;
    panel.hidden = true;
    document.body.classList.remove('th-open');
  };
  window.thApply = function() {
    apply();
    save();
    thClose();
    window.dispatchEvent(new CustomEvent('theme:changed', { detail: state }));
  };
  window.thReset = function() {
    state = Object.assign({}, DEFAULTS);
    apply();
    save();
  };

  function preview(p) {
    if (p.mode)  state.mode  = p.mode;
    if (p.theme) state.theme = p.theme;
    if (p.bg)    state.bg    = p.bg;
    apply();
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel && !panel.hidden) thClose();
  });
  document.addEventListener('click', function(e) {
    if (panel && !panel.hidden && !panel.contains(e.target) && e.target.id !== 'thLauncher') {
      thClose();
    }
  });

  function injectLauncher() {
    if (document.getElementById('thLauncher')) return;
    var btn = document.createElement('button');
    btn.id = 'thLauncher';
    btn.type = 'button';
    btn.className = 'th-launcher';
    btn.setAttribute('aria-label', 'تغيير المظهر');
    btn.title = 'تغيير المظهر';
    btn.onclick = window.thOpen;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>';
    var anchor = document.getElementById('kcSettingsBtn');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    } else {
      document.body.appendChild(btn);
    }
  }

  function init() {
    panel = document.getElementById('thPanel');
    if (!panel) return;
    load();
    apply();
    injectLauncher();

    panel.querySelectorAll('[data-mode]').forEach(function(btn) {
      btn.addEventListener('click', function() { preview({ mode: btn.dataset.mode }); });
    });
    panel.querySelectorAll('[data-theme]').forEach(function(btn) {
      btn.addEventListener('click', function() { preview({ theme: btn.dataset.theme }); });
    });
    panel.querySelectorAll('[data-bg]').forEach(function(btn) {
      btn.addEventListener('click', function() { preview({ bg: btn.dataset.bg }); });
    });

    window.addEventListener('storage', function(e) {
      if (e.key === STORAGE_KEY) { load(); apply(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }
})();
