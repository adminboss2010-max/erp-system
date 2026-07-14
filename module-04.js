
  /* ═══════════════════════════════════════════════════════════════════
     ✅ v220.9+ INPUT VALIDATOR (Zod-like)
     ═══════════════════════════════════════════════════════════════════
     تحقق صارم من المدخلات قبل حفظها في النظام
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const Validator = {
      // أنواع أساسية
      string(value, options = {}) {
        const errors = [];
        if (options.required && (value === undefined || value === null || value === '')) {
          errors.push('الحقل مطلوب');
          return { valid: false, errors, value: null };
        }
        if (value === undefined || value === null) {
          return { valid: true, errors: [], value: null };
        }
        if (typeof value !== 'string') {
          errors.push('يجب أن يكون نصاً');
          return { valid: false, errors, value: null };
        }
        let v = String(value).trim();
        // Sanitize XSS
        v = v.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        v = v.replace(/javascript:/gi, '');
        v = v.replace(/on\w+\s*=/gi, '');
        if (options.minLength && v.length < options.minLength) {
          errors.push('الحد الأدنى ' + options.minLength + ' حرف');
        }
        if (options.maxLength && v.length > options.maxLength) {
          errors.push('الحد الأقصى ' + options.maxLength + ' حرف');
          v = v.substring(0, options.maxLength);
        }
        if (options.pattern && !options.pattern.test(v)) {
          errors.push(options.patternMessage || 'الصيغة غير صحيحة');
        }
        return { valid: errors.length === 0, errors, value: v };
      },
      
      number(value, options = {}) {
        const errors = [];
        if (options.required && (value === undefined || value === null || value === '')) {
          errors.push('الحقل مطلوب');
          return { valid: false, errors, value: null };
        }
        if (value === undefined || value === null || value === '') {
          return { valid: true, errors: [], value: null };
        }
        let n = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(n) || !isFinite(n)) {
          errors.push('يجب أن يكون رقماً صحيحاً');
          return { valid: false, errors, value: null };
        }
        if (options.min !== undefined && n < options.min) {
          errors.push('الحد الأدنى ' + options.min);
          n = options.min;
        }
        if (options.max !== undefined && n > options.max) {
          errors.push('الحد الأقصى ' + options.max);
          n = options.max;
        }
        if (options.integer && !Number.isInteger(n)) {
          n = Math.round(n);
        }
        return { valid: errors.length === 0, errors, value: n };
      },
      
      date(value, options = {}) {
        const errors = [];
        if (options.required && !value) {
          errors.push('التاريخ مطلوب');
          return { valid: false, errors, value: null };
        }
        if (!value) return { valid: true, errors: [], value: null };
        const d = new Date(value);
        if (isNaN(d.getTime())) {
          errors.push('تاريخ غير صالح');
          return { valid: false, errors, value: null };
        }
        if (options.notFuture && d > new Date()) {
          errors.push('التاريخ لا يمكن أن يكون في المستقبل');
        }
        if (options.notTooOld) {
          const minDate = new Date();
          minDate.setFullYear(minDate.getFullYear() - options.notTooOld);
          if (d < minDate) {
            errors.push('التاريخ قديم جداً');
          }
        }
        return { 
          valid: errors.length === 0, 
          errors, 
          value: d.toISOString().split('T')[0] 
        };
      },
      
      enum(value, allowed, options = {}) {
        const errors = [];
        if (options.required && !value) {
          errors.push('الحقل مطلوب');
          return { valid: false, errors, value: null };
        }
        if (!value) return { valid: true, errors: [], value: null };
        if (!allowed.includes(value)) {
          errors.push('القيمة غير مسموحة. المسموح: ' + allowed.join(', '));
          return { valid: false, errors, value: null };
        }
        return { valid: true, errors: [], value };
      },
      
      // مُحقق Transaction
      transaction(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
          return { valid: false, errors: ['بيانات غير صالحة'], value: null };
        }
        const customerId = Validator.string(data.customerId, { required: true, maxLength: 50 });
        const amount = Validator.number(data.amount, { required: true, min: 0, max: 10000000 });
        const date = Validator.date(data.date, { required: true, notFuture: true });
        const type = Validator.enum(data.type, ['sale', 'return', 'collection', 'discount', 'gift', 'expense'], { required: true });
        const notes = Validator.string(data.notes, { maxLength: 500 });
        const invoice = Validator.string(data.invoice, { maxLength: 50 });
        
        if (!customerId.valid) errors.push(...customerId.errors.map(e => 'العميل: ' + e));
        if (!amount.valid) errors.push(...amount.errors.map(e => 'المبلغ: ' + e));
        if (!date.valid) errors.push(...date.errors.map(e => 'التاريخ: ' + e));
        if (!type.valid) errors.push(...type.errors.map(e => 'النوع: ' + e));
        if (!notes.valid) errors.push(...notes.errors.map(e => 'الملاحظات: ' + e));
        
        if (errors.length > 0) {
          return { valid: false, errors, value: null };
        }
        
        return {
          valid: true,
          errors: [],
          value: {
            customerId: customerId.value,
            amount: amount.value,
            date: date.value,
            type: type.value,
            notes: notes.value,
            invoice: invoice.value
          }
        };
      },
      
      // مُحقق Customer
      customer(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
          return { valid: false, errors: ['بيانات غير صالحة'], value: null };
        }
        const nm = Validator.string(data.nm, { required: true, minLength: 2, maxLength: 100 });
        const phone = Validator.string(data.phone, { pattern: /^[\d\s+\-\(\)]{0,20}$/, patternMessage: 'رقم هاتف غير صالح' });
        
        if (!nm.valid) errors.push(...nm.errors.map(e => 'الاسم: ' + e));
        if (!phone.valid) errors.push(...phone.errors.map(e => 'الهاتف: ' + e));
        
        if (errors.length > 0) {
          return { valid: false, errors, value: null };
        }
        
        return {
          valid: true,
          errors: [],
          value: { nm: nm.value, phone: phone.value }
        };
      },
      
      // مُحقق Product
      product(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
          return { valid: false, errors: ['بيانات غير صالحة'], value: null };
        }
        const nm = Validator.string(data.nm, { required: true, minLength: 1, maxLength: 100 });
        const price = Validator.number(data.price, { min: 0, max: 100000 });
        
        if (!nm.valid) errors.push(...nm.errors.map(e => 'الاسم: ' + e));
        if (!price.valid) errors.push(...price.errors.map(e => 'السعر: ' + e));
        
        if (errors.length > 0) {
          return { valid: false, errors, value: null };
        }
        
        return {
          valid: true,
          errors: [],
          value: { nm: nm.value, price: price.value }
        };
      }
    };
    
    window.NayefValidator = Validator;
    window.Validator = Object.assign(window.Validator || {}, {
      // الحفاظ على التوافق مع Validator القديم + إضافة الجديد
      _v2: Validator,
      transaction: Validator.transaction.bind(Validator),
      customer: Validator.customer.bind(Validator),
      product: Validator.product.bind(Validator)
    });
    
    if (NAYEF_ENV.isDev) {
      Logger.info('Validator v2 ready (extended existing Validator)');
    }
  })();
  