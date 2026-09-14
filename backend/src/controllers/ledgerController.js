const { query, get, run, transaction } = require('../config/db');

/**
 * Get Customer Statement of Account (Khata)
 */
function getCustomerLedger(req, res) {
  try {
    const { id } = req.params;
    const customer = get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const entries = query(`
      SELECT * FROM ledger_entries
      WHERE party_type = 'customer' AND party_id = ?
      ORDER BY entry_date ASC, id ASC
    `, [id]);

    const totalDebit = entries.reduce((acc, e) => acc + (Number(e.debit) || 0), 0);
    const totalCredit = entries.reduce((acc, e) => acc + (Number(e.credit) || 0), 0);

    const settingsRows = query('SELECT key, value FROM store_settings');
    const store = {};
    settingsRows.forEach(s => { store[s.key] = s.value; });

    return res.json({
      success: true,
      customer,
      current_balance: customer.current_balance || 0,
      total_debit: totalDebit,
      total_credit: totalCredit,
      entries,
      store
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Supplier Statement of Account (Khata)
 */
function getSupplierLedger(req, res) {
  try {
    const { id } = req.params;
    const supplier = get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const entries = query(`
      SELECT * FROM ledger_entries
      WHERE party_type = 'supplier' AND party_id = ?
      ORDER BY entry_date ASC, id ASC
    `, [id]);

    const totalDebit = entries.reduce((acc, e) => acc + (Number(e.debit) || 0), 0);
    const totalCredit = entries.reduce((acc, e) => acc + (Number(e.credit) || 0), 0);

    const settingsRows = query('SELECT key, value FROM store_settings');
    const store = {};
    settingsRows.forEach(s => { store[s.key] = s.value; });

    return res.json({
      success: true,
      supplier,
      current_balance: supplier.current_balance || 0,
      total_debit: totalDebit,
      total_credit: totalCredit,
      entries,
      store
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Record a Payment Transaction (Customer Payment Received OR Supplier Payment Made)
 */
function recordPayment(req, res) {
  try {
    const {
      party_type, // 'customer' or 'supplier'
      party_id,
      amount,
      payment_method = 'cash',
      payment_date,
      reference_no,
      description
    } = req.body;

    if (!party_type || !party_id || !amount) {
      return res.status(400).json({ success: false, message: 'Party type, Party ID, and Amount are required' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount' });
    }

    const pDate = payment_date || new Date().toISOString().slice(0, 10);
    const cashierId = req.user ? req.user.id : 1;

    const result = transaction(({ get, run }) => {
      let newBalance = 0;
      let desc = description;

      if (party_type === 'customer') {
        const customer = get('SELECT * FROM customers WHERE id = ?', [party_id]);
        if (!customer) throw new Error('Customer not found');

        // Customer pays: Credit reduces what they owe
        newBalance = Math.round(((customer.current_balance || 0) - numAmount) * 100) / 100;
        run('UPDATE customers SET current_balance = ? WHERE id = ?', [newBalance, party_id]);

        desc = desc || `Payment Received from ${customer.name}`;

        run(`
          INSERT INTO ledger_entries (
            party_type, party_id, entry_type, reference_no,
            debit, credit, balance, description, payment_method, entry_date
          ) VALUES ('customer', ?, 'payment_received', ?, 0, ?, ?, ?, ?, ?)
        `, [
          party_id,
          reference_no || null,
          numAmount,
          newBalance,
          desc,
          payment_method,
          pDate
        ]);

        // If cash received, record into active cash drawer shift
        if (payment_method === 'cash') {
          run(`
            UPDATE cash_drawers
            SET cash_sales = cash_sales + ?,
                expected_closing_cash = expected_closing_cash + ?
            WHERE cashier_id = ? AND status = 'open'
          `, [numAmount, numAmount, cashierId]);
        }
      } else if (party_type === 'supplier') {
        const supplier = get('SELECT * FROM suppliers WHERE id = ?', [party_id]);
        if (!supplier) throw new Error('Supplier not found');

        // We pay supplier: Debit reduces what we owe
        newBalance = Math.round(((supplier.current_balance || 0) - numAmount) * 100) / 100;
        run('UPDATE suppliers SET current_balance = ? WHERE id = ?', [newBalance, party_id]);

        desc = desc || `Payment Paid to ${supplier.name}`;

        run(`
          INSERT INTO ledger_entries (
            party_type, party_id, entry_type, reference_no,
            debit, credit, balance, description, payment_method, entry_date
          ) VALUES ('supplier', ?, 'payment_made', ?, ?, 0, ?, ?, ?, ?)
        `, [
          party_id,
          reference_no || null,
          numAmount,
          newBalance,
          desc,
          payment_method,
          pDate
        ]);

        // If cash paid out, record into active cash drawer expenses/outflow
        if (payment_method === 'cash') {
          run(`
            UPDATE cash_drawers
            SET cash_expenses = cash_expenses + ?,
                expected_closing_cash = expected_closing_cash - ?
            WHERE cashier_id = ? AND status = 'open'
          `, [numAmount, numAmount, cashierId]);
        }
      } else {
        throw new Error('Invalid party type. Must be customer or supplier.');
      }

      return { party_type, party_id, amount: numAmount, newBalance };
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded in ledger successfully',
      result
    });
  } catch (error) {
    console.error('recordPayment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Overall Ledger Summary (Accounts Receivable & Accounts Payable)
 */
function getLedgerSummary(req, res) {
  try {
    // Total Customer Udhar (Receivables)
    const custSum = get(`
      SELECT
        COUNT(*) as total_parties,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as total_receivable
      FROM customers
    `);

    // Total Supplier Balance (Payables)
    const supSum = get(`
      SELECT
        COUNT(*) as total_parties,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as total_payable
      FROM suppliers
    `);

    // Top Udhar Customers
    const topDebtors = query(`
      SELECT id, name, phone, current_balance
      FROM customers
      WHERE current_balance > 0
      ORDER BY current_balance DESC
      LIMIT 10
    `);

    // Top Payable Suppliers
    const topCreditors = query(`
      SELECT id, name, contact_person, phone, current_balance
      FROM suppliers
      WHERE current_balance > 0
      ORDER BY current_balance DESC
      LIMIT 10
    `);

    return res.json({
      success: true,
      summary: {
        total_receivable: custSum.total_receivable,
        total_payable: supSum.total_payable
      },
      top_debtors: topDebtors,
      top_creditors: topCreditors
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getCustomerLedger,
  getSupplierLedger,
  recordPayment,
  getLedgerSummary
};
