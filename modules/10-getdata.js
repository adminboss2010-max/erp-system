
  /* ═══════════════════════════════════════════════════════════════════
     📊 v220.9+ RFM SEGMENTATION + CLV PREDICTION
     ═══════════════════════════════════════════════════════════════════
     تجزئة العملاء باستخدام:
     - R (Recency): آخر شراء
     - F (Frequency): تكرار
     - M (Monetary): القيمة المالية
     - CLV (Customer Lifetime Value) تنبؤي
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    function getData() {
      return (typeof window !== 'undefined' && window.O) ? window.O : {};
    }
    
    // حساب RFM Scores لكل عميل
    function calculateRFMScores(customers, transactions, options = {}) {
      const config = Object.assign({
        referenceDate: new Date(),
        recencyBuckets: 5,
        frequencyBuckets: 5,
        monetaryBuckets: 5
      }, options || {});
      
      const now = config.referenceDate;
      const results = [];
      
      customers.forEach(customer => {
        const name = customer.nm || customer.name;
        if (!name) return;
        
        // كل المعاملات لهذا العميل
        const customerTx = transactions.filter(t => 
          (t.client || t.cl || t.customerId) === name
        );
        
        if (customerTx.length === 0) {
          results.push({
            name,
            recency: null,
            frequency: 0,
            monetary: 0,
            rfm: '000',
            segment: 'unknown',
            clv: 0,
            riskScore: 100,
            transactionCount: 0,
            lastTransaction: null,
            daysSince: Infinity
          });
          return;
        }
        
        // حساب R, F, M
        const sales = customerTx.filter(t => (t.tp || t.type) === 'sale');
        const lastSale = sales.sort((a, b) => 
          new Date(b.dt || b.date) - new Date(a.dt || a.date)
        )[0];
        const lastDate = new Date(lastSale.dt || lastSale.date);
        const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        const frequency = customerTx.length;
        const monetary = customerTx.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
        results.push({
          name,
          recency: daysSince,
          frequency,
          monetary,
          transactionCount: customerTx.length,
          lastTransaction: lastSale.dt || lastSale.date,
          daysSince
        });
      });
      
      // حساب Recency Score (أقل = أفضل، نعكس الترتيب)
      const validRecencies = results.filter(r => r.recency !== null).map(r => r.recency);
      if (validRecencies.length > 0) {
        const sorted = [...validRecencies].sort((a, b) => a - b);
        const bucketSize = Math.ceil(sorted.length / config.recencyBuckets);
        results.forEach(r => {
          if (r.recency === null) { r.rScore = 0; return; }
          const idx = sorted.indexOf(r.recency);
          // أقل = score أعلى
          r.rScore = config.recencyBuckets - Math.floor(idx / bucketSize);
          r.rScore = Math.max(1, Math.min(config.recencyBuckets, r.rScore));
        });
      }
      
      // حساب Frequency Score (أعلى = أفضل)
      const frequencies = results.map(r => r.frequency);
      const sortedFreq = [...frequencies].sort((a, b) => a - b);
      const freqBucketSize = Math.ceil(sortedFreq.length / config.frequencyBuckets);
      results.forEach(r => {
        const idx = sortedFreq.indexOf(r.frequency);
        r.fScore = Math.min(config.frequencyBuckets, Math.floor(idx / freqBucketSize) + 1);
        r.fScore = Math.max(1, r.fScore);
      });
      
      // حساب Monetary Score (أعلى = أفضل)
      const monetaries = results.map(r => r.monetary);
      const sortedMon = [...monetaries].sort((a, b) => a - b);
      const monBucketSize = Math.ceil(sortedMon.length / config.monetaryBuckets);
      results.forEach(r => {
        const idx = sortedMon.indexOf(r.monetary);
        r.mScore = Math.min(config.monetaryBuckets, Math.floor(idx / monBucketSize) + 1);
        r.mScore = Math.max(1, r.mScore);
      });
      
      // RFM String + Segment
      results.forEach(r => {
        if (r.recency === null) {
          r.rfm = '000';
          r.segment = 'unknown';
          return;
        }
        r.rfm = `${r.rScore}${r.fScore}${r.mScore}`;
        r.segment = classifySegment(r.rScore, r.fScore, r.mScore);
        r.riskScore = calculateRiskScore(r);
        r.clv = predictCLV(r);
      });
      
      return results;
    }
    
    function classifySegment(r, f, m) {
      // Cannot Lose Them: r منخفض جداً (1) + كان عالي (f>=4, m>=4)
      if (r <= 1 && f >= 4 && m >= 4) return 'cannot_lose';
      // Champions: أعلى r, f, m
      if (r >= 4 && f >= 4 && m >= 4) return 'champions';
      // Loyal Customers: r,f عالي، m متوسط
      if (r >= 4 && f >= 3 && m >= 3) return 'loyal';
      // At Risk: r منخفض (1-2)، f,m عالي (>=3)
      if (r <= 2 && f >= 3 && m >= 3) return 'at_risk';
      // Potential Loyalists: r عالي، f متوسط
      if (r >= 4 && f >= 2 && f <= 3) return 'potential_loyalists';
      // Recent Customers: r عالي، f منخفض
      if (r >= 4 && f <= 1) return 'recent';
      // Promising: r,m متوسط، f منخفض
      if (r >= 3 && m >= 3 && f <= 2) return 'promising';
      // Need Attention: r متوسط، f,m متوسط
      if (r === 3 && f >= 2 && f <= 3) return 'need_attention';
      // About to Sleep: r متوسط-منخفض (2-3)، f متوسط (2-3)
      if (r >= 2 && r <= 3 && f >= 2 && f <= 3) return 'about_to_sleep';
      // Hibernating: r,f,m منخفض
      if (r <= 2 && f <= 2 && m <= 2) return 'hibernating';
      return 'others';
    }
    
    function calculateRiskScore(customer) {
      // 0-100، 100 = أعلى خطر
      let score = 0;
      // Recency (40%)
      if (customer.daysSince > 365) score += 40;
      else if (customer.daysSince > 180) score += 30;
      else if (customer.daysSince > 90) score += 20;
      else if (customer.daysSince > 60) score += 10;
      // Frequency (30%)
      if (customer.frequency === 0) score += 30;
      else if (customer.frequency <= 2) score += 20;
      else if (customer.frequency <= 5) score += 10;
      // Monetary declining (30%)
      const avgTxValue = customer.frequency > 0 ? customer.monetary / customer.frequency : 0;
      if (avgTxValue < 100) score += 30;
      else if (avgTxValue < 500) score += 20;
      else if (avgTxValue < 1000) score += 10;
      return Math.min(100, Math.max(0, score));
    }
    
    // CLV بسيط (BG/NBD-style)
    function predictCLV(customer) {
      if (!customer || customer.transactionCount === 0) return 0;
      
      // معدل الشراء الشهري
      const customerAgeDays = customer.daysSince || 1;
      const monthlyFrequency = customer.transactionCount / Math.max(1, customerAgeDays / 30);
      
      // متوسط قيمة المعاملة
      const avgTransactionValue = customer.monetary / customer.transactionCount;
      
      // توقع ل 12 شهر
      // CLV = freq_monthly * avg_value * 12 * retention_factor
      const retentionFactor = Math.max(0.1, 1 - (customer.riskScore / 100));
      const predictedAnnualFrequency = monthlyFrequency * 12 * retentionFactor;
      const clv = predictedAnnualFrequency * avgTransactionValue;
      
      return Math.round(clv * 100) / 100;
    }
    
    // Get segment description in Arabic
    function getSegmentDescription(segment) {
      const descriptions = {
        champions: {
          name: 'الأبطال',
          icon: '🏆',
          strategy: 'برنامج ولاء ذهبي + منتجات حصرية',
          color: '#10b981'
        },
        loyal: {
          name: 'العملاء المخلصون',
          icon: '⭐',
          strategy: 'Cross-sell + باقات مميزة',
          color: '#3b82f6'
        },
        potential_loyalists: {
          name: 'محتملون للولاء',
          icon: '🌱',
          strategy: 'عروض ترحيبية + تجربة منتجات جديدة',
          color: '#8b5cf6'
        },
        recent: {
          name: 'عملاء جدد',
          icon: '🆕',
          strategy: 'بناء علاقة + onboarding ممتاز',
          color: '#06b6d4'
        },
        promising: {
          name: 'واعدون',
          icon: '🌟',
          strategy: 'تحفيز بالولاء + مكافآت',
          color: '#14b8a6'
        },
        need_attention: {
          name: 'يحتاجون اهتمام',
          icon: '👀',
          strategy: 'تواصل شخصي + عروض مخصصة',
          color: '#f59e0b'
        },
        about_to_sleep: {
          name: 'على وشك النوم',
          icon: '😴',
          strategy: 'حملة إيقاظ فورية',
          color: '#f97316'
        },
        at_risk: {
          name: 'في خطر',
          icon: '⚠️',
          strategy: 'تدخل عاجل + عرض استثنائي',
          color: '#ef4444'
        },
        cannot_lose: {
          name: 'لا يمكن خسارتهم',
          icon: '🚨',
          strategy: 'تدخل شخصي من الإدارة العليا',
          color: '#dc2626'
        },
        hibernating: {
          name: 'خاملون',
          icon: '💤',
          strategy: 'حملة إعادة تنشيط',
          color: '#6b7280'
        },
        others: {
          name: 'آخرون',
          icon: '❓',
          strategy: 'تحليل أعمق مطلوب',
          color: '#94a3b8'
        },
        unknown: {
          name: 'غير معروف',
          icon: '❔',
          strategy: 'لا توجد معاملات سابقة',
          color: '#cbd5e1'
        }
      };
      return descriptions[segment] || descriptions.others;
    }
    
    // تجميع العملاء حسب الشريحة
    function segmentCustomers(rfmResults) {
      const segments = {};
      rfmResults.forEach(customer => {
        const seg = customer.segment;
        if (!segments[seg]) {
          segments[seg] = {
            name: seg,
            description: getSegmentDescription(seg),
            customers: [],
            totalValue: 0,
            totalCLV: 0,
            count: 0
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
    
    // توليد توصيات تسويقية لكل شريحة
    function generateMarketingActions(segments) {
      const actions = [];
      segments.forEach(seg => {
        const desc = seg.description;
        const action = {
          segment: seg.name,
          segmentAr: desc.name,
          icon: desc.icon,
          customerCount: seg.count,
          totalValue: Math.round(seg.totalValue),
          actions: [],
          priority: 'medium'
        };
        
        // تحديد الأولوية
        if (seg.name === 'cannot_lose' || seg.name === 'at_risk') {
          action.priority = 'urgent';
          action.actions.push('🚨 تدخل خلال 48 ساعة');
          action.actions.push('📞 اتصال شخصي من المدير');
          if (seg.name === 'cannot_lose') {
            action.actions.push('💎 عرض حصري لا يمكن رفضه');
          }
        } else if (seg.name === 'champions') {
          action.priority = 'high';
          action.actions.push('🎁 برنامج ولاء VIP');
          action.actions.push('🆕 وصول مبكر للمنتجات الجديدة');
          action.actions.push('📢 دعوة لحدث حصري');
        } else if (seg.name === 'loyal') {
          action.priority = 'high';
          action.actions.push('📦 Cross-sell للفئات الجديدة');
          action.actions.push('💰 خصم ولاء 5-10%');
        } else if (seg.name === 'potential_loyalists') {
          action.priority = 'medium';
          action.actions.push('🎯 عروض ترحيبية مخصصة');
          action.actions.push('📚 محتوى تعليمي عن المنتجات');
        } else if (seg.name === 'about_to_sleep') {
          action.priority = 'high';
          action.actions.push('⏰ حملة إيقاظ خلال أسبوع');
          action.actions.push('🎁 خصم 15% لإعادة النشاط');
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
      
      // الدالة الرئيسية: تحلل النظام الحالي
      analyze(options = {}) {
        try {
          const O = getData();
          const customers = O.soc || [];
          const transactions = O.tx || [];
          
          if (customers.length === 0) {
            return {
              success: true,
              empty: true,
              message: 'لا توجد بيانات عملاء',
              segments: [],
              totalCustomers: 0
            };
          }
          
          const rfm = calculateRFMScores(customers, transactions, options);
          const segments = segmentCustomers(rfm);
          const actions = generateMarketingActions(segments);
          
          // حساب إحصائيات عامة
          const totalCLV = rfm.reduce((sum, c) => sum + (c.clv || 0), 0);
          const avgCLV = rfm.length > 0 ? totalCLV / rfm.length : 0;
          const highValue = rfm.filter(c => c.segment === 'champions' || c.segment === 'loyal').length;
          const atRisk = rfm.filter(c => c.riskScore >= 60).length;
          
          return {
            success: true,
            empty: false,
            totalCustomers: rfm.length,
            highValueCustomers: highValue,
            atRiskCustomers: atRisk,
            totalCLV: Math.round(totalCLV),
            avgCLV: Math.round(avgCLV),
            segments,
            customers: rfm.sort((a, b) => (b.clv || 0) - (a.clv || 0)),
            marketingActions: actions,
            duration: Date.now() - (this._startTime || Date.now())
          };
        } catch (e) {
          Logger.error('RFM Analysis failed', e);
          return { success: false, error: e.message };
        }
      },
      
      // Single customer analysis
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
      
      // اختبارات ذاتية
      selfTest() {
        const tests = [];
        
        // Test 1: champions
        const champ = { nm: 'A', rScore: 5, fScore: 5, mScore: 5, frequency: 10, monetary: 10000, transactionCount: 10, daysSince: 5 };
        const seg1 = classifySegment(champ.rScore, champ.fScore, champ.mScore);
        tests.push({ name: 'تصنيف Champions', pass: seg1 === 'champions' });
        
        // Test 2: hibernating
        const seg2 = classifySegment(1, 1, 1);
        tests.push({ name: 'تصنيف Hibernating', pass: seg2 === 'hibernating' });
        
        // Test 3: at risk
        const seg3 = classifySegment(2, 4, 4);
        tests.push({ name: 'تصنيف At Risk', pass: seg3 === 'at_risk' });
        
        // Test 4: cannot lose
        const seg4 = classifySegment(1, 5, 5);
        tests.push({ name: 'تصنيف Cannot Lose', pass: seg4 === 'cannot_lose' });
        
        // Test 5: CLV calculation
        const clv = predictCLV({ frequency: 10, monetary: 5000, transactionCount: 10, daysSince: 365, riskScore: 20 });
        tests.push({ name: 'حساب CLV', pass: clv > 0 && typeof clv === 'number' });
        
        // Test 6: Risk score
        const risk = calculateRiskScore({ daysSince: 365, frequency: 0, monetary: 0, transactionCount: 0 });
        tests.push({ name: 'حساب Risk Score (عميل خامل)', pass: risk >= 80 });
        
        return tests;
      }
    };
    
    window.RFMSegmentation = RFMSegmentation;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('RFMSegmentation ready [RFM + CLV + 11 segments]');
    }
  })();
  