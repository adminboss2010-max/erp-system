// تحميل مكتبة Supabase من CDN (يُضاف <script> تاج منفصل قبل هذا الملف فى أى صفحة اختبار)
const SUPABASE_URL = 'https://ucgujtkehiihlygykegx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-eZRHFrYinn3WKCWPI_JAg_ltFV_HMX';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const AuthClientV2 = {
  async register(companyNameAr, email, password) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { company_name_ar: companyNameAr } }
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, user: data.user, session: data.session };
  },

  async login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, user: data.user, session: data.session };
  },

  async logout() {
    const { error } = await supabaseClient.auth.signOut();
    return { ok: !error, error: error?.message };
  },

  async getCurrentCompany() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return { ok: false, error: 'لا يوجد مستخدم مسجل دخول' };
    const { data, error } = await supabaseClient
      .from('company_users')
      .select('company_id, role, companies(name_ar, name_en, plan, trial_ends_at)')
      .eq('user_id', user.id)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  }
};

const CustomersClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) return { ok: false, error: error.message };
    return { ok: true, customers: data };
  },

  async create(companyId, customer) {
    const { data, error } = await supabaseClient
      .from('customers')
      .insert({ company_id: companyId, ...customer })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, customer: data };
  },

  async update(customerId, fields) {
    const { data, error } = await supabaseClient
      .from('customers')
      .update(fields)
      .eq('id', customerId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, customer: data };
  },

  async remove(customerId) {
    const { error } = await supabaseClient.from('customers').delete().eq('id', customerId);
    return { ok: !error, error: error?.message };
  }
};

const AgentsClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient
      .from('agents')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) return { ok: false, error: error.message };
    return { ok: true, agents: data };
  },

  async create(companyId, agent) {
    const { data, error } = await supabaseClient
      .from('agents')
      .insert({ company_id: companyId, ...agent })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, agent: data };
  },

  async update(agentId, fields) {
    const { data, error } = await supabaseClient
      .from('agents')
      .update(fields)
      .eq('id', agentId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, agent: data };
  },

  async remove(agentId) {
    const { error } = await supabaseClient.from('agents').delete().eq('id', agentId);
    return { ok: !error, error: error?.message };
  }
};

const ItemsClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient
      .from('items')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) return { ok: false, error: error.message };
    return { ok: true, items: data };
  },

  async create(companyId, item) {
    const { data, error } = await supabaseClient
      .from('items')
      .insert({ company_id: companyId, ...item })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, item: data };
  }
};

const SalesClient = {
  async postSale(payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch('https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-sale', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || 'فشل تسجيل عملية البيع' };
    return { ok: true, ...json };
  }
};


const StatementClient = {
  async getCustomer(customerId) {
    const { data, error } = await supabaseClient
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, customer: data };
  },

  async getCompany(companyId) {
    const { data, error } = await supabaseClient
      .from('companies')
      .select('name_ar, name_en')
      .eq('id', companyId)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, company: data };
  },

  // معاملات قبل تاريخ معين (لحساب الرصيد الافتتاحي)
  async getBalanceBefore(companyId, customerId, beforeDate) {
    let query = supabaseClient
      .from('transactions')
      .select('debit, credit, type')
      .eq('company_id', companyId)
      .eq('customer_id', customerId);
    if (beforeDate) query = query.lt('date', beforeDate);
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    let balance = 0;
    (data || []).forEach(t => {
      if (t.type === 'sale') balance += (t.debit || 0); // بيع آجل بس، البيع النقدي مبيأثرش
      else balance -= (t.credit || 0); // سداد أو مرتجع
    });
    return { ok: true, balance };
  },

  async getTransactionsInRange(companyId, customerId, fromDate, toDate) {
    let query = supabaseClient
      .from('transactions')
      .select('*, items(name), agents(name)')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .order('date', { ascending: true });
    if (fromDate) query = query.gte('date', fromDate);
    if (toDate) query = query.lte('date', toDate + 'T23:59:59');
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, transactions: data };
  }
};

const SuppliersClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) return { ok: false, error: error.message };
    return { ok: true, suppliers: data };
  },

  async create(companyId, supplier) {
    const { data, error } = await supabaseClient
      .from('suppliers')
      .insert({ company_id: companyId, ...supplier })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, supplier: data };
  }
};

const PurchasesClient = {
  async postPurchase(payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch('https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || 'فشل تسجيل عملية الشراء' };
    return { ok: true, ...json };
  }
};

const ItemsImportExportClient = {
  downloadTemplate() {
    const headers = [
      'الكود *', 'الاسم *', 'التصنيف', 'الماركة', 'الوحدة الأساسية',
      'مجموعة الوحدات (اختياري)', 'الباركود', 'سعر التكلفة', 'سعر البيع',
      'الكمية الابتدائية', 'الحد الأدنى للمخزون', 'الحد الأقصى للمخزون', 'الوصف'
    ];
    const exampleRow = [
      'ITM001', 'مثال: أرز بسمتي 5 كجم', 'مواد غذائية', 'الملكة', 'قطعة',
      'كرتون-شد-قطعة', '6281234567890', '1.500', '2.200', '100', '10', '500', 'وصف اختياري للصنف'
    ];

    const wsData = [headers, exampleRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));

    const instructionsData = [
      ['تعليمات استخدام قالب prova لاستيراد الأصناف'],
      [''],
      ['1. الحقول المعلّم عليها بـ * إلزامية (الكود والاسم)'],
      ['2. لا تغيّر أسماء الأعمدة فى الصف الأول'],
      ['3. احذف صف المثال قبل رفع الملف الحقيقي، أو استبدله ببياناتك'],
      ['4. الأسعار والكميات أرقام فقط (بدون رموز عملة أو فواصل)'],
      ['5. "مجموعة الوحدات" اختيارية: اكتب اسم مجموعة موجودة بالفعل بالنظام (زي "كرتون-شد-قطعة") لو الصنف بيُباع بأكتر من وحدة'],
      ['6. لو تركت "مجموعة الوحدات" فارغة، الصنف هيتسجل بوحدة واحدة بس (الوحدة الأساسية)'],
      ['7. لو كتبت اسم مجموعة وحدات مش موجودة بالنظام، سيتم تجاهل هذا الحقل بدون خطأ (الصنف يتسجل بدون مجموعة)'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'تعليمات');
    XLSX.utils.book_append_sheet(wb, ws, 'الأصناف');
    XLSX.writeFile(wb, 'قالب_استيراد_الأصناف_prova.xlsx');
  },

  async parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames.includes('الأصناف') ? 'الأصناف' : workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          const items = rows
            .filter(r => r['الكود *'] || r['الكود'])
            .map(r => ({
              code: String(r['الكود *'] || r['الكود'] || '').trim(),
              name: String(r['الاسم *'] || r['الاسم'] || '').trim(),
              categoryName: String(r['التصنيف'] || '').trim(),
              brand: String(r['الماركة'] || '').trim(),
              unit: String(r['الوحدة الأساسية'] || r['الوحدة'] || 'قطعة').trim(),
              uomGroupName: String(r['مجموعة الوحدات (اختياري)'] || '').trim(),
              barcode: String(r['الباركود'] || '').trim(),
              unit_cost: parseFloat(r['سعر التكلفة']) || 0,
              unit_price: parseFloat(r['سعر البيع']) || 0,
              stock_qty: parseFloat(r['الكمية الابتدائية']) || 0,
              min_stock_level: parseFloat(r['الحد الأدنى للمخزون']) || 0,
              max_stock_level: r['الحد الأقصى للمخزون'] ? parseFloat(r['الحد الأقصى للمخزون']) : null,
              description: String(r['الوصف'] || '').trim(),
            }));
          resolve(items);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  async importItems(companyId, items) {
    const results = { success: 0, failed: 0, errors: [] };
    const categoryCache = {};
    const uomGroupCache = {};

    const { data: existingCats } = await supabaseClient
      .from('item_categories').select('id, name').eq('company_id', companyId);
    (existingCats || []).forEach(c => categoryCache[c.name] = c.id);

    // 🆕 تحميل مجموعات الوحدات الموجودة مسبقًا (مقروءة بأسمائها فقط، ما بننشئش مجموعات جديدة من الإكسل)
    const { data: existingUomGroups } = await supabaseClient
      .from('uom_groups').select('id, name').eq('company_id', companyId);
    (existingUomGroups || []).forEach(g => uomGroupCache[g.name] = g.id);

    for (const item of items) {
      try {
        if (!item.code || !item.name) {
          results.failed++;
          results.errors.push(`صف بدون كود أو اسم تم تجاهله`);
          continue;
        }

        let categoryId = null;
        if (item.categoryName) {
          if (!categoryCache[item.categoryName]) {
            const { data: newCat } = await supabaseClient
              .from('item_categories')
              .insert({ company_id: companyId, name: item.categoryName })
              .select().single();
            categoryCache[item.categoryName] = newCat.id;
          }
          categoryId = categoryCache[item.categoryName];
        }

        // 🆕 ربط مجموعة الوحدات لو موجودة بالاسم، وتجاهل بصمت لو مش موجودة (زي ما اتفقنا)
        let uomGroupId = null;
        if (item.uomGroupName && uomGroupCache[item.uomGroupName]) {
          uomGroupId = uomGroupCache[item.uomGroupName];
        } else if (item.uomGroupName) {
          results.errors.push(`${item.code}: مجموعة الوحدات "${item.uomGroupName}" غير موجودة، تم تجاهلها`);
        }

        const { error } = await supabaseClient.from('items').insert({
          company_id: companyId,
          code: item.code, name: item.name, category_id: categoryId,
          brand: item.brand || null, unit: item.unit, barcode: item.barcode || null,
          unit_cost: item.unit_cost, unit_price: item.unit_price, stock_qty: item.stock_qty,
          min_stock_level: item.min_stock_level, max_stock_level: item.max_stock_level,
          description: item.description || null,
          uom_group_id: uomGroupId,
        });

        if (error) { results.failed++; results.errors.push(`${item.code}: ${error.message}`); }
        else results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`${item.code || '؟'}: ${e.message}`);
      }
    }
    return results;
  }
};
const UomClient = {
  async getUnitsForItem(itemId) {
    const { data, error } = await supabaseClient
      .from('items')
      .select('uom_group_id')
      .eq('id', itemId)
      .single();
    if (error || !data.uom_group_id) return { ok: true, units: [] };

    const { data: units, error: unitsError } = await supabaseClient
      .from('uom_group_units')
      .select('*')
      .eq('uom_group_id', data.uom_group_id)
      .order('sort_order');
    if (unitsError) return { ok: false, error: unitsError.message };
    return { ok: true, units: units || [] };
  }
};
const PaymentsClient = {
  async postPayment(payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch('https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || 'فشل تسجيل الدفعة' };
    return { ok: true, ...json };
  },

  async getNextDocNumber(companyId) {
    const { data, error } = await supabaseClient
      .from('companies').select('last_doc_number').eq('id', companyId).single();
    if (error) return null;
    return (data.last_doc_number || 0) + 1;
  },

  async listRecent(companyId, limit = 10) {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*, customers(name)')
      .eq('company_id', companyId)
      .eq('type', 'payment')
      .order('date', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, vouchers: data };
  }
};
const ReturnsClient = {
  async postReturn(payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch('https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || 'فشل تسجيل المرتجع' };
    return { ok: true, ...json };
  },

  // 🆕 يجيب فواتير البيع اللي ممكن يترجعلها، مع الأصناف المتاحة للإرجاع (لسه ماترجعتش بالكامل)
  async getSaleInvoiceItems(companyId, docNo) {
  const { data, error } = await supabaseClient
    .from('transactions')
    .select('item_id, qty, unit_cost, debit, credit, tax_rate, items(name)')
    .eq('company_id', companyId).eq('doc_no', docNo).eq('type', 'sale');
  if (error) return { ok: false, error: error.message };

  // 🆕 نحسب سعر الوحدة من الإجمالي (debit أو credit) ÷ الكمية، لأن الجدول مايخزنش unit_price مباشرة
  const lines = (data || []).map(line => {
    const total = (line.debit || 0) + (line.credit || 0);
    const unit_price = line.qty > 0 ? total / line.qty : 0;
    return { ...line, unit_price };
  });

  return { ok: true, lines };
},

  async listRecent(companyId, limit = 10) {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*, customers(name), items(name)')
      .eq('company_id', companyId).eq('type', 'return')
      .order('date', { ascending: false }).limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, returns: data };
  }
};

const PurchaseReturnsClient = {
  async postPurchaseReturn(payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch('https://ucgujtkehiihlygykegx.supabase.co/functions/v1/post-purchase-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error || 'فشل تسجيل مرتجع المشتريات' };
    return { ok: true, ...json };
  },

  async getPurchaseInvoiceItems(companyId, docNo) {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('item_id, qty, unit_cost, debit, credit, tax_rate, items(name)')
      .eq('company_id', companyId).eq('doc_no', docNo).eq('type', 'purchase');
    if (error) return { ok: false, error: error.message };
    return { ok: true, lines: data };
  },

  async listRecent(companyId, limit = 10) {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*, suppliers(name), items(name)')
      .eq('company_id', companyId).eq('type', 'purchase_return')
      .order('date', { ascending: false }).limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, returns: data };
  }
};
const DocumentsClient = {
  async getFullDocument(companyId, docType, docNo) {
    const { data: company } = await supabaseClient
      .from('companies').select('name_ar, name_en, tax_number, cr_number, currency, address, phone, email, logo_url').eq('id', companyId).single();

    const { data: lines, error } = await supabaseClient
      .from('transactions')
      .select('*, items(name, unit), customers(name, phone, address, code), suppliers(name, phone, tax_number, code)')
      .eq('company_id', companyId).eq('doc_no', docNo).eq('type', docType)
      .order('created_at');

    if (error || !lines || lines.length === 0) return { ok: false, error: 'لم يتم العثور على المستند' };

    const typeLabels = {
      sale: 'فاتورة مبيعات', purchase: 'فاتورة مشتريات', payment: 'سند قبض',
      return: 'مرتجع مبيعات', purchase_return: 'مرتجع مشتريات',
    };

    const party = lines[0].customers || lines[0].suppliers || null;
    const isReturn = docType === 'return' || docType === 'purchase_return';
    const isCredit = (lines[0].debit > 0 && !isReturn) || (lines[0].credit > 0 && isReturn && docType !== 'payment');

    let subtotal = 0, grandTax = 0;
    const items = lines.filter(l => l.item_id).map(l => {
      const lineTotal = (l.debit || 0) + (l.credit || 0);
      const qty = l.qty || 0;
      const lineNet = lineTotal - (l.tax_amount || 0);
      const unitPrice = qty > 0 ? lineNet / qty : 0;
      subtotal += lineNet;
      grandTax += (l.tax_amount || 0);
      return {
        name: l.items?.name || '—', unit: l.items?.unit || 'قطعة', qty,
        unitPrice, taxAmount: l.tax_amount || 0, lineTotal,
      };
    });

    let grandTotal = subtotal;
    if (docType === 'payment') grandTotal = lines[0].credit || 0;

    return {
      ok: true,
      doc: {
        type: docType, typeLabel: typeLabels[docType] || docType, docNo,
        refDocNo: lines[0].ref_doc_no || null,
        date: lines[0].date, company, party, items,
        subtotal, grandTax, grandTotal: grandTotal + grandTax,
        currency: company?.currency || 'KWD', isReturn, isCredit,
        partyLabel: lines[0].customers ? 'العميل' : (lines[0].suppliers ? 'المورد' : ''),
      }
    };
  }
};
const DocumentsClient2 = {
  async listAll(companyId, filters = {}) {
    let query = supabaseClient
      .from('transactions')
      .select('doc_no, type, date, ref_doc_no, debit, credit, customers(name), suppliers(name)')
      .eq('company_id', companyId);

    if (filters.type) query = query.eq('type', filters.type);
    if (filters.fromDate) query = query.gte('date', filters.fromDate);
    if (filters.toDate) query = query.lte('date', filters.toDate + 'T23:59:59');

    const { data, error } = await query.order('date', { ascending: false });
    if (error) return { ok: false, error: error.message };

    // تجميع الأصناف تحت نفس رقم المستند (فاتورة فيها أكتر من صنف = صف واحد فى السجل)
    const grouped = {};
    (data || []).forEach(t => {
      const key = t.type + '_' + t.doc_no;
      if (!grouped[key]) {
        grouped[key] = { doc_no: t.doc_no, type: t.type, date: t.date, ref_doc_no: t.ref_doc_no,
          party: t.customers?.name || t.suppliers?.name || '—', total: 0 };
      }
      grouped[key].total += (t.debit || 0) + (t.credit || 0);
    });
    return { ok: true, documents: Object.values(grouped) };
  }
};// ============================================================
// 🆕 إضافات الوحدات الجديدة (هجرة نظام غروب النايف) — تُضاف فى آخر supabase-client.js
// ============================================================

const EmployeesClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient.from('employees').select('*').eq('company_id', companyId).order('code');
    if (error) return { ok: false, error: error.message };
    return { ok: true, employees: data };
  },
  async create(companyId, emp) {
    const { data, error } = await supabaseClient.from('employees').insert({ company_id: companyId, ...emp }).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, employee: data };
  },
  async runPayroll(companyId, period) {
    const { data, error } = await supabaseClient.rpc('run_monthly_payroll', { p_company_id: companyId, p_period: period });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  },
  async calculateEOSB(employeeId, endDate) {
    const { data, error } = await supabaseClient.rpc('calculate_eosb', { p_employee_id: employeeId, p_end_date: endDate });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  },
  async payrollHistory(companyId, limit = 12) {
    const { data, error } = await supabaseClient.from('payroll_runs').select('*').eq('company_id', companyId).order('period', { ascending: false }).limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, runs: data };
  }
};

const AssetsClient = {
  async listCategories(companyId) {
    const { data, error } = await supabaseClient.from('asset_categories').select('*').eq('company_id', companyId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, categories: data };
  },
  async list(companyId) {
    const { data, error } = await supabaseClient.from('fixed_assets').select('*').eq('company_id', companyId).order('acquire_date', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, assets: data };
  },
  async create(companyId, asset) {
    const { data, error } = await supabaseClient.from('fixed_assets').insert({ company_id: companyId, ...asset }).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, asset: data };
  },
  async runDepreciation(companyId, assetId, year, month) {
    const { data, error } = await supabaseClient.rpc('run_monthly_depreciation', { p_company_id: companyId, p_fixed_asset_id: assetId, p_year: year, p_month: month });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  }
};

const ProcurementClient = {
  async createPO(companyId, supplierId, items, tradeDiscPct, notes) {
    const { data, error } = await supabaseClient.rpc('create_purchase_order', {
      p_company_id: companyId, p_supplier_id: supplierId, p_items: items,
      p_trade_discount_pct: tradeDiscPct || 0, p_notes: notes || null
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  },
  async listPOs(companyId) {
    const { data, error } = await supabaseClient.from('purchase_orders').select('*, suppliers(name)').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, orders: data };
  },
  async getPOLines(poId) {
    const { data, error } = await supabaseClient.from('purchase_order_lines').select('*, items(name)').eq('purchase_order_id', poId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, lines: data };
  },
  async receiveGoods(companyId, poId, lines) {
    const { data, error } = await supabaseClient.rpc('receive_goods', { p_company_id: companyId, p_purchase_order_id: poId, p_lines: lines });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  },
  async postVendorInvoice(companyId, supplierId, poId, amount) {
    const { data, error } = await supabaseClient.rpc('post_vendor_invoice', { p_company_id: companyId, p_supplier_id: supplierId, p_purchase_order_id: poId, p_invoice_amount: amount });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  }
};

const BankClient = {
  async listAccounts(companyId) {
    const { data, error } = await supabaseClient.from('bank_accounts').select('*').eq('company_id', companyId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, accounts: data };
  },
  async createAccount(companyId, acc) {
    const { data, error } = await supabaseClient.from('bank_accounts').insert({ company_id: companyId, ...acc }).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, account: data };
  },
  async createReconciliation(companyId, bankAccountId, year, month, balancePerBank, balancePerBook) {
    const { data, error } = await supabaseClient.from('bank_reconciliations')
      .insert({ company_id: companyId, bank_account_id: bankAccountId, period_year: year, period_month: month, balance_per_bank: balancePerBank, balance_per_book: balancePerBook })
      .select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, reconciliation: data };
  },
  async addReconciliationItem(reconciliationId, itemType, reference, description, amount) {
    const { error } = await supabaseClient.from('bank_reconciliation_items')
      .insert({ bank_reconciliation_id: reconciliationId, item_type: itemType, reference, description, amount });
    return { ok: !error, error: error?.message };
  },
  async compute(reconciliationId) {
    const { data, error } = await supabaseClient.rpc('compute_bank_reconciliation', { p_reconciliation_id: reconciliationId });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  },
  async listReconciliations(companyId) {
    const { data, error } = await supabaseClient.from('bank_reconciliations').select('*, bank_accounts(bank_name)').eq('company_id', companyId).order('period_year', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, list: data };
  }
};

const QuotationsClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient.from('quotations').select('*, customers(name)').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, quotations: data };
  },
  async create(companyId, customerId, items, validDays, terms) {
    const total = items.reduce((s, i) => s + (i.qty * i.unit_price), 0);
    const { data: countData } = await supabaseClient.from('quotations').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
    const quoteNumber = 'QT-' + new Date().getFullYear() + '-' + String((countData?.length || 0) + 1).padStart(4, '0');
    const validUntil = new Date(Date.now() + (validDays || 30) * 86400000).toISOString().split('T')[0];

    const { data: quote, error } = await supabaseClient.from('quotations')
      .insert({ company_id: companyId, quote_number: quoteNumber, customer_id: customerId, valid_until: validUntil, total_amount: total, terms })
      .select().single();
    if (error) return { ok: false, error: error.message };

    for (const item of items) {
      await supabaseClient.from('quotation_lines').insert({ quotation_id: quote.id, item_id: item.item_id, qty: item.qty, unit_price: item.unit_price });
    }
    return { ok: true, quote };
  },
  async convertToSale(quotationId, isCredit) {
    const { data, error } = await supabaseClient.rpc('convert_quotation_to_sale', { p_quotation_id: quotationId, p_is_credit: isCredit });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  }
};

const CommissionsClient = {
  async calculate(companyId, agentId, period) {
    const { data, error } = await supabaseClient.rpc('calculate_agent_commission', { p_company_id: companyId, p_agent_id: agentId, p_period: period });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  },
  async list(companyId, period) {
    let query = supabaseClient.from('commission_accruals').select('*, agents(name)').eq('company_id', companyId);
    if (period) query = query.eq('period', period);
    const { data, error } = await query.order('period', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, accruals: data };
  }
};

const TaxClient = {
  async calculateAll(companyId, year, post) {
    const { data, error } = await supabaseClient.rpc('calculate_all_taxes', { p_company_id: companyId, p_fiscal_year: year, p_post: post || false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  },
  async history(companyId) {
    const { data, error } = await supabaseClient.from('tax_history').select('*').eq('company_id', companyId).order('fiscal_year', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, history: data };
  }
};

const BranchesClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient.from('branches').select('*').eq('company_id', companyId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, branches: data };
  },
  async create(companyId, branch) {
    const { data, error } = await supabaseClient.from('branches').insert({ company_id: companyId, ...branch }).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, branch: data };
  }
};

const BudgetClient = {
  async listBudgets(companyId) {
    const { data, error } = await supabaseClient.from('budgets').select('*').eq('company_id', companyId).order('fiscal_year', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, budgets: data };
  },
  async vsActual(companyId, year, scenario) {
    const { data, error } = await supabaseClient.from('budget_vs_actual').select('*').eq('company_id', companyId).eq('fiscal_year', year).eq('scenario', scenario || 'base');
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data };
  }
};

const AgingClient = {
  async get(companyId) {
    const { data, error } = await supabaseClient.from('receivables_aging').select('*').eq('company_id', companyId).order('balance', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data };
  }
};
// ============================================================
// 🆕 Clients للأجزاء الناقصة (البناء الثاني) — تُضاف فى آخر supabase-client.js
// ============================================================

const LedgerClient = {
  async trialBalance(companyId) {
    const { data, error } = await supabaseClient.from('trial_balance').select('*').eq('company_id', companyId).order('code');
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data };
  },
  async journalEntries(companyId, limit = 50) {
    const { data, error } = await supabaseClient.from('journal_entries')
      .select('*, journal_entry_lines(*, chart_of_accounts(code, name_ar))')
      .eq('company_id', companyId).order('entry_date', { ascending: false }).limit(limit);
    if (error) return { ok: false, error: error.message };
    return { ok: true, entries: data };
  },
  async chartOfAccounts(companyId) {
    const { data, error } = await supabaseClient.from('chart_of_accounts').select('*').eq('company_id', companyId).order('code');
    if (error) return { ok: false, error: error.message };
    return { ok: true, accounts: data };
  }
};

const BudgetUIClient = {
  async listBudgets(companyId) {
    const { data, error } = await supabaseClient.from('budgets').select('*').eq('company_id', companyId).order('fiscal_year', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, budgets: data };
  },
  async createBudget(companyId, year, scenario, scenarioName) {
    const { data, error } = await supabaseClient.from('budgets')
      .insert({ company_id: companyId, fiscal_year: year, scenario, scenario_name: scenarioName })
      .select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, budget: data };
  },
  async addLine(budgetId, accountId, q1, q2, q3, q4) {
    const { error } = await supabaseClient.from('budget_lines')
      .insert({ budget_id: budgetId, account_id: accountId, q1_amount: q1, q2_amount: q2, q3_amount: q3, q4_amount: q4 });
    return { ok: !error, error: error?.message };
  },
  async vsActual(companyId, year, scenario) {
    const { data, error } = await supabaseClient.from('budget_vs_actual').select('*').eq('company_id', companyId).eq('fiscal_year', year).eq('scenario', scenario || 'base');
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data };
  }
};

const FxUIClient = {
  async listRates(companyId) {
    const { data, error } = await supabaseClient.from('fx_rates').select('*').eq('company_id', companyId).order('currency_code');
    if (error) return { ok: false, error: error.message };
    return { ok: true, rates: data };
  },
  async updateRate(companyId, currencyCode, newRate) {
    const { error } = await supabaseClient.from('fx_rates').insert({ company_id: companyId, currency_code: currencyCode, rate_to_base: newRate });
    return { ok: !error, error: error?.message };
  },
  async listOpenItems(companyId) {
    const { data, error } = await supabaseClient.from('fx_open_items').select('*').eq('company_id', companyId).eq('is_settled', false);
    if (error) return { ok: false, error: error.message };
    return { ok: true, items: data };
  },
  async revalue(itemId, newRate) {
    const { data, error } = await supabaseClient.rpc('revalue_fx_item', { p_fx_open_item_id: itemId, p_new_rate: newRate });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  }
};

const WorkflowUIClient = {
  async listTemplates(companyId) {
    const { data, error } = await supabaseClient.from('workflow_templates').select('*, workflow_steps(*)').eq('company_id', companyId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, templates: data };
  },
  async listRequests(companyId) {
    const { data, error } = await supabaseClient.from('approval_requests').select('*, workflow_templates(name)').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, requests: data };
  },
  async act(requestId, actorUserId, action, notes) {
    const { data, error } = await supabaseClient.rpc('act_on_approval', { p_approval_request_id: requestId, p_actor_user_id: actorUserId, p_action: action, p_notes: notes });
    if (error) return { ok: false, error: error.message };
    return { ok: true, ...data };
  }
};

const WarehouseUIClient = {
  async valuation(companyId) {
    const { data, error } = await supabaseClient.from('inventory_valuation').select('*').eq('company_id', companyId).order('total_value', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data };
  },
  async costVariance(companyId) {
    const { data, error } = await supabaseClient.from('cost_variance_report').select('*').eq('company_id', companyId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data };
  }
};

const BatchUIClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient.from('item_batches').select('*, items(name)').eq('company_id', companyId).order('expiry_date');
    if (error) return { ok: false, error: error.message };
    return { ok: true, batches: data };
  },
  async create(companyId, batch) {
    const { data, error } = await supabaseClient.from('item_batches').insert({ company_id: companyId, ...batch }).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, batch: data };
  },
  async expiringAlert(companyId) {
    const { data, error } = await supabaseClient.from('expiring_batches_alert').select('*').eq('company_id', companyId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data };
  }
};

const DocumentsUIClient = {
  async list(companyId) {
    const { data, error } = await supabaseClient.from('document_attachments').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, docs: data };
  },
  async create(companyId, doc) {
    const { data, error } = await supabaseClient.from('document_attachments').insert({ company_id: companyId, ...doc }).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, doc: data };
  }
};

const AnalyticsUIClient = {
  async clv(companyId) {
    const { data, error } = await supabaseClient.from('customer_clv').select('*').eq('company_id', companyId).order('estimated_clv', { ascending: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data };
  }
};

const SettingsUIClient = {
  async getCompany(companyId) {
    const { data, error } = await supabaseClient.from('companies').select('*').eq('id', companyId).single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, company: data };
  },
  async updateCompany(companyId, fields) {
    const { error } = await supabaseClient.from('companies').update(fields).eq('id', companyId);
    return { ok: !error, error: error?.message };
  }
};
