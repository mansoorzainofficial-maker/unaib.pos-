const Ledger = require('../models/Ledger');
const Account = require('../models/Account');
const syncService = require('../services/syncService');

/**
 * Get all available payment accounts (Cash Counter, Bank Accounts)
 * GET /api/ledger/accounts
 */
async function getAccounts(req, res) {
  try {
    const accounts = await Account.getAll();
    res.json({
      success: true,
      accounts
    });
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch financial accounts',
      message: err.message
    });
  }
}

/**
 * Get parties with real-time calculated balances: SUM(debit) - SUM(credit)
 * GET /api/ledger/parties?type=supplier|client
 */
async function getParties(req, res) {
  try {
    const partyType = req.query.type || 'supplier';
    const parties = await Ledger.getPartiesWithBalances(partyType);
    res.json({
      success: true,
      party_type: partyType,
      parties
    });
  } catch (err) {
    console.error('Error fetching parties with balances:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch party list',
      message: err.message
    });
  }
}

/**
 * Get party statement with dynamic running balance
 * GET /api/ledger/statement?party_type=supplier|client&party_id=:id
 */
async function getStatement(req, res) {
  try {
    const partyType = req.query.party_type || req.query.type || 'supplier';
    const partyId = Number(req.query.party_id || req.query.id);

    if (!partyId) {
      return res.status(400).json({
        success: false,
        error: 'party_id query parameter is required'
      });
    }

    const statement = await Ledger.getPartyStatement(partyType, partyId);
    if (!statement) {
      return res.status(404).json({
        success: false,
        error: 'Party not found'
      });
    }

    res.json({
      success: true,
      statement
    });
  } catch (err) {
    console.error('Error fetching party statement:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statement',
      message: err.message
    });
  }
}

/**
 * Record payment voucher inside ACID SQL transaction
 * POST /api/ledger/payment
 */
async function recordPayment(req, res) {
  try {
    const { party_type, party_id, account_id, amount, entry_date, notes } = req.body;

    if (!account_id) {
      return res.status(400).json({
        success: false,
        error: 'Please select cash or bank account'
      });
    }

    if (!party_type || !['supplier', 'client', 'customer'].includes(party_type)) {
      return res.status(400).json({
        success: false,
        error: 'Valid party type ("supplier" or "client") is required'
      });
    }

    if (!party_id) {
      return res.status(400).json({
        success: false,
        error: 'Party ID is required'
      });
    }

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount must be greater than zero'
      });
    }

    const paymentDate = entry_date || req.body.payment_date || new Date().toISOString().split('T')[0];

    const updatedStatement = await Ledger.recordPaymentWithTransaction({
      party_type,
      party_id: Number(party_id),
      account_id: Number(account_id),
      amount: numAmount,
      entry_date: paymentDate,
      notes: notes ? notes.trim() : null
    });

    if (updatedStatement && updatedStatement.new_entry_id) {
      try {
        syncService.enqueueSync('ledger_entries', updatedStatement.new_entry_id, 'insert');
        const targetTable = (party_type === 'supplier') ? 'suppliers' : 'customers';
        syncService.enqueueSync(targetTable, Number(party_id), 'update');
      } catch (syncErr) {
        console.warn('Non-blocking sync enqueue error:', syncErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully into ledger and financial account!',
      statement: updatedStatement
    });
  } catch (err) {
    console.error('Error recording payment (Transaction Rolled Back):', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to record payment'
    });
  }
}

/**
 * Get ledger overall summary (total receivable, total payable, net)
 * GET /api/ledger/summary
 */
async function getSummary(req, res) {
  try {
    const { get } = require('../config/db');
    const custRes = await get("SELECT COALESCE(SUM(current_balance), 0) as total FROM customers WHERE current_balance > 0");
    const suppRes = await get("SELECT COALESCE(SUM(current_balance), 0) as total FROM suppliers WHERE current_balance > 0");
    
    const total_receivable = Number(custRes?.total || 0);
    const total_payable = Number(suppRes?.total || 0);

    res.json({
      success: true,
      summary: {
        total_receivable,
        total_payable,
        net_balance: total_receivable - total_payable
      }
    });
  } catch (err) {
    console.error('Error fetching ledger summary:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ledger summary',
      message: err.message
    });
  }
}

/**
 * Get customer statement by customer ID
 * GET /api/ledger/customer/:id
 */
async function getCustomerStatement(req, res) {
  try {
    const partyId = Number(req.params.id);
    if (!partyId) {
      return res.status(400).json({ success: false, error: 'Valid customer ID is required' });
    }
    const statement = await Ledger.getPartyStatement('client', partyId);
    if (!statement) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    res.json({ success: true, statement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Get supplier statement by supplier ID
 * GET /api/ledger/supplier/:id
 */
async function getSupplierStatement(req, res) {
  try {
    const partyId = Number(req.params.id);
    if (!partyId) {
      return res.status(400).json({ success: false, error: 'Valid supplier ID is required' });
    }
    const statement = await Ledger.getPartyStatement('supplier', partyId);
    if (!statement) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }
    res.json({ success: true, statement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Safely delete / void a payment voucher with atomic reversal
 * DELETE /api/ledger/payment/:id
 * POST /api/ledger/payment/:id/void
 */
async function deletePayment(req, res) {
  try {
    const entryId = Number(req.params.id || req.body?.entry_id);
    if (!entryId) {
      return res.status(400).json({
        success: false,
        error: 'Valid payment entry ID is required'
      });
    }

    const userId = req.user?.id || null;
    const reason = req.body?.reason || 'User requested payment deletion';

    const result = await Ledger.deletePaymentWithTransaction({
      entryId,
      userId,
      reason
    });

    res.json({
      success: true,
      message: `Payment voucher #${result.reference_no || entryId} (Rs. ${result.reversed_amount.toLocaleString()}) has been successfully voided and reversed.`,
      result
    });
  } catch (err) {
    console.error('Error deleting payment voucher:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to delete payment voucher'
    });
  }
}

module.exports = {
  getAccounts,
  getParties,
  getStatement,
  recordPayment,
  deletePayment,
  getSummary,
  getCustomerStatement,
  getSupplierStatement
};
