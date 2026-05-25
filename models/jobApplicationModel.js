const db = require('../config/db');

// ==================== APPLICATION CRUD ====================

const generateReferenceNumber = async () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const result = await db.query(
        `SELECT COUNT(*) as count FROM job_applications WHERE reference_number LIKE ?`,
        [`CS-JOB-${year}${month}%`]
    );
    
    const count = result[0].count + 1;
    return `CS-JOB-${year}${month}-${String(count).padStart(4, '0')}`;
};

const createApplication = async (data) => {
    const referenceNumber = await generateReferenceNumber();
    
    const sql = `
        INSERT INTO job_applications (
            reference_number, user_id, full_name, address, age, gender, phone, email,
            education_level, experience_years, skills, position_applying,
            availability, additional_notes,
            cv_file, national_id_file, introduction_letter_file, passport_photo_file,
            application_letter_file, certificate_file, other_docs_file,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.query(sql, [
        referenceNumber,
        data.user_id || null,
        data.full_name,
        data.address,
        data.age,
        data.gender,
        data.phone,
        data.email,
        data.education_level,
        data.experience_years,
        data.skills,
        data.position_applying,
        data.availability,
        data.additional_notes || null,
        data.cv_file,
        data.national_id_file,
        data.introduction_letter_file,
        data.passport_photo_file,
        data.application_letter_file || null,
        data.certificate_file || null,
        data.other_docs_file || null,
        'pending'
    ]);

    return { insertId: result.insertId, referenceNumber };
};

const getApplicationById = async (id) => {
    const sql = `
        SELECT ja.*, 
               u.first_name as reviewed_by_name, u.last_name as reviewed_by_lastname
        FROM job_applications ja
        LEFT JOIN users u ON ja.reviewed_by = u.id
        WHERE ja.id = ?
    `;
    return db.query(sql, [id]);
};

const getApplicationByReference = async (referenceNumber) => {
    const sql = `
        SELECT ja.*, 
               u.first_name as reviewed_by_name, u.last_name as reviewed_by_lastname
        FROM job_applications ja
        LEFT JOIN users u ON ja.reviewed_by = u.id
        WHERE ja.reference_number = ?
    `;
    return db.query(sql, [referenceNumber]);
};

const getAllApplications = async (filters = {}) => {
    let sql = `SELECT * FROM job_applications WHERE 1=1`;
    const values = [];

    if (filters.status) { sql += ` AND status = ?`; values.push(filters.status); }
    if (filters.position) { sql += ` AND position_applying LIKE ?`; values.push(`%${filters.position}%`); }
    if (filters.education) { sql += ` AND education_level = ?`; values.push(filters.education); }
    if (filters.search) {
        sql += ` AND (full_name LIKE ? OR email LIKE ? OR reference_number LIKE ? OR position_applying LIKE ?)`;
        const term = `%${filters.search}%`;
        values.push(term, term, term, term);
    }
    if (filters.date_from) { sql += ` AND created_at >= ?`; values.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND created_at <= ?`; values.push(filters.date_to + ' 23:59:59'); }

    sql += ` ORDER BY created_at DESC`;

    if (filters.limit) { sql += ` LIMIT ?`; values.push(parseInt(filters.limit)); }
    if (filters.offset) { sql += ` OFFSET ?`; values.push(parseInt(filters.offset)); }

    return db.query(sql, values);
};

const getUserApplications = async (userId) => {
    return db.query(`SELECT * FROM job_applications WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
};

const updateApplicationStatus = async (id, status, reviewedBy, reviewNotes) => {
    return db.query(
        `UPDATE job_applications SET status = ?, reviewed_by = ?, review_notes = ?, reviewed_at = NOW() WHERE id = ?`,
        [status, reviewedBy, reviewNotes || null, id]
    );
};

const deleteApplication = async (id) => {
    return db.query(`DELETE FROM job_applications WHERE id = ?`, [id]);
};

const getApplicationCount = async (filters = {}) => {
    let sql = `SELECT COUNT(*) as count FROM job_applications WHERE 1=1`;
    const values = [];
    if (filters.status) { sql += ` AND status = ?`; values.push(filters.status); }
    return db.query(sql, values);
};

// ==================== SETTINGS ====================

const getApplicationSettings = async () => {
    return db.query(`SELECT * FROM job_application_settings WHERE id = 1`);
};

const updateApplicationSettings = async (data) => {
    const updates = [];
    const values = [];
    
    if (data.is_open !== undefined) { updates.push('is_open = ?'); values.push(data.is_open ? 1 : 0); }
    if (data.application_deadline !== undefined) { updates.push('application_deadline = ?'); values.push(data.application_deadline); }
    if (data.positions_available !== undefined) { updates.push('positions_available = ?'); values.push(data.positions_available); }
    if (data.min_age !== undefined) { updates.push('min_age = ?'); values.push(data.min_age); }
    if (data.max_age !== undefined) { updates.push('max_age = ?'); values.push(data.max_age); }
    if (data.updated_by !== undefined) { updates.push('updated_by = ?'); values.push(data.updated_by); }

    if (updates.length === 0) return null;

    values.push(1);
    return db.query(`UPDATE job_application_settings SET ${updates.join(', ')} WHERE id = ?`, values);
};

module.exports = {
    createApplication,
    getApplicationById,
    getApplicationByReference,
    getAllApplications,
    getUserApplications,
    updateApplicationStatus,
    deleteApplication,
    getApplicationCount,
    getApplicationSettings,
    updateApplicationSettings
};