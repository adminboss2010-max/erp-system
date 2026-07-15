
  /* ═══════════════════════════════════════════════════════════════════
     🛡️ v220.9+ ERROR BOUNDARY
     ═══════════════════════════════════════════════════════════════════
     يحمي التطبيق من الانهيار عند حدوث خطأ في أي دالة
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    /**
     * تغليف آمن لتشغيل دوال الـ render
     * @param {Function} renderFn - دالة الرسم
     * @param {HTMLElement} container - العنصر المستهدف
     * @param {...any} args - معاملات إضافية
     * @returns {Object} - { success, error? }
     */
    function safeRender(renderFn, container, ...args) {
      try {
        if (typeof renderFn !== 'function') {
          throw new Error('renderFn must be a function');
        }
        if (!container) {
          throw new Error('container element is required');
        }
        const result = renderFn(container, ...args);
        return { success: true, result };
      } catch (error) {
        Logger.error('Render failed: ' + (renderFn.name || 'anonymous'), error, {
          containerId: container ? container.id : null,
          argsCount: args.length
        });
        if (container && container.innerHTML !== undefined) {
          container.innerHTML = renderErrorFallback(error, renderFn.name);
        }
        return { success: false, error };
      }
    }
    
    /**
     * HTML للعرض عند حدوث خطأ
     */
    function renderErrorFallback(error, functionName) {
      const errorMsg = (error && error.message) ? error.message : 'خطأ غير معروف';
      const safeErrorMsg = errorMsg.replace(/[<>"']/g, '');
      const isDev = window.NAYEF_ENV && window.NAYEF_ENV.isDev;
      return [
        '<div class="error-fallback" style="text-align:center;padding:48px 24px;color:var(--c-fg-muted,#64748b);background:var(--c-bg-subtle,#f8fafc);border-radius:12px;margin:20px;">',
          '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>',
          '<h3 style="margin:0 0 8px;color:var(--c-fg,#0f172a);font-size:18px;">حدث خطأ في تحميل هذا القسم</h3>',
          '<p style="margin:0 0 16px;color:var(--c-fg-muted,#64748b);font-size:14px;">تم تسجيل الخطأ وسنعمل على إصلاحه تلقائياً.</p>',
          (isDev ? '<p style="font-family:monospace;font-size:12px;color:var(--c-danger,#dc2626);background:rgba(220,38,38,0.05);padding:8px 12px;border-radius:6px;margin:8px 0;">[' + (functionName || 'unknown') + '] ' + safeErrorMsg + '</p>' : ''),
          '<button onclick="location.reload()" style="margin-top:8px;padding:10px 20px;background:var(--c-primary,#059669);color:white;border:none;border-radius:6px;cursor:pointer;font-family:inherit;font-size:14px;">🔄 إعادة تحميل</button>',
        '</div>'
      ].join('');
    }
    
    /**
     * تغليف آمن لتشغيل أي دالة مع معالجة الأخطاء
     */
    function safeExec(fn, ...args) {
      try {
        const result = fn(...args);
        if (result && typeof result.then === 'function') {
          return result.catch(error => {
            Logger.error('Async operation failed: ' + (fn.name || 'anonymous'), error);
            return null;
          });
        }
        return result;
      } catch (error) {
        Logger.error('Execution failed: ' + (fn.name || 'anonymous'), error);
        return null;
      }
    }
    
    /**
     * معالج أخطاء Promise غير الممسكة
     */
    function handleAsyncError(promise, context) {
      if (!promise || typeof promise.then !== 'function') return promise;
      return promise.catch(error => {
        Logger.error('Promise rejected: ' + (context || 'unknown'), error);
        // لا تعيد throw - امتص الخطأ
        return null;
      });
    }
    
    window.safeRender = safeRender;
    window.safeExec = safeExec;
    window.handleAsyncError = handleAsyncError;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('ErrorBoundary ready');
    }
  })();
  