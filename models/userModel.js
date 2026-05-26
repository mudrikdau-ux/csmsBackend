const db = require('../config/db');
const pool = require('../config/db').pool;

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


// ==================== STAFF PERFORMANCE STATS ====================

const getStaffPerformanceStats = async (staffId) => {
    const sql = `
        SELECT 
            COUNT(*) as total_jobs,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_jobs,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_jobs
        FROM bookings
        WHERE assigned_staff_id = ?
    `;
    return db.query(sql, [staffId]);
};

const getStaffEarnings = async (staffId) => {
    // Staff earns 2% of paid amount per completed job
    const sql = `
        SELECT 
            SUM(CASE WHEN payment_status = 'paid' AND status = 'completed' THEN total_price * 0.02 ELSE 0 END) as total_earnings,
            SUM(CASE WHEN payment_status = 'paid' AND status = 'completed' AND DATE(created_at) = CURDATE() THEN total_price * 0.02 ELSE 0 END) as today_earnings
        FROM bookings
        WHERE assigned_staff_id = ? AND status = 'completed'
    `;
    return db.query(sql, [staffId]);
};

const getStaffCompletionRate = async (staffId) => {
    const sql = `
        SELECT 
            ROUND(
                (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / 
                 NULLIF(SUM(CASE WHEN status IN ('completed', 'cancelled', 'in_progress', 'pending') THEN 1 ELSE 0 END), 0)) * 100, 1
            ) as completion_rate
        FROM bookings
        WHERE assigned_staff_id = ?
    `;
    return db.query(sql, [staffId]);
};

// ==================== STAFF CASH PAYMENT VALIDATION ====================

const getCashPaymentBookings = async (staffId) => {
    const sql = `
        SELECT 
            b.id,
            b.first_name,
            b.last_name,
            b.email,
            b.phone,
            b.address,
            b.city,
            b.service_date,
            b.service_time,
            b.total_price,
            b.status,
            b.payment_status,
            s.name as service_name,
            s.duration,
            b.created_at
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.assigned_staff_id = ? 
        AND b.payment_method = 'cash'
        AND b.payment_status = 'unpaid'
        AND b.status NOT IN ('cancelled', 'completed')
        ORDER BY b.service_date ASC, b.service_time ASC
    `;
    return db.query(sql, [staffId]);
};

const validateCashPayment = async (bookingId, staffId, amountReceived, paymentNote) => {
    // Get a connection from the pool using promise
    const connection = await new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) reject(err);
            else resolve(connection);
        });
    });
    
    try {
        await new Promise((resolve, reject) => {
            connection.beginTransaction((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Get booking details
        const booking = await new Promise((resolve, reject) => {
            connection.query(
                `SELECT total_price, payment_status, user_id, first_name, last_name, email, phone, service_id 
                 FROM bookings WHERE id = ? AND assigned_staff_id = ?`,
                [bookingId, staffId],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
        
        if (!booking || booking.length === 0) {
            throw new Error('Booking not found or not assigned to you');
        }
        
        if (booking[0].payment_status === 'paid') {
            throw new Error('Payment already validated for this booking');
        }
        
        const amountReceivedNum = parseFloat(amountReceived);
        const totalPrice = parseFloat(booking[0].total_price);
        
        if (amountReceivedNum < totalPrice) {
            throw new Error(`Amount received (${amountReceivedNum}) is less than total price (${totalPrice})`);
        }
        
        const changeAmount = amountReceivedNum - totalPrice;
        
        // Generate receipt number
        const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Create cash payment record
        await new Promise((resolve, reject) => {
            connection.query(
                `INSERT INTO cash_payments (
                    booking_id, staff_id, amount_received, change_amount, payment_note, receipt_number, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [bookingId, staffId, amountReceivedNum, changeAmount, paymentNote || null, receiptNumber, booking[0].user_id],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
        
        // Update booking payment status
        await new Promise((resolve, reject) => {
            connection.query(
                `UPDATE bookings SET payment_status = 'paid' WHERE id = ?`,
                [bookingId],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
        
        await new Promise((resolve, reject) => {
            connection.commit((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        return { receiptNumber, changeAmount };
        
    } catch (error) {
        await new Promise((resolve) => {
            connection.rollback(() => resolve());
        });
        throw error;
    } finally {
        connection.release();
    }
};

const getStaffCashPaymentStats = async (staffId) => {
    const sql = `
        SELECT 
            COUNT(*) as total_validated,
            SUM(amount_received) as total_received,
            COUNT(*) * 5000 as total_revenue,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_validated,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN amount_received ELSE 0 END) as today_received,
            SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 5000 ELSE 0 END) as today_revenue
        FROM cash_payments
        WHERE staff_id = ?
    `;
    return db.query(sql, [staffId]);
};

const getStaffCashPaymentHistory = async (staffId, limit = 50) => {
    const sql = `
        SELECT 
            cp.*,
            b.first_name,
            b.last_name,
            b.email,
            b.phone,
            b.service_date,
            b.total_price as booking_total,
            s.name as service_name
        FROM cash_payments cp
        LEFT JOIN bookings b ON cp.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE cp.staff_id = ?
        ORDER BY cp.created_at DESC
        LIMIT ?
    `;
    return db.query(sql, [staffId, limit]);
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

// ==================== OTP OPERATIONS (Login OTP) ====================

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

// ==================== PASSWORD RESET OTP OPERATIONS ====================

const savePasswordResetOTP = async (email, otp, expiry) => {
    return db.query(
        `UPDATE users SET reset_otp = ?, reset_otp_expiry = ? WHERE email = ?`,
        [otp, expiry, email]
    );
};

const verifyPasswordResetOTP = async (email, otp) => {
    return db.query(
        `SELECT * FROM users WHERE email = ? AND reset_otp = ? AND reset_otp_expiry > NOW()`,
        [email, otp]
    );
};

const clearPasswordResetOTP = async (email) => {
    return db.query(
        `UPDATE users SET reset_otp = NULL, reset_otp_expiry = NULL WHERE email = ?`,
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
    await db.query(`UPDATE users SET otp = NULL, otp_expiry = NULL, reset_otp = NULL, reset_otp_expiry = NULL WHERE id = ?`, [userId]);
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
        `SELECT id, first_name, last_name, email, password, address, gender, phone, role, provider, profile_photo, email_notifications, web_notifications, created_at 
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
    getStaffPerformanceStats,
    getStaffEarnings,
    getStaffCompletionRate,
    getCashPaymentBookings,
    validateCashPayment,
    getStaffCashPaymentStats,
    getStaffCashPaymentHistory,
    findUserByEmail,
    findAdminByEmail,
    findStaffByEmail,
    saveOTP,
    verifyOTP,
    clearOTP,
    savePasswordResetOTP,
    verifyPasswordResetOTP,
    clearPasswordResetOTP,
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