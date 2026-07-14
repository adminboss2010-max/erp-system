
function openReportsCenter() {
  if (typeof D === 'undefined' || !D.soc) {
    if (typeof showToast === 'function') showToast('لا توجد بيانات', 'يرجى رفع ملف Excel أولاً', true);
    return;
  }
  var el = document.getElementById('reportsCenter');
  if (!el) return;
  el.style.display = 'grid';
  renderReportsTemplates();
  renderReportsHistory();
  renderReportsSchedules();
  if(typeof renderReportsInvoicesList === 'function') renderReportsInvoicesList();
  populateInvoiceTeamSelect();
  populateInvoiceClientSelect();
}

function closeReportsCenter() {
  var el = document.getElementById('reportsCenter');
  if (el) el.style.display = 'none';
}

function switchRcTab(tab) {
  document.querySelectorAll('.reports-tab').forEach(function(t) {
    t.classList.toggle('reports-tab--active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.reports-tab-content').forEach(function(c) {
    c.classList.toggle('reports-tab-content--active', c.dataset.tab === tab);
  });
}

function renderReportsTemplates() {
  var grid = document.getElementById('reportsTemplatesGrid');
  if (!grid || typeof ReportsEngine === 'undefined') return;
  var templates = ReportsEngine.TEMPLATES;
  var cards = [];
  for (var key in templates) {
    if (!templates.hasOwnProperty(key)) continue;
    var t = templates[key];
    var html = '<div class="report-template-card">';
    html += '<div class="report-template-card__icon">' + renderIcon(t.icon, 24, 'white') + '</div>';
    html += '<h4 class="report-template-card__name">' + t.name + '</h4>';
    html += '<p class="report-template-card__desc">' + t.description + '</p>';
    html += '<div class="report-template-card__actions">';
    html += '<button data-action="pdf" data-id="' + t.id + '" title="PDF">' + renderIcon('pdf', 14) + ' PDF</button>';
    html += '<button data-action="excel" data-id="' + t.id + '" title="Excel">' + renderIcon('excel', 14) + ' Excel</button>';
    html += '<button data-action="email" data-id="' + t.id + '" title="Email">' + renderIcon('mail', 14) + ' Email</button>';
    html += '</div></div>';
    cards.push(html);
  }
  grid.innerHTML = cards.join('');

  grid.querySelectorAll('button[data-action]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      doReportExport(btn.getAttribute('data-id'), btn.getAttribute('data-action'));
    });
  });

  var sel = document.getElementById('schTemplate');
  if (sel) {
    var opts = [];
    for (var k2 in templates) {
      if (templates.hasOwnProperty(k2)) {
        opts.push('<option value="' + templates[k2].id + '">' + templates[k2].name + '</option>');
      }
    }
    sel.innerHTML = opts.join('');
  }
}

function renderReportsHistory() {
  var list = document.getElementById('reportsHistoryList');
  if (!list) return;
  var history = ReportsEngine.getHistory();
  if (history.length === 0) {
    list.innerHTML = '<div class="empty-state">لا توجد تقارير سابقة</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < history.length; i++) {
    var h = history[i];
    var t = ReportsEngine.TEMPLATES[h.template];
    html += '<div class="report-history-item">';
    html += '<div>';
    html += '<div class="report-history-item__name">' + (t ? t.name : h.template) + ' - ' + h.format.toUpperCase() + '</div>';
    html += '<div class="report-history-item__meta">' + new Date(h.timestamp).toLocaleString('ar-KW') + '</div>';
    html += '</div>';
    html += '<div class="report-history-item__actions">';
    html += '<button data-rptid="' + h.id + '" data-action="delete" title="حذف">✕</button>';
    html += '</div></div>';
  }
  list.innerHTML = html;

  list.querySelectorAll('button[data-action="delete"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.getAttribute('data-rptid');
      var history = ReportsEngine.getHistory();
      var filtered = history.filter(function(h) { return h.id !== id; });
      try { localStorage.setItem('nayef_reports', JSON.stringify(filtered)); } catch(e) {}
      renderReportsHistory();
    });
  });
}

function renderReportsSchedules() {
  var list = document.getElementById('reportsSchedulesList');
  if (!list) return;
  var schedules = ReportsEngine.getSchedules();
  if (schedules.length === 0) {
    list.innerHTML = '<div class="empty-state">لا توجد تقارير مجدولة</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < schedules.length; i++) {
    var s = schedules[i];
    var t = ReportsEngine.TEMPLATES[s.template];
    html += '<div class="report-schedule-item">';
    html += '<div>';
    html += '<div class="report-schedule-item__name">' + (t ? t.name : s.template) + ' - ' + s.frequency + '</div>';
    html += '<div class="report-schedule-item__meta">' + s.format.toUpperCase() + '</div>';
    html += '</div>';
    html += '<div class="report-schedule-item__actions">';
    html += '<button data-schid="' + s.id + '" title="حذف">✕</button>';
    html += '</div></div>';
  }
  list.innerHTML = html;

  list.querySelectorAll('button[data-schid]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      ReportsEngine.removeSchedule(btn.getAttribute('data-schid'));
      renderReportsSchedules();
    });
  });
}

function doReportExport(templateId, format) {
  try {
    if (format === 'pdf') ReportsEngine.exportPDF(templateId);
    else if (format === 'excel') ReportsEngine.exportExcel(templateId);
    else if (format === 'email') ReportsEngine.exportEmail(templateId);
    ReportsEngine.saveToHistory(templateId, format);
    setTimeout(renderReportsHistory, 500);
  } catch (e) {
    if (typeof showToast === 'function') showToast('فشل التصدير', e.message, true);
    else alert('فشل التصدير: ' + e.message);
  }
}

function addSchedule() {
  var template = document.getElementById('schTemplate').value;
  var frequency = document.getElementById('schFrequency').value;
  var format = document.getElementById('schFormat').value;
  var recipients = document.getElementById('schRecipients').value;
  ReportsEngine.scheduleReport({ template: template, frequency: frequency, format: format, recipients: recipients });
  if (typeof showToast === 'function') showToast('تمت الجدولة', 'سيتم إنشاء التقرير تلقائياً', false);
  renderReportsSchedules();
}

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    e.preventDefault();
    openReportsCenter();
  }
  if (e.key === 'Escape') {
    var rc = document.getElementById('reportsCenter');
    if (rc && rc.style.display !== 'none') closeReportsCenter();
  }
});


// ═════════════════════════════════════════════════════════════════════
//  🎨 BACKGROUND THEME SWITCHER — تبديل سمات الخلفية
// ═════════════════════════════════════════════════════════════════════
function setBgTheme(theme) {
  document.documentElement.setAttribute('data-bg-theme', theme);
  document.querySelectorAll('.bg-theme-btn').forEach(btn => {
    btn.classList.toggle('bg-theme-btn--active', btn.dataset.bg === theme);
  });
  try { localStorage.setItem('nayef_bg_theme', theme); } catch(e) {}
  if (typeof showToast === 'function') {
    const labels = {sunset: 'غروب 🌅', ocean: 'محيط 🌊', forest: 'غابة 🌲', royal: 'ملكي 👑', mesh: 'شبكة ✨', navy: 'كحلي فاخر ✨'};
    showToast('سمة الخلفية', labels[theme] || theme, false);
  }
}

// استرجاع السمة المحفوظة عند التحميل
(function initBgTheme() {
  try {
    const saved = localStorage.getItem('nayef_bg_theme');
    if (saved) {
      setBgTheme(saved);
    }
  } catch(e) {}
})();




// ═════════════════════════════════════════════════════════════════════
//  🧾 INVOICE V2 UI FUNCTIONS — إدخال يدوي + تلقائي
// ═════════════════════════════════════════════════════════════════════

// Manual items array (يدوي)
let _manualItems = [];

function onClientSelected() {
  var client = document.getElementById('invoiceClient').value;
  var mode = document.getElementById('invoiceFillMode').value;
  if (!client) return;
  
  if (mode === 'manual') {
    // عرض الفاتورة التلقائية كاقتراح، المستخدم يمكنه التعديل
    var autoItems = typeof InvoiceEngine !== 'undefined' ? InvoiceEngine.getAutoItemsForClient(client) : [];
    if (autoItems.length > 0 && _manualItems.length === 0) {
      _manualItems = autoItems.map(function(it) {
        return {
          code: it.code,
          name: it.name,
          nameEn: it.nameEn || '',
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: 0,
          isFree: false,
          notes: ''
        };
      });
      renderManualItems();
    }
  }
}

function onFillModeChanged() {
  var mode = document.getElementById('invoiceFillMode').value;
  var manualArea = document.getElementById('manualItemsArea');
  if (mode === 'manual') {
    manualArea.style.display = 'block';
    if (_manualItems.length === 0) {
      _manualItems = [{ code: '', name: '', nameEn: '', unit: 'قطعة', quantity: 1, unitPrice: 0, discount: 0, isFree: false, notes: '' }];
      renderManualItems();
    } else {
      renderManualItems();
    }
  } else {
    manualArea.style.display = 'none';
  }
}

function addManualItem() {
  _manualItems.push({
    code: '',
    name: '',
    nameEn: '',
    unit: 'قطعة',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    isFree: false,
    notes: ''
  });
  renderManualItems();
}

function removeManualItem(idx) {
  _manualItems.splice(idx, 1);
  if (_manualItems.length === 0) {
    _manualItems.push({ code: '', name: '', nameEn: '', unit: 'قطعة', quantity: 1, unitPrice: 0, discount: 0, isFree: false, notes: '' });
  }
  renderManualItems();
}

function renderManualItems() {
  var list = document.getElementById('manualItemsList');
  if (!list) return;
  
  var html = '';
  var totalAll = 0;
  
  _manualItems.forEach(function(it, idx) {
    var lineTotal = (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0);
    var discountAmount = lineTotal * (parseFloat(it.discount) || 0) / 100;
    var finalTotal = lineTotal - discountAmount;
    totalAll += finalTotal;
    
    html += '<div style="display:grid;grid-template-columns:30px 70px 1fr 60px 60px 80px 60px 30px;gap:6px;margin-bottom:6px;align-items:center;padding:6px;background:var(--canvas-bg-alt);border-radius:6px">';
    html += '<span style="font-size:11px;color:var(--text-uniform-2);text-align:center">' + (idx + 1) + '</span>';
    html += '<input type="text" value="' + escapeAttr(it.code) + '" placeholder="الكود" onchange="updateManualItem(' + idx + ',\'code\',this.value)" style="padding:4px;border-radius:4px;border:1px solid var(--line-soft);background:var(--canvas-bg);font-size:10px;font-family:\'Inter\',monospace">';
    html += '<input type="text" value="' + escapeAttr(it.name) + '" placeholder="اسم الصنف *" onchange="updateManualItem(' + idx + ',\'name\',this.value)" style="padding:4px;border-radius:4px;border:1px solid var(--line-soft);background:var(--canvas-bg);font-size:11px">';
    html += '<input type="text" value="' + escapeAttr(it.unit) + '" placeholder="وحدة" onchange="updateManualItem(' + idx + ',\'unit\',this.value)" style="padding:4px;border-radius:4px;border:1px solid var(--line-soft);background:var(--canvas-bg);font-size:10px;text-align:center">';
    html += '<input type="number" value="' + (it.quantity || 0) + '" placeholder="الكمية *" min="0" step="any" onchange="updateManualItem(' + idx + ',\'quantity\',parseFloat(this.value))" style="padding:4px;border-radius:4px;border:1px solid var(--line-soft);background:var(--canvas-bg);font-size:11px;text-align:center">';
    html += '<input type="number" value="' + (it.unitPrice || 0) + '" placeholder="السعر" min="0" step="any" onchange="updateManualItem(' + idx + ',\'unitPrice\',parseFloat(this.value))" style="padding:4px;border-radius:4px;border:1px solid var(--line-soft);background:var(--canvas-bg);font-size:10px;text-align:center">';
    html += '<div style="display:flex;align-items:center;gap:4px">';
    html += '<input type="number" value="' + (it.discount || 0) + '" placeholder="خصم%" min="0" max="100" onchange="updateManualItem(' + idx + ',\'discount\',parseFloat(this.value))" style="width:36px;padding:4px;border-radius:4px;border:1px solid var(--line-soft);background:var(--canvas-bg);font-size:10px;text-align:center">';
    html += '<button onclick="toggleFreeItem(' + idx + ')" title="مجاني" style="background:' + (it.isFree ? 'var(--success-100)' : 'var(--canvas-bg)') + ';border:1px solid ' + (it.isFree ? 'var(--success-300)' : 'var(--line-soft)') + ';padding:3px 6px;border-radius:4px;cursor:pointer;font-size:10px">🎁</button>';
    html += '</div>';
    html += '<button onclick="removeManualItem(' + idx + ')" style="background:var(--danger-100);border:1px solid var(--danger-300);color:var(--danger-700);padding:3px 6px;border-radius:4px;cursor:pointer;font-size:11px">✕</button>';
    html += '</div>';
  });
  
  list.innerHTML = html;
  var totalDisplay = document.getElementById('manualTotalDisplay');
  if (totalDisplay) {
    totalDisplay.textContent = formatNumberForManual(totalAll) + ' د.ك';
  }
}

function escapeAttr(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatNumberForManual(n) {
  return parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function updateManualItem(idx, field, value) {
  if (_manualItems[idx]) {
    _manualItems[idx][field] = value;
    renderManualItems();
  }
}

function toggleFreeItem(idx) {
  if (_manualItems[idx]) {
    _manualItems[idx].isFree = !_manualItems[idx].isFree;
    if (_manualItems[idx].isFree) {
      _manualItems[idx].unitPrice = 0;
    }
    renderManualItems();
  }
}

function generateSingleInvoice() {
  if (typeof D === 'undefined' || !D.soc) {
    if (typeof showToast === 'function') showToast('لا توجد بيانات', 'يرجى رفع ملف Excel أولاً', true);
    return;
  }
  
  var client = document.getElementById('invoiceClient').value;
  if (!client) {
    if (typeof showToast === 'function') showToast('حدد العميل', 'يرجى اختيار عميل', true);
    return;
  }
  
  var mode = document.getElementById('invoiceFillMode').value;
  var dueDays = parseInt(document.getElementById('invoiceDueDays').value) || 30;
  
  var options = { dueDays: dueDays };
  
  if (mode === 'manual') {
    // استخدم العناصر المُدخلة يدوياً
    var validItems = _manualItems.filter(function(it) {
      return it.name && parseFloat(it.quantity) > 0;
    });
    if (validItems.length === 0) {
      if (typeof showToast === 'function') showToast('لا توجد عناصر', 'أضف صنف واحد على الأقل مع الكمية', true);
      return;
    }
    options.items = validItems;
  }
  
  var invoice = InvoiceEngine.createAndShowInvoice(client, options);
  if (invoice) {
    if (typeof showToast === 'function') showToast('تم إنشاء الفاتورة', invoice.number, false);
    setTimeout(renderReportsInvoicesList, 500);
  }
}

function previewInvoiceData() {
  if (typeof D === 'undefined' || !D.soc) {
    if (typeof showToast === 'function') showToast('لا توجد بيانات', 'يرجى رفع ملف Excel أولاً', true);
    return;
  }
  
  var client = document.getElementById('invoiceClient').value;
  if (!client) {
    if (typeof showToast === 'function') showToast('حدد العميل', 'يرجى اختيار عميل', true);
    return;
  }
  
  var mode = document.getElementById('invoiceFillMode').value;
  var dueDays = parseInt(document.getElementById('invoiceDueDays').value) || 30;
  
  var options = { dueDays: dueDays };
  if (mode === 'manual') {
    options.items = _manualItems.filter(function(it) { return it.name && parseFloat(it.quantity) > 0; });
  }
  
  var invoice = InvoiceEngine.buildInvoice(client, options);
  
  var preview = document.getElementById('invoicePreviewArea');
  var html = '<div style="background:var(--canvas-bg);border:1px solid var(--line-soft);border-radius:12px;padding:16px;margin-top:8px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--line-soft)">';
  html += '<strong>🧾 معاينة الفاتورة لـ ' + escapeHtml(client) + '</strong>';
  html += '<div style="display:flex;gap:12px;font-size:12px;color:var(--text-uniform-2)">';
  html += '<span>عدد الأصناف: <b>' + invoice.items.length + '</b></span>';
  html += '<span>المجموع: <b>' + (typeof Currency !== 'undefined' ? Currency.format(invoice.totals.subtotal) : invoice.totals.subtotal) + '</b></span>';
  if (invoice.totals.discount > 0) html += '<span>الخصم: <b>−' + invoice.totals.discount.toFixed(3) + '</b></span>';
  html += '<span>الإجمالي: <b style="color:var(--brand-600)">' + invoice.totals.afterDiscount.toFixed(3) + ' د.ك</b></span>';
  html += '</div></div>';
  html += '<table style="width:100%;font-size:11px;border-collapse:collapse">';
  html += '<thead><tr style="background:var(--canvas-bg-alt)"><th style="padding:6px;text-align:right">#</th><th style="padding:6px;text-align:right">الصنف</th><th style="padding:6px;text-align:center">الكمية</th><th style="padding:6px;text-align:left">السعر</th><th style="padding:6px;text-align:left">الإجمالي</th></tr></thead>';
  html += '<tbody>';
  invoice.items.forEach(function(it, i) {
    var lineTotal = it.quantity * it.unitPrice;
    var discountAmount = lineTotal * (it.discount || 0) / 100;
    var final = lineTotal - discountAmount;
    html += '<tr style="border-bottom:1px solid var(--line-soft)">';
    html += '<td style="padding:6px">' + (i + 1) + '</td>';
    html += '<td style="padding:6px">' + (it.name || '—') + (it.isFree ? ' 🎁' : '') + '</td>';
    html += '<td style="padding:6px;text-align:center">' + it.quantity + '</td>';
    html += '<td style="padding:6px;text-align:left">' + (it.isFree ? '<span style="color:var(--success-600);font-weight:700">مجاني</span>' : it.unitPrice.toFixed(3)) + '</td>';
    html += '<td style="padding:6px;text-align:left"><b>' + final.toFixed(3) + '</b></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<div style="margin-top:12px;padding:8px;background:linear-gradient(135deg,var(--olive-50),var(--olive-100));border-radius:6px;text-align:center;font-size:11px;color:var(--olive-700)">';
  html += '✅ معفى من الضريبة - الكويت لا تفرض ضريبة على هذه المعاملات';
  html += '</div>';
  html += '</div>';
  
  preview.innerHTML = html;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

