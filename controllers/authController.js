const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');    

const { 
    createUser,
    createGoogleUser, 
    findUserByEmail, 
    saveOTP, 
    verifyOTP 
} = require('../models/userModel');

const { hashPassword } = require('../utils/hash');
const { generateOTP } = require('../utils/otp');
const { sendOTPEmail } = require('../config/mail');


// ================= REGISTER =================
const registerUser = async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            password,
            address,
            gender
        } = req.body;

        findUserByEmail(email, async (err, result) => {
            if (err) return res.status(500).json(err);

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
            }, (err) => {
                if (err) return res.status(500).json(err);

                res.status(201).json({
                    message: 'User registered successfully'
                });
            });
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ================= GOOGLE LOGIN =================
const googleLogin = async (req, res) => {
    try {
        const { token } = req.body;

        // Verify token with Google
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const {
            email,
            given_name,
            family_name
        } = payload;

        // Check if user exists
        findUserByEmail(email, (err, result) => {
            if (err) return res.status(500).json(err);

            if (result.length > 0) {
                // Existing user → login
                const user = result[0];

                const jwtToken = jwt.sign(
                    { id: user.id, email: user.email },
                    process.env.JWT_SECRET,
                    { expiresIn: '1d' }
                );

                return res.json({
                    message: 'Google login successful',
                    token: jwtToken
                });
            }

            // New user → register
            createGoogleUser({
                first_name: given_name,
                last_name: family_name,
                email
            }, (err, result) => {
                if (err) return res.status(500).json(err);

                const jwtToken = jwt.sign(
                    { email },
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
        res.status(401).json({
            message: 'Invalid Google token'
        });
    }
};


// ================= LOGIN STEP 1 =================
const loginUser = (req, res) => {
    const { email, password } = req.body;

    findUserByEmail(email, async (err, result) => {
        if (err) return res.status(500).json(err);

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
            if (err) return res.status(500).json(err);

            try {
                await sendOTPEmail(email, user.first_name, otp);

                res.json({
                    message: 'OTP sent to email'
                });
            } catch (mailError) {
                res.status(500).json({
                    message: 'Failed to send OTP email'
                });
            }
        });
    });
};


// ================= LOGIN STEP 2 =================
const verifyUserOTP = (req, res) => {
    const { email, otp } = req.body;

    verifyOTP(email, otp, (err, result) => {
        if (err) return res.status(500).json(err);

        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const user = result[0];

        // Check expiry
        if (new Date(user.otp_expiry) < new Date()) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        // 🔥 CLEAR OTP AFTER SUCCESS
        saveOTP(email, null, null, () => {});

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login successful',
            token
        });
    });
};


module.exports = { registerUser, googleLogin,loginUser, verifyUserOTP };