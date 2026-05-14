const db = require('../config/db');

// ==================== PAYMENT CRUD ====================

const createPayment = async (data) => {
    const sql = `
        INSERT INTO payments (
            user_id, booking_id, payment_number, transaction_id,
            reference, amount, payment_method, payment_status,
            payment_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.user_id,
        data.booking_id || null,
        data.payment_number,
        data.transaction_id || null,
        data.reference || null,
        data.amount,
        data.payment_method || 'cash',
        data.payment_status || 'completed',
        data.payment_date,
        data.notes || null
    ]);
};

const getPaymentById = async (id) => {
    const sql = `
        SELECT p.*, 
               u.first_name, u.last_name, u.email as user_email, u.phone as user_phone,
               b.service_id, b.service_date, b.total_price as booking_total,
               s.name as service_name
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN bookings b ON p.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE p.id = ?
    `;
    return db.query(sql, [id]);
};

const getPaymentsByUserId = async (userId, filters = {}) => {
    let sql = `
        SELECT p.*, 
               b.service_id, b.service_date, b.total_price as booking_total,
               s.name as service_name
        FROM payments p
        LEFT JOIN bookings b ON p.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE p.user_id = ?
    `;
    const values = [userId];

    if (filters.payment_status) {
        sql += ` AND p.payment_status = ?`;
        values.push(filters.payment_status);
    }
    if (filters.payment_method) {
        sql += ` AND p.payment_method = ?`;
        values.push(filters.payment_method);
    }
    if (filters.date_from) {
        sql += ` AND p.payment_date >= ?`;
        values.push(filters.date_from);
    }
    if (filters.date_to) {
        sql += ` AND p.payment_date <= ?`;
        values.push(filters.date_to);
    }

    sql += ` ORDER BY p.created_at DESC`;

    if (filters.limit) {
        sql += ` LIMIT ?`;
        values.push(parseInt(filters.limit));
    }
    if (filters.offset) {
        sql += ` OFFSET ?`;
        values.push(parseInt(filters.offset));
    }

    return db.query(sql, values);
};

const getUserOutstandingBalance = async (userId) => {
    const sql = `
        SELECT 
            COALESCE(SUM(b.total_price), 0) as total_due,
            COALESCE(SUM(p.amount), 0) as total_paid,
            COALESCE(SUM(b.total_price), 0) - COALESCE(SUM(p.amount), 0) as outstanding_balance,
            COUNT(DISTINCT b.id) as total_bookings,
            COUNT(DISTINCT p.id) as total_payments
        FROM bookings b
        LEFT JOIN payments p ON b.id = p.booking_id AND p.payment_status = 'completed'
        WHERE b.user_id = ? 
        AND b.status != 'cancelled'
        AND b.payment_status != 'paid'
    `;
    return db.query(sql, [userId]);
};

const getUserPaymentStats = async (userId) => {
    const sql = `
        SELECT 
            COUNT(*) as total_payments,
            COALESCE(SUM(amount), 0) as total_amount_paid,
            COALESCE(AVG(amount), 0) as average_payment,
            MAX(amount) as largest_payment,
            MIN(amount) as smallest_payment,
            COUNT(DISTINCT DATE(payment_date)) as payment_days
        FROM payments
        WHERE user_id = ? AND payment_status = 'completed'
    `;
    return db.query(sql, [userId]);
};

const generatePaymentNumber = async () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const result = await db.query(
        `SELECT COUNT(*) as count FROM payments WHERE payment_number LIKE ?`,
        [`PAY-${year}${month}%`]
    );
    
    const count = result[0].count + 1;
    return `PAY-${year}${month}-${String(count).padStart(4, '0')}`;
};

const updateBookingPaymentStatus = async (bookingId, status) => {
    return db.query(
        `UPDATE bookings SET payment_status = ? WHERE id = ?`,
        [status, bookingId]
    );
};

const getUnpaidBookings = async (userId) => {
    const sql = `
        SELECT id, service_id, total_price, service_date, status, payment_status
        FROM bookings
        WHERE user_id = ? 
        AND status != 'cancelled'
        AND payment_status IN ('unpaid', 'partial')
        ORDER BY service_date ASC
    `;
    return db.query(sql, [userId]);
};

module.exports = {
    createPayment,
    getPaymentById,
    getPaymentsByUserId,
    getUserOutstandingBalance,
    getUserPaymentStats,
    generatePaymentNumber,
    updateBookingPaymentStatus,
    getUnpaidBookings
};