const db = require('../config/db');

const createService = async (data) => {
    const sql = `
        INSERT INTO services 
        (name, price, duration, location, description, includes, image)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.name,
        data.price,
        data.duration,
        data.location,
        data.description,
        JSON.stringify(data.includes),
        data.image
    ]);
};

const getAllServices = async () => {
    return db.query(`SELECT * FROM services ORDER BY created_at DESC`);
};

const getServiceById = async (id) => {
    return db.query(`SELECT * FROM services WHERE id = ?`, [id]);
};

const updateService = async (id, data) => {
    const updates = [];
    const values = [];

    if (data.name) {
        updates.push('name = ?');
        values.push(data.name);
    }
    if (data.price) {
        updates.push('price = ?');
        values.push(data.price);
    }
    if (data.duration) {
        updates.push('duration = ?');
        values.push(data.duration);
    }
    if (data.location) {
        updates.push('location = ?');
        values.push(data.location);
    }
    if (data.description) {
        updates.push('description = ?');
        values.push(data.description);
    }
    if (data.includes) {
        updates.push('includes = ?');
        values.push(JSON.stringify(data.includes));
    }
    if (data.image) {
        updates.push('image = ?');
        values.push(data.image);
    }

    if (updates.length === 0) {
        throw new Error('No fields to update');
    }

    values.push(id);
    const sql = `UPDATE services SET ${updates.join(', ')} WHERE id = ?`;

    return db.query(sql, values);
};

const deleteService = async (id) => {
    return db.query(`DELETE FROM services WHERE id = ?`, [id]);
};

module.exports = {
    createService,
    getAllServices,
    getServiceById,
    updateService,
    deleteService
};