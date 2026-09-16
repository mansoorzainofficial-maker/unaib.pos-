const { query, get, run } = require('../config/db');

class Account {
  static getAll() {
    return query(`
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

  static getById(id) {
    return get('SELECT * FROM accounts WHERE id = ?', [id]);
  }

  static getByName(name, excludeId = null) {
    if (excludeId) {
      return get('SELECT * FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?', [name, excludeId]);
    }
    return get('SELECT * FROM accounts WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [name]);
  }

  static create({ name, type, account_number = null, branch_name = null, is_default = 0 }) {
    const res = run(`
      INSERT INTO accounts (name, type, account_number, branch_name, is_default)
      VALUES (?, ?, ?, ?, ?)
    `, [name, type, account_number, branch_name, is_default ? 1 : 0]);

    return this.getById(res.lastInsertRowid);
  }

  static update(id, { name, type, account_number = null, branch_name = null }) {
    run(`
      UPDATE accounts
      SET name = ?, type = ?, account_number = ?, branch_name = ?
      WHERE id = ?
    `, [name, type, account_number, branch_name, id]);

    return this.getById(id);
  }

  static hasTransactions(id) {
    const ledgerRow = get('SELECT COUNT(*) as count FROM ledger_entries WHERE account_id = ?', [id]);
    const ledgerCount = ledgerRow ? Number(ledgerRow.count) : 0;

    let txCount = 0;
    try {
      const txRow = get('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?', [id]);
      txCount = txRow ? Number(txRow.count) : 0;
    } catch (_) {}

    return (ledgerCount + txCount) > 0;
  }

  static delete(id) {
    return run('DELETE FROM accounts WHERE id = ?', [id]);
  }
}

module.exports = Account;
