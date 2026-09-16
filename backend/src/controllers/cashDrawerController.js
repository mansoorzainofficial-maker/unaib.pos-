const { query, get, run } = require('../config/db');

/**
 * Helper to calculate mathematically exact cash drawer inflows and outflows for a shift
 */
function calculateShiftCashFlow(cashierId, openedAt, openingCash = 0) {
  // 1. Net Cash from Sales: paid_amount minus change returned on completed cash sales
  const salesRow = get(`
    SELECT COALESCE(SUM(paid_amount - change_amount), 0) as cash_from_sales
    FROM invoices
    WHERE payment_method = 'cash'
      AND status = 'completed'
      AND created_at >= ?
  `, [openedAt]);

  // 2. Customer Khata Recoveries in Cash (entry_type = 'payment' or 'payment_received', account type = 'cash')
  const customerRecoveryRow = get(`
    SELECT COALESCE(SUM(le.credit), 0) as cash_from_recoveries
    FROM ledger_entries le
    JOIN accounts a ON le.account_id = a.id
    WHERE le.party_type IN ('client', 'customer')
      AND le.entry_type IN ('payment', 'payment_received')
      AND a.type = 'cash'
      AND le.created_at >= ?
  `, [openedAt]);

  // 3. Purchase Returns cash received into drawer (Inflow)
  const purchaseReturnRow = get(`
    SELECT COALESCE(SUM(total_amount), 0) as cash_from_purchase_returns
    FROM purchase_returns
    WHERE refund_mode = 'cash'
      AND created_at >= ?
  `, [openedAt]);

  // 4. Shop Operational Expenses paid in Cash (Outflow)
  const expenseRow = get(`
    SELECT COALESCE(SUM(amount), 0) as cash_to_expenses
    FROM expenses
    WHERE payment_method = 'cash'
      AND created_at >= ?
  `, [openedAt]);

  // 5. Supplier Purchases paid in Cash (Outflow)
  const purchaseRow = get(`
    SELECT COALESCE(SUM(paid_amount), 0) as cash_to_purchases
    FROM purchases
    WHERE payment_method = 'cash'
      AND (status IS NULL OR status != 'void')
      AND created_at >= ?
  `, [openedAt]);

  // 6. Supplier Ledger Payments made in Cash (Outflow)
  const supplierPaymentRow = get(`
    SELECT COALESCE(SUM(CASE WHEN le.credit > 0 THEN le.credit ELSE le.debit END), 0) as cash_to_suppliers
    FROM ledger_entries le
    JOIN accounts a ON le.account_id = a.id
    WHERE le.party_type = 'supplier'
      AND le.entry_type IN ('payment', 'payment_made')
      AND a.type = 'cash'
      AND le.created_at >= ?
  `, [openedAt]);

  // 7. Sale Returns cash refunded to customer (Outflow)
  const saleReturnRow = get(`
    SELECT COALESCE(SUM(total_refund_amount), 0) as cash_to_sale_refunds
    FROM sales_returns
    WHERE refund_mode = 'cash'
      AND created_at >= ?
  `, [openedAt]);

  const cashSales = Math.round((Number(salesRow?.cash_from_sales) || 0) * 100) / 100;
  const customerRecoveries = Math.round((Number(customerRecoveryRow?.cash_from_recoveries) || 0) * 100) / 100;
  const purchaseReturnCash = Math.round((Number(purchaseReturnRow?.cash_from_purchase_returns) || 0) * 100) / 100;
  const totalInflow = Math.round((cashSales + customerRecoveries + purchaseReturnCash) * 100) / 100;

  const cashExpenses = Math.round((Number(expenseRow?.cash_to_expenses) || 0) * 100) / 100;
  const cashPurchases = Math.round((Number(purchaseRow?.cash_to_purchases) || 0) * 100) / 100;
  const supplierPayments = Math.round((Number(supplierPaymentRow?.cash_to_suppliers) || 0) * 100) / 100;
  const saleReturnCash = Math.round((Number(saleReturnRow?.cash_to_sale_refunds) || 0) * 100) / 100;
  const totalOutflow = Math.round((cashExpenses + cashPurchases + supplierPayments + saleReturnCash) * 100) / 100;

  const float = Math.round((Number(openingCash) || 0) * 100) / 100;
  const expectedClosing = Math.round((float + totalInflow - totalOutflow) * 100) / 100;

  return {
    opening_cash: float,
    cash_sales: cashSales,
    customer_recoveries: customerRecoveries,
    purchase_returns_received: purchaseReturnCash,
    total_cash_inflow: totalInflow,
    cash_expenses: cashExpenses,
    cash_purchases: cashPurchases,
    supplier_payments: supplierPayments,
    sale_returns_refunded: saleReturnCash,
    total_cash_outflow: totalOutflow,
    expected_closing_cash: expectedClosing
  };
}

/**
 * Get current open cash drawer session for the cashier
 */
function getCurrentShift(req, res) {
  try {
    const cashierId = req.user ? req.user.id : 1;

    const drawer = get(`
      SELECT cd.*, u.full_name as cashier_name
      FROM cash_drawers cd
      JOIN users u ON cd.cashier_id = u.id
      WHERE cd.cashier_id = ? AND cd.status = 'open'
      ORDER BY cd.id DESC LIMIT 1
    `, [cashierId]);

    if (!drawer) {
      return res.json({ success: true, isOpen: false, drawer: null });
    }

    // Calculate real-time comprehensive cash flow
    const cashFlow = calculateShiftCashFlow(cashierId, drawer.opened_at, drawer.opening_cash);

    return res.json({
      success: true,
      isOpen: true,
      drawer: {
        ...drawer,
        ...cashFlow
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Open a new shift with starting cash float
 */
function openShift(req, res) {
  try {
    const cashierId = req.user ? req.user.id : 1;
    const { opening_cash, notes } = req.body;

    if (opening_cash === undefined || isNaN(opening_cash)) {
      return res.status(400).json({ success: false, message: 'Opening cash float is required' });
    }

    // Check if there is already an open shift
    const existing = get("SELECT id FROM cash_drawers WHERE cashier_id = ? AND status = 'open'", [cashierId]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have an active open shift session' });
    }

    const startAmount = Number(opening_cash);

    const result = run(`
      INSERT INTO cash_drawers (
        cashier_id, opening_cash, cash_sales, cash_expenses,
        expected_closing_cash, status, notes
      ) VALUES (?, ?, 0, 0, ?, 'open', ?)
    `, [cashierId, startAmount, startAmount, notes || null]);

    return res.status(201).json({
      success: true,
      message: 'Cash drawer shift opened successfully',
      shiftId: result.lastInsertRowid
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Close shift and reconcile cash count
 */
function closeShift(req, res) {
  try {
    const cashierId = req.user ? req.user.id : 1;
    const { actual_closing_cash, notes } = req.body;

    if (actual_closing_cash === undefined || isNaN(actual_closing_cash)) {
      return res.status(400).json({ success: false, message: 'Actual closing cash count is required' });
    }

    const drawer = get("SELECT * FROM cash_drawers WHERE cashier_id = ? AND status = 'open'", [cashierId]);
    if (!drawer) {
      return res.status(404).json({ success: false, message: 'No open shift found to close' });
    }

    // Calculate real-time exact cash flow
    const cashFlow = calculateShiftCashFlow(cashierId, drawer.opened_at, drawer.opening_cash);
    const actualClosing = Math.round(Number(actual_closing_cash) * 100) / 100;
    const discrepancy = Math.round((actualClosing - cashFlow.expected_closing_cash) * 100) / 100; // > 0 overage, < 0 shortage

    run(`
      UPDATE cash_drawers SET
        closed_at = CURRENT_TIMESTAMP,
        cash_sales = ?,
        cash_expenses = ?,
        expected_closing_cash = ?,
        actual_closing_cash = ?,
        discrepancy = ?,
        status = 'closed',
        notes = ?
      WHERE id = ?
    `, [
      cashFlow.cash_sales,
      cashFlow.total_cash_outflow,
      cashFlow.expected_closing_cash,
      actualClosing,
      discrepancy,
      notes || drawer.notes,
      drawer.id
    ]);

    return res.json({
      success: true,
      message: 'Cash drawer shift closed and reconciled',
      reconciliation: {
        shift_id: drawer.id,
        opening_cash: drawer.opening_cash,
        cash_sales: cashFlow.cash_sales,
        customer_recoveries: cashFlow.customer_recoveries,
        total_cash_inflow: cashFlow.total_cash_inflow,
        cash_expenses: cashFlow.cash_expenses,
        cash_purchases: cashFlow.cash_purchases,
        supplier_payments: cashFlow.supplier_payments,
        total_cash_outflow: cashFlow.total_cash_outflow,
        expected_closing: cashFlow.expected_closing_cash,
        actual_closing: actualClosing,
        discrepancy: discrepancy,
        status: discrepancy === 0 ? 'Exact Match' : discrepancy > 0 ? `Cash Over (+${discrepancy})` : `Cash Short (${discrepancy})`
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get shift history logs
 */
function getShiftHistory(req, res) {
  try {
    const shifts = query(`
      SELECT cd.*, u.full_name as cashier_name
      FROM cash_drawers cd
      JOIN users u ON cd.cashier_id = u.id
      ORDER BY cd.id DESC LIMIT 50
    `);
    return res.json({ success: true, shifts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getCurrentShift,
  openShift,
  closeShift,
  getShiftHistory,
  calculateShiftCashFlow
};
