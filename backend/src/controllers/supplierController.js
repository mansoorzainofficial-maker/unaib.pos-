const Supplier = require('../models/Supplier');
const { logActivity } = require('../models/ActivityLog');

/**
 * Get all suppliers
 * GET /api/suppliers
 */
async function getAllSuppliers(req, res) {
  try {
    const suppliers = await Supplier.getAll();
    res.json({
      success: true,
      suppliers
    });
  } catch (err) {
    console.error('Error fetching suppliers:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suppliers',
      message: err.message
    });
  }
}

/**
 * Get single supplier by ID
 * GET /api/suppliers/:id
 */
async function getSupplierById(req, res) {
  try {
    const { id } = req.params;
    const supplier = await Supplier.getById(id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      supplier
    });
  } catch (err) {
    console.error('Error fetching supplier:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supplier details',
      message: err.message
    });
  }
}

/**
 * Create new supplier
 * POST /api/suppliers
 */
async function createSupplier(req, res) {
  try {
    const { name, contact_person, phone, email, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Supplier name is required'
      });
    }

    const newSupplier = await Supplier.create({
      name: name.trim(),
      contact_person: contact_person ? contact_person.trim() : null,
      phone: phone ? phone.trim() : null,
      email: email ? email.trim() : null,
      address: address ? address.trim() : null,
      total_due: 0.0
    });

    await logActivity({
      userId: req.user ? req.user.id : null,
      username: req.user ? req.user.username : 'Admin',
      action: 'supplier_create',
      description: `نیا سپلائر رجسٹرڈ: ${name.trim()} (${phone ? phone.trim() : 'کوئی فون نہیں'})`
    });

    res.status(201).json({
      success: true,
      message: 'Supplier added successfully',
      supplier: newSupplier
    });
  } catch (err) {
    console.error('Error creating supplier:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to create supplier'
    });
  }
}

/**
 * Update existing supplier
 * PUT /api/suppliers/:id
 */
async function updateSupplier(req, res) {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Supplier name cannot be empty'
      });
    }

    const existing = await Supplier.getById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    const updated = await Supplier.update(id, {
      name: name.trim(),
      contact_person: contact_person ? contact_person.trim() : null,
      phone: phone ? phone.trim() : null,
      email: email ? email.trim() : null,
      address: address ? address.trim() : null
    });

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      supplier: updated
    });
  } catch (err) {
    console.error('Error updating supplier:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to update supplier'
    });
  }
}

/**
 * Delete supplier
 * DELETE /api/suppliers/:id
 */
async function deleteSupplier(req, res) {
  try {
    const { id } = req.params;
    const existing = await Supplier.getById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    await Supplier.delete(id);

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting supplier:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to delete supplier'
    });
  }
}

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
