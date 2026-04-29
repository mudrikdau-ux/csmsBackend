const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const client = require('../config/google');
const { hashPassword } = require('../utils/hash');
const { generateOTP } = require('../utils/otp');
const { sendOTPEmail } = require('../config/mail');

const {
    createUser,
    createGoogleUser,
    findUserByEmail,
    findAdminByEmail,
    findStaffByEmail,
    saveOTP,
    verifyOTP,
    clearOTP
} = require('../models/userModel');

// ==================== REGISTER USER ====================

const registerUser = async (req, res) => {
    try {
        const { first_name, last_name, email, password, address, gender } = req.body;

        // Check if email exists
        const existingUser = await findUserByEmail(email);
        if (existingUser.length > 0) {
            return res.status(400).json({ 
                message: 'Email already registered',
                field: 'email'
            });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        await createUser({
            first_name,
            last_name,
            email,
            password: hashedPassword,
            address,
            gender,
            role: 'user'
        });

        res.status(201).json({ 
            message: 'User registered successfully',
            data: {
                first_name,
                last_name,
                email,
                role: 'user'
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};

// ==================== GOOGLE LOGIN ====================

const googleLogin = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Google token is required' });
        }

        // Verify Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name } = payload;

        // Check if user exists
        const existingUser = await findUserByEmail(email);

        let userData;

        if (existingUser.length > 0) {
            // User exists - login
            userData = existingUser[0];
        } else {
            // Create new Google user
            await createGoogleUser({
                first_name: given_name,
                last_name: family_name,
                email
            });
            
            const newUser = await findUserByEmail(email);
            userData = newUser[0];
        }

        // Generate JWT
        const jwtToken = jwt.sign(
            { 
                id: userData.id, 
                email: userData.email, 
                role: userData.role || 'user' 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Google login successful',
            token: jwtToken,
            user: {
                id: userData.id,
                first_name: userData.first_name,
                last_name: userData.last_name,
                email: userData.email,
                role: userData.role
            }
        });

    } catch (error) {
        console.error('Google login error:', error);
        res.status(401).json({ message: 'Google authentication failed' });
    }
};

// ==================== USER LOGIN (STEP 1: Send OTP) ====================

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const users = await findUserByEmail(email);
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        const user = users[0];

        // Check if user has password (not Google-only)
        if (!user.password) {
            return res.status(400).json({ 
                message: 'This account uses Google login. Please sign in with Google.' 
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        // Save OTP
        await saveOTP(email, otp, expiry);

        // Send OTP email
        await sendOTPEmail(email, user.first_name, otp, 5);

        res.json({ 
            message: 'Verification code sent to your email',
            email: email // For client reference
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Login failed. Please try again.' });
    }
};

// ==================== USER VERIFY OTP (STEP 2) ====================

const verifyUserOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        // Verify OTP
        const result = await verifyOTP(email, otp);

        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        const user = result[0];

        // Clear OTP after successful verification
        await clearOTP(email);

        // Generate JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role || 'user' 
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ 
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                role: user.role,
                address: user.address,
                gender: user.gender
            }
        });

    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ message: 'Verification failed. Please try again.' });
    }
};

// ==================== ADMIN LOGIN (STEP 1: Send OTP) ====================

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find admin
        const admins = await findAdminByEmail(email);
        
        if (admins.length === 0) {
            return res.status(404).json({ message: 'Admin account not found' });
        }

        const admin = admins[0];

        // Verify password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        // Save OTP
        await saveOTP(email, otp, expiry);

        // Send OTP email
        await sendOTPEmail(email, admin.first_name, otp, 5);

        res.json({ 
            message: 'Verification code sent to admin email',
            email: email
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Admin login failed. Please try again.' });
    }
};

// ==================== ADMIN VERIFY OTP ====================

const verifyAdminOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        // Verify OTP
        const result = await verifyOTP(email, otp);

        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        const admin = result[0];

        // Check role
        if (admin.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Not an admin account.' });
        }

        // Clear OTP
        await clearOTP(email);

        // Generate JWT
        const token = jwt.sign(
            { 
                id: admin.id, 
                email: admin.email, 
                role: 'admin' 
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ 
            message: 'Admin login successful',
            token,
            admin: {
                id: admin.id,
                first_name: admin.first_name,
                last_name: admin.last_name,
                email: admin.email,
                role: 'admin'
            }
        });

    } catch (error) {
        console.error('Admin OTP verification error:', error);
        res.status(500).json({ message: 'Verification failed. Please try again.' });
    }
};

// ==================== RESEND ADMIN OTP ====================

const resendAdminOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if admin exists
        const admins = await findAdminByEmail(email);
        
        if (admins.length === 0) {
            return res.status(404).json({ message: 'Admin account not found' });
        }

        const admin = admins[0];

        // Generate new OTP
        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        // Save new OTP
        await saveOTP(email, otp, expiry);

        // Send OTP
        await sendOTPEmail(email, admin.first_name, otp, 5);

        res.json({ 
            message: 'New verification code sent',
            email: email,
            expiresIn: '5 minutes'
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ message: 'Failed to resend OTP. Please try again.' });
    }
};

// ==================== STAFF LOGIN ====================

const staffLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find staff
        const staffMembers = await findStaffByEmail(email);
        
        if (staffMembers.length === 0) {
            return res.status(404).json({ message: 'Staff account not found' });
        }

        const staff = staffMembers[0];

        // Verify password
        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: staff.id,
                email: staff.email,
                role: staff.role,
                staff_type: staff.staff_type
            },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Staff login successful',
            token,
            staff: {
                id: staff.id,
                first_name: staff.first_name,
                last_name: staff.last_name,
                email: staff.email,
                phone: staff.phone,
                staff_type: staff.staff_type,
                photo: staff.photo ? `/uploads/staff/${staff.photo}` : null
            }
        });

    } catch (error) {
        console.error('Staff login error:', error);
        res.status(500).json({ message: 'Staff login failed. Please try again.' });
    }
};

module.exports = {
    registerUser,
    googleLogin,
    loginUser,
    verifyUserOTP,
    adminLogin,
    verifyAdminOTP,
    resendAdminOTP,
    staffLogin
};