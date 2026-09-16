const Ledger = require('../models/Ledger');
const Account = require('../models/Account');

/**
 * Get all available payment accounts (Cash Counter, Bank Accounts)
 * GET /api/ledger/accounts
 */
async function getAccounts(req, res) {
  try {
    const accounts = Account.getAll();
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
    const parties = Ledger.getPartiesWithBalances(partyType);
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

    const statement = Ledger.getPartyStatement(partyType, partyId);
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
 * Strictly mandates account_id!
 */
async function recordPayment(req, res) {
  try {
    const { party_type, party_id, account_id, amount, entry_date, notes } = req.body;

    // Strict Validation Rule:
    // "Backend mein payment record karte waqt (POST /api/ledger/payment) account_id field ko mandatory/required rakho
    // - agar ye missing ho to request reject karo aur clear error do 'Please select cash or bank account'"
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

    // Call Model with ACID transaction
    const updatedStatement = Ledger.recordPaymentWithTransaction({
      party_type,
      party_id: Number(party_id),
      account_id: Number(account_id),
      amount: numAmount,
      entry_date: paymentDate,
      notes: notes ? notes.trim() : null
    });

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

module.exports = {
  getAccounts,
  getParties,
  getStatement,
  recordPayment
};
