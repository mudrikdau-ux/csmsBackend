const express = require('express');
const router = express.Router();

const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { validateBooking } = require('../middleware/validate');

const {
    createBookingController,
    getReceipt,
    getAllBookingsController,
    updateBookingStatusController,
    getBookingStats,
    getMyBookings
} = require('../controllers/bookingController');

// ✅ BOOKING: Authenticated users only
router.post('/', verifyToken, validateBooking, createBookingController);

// ✅ MY BOOKINGS: Users see their own bookings
router.get('/my-bookings', verifyToken, getMyBookings);

// ✅ ADMIN: View all bookings
router.get('/', verifyAdmin, getAllBookingsController);

// ✅ ADMIN: Booking statistics
router.get('/stats', verifyAdmin, getBookingStats);

// ✅ AUTHENTICATED: View receipt (owner or admin)
router.get('/:id', verifyToken, getReceipt);

// ✅ ADMIN: Update booking status
router.put('/:id/status', verifyAdmin, updateBookingStatusController);

module.exports = router;