/*
 * Server-only data policy.
 * Business data is read from and written to Google Apps Script / Google Sheets.
 * Browser storage is used only for the login token and a non-sensitive revision number.
 */
(function () {
  'use strict';

  const REVISION_KEY = 'erp_state_revision';
  const LEGACY_DATA_KEYS = [
    'nayef_data_v2', 'nayef_data_v2_enc', 'nayef_data_v2_ts',
    'nayef_data_backup_v220_force', 'nayef_data_timestamp_v220_force',
    'nayef_dash_seed', 'nayef_local_snapshot'
  ];

  function notify(message) {
    if (typeof window.showToast === 'function') window.showToast('غير متاح', message, false);
    else window.alert(message);
  }

  function stateSnapshot() {
    const source = window.O || (typeof O !== 'undefined' ? O : {});
    return JSON.parse(JSON.stringify(source || {}));
  }

  function revisionFrom(response) {
    if (!response) return null;
    const value = response.revision !== undefined ? response.revision : response.rev;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function clearLegacyBusinessCache() {
    LEGACY_DATA_KEYS.forEach(function (key) { try { localStorage.removeItem(key); } catch (_) {} });
  }

  async function saveToServer(data) {
    if (!window.ApiClient) throw new Error('ملف الاتصال بالخادم غير محمّل');
    const rawRevision = localStorage.getItem(REVISION_KEY);
    const revision = rawRevision === null ? 0 : Number(rawRevision);
    const result = await ApiClient.state.save(data, Number.isFinite(revision) ? revision : 0);
    if (!result || !result.ok) {
      if (result && (result.conflict || result.code === 'CONFLICT')) {
        notify('تم تعديل البيانات من جهاز آخر. سيتم تحميل أحدث نسخة من الخادم.');
        await loadFromServer();
      }
      throw new Error((result && result.error) || 'فشل الحفظ على الخادم');
    }
    const nextRevision = revisionFrom(result);
    if (nextRevision !== null) localStorage.setItem(REVISION_KEY, String(nextRevision));
    return result;
  }

  async function loadFromServer() {
    if (!window.ApiClient) throw new Error('ملف الاتصال بالخادم غير محمّل');
    const result = await ApiClient.state.load();
    if (!result || !result.ok) throw new Error((result && result.error) || 'فشل تحميل البيانات من الخادم');
    const nextRevision = revisionFrom(result);
    if (nextRevision !== null) localStorage.setItem(REVISION_KEY, String(nextRevision));
    const state = result.state && Object.keys(result.state).length ? result.state : {
      soc: [], ag: [], tx: [], it: [], im: {}, mon: [], ml: [], mk: [], T: {}
    };
    const target = typeof window.O !== 'undefined' ? window.O : {};
    Object.keys(target).forEach(function (key) { delete target[key]; });
    Object.assign(target, state);
    window.O = target;
    clearLegacyBusinessCache();
    return { data: state, source: 'server' };
  }

  // Replace the old localStorage / IndexedDB persistence implementation.
  // Mutate the original object instead of replacing it: older modules keep a
  // lexical reference to StorageV2, so replacing window.StorageV2 alone would
  // leave those modules writing to IndexedDB/localStorage.
  const storageApi = window.StorageV2 || {};
  storageApi.save = function (data) { return saveToServer(data || stateSnapshot()); };
  storageApi.load = function () { return loadFromServer(); };
  window.StorageV2 = storageApi;

  const debouncedSave = (window.PerfUtils && typeof window.PerfUtils.debounce === 'function')
    ? window.PerfUtils.debounce(function (data) {
        saveToServer(data).catch(function (error) {
          if (typeof Logger !== 'undefined') Logger.warn('Server-only save failed:', error);
          if (window.__setRealCloudBadge) window.__setRealCloudBadge('#dc2626', '#fee2e2', 'فشل الحفظ على الخادم');
        });
      }, 900)
    : function (data) {
        saveToServer(data).catch(function (error) {
          if (typeof Logger !== 'undefined') Logger.warn('Server-only save failed:', error);
        });
      };

  window.nayefSaveData = function () {
    const snapshot = stateSnapshot();
    debouncedSave(snapshot);
    // 🆕 مزامنة الشيتات المقروءة (المناديب، العملاء، الأصناف، المعاملات) بعد الحفظ الأساسي
    if (window.StorageV2 && typeof window.StorageV2.syncStructuredSheets === 'function') {
      window.StorageV2.syncStructuredSheets(snapshot);
    }
  };

  // Remove every user-facing import path, including files dropped onto the page.
  ['importExcelFile', 'handleExcelFile', 'readFile', 'handleFile', 'importJSONBackup'].forEach(function (name) {
    window[name] = function () { notify('استيراد الملفات معطّل. أدخل البيانات من النظام؛ Google Sheets هو المصدر الوحيد للبيانات.'); };
  });
  window.addEventListener('dragover', function (event) { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  window.addEventListener('drop', function (event) { event.preventDefault(); event.stopImmediatePropagation(); notify('إفلات الملفات معطّل.'); }, true);

  const style = document.createElement('style');
  style.textContent = 'input[type="file"], .upload-btn, [data-import], [data-excel-import], button[onclick*="importExcelFile"], button[onclick*="importBackupInput"], button[onclick*="importJSONBackup"] { display:none !important; }';
  document.head.appendChild(style);

  // The earlier legacy loader may have restored browser data before this module loads.
  // Always replace it with the authoritative server state after scripts are ready.
  window.addEventListener('load', function () {
    loadFromServer().then(function () {
      if (typeof window.recompute === 'function') window.recompute(0, (window.O && window.O.ml ? window.O.ml.length - 1 : 0));
      if (typeof window.draw === 'function') window.draw();
      if (window.__setRealCloudBadge) window.__setRealCloudBadge('#059669', '#dcfce7', 'متصل بالخادم — Google Sheets هو المصدر');
    }).catch(function (error) {
      if (window.__setRealCloudBadge) window.__setRealCloudBadge('#dc2626', '#fee2e2', 'تعذر تحميل بيانات الخادم');
      if (typeof Logger !== 'undefined') Logger.warn('Server-only load failed:', error);
    });
  });

  // This listener runs after the legacy one and removes any business data it may write.
  window.addEventListener('beforeunload', clearLegacyBusinessCache);
})();
