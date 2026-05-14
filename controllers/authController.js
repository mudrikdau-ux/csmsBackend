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
    clearOTP,
    blacklistToken,
    deleteUserAccount,
    getEmailNotificationPreference,
    toggleEmailNotifications,
    logNotification,
    getUserNotificationHistory,
    updateUserPassword,
    updateUserProfile,
    getUserById
} = require('../models/userModel');

// ==================== REGISTER USER ====================

const registerUser = async (req, res) => {
    try {
        const { first_name, last_name, email, password, address, gender } = req.body;

        const existingUser = await findUserByEmail(email);
        if (existingUser.length > 0) {
            return res.status(400).json({ 
                message: 'Email already registered',
                field: 'email'
            });
        }

        const hashedPassword = await hashPassword(password);

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

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, given_name, family_name } = payload;

        const existingUser = await findUserByEmail(email);

        let userData;

        if (existingUser.length > 0) {
            userData = existingUser[0];
        } else {
            await createGoogleUser({
                first_name: given_name,
                last_name: family_name,
                email
            });
            
            const newUser = await findUserByEmail(email);
            userData = newUser[0];
        }

        const jwtToken = jwt.sign(
            { id: userData.id, email: userData.email, role: userData.role || 'user' },
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

// ==================== USER LOGIN (STEP 1) ====================

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const users = await findUserByEmail(email);
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        const user = users[0];

        if (!user.password) {
            return res.status(400).json({ 
                message: 'This account uses Google login. Please sign in with Google.' 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        await saveOTP(email, otp, expiry);
        await sendOTPEmail(email, user.first_name, otp, 5);

        res.json({ 
            message: 'Verification code sent to your email',
            email: email
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

        const result = await verifyOTP(email, otp);

        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        const user = result[0];

        await clearOTP(email);

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role || 'user' },
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

// ==================== ADMIN LOGIN ====================

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const admins = await findAdminByEmail(email);
        
        if (admins.length === 0) {
            return res.status(404).json({ message: 'Admin account not found' });
        }

        const admin = admins[0];

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        await saveOTP(email, otp, expiry);
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

        const result = await verifyOTP(email, otp);

        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        const admin = result[0];

        if (admin.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Not an admin account.' });
        }

        await clearOTP(email);

        const token = jwt.sign(
            { id: admin.id, email: admin.email, role: 'admin' },
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

        const admins = await findAdminByEmail(email);
        
        if (admins.length === 0) {
            return res.status(404).json({ message: 'Admin account not found' });
        }

        const admin = admins[0];

        const otp = generateOTP();
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        await saveOTP(email, otp, expiry);
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

        const staffMembers = await findStaffByEmail(email);
        
        if (staffMembers.length === 0) {
            return res.status(404).json({ message: 'Staff account not found' });
        }

        const staff = staffMembers[0];

        const isMatch = await bcrypt.compare(password, staff.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

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

// ==================== LOGOUT ====================

const logoutUser = async (req, res) => {
    try {
        const token = req.token;
        const userId = req.user.id;

        const decoded = jwt.decode(token);
        const expiresAt = new Date(decoded.exp * 1000);

        await blacklistToken(token, userId, expiresAt);

        res.json({
            success: true,
            message: 'Logged out successfully. Token has been invalidated.'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to logout',
            error: error.message
        });
    }
};

// ==================== GET PROFILE ====================

const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await getUserById(userId);

        if (!user || user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const u = user[0];

        res.json({
            success: true,
            profile: {
                id: u.id,
                first_name: u.first_name,
                last_name: u.last_name,
                email: u.email,
                address: u.address,
                gender: u.gender,
                phone: u.phone,
                role: u.role,
                provider: u.provider || 'local',
                created_at: u.created_at
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
};

// ==================== UPDATE PROFILE ====================

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { first_name, last_name, address, gender, phone } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({
                message: 'First name and last name are required'
            });
        }

        if (first_name.length < 2 || last_name.length < 2) {
            return res.status(400).json({
                message: 'Name must be at least 2 characters'
            });
        }

        if (gender && !['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ message: 'Gender must be Male or Female' });
        }

        await updateUserProfile(userId, {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            address: address || '',
            gender: gender || 'Male',
            phone: phone || null
        });

        const updated = await getUserById(userId);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile: {
                id: updated[0].id,
                first_name: updated[0].first_name,
                last_name: updated[0].last_name,
                email: updated[0].email,
                address: updated[0].address,
                gender: updated[0].gender,
                phone: updated[0].phone,
                role: updated[0].role
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};

// ==================== CHANGE PASSWORD ====================

const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({
                message: 'All password fields are required',
                required: ['current_password', 'new_password', 'confirm_password']
            });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        if (current_password === new_password) {
            return res.status(400).json({ message: 'New password must be different from current password' });
        }

        const user = await getUserById(userId);
        if (!user || user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const u = user[0];

        // Google users cannot change password here
        if (u.provider === 'google' && u.password === null) {
            return res.status(400).json({
                message: 'This account uses Google Sign-In. Password management is handled by Google.'
            });
        }

        // User has NO password at all - first time setup
        if (u.password === null || u.password === undefined) {
            if (u.provider === 'google') {
                return res.status(400).json({
                    message: 'This account uses Google Sign-In. Password management is handled by Google.'
                });
            }
            const hashedPassword = await bcrypt.hash(new_password, 10);
            await updateUserPassword(userId, hashedPassword);
            return res.json({
                success: true,
                message: 'Password set successfully. You can now login with your email and new password.'
            });
        }

        // User HAS a password - MUST verify current password
        const isMatch = await bcrypt.compare(current_password, u.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await updateUserPassword(userId, hashedPassword);

        res.json({
            success: true,
            message: 'Password changed successfully. Please login again with your new password.'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password',
            error: error.message
        });
    }
};

// ==================== DELETE ACCOUNT ====================

const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { password, confirm_delete } = req.body;

        // Validate confirmation
        if (!confirm_delete || confirm_delete !== 'DELETE') {
            return res.status(400).json({
                message: 'Please type DELETE to confirm account deletion',
                required: 'confirm_delete must be "DELETE"'
            });
        }

        // Get user
        const user = await getUserById(userId);
        if (!user || user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const u = user[0];

        // Check if user has password (local account)
        if (u.provider === 'local' && u.password) {
            // Local account - require password verification
            if (!password) {
                return res.status(400).json({
                    message: 'Password is required to delete your account'
                });
            }

            const isMatch = await bcrypt.compare(password, u.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid password. Account deletion cancelled.' });
            }
        } else if (u.provider === 'google' || !u.password) {
            // Google account or no password - no password verification needed
            // Just require the DELETE confirmation (already validated above)
        }

        // Blacklist current token
        if (req.token) {
            const decoded = jwt.decode(req.token);
            if (decoded && decoded.exp) {
                const expiresAt = new Date(decoded.exp * 1000);
                await blacklistToken(req.token, userId, expiresAt);
            }
        }

        // Delete the account
        await deleteUserAccount(userId);

        res.json({
            success: true,
            message: 'Your account has been permanently deleted. We\'re sorry to see you go.',
            deleted: {
                email: u.email,
                deleted_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account',
            error: error.message
        });
    }
};


// ==================== GET NOTIFICATION PREFERENCES ====================

const getNotificationPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const prefs = await getEmailNotificationPreference(userId);

        if (!prefs || prefs.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const p = prefs[0];

        res.json({
            success: true,
            preferences: {
                email_notifications: p.email_notifications === 1 ? true : false,
                email: p.email
            }
        });

    } catch (error) {
        console.error('Get notification preferences error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification preferences',
            error: error.message
        });
    }
};

// ==================== TOGGLE EMAIL NOTIFICATIONS ====================

const toggleNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { email_notifications } = req.body;

        if (email_notifications === undefined) {
            return res.status(400).json({
                message: 'email_notifications field is required',
                example: { email_notifications: true }
            });
        }

        // Toggle in database
        await toggleEmailNotifications(userId, email_notifications);

        // Get updated preferences
        const prefs = await getEmailNotificationPreference(userId);

        res.json({
            success: true,
            message: email_notifications 
                ? 'Email notifications enabled. You will now receive email updates.' 
                : 'Email notifications disabled. You will no longer receive email updates.',
            preferences: {
                email_notifications: prefs[0].email_notifications === 1 ? true : false,
                email: prefs[0].email
            }
        });

    } catch (error) {
        console.error('Toggle notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notification preferences',
            error: error.message
        });
    }
};

// ==================== GET NOTIFICATION HISTORY ====================

const getNotificationHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const history = await getUserNotificationHistory(userId, limit);

        res.json({
            success: true,
            count: history.length,
            notifications: history.map(n => ({
                id: n.id,
                type: n.notification_type,
                subject: n.subject,
                message: n.message,
                status: n.status,
                created_at: n.created_at
            }))
        });

    } catch (error) {
        console.error('Get notification history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notification history',
            error: error.message
        });
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
    staffLogin,
    logoutUser,
    getProfile,
    updateProfile,
    changePassword,
    deleteAccount,
    getNotificationPreferences,
    toggleNotifications,
    getNotificationHistory
};