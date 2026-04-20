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


// ================= FIND USER =================
const findUserByEmail = (email, callback) => {
    db.query(
        'SELECT * FROM users WHERE email = ?',
        [email],
        callback
    );
};


// ================= FIND ADMIN =================
const findAdminByEmail = (email, callback) => {
    db.query(
        'SELECT * FROM users WHERE email = ? AND role = "admin"',
        [email],
        callback
    );
};

const findStaffByEmail = (email, callback) => {
    const sql = `
        SELECT * FROM users 
        WHERE email = ? AND role = 'staff'
    `;

    db.query(sql, [email], callback);
};


// ================= SAVE OTP =================
const saveOTP = (email, otp, expiry, callback) => {
    db.query(
        'UPDATE users SET otp = ?, otp_expiry = ? WHERE email = ?',
        [otp, expiry, email],
        callback
    );
};


// ================= VERIFY OTP (IMPROVED) =================
const verifyOTP = (email, otp, callback) => {
    db.query(
        `SELECT * FROM users 
         WHERE email = ? 
         AND otp = ? 
         AND otp_expiry > NOW()`,
        [email, otp],
        callback
    );
};


// ================= EXPORT =================
module.exports = {
    createUser,
    createGoogleUser,
    findUserByEmail,
    findAdminByEmail,
    findStaffByEmail,
    saveOTP,
    verifyOTP
};