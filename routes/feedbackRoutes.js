const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');

const {
    submitFeedback,
    getPublicFeedbacks,
    getRecentFeedbacksController,
    getMyFeedbacks,
    updateMyFeedback,
    deleteMyFeedback
} = require('../controllers/feedbackController');

// ==================== PUBLIC ROUTES (No auth required) ====================

// View all public feedbacks
router.get('/public', getPublicFeedbacks);

// View recent feedbacks
router.get('/recent', getRecentFeedbacksController);

// ==================== AUTHENTICATED ROUTES ====================

// Submit feedback
router.post('/', verifyToken, submitFeedback);

// View my feedbacks
router.get('/my', verifyToken, getMyFeedbacks);

// Update my feedback
router.put('/:id', verifyToken, updateMyFeedback);

// Delete my feedback
router.delete('/:id', verifyToken, deleteMyFeedback);

module.exports = router;