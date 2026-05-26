const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/auth');
const {
    getDashboardStats,
    getRecentBookings,
    getChartData,
    getQuickStats
} = require('../controllers/adminStatsController');

// All routes require admin authentication
router.use(verifyAdmin);

// Get complete dashboard statistics
router.get('/dashboard', getDashboardStats);

// Get recent bookings only
router.get('/recent-bookings', getRecentBookings);

// Get chart data (weekly/monthly/yearly)
router.get('/charts', getChartData);

// Get quick stats for dashboard cards
router.get('/quick', getQuickStats);

module.exports = router;