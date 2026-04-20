const db = require('../config/db');

// ================= CREATE USER =================
const createUser = (userData, callback) => {
    const sql = `
        INSERT INTO users (first_name, last_name, email, password, address, gender)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        userData.first_name,
        userData.last_name,
        userData.email,
        userData.password,
        userData.address,
        userData.gender
    ], callback);
};

const createGoogleUser = (userData, callback) => {
    const sql = `
        INSERT INTO users (first_name, last_name, email, password, address, gender, provider)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        userData.first_name,
        userData.last_name,
        userData.email,
        null,
        userData.address || '',
        userData.gender || 'Male',
        'google'
    ], callback);
};

// ================= FIND USER =================
const findUserByEmail = (email, callback) => {
    const sql = `SELECT * FROM users WHERE email = ?`;
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

// ================= VERIFY OTP =================
const verifyOTP = (email, otp, callback) => {
    db.query(
        'SELECT * FROM users WHERE email = ? AND otp = ?',
        [email, otp],
        callback
    );
};

// ================= EXPORT =================
module.exports = {
    createUser,
    findUserByEmail,
    saveOTP,      
    verifyOTP,
    createGoogleUser
};