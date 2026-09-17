const { query, get, run, transaction } = require('../config/db');

class Grn {
  static async getAll() {
    return await query(`
      SELECT 
        g.id,
        g.grn_number,
        g.supplier_id,
        s.name AS supplier_name,
        s.phone AS supplier_phone,
        g.total_amount,
        g.payment_type,
        g.status,
        g.received_date,
        g.notes,
        g.created_at,
        (SELECT COUNT(*) FROM grn_items gi WHERE gi.grn_id = g.id) AS total_items,
        (SELECT COALESCE(SUM(gi.quantity_received), 0) FROM grn_items gi WHERE gi.grn_id = g.id) AS total_quantity_received
      FROM grn g
      JOIN suppliers s ON g.supplier_id = s.id
      ORDER BY g.id DESC
    `);
  }

  static async getById(id) {
    const header = await get(`
      SELECT 
        g.id,
        g.grn_number,
        g.supplier_id,
        s.name AS supplier_name,
        s.contact_person AS supplier_contact_person,
        s.phone AS supplier_phone,
        s.email AS supplier_email,
        s.address AS supplier_address,
        COALESCE(s.total_due, s.current_balance, 0.0) AS supplier_total_due,
        g.total_amount,
        g.payment_type,
        g.status,
        g.received_date,
        g.notes,
        g.created_at
      FROM grn g
      JOIN suppliers s ON g.supplier_id = s.id
      WHERE g.id = ?
    `, [id]);

    if (!header) return null;

    const items = await query(`
      SELECT 
        gi.id,
        gi.grn_id,
        gi.product_id,
        p.name AS product_name,
        p.barcode AS product_barcode,
        gi.quantity_ordered,
        gi.quantity_received,
        gi.unit_cost,
        gi.total_cost
      FROM grn_items gi
      JOIN products p ON gi.product_id = p.id
      WHERE gi.grn_id = ?
      ORDER BY gi.id ASC
    `, [id]);

    return {
      ...header,
      items
    };
  }

  static async generateNextGrnNumber(dbGet = get) {
    const last = await dbGet('SELECT grn_number FROM grn ORDER BY id DESC LIMIT 1');
    if (!last || !last.grn_number) {
      return 'GRN-0001';
    }
    const match = last.grn_number.match(/GRN-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `GRN-${String(nextNum).padStart(4, '0')}`;
    }
    const countRow = await dbGet('SELECT COUNT(*) as cnt FROM grn');
    const nextCount = (Number(countRow?.cnt) || 0) + 1;
    return `GRN-${String(nextCount).padStart(4, '0')}`;
  }

  /**
   * Create GRN with Atomic SQL Transaction
   */
  static async create({ supplier_id, payment_type, received_date, notes = null, items = [] }) {
    if (!supplier_id) throw new Error('Supplier is required');
    if (!payment_type || !['cash', 'credit'].includes(payment_type)) {
      throw new Error('Valid payment type ("cash" or "credit") is required');
    }
    if (!received_date) throw new Error('Received date is required');
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('At least one product item is required in GRN');
    }

    const grnId = await transaction(async ({ query: txQuery, get: txGet, run: txRun }) => {
      // 1. Verify supplier
      const supplier = await txGet('SELECT id, name, total_due, current_balance FROM suppliers WHERE id = ?', [supplier_id]);
      if (!supplier) throw new Error(`Supplier with ID ${supplier_id} not found`);

      // 2. Validate and calculate items total
      let calculatedTotal = 0;
      const validatedItems = [];
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const product = await txGet('SELECT id, name, stock_quantity, cost_price FROM products WHERE id = ?', [item.product_id]);
        if (!product) {
          throw new Error(`Item #${idx + 1}: Product with ID ${item.product_id} does not exist`);
        }

        const qtyOrdered = Number(item.quantity_ordered) || Number(item.quantity_received) || 1;
        const qtyReceived = Number(item.quantity_received) || 0;
        const unitCost = Number(item.unit_cost) || 0;

        if (qtyReceived <= 0) {
          throw new Error(`Item #${idx + 1} (${product.name}): Quantity received must be greater than 0`);
        }
        if (unitCost < 0) {
          throw new Error(`Item #${idx + 1} (${product.name}): Unit cost cannot be negative`);
        }

        const lineTotal = Math.round(qtyReceived * unitCost * 100) / 100;
        calculatedTotal += lineTotal;

        validatedItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity_ordered: qtyOrdered,
          quantity_received: qtyReceived,
          unit_cost: unitCost,
          total_cost: lineTotal
        });
      }

      calculatedTotal = Math.round(calculatedTotal * 100) / 100;

      // 3. Generate sequential GRN Number using transaction-scoped get
      const grnNumber = await this.generateNextGrnNumber(txGet);

      // 4. Insert GRN header
      const grnRes = await txRun(`
        INSERT INTO grn (grn_number, supplier_id, total_amount, payment_type, status, received_date, notes)
        VALUES (?, ?, ?, ?, 'completed', ?, ?)
      `, [grnNumber, supplier_id, calculatedTotal, payment_type, received_date, notes]);

      const newGrnId = grnRes.lastInsertRowid;

      // 5. Insert GRN Items & Update Product Stock
      for (const item of validatedItems) {
        await txRun(`
          INSERT INTO grn_items (grn_id, product_id, quantity_ordered, quantity_received, unit_cost, total_cost)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [newGrnId, item.product_id, item.quantity_ordered, item.quantity_received, item.unit_cost, item.total_cost]);

        await txRun(`
          UPDATE products 
          SET 
            stock_quantity = stock_quantity + ?,
            cost_price = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [item.quantity_received, item.unit_cost, item.product_id]);
      }

      // 6. Handle Payment Type
      if (payment_type === 'credit') {
        await txRun(`
          UPDATE suppliers 
          SET 
            total_due = COALESCE(total_due, 0.0) + ?,
            current_balance = COALESCE(current_balance, 0.0) + ?
          WHERE id = ?
        `, [calculatedTotal, calculatedTotal, supplier_id]);

        try {
          await txRun(`
            INSERT INTO ledger_entries (
              party_type, party_id, entry_type, reference_no, 
              debit, credit, account_id, description, entry_date
            ) VALUES (
              'supplier', ?, 'grn', ?,
              ?, 0.0, NULL, ?, ?
            )
          `, [supplier_id, grnNumber, calculatedTotal, `Goods Received Note: ${grnNumber}`, received_date]);
        } catch (ledgerErr) {
          console.warn('Ledger entry log notice:', ledgerErr.message);
        }
      } else if (payment_type === 'cash') {
        // Find default cash account to deduct balance
        const defaultAcc = await txGet("SELECT id, current_balance FROM accounts WHERE is_default = 1 LIMIT 1");
        if (defaultAcc) {
          await txRun(`
            INSERT INTO accounts_ledger (
              account_id, entry_type, reference_no, debit, credit, balance_after, description
            ) VALUES (
              ?, 'grn_cash', ?, 0.0, ?, (SELECT current_balance - ? FROM accounts WHERE id = ?), ?
            )
          `, [defaultAcc.id, grnNumber, calculatedTotal, calculatedTotal, defaultAcc.id, `Paid cash for ${grnNumber} to ${supplier.name}`]);
          await txRun('UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?', [calculatedTotal, defaultAcc.id]);
        }
      }

      return newGrnId;
    });

    // 7. Read full record AFTER transaction commits
    return await this.getById(grnId);
  }
}

module.exports = Grn;
