
  /* ═══════════════════════════════════════════════════════════════════
     👁️ v220.9+ OCR SERVICE - قراءة الفواتير والمستندات
     ═══════════════════════════════════════════════════════════════════
     يستخدم Tesseract.js لقراءة النصوص من الصور محلياً
     يستخرج: التاريخ، الأصناف، الكميات، المبالغ
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    let tesseractWorker = null;
    let isInitialized = false;
    let isInitializing = false;
    
    // أنماط regex لاستخراج البيانات
    const Patterns = {
      date: [
        /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/g,
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/g,
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2})/g
      ],
      currency: [
        /(\d+[.,]\d{3})\s*(?:د\.ك|KD|kwd|دينار)/gi,
        /(?:د\.ك|KD|kwd|دينار)\s*(\d+[.,]\d{3})/gi,
        /(\d+[.,]\d{2,3})\s*(?:ر\.س|SAR|ريال)/gi,
        /[\$]\s*(\d+[.,]\d{2})/g,
        /(\d+[.,]\d{3})/g
      ],
      invoiceNumber: [
        /(?:invoice|facture|فاتورة|رقم)\s*[:#]?\s*(\w+[-/]?\d+)/gi,
        /(?:no|num|n°|#)\s*[:#]?\s*(\d+)/gi,
        /INV[-\/]?\d+/gi,
        /فاتورة\s*رقم\s*(\d+)/gi
      ],
      phone: [
        /(?:\+\d{1,3}[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/g,
        /\d{4}\s?\d{4}/g
      ]
    };
    
    function extractFromText(text) {
      const result = {
        rawText: text,
        dates: [],
        amounts: [],
        invoiceNumbers: [],
        phones: [],
        lineItems: [],
        confidence: 0
      };
      
      if (!text || text.length === 0) return result;
      
      // استخراج التواريخ
      Patterns.date.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) result.dates.push(...matches);
      });
      result.dates = [...new Set(result.dates)];
      
      // استخراج المبالغ
      Patterns.currency.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(m => {
            const numStr = m.replace(/[^\d.,]/g, '').replace(',', '.');
            const num = parseFloat(numStr);
            if (!isNaN(num) && num > 0 && num < 1000000) {
              result.amounts.push(num);
            }
          });
        }
      });
      result.amounts = [...new Set(result.amounts)].sort((a, b) => b - a);
      
      // استخراج أرقام الفواتير
      Patterns.invoiceNumber.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) result.invoiceNumbers.push(...matches);
      });
      result.invoiceNumbers = [...new Set(result.invoiceNumbers)].slice(0, 5);
      
      // استخراج أرقام الهواتف
      Patterns.phone.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) result.phones.push(...matches);
      });
      result.phones = [...new Set(result.phones)].slice(0, 3);
      
      // استخراج عناصر الفاتورة (سطور تحتوي أرقام)
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      // pattern: name (any chars) + quantity (digits) + price (3 decimal digits) + optional currency
      const itemPattern = /^(.+?)\s+(\d+)\s+(\d+[.,]\d{3})\s*(?:د\.ك|KD|ر\.س|SAR|\$|دينار|ريال)?\s*$/i;
      lines.forEach(line => {
        const match = line.trim().match(itemPattern);
        if (match) {
          const name = match[1].trim();
          const qty = parseFloat(match[2]);
          const price = parseFloat(match[3].replace(',', '.'));
          if (name.length > 1 && name.length < 60 && qty > 0 && price > 0 && price < 1000000) {
            result.lineItems.push({
              name: name,
              quantity: qty,
              price: price
            });
          }
        }
      });
      
      // حساب الثقة
      let confidence = 0;
      if (result.dates.length > 0) confidence += 0.25;
      if (result.amounts.length > 0) confidence += 0.3;
      if (result.invoiceNumbers.length > 0) confidence += 0.2;
      if (result.lineItems.length > 0) confidence += 0.2;
      if (result.phones.length > 0) confidence += 0.05;
      result.confidence = Math.min(1, confidence);
      
      return result;
    }
    
    function normalizeArabicText(text) {
      if (!text) return '';
      return text
        .replace(/[إأآا]/g, 'ا')
        .replace(/[ىي]/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    async function loadTesseract() {
      if (typeof Tesseract !== 'undefined') return Tesseract;
      return new Promise((resolve, reject) => {
        if (document.querySelector('script[data-ocr]')) {
          const checkInterval = setInterval(() => {
            if (typeof Tesseract !== 'undefined') {
              clearInterval(checkInterval);
              resolve(Tesseract);
            }
          }, 100);
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('Tesseract load timeout'));
          }, 30000);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.setAttribute('data-ocr', 'true');
        script.onload = () => {
          if (typeof Tesseract !== 'undefined') resolve(Tesseract);
          else reject(new Error('Tesseract not available after load'));
        };
        script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
        document.head.appendChild(script);
        setTimeout(() => reject(new Error('Load timeout after 30s')), 30000);
      });
    }
    
    async function initWorker() {
      if (isInitialized) return tesseractWorker;
      if (isInitializing) {
        // انتظر حتى يكتمل التهيئة
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (isInitialized) return tesseractWorker;
        }
        throw new Error('Initialization timeout');
      }
      isInitializing = true;
      try {
        const Tesseract = await loadTesseract();
        tesseractWorker = await Tesseract.createWorker('ara+eng', 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              Logger.debug('OCR progress', m.progress);
            }
          }
        });
        isInitialized = true;
        Logger.info('OCR worker initialized');
        return tesseractWorker;
      } catch (e) {
        Logger.error('OCR init failed', e);
        throw e;
      } finally {
        isInitializing = false;
      }
    }
    
    async function processImage(imageSource) {
      try {
        await initWorker();
        const startTime = Date.now();
        const { data } = await tesseractWorker.recognize(imageSource);
        const duration = Date.now() - startTime;
        
        Logger.info('OCR completed', {
          durationMs: duration,
          textLength: data.text.length,
          confidence: data.confidence
        });
        
        const normalized = normalizeArabicText(data.text);
        const extracted = extractFromText(data.text);
        
        return {
          success: true,
          rawText: data.text,
          normalizedText: normalized,
          extracted,
          confidence: data.confidence / 100,
          duration,
          words: (data.words || []).length
        };
      } catch (e) {
        Logger.error('OCR processing failed', e);
        return {
          success: false,
          error: e.message,
          errorAr: 'فشل في قراءة الصورة. تأكد من جودة الصورة وحاول مرة أخرى.'
        };
      }
    }
    
    async function processPDF(file) {
      // PDF support - تحويل كل صفحة لصورة ثم OCR
      try {
        if (typeof pdfjsLib === 'undefined') {
          await loadPdfJs();
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const pages = [];
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          const result = await processImage(canvas);
          pages.push({ pageNumber: i, ...result });
        }
        
        const combinedText = pages.map(p => p.rawText || '').join('\n');
        const extracted = extractFromText(combinedText);
        
        return {
          success: true,
          pageCount: pdf.numPages,
          pages,
          extracted,
          rawText: combinedText
        };
      } catch (e) {
        Logger.error('PDF OCR failed', e);
        return {
          success: false,
          error: e.message,
          errorAr: 'فشل في قراءة ملف PDF'
        };
      }
    }
    
    async function loadPdfJs() {
      if (typeof pdfjsLib !== 'undefined') return;
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
        script.async = true;
        script.onload = () => {
          if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
            resolve();
          } else {
            reject(new Error('PDF.js not available'));
          }
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(script);
      });
    }
    
    async function processFile(file) {
      try {
        if (!file) {
          return { success: false, error: 'لم يتم اختيار ملف' };
        }
        // التحقق من حجم الملف (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          return {
            success: false,
            error: 'حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)',
            errorAr: 'حجم الملف يتجاوز 10 ميجابايت. يرجى تصغير الصورة أو رفع صورة واحدة فقط.'
          };
        }
        
        const fileType = file.type || '';
        if (fileType.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
          return await processPDF(file);
        } else if (fileType.startsWith('image/')) {
          return await processImage(file);
        } else {
          return {
            success: false,
            error: 'نوع ملف غير مدعوم. يرجى رفع صورة (JPG, PNG) أو PDF',
            errorAr: 'نوع الملف غير مدعوم. الأنواع المدعومة: JPG, PNG, PDF'
          };
        }
      } catch (e) {
        Logger.error('File processing failed', e);
        return {
          success: false,
          error: e.message,
          errorAr: 'حدث خطأ في معالجة الملف'
        };
      }
    }
    
    // تحويل OCR results إلى form قابل للتطبيق في النظام
    function toInvoiceDraft(ocrResult) {
      if (!ocrResult || !ocrResult.success) return null;
      const ext = ocrResult.extracted || {};
      const invoice = {
        date: (ext.dates && ext.dates[0]) || new Date().toISOString().split('T')[0],
        invoiceNumber: (ext.invoiceNumbers && ext.invoiceNumbers[0]) || '',
        items: ext.lineItems || [],
        total: (ext.amounts && ext.amounts[0]) || 0,
        phone: (ext.phones && ext.phones[0]) || '',
        notes: '',
        autoFilled: true,
        ocrConfidence: ocrResult.confidence || 0,
        needsReview: (ocrResult.confidence || 0) < 0.7
      };
      return invoice;
    }
    
    const OCRService = {
      version: 'v220.9.0',
      
      isReady: () => isInitialized,
      
      // استخراج النص من صورة (URL أو File أو canvas)
      recognize: processImage,
      
      // معالجة ملف (صورة أو PDF)
      processFile,
      
      // استخراج البيانات المنظمة
      extractData: extractFromText,
      
      // تحويل إلى فاتورة
      toInvoiceDraft,
      
      // تنظيف الموارد
      async terminate() {
        if (tesseractWorker) {
          await tesseractWorker.terminate();
          tesseractWorker = null;
          isInitialized = false;
          Logger.info('OCR worker terminated');
        }
      },
      
      selfTest() {
        const tests = [
          { name: 'OCR Service معرّف', pass: typeof OCRService !== 'undefined' },
          { name: 'extractData موجود', pass: typeof extractFromText === 'function' },
          { name: 'normalizeArabicText موجود', pass: typeof normalizeArabicText === 'function' },
          { name: 'toInvoiceDraft موجود', pass: typeof toInvoiceDraft === 'function' }
        ];
        // اختبار استخراج البيانات
        const sampleText = 'فاتورة رقم INV-2024-001\n2024-01-15\nصنف 1 5 10.500 د.ك\nصنف 2 3 25.000 د.ك\nالمجموع: 125.000 د.ك\nهاتف: 96512345678';
        const extracted = extractFromText(sampleText);
        tests.push({ name: 'استخراج التواريخ', pass: extracted.dates.length > 0 });
        tests.push({ name: 'استخراج المبالغ', pass: extracted.amounts.length > 0 });
        tests.push({ name: 'استخراج أرقام الفواتير', pass: extracted.invoiceNumbers.length > 0 });
        tests.push({ name: 'استخراج الأصناف', pass: extracted.lineItems.length > 0 });
        tests.push({ name: 'استخراج الهواتف', pass: extracted.phones.length > 0 });
        return tests;
      }
    };
    
    window.OCRService = OCRService;
    
    if (NAYEF_ENV.isDev) {
      Logger.info('OCRService ready [Tesseract.js v5]');
    }
  })();
  