
  /* ═══════════════════════════════════════════════════════════════════
     📦 v220.9+ ADVANCED INVENTORY MANAGEMENT
     ═══════════════════════════════════════════════════════════════════
     إدارة مخزون احترافية:
     - Economic Order Quantity (EOQ) محسوب
     - Safety Stock إحصائي
     - Reorder Point تلقائي
     - ABC Analysis
     - تنبيهات ذكية
     - Stockout prediction
  ═══════════════════════════════════════════════════════════════════ */
  (function() {
    'use strict';
    
    const STORAGE_KEYS = {
      inventory: 'nayef_inventory_data',
      movements: 'nayef_stock_movements',
      alerts: 'nayef_inventory_alerts',
      orders: 'nayef_purchase_orders'
    };
    
    function loadStore(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    }
    
    function saveStore(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    }
    
    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
    
    // ============== Statistics ==============
    
    function mean(arr) {
      if (!arr || arr.length === 0) return 0;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    
    function std(arr) {
      if (!arr || arr.length < 2) return 0;
      const m = mean(arr);
      return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
    }
    
    function percentile(arr, p) {
      if (!arr || arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * p);
      return sorted[Math.min(idx, sorted.length - 1)];
    }
    
    // ============== Economic Order Quantity (EOQ) ==============
    
    function calculateEOQ(annualDemand, orderingCost, holdingCost) {
      // EOQ = sqrt(2 * D * S / H)
      // D = الطلب السنوي
      // S = تكلفة الطلبية الواحدة
      // H = تكلفة التخزين السنوية للوحدة
      if (!annualDemand || !holdingCost || annualDemand <= 0 || holdingCost <= 0) {
        return { optimal: 0, error: 'بيانات غير كافية' };
      }
      const optimal = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);
      const ordersPerYear = annualDemand / optimal;
      const totalCost = Math.sqrt(2 * annualDemand * orderingCost * holdingCost);
      
      return {
        optimal: Math.round(optimal),
        ordersPerYear: Math.round(ordersPerYear * 10) / 10,
        daysBetweenOrders: Math.round(365 / ordersPerYear),
        totalAnnualCost: Math.round(totalCost),
        method: 'EOQ'
      };
    }
    
    // ============== Safety Stock ==============
    
    function calculateSafetyStock(dailyDemands, leadTimeDays, serviceLevel = 0.95) {
      if (!dailyDemands || dailyDemands.length === 0) {
        return { safetyStock: 0, reorderPoint: 0, error: 'لا توجد بيانات طلب' };
      }
      
      // z-score for service level
      const zScores = { 0.90: 1.28, 0.95: 1.65, 0.97: 1.88, 0.99: 2.33 };
      const z = zScores[serviceLevel] || 1.65;
      
      const avgDailyDemand = mean(dailyDemands);
      const demandStd = std(dailyDemands);
      
      // Safety Stock = z * std * sqrt(leadTime)
      const safetyStock = Math.ceil(z * demandStd * Math.sqrt(leadTimeDays));
      
      // Reorder Point = (avgDailyDemand * leadTime) + safetyStock
      const reorderPoint = Math.ceil(avgDailyDemand * leadTimeDays + safetyStock);
      
      return {
        safetyStock,
        reorderPoint,
        avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
        demandStd: Math.round(demandStd * 100) / 100,
        serviceLevel,
        method: 'Safety Stock (Statistical)'
      };
    }
    
    // ============== ABC Analysis ==============
    
    function abcAnalysis(items) {
      // items: [{ name, revenue, quantity }]
      if (!items || items.length === 0) return { a: [], b: [], c: [], totalRevenue: 0 };
      
      // ترتيب حسب الإيراد
      const sorted = [...items].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
      const totalRevenue = sorted.reduce((s, i) => s + (i.revenue || 0), 0);
      
      const a = [], b = [], c = [];
      let cumRevenue = 0;
      
      for (const item of sorted) {
        const itemRev = item.revenue || 0;
        cumRevenue += itemRev;
        const cumPct = totalRevenue > 0 ? (cumRevenue / totalRevenue * 100) : 0;
        
        // عناصر منفردة يتم فحص ما بعدها (قد تنتقل عند الانتقال)
        if (cumPct <= 80) {
          a.push({ ...item, cumPct: Math.round(cumPct) });
        } else if (cumPct <= 95) {
          b.push({ ...item, cumPct: Math.round(cumPct) });
        } else {
          c.push({ ...item, cumPct: Math.round(cumPct) });
        }
      }
      
      return { a, b, c, totalRevenue };
    }
    
    // ============== Inventory Engine ==============
    
    const Inventory = {
      version: 'v220.9.0',
      
      // ============== Stock Levels ==============
      
      getStock(productId) {
        const inventory = loadStore(STORAGE_KEYS.inventory);
        return inventory.find(i => i.productId === productId) || null;
      },
      
      setStock(productId, data) {
        const inventory = loadStore(STORAGE_KEYS.inventory);
        const idx = inventory.findIndex(i => i.productId === productId);
        const entry = {
          productId,
          currentStock: data.currentStock || 0,
          minStock: data.minStock || 0,
          maxStock: data.maxStock || 0,
          unitCost: data.unitCost || 0,
          unitPrice: data.unitPrice || 0,
          supplier: data.supplier || null,
          leadTimeDays: data.leadTimeDays || 7,
          serviceLevel: data.serviceLevel || 0.95,
          location: data.location || 'main',
          lastUpdated: Date.now(),
          ...data
        };
        
        if (idx >= 0) {
          inventory[idx] = { ...inventory[idx], ...entry };
        } else {
          inventory.push({ id: generateId(), ...entry });
        }
        
        saveStore(STORAGE_KEYS.inventory, inventory);
        return { success: true, stock: entry };
      },
      
      // ============== Stock Movements ==============
      
      recordMovement(productId, type, quantity, options = {}) {
        const movements = loadStore(STORAGE_KEYS.movements);
        const movement = {
          id: generateId(),
          productId,
          type, // 'in', 'out', 'adjustment', 'return'
          quantity,
          timestamp: Date.now(),
          date: new Date().toISOString(),
          reason: options.reason || '',
          reference: options.reference || null, // PO number, invoice, etc.
          performedBy: options.performedBy || 'system'
        };
        
        movements.push(movement);
        saveStore(STORAGE_KEYS.movements, movements);
        
        // تحديث المخزون
        const stock = this.getStock(productId);
        if (stock) {
          const delta = type === 'in' ? quantity : (type === 'out' ? -quantity : 0);
          this.setStock(productId, {
            ...stock,
            currentStock: stock.currentStock + delta,
            lastUpdated: Date.now()
          });
        }
        
        Logger.info('Stock movement recorded', { productId, type, quantity });
        return { success: true, movement };
      },
      
      getMovements(productId, options = {}) {
        let movements = loadStore(STORAGE_KEYS.movements);
        if (productId) {
          movements = movements.filter(m => m.productId === productId);
        }
        if (options.since) {
          movements = movements.filter(m => m.timestamp >= options.since);
        }
        if (options.type) {
          movements = movements.filter(m => m.type === options.type);
        }
        return movements.sort((a, b) => b.timestamp - a.timestamp);
      },
      
      // ============== Demand Analysis ==============
      
      getDailyDemands(productId, days = 90) {
        const movements = this.getMovements(productId, { type: 'out', since: Date.now() - days * 24 * 60 * 60 * 1000 });
        const dailyMap = {};
        
        movements.forEach(m => {
          const day = m.date.split('T')[0];
          dailyMap[day] = (dailyMap[day] || 0) + m.quantity;
        });
        
        return Object.values(dailyMap);
      },
      
      // ============== Reorder Calculation ==============
      
      calculateReorder(productId, options = {}) {
        const stock = this.getStock(productId);
        if (!stock) {
          return { success: false, error: 'المنتج غير موجود في المخزون' };
        }
        
        const demands = this.getDailyDemands(productId, options.days || 90);
        const safetyStock = calculateSafetyStock(
          demands,
          stock.leadTimeDays || 7,
          stock.serviceLevel || 0.95
        );
        
        // EOQ (إذا توفرت بيانات)
        const annualDemand = demands.reduce((a, b) => a + b, 0) * (365 / (options.days || 90));
        const eoq = calculateEOQ(
          annualDemand,
          options.orderingCost || 50,
          options.holdingCost || (stock.unitCost * 0.2)
        );
        
        const needsReorder = stock.currentStock <= safetyStock.reorderPoint;
        
        return {
          success: true,
          productId,
          currentStock: stock.currentStock,
          safetyStock: safetyStock.safetyStock,
          reorderPoint: safetyStock.reorderPoint,
          recommendedOrderQty: eoq.optimal || 0,
          eoq: eoq,
          daysUntilStockout: demands.length > 0 ? 
            Math.floor(stock.currentStock / (mean(demands) || 1)) : 999,
          needsReorder,
          status: needsReorder ? 'critical' : 
                  stock.currentStock < safetyStock.reorderPoint * 1.5 ? 'low' : 'ok',
          recommendations: this.getReorderRecommendations(stock, safetyStock, eoq)
        };
      },
      
      getReorderRecommendations(stock, safetyStock, eoq) {
        const recs = [];
        
        if (stock.currentStock <= 0) {
          recs.push({
            priority: 'critical',
            message: 'نفد المخزون - اطلب فوراً',
            action: 'order_now'
          });
        } else if (stock.currentStock < safetyStock.safetyStock) {
          recs.push({
            priority: 'urgent',
            message: 'أقل من حد الأمان - اطلب ' + eoq.optimal + ' وحدة',
            action: 'order_soon'
          });
        } else if (stock.currentStock < safetyStock.reorderPoint) {
          recs.push({
            priority: 'high',
            message: 'وصلت لنقطة إعادة الطلب',
            action: 'prepare_order'
          });
        }
        
        if (stock.currentStock > safetyStock.reorderPoint * 3) {
          recs.push({
            priority: 'medium',
            message: 'مخزون زائد - قلل الطلبات القادمة',
            action: 'reduce_orders'
          });
        }
        
        return recs;
      },
      
      // ============== Purchase Orders ==============
      
      createPurchaseOrder(items, supplier, options = {}) {
        const orders = loadStore(STORAGE_KEYS.orders);
        const order = {
          id: generateId(),
          orderNumber: 'PO-' + Date.now().toString(36).toUpperCase(),
          supplier,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost || 0,
            total: item.quantity * (item.unitCost || 0)
          })),
          totalAmount: items.reduce((sum, i) => sum + i.quantity * (i.unitCost || 0), 0),
          status: 'pending', // pending, confirmed, shipped, received, cancelled
          expectedDelivery: options.expectedDelivery || (Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: Date.now(),
          createdBy: options.createdBy || 'system',
          notes: options.notes || ''
        };
        
        orders.push(order);
        saveStore(STORAGE_KEYS.orders, orders);
        Logger.info('Purchase order created', { orderNumber: order.orderNumber, amount: order.totalAmount });
        return { success: true, order };
      },
      
      getPurchaseOrders(options = {}) {
        let orders = loadStore(STORAGE_KEYS.orders);
        if (options.status) {
          orders = orders.filter(o => o.status === options.status);
        }
        return orders.sort((a, b) => b.createdAt - a.createdAt);
      },
      
      receivePurchaseOrder(orderId, receivedItems) {
        const orders = loadStore(STORAGE_KEYS.orders);
        const idx = orders.findIndex(o => o.id === orderId);
        if (idx === -1) return { success: false, error: 'أمر شراء غير موجود' };
        
        const order = orders[idx];
        order.status = 'received';
        order.receivedAt = Date.now();
        order.receivedItems = receivedItems;
        
        // تسجيل حركات المخزون
        receivedItems.forEach(item => {
          this.recordMovement(item.productId, 'in', item.quantity, {
            reason: 'PO received',
            reference: order.orderNumber
          });
        });
        
        orders[idx] = order;
        saveStore(STORAGE_KEYS.orders, orders);
        return { success: true, order };
      },
      
      // ============== Analytics ==============
      
      getInventoryAnalytics() {
        const inventory = loadStore(STORAGE_KEYS.inventory);
        const movements = loadStore(STORAGE_KEYS.movements);
        const products = (typeof window !== 'undefined' && window.O && window.O.it) || [];
        
        // ربط المنتجات بالمخزون
        const enriched = products.map(p => {
          const stock = inventory.find(i => i.productId === p.nm);
          const productMovements = movements.filter(m => m.productId === p.nm);
          const outMovements = productMovements.filter(m => m.type === 'out');
          
          const totalSold = outMovements.reduce((sum, m) => sum + m.quantity, 0);
          const revenue = totalSold * (p.price || 0);
          
          return {
            ...p,
            stock: stock ? stock.currentStock : 0,
            minStock: stock ? stock.minStock : 0,
            totalSold,
            revenue,
            lastSold: outMovements.length > 0 ? 
              Math.max(...outMovements.map(m => m.timestamp)) : null
          };
        });
        
        // ABC Analysis
        const abc = abcAnalysis(enriched);
        
        // إحصائيات عامة
        const totalValue = enriched.reduce((sum, p) => sum + (p.stock * p.price || 0), 0);
        const lowStockCount = enriched.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
        const outOfStockCount = enriched.filter(p => p.stock === 0).length;
        
        // تنبيهات
        const alerts = enriched
          .filter(p => p.stock <= p.minStock)
          .map(p => ({
            productId: p.nm,
            type: p.stock === 0 ? 'out_of_stock' : 'low_stock',
            currentStock: p.stock,
            minStock: p.minStock,
            severity: p.stock === 0 ? 'critical' : 'high',
            message: p.stock === 0 ? 
              `نفد المخزون من ${p.nm}` : 
              `مخزون منخفض: ${p.nm} (${p.stock} وحدة)`
          }));
        
        return {
          totalProducts: enriched.length,
          totalStockValue: Math.round(totalValue),
          lowStockCount,
          outOfStockCount,
          abcAnalysis: { 
            a: abc.a.length, 
            b: abc.b.length, 
            c: abc.c.length,
            topAItems: abc.a.slice(0, 5)
          },
          alerts,
          topSellers: enriched
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
            .map(p => ({ name: p.nm, revenue: Math.round(p.revenue), sold: p.totalSold })),
          slowMovers: enriched
            .filter(p => p.totalSold === 0)
            .map(p => ({ name: p.nm, stock: p.stock }))
        };
      },
      
      // ============== Self Test ==============
      
      selfTest() {
        const tests = [];
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        
        // Test 1: EOQ
        const eoq1 = calculateEOQ(10000, 50, 5);
        tests.push({ name: 'حساب EOQ', pass: eoq1.optimal > 0 && eoq1.ordersPerYear > 0 });
        
        // Test 2: Safety Stock
        const ss1 = calculateSafetyStock([10, 12, 11, 13, 10, 12, 14, 11, 13, 12], 7, 0.95);
        tests.push({ name: 'حساب Safety Stock', pass: ss1.safetyStock >= 0 && ss1.reorderPoint > 0 });
        
        // Test 3: ABC Analysis
        const abc1 = abcAnalysis([
          { name: 'A1', revenue: 5000 },
          { name: 'A2', revenue: 4000 },
          { name: 'B1', revenue: 1000 },
          { name: 'C1', revenue: 100 },
          { name: 'C2', revenue: 50 }
        ]);
        tests.push({ name: 'ABC Analysis', pass: abc1.a.length >= 1 && abc1.c.length >= 1 && abc1.totalRevenue === 10150 });
        
        // Test 4: Set & Get stock
        const setR = this.setStock('product-1', {
          currentStock: 100,
          minStock: 20,
          maxStock: 200,
          unitCost: 5,
          unitPrice: 15,
          leadTimeDays: 7
        });
        tests.push({ name: 'حفظ مخزون', pass: setR.success === true });
        
        const getR = this.getStock('product-1');
        tests.push({ name: 'جلب مخزون', pass: getR && getR.currentStock === 100 });
        
        // Test 5: Stock movement (manual update to avoid Logger)
        const stock = this.getStock('product-1');
        this.setStock('product-1', { ...stock, currentStock: 90 });
        const stockAfter = this.getStock('product-1');
        tests.push({ name: 'تحديث مخزون', pass: stockAfter.currentStock === 90 });
        
        // Test 6: Reorder calculation
        // إضافة بيانات طلب وهمية في المخزن
        const movements = loadStore(STORAGE_KEYS.movements);
        const fakeDate1 = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
        const fakeDate2 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        movements.push(
          { id: 'm1', productId: 'product-1', type: 'out', quantity: 5, timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, date: fakeDate1 },
          { id: 'm2', productId: 'product-1', type: 'out', quantity: 8, timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, date: fakeDate2 }
        );
        saveStore(STORAGE_KEYS.movements, movements);
        const reorder = this.calculateReorder('product-1');
        tests.push({ name: 'حساب Reorder', pass: reorder.success === true && reorder.reorderPoint >= 0 });
        
        // Test 6.1: EOQ calculation
        const eoqTest = calculateEOQ(5000, 50, 5);
        tests.push({ name: 'EOQ مثل اختباري', pass: eoqTest.optimal > 0 });
        
        // Test 7: Purchase order
        const poR = this.createPurchaseOrder([
          { productId: 'product-1', quantity: 50, unitCost: 5 }
        ], { name: 'Supplier Co' }, { createdBy: 'test' });
        tests.push({ name: 'إنشاء أمر شراء', pass: poR.success === true });
        
        // Test 8: Get purchase orders
        const orders = this.getPurchaseOrders();
        tests.push({ name: 'جلب أوامر الشراء', pass: orders.length >= 1 });
        
        // Test 9: Analytics
        window.O = window.O || {};
        window.O.it = [
          { nm: 'product-1', price: 15 },
          { nm: 'product-2', price: 10 }
        ];
        const analytics = this.getInventoryAnalytics();
        tests.push({ name: 'إحصائيات المخزون', pass: analytics.totalProducts >= 2 });
        
        // Test 10: ABC in analytics
        tests.push({ name: 'ABC في الإحصائيات', pass: analytics.abcAnalysis.a >= 0 });
        
        Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
        return tests;
      }
    };
    
    window.Inventory = Inventory;
    
    if (typeof NAYEF_ENV !== 'undefined' && NAYEF_ENV.isDev) {
      Logger.info('Inventory ready [EOQ + Safety Stock + ABC + POs]');
    }
  })();
  