
/* ════════════════════════════════════════════════════════════════
   🆕 v230.9+ UNIFIED GOOGLE SHEETS — مودال واحد، تحكم كامل
   ════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  // ============ Storage Keys ============
  const STORAGE_URL    = 'nayef_gs_url_v1';
  const STORAGE_AUTO   = 'nayef_gs_auto_v1';
  const STORAGE_MIN    = 'nayef_gs_minutes_v1';
  const STORAGE_SHEET  = 'nayef_gs_sheet_v1';
  const STORAGE_LAST   = 'nayef_gs_last_v1';

  // ============ State ============
  let gsTimer = null;
  let gsTickHandle = null;
  let gsLatestWorkbook = null;
  let gsSelectedSheet = null;

  // ============ Helpers ============
  function showGSStatus(kind, message) {
    const el = document.getElementById('gs-status');
    if (!el) return;
    el.className = kind;
    el.textContent = message;
  }

  function extractSheetId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
    const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
  }

  function setSyncBar(visible, title, meta) {
    const bar = document.getElementById('gs-sync-bar');
    if (!bar) return;
    if (visible) {
      bar.hidden = false;
      if (title) bar.querySelector('.gs-sync-title').textContent = title;
      if (meta) {
        const m = document.getElementById('gs-sync-meta');
        if (m) m.textContent = meta;
      }
    } else {
      bar.hidden = true;
    }
  }

  function setLastUpdate(date) {
    localStorage.setItem(STORAGE_LAST, date ? date.toISOString() : '');
    if (date) {
      const el = document.getElementById('gs-last-update');
      if (el) {
        el.textContent = new Date(date).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }
  }

  // ============ Direct Download (fallback) ============
  window.directDownloadGS = function() {
    const urlEl = document.getElementById('gs-url');
    const url = urlEl ? urlEl.value : '';
    const sheetId = extractSheetId(url);
    if (!sheetId) {
      showGSStatus('error', '⚠️ لا يوجد رابط صالح');
      return;
    }
    // فتح رابط التحميل في تبويب جديدة
    const downloadUrl = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) + '/export?format=xlsx';
    window.open(downloadUrl, '_blank', 'noopener');
    showGSStatus('loading',
      '⏳ تم فتح تبويب جديد للتحميل المباشر. حمّلي الملف ثم ارفعيه عبر زر "رفع ملف Excel" في الأعلى.'
    );
    // إرشاد المستخدم في الـ status
    setTimeout(function() {
      const st = document.getElementById('gs-status');
      if (st) st.innerHTML = '⏳ تم فتح تبويب التحميل. <b>بعد ما ينزل الملف</b>، اضغطي على <b>"رفع ملف Excel"</b> في الأعلى (الأخضر) واختاري الملف المحفوظ.';
    }, 1200);
  };

  // ============ Sync Engine ============
  async function refreshSheet(silent) {
    const url = localStorage.getItem(STORAGE_URL);
    if (!url) {
      if (!silent) showGSStatus('error', '⚠️ ما في رابط محفوظ');
      return null;
    }
    try {
      const xlsxUrl = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(extractSheetId(url)) + '/export?format=xlsx';
      const response = await fetch(xlsxUrl, { method: 'GET', redirect: 'follow', mode: 'cors' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const buffer = await response.arrayBuffer();
      if (!buffer || buffer.byteLength < 100) throw new Error('الردّ فارغ');

      // 🔍 التحقق من نوع الرد
      const firstBytes = new Uint8Array(buffer.slice(0, 4));
      const isPK = firstBytes[0] === 0x50 && firstBytes[1] === 0x4B;
      const peekStr = String.fromCharCode.apply(null, new Uint8Array(buffer.slice(0, Math.min(50, buffer.byteLength))));
      if (peekStr.trim().toLowerCase().indexOf('<html') === 0 || peekStr.trim().toLowerCase().indexOf('<!doctype') === 0) {
        throw new Error('Google يردّ HTML — تأكدي من صلاحيات المشاركة');
      }
      if (!isPK) throw new Error('الرد ليس XLSX');

      const data = new Uint8Array(buffer);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });

      gsLatestWorkbook = wb;
      setLastUpdate(new Date());

      // Feed to dashboard's main parser
      try {
        if (typeof handleFile === 'function') {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const fakeFile = new File([blob], 'gs-sync.xlsx', { type: blob.type });
          handleFile({ target: { files: [fakeFile] } });
        }
      } catch(e){}

      const meta = document.getElementById('gs-sync-meta');
      if (meta) {
        const t = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        meta.textContent = (silent ? '🔄 تجديد تلقائي' : '✅ تم التحديث') + ' · ' + t;
      }
      return wb;
    } catch (e) {
      if (!silent) showGSStatus('error', '❌ فشل: ' + e.message);
      return null;
    }
  }

  function startAutoSync(minutes) {
    stopAutoSync();
    const ms = Math.max(60, minutes || 5) * 60 * 1000;
    gsTimer = setInterval(() => refreshSheet(true), ms);
    localStorage.setItem(STORAGE_AUTO, '1');
    localStorage.setItem(STORAGE_MIN, String(minutes || 5));
    setSyncBar(true, 'متزامن مع Google Sheets', 'كل ' + (minutes || 5) + ' دقائق · آخر تحديث: للتو');
  }

  function stopAutoSync() {
    if (gsTimer) { clearInterval(gsTimer); gsTimer = null; }
    localStorage.setItem(STORAGE_AUTO, '0');
    setSyncBar(false);
  }

  function tickSyncBar() {
    const last = localStorage.getItem(STORAGE_LAST);
    if (!last) return;
    const diffMs = Date.now() - new Date(last).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const meta = document.getElementById('gs-sync-meta');
    if (meta) {
      if (diffMin < 1) meta.textContent = 'آخر تحديث: قبل لحظات';
      else if (diffMin === 1) meta.textContent = 'آخر تحديث: قبل دقيقة';
      else meta.textContent = 'آخر تحديث: قبل ' + diffMin + ' دقيقة';
    }
  }

  // ============ Connection UI ============
  window.openGoogleSheetsModal = function() {
    const m = document.getElementById('gs-modal');
    if (!m) return;
    m.hidden = false;
    hideProgressiveSections();
    // ✅ لو عندنا رابط محفوظ، نعرضه مسبقاً في الـ input
    setTimeout(function() {
      const i = document.getElementById('gs-url');
      const savedUrl = localStorage.getItem(STORAGE_URL);
      if (i && savedUrl && !i.value) i.value = savedUrl;
      if (i) { i.focus(); i.select(); }
    }, 80);
  };

  window.closeGoogleSheetsModal = function() {
    const m = document.getElementById('gs-modal');
    if (m) {
      // ⚠️ CSS .gs-modal { display: flex } يلغي تأثير hidden attribute!
      // لازم نستخدم style.display صراحة
      m.hidden = true;
      m.style.display = 'none';
    }
    hideProgressiveSections();
  };

  function hideProgressiveSections() {
    const sheets = document.getElementById('gs-sheets-section');
    const sync = document.getElementById('gs-sync-section');
    const fin = document.getElementById('gs-finalize-section');
    if (sheets) sheets.classList.remove('show');
    if (sync) sync.classList.remove('show');
    if (fin) fin.style.display = 'none';
    const status = document.getElementById('gs-status');
    if (status) { status.className = ''; status.style.display = 'none'; status.textContent = ''; }
    // إعادة تفعيز زر الإرسال
    const btn = document.getElementById('gs-submit');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> اتصال وتحميل';
    }
    // إزالة أي hint messages بقايا
    const btnParent = btn ? btn.parentElement : null;
    if (btnParent) {
      btnParent.querySelectorAll('[data-gs-hint]').forEach(function(el) { el.remove(); });
    }
    // 🛡️ safety net: إخفاء أي مودال ثاني للموضوع لو كان موجوداً (من كاش قديم)
    document.querySelectorAll('[id^="gs-auto-"], [id^="gs-settings-"]').forEach(function(el) {
      el.hidden = true;
    });
  }

  // ============ Sheet Picker in Unified Modal ============
  function populateSheetPicker(workbook) {
    const list = document.getElementById('gs-sheets-list');
    const section = document.getElementById('gs-sheets-section');
    if (!list || !section) return;

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      section.classList.remove('show');
      return;
    }

    const saved = localStorage.getItem(STORAGE_SHEET);
    const defaultSheet = (saved && workbook.SheetNames.indexOf(saved) >= 0) ? saved : workbook.SheetNames[0];
    gsSelectedSheet = defaultSheet;

    list.innerHTML = workbook.SheetNames.map(function(name) {
      const safeName = name.replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return '<label class="gs-sheet-row' + (name === defaultSheet ? ' selected' : '') + '" data-name="' + safeName + '">' +
        '<input type="radio" name="gs-sheet-pick" value="' + safeName + '"' + (name === defaultSheet ? ' checked' : '') + ' style="width:16px;height:16px;cursor:pointer">' +
        '<span style="flex:1;font-weight:600;font-size:13px">' + safeName + '</span>' +
        '<span style="font-size:11px;color:var(--c-fg-muted)">شيت</span>' +
      '</label>';
    }).join('');

    // تحديث الـ row عند الضغط
    list.querySelectorAll('.gs-sheet-row').forEach(function(row) {
      row.addEventListener('click', function() {
        list.querySelectorAll('.gs-sheet-row').forEach(function(r) { r.classList.remove('selected'); });
        row.classList.add('selected');
        const radio = row.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        gsSelectedSheet = row.getAttribute('data-name');
        // عند اختيار شيت، يظهر قسم التزامن
        document.getElementById('gs-sync-section').classList.add('show');
        document.getElementById('gs-finalize-section').style.display = 'flex';
      });
    });

    section.classList.add('show');

    // لو شيت واحد فقط → نختاره تلقائياً ونظهر قسم التزامن
    if (workbook.SheetNames.length === 1) {
      setTimeout(function() {
        document.getElementById('gs-sync-section').classList.add('show');
        document.getElementById('gs-finalize-section').style.display = 'flex';
      }, 100);
    }
  }

  // ============ Sync Interval Buttons ============
  function wireIntervalButtons() {
    document.querySelectorAll('.gs-interval-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.gs-interval-btn').forEach(function(b) { b.classList.remove('gs-interval-btn--active'); });
        btn.classList.add('gs-interval-btn--active');
      });
    });
    // توجل التزامن
    const toggle = document.getElementById('gs-auto-toggle');
    const state = document.getElementById('gs-auto-state');
    if (toggle && state) {
      toggle.addEventListener('change', function() {
        state.textContent = toggle.checked ? 'شغّال' : 'متوقف';
        state.style.background = toggle.checked ? 'var(--c-primary)' : '#94a3b8';
      });
    }
  }

  // ============ Finalize (Save & Start Sync) ============
  ;
  
  // === NAIF: زر لصق CSV/TSV من Google Sheets (يعمل بدون CORS) ===
  window.openPasteSheetsModal = function() {
    // 1) أغلق modal الرئيسي
    if (window.closeGoogleSheetsModal) window.closeGoogleSheetsModal();
    
    // 2) أنشئ modal اللصق
    const existing = document.getElementById('paste-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'paste-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:720px;width:100%;max-height:90vh;overflow-y:auto;direction:rtl;font-family:Tahoma,Arial,sans-serif">
        <div style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;padding:18px 24px;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center">
          <div>
            <h2 style="margin:0;font-size:18px">📋 لصق من Google Sheets</h2>
            <p style="margin:4px 0 0;font-size:12px;opacity:0.9">حل بديل يعمل بدون إنترنت — للصق من الحافظة</p>
          </div>
          <button onclick="document.getElementById('paste-modal').remove()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px">✕</button>
        </div>
        <div style="padding:24px">
          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;line-height:1.6">
            <b>📌 طريقة الاستخدام:</b>
            <ol style="margin:8px 0 0 0;padding-right:20px">
              <li>في Google Sheets: <b>ملف ← تنزيل ← قيم مفصولة بفواصل (.csv)</b></li>
              <li>أو: <b>Ctrl+A</b> ثم <b>Ctrl+C</b> في Google Sheets</li>
              <li>الصق هنا في الصندوق أدناه</li>
            </ol>
          </div>
          <textarea id="paste-data" placeholder="الصق بيانات CSV هنا (مفصولة بفواصل أو tabs)..." style="width:100%;height:240px;padding:12px;border:2px solid #e5e7eb;border-radius:8px;font-family:Consolas,Monaco,monospace;font-size:13px;resize:vertical;direction:ltr;text-align:left"></textarea>
          <div id="paste-preview" style="margin-top:12px;display:none;background:#f0f9ff;border:1px solid #0ea5e9;border-radius:8px;padding:12px;font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button onclick="processPasteData()" style="flex:1;padding:12px;background:#059669;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px">✅ معالجة وتحميل</button>
            <button onclick="document.getElementById('paste-data').value='';document.getElementById('paste-preview').style.display='none'" style="padding:12px 18px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;cursor:pointer;font-size:14px">🗑️ مسح</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // live preview
    setTimeout(() => {
      const ta = document.getElementById('paste-data');
      if (ta) ta.addEventListener('input', updatePastePreview);
    }, 100);
  };
  
  window.updatePastePreview = function() {
    const text = document.getElementById('paste-data').value.trim();
    const preview = document.getElementById('paste-preview');
    if (!text) {
      preview.style.display = 'none';
      return;
    }
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const sample = lines.slice(0, 3).map(l => l.split(/[\t,]/).length).join(' | ');
    preview.style.display = 'block';
    preview.innerHTML = '<b>📊 معاينة:</b> ' + lines.length + ' سطر · أعمدة متوقعة في كل سطر: ' + sample;
  };
  
  window.processPasteData = function() {
    try {
      const text = document.getElementById('paste-data').value.trim();
      if (!text) {
        alert('الرجاء لصق البيانات أولاً');
        return;
      }
      
      // تحليل CSV/TSV
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        alert('البيانات يجب أن تحتوي على سطر header وسطر بيانات واحد على الأقل');
        return;
      }
      
      // كشف الفاصل
      const firstLine = lines[0];
      const sep = firstLine.includes('\t') ? '\t' : ',';
      
      // Parse header
      const headers = firstLine.split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
      
      // Parse data
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, j) => row[h] = values[j] || '');
        data.push(row);
      }
      
      // محاولة تحميل كـ Excel-like data
      if (typeof XLSX === 'undefined') {
        alert('مكتبة XLSX غير محمّلة. الرجاء فتح النظام عبر الرابط الرسمي أو إضافة المكتبة يدوياً.');
        return;
      }
      
      // بناء workbook
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data.map(r => headers.map(h => r[h]))]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      
      // تصدير كـ blob
      const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
      const blob = new Blob([wbout], {type: 'application/octet-stream'});
      const file = new File([blob], 'pasted-sheets.xlsx', {type: blob.type});
      
      // استدعاء readFile
      if (typeof window.readFile === 'function') {
        document.getElementById('paste-modal').remove();
        window.readFile(file);
        setTimeout(() => {
          if (typeof showToast === 'function') {
            showToast('✅ تم تحميل ' + data.length + ' صف من البيانات الملصوقة');
          } else {
            alert('✅ تم تحميل ' + data.length + ' صف');
          }
        }, 500);
      } else {
        alert('وظيفة readFile غير متاحة في هذا السياق');
      }
    } catch(e) {
      alert('خطأ في معالجة البيانات: ' + e.message);
      console.error(e);
    }
  };
  window.finalizeGoogleSheet = function() {
    // 1. اقرأ الاختيارات
    const pickedSheetEl = document.querySelector('input[name="gs-sheet-pick"]:checked');
    if (pickedSheetEl) gsSelectedSheet = pickedSheetEl.value;
    const activeInterval = document.querySelector('.gs-interval-btn--active');
    const minutes = activeInterval ? parseInt(activeInterval.dataset.min, 10) : 5;
    const autoOn = document.getElementById('gs-auto-toggle');

    // 2. احفظ في localStorage
    if (gsSelectedSheet) localStorage.setItem(STORAGE_SHEET, gsSelectedSheet);

    // 3. فعّل/أوقف المزامنة
    if (autoOn && autoOn.checked) {
      startAutoSync(minutes);
      try { showToast && showToast('✅ التزامن التلقائي مفعّل · كل ' + minutes + ' دقائق', '', false); } catch(e){}
    } else {
      stopAutoSync();
      try { showToast && showToast('✅ تم الاتصال بنجاح · التزامن التلقائي متوقف', '', false); } catch(e){}
    }

    // 4. أغلق المودال الموحد
    closeGoogleSheetsModal();
  };

  // ============ Connection Logic ============
  window.connectGoogleSheet = async function() {
    const urlEl = document.getElementById('gs-url');
    const btn = document.getElementById('gs-submit');
    const url = urlEl ? urlEl.value : '';
    const sheetId = extractSheetId(url);

    // ✅ DEBUG: تشخيص فوري عبر DOM (يتجاوز console interception)
    const debugLog = function(msg) {
      const dbg = document.getElementById('gs-debug-log');
      if (dbg) {
        const line = document.createElement('div');
        line.style.cssText = 'padding:4px 8px;border-bottom:1px solid var(--c-border);font-size:11px;font-family:monospace;color:var(--c-fg-muted)';
        line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        dbg.appendChild(line);
        dbg.scrollTop = dbg.scrollHeight;
      }
      // أيضاً window.GS debug
      if (window.GS && window.GS.log) window.GS.log(msg);
      // أيضاً raw console (bypass interception)
      try { (window.__rawConsoleLog || console.log).call(console, msg); } catch(e){}
    };

    debugLog('═══ بدء الاتصال ═══');
    debugLog('URL المُدخل: ' + (url ? url.slice(0, 60) + '...' : '(فارغ)'));
    debugLog('Sheet ID المُستخرج: ' + (sheetId || 'فشل'));

    if (!sheetId) {
      showGSStatus('error', '⚠️ الرابط غير صالح. الصق رابط Google Sheet كاملاً أو معرّف الـ Sheet فقط.');
      debugLog('❌ فشل: Sheet ID فارغ');
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ جاري التحميل...';
    showGSStatus('loading', 'جاري تحميل الملف من Google Sheets...');

    const xlsxUrl = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) + '/export?format=xlsx';
    debugLog('رابط XLSX: ' + xlsxUrl);

    try {
      debugLog('⏳ إرسال fetch...');
      const response = await fetch(xlsxUrl, { method: 'GET', redirect: 'follow', mode: 'cors' });
      debugLog('✅ Response: ' + response.status + ' | URL: ' + response.url.slice(0, 80));
      const ct = response.headers.get('content-type');
      debugLog('Content-Type: ' + ct);
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const buffer = await response.arrayBuffer();
      debugLog('Buffer: ' + buffer.byteLength + ' bytes');
      if (!buffer || buffer.byteLength < 100) throw new Error('الردّ فارغ');

      const firstBytes = new Uint8Array(buffer.slice(0, 4));
      const isPK = firstBytes[0] === 0x50 && firstBytes[1] === 0x4B;
      const peekStr = String.fromCharCode.apply(null, new Uint8Array(buffer.slice(0, Math.min(50, buffer.byteLength))));
      debugLog('Magic bytes: ' + Array.from(firstBytes).map(function(b){return b.toString(16).padStart(2,'0');}).join(' '));
      debugLog('First chars: "' + peekStr.trim().slice(0, 40) + '"');

      if (peekStr.trim().toLowerCase().indexOf('<html') === 0 || peekStr.trim().toLowerCase().indexOf('<!doctype') === 0) {
        throw new Error(
          '🚫 Google يردّ HTML!\n' +
          'غالبًا الـ Sheet ليس عاماً. افتحي Google Sheet → Share → "Anyone with link" → Viewer'
        );
      }
      if (!isPK) {
        throw new Error('الردّ ليس XLSX (' + buffer.byteLength + ' بايت من نوع غير معروف)');
      }

      const data = new Uint8Array(buffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      debugLog('✅ XLSX parsed: ' + workbook.SheetNames.length + ' شيت');
      if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('الملف فارغ من الشيتات');
      }

      localStorage.setItem(STORAGE_URL, url);
      gsLatestWorkbook = workbook;

      let used = false;
      try {
        if (typeof window.readFile === 'function') {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const fakeFile = new File([blob], 'google-sheet.xlsx', { type: blob.type });
          debugLog('📤 استدعاء readFile() مع File بحجم ' + blob.size + ' بايت');
          window.readFile(fakeFile);
          used = true;
          debugLog('✅ readFile() نجح - تم تمرير البيانات للنظام');
        } else if (typeof window.handleFile === 'function') {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const fakeFile = new File([blob], 'google-sheet.xlsx', { type: blob.type });
          window.handleFile({ target: { files: [fakeFile] } });
          used = true;
          debugLog('✅ handleFile() نجح (fallback)');
        } else {
          debugLog('⚠️ readFile و handleFile كلاهما غير موجود');
        }
      } catch(e){
        debugLog('❌ خطأ في الاستدعاء: ' + e.message);
      }
      debugLog('═══ اكتمل بنجاح ═══');

      // 🚪 إغلاق فوري + تحديث الـ dashboard
      debugLog('🚪 إغلاق المودال فوراً...');
      // 1. حفظ الـ URL + تفعيل المزامنة التلقائية (5 دقائق افتراضياً)
      localStorage.setItem(STORAGE_URL, url);
      gsLatestWorkbook = workbook;
      // 2. 🆕 v230.9.6+ Auto-enable sync on first connect (حتى لا يطلب من المستخدم)
      const existingAuto = localStorage.getItem(STORAGE_AUTO);
      if (existingAuto !== '0') {
        startAutoSync(5);
        debugLog('✅ Auto-sync enabled (5 min) — الرابط محفوظ تلقائياً');
      }
      // 3. إغلاق المودال (يستخدم display:none صراحة لأنه يتغلب على CSS display:flex)
      closeGoogleSheetsModal();
      // 3. اعرض toast نجاح
      try {
        showToast('✅ ' + workbook.SheetNames.length + ' شيت من Google تم تحميلها — الداشبورد تحدّث',
                   'افتحي الزر ⚙️ على شريط التزامن لتغيير الفترة', false);
      } catch(e){}
      // 4. ابقَ الـ workbook محفوظاً في الذاكرة
      debugLog('💡 لاستبدال الشيت: افتحي الزر ⚙️ في شريط التزامن');

      const sheetList = workbook.SheetNames.join('، ');
      if (used) {
        showGSStatus('success', '✅ تم الاتصال! ' + workbook.SheetNames.length + ' شيت: ' + sheetList);
        // ✅ تكشف الأقسام الإضافية في نفس المودال
        populateSheetPicker(workbook);
        wireIntervalButtons();
        setLastUpdate(new Date());

        // إخفاء زر الاتصال نفسه (لأن الخطوة تمت)
        btn.style.display = 'none';
        // إظهار نص للمستخدم
        const hint = document.createElement('div');
        hint.style.cssText = 'margin-top:10px;padding:8px 12px;background:var(--c-primary-soft);color:var(--c-primary);border-radius:6px;font-size:12px;text-align:center;font-weight:700';
        hint.textContent = '↓ اختر شيت ثم اضغط "حفظ وتفعيل" ↓';
        btn.parentElement.appendChild(hint);
      } else {
        showGSStatus('error',
          '⚠️ تم تحميل ' + workbook.SheetNames.length + ' شيت لكن النظام لم يستطع تفعيله تلقائياً. ارفعي الملف يدوياً.'
        );
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> اتصال وتحميل';
      }
    } catch (e) {
      showGSStatus('error', '❌ فشل: ' + (e.message || 'خطأ غير معروف') + '. تأكدي من صلاحيات المشاركة.');
      btn.disabled = false;
      btn.innerHTML = '🔄 إعادة المحاولة';
      // إظهار زر التحميل المباشر كـ fallback
      const dlBtn = document.getElementById('gs-direct-download');
      if (dlBtn) dlBtn.style.display = 'inline-flex';
    }
  };

  // ============ Status Bar Controls ============
  window.manualRefreshGS = function() {
    refreshSheet(false);
  };

  window.startAutoSync = startAutoSync;
  window.stopAutoSync = function() {
    stopAutoSync();
    try { showToast && showToast('⏸ تم إيقاف التزامن التلقائي', '', false); } catch(e){}
  };

  // ============ Auto-Connect from Query Parameter ============
  function applyURLParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      // ?gs=URL → pre-fill localStorage
      const gsUrl = params.get('gs');
      if (gsUrl && !gsUrl.match(/javascript:/i)) {
        // التحقق من أنه URL صحيح
        try {
          new URL(gsUrl);
          localStorage.setItem(STORAGE_URL, gsUrl);
          // محاولة فك تشفير ?sheet= أيضاً
          const sheet = params.get('sheet');
          if (sheet) localStorage.setItem(STORAGE_SHEET, sheet);
          const minutes = parseInt(params.get('min') || '5', 10);
          localStorage.setItem(STORAGE_MIN, String(minutes));
          const auto = params.get('auto');
          if (auto === '1' || auto === 'true') localStorage.setItem(STORAGE_AUTO, '1');
          // عرض إشعار للمستخدم
          setTimeout(function() {
            try {
              showToast('✅ تم حفظ الرابط. افتحي زرّ "ربط Google Sheets" أو سأبدأ المزامنة تلقائياً خلال 5 ثوانٍ.', '', false);
            } catch(e){}
            // بعد 5 ثوانٍ ابدأ المزامنة تلقائياً لو طُلب
            if (params.get('auto') === '1') {
              setTimeout(function() {
                startAutoSync(minutes);
                setTimeout(function() { refreshSheet(true); }, 1000);
              }, 5000);
            }
          }, 2000);
        } catch(e){}
      }
    } catch(e){}
  }

  // ============ Boot ============
  function boot() {
    applyURLParams();  // ✅ يستقبل gs=... من URL
    const last = localStorage.getItem(STORAGE_LAST);
    if (last) tickSyncBar();

    if (gsTickHandle) clearInterval(gsTickHandle);
    gsTickHandle = setInterval(tickSyncBar, 30000);

    // 🆕 v230.9.6+ Auto-persist: إذا في URL محفوظ، نفعّل المزامنة التلقائية تلقائياً
    const url = localStorage.getItem(STORAGE_URL);
    if (url) {
      const minutes = parseInt(localStorage.getItem(STORAGE_MIN) || '5', 10);
      const auto = localStorage.getItem(STORAGE_AUTO);
      
      // أظهر indicator أن الرابط محفوظ
      setSyncBar(true, '🔗 Google Sheet محفوظ', 'جاري الاتصال التلقائي...');
      
      // جدد بعد 3 ثوان (silent) - يعمل حتى لو STORAGE_AUTO='0'
      setTimeout(function() {
        refreshSheet(true).then(function() {
          // إذا نجح، فعل المزامنة الدورية
          if (auto !== '0') {
            startAutoSync(minutes);
            console.log('✅ [GS] Auto-sync enabled for', url.slice(0, 50));
          }
        }).catch(function(e) {
          console.warn('⚠️ [GS] Auto-refresh failed:', e.message);
        });
      }, 3000);
    }
    gsSelectedSheet = localStorage.getItem(STORAGE_SHEET);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 100);
  }

  // ============ Escape / Click outside ============
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const m = document.getElementById('gs-modal');
      if (m && !m.hidden) closeGoogleSheetsModal();
    }
  });
  document.addEventListener('click', function(e) {
    const m = document.getElementById('gs-modal');
    if (m && !m.hidden && e.target === m) closeGoogleSheetsModal();
  });

  // ============ Debug API ============
  window.GS = {
    getLatestWorkbook: () => gsLatestWorkbook,
    getSelectedSheet: () => gsSelectedSheet,
    refresh: refreshSheet,
    setSheet: function(s) { gsSelectedSheet = s; localStorage.setItem(STORAGE_SHEET, s); },
    log: function(msg) {
      // التجاوز عبر أي console interception من النظام
      try {
        var origLog = Function.prototype.bind.call(console.log, console);
        origLog('[GS]', msg);
      } catch(e){}
    }
  };
  // حفظ دالة console.log الأصلية للاستخدام في التشخيص
  try { window.__rawConsoleLog = Function.prototype.bind.call(console.log, console); } catch(e){}

})();
