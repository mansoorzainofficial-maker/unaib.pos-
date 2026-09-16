const { getDb, query, get, run, transaction } = require('../config/db');

/**
 * Helper to generate sequential unique serial numbers for a product
 */
function generateSequentialSerials(productName, count, existingSerials = []) {
  const prefix = (productName || 'ACC').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase() || 'PROD';
  const timeCode = Date.now().toString().slice(-4);
  const generated = [];
  let seq = 1;
  const existingSet = new Set(existingSerials);

  while (generated.length < count) {
    const candidate = `SN-${prefix}-${timeCode}-${String(seq).padStart(3, '0')}`;
    seq++;
    if (!existingSet.has(candidate)) {
      existingSet.add(candidate);
      generated.push(candidate);
    }
  }
  return generated;
}

/**
 * Helper to mask cost_price if user is a cashier
 */
function sanitizeProduct(product, role) {
  if (!product) return null;
  if (role !== 'admin') {
    const { cost_price, ...safe } = product;
    return safe;
  }
  return product;
}

/**
 * Get all products with optional filters (search, category, low_stock, out_of_stock, has_serials)
 */
function getProducts(req, res) {
  try {
    const { search, category_id, low_stock, out_of_stock, has_serials } = req.query;
    const role = req.user ? req.user.role : 'cashier';

    let sql = `
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    const cleanSearch = (search && search !== 'undefined' && search !== 'null') ? search.trim() : null;
    const cleanCategory = (category_id && category_id !== 'undefined' && category_id !== 'null' && category_id !== '') ? category_id : null;

    if (cleanSearch) {
      const sTerm = `%${cleanSearch}%`;
      sql += ` AND (
        p.name LIKE ? COLLATE NOCASE
        OR p.barcode LIKE ?
        OR COALESCE(p.description, '') LIKE ? COLLATE NOCASE
        OR COALESCE(c.name, '') LIKE ? COLLATE NOCASE
        OR COALESCE(s.name, '') LIKE ? COLLATE NOCASE
        OR p.id IN (SELECT product_id FROM serial_numbers WHERE serial_number LIKE ? COLLATE NOCASE)
      )`;
      params.push(sTerm, sTerm, sTerm, sTerm, sTerm, sTerm);
    }

    if (cleanCategory) {
      sql += ` AND p.category_id = ?`;
      params.push(cleanCategory);
    }

    if (low_stock === 'true' || low_stock === '1') {
      sql += ` AND p.stock_quantity <= p.low_stock_threshold`;
    }

    if (out_of_stock === 'true' || out_of_stock === '1') {
      sql += ` AND p.stock_quantity <= 0`;
    }

    if (has_serials === 'true' || has_serials === '1') {
      sql += ` AND p.has_serials = 1`;
    }

    sql += ` ORDER BY p.name ASC`;

    const products = query(sql, params);
    
    // Attach available in-stock serials for serialized components
    const inStockSerials = query("SELECT product_id, serial_number FROM serial_numbers WHERE status = 'in_stock'");
    const serialsMap = {};
    for (const s of inStockSerials) {
      if (!serialsMap[s.product_id]) serialsMap[s.product_id] = [];
      serialsMap[s.product_id].push(s.serial_number);
    }

    const sanitized = products.map(p => {
      const sp = sanitizeProduct(p, role);
      if (p.has_serials) {
        const serials = serialsMap[p.id] || [];
        sp.availableSerials = serials;
        sp.inStockSerialsCount = serials.length;
      }
      return sp;
    });

    return res.json({ success: true, count: sanitized.length, products: sanitized });
  } catch (error) {
    console.error('getProducts error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get low stock warnings list for dashboard alerts
 */
function getLowStockAlerts(req, res) {
  try {
    const sql = `
      SELECT p.id, p.barcode, p.name, p.stock_quantity, p.low_stock_threshold, p.sale_price,
             c.name as category_name, s.name as supplier_name, s.phone as supplier_phone
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.stock_quantity <= p.low_stock_threshold
      ORDER BY p.stock_quantity ASC
    `;
    const lowStockProducts = query(sql);
    return res.json({
      success: true,
      count: lowStockProducts.length,
      alerts: lowStockProducts
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * High-speed barcode lookup (called when barcode scanner fires)
 */
function getProductByBarcode(req, res) {
  try {
    const { barcode } = req.params;
    const role = req.user ? req.user.role : 'cashier';

    const product = get(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.barcode = ?
    `, [barcode]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found for scanned barcode' });
    }

    // Also fetch available in-stock serial numbers if item has serials
    let availableSerials = [];
    if (product.has_serials) {
      availableSerials = query(
        "SELECT serial_number FROM serial_numbers WHERE product_id = ? AND status = 'in_stock'",
        [product.id]
      ).map(s => s.serial_number);
    }

    return res.json({
      success: true,
      product: {
        ...sanitizeProduct(product, role),
        availableSerials
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get single product by ID
 */
function getProductById(req, res) {
  try {
    const { id } = req.params;
    const role = req.user ? req.user.role : 'cashier';

    const product = get(`
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `, [id]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, product: sanitizeProduct(product, role) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create a new product (Admin only)
 */
function createProduct(req, res) {
  try {
    const {
      barcode,
      name,
      category_id,
      cost_price,
      sale_price,
      stock_quantity,
      low_stock_threshold,
      supplier_id,
      has_serials,
      warranty_months,
      description,
      initial_serials // optional array of serial strings
    } = req.body;

    if (!name || sale_price === undefined) {
      return res.status(400).json({ success: false, message: 'Product Name and Sale Price are required' });
    }

    // Check barcode uniqueness if provided
    if (barcode && barcode.trim().length > 0) {
      const existing = get('SELECT id FROM products WHERE barcode = ?', [barcode.trim()]);
      if (existing) {
        return res.status(400).json({ success: false, message: 'A product with this barcode already exists' });
      }
    }

    const stockQty = Number(stock_quantity) || 0;
    const isSerialized = has_serials ? 1 : 0;
    const cleanCategoryId = (category_id && Number(category_id) > 0) ? Number(category_id) : null;
    const cleanSupplierId = (supplier_id && Number(supplier_id) > 0) ? Number(supplier_id) : null;

    const result = transaction(({ run }) => {
      const insRes = run(`
        INSERT INTO products (
          barcode, name, category_id, cost_price, sale_price,
          stock_quantity, low_stock_threshold, supplier_id,
          has_serials, warranty_months, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        barcode ? barcode.trim() : null,
        name.trim(),
        cleanCategoryId,
        Number(cost_price) || 0,
        Number(sale_price) || 0,
        stockQty,
        Number(low_stock_threshold) || 5,
        cleanSupplierId,
        isSerialized,
        Number(warranty_months) || 12,
        description || null
      ]);

      const productId = insRes.lastInsertRowid;

      // Handle serial numbers if product is serialized
      if (isSerialized === 1 && stockQty > 0) {
        let serialsList = [];
        if (Array.isArray(initial_serials)) {
          serialsList = initial_serials.map(s => (s || '').trim()).filter(Boolean);
        }

        // Auto-generate missing serial numbers if fewer provided than stock quantity
        if (serialsList.length < stockQty) {
          const needed = stockQty - serialsList.length;
          const autoSerials = generateSequentialSerials(name.trim(), needed, serialsList);
          serialsList.push(...autoSerials);
        }

        // Insert into serial_numbers table
        for (const sn of serialsList) {
          run(`
            INSERT OR IGNORE INTO serial_numbers (serial_number, product_id, status)
            VALUES (?, ?, 'in_stock')
          `, [sn, productId]);
        }
      }

      return productId;
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      productId: result
    });
  } catch (error) {
    console.error('createProduct error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update existing product (Admin only)
 */
function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      barcode,
      name,
      category_id,
      cost_price,
      sale_price,
      stock_quantity,
      low_stock_threshold,
      supplier_id,
      has_serials,
      warranty_months,
      description
    } = req.body;

    const existing = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (barcode && barcode.trim().length > 0) {
      const duplicate = get('SELECT id FROM products WHERE barcode = ? AND id != ?', [barcode.trim(), id]);
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Barcode already in use by another product' });
      }
    }

    const newStock = Number(stock_quantity) || 0;
    const isSerialized = has_serials ? 1 : 0;
    const cleanCategoryId = (category_id && Number(category_id) > 0) ? Number(category_id) : null;
    const cleanSupplierId = (supplier_id && Number(supplier_id) > 0) ? Number(supplier_id) : null;

    transaction(({ run, query }) => {
      run(`
        UPDATE products SET
          barcode = ?,
          name = ?,
          category_id = ?,
          cost_price = ?,
          sale_price = ?,
          stock_quantity = ?,
          low_stock_threshold = ?,
          supplier_id = ?,
          has_serials = ?,
          warranty_months = ?,
          description = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        barcode ? barcode.trim() : null,
        name.trim(),
        cleanCategoryId,
        Number(cost_price) || 0,
        Number(sale_price) || 0,
        newStock,
        Number(low_stock_threshold) || 5,
        cleanSupplierId,
        isSerialized,
        Number(warranty_months) || 12,
        description || null,
        id
      ]);

      // If item is serialized and new stock exceeds existing in-stock serial numbers count,
      // automatically generate serial numbers for the deficit!
      if (isSerialized === 1 && newStock > 0) {
        const inStockSerials = query("SELECT serial_number FROM serial_numbers WHERE product_id = ? AND status = 'in_stock'", [id]);
        const currentCount = inStockSerials.length;
        if (currentCount < newStock) {
          const deficit = newStock - currentCount;
          const existingSNs = inStockSerials.map(s => s.serial_number);
          const newSerials = generateSequentialSerials(name.trim(), deficit, existingSNs);
          for (const sn of newSerials) {
            run("INSERT OR IGNORE INTO serial_numbers (serial_number, product_id, status) VALUES (?, ?, 'in_stock')", [sn, id]);
          }
        }
      }
    });

    return res.json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    console.error('updateProduct error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Delete product (Admin only)
 */
function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const existing = get('SELECT id, name FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check sales history
    const saleItem = get('SELECT id FROM invoice_items WHERE product_id = ? LIMIT 1', [id]);
    if (saleItem) {
      return res.status(400).json({
        success: false,
        message: `Product "${existing.name}" cannot be deleted because it exists in past sales invoices. To remove it from active sale, please set its stock to 0.`
      });
    }

    // Check purchase history
    const purItem = get('SELECT id FROM purchase_items WHERE product_id = ? LIMIT 1', [id]);
    if (purItem) {
      return res.status(400).json({
        success: false,
        message: `Product "${existing.name}" cannot be deleted because it has purchase history from suppliers. To remove it from active sale, please set its stock to 0.`
      });
    }

    // Check active warranty or sold serial numbers
    const soldSN = get("SELECT id FROM serial_numbers WHERE product_id = ? AND status != 'in_stock' LIMIT 1", [id]);
    if (soldSN) {
      return res.status(400).json({
        success: false,
        message: `Product "${existing.name}" cannot be deleted because it has serial numbers attached to customer warranties.`
      });
    }

    // Safe to delete in transaction
    transaction(({ run }) => {
      run('DELETE FROM serial_numbers WHERE product_id = ?', [id]);
      run('DELETE FROM products WHERE id = ?', [id]);
    });

    return res.json({ success: true, message: `Product "${existing.name}" deleted successfully` });
  } catch (error) {
    console.error('deleteProduct error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Automatically sync in-stock serial numbers with stock_quantity for a product
 */
function syncProductSerials(req, res) {
  try {
    const { id } = req.params;
    const product = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!product.has_serials) {
      return res.status(400).json({ success: false, message: 'Product is not configured for serial tracking' });
    }

    const inStockSerials = query("SELECT serial_number FROM serial_numbers WHERE product_id = ? AND status = 'in_stock'", [id]);
    const currentCount = inStockSerials.length;
    const targetQty = Number(product.stock_quantity) || 0;

    if (currentCount >= targetQty) {
      return res.json({
        success: true,
        message: `Product already has ${currentCount} serial numbers for ${targetQty} units in stock.`,
        synced: 0,
        totalInStockSerials: currentCount
      });
    }

    const needed = targetQty - currentCount;
    const existingSNs = inStockSerials.map(s => s.serial_number);
    const newSerials = generateSequentialSerials(product.name, needed, existingSNs);

    let inserted = 0;
    transaction(({ run }) => {
      for (const sn of newSerials) {
        run("INSERT OR IGNORE INTO serial_numbers (serial_number, product_id, status) VALUES (?, ?, 'in_stock')", [sn, id]);
        inserted++;
      }
    });

    return res.json({
      success: true,
      message: `Generated and registered ${inserted} missing serial numbers for "${product.name}".`,
      synced: inserted,
      totalInStockSerials: currentCount + inserted
    });
  } catch (error) {
    console.error('syncProductSerials error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get categories list
 */
function getCategories(req, res) {
  try {
    const categories = query('SELECT * FROM categories ORDER BY name ASC');
    return res.json({ success: true, categories });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create category (Admin only)
 */
function createCategory(req, res) {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });

    const result = run('INSERT INTO categories (name, description) VALUES (?, ?)', [name.trim(), description || null]);
    return res.status(201).json({ success: true, categoryId: result.lastInsertRowid });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get suppliers list
 */
function getSuppliers(req, res) {
  try {
    const suppliers = query('SELECT * FROM suppliers ORDER BY name ASC');
    return res.json({ success: true, suppliers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create supplier (Admin only)
 */
function createSupplier(req, res) {
  try {
    const { name, contact_person, phone, email, address, opening_balance } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Supplier name is required' });

    const openBal = Number(opening_balance) || 0;
    const result = run(
      'INSERT INTO suppliers (name, contact_person, phone, email, address, current_balance) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), contact_person || null, phone || null, email || null, address || null, openBal]
    );
    const supplierId = result.lastInsertRowid;

    if (openBal > 0) {
      run(`
        INSERT INTO ledger_entries (
          party_type, party_id, entry_type, debit, credit, description, entry_date
        ) VALUES ('supplier', ?, 'opening_balance', 0, ?, 'Opening Balance (Previous Payable)', DATE('now'))
      `, [supplierId, openBal]);
    }

    return res.status(201).json({ success: true, message: 'Supplier registered successfully', supplierId });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get unresolved oversold stock alerts (triggered by offline billing sync)
 * GET /api/products/alerts/oversold?status=pending|resolved|all
 */
function getOversoldAlerts(req, res) {
  try {
    const status = req.query.status || 'pending';
    let sql = `
      SELECT sa.*, p.stock_quantity as current_stock, p.barcode
      FROM stock_alerts sa
      LEFT JOIN products p ON sa.product_id = p.id
    `;
    const params = [];
    if (status !== 'all') {
      sql += ' WHERE sa.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY sa.id DESC';

    const alerts = query(sql, params);
    return res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Resolve an oversold alert
 * POST /api/products/alerts/oversold/:id/resolve
 */
function resolveOversoldAlert(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const notes = req.body.notes || '';

    const alert = get('SELECT * FROM stock_alerts WHERE id = ?', [id]);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Stock alert not found' });
    }

    run(`
      UPDATE stock_alerts
      SET status = 'resolved',
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = ?,
          notes = CASE WHEN notes IS NOT NULL AND notes != '' THEN notes || ' | ' || ? ELSE ? END
      WHERE id = ?
    `, [userId, notes, notes, id]);

    return res.json({
      success: true,
      message: 'اسٹاک الرٹ کامیابی سے حل شدہ مارک کر دیا گیا ہے۔ (Alert resolved successfully)'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getProducts,
  getProductById,
  getProductByBarcode,
  getLowStockAlerts,
  getOversoldAlerts,
  resolveOversoldAlert,
  createProduct,
  updateProduct,
  deleteProduct,
  syncProductSerials,
  getCategories,
  createCategory,
  getSuppliers,
  createSupplier
};
