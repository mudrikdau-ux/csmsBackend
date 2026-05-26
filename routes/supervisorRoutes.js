const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { verifyStaff } = require('../middleware/auth');

const {
    getSupervisorProfile,
    getContractors,
    getContractorStaffList,
    saveStaffAttendance,
    getAttendance,
    getPayrollSummary,
    generateWeeklyReport,
    downloadWeeklyReport,
    submitReportToAdmin,
    getMyReports,
    sendChatMessage,
    getChatMessages,
    getUnreadMessageCount,
    changeSupervisorPassword
} = require('../controllers/supervisorController');

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

// All routes require staff authentication (supervisor)
router.use(verifyStaff);

// ==================== PROFILE ====================
router.get('/profile', getSupervisorProfile);
router.put('/change-password', changeSupervisorPassword);

// ==================== CONTRACTOR & STAFF ====================
router.get('/contractors', getContractors);
router.get('/contractors/:contractorId/staff', getContractorStaffList);

// ==================== ATTENDANCE ====================
router.post('/attendance', saveStaffAttendance);
router.get('/attendance/:contractorId/:date', getAttendance);

// ==================== PAYROLL ====================
router.get('/payroll/:weekEndingDate', getPayrollSummary);

// ==================== WEEKLY REPORTS ====================
router.post('/reports', generateWeeklyReport);
router.get('/reports', getMyReports);
router.get('/reports/:reportId/download', downloadWeeklyReport);
router.post('/reports/:reportId/submit', submitReportToAdmin);

// ==================== CHAT SYSTEM ====================
router.get('/chat/messages', getChatMessages);
router.get('/chat/unread', getUnreadMessageCount);
router.post('/chat/send', uploadChat.single('attachment'), sendChatMessage);

module.exports = router;