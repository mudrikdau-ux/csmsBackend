const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/auth');

const {
    generateInvoice,
    getInvoices,
    getSingleInvoice,
    updateInvoiceStatusController,
    deleteInvoiceController,
    downloadInvoicePDF,
    viewInvoicePDF
} = require('../controllers/invoiceController');

// All routes require admin authentication
router.use(verifyAdmin);

// ==================== INVOICE ROUTES ====================

// Generate new invoice
router.post('/', generateInvoice);

// Get all invoices
router.get('/', getInvoices);

// Get single invoice details
router.get('/:id', getSingleInvoice);

// Delete invoice
router.delete('/:id', deleteInvoiceController);

// Update invoice status
router.patch('/:id/status', updateInvoiceStatusController);

// Download invoice PDF
router.get('/:id/download', downloadInvoicePDF);

// View invoice PDF (inline)
router.get('/:id/view', viewInvoicePDF);

module.exports = router;