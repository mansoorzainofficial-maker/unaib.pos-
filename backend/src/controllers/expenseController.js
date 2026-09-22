const { query, get, run, transaction } = require('../config/db');
const syncService = require('../services/syncService');

/**
 * Get list of operational expenses
 */
async function getExpenses(req, res) {
  try {
    const { category, start_date, end_date } = req.query;

    let sql = `
      SELECT e.*, u.full_name as recorded_by
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      sql += ` AND e.category = ?`;
      params.push(category);
    }

    if (start_date) {
      sql += ` AND e.expense_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND e.expense_date <= ?`;
      params.push(end_date);
    }

    sql += ` ORDER BY e.expense_date DESC, e.id DESC`;

    const expenses = await query(sql, params);
    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return res.json({ success: true, count: expenses.length, total: totalAmount, expenses });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Add a new expense
 */
async function createExpense(req, res) {
  try {
    const { category, amount, payment_method, description, expense_date } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!category || !amount) {
      return res.status(400).json({ success: false, message: 'Category and amount are required' });
    }

    const expDate = expense_date || new Date().toISOString().slice(0, 10);
    const payMethod = payment_method || 'cash';
    const numAmount = Number(amount);

    const result = await transaction(async ({ run: txRun }) => {
      const ins = await txRun(`
        INSERT INTO expenses (user_id, category, amount, payment_method, description, expense_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, category, numAmount, payMethod, description || null, expDate]);

      // If paid out of Cash drawer, record on current open shift
      if (payMethod === 'cash') {
        await txRun(`
          UPDATE cash_drawers
          SET cash_expenses = cash_expenses + ?,
              expected_closing_cash = expected_closing_cash - ?
          WHERE status = 'open' AND (cashier_id = ? OR 1=1)
        `, [numAmount, numAmount, userId || 1]);
      }

      return ins.lastInsertRowid;
    });

    try {
      syncService.enqueueSync('expenses', result, 'insert');
    } catch (syncErr) {
      console.warn('Non-blocking sync enqueue error:', syncErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Expense recorded successfully',
      expenseId: result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Delete expense (Admin only)
 */
async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const existing = await get('SELECT * FROM expenses WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense record not found' });
    }

    await transaction(async ({ run: txRun }) => {
      await txRun('DELETE FROM expenses WHERE id = ?', [id]);

      // If paid out of cash drawer, refund amount back to active cash drawer
      if (existing.payment_method === 'cash') {
        const numAmount = Number(existing.amount) || 0;
        await txRun(`
          UPDATE cash_drawers
          SET cash_expenses = CASE WHEN cash_expenses - ? < 0 THEN 0 ELSE cash_expenses - ? END,
              expected_closing_cash = expected_closing_cash + ?
          WHERE status = 'open'
        `, [numAmount, numAmount, numAmount]);
      }
    });

    try {
      syncService.enqueueSync('expenses', id, 'delete');
    } catch (syncErr) {
      console.warn('Non-blocking sync enqueue error:', syncErr);
    }

    return res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getExpenses,
  createExpense,
  deleteExpense
};
