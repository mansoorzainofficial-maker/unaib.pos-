const express = require('express');
const router = express.Router();
const grnController = require('../controllers/grnController');
const { authRequired } = require('../middleware/auth');

function authFlexible(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authRequired(req, res, next);
  }
  next();
}

router.get('/', authFlexible, grnController.getAllGrns);
router.get('/:id', authFlexible, grnController.getGrnById);
router.post('/', authFlexible, grnController.createGrn);

module.exports = router;
