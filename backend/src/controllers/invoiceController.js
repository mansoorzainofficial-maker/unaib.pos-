const { query, get, run, transaction } = require('../config/db');
const { logActivity } = require('../models/ActivityLog');

/**
 * Generate unique Invoice Number (e.g. UCA-20260909-0001)
 */
async function generateInvoiceNumber(dbGet = get) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = 'UCA';

  // Find latest invoice of today
  const last = await dbGet(
    'SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1',
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
async function createInvoice(req, res) {
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
      shipping_cost,
      shipping_notes,
      extra_charges,
      payment_method, // 'cash', 'card', 'online', 'split'
      paid_amount,
      notes,
      show_previous_balance,
      is_offline_sync,
      offline_created_at,
      offline_local_id
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items cannot be empty' });
    }

    const cashierId = req.user ? req.user.id : 1;

    // Run transaction
    const invoiceResult = await transaction(async ({ query: txQuery, get: txGet, run: txRun }) => {
      // 0. Offline Deduplication Check: Prevent duplicate invoices and double stock reduction
      if (offline_local_id) {
        const marker = `[OFFLINE_ID:${offline_local_id}]`;
        const existingInvoice = await txGet(
          'SELECT id, invoice_number, grand_total, paid_amount, balance_due FROM invoices WHERE notes LIKE ? LIMIT 1',
          [`%${marker}%`]
        );
        if (existingInvoice) {
          return {
            id: existingInvoice.id,
            invoice_number: existingInvoice.invoice_number,
            grand_total: existingInvoice.grand_total,
            paid_amount: existingInvoice.paid_amount,
            balance_due: existingInvoice.balance_due,
            already_synced: true
          };
        }
      }

      // 1. Resolve or create Customer (Match by ID, Phone, or Name)
      let customerId = customer_id ? Number(customer_id) : null;
      const cleanPhone = customer_phone ? customer_phone.trim() : null;
      let cleanName = customer_name ? customer_name.trim() : '';

      if (customerId) {
        const custRecord = await txGet('SELECT id, name, phone FROM customers WHERE id = ?', [customerId]);
        if (custRecord) {
          if (!cleanName) cleanName = custRecord.name;
        } else {
          customerId = null;
        }
      }

      if (!customerId && cleanPhone) {
        let existingCust = await txGet('SELECT id, name, total_spent FROM customers WHERE phone = ?', [cleanPhone]);
        if (existingCust) {
          customerId = existingCust.id;
          if (!cleanName) cleanName = existingCust.name;
        }
      }

      if (!customerId && cleanName && cleanName.toLowerCase() !== 'walk-in customer') {
        let existingByName = await txGet('SELECT id, name FROM customers WHERE LOWER(name) = LOWER(?)', [cleanName]);
        if (existingByName) {
          customerId = existingByName.id;
        }
      }

      // 2. Validate Items, Stock Availability & Calculate Totals
      let subtotal = 0;
      const processedItems = [];
      const stockWarnings = [];

      for (const item of items) {
        const product = await txGet('SELECT * FROM products WHERE id = ?', [item.product_id]);
        if (!product) {
          throw new Error(`Product not found with ID ${item.product_id}`);
        }

        const qty = Number(item.quantity) || 1;
        const availableStock = Number(product.stock_quantity) || 0;

        if (availableStock < qty) {
          if (is_offline_sync) {
            const oversold = qty - Math.max(0, availableStock);
            stockWarnings.push({
              product_id: product.id,
              product_name: product.name,
              available: availableStock,
              quantity_sold: qty,
              quantity_oversold: oversold,
              message: `"${product.name}" اسٹاک سے زیادہ فروخت ہو چکا ہے (موجود تھا: ${availableStock}، فروخت ہوا: ${qty}، منفی: -${oversold})۔ براہ کرم دستی طور پر چیک کریں۔`
            });
          } else {
            throw new Error(`Insufficient stock for "${product.name}". Available: ${availableStock}, Requested: ${qty}`);
          }
        }

        // Validate serial numbers if product has_serials
        if (product.has_serials) {
          const itemSerials = Array.isArray(item.serial_numbers) ? item.serial_numbers : [];
          if (itemSerials.length !== qty) {
            throw new Error(`Product "${product.name}" requires exactly ${qty} serial number(s). Provided: ${itemSerials.length}`);
          }
        }

        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : product.sale_price;
        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error(`Invalid price for product "${product.name}". Unit price cannot be negative.`);
        }
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
      if (discVal < 0) {
        throw new Error('Discount value cannot be negative');
      }

      if (discount_type === 'percentage') {
        discAmount = (subtotal * discVal) / 100;
      } else {
        discAmount = discVal;
      }
      discAmount = Math.min(discAmount, subtotal); // Cannot exceed subtotal
      discAmount = Math.round(discAmount * 100) / 100;

      const taxableAmount = Math.round((subtotal - discAmount) * 100) / 100;
      const tRate = Number(tax_rate) || 0;
      if (tRate < 0) {
        throw new Error('Tax rate cannot be negative');
      }
      const taxAmount = Math.round(((taxableAmount * tRate) / 100) * 100) / 100;
      const shippingCost = Math.max(0, Number(shipping_cost) || 0);
      const shippingNotes = (shipping_notes && typeof shipping_notes === 'string') ? shipping_notes.trim() : null;
      const extraCharges = Math.max(0, Number(extra_charges) || 0);
      const grandTotal = Math.round((taxableAmount + taxAmount + shippingCost + extraCharges) * 100) / 100;

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
        const newCust = await txRun(
          'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
          [fallbackName, cleanPhone || null, customer_email || null]
        );
        customerId = newCust.lastInsertRowid;
        if (!cleanName || cleanName.toLowerCase() === 'walk-in customer') cleanName = fallbackName;
      } else if (!customerId && (cleanPhone || (cleanName && cleanName.toLowerCase() !== 'walk-in customer' && cleanName !== 'عام واک ان گاہک'))) {
        const newCust = await txRun(
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
        const custRecord = await txGet('SELECT current_balance FROM customers WHERE id = ?', [customerId]);
        prevCustomerBalance = custRecord ? Number(custRecord.current_balance || 0) : 0;

        // Customer Balance Delta:
        // New Balance = Previous Balance + Grand Total - Paid
        const netKhataDelta = Math.round((grandTotal - paid) * 100) / 100;
        newCustomerBalance = Math.round((prevCustomerBalance + netKhataDelta) * 100) / 100;
      }

      // 4. Insert Invoice Header
      const showPrevBal = show_previous_balance !== undefined ? (show_previous_balance ? 1 : 0) : 1;
      const invoiceNumber = await generateInvoiceNumber(txGet);
      const invoiceInsert = await txRun(`
        INSERT INTO invoices (
          invoice_number, customer_id, customer_name, customer_phone,
          cashier_id, subtotal, discount_type, discount_value,
          discount_amount, tax_rate, tax_amount, grand_total,
          shipping_cost, shipping_notes, extra_charges,
          paid_amount, change_amount, balance_due, payment_method, notes,
          previous_customer_balance, new_customer_balance, show_previous_balance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        shippingCost,
        shippingNotes,
        extraCharges,
        paid,
        changeAmount,
        balanceDue,
        payment_method || 'cash',
        offline_local_id
          ? (notes ? `${notes} [OFFLINE_ID:${offline_local_id}]` : `[OFFLINE_ID:${offline_local_id}]`)
          : (notes || null),
        prevCustomerBalance,
        newCustomerBalance,
        showPrevBal
      ]);

      const invoiceId = invoiceInsert.lastInsertRowid;

      // 5. Insert Line Items, Update Product Stock, and Assign Serial Numbers
      for (const item of processedItems) {
        // Insert line item
        const itemInsert = await txRun(`
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
        await txRun('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.qty, item.product.id]);

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
            const existingSerial = await txGet('SELECT id, status FROM serial_numbers WHERE serial_number = ?', [cleanSN]);

            if (existingSerial) {
              await txRun(`
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
              await txRun(`
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
        await txRun('UPDATE customers SET total_spent = total_spent + ?, current_balance = ? WHERE id = ?', [
          grandTotal,
          newCustomerBalance,
          customerId
        ]);

        // If there was a credit/udhar balance or payment, log in ledger
        if (grandTotal > 0 || paid > 0) {
          let ledgerDesc = `Sale Invoice #${invoiceNumber}`;
          if (shippingCost > 0) {
            ledgerDesc += ` (Incl. Shipping: Rs. ${shippingCost.toLocaleString()}${shippingNotes ? ` - ${shippingNotes}` : ''})`;
          }
          if (extraCharges > 0) {
            ledgerDesc += ` (Deal: Rs. ${grandTotal.toLocaleString()})`;
          }
          if (balanceDue > 0) {
            ledgerDesc += ` (Udhar: Rs. ${balanceDue.toLocaleString()})`;
          } else if (excessPaidToKhata > 0) {
            ledgerDesc += ` (Bill: Rs. ${grandTotal.toLocaleString()}, Paid: Rs. ${paid.toLocaleString()}, Khata Wasooli: -Rs. ${excessPaidToKhata.toLocaleString()})`;
          } else {
            ledgerDesc += ' (Paid in Full)';
          }

          await txRun(`
            INSERT INTO ledger_entries (
              party_type, party_id, entry_type, reference_id, reference_no,
              debit, credit, account_id, description, entry_date
            ) VALUES ('client', ?, 'sale', ?, ?, ?, ?, ?, ?, DATE('now'))
          `, [
            customerId,
            invoiceId,
            invoiceNumber,
            grandTotal, // Debit: Total sale billed
            paid, // Credit: Amount received immediately
            (payment_method === 'cash' ? 1 : null),
            ledgerDesc
          ]);
        }
      }

      // 7. If cash payment and there is an open cash drawer, update drawer cash_sales
      if (payment_method === 'cash') {
        const cashReceived = (isPartyMode && customerId) ? paid : Math.min(paid, grandTotal);
        await txRun(`
          UPDATE cash_drawers
          SET cash_sales = cash_sales + ?,
              expected_closing_cash = expected_closing_cash + ?
          WHERE cashier_id = ? AND status = 'open'
        `, [cashReceived, cashReceived, cashierId]);
      }

      // 8. If any items were oversold during offline sync, log them into stock_alerts
      if (stockWarnings.length > 0) {
        for (const warn of stockWarnings) {
          await txRun(`
            INSERT INTO stock_alerts (
              product_id, product_name, invoice_id, invoice_number,
              available_before, quantity_sold, quantity_oversold, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
          `, [
            warn.product_id,
            warn.product_name,
            invoiceId,
            invoiceNumber,
            warn.available,
            warn.quantity_sold,
            warn.quantity_oversold
          ]);
        }
      }

      return { invoiceId, invoiceNumber, stockWarnings, customerId };
    });

    if (invoiceResult.already_synced) {
      const fullInvoice = await getFullInvoiceDetails(invoiceResult.id);
      return res.status(200).json({
        success: true,
        already_synced: true,
        message: 'Invoice already synced (Duplicate prevented)',
        invoice: { ...(fullInvoice || {}), already_synced: true },
        stock_warnings: []
      });
    }

    // Fetch complete invoice record for thermal receipt response
    const fullInvoice = await getFullInvoiceDetails(invoiceResult.invoiceId);
    if (fullInvoice) {
      fullInvoice.stock_warnings = invoiceResult.stockWarnings || [];
    }

    return res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      invoice: fullInvoice,
      stock_warnings: invoiceResult.stockWarnings || []
    });
  } catch (error) {
    console.error('Sale transaction failed:', error);
    return res.status(400).json({ success: false, message: error.message || 'سیل محفوظ کرنے میں خرابی پیش آئی (Sale transaction failed)' });
  }
}

/**
 * Fetch complete invoice with line items, serial numbers, cashier, and store info
 */
async function getFullInvoiceDetails(invoiceId) {
  const invoice = await get(`
    SELECT inv.*, u.full_name as cashier_name,
           c.current_balance as live_customer_balance,
           COALESCE(sr_agg.total_refunded, 0) as total_refunded,
           COALESCE(sr_agg.return_count, 0) as return_count
    FROM invoices inv
    LEFT JOIN users u ON inv.cashier_id = u.id
    LEFT JOIN customers c ON inv.customer_id = c.id
    LEFT JOIN (
      SELECT invoice_id,
             SUM(total_refund_amount) as total_refunded,
             COUNT(*) as return_count
      FROM sales_returns
      GROUP BY invoice_id
    ) sr_agg ON sr_agg.invoice_id = inv.id
    WHERE inv.id = ?
  `, [invoiceId]);

  if (!invoice) return null;

  invoice.customer_balance = (invoice.new_customer_balance !== null && invoice.new_customer_balance !== undefined)
    ? invoice.new_customer_balance
    : invoice.live_customer_balance;

  invoice.show_previous_balance = (invoice.show_previous_balance !== null && invoice.show_previous_balance !== undefined)
    ? Number(invoice.show_previous_balance)
    : 1;

  const items = await query(`
    SELECT ii.*, p.barcode
    FROM invoice_items ii
    LEFT JOIN products p ON ii.product_id = p.id
    WHERE ii.invoice_id = ?
  `, [invoiceId]);

  // Fetch serial numbers linked to this invoice
  const serials = await query(`
    SELECT serial_number, product_id, invoice_item_id, warranty_expiry_date
    FROM serial_numbers
    WHERE invoice_id = ?
  `, [invoiceId]);

  // Map serial numbers to respective items
  const itemsWithSerials = items.map(item => ({
    ...item,
    serial_numbers: serials
      .filter(s => s.invoice_item_id ? s.invoice_item_id === item.id : s.product_id === item.product_id)
      .map(s => ({
        serial_number: s.serial_number,
        warranty_expiry: s.warranty_expiry_date
      }))
  }));

  // Fetch store settings for receipt branding
  const settingsRows = await query('SELECT key, value FROM store_settings');
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
async function getInvoices(req, res) {
  try {
    const { search, start_date, end_date, limit = 50 } = req.query;

    let sql = `
      SELECT inv.*, u.full_name as cashier_name,
             COALESCE(sr_agg.total_refunded, 0) as total_refunded,
             COALESCE(sr_agg.return_count, 0) as return_count
      FROM invoices inv
      LEFT JOIN users u ON inv.cashier_id = u.id
      LEFT JOIN (
        SELECT invoice_id,
               SUM(total_refund_amount) as total_refunded,
               COUNT(*) as return_count
        FROM sales_returns
        GROUP BY invoice_id
      ) sr_agg ON sr_agg.invoice_id = inv.id
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
      sql += ' AND DATE(inv.created_at) >= DATE(?)';
      params.push(cleanStartDate);
    }

    if (cleanEndDate) {
      sql += ' AND DATE(inv.created_at) <= DATE(?)';
      params.push(cleanEndDate);
    }

    sql += ' ORDER BY inv.id DESC LIMIT ?';
    params.push(Number(limit));

    const invoices = await query(sql, params);
    return res.json({ success: true, count: invoices.length, invoices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get single invoice details by invoice_number or ID
 */
async function getInvoiceDetails(req, res) {
  try {
    const { identifier } = req.params;
    let invoice = null;

    if (isNaN(identifier)) {
      const cleanIdent = String(identifier).trim();
      // 1. Exact match case-insensitive
      let row = await get('SELECT id FROM invoices WHERE LOWER(invoice_number) = LOWER(?)', [cleanIdent]);

      // 2. Fallback: Partial match on invoice_number
      if (!row) {
        row = await get('SELECT id FROM invoices WHERE invoice_number LIKE ? COLLATE NOCASE ORDER BY id DESC LIMIT 1', [`%${cleanIdent}%`]);
      }

      // 3. Fallback: Match by customer name
      if (!row) {
        row = await get('SELECT id FROM invoices WHERE customer_name LIKE ? COLLATE NOCASE ORDER BY id DESC LIMIT 1', [`%${cleanIdent}%`]);
      }

      if (row) invoice = await getFullInvoiceDetails(row.id);
    } else {
      invoice = await getFullInvoiceDetails(Number(identifier));
      // If not found by numeric ID, check if identifier is a partial invoice number (e.g. 0001)
      if (!invoice) {
        const row = await get('SELECT id FROM invoices WHERE invoice_number LIKE ? COLLATE NOCASE ORDER BY id DESC LIMIT 1', [`%${identifier}%`]);
        if (row) invoice = await getFullInvoiceDetails(row.id);
      }
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
async function getCustomers(req, res) {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY current_balance DESC, name ASC';
    const customers = await query(sql, params);
    return res.json({ success: true, customers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create a new customer record directly
 */
async function createCustomer(req, res) {
  try {
    const { name, phone, email, address, opening_balance } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }

    const openBal = Number(opening_balance) || 0;
    const result = await run(
      'INSERT INTO customers (name, phone, email, address, current_balance) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), phone ? phone.trim() : null, email ? email.trim() : null, address ? address.trim() : null, openBal]
    );

    const customerId = result.lastInsertRowid;

    if (openBal > 0) {
      await run(`
        INSERT INTO ledger_entries (
          party_type, party_id, entry_type, debit, credit, description, entry_date
        ) VALUES ('client', ?, 'opening_balance', ?, 0, 'Opening Balance (Previous Udhar)', DATE('now'))
      `, [customerId, openBal]);
    }

    await logActivity({
      userId: req.user ? req.user.id : null,
      username: req.user ? req.user.username : 'System',
      action: 'customer_create',
      description: `نیا گاہک رجسٹرڈ: ${name.trim()} (${phone ? phone.trim() : 'کوئی فون نہیں'})`
    });

    const customerObj = {
      id: customerId,
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      email: email ? email.trim() : null,
      address: address ? address.trim() : null,
      current_balance: openBal,
      total_spent: 0,
      created_at: new Date().toISOString()
    };

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customerId,
      customer: customerObj
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update an existing customer record
 * PUT /api/invoices/meta/customers/:id
 */
async function updateCustomer(req, res) {
  try {
    const customerId = Number(req.params.id);
    const { name, phone, email, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'گاہک کا نام لازمی ہے (Customer name is required)' });
    }

    const existing = await get('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'کسٹمر ریکارڈ نہیں ملا (Customer not found)' });
    }

    await run(`
      UPDATE customers 
      SET 
        name = ?,
        phone = ?,
        email = ?,
        address = ?
      WHERE id = ?
    `, [
      name.trim(),
      phone ? phone.trim() : null,
      email ? email.trim() : null,
      address ? address.trim() : null,
      customerId
    ]);

    const updated = await get('SELECT * FROM customers WHERE id = ?', [customerId]);

    await logActivity({
      userId: req.user ? req.user.id : null,
      username: req.user ? req.user.username : 'Admin',
      action: 'customer_update',
      description: `گاہک کی تفصیلات میں ترمیم: ${name.trim()} (ID: ${customerId})`
    });

    return res.json({
      success: true,
      message: 'Customer updated successfully',
      customer: updated
    });
  } catch (error) {
    console.error('updateCustomer error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Delete a customer with comprehensive safety checks
 * DELETE /api/invoices/meta/customers/:id
 */
async function deleteCustomer(req, res) {
  try {
    const customerId = Number(req.params.id);
    const existing = await get('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'کسٹمر ریکارڈ نہیں ملا (Customer not found)' });
    }

    // 1. Check if customer has non-zero balance
    const currentBal = Number(existing.current_balance) || 0;
    if (Math.abs(currentBal) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `کسٹمر "${existing.name}" کو ڈیلیٹ نہیں کیا جا سکتا کیونکہ اس کے کھاتے میں Rs. ${currentBal.toLocaleString()} بقایا ادھار/بیلنس موجود ہے۔ برائے مہربانی پہلے کھاتہ صفر (0) کریں۔`
      });
    }

    // 2. Check sales invoices
    const invCheck = await get('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?', [customerId]);
    if (invCheck && Number(invCheck.count) > 0) {
      return res.status(400).json({
        success: false,
        message: `کسٹمر "${existing.name}" کو ڈیلیٹ نہیں کیا جا سکتا کیونکہ اس کے نام پر ${invCheck.count} عدد سابقہ بل/رسیدیں موجود ہیں۔`
      });
    }

    // 3. Check ledger entries
    const ledgerCheck = await get(
      "SELECT COUNT(*) as count FROM ledger_entries WHERE party_type IN ('client', 'customer') AND party_id = ?",
      [customerId]
    );
    if (ledgerCheck && Number(ledgerCheck.count) > 0) {
      return res.status(400).json({
        success: false,
        message: `کسٹمر "${existing.name}" کے کھاتے (Ledger) میں سابقہ ٹرانزیکشن کی ہسٹری موجود ہے، اس لیے اسے ڈیلیٹ نہیں کیا جا سکتا۔`
      });
    }

    // 4. Check warranty claims or assigned serials
    const warrantyCheck = await get('SELECT COUNT(*) as count FROM serial_numbers WHERE customer_id = ?', [customerId]);
    if (warrantyCheck && Number(warrantyCheck.count) > 0) {
      return res.status(400).json({
        success: false,
        message: `کسٹمر "${existing.name}" کے نام پر وارنٹی سیریل نمبرز منسلک ہیں۔`
      });
    }

    // 5. Safe to delete
    await run('DELETE FROM customers WHERE id = ?', [customerId]);

    await logActivity({
      userId: req.user ? req.user.id : null,
      username: req.user ? req.user.username : 'Admin',
      action: 'customer_delete',
      description: `گاہک ڈیلیٹ کیا گیا: ${existing.name} (ID: ${customerId})`
    });

    return res.json({
      success: true,
      message: `گاہک "${existing.name}" کامیابی سے ڈیلیٹ ہو گیا۔`
    });
  } catch (error) {
    console.error('deleteCustomer error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Void / Cancel a POS Sale Invoice (Atomic rollback)
 */
async function voidInvoice(req, res) {
  try {
    const { id } = req.params;
    const void_reason = (req.body.void_reason || req.body.reason || '').trim();
    const voidedBy = req.user ? req.user.id : 1;
    const invoiceId = Number(id);

    if (!void_reason) {
      return res.status(400).json({ success: false, message: 'Void reason is required' });
    }

    const voidResult = await transaction(async ({ query: txQuery, get: txGet, run: txRun }) => {
      // 1. Fetch active invoice record
      const invoice = await txGet('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.voided_at || invoice.status === 'void' || invoice.status === 'cancelled') {
        throw new Error('Invoice is already voided');
      }

      // 2. Fetch line items and serials
      const lineItems = await txQuery('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

      // 3. Restore product stock quantities
      for (const it of lineItems) {
        await txRun('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [
          it.quantity,
          it.product_id
        ]);
      }

      // 4. Free / unassign serial numbers
      await txRun(
        "UPDATE serial_numbers SET status = 'in_stock', invoice_id = NULL, invoice_item_id = NULL, customer_id = NULL, sold_date = NULL, warranty_expiry_date = NULL WHERE invoice_id = ?",
        [invoiceId]
      );

      // 5. Mark Invoice Header as voided and update status to void
      await txRun(`
        UPDATE invoices SET
          status = 'void',
          voided_at = CURRENT_TIMESTAMP,
          voided_by = ?,
          void_reason = ?
        WHERE id = ?
      `, [voidedBy, void_reason, invoiceId]);

      // 6. Reverse Customer Lifetime Spend and Khata / Ledger Balance
      if (invoice.customer_id) {
        const customer = await txGet('SELECT id, current_balance, total_spent FROM customers WHERE id = ?', [invoice.customer_id]);
        if (customer) {
          const grandTotal = Number(invoice.grand_total) || 0;
          const paid = Number(invoice.paid_amount) || 0;
          const netInvoiceDelta = grandTotal - paid;
          const newCustBalance = Math.round(((customer.current_balance || 0) - netInvoiceDelta) * 100) / 100;
          const newTotalSpent = Math.max(0, (customer.total_spent || 0) - grandTotal);

          await txRun(
            'UPDATE customers SET current_balance = ?, total_spent = ? WHERE id = ?',
            [newCustBalance, newTotalSpent, invoice.customer_id]
          );

          // Log reversing entry in ledger
          await txRun(`
            INSERT INTO ledger_entries (
              party_type, party_id, entry_type, reference_id, reference_no,
              debit, credit, account_id, description, entry_date
            ) VALUES ('client', ?, 'sale_void', ?, ?, ?, ?, ?, ?, DATE('now'))
          `, [
            invoice.customer_id,
            invoiceId,
            invoice.invoice_number,
            paid,
            grandTotal,
            (invoice.payment_method === 'cash' ? 1 : null),
            `VOIDED #${invoice.invoice_number} - ${void_reason}`
          ]);
        }
      }

      // 7. If cash payment, deduct refunded cash from open cash drawer so cash reconciliation is exact
      if (invoice.payment_method === 'cash') {
        const cashRefund = invoice.customer_id
          ? Number(invoice.paid_amount || 0)
          : Math.min(Number(invoice.paid_amount || 0), Number(invoice.grand_total || 0));
        if (cashRefund > 0) {
          await txRun(`
            UPDATE cash_drawers
            SET cash_sales = CASE WHEN cash_sales - ? < 0 THEN 0 ELSE cash_sales - ? END,
                expected_closing_cash = CASE WHEN expected_closing_cash - ? < 0 THEN 0 ELSE expected_closing_cash - ? END
            WHERE status = 'open' AND (cashier_id = ? OR id = (SELECT id FROM cash_drawers WHERE status = 'open' ORDER BY id DESC LIMIT 1))
          `, [cashRefund, cashRefund, cashRefund, cashRefund, voidedBy]);
        }
      }

      return {
        success: true,
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        void_reason: void_reason,
        items_restored: lineItems.length
      };
    });

    await logActivity({
      userId: voidedBy,
      username: req.user ? req.user.username : 'Admin',
      action: 'invoice_void',
      description: `انوائس منسوخ #${voidResult.invoice_number} - وجہ: ${void_reason}`
    });

    return res.json({
      success: true,
      message: `Invoice #${voidResult.invoice_number} successfully voided. Stock & Khata restored.`,
      result: voidResult
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Permanently Delete an Invoice (Restores stock & ledger, deletes record)
 * DELETE /api/invoices/:id
 */
async function deleteInvoice(req, res) {
  try {
    const invoiceId = Number(req.params.id);
    const invoice = await get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    await transaction(async ({ query: txQuery, get: txGet, run: txRun }) => {
      // 1. If not voided yet, restore product stock & serials first
      if (!invoice.voided_at && invoice.status !== 'void' && invoice.status !== 'cancelled') {
        const lineItems = await txQuery('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        for (const it of lineItems) {
          await txRun('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [
            it.quantity,
            it.product_id
          ]);
        }
        await txRun(
          "UPDATE serial_numbers SET status = 'in_stock', invoice_id = NULL, invoice_item_id = NULL, customer_id = NULL, sold_date = NULL, warranty_expiry_date = NULL WHERE invoice_id = ?",
          [invoiceId]
        );
        if (invoice.customer_id) {
          const customer = await txGet('SELECT id, current_balance, total_spent FROM customers WHERE id = ?', [invoice.customer_id]);
          if (customer) {
            const grandTotal = Number(invoice.grand_total) || 0;
            const paid = Number(invoice.paid_amount) || 0;
            const netInvoiceDelta = grandTotal - paid;
            const newCustBalance = Math.round(((customer.current_balance || 0) - netInvoiceDelta) * 100) / 100;
            const newTotalSpent = Math.max(0, (customer.total_spent || 0) - grandTotal);
            await txRun('UPDATE customers SET current_balance = ?, total_spent = ? WHERE id = ?', [newCustBalance, newTotalSpent, invoice.customer_id]);
          }
        }
      }

      // 2. Remove ledger entries for this invoice
      await txRun("DELETE FROM ledger_entries WHERE party_type = 'client' AND reference_id = ?", [invoiceId]);

      // 3. Delete invoice line items
      await txRun('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

      // 4. Delete invoice record
      await txRun('DELETE FROM invoices WHERE id = ?', [invoiceId]);
    });

    return res.json({
      success: true,
      message: `Invoice #${invoice.invoice_number} successfully deleted.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update / Edit an existing Sales Invoice
 * Recalculates line items, adjusts product stock deltas, updates customer ledger & cash drawer
 * PUT /api/invoices/:id
 */
async function updateInvoice(req, res) {
  try {
    const invoiceId = Number(req.params.id);
    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }

    const {
      customer_id,
      customer_name,
      customer_phone,
      items, // Array of { product_id, quantity, unit_price, cost_price, serial_numbers }
      discount_type,
      discount_value,
      tax_rate,
      shipping_cost,
      shipping_notes,
      extra_charges,
      payment_method,
      paid_amount,
      notes,
      show_previous_balance
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items cannot be empty (بل میں کم از کم ایک آئٹم ہونا ضروری ہے)' });
    }

    const cashierId = req.user ? req.user.id : 1;

    const result = await transaction(async ({ query: txQuery, get: txGet, run: txRun }) => {
      // 1. Fetch existing invoice
      const existingInvoice = await txGet('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
      if (!existingInvoice) {
        throw new Error('Invoice not found (بل نہیں ملا)');
      }

      // 2. Reject if invoice is voided or cancelled
      if (existingInvoice.voided_at || existingInvoice.status === 'void' || existingInvoice.status === 'cancelled') {
        throw new Error('منسوخ شدہ بل میں ترمیم نہیں کی جا سکتی (Cannot edit a voided or cancelled invoice)');
      }

      // 3. Fetch existing line items
      const oldItems = await txQuery('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

      // Calculate old quantity map per product: { [product_id]: total_old_qty }
      const oldQtyMap = {};
      for (const it of oldItems) {
        const pid = Number(it.product_id);
        oldQtyMap[pid] = (oldQtyMap[pid] || 0) + Number(it.quantity);
      }

      function getItemQty(it) {
        return Number(it.quantity !== undefined ? it.quantity : (it.qty !== undefined ? it.qty : 1));
      }

      // Calculate new quantity map per product
      const newQtyMap = {};
      for (const it of items) {
        const pid = Number(it.product_id);
        const qty = getItemQty(it);
        if (qty <= 0) {
          throw new Error('Quantity must be greater than 0 (تعداد صفر سے زیادہ ہونی چاہیے)');
        }
        newQtyMap[pid] = (newQtyMap[pid] || 0) + qty;
      }

      // 4. Validate stock availability for all products with net positive delta
      // delta = newQty - oldQty. If delta > 0, we need delta additional stock from warehouse!
      const allProductIds = Array.from(new Set([...Object.keys(oldQtyMap), ...Object.keys(newQtyMap)].map(Number)));

      for (const pid of allProductIds) {
        const oldQty = oldQtyMap[pid] || 0;
        const newQty = newQtyMap[pid] || 0;
        const delta = newQty - oldQty;

        if (delta > 0) {
          const product = await txGet('SELECT id, name, stock_quantity FROM products WHERE id = ?', [pid]);
          if (!product) {
            throw new Error(`Product ID ${pid} not found`);
          }
          const availableStock = Number(product.stock_quantity) || 0;
          if (availableStock < delta) {
            throw new Error(`اسٹاک کی کمی: پروڈکٹ "${product.name}" کا موجودہ اسٹاک صرف ${availableStock} ہے، جبکہ ترمیم کے بعد ${delta} مزید آئٹم درکار ہیں (مجموعی ضرورت: ${newQty})۔`);
          }
        }
      }

      // 5. Process new items and calculate Subtotal
      let subtotal = 0;
      const processedItems = [];

      for (const item of items) {
        const pid = Number(item.product_id);
        const product = await txGet('SELECT * FROM products WHERE id = ?', [pid]);
        if (!product) {
          throw new Error(`Product not found with ID ${pid}`);
        }

        const qty = getItemQty(item);
        const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : product.sale_price;
        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error(`Invalid price for product "${product.name}". Unit price cannot be negative.`);
        }
        const lineTotal = Math.round(unitPrice * qty * 100) / 100;
        subtotal += lineTotal;

        processedItems.push({
          product,
          qty,
          unitPrice,
          lineTotal,
          costPrice: item.cost_price !== undefined ? Number(item.cost_price) : (product.cost_price || 0),
          warrantyMonths: product.warranty_months || 0,
          serials: Array.isArray(item.serial_numbers) ? item.serial_numbers : []
        });
      }

      // 6. Calculate Discounts, Taxes, Shipping, and Grand Total
      let discAmount = 0;
      const discVal = Number(discount_value) || 0;
      if (discVal < 0) throw new Error('Discount value cannot be negative');

      if (discount_type === 'percentage') {
        discAmount = (subtotal * discVal) / 100;
      } else {
        discAmount = discVal;
      }
      discAmount = Math.min(discAmount, subtotal);
      discAmount = Math.round(discAmount * 100) / 100;

      const taxableAmount = Math.round((subtotal - discAmount) * 100) / 100;
      const tRate = Number(tax_rate) || 0;
      if (tRate < 0) throw new Error('Tax rate cannot be negative');
      const taxAmount = Math.round(((taxableAmount * tRate) / 100) * 100) / 100;

      const shippingCost = Math.max(0, Number(shipping_cost) || 0);
      const shippingNotes = (shipping_notes && typeof shipping_notes === 'string') ? shipping_notes.trim() : null;
      const extraCharges = Math.max(0, Number(extra_charges) || 0);
      const grandTotal = Math.round((taxableAmount + taxAmount + shippingCost + extraCharges) * 100) / 100;

      const paid = (paid_amount !== undefined && paid_amount !== null && paid_amount !== '')
        ? Math.round(Number(paid_amount) * 100) / 100
        : grandTotal;

      // 7. Resolve Customer & Khata logic
      let customerId = customer_id ? Number(customer_id) : (existingInvoice.customer_id || null);
      let cleanName = customer_name ? customer_name.trim() : (existingInvoice.customer_name || 'عام واک ان گاہک');
      let cleanPhone = customer_phone ? customer_phone.trim() : (existingInvoice.customer_phone || null);

      if (customerId) {
        const custRecord = await txGet('SELECT id, name, phone FROM customers WHERE id = ?', [customerId]);
        if (custRecord) {
          if (!cleanName || cleanName === 'عام واک ان گاہک') cleanName = custRecord.name;
        } else {
          customerId = null;
        }
      }

      let changeAmount = 0;
      let balanceDue = 0;
      if (customerId) {
        if (paid >= grandTotal) {
          balanceDue = 0;
          changeAmount = 0;
        } else {
          balanceDue = Math.round((grandTotal - paid) * 100) / 100;
          changeAmount = 0;
        }
      } else {
        changeAmount = Math.max(0, Math.round((paid - grandTotal) * 100) / 100);
        balanceDue = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);
      }

      // 8. Apply Stock Adjustments for each product
      // delta = newQty - oldQty
      // delta > 0: stock_quantity = stock_quantity - delta (further reduction)
      // delta < 0: stock_quantity = stock_quantity - (-|delta|) = stock_quantity + |delta| (stock restored)
      for (const pid of allProductIds) {
        const delta = (newQtyMap[pid] || 0) - (oldQtyMap[pid] || 0);
        if (delta !== 0) {
          await txRun('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [delta, pid]);
        }
      }

      // 9. Update Line Items: delete old items and insert updated items
      await txRun('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

      for (const item of processedItems) {
        await txRun(`
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
      }

      // 10. Customer Khata & Ledger Adjustments
      const oldGrandTotal = Number(existingInvoice.grand_total) || 0;
      const oldPaidAmount = Number(existingInvoice.paid_amount) || 0;
      const oldNetDelta = Math.round((oldGrandTotal - oldPaidAmount) * 100) / 100;
      const newNetDelta = Math.round((grandTotal - paid) * 100) / 100;

      const oldCustomerId = existingInvoice.customer_id ? Number(existingInvoice.customer_id) : null;
      let newCustomerBalance = 0;

      if (oldCustomerId && oldCustomerId === customerId) {
        // Same customer: balance adjusts by (newNetDelta - oldNetDelta)
        const balanceChange = Math.round((newNetDelta - oldNetDelta) * 100) / 100;
        const spentChange = Math.round((grandTotal - oldGrandTotal) * 100) / 100;

        const cust = await txGet('SELECT id, current_balance, total_spent FROM customers WHERE id = ?', [customerId]);
        if (cust) {
          newCustomerBalance = Math.round(((Number(cust.current_balance) || 0) + balanceChange) * 100) / 100;
          const newTotalSpent = Math.max(0, Math.round(((Number(cust.total_spent) || 0) + spentChange) * 100) / 100);
          await txRun('UPDATE customers SET current_balance = ?, total_spent = ? WHERE id = ?', [
            newCustomerBalance,
            newTotalSpent,
            customerId
          ]);

          // Insert audit adjustment entry in ledger
          await txRun(`
            INSERT INTO ledger_entries (
              party_type, party_id, entry_type, reference_id, reference_no,
              debit, credit, account_id, description, entry_date
            ) VALUES ('client', ?, 'invoice_edit', ?, ?, ?, ?, ?, ?, CURRENT_DATE)
          `, [
            customerId,
            invoiceId,
            existingInvoice.invoice_number,
            grandTotal,
            paid,
            (payment_method === 'cash' ? 1 : null),
            `ترمیم شدہ بل (Invoice Edit) #${existingInvoice.invoice_number} (پہلے: Rs. ${oldGrandTotal}, نیا: Rs. ${grandTotal})`
          ]);
        }
      } else {
        // Customer was changed or removed/added
        if (oldCustomerId) {
          // Revert old customer's net invoice debt & total spent
          const oldCust = await txGet('SELECT id, current_balance, total_spent FROM customers WHERE id = ?', [oldCustomerId]);
          if (oldCust) {
            const revertedBal = Math.round(((Number(oldCust.current_balance) || 0) - oldNetDelta) * 100) / 100;
            const revertedSpent = Math.max(0, Math.round(((Number(oldCust.total_spent) || 0) - oldGrandTotal) * 100) / 100);
            await txRun('UPDATE customers SET current_balance = ?, total_spent = ? WHERE id = ?', [
              revertedBal,
              revertedSpent,
              oldCustomerId
            ]);
            await txRun(`
              INSERT INTO ledger_entries (
                party_type, party_id, entry_type, reference_id, reference_no,
                debit, credit, account_id, description, entry_date
              ) VALUES ('client', ?, 'invoice_edit_reversal', ?, ?, ?, ?, ?, ?, CURRENT_DATE)
            `, [
              oldCustomerId,
              invoiceId,
              existingInvoice.invoice_number,
              oldPaidAmount,
              oldGrandTotal,
              1,
              `بل کی گاہک تبدیلی منسوخی (Reversal) #${existingInvoice.invoice_number}`
            ]);
          }
        }

        if (customerId) {
          // Apply new net delta to new customer
          const newCust = await txGet('SELECT id, current_balance, total_spent FROM customers WHERE id = ?', [customerId]);
          if (newCust) {
            newCustomerBalance = Math.round(((Number(newCust.current_balance) || 0) + newNetDelta) * 100) / 100;
            const newSpent = Math.round(((Number(newCust.total_spent) || 0) + grandTotal) * 100) / 100;
            await txRun('UPDATE customers SET current_balance = ?, total_spent = ? WHERE id = ?', [
              newCustomerBalance,
              newSpent,
              customerId
            ]);
            await txRun(`
              INSERT INTO ledger_entries (
                party_type, party_id, entry_type, reference_id, reference_no,
                debit, credit, account_id, description, entry_date
              ) VALUES ('client', ?, 'sale', ?, ?, ?, ?, ?, ?, CURRENT_DATE)
            `, [
              customerId,
              invoiceId,
              existingInvoice.invoice_number,
              grandTotal,
              paid,
              (payment_method === 'cash' ? 1 : null),
              `بل ٹرانسفر (Transferred Bill) #${existingInvoice.invoice_number}`
            ]);
          }
        }
      }

      // 11. Update Cash Drawer (if payment method was/is cash)
      const oldPayMethod = existingInvoice.payment_method;
      const newPayMethod = payment_method || oldPayMethod || 'cash';

      const oldCashCollected = oldPayMethod === 'cash' ? (existingInvoice.customer_id ? oldPaidAmount : Math.min(oldPaidAmount, oldGrandTotal)) : 0;
      const newCashCollected = newPayMethod === 'cash' ? (customerId ? paid : Math.min(paid, grandTotal)) : 0;
      const cashDiff = Math.round((newCashCollected - oldCashCollected) * 100) / 100;

      if (cashDiff !== 0) {
        await txRun(`
          UPDATE cash_drawers
          SET cash_sales = CASE WHEN cash_sales + ? < 0 THEN 0 ELSE cash_sales + ? END,
              expected_closing_cash = CASE WHEN expected_closing_cash + ? < 0 THEN 0 ELSE expected_closing_cash + ? END
          WHERE status = 'open' AND (cashier_id = ? OR id = (SELECT id FROM cash_drawers WHERE status = 'open' ORDER BY id DESC LIMIT 1))
        `, [cashDiff, cashDiff, cashDiff, cashDiff, cashierId]);
      }

      // 12. Update Invoices Table
      const showPrevBal = show_previous_balance !== undefined ? (show_previous_balance ? 1 : 0) : Number(existingInvoice.show_previous_balance || 1);

      await txRun(`
        UPDATE invoices SET
          customer_id = ?,
          customer_name = ?,
          customer_phone = ?,
          subtotal = ?,
          discount_type = ?,
          discount_value = ?,
          discount_amount = ?,
          tax_rate = ?,
          tax_amount = ?,
          grand_total = ?,
          shipping_cost = ?,
          shipping_notes = ?,
          extra_charges = ?,
          paid_amount = ?,
          change_amount = ?,
          balance_due = ?,
          payment_method = ?,
          notes = ?,
          new_customer_balance = ?,
          show_previous_balance = ?
        WHERE id = ?
      `, [
        customerId,
        cleanName,
        cleanPhone,
        subtotal,
        discount_type || 'amount',
        discVal,
        discAmount,
        tRate,
        taxAmount,
        grandTotal,
        shippingCost,
        shippingNotes,
        extraCharges,
        paid,
        changeAmount,
        balanceDue,
        newPayMethod,
        notes !== undefined ? notes : existingInvoice.notes,
        newCustomerBalance,
        showPrevBal,
        invoiceId
      ]);

      return {
        invoiceId,
        invoice_number: existingInvoice.invoice_number,
        grandTotal,
        paid,
        balanceDue
      };
    });

    await logActivity({
      userId: cashierId,
      username: req.user ? req.user.username : 'Cashier/Admin',
      action: 'invoice_edit',
      description: `بل میں ترمیم #${result.invoice_number} - نیا کل: Rs. ${result.grandTotal}`
    });

    // Fetch updated invoice
    const updatedInvoice = await getFullInvoiceDetails(invoiceId);

    return res.json({
      success: true,
      message: `بل نمبر #${result.invoice_number} کامیابی سے اپڈیٹ ہو گیا۔ اسٹاک اور کھاتہ خودکار ایڈجسٹ ہو گئے!`,
      invoice: updatedInvoice
    });
  } catch (error) {
    console.error('Invoice update failed:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'بل میں ترمیم محفوظ کرنے میں خرابی پیش آئی'
    });
  }
}

module.exports = {
  createInvoice,
  updateInvoice,
  getInvoices,
  getInvoiceDetails,
  getFullInvoiceDetails,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  voidInvoice,
  deleteInvoice
};
