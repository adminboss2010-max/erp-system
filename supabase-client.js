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