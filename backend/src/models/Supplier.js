const { query, get, run } = require('../config/db');

class Supplier {
  static getAll() {
    return query(`
      SELECT 
        id, 
        name, 
        contact_person, 
        phone, 
        email, 
        address, 
        COALESCE(total_due, current_balance, 0.0) AS total_due, 
        created_at 
      FROM suppliers 
      ORDER BY name ASC
    `);
  }

  static getById(id) {
    return get(`
      SELECT 
        id, 
        name, 
        contact_person, 
        phone, 
        email, 
        address, 
        COALESCE(total_due, current_balance, 0.0) AS total_due, 
        created_at 
      FROM suppliers 
      WHERE id = ?
    `, [id]);
  }

  static create({ name, contact_person = null, phone = null, email = null, address = null, total_due = 0.0 }) {
    const res = run(`
      INSERT INTO suppliers (name, contact_person, phone, email, address, total_due, current_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, contact_person, phone, email, address, total_due, total_due]);

    return this.getById(res.lastInsertRowid);
  }

  static update(id, { name, contact_person = null, phone = null, email = null, address = null }) {
    run(`
      UPDATE suppliers 
      SET 
        name = ?, 
        contact_person = ?, 
        phone = ?, 
        email = ?, 
        address = ?
      WHERE id = ?
    `, [name, contact_person, phone, email, address, id]);

    return this.getById(id);
  }

  static delete(id) {
    // Check if supplier has any GRNs
    const grnCheck = get('SELECT COUNT(*) as count FROM grn WHERE supplier_id = ?', [id]);
    if (grnCheck && grnCheck.count > 0) {
      throw new Error(`Supplier cannot be deleted because they have ${grnCheck.count} associated GRN record(s).`);
    }

    // Check if supplier has any purchases
    const purchaseCheck = get('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?', [id]);
    if (purchaseCheck && purchaseCheck.count > 0) {
      throw new Error(`Supplier cannot be deleted because they have ${purchaseCheck.count} associated purchase invoice(s).`);
    }

    const res = run('DELETE FROM suppliers WHERE id = ?', [id]);
    return res.changes > 0;
  }

  static updateDue(id, amountChange) {
    run(`
      UPDATE suppliers 
      SET 
        total_due = COALESCE(total_due, 0.0) + ?,
        current_balance = COALESCE(current_balance, 0.0) + ?
      WHERE id = ?
    `, [amountChange, amountChange, id]);

    return this.getById(id);
  }
}

module.exports = Supplier;
