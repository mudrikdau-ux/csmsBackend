const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { verifyToken } = require('../middleware/auth');

const {
    getProfile,
    updateProfile,
    updateProfilePhoto,
    changePassword,
    getSavedLocations,
    addLocation,
    deleteLocation,
    getSavedPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod,
    getServiceHistory,
    deleteServiceHistory,
    clearAllHistory,
    getNotificationSettings,
    toggleWebNotifications,
    getWebNotificationHistory,
    markNotificationRead,
    clearAllNotifications
} = require('../controllers/profileController');

const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/profiles';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `profile_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadProfile = multer({
    storage: profileStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

router.use(verifyToken);

router.get('/', getProfile);
router.put('/', updateProfile);
router.post('/photo', uploadProfile.single('photo'), updateProfilePhoto);
router.put('/password', changePassword);
router.get('/locations', getSavedLocations);
router.post('/locations', addLocation);
router.delete('/locations/:id', deleteLocation);
router.get('/payment-methods', getSavedPaymentMethods);
router.post('/payment-methods', addPaymentMethod);
router.delete('/payment-methods/:id', deletePaymentMethod);
router.get('/service-history', getServiceHistory);
router.delete('/service-history/:id', deleteServiceHistory);
router.delete('/service-history', clearAllHistory);
router.get('/notifications/settings', getNotificationSettings);
router.put('/notifications/toggle', toggleWebNotifications);
router.get('/notifications', getWebNotificationHistory);
router.put('/notifications/:id/read', markNotificationRead);
router.delete('/notifications', clearAllNotifications);

module.exports = router;