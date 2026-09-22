const { getDb, getPgPool, pingCloudDb, isPostgres } = require('../config/db');

let isSyncing = false;
let lastSyncTime = null;
let syncTimer = null;

/**
 * Enqueue a change to the local sync queue (1ms local SQLite write, zero network dependence)
 * @param {string} tableName - e.g. 'invoices', 'products', 'customers', 'suppliers', etc.
 * @param {string|number} recordId - primary key ID of local record
 * @param {'insert'|'update'|'delete'} action
 * @param {object|null} [payload] - optional custom payload snapshot
 */
function enqueueSync(tableName, recordId, action = 'insert', payload = null) {
  // If running directly on Postgres (e.g. Vercel cloud), local sync queue is not needed
  if (isPostgres) return;

  try {
    const db = getDb();
    if (!db) return;

    const cleanRecordId = String(recordId);
    const payloadJson = payload ? JSON.stringify(payload) : null;

    // Check if an entry for this record already exists in pending state to avoid duplicate queue bloat
    const existing = db.prepare(`
      SELECT id FROM sync_queue 
      WHERE table_name = ? AND record_id = ? AND status = 'pending'
      LIMIT 1
    `).get(tableName, cleanRecordId);

    if (existing) {
      db.prepare(`
        UPDATE sync_queue 
        SET action = ?, payload = COALESCE(?, payload), updated_at = CURRENT_TIMESTAMP, retry_count = 0
        WHERE id = ?
      `).run(action, payloadJson, existing.id);
    } else {
      db.prepare(`
        INSERT INTO sync_queue (table_name, record_id, action, payload, status)
        VALUES (?, ?, ?, ?, 'pending')
      `).run(tableName, cleanRecordId, action, payloadJson);
    }

    // Mark local table record as pending sync
    try {
      db.prepare(`
        UPDATE ${tableName} 
        SET sync_status = 'pending', local_updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(recordId);
    } catch (_) {
      // Table might not have id or sync_status column, ignore gracefully
    }
  } catch (err) {
    console.error(`[SyncQueue Error] Failed to enqueue ${action} for ${tableName}:${recordId}:`, err.message);
  }
}

/**
 * Get current sync status summary for UI indicator and health monitoring
 */
async function getSyncStatus() {
  const db = getDb();
  let pendingCount = 0;
  let failedCount = 0;

  if (db && !isPostgres) {
    try {
      const pRow = db.prepare("SELECT COUNT(*) as cnt FROM sync_queue WHERE status = 'pending'").get();
      const fRow = db.prepare("SELECT COUNT(*) as cnt FROM sync_queue WHERE status = 'failed'").get();
      pendingCount = pRow ? Number(pRow.cnt) : 0;
      failedCount = fRow ? Number(fRow.cnt) : 0;
    } catch (_) {}
  }

  const cloudPing = await pingCloudDb();

  return {
    success: true,
    isOnline: Boolean(cloudPing.connected),
    isSyncing,
    pendingCount,
    failedCount,
    lastSyncTime,
    cloudConfigured: Boolean(getPgPool()),
    latencyMs: cloudPing.latencyMs || null,
    cloudError: cloudPing.reason || null
  };
}

/**
 * Upsert or push a single queue item to Supabase PostgreSQL
 */
async function syncQueueItem(item, pgClient, db) {
  const { table_name, record_id, action } = item;
  const numId = Number(record_id);

  if (action === 'delete') {
    // Execute remote delete
    await pgClient.query(`DELETE FROM ${table_name} WHERE server_id = $1 OR id = $2`, [record_id, isNaN(numId) ? null : numId]);
    return { success: true, action: 'deleted' };
  }

  // Handle INSERT or UPDATE per table
  if (table_name === 'invoices') {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(numId);
    if (!inv) return { success: true, skipped: 'Record not found locally' };

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(numId) || [];

    // Check if invoice already exists on Supabase by invoice_number
    const checkRes = await pgClient.query('SELECT id, local_updated_at FROM invoices WHERE invoice_number = $1', [inv.invoice_number]);
    let serverInvoiceId = null;

    if (checkRes.rows.length > 0) {
      // Last-Write-Wins (LWW) check
      const remoteRow = checkRes.rows[0];
      serverInvoiceId = remoteRow.id;

      if (remoteRow.local_updated_at && inv.local_updated_at) {
        const remoteTime = new Date(remoteRow.local_updated_at).getTime();
        const localTime = new Date(inv.local_updated_at).getTime();
        if (remoteTime > localTime) {
          // Cloud has newer revision; do not overwrite
          db.prepare("UPDATE invoices SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverInvoiceId), numId);
          return { success: true, lww_skipped: true };
        }
      }

      await pgClient.query(`
        UPDATE invoices SET
          customer_name = $1, customer_phone = $2, subtotal = $3,
          discount_type = $4, discount_value = $5, discount_amount = $6,
          tax_rate = $7, tax_amount = $8, grand_total = $9,
          paid_amount = $10, change_amount = $11, balance_due = $12,
          payment_method = $13, status = $14, shipping_cost = $15,
          shipping_notes = $16, extra_charges = $17, notes = $18,
          sync_status = 'synced', local_updated_at = $19
        WHERE id = $20
      `, [
        inv.customer_name, inv.customer_phone, inv.subtotal,
        inv.discount_type, inv.discount_value, inv.discount_amount,
        inv.tax_rate, inv.tax_amount, inv.grand_total,
        inv.paid_amount, inv.change_amount, inv.balance_due,
        inv.payment_method, inv.status, inv.shipping_cost,
        inv.shipping_notes, inv.extra_charges, inv.notes,
        inv.local_updated_at || new Date().toISOString(), serverInvoiceId
      ]);
    } else {
      // Insert new invoice into Supabase
      const insRes = await pgClient.query(`
        INSERT INTO invoices (
          invoice_number, customer_name, customer_phone, subtotal,
          discount_type, discount_value, discount_amount, tax_rate,
          tax_amount, grand_total, paid_amount, change_amount,
          balance_due, payment_method, status, shipping_cost,
          shipping_notes, extra_charges, notes, created_at,
          sync_status, local_updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19, $20, 'synced', $21
        ) RETURNING id
      `, [
        inv.invoice_number, inv.customer_name, inv.customer_phone, inv.subtotal,
        inv.discount_type, inv.discount_value, inv.discount_amount, inv.tax_rate,
        inv.tax_amount, inv.grand_total, inv.paid_amount, inv.change_amount,
        inv.balance_due, inv.payment_method, inv.status, inv.shipping_cost,
        inv.shipping_notes, inv.extra_charges, inv.notes, inv.created_at,
        inv.local_updated_at || new Date().toISOString()
      ]);
      serverInvoiceId = insRes.rows[0].id;
    }

    // Sync line items
    if (serverInvoiceId && items.length > 0) {
      await pgClient.query('DELETE FROM invoice_items WHERE invoice_id = $1', [serverInvoiceId]);
      for (const it of items) {
        await pgClient.query(`
          INSERT INTO invoice_items (
            invoice_id, product_name, cost_price, unit_price, quantity, total_price, warranty_months
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          serverInvoiceId, it.product_name, it.cost_price, it.unit_price, it.quantity, it.total_price, it.warranty_months
        ]);
      }
    }

    db.prepare("UPDATE invoices SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverInvoiceId), numId);
    return { success: true, server_id: serverInvoiceId };
  }

  if (table_name === 'products') {
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(numId);
    if (!prod) return { success: true, skipped: 'Product not found locally' };

    let checkRes;
    if (prod.barcode && prod.barcode.trim().length > 0) {
      checkRes = await pgClient.query('SELECT id, local_updated_at FROM products WHERE barcode = $1', [prod.barcode.trim()]);
    } else {
      checkRes = await pgClient.query('SELECT id, local_updated_at FROM products WHERE name = $1', [prod.name.trim()]);
    }

    let serverProdId = null;
    if (checkRes.rows.length > 0) {
      const remoteRow = checkRes.rows[0];
      serverProdId = remoteRow.id;

      await pgClient.query(`
        UPDATE products SET
          name = $1, cost_price = $2, sale_price = $3,
          stock_quantity = $4, low_stock_threshold = $5,
          has_serials = $6, warranty_months = $7, description = $8,
          sync_status = 'synced', local_updated_at = $9
        WHERE id = $10
      `, [
        prod.name, prod.cost_price, prod.sale_price,
        prod.stock_quantity, prod.low_stock_threshold,
        prod.has_serials, prod.warranty_months, prod.description,
        prod.local_updated_at || new Date().toISOString(), serverProdId
      ]);
    } else {
      const insRes = await pgClient.query(`
        INSERT INTO products (
          barcode, name, cost_price, sale_price, stock_quantity,
          low_stock_threshold, has_serials, warranty_months, description,
          sync_status, local_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'synced', $10)
        RETURNING id
      `, [
        prod.barcode ? prod.barcode.trim() : null, prod.name,
        prod.cost_price, prod.sale_price, prod.stock_quantity,
        prod.low_stock_threshold, prod.has_serials, prod.warranty_months,
        prod.description, prod.local_updated_at || new Date().toISOString()
      ]);
      serverProdId = insRes.rows[0].id;
    }

    db.prepare("UPDATE products SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverProdId), numId);
    return { success: true, server_id: serverProdId };
  }

  if (table_name === 'customers') {
    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(numId);
    if (!cust) return { success: true, skipped: 'Customer not found locally' };

    let checkRes;
    if (cust.phone && cust.phone.trim().length > 0) {
      checkRes = await pgClient.query('SELECT id FROM customers WHERE phone = $1', [cust.phone.trim()]);
    } else {
      checkRes = await pgClient.query('SELECT id FROM customers WHERE LOWER(name) = LOWER($1)', [cust.name.trim()]);
    }

    let serverCustId = null;
    if (checkRes.rows.length > 0) {
      serverCustId = checkRes.rows[0].id;
      await pgClient.query(`
        UPDATE customers SET
          name = $1, email = $2, address = $3,
          total_spent = $4, current_balance = $5,
          sync_status = 'synced', local_updated_at = $6
        WHERE id = $7
      `, [
        cust.name, cust.email, cust.address,
        cust.total_spent, cust.current_balance,
        cust.local_updated_at || new Date().toISOString(), serverCustId
      ]);
    } else {
      const insRes = await pgClient.query(`
        INSERT INTO customers (
          name, phone, email, address, total_spent, current_balance, sync_status, local_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'synced', $7)
        RETURNING id
      `, [
        cust.name, cust.phone, cust.email, cust.address,
        cust.total_spent, cust.current_balance,
        cust.local_updated_at || new Date().toISOString()
      ]);
      serverCustId = insRes.rows[0].id;
    }

    db.prepare("UPDATE customers SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverCustId), numId);
    return { success: true, server_id: serverCustId };
  }

  if (table_name === 'suppliers') {
    const sup = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(numId);
    if (!sup) return { success: true, skipped: 'Supplier not found locally' };

    const checkRes = await pgClient.query('SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)', [sup.name.trim()]);
    let serverSupId = null;

    if (checkRes.rows.length > 0) {
      serverSupId = checkRes.rows[0].id;
      await pgClient.query(`
        UPDATE suppliers SET
          contact_person = $1, phone = $2, email = $3, address = $4,
          current_balance = $5, total_due = $6, sync_status = 'synced', local_updated_at = $7
        WHERE id = $8
      `, [
        sup.contact_person, sup.phone, sup.email, sup.address,
        sup.current_balance, sup.total_due,
        sup.local_updated_at || new Date().toISOString(), serverSupId
      ]);
    } else {
      const insRes = await pgClient.query(`
        INSERT INTO suppliers (
          name, contact_person, phone, email, address, current_balance, total_due, sync_status, local_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'synced', $8)
        RETURNING id
      `, [
        sup.name, sup.contact_person, sup.phone, sup.email,
        sup.address, sup.current_balance, sup.total_due,
        sup.local_updated_at || new Date().toISOString()
      ]);
      serverSupId = insRes.rows[0].id;
    }

    db.prepare("UPDATE suppliers SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverSupId), numId);
    return { success: true, server_id: serverSupId };
  }

  if (table_name === 'ledger_entries') {
    const entry = db.prepare('SELECT * FROM ledger_entries WHERE id = ?').get(numId);
    if (!entry) return { success: true, skipped: 'Ledger entry not found locally' };

    const insRes = await pgClient.query(`
      INSERT INTO ledger_entries (
        party_type, party_id, entry_type, reference_no, debit, credit, description, entry_date, sync_status, local_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'synced', $9)
      RETURNING id
    `, [
      entry.party_type, entry.party_id, entry.entry_type, entry.reference_no,
      entry.debit, entry.credit, entry.description, entry.entry_date,
      entry.local_updated_at || new Date().toISOString()
    ]);
    const serverEntryId = insRes.rows[0].id;
    db.prepare("UPDATE ledger_entries SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverEntryId), numId);
    return { success: true, server_id: serverEntryId };
  }

  if (table_name === 'purchases') {
    const pur = db.prepare('SELECT * FROM purchases WHERE id = ?').get(numId);
    if (!pur) return { success: true, skipped: 'Purchase not found locally' };

    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(numId) || [];
    const checkRes = await pgClient.query('SELECT id FROM purchases WHERE purchase_number = $1', [pur.purchase_number]);
    let serverPurId = null;

    if (checkRes.rows.length > 0) {
      serverPurId = checkRes.rows[0].id;
      await pgClient.query(`
        UPDATE purchases SET
          supplier_invoice_no = $1, subtotal = $2, discount = $3,
          grand_total = $4, paid_amount = $5, balance_due = $6,
          payment_method = $7, notes = $8, sync_status = 'synced', local_updated_at = $9
        WHERE id = $10
      `, [
        pur.supplier_invoice_no, pur.subtotal, pur.discount,
        pur.grand_total, pur.paid_amount, pur.balance_due,
        pur.payment_method, pur.notes,
        pur.local_updated_at || new Date().toISOString(), serverPurId
      ]);
    } else {
      const insRes = await pgClient.query(`
        INSERT INTO purchases (
          purchase_number, supplier_id, supplier_invoice_no, purchase_date,
          subtotal, discount, grand_total, paid_amount, balance_due,
          payment_method, notes, sync_status, local_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'synced', $12)
        RETURNING id
      `, [
        pur.purchase_number, pur.supplier_id || 1, pur.supplier_invoice_no,
        pur.purchase_date, pur.subtotal, pur.discount, pur.grand_total,
        pur.paid_amount, pur.balance_due, pur.payment_method, pur.notes,
        pur.local_updated_at || new Date().toISOString()
      ]);
      serverPurId = insRes.rows[0].id;
    }

    if (serverPurId && items.length > 0) {
      await pgClient.query('DELETE FROM purchase_items WHERE purchase_id = $1', [serverPurId]);
      for (const it of items) {
        await pgClient.query(`
          INSERT INTO purchase_items (purchase_id, product_name, cost_price, sale_price, quantity, total_cost)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [serverPurId, it.product_name, it.cost_price, it.sale_price, it.quantity, it.total_cost]);
      }
    }

    db.prepare("UPDATE purchases SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverPurId), numId);
    return { success: true, server_id: serverPurId };
  }

  if (table_name === 'sales_returns') {
    const ret = db.prepare('SELECT * FROM sales_returns WHERE id = ?').get(numId);
    if (!ret) return { success: true, skipped: 'Sales return not found locally' };

    const checkRes = await pgClient.query('SELECT id FROM sales_returns WHERE return_number = $1', [ret.return_number]);
    let serverRetId = null;

    if (checkRes.rows.length > 0) {
      serverRetId = checkRes.rows[0].id;
    } else {
      const insRes = await pgClient.query(`
        INSERT INTO sales_returns (
          return_number, invoice_number, customer_name, customer_phone,
          refund_mode, total_refund_amount, reason, sync_status, local_updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'synced', $8)
        RETURNING id
      `, [
        ret.return_number, ret.invoice_number, ret.customer_name, ret.customer_phone,
        ret.refund_mode, ret.total_refund_amount, ret.reason,
        ret.local_updated_at || new Date().toISOString()
      ]);
      serverRetId = insRes.rows[0].id;
    }

    db.prepare("UPDATE sales_returns SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverRetId), numId);
    return { success: true, server_id: serverRetId };
  }

  if (table_name === 'expenses') {
    const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(numId);
    if (!exp) return { success: true, skipped: 'Expense not found locally' };

    const insRes = await pgClient.query(`
      INSERT INTO expenses (
        title, category, amount, payment_method, notes, expense_date, sync_status, local_updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'synced', $7)
      RETURNING id
    `, [
      exp.title, exp.category, exp.amount, exp.payment_method, exp.notes,
      exp.expense_date, exp.local_updated_at || new Date().toISOString()
    ]);
    const serverExpId = insRes.rows[0].id;
    db.prepare("UPDATE expenses SET sync_status = 'synced', server_id = ? WHERE id = ?").run(String(serverExpId), numId);
    return { success: true, server_id: serverExpId };
  }

  return { success: true, skipped: 'Unhandled table' };
}

/**
 * Process pending queue items in background (Thread-safe, non-blocking)
 */
async function processQueue() {
  if (isSyncing) {
    return { status: 'in_progress', message: 'Sync already in progress' };
  }

  const pool = getPgPool();
  if (!pool) {
    return { status: 'unconfigured', message: 'No Supabase database pool configured' };
  }

  const pingRes = await pingCloudDb();
  if (!pingRes.connected) {
    return { status: 'offline', message: `Cloud database offline: ${pingRes.reason}` };
  }

  const db = getDb();
  if (!db) {
    return { status: 'no_db', message: 'Local database not initialized' };
  }

  // Fetch pending records (limit 50 per batch)
  const pendingItems = db.prepare(`
    SELECT * FROM sync_queue 
    WHERE status IN ('pending', 'failed') AND retry_count < 10 
    ORDER BY id ASC 
    LIMIT 50
  `).all();

  if (!pendingItems || pendingItems.length === 0) {
    return { status: 'idle', count: 0, message: 'Sync queue is empty' };
  }

  isSyncing = true;
  let syncedCount = 0;
  let errorCount = 0;

  let pgClient = null;
  try {
    pgClient = await pool.connect();

    for (const item of pendingItems) {
      try {
        db.prepare("UPDATE sync_queue SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(item.id);

        const res = await syncQueueItem(item, pgClient, db);

        if (res && res.success) {
          // Delete synced entry from queue
          db.prepare('DELETE FROM sync_queue WHERE id = ?').run(item.id);
          syncedCount++;
        } else {
          db.prepare(`
            UPDATE sync_queue 
            SET status = 'failed', retry_count = retry_count + 1, error_message = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(res?.error || 'Unknown sync error', item.id);
          errorCount++;
        }
      } catch (itemErr) {
        console.warn(`[Sync Worker] Failed item ${item.table_name}:${item.record_id}:`, itemErr.message);
        db.prepare(`
          UPDATE sync_queue 
          SET status = 'failed', retry_count = retry_count + 1, error_message = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(itemErr.message, item.id);
        errorCount++;
      }
    }

    lastSyncTime = new Date().toISOString();
    console.log(`[Sync Worker] Batch complete: ${syncedCount} synced, ${errorCount} failed.`);
  } catch (batchErr) {
    console.error('[Sync Worker] Critical batch error:', batchErr.message);
  } finally {
    if (pgClient) {
      try { pgClient.release(); } catch (_) {}
    }
    isSyncing = false;
  }

  return {
    status: 'completed',
    syncedCount,
    errorCount,
    timestamp: lastSyncTime
  };
}

/**
 * Start background scheduler:
 * - Runs startup sync after 3 seconds
 * - Runs periodic sync every 30 seconds
 */
function startSyncScheduler(intervalMs = 30000) {
  if (isPostgres) {
    console.log('[Sync Scheduler] Cloud-direct mode active (Vercel). Background sync worker disabled.');
    return;
  }

  if (syncTimer) {
    clearInterval(syncTimer);
  }

  console.log(`[Sync Scheduler] Local-first sync worker started (interval: ${intervalMs / 1000}s).`);

  // Initial startup sync (deferred by 3 seconds to let local server warm up)
  setTimeout(() => {
    processQueue().catch(err => {
      console.warn('[Sync Worker] Startup sync notice:', err.message);
    });
  }, 3000);

  // Recurring background sync every 30 seconds
  syncTimer = setInterval(() => {
    processQueue().catch(err => {
      console.warn('[Sync Worker] Periodic sync notice:', err.message);
    });
  }, intervalMs);
}

module.exports = {
  enqueueSync,
  getSyncStatus,
  processQueue,
  startSyncScheduler
};
