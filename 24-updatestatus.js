
// ربط البحث الجديد بالبحث الأصلي
(function(){
  var newSearch = document.getElementById('kcGlobalSearch');
  var oldSearch = document.getElementById('globalSearch');
  if(newSearch && oldSearch){
    newSearch.addEventListener('input', function(e){
      oldSearch.value = e.target.value;
      oldSearch.dispatchEvent(new Event('input'));
    });
    if(oldSearch.value){
      newSearch.value = oldSearch.value;
    }
  }

  // تحديث الـ status pill
  function updateStatus(){
    var el = document.getElementById('kcStatusText');
    var pill = document.getElementById('kcStatusPill');
    if(!el) return;
    try {
      var keys = Object.keys(localStorage);
      var hasData = keys.some(function(k){
        return ['nayef','kashf','excel','seed','dg'].some(function(s){ return k.toLowerCase().indexOf(s)!==-1; });
      });
      if(hasData){
        el.textContent = 'بيانات محمّلة';
        if(pill) pill.classList.add('loaded');
      } else {
        el.textContent = 'لم يتم رفع ملف';
        if(pill) pill.classList.remove('loaded');
      }
    } catch(e){}
    var upd = document.getElementById('kcLastUpdate');
    if(upd){
      var d = new Date();
      upd.textContent = d.toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'});
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', updateStatus);
  } else {
    setTimeout(updateStatus, 200);
  }
  setInterval(updateStatus, 5000);

  // 🆕 v230.7: تبويبات الـ kc-tabs تم إزالتها من الواجهة — الكود التالي محذوف أيضاً للحفاظ على نظافة النظام
  /*
  document.querySelectorAll('.kc-tab').forEach(function(t){
    t.addEventListener('click', function(){
      document.querySelectorAll('.kc-tab').forEach(function(x){ x.classList.remove('active'); x.setAttribute('aria-selected','false'); });
      t.classList.add('active');
      t.setAttribute('aria-selected','true');
      // Best-effort mapping to existing nav
      var tab = t.getAttribute('data-tab');
      var map = { overview:'ov', sales:'sales', products:'items', audit:'audit', agents:'sales', strategy:'strategy' };
      try {
        var pageEl = document.getElementById('pg_' + (map[tab]||'')) || document.querySelector('[data-pg="'+(map[tab]||'')+'"]');
        if(pageEl) pageEl.click();
      } catch(e){}
    });
  });
  */
})();


// ====== 🆕 v220.8.6+ SETTINGS PANEL HANDLERS ======
(function(){
  var btn = document.getElementById('kcSettingsBtn');
  var panel = document.getElementById('kcSettingsPanel');
  if(!btn || !panel) return;

  // Toggle panel
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var isHidden = panel.hidden;
    panel.hidden = !isHidden;
    btn.setAttribute('aria-expanded', !isHidden);
  });

  // Close on outside click
  document.addEventListener('click', function(e){
    if(!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)){
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on Escape
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !panel.hidden){
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Sync intensity dots with current state
  var currentIntensity = document.body.getAttribute('data-intensity') || '1';
  document.querySelectorAll('.kc-intensity-dot').forEach(function(dot){
    var lvl = dot.getAttribute('data-level');
    dot.classList.toggle('active', lvl === currentIntensity);
  });

  // Sync bg chips with current state
  var currentBg = document.documentElement.getAttribute('data-bg-theme') || 'sunset';
  document.querySelectorAll('.kc-bg-chip').forEach(function(chip){
    var bg = chip.getAttribute('data-bg');
    chip.classList.toggle('active', bg === currentBg);
  });

  // Listen to theme changes from elsewhere
  var origSetIntensity = window.setIntensity;
  if(typeof origSetIntensity === 'function'){
    window.setIntensity = function(level){
      origSetIntensity(level);
      document.querySelectorAll('.kc-intensity-dot').forEach(function(d){
        d.classList.toggle('active', d.getAttribute('data-level') == String(level));
      });
    };
  }
  var origSetBgTheme = window.setBgTheme;
  if(typeof origSetBgTheme === 'function'){
    window.setBgTheme = function(theme){
      origSetBgTheme(theme);
      document.querySelectorAll('.kc-bg-chip').forEach(function(c){
        c.classList.toggle('active', c.getAttribute('data-bg') === theme);
      });
    };
  }

  // Load saved print prefs
  try {
    var prefs = JSON.parse(localStorage.getItem('kc_print_prefs') || '{}');
    if(prefs.paper) document.getElementById('kcPrintPaper').value = prefs.paper;
    if(prefs.font)  document.getElementById('kcPrintFont').value  = prefs.font;
    if(typeof prefs.logo !== 'undefined')  document.getElementById('kcPrintLogo').checked  = prefs.logo;
    if(typeof prefs.notes !== 'undefined') document.getElementById('kcPrintNotes').checked = prefs.notes;
    applyPrintPrefs();
  } catch(e){}

  function applyPrintPrefs(){
    var style = document.getElementById('kc-print-prefs-style');
    if(!style){
      style = document.createElement('style');
      style.id = 'kc-print-prefs-style';
      document.head.appendChild(style);
    }
    var paper = document.getElementById('kcPrintPaper')?.value || 'A4';
    var font  = document.getElementById('kcPrintFont')?.value  || '12';
    var logo  = document.getElementById('kcPrintLogo')?.checked !== false;
    var notes = document.getElementById('kcPrintNotes')?.checked !== false;
    style.textContent = '@page { size: ' + paper + '; margin: 12mm; } @media print { body { font-size: ' + font + 'px !important; } .print-no-logo .invoice-logo, .print-no-logo .company-logo, .print-no-logo .kc-brand-mark { display: none !important; } .print-no-notes .invoice-notes, .print-no-notes [class*="note"] { display: none !important; } }';
    document.body.classList.toggle('print-no-logo', !logo);
    document.body.classList.toggle('print-no-notes', !notes);
    try {
      localStorage.setItem('kc_print_prefs', JSON.stringify({paper: paper, font: font, logo: logo, notes: notes}));
    } catch(e){}
  }
  window.kcApplyPrintPrefs = applyPrintPrefs;
  window.applyPrintPrefs = applyPrintPrefs;
  applyPrintPrefs();
})();

