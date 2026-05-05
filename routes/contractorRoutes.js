const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/auth');

const {
    addContractor,
    getContractors,
    getSingleContractor,
    editContractor,
    removeContractor,
    updateStatus,
    searchContractorsController,
    generateInvoice,
    getContractorInvoices,
    updateInvoiceStatusController
} = require('../controllers/contractorController');

// All routes require admin authentication
router.use(verifyAdmin);

// ==================== CONTRACTOR ROUTES ====================

// Add new contractor
router.post('/', addContractor);

// Search contractors
router.get('/search', searchContractorsController);

// Get all contractors with filters
router.get('/', getContractors);

// Get single contractor details
router.get('/:id', getSingleContractor);

// Update contractor
router.put('/:id', editContractor);

// Delete contractor
router.delete('/:id', removeContractor);

// Update contractor status
router.patch('/:id/status', updateStatus);

// ==================== INVOICE ROUTES ====================

// Generate invoice for contractor
router.post('/:id/invoices', generateInvoice);

// Get contractor invoices
router.get('/:id/invoices', getContractorInvoices);

// Update invoice status
router.patch('/invoices/:invoiceId/status', updateInvoiceStatusController);

module.exports = router;