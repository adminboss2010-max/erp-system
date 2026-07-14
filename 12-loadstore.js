
  /* ═══════════════════════════════════════════════════════════════════
     👥 v220.9+ CRM - نظام إدارة علاقات العملاء 360°
     ═══════════════════════════════════════════════════════════════════
     - سجل التفاعلات الكامل (مكالمات، زيارات، إيميلات)
     - Lead Scoring ذكي
     - Next Best Action
     - ملاحظات وتاجات
     - ربط بالمعاملات والاجتجات
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const STORAGE_KEYS = {
      interactions: 'nayef_crm_interactions',
      notes: 'nayef_crm_notes',
      tags: 'nayef_crm_tags',
      leads: 'nayef_crm_leads',
      tasks: 'nayef_crm_tasks'
    };
    
    function loadStore(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        Logger.error('CRM load failed', e, { key });
        return [];
      }
    }
    
    function saveStore(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e) {
        Logger.error('CRM save failed', e, { key });
        return false;
      }
    }
    
    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
    
    function getCustomerData(customerName) {
      const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
      const customer = (O.soc || []).find(c => (c.nm || c.name) === customerName);
      const transactions = (O.tx || []).filter(t => 
        (t.client || t.cl) === customerName
      );
      return { customer, transactions };
    }
    
    // ============== أنواع التفاعلات ==============
    
    const InteractionTypes = {
      call: { icon: '📞', name: 'مكالمة', points: 5 },
      visit: { icon: '🚗', name: 'زيارة', points: 15 },
      email: { icon: '📧', name: 'بريد إلكتروني', points: 3 },
      whatsapp: { icon: '💬', name: 'واتساب', points: 4 },
      meeting: { icon: '🤝', name: 'اجتماع', points: 20 },
      complaint: { icon: '⚠️', name: 'شكوى', points: -10 },
      compliment: { icon: '🎉', name: 'إشادة', points: 10 },
      order: { icon: '🛒', name: 'طلب', points: 25 },
      payment: { icon: '💵', name: 'دفعة', points: 8 },
      negotiation: { icon: '💬', name: 'تفاوض', points: 12 },
      demo: { icon: '🎯', name: 'عرض تجريبي', points: 18 },
      follow_up: { icon: '🔄', name: 'متابعة', points: 5 },
      reminder: { icon: '⏰', name: 'تذكير', points: 2 },
      note: { icon: '📝', name: 'ملاحظة', points: 1 }
    };
    
    // ============== إدارة التفاعلات ==============
    
    const CRM = {
      version: 'v220.9.0',
      
      // تسجيل تفاعل جديد
      logInteraction(customerName, type, details = {}) {
        try {
          if (!InteractionTypes[type]) {
            return { success: false, error: 'نوع تفاعل غير معروف: ' + type };
          }
          
          const interactions = loadStore(STORAGE_KEYS.interactions);
          const interaction = {
            id: generateId(),
            customerName,
            type,
            timestamp: Date.now(),
            date: new Date().toISOString(),
            points: InteractionTypes[type].points,
            agent: details.agent || (typeof getCurrentUser === 'function' ? getCurrentUser() : 'system'),
            outcome: details.outcome || 'neutral', // positive, neutral, negative
            notes: details.notes || '',
            duration: details.duration || 0, // minutes
            amount: details.amount || 0,
            metadata: details.metadata || {}
          };
          
          interactions.push(interaction);
          saveStore(STORAGE_KEYS.interactions, interactions);
          
          Logger.info('CRM interaction logged', { customer: customerName, type });
          return { success: true, interaction };
        } catch (e) {
          Logger.error('CRM logInteraction failed', e);
          return { success: false, error: e.message };
        }
      },
      
      // جلب التفاعلات لعميل
      getInteractions(customerName, options = {}) {
        const interactions = loadStore(STORAGE_KEYS.interactions);
        let filtered = interactions.filter(i => i.customerName === customerName);
        
        if (options.since) {
          filtered = filtered.filter(i => i.timestamp >= options.since);
        }
        if (options.until) {
          filtered = filtered.filter(i => i.timestamp <= options.until);
        }
        if (options.type) {
          filtered = filtered.filter(i => i.type === options.type);
        }
        
        return filtered.sort((a, b) => b.timestamp - a.timestamp);
      },
      
      // كل التفاعلات (للتقرير)
      getAllInteractions(options = {}) {
        let interactions = loadStore(STORAGE_KEYS.interactions);
        if (options.since) {
          interactions = interactions.filter(i => i.timestamp >= options.since);
        }
        return interactions.sort((a, b) => b.timestamp - a.timestamp);
      },
      
      // ملخص 360° لعميل
      getCustomer360(customerName) {
        const interactions = this.getInteractions(customerName);
        const { customer, transactions } = getCustomerData(customerName);
        const notes = this.getNotes(customerName);
        const tags = this.getTags(customerName);
        const tasks = this.getTasks(customerName);
        
        const totalSpent = transactions
          .filter(t => (t.tp || t.type) === 'sale')
          .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        
        const lastInteraction = interactions[0];
        const lastTransaction = transactions.sort((a, b) => 
          new Date(b.dt || b.date) - new Date(a.dt || a.date)
        )[0];
        
        // Engagement Score
        const engagementScore = this.calculateEngagementScore(interactions);
        
        // Sentiment Analysis (simple)
        const sentiment = this.analyzeSentiment(interactions);
        
        // Lead Score
        const leadScore = this.calculateLeadScore({
          customer,
          transactions,
          interactions,
          engagementScore
        });
        
        return {
          customer,
          summary: {
            transactionCount: transactions.length,
            totalSpent,
            lastTransactionDate: lastTransaction ? (lastTransaction.dt || lastTransaction.date) : null,
            lastTransactionAmount: lastTransaction ? (parseFloat(lastTransaction.amount) || 0) : 0,
            interactionsCount: interactions.length,
            engagementScore,
            sentiment,
            leadScore
          },
          interactions: interactions.slice(0, 20), // آخر 20 تفاعل
          notes,
          tags,
          tasks,
          recommendations: this.getNextBestActions(customerName, {
            engagementScore,
            leadScore,
            sentiment,
            lastTransactionDate: lastTransaction ? (lastTransaction.dt || lastTransaction.date) : null
          })
        };
      },
      
      // Engagement Score (0-100)
      calculateEngagementScore(interactions) {
        if (!interactions || interactions.length === 0) return 0;
        const recent = interactions.filter(i => 
          Date.now() - i.timestamp < 90 * 24 * 60 * 60 * 1000 // آخر 90 يوم
        );
        let score = 0;
        recent.forEach(i => {
          let s = Math.max(0, i.points || 0);
          if (i.outcome === 'positive') s *= 1.5;
          if (i.outcome === 'negative') s *= 0.5;
          score += s;
        });
        // تطبيع لـ 0-100
        return Math.min(100, Math.round(score / 5));
      },
      
      // Sentiment Analysis (بسيط - يعتمد على outcome)
      analyzeSentiment(interactions) {
        if (!interactions || interactions.length === 0) {
          return { score: 0, label: 'neutral', confidence: 0 };
        }
        const recent = interactions.filter(i => 
          Date.now() - i.timestamp < 60 * 24 * 60 * 60 * 1000 // آخر 60 يوم
        );
        if (recent.length === 0) return { score: 0, label: 'neutral', confidence: 0 };
        
        let pos = 0, neg = 0;
        recent.forEach(i => {
          if (i.outcome === 'positive' || (i.points || 0) > 0) pos++;
          if (i.outcome === 'negative' || (i.points || 0) < 0) neg++;
        });
        
        const score = (pos - neg) / recent.length;
        let label = 'neutral';
        if (score > 0.3) label = 'positive';
        else if (score < -0.3) label = 'negative';
        
        return {
          score: Math.round(score * 100) / 100,
          label,
          positive: pos,
          negative: neg,
          total: recent.length,
          confidence: Math.min(1, recent.length / 10)
        };
      },
      
      // Lead Score (احتمالية الشراء)
      calculateLeadScore(data) {
        let score = 0;
        
        // 1. بيانات العميل (25%)
        if (data.customer) {
          if (data.customer.phone) score += 10;
          if (data.customer.region) score += 8;
          if (data.customer.notes) score += 7;
        }
        
        // 2. السلوك التاريخي (30%)
        const txCount = data.transactions.length;
        if (txCount >= 10) score += 30;
        else if (txCount >= 5) score += 20;
        else if (txCount >= 1) score += 10;
        
        // 3. التفاعل الأخير (25%)
        const recentInteractions = data.interactions.filter(i => 
          Date.now() - i.timestamp < 30 * 24 * 60 * 60 * 1000
        );
        score += Math.min(25, recentInteractions.length * 5);
        
        // 4. Engagement (20%)
        score += Math.round(data.engagementScore * 0.2);
        
        return Math.min(100, Math.max(0, score));
      },
      
      // Next Best Action
      getNextBestActions(customerName, context) {
        const actions = [];
        const daysSinceLastTx = context.lastTransactionDate ? 
          Math.floor((Date.now() - new Date(context.lastTransactionDate).getTime()) / (1000 * 60 * 60 * 24)) : 999;
        
        // عميل VIP بدون شراء حديث
        if (context.leadScore >= 70 && daysSinceLastTx > 30) {
          actions.push({
            priority: 'urgent',
            action: 'تواصل شخصي',
            reason: 'عميل VIP بدون شراء منذ ' + daysSinceLastTx + ' يوم',
            channel: 'phone',
            script: 'مرحباً [الاسم]، وحشتنا طلباتك. لدينا عرض خاص لك...'
          });
        }
        
        // عميل سلبي
        if (context.sentiment.label === 'negative') {
          actions.push({
            priority: 'urgent',
            action: 'معالجة الشكوى',
            reason: 'sentiment سلبي في آخر 60 يوم',
            channel: 'visit',
            script: 'نود سماع ملاحظاتك لتحسين خدمتنا'
          });
        }
        
        // عميل خامل
        if (daysSinceLastTx > 90 && context.leadScore < 50) {
          actions.push({
            priority: 'medium',
            action: 'حملة إيقاظ',
            reason: 'عميل لم يشترِ منذ 3+ أشهر',
            channel: 'whatsapp',
            script: 'عرض 15% خصم لإعادة النشاط'
          });
        }
        
        // فرصة upsell
        if (daysSinceLastTx < 30 && context.leadScore >= 60) {
          actions.push({
            priority: 'low',
            action: 'اقتراح upsell',
            reason: 'عميل نشط وقابل للترقية',
            channel: 'visit',
            script: 'لدينا فئة منتجات جديدة مناسبة لك'
          });
        }
        
        // تفاعل منخفض
        if (context.engagementScore < 20) {
          actions.push({
            priority: 'medium',
            action: 'زيادة التفاعل',
            reason: 'مستوى التفاعل منخفض',
            channel: 'whatsapp',
            script: 'إرسال محتوى قيّم عن منتجاتنا'
          });
        }
        
        return actions;
      },
      
      // ============== الملاحظات ==============
      
      addNote(customerName, text, options = {}) {
        const notes = loadStore(STORAGE_KEYS.notes);
        const note = {
          id: generateId(),
          customerName,
          text,
          timestamp: Date.now(),
          author: options.author || 'system',
          pinned: options.pinned || false,
          tags: options.tags || []
        };
        notes.push(note);
        saveStore(STORAGE_KEYS.notes, notes);
        Logger.info('CRM note added', { customer: customerName });
        return { success: true, note };
      },
      
      getNotes(customerName) {
        const notes = loadStore(STORAGE_KEYS.notes)
          .filter(n => n.customerName === customerName)
          .sort((a, b) => b.timestamp - a.timestamp);
        return notes;
      },
      
      // ============== التاجات ==============
      
      addTag(customerName, tag, color = '#3b82f6') {
        const tags = loadStore(STORAGE_KEYS.tags);
        // تحقق من عدم التكرار
        if (tags.find(t => t.customerName === customerName && t.tag === tag)) {
          return { success: false, error: 'التاج موجود بالفعل' };
        }
        const tagObj = {
          id: generateId(),
          customerName,
          tag,
          color,
          timestamp: Date.now()
        };
        tags.push(tagObj);
        saveStore(STORAGE_KEYS.tags, tags);
        return { success: true, tag: tagObj };
      },
      
      removeTag(customerName, tag) {
        const tags = loadStore(STORAGE_KEYS.tags)
          .filter(t => !(t.customerName === customerName && t.tag === tag));
        saveStore(STORAGE_KEYS.tags, tags);
        return { success: true };
      },
      
      getTags(customerName) {
        return loadStore(STORAGE_KEYS.tags)
          .filter(t => t.customerName === customerName);
      },
      
      // ============== المهام ==============
      
      addTask(customerName, taskData) {
        const tasks = loadStore(STORAGE_KEYS.tasks);
        const task = {
          id: generateId(),
          customerName,
          title: taskData.title,
          description: taskData.description || '',
          type: taskData.type || 'follow_up',
          dueDate: taskData.dueDate || null,
          priority: taskData.priority || 'medium',
          status: 'pending',
          assignedTo: taskData.assignedTo || null,
          createdAt: Date.now(),
          createdBy: taskData.createdBy || 'system'
        };
        tasks.push(task);
        saveStore(STORAGE_KEYS.tasks, tasks);
        Logger.info('CRM task created', { customer: customerName, type: task.type });
        return { success: true, task };
      },
      
      getTasks(customerName, options = {}) {
        let tasks = loadStore(STORAGE_KEYS.tasks)
          .filter(t => t.customerName === customerName);
        if (options.status) {
          tasks = tasks.filter(t => t.status === options.status);
        }
        if (options.overdue) {
          const now = Date.now();
          tasks = tasks.filter(t => 
            t.status === 'pending' && t.dueDate && new Date(t.dueDate).getTime() < now
          );
        }
        return tasks.sort((a, b) => {
          // المهام المستحقة أولاً
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
          }
          return b.createdAt - a.createdAt;
        });
      },
      
      completeTask(taskId) {
        const tasks = loadStore(STORAGE_KEYS.tasks);
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx === -1) return { success: false, error: 'مهمة غير موجودة' };
        tasks[idx].status = 'completed';
        tasks[idx].completedAt = Date.now();
        saveStore(STORAGE_KEYS.tasks, tasks);
        return { success: true };
      },
      
      // ============== الإحصائيات ==============
      
      getStats() {
        const interactions = loadStore(STORAGE_KEYS.interactions);
        const notes = loadStore(STORAGE_KEYS.notes);
        const tags = loadStore(STORAGE_KEYS.tags);
        const tasks = loadStore(STORAGE_KEYS.tasks);
        
        const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const recent = interactions.filter(i => i.timestamp >= last30Days);
        
        // تفاعلات حسب النوع
        const byType = {};
        Object.keys(InteractionTypes).forEach(t => {
          byType[t] = interactions.filter(i => i.type === t).length;
        });
        
        return {
          totalInteractions: interactions.length,
          recentInteractions: recent.length,
          totalNotes: notes.length,
          totalTags: tags.length,
          totalTasks: tasks.length,
          pendingTasks: tasks.filter(t => t.status === 'pending').length,
          overdueTasks: tasks.filter(t => 
            t.status === 'pending' && t.dueDate && new Date(t.dueDate).getTime() < Date.now()
          ).length,
          interactionsByType: byType,
          averageEngagement: interactions.length > 0 ? 
            Math.round(interactions.reduce((s, i) => s + (i.points || 0), 0) / interactions.length) : 0
        };
      },
      
      // اختبارات ذاتية
      selfTest() {
        const tests = [];
        
        // تنظيف قبل الاختبار
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        
        // Test 1: log interaction
        const result = this.logInteraction('Test Customer', 'call', { outcome: 'positive', duration: 5 });
        tests.push({ name: 'تسجيل تفاعل', pass: result.success === true });
        
        // Test 2: get interactions
        const list = this.getInteractions('Test Customer');
        tests.push({ name: 'جلب التفاعلات', pass: list.length === 1 });
        
        // Test 3: add note
        const noteResult = this.addNote('Test Customer', 'ملاحظة اختبار', { pinned: true });
        tests.push({ name: 'إضافة ملاحظة', pass: noteResult.success === true });
        
        // Test 4: add tag
        const tagResult = this.addTag('Test Customer', 'VIP', '#10b981');
        tests.push({ name: 'إضافة تاج', pass: tagResult.success === true });
        
        // Test 5: duplicate tag prevention
        const dupResult = this.addTag('Test Customer', 'VIP');
        tests.push({ name: 'منع التكرار', pass: dupResult.success === false });
        
        // Test 6: add task
        const taskResult = this.addTask('Test Customer', { 
          title: 'متابعة', dueDate: new Date(Date.now() + 86400000).toISOString() 
        });
        tests.push({ name: 'إضافة مهمة', pass: taskResult.success === true });
        
        // Test 7: 360 view
        const view = this.getCustomer360('Test Customer');
        tests.push({ name: 'عرض 360°', pass: view && view.summary && view.summary.leadScore >= 0 });
        
        // Test 8: engagement score
        const score = this.calculateEngagementScore(list);
        tests.push({ name: 'Engagement Score', pass: score >= 0 });
        
        // Test 9: sentiment analysis
        const sentiment = this.analyzeSentiment(list);
        tests.push({ name: 'تحليل المشاعر', pass: sentiment && sentiment.label });
        
        // Test 10: next best actions
        const actions = this.getNextBestActions('Test Customer', {
          engagementScore: 50, leadScore: 60, sentiment: { label: 'neutral' },
          lastTransactionDate: null
        });
        tests.push({ name: 'الإجراء التالي المقترح', pass: Array.isArray(actions) });
        
        // Test 11: stats
        const stats = this.getStats();
        tests.push({ name: 'الإحصائيات', pass: stats.totalInteractions >= 1 });
        
        // Test 12: interaction types
        tests.push({ name: 'أنواع التفاعل معرّفة', pass: Object.keys(InteractionTypes).length >= 10 });
        
        // تنظيف
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        
        return tests;
      }
    };
    
    window.CRM = CRM;
    window.InteractionTypes = InteractionTypes;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('CRM ready [' + Object.keys(InteractionTypes).length + ' interaction types]');
    }
  })();
  