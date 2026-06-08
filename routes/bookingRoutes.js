const express = require('express');
const router = express.Router();

const { verifyToken, verifyAdmin, verifyStaff } = require('../middleware/auth');
const { validateBooking } = require('../middleware/validate');

const {
    createBookingController,
    getMyBookings,
    getAllBookingsController,
    getBookingDetails,
    assignStaff,
    removeStaff,
    updateBookingStatusController,
    updatePaymentStatus,
    getBookingStats,
    getReceipt,
    cancelMyBooking,
    getStaffAssignments,
    updateBookingEstimationController,
    generateAndSendInvoice,
    getMyInvoices,
    downloadCustomerInvoice
} = require('../controllers/bookingController');

// ==================== CUSTOMER ROUTES ====================
router.post('/', verifyToken, validateBooking, createBookingController);
router.get('/my-bookings', verifyToken, getMyBookings);
router.get('/my-invoices', verifyToken, getMyInvoices);
router.get('/invoices/:id/download', verifyToken, downloadCustomerInvoice);
router.get('/:id/receipt', verifyToken, getReceipt);
router.put('/:id/cancel', verifyToken, cancelMyBooking);

// ==================== ADMIN ROUTES ====================
router.get('/stats', verifyAdmin, getBookingStats);
router.get('/', verifyAdmin, getAllBookingsController);
router.get('/:id', verifyAdmin, getBookingDetails);
router.put('/:id/status', verifyAdmin, updateBookingStatusController);
router.put('/:id/payment-status', verifyAdmin, updatePaymentStatus);
router.post('/:id/assign-staff', verifyAdmin, assignStaff);
router.delete('/:id/assign-staff', verifyAdmin, removeStaff);
router.post('/:id/estimation', verifyAdmin, updateBookingEstimationController);
router.post('/:id/generate-invoice', verifyAdmin, generateAndSendInvoice);

// ==================== STAFF ROUTES ====================
router.get('/staff/my-assignments', verifyStaff, getStaffAssignments);

module.exports = router;