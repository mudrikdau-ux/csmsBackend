const db = require('../config/db');

const createInquiry = async (data) => {
    const sql = `
        INSERT INTO contact_inquiries (
            full_name, email, phone, service_type, subject, message, subscribe, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'unread')
    `;

    return db.query(sql, [
        data.full_name,
        data.email,
        data.phone,
        data.service_type,
        data.subject,
        data.message,
        data.subscribe ? 1 : 0
    ]);
};

const getInquiryById = async (id) => {
    const sql = `
        SELECT ci.*, 
               u.first_name as replied_by_name, u.last_name as replied_by_lastname
        FROM contact_inquiries ci
        LEFT JOIN users u ON ci.replied_by = u.id
        WHERE ci.id = ?
    `;
    return db.query(sql, [id]);
};

const getAllInquiries = async (filters = {}) => {
    let sql = `SELECT * FROM contact_inquiries WHERE 1=1`;
    const values = [];

    if (filters.status) {
        sql += ` AND status = ?`;
        values.push(filters.status);
    }
    if (filters.service_type) {
        sql += ` AND service_type = ?`;
        values.push(filters.service_type);
    }
    if (filters.search) {
        sql += ` AND (full_name LIKE ? OR email LIKE ? OR subject LIKE ?)`;
        const term = `%${filters.search}%`;
        values.push(term, term, term);
    }
    if (filters.date_from) {
        sql += ` AND created_at >= ?`;
        values.push(filters.date_from);
    }
    if (filters.date_to) {
        sql += ` AND created_at <= ?`;
        values.push(filters.date_to + ' 23:59:59');
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

const updateInquiryStatus = async (id, status) => {
    return db.query(
        `UPDATE contact_inquiries SET status = ? WHERE id = ?`,
        [status, id]
    );
};

const addReply = async (id, replyMessage, repliedBy) => {
    return db.query(
        `UPDATE contact_inquiries SET reply_message = ?, replied_by = ?, status = 'replied', replied_at = NOW() WHERE id = ?`,
        [replyMessage, repliedBy, id]
    );
};

const getInquiryCount = async (filters = {}) => {
    let sql = `SELECT COUNT(*) as count FROM contact_inquiries WHERE 1=1`;
    const values = [];

    if (filters.status) {
        sql += ` AND status = ?`;
        values.push(filters.status);
    }

    return db.query(sql, values);
};

const markAsRead = async (id) => {
    return db.query(
        `UPDATE contact_inquiries SET status = 'read' WHERE id = ? AND status = 'unread'`,
        [id]
    );
};

const deleteInquiry = async (id) => {
    return db.query(`DELETE FROM contact_inquiries WHERE id = ?`, [id]);
};

module.exports = {
    createInquiry,
    getInquiryById,
    getAllInquiries,
    updateInquiryStatus,
    addReply,
    getInquiryCount,
    markAsRead,
    deleteInquiry
};