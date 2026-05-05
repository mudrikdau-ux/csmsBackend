const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/auth');

const {
    generateReport,
    getReportHistory,
    downloadReport,
    getBookingAnalytics,
    getRevenueAnalytics,
    getStaffAnalytics,
    getDashboardSummary
} = require('../controllers/reportController');

// All routes require admin authentication
router.use(verifyAdmin);

// ==================== REPORT GENERATION ====================

// Generate new report
router.post('/generate', generateReport);

// Get report history
router.get('/history', getReportHistory);

// Download report
router.get('/download/:id', downloadReport);

// ==================== ANALYTICS DASHBOARDS ====================

// Dashboard summary
router.get('/dashboard', getDashboardSummary);

// Booking analytics with charts
router.get('/bookings', getBookingAnalytics);

// Revenue analytics with charts
router.get('/revenue', getRevenueAnalytics);

// Staff performance analytics
router.get('/staff-performance', getStaffAnalytics);

module.exports = router;