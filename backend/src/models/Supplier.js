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
    // 1. Check if supplier has any GRNs
    const grnCheck = await get('SELECT COUNT(*) as count FROM grn WHERE supplier_id = ?', [id]);
    if (grnCheck && Number(grnCheck.count) > 0) {
      throw new Error(`سپلائر ڈیلیٹ نہیں کیا جا سکتا کیونکہ اس کے نام پر ${grnCheck.count} عدد GRN ریکارڈ موجود ہیں۔`);
    }

    // 2. Check if supplier has any purchases
    const purchaseCheck = await get('SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?', [id]);
    if (purchaseCheck && Number(purchaseCheck.count) > 0) {
      throw new Error(`سپلائر ڈیلیٹ نہیں کیا جا سکتا کیونکہ اس کے نام پر ${purchaseCheck.count} عدد خریداری کے بل موجود ہیں۔`);
    }

    // 3. Check if supplier has any ledger entries (payments or opening balance)
    const ledgerCheck = await get("SELECT COUNT(*) as count FROM ledger_entries WHERE party_type = 'supplier' AND party_id = ?", [id]);
    if (ledgerCheck && Number(ledgerCheck.count) > 0) {
      throw new Error(`سپلائر ڈیلیٹ نہیں کیا جا سکتا کیونکہ کھاتے میں ${ledgerCheck.count} عدد لیجر یا ادائیگی کی انٹریز موجود ہیں۔`);
    }

    // 4. Check if supplier has non-zero due balance
    const sup = await this.getById(id);
    if (sup) {
      const bal = Number(sup.total_due || sup.current_balance || 0);
      if (Math.abs(bal) > 0.01) {
        throw new Error(`سپلائر کا واجب الادا بقایا Rs. ${bal.toLocaleString()} موجود ہے۔ ڈیلیٹ کرنے سے پہلے کھاتہ صفر (0) کریں۔`);
      }
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
