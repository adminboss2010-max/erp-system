
  /* ═══════════════════════════════════════════════════════════════════
     🔌 v220.9+ PUBLIC API + EVENT BUS + WEBHOOKS
     ═══════════════════════════════════════════════════════════════════
     طبقة API عامة:
     - REST-like endpoints
     - Event Bus للتطبيق الداخلي
     - Webhooks للإشعارات الخارجية
     - API Keys + Rate Limiting
     - Request/Response logging
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const STORAGE_KEYS = {
      apiKeys: 'nayef_api_keys',
      webhooks: 'nayef_webhooks',
      webhookDeliveries: 'nayef_webhook_deliveries',
      apiLogs: 'nayef_api_logs',
      rateLimits: 'nayef_rate_limits'
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
    
    function generateApiKey() {
      return 'nky_' + Date.now().toString(36) + '_' + 
             Array.from(crypto.getRandomValues(new Uint8Array(24)))
               .map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // ============== Event Bus ==============
    
    const EventBus = {
      listeners: new Map(),
      
      on(event, handler) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
        return () => this.off(event, handler);
      },
      
      off(event, handler) {
        if (this.listeners.has(event)) {
          this.listeners.get(event).delete(handler);
        }
      },
      
      emit(event, data) {
        const handlers = this.listeners.get(event);
        if (!handlers) return;
        handlers.forEach(handler => {
          try {
            handler(data, event);
          } catch (e) {
            Logger.error('Event handler error', e, { event });
          }
        });
        
        // Wildcard listeners
        const wildcards = this.listeners.get('*');
        if (wildcards) {
          wildcards.forEach(handler => {
            try { handler({ event, data }); } catch (e) {}
          });
        }
      },
      
      clear() {
        this.listeners.clear();
      }
    };
    
    // ============== Standard Events ==============
    
    const Events = {
      TRANSACTION_CREATED: 'transaction.created',
      TRANSACTION_UPDATED: 'transaction.updated',
      CUSTOMER_CREATED: 'customer.created',
      CUSTOMER_CHURNED: 'customer.churned',
      INVOICE_CREATED: 'invoice.created',
      STOCK_LOW: 'stock.low',
      STOCK_OUT: 'stock.out',
      CAMPAIGN_SENT: 'campaign.sent',
      AB_TEST_COMPLETED: 'abtest.completed',
      CRM_INTERACTION_LOGGED: 'crm.interaction_logged',
      ERROR_OCCURRED: 'error.occurred',
      // ... يمكن إضافة المزيد
    };
    
    // ============== Rate Limiter ==============
    
    class RateLimiter {
      constructor(maxRequests = 100, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map(); // apiKey -> [timestamps]
      }
      
      check(apiKey) {
        const now = Date.now();
        const cutoff = now - this.windowMs;
        
        if (!this.requests.has(apiKey)) {
          this.requests.set(apiKey, []);
        }
        
        const timestamps = this.requests.get(apiKey);
        // تنظيف القديم
        while (timestamps.length > 0 && timestamps[0] < cutoff) {
          timestamps.shift();
        }
        
        if (timestamps.length >= this.maxRequests) {
          return {
            allowed: false,
            remaining: 0,
            resetAt: timestamps[0] + this.windowMs,
            retryAfter: Math.ceil((timestamps[0] + this.windowMs - now) / 1000)
          };
        }
        
        timestamps.push(now);
        return {
          allowed: true,
          remaining: this.maxRequests - timestamps.length,
          resetAt: now + this.windowMs
        };
      }
      
      reset(apiKey) {
        this.requests.delete(apiKey);
      }
    }
    
    // ============== Webhook Delivery ==============
    
    async function deliverWebhook(webhook, event, data) {
      const payload = {
        event,
        data,
        timestamp: Date.now(),
        webhookId: webhook.id,
        deliveryId: generateId()
      };
      
      // توقيع للـ verification
      const signature = await generateSignature(JSON.stringify(payload), webhook.secret);
      
      const startTime = Date.now();
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Nayef-Event': event,
            'X-Nayef-Delivery': payload.deliveryId,
            'X-Nayef-Signature': signature,
            'User-Agent': 'Nayef-Webhook/1.0'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000) // 30s timeout
        });
        
        const duration = Date.now() - startTime;
        const success = response.ok;
        const status = response.status;
        
        // تسجيل
        const deliveries = loadStore(STORAGE_KEYS.webhookDeliveries);
        deliveries.push({
          id: payload.deliveryId,
          webhookId: webhook.id,
          event,
          status,
          success,
          duration,
          timestamp: Date.now(),
          responseBody: success ? null : (await response.text().catch(() => '')).substring(0, 500)
        });
        while (deliveries.length > 1000) deliveries.shift();
        saveStore(STORAGE_KEYS.webhookDeliveries, deliveries);
        
        return { success, status, duration };
      } catch (e) {
        const duration = Date.now() - startTime;
        const deliveries = loadStore(STORAGE_KEYS.webhookDeliveries);
        deliveries.push({
          id: payload.deliveryId,
          webhookId: webhook.id,
          event,
          success: false,
          error: e.message,
          duration,
          timestamp: Date.now()
        });
        saveStore(STORAGE_KEYS.webhookDeliveries, deliveries);
        return { success: false, error: e.message, duration };
      }
    }
    
    async function generateSignature(payload, secret) {
      try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(secret || 'nayef-default-secret'),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
        return Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        return 'sig_' + Date.now();
      }
    }
    
    // ============== REST API ==============
    
    class RestAPI {
      constructor() {
        this.routes = new Map();
        this.middleware = [];
        this.rateLimiter = new RateLimiter(100, 60000);
      }
      
      addRoute(method, path, handler, options = {}) {
        const key = method.toUpperCase() + ' ' + path;
        this.routes.set(key, { handler, options });
      }
      
      get(path, handler, options) { return this.addRoute('GET', path, handler, options); }
      post(path, handler, options) { return this.addRoute('POST', path, handler, options); }
      put(path, handler, options) { return this.addRoute('PUT', path, handler, options); }
      delete(path, handler, options) { return this.addRoute('DELETE', path, handler, options); }
      
      use(middleware) {
        this.middleware.push(middleware);
      }
      
      async handle(method, path, body = null, options = {}) {
        const startTime = Date.now();
        const key = method.toUpperCase() + ' ' + path;
        const route = this.routes.get(key);
        
        // Rate limiting
        if (options.apiKey) {
          const limitCheck = this.rateLimiter.check(options.apiKey);
          if (!limitCheck.allowed) {
            return {
              status: 429,
              error: 'Too Many Requests',
              retryAfter: limitCheck.retryAfter
            };
          }
        }
        
        // Logging
        const log = {
          method,
          path,
          timestamp: Date.now(),
          apiKey: options.apiKey || null
        };
        
        try {
          if (!route) {
            return { status: 404, error: 'Not Found' };
          }
          
          // Execute middleware
          for (const mw of this.middleware) {
            await mw(options, body);
          }
          
          // Execute handler
          const result = await route.handler(body || {}, options);
          
          log.status = result.status || 200;
          log.duration = Date.now() - startTime;
          log.success = true;
          
          // Emit event
          EventBus.emit('api.request', log);
          
          return result;
        } catch (e) {
          log.status = 500;
          log.error = e.message;
          log.duration = Date.now() - startTime;
          log.success = false;
          
          EventBus.emit('api.error', log);
          Logger.error('API request failed', e, { method, path });
          
          return { status: 500, error: e.message };
        } finally {
          // حفظ السجل
          const logs = loadStore(STORAGE_KEYS.apiLogs);
          logs.push(log);
          while (logs.length > 500) logs.shift();
          saveStore(STORAGE_KEYS.apiLogs, logs);
        }
      }
    }
    
    // ============== Public API Setup ==============
    
    const api = new RestAPI();
    
    // Middleware: Authentication
    api.use(async (options) => {
      if (options.requireAuth !== false) {
        const apiKey = options.apiKey;
        if (!apiKey) {
          throw new Error('API key required');
        }
        const keys = loadStore(STORAGE_KEYS.apiKeys);
        const keyData = keys.find(k => k.key === apiKey && k.enabled);
        if (!keyData) {
          throw new Error('Invalid API key');
        }
      }
    });
    
    // ============== API Endpoints ==============
    
    // GET /api/customers
    api.get('/api/customers', (params, options) => {
      const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
      let customers = O.soc || [];
      
      // فلاتر
      if (params.search) {
        const q = String(params.search).toLowerCase();
        customers = customers.filter(c => 
          (c.nm || c.name || '').toLowerCase().includes(q)
        );
      }
      
      // Pagination
      const page = parseInt(params.page) || 1;
      const limit = Math.min(parseInt(params.limit) || 50, 500);
      const start = (page - 1) * limit;
      const items = customers.slice(start, start + limit);
      
      return {
        status: 200,
        data: {
          items,
          total: customers.length,
          page,
          limit,
          hasMore: start + limit < customers.length
        }
      };
    });
    
    // GET /api/customers/:id
    api.get('/api/customers/:id', (params) => {
      const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
      const customer = (O.soc || []).find(c => (c.nm || c.name) === params.id);
      
      if (!customer) {
        return { status: 404, error: 'Customer not found' };
      }
      
      const transactions = (O.tx || []).filter(t => 
        (t.client || t.cl) === params.id
      );
      
      return {
        status: 200,
        data: {
          ...customer,
          transactionsCount: transactions.length,
          totalSpent: transactions
            .filter(t => (t.tp || t.type) === 'sale')
            .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
        }
      };
    });
    
    // GET /api/transactions
    api.get('/api/transactions', (params) => {
      const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
      let transactions = O.tx || [];
      
      if (params.customer) {
        transactions = transactions.filter(t => 
          (t.client || t.cl) === params.customer
        );
      }
      if (params.type) {
        transactions = transactions.filter(t => (t.tp || t.type) === params.type);
      }
      if (params.since) {
        transactions = transactions.filter(t => 
          new Date(t.dt || t.date).getTime() >= parseInt(params.since)
        );
      }
      
      const page = parseInt(params.page) || 1;
      const limit = Math.min(parseInt(params.limit) || 50, 500);
      const start = (page - 1) * limit;
      const items = transactions.slice(start, start + limit);
      
      return {
        status: 200,
        data: {
          items,
          total: transactions.length,
          page,
          limit,
          hasMore: start + limit < transactions.length
        }
      };
    });
    
    // POST /api/transactions
    api.post('/api/transactions', (params) => {
      if (typeof NayefValidator === 'undefined') {
        return { status: 500, error: 'Validator not available' };
      }
      const result = NayefValidator.transaction(params);
      if (!result.valid) {
        return { status: 400, error: 'Validation failed', details: result.errors };
      }
      
      const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
      if (!O.tx) O.tx = [];
      const newTx = { id: generateId(), ...result.value, createdAt: Date.now() };
      O.tx.push(newTx);
      
      // Emit event
      EventBus.emit(Events.TRANSACTION_CREATED, newTx);
      
      return { status: 201, data: newTx };
    });
    
    // GET /api/products
    api.get('/api/products', (params) => {
      const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
      const products = O.it || [];
      return {
        status: 200,
        data: {
          items: products,
          total: products.length
        }
      };
    });
    
    // GET /api/analytics/summary
    api.get('/api/analytics/summary', () => {
      const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
      return {
        status: 200,
        data: {
          customers: (O.soc || []).length,
          products: (O.it || []).length,
          transactions: (O.tx || []).length,
          agents: (O.mon || []).length,
          totalSales: O.T?.s || 0,
          totalCollections: O.T?.co || 0,
          totalProfit: O.T?.pr || 0,
          outstanding: O.T?.ot || 0
        }
      };
    });
    
    // POST /api/query (نقطة شاملة للأسئلة)
    api.post('/api/query', async (params) => {
      if (typeof NayefGPT === 'undefined') {
        return { status: 503, error: 'NayefGPT not available' };
      }
      if (!params.question) {
        return { status: 400, error: 'question required' };
      }
      const result = await NayefGPT.ask(params.question);
      return { status: 200, data: result };
    });
    
    // POST /api/forecast
    api.post('/api/forecast', (params) => {
      if (typeof ForecastEngine === 'undefined') {
        return { status: 503, error: 'ForecastEngine not available' };
      }
      if (!params.data || !Array.isArray(params.data)) {
        return { status: 400, error: 'data array required' };
      }
      const result = ForecastEngine.forecast(params.data, params.periods || 3);
      return { status: 200, data: result };
    });
    
    // ============== Public API Object ==============
    
    const PublicAPI = {
      version: 'v220.9.0',
      events: Events,
      bus: EventBus,
      
      // ============== API Keys ==============
      
      createApiKey(name, scopes = ['read']) {
        const keys = loadStore(STORAGE_KEYS.apiKeys);
        const key = {
          id: generateId(),
          key: generateApiKey(),
          name: name || 'Unnamed',
          scopes,
          enabled: true,
          createdAt: Date.now(),
          lastUsed: null,
          requestCount: 0
        };
        keys.push(key);
        saveStore(STORAGE_KEYS.apiKeys, keys);
        return { success: true, apiKey: key.key, id: key.id };
      },
      
      getApiKeys() {
        return loadStore(STORAGE_KEYS.apiKeys);
      },
      
      revokeApiKey(keyId) {
        const keys = loadStore(STORAGE_KEYS.apiKeys);
        const idx = keys.findIndex(k => k.id === keyId);
        if (idx === -1) return { success: false };
        keys[idx].enabled = false;
        keys[idx].revokedAt = Date.now();
        saveStore(STORAGE_KEYS.apiKeys, keys);
        return { success: true };
      },
      
      // ============== API Calls ==============
      
      async call(method, path, params = {}, apiKey = null) {
        return api.handle(method, path, params, { apiKey });
      },
      
      // ============== Webhooks ==============
      
      registerWebhook(url, events, options = {}) {
        if (!url || !events || events.length === 0) {
          return { success: false, error: 'URL and events required' };
        }
        
        const webhooks = loadStore(STORAGE_KEYS.webhooks);
        const webhook = {
          id: generateId(),
          url,
          events: Array.isArray(events) ? events : [events],
          secret: options.secret || generateId(),
          enabled: options.enabled !== false,
          createdAt: Date.now(),
          description: options.description || '',
          successCount: 0,
          failureCount: 0
        };
        
        webhooks.push(webhook);
        saveStore(STORAGE_KEYS.webhooks, webhooks);
        return { success: true, webhook };
      },
      
      getWebhooks() {
        return loadStore(STORAGE_KEYS.webhooks);
      },
      
      deleteWebhook(id) {
        const webhooks = loadStore(STORAGE_KEYS.webhooks)
          .filter(w => w.id !== id);
        saveStore(STORAGE_KEYS.webhooks, webhooks);
        return { success: true };
      },
      
      getWebhookDeliveries(webhookId = null) {
        let deliveries = loadStore(STORAGE_KEYS.webhookDeliveries);
        if (webhookId) {
          deliveries = deliveries.filter(d => d.webhookId === webhookId);
        }
        return deliveries.slice(0, 100);
      },
      
      // ============== Event System ==============
      
      on(event, handler) {
        return EventBus.on(event, handler);
      },
      
      off(event, handler) {
        return EventBus.off(event, handler);
      },
      
      emit(event, data) {
        EventBus.emit(event, data);
        
        // تشغيل webhooks
        const webhooks = loadStore(STORAGE_KEYS.webhooks)
          .filter(w => w.enabled && (w.events.includes(event) || w.events.includes('*')));
        
        webhooks.forEach(async (webhook) => {
          const result = await deliverWebhook(webhook, event, data);
          const allWebhooks = loadStore(STORAGE_KEYS.webhooks);
          const idx = allWebhooks.findIndex(w => w.id === webhook.id);
          if (idx >= 0) {
            if (result.success) allWebhooks[idx].successCount++;
            else allWebhooks[idx].failureCount++;
            saveStore(STORAGE_KEYS.webhooks, allWebhooks);
          }
        });
      },
      
      // ============== Analytics ==============
      
      getApiAnalytics() {
        const logs = loadStore(STORAGE_KEYS.apiLogs);
        const webhooks = loadStore(STORAGE_KEYS.webhooks);
        const deliveries = loadStore(STORAGE_KEYS.webhookDeliveries);
        const keys = loadStore(STORAGE_KEYS.apiKeys);
        
        const last24h = Date.now() - 24 * 60 * 60 * 1000;
        const recentLogs = logs.filter(l => l.timestamp >= last24h);
        
        return {
          totalRequests: logs.length,
          recentRequests: recentLogs.length,
          successRate: logs.length > 0 ? 
            (logs.filter(l => l.success).length / logs.length * 100).toFixed(1) + '%' : 'N/A',
          totalApiKeys: keys.length,
          activeApiKeys: keys.filter(k => k.enabled).length,
          totalWebhooks: webhooks.length,
          activeWebhooks: webhooks.filter(w => w.enabled).length,
          totalDeliveries: deliveries.length,
          successfulDeliveries: deliveries.filter(d => d.success).length,
          failedDeliveries: deliveries.filter(d => !d.success).length,
          averageResponseTime: logs.length > 0 ?
            Math.round(logs.reduce((s, l) => s + (l.duration || 0), 0) / logs.length) + 'ms' : 'N/A',
          routes: Array.from(api.routes.keys())
        };
      },
      
      // اختبارات ذاتية
      selfTest() {
        const tests = [];
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        
        // Test 1: Create API Key
        const keyResult = this.createApiKey('Test Key', ['read', 'write']);
        tests.push({ name: 'إنشاء API Key', pass: keyResult.success && keyResult.apiKey.startsWith('nky_') });
        
        // Test 2: Get API Keys
        const keys = this.getApiKeys();
        tests.push({ name: 'جلب المفاتيح', pass: keys.length === 1 });
        
        // Test 3: Register webhook
        const whResult = this.registerWebhook('https://example.com/hook', ['transaction.created']);
        tests.push({ name: 'تسجيل webhook', pass: whResult.success === true });
        
        // Test 4: Get webhooks
        tests.push({ name: 'جلب webhooks', pass: this.getWebhooks().length === 1 });
        
        // Test 5: Event Bus (بدون إطلاق webhook)
        let received = false;
        const unsub = this.on('selftest.event', () => received = true);
        // استدعاء EventBus مباشرة بدل this.emit
        EventBus.emit('selftest.event', {});
        tests.push({ name: 'Event Bus', pass: received === true });
        
        // Test 6: Rate Limiter class
        const rl = new RateLimiter(5, 1000);
        const limitR = rl.check('test');
        tests.push({ name: 'Rate Limiter', pass: limitR.allowed === true });
        
        // Test 7: Revoke Key
        this.revokeApiKey(keyResult.id);
        tests.push({ name: 'إلغاء المفتاح', pass: this.getApiKeys()[0].enabled === false });
        
        // Test 8: API Routes defined
        const routes = Array.from(api.routes.keys());
        tests.push({ name: 'Routes معرّفة', pass: routes.length >= 5 });
        
        // Test 9: API Analytics
        const analytics = this.getApiAnalytics();
        tests.push({ name: 'إحصائيات API', pass: analytics && analytics.totalWebhooks === 1 });
        
        // Test 10-14: Routes include main endpoints
        const routesStr = routes.join(',');
        tests.push({ name: '/api/customers route', pass: routesStr.includes('/api/customers') });
        tests.push({ name: '/api/transactions route', pass: routesStr.includes('/api/transactions') });
        tests.push({ name: '/api/analytics/summary route', pass: routesStr.includes('/api/analytics/summary') });
        tests.push({ name: '/api/forecast route', pass: routesStr.includes('/api/forecast') });
        tests.push({ name: '/api/query route', pass: routesStr.includes('/api/query') });
        
        // Test 15: Events constants
        tests.push({ name: 'Events constants', pass: !!Events.TRANSACTION_CREATED && !!Events.CUSTOMER_CHURNED });
        
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        return tests;
      }
    };
    
    window.PublicAPI = PublicAPI;
    
    // Setup default event listeners
    EventBus.on(Events.STOCK_LOW, (data) => {
      Logger.warn('Stock low alert', data);
    });
    
    EventBus.on(Events.ERROR_OCCURRED, (data) => {
      Logger.error('System error event', null, data);
    });
    
    if (typeof NAYEF_ENV !== 'undefined' && NAYEF_ENV.isDev) {
      Logger.info('PublicAPI ready [REST + Webhooks + EventBus]');
    }
  })();
  