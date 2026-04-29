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
    clearOTP
};