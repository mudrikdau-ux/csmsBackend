const db = require('../config/db');

// ==================== CREATE ISSUE ====================

const createIssue = async (data) => {
    const sql = `
        INSERT INTO staff_issues (
            staff_id, booking_id, issue_type, issue_title, 
            issue_description, expected_return_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    return db.query(sql, [
        data.staff_id,
        data.booking_id || null,
        data.issue_type,
        data.issue_title,
        data.issue_description,
        data.expected_return_date
    ]);
};

// ==================== GET ISSUES BY STAFF ====================

const getIssuesByStaffId = async (staffId, filters = {}) => {
    let sql = `
        SELECT 
            si.*,
            b.id as booking_id,
            b.service_date,
            b.service_time,
            b.address,
            b.city,
            b.total_price,
            s.name as service_name,
            CONCAT(b.first_name, ' ', b.last_name) as customer_name
        FROM staff_issues si
        LEFT JOIN bookings b ON si.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE si.staff_id = ?
    `;
    const values = [staffId];

    if (filters.status) {
        sql += ` AND si.status = ?`;
        values.push(filters.status);
    }

    sql += ` ORDER BY si.created_at DESC`;

    if (filters.limit) {
        sql += ` LIMIT ?`;
        values.push(parseInt(filters.limit));
    }

    return db.query(sql, values);
};

// ==================== GET SINGLE ISSUE ====================

const getIssueById = async (issueId) => {
    const sql = `
        SELECT 
            si.*,
            b.id as booking_id,
            b.service_date,
            b.service_time,
            b.address,
            b.city,
            b.landmark,
            b.total_price,
            b.status as booking_status,
            s.name as service_name,
            s.price as service_price,
            s.duration as service_duration,
            CONCAT(b.first_name, ' ', b.last_name) as customer_name,
            b.email as customer_email,
            b.phone as customer_phone,
            st.first_name as staff_first_name,
            st.last_name as staff_last_name,
            st.email as staff_email,
            st.phone as staff_phone,
            st.photo as staff_photo
        FROM staff_issues si
        LEFT JOIN bookings b ON si.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN users st ON si.staff_id = st.id
        WHERE si.id = ?
    `;
    return db.query(sql, [issueId]);
};

// ==================== GET ALL ISSUES (ADMIN) ====================

const getAllIssues = async (filters = {}) => {
    let sql = `
        SELECT 
            si.*,
            b.id as booking_id,
            b.service_date,
            b.service_time,
            b.address,
            b.city,
            b.total_price,
            b.status as booking_status,
            s.name as service_name,
            CONCAT(b.first_name, ' ', b.last_name) as customer_name,
            st.first_name as staff_first_name,
            st.last_name as staff_last_name,
            st.email as staff_email,
            st.phone as staff_phone,
            st.photo as staff_photo
        FROM staff_issues si
        LEFT JOIN bookings b ON si.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN users st ON si.staff_id = st.id
        WHERE 1=1
    `;
    const values = [];

    if (filters.status) {
        sql += ` AND si.status = ?`;
        values.push(filters.status);
    }

    if (filters.staff_id) {
        sql += ` AND si.staff_id = ?`;
        values.push(filters.staff_id);
    }

    if (filters.date_from) {
        sql += ` AND si.created_at >= ?`;
        values.push(filters.date_from);
    }

    if (filters.date_to) {
        sql += ` AND si.created_at <= ?`;
        values.push(filters.date_to + ' 23:59:59');
    }

    sql += ` ORDER BY 
        CASE si.status 
            WHEN 'pending' THEN 1 
            WHEN 'reviewed' THEN 2 
            WHEN 'resolved' THEN 3 
            WHEN 'rejected' THEN 4 
        END, 
        si.created_at DESC`;

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

// ==================== UPDATE ISSUE STATUS (ADMIN) ====================

const updateIssueStatus = async (issueId, status, adminResponse = null) => {
    let sql = `UPDATE staff_issues SET status = ?`;
    const values = [status];

    if (adminResponse) {
        sql += `, admin_response = ?`;
        values.push(adminResponse);
    }

    if (status === 'resolved') {
        sql += `, resolved_at = NOW()`;
    }

    sql += ` WHERE id = ?`;
    values.push(issueId);

    return db.query(sql, values);
};

// ==================== GET ISSUE STATS ====================

const getIssueStats = async () => {
    const sql = `
        SELECT 
            COUNT(*) as total_issues,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
            SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed_count,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
            COUNT(DISTINCT staff_id) as staff_with_issues
        FROM staff_issues
    `;
    return db.query(sql);
};

// ==================== DELETE ISSUE ====================

const deleteIssue = async (issueId) => {
    return db.query(`DELETE FROM staff_issues WHERE id = ?`, [issueId]);
};

module.exports = {
    createIssue,
    getIssuesByStaffId,
    getIssueById,
    getAllIssues,
    updateIssueStatus,
    getIssueStats,
    deleteIssue
};