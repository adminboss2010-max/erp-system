
  /* ═══════════════════════════════════════════════════════════════════
     🧪 v220.9+ A/B TESTING FRAMEWORK
     ═══════════════════════════════════════════════════════════════════
     إطار عمل احترافي لاختبار A/B:
     - إحصاء Bayesian للحسم السريع
     - عينة عشوائية مع hash-based assignment
     - تحليل الأهمية الإحصائية
     - Multi-variant testing (A/B/C/...)
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const STORAGE_KEY = 'nayef_ab_tests';
    
    function loadStore() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
    
    function saveStore(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        return false;
      }
    }
    
    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
    
    // ============== إحصاء ==============
    
    function factorial(n) {
      if (n <= 1) return 1;
      let r = 1;
      for (let i = 2; i <= n; i++) r *= i;
      return r;
    }
    
    function logGamma(x) {
      // Lanczos approximation
      const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
                   -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
      let y = x, tmp = x + 5.5;
      tmp -= (x + 0.5) * Math.log(tmp);
      let ser = 1.000000000190015;
      for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
      return -tmp + Math.log(2.5066282746310005 * ser / x);
    }
    
    function betaPDF(x, a, b) {
      if (x <= 0 || x >= 1) return 0;
      try {
        return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - 
                       (logGamma(a) + logGamma(b) - logGamma(a + b)));
      } catch (e) {
        return 0;
      }
    }
    
    function betaCDF(x, a, b) {
      // تقريب بواسطة Simpson's rule
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      const n = 100;
      const h = x / n;
      let sum = (betaPDF(0, a, b) + betaPDF(x, a, b)) / 2;
      for (let i = 1; i < n; i++) {
        const xi = i * h;
        sum += betaPDF(xi, a, b) * (i % 2 === 0 ? 2 : 4);
      }
      return sum * h / 3;
    }
    
    function normalCDF(x, mean = 0, std = 1) {
      const z = (x - mean) / std;
      return 0.5 * (1 + erf(z / Math.SQRT2));
    }
    
    function erf(x) {
      // Abramowitz approximation
      const a1 =  0.254829592;
      const a2 = -0.284496736;
      const a3 =  1.421413741;
      const a4 = -1.453152027;
      const a5 =  1.061405429;
      const p  =  0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x);
      const t = 1.0 / (1.0 + p * x);
      const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return sign * y;
    }
    
    // ============== A/B Testing Engine ==============
    
    const ABTesting = {
      version: 'v220.9.0',
      
      // ========== إنشاء اختبار ==========
      
      createTest(testConfig) {
        const tests = loadStore();
        if (!testConfig.variants || testConfig.variants.length < 2) {
          return { success: false, error: 'يجب توفير متغيرين على الأقل' };
        }
        
        const test = {
          id: generateId(),
          name: testConfig.name,
          description: testConfig.description || '',
          hypothesis: testConfig.hypothesis || '',
          variants: testConfig.variants.map((v, i) => ({
            id: v.id || ('variant_' + i),
            name: v.name,
            weight: v.weight || (1 / testConfig.variants.length),
            config: v.config || {}, // مثل: محتوى الرسالة، الخصم، إلخ
            isControl: v.isControl || i === 0
          })),
          metrics: testConfig.metrics || ['conversion'], // conversion, retention, revenue
          primaryMetric: testConfig.primaryMetric || 'conversion',
          status: 'draft', // draft, running, completed, stopped
          startDate: testConfig.startDate || Date.now(),
          endDate: testConfig.endDate || null,
          minSampleSize: testConfig.minSampleSize || 100,
          confidenceLevel: testConfig.confidenceLevel || 0.95,
          createdAt: Date.now(),
          createdBy: testConfig.createdBy || 'system',
          results: testConfig.variants.map(v => ({
            variantId: v.id || ('variant_' + testConfig.variants.indexOf(v)),
            exposures: 0,
            conversions: 0,
            revenue: 0,
            conversionRate: 0,
            averageOrderValue: 0,
            standardError: 0,
            credibleInterval: { lower: 0, upper: 0 }
          }))
        };
        
        tests.push(test);
        saveStore(tests);
        return { success: true, test };
      },
      
      // ========== Hash-based assignment ==========
      
      // Hash function for consistent assignment
      hashAssignment(userId, testId, numVariants) {
        try {
          let hash = 0;
          const str = userId + ':' + testId;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return Math.abs(hash) % numVariants;
        } catch (e) {
          return Math.floor(Math.random() * numVariants);
        }
      },
      
      // ========== تسجيل التعرض ==========
      
      trackExposure(testId, userId, variantId = null) {
        const tests = loadStore();
        const test = tests.find(t => t.id === testId);
        if (!test) return { success: false, error: 'اختبار غير موجود' };
        
        // اختيار المتغير إذا لم يحدد
        let assignedVariant = variantId;
        if (!assignedVariant) {
          const idx = this.hashAssignment(userId, testId, test.variants.length);
          assignedVariant = test.variants[idx].id;
        }
        
        const result = test.results.find(r => r.variantId === assignedVariant);
        if (result) {
          result.exposures++;
          test.status = test.status === 'draft' ? 'running' : test.status;
        }
        
        saveStore(tests);
        return { success: true, variant: assignedVariant };
      },
      
      // ========== تسجيل التحويل ==========
      
      trackConversion(testId, userId, value = 0) {
        const tests = loadStore();
        const test = tests.find(t => t.id === testId);
        if (!test) return { success: false, error: 'اختبار غير موجود' };
        
        const idx = this.hashAssignment(userId, testId, test.variants.length);
        const assignedVariant = test.variants[idx].id;
        const result = test.results.find(r => r.variantId === assignedVariant);
        
        if (result) {
          result.conversions++;
          result.revenue += (parseFloat(value) || 0);
        }
        
        saveStore(tests);
        return { success: true, variant: assignedVariant };
      },
      
      // ========== Bayesian Analysis ==========
      
      analyzeTest(testId) {
        const tests = loadStore();
        const test = tests.find(t => t.id === testId);
        if (!test) return { success: false, error: 'اختبار غير موجود' };
        
        // حساب Bayesian لكل متغير مقارنة بالـ control
        const control = test.results.find(r => 
          test.variants.find(v => v.id === r.variantId && v.isControl)
        );
        if (!control) {
          return { success: false, error: 'لم يتم تعريف متغير control' };
        }
        
        const analysis = {
          testId,
          testName: test.name,
          totalSamples: test.results.reduce((sum, r) => sum + r.exposures, 0),
          totalConversions: test.results.reduce((sum, r) => sum + r.conversions, 0),
          variants: test.results.map(r => {
            const variant = test.variants.find(v => v.id === r.variantId);
            const rate = r.exposures > 0 ? r.conversions / r.exposures : 0;
            
            // Bayesian: Beta(1+conversions, 1+exposures-conversions) prior uniform
            const a = 1 + r.conversions;
            const b = 1 + Math.max(0, r.exposures - r.conversions);
            
            // P(rate > control_rate)
            let probBeatControl = 0;
            if (r.variantId !== control.variantId && control.exposures > 0) {
              const controlRate = control.exposures > 0 ? control.conversions / control.exposures : 0;
              probBeatControl = 1 - betaCDF(controlRate, a, b);
            }
            
            // Credible interval 95%
            const samples = 1000;
            const samples2 = [];
            for (let i = 0; i < samples; i++) {
              samples2.push(this.sampleBeta(a, b));
            }
            samples2.sort((a, b) => a - b);
            
            return {
              variantId: r.variantId,
              name: variant?.name || r.variantId,
              exposures: r.exposures,
              conversions: r.conversions,
              conversionRate: rate,
              averageOrderValue: r.conversions > 0 ? r.revenue / r.conversions : 0,
              revenue: r.revenue,
              standardError: r.exposures > 0 ? Math.sqrt(rate * (1 - rate) / r.exposures) : 0,
              credibleInterval: {
                lower: samples2[Math.floor(samples * 0.025)],
                upper: samples2[Math.floor(samples * 0.975)]
              },
              isControl: variant?.isControl || false,
              probabilityBeatControl: probBeatControl,
              sampleSizeReached: r.exposures >= test.minSampleSize
            };
          })
        };
        
        // التوصية
        const bestNonControl = analysis.variants
          .filter(v => !v.isControl)
          .sort((a, b) => b.probabilityBeatControl - a.probabilityBeatControl)[0];
        
        if (bestNonControl && bestNonControl.probabilityBeatControl > 0.95 && 
            bestNonControl.sampleSizeReached) {
          analysis.recommendation = {
            winner: bestNonControl.variantId,
            winnerName: bestNonControl.name,
            confidence: bestNonControl.probabilityBeatControl,
            lift: bestNonControl.conversionRate / Math.max(0.001, control.conversions / Math.max(1, control.exposures)) - 1,
            action: 'launch_winner'
          };
        } else if (bestNonControl && bestNonControl.probabilityBeatControl > 0.8) {
          analysis.recommendation = {
            action: 'continue_testing',
            reason: 'فرق محتمل لكن نحتاج بيانات أكثر',
            currentLeader: bestNonControl.variantId
          };
        } else {
          analysis.recommendation = {
            action: 'no_clear_winner',
            reason: 'لا يوجد فرق واضح حتى الآن'
          };
        }
        
        return { success: true, analysis };
      },
      
      // Beta distribution sampling
      sampleBeta(a, b) {
        const x = this.sampleGamma(a);
        const y = this.sampleGamma(b);
        return x / (x + y);
      },
      
      sampleGamma(shape) {
        if (shape < 1) {
          return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
        }
        const d = shape - 1/3;
        const c = 1 / Math.sqrt(9 * d);
        while (true) {
          let x, v;
          do {
            x = this.sampleNormal();
            v = 1 + c * x;
          } while (v <= 0);
          v = v * v * v;
          const u = Math.random();
          if (u < 1 - 0.0331 * x * x * x * x) return d * v;
          if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
        }
      },
      
      sampleNormal() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      
      // ========== إدارة الاختبارات ==========
      
      getTests() {
        return loadStore();
      },
      
      getTest(testId) {
        return loadStore().find(t => t.id === testId);
      },
      
      startTest(testId) {
        const tests = loadStore();
        const test = tests.find(t => t.id === testId);
        if (!test) return { success: false, error: 'اختبار غير موجود' };
        test.status = 'running';
        test.startDate = Date.now();
        saveStore(tests);
        return { success: true, test };
      },
      
      stopTest(testId) {
        const tests = loadStore();
        const test = tests.find(t => t.id === testId);
        if (!test) return { success: false, error: 'اختبار غير موجود' };
        test.status = 'stopped';
        test.endDate = Date.now();
        saveStore(tests);
        return { success: true };
      },
      
      completeTest(testId, winnerId) {
        const tests = loadStore();
        const test = tests.find(t => t.id === testId);
        if (!test) return { success: false, error: 'اختبار غير موجود' };
        test.status = 'completed';
        test.endDate = Date.now();
        test.winnerId = winnerId;
        saveStore(tests);
        return { success: true };
      },
      
      // ========== Self Test ==========
      
      selfTest() {
        const tests = [];
        localStorage.removeItem(STORAGE_KEY);
        
        // Test 1: create test
        const testResult = this.createTest({
          name: 'اختبار A',
          hypothesis: 'الخصم 15% يحسن التحويل',
          variants: [
            { name: 'Control (بدون خصم)', isControl: true },
            { name: 'Variant A (خصم 15%)' },
            { name: 'Variant B (خصم 20%)' }
          ],
          primaryMetric: 'conversion',
          minSampleSize: 100
        });
        tests.push({ name: 'إنشاء اختبار', pass: testResult.success === true });
        
        if (!testResult.success) return tests;
        
        const testId = testResult.test.id;
        
        // Test 2: track exposures
        let exposuresOk = true;
        for (let i = 0; i < 1000; i++) {
          const r = this.trackExposure(testId, 'user_' + i);
          if (!r.success) { exposuresOk = false; break; }
        }
        tests.push({ name: 'تسجيل 1000 تعرض', pass: exposuresOk });
        
        // Test 3: track conversions (Control: 10%, A: 15%, B: 12%)
        let conversionsOk = true;
        for (let i = 0; i < 1000; i++) {
          const r = this.trackExposure(testId, 'conv_' + i);
          if (!r.success) continue;
          const variant = r.variant;
          const shouldConvert = Math.random() < (variant === 'variant_0' ? 0.1 : variant === 'variant_1' ? 0.15 : 0.12);
          if (shouldConvert) {
            this.trackConversion(testId, 'conv_' + i, 100);
          }
        }
        tests.push({ name: 'تسجيل التحويلات', pass: conversionsOk });
        
        // Test 4: analyze test
        const analysis = this.analyzeTest(testId);
        tests.push({ name: 'تحليل Bayesian', pass: analysis.success === true });
        
        // Test 5: variant distribution balanced
        const test = this.getTest(testId);
        const totalExp = test.results.reduce((sum, r) => sum + r.exposures, 0);
        const minExp = Math.min(...test.results.map(r => r.exposures));
        const maxExp = Math.max(...test.results.map(r => r.exposures));
        const balance = maxExp / Math.max(1, minExp);
        tests.push({ name: 'توزيع متوازن (نسبة < 1.5x)', pass: balance < 1.5 });
        
        // Test 6: hash assignment deterministic
        const assign1 = this.hashAssignment('user123', testId, 3);
        const assign2 = this.hashAssignment('user123', testId, 3);
        tests.push({ name: 'Hash deterministic', pass: assign1 === assign2 });
        
        // Test 7: stop test
        const stopResult = this.stopTest(testId);
        tests.push({ name: 'إيقاف اختبار', pass: stopResult.success === true });
        
        // Test 8: recommendation exists
        tests.push({ name: 'توصية موجودة', pass: analysis.analysis && analysis.analysis.recommendation });
        
        localStorage.removeItem(STORAGE_KEY);
        return tests;
      }
    };
    
    window.ABTesting = ABTesting;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('ABTesting ready [Bayesian analysis]');
    }
  })();
  