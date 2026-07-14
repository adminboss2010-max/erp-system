
/* v23 Open Cloud Backup + Ctrl+K - لفّ في IIFE لتجنب scope pollution */
(function() {
  'use strict';
  
  // Helper functions (local to this block)
  const safe = (fn) => { try { return fn(); } catch(e) { console.warn('v23safe:', e.message); return null; } };
  const Logger = window.Logger || { info: function() { try { console.log.apply(console, arguments); } catch(e) {} } };
  function v23Search() { if (window.v23Search) window.v23Search(); else console.log('[NAIF] v23Search'); }
  function toast(msg) { if (typeof window.toast === 'function') window.toast(msg); else if (typeof window.v23Toast === 'function') window.v23Toast(msg); else console.log(msg); }
  function closeMiniModal() { if (typeof window.closeMiniModal === 'function') window.closeMiniModal(); }
  function showMiniModal(title, html) { if (typeof window.showMiniModal === 'function') window.showMiniModal(title, html); }
  
  window.v23OpenCloudBackup = function() {
    if (!window.CloudBackup) { toast('❌ CloudBackup غير محمّل'); return; }
    showMiniModal('☁️ نسخ احتياطي سحابي', `
      <p style="color:#666;font-size:12px;margin-bottom:12px;">نسخ احتياطي للبيانات على السحابة</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button onclick="v23DoBackup('export')" style="padding:11px;background:#1a2744;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">📤 تصدير نسخة</button>
        <button onclick="v23DoBackup('import')" style="padding:11px;background:#b8932f;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">📥 استيراد نسخة</button>
      </div>
      <div style="margin-top:10px;background:#f7f7f7;padding:10px;border-radius:6px;font-size:12px;">
        <b>آخر نسخ احتياطي:</b> ${localStorage.getItem('nayef_last_backup') || 'لا يوجد'}
      </div>
    `);
  };
  
  window.v23DoBackup = function(type) {
    if (type === 'export' && window.CloudBackup && CloudBackup.backup) {
      try {
        CloudBackup.backup();
        toast('✓ تم تصدير النسخة الاحتياطية');
        closeMiniModal();
      } catch(e) { toast('❌ ' + e.message); }
    } else {
      alert('📥 للاستيراد:\n1. اختر الملف من جهازك\n2. سيتم استرجاع البيانات تلقائياً\n\n(تحت التطوير — حالياً يدعم التصدير فقط)');
    }
  };
  
  // Ctrl+K search shortcut
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.altKey && !e.shiftKey) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      v23Search();
    }
  });
  
  safe(function() { Logger.info('✅ v230.1+: All panels & FAB buttons initialized'); });
  
  console.log('✅ [NAIF] v23OpenCloudBackup + Ctrl+K module ready');
})();
