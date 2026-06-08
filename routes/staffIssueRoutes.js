const express = require('express');
const router = express.Router();

const { verifyStaff, verifyAdmin } = require('../middleware/auth');

const {
    submitIssue,
    getMyIssues,
    getSingleIssue,
    adminGetAllIssues,
    adminUpdateIssueStatus,
    adminDeleteIssue,
    adminGetIssueStats
} = require('../controllers/staffIssueController');

// ==================== STAFF ROUTES ====================
router.post('/', verifyStaff, submitIssue);
router.get('/my', verifyStaff, getMyIssues);
router.get('/:id', verifyStaff, getSingleIssue);

// ==================== ADMIN ROUTES ====================
router.get('/admin/all', verifyAdmin, adminGetAllIssues);
router.get('/admin/stats', verifyAdmin, adminGetIssueStats);
router.put('/admin/:id/status', verifyAdmin, adminUpdateIssueStatus);
router.delete('/admin/:id', verifyAdmin, adminDeleteIssue);

module.exports = router;