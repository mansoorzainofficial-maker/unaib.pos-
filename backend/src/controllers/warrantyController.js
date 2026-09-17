const { query, get, run, transaction } = require('../config/db');

/**
 * Look up component by Serial Number
 * Shows full warranty lifecycle, invoice link, and customer details
 */
async function lookupSerial(req, res) {
  try {
    const { serial_number } = req.params;
    const cleanSN = serial_number.trim();

    const serial = await get(`
      SELECT
        sn.*,
        p.name as product_name,
        p.barcode as product_barcode,
        p.warranty_months as default_warranty_months,
        c.name as customer_name,
        c.phone as customer_phone,
        COALESCE(c.name, inv.customer_name, 'عام واک ان گاہک') as display_customer_name,
        COALESCE(c.phone, inv.customer_phone, '—') as display_customer_phone,
        inv.invoice_number,
        inv.created_at as invoice_date,
        s.name as supplier_name
      FROM serial_numbers sn
      JOIN products p ON sn.product_id = p.id
      LEFT JOIN customers c ON sn.customer_id = c.id
      LEFT JOIN invoices inv ON sn.invoice_id = inv.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE sn.serial_number = ?
    `, [cleanSN]);

    if (!serial) {
      return res.status(404).json({
        success: false,
        message: `Serial Number "${cleanSN}" not found in system.`
      });
    }

    // Calculate warranty remaining or expired
    let warrantyStatus = 'not_sold';
    let daysRemaining = 0;
    let isWarrantyValid = false;

    if (serial.sold_date && serial.warranty_expiry_date) {
      const now = new Date();
      const expiry = new Date(serial.warranty_expiry_date);
      const diffMs = expiry - now;
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysRemaining > 0) {
        warrantyStatus = 'active';
        isWarrantyValid = true;
      } else {
        warrantyStatus = 'expired';
        isWarrantyValid = false;
      }
    }

    // Fetch existing claims / RMA history for this serial number
    const claims = await query(`
      SELECT wc.*, inv.invoice_number
      FROM warranty_claims wc
      LEFT JOIN invoices inv ON wc.invoice_id = inv.id
      WHERE wc.serial_number_id = ?
      ORDER BY wc.id DESC
    `, [serial.id]);

    return res.json({
      success: true,
      serial: {
        ...serial,
        warrantyStatus,
        daysRemaining,
        isWarrantyValid,
        claims
      }
    });
  } catch (error) {
    console.error('lookupSerial error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get all serial numbers with filter by status or product
 */
async function getSerialNumbers(req, res) {
  try {
    const { status, product_id, search, limit = 100 } = req.query;

    let sql = `
      SELECT sn.*, p.name as product_name,
             COALESCE(c.name, inv.customer_name, CASE WHEN sn.status = 'sold' THEN 'عام واک ان گاہک' ELSE NULL END) as customer_name,
             inv.invoice_number
      FROM serial_numbers sn
      JOIN products p ON sn.product_id = p.id
      LEFT JOIN customers c ON sn.customer_id = c.id
      LEFT JOIN invoices inv ON sn.invoice_id = inv.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND sn.status = ?`;
      params.push(status);
    }

    if (product_id) {
      sql += ` AND sn.product_id = ?`;
      params.push(product_id);
    }

    if (search) {
      sql += ` AND (sn.serial_number LIKE ? OR p.name LIKE ? OR inv.invoice_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY sn.id DESC LIMIT ?`;
    params.push(Number(limit));

    const serials = await query(sql, params);
    return res.json({ success: true, count: serials.length, serials });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Add new serial numbers to stock (for inventory receipt)
 */
async function addSerialsToStock(req, res) {
  try {
    const { product_id, serial_numbers } = req.body;
    if (!product_id || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ success: false, message: 'Product ID and serial numbers list required' });
    }

    const product = await get('SELECT id, name FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let inserted = 0;
    const errors = [];

    await transaction(async ({ get: txGet, run: txRun }) => {
      for (const sn of serial_numbers) {
        const clean = sn.trim();
        if (!clean) continue;
        const exists = await txGet('SELECT id FROM serial_numbers WHERE serial_number = ?', [clean]);
        if (exists) {
          errors.push(`Serial "${clean}" already exists in database.`);
          continue;
        }
        await txRun("INSERT INTO serial_numbers (serial_number, product_id, status) VALUES (?, ?, 'in_stock')", [clean, product_id]);
        inserted++;
      }
      // Update stock quantity on product
      if (inserted > 0) {
        await txRun('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [inserted, product_id]);
      }
    });

    return res.json({
      success: true,
      message: `Added ${inserted} serial numbers to stock for ${product.name}`,
      inserted,
      errors
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create a new Warranty / RMA claim
 */
async function createClaim(req, res) {
  try {
    const { serial_number_id, issue_description, notes } = req.body;

    if (!serial_number_id || !issue_description) {
      return res.status(400).json({ success: false, message: 'Serial number and issue description required' });
    }

    const serial = await get('SELECT * FROM serial_numbers WHERE id = ?', [serial_number_id]);
    if (!serial) {
      return res.status(404).json({ success: false, message: 'Serial number record not found' });
    }

    // Generate RMA Claim Number e.g. RMA-20260909-001
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const lastClaim = await get(`SELECT claim_number FROM warranty_claims WHERE claim_number LIKE 'RMA-${dateStr}-%' ORDER BY id DESC LIMIT 1`);
    let seq = 1;
    if (lastClaim) {
      const parts = lastClaim.claim_number.split('-');
      if (parts.length === 3) seq = parseInt(parts[2], 10) + 1;
    }
    const claimNumber = `RMA-${dateStr}-${String(seq).padStart(3, '0')}`;

    const result = await run(`
      INSERT INTO warranty_claims (
        claim_number, serial_number_id, invoice_id, customer_id,
        issue_description, status, resolution_notes
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [
      claimNumber,
      serial.id,
      serial.invoice_id || null,
      serial.customer_id || null,
      issue_description.trim(),
      notes || null
    ]);

    // Update serial status to rma_claimed
    await run("UPDATE serial_numbers SET status = 'rma_claimed' WHERE id = ?", [serial.id]);

    return res.status(201).json({
      success: true,
      message: 'Warranty RMA claim created successfully',
      claimNumber,
      claimId: result.lastInsertRowid
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get all RMA warranty claims
 */
async function getClaims(req, res) {
  try {
    const { status } = req.query;
    let sql = `
      SELECT wc.*, sn.serial_number, p.name as product_name, c.name as customer_name, c.phone as customer_phone, inv.invoice_number
      FROM warranty_claims wc
      JOIN serial_numbers sn ON wc.serial_number_id = sn.id
      JOIN products p ON sn.product_id = p.id
      LEFT JOIN customers c ON wc.customer_id = c.id
      LEFT JOIN invoices inv ON wc.invoice_id = inv.id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      sql += ` AND wc.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY wc.id DESC`;

    const claims = await query(sql, params);
    return res.json({ success: true, count: claims.length, claims });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update RMA Claim Status (sent_to_vendor, repaired, replaced, rejected)
 */
async function updateClaimStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, resolution_notes } = req.body;

    const claim = await get('SELECT * FROM warranty_claims WHERE id = ?', [id]);
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const isResolved = ['repaired', 'replaced', 'rejected'].includes(status);
    const resolvedAt = isResolved ? new Date().toISOString() : null;

    await run(`
      UPDATE warranty_claims
      SET status = ?, resolution_notes = ?, resolved_at = ?
      WHERE id = ?
    `, [status, resolution_notes || null, resolvedAt, id]);

    // If replaced or returned to customer, adjust serial status
    if (status === 'replaced') {
      await run("UPDATE serial_numbers SET status = 'returned' WHERE id = ?", [claim.serial_number_id]);
    } else if (status === 'repaired') {
      await run("UPDATE serial_numbers SET status = 'sold' WHERE id = ?", [claim.serial_number_id]);
    }

    return res.json({ success: true, message: `Claim status updated to ${status}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  lookupSerial,
  getSerialNumbers,
  addSerialsToStock,
  createClaim,
  getClaims,
  updateClaimStatus
};
