const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/auth');

const {
    submitInquiry,
    getInquiries,
    getSingleInquiry,
    replyToInquiry,
    updateStatus,
    removeInquiry
} = require('../controllers/contactController');

// ==================== PUBLIC ROUTE ====================

// Submit inquiry (no auth required)
router.post('/', submitInquiry);

// ==================== ADMIN ROUTES ====================

// Get all inquiries
router.get('/', verifyAdmin, getInquiries);

// Get single inquiry
router.get('/:id', verifyAdmin, getSingleInquiry);

// Reply to inquiry
router.post('/:id/reply', verifyAdmin, replyToInquiry);

// Update status
router.patch('/:id/status', verifyAdmin, updateStatus);

// Delete inquiry
router.delete('/:id', verifyAdmin, removeInquiry);

module.exports = router;