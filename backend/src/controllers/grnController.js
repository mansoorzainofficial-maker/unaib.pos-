const Grn = require('../models/Grn');

/**
 * Get all GRNs
 * GET /api/grn
 */
async function getAllGrns(req, res) {
  try {
    const grns = await Grn.getAll();
    res.json({
      success: true,
      grns
    });
  } catch (err) {
    console.error('Error fetching GRNs:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GRN records',
      message: err.message
    });
  }
}

/**
 * Get single GRN with item details
 * GET /api/grn/:id
 */
async function getGrnById(req, res) {
  try {
    const { id } = req.params;
    const grn = await Grn.getById(id);

    if (!grn) {
      return res.status(404).json({
        success: false,
        error: 'GRN record not found'
      });
    }

    res.json({
      success: true,
      grn
    });
  } catch (err) {
    console.error('Error fetching GRN detail:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GRN details',
      message: err.message
    });
  }
}

/**
 * Create new GRN with atomic SQL transaction
 * POST /api/grn
 */
async function createGrn(req, res) {
  try {
    const { supplier_id, payment_type, received_date, notes, items } = req.body;

    // Strict Validation
    if (!supplier_id) {
      return res.status(400).json({
        success: false,
        error: 'Supplier selection is required'
      });
    }

    if (!payment_type || !['cash', 'credit'].includes(payment_type)) {
      return res.status(400).json({
        success: false,
        error: 'Payment type must be either "cash" or "credit"'
      });
    }

    if (!received_date) {
      return res.status(400).json({
        success: false,
        error: 'Received date is required'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one product item is required'
      });
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.product_id) {
        return res.status(400).json({
          success: false,
          error: `Row #${i + 1}: Please select a product`
        });
      }
      if (!it.quantity_received || Number(it.quantity_received) <= 0) {
        return res.status(400).json({
          success: false,
          error: `Row #${i + 1}: Quantity received must be greater than 0`
        });
      }
      if (it.unit_cost === undefined || it.unit_cost === null || Number(it.unit_cost) < 0) {
        return res.status(400).json({
          success: false,
          error: `Row #${i + 1}: Valid unit cost is required`
        });
      }
    }

    const createdGrn = await Grn.create({
      supplier_id: Number(supplier_id),
      payment_type,
      received_date,
      notes: notes && notes.trim() ? notes.trim() : null,
      items
    });

    res.status(201).json({
      success: true,
      message: `Goods Received Note ${createdGrn.grn_number} created successfully`,
      grn: createdGrn
    });
  } catch (err) {
    console.error('Error creating GRN:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to create GRN'
    });
  }
}

module.exports = {
  getAllGrns,
  getGrnById,
  createGrn
};
