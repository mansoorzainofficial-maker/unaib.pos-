const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { authRequired } = require('../middleware/auth');

function authFlexible(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authRequired(req, res, next);
  }
  next();
}

router.get('/', authFlexible, accountController.getAccounts);
router.get('/:id', authFlexible, accountController.getAccountById);
router.post('/', authFlexible, accountController.createAccount);
router.put('/:id', authFlexible, accountController.updateAccount);
router.delete('/:id', authFlexible, accountController.deleteAccount);

module.exports = router;
