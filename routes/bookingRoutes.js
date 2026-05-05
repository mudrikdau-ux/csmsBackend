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
    getBookingStats,
    getReceipt,
    cancelMyBooking,
    getStaffAssignments
} = require('../controllers/bookingController');

// ==================== CUSTOMER ROUTES ====================

// Create booking (authenticated users only)
router.post('/', verifyToken, validateBooking, createBookingController);

// Get my bookings with filters (upcoming, delivered, cancelled, unpaid, etc.)
router.get('/my-bookings', verifyToken, getMyBookings);

// Get booking receipt (owner or admin)
router.get('/:id/receipt', verifyToken, getReceipt);

// Cancel my booking
router.put('/:id/cancel', verifyToken, cancelMyBooking);

// ==================== ADMIN ROUTES ====================

// Get booking statistics
router.get('/stats', verifyAdmin, getBookingStats);

// Get all bookings with filters
router.get('/', verifyAdmin, getAllBookingsController);

// Get single booking details
router.get('/:id', verifyAdmin, getBookingDetails);

// Update booking status
router.put('/:id/status', verifyAdmin, updateBookingStatusController);

// Assign staff to booking
router.post('/:id/assign-staff', verifyAdmin, assignStaff);

// Remove staff from booking
router.delete('/:id/assign-staff', verifyAdmin, removeStaff);

// ==================== STAFF ROUTES ====================

// Staff views their assigned bookings
router.get('/staff/my-assignments', verifyStaff, getStaffAssignments);

module.exports = router;