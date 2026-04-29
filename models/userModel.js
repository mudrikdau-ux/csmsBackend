const db = require('../config/db');

// ================= CREATE USER =================
const createUser = (userData, callback) => {
    const sql = `
        INSERT INTO users 
        (first_name, last_name, email, password, address, gender, role, provider)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        userData.first_name,
        userData.last_name,
        userData.email,
        userData.password,
        userData.address,
        userData.gender,
        userData.role || 'user',
        'local'
    ], callback);
};


// ================= GOOGLE USER =================
const createGoogleUser = (userData, callback) => {
    const sql = `
        INSERT INTO users 
        (first_name, last_name, email, password, address, gender, role, provider)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        userData.first_name,
        userData.last_name,
        userData.email,
        null,
        userData.address || '',
        userData.gender || 'Male',
        'user',
        'google'
    ], callback);
};


// ================= STAFF CRUD =================
const createStaff = (data, callback) => {
    const sql = `
        INSERT INTO users 
        (first_name, last_name, email, password, phone, photo, role, staff_type)
        VALUES (?, ?, ?, ?, ?, ?, 'staff', ?)
    `;

    db.query(sql, [
        data.first_name,
        data.last_name,
        data.email,
        data.password,
        data.phone,
        data.photo,
        data.staff_type || 'normal'
    ], callback);
};

const getAllStaff = (callback) => {
    db.query(`SELECT * FROM users WHERE role='staff'`, callback);
};

const getStaffById = (id, callback) => {
    db.query(`SELECT * FROM users WHERE id=? AND role='staff'`, [id], callback);
};

const updateStaff = (id, data, callback) => {
    const sql = `
        UPDATE users 
        SET first_name=?, last_name=?, email=?, password=?, phone=?, photo=?, staff_type=?
        WHERE id=? AND role='staff'
    `;

    db.query(sql, [
        data.first_name,
        data.last_name,
        data.email,
        data.password,
        data.phone,
        data.photo,
        data.staff_type,
        id
    ], callback);
};

const deleteStaff = (id, callback) => {
    db.query(`DELETE FROM users WHERE id=? AND role='staff'`, [id], callback);
};


// ================= FIND USERS =================
const findUserByEmail = (email, callback) => {
    db.query(`SELECT * FROM users WHERE email = ?`, [email], callback);
};

const findAdminByEmail = (email, callback) => {
    db.query(
        `SELECT * FROM users WHERE email=? AND role='admin'`,
        [email],
        callback
    );
};

const findStaffByEmail = (email, callback) => {
    db.query(
        `SELECT * FROM users WHERE email=? AND role='staff'`,
        [email],
        callback
    );
};


// ================= OTP =================
const saveOTP = (email, otp, expiry, callback) => {
    db.query(
        `UPDATE users SET otp=?, otp_expiry=? WHERE email=?`,
        [otp, expiry, email],
        callback
    );
};

const verifyOTP = (email, otp, callback) => {
    db.query(
        `SELECT * FROM users 
         WHERE email=? AND otp=? AND otp_expiry > NOW()`,
        [email, otp],
        callback
    );
};


// ================= EXPORT =================
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
    verifyOTP
};