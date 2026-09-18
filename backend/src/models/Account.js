const { query, get, run } = require('../config/db');

class Account {
  static async getAll() {
    return await query(`
      SELECT 
        id, 
        name, 
        type, 
        account_number, 
        branch_name, 
        current_balance,
        is_default, 
        created_at 
      FROM accounts 
      ORDER BY is_default DESC, name ASC
    `);
  }

  static async getById(id) {
    return await get('SELECT * FROM accounts WHERE id = ?', [id]);
  }

  static async getByName(name, excludeId = null) {
    if (excludeId) {
      return await get('SELECT * FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?', [name, excludeId]);
    }
    return await get('SELECT * FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [name]);
  }

  static async create({ name, type, account_number = null, branch_name = null, current_balance = 0.0, is_default = 0 }) {
    const numBalance = Number(current_balance) || 0.0;
    const res = await run(`
      INSERT INTO accounts (name, type, account_number, branch_name, current_balance, is_default)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, type, account_number, branch_name, numBalance, is_default ? 1 : 0]);

    return await this.getById(res.lastInsertRowid);
  }

  static async update(id, { name, type, account_number = null, branch_name = null, current_balance = null }) {
    if (current_balance !== null && current_balance !== undefined) {
      await run(`
        UPDATE accounts
        SET name = ?, type = ?, account_number = ?, branch_name = ?, current_balance = ?
        WHERE id = ?
      `, [name, type, account_number, branch_name, Number(current_balance) || 0.0, id]);
    } else {
      await run(`
        UPDATE accounts
        SET name = ?, type = ?, account_number = ?, branch_name = ?
        WHERE id = ?
      `, [name, type, account_number, branch_name, id]);
    }

    return await this.getById(id);
  }

  /**
   * Calculate live financial balance for this account
   */
  static async calculateBalance(account) {
    if (!account || !account.id) return 0;
    const accId = account.id;
    let balance = Number(account.current_balance || 0);

    if (account.type === 'cash' || account.is_default === 1) {
      // 1. Sales cash: net completed cash received (paid_amount - change_amount)
      let salesAmt = 0;
      try {
        const salesRow = await get(`
          SELECT COALESCE(SUM(paid_amount - change_amount), 0) as amt
          FROM invoices
          WHERE payment_method = 'cash'
            AND status = 'completed'
        `);
        salesAmt = Number(salesRow?.amt || 0);
      } catch (_) {}

      // 2. Customer Khata recoveries in cash
      let custRecoveryAmt = 0;
      try {
        const custRow = await get(`
          SELECT COALESCE(SUM(credit), 0) as amt
          FROM ledger_entries
          WHERE (account_id = ? OR (account_id IS NULL AND payment_method = 'cash'))
            AND party_type IN ('client', 'customer')
            AND entry_type IN ('payment', 'payment_received')
        `, [accId]);
        custRecoveryAmt = Number(custRow?.amt || 0);
      } catch (_) {}

      // 3. Purchase Returns cash received
      let purReturnAmt = 0;
      try {
        const purReturnRow = await get(`
          SELECT COALESCE(SUM(total_amount), 0) as amt
          FROM purchase_returns
          WHERE refund_mode = 'cash'
        `);
        purReturnAmt = Number(purReturnRow?.amt || 0);
      } catch (_) {}

      // 4. Operational Expenses in cash
      let expenseAmt = 0;
      try {
        const expRow = await get(`
          SELECT COALESCE(SUM(amount), 0) as amt
          FROM expenses
          WHERE (account_id = ? OR payment_method = 'cash')
        `, [accId]);
        expenseAmt = Number(expRow?.amt || 0);
      } catch (_) {}

      // 5. Purchases paid in cash
      let purchaseAmt = 0;
      try {
        const purRow = await get(`
          SELECT COALESCE(SUM(paid_amount), 0) as amt
          FROM purchases
          WHERE (account_id = ? OR payment_method = 'cash')
            AND (status IS NULL OR status != 'void')
        `, [accId]);
        purchaseAmt = Number(purRow?.amt || 0);
      } catch (_) {}

      // 6. Supplier Khata payments made in cash
      let suppPaymentAmt = 0;
      try {
        const suppRow = await get(`
          SELECT COALESCE(SUM(CASE WHEN credit > 0 THEN credit ELSE debit END), 0) as amt
          FROM ledger_entries
          WHERE (account_id = ? OR (account_id IS NULL AND payment_method = 'cash'))
            AND party_type = 'supplier'
            AND entry_type IN ('payment', 'payment_made')
        `, [accId]);
        suppPaymentAmt = Number(suppRow?.amt || 0);
      } catch (_) {}

      // 7. Sales returns cash refunded
      let saleReturnAmt = 0;
      try {
        const saleReturnRow = await get(`
          SELECT COALESCE(SUM(total_refund_amount), 0) as amt
          FROM sales_returns
          WHERE refund_mode = 'cash'
        `);
        saleReturnAmt = Number(saleReturnRow?.amt || 0);
      } catch (_) {}

      balance += salesAmt + custRecoveryAmt + purReturnAmt - expenseAmt - purchaseAmt - suppPaymentAmt - saleReturnAmt;
    } else {
      // Bank / Digital Wallet account
      // Inflows: Customer payments received via this specific account
      let custRecoveryAmt = 0;
      try {
        const custRow = await get(`
          SELECT COALESCE(SUM(credit), 0) as amt
          FROM ledger_entries
          WHERE account_id = ?
            AND party_type IN ('client', 'customer')
            AND entry_type IN ('payment', 'payment_received')
        `, [accId]);
        custRecoveryAmt = Number(custRow?.amt || 0);
      } catch (_) {}

      // Outflows: Supplier payments made from this account
      let suppPaymentAmt = 0;
      try {
        const suppRow = await get(`
          SELECT COALESCE(SUM(CASE WHEN credit > 0 THEN credit ELSE debit END), 0) as amt
          FROM ledger_entries
          WHERE account_id = ?
            AND party_type = 'supplier'
            AND entry_type IN ('payment', 'payment_made')
        `, [accId]);
        suppPaymentAmt = Number(suppRow?.amt || 0);
      } catch (_) {}

      // Outflows: Expenses paid from this account
      let expenseAmt = 0;
      try {
        const expRow = await get(`
          SELECT COALESCE(SUM(amount), 0) as amt
          FROM expenses
          WHERE account_id = ?
        `, [accId]);
        expenseAmt = Number(expRow?.amt || 0);
      } catch (_) {}

      // Outflows: Purchases paid from this account
      let purchaseAmt = 0;
      try {
        const purRow = await get(`
          SELECT COALESCE(SUM(paid_amount), 0) as amt
          FROM purchases
          WHERE account_id = ?
            AND (status IS NULL OR status != 'void')
        `, [accId]);
        purchaseAmt = Number(purRow?.amt || 0);
      } catch (_) {}

      balance += custRecoveryAmt - suppPaymentAmt - expenseAmt - purchaseAmt;
    }

    return Math.round(balance * 100) / 100;
  }

  static async hasTransactions(id) {
    const ledgerRow = await get('SELECT COUNT(*) as count FROM ledger_entries WHERE account_id = ?', [id]);
    const ledgerCount = ledgerRow ? Number(ledgerRow.count) : 0;

    let txCount = 0;
    try {
      const txRow = await get('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?', [id]);
      txCount = txRow ? Number(txRow.count) : 0;
    } catch (_) {}

    return (ledgerCount + txCount) > 0;
  }

  static async delete(id) {
    return await run('DELETE FROM accounts WHERE id = ?', [id]);
  }
}

module.exports = Account;
