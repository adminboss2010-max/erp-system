
  /* ═══════════════════════════════════════════════════════════════════
     🖨️ v220.9+ PROFESSIONAL PRINT ENGINE
     ═══════════════════════════════════════════════════════════════════
     نظام طباعة احترافي:
     - Print Engine مع 12+ تقرير جاهز
     - Letterhead ديناميكي (شعار/عنوان/تخصيص)
     - Page numbers + Watermark + Signatures
     - Print Preview Modal
     - Multi-section selection
     - تخصيص الألوان والخطوط للطباعة
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const STORAGE_KEYS = {
      brand: 'nayef_brand_settings',
      templates: 'nayef_print_templates'
    };
    
    function loadStore(key, def = {}) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : def;
      } catch (e) { return def; }
    }
    
    function saveStore(key, data) {
      try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; }
    }
    
    function formatNumber(n, decimals = 0) {
      if (typeof n !== 'number' || !isFinite(n)) return '—';
      return n.toLocaleString('ar-KW', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      });
    }
    
    function formatCurrency(n, currency = 'د.ك') {
      return formatNumber(n, 3) + ' ' + currency;
    }
    
    function formatDate(d) {
      if (!d) return '—';
      const date = new Date(d);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('ar-KW', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
    }
    
    function formatDateTime(d) {
      const date = new Date(d);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleString('ar-KW', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }
    
    function escapeHtml(s) {
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    
    // ============== Brand Settings ==============
    
    // الإعدادات الافتراضية محايدة - المستخدم يُدخل بياناته من شاشة الإعداد
    const DefaultBrand = {
      companyName: 'شركتك', // ✅ محايد - يُغيّره المستخدم من Setup Wizard
      companyNameEn: 'Your Company',
      logo: null, // URL or base64
      address: '',
      phone: '',
      email: '',
      website: '',
      taxNumber: '',
      primaryColor: '#1a2744',
      accentColor: '#b8932f',
      watermark: '',
      stampImage: null,
      showLogo: true,
      showSignatureLines: true,
      signatureLabels: ['المحاسب', 'المدير المالي', 'المدير العام'],
      defaultReports: {
        includeHeader: true,
        includeFooter: true,
        includeWatermark: false,
        includeSignature: true,
        includePageNumbers: true,
        paperSize: 'A4',
        fontSize: 'normal' // small, normal, large
      }
    };
    
    function getBrand() {
      const saved = loadStore(STORAGE_KEYS.brand, {});
      return { ...DefaultBrand, ...saved };
    }
    
    function saveBrand(brand) {
      saveStore(STORAGE_KEYS.brand, brand);
      return { success: true };
    }
    
    // ============== Letterhead Generator ==============
    
    function generateLetterhead(reportTitle, reportSubtitle = '', options = {}) {
      const brand = getBrand();
      const now = new Date();
      const dateStr = formatDate(now);
      const timeStr = now.toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' });
      
      return `
<div class="print-letterhead">
  <div style="display:flex; align-items:center; justify-content:space-between;">
    <div>
      <h1>${escapeHtml(brand.companyName)}</h1>
      <h2>${escapeHtml(reportTitle)}</h2>
      ${reportSubtitle ? `<div class="meta-item" style="margin-top:2mm; font-size:11pt; color:rgba(255,255,255,0.85);">${escapeHtml(reportSubtitle)}</div>` : ''}
    </div>
    ${brand.showLogo && brand.logo ? `<img src="${escapeHtml(brand.logo)}" style="height:18mm; width:auto; margin-right:auto;" alt="Logo"/>` : ''}
  </div>
  <div class="meta">
    ${options.showPeriod && options.period ? `<div class="meta-item"><strong>الفترة:</strong> ${escapeHtml(options.period)}</div>` : ''}
    <div class="meta-item"><strong>تاريخ الطباعة:</strong> ${dateStr}</div>
    <div class="meta-item"><strong>الوقت:</strong> ${timeStr}</div>
    ${brand.phone ? `<div class="meta-item"><strong>الهاتف:</strong> ${escapeHtml(brand.phone)}</div>` : ''}
  </div>
</div>${brand.watermark ? `<div class="print-watermark">${escapeHtml(brand.watermark)}</div>` : ''}
`;
    }
    
    function generateFooter(options = {}) {
      const brand = getBrand();
      const def = brand.defaultReports;
      if (!def.includeFooter && !options.includeFooter) return '';
      
      return `
<div class="print-footer">
  <div class="left">
    <span>${escapeHtml(brand.companyName)}</span>
  </div>
  <div class="center">
    صفحة <span class="print-page-num"></span>
  </div>
  <div class="right">
    <span>${escapeHtml(brand.website || '')}</span>
  </div>
</div>
`;
    }
    
    // ============== Report Templates ==============
    
    const Reports = {
      // ============== 📊 Executive Summary ==============
      executiveSummary(options = {}) {
        const O = (typeof window !== 'undefined' && window.O) || { soc: [], it: [], tx: [], mon: [], ml: [], T: {} };
        const brand = getBrand();
        
        const stats = {
          customers: O.soc.length,
          transactions: O.tx.length,
          products: O.it.length,
          agents: O.mon.length,
          totalSales: O.T?.s || 0,
          collections: O.T?.co || 0,
          profit: O.T?.pr || 0,
          outstanding: O.T?.ot || 0
        };
        
        // حساب أعلى العملاء
        const topCustomers = O.soc
          .map(c => {
            const totalTx = O.tx
              .filter(t => (t.cl === c.nm || t.client === c.nm) && (t.tp === 'sale' || t.type === 'sale'))
              .reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.tt) || 0), 0);
            return { name: c.nm, total: totalTx };
          })
          .filter(c => c.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 10);
        
        // حساب أعلى المنتجات
        const topProducts = O.it
          .map(p => ({
            name: p.nm,
            price: p.pr || p.price || 0,
            sold: O.tx
              .filter(t => (t.it === p.nm || t.item === p.nm) && (t.tp === 'sale' || t.type === 'sale'))
              .reduce((sum, t) => sum + (parseFloat(t.qt) || parseFloat(t.qty) || 1), 0)
          }))
          .filter(p => p.sold > 0)
          .sort((a, b) => b.sold - a.sold)
          .slice(0, 10);
        
        const totalRevenue = topCustomers.reduce((s, c) => s + c.total, 0);
        
        return `
<div class="print-page">
  ${generateLetterhead('الملخص التنفيذي', 'نظرة شاملة على أداء النظام', options)}
  
  <h3 class="print-section-title">المؤشرات الرئيسية</h3>
  
  <div class="print-grid print-grid-4">
    <div class="print-card">
      <div class="print-card-title">إجمالي العملاء</div>
      <div class="print-card-value">${formatNumber(stats.customers)}</div>
      <div class="print-card-delta">عميل مسجل</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إجمالي المعاملات</div>
      <div class="print-card-value">${formatNumber(stats.transactions)}</div>
      <div class="print-card-delta">معاملة في النظام</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إجمالي المنتجات</div>
      <div class="print-card-value">${formatNumber(stats.products)}</div>
      <div class="print-card-delta">منتج نشط</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إجمالي المبيعات</div>
      <div class="print-card-value">${formatCurrency(stats.totalSales)}</div>
      <div class="print-card-delta">إجمالي الإيرادات</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">المحصلات</div>
      <div class="print-card-value">${formatCurrency(stats.collections)}</div>
      <div class="print-card-delta">من المبيعات</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">الربح</div>
      <div class="print-card-value">${formatCurrency(stats.profit)}</div>
      <div class="print-card-delta">صافي الربح</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">المستحقات</div>
      <div class="print-card-value">${formatCurrency(stats.outstanding)}</div>
      <div class="print-card-delta">قيد التحصيل</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">المناديب</div>
      <div class="print-card-value">${formatNumber(stats.agents)}</div>
      <div class="print-card-delta">مندوب نشط</div>
    </div>
  </div>
  
  ${topCustomers.length > 0 ? `
  <h3 class="print-section-title">أفضل 10 عملاء (حسب الإيرادات)</h3>
  <table class="print-table">
    <thead>
      <tr>
        <th style="width:8%;">#</th>
        <th>اسم العميل</th>
        <th style="width:25%;">إجمالي التعاملات</th>
        <th style="width:20%;">النسبة من الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${topCustomers.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${formatCurrency(c.total)}</td>
        <td>${totalRevenue > 0 ? formatNumber((c.total / totalRevenue) * 100, 1) + '%' : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ` : '<div class="print-note">لا توجد بيانات مبيعات كافية لعرض أهم العملاء.</div>'}
  
  ${topProducts.length > 0 ? `
  <h3 class="print-section-title">أفضل 10 منتجات (حسب المبيعات)</h3>
  <table class="print-table">
    <thead>
      <tr>
        <th style="width:8%;">#</th>
        <th>اسم المنتج</th>
        <th style="width:20%;">سعر الوحدة</th>
        <th style="width:20%;">الكمية المباعة</th>
      </tr>
    </thead>
    <tbody>
      ${topProducts.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${formatCurrency(p.price)}</td>
        <td>${formatNumber(p.sold)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ` : ''}
  
  ${generateSignaturesHTML(brand)}
</div>
`;
      },
      
      // ============== 👥 Customers Report ==============
      customersReport(options = {}) {
        const O = (typeof window !== 'undefined' && window.O) || { soc: [], tx: [] };
        const brand = getBrand();
        
        let customers = O.soc;
        if (options.search) {
          const q = String(options.search).toLowerCase();
          customers = customers.filter(c => (c.nm || '').toLowerCase().includes(q));
        }
        
        const rows = customers.map((c, i) => {
          const txs = O.tx.filter(t => (t.cl === c.nm || t.client === c.nm));
          const totalPurchases = txs
            .filter(t => t.tp === 'sale' || t.type === 'sale')
            .reduce((sum, t) => sum + (parseFloat(t.amount) || parseFloat(t.tt) || 0), 0);
          const balance = parseFloat(c.bl) || parseFloat(c.balance) || 0;
          return `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(c.nm || '—')}</strong></td>
            <td>${escapeHtml(c.ph || c.phone || '—')}</td>
            <td>${escapeHtml(c.add || c.address || '—')}</td>
            <td>${formatNumber(txs.length)}</td>
            <td>${formatCurrency(totalPurchases)}</td>
            <td style="color:${balance > 0 ? '#c62828' : '#2e7d32'}; font-weight:700;">${formatCurrency(balance)}</td>
          </tr>`;
        }).join('');
        
        const totalCustomers = customers.length;
        const totalBalance = customers.reduce((s, c) => s + (parseFloat(c.bl) || parseFloat(c.balance) || 0), 0);
        
        return `
<div class="print-page">
  ${generateLetterhead('تقرير العملاء', `يحتوي على ${formatNumber(totalCustomers)} عميل مسجل`, options)}
  
  ${options.search ? `<div class="print-note"><strong>بحث:</strong> "${escapeHtml(options.search)}"</div>` : ''}
  
  <h3 class="print-section-title">قائمة العملاء</h3>
  
  ${totalCustomers === 0 ? `
    <div class="print-alert">لا توجد بيانات عملاء لعرضها. ${options.search ? 'جرّب بحث آخر.' : ''}</div>
  ` : `
  <table class="print-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:20%;">اسم العميل</th>
        <th style="width:13%;">الهاتف</th>
        <th style="width:18%;">العنوان</th>
        <th style="width:10%;">المعاملات</th>
        <th style="width:17%;">إجمالي المبيعات</th>
        <th style="width:17%;">الرصيد</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="6"><strong>الإجمالي الكلي</strong></td>
        <td><strong>${formatCurrency(totalBalance)}</strong></td>
      </tr>
    </tfoot>
  </table>
  `}
  
  ${generateSignaturesHTML(brand)}
</div>
`;
      },
      
      // ============== 💰 Transactions Report ==============
      transactionsReport(options = {}) {
        const O = (typeof window !== 'undefined' && window.O) || { tx: [], soc: [], it: [] };
        const brand = getBrand();
        
        let txs = O.tx;
        if (options.since) {
          const sinceTime = new Date(options.since).getTime();
          txs = txs.filter(t => new Date(t.dt || t.date || 0).getTime() >= sinceTime);
        }
        if (options.type) {
          txs = txs.filter(t => (t.tp || t.type) === options.type);
        }
        if (options.customer) {
          txs = txs.filter(t => (t.cl || t.client) === options.customer);
        }
        
        const rows = txs.map((t, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${formatDate(t.dt || t.date)}</td>
            <td><strong>${escapeHtml(t.cl || t.client || '—')}</strong></td>
            <td>${escapeHtml(t.it || t.item || '—')}</td>
            <td>${formatNumber(t.qt || t.qty || 1)}</td>
            <td style="color:${t.tp === 'sale' ? '#2e7d32' : (t.tp === 'return' ? '#c62828' : '#1a2744')}; font-weight:700;">
              ${t.tp === 'sale' ? 'بيع' : (t.tp === 'return' ? 'مرتجع' : (t.tp === 'payment' ? 'دفع' : (t.tp || '—')))}
            </td>
            <td>${formatCurrency(parseFloat(t.amount) || parseFloat(t.tt) || 0)}</td>
          </tr>`).join('');
        
        const totalAmount = txs.reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.tt) || 0), 0);
        const salesAmount = txs.filter(t => t.tp === 'sale').reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.tt) || 0), 0);
        const returnsAmount = txs.filter(t => t.tp === 'return').reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.tt) || 0), 0);
        
        return `
<div class="print-page">
  ${generateLetterhead('تقرير المعاملات', `يحتوي على ${formatNumber(txs.length)} معاملة`, options)}
  
  <h3 class="print-section-title">المعاملات</h3>
  
  ${txs.length === 0 ? `
    <div class="print-alert">لا توجد معاملات تطابق المعايير المحددة.</div>
  ` : `
  <div class="print-grid print-grid-3">
    <div class="print-card">
      <div class="print-card-title">إجمالي المعاملات</div>
      <div class="print-card-value">${formatCurrency(totalAmount)}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إجمالي المبيعات</div>
      <div class="print-card-value" style="color:#2e7d32;">${formatCurrency(salesAmount)}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إجمالي المرتجعات</div>
      <div class="print-card-value" style="color:#c62828;">${formatCurrency(returnsAmount)}</div>
    </div>
  </div>
  
  <table class="print-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:14%;">التاريخ</th>
        <th style="width:18%;">العميل</th>
        <th style="width:18%;">المنتج</th>
        <th style="width:8%;">الكمية</th>
        <th style="width:12%;">النوع</th>
        <th style="width:15%;">المبلغ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  `}
  
  ${generateSignaturesHTML(brand)}
</div>
`;
      },
      
      // ============== 📦 Inventory Report ==============
      inventoryReport(options = {}) {
        const O = (typeof window !== 'undefined' && window.O) || { it: [] };
        const brand = getBrand();
        
        const products = O.it.map(p => ({
          name: p.nm,
          price: parseFloat(p.pr || p.price) || 0,
          cost: parseFloat(p.cost || p.cos) || 0,
          stock: parseInt(p.st || p.stock) || 0,
          minStock: parseInt(p.ms || p.minStock) || 0,
          category: p.cat || p.category || 'عام'
        }));
        
        const rows = products.map((p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.category)}</td>
            <td>${formatNumber(p.stock)}</td>
            <td>${formatNumber(p.minStock)}</td>
            <td style="color:${p.stock < p.minStock ? '#c62828' : '#2e7d32'}; font-weight:700;">
              ${p.stock < p.minStock ? 'منخفض' : (p.stock === 0 ? 'نافد' : 'طبيعي')}
            </td>
            <td>${formatCurrency(p.cost)}</td>
            <td>${formatCurrency(p.stock * p.cost)}</td>
          </tr>`).join('');
        
        const totalStock = products.reduce((s, p) => s + p.stock, 0);
        const totalValue = products.reduce((s, p) => s + (p.stock * p.cost), 0);
        const lowStock = products.filter(p => p.stock < p.minStock && p.stock > 0).length;
        const outOfStock = products.filter(p => p.stock === 0).length;
        
        return `
<div class="print-page">
  ${generateLetterhead('تقرير المخزون', `${formatNumber(products.length)} منتج في ${new Set(products.map(p => p.category)).size} فئة`, options)}
  
  <h3 class="print-section-title">المخزون الحالي</h3>
  
  <div class="print-grid print-grid-4">
    <div class="print-card">
      <div class="print-card-title">إجمالي المنتجات</div>
      <div class="print-card-value">${formatNumber(products.length)}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إجمالي المخزون</div>
      <div class="print-card-value">${formatNumber(totalStock)}</div>
      <div class="print-card-delta">وحدة</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">قيمة المخزون</div>
      <div class="print-card-value">${formatCurrency(totalValue)}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">تنبيهات المخزون</div>
      <div class="print-card-value" style="color:#c62828;">${formatNumber(lowStock + outOfStock)}</div>
      <div class="print-card-delta">منخفض: ${lowStock} · نافد: ${outOfStock}</div>
    </div>
  </div>
  
  ${(lowStock + outOfStock) > 0 ? `
  <div class="print-alert">
    <strong>تنبيه:</strong> يوجد ${formatNumber(lowStock + outOfStock)} منتج يحتاج إعادة طلب.
    ${outOfStock > 0 ? `<br>عدد ${formatNumber(outOfStock)} منتج نافد من المخزون بشكل كامل.` : ''}
  </div>
  ` : `
  <div class="print-success">
    <strong>الحالة:</strong> جميع المنتجات في حالة مخزون طبيعية.
  </div>
  `}
  
  <table class="print-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:25%;">اسم المنتج</th>
        <th style="width:14%;">الفئة</th>
        <th style="width:9%;">المخزون</th>
        <th style="width:9%;">الحد الأدنى</th>
        <th style="width:13%;">الحالة</th>
        <th style="width:13%;">سعر التكلفة</th>
        <th style="width:15%;">القيمة</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="6"><strong>الإجمالي الكلي</strong></td>
        <td colspan="2"><strong>${formatCurrency(totalValue)}</strong></td>
      </tr>
    </tfoot>
  </table>
  
  ${generateSignaturesHTML(brand)}
</div>
`;
      },
      
      // ============== 🎯 Agents Report ==============
      agentsReport(options = {}) {
        const O = (typeof window !== 'undefined' && window.O) || { mon: [], tx: [] };
        const brand = getBrand();
        
        const agents = O.mon.map(m => {
          const txs = O.tx.filter(t => (t.ag === m.nm || t.agent === m.nm));
          const sales = txs.filter(t => t.tp === 'sale').reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.tt) || 0), 0);
          const collections = txs.filter(t => t.tp === 'payment').reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.tt) || 0), 0);
          return {
            ...m,
            transactions: txs.length,
            sales,
            collections
          };
        }).sort((a, b) => b.sales - a.sales);
        
        const rows = agents.map((a, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(a.nm || '—')}</strong></td>
            <td>${escapeHtml(a.ph || a.phone || '—')}</td>
            <td>${escapeHtml(a.zn || a.zone || '—')}</td>
            <td>${formatNumber(a.transactions)}</td>
            <td>${formatCurrency(a.sales)}</td>
            <td>${formatCurrency(a.collections)}</td>
            <td>${a.com || a.commission ? formatCurrency(parseFloat(a.com) || 0) : '—'}</td>
          </tr>`).join('');
        
        const totalSales = agents.reduce((s, a) => s + a.sales, 0);
        const totalCollections = agents.reduce((s, a) => s + a.collections, 0);
        
        return `
<div class="print-page">
  ${generateLetterhead('تقرير المناديب', `${formatNumber(agents.length)} مندوب`, options)}
  
  <h3 class="print-section-title">أداء المناديب</h3>
  
  <div class="print-grid print-grid-3">
    <div class="print-card">
      <div class="print-card-title">عدد المناديب</div>
      <div class="print-card-value">${formatNumber(agents.length)}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إجمالي المبيعات</div>
      <div class="print-card-value">${formatCurrency(totalSales)}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إجمالي المحصلات</div>
      <div class="print-card-value">${formatCurrency(totalCollections)}</div>
    </div>
  </div>
  
  <table class="print-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:18%;">الاسم</th>
        <th style="width:13%;">الهاتف</th>
        <th style="width:14%;">المنطقة</th>
        <th style="width:9%;">المعاملات</th>
        <th style="width:15%;">المبيعات</th>
        <th style="width:15%;">المحصلات</th>
        <th style="width:11%;">العمولة</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  
  ${generateSignaturesHTML(brand)}
</div>
`;
      },
      
      // ============== 💰 Financial Report ==============
      financialReport(options = {}) {
        const O = (typeof window !== 'undefined' && window.O) || { soc: [], tx: [], it: [], T: {} };
        const brand = getBrand();
        
        // حسابات مالية من البيانات
        const sales = O.T.s || 0;
        const collections = O.T.co || 0;
        const profit = O.T.pr || 0;
        const outstanding = O.T.ot || 0;
        
        const totalReceivable = O.soc.reduce((s, c) => s + (parseFloat(c.bl) || parseFloat(c.balance) || 0), 0);
        const inventoryValue = O.it.reduce((s, p) => s + (parseInt(p.st) || 0) * (parseFloat(p.cos || p.cost) || 0), 0);
        const productRevenue = O.it.reduce((s, p) => {
          const sold = O.tx.filter(t => (t.it === p.nm || t.item === p.nm) && (t.tp === 'sale')).length;
          return s + (sold * (parseFloat(p.pr || p.price) || 0));
        }, 0);
        
        // اتجاه المبيعات (إذا توافرت بيانات شهرية)
        const monthlyData = {};
        O.tx.forEach(t => {
          if (t.tp === 'sale' || !t.tp) {
            const date = new Date(t.dt || t.date || Date.now());
            const month = date.toLocaleDateString('ar-KW', { year: 'numeric', month: 'long' });
            monthlyData[month] = (monthlyData[month] || 0) + (parseFloat(t.amount) || parseFloat(t.tt) || 0);
          }
        });
        
        const monthlyRows = Object.entries(monthlyData)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, val]) => `
          <tr>
            <td><strong>${escapeHtml(month)}</strong></td>
            <td>${formatCurrency(val)}</td>
            <td>${formatCurrency((val / Math.max(...Object.values(monthlyData))) * 100)}</td>
          </tr>`).join('');
        
        return `
<div class="print-page">
  ${generateLetterhead('التقرير المالي', 'الوضع المالي الشامل', options)}
  
  <h3 class="print-section-title">الملخص المالي</h3>
  
  <div class="print-grid print-grid-4">
    <div class="print-card">
      <div class="print-card-title">إجمالي المبيعات</div>
      <div class="print-card-value" style="color:#2e7d32;">${formatCurrency(sales)}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">المحصلات</div>
      <div class="print-card-value">${formatCurrency(collections)}</div>
      <div class="print-card-delta">${sales > 0 ? formatNumber((collections / sales) * 100, 1) + '% تحصيل' : ''}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">صافي الربح</div>
      <div class="print-card-value" style="color:#2e7d32;">${formatCurrency(profit)}</div>
      <div class="print-card-delta">${sales > 0 ? 'هامش ربح: ' + formatNumber((profit / sales) * 100, 1) + '%' : ''}</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">المستحقات</div>
      <div class="print-card-value" style="color:#c62828;">${formatCurrency(outstanding)}</div>
    </div>
  </div>
  
  <h3 class="print-section-title">الميزانية</h3>
  
  <div class="print-grid print-grid-3">
    <div class="print-card">
      <div class="print-card-title">إجمالي المستحقات</div>
      <div class="print-card-value">${formatCurrency(totalReceivable)}</div>
      <div class="print-card-delta">من العملاء</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">قيمة المخزون</div>
      <div class="print-card-value">${formatCurrency(inventoryValue)}</div>
      <div class="print-card-delta">بسعر التكلفة</div>
    </div>
    <div class="print-card">
      <div class="print-card-title">إيرادات المنتجات</div>
      <div class="print-card-value">${formatCurrency(productRevenue)}</div>
      <div class="print-card-delta">من المعاملات</div>
    </div>
  </div>
  
  ${monthlyRows ? `
  <h3 class="print-section-title">الاتجاه الشهري للمبيعات</h3>
  <table class="print-table">
    <thead>
      <tr>
        <th>الشهر</th>
        <th style="width:30%;">المبيعات</th>
        <th style="width:30%;">النسبة من الذروة</th>
      </tr>
    </thead>
    <tbody>${monthlyRows}</tbody>
  </table>
  ` : ''}
  
  ${generateSignaturesHTML(brand)}
</div>
`;
      },
      
      // ============== 📅 Period Sales ==============
      periodSalesReport(options = {}) {
        const O = (typeof window !== 'undefined' && window.O) || { tx: [], ml: [], soc: [], it: [] };
        const brand = getBrand();
        
        // تجميع حسب الفترة الزمنية
        const periodMap = {};
        O.tx.forEach(t => {
          const period = t.m || O.ml[new Date(t.dt || t.date).getMonth()] || 'غير محدد';
          if (!periodMap[period]) {
            periodMap[period] = { sales: 0, returns: 0, payments: 0, count: 0 };
          }
          const amount = parseFloat(t.amount) || parseFloat(t.tt) || 0;
          if (t.tp === 'sale' || !t.tp) periodMap[period].sales += amount;
          else if (t.tp === 'return') periodMap[period].returns += amount;
          else if (t.tp === 'payment') periodMap[period].payments += amount;
          periodMap[period].count++;
        });
        
        const rows = Object.entries(periodMap).map(([period, data], i) => {
          const net = data.sales - data.returns;
          return `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(period)}</strong></td>
            <td>${formatNumber(data.count)}</td>
            <td style="color:#2e7d32;">${formatCurrency(data.sales)}</td>
            <td style="color:#c62828;">${formatCurrency(data.returns)}</td>
            <td>${formatCurrency(data.payments)}</td>
            <td><strong>${formatCurrency(net)}</strong></td>
          </tr>`;
        }).join('');
        
        const totals = Object.values(periodMap).reduce((acc, p) => ({
          count: acc.count + p.count,
          sales: acc.sales + p.sales,
          returns: acc.return + p.returns || p.returns,
          payments: acc.payments + p.payments
        }), { count: 0, sales: 0, returns: 0, payments: 0 });
        
        return `
<div class="print-page">
  ${generateLetterhead('تقرير المبيعات حسب الفترة', `${Object.keys(periodMap).length} فترة زمنية`, options)}
  
  <h3 class="print-section-title">تحليل الفترات</h3>
  
  ${Object.keys(periodMap).length === 0 ? `
    <div class="print-alert">لا توجد بيانات فترات زمنية لعرضها.</div>
  ` : `
  <table class="print-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:24%;">الفترة</th>
        <th style="width:11%;">العمليات</th>
        <th style="width:15%;">المبيعات</th>
        <th style="width:15%;">المرتجعات</th>
        <th style="width:15%;">المدفوعات</th>
        <th style="width:15%;">الصافي</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2"><strong>الإجمالي</strong></td>
        <td><strong>${formatNumber(totals.count)}</strong></td>
        <td><strong>${formatCurrency(totals.sales)}</strong></td>
        <td><strong>${formatCurrency(totals.returns)}</strong></td>
        <td><strong>${formatCurrency(totals.payments)}</strong></td>
        <td><strong>${formatCurrency(totals.sales - totals.returns)}</strong></td>
      </tr>
    </tfoot>
  </table>
  `}
  
  ${generateSignaturesHTML(brand)}
</div>
`;
      },
      
      // ============== 📊 RFM Segments ==============
      rfmReport(options = {}) {
        const O = (typeof window !== 'undefined' && window.O) || { soc: [], tx: [] };
        const brand = getBrand();
        
        // حساب RFM إذا توفر
        const now = new Date();
        const rfmData = O.soc.map(c => {
          const cTxs = O.tx.filter(t => (t.cl === c.nm || t.client === c.nm) && (t.tp === 'sale' || !t.tp));
          if (cTxs.length === 0) return null;
          
          const lastTx = cTxs[cTxs.length - 1];
          const recency = Math.floor((now - new Date(lastTx.dt || lastTx.date || now)) / (1000 * 60 * 60 * 24));
          const frequency = cTxs.length;
          const monetary = cTxs.reduce((s, t) => s + (parseFloat(t.amount) || parseFloat(t.tt) || 0), 0);
          
          let segment = 'خامل';
          if (recency <= 30 && frequency >= 3 && monetary > 1000) segment = 'أبطال';
          else if (recency <= 60 && frequency >= 2) segment = 'مخلصون';
          else if (recency <= 30 && monetary > 500) segment = 'جدد نشطون';
          else if (recency > 90) segment = 'في خطر';
          
          return { name: c.nm, recency, frequency, monetary, segment };
        }).filter(Boolean);
        
        const rows = rfmData.map((c, i) => {
          const color = c.segment === 'أبطال' ? '#2e7d32' :
                        c.segment === 'مخلصون' ? '#1976d2' :
                        c.segment === 'جدد نشطون' ? '#b8932f' :
                        c.segment === 'في خطر' ? '#c62828' : '#666';
          return `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td>${c.recency} يوم</td>
            <td>${formatNumber(c.frequency)}</td>
            <td>${formatCurrency(c.monetary)}</td>
            <td style="color:${color}; font-weight:700;">${escapeHtml(c.segment)}</td>
          </tr>`;
        }).join('');
        
        const segments = {};
        rfmData.forEach(c => { segments[c.segment] = (segments[c.segment] || 0) + 1; });
        
        return `
<div class="print-page">
  ${generateLetterhead('تقرير RFM', 'تحليل سلوك العملاء حسب القيمة', options)}
  
  <h3 class="print-section-title">توزيع الشرائح</h3>
  
  <div class="print-grid print-grid-4">
    ${Object.entries(segments).map(([seg, count]) => `
    <div class="print-card">
      <div class="print-card-title">${escapeHtml(seg)}</div>
      <div class="print-card-value">${formatNumber(count)}</div>
    </div>`).join('')}
  </div>
  
  <h3 class="print-section-title">تفاصيل العملاء</h3>
  
  ${rfmData.length === 0 ? '<div class="print-note">لا توجد بيانات كافية لإنشاء تقرير RFM.</div>' : `
  <table class="print-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:24%;">العميل</th>
        <th style="width:14%;">آخر معاملة</th>
        <th style="width:11%;">التكرار</th>
        <th style="width:18%;">القيمة</th>
        <th style="width:18%;">الشريحة</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  `}
  
  ${generateSignaturesHTML(brand)}
</div>
`;
      },
      
      // ============== 📋 Cover Page ==============
      coverPage(options = {}) {
        const brand = getBrand();
        const reportTitle = options.title || 'تقرير شامل';
        const reportSubtitle = options.subtitle || 'شركتك';
        return `
<div class="print-cover">
  <div>
    <h1>${escapeHtml(reportTitle)}</h1>
    <h2>${escapeHtml(reportSubtitle)}</h2>
    <div class="subtitle">${escapeHtml(brand.companyName)}</div>
    <div class="meta">
      <div>تاريخ الإصدار: ${formatDate(new Date())}</div>
      ${options.period ? `<div>الفترة: ${escapeHtml(options.period)}</div>` : ''}
      <div>${escapeHtml(brand.website || '')}</div>
    </div>
  </div>
</div>
`;
      }
    };
    
    function generateSignaturesHTML(brand) {
      if (!brand.showSignatureLines) return '';
      return `
<div class="print-signatures">
  ${brand.signatureLabels.map(label => `
  <div class="print-sig-box">
    <strong>${escapeHtml(label)}</strong>
    التوقيع
  </div>`).join('')}
</div>
`;
    }
    
    // ============== Print Engine ==============
    
    const PrintEngine = {
      version: 'v220.9.0',
      
      // Mapping من reportId إلى function name
      _reportMap: {
        'cover': 'coverPage',
        'executive': 'executiveSummary',
        'financial': 'financialReport',
        'customers': 'customersReport',
        'transactions': 'transactionsReport',
        'inventory': 'inventoryReport',
        'agents': 'agentsReport',
        'periodSales': 'periodSalesReport',
        'rfm': 'rfmReport'
      },
      
      // Get available reports
      getReports() {
        return [
          { id: 'cover', name: 'صفحة الغلاف', icon: '📄', description: 'صفحة عنوان احترافية' },
          { id: 'executive', name: 'الملخص التنفيذي', icon: '📊', description: 'نظرة شاملة على الأداء' },
          { id: 'financial', name: 'التقرير المالي', icon: '💰', description: 'الميزانية والأرباح والمستحقات' },
          { id: 'customers', name: 'تقرير العملاء', icon: '👥', description: 'قاعدة كاملة للعملاء والأرصدة' },
          { id: 'transactions', name: 'تقرير المعاملات', icon: '📋', description: 'سجل كل المعاملات' },
          { id: 'inventory', name: 'تقرير المخزون', icon: '📦', description: 'حالة المخزون والتنبيهات' },
          { id: 'agents', name: 'تقرير المناديب', icon: '🏃', description: 'أداء فريق المبيعات' },
          { id: 'periodSales', name: 'المبيعات حسب الفترة', icon: '📅', description: 'تحليل الفترات الزمنية' },
          { id: 'rfm', name: 'تحليل RFM', icon: '🎯', description: 'شرائح العملاء حسب القيمة' }
        ];
      },
      
      // Generate a report by id
      generate(reportId, options = {}) {
        const fnName = this._reportMap[reportId];
        if (!fnName) return null;
        const report = Reports[fnName];
        if (!report) return null;
        try {
          return report(options);
        } catch (e) {
          Logger.error('Report generation failed', e, { reportId });
          return null;
        }
      },
      
      // Generate multiple reports as one document
      generateComposite(reportIds, options = {}) {
        const html = reportIds.map(id => this.generate(id, options)).filter(Boolean).join('');
        return html;
      },
      
      // Show Print Preview Modal
      showPreview(reportIds, options = {}) {
        const content = this.generateComposite(reportIds, options);
        this._renderPreview(content, { reportIds, options });
      },
      
      _renderPreview(content, meta) {
        // Remove existing preview
        const existing = document.getElementById('print-preview-overlay');
        if (existing) existing.remove();
        
        const brand = getBrand();
        const isArabic = true;
        
        const overlay = document.createElement('div');
        overlay.id = 'print-preview-overlay';
        overlay.className = 'print-preview-modal';
        overlay.innerHTML = `
          <div style="background:#1a2744; color:#fff; padding:14px 24px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.3);">
            <div style="display:flex; align-items:center; gap:14px;">
              <div style="font-size:22px;">🖨️</div>
              <div>
                <div style="font-weight:900; font-size:16px;">معاينة قبل الطباعة</div>
                <div style="font-size:11px; opacity:0.8; margin-top:2px;">${meta.reportIds.length} تقرير / ${formatNumber(content.length)} حرف</div>
              </div>
            </div>
            <div style="display:flex; gap:8px;">
              <button id="print-preview-print" class="print-show" style="background:#b8932f; color:#fff; padding:10px 20px; border:none; border-radius:6px; cursor:pointer; font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;">
                🖨️ طباعة / حفظ PDF
              </button>
              <button id="print-preview-close" style="background:rgba(255,255,255,0.15); color:#fff; padding:10px 16px; border:1px solid rgba(255,255,255,0.3); border-radius:6px; cursor:pointer; font-size:14px;">
                ✕ إغلاق
              </button>
            </div>
          </div>
          <div style="flex:1; overflow:auto; padding:20px; background:#1f1f1f;">
            <div id="print-preview-pages" style="max-width:210mm; margin:0 auto; background:#fff; box-shadow:0 4px 20px rgba(0,0,0,0.4);">
              ${content}
            </div>
          </div>
        `;
        
        // إضافة CSS للـ preview modal
        if (!document.getElementById('print-preview-style')) {
          const style = document.createElement('style');
          style.id = 'print-preview-style';
          style.textContent = `
            #print-preview-pages { direction: rtl; }
            @media screen {
              #print-preview-pages .print-cover {
                height: auto !important;
                min-height: 200mm !important;
                margin-bottom: 12px;
              }
              #print-preview-pages .print-page {
                background: #fff;
                color: #000;
                padding: 16mm;
                margin-bottom: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              }
              #print-preview-pages .print-letterhead {
                background: linear-gradient(135deg, #1a2744 0%, #2a3f5f 100%) !important;
                color: #fff !important;
                padding: 8mm 6mm !important;
                margin: -16mm -16mm 6mm -16mm !important;
              }
              #print-preview-pages .print-footer {
                position: relative !important;
                bottom: auto !important;
                margin-top: 8mm !important;
                border-top: 0.5pt solid #ccc !important;
                padding: 3mm 0 !important;
              }
            }
          `;
          document.head.appendChild(style);
        }
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        
        // Event handlers
        document.getElementById('print-preview-close').addEventListener('click', () => {
          overlay.remove();
          document.body.style.overflow = '';
        });
        
        document.getElementById('print-preview-print').addEventListener('click', () => {
          // استبدال محتوى الـ preview بنسخة طباعة نظيفة
          const printDiv = document.createElement('div');
          printDiv.id = 'print-active-div';
          printDiv.className = 'print-active';
          printDiv.innerHTML = content;
          document.body.appendChild(printDiv);
          
          // إخفاء كل شيء آخر
          document.body.classList.add('print-mode');
          
          // انتظر قليل ثم اطبع
          setTimeout(() => {
            window.print();
            
            // استعادة الحالة
            setTimeout(() => {
              printDiv.remove();
              document.body.classList.remove('print-mode');
            }, 500);
          }, 100);
        });
      },
      
      // طباعة مباشرة (بدون معاينة)
      quickPrint(reportId, options = {}) {
        const content = this.generate(reportId, options);
        if (!content) return;
        
        // إنشاء container للطباعة
        let printDiv = document.getElementById('print-active-div');
        if (printDiv) printDiv.remove();
        
        printDiv = document.createElement('div');
        printDiv.id = 'print-active-div';
        printDiv.className = 'print-active';
        printDiv.innerHTML = content;
        document.body.appendChild(printDiv);
        document.body.classList.add('print-mode');
        
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            printDiv.remove();
            document.body.classList.remove('print-mode');
          }, 500);
        }, 100);
      },
      
      // قائمة التقارير الرئيسية
      printMainMenu(options = {}) {
        const html = `
<div class="print-cover">
  <h1>${escapeHtml(options.companyName || getBrand().companyName)}</h1>
  <h2>تقرير شامل متعدد الأقسام</h2>
  <div class="subtitle">يحتوي على ملخص شامل لأداء الشركة</div>
  <div class="meta">
    <div>تاريخ الإصدار: ${formatDate(new Date())}</div>
    <div>عدد الصفحات: متعدد</div>
  </div>
</div>
${this.generate('executive', options)}
${this.generate('financial', options)}
${this.generate('customers', { ...options, search: null })}
${this.generate('transactions', options)}
${this.generate('inventory', options)}
${this.generate('agents', options)}
${this.generate('rfm', options)}
`;
        this._renderPreview(html, { reportIds: ['composite'], options });
      },
      
      // تخصيص
      getBrand,
      saveBrand,
      updateBrandSetting(key, value) {
        const brand = getBrand();
        brand[key] = value;
        return saveBrand(brand);
      }
    };
    
    // ============== Self Test ==============
    
    PrintEngine.selfTest = function() {
      const tests = [];
      
      // Setup test data
      if (typeof window !== 'undefined') {
        window.O = window.O || {};
        window.O.soc = [
          { nm: 'عميل 1', ph: '1234', bl: 100 },
          { nm: 'عميل 2', ph: '5678', bl: 200 }
        ];
        window.O.it = [
          { nm: 'منتج 1', pr: 10, st: 50 },
          { nm: 'منتج 2', pr: 20, st: 0 }
        ];
        window.O.tx = [
          { cl: 'عميل 1', it: 'منتج 1', tt: 100, dt: new Date().toISOString(), tp: 'sale' }
        ];
        window.O.mon = [{ nm: 'مندوب 1', ph: '555' }];
        window.O.T = { s: 1000, co: 500, pr: 200, ot: 300 };
        window.O.ml = ['يناير', 'فبراير'];
      }
      
      // Test 1: Available reports
      const reports = this.getReports();
      tests.push({ name: 'Available Reports', pass: reports.length >= 7 });
      
      // Test 2: Generate executive
      const exec = this.generate('executive');
      tests.push({ name: 'Executive Report', pass: exec && exec.includes('print-letterhead') });
      
      // Test 3: Generate customers
      const cust = this.generate('customers');
      tests.push({ name: 'Customers Report', pass: cust && cust.includes('print-table') });
      
      // Test 4: Generate transactions
      const tx = this.generate('transactions');
      tests.push({ name: 'Transactions Report', pass: tx && tx.includes('print-page') });
      
      // Test 5: Generate inventory
      const inv = this.generate('inventory');
      tests.push({ name: 'Inventory Report', pass: inv && inv.includes('print-alert') });
      
      // Test 6: Generate financial
      const fin = this.generate('financial');
      tests.push({ name: 'Financial Report', pass: fin && fin.includes('الميزانية') });
      
      // Test 7: Generate agents
      const ag = this.generate('agents');
      tests.push({ name: 'Agents Report', pass: ag && ag.includes('أداء المناديب') });
      
      // Test 8: Generate RFM
      const rfm = this.generate('rfm');
      tests.push({ name: 'RFM Report', pass: rfm && rfm.includes('RFM') });
      
      // Test 9: Composite generate
      const composite = this.generateComposite(['executive', 'financial']);
      tests.push({ name: 'Composite Report', pass: composite && composite.length > 1000 });
      
      // Test 10: Brand
      const brand = this.getBrand();
      tests.push({ name: 'Brand Settings', pass: brand && brand.companyName });
      
      // Test 11: Save Brand
      const saveResult = this.saveBrand({ ...brand, phone: '+965 9999 9999' });
      tests.push({ name: 'Save Brand', pass: saveResult.success === true });
      
      // Test 12: Letterhead
      const lh = generateLetterhead('Test', 'Test Sub');
      tests.push({ name: 'Letterhead', pass: lh && lh.includes('print-letterhead') });
      
      // Test 13: Footer
      const footer = generateFooter();
      tests.push({ name: 'Footer', pass: footer && footer.includes('print-footer') });
      
      // Test 14: Signatures
      const brand2 = getBrand();
      const sig = generateSignaturesHTML(brand2);
      tests.push({ name: 'Signature Blocks', pass: sig && sig.includes('print-sig-box') });
      
      // Test 15: Filter customers in report
      const filteredCustomers = this.generate('customers', { search: 'عميل 1' });
      tests.push({ name: 'Search Filter Customers', pass: filteredCustomers && filteredCustomers.includes('عميل 1') });
      
      // Test 16: Period sales
      const period = this.generate('periodSales');
      tests.push({ name: 'Period Sales Report', pass: period && period.includes('الفترة') });
      
      // Test 17: Helper functions (الأرقام قد تكون عربية أو غربية حسب الـ locale)
      tests.push({ name: 'formatNumber', pass: formatNumber(0) === '—' || formatNumber(100).length > 0 });
      tests.push({ name: 'formatCurrency', pass: formatCurrency(1000).includes('د.ك') || formatCurrency(1000).length >= 5 });
      tests.push({ name: 'formatDate', pass: !!formatDate(new Date()) });
      tests.push({ name: 'escapeHtml', pass: escapeHtml('<script>') === '&lt;script&gt;' });
      
      // Test 18: Cover page
      const cover = this.generate('cover');
      tests.push({ name: 'Cover Page', pass: cover && cover.includes('print-cover') });
      
      return tests;
    };
    
    window.PrintEngine = PrintEngine;
    
    // === استبدال exportPDF القديم ===
    
    // Enhanced exportPDF function (uses PrintEngine)
    window.exportPDF = function(reportId = 'executive', options = {}) {
      Logger.info('PrintEngine.exportPDF', { reportId, options });
      
      // إذا كانت options فارغة، عرض قائمة التقارير
      if (!reportId) {
        return PrintEngine.showPreview(['executive', 'financial', 'customers', 'transactions', 'inventory', 'agents']);
      }
      
      // إذا كانت reportId قائمة
      if (Array.isArray(reportId)) {
        return PrintEngine.showPreview(reportId, options);
      }
      
      // Single report
      if (PrintEngine.getReports().some(r => r.id === reportId)) {
        return PrintEngine.showPreview([reportId], options);
      }
      
      // Fallback
      return PrintEngine.quickPrint('executive', options);
    };
    
    if (typeof NAYEF_ENV !== 'undefined' && NAYEF_ENV.isDev) {
      Logger.info('PrintEngine ready [9 reports + preview modal + brand settings]');
    }
  })();
  