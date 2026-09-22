const { query, get, run, transaction } = require('../config/db');
const { logActivity } = require('../models/ActivityLog');
const syncService = require('../services/syncService');

/**
 * Generate unique Purchase Order Number (e.g. PUR-20260909-0001)
 */
async function generatePurchaseNumber(dbGet = get) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = 'PUR';

  const last = await dbGet(
    'SELECT purchase_number FROM purchases WHERE purchase_number LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}-${dateStr}-%`]
  );

  let seq = 1;
  if (last && last.purchase_number) {
    const parts = last.purchase_number.split('-');
    if (parts.length === 3) seq = parseInt(parts[2], 10) + 1;
  }

  return `${prefix}-${dateStr}-${String(seq).padStart(4, '0')}`;
}

/**
 * Record a New Stock Purchase from Supplier
 * Atomically increases inventory, registers serial numbers, and updates supplier ledger
 */
async function createPurchase(req, res) {
  try {
    const {
      supplier_id,
      supplier_invoice_no,
      purchase_date,
      items, // Array of { product_id, cost_price, sale_price, quantity, serial_numbers }
      discount,
      tax_rate,
      tax_amount,
      paid_amount,
      payment_method,
      notes
    } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ success: false, message: 'Supplier is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one purchase item is required' });
    }

    const supplier = await get('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const purDate = purchase_date || new Date().toISOString().slice(0, 10);

    const result = await transaction(async ({ query: txQuery, get: txGet, run: txRun }) => {
      const purchaseNumber = await generatePurchaseNumber(txGet);

      // 1. Calculate subtotal and validate items
      let subtotal = 0;
      const processedItems = [];

      for (const it of items) {
        const product = await txGet('SELECT * FROM products WHERE id = ?', [it.product_id]);
        if (!product) {
          throw new Error(`Product not found with ID ${it.product_id}`);
        }

        const qty = Number(it.quantity) || 1;
        const costPrice = Number(it.cost_price) || 0;
        const salePrice = it.sale_price !== undefined ? Number(it.sale_price) : product.sale_price;
        const lineTotal = costPrice * qty;
        subtotal += lineTotal;

        processedItems.push({
          product,
          qty,
          costPrice,
          salePrice,
          lineTotal,
          serials: it.serial_numbers || []
        });
      }

      const disc = Number(discount) || 0;
      const taxableAmount = Math.max(0, subtotal - disc);
      const tRate = Number(tax_rate) || 0;
      let tAmount = (tax_amount !== undefined && tax_amount !== null && tax_amount !== '')
        ? Number(tax_amount)
        : Math.round(((taxableAmount * tRate) / 100) * 100) / 100;
      tAmount = Math.max(0, tAmount);

      const grandTotal = Math.round((taxableAmount + tAmount) * 100) / 100;
      const paid = Math.round((Number(paid_amount) || 0) * 100) / 100;
      const balanceDue = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
      const excessPaid = Math.max(0, Math.round((paid - grandTotal) * 100) / 100);

      // Supplier balance invariant: New Balance = Previous Balance + Grand Total - Paid
      const currentSupBal = Math.round(Number(supplier.current_balance || 0) * 100) / 100;
      const newSupBal = Math.round((currentSupBal + grandTotal - paid) * 100) / 100;

      // 2. Insert Purchase Header
      const insPur = await txRun(`
        INSERT INTO purchases (
          purchase_number, supplier_id, supplier_invoice_no, purchase_date,
          subtotal, discount, tax_rate, tax_amount, grand_total, paid_amount, balance_due,
          previous_supplier_balance, new_supplier_balance,
          payment_method, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
      `, [
        purchaseNumber,
        supplier_id,
        supplier_invoice_no || null,
        purDate,
        subtotal,
        disc,
        tRate,
        tAmount,
        grandTotal,
        paid,
        balanceDue,
        currentSupBal,
        newSupBal,
        payment_method || 'cash',
        notes || null
      ]);

      const purchaseId = insPur.lastInsertRowid;

      // 3. Process Line Items: Add stock, update cost/sale prices, register serials
      for (const it of processedItems) {
        const piRes = await txRun(`
          INSERT INTO purchase_items (
            purchase_id, product_id, product_name, cost_price, sale_price,
            quantity, total_cost
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          purchaseId,
          it.product.id,
          it.product.name,
          it.costPrice,
          it.salePrice,
          it.qty,
          it.lineTotal
        ]);
        const purchaseItemId = piRes.lastInsertRowid;

        // Increment stock and update prices on product
        await txRun(`
          UPDATE products SET
            stock_quantity = stock_quantity + ?,
            cost_price = ?,
            sale_price = ?,
            supplier_id = COALESCE(supplier_id, ?),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [it.qty, it.costPrice, it.salePrice, supplier_id, it.product.id]);

        // Insert new serial numbers into stock if provided
        if (it.product.has_serials && it.serials.length > 0) {
          for (const sn of it.serials) {
            const clean = sn.trim();
            if (!clean) continue;
            await txRun(`
              INSERT INTO serial_numbers (
                serial_number, product_id, purchase_id, purchase_item_id, status
              ) VALUES (?, ?, ?, ?, 'in_stock')
              ON CONFLICT(serial_number) DO UPDATE SET
                status = 'in_stock',
                purchase_id = excluded.purchase_id,
                purchase_item_id = excluded.purchase_item_id
            `, [clean, it.product.id, purchaseId, purchaseItemId]);
          }
        }
      }

      // 4. Update Supplier Khata / Ledger
      await txRun('UPDATE suppliers SET current_balance = ? WHERE id = ?', [newSupBal, supplier_id]);

      let ledgerDesc = `Stock Purchase Bill #${supplier_invoice_no || purchaseNumber}`;
      if (excessPaid > 0) {
        ledgerDesc += ` (Bill: Rs. ${grandTotal.toLocaleString()}, Paid: Rs. ${paid.toLocaleString()}, Khata Wasooli/Adaigi: -Rs. ${excessPaid.toLocaleString()})`;
      } else if (paid > 0 && paid < grandTotal) {
        ledgerDesc += ` (Bill: Rs. ${grandTotal.toLocaleString()}, Paid: Rs. ${paid.toLocaleString()}, Naya Udhar: +Rs. ${balanceDue.toLocaleString()})`;
      } else if (paid === 0) {
        ledgerDesc += ` (Full Credit / Poora Udhar: Rs. ${grandTotal.toLocaleString()})`;
      }

      // Record in ledger: Purchase Bill (Credit increases what we owe, Debit reflects immediate payment)
      const cashAccId = (payment_method === 'cash' && paid > 0) ? 1 : null;
      await txRun(`
        INSERT INTO ledger_entries (
          party_type, party_id, entry_type, reference_id, reference_no,
          debit, credit, account_id, description, entry_date
        ) VALUES ('supplier', ?, 'purchase_bill', ?, ?, ?, ?, ?, ?, ?)
      `, [
        supplier_id,
        purchaseId,
        purchaseNumber,
        paid, // Amount paid immediately
        grandTotal, // Total bill amount
        cashAccId,
        ledgerDesc + (payment_method ? ` [via ${payment_method}]` : ''),
        purDate
      ]);

      // If paid by cash, record into active cash drawer expenses/outflow
      if (payment_method === 'cash' && paid > 0) {
        const cashierId = req.user?.id || 1;
        try {
          await txRun(`
            UPDATE cash_drawers
            SET cash_expenses = cash_expenses + ?,
                expected_closing_cash = expected_closing_cash - ?
            WHERE cashier_id = ? AND status = 'open'
          `, [paid, paid, cashierId]);
        } catch (_) {}
      }

      return {
        purchaseId,
        purchaseNumber,
        grandTotal,
        paid,
        balanceDue,
        previous_supplier_balance: currentSupBal,
        new_supplier_balance: newSupBal
      };
    });

    syncService.enqueueSync('purchases', result.purchaseId, 'insert');
    if (supplier_id) {
      syncService.enqueueSync('suppliers', supplier_id, 'update');
    }

    return res.status(201).json({
      success: true,
      message: 'Stock purchase recorded successfully',
      purchase: result
    });
  } catch (error) {
    console.error('createPurchase error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get all purchases with filters
 */
async function getPurchases(req, res) {
  try {
    const { supplier_id, search, start_date, end_date, status = 'active', limit = 100 } = req.query;

    let sql = `
      SELECT p.*, s.name as supplier_name, s.phone as supplier_phone
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    const cleanSupplierId = (supplier_id && supplier_id !== 'undefined' && supplier_id !== 'null' && supplier_id !== '') ? supplier_id : null;
    const cleanSearch = (search && search !== 'undefined' && search !== 'null') ? search.trim() : null;
    const cleanStartDate = (start_date && start_date !== 'undefined' && start_date !== 'null' && start_date !== '') ? start_date : null;
    const cleanEndDate = (end_date && end_date !== 'undefined' && end_date !== 'null' && end_date !== '') ? end_date : null;

    if (status === 'active') {
      sql += " AND (p.status IS NULL OR p.status = 'completed')";
    } else if (status === 'voided') {
      sql += " AND (p.status = 'void' OR p.status = 'cancelled')";
    }

    if (cleanSupplierId) {
      sql += ' AND p.supplier_id = ?';
      params.push(cleanSupplierId);
    }
    if (cleanSearch) {
      sql += ' AND (p.purchase_number LIKE ? COLLATE NOCASE OR p.supplier_invoice_no LIKE ? COLLATE NOCASE OR s.name LIKE ? COLLATE NOCASE)';
      params.push(`%${cleanSearch}%`, `%${cleanSearch}%`, `%${cleanSearch}%`);
    }
    if (cleanStartDate) {
      sql += ' AND p.purchase_date >= ?';
      params.push(cleanStartDate);
    }
    if (cleanEndDate) {
      sql += ' AND p.purchase_date <= ?';
      params.push(cleanEndDate);
    }

    sql += ' ORDER BY p.id DESC LIMIT ?';
    params.push(Number(limit));

    const purchases = await query(sql, params);

    // Attach items summary so user sees what products are in each purchase directly
    const purchaseIds = purchases.map(p => p.id);
    if (purchaseIds.length > 0) {
      const items = await query(`
        SELECT purchase_id, product_name, quantity, total_cost 
        FROM purchase_items 
        WHERE purchase_id IN (${purchaseIds.map(() => '?').join(',')})
      `, purchaseIds);
      const itemsMap = {};
      for (const it of items) {
        if (!itemsMap[it.purchase_id]) itemsMap[it.purchase_id] = [];
        itemsMap[it.purchase_id].push(`${it.product_name} (${it.quantity}x)`);
      }
      purchases.forEach(p => {
        p.items_summary = (itemsMap[p.id] || []).join(', ');
        p.items_count = (itemsMap[p.id] || []).length;
      });
    }

    return res.json({ success: true, count: purchases.length, purchases });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get detailed purchase record with line items
 */
async function getPurchaseDetails(req, res) {
  try {
    const { id } = req.params;
    const purchase = await get(`
      SELECT p.*, s.name as supplier_name, s.contact_person, s.phone as supplier_phone, s.address as supplier_address
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ? OR p.purchase_number = ?
    `, [id, id]);

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase record not found' });
    }

    const items = await query(`
      SELECT pi.*, p.barcode
      FROM purchase_items pi
      LEFT JOIN products p ON pi.product_id = p.id
      WHERE pi.purchase_id = ?
    `, [purchase.id]);

    // Fetch serial numbers created under this purchase
    const serials = await query('SELECT serial_number, product_id, purchase_item_id FROM serial_numbers WHERE purchase_id = ?', [purchase.id]);

    const itemsWithSerials = items.map(it => ({
      ...it,
      serials: serials
        .filter(s => s.purchase_item_id ? s.purchase_item_id === it.id : s.product_id === it.product_id)
        .map(s => s.serial_number)
    }));

    return res.json({ success: true, purchase: { ...purchase, items: itemsWithSerials } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Void / Cancel a Stock Purchase (Return to Supplier)
 * Atomically deducts inventory stock, frees/marks serials as returned, and adjusts supplier ledger
 */
async function voidPurchase(req, res) {
  try {
    const purchaseId = Number(req.params.id);
    const { reason } = req.body;

    if (!purchaseId) {
      return res.status(400).json({ success: false, message: 'Valid Purchase ID is required' });
    }

    const voidReason = (reason && reason.trim()) ? reason.trim() : 'Stock returned to supplier / Voided by admin';
    const voidedBy = req.user ? req.user.id : 1;

    const result = await transaction(async ({ query: txQuery, get: txGet, run: txRun }) => {
      // 1. Fetch purchase record
      const purchase = await txGet('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
      if (!purchase) {
        throw new Error('Purchase record not found');
      }
      if (purchase.status === 'void' || purchase.status === 'cancelled') {
        throw new Error(`Purchase #${purchase.purchase_number} is already marked as ${purchase.status}`);
      }

      // 2. Fetch line items
      const items = await txQuery('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);

      // 3. Verify stock availability before deducting to prevent negative stock
      for (const it of items) {
        if (it.product_id) {
          const prod = await txGet('SELECT id, name, stock_quantity FROM products WHERE id = ?', [it.product_id]);
          if (!prod) continue;
          if (prod.stock_quantity < it.quantity) {
            throw new Error(
              `خریداری بل منسوخ نہیں ہو سکتا: سامان "${prod.name}" کا موجودہ اسٹاک صرف ${prod.stock_quantity} ہے، جبکہ بل میں ${it.quantity} واپس کرنے ہیں۔ کچھ سامان پہلے ہی فروخت ہو چکا ہے!`
            );
          }
        }
      }

      // 4. Deduct inventory stock
      for (const it of items) {
        if (it.product_id) {
          await txRun(
            'UPDATE products SET stock_quantity = CASE WHEN stock_quantity - ? < 0 THEN 0 ELSE stock_quantity - ? END, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [it.quantity, it.quantity, it.product_id]
          );
        }
      }

      // 5. Update serial numbers to returned status
      await txRun(`
        UPDATE serial_numbers SET
          status = 'returned'
        WHERE purchase_id = ? AND status = 'in_stock'
      `, [purchaseId]);

      // 6. Update Purchase Header
      await txRun(`
        UPDATE purchases SET
          status = 'void',
          void_reason = ?,
          voided_at = CURRENT_TIMESTAMP,
          voided_by = ?
        WHERE id = ?
      `, [voidReason, voidedBy, purchaseId]);

      // 7. Adjust Supplier Ledger
      const supplier = await txGet('SELECT * FROM suppliers WHERE id = ?', [purchase.supplier_id]);
      if (supplier) {
        const grandTotal = Number(purchase.grand_total) || 0;
        const paid = Number(purchase.paid_amount) || 0;
        const netPurchaseDelta = grandTotal - paid;
        const newSupBalance = Math.round(((supplier.current_balance || 0) - netPurchaseDelta) * 100) / 100;

        await txRun('UPDATE suppliers SET current_balance = ? WHERE id = ?', [newSupBalance, purchase.supplier_id]);

        // Log reversing entry in ledger: Supplier Void
        const cashAccId = (purchase.payment_method === 'cash' && paid > 0) ? 1 : null;
        await txRun(`
          INSERT INTO ledger_entries (
            party_type, party_id, entry_type, reference_id, reference_no,
            debit, credit, account_id, description, entry_date
          ) VALUES ('supplier', ?, 'purchase_void', ?, ?, ?, ?, ?, ?, DATE('now'))
        `, [
          purchase.supplier_id,
          purchaseId,
          purchase.purchase_number,
          grandTotal,
          paid,
          cashAccId,
          `VOIDED PURCHASE #${purchase.purchase_number} - ${voidReason}`
        ]);
      }

      // 8. If paid in cash, refund back to open cash drawer
      if (purchase.payment_method === 'cash' && Number(purchase.paid_amount || 0) > 0) {
        const cashRefund = Number(purchase.paid_amount);
        await txRun(`
          UPDATE cash_drawers
          SET cash_expenses = CASE WHEN cash_expenses - ? < 0 THEN 0 ELSE cash_expenses - ? END,
              expected_closing_cash = expected_closing_cash + ?
          WHERE status = 'open'
        `, [cashRefund, cashRefund, cashRefund]);
      }

      return {
        purchase_id: purchaseId,
        purchase_number: purchase.purchase_number,
        void_reason: voidReason
      };
    });

    await logActivity({
      userId: voidedBy,
      username: req.user ? req.user.username : 'Admin',
      action: 'purchase_void',
      description: `خریداری بل منسوخ: #${result.purchase_number} - وجہ: ${result.void_reason}`
    });

    return res.json({
      success: true,
      message: `Purchase #${result.purchase_number} successfully voided. Stock & Supplier Khata restored.`,
      result
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = {
  createPurchase,
  getPurchases,
  getPurchaseDetails,
  voidPurchase
};
