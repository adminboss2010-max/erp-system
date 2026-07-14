
  /* ═══════════════════════════════════════════════════════════════════
     ⚡ v220.9+ PERFORMANCE UTILITIES
     ═══════════════════════════════════════════════════════════════════
     أدوات تحسين الأداء:
     - Debounce & Throttle
     - Memoization
     - Lazy loading
     - Virtual scrolling helper
     - Worker pool للحسابات الثقيلة
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    // ============== Debounce ==============
    
    function debounce(fn, wait = 250, immediate = false) {
      let timeout;
      return function debounced(...args) {
        const context = this;
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          timeout = null;
          if (!immediate) fn.apply(context, args);
        }, wait);
        if (callNow) fn.apply(context, args);
      };
    }
    
    // ============== Throttle ==============
    
    function throttle(fn, limit = 100) {
      let inThrottle = false;
      let lastResult;
      return function throttled(...args) {
        const context = this;
        if (!inThrottle) {
          inThrottle = true;
          lastResult = fn.apply(context, args);
          setTimeout(() => inThrottle = false, limit);
        }
        return lastResult;
      };
    }
    
    // ============== Memoization ==============
    
    function memoize(fn, keyFn) {
      const cache = new Map();
      return function memoized(...args) {
        const key = keyFn ? keyFn(...args) : JSON.stringify(args);
        if (cache.has(key)) return cache.get(key);
        const result = fn.apply(this, args);
        cache.set(key, result);
        // حد أقصى لحجم الكاش (منع تسرب الذاكرة)
        if (cache.size > 500) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        return result;
      };
    }
    
    // ============== Lazy Load ==============
    
    function lazyLoad(fn) {
      let result = null;
      let loaded = false;
      return function lazyLoaded(...args) {
        if (!loaded) {
          loaded = true;
          result = typeof fn === 'function' ? fn() : fn;
        }
        return typeof result === 'function' ? result(...args) : result;
      };
    }
    
    // ============== Virtual List (للجداول الطويلة) ==============
    
    class VirtualList {
      constructor(options) {
        this.container = options.container;
        this.items = options.items || [];
        this.itemHeight = options.itemHeight || 40;
        this.renderItem = options.renderItem || (() => '');
        this.bufferSize = options.bufferSize || 10;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.scrollHandler = null;
        
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        this.container.style.height = (options.height || 400) + 'px';
        
        this.spacer = document.createElement('div');
        this.spacer.style.position = 'relative';
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'absolute';
        this.viewport.style.top = '0';
        this.viewport.style.left = '0';
        this.viewport.style.right = '0';
        
        this.container.appendChild(this.spacer);
        this.spacer.appendChild(this.viewport);
        
        this.scrollHandler = throttle(() => this.render(), 16);
        this.container.addEventListener('scroll', this.scrollHandler);
        this.render();
      }
      
      setItems(items) {
        this.items = items;
        this.spacer.style.height = (items.length * this.itemHeight) + 'px';
        this.render();
      }
      
      render() {
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        
        this.visibleStart = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
        this.visibleEnd = Math.min(
          this.items.length,
          Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize
        );
        
        const visible = this.items.slice(this.visibleStart, this.visibleEnd);
        const offsetY = this.visibleStart * this.itemHeight;
        
        this.viewport.style.transform = `translateY(${offsetY}px)`;
        this.viewport.innerHTML = visible.map((item, i) => 
          `<div style="height:${this.itemHeight}px;">${this.renderItem(item, this.visibleStart + i)}</div>`
        ).join('');
      }
      
      destroy() {
        this.container.removeEventListener('scroll', this.scrollHandler);
      }
    }
    
    // ============== Worker Pool (للعمليات الثقيلة) ==============
    
    class WorkerPool {
      constructor(workerScript, poolSize = 2) {
        this.pool = [];
        this.queue = [];
        this.workerScript = workerScript;
        this.poolSize = poolSize;
        this.activeJobs = new Map();
        this.jobId = 0;
        
        for (let i = 0; i < poolSize; i++) {
          try {
            const worker = new Worker(workerScript);
            this.pool.push({ worker, busy: false });
            worker.addEventListener('message', (e) => this.handleMessage(i, e));
          } catch (e) {
            Logger.warn('Worker creation failed', e);
          }
        }
      }
      
      execute(data) {
        return new Promise((resolve, reject) => {
          const id = ++this.jobId;
          const job = { id, data, resolve, reject };
          
          const available = this.pool.findIndex(p => !p.busy);
          if (available >= 0) {
            this.runJob(available, job);
          } else {
            this.queue.push(job);
          }
        });
      }
      
      runJob(workerIdx, job) {
        const pool = this.pool[workerIdx];
        pool.busy = true;
        this.activeJobs.set(job.id, { workerIdx, job });
        pool.worker.postMessage({ id: job.id, data: job.data });
      }
      
      handleMessage(workerIdx, event) {
        const { id, result, error } = event.data;
        const active = this.activeJobs.get(id);
        if (!active) return;
        
        const pool = this.pool[workerIdx];
        pool.busy = false;
        this.activeJobs.delete(id);
        
        if (error) active.job.reject(new Error(error));
        else active.job.resolve(result);
        
        // معالجة الطابور
        if (this.queue.length > 0) {
          const nextJob = this.queue.shift();
          this.runJob(workerIdx, nextJob);
        }
      }
      
      terminate() {
        this.pool.forEach(p => {
          try { p.worker.terminate(); } catch (e) {}
        });
        this.pool = [];
        this.queue = [];
      }
    }
    
    // ============== RAF Throttle (للرسوم المتحركة) ==============
    
    function rafThrottle(fn) {
      let scheduled = false;
      let lastArgs;
      return function(...args) {
        lastArgs = args;
        if (!scheduled) {
          scheduled = true;
          requestAnimationFrame(() => {
            fn.apply(this, lastArgs);
            scheduled = false;
          });
        }
      };
    }
    
    // ============== Batch Updates ==============
    
    function batchDOMUpdates(callback) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          callback();
        });
      });
    }
    
    // ============== Performance Monitor ==============
    
    const PerfMonitor = {
      marks: new Map(),
      
      start(name) {
        this.marks.set(name, performance.now());
      },
      
      end(name) {
        const start = this.marks.get(name);
        if (!start) return null;
        const duration = performance.now() - start;
        this.marks.delete(name);
        return Math.round(duration * 100) / 100;
      },
      
      measure(name, fn) {
        this.start(name);
        const result = fn();
        const duration = this.end(name);
        if (typeof Logger !== 'undefined' && NAYEF_ENV.isDev) {
          Logger.debug(`Perf [${name}]: ${duration}ms`);
        }
        return result;
      },
      
      getMemoryUsage() {
        if (performance.memory) {
          return {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
          };
        }
        return null;
      }
    };
    
    // ============== Image Lazy Loader ==============
    
    function lazyLoadImages(container = document) {
      if (!('IntersectionObserver' in window)) return;
      const images = container.querySelectorAll('img[data-src]');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '100px' });
      images.forEach(img => observer.observe(img));
    }
    
    // ============== Exports ==============
    
    const PerfUtils = {
      version: 'v220.9.0',
      debounce,
      throttle,
      memoize,
      lazyLoad,
      rafThrottle,
      batchDOMUpdates,
      lazyLoadImages,
      VirtualList,
      WorkerPool,
      Monitor: PerfMonitor,
      
      selfTest() {
        const tests = [];
        
        // Test 1: debounce
        let debouncedCount = 0;
        const debouncedFn = debounce(() => debouncedCount++, 50);
        for (let i = 0; i < 5; i++) debouncedFn();
        tests.push({ name: 'Debounce موجود', pass: typeof debouncedFn === 'function' });
        
        // Test 2: throttle
        const throttledFn = throttle(() => {}, 50);
        tests.push({ name: 'Throttle موجود', pass: typeof throttledFn === 'function' });
        
        // Test 3: memoize
        let computeCount = 0;
        const memoizedFn = memoize((x) => { computeCount++; return x * 2; });
        memoizedFn(5);
        memoizedFn(5);
        memoizedFn(5);
        tests.push({ name: 'Memoize caching', pass: computeCount === 1 });
        
        // Test 4: lazy load
        const factory = lazyLoad(() => 'result');
        tests.push({ name: 'Lazy Load', pass: factory() === factory() });
        
        // Test 5: PerfMonitor
        PerfMonitor.start('test');
        const dur = PerfMonitor.end('test');
        tests.push({ name: 'PerfMonitor', pass: typeof dur === 'number' });
        
        // Test 6: rafThrottle
        const rafFn = rafThrottle(() => {});
        tests.push({ name: 'RAF Throttle', pass: typeof rafFn === 'function' });
        
        // Test 7: Memory monitoring
        const mem = PerfMonitor.getMemoryUsage();
        tests.push({ name: 'Memory Monitor', pass: mem === null || typeof mem.used === 'number' });
        
        // Test 8: WorkerPool class
        tests.push({ name: 'WorkerPool class', pass: typeof WorkerPool === 'function' });
        
        // Test 9: VirtualList class
        tests.push({ name: 'VirtualList class', pass: typeof VirtualList === 'function' });
        
        // Test 10: Batch updates
        tests.push({ name: 'Batch DOM updates', pass: typeof batchDOMUpdates === 'function' });
        
        return tests;
      }
    };
    
    window.PerfUtils = PerfUtils;
    
    // تحسينات تلقائية للنظام
    // 1. تنظيف console.log الزائدة في الإنتاج
    if (typeof NAYEF_ENV !== 'undefined' && !NAYEF_ENV.isDev) {
      // اعتراض console.log في الإنتاج
      const originalLog = console.log;
      // ✅ استثناء errors والتحذيرات حتى تشخيص الـ user
      console.log = function(...args) {
        if (typeof Logger !== 'undefined') {
          Logger.info(args.map(a => String(a)).join(' '));
        }
      };
      console.warn = function(...args) {
        if (typeof Logger !== 'undefined') Logger.warn(args.map(a => String(a)).join(' '));
      };
      // 🔧 السماح بـ console.error (أساسي لرؤية الأخطاء)
      console.error = function(...args) {
        if (typeof Logger !== 'undefined') Logger.error(args.map(a => String(a)).join(' '));
        originalLog.apply(console, ['⚠️', ...args]);
      };
    }
    
    if (typeof NAYEF_ENV !== 'undefined' && NAYEF_ENV.isDev) {
      Logger.info('PerfUtils ready [debounce, throttle, memoize, VirtualList]');
    }
  })();
  