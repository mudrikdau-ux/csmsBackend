const express = require('express');
const router = express.Router();

const { verifyStaff } = require('../middleware/auth');

const {
    getAssignedJobs,
    getJobDetails,
    getJobDetailsWithIssueStatus,
    updateJobStatus,
    getJobHistory,
    getPerformanceStats,
    getStaffProfile,
    changeStaffPassword
} = require('../controllers/staffJobsController');

// All routes require staff authentication
router.use(verifyStaff);

// ==================== JOB MANAGEMENT ====================
router.get('/jobs', getAssignedJobs);
router.get('/jobs/:id', getJobDetailsWithIssueStatus);
router.put('/jobs/:id/status', updateJobStatus);
router.get('/jobs/history', getJobHistory);

// ==================== PERFORMANCE ====================
router.get('/performance', getPerformanceStats);

// ==================== PROFILE ====================
router.get('/profile', getStaffProfile);
router.put('/change-password', changeStaffPassword);

module.exports = router;