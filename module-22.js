
// v210: كشف الإصدار المختلف وإظهار banner
(function() {
  try {
    var SEED_V = 'unknown';
    try { SEED_V = (typeof SEED !== 'undefined' && SEED._v) ? SEED._v : 'unknown'; } catch(e) {}
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('nayef_data_backup_v220_force') || 'null'); } catch(e) {}
    var savedV = (saved && (saved._v || (saved.seed && saved.seed._v))) || '';
    
    if(SEED_V !== 'unknown' && savedV && savedV !== SEED_V && savedV !== 'restored') {
      // إظهار banner
      setTimeout(function() {
        var banner = document.getElementById('updateBanner');
        if(banner) banner.style.display = 'block';
      }, 1500);
    } else if(SEED_V !== 'unknown' && !saved) {
      // أول مرة - لا banner
    }
  } catch(e) { Logger.warn('v210 detection:', e); }
})();
