const db = require('../config/db');

// ==================== USER OPERATIONS ====================

const createUser = async (userData) => {
    const sql = `
        INSERT INTO users 
        (first_name, last_name, email, password, address, gender, role, provider)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        userData.first_name,
        userData.last_name,
        userData.email,
        userData.password,
        userData.address,
        userData.gender,
        userData.role || 'user',
        'local'
    ]);
};

const createGoogleUser = async (userData) => {
    const sql = `
        INSERT INTO users 
        (first_name, last_name, email, password, address, gender, role, provider)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        userData.first_name,
        userData.last_name,
        userData.email,
        null,
        userData.address || '',
        userData.gender || 'Male',
        'user',
        'google'
    ]);
};

// ==================== STAFF OPERATIONS ====================

const createStaff = async (data) => {
    const sql = `
        INSERT INTO users 
        (first_name, last_name, email, password, phone, photo, role, staff_type)
        VALUES (?, ?, ?, ?, ?, ?, 'staff', ?)
    `;

    return db.query(sql, [
        data.first_name,
        data.last_name,
        data.email,
        data.password,
        data.phone,
        data.photo,
        data.staff_type || 'normal'
    ]);
};

const getAllStaff = async () => {
    return db.query(`SELECT * FROM users WHERE role = 'staff'`);
};

const getStaffById = async (id) => {
    return db.query(`SELECT * FROM users WHERE id = ? AND role = 'staff'`, [id]);
};

const updateStaff = async (id, data) => {
    const sql = `
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, password = ?, 
            phone = ?, photo = ?, staff_type = ?
        WHERE id = ? AND role = 'staff'
    `;

    return db.query(sql, [
        data.first_name,
        data.last_name,
        data.email,
        data.password,
        data.phone,
        data.photo,
        data.staff_type,
        id
    ]);
};

const deleteStaff = async (id) => {
    return db.query(`DELETE FROM users WHERE id = ? AND role = 'staff'`, [id]);
};

// ==================== FIND OPERATIONS ====================

const findUserByEmail = async (email) => {
    return db.query(`SELECT * FROM users WHERE email = ?`, [email]);
};

const findAdminByEmail = async (email) => {
    return db.query(`SELECT * FROM users WHERE email = ? AND role = 'admin'`, [email]);
};

const findStaffByEmail = async (email) => {
    return db.query(`SELECT * FROM users WHERE email = ? AND role = 'staff'`, [email]);
};

// ==================== OTP OPERATIONS ====================

const saveOTP = async (email, otp, expiry) => {
    return db.query(
        `UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?`,
        [otp, expiry, email]
    );
};

const verifyOTP = async (email, otp) => {
    return db.query(
        `SELECT * FROM users WHERE email = ? AND otp = ? AND otp_expiry > NOW()`,
        [email, otp]
    );
};

const clearOTP = async (email) => {
    return db.query(
        `UPDATE users SET otp = NULL, otp_expiry = NULL WHERE email = ?`,
        [email]
    );
};

// ==================== LOGOUT ====================

const blacklistToken = async (token, userId, expiresAt) => {
    const sql = `
        INSERT INTO token_blacklist (token, user_id, expires_at)
        VALUES (?, ?, ?)
    `;
    return db.query(sql, [token, userId, expiresAt]);
};

const isTokenBlacklisted = async (token) => {
    const result = await db.query(
        `SELECT id FROM token_blacklist WHERE token = ? AND expires_at > NOW()`,
        [token]
    );
    return result.length > 0;
};

// ==================== DELETE ACCOUNT ====================

const deleteUserAccount = async (userId) => {
    const user = await db.query(`SELECT * FROM users WHERE id = ?`, [userId]);
    
    if (user.length > 0) {
        const u = user[0];
        await db.query(
            `INSERT INTO deleted_users (user_id, first_name, last_name, email, role, provider, deleted_reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [u.id, u.first_name, u.last_name, u.email, u.role, u.provider || 'local', 'User requested account deletion']
        );
    }

    await db.query(`DELETE FROM feedbacks WHERE user_id = ?`, [userId]);
    await db.query(`UPDATE users SET otp = NULL, otp_expiry = NULL WHERE id = ?`, [userId]);
    await db.query(`DELETE FROM token_blacklist WHERE user_id = ?`, [userId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    
    return true;
};

// ==================== EMAIL NOTIFICATION PREFERENCES ====================

const getEmailNotificationPreference = async (userId) => {
    const sql = `
        SELECT email_notifications, email, first_name
        FROM users WHERE id = ?
    `;
    return db.query(sql, [userId]);
};

const toggleEmailNotifications = async (userId, enabled) => {
    return db.query(
        `UPDATE users SET email_notifications = ? WHERE id = ?`,
        [enabled ? 1 : 0, userId]
    );
};

// ==================== NOTIFICATION LOGS ====================

const logNotification = async (data) => {
    const sql = `
        INSERT INTO notification_logs (
            user_id, notification_type, subject, message, sent_to, status
        ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.user_id,
        data.notification_type,
        data.subject,
        data.message,
        data.sent_to,
        data.status || 'sent'
    ]);
};

const getUserNotificationHistory = async (userId, limit = 20) => {
    return db.query(
        `SELECT * FROM notification_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        [userId, limit]
    );
};


// ==================== PROFILE OPERATIONS ====================

const updateUserPassword = async (userId, hashedPassword) => {
    return db.query(
        `UPDATE users SET password = ? WHERE id = ?`,
        [hashedPassword, userId]
    );
};

const updateUserProfile = async (userId, data) => {
    const sql = `
        UPDATE users SET
            first_name = ?,
            last_name = ?,
            address = ?,
            gender = ?,
            phone = ?
        WHERE id = ?
    `;

    return db.query(sql, [
        data.first_name,
        data.last_name,
        data.address,
        data.gender,
        data.phone || null,
        userId
    ]);
};

const getUserById = async (userId) => {
    return db.query(
        `SELECT id, first_name, last_name, email, address, gender, phone, role, provider, created_at 
         FROM users WHERE id = ?`,
        [userId]
    );
};

module.exports = {
    createUser,
    createGoogleUser,
    createStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    deleteStaff,
    findUserByEmail,
    findAdminByEmail,
    findStaffByEmail,
    saveOTP,
    verifyOTP,
    clearOTP,
    blacklistToken,
    isTokenBlacklisted,
    deleteUserAccount,
    getEmailNotificationPreference,
    toggleEmailNotifications,
    logNotification,
    getUserNotificationHistory,
    updateUserPassword,
    updateUserProfile,
    getUserById
};