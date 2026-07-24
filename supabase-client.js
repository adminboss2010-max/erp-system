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
  // تحميل قالب إكسل فاضي بكل أعمدة النظام + شيت شرح
  downloadTemplate() {
    const headers = [
      'الكود *', 'الاسم *', 'التصنيف', 'الماركة', 'الوحدة',
      'الباركود', 'سعر التكلفة', 'سعر البيع', 'الكمية الابتدائية',
      'الحد الأدنى للمخزون', 'الحد الأقصى للمخزون', 'الوصف'
    ];
    const exampleRow = [
      'ITM001', 'مثال: أرز بسمتي 5 كجم', 'مواد غذائية', 'الملكة', 'كرتونة',
      '6281234567890', '1.500', '2.200', '100', '10', '500', 'وصف اختياري للصنف'
    ];

    const wsData = [headers, exampleRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));

    const instructionsData = [
      ['تعليمات استخدام قالب prova لاستيراد الأصناف'],
      [''],
      ['1. الحقول المعلّم عليها بـ * إلزامية (الكود والاسم)'],
      ['2. لا تغيّر أسماء الأعمدة فى الصف الأول'],
      ['3. احذف صف المثال قبل رفع الملف الحقيقي، أو استبدله ببياناتك'],
      ['4. الأسعار والكميات أرقام فقط (بدون رموز عملة أو فواصل)'],
      ['5. لو الصنف عنده تصنيف جديد غير موجود بالنظام، سيتم إنشاؤه تلقائيًا'],
      ['6. الحد الأقصى للمخزون اختياري، اتركه فارغًا إذا لم يكن محددًا'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'تعليمات');
    XLSX.utils.book_append_sheet(wb, ws, 'الأصناف');
    XLSX.writeFile(wb, 'قالب_استيراد_الأصناف_prova.xlsx');
  },

  // قراءة ملف مرفوع وتحويله لمصفوفة كائنات جاهزة للاستيراد
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
              unit: String(r['الوحدة'] || 'قطعة').trim(),
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

  // استيراد فعلي لقاعدة البيانات — ينشئ التصنيفات الناقصة تلقائيًا، ويتجاهل صفوف بدون كود/اسم
  async importItems(companyId, items) {
    const results = { success: 0, failed: 0, errors: [] };
    const categoryCache = {};

    // تحميل التصنيفات الموجودة مسبقًا
    const { data: existingCats } = await supabaseClient
      .from('item_categories').select('id, name').eq('company_id', companyId);
    (existingCats || []).forEach(c => categoryCache[c.name] = c.id);

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

        const { error } = await supabaseClient.from('items').insert({
          company_id: companyId,
          code: item.code, name: item.name, category_id: categoryId,
          brand: item.brand || null, unit: item.unit, barcode: item.barcode || null,
          unit_cost: item.unit_cost, unit_price: item.unit_price, stock_qty: item.stock_qty,
          min_stock_level: item.min_stock_level, max_stock_level: item.max_stock_level,
          description: item.description || null,
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