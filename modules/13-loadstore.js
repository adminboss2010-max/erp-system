
  /* ═══════════════════════════════════════════════════════════════════
     📣 v220.9+ MARKETING AUTOMATION ENGINE
     ═══════════════════════════════════════════════════════════════════
     محرك أتمتة تسويقية متعدد القنوات:
     - محفزات (Triggers): سلوكية، زمنية، يدوية
     - إجراءات (Actions): رسائل، عروض، مهام
     - شرائح (Segments): ديناميكية بناء على RFM
     - جدولة (Scheduling): يومي، أسبوعي، شهري
     - قياس الأداء (Analytics): فتح، نقر، تحويل
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const STORAGE_KEYS = {
      campaigns: 'nayef_marketing_campaigns',
      workflows: 'nayef_marketing_workflows',
      executions: 'nayef_marketing_executions',
      templates: 'nayef_marketing_templates'
    };
    
    function loadStore(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        Logger.error('Marketing load failed', e, { key });
        return [];
      }
    }
    
    function saveStore(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e) {
        Logger.error('Marketing save failed', e, { key });
        return false;
      }
    }
    
    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
    
    // ============== أنواع المحفزات ==============
    
    const TriggerTypes = {
      // زمنية
      'time.after_purchase': {
        name: 'بعد الشراء بـ X يوم',
        category: 'time',
        params: ['days']
      },
      'time.no_purchase': {
        name: 'بدون شراء منذ X يوم',
        category: 'time',
        params: ['days']
      },
      'time.birthday': {
        name: 'عيد الميلاد',
        category: 'time',
        params: []
      },
      'time.anniversary': {
        name: 'ذكرى السنوية',
        category: 'time',
        params: []
      },
      'time.day_of_week': {
        name: 'يوم محدد من الأسبوع',
        category: 'time',
        params: ['day']
      },
      
      // سلوكية
      'behavior.high_value': {
        name: 'عميل عالي القيمة (CLV > X)',
        category: 'behavior',
        params: ['minCLV']
      },
      'behavior.churn_risk': {
        name: 'خطر الانسحاب',
        category: 'behavior',
        params: ['riskLevel']
      },
      'behavior.first_order': {
        name: 'أول طلب',
        category: 'behavior',
        params: []
      },
      'behavior.repeat_order': {
        name: 'طلب متكرر',
        category: 'behavior',
        params: ['count']
      },
      'behavior.large_order': {
        name: 'طلب كبير ( > X د.ك)',
        category: 'behavior',
        params: ['minAmount']
      },
      'behavior.browsed_product': {
        name: 'شاهد منتجاً معيناً',
        category: 'behavior',
        params: ['product']
      },
      'behavior.abandoned_cart': {
        name: 'سلة متروكة',
        category: 'behavior',
        params: ['hours']
      },
      
      // شرائح RFM
      'segment.champions': {
        name: 'شريحة Champions',
        category: 'segment',
        params: []
      },
      'segment.at_risk': {
        name: 'شريحة At Risk',
        category: 'segment',
        params: []
      },
      'segment.hibernating': {
        name: 'شريحة Hibernating',
        category: 'segment',
        params: []
      },
      'segment.new_customer': {
        name: 'عملاء جدد (أقل من 30 يوم)',
        category: 'segment',
        params: []
      },
      
      // يدوية
      'manual.trigger': {
        name: 'إطلاق يدوي',
        category: 'manual',
        params: []
      }
    };
    
    // ============== أنواع الإجراءات ==============
    
    const ActionTypes = {
      'send.whatsapp': {
        name: 'إرسال رسالة واتساب',
        channel: 'whatsapp',
        params: ['templateId', 'variables']
      },
      'send.sms': {
        name: 'إرسال SMS',
        channel: 'sms',
        params: ['templateId', 'variables']
      },
      'send.email': {
        name: 'إرسال بريد إلكتروني',
        channel: 'email',
        params: ['templateId', 'variables', 'subject']
      },
      'send.push': {
        name: 'إشعار Push',
        channel: 'push',
        params: ['title', 'body']
      },
      'create.task': {
        name: 'إنشاء مهمة CRM',
        channel: 'crm',
        params: ['title', 'dueDate', 'assignedTo']
      },
      'create.discount': {
        name: 'إنشاء كود خصم',
        channel: 'discount',
        params: ['code', 'percentage', 'expiresIn']
      },
      'add.tag': {
        name: 'إضافة تاج',
        channel: 'tag',
        params: ['tag']
      },
      'wait.days': {
        name: 'انتظار X يوم',
        channel: 'wait',
        params: ['days']
      },
      'webhook': {
        name: 'إرسال Webhook',
        channel: 'webhook',
        params: ['url', 'payload']
      }
    };
    
    // ============== قوالب الرسائل الجاهزة ==============
    
    const DefaultTemplates = {
      welcome: {
        id: 'welcome',
        name: 'ترحيب بعميل جديد',
        channel: 'whatsapp',
        body: 'أهلاً [اسم العميل]! 🌟\nشكراً لاختيارك نظام إدارة مالية.\nاحصل على خصم 10% على طلبك الأول بكود [كود الخصم].\nللتواصل: [رقم الهاتف]',
        variables: ['اسم العميل', 'كود الخصم', 'رقم الهاتف']
      },
      birthday: {
        id: 'birthday',
        name: 'تهنئة عيد الميلاد',
        channel: 'whatsapp',
        body: 'كل عام وأنت بخير يا [اسم العميل]! 🎂\nبمناسبة عيد ميلادك، نقدم لك خصم 15% على طلبك القادم.\nالكود: [كود الخصم]\nصالح لمدة 7 أيام.',
        variables: ['اسم العميل', 'كود الخصم']
      },
      abandoned_cart: {
        id: 'abandoned_cart',
        name: 'استرداد السلة المتروكة',
        channel: 'sms',
        body: '[اسم العميل]، لاحظنا أنك لم تكمل طلبك من [المنتجات].\nإليك خصم 10% لإتمام الطلب: [كود الخصم]',
        variables: ['اسم العميل', 'المنتجات', 'كود الخصم']
      },
      reactivation: {
        id: 'reactivation',
        name: 'إعادة تنشيط',
        channel: 'whatsapp',
        body: 'وحشتنا طلباتك يا [اسم العميل]! 😊\nنحن في نظام إدارة مالية نقدم لك عرض خاص:\nخصم 15% على طلبك القادم.\nالكود: [كود الخصم]',
        variables: ['اسم العميل', 'كود الخصم']
      },
      thank_you: {
        id: 'thank_you',
        name: 'شكر بعد الشراء',
        channel: 'sms',
        body: 'شكراً لطلبك يا [اسم العميل]! 🙏\nطلبك رقم [رقم الطلب] قيد التجهيز.\nللتواصل: [رقم الهاتف]',
        variables: ['اسم العميل', 'رقم الطلب', 'رقم الهاتف']
      },
      win_back: {
        id: 'win_back',
        name: 'استرداد عميل خامل',
        channel: 'email',
        subject: 'وحشتنا طلباتك يا [اسم العميل]',
        body: 'مرحباً [اسم العميل],\nلاحظنا أنك لم تطلب منا منذ فترة. لدينا منتجات جديدة قد تعجبك!\nاحصل على خصم 20% بإستخدام كود [كود الخصم].',
        variables: ['اسم العميل', 'كود الخصم']
      },
      vip_special: {
        id: 'vip_special',
        name: 'عرض VIP حصري',
        channel: 'whatsapp',
        body: 'عميلنا المميز [اسم العميل]! 💎\nلأنك من عملاء VIP، نقدم لك خصم 25% حصرياً.\nالكود: [كود الخصم] - صالح لمدة 48 ساعة فقط.',
        variables: ['اسم العميل', 'كود الخصم']
      },
      payment_reminder: {
        id: 'payment_reminder',
        name: 'تذكير بالدفع',
        channel: 'sms',
        body: '[اسم العميل]، تذكير ودي بمبلغ [المبلغ] د.ك المستحق.\nللتسديد أو الاستفسار: [رقم الهاتف]',
        variables: ['اسم العميل', 'المبلغ', 'رقم الهاتف']
      }
    };
    
    function loadTemplates() {
      const stored = loadStore(STORAGE_KEYS.templates);
      if (stored.length === 0) {
        const defaults = Object.values(DefaultTemplates);
        saveStore(STORAGE_KEYS.templates, defaults);
        return defaults;
      }
      return stored;
    }
    
    function fillTemplate(templateId, variables) {
      const templates = loadTemplates();
      const template = templates.find(t => t.id === templateId);
      if (!template) return null;
      
      let body = template.body;
      Object.entries(variables || {}).forEach(([key, value]) => {
        const regex = new RegExp('\\[' + key + '\\]', 'g');
        body = body.replace(regex, value);
      });
      
      return {
        channel: template.channel,
        subject: template.subject,
        body
      };
    }
    
    // ============== محرك الأتمتة ==============
    
    async function executeAction(action, customer, context = {}) {
      try {
        const executions = loadStore(STORAGE_KEYS.executions);
        const execution = {
          id: generateId(),
          customerName: customer.name,
          actionType: action.type,
          channel: ActionTypes[action.type]?.channel,
          status: 'pending',
          timestamp: Date.now(),
          result: null
        };
        
        // تنفيذ الإجراء حسب النوع
        if (action.type.startsWith('send.')) {
          // إرسال رسالة
          const filled = fillTemplate(action.templateId, action.variables || {});
          if (filled) {
            execution.result = await sendMessage(filled.channel, customer, filled);
            execution.status = execution.result.success ? 'sent' : 'failed';
          } else {
            execution.status = 'failed';
            execution.result = { error: 'قالب غير موجود' };
          }
        } else if (action.type === 'create.task') {
          // إنشاء مهمة CRM
          if (typeof CRM !== 'undefined') {
            const result = CRM.addTask(customer.name, {
              title: action.title,
              dueDate: action.dueDate,
              assignedTo: action.assignedTo,
              type: 'follow_up'
            });
            execution.result = result;
            execution.status = result.success ? 'created' : 'failed';
          }
        } else if (action.type === 'create.discount') {
          // إنشاء كود خصم
          const code = action.code || ('DISC' + Date.now().toString(36).toUpperCase());
          execution.result = {
            success: true,
            code,
            percentage: action.percentage,
            customerName: customer.name,
            expiresIn: action.expiresIn || 30
          };
          execution.status = 'created';
        } else if (action.type === 'add.tag') {
          if (typeof CRM !== 'undefined') {
            const result = CRM.addTag(customer.name, action.tag);
            execution.result = result;
            execution.status = result.success ? 'tagged' : 'failed';
          }
        } else if (action.type === 'wait.days') {
          execution.status = 'waiting';
          execution.waitUntil = Date.now() + (action.days || 1) * 24 * 60 * 60 * 1000;
        }
        
        executions.push(execution);
        saveStore(STORAGE_KEYS.executions, executions);
        return execution;
      } catch (e) {
        Logger.error('Action execution failed', e, { action, customer: customer.name });
        return { status: 'failed', error: e.message };
      }
    }
    
    async function sendMessage(channel, customer, content) {
      // في الإنتاج: تكامل مع Twilio / WhatsApp Business / SendGrid
      // هنا: محاكاة + رابط wa.me للواتساب
      try {
        if (channel === 'whatsapp') {
          const phone = (customer.phone || '').replace(/[^\d+]/g, '');
          const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(content.body);
          return {
            success: true,
            channel: 'whatsapp',
            url,
            message: 'فتح واتساب للعميل ' + customer.name
          };
        } else if (channel === 'sms') {
          // في الإنتاج: إرسال عبر Twilio
          return {
            success: true,
            channel: 'sms',
            phone: customer.phone,
            message: content.body,
            simulated: true
          };
        } else if (channel === 'email') {
          return {
            success: true,
            channel: 'email',
            email: customer.email,
            subject: content.subject,
            message: content.body,
            simulated: true
          };
        }
        return { success: false, error: 'قناة غير مدعومة' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    
    // ============== Workflow Engine ==============
    
    async function executeWorkflow(workflowId, customer, triggerContext = {}) {
      const workflows = loadStore(STORAGE_KEYS.workflows);
      const workflow = workflows.find(w => w.id === workflowId);
      if (!workflow) return { success: false, error: 'Workflow غير موجود' };
      
      if (!workflow.enabled) {
        return { success: false, error: 'Workflow معطل' };
      }
      
      Logger.info('Workflow execution started', { workflowId, customer: customer.name });
      
      const results = [];
      for (const action of workflow.actions) {
        const result = await executeAction(action, customer, triggerContext);
        results.push(result);
        
        // إذا كان wait، لا تكمل (يحتاج scheduling)
        if (result.status === 'waiting') {
          Logger.info('Workflow waiting', { until: result.waitUntil });
          break;
        }
      }
      
      return { success: true, workflowId, results };
    }
    
    // ============== التحقق من المحفزات ==============
    
    function evaluateTrigger(trigger, customer) {
      try {
        const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
        const customerData = (O.soc || []).find(c => (c.nm || c.name) === customer.name);
        const transactions = (O.tx || []).filter(t => 
          (t.client || t.cl) === customer.name
        );
        const sales = transactions.filter(t => (t.tp || t.type) === 'sale');
        
        switch (trigger.type) {
          case 'time.after_purchase': {
            const lastSale = sales.sort((a, b) => 
              new Date(b.dt || b.date) - new Date(a.dt || a.date)
            )[0];
            if (!lastSale) return false;
            const daysSince = (Date.now() - new Date(lastSale.dt || lastSale.date)) / (1000 * 60 * 60 * 24);
            return daysSince >= (trigger.params?.days || 7);
          }
          
          case 'time.no_purchase': {
            if (sales.length === 0) return false;
            const lastSale = sales.sort((a, b) => 
              new Date(b.dt || b.date) - new Date(a.dt || a.date)
            )[0];
            const daysSince = (Date.now() - new Date(lastSale.dt || lastSale.date)) / (1000 * 60 * 60 * 24);
            return daysSince >= (trigger.params?.days || 60);
          }
          
          case 'behavior.high_value': {
            const totalSpent = sales.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
            return totalSpent >= (trigger.params?.minCLV || 5000);
          }
          
          case 'behavior.churn_risk': {
            if (typeof RFMSegmentation !== 'undefined') {
              const result = RFMSegmentation.analyzeCustomer(customer.name);
              if (result.success && result.customer) {
                const risk = result.customer.riskScore || 0;
                return risk >= (trigger.params?.riskLevel || 60);
              }
            }
            return false;
          }
          
          case 'behavior.first_order': {
            return sales.length === 1;
          }
          
          case 'behavior.repeat_order': {
            return sales.length >= (trigger.params?.count || 3);
          }
          
          case 'behavior.large_order': {
            const maxOrder = Math.max(...sales.map(t => parseFloat(t.amount) || 0), 0);
            return maxOrder >= (trigger.params?.minAmount || 1000);
          }
          
          case 'segment.champions':
          case 'segment.at_risk':
          case 'segment.hibernating':
          case 'segment.new_customer': {
            if (typeof RFMSegmentation === 'undefined') return false;
            const rfm = RFMSegmentation.analyzeCustomer(customer.name);
            if (!rfm.success || !rfm.customer) return false;
            const segment = rfm.customer.segment;
            const target = trigger.type.split('.')[1];
            if (target === 'new_customer') {
              // عميل جديد: أقل من 30 يوم من أول معاملة
              if (sales.length === 0) return false;
              const firstSale = sales.sort((a, b) => 
                new Date(a.dt || a.date) - new Date(b.dt || b.date)
              )[0];
              const daysSince = (Date.now() - new Date(firstSale.dt || firstSale.date)) / (1000 * 60 * 60 * 24);
              return daysSince <= 30;
            }
            return segment === target;
          }
          
          case 'manual.trigger':
            return true;
          
          default:
            return false;
        }
      } catch (e) {
        Logger.error('Trigger evaluation failed', e);
        return false;
      }
    }
    
    // ============== Marketing Automation API ==============
    
    const MarketingAutomation = {
      version: 'v220.9.0',
      TriggerTypes,
      ActionTypes,
      
      // ========== Campaigns ==========
      
      createCampaign(campaignData) {
        const campaigns = loadStore(STORAGE_KEYS.campaigns);
        const campaign = {
          id: generateId(),
          name: campaignData.name,
          description: campaignData.description || '',
          type: campaignData.type || 'broadcast', // broadcast, drip, trigger_based
          channel: campaignData.channel || 'whatsapp',
          templateId: campaignData.templateId,
          targetSegment: campaignData.targetSegment || 'all',
          status: 'draft', // draft, scheduled, running, completed, paused
          createdAt: Date.now(),
          createdBy: campaignData.createdBy || 'system',
          scheduledFor: campaignData.scheduledFor || null,
          stats: {
            sent: 0,
            opened: 0,
            clicked: 0,
            converted: 0
          }
        };
        campaigns.push(campaign);
        saveStore(STORAGE_KEYS.campaigns, campaigns);
        return { success: true, campaign };
      },
      
      getCampaigns() {
        return loadStore(STORAGE_KEYS.campaigns);
      },
      
      // ========== Workflows ==========
      
      createWorkflow(workflowData) {
        const workflows = loadStore(STORAGE_KEYS.workflows);
        const workflow = {
          id: generateId(),
          name: workflowData.name,
          description: workflowData.description || '',
          trigger: workflowData.trigger,
          actions: workflowData.actions || [],
          enabled: workflowData.enabled !== false,
          createdAt: Date.now(),
          stats: {
            triggered: 0,
            completed: 0,
            failed: 0
          }
        };
        workflows.push(workflow);
        saveStore(STORAGE_KEYS.workflows, workflows);
        return { success: true, workflow };
      },
      
      getWorkflows() {
        return loadStore(STORAGE_KEYS.workflows);
      },
      
      // ========== تشغيل حملة على شريحة ==========
      
      async runCampaign(campaignId, options = {}) {
        const campaigns = loadStore(STORAGE_KEYS.campaigns);
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return { success: false, error: 'حملة غير موجودة' };
        
        const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
        const customers = O.soc || [];
        
        // فلترة العملاء حسب الشريحة
        let targetCustomers = customers;
        if (campaign.targetSegment && campaign.targetSegment !== 'all') {
          targetCustomers = customers.filter(c => {
            const result = evaluateTrigger(
              { type: 'segment.' + campaign.targetSegment },
              { name: c.nm || c.name }
            );
            return result;
          });
        }
        
        // قصر العدد لو تم تحديده
        if (options.limit) {
          targetCustomers = targetCustomers.slice(0, options.limit);
        }
        
        Logger.info('Campaign started', { 
          campaignId, 
          targetCount: targetCustomers.length 
        });
        
        // تنفيذ الحملة
        const results = [];
        for (const customer of targetCustomers) {
          const filled = fillTemplate(campaign.templateId, {
            'اسم العميل': customer.nm || customer.name,
            'رقم الهاتف': customer.phone || ''
          });
          if (filled) {
            const result = await sendMessage(campaign.channel, customer, filled);
            results.push({
              customerName: customer.nm || customer.name,
              ...result
            });
          }
        }
        
        // تحديث إحصائيات الحملة
        const idx = campaigns.findIndex(c => c.id === campaignId);
        if (idx >= 0) {
          campaigns[idx].status = 'completed';
          campaigns[idx].stats.sent += results.length;
          campaigns[idx].completedAt = Date.now();
          saveStore(STORAGE_KEYS.campaigns, campaigns);
        }
        
        return {
          success: true,
          campaignId,
          targetCount: targetCustomers.length,
          sentCount: results.filter(r => r.success).length,
          failedCount: results.filter(r => !r.success).length,
          results
        };
      },
      
      // ========== معالجة المحفزات (scheduled) ==========
      
      async processTriggers() {
        const workflows = loadStore(STORAGE_KEYS.workflows).filter(w => w.enabled);
        const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
        const customers = O.soc || [];
        
        const executions = [];
        for (const workflow of workflows) {
          for (const customer of customers) {
            try {
              const shouldTrigger = evaluateTrigger(workflow.trigger, { name: customer.nm || customer.name });
              if (shouldTrigger) {
                const result = await executeWorkflow(workflow.id, { name: customer.nm || customer.name });
                executions.push({ workflowId: workflow.id, customer: customer.nm, result });
                workflow.stats.triggered++;
              }
            } catch (e) {
              Logger.error('Trigger processing failed', e, { workflowId: workflow.id });
            }
          }
        }
        
        // تحديث الإحصائيات
        const allWorkflows = loadStore(STORAGE_KEYS.workflows);
        workflows.forEach(w => {
          const idx = allWorkflows.findIndex(x => x.id === w.id);
          if (idx >= 0) {
            allWorkflows[idx].stats = w.stats;
          }
        });
        saveStore(STORAGE_KEYS.workflows, allWorkflows);
        
        return {
          success: true,
          workflowsProcessed: workflows.length,
          executions: executions.length,
          details: executions
        };
      },
      
      // ========== Templates ==========
      
      getTemplates() {
        return loadTemplates();
      },
      
      fillTemplate,
      
      // ========== Analytics ==========
      
      getAnalytics() {
        const campaigns = loadStore(STORAGE_KEYS.campaigns);
        const executions = loadStore(STORAGE_KEYS.executions);
        const workflows = loadStore(STORAGE_KEYS.workflows);
        
        const byChannel = {};
        executions.forEach(e => {
          const ch = e.channel || 'unknown';
          byChannel[ch] = byChannel[ch] || { sent: 0, failed: 0 };
          if (e.status === 'sent' || e.status === 'created') byChannel[ch].sent++;
          if (e.status === 'failed') byChannel[ch].failed++;
        });
        
        return {
          totalCampaigns: campaigns.length,
          activeCampaigns: campaigns.filter(c => c.status === 'running').length,
          completedCampaigns: campaigns.filter(c => c.status === 'completed').length,
          totalWorkflows: workflows.length,
          activeWorkflows: workflows.filter(w => w.enabled).length,
          totalExecutions: executions.length,
          successfulExecutions: executions.filter(e => 
            e.status === 'sent' || e.status === 'created' || e.status === 'tagged'
          ).length,
          failedExecutions: executions.filter(e => e.status === 'failed').length,
          executionsByChannel: byChannel,
          totalReach: campaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0)
        };
      },
      
      // ========== Self Test ==========
      
      selfTest() {
        const tests = [];
        
        // تنظيف قبل الاختبار
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        
        // Test 1: create campaign
        const campResult = this.createCampaign({
          name: 'حملة اختبار',
          channel: 'whatsapp',
          templateId: 'welcome'
        });
        tests.push({ name: 'إنشاء حملة', pass: campResult.success === true });
        
        // Test 2: get campaigns
        const camps = this.getCampaigns();
        tests.push({ name: 'جلب الحملات', pass: camps.length === 1 });
        
        // Test 3: create workflow
        const wfResult = this.createWorkflow({
          name: 'سير عمل اختبار',
          trigger: { type: 'manual.trigger' },
          actions: [{ type: 'send.whatsapp', templateId: 'welcome' }]
        });
        tests.push({ name: 'إنشاء workflow', pass: wfResult.success === true });
        
        // Test 4: get templates
        const templates = this.getTemplates();
        tests.push({ name: 'جلب القوالب', pass: templates.length >= 7 });
        
        // Test 5: fill template
        const filled = fillTemplate('welcome', {
          'اسم العميل': 'أحمد',
          'كود الخصم': 'WELCOME10'
        });
        tests.push({ name: 'ملء القالب', pass: filled && filled.body.includes('أحمد') });
        
        // Test 6: trigger types defined
        tests.push({ name: 'أنواع المحفزات', pass: Object.keys(TriggerTypes).length >= 15 });
        
        // Test 7: action types defined
        tests.push({ name: 'أنواع الإجراءات', pass: Object.keys(ActionTypes).length >= 7 });
        
        // Test 8: evaluate manual trigger
        const triggerResult = evaluateTrigger({ type: 'manual.trigger' }, { name: 'test' });
        tests.push({ name: 'تقييم محفز يدوي', pass: triggerResult === true });
        
        // Test 9: analytics
        const analytics = this.getAnalytics();
        tests.push({ name: 'الإحصائيات', pass: analytics.totalCampaigns === 1 });
        
        // تنظيف
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        
        return tests;
      }
    };
    
    window.MarketingAutomation = MarketingAutomation;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('MarketingAutomation ready [' + 
        Object.keys(TriggerTypes).length + ' triggers, ' +
        Object.keys(ActionTypes).length + ' actions, ' +
        Object.keys(DefaultTemplates).length + ' templates]'
      );
    }
  })();
  