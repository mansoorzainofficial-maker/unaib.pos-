const { query, get, run } = require('../config/db');

class Supplier {
  static async getAll() {
    return await query(`
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

  static async getById(id) {
    return await get(`
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

  static async create({ name, contact_person = null, phone = null, email = null, address = null, total_due = 0.0 }) {
    const res = await run(`
      INSERT INTO suppliers (name, contact_person, phone, email, address, total_due, current_balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, contact_person, phone, email, address, total_due, total_due]);

    return await this.getById(res.lastInsertRowid);
  }

  static async update(id, { name, contact_person = null, phone = null, email = null, address = null }) {
    await run(`
      UPDATE suppliers 
      SET 
        name = ?, 
        contact_person = ?, 
        phone = ?, 
        email = ?, 
        address = ?
      WHERE id = ?
    `, [name, contact_person, phone, email, address, id]);

    return await this.getById(id);
  }

  static async delete(id) {
    // Check if supplier has any GRNs
    const grnCheck = await get('SELECT COUNT(*) as count FROM grn WHERE supplier_id = ?', [id]);
    if (grnCheck && Number(grnCheck.count) > 0) {
      throw new Error(`Supplier cannot be deleted because they have ${grnCheck.count} associated GRN record(s).`);
    }

    // Check if supplier has any purchases
    const purchaseCheck = await get('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?', [id]);
    if (purchaseCheck && Number(purchaseCheck.count) > 0) {
      throw new Error(`Supplier cannot be deleted because they have ${purchaseCheck.count} associated purchase invoice(s).`);
    }

    const res = await run('DELETE FROM suppliers WHERE id = ?', [id]);
    return res.changes > 0;
  }

  static async updateDue(id, amountChange) {
    await run(`
      UPDATE suppliers 
      SET 
        total_due = COALESCE(total_due, current_balance, 0.0) + ?,
        current_balance = COALESCE(current_balance, total_due, 0.0) + ?
      WHERE id = ?
    `, [amountChange, amountChange, id]);

    return await this.getById(id);
  }
}

module.exports = Supplier;
