
  /* ═══════════════════════════════════════════════════════════════════
     🛡️ v220.9+ TYPE SAFETY (TypeScript-like Runtime Types)
     ═══════════════════════════════════════════════════════════════════
     نظام أمان نوعي يحاكي TypeScript:
     - تعريف schemas للأنواع المهمة
     - التحقق عند الحدود (function calls, storage I/O)
     - رسائل خطأ واضحة مع أسماء الحقول
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    // تعريف الأنواع الأساسية
    const T = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      date: 'date',
      array: 'array',
      object: 'object',
      any: 'any',
      null: 'null',
      undefined: 'undefined'
    };
    
    // ============== Type Checkers ==============
    
    function getType(value) {
      if (value === null) return T.null;
      if (value === undefined) return T.undefined;
      if (Array.isArray(value)) return T.array;
      if (value instanceof Date) return T.date;
      return typeof value;
    }
    
    function isOfType(value, expectedType) {
      const actualType = getType(value);
      
      if (expectedType === T.any) return true;
      if (expectedType === T.date) {
        return value instanceof Date && !isNaN(value.getTime());
      }
      if (expectedType === T.array) {
        return Array.isArray(value);
      }
      if (expectedType === T.null) {
        return value === null;
      }
      if (expectedType === T.number) {
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
      }
      return actualType === expectedType;
    }
    
    // ============== Schema Definition ==============
    
    class Schema {
      constructor(definition) {
        this.definition = definition;
        this.optional = false;
      }
      
      optional_(value) {
        const s = new Schema(this.definition);
        s.optional = true;
        return s;
      }
      
      validate(data, fieldName = 'value') {
        const errors = [];
        
        // Handle null/undefined
        if (data === null || data === undefined) {
          if (this.optional) return { valid: true, errors: [], value: undefined };
          errors.push(fieldName + ' is required');
          return { valid: false, errors, value: undefined };
        }
        
        // Type check
        const def = this.definition;
        if (def.type) {
          if (!isOfType(data, def.type)) {
            errors.push(fieldName + ': expected ' + def.type + ', got ' + getType(data));
            return { valid: false, errors, value: undefined };
          }
        }
        
        // Range checks for numbers
        if (def.type === T.number) {
          if (def.min !== undefined && data < def.min) {
            errors.push(fieldName + ': must be >= ' + def.min);
          }
          if (def.max !== undefined && data > def.max) {
            errors.push(fieldName + ': must be <= ' + def.max);
          }
          if (def.integer && !Number.isInteger(data)) {
            errors.push(fieldName + ': must be integer');
          }
        }
        
        // String checks
        if (def.type === T.string) {
          if (def.minLength !== undefined && data.length < def.minLength) {
            errors.push(fieldName + ': min length ' + def.minLength);
          }
          if (def.maxLength !== undefined && data.length > def.maxLength) {
            errors.push(fieldName + ': max length ' + def.maxLength);
          }
          if (def.pattern && !def.pattern.test(data)) {
            errors.push(fieldName + ': pattern mismatch');
          }
        }
        
        // Enum check
        if (def.enum && !def.enum.includes(data)) {
          errors.push(fieldName + ': must be one of ' + def.enum.join(', '));
        }
        
        // Object schema
        if (def.type === T.object && def.schema) {
          const objResult = validateObject(data, def.schema, fieldName);
          if (!objResult.valid) {
            errors.push(...objResult.errors);
          } else {
            return { valid: errors.length === 0, errors, value: objResult.value };
          }
        }
        
        // Array schema
        if (def.type === T.array && def.items) {
          if (!Array.isArray(data)) {
            errors.push(fieldName + ': expected array');
          } else {
            const validatedArray = [];
            for (let i = 0; i < data.length; i++) {
              const itemResult = def.items.validate(data[i], fieldName + '[' + i + ']');
              if (!itemResult.valid) {
                errors.push(...itemResult.errors);
              }
              validatedArray.push(itemResult.value);
            }
            return { valid: errors.length === 0, errors, value: validatedArray };
          }
        }
        
        return {
          valid: errors.length === 0,
          errors,
          value: data
        };
      }
    }
    
    function validateObject(data, schema, prefix = '') {
      const errors = [];
      const validated = {};
      
      Object.keys(schema).forEach(key => {
        const fieldSchema = schema[key];
        const fieldName = prefix ? prefix + '.' + key : key;
        const value = data ? data[key] : undefined;
        const result = fieldSchema.validate(value, fieldName);
        if (!result.valid) {
          errors.push(...result.errors);
        }
        validated[key] = result.value;
      });
      
      // Check for extra keys (if strict)
      Object.keys(data || {}).forEach(key => {
        if (!(key in schema)) {
          // Extra key warning - not error
        }
      });
      
      return {
        valid: errors.length === 0,
        errors,
        value: validated
      };
    }
    
    // ============== Schema Definitions for Nayef System ==============
    
    const Schemas = {
      // معاملة
      Transaction: new Schema({
        type: T.object,
        schema: {
          client: new Schema({ type: T.string, minLength: 1, maxLength: 100 }),
          cl: new Schema({ type: T.string, minLength: 1, maxLength: 100 }).optional_(true),
          amount: new Schema({ type: T.number, min: 0, max: 10000000 }),
          dt: new Schema({ type: T.string, pattern: /^\d{4}-\d{2}-\d{2}$/ }),
          date: new Schema({ type: T.string, pattern: /^\d{4}-\d{2}-\d{2}$/ }).optional_(true),
          tp: new Schema({ type: T.string, enum: ['sale', 'return', 'payment', 'opening', 'credit_note', 'debit_note'] }),
          type: new Schema({ type: T.string, enum: ['sale', 'return', 'payment', 'opening', 'credit_note', 'debit_note'] }).optional_(true),
          invoice: new Schema({ type: T.string, maxLength: 50 }).optional_(true),
          item: new Schema({ type: T.string, maxLength: 100 }).optional_(true),
          product: new Schema({ type: T.string, maxLength: 100 }).optional_(true),
          notes: new Schema({ type: T.string, maxLength: 500 }).optional_(true)
        }
      }),
      
      // عميل
      Customer: new Schema({
        type: T.object,
        schema: {
          nm: new Schema({ type: T.string, minLength: 1, maxLength: 100 }),
          name: new Schema({ type: T.string, minLength: 1, maxLength: 100 }).optional_(true),
          phone: new Schema({ type: T.string, pattern: /^[\d\s+\-\(\)]{0,20}$/ }).optional_(true),
          region: new Schema({ type: T.string, maxLength: 50 }).optional_(true),
          notes: new Schema({ type: T.string, maxLength: 500 }).optional_(true)
        }
      }),
      
      // مندوب
      Agent: new Schema({
        type: T.object,
        schema: {
          nm: new Schema({ type: T.string, minLength: 1, maxLength: 100 }),
          name: new Schema({ type: T.string, maxLength: 100 }).optional_(true),
          phone: new Schema({ type: T.string, pattern: /^[\d\s+\-\(\)]{0,20}$/ }).optional_(true),
          v: new Schema({ type: T.array }).optional_(true),
          commission: new Schema({ type: T.number, min: 0, max: 100 }).optional_(true)
        }
      }),
      
      // منتج
      Product: new Schema({
        type: T.object,
        schema: {
          nm: new Schema({ type: T.string, minLength: 1, maxLength: 100 }),
          name: new Schema({ type: T.string, maxLength: 100 }).optional_(true),
          price: new Schema({ type: T.number, min: 0, max: 100000 }),
          cost: new Schema({ type: T.number, min: 0, max: 100000 }).optional_(true),
          category: new Schema({ type: T.string, maxLength: 50 }).optional_(true)
        }
      }),
      
      // مصروف
      Expense: new Schema({
        type: T.object,
        schema: {
          amount: new Schema({ type: T.number, min: 0, max: 1000000 }),
          category: new Schema({ type: T.string, maxLength: 50 }),
          date: new Schema({ type: T.string, pattern: /^\d{4}-\d{2}-\d{2}$/ }),
          description: new Schema({ type: T.string, maxLength: 200 }).optional_(true)
        }
      }),
      
      // مصفوفة أرقام
      NumberArray: new Schema({ type: T.array }),
      
      // سلسلة نصية
      NonEmptyString: new Schema({ type: T.string, minLength: 1 }),
      
      // رقم موجب
      PositiveNumber: new Schema({ type: T.number, min: 0 })
    };
    
    // ============== Helper Functions ==============
    
    function safeCall(fn, args, schema) {
      if (!schema) {
        try {
          return { success: true, result: fn.apply(null, args) };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      // Validate args first
      const validatedArgs = [];
      for (let i = 0; i < args.length; i++) {
        const argSchema = Array.isArray(schema) ? schema[i] : schema;
        const result = argSchema.validate(args[i], 'arg' + i);
        if (!result.valid) {
          Logger.warn('Type validation failed', { errors: result.errors });
          return { success: false, errors: result.errors };
        }
        validatedArgs.push(result.value);
      }
      try {
        return { success: true, result: fn.apply(null, validatedArgs) };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    
    // ============== Type Checking Wrappers ==============
    
    function assertType(value, expectedType, fieldName) {
      if (!isOfType(value, expectedType)) {
        const err = fieldName + ': expected ' + expectedType + ', got ' + getType(value);
        Logger.error('Type assertion failed', null, { fieldName, expectedType, actualType: getType(value) });
        throw new TypeError(err);
      }
      return value;
    }
    
    function assertSchema(data, schema, fieldName) {
      const result = schema.validate(data, fieldName || 'data');
      if (!result.valid) {
        Logger.error('Schema validation failed', null, { errors: result.errors });
        throw new TypeError('Validation failed: ' + result.errors.join(', '));
      }
      return result.value;
    }
    
    // ============== Storage Type Safety ==============
    
    function safeStorageGet(key, schema) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return { exists: false, value: null };
        const parsed = JSON.parse(raw);
        if (schema) {
          const result = schema.validate(parsed, key);
          if (!result.valid) {
            Logger.warn('Storage data validation failed', { key, errors: result.errors });
            return { exists: true, value: parsed, warnings: result.errors };
          }
          return { exists: true, value: result.value };
        }
        return { exists: true, value: parsed };
      } catch (e) {
        Logger.error('Storage get failed', e, { key });
        return { exists: false, value: null, error: e.message };
      }
    }
    
    function safeStorageSet(key, value, schema) {
      try {
        let dataToStore = value;
        if (schema) {
          const result = schema.validate(value, key);
          if (!result.valid) {
            Logger.warn('Storage set validation failed', { key, errors: result.errors });
            return { success: false, errors: result.errors };
          }
          dataToStore = result.value;
        }
        localStorage.setItem(key, JSON.stringify(dataToStore));
        return { success: true };
      } catch (e) {
        Logger.error('Storage set failed', e, { key });
        return { success: false, error: e.message };
      }
    }
    
    // ============== Public API ==============
    
    const TypeSafety = {
      version: 'v220.9.0',
      T,
      Schema,
      Schemas,
      
      // Type checkers
      isString: (v) => isOfType(v, T.string),
      isNumber: (v) => isOfType(v, T.number),
      isBoolean: (v) => isOfType(v, T.boolean),
      isArray: (v) => isOfType(v, T.array),
      isObject: (v) => isOfType(v, T.object),
      isDate: (v) => isOfType(v, T.date),
      
      getType,
      
      // Assertions
      assertType,
      assertSchema,
      
      // Validation
      validate(data, schema, fieldName) {
        return schema.validate(data, fieldName);
      },
      
      // Safe execution
      safeCall,
      
      // Storage helpers
      safeStorageGet,
      safeStorageSet,
      
      // اختبارات ذاتية
      selfTest() {
        const tests = [];
        
        // Type checks
        tests.push({ name: 'string check', pass: TypeSafety.isString('hello') === true });
        tests.push({ name: 'number check', pass: TypeSafety.isNumber(42) === true });
        tests.push({ name: 'NaN check', pass: TypeSafety.isNumber(NaN) === false });
        tests.push({ name: 'array check', pass: TypeSafety.isArray([]) === true });
        tests.push({ name: 'date check', pass: TypeSafety.isDate(new Date()) === true });
        tests.push({ name: 'invalid date check', pass: TypeSafety.isDate(new Date('invalid')) === false });
        
        // Schema validation
        const txValid = Schemas.Transaction.validate({
          client: 'Test', amount: 100, dt: '2024-01-15', tp: 'sale'
        }, 'tx');
        tests.push({ name: 'Transaction صحيح', pass: txValid.valid === true });
        
        const txInvalid = Schemas.Transaction.validate({
          client: '', amount: -50, dt: '2024-01-15', tp: 'unknown'
        }, 'tx');
        tests.push({ name: 'Transaction خاطئ', pass: txInvalid.valid === false });
        
        const txMissing = Schemas.Transaction.validate({
          amount: 100, dt: '2024-01-15'
        }, 'tx');
        tests.push({ name: 'Transaction حقول ناقصة', pass: txMissing.valid === false });
        
        const customerValid = Schemas.Customer.validate({
          nm: 'أحمد', phone: '96512345678'
        }, 'customer');
        tests.push({ name: 'Customer صحيح', pass: customerValid.valid === true });
        
        const customerInvalid = Schemas.Customer.validate({
          nm: '', phone: 'invalid-phone-format-very-long-string-that-might-fail-regex-test'
        }, 'customer');
        tests.push({ name: 'Customer برقم خاطئ', pass: customerInvalid.valid === false });
        
        // Storage
        const setResult = safeStorageSet('nayef_test_' + Date.now(), { test: 'value' });
        tests.push({ name: 'Storage Set', pass: setResult.success === true });
        
        const getResult = safeStorageGet('nayef_test_' + Date.now());
        tests.push({ name: 'Storage Get', pass: getResult.exists === true });
        
        // Assertions
        try {
          assertType('hello', T.string, 'test');
          tests.push({ name: 'assertType صحيح', pass: true });
        } catch (e) {
          tests.push({ name: 'assertType صحيح', pass: false });
        }
        
        try {
          assertType(42, T.string, 'test');
          tests.push({ name: 'assertType خاطئ', pass: false });
        } catch (e) {
          tests.push({ name: 'assertType خاطئ يرمي خطأ', pass: true });
        }
        
        return tests;
      }
    };
    
    window.TypeSafety = TypeSafety;
    window.T = T;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('TypeSafety ready [' + Object.keys(Schemas).length + ' schemas]');
    }
  })();
  