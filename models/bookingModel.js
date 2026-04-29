const db = require('../config/db');

const createBooking = (data, callback) => {
    const sql = `
        INSERT INTO bookings (
            user_id, service_id,
            cleaners, hours, frequency, materials,
            property_type,
            address, city, landmark, latitude, longitude,
            service_date, service_time, instructions,
            first_name, last_name, email, phone,
            payment_method,
            base_price, extras, discount, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        data.user_id,
        data.service_id,
        data.cleaners,
        data.hours,
        data.frequency,
        data.materials,
        data.property_type,
        data.address,
        data.city,
        data.landmark,
        data.latitude,
        data.longitude,
        data.service_date,
        data.service_time,
        data.instructions,
        data.first_name,
        data.last_name,
        data.email,
        data.phone,
        data.payment_method,
        data.base_price,
        data.extras,
        data.discount,
        data.total_price
    ], callback);
};

const getBookingById = (id, callback) => {
    db.query('SELECT * FROM bookings WHERE id=?', [id], callback);
};

module.exports = {
    createBooking,
    getBookingById
};