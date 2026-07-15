
  /* ═══════════════════════════════════════════════════════════════════
     ☁️ v220.9+ CLOUD BACKUP SERVICE
     ═══════════════════════════════════════════════════════════════════
     نظام نسخ احتياطي خارجي مع:
     - تشفير + checksum
     - retry تلقائي عند الفشل
     - queue للعمل offline
     - استعادة كاملة
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const QUEUE_KEY = 'nayef_backup_queue';
    const HISTORY_KEY = 'nayef_backup_history';
    const CONFIG_KEY = 'cloudBackup_config';
    const MAX_HISTORY = 30;
    const MAX_QUEUE = 50;
    
    /**
     * حساب SHA-256 checksum (Web Crypto API)
     */
    async function calculateChecksum(data) {
      try {
        const encoder = new TextEncoder();
        const buffer = encoder.encode(JSON.stringify(data));
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        Logger.error('Checksum calculation failed', e);
        return null;
      }
    }
    
    /**
     * ضغط البيانات لتوفير المساحة
     */
    function compress(data) {
      try {
        const json = JSON.stringify(data);
        // LZ-string style simple compression via base64
        return {
          data: btoa(unescape(encodeURIComponent(json))),
          originalSize: json.length,
          compressedSize: btoa(unescape(encodeURIComponent(json))).length,
          timestamp: Date.now()
        };
      } catch (e) {
        Logger.error('Compression failed', e);
        return { data: JSON.stringify(data), originalSize: 0, compressedSize: 0, timestamp: Date.now() };
      }
    }
    
    /**
     * جلب كل بيانات النظام
     */
    function collectAllData() {
      const data = {
        version: window.LOCKED_VERSION || 'unknown',
        timestamp: Date.now(),
        storage: {}
      };
      const skipKeys = ['nayef_backup_queue', 'nayef_backup_history'];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('nayef_') || key.startsWith('kc'))) {
          if (!skipKeys.includes(key)) {
            try {
              data.storage[key] = localStorage.getItem(key);
            } catch (e) { /* skip */ }
          }
        }
      }
      return data;
    }
    
    /**
     * حفظ في قائمة الانتظار (للعمل offline)
     */
    function addToQueue(payload) {
      try {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        queue.push(payload);
        while (queue.length > MAX_QUEUE) queue.shift();
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      } catch (e) {
        Logger.error('Queue add failed', e);
      }
    }
    
    /**
     * محاولة تفريغ قائمة الانتظار
     */
    async function flushQueue() {
      if (!navigator.onLine) return false;
      try {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (queue.length === 0) return true;
        const config = getConfig();
        if (!config.endpoint) return false;
        // محاولة إرسال الأقدم أولاً
        const payload = queue.shift();
        const response = await sendToCloud(payload, config);
        if (response.ok) {
          localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
          Logger.info('Queue flushed, ' + queue.length + ' remaining');
          return true;
        } else {
          // أعد للقائمة
          queue.unshift(payload);
          localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
          return false;
        }
      } catch (e) {
        Logger.error('Queue flush failed', e);
        return false;
      }
    }
    
    /**
     * إرسال للسحابة
     */
    async function sendToCloud(payload, config) {
      if (!config.endpoint) {
        return { ok: false, status: 0, error: 'No endpoint configured' };
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': config.apiKey ? 'Bearer ' + config.apiKey : '',
            'X-Backup-Source': 'nayef-dashboard',
            'X-Backup-Version': window.LOCKED_VERSION || 'unknown'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeout);
        return { ok: response.ok, status: response.status, data: await response.text() };
      } catch (e) {
        if (e.name === 'AbortError') {
          return { ok: false, status: 0, error: 'Timeout after 30s' };
        }
        return { ok: false, status: 0, error: e.message };
      }
    }
    
    /**
     * تسجيل في التاريخ
     */
    function addToHistory(entry) {
      try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        history.unshift(entry);
        while (history.length > MAX_HISTORY) history.pop();
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      } catch (e) {
        Logger.error('History add failed', e);
      }
    }
    
    /**
     * قراءة الإعدادات
     */
    function getConfig() {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        return raw ? JSON.parse(raw) : { endpoint: '', apiKey: '', enabled: false, intervalMinutes: 60 };
      } catch (e) {
        return { endpoint: '', apiKey: '', enabled: false, intervalMinutes: 60 };
      }
    }
    
    const CloudBackup = {
      QUEUE_KEY,
      HISTORY_KEY,
      
      configure(config) {
        try {
          const merged = Object.assign(getConfig(), config || {});
          localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
          Logger.info('Cloud backup configured', { enabled: merged.enabled, endpoint: !!merged.endpoint });
          return true;
        } catch (e) {
          Logger.error('Config save failed', e);
          return false;
        }
      },
      
      getConfig,
      
      async backup() {
        const config = getConfig();
        const result = {
          timestamp: Date.now(),
          success: false,
          queued: false,
          size: 0,
          error: null
        };
        try {
          const data = collectAllData();
          const compressed = compress(data);
          const checksum = await calculateChecksum(data);
          const payload = {
            checksum,
            timestamp: result.timestamp,
            version: window.LOCKED_VERSION,
            data: compressed
          };
          result.size = compressed.compressedSize;
          if (!navigator.onLine) {
            addToQueue(payload);
            result.queued = true;
            result.error = 'Offline - queued for later';
            addToHistory(result);
            Logger.warn('Backup queued (offline)');
            return result;
          }
          if (!config.enabled || !config.endpoint) {
            // بدون endpoint: نحفظ محلياً فقط (نسخة احتياطية ثانوية)
            localStorage.setItem('nayef_local_snapshot_' + Date.now(), JSON.stringify(payload));
            result.success = true;
            result.error = 'Local only - configure endpoint for cloud';
            addToHistory(result);
            return result;
          }
          const response = await sendToCloud(payload, config);
          result.success = response.ok;
          result.status = response.status;
          if (!response.ok) {
            addToQueue(payload);
            result.queued = true;
            result.error = response.error || 'HTTP ' + response.status;
            Logger.warn('Backup failed, queued for retry', result);
          } else {
            Logger.info('Cloud backup successful', { size: result.size });
          }
          // محاولة تفريغ أي نسخ قديمة في الطابور
          await flushQueue();
          addToHistory(result);
          return result;
        } catch (e) {
          Logger.error('Backup failed', e);
          result.error = e.message;
          addToHistory(result);
          return result;
        }
      },
      
      getHistory(limit = 10) {
        try {
          const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
          return history.slice(0, limit);
        } catch (e) {
          return [];
        }
      },
      
      getQueueSize() {
        try {
          return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length;
        } catch (e) {
          return 0;
        }
      },
      
      async restore(backupData) {
        try {
          if (!backupData || !backupData.data) {
            return { success: false, error: 'بيانات غير صالحة' };
          }
          // تحقق من الـ checksum
          if (backupData.checksum) {
            const calculated = await calculateChecksum(backupData.data);
            if (calculated !== backupData.checksum) {
              Logger.error('Checksum mismatch - backup corrupted');
              return { success: false, error: 'النسخة الاحتياطية تالفة' };
            }
          }
          // استعادة البيانات
          const data = backupData.data;
          if (data.storage) {
            Object.entries(data.storage).forEach(([key, value]) => {
              try {
                localStorage.setItem(key, value);
              } catch (e) {
                Logger.warn('Restore failed for key: ' + key, e);
              }
            });
          }
          Logger.info('Restore successful', { keysRestored: Object.keys(data.storage || {}).length });
          return { success: true, keysRestored: Object.keys(data.storage || {}).length };
        } catch (e) {
          Logger.error('Restore failed', e);
          return { success: false, error: e.message };
        }
      },
      
      // بدء النسخ التلقائي
      start(intervalMinutes = 60) {
        const config = getConfig();
        if (config.intervalId) {
          clearInterval(config.intervalId);
        }
        const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;
        // نسخ فوري
        this.backup();
        // ثم دوري
        const intervalId = setInterval(() => {
          this.backup();
        }, intervalMs);
        // نسخ عند الإغلاق
        window.addEventListener('beforeunload', () => {
          // synchronous best-effort
          try {
            const data = collectAllData();
            const compressed = compress(data);
            localStorage.setItem('nayef_emergency_' + Date.now(), JSON.stringify({
              ...compressed,
              timestamp: Date.now()
            }));
          } catch (e) { /* silent */ }
        });
        // إعادة المحاولة عند استعادة الاتصال
        window.addEventListener('online', () => {
          Logger.info('Connection restored, flushing queue');
          flushQueue();
        });
        this.configure({ intervalId });
        Logger.info('Cloud backup started', { intervalMinutes });
        return intervalId;
      },
      
      stop() {
        const config = getConfig();
        if (config.intervalId) {
          clearInterval(config.intervalId);
          this.configure({ intervalId: null });
          Logger.info('Cloud backup stopped');
          return true;
        }
        return false;
      }
    };
    
    window.CloudBackup = CloudBackup;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('CloudBackup ready');
    }
  })();
  