const db = require('../config/db');

// ================= CREATE STAFF =================
const createStaff = (data, callback) => {
    const sql = `
        INSERT INTO users 
        (first_name, last_name, email, password, address, gender, phone, photo, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'staff')
    `;

    db.query(sql, [
        data.first_name,
        data.last_name,
        data.email,
        data.password,
        data.address || '',
        data.gender || 'Male',
        data.phone,
        data.photo
    ], callback);
};


// ================= GET ALL STAFF =================
const getAllStaff = (callback) => {
    db.query(
        `SELECT * FROM users WHERE role = 'staff'`,
        callback
    );
};


// ================= GET STAFF BY ID =================
const getStaffById = (id, callback) => {
    db.query(
        `SELECT * FROM users WHERE id = ? AND role = 'staff'`,
        [id],
        callback
    );
};


// ================= UPDATE STAFF =================
const updateStaff = (id, data, callback) => {
    const sql = `
        UPDATE users 
        SET first_name=?, last_name=?, email=?, password=?, phone=?, photo=?
        WHERE id=? AND role='staff'
    `;

    db.query(sql, [
        data.first_name,
        data.last_name,
        data.email,
        data.password,
        data.phone,
        data.photo,
        id
    ], callback);
};


// ================= DELETE STAFF =================
const deleteStaff = (id, callback) => {
    db.query(
        `DELETE FROM users WHERE id=? AND role='staff'`,
        [id],
        callback
    );
};


module.exports = {
    createStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    deleteStaff
};