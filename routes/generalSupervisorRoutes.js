const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { verifyGeneralSupervisor } = require('../middleware/auth');

const {
    getProfile,
    changePassword,
    getMyTeam,
    getTeamJobs,
    getAllTeamJobs,
    updateTeamJobStatus,
    getCashPaymentList,
    validateCashPayment,
    getCashPaymentStats,
    getCashPaymentHistory,
    generateWeeklyReport,
    getMyReports,
    downloadWeeklyReport,
    submitReportToAdmin,
    sendChatMessage,
    getChatMessages,
    getUnreadMessageCount
} = require('../controllers/generalSupervisorController');

// All routes require general supervisor authentication
router.use(verifyGeneralSupervisor);

// ==================== PROFILE ====================
router.get('/profile', getProfile);
router.put('/change-password', changePassword);

// ==================== MY TEAM ====================
router.get('/team', getMyTeam);
router.get('/team/jobs', getAllTeamJobs);
router.get('/team/:staffId/jobs', getTeamJobs);
router.put('/team/jobs/:jobId/status', updateTeamJobStatus);

// ==================== CASH PAYMENT VALIDATION ====================
router.get('/payments/cash/list', getCashPaymentList);
router.post('/payments/cash/validate', validateCashPayment);
router.get('/payments/cash/stats', getCashPaymentStats);
router.get('/payments/cash/history', getCashPaymentHistory);

// ==================== WEEKLY REPORTS ====================
router.post('/reports', generateWeeklyReport);
router.get('/reports', getMyReports);
router.get('/reports/:reportId/download', downloadWeeklyReport);
router.post('/reports/:reportId/submit', submitReportToAdmin);

// ==================== CHAT SYSTEM ====================
// Multer setup for chat attachments
const chatUploadDir = 'uploads/chats';
if (!fs.existsSync(chatUploadDir)) {
    fs.mkdirSync(chatUploadDir, { recursive: true });
}

const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, chatUploadDir),
    filename: (req, file, cb) => cb(null, `chat_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`)
});

const uploadChat = multer({
    storage: chatStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
        cb(allowed.test(path.extname(file.originalname).toLowerCase()) ? null : new Error('Invalid file type'), true);
    }
});

router.get('/chat/messages', getChatMessages);
router.get('/chat/unread', getUnreadMessageCount);
router.post('/chat/send', uploadChat.single('attachment'), sendChatMessage);

module.exports = router;