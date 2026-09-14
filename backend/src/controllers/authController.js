const { get, query, run } = require('../config/db');
const { verifyPassword, hashPassword, signToken } = require('../utils/authUtils');

/**
 * Login with username/password OR fast 4-digit PIN
 */
function login(req, res) {
  try {
    const { username, password, pin } = req.body;

    // Quick PIN login (used on high-speed POS terminal)
    if (pin) {
      const user = get('SELECT id, username, full_name, role, pin, is_active FROM users WHERE pin = ? AND is_active = 1', [pin]);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid Quick PIN' });
      }

      const token = signToken({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      });

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role
        }
      });
    }

    // Standard Username + Password Login
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const user = get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or account deactivated' });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during login' });
  }
}

/**
 * Get current authenticated user profile
 */
function getMe(req, res) {
  try {
    const user = get('SELECT id, username, full_name, role, phone, pin FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * List all users (Admin only)
 */
function getUsers(req, res) {
  try {
    const users = query('SELECT id, username, full_name, role, phone, pin, is_active, created_at FROM users ORDER BY id ASC');
    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create new user (Admin only)
 */
function createUser(req, res) {
  try {
    const { username, password, pin, full_name, role, phone } = req.body;
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ success: false, message: 'Missing required user fields' });
    }

    const existing = get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    const password_hash = hashPassword(password);
    const result = run(
      'INSERT INTO users (username, password_hash, pin, full_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [username, password_hash, pin || null, full_name, role, phone || null]
    );

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      userId: result.lastInsertRowid
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update user details/PIN/password (Admin only)
 */
function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { full_name, role, phone, pin, password, is_active } = req.body;

    const user = get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let queryStr = 'UPDATE users SET full_name = ?, role = ?, phone = ?, pin = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [full_name, role, phone || null, pin || null, is_active !== undefined ? is_active : 1];

    if (password && password.trim().length > 0) {
      queryStr += ', password_hash = ?';
      params.push(hashPassword(password));
    }

    queryStr += ' WHERE id = ?';
    params.push(id);

    run(queryStr, params);
    return res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  login,
  getMe,
  getUsers,
  createUser,
  updateUser
};
