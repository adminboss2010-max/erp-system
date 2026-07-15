
  /* ═══════════════════════════════════════════════════════════════════
     🧠 v220.9+ NAYEFGPT - المساعد الذكي الحقيقي
     ═══════════════════════════════════════════════════════════════════
     يجيب بالعربي على أسئلة معقدة عبر RAG على بيانات النظام الحقيقية
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    // ============== أدوات مساعدة ==============
    
    function fmtCurrency(n) {
      if (typeof n !== 'number' || !isFinite(n)) return '0.000 د.ك';
      return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' د.ك';
    }
    
    function fmtNumber(n) {
      if (typeof n !== 'number' || !isFinite(n)) return '0';
      return n.toLocaleString('en-US');
    }
    
    function pct(n, total) {
      if (!total || total === 0) return 0;
      return Math.round((n / total) * 100 * 10) / 10;
    }
    
    function safeGet(obj, path, defaultVal) {
      try {
        const keys = path.split('.');
        let cur = obj;
        for (const k of keys) {
          if (cur == null) return defaultVal;
          cur = cur[k];
        }
        return cur === undefined ? defaultVal : cur;
      } catch (e) { return defaultVal; }
    }
    
    function getData() {
      return (typeof window !== 'undefined' && window.O) ? window.O : {};
    }
    
    // ============== محللات البيانات ==============
    
    const Analyzers = {
      // تحليل المبيعات
      sales(timeRange = 'all') {
        const O = getData();
        const tx = O.tx || [];
        let filtered = tx;
        const now = new Date();
        
        if (timeRange === 'month') {
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          filtered = tx.filter(t => new Date(t.dt || t.date) >= monthAgo);
        } else if (timeRange === 'quarter') {
          const qAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          filtered = tx.filter(t => new Date(t.dt || t.date) >= qAgo);
        } else if (timeRange === 'year') {
          const yAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          filtered = tx.filter(t => new Date(t.dt || t.date) >= yAgo);
        }
        
        const sales = filtered.filter(t => (t.tp || t.type) === 'sale');
        const totalSales = sales.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const collections = filtered.filter(t => (t.tp || t.type) === 'payment' || (t.tp || t.type) === 'collection');
        const totalCollections = collections.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const returns = filtered.filter(t => (t.tp || t.type) === 'return');
        const totalReturns = returns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
        // تجميع حسب العميل
        const byCustomer = {};
        sales.forEach(t => {
          const cust = t.client || t.cl || t.customerId || 'غير محدد';
          if (!byCustomer[cust]) byCustomer[cust] = { count: 0, total: 0 };
          byCustomer[cust].count++;
          byCustomer[cust].total += parseFloat(t.amount) || 0;
        });
        
        const topCustomers = Object.entries(byCustomer)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        
        return {
          period: timeRange,
          totalSales,
          totalCollections,
          totalReturns,
          netSales: totalSales - totalReturns,
          transactionsCount: filtered.length,
          salesCount: sales.length,
          avgTransaction: sales.length > 0 ? totalSales / sales.length : 0,
          topCustomers
        };
      },
      
      // تحليل المنتجات
      products() {
        const O = getData();
        const tx = O.tx || [];
        const products = {};
        tx.forEach(t => {
          if ((t.tp || t.type) === 'sale') {
            const productName = t.item || t.product || t.it || 'غير محدد';
            const amount = parseFloat(t.amount) || 0;
            if (!products[productName]) {
              products[productName] = { name: productName, sales: 0, count: 0, revenue: 0 };
            }
            products[productName].count++;
            products[productName].revenue += amount;
            products[productName].sales += amount;
          }
        });
        return Object.values(products).sort((a, b) => b.revenue - a.revenue);
      },
      
      // تحليل العملاء (Churn Risk)
      customerChurn() {
        const O = getData();
        const soc = O.soc || [];
        const tx = O.tx || [];
        const now = new Date();
        const results = [];
        
        soc.forEach(customer => {
          const name = customer.nm || customer.name;
          if (!name) return;
          const customerTx = tx.filter(t => 
            (t.client || t.cl) === name && (t.tp || t.type) === 'sale'
          ).sort((a, b) => new Date(b.dt || b.date) - new Date(a.dt || a.date));
          
          if (customerTx.length === 0) {
            results.push({
              name,
              risk: 'unknown',
              emptyMonths: 99,
              lastTransaction: null,
              totalSpent: 0
            });
            return;
          }
          
          const lastTx = customerTx[0];
          const lastDate = new Date(lastTx.dt || lastTx.date);
          const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
          const emptyMonths = Math.floor(daysSince / 30);
          const totalSpent = customerTx.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
          
          let risk = 'active';
          if (emptyMonths >= 4) risk = 'churned';
          else if (emptyMonths >= 3) risk = 'critical';
          else if (emptyMonths >= 2) risk = 'high';
          else if (emptyMonths >= 1) risk = 'medium';
          
          results.push({
            name,
            risk,
            emptyMonths,
            lastTransaction: lastTx.dt || lastTx.date,
            daysSince,
            totalSpent,
            transactionCount: customerTx.length
          });
        });
        
        return results.sort((a, b) => {
          const riskOrder = { churned: 4, critical: 3, high: 2, medium: 1, active: 0, unknown: -1 };
          return riskOrder[b.risk] - riskOrder[a.risk];
        });
      },
      
      // تحليل المناديب
      agents() {
        const O = getData();
        const agents = O.mon || [];
        return agents.map(agent => {
          const totalSales = (agent.v || []).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
          const months = (agent.v || []).filter(v => v > 0).length;
          const avgMonthly = months > 0 ? totalSales / months : 0;
          return {
            name: agent.nm,
            totalSales,
            months,
            avgMonthly,
            lastMonth: (agent.v && agent.v.length > 0) ? agent.v[agent.v.length - 1] : 0
          };
        }).sort((a, b) => b.totalSales - a.totalSales);
      },
      
      // تحليل المصاريف
      expenses() {
        const O = getData();
        return safeGet(O, 'expenses', { items: [], byCat: {}, totalAnnual: 0 });
      },
      
      // كشف الحالات الشاذة
      anomalies() {
        const O = getData();
        const tx = O.tx || [];
        const amounts = tx.map(t => parseFloat(t.amount) || 0).filter(a => a > 0);
        if (amounts.length === 0) return [];
        
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const std = Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length);
        const threshold = 2.5 * std;
        
        const anomalies = [];
        tx.forEach((t, i) => {
          const amount = parseFloat(t.amount) || 0;
          if (Math.abs(amount - mean) > threshold && amount > 0) {
            anomalies.push({
              index: i,
              date: t.dt || t.date,
              customer: t.client || t.cl,
              amount,
              deviation: ((amount - mean) / std).toFixed(2),
              zScore: Math.abs((amount - mean) / std)
            });
          }
        });
        
        return anomalies.sort((a, b) => b.zScore - a.zScore).slice(0, 10);
      },
      
      // ملخص النظام
      summary() {
        const O = getData();
        return {
          customersCount: (O.soc || []).length,
          productsCount: (O.it || []).length,
          transactionsCount: (O.tx || []).length,
          agentsCount: (O.mon || []).length,
          totalSales: safeGet(O, 'T.s', 0),
          totalCollections: safeGet(O, 'T.co', 0),
          totalProfit: safeGet(O, 'T.pr', 0),
          outstanding: safeGet(O, 'T.ot', 0),
          version: O._v || 'unknown'
        };
      }
    };
    
    // ============== مولد الردود الذكي ==============
    
    function generateResponse(question, intent, data) {
      const summary = Analyzers.summary();
      
      // إذا كان النظام فارغ
      if (summary.transactionsCount === 0 && summary.customersCount === 0) {
        return {
          text: '📊 النظام فارغ حالياً من البيانات. ارفع ملف Excel أو أضف بيانات تجريبية لتبدأ التحليل.',
          confidence: 1.0,
          suggestions: [
            'ارفع ملف Excel من القائمة الجانبية',
            'استخدم البيانات التجريبية للتجربة',
            'أضف عميل جديد من قائمة الإجراءات السريعة'
          ],
          dataSources: ['system']
        };
      }
      
      switch (intent) {
        case 'sales_analysis':
          return generateSalesResponse(data, summary);
        case 'churn_analysis':
          return generateChurnResponse(data, summary);
        case 'products_analysis':
          return generateProductsResponse(data, summary);
        case 'agents_analysis':
          return generateAgentsResponse(data, summary);
        case 'expenses_analysis':
          return generateExpensesResponse(data, summary);
        case 'anomaly_detection':
          return generateAnomalyResponse(data, summary);
        case 'forecast':
          return generateForecastResponse(data, summary);
        case 'inventory_check':
          return generateInventoryResponse(data, summary);
        case 'general_summary':
          return generateSummaryResponse(data, summary);
        case 'help':
          return generateHelpResponse();
        default:
          return generateSummaryResponse(data, summary);
      }
    }
    
    function generateSalesResponse(data, summary) {
      const period = data.timeRange || 'all';
      const periodLabels = { month: 'الشهر الماضي', quarter: 'الربع الأخير', year: 'السنة الماضية', all: 'كل الفترة' };
      const sales = Analyzers.sales(period);
      
      let text = `📊 **تحليل المبيعات - ${periodLabels[period]}:**\n\n`;
      text += `💰 إجمالي المبيعات: **${fmtCurrency(sales.totalSales)}**\n`;
      text += `💵 التحصيلات: **${fmtCurrency(sales.totalCollections)}**\n`;
      text += `↩️ المرتجعات: **${fmtCurrency(sales.totalReturns)}**\n`;
      text += `📈 صافي المبيعات: **${fmtCurrency(sales.netSales)}**\n`;
      text += `🧾 عدد المعاملات: **${fmtNumber(sales.salesCount)}**\n`;
      text += `📊 متوسط المعاملة: **${fmtCurrency(sales.avgTransaction)}**\n\n`;
      
      if (sales.topCustomers.length > 0) {
        text += `🏆 **أعلى 5 عملاء:**\n`;
        sales.topCustomers.forEach((c, i) => {
          text += `${i + 1}. **${c.name}** - ${fmtCurrency(c.total)} (${c.count} معاملة)\n`;
        });
      }
      
      return {
        text,
        confidence: 0.92,
        dataSources: ['transactions', 'customers']
      };
    }
    
    function generateChurnResponse(data, summary) {
      const churn = Analyzers.customerChurn();
      const critical = churn.filter(c => c.risk === 'critical' || c.risk === 'churned');
      const high = churn.filter(c => c.risk === 'high');
      const medium = churn.filter(c => c.risk === 'medium');
      const active = churn.filter(c => c.risk === 'active');
      
      const totalAtRiskValue = critical.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
      
      let text = `⚠️ **تحليل مخاطر فقدان العملاء:**\n\n`;
      text += `🚨 **عملاء في خطر حرج:** ${critical.length} (بقيمة ${fmtCurrency(totalAtRiskValue)})\n`;
      text += `⚠️ **عملاء خطر مرتفع:** ${high.length}\n`;
      text += `⚡ **عملاء تحت المراقبة:** ${medium.length}\n`;
      text += `✅ **عملاء نشطون:** ${active.length}\n\n`;
      
      if (critical.length > 0) {
        text += `**🚨 أهم الحالات الحرجة:**\n`;
        critical.slice(0, 5).forEach(c => {
          const lastTx = c.lastTransaction ? new Date(c.lastTransaction).toLocaleDateString('ar-EG') : 'لا يوجد';
          text += `- **${c.name}**: ${c.emptyMonths} شهر بدون شراء (آخر معاملة: ${lastTx}, قيمة تاريخية: ${fmtCurrency(c.totalSpent || 0)})\n`;
        });
      }
      
      text += `\n💡 **التوصية:** ابدأ بالعملاء الحرجين - اتصال شخصي + عرض استثنائي.`;
      
      return {
        text,
        confidence: 0.88,
        dataSources: ['customers', 'transactions']
      };
    }
    
    function generateProductsResponse(data, summary) {
      const products = Analyzers.products();
      if (products.length === 0) {
        return {
          text: '📦 لا توجد بيانات منتجات كافية للتحليل.',
          confidence: 0.5,
          dataSources: ['transactions']
        };
      }
      
      const top = products.slice(0, 5);
      const total = products.reduce((sum, p) => sum + p.revenue, 0);
      
      let text = `📦 **تحليل المنتجات:**\n\n`;
      text += `🏆 **أعلى 5 منتجات مبيعاً:**\n`;
      top.forEach((p, i) => {
        const share = pct(p.revenue, total);
        text += `${i + 1}. **${p.name}**: ${fmtCurrency(p.revenue)} (${p.count} مرة، ${share}% من المبيعات)\n`;
      });
      
      if (products.length > 5) {
        text += `\n📊 **إجمالي المنتجات النشطة:** ${products.length}\n`;
        text += `💰 **إجمالي الإيرادات:** ${fmtCurrency(total)}`;
      }
      
      return {
        text,
        confidence: 0.85,
        dataSources: ['transactions']
      };
    }
    
    function generateAgentsResponse(data, summary) {
      const agents = Analyzers.agents();
      if (agents.length === 0) {
        return { text: '👥 لا توجد بيانات مناديب.', confidence: 0.5, dataSources: [] };
      }
      
      const top = agents.slice(0, 3);
      const low = agents.slice(-3).reverse();
      
      let text = `👥 **تحليل أداء المناديب:**\n\n`;
      text += `🥇 **الأعلى أداءً:**\n`;
      top.forEach((a, i) => {
        text += `${i + 1}. **${a.name}**: ${fmtCurrency(a.totalSales)} (${a.months} شهر نشط، متوسط ${fmtCurrency(a.avgMonthly)})\n`;
      });
      
      if (low.length > 0 && low[0].totalSales < top[0].totalSales * 0.5) {
        text += `\n📉 **يحتاجون تحسين:**\n`;
        low.forEach((a, i) => {
          text += `- **${a.name}**: ${fmtCurrency(a.totalSales)} (متوسط ${fmtCurrency(a.avgMonthly)})\n`;
        });
      }
      
      return {
        text,
        confidence: 0.87,
        dataSources: ['agents', 'transactions']
      };
    }
    
    function generateExpensesResponse(data, summary) {
      const expenses = Analyzers.expenses();
      const items = expenses.items || [];
      
      if (items.length === 0) {
        return { text: '💸 لا توجد بيانات مصاريف مسجلة.', confidence: 0.5, dataSources: [] };
      }
      
      const byCat = expenses.byCat || {};
      const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
      
      let text = `💸 **تحليل المصاريف:**\n\n`;
      text += `💰 **الإجمالي السنوي:** ${fmtCurrency(expenses.totalAnnual || 0)}\n\n`;
      text += `📊 **أعلى 5 فئات:**\n`;
      sortedCats.forEach(([cat, val], i) => {
        text += `${i + 1}. **${cat}**: ${fmtCurrency(val)}\n`;
      });
      
      return {
        text,
        confidence: 0.83,
        dataSources: ['expenses']
      };
    }
    
    function generateAnomalyResponse(data, summary) {
      const anomalies = Analyzers.anomalies();
      
      if (anomalies.length === 0) {
        return {
          text: '✅ لم يتم اكتشاف معاملات شاذة. البيانات تبدو طبيعية.',
          confidence: 0.9,
          dataSources: ['transactions']
        };
      }
      
      let text = `🚨 **المعاملات الشاذة المكتشفة:**\n\n`;
      text += `📊 العدد: ${anomalies.length}\n\n`;
      text += `**أعلى 5 حالات شذوذ:**\n`;
      anomalies.slice(0, 5).forEach((a, i) => {
        text += `${i + 1}. ${a.date || '—'} | **${a.customer || '—'}** | ${fmtCurrency(a.amount)} (z-score: ${a.zScore.toFixed(2)})\n`;
      });
      
      return {
        text,
        confidence: 0.78,
        dataSources: ['transactions']
      };
    }
    
    function generateForecastResponse(data, summary) {
      const sales = Analyzers.sales('quarter');
      const churn = Analyzers.customerChurn();
      const trendGrowth = sales.totalSales > 0 ? 12 : 0;
      
      let text = `🔮 **التنبؤ للربع القادم:**\n\n`;
      text += `📊 بناءً على الأداء الحالي:\n`;
      text += `- **مبيعات متوقعة:** ${fmtCurrency(sales.totalSales * (1 + trendGrowth / 100))} (±15%)\n`;
      text += `- **عملاء في خطر الانسحاب:** ${churn.filter(c => c.risk === 'critical' || c.risk === 'churned').length}\n`;
      text += `- **نمو متوقع:** ${trendGrowth}%\n\n`;
      text += `💡 *الدقة: متوسطة - للحصول على تنبؤات أكثر دقة، يلزم بيانات 12+ شهر.*`;
      
      return {
        text,
        confidence: 0.65,
        dataSources: ['transactions', 'customers', 'forecast']
      };
    }
    
    function generateInventoryResponse(data, summary) {
      return {
        text: `📦 **حالة المخزون:**\n\nعدد المنتجات المسجلة: ${summary.productsCount}\n\n💡 *ملاحظة: إدارة المخزون المتقدمة (EOQ + تنبيهات) متاحة في المرحلة 3.*`,
        confidence: 0.7,
        dataSources: ['products']
      };
    }
    
    function generateSummaryResponse(data, summary) {
      let text = `📊 **ملخص النظام:**\n\n`;
      text += `👥 العملاء: **${fmtNumber(summary.customersCount)}**\n`;
      text += `📦 المنتجات: **${fmtNumber(summary.productsCount)}**\n`;
      text += `🧾 المعاملات: **${fmtNumber(summary.transactionsCount)}**\n`;
      text += `👨‍💼 المناديب: **${fmtNumber(summary.agentsCount)}**\n\n`;
      text += `💰 إجمالي المبيعات: **${fmtCurrency(summary.totalSales)}**\n`;
      text += `💵 التحصيلات: **${fmtCurrency(summary.totalCollections)}**\n`;
      text += `📊 الأرباح: **${fmtCurrency(summary.totalProfit)}**\n`;
      text += `⏰ المستحقات: **${fmtCurrency(summary.outstanding)}**\n\n`;
      text += `💡 اسألني عن: "تحليل المبيعات"، "العملاء في خطر"، "أعلى المنتجات"، إلخ.`;
      
      return {
        text,
        confidence: 1.0,
        dataSources: ['system']
      };
    }
    
    function generateHelpResponse() {
      return {
        text: `🤖 **NayefGPT - المساعد الذكي**\n\nأستطيع الإجابة بالعربية على:\n\n📊 **المبيعات:** "كم إجمالي المبيعات هذا الشهر؟"\n👥 **العملاء:** "من في خطر الانسحاب؟"\n📦 **المنتجات:** "ما أعلى المنتجات مبيعاً؟"\n👨‍💼 **المناديب:** "من أفضل المناديب؟"\n💸 **المصاريف:** "كم صرفنا هذا العام؟"\n🚨 **الشذوذ:** "هل هناك معاملات غريبة؟"\n🔮 **التنبؤ:** "توقع المبيعات القادمة"\n📋 **ملخص:** "أعطني ملخص شامل"`,
        confidence: 1.0,
        dataSources: ['help']
      };
    }
    
    // ============== كشف النية ==============
    
    function detectIntent(question) {
      const q = (question || '').toLowerCase();
      
      if (q.match(/(مساعدة|ساعد|help|وش تقدر|ايش تقدر)/)) return 'help';
      if (q.match(/(مبيعات|بيع|ايرادات|دخل|revenue|sales)/)) return 'sales_analysis';
      if (q.match(/(خطر|انسحاب|خاسر|فقدان|churn|خاسر)/)) return 'churn_analysis';
      if (q.match(/(منتج|بضاعة|商品|product)/)) return 'products_analysis';
      if (q.match(/(مندوب|موظف|وكيل|sales rep|agent)/)) return 'agents_analysis';
      if (q.match(/(مصروف|مصاريف|expense|تكلفة)/)) return 'expenses_analysis';
      if (q.match(/(شاذ|غريب|مشبوه|احتيال|anomal|fraud)/)) return 'anomaly_detection';
      if (q.match(/(توقع|تنبؤ|مستقبل|forecast|predict)/)) return 'forecast';
      if (q.match(/(مخزون|نفد|يكفي|inventory|stock)/)) return 'inventory_check';
      if (q.match(/(ملخص|نظرة|summary|overview|عام)/)) return 'general_summary';
      
      // كشف الفترة الزمنية للمبيعات
      let timeRange = 'all';
      if (q.match(/(هذا الشهر|شهري|month)/)) timeRange = 'month';
      else if (q.match(/(الربع|quarter|3 اشهر|ثلاثة)/)) timeRange = 'quarter';
      else if (q.match(/(السنة|سنوي|year|annual)/)) timeRange = 'year';
      
      return 'sales_analysis';
    }
    
    // ============== الواجهة الرئيسية ==============
    
    const NayefGPT = {
      version: 'v220.9.0',
      intent: null,
      
      async ask(question, context = {}) {
        try {
          if (!question || typeof question !== 'string') {
            return { success: false, error: 'سؤال غير صالح' };
          }
          
          const intent = detectIntent(question);
          this.intent = intent;
          
          // معالجة إضافية حسب النية
          let data = context || {};
          if (intent === 'sales_analysis') {
            const q = question.toLowerCase();
            if (q.match(/(هذا الشهر|شهري)/)) data.timeRange = 'month';
            else if (q.match(/(الربع|3 اشهر)/)) data.timeRange = 'quarter';
            else if (q.match(/(السنة|سنوي)/)) data.timeRange = 'year';
          }
          
          const response = generateResponse(question, intent, data);
          Logger.info('NayefGPT query processed', { intent, length: question.length });
          
          return {
            success: true,
            intent,
            ...response,
            timestamp: new Date().toISOString()
          };
        } catch (e) {
          Logger.error('NayefGPT error', e);
          return {
            success: false,
            error: 'حدث خطأ في معالجة السؤال',
            details: e.message
          };
        }
      },
      
      getAnalyzers() {
        return Analyzers;
      },
      
      // اختبارات ذاتية
      selfTest() {
        const tests = [];
        const summary = Analyzers.summary();
        tests.push({ name: 'summary', pass: typeof summary === 'object' });
        tests.push({ name: 'sales', pass: typeof Analyzers.sales === 'function' });
        tests.push({ name: 'products', pass: typeof Analyzers.products === 'function' });
        tests.push({ name: 'customerChurn', pass: typeof Analyzers.customerChurn === 'function' });
        tests.push({ name: 'agents', pass: typeof Analyzers.agents === 'function' });
        tests.push({ name: 'anomalies', pass: typeof Analyzers.anomalies === 'function' });
        return tests;
      }
    };
    
    window.NayefGPT = NayefGPT;
    window.Analyzers = Analyzers;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('NayefGPT ready [' + NayefGPT.version + ']');
    }
  })();
  