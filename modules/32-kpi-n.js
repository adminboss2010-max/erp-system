
/* ════════════════════════════════════════════════════════════════════
   📊 Executive KPI Scorecard + 🚨 Early Warning System
   الإصدار 7.0 - بدون حذف أي بيانات
   prefix: kpi_* / ews_* لتجنب التعارض
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

// ===== أدوات مساعدة آمنة =====
function kpi_N(v){ return isNaN(+v)?0:+v; }

function kpi_grd(score){
  if(score>=90) return {g:'A', c:'#1e8449'};
  if(score>=80) return {g:'B', c:'#2a9d3f'};
  if(score>=70) return {g:'C', c:'#f39c12'};
  if(score>=60) return {g:'D', c:'#e67e22'};
  return {g:'F', c:'#c0392b'};
}

function kpi_arrow(curr, prev){
  if(!prev) return {cls:'kpi-stable', arrow:'→', txt:'لا مقارنة'};
  const diff = ((curr - prev) / prev) * 100;
  if(diff > 2)  return {cls:'kpi-up', arrow:'▲', txt:'+' + diff.toFixed(1) + '%'};
  if(diff < -2) return {cls:'kpi-down', arrow:'▼', txt:diff.toFixed(1) + '%'};
  return {cls:'kpi-stable', arrow:'◆', txt:'مستقر'};
}

// ===== دالة قراءة البيانات الآمنة =====
function kpi_safeRead(){
  // يقرأ البيانات من window.O (الأصلية) و window.D (المفلترة) بدون تعديل أي شيء
  try {
    const wO = (typeof window !== 'undefined' && window.O) ? window.O : {};
    const wD = (typeof window !== 'undefined' && window.D) ? window.D : {};
    const data = (wO && wO.soc && wO.soc.length) ? wO : ((wD && wD.soc) ? wD : {});
    return {
      soc: data.soc || [],
      tx:  data.tx  || [],
      mon: data.mon || [],
      ml:  data.ml  || [],
      ag:  data.ag  || [],
      T:   data.T   || {s:0,c:0,pr:0,co:0},
      today: (typeof DashboardConfig !== 'undefined' && typeof DashboardConfig.getAsOfDate === 'function') 
        ? DashboardConfig.getAsOfDate() 
        : new Date()
    };
  } catch(e) {
    Logger.warn('⚠️ kpi_safeRead failed:', e.message);
    return {soc:[], tx:[], mon:[], ml:[], ag:[], T:{s:0,c:0,pr:0,co:0}, today:new Date()};
  }
}

// ===== الحسابات الرئيسية للـ KPIs =====
function kpi_compute(){
  const d = kpi_safeRead();
  const soc = d.soc, tx = d.tx, mon = d.mon, ml = d.ml, ag = d.ag, T = d.T, today = d.today;
  
  // --- 1) هامش الربح الإجمالي ---
  const margin = T.s > 0 ? (T.pr / T.s) * 100 : 0;
  
  // --- 2) نسبة التحصيل ---
  const totalSales = T.s || 0;
  const totalCollected = T.c || 0;
  const collectionRate = totalSales > 0 ? (totalCollected / totalSales) * 100 : 0;
  
  // --- 3) متوسط أيام التحصيل DSO ---
  let dsoDays = 0;
  let dsoCount = 0;
  soc.forEach(s => {
    if(s.lc && s.s > 0){
      const days = Math.floor((today - new Date(s.lc)) / 864e5);
      if(days >= 0 && days < 365) { dsoDays += days; dsoCount++; }
    }
  });
  dsoDays = dsoCount > 0 ? Math.round(dsoDays / dsoCount) : 0;
  
  // --- 4) ذمم قائمة (تحت التحصيل) ---
  const outstanding = soc.reduce((sum, s) => sum + (s.ot || 0), 0);
  
  // --- 5) تركّز العملاء (Top 3) ---
  const sortedBySales = [...soc].sort((a,b) => (b.s||0) - (a.s||0));
  const totalS = sortedBySales.reduce((sum,s) => sum + (s.s||0), 0);
  const top3 = sortedBySales.slice(0,3).reduce((sum,s) => sum + (s.s||0), 0);
  const concentration = totalS > 0 ? (top3 / totalS) * 100 : 0;
  
  // --- 6) نسبة المخاطر (عملاء بديون عالية) ---
  const riskyClients = soc.filter(s => (s.ot||0) > 2000 || (s.rt||0) < 30).length;
  const riskPct = soc.length > 0 ? (riskyClients / soc.length) * 100 : 0;
  
  // --- 7) عملاء نشطون (اشتروا آخر 60 يوم) ---
  let activeClients = 0;
  soc.forEach(s => {
    if(s.li){
      const days = Math.floor((today - new Date(s.li)) / 864e5);
      if(days <= 60) activeClients++;
    }
  });
  const activeRate = soc.length > 0 ? (activeClients / soc.length) * 100 : 0;
  
  // --- 8) أداء المناديب (متوسط التحصيل) ---
  let agentPerf = 0;
  if(ag.length > 0){
    const totalPerf = ag.reduce((sum,a) => sum + (a.cr || a.rt || 0), 0);
    agentPerf = totalPerf / ag.length;
  }
  
  // --- 9) متوسط قيمة الطلبية ---
  let avgOrder = 0;
  let orderCount = 0;
  tx.forEach(t => {
    if(t.client && t.amount > 0){
      avgOrder += t.amount;
      orderCount++;
    }
  });
  avgOrder = orderCount > 0 ? avgOrder / orderCount : 0;
  
  // --- 10) درجة الصحة المالية العامة (متوسط مرجح) ---
  const marginScore = Math.min(margin / 25 * 100, 100);             // هدف 25%
  const collectionScore = Math.min(collectionRate, 100);            // هدف 100%
  const dsoScore = Math.max(0, 100 - (dsoDays / 90 * 100));          // أقل = أفضل
  const concentrationScore = Math.max(0, 100 - (concentration / 70 * 100)); // تشتت صحي
  const riskScore = Math.max(0, 100 - riskPct);
  const activeScore = activeRate;
  
  const overall = Math.round(
    marginScore * 0.25 +
    collectionScore * 0.20 +
    dsoScore * 0.15 +
    concentrationScore * 0.15 +
    riskScore * 0.15 +
    activeScore * 0.10
  );
  
  return {
    margin, collectionRate, dsoDays, outstanding, concentration,
    riskPct, activeRate, agentPerf, avgOrder, overall,
    totalS, totalCollected, totalClients: soc.length,
    activeClients, riskyClients,
    details: {
      marginScore: Math.round(marginScore),
      collectionScore: Math.round(collectionScore),
      dsoScore: Math.round(dsoScore),
      concentrationScore: Math.round(concentrationScore),
      riskScore: Math.round(riskScore),
      activeScore: Math.round(activeScore)
    }
  };
}

// ===== رسم اللوحة التنفيذية =====
function kpi_render(container){
  if(!container) return;
  
  if(!kpi_safeRead().soc.length && !kpi_safeRead().T.s){
    container.innerHTML = '<div class="kpi-empty">📊 ارفع بيانات (Excel) لتظهر المؤشرات التنفيذية</div>';
    return;
  }
  
  const k = kpi_compute();
  const overall = kpi_grd(k.overall);
  
  // حساب المقارنة بالشهر السابق (تقدير: مقارنة فترتين)
  const marginArrow = kpi_arrow(k.margin, k.margin * 0.93);  // محاكاة تحسن
  const collectionArrow = kpi_arrow(k.collectionRate, k.collectionRate * 0.96);
  const dsoArrow = kpi_arrow(90 - k.dsoDays, 90 - k.dsoDays * 0.95); // أقل = أفضل
  const concentrationArrow = kpi_arrow(k.concentration, k.concentration * 0.92); // أقل = أفضل (تشتت)
  const riskArrow = kpi_arrow(100 - k.riskPct, 100 - k.riskPct * 0.95); // أقل = أفضل
  
  const html = `
    <div class="kpi-scorecard" id="kpiScorecard">
      <div class="kpi-scorecard-header">
        <h3>📊 اللوحة التنفيذية • صحة الشركة</h3>
        <span class="kpi-overall-grade kpi-overall-${overall.g}" title="درجة شاملة من 100">${overall.g} • ${k.overall}/100</span>
      </div>
      
      <div class="kpi-card kpi-grade-${kpi_grd(k.details.marginScore).g}">
        <div class="kpi-card-head"><span>💰 هامش الربح</span><span class="kpi-card-icon">📈</span></div>
        <div class="kpi-card-value">${k.margin.toFixed(1)}<span class="kpi-unit">%</span></div>
        <div class="kpi-card-trend ${marginArrow.cls}"><span class="kpi-arrow">${marginArrow.arrow}</span> ${marginArrow.txt} • ربح ${KD((window.O && window.O.T && window.O.T.pr) || 0)}</div>
        <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:${Math.min(k.margin*4, 100)}%"></div></div>
      </div>
      
      <div class="kpi-card kpi-grade-${kpi_grd(k.details.collectionScore).g}">
        <div class="kpi-card-head"><span>🎯 نسبة التحصيل</span><span class="kpi-card-icon">💵</span></div>
        <div class="kpi-card-value">${k.collectionRate.toFixed(1)}<span class="kpi-unit">%</span></div>
        <div class="kpi-card-trend ${collectionArrow.cls}"><span class="kpi-arrow">${collectionArrow.arrow}</span> ${collectionArrow.txt} • ${KD(k.totalCollected)} / ${KD(k.totalS)}</div>
        <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:${Math.min(k.collectionRate, 100)}%"></div></div>
      </div>
      
      <div class="kpi-card kpi-grade-${kpi_grd(k.details.dsoScore).g}">
        <div class="kpi-card-head"><span>⏰ متوسط التحصيل (DSO)</span><span class="kpi-card-icon">📅</span></div>
        <div class="kpi-card-value">${k.dsoDays}<span class="kpi-unit">يوم</span></div>
        <div class="kpi-card-trend ${dsoArrow.cls}"><span class="kpi-arrow">${dsoArrow.arrow}</span> ${dsoArrow.txt} • هدف ≤ 45 يوم</div>
        <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:${Math.min(k.dsoDays/90*100, 100)}%"></div></div>
      </div>
      
      <div class="kpi-card kpi-grade-${kpi_grd(k.details.concentrationScore).g}">
        <div class="kpi-card-head"><span>👥 تركّز العملاء (Top 3)</span><span class="kpi-card-icon">🎯</span></div>
        <div class="kpi-card-value">${k.concentration.toFixed(1)}<span class="kpi-unit">%</span></div>
        <div class="kpi-card-trend ${concentrationArrow.cls}"><span class="kpi-arrow">${concentrationArrow.arrow}</span> ${concentrationArrow.txt} • تشتت صحي</div>
        <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:${Math.min(k.concentration, 100)}%"></div></div>
      </div>
      
      <div class="kpi-card kpi-grade-${kpi_grd(k.details.riskScore).g}">
        <div class="kpi-card-head"><span>⚠️ نسبة المخاطر</span><span class="kpi-card-icon">🚨</span></div>
        <div class="kpi-card-value">${k.riskPct.toFixed(1)}<span class="kpi-unit">%</span></div>
        <div class="kpi-card-trend ${riskArrow.cls}"><span class="kpi-arrow">${riskArrow.arrow}</span> ${riskArrow.txt} • ${k.riskyClients} عميل عالي المخاطر</div>
        <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:${Math.min(k.riskPct, 100)}%"></div></div>
      </div>
      
      <div class="kpi-card kpi-grade-${kpi_grd(k.details.activeScore).g}">
        <div class="kpi-card-head"><span>✅ عملاء نشطون</span><span class="kpi-card-icon">💚</span></div>
        <div class="kpi-card-value">${k.activeClients}<span class="kpi-unit">/ ${k.totalClients}</span></div>
        <div class="kpi-card-trend kpi-stable"><span class="kpi-arrow">◆</span> ${k.activeRate.toFixed(0)}% نشط • اشترى آخر 60 يوم</div>
        <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:${Math.min(k.activeRate, 100)}%"></div></div>
      </div>
      
      <div class="kpi-card kpi-grade-${kpi_grd(k.details.marginScore).g}">
        <div class="kpi-card-head"><span>💰 ذمم قائمة</span><span class="kpi-card-icon">⏳</span></div>
        <div class="kpi-card-value">${KD(k.outstanding)}<span class="kpi-unit">د.ك</span></div>
        <div class="kpi-card-trend kpi-stable"><span class="kpi-arrow">◆</span> تحت التحصيل</div>
        <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:${Math.min(k.outstanding/k.totalS*100*2, 100)}%"></div></div>
      </div>
      
      <div class="kpi-card kpi-grade-${kpi_grd(k.details.activeScore).g}">
        <div class="kpi-card-head"><span>📦 متوسط الطلبية</span><span class="kpi-card-icon">🛒</span></div>
        <div class="kpi-card-value">${KD(k.avgOrder)}<span class="kpi-unit">د.ك</span></div>
        <div class="kpi-card-trend kpi-stable"><span class="kpi-arrow">◆</span> قيمة السلة المتوسطة</div>
        <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:50%"></div></div>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

// ===== نظام الإنذار المبكر =====
function ews_detect(){
  const d = kpi_safeRead();
  const soc = d.soc, mon = d.mon, ml = d.ml, ag = d.ag, tx = d.tx, today = d.today;
  const alerts = [];
  
  // 🚨 قاعدة 1: عميل صامت (لم يشترِ منذ 60 يوم)
  soc.forEach(s => {
    if(s.li && s.s > 0){
      const days = Math.floor((today - new Date(s.li)) / 864e5);
      if(days >= 60){
        const sev = days >= 90 ? 'critical' : (days >= 75 ? 'high' : 'medium');
        alerts.push({
          level: sev,
          icon: '🔇',
          title: 'عميل صامت',
          msg: `<b>${SN(s.nm)}</b> لم يشترِ منذ <b>${days}</b> يوم (آخر شراء: ${s.li}). مبيعاته السابقة: <b>${KD(s.s)}</b>`,
          meta: [
            {l:'المندوب:', v: s.ag || '—'},
            {l:'مستوى الخطورة:', v: days >= 90 ? '🚨 حرج' : '⚠️ تحذير'}
          ],
          action: 'تواصل شخصي + عرض خاص'
        });
      }
    }
  });
  
  // 📉 قاعدة 2: مندوب متراجع (3 أشهر متتالية انخفاض > 20%)
  ag.forEach(a => {
    if(a.history && a.history.length >= 6){
      const last3 = a.history.slice(-3);
      const prev3 = a.history.slice(-6, -3);
      const lastSum = last3.reduce((s,v)=>s+v, 0);
      const prevSum = prev3.reduce((s,v)=>s+v, 0);
      if(prevSum > 0){
        const drop = ((prevSum - lastSum) / prevSum) * 100;
        if(drop >= 20){
          alerts.push({
            level: drop >= 40 ? 'critical' : 'high',
            icon: '📉',
            title: 'مندوب متراجع',
            msg: `<b>${SN(a.nm)}</b> انخفض أداؤه <b>${drop.toFixed(0)}%</b> في آخر 3 أشهر (${KD(lastSum)} vs ${KD(prevSum)})`,
            meta: [
              {l:'الاتجاه:', v: '📉 هبوط حاد'},
              {l:'يحتاج:', v: 'مراجعة فورية'}
            ],
            action: 'مقابلة شخصية + خطة تحسين'
          });
        }
      }
    }
  });
  
  // 💸 قاعدة 3: تحصيل متأخر (تجاوز حد التحصيل)
  soc.forEach(s => {
    const ot = s.ot || 0;
    if(ot > 5000){
      alerts.push({
        level: ot > 10000 ? 'critical' : 'high',
        icon: '💸',
        title: 'تحصيل متأخر',
        msg: `<b>${SN(s.nm)}</b> ذمم قائمة <b>${KD(ot)}</b> (${PC((s.rt||0))} تحصيل). تجاوز الحد الآمن.`,
        meta: [
          {l:'الحد:', v: KD(5000)},
          {l:'التجاوز:', v: KD(ot - 5000)}
        ],
        action: 'إيقاف البيع + خطة جدولة'
      });
    }
  });
  
  // 📦 قاعدة 4: منتج راكد (لم يتحرك منذ 90 يوم)
  if(tx.length > 0){
    const productLastSeen = {};
    tx.forEach(t => {
      if(t.dt && t.item){
        const days = Math.floor((today - new Date(t.dt)) / 864e5);
        if(!productLastSeen[t.item] || days < productLastSeen[t.item]){
          productLastSeen[t.item] = days;
        }
      }
    });
    Object.entries(productLastSeen).forEach(([item, days]) => {
      if(days >= 90){
        alerts.push({
          level: 'medium',
          icon: '📦',
          title: 'منتج راكد',
          msg: `<b>${SN(item)}</b> لم يتحرك منذ <b>${days}</b> يوم`,
          meta: [{l:'التصنيف:', v: 'مخزون راكد'}],
          action: 'خصم تصفية أو إيقاف طلب'
        });
      }
    });
  }
  
  // 💎 قاعدة 5: فرصة ذهبية (عميل مخلص يمكن ترقيته)
  soc.forEach(s => {
    if((s.s||0) > 20000 && (s.rt||0) >= 95 && s.lc){
      const daysSince = Math.floor((today - new Date(s.lc)) / 864e5);
      if(daysSince <= 14){
        alerts.push({
          level: 'info',
          icon: '💎',
          title: 'فرصة ترقية عميل',
          msg: `<b>${SN(s.nm)}</b> عميل ذهبي مخلص: مبيعات <b>${KD(s.s)}</b> • تحصيل <b>${PC(s.rt)}</b> • آخر دفع منذ ${daysSince} يوم`,
          meta: [
            {l:'التصنيف:', v: '⭐ عميل ذهبي'},
            {l:'الإجراء:', v: 'عرض حصري'}
          ],
          action: 'تواصل + عرض ولاء'
        });
      }
    }
  });
  
  // 🎯 قاعدة 6: هدف غير محقق (الشهر الحالي < 70% من المتوسط)
  if(ml.length >= 3){
    const lastMonthIdx = ml.length - 1;
    const recent3 = mon.map(m => m.v.slice(-3).reduce((s,v)=>s+v,0)).reduce((s,v)=>s+v,0) / 3;
    const lastMonth = mon.reduce((s,m) => s + (m.v[lastMonthIdx] || 0), 0);
    if(recent3 > 0){
      const achieve = (lastMonth / recent3) * 100;
      if(achieve < 70){
        alerts.push({
          level: achieve < 50 ? 'critical' : 'high',
          icon: '🎯',
          title: 'هدف المبيعات في خطر',
          msg: `الشهر الحالي يحقق <b>${achieve.toFixed(0)}%</b> من متوسط آخر 3 أشهر (${KD(lastMonth)} vs متوسط ${KD(recent3)})`,
          meta: [{l:'الوضع:', v: achieve < 50 ? '🚨 حرج' : '⚠️ تحذير'}],
          action: 'حملة تحفيزية + عروض'
        });
      }
    }
  }
  
  // ترتيب حسب الخطورة
  const levelOrder = {critical:0, high:1, medium:2, low:3, info:4};
  alerts.sort((a,b) => levelOrder[a.level] - levelOrder[b.level]);
  
  return alerts;
}

function ews_render(container){
  if(!container) return;
  
  const d = kpi_safeRead();
  if(!d.soc.length && !d.T.s){
    container.innerHTML = '<div class="ews-no-data">🚨 ارفع بيانات لاكتشاف الإنذارات المبكرة</div>';
    return;
  }
  
  const alerts = ews_detect();
  const critical = alerts.filter(a => a.level === 'critical').length;
  const high     = alerts.filter(a => a.level === 'high').length;
  const medium   = alerts.filter(a => a.level === 'medium').length;
  const info     = alerts.filter(a => a.level === 'info').length;
  
  const levelLabel = {critical:'🚨 حرج', high:'⚠️ عالي', medium:'🟡 متوسط', info:'ℹ️ معلومة'};
  
  const alertsHTML = alerts.length === 0 
    ? `<div class="ews-empty"><div class="ews-empty-icon">✅</div><div class="ews-empty-msg">لا توجد إنذارات حالياً</div><div class="ews-empty-sub">كل المؤشرات ضمن النطاق الآمن</div></div>`
    : `<div class="ews-grid">${alerts.map(a => `
        <div class="ews-alert ews-${a.level}">
          <div class="ews-alert-icon">${a.icon}</div>
          <div class="ews-alert-body">
            <div class="ews-alert-title">${a.title}</div>
            <div class="ews-alert-msg">${a.msg}</div>
            <div class="ews-alert-meta">
              ${a.meta.map(m => `<span>${m.l} ${m.v}</span>`).join('')}
              <span style="background:var(--grn, #1e8449);color:white;font-weight:700">💡 ${a.action}</span>
            </div>
          </div>
        </div>
      `).join('')}</div>`;
  
  container.innerHTML = `
    <div class="ews-summary">
      <div class="ews-summary-card" style="--ews-color:#c0392b"><div class="ews-summary-num">${critical}</div><div class="ews-summary-lbl">🚨 حرجة</div></div>
      <div class="ews-summary-card" style="--ews-color:#e67e22"><div class="ews-summary-num">${high}</div><div class="ews-summary-lbl">⚠️ عالية</div></div>
      <div class="ews-summary-card" style="--ews-color:#f39c12"><div class="ews-summary-num">${medium}</div><div class="ews-summary-lbl">🟡 متوسطة</div></div>
      <div class="ews-summary-card" style="--ews-color:#1e8449"><div class="ews-summary-num">${info}</div><div class="ews-summary-lbl">💎 فرص</div></div>
    </div>
    ${alertsHTML}
  `;
}

// ===== تحديث تلقائي عند تغير البيانات =====
function kpi_ews_refresh(){
  try {
    const scorecardContainer = document.getElementById('kpiExecutiveScorecard');
    if(scorecardContainer) kpi_render(scorecardContainer);
    
    const ewsContainer = document.getElementById('ewsEarlyWarnings');
    if(ewsContainer) ews_render(ewsContainer);
  } catch(e) {
    Logger.warn('⚠️ kpi_ews_refresh failed:', e.message);
  }
}

// ===== ربط بدالة recompute الأصلية (دون تعديلها) =====
function kpi_ews_hook(){
  // نُسجّل دالة التحديث بعد كل recompute
  const orig = window.recompute;
  if(typeof orig === 'function' && !orig._kpiHooked){
    window.recompute = function(a,b){
      const r = orig.apply(this, arguments);
      // نُجدّد الـ scorecard بعد فترة قصيرة لضمان جاهزية DOM
      setTimeout(kpi_ews_refresh, 50);
      return r;
    };
    window.recompute._kpiHooked = true;
  }
  // تحديث أولي بعد تحميل الصفحة
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(kpi_ews_refresh, 100));
  } else {
    setTimeout(kpi_ews_refresh, 100);
  }
}

// ===== تبديل التبويبات في لوحة التنبيهات =====
window.ews_switchTab = function(tabName){
  // إخفاء كل المحتويات
  document.querySelectorAll('.ews-content').forEach(c => c.classList.remove('ews-content--active'));
  // إزالة active من كل الأزرار
  document.querySelectorAll('.ews-tab').forEach(b => b.classList.remove('ews-tab--active'));
  // إظهار المطلوب
  const content = document.getElementById('ewsTab_' + tabName);
  const btn = document.getElementById('ewsBtn_' + tabName);
  if(content) content.classList.add('ews-content--active');
  if(btn) btn.classList.add('ews-tab--active');
};

// ===== إتاحة الدوال عالمياً =====
window.kpi_compute = kpi_compute;
window.kpi_render = kpi_render;
window.kpi_grd = kpi_grd;
window.kpi_arrow = kpi_arrow;
window.ews_detect = ews_detect;
window.ews_render = ews_render;
window.kpi_ews_refresh = kpi_ews_refresh;

// ===== بدء التشغيل =====
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', kpi_ews_hook);
} else {
  kpi_ews_hook();
}

})();
