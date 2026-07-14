
  /* ═══════════════════════════════════════════════════════════════════
     🛡️ v220.9+ LOGGING SYSTEM (Production-Ready)
     ═══════════════════════════════════════════════════════════════════
     بديل احترافي لـ console.log يكشف معلومات حساسة في الإنتاج
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const NAYEF_ENV = {
      // يتغير تلقائياً حسب الـ hostname
      // - localhost / 127.0.0.1 → 'development' (يظهر console)
      // - nayef.app → 'production' (يرسل لـ Sentry فقط)
      isDev: window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1' ||
             window.location.hostname.startsWith('192.168.') ||
             window.location.search.includes('debug=1'),
      version: window.LOCKED_VERSION || 'unknown',
      service: 'nayef-dashboard',
      errors: [],
      maxErrors: 50
    };
    
    // قائمة الأخطاء للمراجعة المحلية (للإدارة فقط)
    NAYEF_ENV.getRecentErrors = function() {
      return NAYEF_ENV.errors.slice(-NAYEF_ENV.maxErrors);
    };
    
    function sendToSentry(level, message, data) {
      // في الإنتاج: ارسل لـ Sentry أو endpoint خاص
      if (window.Sentry && typeof window.Sentry.captureMessage === 'function') {
        try {
          window.Sentry.captureMessage(message, {
            level: level,
            extra: data,
            tags: { service: NAYEF_ENV.service, version: NAYEF_ENV.version }
          });
        } catch (e) { /* silent */ }
      }
      
      // احتفظ بنسخة محلية (لا تكشف بيانات حساسة)
      if (level === 'error' || level === 'warning') {
        NAYEF_ENV.errors.push({
          timestamp: new Date().toISOString(),
          level,
          message: String(message).substring(0, 200),
          data: data ? JSON.stringify(data).substring(0, 500) : null
        });
        if (NAYEF_ENV.errors.length > NAYEF_ENV.maxErrors * 2) {
          NAYEF_ENV.errors = NAYEF_ENV.errors.slice(-NAYEF_ENV.maxErrors);
        }
      }
    }
    
    const Logger = {
      env: NAYEF_ENV,
      
      debug(message, data) {
        if (!NAYEF_ENV.isDev) return;
        try { console.debug('🔍 [' + NAYEF_ENV.service + ']', message, data || ''); } catch(e) {}
      },
      
      info(message, data) {
        if (NAYEF_ENV.isDev) {
          try { console.info('ℹ️ [' + NAYEF_ENV.service + ']', message, data || ''); } catch(e) {}
        }
        sendToSentry('info', message, data);
      },
      
      warn(message, data) {
        if (NAYEF_ENV.isDev) {
          try { console.warn('⚠️ [' + NAYEF_ENV.service + ']', message, data || ''); } catch(e) {}
        }
        sendToSentry('warning', message, data);
      },
      
      error(message, error, context) {
        if (NAYEF_ENV.isDev) {
          try { console.error('❌ [' + NAYEF_ENV.service + ']', message, error, context || ''); } catch(e) {}
        }
        sendToSentry('error', message, {
          errorMessage: error && error.message ? error.message : null,
          stack: error && error.stack ? error.stack.substring(0, 500) : null,
          context: context || null
        });
      },
      
      audit(action, entityType, entityId, details) {
        // للعمليات المالية الحساسة
        sendToSentry('info', '[AUDIT] ' + action + ' ' + entityType, {
          action, entityType, entityId, details,
          timestamp: new Date().toISOString(),
          userId: (typeof getCurrentUser === 'function') ? getCurrentUser() : 'anonymous'
        });
      }
    };
    
    // اجعل Logger متاح globally
    window.Logger = Logger;
    window.NAYEF_ENV = NAYEF_ENV;
    
    // معالج الأخطاء العام
    window.addEventListener('error', function(event) {
      Logger.error('Uncaught error: ' + event.message, event.error, {
        filename: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });
    
    window.addEventListener('unhandledrejection', function(event) {
      Logger.error('Unhandled promise rejection', event.reason);
    });
    
    if (NAYEF_ENV.isDev) {
      Logger.info('Logger initialized [' + NAYEF_ENV.version + ']');
    }
  })();
  