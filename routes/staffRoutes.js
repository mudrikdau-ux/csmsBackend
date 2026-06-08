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
    changeStaffPassword
    // Removed: getCashPaymentList, validateCashPaymentController, getCashPaymentStats, getCashPaymentHistory
} = require('../controllers/staffJobsController');

// All routes require staff authentication
router.use(verifyStaff);

// ==================== JOB MANAGEMENT ====================
router.get('/jobs', getAssignedJobs);
router.get('/jobs/:id', getJobDetails);
router.put('/jobs/:id/status', updateJobStatus);
router.get('/jobs/history', getJobHistory);

// ==================== PERFORMANCE ====================
router.get('/performance', getPerformanceStats);

// ==================== PROFILE ====================
router.get('/profile', getStaffProfile);
router.put('/change-password', changeStaffPassword);

// Cash payment endpoints REMOVED - moved to general supervisor

module.exports = router;