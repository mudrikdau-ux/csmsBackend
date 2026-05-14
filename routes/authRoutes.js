const express = require('express');
const router = express.Router();

const {
    registerUser,
    googleLogin,
    loginUser,
    verifyUserOTP,
    adminLogin,
    verifyAdminOTP,
    resendAdminOTP,
    staffLogin,
    logoutUser,
    getProfile,
    updateProfile,
    changePassword,
    deleteAccount,
    getNotificationPreferences,
    toggleNotifications,
    getNotificationHistory
} = require('../controllers/authController');

const { validateRegister, validateLogin } = require('../middleware/validate');
const { verifyToken } = require('../middleware/auth');

// ==================== USER AUTH ====================
router.post('/register', validateRegister, registerUser);
router.post('/login', validateLogin, loginUser);
router.post('/verify-otp', verifyUserOTP);

// ==================== GOOGLE AUTH ====================
router.post('/google-login', googleLogin);

// ==================== ADMIN AUTH ====================
router.post('/admin/login', validateLogin, adminLogin);
router.post('/admin/verify-otp', verifyAdminOTP);
router.post('/admin/resend-otp', resendAdminOTP);

// ==================== STAFF AUTH ====================
router.post('/staff/login', validateLogin, staffLogin);

// ==================== USER PROFILE (Authenticated) ====================

// Get profile
router.get('/profile', verifyToken, getProfile);

// Update profile
router.put('/profile', verifyToken, updateProfile);

// Change password
router.put('/change-password', verifyToken, changePassword);

// Logout
router.post('/logout', verifyToken, logoutUser);

// Delete account
router.delete('/delete-account', verifyToken, deleteAccount);


// Get notification preferences
router.get('/notifications/preferences', verifyToken, getNotificationPreferences);

// Toggle email notifications
router.put('/notifications/toggle', verifyToken, toggleNotifications);

// Get notification history
router.get('/notifications/history', verifyToken, getNotificationHistory);

module.exports = router;