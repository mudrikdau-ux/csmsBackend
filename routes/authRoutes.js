const express = require('express');
const router = express.Router();

const {
    registerUser,
    adminLogin,
    verifyAdminOTP,
    googleLogin,
    loginUser,
    verifyUserOTP,
    resendAdminOTP
} = require('../controllers/authController');

const { validateRegister } = require('../middleware/validate');


// ================= USER AUTH =================
router.post('/register', validateRegister, registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyUserOTP);


// ================= GOOGLE AUTH =================
router.post('/google-login', googleLogin);


// ================= ADMIN AUTH =================
router.post('/admin/login', adminLogin);
router.post('/admin/verify-otp', verifyAdminOTP);
router.post('/admin/resend-otp', resendAdminOTP);


// ================= EXPORT =================
module.exports = router;