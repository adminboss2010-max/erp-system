
function forceFullReset() {
  // 🆕 v220.1+ LOCKED: نافذة تأكيد قوية مع عرض ما سيتم مسحه
  const stats = {
    localStorage: (function(){try{return Object.keys(localStorage).length;}catch(e){return 0;}})(),
    sessionStorage: (function(){try{return Object.keys(sessionStorage).length;}catch(e){return 0;}})(),
    transactions: (typeof O !== 'undefined' && O.tx) ? O.tx.length : 0,
    societies: (typeof O !== 'undefined' && O.soc) ? O.soc.length : 0,
  };
  
  const msg = '⚠️ تحذير: سيتم مسح كل البيانات!\n\n' +
    '📊 ما سيتم مسحه:\n' +
    '- 🔑 مفاتيح localStorage: ' + stats.localStorage + '\n' +
    '- 🔑 مفاتيح sessionStorage: ' + stats.sessionStorage + '\n' +
    '- 📋 معاملات: ' + stats.transactions + '\n' +
    '- 🏢 جمعيات: ' + stats.societies + '\n\n' +
    '✅ بعد المسح:\n' +
    '- سيتم تحميل البيانات المضمّنة (v220.1 LOCKED)\n' +
    '- كل الإضافات اليدوية ستفقد\n' +
    '- الإعدادات ستعود للافتراضي\n\n' +
    'هل تريد المتابعة؟';
  
  if(!confirm(msg)) return;
  if(!confirm('⚠️ تأكيد نهائي: هل أنت متأكد 100%؟')) return;
  
  // 🆕 إظهار loader
  if(typeof nayefShowLoader === 'function') nayefShowLoader('جاري مسح البيانات...');
  
  try {
    // 1) مسح المفاتيح المعروفة
    const keysToDelete = [
      'nayef_dash_seed', 'nayef_dash_state', 'nayef_autosave',
      'nayef_destructive_log', 'nayef_invoices', 'nayef_reports',
      'nayef_report_schedules', 'nayef_as_of_date', 'nayef_theme',
      'nayef_intensity', 'nayef_bg_theme',
      'nayef_data_backup_v220_force', 'nayef_data_timestamp_v220_force',
      'nayef_data_backup_v1', 'nayef_data_timestamp_v1',
      'nayef_data_backup', 'nayef_data_timestamp',
    ];
    keysToDelete.forEach(function(k){
      try{localStorage.removeItem(k);}catch(e){}
      try{sessionStorage.removeItem(k);}catch(e){}
    });
    
    // 2) مسح كل ما تبقى
    try{Object.keys(localStorage).forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});}catch(e){}
    try{Object.keys(sessionStorage).forEach(function(k){try{sessionStorage.removeItem(k);}catch(e){}});}catch(e){}
    
    Logger.info('✅ تم مسح كل البيانات');
    if(typeof nayefHideLoader === 'function') nayefHideLoader();
    
    // 3) ضع flag في sessionStorage لمنع الاستعادة
    try { sessionStorage.setItem('nayef_skip_restore', '1'); } catch(e) {}
    // 4) إعادة تحميل بقوة
    window.location.href = window.location.pathname + '?v=220-reset-' + Date.now();
  } catch(e) {
    alert('❌ خطأ: ' + e.message);
    if(typeof nayefHideLoader === 'function') nayefHideLoader();
  }
}

// 🆕 v220.1+ LOCKED: إعادة تهيئة سريعة
function quickResetV220() {
  if(!confirm('إعادة تهيئة سريعة - سيتم الاحتفاظ بالبيانات اليدوية. متابعة؟')) return;
  try {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = window.location.pathname + '?v=220-quick-' + Date.now();
  } catch(e) {
    alert('❌ خطأ: ' + e.message);
  }
}
