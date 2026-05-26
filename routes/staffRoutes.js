const express = require('express');
const router = express.Router();

const { verifyStaff } = require('../middleware/auth');

const {
    getAssignedJobs,
    getJobDetails,
    updateJobStatus,
    getJobHistory,
    getPerformanceStats,
    getStaffProfile,
    changeStaffPassword,
    getCashPaymentList,
    validateCashPaymentController,
    getCashPaymentStats,
    getCashPaymentHistory
} = require('../controllers/staffJobsController');

// All routes require staff authentication
router.use(verifyStaff);

// ==================== JOB MANAGEMENT ====================

// Get all assigned jobs (with optional status filter)
router.get('/jobs', getAssignedJobs);

// Get single job details
router.get('/jobs/:id', getJobDetails);

// Update job status (start job / mark as complete)
router.put('/jobs/:id/status', updateJobStatus);

// Get job history (completed jobs)
router.get('/jobs/history', getJobHistory);

// ==================== PERFORMANCE ====================

// Get performance statistics
router.get('/performance', getPerformanceStats);

// ==================== PROFILE ====================

// Get staff profile
router.get('/profile', getStaffProfile);

// Change password
router.put('/change-password', changeStaffPassword);

// ==================== CASH PAYMENT VALIDATION ====================

// Get list of unpaid cash payment bookings
router.get('/payments/cash/list', getCashPaymentList);

// Validate cash payment
router.post('/payments/cash/validate', validateCashPaymentController);

// Get cash payment statistics
router.get('/payments/cash/stats', getCashPaymentStats);

// Get cash payment history
router.get('/payments/cash/history', getCashPaymentHistory);

module.exports = router;