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
    staffLogin
} = require('../controllers/authController');

const { validateRegister, validateLogin } = require('../middleware/validate');

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

module.exports = router;