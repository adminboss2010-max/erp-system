/* ═══════════════════════════════════════════════════════════════════
   📊 v220.9+ RFM SEGMENTATION + CLV PREDICTION (🛡️ نسخة آمنة ومحسنة الأداء)
   ═══════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';
  
  function getData() {
    return (typeof window !== 'undefined' && window.O) ? window.O : {};
  }
  
  // حساب RFM Scores لكل عميل بأداء عالي $O(N)$ وحساب محاسبي دقيق
  function calculateRFMScores(customers, transactions, options = {}) {
    const config = Object.assign({
      referenceDate: new Date(),
      recencyBuckets: 5,
      frequencyBuckets: 5,
      monetaryBuckets: 5
    }, options || {});
    
    const now = config.referenceDate;
    const results = [];
    
    // 1) ربط المعاملات بالعملاء بشكل مسبق لتجنب الفلترة المتكررة داخل الحلقات
    const txMap = {};
    transactions.forEach(t => {
      const cName = t.client || t.cl || t.customerId;
      if (cName) {
        if (!txMap[cName]) txMap[cName] = [];
        txMap[cName].push(t);
      }
    });
    
    customers.forEach(customer => {
      const name = customer.nm || customer.name;
      if (!name) return;
      
      const customerTx = txMap[name] || [];
      
      if (customerTx.length === 0) {
        results.push({
          name, recency: null, frequency: 0, monetary: 0, rfm: '000',
          segment: 'unknown', clv: 0, riskScore: 100, transactionCount: 0,
          lastTransaction: null, daysSince: Infinity, rScore: 0, fScore: 0, mScore: 0
        });
        return;
      }
      
      // الفلترة الصحيحة للمبيعات فقط لحساب الـ Recency والـ Monetary بشكل محاسبي سليم
      const sales = customerTx.filter(t => (t.tp || t.type) === 'sale');
      
      if (sales.length === 0) {
        results.push({
          name, recency: null, frequency: 0, monetary: 0, rfm: '000',
          segment: 'unknown', clv: 0, riskScore: 100, transactionCount: 0,
          lastTransaction: null, daysSince: Infinity, rScore: 0, fScore: 0, mScore: 0
        });
        return;
      }
      
      const sortedSales = sales.sort((a, b) => new Date(b.dt || b.date) - new Date(a.dt || a.date));
      const lastSale = sortedSales[0];
      const lastDate = new Date(lastSale.dt || lastSale.date);
      const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      
      const frequency = sales.length;
      // 🛡️ تصحيح محاسبي: الحساب يعتمد على الفواتير الفعلية (sales) وليس كل الحركات المتنوعة
      const monetary = sales.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      
      results.push({
        name,
        recency: daysSince,
        frequency,
        monetary,
        transactionCount: sales.length,
        lastTransaction: lastSale.dt || lastSale.date,
        daysSince
      });
    });
    
    // 🛡️ تحسين الأداء: استخدام خرائط توزيع (Rank Maps) بدلاً من indexOf المتكرر لتسريع المعالجة
    const buildScoreMap = (values, totalBuckets, reverse = false) => {
      const sorted = [...values].sort((a, b) => a - b);
      const bucketSize = Math.ceil(sorted.length / totalBuckets);
      const scoreMap = new Map();
      
      sorted.forEach((val, idx) => {
        if (!scoreMap.has(val)) {
          let score = Math.floor(idx / bucketSize) + 1;
          if (reverse) score = totalBuckets - score + 1;
          scoreMap.set(val, Math.max(1, Math.min(totalBuckets, score)));
        }
      });
      return scoreMap;
    };
    
    const validRecencies = results.filter(r => r.recency !== null).map(r => r.recency);
    const rMap = buildScoreMap(validRecencies, config.recencyBuckets, true); // Recency منخفض = أفضل
    
    const frequencies = results.map(r => r.frequency);
    const fMap = buildScoreMap(frequencies, config.frequencyBuckets);
    
    const monetaries = results.map(r => r.monetary);
    const mMap = buildScoreMap(monetaries, config.monetaryBuckets);
    
    // تطبيق الـ Scores وحساب الشرائح والتوقعات
    results.forEach(r => {
      if (r.recency === null) {
        r.rScore = 0; r.fScore = 0; r.mScore = 0;
        r.rfm = '000'; r.segment = 'unknown';
        r.riskScore = 100; r.clv = 0;
        return;
      }
      
      r.rScore = rMap.get(r.recency) || 1;
      r.fScore = fMap.get(r.frequency) || 1;
      r.mScore = mMap.get(r.monetary) || 1;
      
      r.rfm = `${r.rScore}${r.fScore}${r.mScore}`;
      r.segment = classifySegment(r.rScore, r.fScore, r.mScore);
      r.riskScore = calculateRiskScore(r);
      r.clv = predictCLV(r);
    });
    
    return results;
  }
  
  function classifySegment(r, f, m) {
    if (r <= 1 && f >= 4 && m >= 4) return 'cannot_lose';
    if (r >= 4 && f >= 4 && m >= 4) return 'champions';
    if (r >= 4 && f >= 3 && m >= 3) return 'loyal';
    if (r <= 2 && f >= 3 && m >= 3) return 'at_risk';
    if (r >= 4 && f >= 2 && f <= 3) return 'potential_loyalists';
    if (r >= 4 && f <= 1) return 'recent';
    if (r >= 3 && m >= 3 && f <= 2) return 'promising';
    if (r === 3 && f >= 2 && f <= 3) return 'need_attention';
    if (r >= 2 && r <= 3 && f >= 2 && f <= 3) return 'about_to_sleep';
    if (r <= 2 && f <= 2 && m <= 2) return 'hibernating';
    return 'others';
  }
  
  function calculateRiskScore(customer) {
    let score = 0;
    if (customer.daysSince > 365) score += 40;
    else if (customer.daysSince > 180) score += 30;
    else if (customer.daysSince > 90) score += 20;
    else if (customer.daysSince > 60) score += 10;
    
    if (customer.frequency === 0) score += 30;
    else if (customer.frequency <= 2) score += 20;
    else if (customer.frequency <= 5) score += 10;
    
    const avgTxValue = customer.frequency > 0 ? customer.monetary / customer.frequency : 0;
    if (avgTxValue < 100) score += 30;
    else if (avgTxValue < 500) score += 20;
    else if (avgTxValue < 1000) score += 10;
    return Math.min(100, Math.max(0, score));
  }
  
  function predictCLV(customer) {
    if (!customer || customer.transactionCount === 0) return 0;
    const customerAgeDays = customer.daysSince || 1;
    const monthlyFrequency = customer.transactionCount / Math.max(1, customerAgeDays / 30);
    const avgTransactionValue = customer.monetary / customer.transactionCount;
    const retentionFactor = Math.max(0.1, 1 - (customer.riskScore / 100));
    const predictedAnnualFrequency = monthlyFrequency * 12 * retentionFactor;
    const clv = predictedAnnualFrequency * avgTransactionValue;
    return Math.round(clv * 100) / 100;
  }
  
  function getSegmentDescription(segment) {
    const descriptions = {
      champions: { name: 'الأبطال', icon: '🏆', strategy: 'برنامج ولاء ذهبي + منتجات حصرية', color: '#10b981' },
      loyal: { name: 'العملاء المخلصون', icon: '⭐', strategy: 'Cross-sell + باقات مميزة', color: '#3b82f6' },
      potential_loyalists: { name: 'محتملون للولاء', icon: '🌱', strategy: 'عروض ترحيبية + تجربة منتجات جديدة', color: '#8b5cf6' },
      recent: { name: 'عملاء جدد', icon: '🆕', strategy: 'بناء علاقة + onboarding ممتاز', color: '#06b6d4' },
      promising: { name: 'واعدون', icon: '🌟', strategy: 'تحفيز بالولاء + مكافآت', color: '#14b8a6' },
      need_attention: { name: 'يحتاجون اهتمام', icon: '👀', strategy: 'تواصل شخصي + عروض مخصصة', color: '#f59e0b' },
      about_to_sleep: { name: 'على وشك النوم', icon: '😴', strategy: 'حملة إيقاظ فورية', color: '#f97316' },
      at_risk: { name: 'في خطر', icon: '⚠️', strategy: 'تدخل عاجل + عرض استثنائي', color: '#ef4444' },
      cannot_lose: { name: 'لا يمكن خسارتهم', icon: '🚨', strategy: 'تدخل شخصي من الإدارة العليا', color: '#dc2626' },
      hibernating: { name: 'خاملون', icon: '💤', strategy: 'حملة إعادة تنشيط', color: '#6b7280' },
      others: { name: 'آخرون', icon: '❓', strategy: 'تحليل أعمق مطلوب', color: '#94a3b8' },
      unknown: { name: 'غير معروف', icon: '❔', strategy: 'لا توجد معاملات سابقة', color: '#cbd5e1' }
    };
    return descriptions[segment] || descriptions.others;
  }
  
  function segmentCustomers(rfmResults) {
    const segments = {};
    rfmResults.forEach(customer => {
      const seg = customer.segment;
      if (!segments[seg]) {
        segments[seg] = {
          name: seg, description: getSegmentDescription(seg),
          customers: [], totalValue: 0, totalCLV: 0, count: 0
        };
      }
      segments[seg].customers.push(customer);
      segments[seg].totalValue += customer.monetary || 0;
      segments[seg].totalCLV += customer.clv || 0;
      segments[seg].count++;
    });
    return Object.values(segments)
      .map(s => ({
        ...s,
        avgValue: s.count > 0 ? s.totalValue / s.count : 0,
        avgCLV: s.count > 0 ? s.totalCLV / s.count : 0
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }
  
  function generateMarketingActions(segments) {
    const actions = [];
    segments.forEach(seg => {
      const desc = seg.description;
      const action = {
        segment: seg.name, segmentAr: desc.name, icon: desc.icon,
        customerCount: seg.count, totalValue: Math.round(seg.totalValue),
        actions: [], priority: 'medium'
      };
      
      if (seg.name === 'cannot_lose' || seg.name === 'at_risk') {
        action.priority = 'urgent';
        action.actions.push('🚨 تدخل خلال 48 ساعة', '📞 اتصال شخصي من المدير');
        if (seg.name === 'cannot_lose') action.actions.push('💎 عرض حصري لا يمكن رفضه');
      } else if (seg.name === 'champions') {
        action.priority = 'high';
        action.actions.push('🎁 برنامج ولاء VIP', '🆕 وصول مبكر للمنتجات الجديدة', '📢 دعوة لحدث حصري');
      } else if (seg.name === 'loyal') {
        action.priority = 'high';
        action.actions.push('📦 Cross-sell للفئات الجديدة', '💰 خصم ولاء 5-10%');
      } else if (seg.name === 'potential_loyalists') {
        action.priority = 'medium';
        action.actions.push('🎯 عروض ترحيبية مخصصة', '📚 محتوى تعليمي عن المنتجات');
      } else if (seg.name === 'about_to_sleep') {
        action.priority = 'high';
        action.actions.push('⏰ حملة إيقاظ خلال أسبوع', '🎁 خصم 15% لإعادة النشاط');
      } else if (seg.name === 'hibernating') {
        action.priority = 'low';
        action.actions.push('📧 حملة email ربع سنوية');
      }
      
      actions.push(action);
    });
    return actions;
  }
  
  const RFMSegmentation = {
    version: 'v220.9.0',
    
    analyze(options = {}) {
      try {
        const O = getData();
        const customers = O.soc || [];
        const transactions = O.tx || [];
        
        if (customers.length === 0) {
          return { success: true, empty: true, message: 'لا توجد بيانات عملاء', segments: [], totalCustomers: 0 };
        }
        
        const rfm = calculateRFMScores(customers, transactions, options);
        const segments = segmentCustomers(rfm);
        const actions = generateMarketingActions(segments);
        
        const totalCLV = rfm.reduce((sum, c) => sum + (c.clv || 0), 0);
        const avgCLV = rfm.length > 0 ? totalCLV / rfm.length : 0;
        const highValue = rfm.filter(c => c.segment === 'champions' || c.segment === 'loyal').length;
        const atRisk = rfm.filter(c => c.riskScore >= 60).length;
        
        return {
          success: true, empty: false, totalCustomers: rfm.length,
          highValueCustomers: highValue, atRiskCustomers: atRisk,
          totalCLV: Math.round(totalCLV), avgCLV: Math.round(avgCLV),
          segments, customers: rfm.sort((a, b) => (b.clv || 0) - (a.clv || 0)),
          marketingActions: actions, duration: Date.now() - (this._startTime || Date.now())
        };
      } catch (e) {
        // 🛡️ حماية المتغيرات البيئية غير المعرفة في حال غياب حزمة اللوجر الأساسية
        if (typeof Logger !== 'undefined' && Logger.error) {
          Logger.error('RFM Analysis failed', e);
        } else {
          console.error('RFM Analysis failed:', e);
        }
        return { success: false, error: e.message };
      }
    },
    
    analyzeCustomer(customerName, options = {}) {
      try {
        const O = getData();
        const allCustomers = O.soc || [];
        const transactions = O.tx || [];
        const customers = allCustomers.filter(c => (c.nm || c.name) === customerName);
        const result = calculateRFMScores(customers, transactions, options);
        return { success: true, customer: result[0] || null };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
    
    selfTest() {
      const tests = [];
      const champ = { nm: 'A', rScore: 5, fScore: 5, mScore: 5, frequency: 10, monetary: 10000, transactionCount: 10, daysSince: 5 };
      const seg1 = classifySegment(champ.rScore, champ.fScore, champ.mScore);
      tests.push({ name: 'تصنيف Champions', pass: seg1 === 'champions' });
      
      const seg2 = classifySegment(1, 1, 1);
      tests.push({ name: 'تصنيف Hibernating', pass: seg2 === 'hibernating' });
      
      const seg3 = classifySegment(2, 4, 4);
      tests.push({ name: 'تصنيف At Risk', pass: seg3 === 'at_risk' });
      
      const seg4 = classifySegment(1, 5, 5);
      tests.push({ name: 'تصنيف Cannot Lose', pass: seg4 === 'cannot_lose' });
      
      const clv = predictCLV({ frequency: 10, monetary: 5000, transactionCount: 10, daysSince: 365, riskScore: 20 });
      tests.push({ name: 'حساب CLV', pass: clv > 0 && typeof clv === 'number' });
      
      const risk = calculateRiskScore({ daysSince: 365, frequency: 0, monetary: 0, transactionCount: 0 });
      tests.push({ name: 'حساب Risk Score (عميل خامل)', pass: risk >= 80 });
      
      return tests;
    }
  };
  
  window.RFMSegmentation = RFMSegmentation;
  
  if (typeof NAYEF_ENV !== 'undefined' && NAYEF_ENV.isDev && typeof Logger !== 'undefined') {
    Logger.info('RFMSegmentation ready [RFM + CLV + 11 segments]');
  }
})();
