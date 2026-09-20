const Account = require('../models/Account');

/**
 * Get all accounts with transaction flags
 * GET /api/accounts
 */
async function getAccounts(req, res) {
  try {
    const rawAccounts = await Account.getAll();
    const accounts = await Promise.all(rawAccounts.map(async acc => ({
      ...acc,
      current_balance: await Account.calculateBalance(acc),
      has_transactions: await Account.hasTransactions(acc.id)
    })));

    res.json({
      success: true,
      accounts
    });
  } catch (err) {
    console.error('Error in getAccounts:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch financial accounts',
      message: err.message
    });
  }
}

/**
 * Get single account by ID
 * GET /api/accounts/:id
 */
async function getAccountById(req, res) {
  try {
    const account = await Account.getById(req.params.id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      account: {
        ...account,
        current_balance: await Account.calculateBalance(account),
        has_transactions: await Account.hasTransactions(account.id)
      }
    });
  } catch (err) {
    console.error('Error in getAccountById:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account',
      message: err.message
    });
  }
}

/**
 * Create new account
 * POST /api/accounts
 */
async function createAccount(req, res) {
  try {
    const { name, type, account_number, branch_name, current_balance, opening_balance } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Account name is required'
      });
    }

    const validTypes = ['cash', 'bank', 'wallet'];
    if (!type || !validTypes.includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Account type must be cash, bank, or wallet'
      });
    }

    // Check duplicate name
    const existing = await Account.getByName(name.trim());
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'An account with this name already exists'
      });
    }

    const initialBal = Number(opening_balance !== undefined ? opening_balance : current_balance) || 0;
    const account = await Account.create({
      name: name.trim(),
      type: type.toLowerCase(),
      account_number: account_number && account_number.trim() ? account_number.trim() : null,
      branch_name: branch_name && branch_name.trim() ? branch_name.trim() : null,
      current_balance: initialBal,
      is_default: 0
    });

    const liveBal = await Account.calculateBalance(account);

    res.status(201).json({
      success: true,
      account: {
        ...account,
        current_balance: liveBal
      },
      message: 'Account created successfully'
    });
  } catch (err) {
    console.error('Error in createAccount:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create account',
      message: err.message
    });
  }
}

/**
 * Update existing account
 * PUT /api/accounts/:id
 */
async function updateAccount(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await Account.getById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    const { name, type, account_number, branch_name, current_balance } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Account name is required'
      });
    }

    const validTypes = ['cash', 'bank', 'wallet'];
    if (!type || !validTypes.includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Account type must be cash, bank, or wallet'
      });
    }

    // Check duplicate name for other accounts
    const duplicate = await Account.getByName(name.trim(), id);
    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: 'An account with this name already exists'
      });
    }

    const updated = await Account.update(id, {
      name: name.trim(),
      type: type.toLowerCase(),
      account_number: account_number && account_number.trim() ? account_number.trim() : null,
      branch_name: branch_name && branch_name.trim() ? branch_name.trim() : null,
      current_balance: current_balance !== undefined ? Number(current_balance) || 0 : undefined
    });

    const liveBal = await Account.calculateBalance(updated);

    res.json({
      success: true,
      account: {
        ...updated,
        current_balance: liveBal
      },
      message: 'Account updated successfully'
    });
  } catch (err) {
    console.error('Error in updateAccount:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update account',
      message: err.message
    });
  }
}

/**
 * Delete account with safety checks
 * DELETE /api/accounts/:id
 */
async function deleteAccount(req, res) {
  try {
    const id = Number(req.params.id);
    const account = await Account.getById(id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Protect default account
    if (account.is_default === 1) {
      return res.status(400).json({
        success: false,
        error: 'Default Cash Counter account cannot be deleted'
      });
    }

    // Check if account has transactions in ledger or transactions tables
    if (await Account.hasTransactions(id)) {
      return res.status(400).json({
        success: false,
        error: 'Ye account delete nahi ho sakta, iski transaction history hai',
        code: 'HAS_TRANSACTIONS'
      });
    }

    await Account.delete(id);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (err) {
    console.error('Error in deleteAccount:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
      message: err.message
    });
  }
}

/**
 * Get account statement / passbook ledger
 * GET /api/accounts/:id/statement
 */
async function getAccountStatement(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account ID'
      });
    }

    const statement = await Account.getStatement(id);
    if (!statement) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      statement
    });
  } catch (err) {
    console.error('Error in getAccountStatement:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account statement',
      message: err.message
    });
  }
}

module.exports = {
  getAccounts,
  getAccountById,
  getAccountStatement,
  createAccount,
  updateAccount,
  deleteAccount
};
