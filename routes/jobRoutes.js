const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { verifyToken, verifyAdmin } = require('../middleware/auth');
const {
    getSettings, updateSettings, getStats,
    submitApplication, getMyApplications, trackByReference, trackMyApplication,
    getApplications, getSingleApplication, reviewApplication, removeApplication,
    downloadApplicationPDF, viewApplicationPDF
} = require('../controllers/jobApplicationController');

const uploadDir = 'uploads/applications';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `app_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage, limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
        cb(allowed.test(path.extname(file.originalname).toLowerCase()) ? null : new Error('Invalid file type'), true);
    }
});

// ==================== PUBLIC ROUTES ====================
router.get('/settings', getSettings);
router.get('/track/:reference', trackByReference);

// ==================== CUSTOMER ROUTES ====================
router.post('/apply', verifyToken, upload.any(), submitApplication);
router.get('/my-applications', verifyToken, getMyApplications);
router.get('/my-track/:reference', verifyToken, trackMyApplication);

// ==================== ADMIN ROUTES ====================

// Statistics
router.get('/stats', verifyAdmin, getStats);

// Toggle open/close
router.put('/settings', verifyAdmin, updateSettings);

// View all applications
router.get('/', verifyAdmin, getApplications);

// Download PDF
router.get('/:id/download', verifyAdmin, downloadApplicationPDF);

// View/Share PDF
router.get('/:id/view', verifyAdmin, viewApplicationPDF);

// Review application
router.put('/:id/review', verifyAdmin, reviewApplication);

// Delete application
router.delete('/:id', verifyAdmin, removeApplication);

// Get single application (MUST be last)
router.get('/:id', verifyAdmin, getSingleApplication);

module.exports = router;