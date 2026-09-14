const { query, get, run, transaction, getDb } = require('../config/db');

/**
 * Generate unique Invoice Number (e.g. UCA-20260909-0001)
 */
function generateInvoiceNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = 'UCA';

  // Find latest invoice of today
  const last = get(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${dateStr}-%`]
  );

  let seq = 1;
  if (last && last.invoice_number) {
    const parts = last.invoice_number.split('-');
    if (parts.length === 3) {
      seq = parseInt(parts[2], 10) + 1;
    }
  }

  const seqStr = String(seq).padStart(4, '0');
  return `${prefix}-${dateStr}-${seqStr}`;
}

/**
 * Process a POS Sale Transaction (Atomic ACID transaction)
 */
function createInvoice(req, res) {
  try {
    const {
      customer_mode,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      items, // Array of { product_id, quantity, unit_price, serial_numbers }
      discount_type, // 'percentage' or 'amount'
      discount_value,
      tax_rate,
      payment_method, // 'cash', 'card', 'online', 'split'
      paid_amount,
      notes
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items cannot be empty' });
    }

    const cashierId = req.user ? req.user.id : 1;

    // Run transaction
    const invoiceResult = transaction(({ query, get, run }) => {
      // 1. Resolve or create Customer (Match by ID, Phone, or Name)
      let customerId = customer_id ? Number(customer_id) : null;
      const cleanPhone = customer_phone ? customer_phone.trim() : null;
      let cleanName = customer_name ? customer_name.trim() : '';

      if (customerId) {
        const custRecord = get('SELECT id, name, phone FROM customers WHERE id = ?', [customerId]);
        if (custRecord) {
          if (!cleanName) cleanName = custRecord.name;
        } else {
          customerId = null;
        }
      }

      if (!customerId && cleanPhone) {
        let existingCust = get('SELECT id, name, total_spent FROM customers WHERE phone = ?', [cleanPhone]);
        if (existingCust) {
          customerId = existingCust.id;
          if (!cleanName) cleanName = existingCust.name;
        }
      }

      if (!customerId && cleanName && cleanName.toLowerCase() !== 'walk-in customer') {
        let existingByName = get('SELECT id, name FROM customers WHERE LOWER(name) = LOWER(?)', [cleanName]);
        if (existingByName) {
          customerId = existingByName.id;
        }
      }

      // 2. Validate Items, Stock Availability & Calculate Totals
      let subtotal = 0;
      const processedItems = [];

      for (const item of items) {
        const product = get('SELECT * FROM products WHERE id = ?', [item.product_id]);
        if (!product) {
          throw new Error(`Product not found with ID ${item.product_id}`);
        }

        const qty = Number(item.quantity) || 1;
        if (product.stock_quantity < qty) {
          throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, Requested: ${qty}`);
        }

        // Validate serial numbers if product has_serials
        if (product.has_serials) {
          const itemSerials = Array.isArray(item.serial_numbers) ? item.serial_numbers : [];
          if (itemSerials.length !== qty) {
            throw new Error(`Product "${product.name}" requires exactly ${qty} serial number(s). Provided: ${itemSerials.length}`);
          }
        }

        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : product.sale_price;
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;

        processedItems.push({
          product,
          qty,
          unitPrice,
          lineTotal,
          costPrice: product.cost_price,
          warrantyMonths: product.warranty_months || 0,
          serials: item.serial_numbers || []
        });
      }

      // 3. Calculate Discount, Tax, and Grand Total
      let discAmount = 0;
      const discVal = Number(discount_value) || 0;
      if (discount_type === 'percentage') {
        discAmount = (subtotal * discVal) / 100;
      } else {
        discAmount = discVal;
      }
      discAmount = Math.min(discAmount, subtotal); // Cannot exceed subtotal
      discAmount = Math.round(discAmount * 100) / 100;

      const taxableAmount = Math.round((subtotal - discAmount) * 100) / 100;
      const tRate = Number(tax_rate) || 0;
      const taxAmount = Math.round(((taxableAmount * tRate) / 100) * 100) / 100;
      const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

      const paid = (paid_amount !== undefined && paid_amount !== null && paid_amount !== '')
        ? Math.round(Number(paid_amount) * 100) / 100
        : grandTotal;

      // Check if this transaction is for a wholesale party or customer with ledger
      const isPartyMode = customer_mode === 'party' || Boolean(customerId);

      let changeAmount = 0;
      let balanceDue = 0;
      let excessPaidToKhata = 0;

      if (isPartyMode && customerId) {
        // Wholesale Party / Customer Khata invoice:
        // Any excess payment over grandTotal directly reduces their previous ledger balance, NOT returned as cash change
        if (paid >= grandTotal) {
          balanceDue = 0;
          changeAmount = 0;
          excessPaidToKhata = Math.round((paid - grandTotal) * 100) / 100;
        } else {
          balanceDue = Math.round((grandTotal - paid) * 100) / 100;
          changeAmount = 0;
          excessPaidToKhata = 0;
        }
      } else {
        // Walk-in retail counter customer
        changeAmount = Math.max(0, Math.round((paid - grandTotal) * 100) / 100);
        balanceDue = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
      }

      // If Udhar exists (balanceDue > 0) or customer details provided, ensure customer record exists
      if (balanceDue > 0 && !customerId) {
        const fallbackName = cleanName && cleanName.toLowerCase() !== 'walk-in customer' ? cleanName : 'واک ان ادھار گاہک';
        const newCust = run(
          'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
          [fallbackName, cleanPhone || null, customer_email || null]
        );
        customerId = newCust.lastInsertRowid;
        if (!cleanName || cleanName.toLowerCase() === 'walk-in customer') cleanName = fallbackName;
      } else if (!customerId && (cleanPhone || (cleanName && cleanName.toLowerCase() !== 'walk-in customer' && cleanName !== 'عام واک ان گاہک'))) {
        const newCust = run(
          'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
          [cleanName || 'عام واک ان گاہک', cleanPhone || null, customer_email || null]
        );
        customerId = newCust.lastInsertRowid;
      }

      if (!cleanName || cleanName.toLowerCase() === 'walk-in customer') cleanName = 'عام واک ان گاہک';

      // Read previous customer balance before this invoice
      let prevCustomerBalance = 0;
      let newCustomerBalance = 0;
      if (customerId) {
        const custRecord = get('SELECT current_balance FROM customers WHERE id = ?', [customerId]);
        prevCustomerBalance = custRecord ? Number(custRecord.current_balance || 0) : 0;

        // Customer Balance Delta:
        // New Balance = Previous Balance + Grand Total - Paid
        const netKhataDelta = Math.round((grandTotal - paid) * 100) / 100;
        newCustomerBalance = Math.round((prevCustomerBalance + netKhataDelta) * 100) / 100;
      }

      // 4. Insert Invoice Header
      const invoiceNumber = generateInvoiceNumber();
      const invoiceInsert = run(`
        INSERT INTO invoices (
          invoice_number, customer_id, customer_name, customer_phone,
          cashier_id, subtotal, discount_type, discount_value,
          discount_amount, tax_rate, tax_amount, grand_total,
          paid_amount, change_amount, balance_due, payment_method, notes,
          previous_customer_balance, new_customer_balance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceNumber,
        customerId,
        cleanName,
        cleanPhone,
        cashierId,
        subtotal,
        discount_type || 'amount',
        discVal,
        discAmount,
        tRate,
        taxAmount,
        grandTotal,
        paid,
        changeAmount,
        balanceDue,
        payment_method || 'cash',
        notes || null,
        prevCustomerBalance,
        newCustomerBalance
      ]);

      const invoiceId = invoiceInsert.lastInsertRowid;

      // 5. Insert Line Items, Update Product Stock, and Assign Serial Numbers
      for (const item of processedItems) {
        // Insert line item
        const itemInsert = run(`
          INSERT INTO invoice_items (
            invoice_id, product_id, product_name, cost_price,
            unit_price, quantity, total_price, warranty_months
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId,
          item.product.id,
          item.product.name,
          item.costPrice,
          item.unitPrice,
          item.qty,
          item.lineTotal,
          item.warrantyMonths
        ]);

        const invoiceItemId = itemInsert.lastInsertRowid;

        // Deduct product stock quantity
        run(`UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`, [item.qty, item.product.id]);

        // Process serialized components
        if (item.product.has_serials && item.serials.length > 0) {
          for (const sn of item.serials) {
            const cleanSN = sn.trim();
            // Calculate warranty expiry date
            const warrantyMonths = item.warrantyMonths || 12;
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);
            const expiryStr = expiryDate.toISOString();

            // Check if serial exists in stock or is new
            const existingSerial = get('SELECT id, status FROM serial_numbers WHERE serial_number = ?', [cleanSN]);

            if (existingSerial) {
              run(`
                UPDATE serial_numbers SET
                  status = 'sold',
                  invoice_id = ?,
                  invoice_item_id = ?,
                  customer_id = ?,
                  sold_date = CURRENT_TIMESTAMP,
                  warranty_expiry_date = ?
                WHERE id = ?
              `, [invoiceId, invoiceItemId, customerId, expiryStr, existingSerial.id]);
            } else {
              // Automatically register serial number as sold
              run(`
                INSERT INTO serial_numbers (
                  serial_number, product_id, status, invoice_id,
                  invoice_item_id, customer_id, sold_date, warranty_expiry_date
                ) VALUES (?, ?, 'sold', ?, ?, ?, CURRENT_TIMESTAMP, ?)
              `, [cleanSN, item.product.id, invoiceId, invoiceItemId, customerId, expiryStr]);
            }
          }
        }
      }

      // 6. Update Customer Lifetime Spend and Khata / Ledger Balance
      if (customerId) {
        run('UPDATE customers SET total_spent = total_spent + ?, current_balance = ? WHERE id = ?', [
          grandTotal,
          newCustomerBalance,
          customerId
        ]);

        // If there was a credit/udhar balance or payment, log in ledger
        if (grandTotal > 0 || paid > 0) {
          let ledgerDesc = `Sale Invoice #${invoiceNumber}`;
          if (balanceDue > 0) {
            ledgerDesc += ` (Udhar: Rs. ${balanceDue.toLocaleString()})`;
          } else if (excessPaidToKhata > 0) {
            ledgerDesc += ` (Bill: Rs. ${grandTotal.toLocaleString()}, Paid: Rs. ${paid.toLocaleString()}, Khata Wasooli: -Rs. ${excessPaidToKhata.toLocaleString()})`;
          } else {
            ledgerDesc += ` (Paid in Full)`;
          }

          run(`
            INSERT INTO ledger_entries (
              party_type, party_id, entry_type, reference_id, reference_no,
              debit, credit, balance, description, payment_method, entry_date
            ) VALUES ('customer', ?, 'sale_invoice', ?, ?, ?, ?, ?, ?, ?, DATE('now'))
          `, [
            customerId,
            invoiceId,
            invoiceNumber,
            grandTotal, // Debit: Total sale billed
            paid, // Credit: Amount received immediately
            newCustomerBalance,
            ledgerDesc,
            payment_method || 'cash'
          ]);
        }
      }

      // 7. If cash payment and there is an open cash drawer, update drawer cash_sales
      if (payment_method === 'cash') {
        const cashReceived = (isPartyMode && customerId) ? paid : Math.min(paid, grandTotal);
        run(`
          UPDATE cash_drawers
          SET cash_sales = cash_sales + ?,
              expected_closing_cash = expected_closing_cash + ?
          WHERE cashier_id = ? AND status = 'open'
        `, [cashReceived, cashReceived, cashierId]);
      }

      return { invoiceId, invoiceNumber };
    });

    // Fetch complete invoice record for thermal receipt response
    const fullInvoice = getFullInvoiceDetails(invoiceResult.invoiceId);

    return res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      invoice: fullInvoice
    });
  } catch (error) {
    console.error('Sale transaction failed:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Fetch complete invoice with line items, serial numbers, cashier, and store info
 */
function getFullInvoiceDetails(invoiceId) {
  const invoice = get(`
    SELECT inv.*, u.full_name as cashier_name,
           c.current_balance as live_customer_balance
    FROM invoices inv
    LEFT JOIN users u ON inv.cashier_id = u.id
    LEFT JOIN customers c ON inv.customer_id = c.id
    WHERE inv.id = ?
  `, [invoiceId]);

  if (!invoice) return null;

  invoice.customer_balance = (invoice.new_customer_balance !== null && invoice.new_customer_balance !== undefined)
    ? invoice.new_customer_balance
    : invoice.live_customer_balance;

  const items = query(`
    SELECT ii.*, p.barcode
    FROM invoice_items ii
    LEFT JOIN products p ON ii.product_id = p.id
    WHERE ii.invoice_id = ?
  `, [invoiceId]);

  // Fetch serial numbers linked to this invoice
  const serials = query(`
    SELECT serial_number, product_id, warranty_expiry_date
    FROM serial_numbers
    WHERE invoice_id = ?
  `, [invoiceId]);

  // Map serial numbers to respective items
  const itemsWithSerials = items.map(item => ({
    ...item,
    serial_numbers: serials
      .filter(s => s.product_id === item.product_id)
      .map(s => ({
        serial_number: s.serial_number,
        warranty_expiry: s.warranty_expiry_date
      }))
  }));

  // Fetch store settings for receipt branding
  const settingsRows = query('SELECT key, value FROM store_settings');
  const storeSettings = {};
  settingsRows.forEach(s => {
    storeSettings[s.key] = s.value;
  });

  return {
    ...invoice,
    items: itemsWithSerials,
    store: storeSettings
  };
}

/**
 * Get all invoices with filtering (search, date range, status)
 */
function getInvoices(req, res) {
  try {
    const { search, start_date, end_date, limit = 50 } = req.query;

    let sql = `
      SELECT inv.*, u.full_name as cashier_name
      FROM invoices inv
      LEFT JOIN users u ON inv.cashier_id = u.id
      WHERE 1=1
    `;
    const params = [];

    const cleanSearch = (search && search !== 'undefined' && search !== 'null') ? search.trim() : null;
    const cleanStartDate = (start_date && start_date !== 'undefined' && start_date !== 'null' && start_date !== '') ? start_date : null;
    const cleanEndDate = (end_date && end_date !== 'undefined' && end_date !== 'null' && end_date !== '') ? end_date : null;

    if (cleanSearch) {
      sql += ` AND (inv.invoice_number LIKE ? COLLATE NOCASE OR inv.customer_name LIKE ? COLLATE NOCASE OR inv.customer_phone LIKE ? COLLATE NOCASE)`;
      params.push(`%${cleanSearch}%`, `%${cleanSearch}%`, `%${cleanSearch}%`);
    }

    if (cleanStartDate) {
      sql += ` AND DATE(inv.created_at) >= DATE(?)`;
      params.push(cleanStartDate);
    }

    if (cleanEndDate) {
      sql += ` AND DATE(inv.created_at) <= DATE(?)`;
      params.push(cleanEndDate);
    }

    sql += ` ORDER BY inv.id DESC LIMIT ?`;
    params.push(Number(limit));

    const invoices = query(sql, params);
    return res.json({ success: true, count: invoices.length, invoices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get single invoice details by invoice_number or ID
 */
function getInvoiceDetails(req, res) {
  try {
    const { identifier } = req.params;
    let invoice = null;

    if (isNaN(identifier)) {
      const row = get('SELECT id FROM invoices WHERE invoice_number = ?', [identifier]);
      if (row) invoice = getFullInvoiceDetails(row.id);
    } else {
      invoice = getFullInvoiceDetails(Number(identifier));
    }

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    return res.json({ success: true, invoice });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get customers list with balance and lifetime spending
 */
function getCustomers(req, res) {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY current_balance DESC, name ASC';
    const customers = query(sql, params);
    return res.json({ success: true, customers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create a new customer record directly
 */
function createCustomer(req, res) {
  try {
    const { name, phone, email, address, opening_balance } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const openBal = Number(opening_balance) || 0;
    const result = run(
      'INSERT INTO customers (name, phone, email, address, current_balance) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), phone ? phone.trim() : null, email ? email.trim() : null, address ? address.trim() : null, openBal]
    );

    const customerId = result.lastInsertRowid;

    if (openBal > 0) {
      run(`
        INSERT INTO ledger_entries (
          party_type, party_id, entry_type, debit, credit, balance, description, entry_date
        ) VALUES ('customer', ?, 'opening_balance', ?, 0, ?, 'Opening Balance (Previous Udhar)', DATE('now'))
      `, [customerId, openBal, openBal]);
    }

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customerId
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Void / Cancel an Invoice (Sales Order)
 * Reverses stock, frees serial numbers, and logs reversal in customer khata/ledger
 */
function voidInvoice(req, res) {
  try {
    const invoiceId = Number(req.params.id);
    const { reason } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Valid Invoice ID is required' });
    }

    const voidReason = (reason && reason.trim()) ? reason.trim() : 'Customer returned / Voided by Cashier';
    const voidedBy = req.user ? req.user.id : 1;

    const result = transaction(({ query, get, run }) => {
      // 1. Fetch invoice and ensure it exists and isn't already voided
      const invoice = get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      if (invoice.status === 'void' || invoice.status === 'cancelled') {
        throw new Error(`Invoice #${invoice.invoice_number} is already marked as ${invoice.status}`);
      }

      // 2. Fetch line items
      const items = query('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

      // 3. Restore product inventory stock
      for (const it of items) {
        if (it.product_id) {
          run(
            'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [it.quantity, it.product_id]
          );
        }
      }

      // 4. Return serialized components to 'in_stock'
      run(`
        UPDATE serial_numbers SET
          status = 'in_stock',
          invoice_id = NULL,
          invoice_item_id = NULL,
          sold_date = NULL,
          warranty_expiry_date = NULL,
          customer_id = NULL
        WHERE invoice_id = ?
      `, [invoiceId]);

      // 5. Update Invoice Header
      run(`
        UPDATE invoices SET
          status = 'void',
          void_reason = ?,
          voided_at = CURRENT_TIMESTAMP,
          voided_by = ?
        WHERE id = ?
      `, [voidReason, voidedBy, invoiceId]);

      // 6. Reverse Customer Khata / Ledger
      if (invoice.customer_id) {
        const customer = get('SELECT * FROM customers WHERE id = ?', [invoice.customer_id]);
        if (customer) {
          const grandTotal = Number(invoice.grand_total) || 0;
          const paid = Number(invoice.paid_amount) || 0;
          const netInvoiceDelta = grandTotal - paid;
          const newCustBalance = Math.round(((customer.current_balance || 0) - netInvoiceDelta) * 100) / 100;
          const newTotalSpent = Math.max(0, (customer.total_spent || 0) - grandTotal);

          run(
            'UPDATE customers SET current_balance = ?, total_spent = ? WHERE id = ?',
            [newCustBalance, newTotalSpent, invoice.customer_id]
          );

          // Log reversing entry in ledger
          run(`
            INSERT INTO ledger_entries (
              party_type, party_id, entry_type, reference_id, reference_no,
              debit, credit, balance, description, payment_method, entry_date
            ) VALUES ('customer', ?, 'sale_void', ?, ?, ?, ?, ?, ?, 'void', DATE('now'))
          `, [
            invoice.customer_id,
            invoiceId,
            invoice.invoice_number,
            paid,
            grandTotal,
            newCustBalance,
            `VOIDED #${invoice.invoice_number} - ${voidReason}`
          ]);
        }
      }

      // 7. If cash payment, deduct refunded cash from open cash drawer so cash reconciliation is exact
      if (invoice.payment_method === 'cash') {
        const cashRefund = invoice.customer_id
          ? Number(invoice.paid_amount || 0)
          : Math.min(Number(invoice.paid_amount || 0), Number(invoice.grand_total || 0));
        if (cashRefund > 0) {
          run(`
            UPDATE cash_drawers
            SET cash_sales = MAX(0, cash_sales - ?),
                expected_closing_cash = MAX(0, expected_closing_cash - ?)
            WHERE status = 'open' AND (cashier_id = ? OR id = (SELECT id FROM cash_drawers WHERE status = 'open' ORDER BY id DESC LIMIT 1))
          `, [cashRefund, cashRefund, voidedBy]);
        }
      }

      return {
        success: true,
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        void_reason: voidReason,
        items_restored: items.length
      };
    });

    return res.json({
      success: true,
      message: `Invoice #${result.invoice_number} successfully voided. Stock & Khata restored.`,
      result
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceDetails,
  getFullInvoiceDetails,
  getCustomers,
  createCustomer,
  voidInvoice
};
