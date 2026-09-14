const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const printerService = require('../services/printerService');
const { getFullInvoiceDetails } = require('../controllers/invoiceController');

/**
 * Print Invoice to Thermal Printer with zero-crash try-catch guarantee
 */
router.post('/print-receipt', authRequired, async (req, res) => {
  try {
    const { invoice_id, invoice: rawInvoice, printer_config } = req.body;

    let invoice = rawInvoice;
    if (!invoice && invoice_id) {
      invoice = getFullInvoiceDetails(Number(invoice_id));
    }

    if (!invoice) {
      return res.status(400).json({
        success: false,
        message: 'Invoice not found or invalid invoice details'
      });
    }

    // Call printer service safely
    const printResult = await printerService.printInvoiceReceipt(invoice, printer_config || {});

    if (!printResult.success) {
      return res.status(503).json({
        success: false,
        message: printResult.error || 'Printer connection failed, please check cable',
        code: printResult.code,
        details: printResult.details
      });
    }

    return res.json({
      success: true,
      message: 'Receipt sent to thermal printer successfully'
    });
  } catch (err) {
    console.error('[PrinterRoute] Caught unexpected controller error:', err);
    return res.status(503).json({
      success: false,
      message: 'Printer connection failed, please check cable',
      error: err.message
    });
  }
});

/**
 * Test Printer Connection
 */
router.post('/test-connection', authRequired, async (req, res) => {
  try {
    const config = req.body || {};
    const result = await printerService.testPrinterConnection(config);
    if (!result.success) {
      return res.status(503).json(result);
    }
    return res.json(result);
  } catch (err) {
    return res.status(503).json({
      success: false,
      message: 'Printer connection failed, please check cable',
      error: err.message
    });
  }
});

module.exports = router;
