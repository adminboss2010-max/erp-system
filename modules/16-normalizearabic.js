
  /* ═══════════════════════════════════════════════════════════════════
     🔍 v220.9+ GLOBAL SEARCH ENGINE
     ═══════════════════════════════════════════════════════════════════
     بحث شامل عبر كل البيانات:
     - Ctrl+K للتفعيل السريع
     - Fuzzy matching للعربية
     - بحث فوري أثناء الكتابة (debounced)
     - ترتيب بالملاءمة
     - تاريخ البحث
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const SEARCH_HISTORY_KEY = 'nayef_search_history';
    const MAX_HISTORY = 10;
    const MAX_RESULTS_PER_TYPE = 8;
    const MIN_QUERY_LENGTH = 1;
    
    // ============== Normalization for Arabic ==============
    
    function normalizeArabic(text) {
      if (!text) return '';
      return String(text)
        .toLowerCase()
        .replace(/[\u064B-\u0652]/g, '') // Remove diacritics
        .replace(/[إأآا]/g, 'ا')
        .replace(/[ىي]/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // ============== Fuzzy Matching ==============
    
    function fuzzyScore(query, target) {
      if (!query || !target) return 0;
      const q = normalizeArabic(query);
      const t = normalizeArabic(String(target));
      
      if (q === t) return 100;
      if (t.startsWith(q)) return 90;
      if (t.includes(q)) return 70;
      
      // Character matching
      let qi = 0, ti = 0;
      let matched = 0;
      let bonus = 0;
      let lastMatchIndex = -1;
      
      while (qi < q.length && ti < t.length) {
        if (q[qi] === t[ti]) {
          matched++;
          if (lastMatchIndex === ti - 1) bonus += 5;
          lastMatchIndex = ti;
          qi++;
        }
        ti++;
      }
      
      if (qi < q.length) return 0; // لم تُطابق كل الأحرف
      
      const baseScore = (matched / q.length) * 50;
      const bonusScore = Math.min(20, bonus);
      return baseScore + bonusScore;
    }
    
    // ============== Index Builder ==============
    
    function buildIndex() {
      try {
        const O = (typeof window !== 'undefined' && window.O) ? window.O : {};
        const index = [];
        
        // فهرسة العملاء
        (O.soc || []).forEach((c, i) => {
          index.push({
            type: 'customer',
            id: c.nm || c.name,
            title: c.nm || c.name,
            subtitle: c.phone || c.region || '',
            icon: '👥',
            data: c,
            searchable: [c.nm, c.name, c.phone, c.region, c.notes].filter(Boolean).join(' '),
            url: '#customer-' + encodeURIComponent(c.nm || c.name)
          });
        });
        
        // فهرسة المنتجات
        (O.it || []).forEach((p, i) => {
          index.push({
            type: 'product',
            id: p.nm || p.name,
            title: p.nm || p.name,
            subtitle: p.price ? p.price + ' د.ك' : '',
            icon: '📦',
            data: p,
            searchable: [p.nm, p.name, p.category].filter(Boolean).join(' '),
            url: '#product-' + encodeURIComponent(p.nm || p.name)
          });
        });
        
        // فهرسة المناديب
        (O.mon || []).forEach((a, i) => {
          index.push({
            type: 'agent',
            id: a.nm || a.name,
            title: a.nm || a.name,
            subtitle: a.phone || '',
            icon: '👨‍💼',
            data: a,
            searchable: [a.nm, a.name, a.phone].filter(Boolean).join(' '),
            url: '#agent-' + encodeURIComponent(a.nm || a.name)
          });
        });
        
        // فهرسة المعاملات الأخيرة (آخر 500)
        const recentTx = (O.tx || []).slice(-500);
        recentTx.forEach((t, i) => {
          if (!t) return;
          const amount = parseFloat(t.amount) || 0;
          index.push({
            type: 'transaction',
            id: t.id || ('tx_' + Date.now() + '_' + i),
            title: (t.client || t.cl || 'عميل') + ' - ' + amount.toFixed(3) + ' د.ك',
            subtitle: (t.dt || t.date || '') + ' - ' + (t.invoice || ''),
            icon: (t.tp || t.type) === 'sale' ? '💰' : '📝',
            data: t,
            searchable: [t.client, t.cl, t.item, t.product, t.invoice, t.dt, t.date, t.amount].filter(Boolean).join(' '),
            url: '#transaction-' + (t.id || i)
          });
        });
        
        return index;
      } catch (e) {
        Logger.error('Search index build failed', e);
        return [];
      }
    }
    
    // ============== Search Execution ==============
    
    function search(query, options = {}) {
      try {
        if (!query || query.length < MIN_QUERY_LENGTH) {
          return { results: [], query, total: 0 };
        }
        
        const startTime = performance.now ? performance.now() : Date.now();
        const index = options.useCache && _searchCache ? _searchCache : buildIndex();
        if (options.useCache !== false) _searchCache = index;
        
        const scored = [];
        for (const item of index) {
          const score = fuzzyScore(query, item.searchable);
          if (score >= 30) {
            scored.push({ ...item, score });
          }
        }
        
        // ترتيب حسب النقاط
        scored.sort((a, b) => b.score - a.score);
        
        // تجميع حسب النوع
        const grouped = {};
        const limited = [];
        for (const item of scored) {
          if (!grouped[item.type]) grouped[item.type] = 0;
          if (grouped[item.type] < MAX_RESULTS_PER_TYPE) {
            limited.push(item);
            grouped[item.type]++;
          }
        }
        
        const endTime = performance.now ? performance.now() : Date.now();
        
        return {
          query,
          results: limited,
          total: scored.length,
          grouped,
          duration: Math.round((endTime - startTime) * 100) / 100,
          timestamp: Date.now()
        };
      } catch (e) {
        Logger.error('Search failed', e);
        return { results: [], query, total: 0, error: e.message };
      }
    }
    
    let _searchCache = null;
    let _lastCacheBuild = 0;
    const CACHE_TTL = 30000; // 30 ثانية
    
    function getCachedIndex() {
      const now = Date.now();
      if (!_searchCache || (now - _lastCacheBuild) > CACHE_TTL) {
        _searchCache = buildIndex();
        _lastCacheBuild = now;
      }
      return _searchCache;
    }
    
    function invalidateCache() {
      _searchCache = null;
      _lastCacheBuild = 0;
    }
    
    // ============== Search History ==============
    
    function getHistory() {
      try {
        return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
      } catch (e) { return []; }
    }
    
    function addToHistory(query) {
      if (!query || query.length < 2) return;
      try {
        let history = getHistory();
        history = history.filter(h => h !== query);
        history.unshift(query);
        while (history.length > MAX_HISTORY) history.pop();
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
      } catch (e) {
        Logger.error('Search history failed', e);
      }
    }
    
    function clearHistory() {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    }
    
    // ============== UI Controller ==============
    
    const SearchUI = {
      isOpen: false,
      selectedIndex: 0,
      currentResults: [],
      
      init() {
        this.createModal();
        this.bindKeyboard();
        Logger.info('Search UI initialized (Ctrl+K)');
      },
      
      createModal() {
        if (document.getElementById('nayef-search-modal')) return;
        
        const modal = document.createElement('div');
        modal.id = 'nayef-search-modal';
        modal.innerHTML = `
          <div class="nayef-search-overlay"></div>
          <div class="nayef-search-container">
            <div class="nayef-search-header">
              <span class="nayef-search-icon">🔍</span>
              <input type="text" id="nayef-search-input" placeholder="ابحث في العملاء، المنتجات، المناديب، المعاملات... (Ctrl+K)" autocomplete="off" />
              <kbd>ESC</kbd>
            </div>
            <div class="nayef-search-results" id="nayef-search-results">
              <div class="nayef-search-empty">
                <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
                <div>ابدأ بالكتابة للبحث الفوري</div>
                <div style="margin-top: 16px; font-size: 13px; opacity: 0.6;">
                  ابحث في: العملاء، المنتجات، المناديب، المعاملات، الفواتير
                </div>
              </div>
            </div>
            <div class="nayef-search-footer">
              <span><kbd>↑↓</kbd> للتنقل</span>
              <span><kbd>↵</kbd> للفتح</span>
              <span><kbd>ESC</kbd> للإغلاق</span>
            </div>
          </div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
          #nayef-search-modal {
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: none;
            font-family: -apple-system, 'Segoe UI', 'Cairo', sans-serif;
          }
          #nayef-search-modal.open { display: block; }
          .nayef-search-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
            animation: fadeIn 0.15s ease;
          }
          .nayef-search-container {
            position: relative;
            max-width: 680px;
            margin: 80px auto;
            background: #1e293b;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            overflow: hidden;
            animation: slideDown 0.2s ease;
          }
          @keyframes fadeIn { from {opacity:0;} to {opacity:1;} }
          @keyframes slideDown { from {transform:translateY(-20px); opacity:0;} to {transform:translateY(0); opacity:1;} }
          .nayef-search-header {
            display: flex;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid #334155;
            gap: 12px;
          }
          .nayef-search-icon { font-size: 20px; color: #64748b; }
          #nayef-search-input {
            flex: 1;
            background: transparent;
            border: none;
            color: #f1f5f9;
            font-size: 16px;
            outline: none;
            font-family: inherit;
          }
          #nayef-search-input::placeholder { color: #64748b; }
          .nayef-search-header kbd {
            background: #334155;
            color: #94a3b8;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-family: inherit;
          }
          .nayef-search-results {
            max-height: 480px;
            overflow-y: auto;
            padding: 8px 0;
          }
          .nayef-search-result {
            padding: 10px 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 12px;
            color: #f1f5f9;
            transition: background 0.1s;
          }
          .nayef-search-result:hover, .nayef-search-result.selected {
            background: rgba(5,150,105,0.15);
          }
          .nayef-search-result .icon {
            font-size: 20px;
            width: 32px;
            text-align: center;
          }
          .nayef-search-result .info { flex: 1; min-width: 0; }
          .nayef-search-result .title {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 2px;
          }
          .nayef-search-result .subtitle {
            font-size: 12px;
            color: #94a3b8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .nayef-search-result .badge {
            background: #334155;
            color: #94a3b8;
            padding: 2px 8px;
            border-radius: 8px;
            font-size: 11px;
          }
          .nayef-search-group {
            padding: 8px 20px 4px;
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          .nayef-search-empty {
            padding: 60px 20px;
            text-align: center;
            color: #64748b;
          }
          .nayef-search-footer {
            display: flex;
            gap: 16px;
            padding: 10px 20px;
            border-top: 1px solid #334155;
            font-size: 12px;
            color: #64748b;
          }
          .nayef-search-footer kbd {
            background: #334155;
            color: #94a3b8;
            padding: 1px 6px;
            border-radius: 3px;
            font-family: inherit;
            font-size: 10px;
          }
          .nayef-search-history-item {
            padding: 8px 20px;
            cursor: pointer;
            color: #94a3b8;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
          }
          .nayef-search-history-item:hover {
            background: rgba(5,150,105,0.1);
            color: #f1f5f9;
          }
          .nayef-search-stats {
            padding: 8px 20px;
            color: #64748b;
            font-size: 12px;
            border-top: 1px solid #334155;
            display: flex;
            justify-content: space-between;
          }
          mark {
            background: rgba(217,119,6,0.4);
            color: #fef3c7;
            padding: 0 2px;
            border-radius: 2px;
          }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
        
        // Bind events
        const input = document.getElementById('nayef-search-input');
        const overlay = modal.querySelector('.nayef-search-overlay');
        
        input.addEventListener('input', this.handleInput.bind(this));
        input.addEventListener('keydown', this.handleKeyDown.bind(this));
        overlay.addEventListener('click', this.close.bind(this));
      },
      
      bindKeyboard() {
        document.addEventListener('keydown', (e) => {
          // Ctrl+K or Cmd+K
          if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.toggle();
          }
          // ESC
          if (e.key === 'Escape' && this.isOpen) {
            this.close();
          }
        });
      },
      
      toggle() {
        if (this.isOpen) this.close();
        else this.open();
      },
      
      open() {
        const modal = document.getElementById('nayef-search-modal');
        if (!modal) return;
        modal.classList.add('open');
        this.isOpen = true;
        
        const input = document.getElementById('nayef-search-input');
        input.focus();
        input.value = '';
        this.selectedIndex = 0;
        
        // عرض التاريخ
        this.renderHistory();
      },
      
      close() {
        const modal = document.getElementById('nayef-search-modal');
        if (!modal) return;
        modal.classList.remove('open');
        this.isOpen = false;
      },
      
      handleInput(e) {
        const query = e.target.value.trim();
        this.debouncedSearch(query);
      },
      
      debouncedSearch: null,
      
      // Debounce wrapper
      debounceSearch(query) {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this.executeSearch(query);
        }, 150); // 150ms debounce
      },
      
      // استخدم debounceSearch في handleInput
      // (سنعيد تعريف handleInput)
      
      executeSearch(query) {
        if (!query) {
          this.renderHistory();
          return;
        }
        
        const result = search(query);
        this.currentResults = result.results;
        this.selectedIndex = 0;
        this.renderResults(result);
        addToHistory(query);
      },
      
      renderResults(searchResult) {
        const container = document.getElementById('nayef-search-results');
        if (!container) return;
        
        if (searchResult.results.length === 0) {
          container.innerHTML = `
            <div class="nayef-search-empty">
              <div style="font-size: 48px; margin-bottom: 12px;">😔</div>
              <div>لا توجد نتائج لـ "${this.escapeHtml(searchResult.query)}"</div>
              <div style="margin-top: 12px; font-size: 13px; opacity: 0.6;">جرب كلمات مختلفة</div>
            </div>
          `;
          return;
        }
        
        // تجميع حسب النوع
        const typeLabels = {
          customer: 'العملاء',
          product: 'المنتجات',
          agent: 'المناديب',
          transaction: 'المعاملات'
        };
        
        let html = '';
        let currentType = null;
        let globalIndex = 0;
        
        for (const item of searchResult.results) {
          if (item.type !== currentType) {
            currentType = item.type;
            html += `<div class="nayef-search-group">${typeLabels[item.type] || item.type}</div>`;
          }
          
          const highlighted = this.highlight(item.title, searchResult.query);
          const subtitle = item.subtitle ? this.highlight(item.subtitle, searchResult.query) : '';
          
          html += `
            <div class="nayef-search-result${globalIndex === this.selectedIndex ? ' selected' : ''}" 
                 data-index="${globalIndex}" data-id="${this.escapeHtml(item.id)}" data-type="${item.type}">
              <span class="icon">${item.icon}</span>
              <div class="info">
                <div class="title">${highlighted}</div>
                <div class="subtitle">${subtitle}</div>
              </div>
              <span class="badge">${Math.round(item.score)}%</span>
            </div>
          `;
          globalIndex++;
        }
        
        html += `
          <div class="nayef-search-stats">
            <span>${searchResult.total} نتيجة في ${searchResult.duration}ms</span>
            <span>بحث فوري</span>
          </div>
        `;
        
        container.innerHTML = html;
        
        // Bind click events
        container.querySelectorAll('.nayef-search-result').forEach(el => {
          el.addEventListener('click', () => {
            const index = parseInt(el.dataset.index);
            this.selectResult(index);
          });
        });
      },
      
      renderHistory() {
        const container = document.getElementById('nayef-search-results');
        if (!container) return;
        
        const history = getHistory();
        if (history.length === 0) {
          container.innerHTML = `
            <div class="nayef-search-empty">
              <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
              <div>ابدأ بالكتابة للبحث الفوري</div>
              <div style="margin-top: 16px; font-size: 13px; opacity: 0.6;">
                ابحث في: العملاء، المنتجات، المناديب، المعاملات
              </div>
            </div>
          `;
          return;
        }
        
        let html = '<div class="nayef-search-group">عمليات بحث سابقة</div>';
        history.forEach(query => {
          html += `
            <div class="nayef-search-history-item" data-query="${this.escapeHtml(query)}">
              <span>🕐</span>
              <span>${this.escapeHtml(query)}</span>
            </div>
          `;
        });
        
        container.innerHTML = html;
        
        container.querySelectorAll('.nayef-search-history-item').forEach(el => {
          el.addEventListener('click', () => {
            const input = document.getElementById('nayef-search-input');
            input.value = el.dataset.query;
            this.executeSearch(el.dataset.query);
          });
        });
      },
      
      handleKeyDown(e) {
        const container = document.getElementById('nayef-search-results');
        const items = container ? container.querySelectorAll('.nayef-search-result') : [];
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
          this.updateSelection(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.updateSelection(items);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (items.length > 0) {
            this.selectResult(this.selectedIndex);
          }
        }
      },
      
      updateSelection(items) {
        items.forEach((item, i) => {
          if (i === this.selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } else {
            item.classList.remove('selected');
          }
        });
      },
      
      selectResult(index) {
        const item = this.currentResults[index];
        if (!item) return;
        
        // تتبع البحث الناجح
        addToHistory(item.title);
        Logger.info('Search result selected', { type: item.type, id: item.id });
        
        // إغلاق الـ modal
        this.close();
        
        // محاولة الانتقال للرابط
        if (item.url && item.url !== '#') {
          // محاولة scroll to element
          const id = item.url.replace('#', '').split('-').slice(1).join('-');
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.outline = '2px solid #059669';
            setTimeout(() => el.style.outline = '', 2000);
            return;
          }
        }
        
        // عرض تفاصيل في alert (placeholder)
        alert(`${item.icon} ${item.title}\n${item.subtitle || ''}\n\nالنوع: ${item.type}`);
      },
      
      highlight(text, query) {
        if (!query || !text) return this.escapeHtml(String(text || ''));
        const escapedText = this.escapeHtml(String(text));
        const escapedQuery = this.escapeHtml(query);
        const regex = new RegExp('(' + escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return escapedText.replace(regex, '<mark>$1</mark>');
      },
      
      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
    };
    
    // Replace handleInput to use debounce
    SearchUI.handleInput = function(e) {
      this.debounceSearch(e.target.value.trim());
    };
    
    const GlobalSearch = {
      version: 'v220.9.0',
      
      search,
      fuzzyScore,
      normalizeArabic,
      buildIndex,
      invalidateCache,
      getHistory,
      addToHistory,
      clearHistory,
      UI: SearchUI,
      
      // اختبارات ذاتية
      selfTest() {
        const tests = [];
        
        // Test 1: normalize Arabic
        const n1 = normalizeArabic('أحمد');
        const n2 = normalizeArabic('احمد');
        tests.push({ name: 'تطبيع العربية', pass: n1 === n2 });
        
        // Test 2: exact match
        const s1 = fuzzyScore('أحمد', 'أحمد محمد');
        tests.push({ name: 'مطابقة كاملة', pass: s1 >= 90 });
        
        // Test 3: partial match
        const s2 = fuzzyScore('أح', 'أحمد محمد');
        tests.push({ name: 'مطابقة جزئية', pass: s2 >= 70 });
        
        // Test 4: no match
        const s3 = fuzzyScore('xyz', 'أحمد محمد');
        tests.push({ name: 'عدم مطابقة', pass: s3 === 0 });
        
        // Test 5: case insensitive
        const s4 = fuzzyScore('AHMED', 'ahmed');
        tests.push({ name: 'غير حساس للحالة', pass: s4 >= 90 });
        
        // Test 6: search with empty data
        const oldO = window.O;
        window.O = {};
        const r1 = search('test');
        window.O = oldO;
        tests.push({ name: 'بحث في بيانات فارغة', pass: r1.results.length === 0 });
        
        // Test 7: search with data
        window.O = {
          soc: [{ nm: 'أحمد محمد', phone: '123' }],
          it: [{ nm: 'زيت زيتون', price: 10 }],
          mon: [],
          tx: [{ client: 'أحمد', amount: 100, dt: '2024-01-01', tp: 'sale' }]
        };
        invalidateCache();
        const r2 = search('أحمد');
        window.O = oldO;
        tests.push({ name: 'بحث في عملاء', pass: r2.results.length > 0 });
        
        // Test 8: history
        clearHistory();
        addToHistory('test1');
        addToHistory('test2');
        const h = getHistory();
        tests.push({ name: 'تاريخ البحث', pass: h.length === 2 && h[0] === 'test2' });
        
        // Test 9: history limit
        clearHistory();
        for (let i = 0; i < 15; i++) addToHistory('q' + i);
        tests.push({ name: 'حد التاريخ', pass: getHistory().length === 10 });
        
        // Test 10: indexed types
        invalidateCache();
        window.O = {
          soc: [{ nm: 'عميل 1' }],
          it: [{ nm: 'منتج 1' }],
          mon: [{ nm: 'مندوب 1' }],
          tx: []
        };
        const idx = buildIndex();
        const types = [...new Set(idx.map(i => i.type))];
        window.O = oldO;
        tests.push({ name: 'فهرسة كل الأنواع', pass: types.includes('customer') && types.includes('product') && types.includes('agent') });
        
        // Test 11: score sorting
        window.O = {
          soc: [
            { nm: 'أحمد' },
            { nm: 'محمد أحمد علي' },
            { nm: 'علي' }
          ]
        };
        invalidateCache();
        const r3 = search('أحمد');
        window.O = oldO;
        tests.push({ name: 'ترتيب حسب الملاءمة', pass: r3.results[0].data.nm === 'أحمد' });
        
        clearHistory();
        return tests;
      }
    };
    
    window.GlobalSearch = GlobalSearch;
    
    // تهيئة الـ UI تلقائياً عند تحميل الصفحة
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => SearchUI.init());
    } else {
      setTimeout(() => SearchUI.init(), 100);
    }
    
    if (NAYEF_ENV.isDev) {
      Logger.info('GlobalSearch ready [Ctrl+K to activate]');
    }
  })();
  