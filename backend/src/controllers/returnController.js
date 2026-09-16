const { query, get, run, transaction } = require('../config/db');

function generateSaleReturnNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const last = get(
    `SELECT return_number FROM sales_returns WHERE return_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`SR-${dateStr}-%`]
  );
  let seq = 1;
  if (last && last.return_number) {
    const parts = last.return_number.split('-');
    if (parts.length === 3) seq = parseInt(parts[2], 10) + 1;
  }
  return `SR-${dateStr}-${String(seq).padStart(4, '0')}`;
}

function generatePurchaseReturnNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const last = get(
    `SELECT return_number FROM purchase_returns WHERE return_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`PR-${dateStr}-%`]
  );
  let seq = 1;
  if (last && last.return_number) {
    const parts = last.return_number.split('-');
    if (parts.length === 3) seq = parseInt(parts[2], 10) + 1;
  }
  return `PR-${dateStr}-${String(seq).padStart(4, '0')}`;
}

/**
 * 1. Process Sale Return (سیل واپسی)
 */
function createSaleReturn(req, res) {
  try {
    const {
      invoice_id,
      invoice_number,
      customer_id,
      customer_name,
      customer_phone,
      items,
      refund_mode, // 'cash' or 'khata_credit'
      reason
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Return items cannot be empty' });
    }

    const cashierId = req.user ? req.user.id : 1;
    const returnNumber = generateSaleReturnNumber();

    const result = transaction(({ query, get, run }) => {
      let totalRefund = 0;
      const processedItems = [];

      for (const item of items) {
        const prod = get('SELECT id, name, stock_quantity, sale_price FROM products WHERE id = ?', [item.product_id]);
        if (!prod) throw new Error(`Product not found with ID ${item.product_id}`);

        const qty = Number(item.quantity) || 1;
        const price = item.unit_price !== undefined ? Number(item.unit_price) : prod.sale_price;
        const lineTotal = qty * price;
        totalRefund += lineTotal;

        processedItems.push({
          product_id: prod.id,
          product_name: prod.name,
          quantity: qty,
          unit_price: price,
          total_amount: lineTotal,
          serial_numbers: item.serial_numbers || []
        });
      }

      // Insert return header
      const returnInsert = run(`
        INSERT INTO sales_returns (
          return_number, invoice_id, invoice_number, customer_id,
          customer_name, customer_phone, refund_mode, total_refund_amount,
          reason, cashier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        returnNumber,
        invoice_id || null,
        invoice_number || null,
        customer_id || null,
        customer_name || 'عام واک ان گاہک',
        customer_phone || null,
        refund_mode || 'cash',
        totalRefund,
        reason || 'گاہک نے مال واپس کیا',
        cashierId
      ]);

      const returnId = returnInsert.lastInsertRowid;

      // Insert return items & restore inventory stock
      for (const pItem of processedItems) {
        run(`
          INSERT INTO sales_return_items (
            sales_return_id, product_id, product_name, quantity,
            unit_price, total_amount, serial_numbers
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          returnId,
          pItem.product_id,
          pItem.product_name,
          pItem.quantity,
          pItem.unit_price,
          pItem.total_amount,
          JSON.stringify(pItem.serial_numbers)
        ]);

        // Restore stock
        run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [
          pItem.quantity,
          pItem.product_id
        ]);

        // If serial numbers provided, restore status to in_stock
        if (Array.isArray(pItem.serial_numbers)) {
          for (const sn of pItem.serial_numbers) {
            run(`
              UPDATE serial_numbers SET
                status = 'in_stock',
                customer_id = NULL,
                invoice_id = NULL,
                invoice_item_id = NULL
              WHERE serial_number = ?
            `, [sn.trim()]);
          }
        }
      }

      // Handle ledger adjustments
      if (customer_id) {
        if (refund_mode === 'khata_credit') {
          // Reduce customer's outstanding balance
          run('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?', [
            totalRefund,
            customer_id
          ]);

          run(`
            INSERT INTO ledger_entries (
              party_type, party_id, entry_type, reference_id, reference_no,
              debit, credit, account_id, description, entry_date
            ) VALUES ('client', ?, 'sale_return', ?, ?, 0, ?, NULL, ?, DATE('now'))
          `, [
            customer_id,
            returnId,
            returnNumber,
            totalRefund,
            `Sale Return #${returnNumber} (Khata Credited)`
          ]);
        } else {
          // Cash refunded to customer
          run(`
            INSERT INTO ledger_entries (
              party_type, party_id, entry_type, reference_id, reference_no,
              debit, credit, account_id, description, entry_date
            ) VALUES ('client', ?, 'sale_return', ?, ?, 0, 0, 1, ?, DATE('now'))
          `, [
            customer_id,
            returnId,
            returnNumber,
            `Sale Return #${returnNumber} (Cash Refunded: Rs. ${totalRefund.toLocaleString()})`
          ]);
        }
      }

      // Cash Drawer: If cash was refunded, deduct from open drawer
      if (refund_mode === 'cash') {
        run(`
          UPDATE cash_drawers
          SET cash_expenses = cash_expenses + ?,
              expected_closing_cash = expected_closing_cash - ?
          WHERE cashier_id = ? AND status = 'open'
        `, [totalRefund, totalRefund, cashierId]);
      }

      return { returnId, returnNumber, totalRefund };
    });

    res.status(201).json({
      success: true,
      message: 'Sale return processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Sale return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 2. Process Purchase Return (خریداری واپسی / سپلائر کو واپسی)
 */
function createPurchaseReturn(req, res) {
  try {
    const {
      purchase_id,
      purchase_number,
      supplier_id,
      supplier_name,
      items,
      refund_mode, // 'deduct_balance' or 'cash_received'
      reason
    } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ success: false, message: 'Supplier is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Return items cannot be empty' });
    }

    const cashierId = req.user ? req.user.id : 1;
    const returnNumber = generatePurchaseReturnNumber();

    const result = transaction(({ query, get, run }) => {
      let totalAmount = 0;
      const processedItems = [];

      for (const item of items) {
        const prod = get('SELECT id, name, stock_quantity, cost_price FROM products WHERE id = ?', [item.product_id]);
        if (!prod) throw new Error(`Product not found with ID ${item.product_id}`);

        const qty = Number(item.quantity) || 1;
        if (prod.stock_quantity < qty) {
          throw new Error(`Insufficient stock to return for "${prod.name}". Available in store: ${prod.stock_quantity}, returning: ${qty}`);
        }

        const cost = item.unit_cost !== undefined ? Number(item.unit_cost) : prod.cost_price;
        const lineTotal = qty * cost;
        totalAmount += lineTotal;

        processedItems.push({
          product_id: prod.id,
          product_name: prod.name,
          quantity: qty,
          unit_cost: cost,
          total_amount: lineTotal
        });
      }

      // Insert purchase return header
      const returnInsert = run(`
        INSERT INTO purchase_returns (
          return_number, purchase_id, purchase_number, supplier_id,
          supplier_name, total_amount, refund_mode, reason, cashier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        returnNumber,
        purchase_id || null,
        purchase_number || null,
        supplier_id,
        supplier_name || 'سپلائر',
        totalAmount,
        refund_mode || 'deduct_balance',
        reason || 'سپلائر کو خراب / فالتو مال واپس کیا',
        cashierId
      ]);

      const returnId = returnInsert.lastInsertRowid;

      // Insert items & reduce stock
      for (const pItem of processedItems) {
        run(`
          INSERT INTO purchase_return_items (
            purchase_return_id, product_id, product_name, quantity,
            unit_cost, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          returnId,
          pItem.product_id,
          pItem.product_name,
          pItem.quantity,
          pItem.unit_cost,
          pItem.total_amount
        ]);

        // Reduce stock (goods sent back to vendor)
        run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [
          pItem.quantity,
          pItem.product_id
        ]);
      }

      // Adjust supplier ledger
      if (refund_mode === 'deduct_balance') {
        run('UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?', [
          totalAmount,
          supplier_id
        ]);

        run(`
          INSERT INTO ledger_entries (
            party_type, party_id, entry_type, reference_id, reference_no,
            debit, credit, account_id, description, entry_date
          ) VALUES ('supplier', ?, 'purchase_return', ?, ?, ?, 0, NULL, ?, DATE('now'))
        `, [
          supplier_id,
          returnId,
          returnNumber,
          totalAmount,
          `Purchase Return #${returnNumber} (Supplier Balance Deducted)`
        ]);
      } else {
        // Cash received back from supplier
        run(`
          INSERT INTO ledger_entries (
            party_type, party_id, entry_type, reference_id, reference_no,
            debit, credit, account_id, description, entry_date
          ) VALUES ('supplier', ?, 'purchase_return', ?, ?, 0, 0, 1, ?, DATE('now'))
        `, [
          supplier_id,
          returnId,
          returnNumber,
          `Purchase Return #${returnNumber} (Cash Received: Rs. ${totalAmount.toLocaleString()})`
        ]);

        // Add to cash drawer
        run(`
          UPDATE cash_drawers
          SET cash_sales = cash_sales + ?,
              expected_closing_cash = expected_closing_cash + ?
          WHERE cashier_id = ? AND status = 'open'
        `, [totalAmount, totalAmount, cashierId]);
      }

      return { returnId, returnNumber, totalAmount };
    });

    res.status(201).json({
      success: true,
      message: 'Purchase return processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Purchase return error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 3. Get Sale Returns List
 */
function getSaleReturns(req, res) {
  try {
    const returns = query(`
      SELECT sr.*, u.full_name as cashier_name
      FROM sales_returns sr
      LEFT JOIN users u ON sr.cashier_id = u.id
      ORDER BY sr.id DESC
    `);

    for (const r of returns) {
      r.items = query('SELECT * FROM sales_return_items WHERE sales_return_id = ?', [r.id]);
    }

    res.json({ success: true, count: returns.length, returns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * 4. Get Purchase Returns List
 */
function getPurchaseReturns(req, res) {
  try {
    const returns = query(`
      SELECT pr.*, u.full_name as cashier_name
      FROM purchase_returns pr
      LEFT JOIN users u ON pr.cashier_id = u.id
      ORDER BY pr.id DESC
    `);

    for (const r of returns) {
      r.items = query('SELECT * FROM purchase_return_items WHERE purchase_return_id = ?', [r.id]);
    }

    res.json({ success: true, count: returns.length, returns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  createSaleReturn,
  createPurchaseReturn,
  getSaleReturns,
  getPurchaseReturns
};
