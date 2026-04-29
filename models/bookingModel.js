const db = require('../config/db');

const createBooking = async (data) => {
    const sql = `
        INSERT INTO bookings (
            user_id, service_id,
            cleaners, hours, frequency, materials,
            property_type,
            address, city, landmark, latitude, longitude,
            service_date, service_time, instructions,
            first_name, last_name, email, phone,
            payment_method,
            base_price, extras, discount, total_price,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.user_id,
        data.service_id,
        data.cleaners,
        data.hours,
        data.frequency,
        data.materials || false,
        data.property_type,
        data.address,
        data.city,
        data.landmark || null,
        data.latitude || null,
        data.longitude || null,
        data.service_date,
        data.service_time,
        data.instructions || null,
        data.first_name,
        data.last_name,
        data.email,
        data.phone,
        data.payment_method,
        data.base_price,
        data.extras,
        data.discount,
        data.total_price,
        data.status || 'pending'
    ]);
};

const getBookingById = async (id) => {
    return db.query(`SELECT * FROM bookings WHERE id = ?`, [id]);
};

const getAllBookings = async (filters = {}) => {
    let sql = `SELECT * FROM bookings WHERE 1=1`;
    const values = [];

    if (filters.user_id) {
        sql += ` AND user_id = ?`;
        values.push(filters.user_id);
    }
    if (filters.status) {
        sql += ` AND status = ?`;
        values.push(filters.status);
    }
    if (filters.date_from) {
        sql += ` AND service_date >= ?`;
        values.push(filters.date_from);
    }
    if (filters.date_to) {
        sql += ` AND service_date <= ?`;
        values.push(filters.date_to);
    }

    sql += ` ORDER BY created_at DESC`;

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

// ✅ NEW: Get bookings by user ID with optional filters
const getBookingsByUserId = async (userId, filters = {}) => {
    let sql = `SELECT * FROM bookings WHERE user_id = ?`;
    const values = [userId];

    if (filters.status) {
        sql += ` AND status = ?`;
        values.push(filters.status);
    }
    if (filters.service_id) {
        sql += ` AND service_id = ?`;
        values.push(filters.service_id);
    }
    if (filters.service_date) {
        sql += ` AND service_date = ?`;
        values.push(filters.service_date);
    }
    if (filters.date_from) {
        sql += ` AND service_date >= ?`;
        values.push(filters.date_from);
    }
    if (filters.date_to) {
        sql += ` AND service_date <= ?`;
        values.push(filters.date_to);
    }

    sql += ` ORDER BY created_at DESC`;

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

const updateBookingStatus = async (id, status) => {
    return db.query(
        `UPDATE bookings SET status = ? WHERE id = ?`,
        [status, id]
    );
};

const assignStaffToBooking = async (bookingId, staffId) => {
    return db.query(
        `UPDATE bookings SET assigned_staff_id = ? WHERE id = ?`,
        [staffId, bookingId]
    );
};

const getBookingCount = async (filters = {}) => {
    let sql = `SELECT COUNT(*) as count FROM bookings WHERE 1=1`;
    const values = [];

    if (filters.status) {
        sql += ` AND status = ?`;
        values.push(filters.status);
    }
    if (filters.user_id) {
        sql += ` AND user_id = ?`;
        values.push(filters.user_id);
    }

    return db.query(sql, values);
};

module.exports = {
    createBooking,
    getBookingById,
    getAllBookings,
    getBookingsByUserId,  // ✅ NEW
    updateBookingStatus,
    assignStaffToBooking,
    getBookingCount
};