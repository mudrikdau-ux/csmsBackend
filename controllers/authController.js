const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const client = require('../config/google');

const {
    createUser,
    createGoogleUser,
    findUserByEmail,
    findAdminByEmail,
    findStaffByEmail,
    saveOTP,
    verifyOTP
} = require('../models/userModel');

const { hashPassword } = require('../utils/hash');
const { generateOTP } = require('../utils/otp');
const { sendOTPEmail } = require('../config/mail');


// ================= REGISTER =================
const registerUser = async (req, res) => {
    try {
        const { first_name, last_name, email, password, address, gender } = req.body;

        findUserByEmail(email, async (err, result) => {
            if (result.length > 0) {
                return res.status(400).json({ message: 'Email already exists' });
            }

            const hashedPassword = await hashPassword(password);

            createUser({
                first_name,
                last_name,
                email,
                password: hashedPassword,
                address,
                gender
            }, () => {
                res.status(201).json({ message: 'User registered successfully' });
            });
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ================= GOOGLE LOGIN =================
const googleLogin = async (req, res) => {
    try {
        const { token } = req.body;

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name } = payload;

        findUserByEmail(email, (err, result) => {
            if (err) return res.status(500).json({ message: 'Database error' });

            if (result.length > 0) {
                const user = result[0];

                const jwtToken = jwt.sign(
                    { id: user.id, email: user.email, role: user.role || 'user' },
                    process.env.JWT_SECRET,
                    { expiresIn: '1d' }
                );

                return res.json({
                    message: 'Google login successful',
                    token: jwtToken
                });
            }

            createGoogleUser({
                first_name: given_name,
                last_name: family_name,
                email
            }, (err, result) => {
                if (err) return res.status(500).json({ message: 'Failed to create user' });

                const jwtToken = jwt.sign(
                    { email, role: 'user' },
                    process.env.JWT_SECRET,
                    { expiresIn: '1d' }
                );

                res.json({
                    message: 'Google account created and logged in',
                    token: jwtToken
                });
            });
        });

    } catch (error) {
        res.status(401).json({ message: 'Invalid Google token' });
    }
};


// ================= USER LOGIN STEP 1 =================
const loginUser = (req, res) => {
    const { email, password } = req.body;

    findUserByEmail(email, async (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (result.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result[0];

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        saveOTP(email, otp, expiry, async (err) => {
            if (err) return res.status(500).json({ message: 'Failed to save OTP' });

            await sendOTPEmail(email, user.first_name, otp);

            res.json({ message: 'OTP sent to email' });
        });
    });
};


// ================= USER VERIFY OTP =================
const verifyUserOTP = (req, res) => {
    const { email, otp } = req.body;

    verifyOTP(email, otp, (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const user = result[0];

        if (new Date(user.otp_expiry) < new Date()) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        saveOTP(email, null, null, () => {});

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role || 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ message: 'Login successful', token });
    });
};


// ================= ADMIN LOGIN STEP 1 =================
const adminLogin = (req, res) => {
    const { email, password } = req.body;

    findAdminByEmail(email, async (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (result.length === 0) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const admin = result[0];

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        saveOTP(email, otp, expiry, async (err) => {
            if (err) return res.status(500).json({ message: 'Failed to save OTP' });

            await sendOTPEmail(email, admin.first_name, otp);

            res.json({ message: 'OTP sent to admin email' });
        });
    });
};


// ================= ADMIN VERIFY OTP =================
const verifyAdminOTP = (req, res) => {
    const { email, otp } = req.body;

    verifyOTP(email, otp, (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const admin = result[0];

        if (admin.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (new Date(admin.otp_expiry) < new Date()) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        saveOTP(email, null, null, () => {});

        const token = jwt.sign(
            { id: admin.id, email: admin.email, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({ message: 'Admin login successful', token });
    });
};


// ================= RESEND ADMIN OTP =================
const resendAdminOTP = (req, res) => {
    const { email } = req.body;

    findAdminByEmail(email, async (err, result) => {
        if (err) return res.status(500).json({ message: 'Database error' });

        if (result.length === 0) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const admin = result[0];

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        saveOTP(email, otp, expiry, async (err) => {
            if (err) return res.status(500).json({ message: 'Failed to save OTP' });

            await sendOTPEmail(email, admin.first_name, otp);

            res.json({ message: 'New OTP sent' });
        });
    });
};

// ================= STAFF LOGIN =================
const staffLogin = (req, res) => {
    const { email, password } = req.body;

    findStaffByEmail(email, async (err, result) => {
        if (result.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        const staff = result[0];

        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: staff.id,
                email: staff.email,
                role: staff.role,
                staff_type: staff.staff_type // 🔥 NEW
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Staff login successful',
            token,
            staff: {
                id: staff.id,
                name: staff.first_name,
                email: staff.email,
                type: staff.staff_type // 🔥 NEW
            }
        });
    });
};

module.exports = {
    registerUser,
    staffLogin
};


// ================= EXPORT =================
module.exports = {
    registerUser,
    googleLogin,
    staffLogin,
    loginUser,
    verifyUserOTP,
    adminLogin,
    verifyAdminOTP,
    resendAdminOTP
};