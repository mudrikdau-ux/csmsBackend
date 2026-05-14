const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const db = require('../config/db');
const {
    getUserById,
    updateUserProfile,
    updateUserPassword,
    findUserByEmail
} = require('../models/userModel');

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
                profile_photo: u.profile_photo ? `${req.protocol}://${req.get('host')}/uploads/profiles/${u.profile_photo}` : null,
                email_notifications: u.email_notifications === 1,
                web_notifications: u.web_notifications === 1,
                created_at: u.created_at
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
    }
};

// ==================== UPDATE PROFILE ====================

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { first_name, last_name, email, phone, address, gender } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({ message: 'First name and last name are required' });
        }

        if (first_name.length < 2 || last_name.length < 2) {
            return res.status(400).json({ message: 'Name must be at least 2 characters' });
        }

        await updateUserProfile(userId, {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            address: address || '',
            gender: gender || 'Male',
            phone: phone || null
        });

        if (email && email !== req.user.email) {
            const existing = await findUserByEmail(email);
            if (existing.length > 0 && existing[0].id !== userId) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            await db.query(`UPDATE users SET email = ? WHERE id = ?`, [email.toLowerCase().trim(), userId]);
        }

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
                profile_photo: updated[0].profile_photo ? `${req.protocol}://${req.get('host')}/uploads/profiles/${updated[0].profile_photo}` : null
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
    }
};

// ==================== UPDATE PROFILE PHOTO ====================

const updateProfilePhoto = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ message: 'Photo file is required' });
        }

        const user = await getUserById(userId);
        if (user[0].profile_photo) {
            const oldPath = path.join(__dirname, '..', 'uploads', 'profiles', user[0].profile_photo);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await db.query(`UPDATE users SET profile_photo = ? WHERE id = ?`, [req.file.filename, userId]);

        res.json({
            success: true,
            message: 'Profile photo updated',
            photo_url: `${req.protocol}://${req.get('host')}/uploads/profiles/${req.file.filename}`
        });

    } catch (error) {
        console.error('Update photo error:', error);
        res.status(500).json({ success: false, message: 'Failed to update photo', error: error.message });
    }
};

// ==================== CHANGE PASSWORD (FIXED) ====================

const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password, confirm_password } = req.body;

        // Validate all fields
        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({
                message: 'All password fields are required',
                required: ['current_password', 'new_password', 'confirm_password']
            });
        }

        // Validate passwords match
        if (new_password !== confirm_password) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }

        // Validate password length
        if (new_password.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        // Validate not same as current
        if (current_password === new_password) {
            return res.status(400).json({ message: 'New password must be different from current password' });
        }

        // Get user from database
        const user = await getUserById(userId);
        if (!user || user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const u = user[0];

        // Case 1: Google users cannot change password here
        if (u.provider === 'google' && (u.password === null || u.password === undefined || u.password === '')) {
            return res.status(400).json({
                message: 'This account uses Google Sign-In. Password management is handled by Google.'
            });
        }

        // Case 2: User has NO password (first time setup)
        if (u.password === null || u.password === undefined || u.password === '') {
            const hashedPassword = await bcrypt.hash(new_password, 10);
            await updateUserPassword(userId, hashedPassword);
            return res.json({
                success: true,
                message: 'Password set successfully. You can now login with your email and new password.'
            });
        }

        // Case 3: User HAS a password - MUST verify current password
        const isMatch = await bcrypt.compare(current_password, u.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash and update new password
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

// ==================== SAVED LOCATIONS ====================

const getSavedLocations = async (req, res) => {
    try {
        const locations = await db.query(
            `SELECT * FROM saved_locations WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, count: locations.length, locations });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch locations', error: error.message });
    }
};

const addLocation = async (req, res) => {
    try {
        const { location_name, address, city, landmark, latitude, longitude, is_default } = req.body;

        if (!location_name || !address || !city) {
            return res.status(400).json({ message: 'Location name, address, and city are required' });
        }

        if (is_default) {
            await db.query(`UPDATE saved_locations SET is_default = 0 WHERE user_id = ?`, [req.user.id]);
        }

        const result = await db.query(
            `INSERT INTO saved_locations (user_id, location_name, address, city, landmark, latitude, longitude, is_default) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, location_name, address, city, landmark || null, latitude || null, longitude || null, is_default ? 1 : 0]
        );

        res.status(201).json({ success: true, message: 'Location saved', location_id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save location', error: error.message });
    }
};

const deleteLocation = async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM saved_locations WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Location not found' });
        }

        res.json({ success: true, message: 'Location deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete location', error: error.message });
    }
};

// ==================== SAVED PAYMENT METHODS ====================

const getSavedPaymentMethods = async (req, res) => {
    try {
        const methods = await db.query(
            `SELECT * FROM saved_payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, count: methods.length, payment_methods: methods });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch payment methods', error: error.message });
    }
};

const addPaymentMethod = async (req, res) => {
    try {
        const { payment_type, card_last_four, mobile_number, bank_name, account_number, is_default } = req.body;

        if (!payment_type) {
            return res.status(400).json({ message: 'Payment type is required' });
        }

        if (is_default) {
            await db.query(`UPDATE saved_payment_methods SET is_default = 0 WHERE user_id = ?`, [req.user.id]);
        }

        const result = await db.query(
            `INSERT INTO saved_payment_methods (user_id, payment_type, card_last_four, mobile_number, bank_name, account_number, is_default) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, payment_type, card_last_four || null, mobile_number || null, bank_name || null, account_number || null, is_default ? 1 : 0]
        );

        res.status(201).json({ success: true, message: 'Payment method saved', method_id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save payment method', error: error.message });
    }
};

const deletePaymentMethod = async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM saved_payment_methods WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Payment method not found' });
        }

        res.json({ success: true, message: 'Payment method deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete payment method', error: error.message });
    }
};

// ==================== SERVICE HISTORY ====================

const getStatusLabel = (status) => {
    const labels = {
        'pending': 'Pending', 'confirmed': 'Upcoming', 'in_progress': 'In Progress',
        'completed': 'Delivered', 'cancelled': 'Cancelled'
    };
    return labels[status] || status;
};

const getServiceHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, date_from, date_to, limit } = req.query;

        let sql = `
            SELECT b.*, s.name as service_name, s.price as service_price, s.duration as service_duration,
                   u.first_name as staff_first_name, u.last_name as staff_last_name
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN users u ON b.assigned_staff_id = u.id
            WHERE b.user_id = ?
        `;
        const values = [userId];

        if (status) { sql += ` AND b.status = ?`; values.push(status); }
        if (date_from) { sql += ` AND b.service_date >= ?`; values.push(date_from); }
        if (date_to) { sql += ` AND b.service_date <= ?`; values.push(date_to); }

        sql += ` ORDER BY b.created_at DESC LIMIT ?`;
        values.push(parseInt(limit) || 50);

        const history = await db.query(sql, values);

        const enriched = history.map(h => ({
            id: h.id,
            service: { id: h.service_id, name: h.service_name, price: parseFloat(h.service_price), duration: h.service_duration },
            staff: h.staff_first_name ? { name: `${h.staff_first_name} ${h.staff_last_name || ''}` } : null,
            date: h.service_date,
            time: h.service_time,
            address: h.address,
            city: h.city,
            total_price: parseFloat(h.total_price),
            payment_method: h.payment_method,
            payment_status: h.payment_status,
            status: h.status,
            status_label: getStatusLabel(h.status),
            created_at: h.created_at
        }));

        res.json({ success: true, count: enriched.length, history: enriched });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch service history', error: error.message });
    }
};

const deleteServiceHistory = async (req, res) => {
    try {
        const result = await db.query(
            `DELETE FROM bookings WHERE id = ? AND user_id = ? AND status IN ('completed', 'cancelled')`,
            [req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'History entry not found or cannot be deleted' });
        }
        res.json({ success: true, message: 'History entry deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete history', error: error.message });
    }
};

const clearAllHistory = async (req, res) => {
    try {
        await db.query(`DELETE FROM bookings WHERE user_id = ? AND status IN ('completed', 'cancelled')`, [req.user.id]);
        res.json({ success: true, message: 'All service history cleared' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to clear history', error: error.message });
    }
};

// ==================== WEB NOTIFICATIONS ====================

const getNotificationSettings = async (req, res) => {
    try {
        const user = await getUserById(req.user.id);
        res.json({
            success: true,
            settings: {
                email_notifications: user[0].email_notifications === 1,
                web_notifications: user[0].web_notifications === 1
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch settings', error: error.message });
    }
};

const toggleWebNotifications = async (req, res) => {
    try {
        const { enabled } = req.body;
        if (enabled === undefined) {
            return res.status(400).json({ message: 'enabled field is required' });
        }
        await db.query(`UPDATE users SET web_notifications = ? WHERE id = ?`, [enabled ? 1 : 0, req.user.id]);
        res.json({
            success: true,
            message: enabled ? 'Web notifications enabled' : 'Web notifications disabled',
            web_notifications: enabled
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle notifications', error: error.message });
    }
};

const getWebNotificationHistory = async (req, res) => {
    try {
        const { limit } = req.query;
        const notifications = await db.query(
            `SELECT * FROM notification_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
            [req.user.id, parseInt(limit) || 50]
        );
        res.json({ success: true, count: notifications.length, notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        await db.query(`UPDATE notification_logs SET is_read = 1 WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to mark notification', error: error.message });
    }
};

const clearAllNotifications = async (req, res) => {
    try {
        await db.query(`DELETE FROM notification_logs WHERE user_id = ?`, [req.user.id]);
        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to clear notifications', error: error.message });
    }
};

module.exports = {
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
};