const net = require('net');

/**
 * ESC/POS Command Constants for 58mm and 80mm Thermal Printers
 */
const ESC_POS = {
  INIT: Buffer.from([0x1B, 0x40]),
  ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 0x02]),
  BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),
  DOUBLE_SIZE: Buffer.from([0x1D, 0x21, 0x11]),
  NORMAL_SIZE: Buffer.from([0x1D, 0x21, 0x00]),
  FEED_LINE: Buffer.from([0x0A]),
  FEED_AND_CUT: Buffer.from([0x1D, 0x56, 0x41, 0x03]) // Partial or Full paper cut
};

/**
 * Build Raw ESC/POS Buffer for an Invoice Receipt
 */
function buildEscPosReceipt(invoice, options = {}) {
  const chunks = [];

  const writeText = (text, encoding = 'ascii') => {
    chunks.push(Buffer.from(text, encoding));
  };

  const writeLine = (text = '') => {
    chunks.push(Buffer.from(text + '\n', 'ascii'));
  };

  // Initialize printer
  chunks.push(ESC_POS.INIT);

  // Store Header (Centered & Bold)
  chunks.push(ESC_POS.ALIGN_CENTER);
  chunks.push(ESC_POS.BOLD_ON);
  chunks.push(ESC_POS.DOUBLE_SIZE);
  writeLine(invoice.store?.store_name || 'UNAIB COMPUTER ACCESSORIES');
  chunks.push(ESC_POS.NORMAL_SIZE);
  chunks.push(ESC_POS.BOLD_OFF);

  writeLine(invoice.store?.store_tagline || 'High-End Components & Accessories');
  writeLine(invoice.store?.store_address || 'Shop #14, Techno City Plaza, Karachi');
  writeLine(`Tel: ${invoice.store?.store_phone || '0300-9258123'}`);
  writeLine('------------------------------------------');

  // Prominent Invoice Title
  chunks.push(ESC_POS.BOLD_ON);
  writeLine(`INVOICE NO: ${invoice.invoice_number}`);
  chunks.push(ESC_POS.BOLD_OFF);
  writeLine(`Date: ${new Date(invoice.created_at || Date.now()).toLocaleString()}`);
  writeLine(`Customer: ${invoice.customer_name || 'Walk-in Customer'}`);
  if (invoice.customer_phone) writeLine(`Phone: ${invoice.customer_phone}`);
  writeLine('------------------------------------------');

  // Itemized List (Left-aligned)
  chunks.push(ESC_POS.ALIGN_LEFT);
  if (invoice.items && Array.isArray(invoice.items)) {
    invoice.items.forEach((item, idx) => {
      const name = item.product_name || item.name || 'Item';
      const qty = item.quantity || 1;
      const rate = Number(item.unit_price || item.sale_price || 0);
      const total = Number(item.total_price || rate * qty);

      chunks.push(ESC_POS.BOLD_ON);
      writeLine(`${idx + 1}. ${name}`);
      chunks.push(ESC_POS.BOLD_OFF);
      writeLine(`   ${qty} x Rs. ${rate.toLocaleString()} = Rs. ${total.toLocaleString()}`);

      if (item.serial_numbers && item.serial_numbers.length > 0) {
        writeLine(`   S/N: ${item.serial_numbers.join(', ')}`);
      }
      if (item.warranty_months > 0) {
        writeLine(`   Warranty: ${item.warranty_months} Months`);
      }
    });
  }

  writeLine('------------------------------------------');

  // Totals & Calculations
  chunks.push(ESC_POS.ALIGN_RIGHT);
  writeLine(`Subtotal: Rs. ${Number(invoice.subtotal || 0).toLocaleString()}`);
  if (invoice.discount_amount > 0 || invoice.discount > 0) {
    const disc = invoice.discount_amount || invoice.discount;
    writeLine(`Discount: - Rs. ${Number(disc).toLocaleString()}`);
  }
  chunks.push(ESC_POS.BOLD_ON);
  writeLine(`GRAND TOTAL: Rs. ${Number(invoice.grand_total || 0).toLocaleString()}`);
  writeLine(`Paid: Rs. ${Number(invoice.paid_amount || 0).toLocaleString()}`);
  chunks.push(ESC_POS.BOLD_OFF);

  if (invoice.balance_due > 0) {
    chunks.push(ESC_POS.BOLD_ON);
    writeLine(`* BAQAYA UDHAR (DUE): Rs. ${Number(invoice.balance_due).toLocaleString()} *`);
    chunks.push(ESC_POS.BOLD_OFF);
  } else if (invoice.change_amount > 0) {
    writeLine(`Change Returned: Rs. ${Number(invoice.change_amount).toLocaleString()}`);
  }

  // Footer & Warranty Policy (Centered)
  chunks.push(ESC_POS.ALIGN_CENTER);
  writeLine('------------------------------------------');
  writeLine(invoice.store?.receipt_footer || 'Thank you for your purchase!');
  writeLine('Physical / Burn damage voids warranty.');
  writeLine('\n\n');

  // Feed paper and cut
  chunks.push(ESC_POS.FEED_AND_CUT);

  return Buffer.concat(chunks);
}

/**
 * Send ESC/POS buffer to a Network / TCP Thermal Printer
 * Robust try-catch with socket error interception & timeout protection
 */
function sendToNetworkPrinter(rawBuffer, printerIp = '127.0.0.1', printerPort = 9100, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let hasResolved = false;
    const socket = new net.Socket();

    const finish = (result) => {
      if (hasResolved) return;
      hasResolved = true;
      try {
        socket.destroy();
      } catch (e) {}
      resolve(result);
    };

    // Strict timeout protection: If printer doesn't respond, do not hang server
    socket.setTimeout(timeoutMs);

    // CRITICAL: .on('error') listener prevents Node.js process crashing on ECONNREFUSED/EHOSTUNREACH
    socket.on('error', (err) => {
      console.warn(`[PrinterService] Socket Error (${printerIp}:${printerPort}):`, err.code || err.message);
      finish({
        success: false,
        error: 'Printer connection failed, please check cable',
        details: err.message,
        code: err.code || 'PRINTER_ERROR'
      });
    });

    socket.on('timeout', () => {
      console.warn(`[PrinterService] Socket Timeout connecting to ${printerIp}:${printerPort}`);
      finish({
        success: false,
        error: 'Printer connection failed, please check cable',
        details: 'Connection timed out. Printer may be turned off, out of paper, or disconnected.',
        code: 'ETIMEDOUT'
      });
    });

    socket.connect(printerPort, printerIp, () => {
      try {
        socket.write(rawBuffer, (writeErr) => {
          if (writeErr) {
            finish({
              success: false,
              error: 'Printer connection failed, please check cable',
              details: writeErr.message,
              code: 'WRITE_ERROR'
            });
          } else {
            finish({
              success: true,
              message: 'Receipt sent to thermal printer successfully'
            });
          }
        });
      } catch (writeException) {
        finish({
          success: false,
          error: 'Printer connection failed, please check cable',
          details: writeException.message,
          code: 'WRITE_EXCEPTION'
        });
      }
    });
  });
}

/**
 * Main Print Execution Entrypoint with full Try-Catch
 */
async function printInvoiceReceipt(invoice, printerConfig = {}) {
  try {
    if (!invoice) {
      return {
        success: false,
        error: 'Invalid invoice data provided',
        code: 'INVALID_DATA'
      };
    }

    // Generate ESC/POS raw bytes
    const rawBuffer = buildEscPosReceipt(invoice, printerConfig);

    const type = printerConfig.type || 'network';
    const ip = printerConfig.ip || process.env.PRINTER_IP || '127.0.0.1';
    const port = Number(printerConfig.port || process.env.PRINTER_PORT || 9100);
    const timeout = Number(printerConfig.timeout || 3500);

    // Send to hardware printer with zero-crash guarantee
    const result = await sendToNetworkPrinter(rawBuffer, ip, port, timeout);
    return result;
  } catch (unexpectedError) {
    // Catches any unforeseen synchronous/asynchronous hardware exception
    console.error('[PrinterService] Caught unexpected printer error:', unexpectedError);
    return {
      success: false,
      error: 'Printer connection failed, please check cable',
      details: unexpectedError.message,
      code: 'UNEXPECTED_PRINTER_ERROR'
    };
  }
}

/**
 * Ping / Test Printer Connectivity
 */
async function testPrinterConnection(printerConfig = {}) {
  try {
    const ip = printerConfig.ip || process.env.PRINTER_IP || '127.0.0.1';
    const port = Number(printerConfig.port || process.env.PRINTER_PORT || 9100);
    const timeout = Number(printerConfig.timeout || 2500);

    return new Promise((resolve) => {
      let resolved = false;
      const socket = new net.Socket();

      const finish = (res) => {
        if (resolved) return;
        resolved = true;
        try { socket.destroy(); } catch (e) {}
        resolve(res);
      };

      socket.setTimeout(timeout);

      socket.on('error', (err) => {
        finish({
          success: false,
          error: 'Printer connection failed, please check cable',
          details: err.message,
          code: err.code || 'PRINTER_DISCONNECTED'
        });
      });

      socket.on('timeout', () => {
        finish({
          success: false,
          error: 'Printer connection failed, please check cable',
          details: 'Printer response timed out',
          code: 'ETIMEDOUT'
        });
      });

      socket.connect(port, ip, () => {
        finish({
          success: true,
          message: `Thermal printer connected at ${ip}:${port}`
        });
      });
    });
  } catch (err) {
    return {
      success: false,
      error: 'Printer connection failed, please check cable',
      details: err.message,
      code: 'TEST_ERROR'
    };
  }
}

module.exports = {
  buildEscPosReceipt,
  printInvoiceReceipt,
  testPrinterConnection
};
