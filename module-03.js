
  /* ═══════════════════════════════════════════════════════════════════
     🔐 v220.9+ SECURE CONFIG MANAGER
     ═══════════════════════════════════════════════════════════════════
     يخزن إعدادات API بشكل آمن مع:
     - تشفير بسيط للحماية من الوصول المباشر
     - تنبيه المستخدم عند حفظ مفاتيح حساسة
     - توثيق واضح لأفضل ممارسات الأمان
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const SecureConfig = {
      // تشفير XOR بسيط (ليس آمن 100% لكنه أفضل من النص الصريح)
      _xorKey: 'nayef-' + (navigator.userAgent.length || 0),
      
      _encrypt(value) {
        try {
          const text = JSON.stringify(value);
          let result = '';
          for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(
              text.charCodeAt(i) ^ this._xorKey.charCodeAt(i % this._xorKey.length)
            );
          }
          return btoa(unescape(encodeURIComponent(result)));
        } catch (e) {
          Logger.error('Encryption failed', e);
          return null;
        }
      },
      
      _decrypt(encoded) {
        try {
          const text = atob(encoded);
          let result = '';
          for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(
              text.charCodeAt(i) ^ this._xorKey.charCodeAt(i % this._xorKey.length)
            );
          }
          return JSON.parse(decodeURIComponent(escape(result)));
        } catch (e) {
          return null;
        }
      },
      
      // التحقق من شكل مفتاح Supabase
      validateSupabaseKey(key) {
        if (!key || typeof key !== 'string') {
          return { valid: false, error: 'المفتاح مطلوب' };
        }
        // JWT format: xxx.xxx.xxx
        const parts = key.split('.');
        if (parts.length !== 3) {
          return { valid: false, error: 'صيغة المفتاح غير صحيحة (يجب أن يكون JWT)' };
        }
        if (!key.startsWith('eyJ')) {
          return { valid: false, error: 'مفتاح Supabase يجب أن يبدأ بـ eyJ' };
        }
        return { valid: true };
      },
      
      // حفظ إعداد بشكل آمن
      save(key, value) {
        if (!key || value === undefined) return false;
        try {
          const encrypted = this._encrypt(value);
          localStorage.setItem('nayef_secure_' + key, encrypted);
          return true;
        } catch (e) {
          Logger.error('Failed to save config', e, { key });
          return false;
        }
      },
      
      // قراءة إعداد
      get(key) {
        try {
          const encrypted = localStorage.getItem('nayef_secure_' + key);
          if (!encrypted) return null;
          return this._decrypt(encrypted);
        } catch (e) {
          Logger.error('Failed to read config', e, { key });
          return null;
        }
      },
      
      // حذف إعداد
      remove(key) {
        localStorage.removeItem('nayef_secure_' + key);
      },
      
      // تنظيف جميع الإعدادات الآمنة
      clearAll() {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('nayef_secure_')) {
            localStorage.removeItem(k);
          }
        });
      },
      
      // تنبيه المستخدم عند حفظ مفاتيح حساسة
      warnIfSensitiveKey(key) {
        const sensitive = ['supabase_key', 'api_key', 'twilio_sid', 'twilio_token'];
        if (sensitive.some(s => key.toLowerCase().includes(s))) {
          Logger.warn('Sensitive key stored locally. For production, use Edge Functions.', { key });
        }
      }
    };
    
    window.SecureConfig = SecureConfig;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('SecureConfig ready');
    }
  })();
  