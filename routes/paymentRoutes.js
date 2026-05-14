const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');

const {
    getOutstandingBalance,
    makePayment,
    payAllOutstanding,
    getPaymentHistory,
    getPaymentReceipt,
    downloadPaymentReceipt
} = require('../controllers/paymentController');

// All routes require authentication
router.use(verifyToken);

// Get outstanding balance & unpaid bookings
router.get('/balance', getOutstandingBalance);

// Make a payment
router.post('/pay', makePayment);

// Pay all outstanding at once  
router.post('/pay-all', payAllOutstanding);

// Get payment history
router.get('/history', getPaymentHistory);

// Get single payment receipt
router.get('/:id/receipt', getPaymentReceipt);

// Download payment receipt PDF
router.get('/:id/download', downloadPaymentReceipt);

module.exports = router;