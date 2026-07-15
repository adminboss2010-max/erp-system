
  /* ═══════════════════════════════════════════════════════════════════
     📈 v220.9+ PROPHET-STYLE FORECASTING ENGINE
     ═══════════════════════════════════════════════════════════════════
     تنبؤ احترافي بـ:
     - Ensemble (Linear + Exponential Smoothing + Seasonal + MA)
     - Bootstrap Confidence Intervals (P10, P50, P90)
     - Anomaly Detection (Z-Score)
     - Seasonality Detection (Auto)
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    // ============== أدوات إحصائية ==============
    
    function mean(arr) {
      if (!arr || arr.length === 0) return 0;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    
    function variance(arr) {
      if (!arr || arr.length === 0) return 0;
      const m = mean(arr);
      return arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / arr.length;
    }
    
    function std(arr) {
      return Math.sqrt(variance(arr));
    }
    
    function median(arr) {
      if (!arr || arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    // Random number from normal distribution (Box-Muller)
    function normalRandom() {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
    
    function linearRegression(series) {
      const n = series.length;
      if (n < 2) return { slope: 0, intercept: n === 1 ? series[0] : 0, r2: 0 };
      
      const xs = Array.from({ length: n }, (_, i) => i);
      const xMean = mean(xs);
      const yMean = mean(series);
      
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - xMean) * (series[i] - yMean);
        den += Math.pow(xs[i] - xMean, 2);
      }
      
      const slope = den === 0 ? 0 : num / den;
      const intercept = yMean - slope * xMean;
      
      // R² calculation
      let ssTot = 0, ssRes = 0;
      for (let i = 0; i < n; i++) {
        const predicted = intercept + slope * xs[i];
        ssTot += Math.pow(series[i] - yMean, 2);
        ssRes += Math.pow(series[i] - predicted, 2);
      }
      const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
      
      return { slope, intercept, r2 };
    }
    
    // Moving Average
    function movingAverage(series, window) {
      const result = [];
      for (let i = 0; i < series.length; i++) {
        const start = Math.max(0, i - window + 1);
        const slice = series.slice(start, i + 1);
        result.push(mean(slice));
      }
      return result;
    }
    
    // Exponential Smoothing (Holt's method with trend)
    function exponentialSmoothing(series, alpha = 0.3, beta = 0.1, periods = 3) {
      if (series.length === 0) return { forecast: [], fitted: [] };
      
      const n = series.length;
      const fitted = new Array(n).fill(0);
      let level = series[0];
      let trend = n > 1 ? series[1] - series[0] : 0;
      fitted[0] = level;
      
      for (let i = 1; i < n; i++) {
        const prevLevel = level;
        level = alpha * series[i] + (1 - alpha) * (level + trend);
        trend = beta * (level - prevLevel) + (1 - beta) * trend;
        fitted[i] = level + trend;
      }
      
      const forecast = [];
      for (let h = 1; h <= periods; h++) {
        forecast.push(Math.max(0, level + h * trend));
      }
      
      return { forecast, fitted, level, trend };
    }
    
    // Decomposition: trend + seasonal + residual
    function decompose(series, seasonLength = 12) {
      const n = series.length;
      if (n < seasonLength * 2) {
        // بيانات قصيرة - لا يمكن اكتشاف الموسمية
        return {
          trend: movingAverage(series, 3),
          seasonal: new Array(n).fill(0),
          seasonalPattern: new Array(seasonLength).fill(0),
          residual: series.slice(),
          hasSeasonality: false
        };
      }
      
      // Trend via centered moving average
      const trend = movingAverage(series, seasonLength);
      
      // Detrended series
      const detrended = series.map((v, i) => trend[i] !== null ? v - trend[i] : 0);
      
      // Seasonal pattern
      const seasonal = new Array(seasonLength).fill(0);
      const counts = new Array(seasonLength).fill(0);
      for (let i = 0; i < n; i++) {
        const idx = i % seasonLength;
        if (detrended[i] !== 0 || series[i] !== 0) {
          seasonal[idx] += detrended[i];
          counts[idx]++;
        }
      }
      for (let i = 0; i < seasonLength; i++) {
        seasonal[i] = counts[i] > 0 ? seasonal[i] / counts[i] : 0;
      }
      // Normalize so seasonal averages to zero
      const seasonalMean = mean(seasonal);
      for (let i = 0; i < seasonLength; i++) {
        seasonal[i] -= seasonalMean;
      }
      
      // Extend seasonal to full series length
      const seasonalFull = [];
      for (let i = 0; i < n; i++) {
        seasonalFull.push(seasonal[i % seasonLength]);
      }
      
      // Residual
      const residual = series.map((v, i) => v - trend[i] - seasonalFull[i]);
      
      // Test for seasonality (variance reduction)
      const originalVar = variance(series);
      const residualVar = variance(residual.filter(r => !isNaN(r) && isFinite(r)));
      const hasSeasonality = originalVar > 0 && residualVar < originalVar * 0.85;
      
      return { trend, seasonal: seasonalFull, residual, hasSeasonality, seasonalPattern: seasonal };
    }
    
    // Bootstrap confidence intervals
    function bootstrapIntervals(forecast, residuals, periods, iterations = 1000) {
      const intervals = { p10: [], p50: [], p90: [], p95: [] };
      if (!residuals || residuals.length === 0) {
        for (let i = 0; i < periods; i++) {
          intervals.p10.push(forecast[i] * 0.85);
          intervals.p50.push(forecast[i]);
          intervals.p90.push(forecast[i] * 1.15);
          intervals.p95.push(forecast[i] * 1.2);
        }
        return intervals;
      }
      
      const residualStd = std(residuals);
      const samples = [];
      
      for (let i = 0; i < iterations; i++) {
        const sample = forecast.map(f => Math.max(0, f + normalRandom() * residualStd));
        samples.push(sample);
      }
      
      // Calculate percentiles
      for (let i = 0; i < periods; i++) {
        const periodSamples = samples.map(s => s[i]).sort((a, b) => a - b);
        intervals.p10.push(periodSamples[Math.floor(iterations * 0.10)]);
        intervals.p50.push(periodSamples[Math.floor(iterations * 0.50)]);
        intervals.p90.push(periodSamples[Math.floor(iterations * 0.90)]);
        intervals.p95.push(periodSamples[Math.floor(iterations * 0.95)]);
      }
      
      return intervals;
    }
    
    // Weighted Moving Average
    function weightedMovingAverage(series, periods) {
      if (series.length === 0) return new Array(periods).fill(0);
      const recent = series.slice(-Math.min(series.length, 6));
      const weights = [0.4, 0.25, 0.15, 0.1, 0.06, 0.04].slice(0, recent.length);
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const wma = recent.reduce((sum, v, i) => sum + v * weights[i], 0) / totalWeight;
      return new Array(periods).fill(Math.max(0, wma));
    }
    
    // Anomaly detection using Z-score
    function detectAnomalies(series, threshold = 2.5) {
      if (series.length < 3) return [];
      const m = mean(series);
      const s = std(series);
      if (s === 0) return [];
      
      const anomalies = [];
      series.forEach((value, index) => {
        const zScore = Math.abs((value - m) / s);
        if (zScore > threshold) {
          anomalies.push({
            index,
            value,
            zScore,
            deviation: ((value - m) / m * 100).toFixed(1) + '%'
          });
        }
      });
      return anomalies;
    }
    
    // Detect seasonality strength
    function detectSeasonalityStrength(series) {
      if (series.length < 24) return { hasSeasonality: false, strength: 0 };
      const decomp = decompose(series, 12);
      if (!decomp.hasSeasonality) return { hasSeasonality: false, strength: 0 };
      const seasonalVar = variance(decomp.seasonal.filter(s => !isNaN(s)));
      const totalVar = variance(series);
      const strength = totalVar > 0 ? Math.min(1, seasonalVar / totalVar) : 0;
      return { hasSeasonality: strength > 0.05, strength, pattern: decomp.seasonalPattern };
    }
    
    // ============== محرك التنبؤ الرئيسي ==============
    
    function forecast(series, periods = 3, options = {}) {
      const startTime = Date.now();
      const config = Object.assign({
        seasonLength: 12,
        iterations: 1000,
        anomalyThreshold: 2.5
      }, options || {});
      
      // التحقق من المدخلات
      if (!Array.isArray(series)) {
        return { success: false, error: 'البيانات يجب أن تكون مصفوفة' };
      }
      
      // تنظيف البيانات
      const cleanSeries = series.map(v => {
        const n = parseFloat(v);
        return isNaN(n) || !isFinite(n) ? 0 : Math.max(0, n);
      });
      
      // إذا البيانات قليلة
      if (cleanSeries.length < 3) {
        const avg = mean(cleanSeries);
        return {
          success: true,
          forecast: new Array(periods).fill(avg),
          intervals: null,
          methods: { simple_average: new Array(periods).fill(avg) },
          weights: { simple_average: 1.0 },
          confidence: 0,
          warning: 'بيانات غير كافية - استخدم أكثر من 3 نقاط للحصول على تنبؤ دقيق',
          anomalyCount: 0,
          duration: Date.now() - startTime
        };
      }
      
      // تحضير البيانات
      const decomp = decompose(cleanSeries, config.seasonLength);
      const validTrend = decomp.trend.filter(v => v !== null && !isNaN(v));
      const validResiduals = decomp.residual.filter(v => v !== null && !isNaN(v) && isFinite(v));
      
      // 1. Linear Regression
      const linear = linearRegression(validTrend);
      const linearFc = [];
      for (let k = 1; k <= periods; k++) {
        const v = linear.intercept + linear.slope * (cleanSeries.length + k - 1);
        linearFc.push(Math.max(0, v));
      }
      
      // 2. Exponential Smoothing (Holt's)
      const expResult = exponentialSmoothing(cleanSeries, 0.3, 0.1, periods);
      const expFc = expResult.forecast;
      
      // 3. Seasonal Naive (إذا في seasonality)
      let seasonalFc = [];
      if (decomp.hasSeasonality && cleanSeries.length >= config.seasonLength) {
        const lastSeason = cleanSeries.slice(-config.seasonLength);
        for (let k = 0; k < periods; k++) {
          const trendVal = linear.intercept + linear.slope * (cleanSeries.length + k);
          const seasonIdx = (cleanSeries.length + k) % config.seasonLength;
          const seasonEffect = decomp.seasonalPattern[seasonIdx] || 0;
          seasonalFc.push(Math.max(0, trendVal + seasonEffect));
        }
      } else {
        seasonalFc = linearFc.slice();
      }
      
      // 4. Weighted Moving Average
      const wmaFc = weightedMovingAverage(cleanSeries, periods);
      
      // حساب أوزان بناءً على الدقة التاريخية
      // (في الواقع: نختبر كل طريقة على آخر 30% من البيانات)
      const testSize = Math.max(2, Math.floor(cleanSeries.length * 0.3));
      const trainSize = cleanSeries.length - testSize;
      
      const methodAccuracies = {
        linear: 0,
        exponential: 0,
        seasonal: 0,
        wma: 0
      };
      
      if (trainSize >= 6) {
        const train = cleanSeries.slice(0, trainSize);
        const test = cleanSeries.slice(trainSize);
        
        // Linear on train
        const lrTrain = linearRegression(train);
        const lrPred = [];
        for (let k = 1; k <= test.length; k++) {
          lrPred.push(Math.max(0, lrTrain.intercept + lrTrain.slope * (train.length + k - 1)));
        }
        methodAccuracies.linear = 1 - mape(test, lrPred);
        
        // Exp on train
        const expTrain = exponentialSmoothing(train, 0.3, 0.1, test.length);
        methodAccuracies.exponential = 1 - mape(test, expTrain.forecast);
        
        // Seasonal on train
        if (train.length >= config.seasonLength) {
          const decTrain = decompose(train, config.seasonLength);
          const trendTrain = decTrain.trend.filter(v => v !== null);
          const lrSeasonTrain = linearRegression(trendTrain);
          const seasonPred = [];
          for (let k = 0; k < test.length; k++) {
            const trendV = lrSeasonTrain.intercept + lrSeasonTrain.slope * (train.length + k);
            const seasonIdx = (train.length + k) % config.seasonLength;
            seasonPred.push(Math.max(0, trendV + (decTrain.seasonalPattern[seasonIdx] || 0)));
          }
          methodAccuracies.seasonal = 1 - mape(test, seasonPred);
        } else {
          methodAccuracies.seasonal = methodAccuracies.linear;
        }
        
        // WMA on train
        const wmaPred = weightedMovingAverage(train, test.length);
        methodAccuracies.wma = 1 - mape(test, wmaPred);
      }
      
      // تطبيع الأوزان
      const totalAccuracy = Object.values(methodAccuracies).reduce((a, b) => a + Math.max(0, b), 0);
      const weights = {};
      if (totalAccuracy > 0) {
        Object.keys(methodAccuracies).forEach(k => {
          weights[k] = Math.max(0.05, methodAccuracies[k]) / totalAccuracy;
        });
      } else {
        weights.linear = 0.3;
        weights.exponential = 0.25;
        weights.seasonal = 0.25;
        weights.wma = 0.2;
      }
      
      // Ensemble: مجموع مرجح
      const ensemble = [];
      for (let k = 0; k < periods; k++) {
        const v = (
          weights.linear * linearFc[k] +
          weights.exponential * expFc[k] +
          weights.seasonal * seasonalFc[k] +
          weights.wma * wmaFc[k]
        );
        ensemble.push(Math.max(0, v));
      }
      
      // Confidence Intervals (Bootstrap)
      const intervals = bootstrapIntervals(ensemble, validResiduals, periods, config.iterations);
      
      // Anomalies
      const anomalies = detectAnomalies(cleanSeries, config.anomalyThreshold);
      
      // Insight generation
      const insights = generateInsights({
        trend: linear,
        seasonality: decomp.hasSeasonality,
        series: cleanSeries,
        forecast: ensemble,
        anomalies
      });
      
      // Overall confidence
      const overallConfidence = Math.min(1, 
        linear.r2 * 0.4 +
        Math.min(1, methodAccuracies.linear + 0.5) * 0.3 +
        (decomp.hasSeasonality ? 0.2 : 0.1) +
        Math.max(0, 1 - anomalies.length / Math.max(1, cleanSeries.length)) * 0.1
      );
      
      return {
        success: true,
        forecast: ensemble,
        intervals,
        methods: {
          linear: linearFc,
          exponential: expFc,
          seasonal: seasonalFc,
          weightedMovingAvg: wmaFc
        },
        weights,
        methodAccuracies,
        anomalies,
        hasSeasonality: decomp.hasSeasonality,
        linearTrend: linear,
        insights,
        confidence: overallConfidence,
        modelFit: {
          r2: linear.r2,
          slope: linear.slope,
          trendDirection: linear.slope > 0 ? 'صاعد' : (linear.slope < 0 ? 'هابط' : 'ثابت')
        },
        duration: Date.now() - startTime,
        dataPoints: cleanSeries.length
      };
    }
    
    function mape(actual, predicted) {
      if (!actual || actual.length === 0) return 1;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < actual.length; i++) {
        if (actual[i] > 0) {
          sum += Math.abs(actual[i] - predicted[i]) / actual[i];
          count++;
        }
      }
      return count > 0 ? Math.min(1, sum / count) : 1;
    }
    
    function generateInsights(params) {
      const insights = [];
      const { trend, seasonality, series, forecast, anomalies } = params;
      
      // 1. اتجاه
      if (trend.slope > 0 && trend.r2 > 0.5) {
        const growthPct = ((trend.slope * 12) / Math.max(1, mean(series.slice(-3)))) * 100;
        insights.push({
          type: 'trend',
          level: 'positive',
          message: `📈 اتجاه صاعد: نمو متوقع ${growthPct.toFixed(1)}% سنوياً بثقة ${(trend.r2 * 100).toFixed(0)}%`
        });
      } else if (trend.slope < 0 && trend.r2 > 0.5) {
        const declinePct = ((trend.slope * 12) / Math.max(1, mean(series.slice(-3)))) * 100;
        insights.push({
          type: 'trend',
          level: 'warning',
          message: `📉 اتجاه هابط: انخفاض ${Math.abs(declinePct).toFixed(1)}% سنوياً - يستدعي الانتباه`
        });
      } else {
        insights.push({
          type: 'trend',
          level: 'neutral',
          message: `➡️ أداء مستقر نسبياً (R² = ${(trend.r2 * 100).toFixed(0)}%)`
        });
      }
      
      // 2. الموسمية
      if (seasonality) {
        insights.push({
          type: 'seasonality',
          level: 'info',
          message: '🔄 تم اكتشاف نمط موسمي - التوقعات تأخذ الموسمية بعين الاعتبار'
        });
      }
      
      // 3. الشذوذ
      if (anomalies.length > 0) {
        insights.push({
          type: 'anomaly',
          level: 'warning',
          message: `🚨 ${anomalies.length} قيمة شاذة مكتشفة - قد تحتاج إلى مراجعة`
        });
      } else {
        insights.push({
          type: 'anomaly',
          level: 'success',
          message: '✅ لا توجد قيم شاذة في البيانات'
        });
      }
      
      // 4. الثقة
      const firstForecast = forecast[0] || 0;
      const lastActual = series[series.length - 1] || 0;
      if (lastActual > 0) {
        const changePct = ((firstForecast - lastActual) / lastActual) * 100;
        if (Math.abs(changePct) > 20) {
          insights.push({
            type: 'prediction',
            level: changePct > 0 ? 'positive' : 'warning',
            message: `🎯 التوقع للفترات القادمة يختلف ${Math.abs(changePct).toFixed(0)}% عن آخر قيمة فعلية`
          });
        }
      }
      
      return insights;
    }
    
    const ForecastEngine = {
      version: 'v220.9.0',
      
      forecast,
      
      detectAnomalies,
      
      detectSeasonality(series) {
        return detectSeasonalityStrength(series);
      },
      
      // اختبارات ذاتية
      selfTest() {
        const tests = [];
        
        // Test 1: linear rising - التحقق من النمو في الفترة الثانية أو الثالثة
        const rising = [10, 12, 14, 16, 18, 20, 22, 24];
        const r1 = forecast(rising, 3);
        tests.push({
          name: 'اتجاه صاعد',
          pass: r1.success && (r1.forecast[1] > rising[rising.length - 1] || r1.modelFit.slope > 0)
        });
        
        // Test 2: linear declining
        const declining = [100, 90, 80, 70, 60, 50, 40, 30];
        const r2 = forecast(declining, 3);
        tests.push({
          name: 'اتجاه هابط',
          pass: r2.success && r2.modelFit.slope < 0
        });
        
        // Test 3: seasonal - بيانات كافية (24+)
        const seasonal = [10, 20, 30, 40, 50, 60, 10, 20, 30, 40, 50, 60, 10, 20, 30, 40, 50, 60, 10, 20, 30, 40, 50, 60, 10];
        const r3 = forecast(seasonal, 4);
        tests.push({
          name: 'كشف الموسمية',
          pass: r3.success && r3.hasSeasonality === true
        });
        
        // Test 4: anomaly
        const withAnomaly = [10, 12, 11, 13, 100, 12, 14, 11];
        const r4 = forecast(withAnomaly, 3);
        tests.push({
          name: 'كشف الشذوذ',
          pass: r4.success && r4.anomalies.length > 0
        });
        
        // Test 5: insufficient data
        const small = [10, 20];
        const r5 = forecast(small, 3);
        tests.push({
          name: 'بيانات قليلة - fallback',
          pass: r5.success && r5.warning !== undefined
        });
        
        // Test 6: invalid input
        const r6 = forecast(null, 3);
        tests.push({
          name: 'معالجة مدخل خاطئ',
          pass: r6.success === false
        });
        
        // Test 7: intervals
        tests.push({
          name: 'فترات الثقة موجودة',
          pass: r1.intervals && r1.intervals.p50 && r1.intervals.p50.length === 3
        });
        
        // Test 8: insights
        tests.push({
          name: 'الرؤى (insights) موجودة',
          pass: Array.isArray(r1.insights) && r1.insights.length > 0
        });
        
        return tests;
      }
    };
    
    window.ForecastEngine = ForecastEngine;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('ForecastEngine ready [Ensemble + Bootstrap CI]');
    }
  })();
  