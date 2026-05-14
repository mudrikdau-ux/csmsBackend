const db = require('../config/db');

// ==================== FEEDBACK CRUD ====================

const createFeedback = async (data) => {
    const sql = `
        INSERT INTO feedbacks (
            user_id,
            booking_id,
            rating,
            rating_value,
            feedback_text,
            is_public
        ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.user_id,
        data.booking_id || null,
        data.rating,
        data.rating_value,
        data.feedback_text,
        data.is_public !== undefined ? data.is_public : 1
    ]);
};

const getFeedbackById = async (id) => {
    const sql = `
        SELECT 
            f.*,
            u.first_name,
            u.last_name,
            u.email as user_email,
            u.gender,
            b.service_id,
            b.service_date,
            s.name as service_name
        FROM feedbacks f
        LEFT JOIN users u ON f.user_id = u.id
        LEFT JOIN bookings b ON f.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE f.id = ?
    `;
    return db.query(sql, [id]);
};

const getAllFeedbacks = async (filters = {}) => {
    let sql = `
        SELECT 
            f.*,
            u.first_name,
            u.last_name,
            u.gender,
            b.service_id,
            b.service_date,
            s.name as service_name
        FROM feedbacks f
        LEFT JOIN users u ON f.user_id = u.id
        LEFT JOIN bookings b ON f.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE f.is_public = 1
    `;
    const values = [];

    if (filters.rating) {
        sql += ` AND f.rating = ?`;
        values.push(filters.rating);
    }
    if (filters.user_id) {
        sql += ` AND f.user_id = ?`;
        values.push(filters.user_id);
    }
    if (filters.booking_id) {
        sql += ` AND f.booking_id = ?`;
        values.push(filters.booking_id);
    }
    if (filters.date_from) {
        sql += ` AND f.created_at >= ?`;
        values.push(filters.date_from);
    }
    if (filters.date_to) {
        sql += ` AND f.created_at <= ?`;
        values.push(filters.date_to + ' 23:59:59');
    }

    sql += ` ORDER BY f.created_at DESC`;

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

const getFeedbacksByUserId = async (userId) => {
    const sql = `
        SELECT 
            f.*,
            b.service_id,
            s.name as service_name
        FROM feedbacks f
        LEFT JOIN bookings b ON f.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
    `;
    return db.query(sql, [userId]);
};

const updateFeedback = async (id, data) => {
    const sql = `
        UPDATE feedbacks SET
            rating = ?,
            rating_value = ?,
            feedback_text = ?,
            is_public = ?
        WHERE id = ?
    `;

    return db.query(sql, [
        data.rating,
        data.rating_value,
        data.feedback_text,
        data.is_public,
        id
    ]);
};

const deleteFeedback = async (id) => {
    return db.query(`DELETE FROM feedbacks WHERE id = ?`, [id]);
};

const getFeedbackStats = async () => {
    const sql = `
        SELECT 
            COUNT(*) as total_feedbacks,
            AVG(rating_value) as average_rating,
            SUM(CASE WHEN rating = 'very_happy' THEN 1 ELSE 0 END) as very_happy_count,
            SUM(CASE WHEN rating = 'happy' THEN 1 ELSE 0 END) as happy_count,
            SUM(CASE WHEN rating = 'neutral' THEN 1 ELSE 0 END) as neutral_count,
            SUM(CASE WHEN rating = 'sad' THEN 1 ELSE 0 END) as sad_count,
            SUM(CASE WHEN rating = 'very_sad' THEN 1 ELSE 0 END) as very_sad_count
        FROM feedbacks
        WHERE is_public = 1
    `;
    return db.query(sql);
};

const getRecentFeedbacks = async (limit = 10) => {
    const sql = `
        SELECT 
            f.*,
            u.first_name,
            u.last_name,
            u.gender,
            s.name as service_name
        FROM feedbacks f
        LEFT JOIN users u ON f.user_id = u.id
        LEFT JOIN bookings b ON f.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE f.is_public = 1
        ORDER BY f.created_at DESC
        LIMIT ?
    `;
    return db.query(sql, [limit]);
};

module.exports = {
    createFeedback,
    getFeedbackById,
    getAllFeedbacks,
    getFeedbacksByUserId,
    updateFeedback,
    deleteFeedback,
    getFeedbackStats,
    getRecentFeedbacks
};