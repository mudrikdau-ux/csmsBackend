const db = require('../config/db');

// CREATE
const createService = (data, callback) => {
    const sql = `
        INSERT INTO services 
        (name, price, duration, location, description, includes, image)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        data.name,
        data.price,
        data.duration,
        data.location,
        data.description,
        JSON.stringify(data.includes),
        data.image
    ], callback);
};

// GET ALL
const getAllServices = (callback) => {
    db.query('SELECT * FROM services', callback);
};

// GET ONE
const getServiceById = (id, callback) => {
    db.query('SELECT * FROM services WHERE id = ?', [id], callback);
};

// UPDATE
const updateService = (id, data, callback) => {
    const sql = `
        UPDATE services 
        SET name=?, price=?, duration=?, location=?, description=?, includes=?, image=?
        WHERE id=?
    `;

    db.query(sql, [
        data.name,
        data.price,
        data.duration,
        data.location,
        data.description,
        JSON.stringify(data.includes),
        data.image,
        id
    ], callback);
};

// DELETE
const deleteService = (id, callback) => {
    db.query('DELETE FROM services WHERE id=?', [id], callback);
};

module.exports = {
    createService,
    getAllServices,
    getServiceById,
    updateService,
    deleteService
};