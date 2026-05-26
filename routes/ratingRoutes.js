const express = require('express');
const router = express.Router();

const { verifyToken, verifyStaff, verifyAdmin } = require('../middleware/auth');

const {
    submitRating,
    getRatableBookingsController,
    getMyRatings,
    getStaffRatings,
    getStaffRatingSummaryController,
    getTopRatedStaffController,
    getPublicStaffRatings,
    adminGetAllRatings,
    adminUpdateRatingStatus,
    adminDeleteRating
} = require('../controllers/ratingController');

// ==================== PUBLIC ROUTES ====================
router.get('/top-staff', getTopRatedStaffController);
router.get('/staff/:staffId', getPublicStaffRatings);

// ==================== CUSTOMER ROUTES (Authenticated) ====================
router.get('/my/ratable', verifyToken, getRatableBookingsController);
router.post('/submit', verifyToken, submitRating);
router.get('/my', verifyToken, getMyRatings);

// ==================== STAFF ROUTES ====================
router.get('/staff/my', verifyStaff, getStaffRatings);
router.get('/staff/summary', verifyStaff, getStaffRatingSummaryController);

// ==================== ADMIN ROUTES ====================
router.get('/admin/all', verifyAdmin, adminGetAllRatings);
router.put('/admin/:id/status', verifyAdmin, adminUpdateRatingStatus);
router.delete('/admin/:id', verifyAdmin, adminDeleteRating);

module.exports = router;