const { query, get, run, transaction } = require('../config/db');

class Ledger {
  /**
   * Helper to normalize party_type filters
   */
  static getPartyTypeAliases(type) {
    if (type === 'client' || type === 'customer') {
      return ['client', 'customer'];
    }
    return ['supplier', 'supplier'];
  }

  /**
   * Get all parties with real-time calculated balances: SUM(debit) - SUM(credit)
   */
  static getPartiesWithBalances(partyType) {
    const isClient = partyType === 'client' || partyType === 'customer';
    const tableName = isClient ? 'customers' : 'suppliers';
    const aliases = this.getPartyTypeAliases(partyType);

    const sql = `
      SELECT 
        p.id,
        p.name,
        p.phone,
        p.email,
        p.address,
        COALESCE(SUM(le.debit), 0.0) AS total_debit,
        COALESCE(SUM(le.credit), 0.0) AS total_credit,
        (COALESCE(SUM(le.debit), 0.0) - COALESCE(SUM(le.credit), 0.0)) AS current_balance
      FROM ${tableName} p
      LEFT JOIN ledger_entries le 
        ON le.party_id = p.id 
        AND le.party_type IN (?, ?)
      GROUP BY p.id
      ORDER BY p.name ASC
    `;

    return query(sql, aliases);
  }

  /**
   * Get full ledger statement with dynamic running balance (calculated via window function)
   */
  static getPartyStatement(partyType, partyId) {
    const isClient = partyType === 'client' || partyType === 'customer';
    const tableName = isClient ? 'customers' : 'suppliers';
    const aliases = this.getPartyTypeAliases(partyType);

    // Fetch party details
    const party = get(`SELECT * FROM ${tableName} WHERE id = ?`, [partyId]);
    if (!party) return null;

    // Fetch entries with dynamic on-the-fly running balance
    const entries = query(`
      SELECT 
        le.id,
        le.party_type,
        le.party_id,
        le.entry_type,
        le.reference_id,
        le.reference_no,
        le.debit,
        le.credit,
        le.account_id,
        a.name AS account_name,
        a.type AS account_type,
        le.description,
        le.entry_date,
        le.created_at,
        SUM(le.debit - le.credit) OVER (
          ORDER BY le.entry_date ASC, le.id ASC
        ) AS running_balance
      FROM ledger_entries le
      LEFT JOIN accounts a ON le.account_id = a.id
      WHERE le.party_type IN (?, ?) AND le.party_id = ?
      ORDER BY le.entry_date ASC, le.id ASC
    `, [aliases[0], aliases[1], partyId]);

    // Calculate real-time totals
    const totalDebit = entries.reduce((sum, en) => sum + (Number(en.debit) || 0), 0);
    const totalCredit = entries.reduce((sum, en) => sum + (Number(en.credit) || 0), 0);
    const currentBalance = Math.round((totalDebit - totalCredit) * 100) / 100;

    return {
      party: {
        ...party,
        current_balance: currentBalance
      },
      summary: {
        total_debit: Math.round(totalDebit * 100) / 100,
        total_credit: Math.round(totalCredit * 100) / 100,
        current_balance: currentBalance
      },
      entries
    };
  }

  /**
   * Record Payment inside ACID SQL transaction
   * account_id is STRICTLY MANDATORY for payments
   */
  static recordPaymentWithTransaction({ party_type, party_id, account_id, amount, entry_date, notes = null }) {
    // 1. Strict Validation
    if (!party_type || !['supplier', 'client', 'customer'].includes(party_type)) {
      throw new Error('Valid party type ("supplier" or "client") is required');
    }
    if (!party_id) {
      throw new Error('Party ID is required');
    }
    if (!account_id) {
      throw new Error('Please select cash or bank account');
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (!entry_date) {
      throw new Error('Payment date is required');
    }

    return transaction(() => {
      // Verify Account exists
      const account = get('SELECT id, name, type FROM accounts WHERE id = ?', [account_id]);
      if (!account) {
        throw new Error('Please select cash or bank account');
      }

      // Verify Party exists
      const isClient = party_type === 'client' || party_type === 'customer';
      const tableName = isClient ? 'customers' : 'suppliers';
      const party = get(`SELECT id, name FROM ${tableName} WHERE id = ?`, [party_id]);
      if (!party) {
        throw new Error(`${isClient ? 'Client' : 'Supplier'} not found with ID ${party_id}`);
      }

      // Generate Voucher Number: PMT-0001
      const countRow = get("SELECT COUNT(*) as cnt FROM ledger_entries WHERE entry_type = 'payment'");
      const voucherNo = `PMT-${String((countRow?.cnt || 0) + 1).padStart(4, '0')}`;

      // Insert into ledger_entries
      // Payment reduces party balance -> Credit amount
      const normPartyType = isClient ? 'client' : 'supplier';
      const desc = notes ? notes.trim() : `Payment via ${account.name}`;

      const res = run(`
        INSERT INTO ledger_entries (
          party_type, party_id, entry_type, reference_no, 
          debit, credit, account_id, description, entry_date
        ) VALUES (
          ?, ?, 'payment', ?,
          0.0, ?, ?, ?, ?
        )
      `, [normPartyType, party_id, voucherNo, numericAmount, account_id, desc, entry_date]);

      const ledgerEntryId = res.lastInsertRowid;

      // Insert into transactions table for cash/bank reconciliation
      // For Supplier payment: Cash outflow -> 'debit'
      // For Client receipt: Cash inflow -> 'credit'
      const txType = normPartyType === 'supplier' ? 'debit' : 'credit';
      const txCategory = normPartyType === 'supplier' ? 'supplier_payment' : 'customer_receipt';
      const txDesc = `${normPartyType === 'supplier' ? 'Payment to' : 'Received from'} ${party.name} (${voucherNo})`;

      run(`
        INSERT INTO transactions (
          type, category, amount, account_id, 
          reference_id, reference_type, description
        ) VALUES (
          ?, ?, ?, ?,
          ?, 'ledger_entry', ?
        )
      `, [txType, txCategory, numericAmount, account_id, ledgerEntryId, txDesc]);

      // Sync cached balance in suppliers/customers table
      try {
        const altPartyType = isClient ? 'customer' : 'supplier';
        const balRow = get(`
          SELECT (COALESCE(SUM(debit), 0.0) - COALESCE(SUM(credit), 0.0)) as bal 
          FROM ledger_entries 
          WHERE party_type IN (?, ?) AND party_id = ?
        `, [normPartyType, altPartyType, party_id]);
        
        const newBal = balRow ? balRow.bal : 0.0;
        if (normPartyType === 'supplier') {
          run('UPDATE suppliers SET total_due = ?, current_balance = ? WHERE id = ?', [newBal, newBal, party_id]);
        } else {
          run('UPDATE customers SET current_balance = ? WHERE id = ?', [newBal, party_id]);
        }
      } catch (syncErr) {
        console.warn('Balance cache sync notice:', syncErr.message);
      }

      // Return refreshed statement
      return this.getPartyStatement(normPartyType, party_id);
    });
  }
}

module.exports = Ledger;
