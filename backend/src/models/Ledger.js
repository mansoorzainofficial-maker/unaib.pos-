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
  static async getPartiesWithBalances(partyType) {
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

    return await query(sql, aliases);
  }

  /**
   * Get full ledger statement with dynamic running balance (calculated via window function)
   */
  static async getPartyStatement(partyType, partyId) {
    const isClient = partyType === 'client' || partyType === 'customer';
    const tableName = isClient ? 'customers' : 'suppliers';
    const aliases = this.getPartyTypeAliases(partyType);

    // Fetch party details
    const party = await get(`SELECT * FROM ${tableName} WHERE id = ?`, [partyId]);
    if (!party) return null;

    // Fetch entries with dynamic on-the-fly running balance
    const entries = await query(`
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
  static async recordPaymentWithTransaction({ party_type, party_id, account_id, amount, entry_date, notes = null }) {
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

    const isClient = party_type === 'client' || party_type === 'customer';
    const normPartyType = isClient ? 'client' : 'supplier';
    const tableName = isClient ? 'customers' : 'suppliers';

    let newEntryId = null;

    await transaction(async ({ query: txQuery, get: txGet, run: txRun }) => {
      // Verify Account exists
      const account = await txGet('SELECT id, name, type, current_balance FROM accounts WHERE id = ?', [account_id]);
      if (!account) {
        throw new Error('Please select cash or bank account');
      }

      // Verify Party exists
      const party = await txGet(`SELECT id, name FROM ${tableName} WHERE id = ?`, [party_id]);
      if (!party) {
        throw new Error(`${isClient ? 'Client' : 'Supplier'} not found with ID ${party_id}`);
      }

      // Generate Voucher Number: PMT-0001
      const countRow = await txGet("SELECT COUNT(*) as cnt FROM ledger_entries WHERE entry_type = 'payment'");
      const voucherNo = `PMT-${String((Number(countRow?.cnt) || 0) + 1).padStart(4, '0')}`;

      // Insert into ledger_entries
      const desc = notes ? notes.trim() : `Payment via ${account.name}`;

      const res = await txRun(`
        INSERT INTO ledger_entries (
          party_type, party_id, entry_type, reference_no, 
          debit, credit, account_id, description, entry_date
        ) VALUES (
          ?, ?, 'payment', ?,
          0.0, ?, ?, ?, ?
        )
      `, [normPartyType, party_id, voucherNo, numericAmount, account_id, desc, entry_date]);

      newEntryId = res.lastInsertRowid;

      // Deduct or add account balance in accounts table
      const balanceChange = isClient ? numericAmount : -numericAmount;
      await txRun(`
        UPDATE accounts 
        SET current_balance = current_balance + ? 
        WHERE id = ?
      `, [balanceChange, account_id]);

      // Record in accounts_ledger
      const newAccBal = Number(account.current_balance) + balanceChange;
      await txRun(`
        INSERT INTO accounts_ledger (
          account_id, entry_type, reference_no, debit, credit, balance_after, description
        ) VALUES (
          ?, 'party_payment', ?, ?, ?, ?, ?
        )
      `, [
        account_id, 
        voucherNo, 
        isClient ? numericAmount : 0.0, 
        isClient ? 0.0 : numericAmount, 
        newAccBal, 
        `${isClient ? 'Received from' : 'Payment to'} ${party.name} (${voucherNo})`
      ]);

      // Sync cached balance in suppliers/customers table
      try {
        const altPartyType = isClient ? 'customer' : 'supplier';
        const balRow = await txGet(`
          SELECT (COALESCE(SUM(debit), 0.0) - COALESCE(SUM(credit), 0.0)) as bal 
          FROM ledger_entries 
          WHERE party_type IN (?, ?) AND party_id = ?
        `, [normPartyType, altPartyType, party_id]);
        
        const newBal = balRow ? balRow.bal : 0.0;
        if (normPartyType === 'supplier') {
          await txRun('UPDATE suppliers SET total_due = ?, current_balance = ? WHERE id = ?', [newBal, newBal, party_id]);
        } else {
          await txRun('UPDATE customers SET current_balance = ? WHERE id = ?', [newBal, party_id]);
        }
      } catch (syncErr) {
        console.warn('Balance cache sync notice:', syncErr.message);
      }
    });

    // Return refreshed statement AFTER commit with newEntryId attached
    const stmt = await this.getPartyStatement(normPartyType, party_id);
    if (stmt) {
      stmt.new_entry_id = newEntryId;
      stmt.party_id = party_id;
      stmt.party_type = normPartyType;
    }
    return stmt;
  }
}

module.exports = Ledger;
