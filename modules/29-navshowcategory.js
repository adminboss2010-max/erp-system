// 🆕 v220.8.3+ NAVIGATION TABS: نظام تبويبات ديناميكي
const NAV_CATEGORIES = {
  overview: {
    title: 'الملخص',
    icon: '📊',
    pages: [
      { pg: 'ov', icon: '📊', label: 'نظرة عامة', title: 'الملخص التنفيذي الشامل' },
    ],
  },
  master: {
    title: 'البيانات الأساسية',
    icon: '💼',
    pages: [
      { pg: 'clients360', icon: '🏢', label: 'الجمعيات', title: 'تحليل أداء الجمعيات والربحية' },
      { pg: 'ag', icon: '👥', label: 'المناديب', title: 'أداء فريق المبيعات والأهداف' },
      { pg: 'it', icon: '📦', label: 'الأصناف', title: 'ربحية المنتجات وحركة المخزون' },
      { pg: 'txTypes', icon: '⚙️', label: 'أنواع الحركات', title: 'تصنيف الحركات على حساب العميل' },
    ],
  },
  sales: {
    title: 'المبيعات والعمليات',
    icon: '🛒',
    pages: [
      { pg: 'invoice', icon: '🧾', label: 'الفواتير', title: 'إنشاء وطباعة فواتير احترافية' },
      { pg: 'statement', icon: '📋', label: 'كشف العميل', title: 'كشف حساب العميل التفصيلي' },
      { pg: 'agentStatement', icon: '👤', label: 'كشف المندوب', title: 'مبيعات، تحصيل، عمولات' },
      { pg: 'mo', icon: '📈', label: 'التحليل الشهري', title: 'تطور المبيعات والتحصيل عبر الزمن' },
      { pg: 'lg', icon: '📜', label: 'سجل المعاملات', title: 'الحركات التفصيلية مع البحث' },
      { fn: 'v23Commissions', icon: '💰', label: 'عمولات المناديب', title: 'حساب عمولات كل المناديب تلقائيًا' },
      { fn: 'v23ModalApi', icon: '🔌', label: 'مفاتيح API', title: 'إدارة مفاتيح API وWebhooks' },
    ],
  },
  analytics: {
    title: 'التحليلات',
    icon: '📊',
    pages: [
      { pg: 'behavior', icon: '🌱', label: 'سلوك الجمعيات', title: 'النمو والتعثر ودورة المشتريات' },
      { pg: 'receivables', icon: '💳', label: 'التحصيل والمخاطر', title: 'الذمم وأعمارها وتقييم المخاطر' },
      { pg: 'profitability', icon: '💰', label: 'الربحية', title: 'قائمة الدخل الكاملة وصافي الربح' },
      { pg: 'offers', icon: '🎁', label: 'عروض الجمعيات', title: 'تصنيف الجمعيات والعروض المقترحة' },
      { pg: 'cp', icon: '⚖️', label: 'مقارنة الفترات', title: 'مقارنة الأداء بين فترتين' },
      { pg: 'fc', icon: '🔮', label: 'التنبؤ', title: 'توقعات المبيعات للأشهر القادمة' },
      { fn: 'v23ModalRfm', icon: '🎯', label: 'تصنيف RFM', title: 'تقسيم العملاء حسب القيمة والنشاط' },
    ],
  },
  strategy: {
    title: 'الاستراتيجية',
    icon: '🎯',
    pages: [
      { pg: 'decisions', icon: '🧭', label: 'القرارات الاستراتيجية', title: 'المخاطر والفرص الحرجة' },
      { pg: 'strategic', icon: '🎯', label: 'تحليلات استراتيجية', title: 'BCG · تآكل الربحية · سيناريوهات' },
    ],
  },
  rentals: {
    title: 'القيم الإيجارية',
    icon: '🏠',
    pages: [
      { pg: 'rentals', icon: '🏠', label: 'القيم الإيجارية', title: 'عقود الإيجار والعملاء الإيجابيين' },
    ],
  },
};

// خريطة معكوسة: pg → cat
const NAV_PG_TO_CAT = {};
Object.entries(NAV_CATEGORIES).forEach(([cat, info]) => {
  info.pages.forEach(p => { NAV_PG_TO_CAT[p.pg] = cat; });
});

function navShowCategory(cat, btnEl) {
  // فعّل التبويب
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  // اعرض صفحات القسم
  const cat_data = NAV_CATEGORIES[cat];
  if (!cat_data) return;
  const bar = document.getElementById('navActiveBar');
  if (!bar) return;
  const currentPg = window.CUR || 'ov';
  bar.innerHTML = cat_data.pages.map(p => {
    const active = p.pg === currentPg ? ' on' : '';
    return `<button class="navpill${active}" data-pg="${p.pg}" onclick="sw('${p.pg}',this)" title="${p.title}"><span class="ico">${p.icon}</span> ${p.label}</button>`;
  }).join('') + `<span class="nav-section-title">${cat_data.icon} ${cat_data.title}</span>`;
}

window.navShowCategory = navShowCategory;

// دالة sw المعدلة: تتذكر التبويب النشط
const _orig_sw = window.sw;
window._swWithCategory = function(id, el) {
  if (_orig_sw) _orig_sw(id, el);
  // حدّث الـ active bar
  const cat = NAV_PG_TO_CAT[id];
  if (cat) {
    const tabBtn = document.querySelector(`.nav-tab[data-cat="${cat}"]`);
    if (tabBtn) {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tabBtn.classList.add('active');
    }
    navShowCategory(cat, tabBtn);
  }
};
// اعتراض sw الأصلي
window.sw = window._swWithCategory;

// عند التحميل: اعرض قسم overview
window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const ovBtn = document.querySelector('.nav-tab[data-cat="overview"]');
    navShowCategory('overview', ovBtn);
  }, 100);
});
