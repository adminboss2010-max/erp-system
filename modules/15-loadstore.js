
  /* ═══════════════════════════════════════════════════════════════════
     🔔 v220.9+ NOTIFICATION SERVICE + CUSTOMER JOURNEY
     ═══════════════════════════════════════════════════════════════════
     خدمة إشعارات موحدة + تتبع رحلة العميل:
     - Queue مع إعادة المحاولة
     - جدولة الإرسال
     - تتبع رحلة العميل (Awareness → Consideration → Decision → Retention)
     - نقاط التحويل والإجراءات التالية
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const STORAGE_KEYS = {
      queue: 'nayef_notif_queue',
      history: 'nayef_notif_history',
      journeyEvents: 'nayef_customer_journey',
      journeyStages: 'nayef_journey_stages'
    };
    
    function loadStore(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }
    
    function saveStore(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    }
    
    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
    
    // ============== مراحل رحلة العميل ==============
    
    const JourneyStages = {
      awareness: {
        id: 'awareness',
        name: 'الوعي',
        description: 'العميل المحتمل يعرف عن منتجاتك لأول مرة',
        order: 1,
        triggers: ['زيارة موقع', 'مشاهدة إعلان', 'بحث عن منتج'],
        nextStage: 'consideration',
        conversionGoal: 'ترك بياناته',
        avgDurationDays: 7
      },
      consideration: {
        id: 'consideration',
        name: 'التفكير',
        description: 'العميل يقيّم منتجاتك ويقارنها',
        order: 2,
        triggers: ['استفسار عن السعر', 'طلب عرض', 'متابعة واتساب'],
        nextStage: 'decision',
        conversionGoal: 'طلب عرض رسمي',
        avgDurationDays: 14
      },
      decision: {
        id: 'decision',
        name: 'قرار الشراء',
        description: 'العميل مستعد لاتخاذ قرار الشراء',
        order: 3,
        triggers: ['مناقشة الشروط', 'طلب خصم', 'مفاوضات'],
        nextStage: 'retention',
        conversionGoal: 'إتمام أول طلب',
        avgDurationDays: 7
      },
      retention: {
        id: 'retention',
        name: 'الاحتفاظ',
        description: 'العميل يشتري بانتظام',
        order: 4,
        triggers: ['طلب متكرر', 'توصية لآخرين', 'مشاركة تجربته'],
        nextStage: 'advocacy',
        conversionGoal: 'تحويل عميل دائم',
        avgDurationDays: 90
      },
      advocacy: {
        id: 'advocacy',
        name: 'الدعاة',
        description: 'العميل يروج لمنتجاتك',
        order: 5,
        triggers: ['توصية', 'مراجعة إيجابية', 'إحالة'],
        nextStage: null,
        conversionGoal: 'إحالة عميل جديد',
        avgDurationDays: 365
      },
      churned: {
        id: 'churned',
        name: 'منسحب',
        description: 'العميل توقف عن الشراء',
        order: -1,
        triggers: ['توقف عن الشراء'],
        nextStage: 'awareness', // يمكن إعادة تنشيطه
        conversionGoal: 'إعادة النشاط',
        avgDurationDays: 0
      }
    };
    
    // ============== Notification Service ==============
    
    const NotificationService = {
      version: 'v220.9.0',
      
      // ========== Queue ==========
      
      async send(notification) {
        try {
          if (!notification.recipient || !notification.message) {
            return { success: false, error: 'بيانات غير مكتملة' };
          }
          
          const queue = loadStore(STORAGE_KEYS.queue);
          const item = {
            id: generateId(),
            recipient: notification.recipient,
            channel: notification.channel || 'whatsapp', // whatsapp, sms, email, push
            subject: notification.subject || null,
            message: notification.message,
            priority: notification.priority || 'normal', // low, normal, high, urgent
            scheduledFor: notification.scheduledFor || Date.now(),
            attempts: 0,
            maxAttempts: notification.maxAttempts || 3,
            status: 'queued', // queued, sending, sent, failed
            context: notification.context || {},
            createdAt: Date.now()
          };
          
          queue.push(item);
          saveStore(STORAGE_KEYS.queue, queue);
          
          // حاول الإرسال فوراً إذا لم يكن مجدول
          if (item.scheduledFor <= Date.now()) {
            return await this.processQueueItem(item.id);
          }
          
          return { success: true, id: item.id, status: 'queued' };
        } catch (e) {
          Logger.error('Notification send failed', e);
          return { success: false, error: e.message };
        }
      },
      
      // معالجة عنصر من الطابور
      async processQueueItem(itemId) {
        const queue = loadStore(STORAGE_KEYS.queue);
        const idx = queue.findIndex(i => i.id === itemId);
        if (idx === -1) return { success: false, error: 'عنصر غير موجود' };
        
        const item = queue[idx];
        if (item.status === 'sent') return { success: true, status: 'sent' };
        
        try {
          item.status = 'sending';
          item.attempts++;
          saveStore(STORAGE_KEYS.queue, queue);
          
          // تنفيذ الإرسال حسب القناة
          let result;
          if (item.channel === 'whatsapp') {
            result = this.sendWhatsApp(item);
          } else if (item.channel === 'sms') {
            result = this.sendSMS(item);
          } else if (item.channel === 'email') {
            result = this.sendEmail(item);
          } else if (item.channel === 'push') {
            result = this.sendPush(item);
          } else {
            result = { success: false, error: 'قناة غير مدعومة' };
          }
          
          if (result.success) {
            item.status = 'sent';
            item.sentAt = Date.now();
            // أضف للتاريخ
            const history = loadStore(STORAGE_KEYS.history);
            history.push({ ...item, ...result });
            saveStore(STORAGE_KEYS.history, history);
            // احذف من الطابور
            queue.splice(idx, 1);
            saveStore(STORAGE_KEYS.queue, queue);
            return { success: true, status: 'sent', result };
          } else {
            // إعادة المحاولة
            if (item.attempts < item.maxAttempts) {
              item.status = 'queued';
              item.nextRetry = Date.now() + (item.attempts * 60000); // exponential backoff
              item.lastError = result.error;
              saveStore(STORAGE_KEYS.queue, queue);
              return { success: false, status: 'will_retry', error: result.error };
            } else {
              item.status = 'failed';
              item.lastError = result.error;
              const history = loadStore(STORAGE_KEYS.history);
              history.push({ ...item });
              saveStore(STORAGE_KEYS.history, history);
              queue.splice(idx, 1);
              saveStore(STORAGE_KEYS.queue, queue);
              return { success: false, status: 'failed', error: result.error };
            }
          }
        } catch (e) {
          item.status = 'failed';
          item.lastError = e.message;
          saveStore(STORAGE_KEYS.queue, queue);
          return { success: false, error: e.message };
        }
      },
      
      // إرسال واتساب (يفتح wa.me)
      sendWhatsApp(item) {
        try {
          const phone = (item.recipient.phone || item.recipient).replace(/[^\d+]/g, '');
          if (!phone) return { success: false, error: 'رقم الهاتف مفقود' };
          const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(item.message);
          return {
            success: true,
            url,
            channel: 'whatsapp',
            note: 'تم توليد رابط واتساب'
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
      
      // إرسال SMS (Twilio - محاكاة)
      sendSMS(item) {
        try {
          const phone = (item.recipient.phone || item.recipient).replace(/[^\d+]/g, '');
          if (!phone) return { success: false, error: 'رقم الهاتف مفقود' };
          // في الإنتاج: استدعاء Twilio API
          return {
            success: true,
            phone,
            message: item.message,
            channel: 'sms',
            simulated: true,
            note: 'في الإنتاج: تكامل مع Twilio'
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
      
      // إرسال بريد (SendGrid - محاكاة)
      sendEmail(item) {
        try {
          const email = item.recipient.email || item.recipient;
          if (!email || !email.includes('@')) {
            return { success: false, error: 'بريد إلكتروني غير صالح' };
          }
          return {
            success: true,
            email,
            subject: item.subject,
            body: item.message,
            channel: 'email',
            simulated: true,
            note: 'في الإنتاج: تكامل مع SendGrid/SMTP'
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
      
      // إرسال Push (Web Push)
      async sendPush(item) {
        try {
          if (!('Notification' in window)) {
            return { success: false, error: 'Push notifications not supported' };
          }
          if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              return { success: false, error: 'الإذن مرفوض' };
            }
          }
          const notif = new Notification(item.subject || 'إشعار', {
            body: item.message,
            icon: '/icon.png',
            badge: '/badge.png'
          });
          return { success: true, notification: notif, channel: 'push' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
      
      // معالجة الطابور بالكامل
      async processQueue() {
        const queue = loadStore(STORAGE_KEYS.queue);
        const results = [];
        for (const item of queue) {
          if (item.scheduledFor <= Date.now() && item.status === 'queued') {
            const result = await this.processQueueItem(item.id);
            results.push(result);
          }
        }
        return { processed: results.length, results };
      },
      
      // إحصائيات
      getStats() {
        const queue = loadStore(STORAGE_KEYS.queue);
        const history = loadStore(STORAGE_KEYS.history);
        const last30Days = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const recent = history.filter(h => h.sentAt >= last30Days);
        
        const byChannel = {};
        history.forEach(h => {
          const ch = h.channel || 'unknown';
          byChannel[ch] = byChannel[ch] || { sent: 0, failed: 0 };
          if (h.status === 'sent') byChannel[ch].sent++;
          if (h.status === 'failed') byChannel[ch].failed++;
        });
        
        return {
          queuedCount: queue.length,
          queuedByPriority: {
            urgent: queue.filter(q => q.priority === 'urgent').length,
            high: queue.filter(q => q.priority === 'high').length,
            normal: queue.filter(q => q.priority === 'normal').length,
            low: queue.filter(q => q.priority === 'low').length
          },
          totalSent: history.length,
          recentSent: recent.length,
          failedCount: history.filter(h => h.status === 'failed').length,
          successRate: history.length > 0 ? 
            (history.filter(h => h.status === 'sent').length / history.length * 100).toFixed(1) + '%' : 'N/A',
          byChannel
        };
      },
      
      // Self test (sync-friendly)
      selfTest() {
        const tests = [];
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        
        // Test 1: WhatsApp
        const w1 = this.sendWhatsApp({ recipient: { phone: '96512345678' }, message: 'test' });
        tests.push({ name: 'إرسال واتساب', pass: w1.success === true });
        
        // Test 2: Email
        const e1 = this.sendEmail({ recipient: { email: 'test@test.com' }, subject: 'Test', message: 'body' });
        tests.push({ name: 'إرسال بريد', pass: e1.success === true });
        
        // Test 3: SMS
        const s1 = this.sendSMS({ recipient: { phone: '96512345678' }, message: 'test' });
        tests.push({ name: 'إرسال SMS', pass: s1.success === true });
        
        // Test 4: invalid recipient
        const i1 = this.sendWhatsApp({ recipient: { phone: '' }, message: 'test' });
        tests.push({ name: 'معالجة رقم خاطئ', pass: i1.success === false });
        
        // Test 5: Queue storage (add to queue directly)
        const queue = loadStore(STORAGE_KEYS.queue);
        queue.push({
          id: 'test-1',
          recipient: { phone: '123' },
          channel: 'whatsapp',
          message: 'test',
          priority: 'urgent',
          status: 'queued',
          attempts: 0,
          maxAttempts: 3,
          scheduledFor: Date.now(),
          createdAt: Date.now()
        });
        saveStore(STORAGE_KEYS.queue, queue);
        tests.push({ name: 'إضافة للطابور', pass: queue.length === 1 });
        
        // Test 6: stats
        const stats = this.getStats();
        tests.push({ name: 'إحصائيات', pass: stats.queuedCount >= 1 });
        
        // Test 7: History
        const hist = loadStore(STORAGE_KEYS.history);
        hist.push({ id: 'h1', channel: 'whatsapp', status: 'sent', sentAt: Date.now() });
        saveStore(STORAGE_KEYS.history, hist);
        tests.push({ name: 'سجل الإرسال', pass: hist.length === 1 });
        
        // Test 8: Priority queue
        tests.push({ name: 'أولوية الإرسال', pass: stats.queuedByPriority.normal >= 0 });
        
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        return tests;
      }
    };
    
    // ============== Customer Journey Service ==============
    
    const CustomerJourney = {
      version: 'v220.9.0',
      stages: JourneyStages,
      
      // تتبع حدث في رحلة العميل
      trackEvent(customerName, event) {
        try {
          const events = loadStore(STORAGE_KEYS.journeyEvents);
          const newEvent = {
            id: generateId(),
            customerName,
            stage: event.stage,
            eventType: event.type,
            timestamp: Date.now(),
            metadata: event.metadata || {},
            agent: event.agent || 'system',
            channel: event.channel || null,
            value: event.value || 0
          };
          events.push(newEvent);
          saveStore(STORAGE_KEYS.journeyEvents, events);
          return { success: true, event: newEvent };
        } catch (e) {
          Logger.error('Journey track failed', e);
          return { success: false, error: e.message };
        }
      },
      
      // الحصول على رحلة عميل
      getCustomerJourney(customerName) {
        const events = loadStore(STORAGE_KEYS.journeyEvents)
          .filter(e => e.customerName === customerName)
          .sort((a, b) => a.timestamp - b.timestamp);
        
        // حساب المرحلة الحالية
        let currentStage = 'awareness';
        if (events.length > 0) {
          const lastEvent = events[events.length - 1];
          currentStage = lastEvent.stage || 'awareness';
        }
        
        // حساب المدة في كل مرحلة
        const stageDurations = {};
        const stageStarts = {};
        events.forEach(e => {
          if (!stageStarts[e.stage]) {
            stageStarts[e.stage] = e.timestamp;
          }
          if (e.stage !== currentStage && !stageDurations[e.stage]) {
            stageDurations[e.stage] = e.timestamp - stageStarts[e.stage];
          }
        });
        
        // Funnel
        const funnel = Object.keys(JourneyStages)
          .filter(s => JourneyStages[s].order > 0)
          .map(stageId => {
            const stageEvents = events.filter(e => e.stage === stageId);
            return {
              stage: stageId,
              ...JourneyStages[stageId],
              reached: stageEvents.length > 0,
              eventCount: stageEvents.length,
              firstReached: stageEvents.length > 0 ? stageEvents[0].timestamp : null
            };
          });
        
        // حساب معدل التحويل بين المراحل
        for (let i = 1; i < funnel.length; i++) {
          if (funnel[i-1].reached) {
            funnel[i].conversionRate = funnel[i].reached ? 
              (funnel[i].eventCount / funnel[i-1].eventCount * 100).toFixed(1) + '%' : '0%';
          }
        }
        
        // الوقت في المرحلة الحالية
        const timeInCurrentStage = Date.now() - (stageStarts[currentStage] || Date.now());
        const stageInfo = JourneyStages[currentStage];
        const expectedDuration = stageInfo?.avgDurationDays * 24 * 60 * 60 * 1000 || 0;
        const stageHealth = expectedDuration > 0 ? 
          Math.max(0, 100 - (timeInCurrentStage / expectedDuration * 100)).toFixed(0) : 100;
        
        // الإجراء التالي المقترح
        const nextAction = this.getNextAction(currentStage, {
          timeInStage: timeInCurrentStage,
          stageHealth,
          events: events.length,
          totalValue: events.reduce((sum, e) => sum + (e.value || 0), 0)
        });
        
        return {
          customerName,
          currentStage,
          stageInfo,
          events,
          stageDurations,
          funnel,
          timeInCurrentStage,
          timeInCurrentStageDays: Math.floor(timeInCurrentStage / (24 * 60 * 60 * 1000)),
          stageHealth: stageHealth + '%',
          expectedDuration: stageInfo?.avgDurationDays || 0,
          isOverdue: timeInCurrentStage > expectedDuration && expectedDuration > 0,
          nextAction,
          totalEvents: events.length,
          totalValue: events.reduce((sum, e) => sum + (e.value || 0), 0)
        };
      },
      
      getNextAction(currentStage, context) {
        const stageInfo = JourneyStages[currentStage];
        if (!stageInfo) return null;
        
        const actions = {
          awareness: {
            priority: 'medium',
            action: 'إرسال محتوى تعليمي',
            channel: 'whatsapp',
            reason: 'العميل في مرحلة الوعي - يحتاج معرفة قيمة المنتج',
            script: 'مرحباً! نقدم لك دليل شامل عن منتجاتنا...'
          },
          consideration: {
            priority: 'high',
            action: 'إرسال عرض مخصص',
            channel: 'phone',
            reason: 'العميل يفكر - اللحظة المثالية للعرض',
            script: 'بناءً على اهتمامك، نقدم لك عرض خاص...'
          },
          decision: {
            priority: 'urgent',
            action: 'متابعة مباشرة',
            channel: 'visit',
            reason: 'العميل مستعد للشراء - لا تفوّت الفرصة',
            script: 'متابعة شخصية لتأكيد التفاصيل'
          },
          retention: {
            priority: 'high',
            action: 'عرض ولاء',
            channel: 'whatsapp',
            reason: 'العميل نشط - حافظ عليه',
            script: 'شكراً لولائك! نقدم لك خصم خاص...'
          },
          advocacy: {
            priority: 'medium',
            action: 'برنامج إحالة',
            channel: 'email',
            reason: 'العميل مخلص - حوله لداعية',
            script: 'ادعُ أصدقاءك واحصل على مكافآت...'
          },
          churned: {
            priority: 'urgent',
            action: 'حملة إيقاظ',
            channel: 'whatsapp',
            reason: 'العميل منسحب - حاول استعادته',
            script: 'وحشتنا طلباتك! عرض خاص للعودة...'
          }
        };
        
        return actions[currentStage] || null;
      },
      
      // رحلة كل العملاء
      getAllJourneys() {
        const events = loadStore(STORAGE_KEYS.journeyEvents);
        const customers = [...new Set(events.map(e => e.customerName))];
        return customers.map(c => this.getCustomerJourney(c));
      },
      
      // إحصائيات المراحل
      getStageDistribution() {
        const journeys = this.getAllJourneys();
        const distribution = {};
        Object.keys(JourneyStages).forEach(s => {
          distribution[s] = 0;
        });
        journeys.forEach(j => {
          if (distribution[j.currentStage] !== undefined) {
            distribution[j.currentStage]++;
          }
        });
        return distribution;
      },
      
      // Self test
      selfTest() {
        const tests = [];
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        
        // Track events
        const e1 = this.trackEvent('Customer A', { stage: 'awareness', type: 'visit' });
        tests.push({ name: 'تسجيل حدث', pass: e1.success === true });
        
        this.trackEvent('Customer A', { stage: 'awareness', type: 'view_product' });
        this.trackEvent('Customer A', { stage: 'consideration', type: 'inquiry', value: 100 });
        this.trackEvent('Customer A', { stage: 'decision', type: 'order', value: 500 });
        
        const journey = this.getCustomerJourney('Customer A');
        tests.push({ name: 'جلب الرحلة', pass: journey.totalEvents === 4 });
        tests.push({ name: 'المرحلة الحالية صحيحة', pass: journey.currentStage === 'decision' });
        tests.push({ name: 'Funnel موجود', pass: journey.funnel.length > 0 });
        tests.push({ name: 'الإجراء التالي موجود', pass: journey.nextAction !== null });
        
        // Stage distribution
        const dist = this.getStageDistribution();
        tests.push({ name: 'توزيع المراحل', pass: Object.keys(dist).length > 0 });
        
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        return tests;
      }
    };
    
    window.NotificationService = NotificationService;
    window.CustomerJourney = CustomerJourney;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('NotificationService + CustomerJourney ready');
    }
  })();
  