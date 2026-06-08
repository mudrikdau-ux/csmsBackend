const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/auth');

const {
    generateReport,
    getReportHistory,
    downloadReport,
    getBookingAnalytics,
    getRevenueAnalytics,
    getDashboardSummary
} = require('../controllers/reportController');

// All routes require admin authentication
router.use(verifyAdmin);

// ==================== REPORT GENERATION ====================
router.post('/generate', generateReport);
router.get('/history', getReportHistory);
router.get('/download/:id', downloadReport);

// ==================== ANALYTICS DASHBOARDS ====================
router.get('/dashboard', getDashboardSummary);
router.get('/bookings', getBookingAnalytics);
router.get('/revenue', getRevenueAnalytics);

// staff_performance endpoint REMOVED - use staff_report type instead

module.exports = router;