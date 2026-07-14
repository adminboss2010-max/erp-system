
// ═══════════════════════════════════════════════════════════════════
// 🆕 LOCKED v220.1+: نظام الإدخال والتعديل اليدوي الكامل
// ═══════════════════════════════════════════════════════════════════

// --- 1) فتح modal إضافة معاملة ---
window.openV220AddTx = function() {
  if (typeof O === "undefined" || !O || !O.soc) {
    alert("⚠️ النظام لم يكتمل تحميله. حاول بعد ثانيتين.");
    return;
  }
  var opts = (O.soc || []).map(function(s) {
    return '<option value="' + s.nm + '">' + s.nm + '</option>';
  }).join("");
  var overlay = document.createElement("div");
  overlay.id = "addTxV220";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto";
  overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:520px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,0.4)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:2px solid #27ae60;padding-bottom:10px"><h2 style="margin:0;color:#1e3a5f">➕ إضافة معاملة جديدة</h2><button onclick="document.getElementById(\'addTxV220\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999">✕</button></div><div style="display:flex;flex-direction:column;gap:14px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label><span style="color:#555;font-size:12px">التاريخ</span><input type="date" id="v220tx_date" value="' + new Date().toISOString().slice(0,10) + '" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label><label><span style="color:#555;font-size:12px">رقم الفاتورة</span><input type="number" id="v220tx_inv" placeholder="اختياري" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label></div><label><span style="color:#555;font-size:12px">العميل</span><select id="v220tx_client" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px">' + opts + '</select></label><label><span style="color:#555;font-size:12px">النوع</span><select id="v220tx_type" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"><option value="sale">🟢 فاتورة مبيعات (مدين +)</option><option value="return">🟠 مرتجع (دائن -)</option><option value="payment">🔵 شيك / دفع (دائن -)</option></select></label><label><span style="color:#555;font-size:12px">المبلغ (د.ك)</span><input type="number" step="0.001" id="v220tx_amount" placeholder="0.000" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label><label><span style="color:#555;font-size:12px">المندوب (اختياري)</span><input type="text" id="v220tx_ag" placeholder="اتركه فارغاً" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label></div><div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end"><button onclick="document.getElementById(\'addTxV220\').remove()" style="padding:10px 20px;background:#95a5a6;color:#fff;border:none;border-radius:6px;cursor:pointer">إلغاء</button><button onclick="saveV220Tx()" style="padding:10px 20px;background:#27ae60;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold">💾 حفظ المعاملة</button></div></div>';
  document.body.appendChild(overlay);
};

window.saveV220Tx = function() {
  var dt = document.getElementById("v220tx_date").value;
  var inv = parseInt(document.getElementById("v220tx_inv").value) || 0;
  var client = document.getElementById("v220tx_client").value;
  var type = document.getElementById("v220tx_type").value;
  var amount = parseFloat(document.getElementById("v220tx_amount").value) || 0;
  var ag = document.getElementById("v220tx_ag").value.trim() || "إدخال يدوي";
  if (!dt) { alert("⚠️ اختر التاريخ"); return; }
  if (!client) { alert("⚠️ اختر العميل"); return; }
  if (amount === 0) { alert("⚠️ أدخل المبلغ"); return; }
  // 🆕 v220.1+ LOCKED: التحقق الصارم
  if(typeof Validator !== 'undefined') {
    var newTxForCheck = { dt: dt, client: client, amount: amount, tp: type };
    var validation = Validator.validateTx(newTxForCheck);
    if(!Validator.showResult(validation)) return;
  }
  if (!O.tx) O.tx = [];
  var newTx = { id: "TX-LK-" + Date.now(), dt: dt, client: client, cl: client, i: inv, items: [["R-MAN", 1, amount, amount]], amount: amount, cost: 0, tp: type, ag: ag, source: "manual" };
  O.tx.push(newTx);
  // 🆕 v220.1+ LOCKED: تسجيل في Audit Trail
  if(typeof AuditLog !== 'undefined') AuditLog.log('add_tx', { client: client, amount: amount, dt: dt, type: type });
  var soc = O.soc.find(function(x) { return x.nm === client; });
  if (soc && (!soc.li || dt > soc.li)) soc.li = dt;
  if (typeof nayefSaveData === "function") nayefSaveData();
  try { if (typeof initFilter === "function") initFilter(); } catch(e) {}
  try { if (typeof sw === "function") sw("ov"); } catch(e) {}
  try { if (typeof updateRefreshBtn === "function") updateRefreshBtn(); } catch(e) {}
  document.getElementById("addTxV220").remove();
  alert("✅ تمت إضافة المعاملة بنجاح\n\nالتاريخ: " + dt + "\nالعميل: " + client + "\nالمبلغ: " + amount.toFixed(3) + " د.ك");
};

window.openV220AddClient = function() {
  if (typeof O === "undefined" || !O) { alert("⚠️ النظام لم يكتمل تحميله."); return; }
  var overlay = document.createElement("div");
  overlay.id = "addClV220";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px";
  overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:520px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.4)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:2px solid #2980b9;padding-bottom:10px"><h2 style="margin:0;color:#1e3a5f">🏢 إضافة عميل جديد</h2><button onclick="document.getElementById(\'addClV220\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999">✕</button></div><div style="display:flex;flex-direction:column;gap:14px"><label><span style="color:#555;font-size:12px">اسم العميل *</span><input type="text" id="v220cl_nm" placeholder="مثال: جمعية الفحيحيل" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label><span style="color:#555;font-size:12px">الهاتف</span><input type="text" id="v220cl_ph" placeholder="+965 ..." style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label><label><span style="color:#555;font-size:12px">المنطقة</span><input type="text" id="v220cl_rg" value="الكويت" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label><span style="color:#555;font-size:12px">المندوب</span><input type="text" id="v220cl_ag" placeholder="اسم المندوب" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label><label><span style="color:#555;font-size:12px">الرصيد الافتتاحي</span><input type="number" step="0.001" id="v220cl_ob" value="0" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px"></label></div></div><div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end"><button onclick="document.getElementById(\'addClV220\').remove()" style="padding:10px 20px;background:#95a5a6;color:#fff;border:none;border-radius:6px;cursor:pointer">إلغاء</button><button onclick="saveV220Client()" style="padding:10px 20px;background:#2980b9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold">💾 حفظ العميل</button></div></div>';
  document.body.appendChild(overlay);
};

window.saveV220Client = function() {
  var nm = document.getElementById("v220cl_nm").value.trim();
  if (!nm) { alert("⚠️ أدخل اسم العميل"); return; }
  if (!O.soc) O.soc = [];
  if (O.soc.some(function(s) { return s.nm === nm; })) { alert("⚠️ يوجد عميل بنفس الاسم: " + nm); return; }
  var ob = parseFloat(document.getElementById("v220cl_ob").value) || 0;
  var newClient = { i: (O.soc.length || 0) + 1, nm: nm, phone: document.getElementById("v220cl_ph").value.trim(), reg: document.getElementById("v220cl_rg").value.trim() || "الكويت", ag: document.getElementById("v220cl_ag").value.trim() || "غير محدد", op: ob, ob: ob, ot: ob, s: 0, co: 0, pr: 0, c: 0, q: 0, rt: 1, li: "", lc: "", nt: "عميل جديد - إدخال يدوي", source: "manual" };
  O.soc.push(newClient);
  if (typeof nayefSaveData === "function") nayefSaveData();
  try { if (typeof initFilter === "function") initFilter(); } catch(e) {}
  try { if (typeof sw === "function") sw("ov"); } catch(e) {}
  try { if (typeof updateRefreshBtn === "function") updateRefreshBtn(); } catch(e) {}
  document.getElementById("addClV220").remove();
  alert("✅ تمت إضافة العميل: " + nm + "\n\nالرصيد الافتتاحي: " + ob.toFixed(3) + " د.ك");
};

window.openV220EditMode = function() {
  if (typeof O === "undefined" || !O || !O.tx) { alert("⚠️ النظام لم يكتمل تحميله."); return; }
  var txList = (O.tx || []).slice(-30).reverse();
  var clList = (O.soc || []).slice();
  var overlay = document.createElement("div");
  overlay.id = "editV220";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto";
  var txRows = txList.map(function(t, idx) {
    var realIdx = O.tx.length - 1 - idx;
    return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">' + (t.dt || "—") + '</td><td style="padding:6px">' + (t.client || t.cl || "—") + '</td><td style="padding:6px">' + (t.i || 0) + '</td><td style="padding:6px">' + (t.amount || 0).toFixed(3) + '</td><td style="padding:6px">' + (t.tp === "sale" ? "🟢 مبيع" : t.tp === "return" ? "🟠 مرتجع" : t.tp === "payment" ? "🔵 شيك" : (t.tp || "—")) + '</td><td style="padding:6px"><button onclick="editTxV220(' + realIdx + ')" style="background:#f39c12;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">✏️</button> <button onclick="deleteTxV220(' + realIdx + ')" style="background:#c0392b;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">🗑️</button></td></tr>';
  }).join("");
  var clRows = clList.map(function(c, idx) {
    return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">' + (c.nm || "—") + '</td><td style="padding:6px">' + (c.ag || "—") + '</td><td style="padding:6px">' + (c.phone || "—") + '</td><td style="padding:6px">' + (c.ob || 0).toFixed(3) + '</td><td style="padding:6px"><button onclick="editClientV220(' + idx + ')" style="background:#f39c12;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">✏️</button> <button onclick="deleteClientV220(' + idx + ')" style="background:#c0392b;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">🗑️</button></td></tr>';
  }).join("");
  overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:900px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,0.4)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:2px solid #f39c12;padding-bottom:10px"><h2 style="margin:0;color:#1e3a5f">✏️ تعديل البيانات</h2><button onclick="document.getElementById(\'editV220\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999">✕</button></div><div style="margin-bottom:20px"><h3 style="color:#2980b9;border-bottom:1px solid #2980b9;padding-bottom:6px">📋 آخر 30 معاملة (الأحدث أولاً)</h3><div style="overflow:auto;max-height:300px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:right">التاريخ</th><th style="padding:8px;text-align:right">العميل</th><th style="padding:8px;text-align:right">رقم</th><th style="padding:8px;text-align:right">المبلغ</th><th style="padding:8px;text-align:right">النوع</th><th style="padding:8px;text-align:right">إجراء</th></tr></thead><tbody>' + txRows + '</tbody></table></div></div><div><h3 style="color:#27ae60;border-bottom:1px solid #27ae60;padding-bottom:6px">🏢 الجمعيات / العملاء</h3><div style="overflow:auto;max-height:300px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:right">الاسم</th><th style="padding:8px;text-align:right">المندوب</th><th style="padding:8px;text-align:right">الهاتف</th><th style="padding:8px;text-align:right">الرصيد</th><th style="padding:8px;text-align:right">إجراء</th></tr></thead><tbody>' + clRows + '</tbody></table></div></div><div style="display:flex;justify-content:flex-end;margin-top:20px"><button onclick="document.getElementById(\'editV220\').remove()" style="padding:10px 20px;background:#95a5a6;color:#fff;border:none;border-radius:6px;cursor:pointer">إغلاق</button></div></div>';
  document.body.appendChild(overlay);
};

window.editTxV220 = function(idx) {
  var t = O.tx[idx];
  if (!t) { alert("⚠️ معاملة غير موجودة"); return; }
  var newDt = prompt("📅 التاريخ الجديد (YYYY-MM-DD):", t.dt || "");
  if (newDt === null) return;
  var newAmt = prompt("💰 المبلغ الجديد (د.ك):", t.amount || 0);
  if (newAmt === null) return;
  var newInv = prompt("📄 رقم الفاتورة الجديد:", t.i || "");
  if (newInv === null) return;
  var oldClient = t.client || t.cl;
  t.dt = newDt || t.dt;
  t.amount = parseFloat(newAmt) || t.amount;
  t.i = parseInt(newInv) || t.i;
  var soc = O.soc.find(function(x) { return x.nm === oldClient; });
  if (soc && t.dt > (soc.li || "")) soc.li = t.dt;
  if (typeof nayefSaveData === "function") nayefSaveData();
  try { if (typeof initFilter === "function") initFilter(); } catch(e) {}
  try { if (typeof sw === "function") sw("ov"); } catch(e) {}
  document.getElementById("editV220").remove();
  alert("✅ تم تعديل المعاملة بنجاح");
  openV220EditMode();
};

window.deleteTxV220 = function(idx) {
  var t = O.tx[idx];
  if (!t) { alert("⚠️ معاملة غير موجودة"); return; }
  if (!confirm("⚠️ حذف المعاملة؟\n\n" + (t.dt || "") + " | " + (t.client || "") + " | " + (t.amount || 0).toFixed(3) + " د.ك")) return;
  O.tx.splice(idx, 1);
  if (typeof nayefSaveData === "function") nayefSaveData();
  try { if (typeof initFilter === "function") initFilter(); } catch(e) {}
  try { if (typeof sw === "function") sw("ov"); } catch(e) {}
  document.getElementById("editV220").remove();
  alert("✅ تم حذف المعاملة");
  openV220EditMode();
};

window.editClientV220 = function(idx) {
  var c = O.soc[idx];
  if (!c) { alert("⚠️ عميل غير موجود"); return; }
  var newNm = prompt("🏢 اسم العميل الجديد:", c.nm || "");
  if (newNm === null) return;
  var newPhone = prompt("📞 الهاتف الجديد:", c.phone || "");
  if (newPhone === null) return;
  var newAg = prompt("👤 المندوب الجديد:", c.ag || "");
  if (newAg === null) return;
  var oldNm = c.nm;
  c.nm = (newNm || c.nm).trim();
  c.phone = newPhone.trim();
  c.ag = newAg.trim();
  if (oldNm && oldNm !== c.nm) {
    O.tx.forEach(function(tx) {
      if (tx.client === oldNm) tx.client = c.nm;
      if (tx.cl === oldNm) tx.cl = c.nm;
    });
  }
  if (typeof nayefSaveData === "function") nayefSaveData();
  try { if (typeof initFilter === "function") initFilter(); } catch(e) {}
  try { if (typeof sw === "function") sw("ov"); } catch(e) {}
  document.getElementById("editV220").remove();
  alert("✅ تم تعديل العميل: " + c.nm);
  openV220EditMode();
};

window.deleteClientV220 = function(idx) {
  var c = O.soc[idx];
  if (!c) { alert("⚠️ عميل غير موجود"); return; }
  var txCount = O.tx.filter(function(t) { return (t.client || t.cl) === c.nm; }).length;
  if (!confirm("⚠️ حذف العميل '" + c.nm + "'؟\n\nعدد معاملاته: " + txCount + "\n\nملاحظة: المعاملات لن تُحذف لكن ستبقى بدون عميل مربوط.")) return;
  O.soc.splice(idx, 1);
  if (typeof nayefSaveData === "function") nayefSaveData();
  try { if (typeof initFilter === "function") initFilter(); } catch(e) {}
  try { if (typeof sw === "function") sw("ov"); } catch(e) {}
  document.getElementById("editV220").remove();
  alert("✅ تم حذف العميل");
  openV220EditMode();
};



window.editLastCollectionV220 = function(clientName) {
  if(!clientName) { alert("⚠️ اسم العميل فارغ"); return; }
  if(typeof O === "undefined" || !O || !O.soc) { alert("⚠️ النظام لم يكتمل تحميله"); return; }
  var soc = O.soc.find(function(s) { return s.nm === clientName; });
  if(!soc) { alert("⚠️ العميل غير موجود: " + clientName); return; }
  var currentVal = "";
  if(typeof soc.lc === "string") currentVal = soc.lc;
  else if(soc.lc && typeof soc.lc === "object") {
    if(soc.lc.dt) currentVal = String(soc.lc.dt);
    else currentVal = "";
  }
  var newDt = prompt("📅 تاريخ آخر تحصيل لـ [" + clientName + "]\n\nالصيغة: YYYY-MM-DD\nاتركه فارغاً لمسح التاريخ:", currentVal);
  if(newDt === null) return; // إلغاء
  // تنظيف التاريخ
  newDt = (newDt || "").trim();
  if(newDt && !/^\d{4}-\d{2}-\d{2}$/.test(newDt)) {
    alert("⚠️ صيغة التاريخ غير صحيحة.\n\nالمطلوب: YYYY-MM-DD\nمثال: 2026-05-19");
    return;
  }
  // تحديث soc.lc - تنظيف الـ object القديم إذا كان موجوداً
  if(soc.lc && typeof soc.lc === "object" && !(soc.lc instanceof Date)) {
    // إذا كان object، نحذفه ونضع string جديد
    delete soc.lc;
  }
  soc.lc = newDt || ""; // string دائماً
  if(typeof nayefSaveData === "function") nayefSaveData();
  try { if(typeof initFilter === "function") initFilter(); } catch(e) {}
  try { if(typeof sw === "function") sw("aging"); } catch(e) {}
  alert(newDt ? ("✅ تم تحديث تاريخ آخر تحصيل\n\n" + clientName + " → " + newDt) : "✅ تم مسح تاريخ آخر تحصيل");
};

Logger.info("✅ LOCKED v220.1+ Manual Entry System loaded");
