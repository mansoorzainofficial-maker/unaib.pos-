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

  static async create({ name, type, account_number = null, branch_name = null, is_default = 0 }) {
    const res = await run(`
      INSERT INTO accounts (name, type, account_number, branch_name, is_default)
      VALUES (?, ?, ?, ?, ?)
    `, [name, type, account_number, branch_name, is_default ? 1 : 0]);

    return await this.getById(res.lastInsertRowid);
  }

  static async update(id, { name, type, account_number = null, branch_name = null }) {
    await run(`
      UPDATE accounts
      SET name = ?, type = ?, account_number = ?, branch_name = ?
      WHERE id = ?
    `, [name, type, account_number, branch_name, id]);

    return await this.getById(id);
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
