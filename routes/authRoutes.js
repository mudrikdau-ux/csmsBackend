const express = require('express');
const router = express.Router();

const { registerUser, googleLogin, loginUser, verifyUserOTP} = require('../controllers/authController');
const { validateRegister } = require('../middleware/validate');

router.post('/register', validateRegister, registerUser);
router.post('/google-login', googleLogin);
router.post('/login', loginUser);
router.post('/verify-otp', verifyUserOTP);

module.exports = router;