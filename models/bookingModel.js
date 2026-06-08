const db = require('../config/db');

const createBooking = async (data) => {
    const sql = `
        INSERT INTO bookings (
            user_id, service_id,
            cleaners, hours, frequency, materials,
            property_type, property_type_detail, bedrooms, bathrooms, dirt_level, cleaning_frequency,
            address, area_district, city, region, landmark, building_name, floor_number,
            latitude, longitude, pin_latitude, pin_longitude,
            service_date, service_time, instructions, special_instructions_cleaners,
            first_name, last_name, email, phone, alternative_phone, preferred_communication,
            payment_method, base_price, extras, discount, total_price,
            estimated_service_cost, labor_cost, transport_cost, equipment_cost_admin,
            tax_rate_admin, tax_amount_admin, discount_admin, final_total,
            status, payment_status, estimation_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.user_id,
        data.service_id,
        data.cleaners,
        data.hours,
        data.frequency,
        data.materials || false,
        data.property_type,
        data.property_type_detail || null,
        data.bedrooms || null,
        data.bathrooms || null,
        data.dirt_level || null,
        data.cleaning_frequency || null,
        data.address,
        data.area_district || null,
        data.city,
        data.region || null,
        data.landmark || null,
        data.building_name || null,
        data.floor_number || null,
        data.latitude || null,
        data.longitude || null,
        data.pin_latitude || null,
        data.pin_longitude || null,
        data.service_date,
        data.service_time,
        data.instructions || null,
        data.special_instructions_cleaners || null,
        data.first_name,
        data.last_name,
        data.email,
        data.phone,
        data.alternative_phone || null,
        data.preferred_communication || null,
        data.payment_method,
        data.base_price,
        data.extras,
        data.discount,
        data.total_price,
        null, // estimated_service_cost
        null, // labor_cost
        null, // transport_cost
        null, // equipment_cost_admin
        null, // tax_rate_admin
        null, // tax_amount_admin
        null, // discount_admin
        null, // final_total
        data.status || 'pending',
        data.payment_status || 'unpaid',
        data.estimation_status || 'pending'
    ]);
};

const getBookingById = async (id) => {
    return db.query(`SELECT * FROM bookings WHERE id = ?`, [id]);
};

const getAllBookings = async (filters = {}) => {
    let sql = `SELECT * FROM bookings WHERE 1=1`;
    const values = [];

    if (filters.user_id) { sql += ` AND user_id = ?`; values.push(filters.user_id); }
    if (filters.status) { sql += ` AND status = ?`; values.push(filters.status); }
    if (filters.estimation_status) { sql += ` AND estimation_status = ?`; values.push(filters.estimation_status); }
    if (filters.payment_status) { sql += ` AND payment_status = ?`; values.push(filters.payment_status); }
    if (filters.date_from) { sql += ` AND service_date >= ?`; values.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND service_date <= ?`; values.push(filters.date_to); }
    if (filters.assigned_staff_id) { sql += ` AND assigned_staff_id = ?`; values.push(filters.assigned_staff_id); }

    sql += ` ORDER BY created_at DESC`;

    if (filters.limit) { sql += ` LIMIT ?`; values.push(parseInt(filters.limit)); }
    if (filters.offset) { sql += ` OFFSET ?`; values.push(parseInt(filters.offset)); }

    return db.query(sql, values);
};

const getBookingsByUserId = async (userId, filters = {}) => {
    let sql = `SELECT * FROM bookings WHERE user_id = ?`;
    const values = [userId];

    if (filters.status) { sql += ` AND status = ?`; values.push(filters.status); }
    if (filters.estimation_status) { sql += ` AND estimation_status = ?`; values.push(filters.estimation_status); }
    if (filters.payment_status) { sql += ` AND payment_status = ?`; values.push(filters.payment_status); }
    if (filters.service_id) { sql += ` AND service_id = ?`; values.push(filters.service_id); }
    if (filters.service_date) { sql += ` AND service_date = ?`; values.push(filters.service_date); }
    if (filters.date_from) { sql += ` AND service_date >= ?`; values.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND service_date <= ?`; values.push(filters.date_to); }

    sql += ` ORDER BY created_at DESC`;

    if (filters.limit) { sql += ` LIMIT ?`; values.push(parseInt(filters.limit)); }
    if (filters.offset) { sql += ` OFFSET ?`; values.push(parseInt(filters.offset)); }

    return db.query(sql, values);
};

const updateBookingStatus = async (id, status) => {
    return db.query(`UPDATE bookings SET status = ? WHERE id = ?`, [status, id]);
};

const updateBookingPaymentStatus = async (id, payment_status) => {
    return db.query(`UPDATE bookings SET payment_status = ? WHERE id = ?`, [payment_status, id]);
};

const assignStaffToBooking = async (bookingId, staffId, staffName) => {
    return db.query(`UPDATE bookings SET assigned_staff_id = ?, assigned_staff_name = ?, status = 'confirmed' WHERE id = ?`, [staffId, staffName, bookingId]);
};

const removeStaffAssignment = async (bookingId) => {
    return db.query(`UPDATE bookings SET assigned_staff_id = NULL, assigned_staff_name = NULL, status = 'pending' WHERE id = ?`, [bookingId]);
};

const getBookingCount = async (filters = {}) => {
    let sql = `SELECT COUNT(*) as count FROM bookings WHERE 1=1`;
    const values = [];

    if (filters.status) { sql += ` AND status = ?`; values.push(filters.status); }
    if (filters.estimation_status) { sql += ` AND estimation_status = ?`; values.push(filters.estimation_status); }
    if (filters.payment_status) { sql += ` AND payment_status = ?`; values.push(filters.payment_status); }
    if (filters.user_id) { sql += ` AND user_id = ?`; values.push(filters.user_id); }
    if (filters.assigned_staff_id) { sql += ` AND assigned_staff_id = ?`; values.push(filters.assigned_staff_id); }

    return db.query(sql, values);
};

const getStaffBookings = async (staffId, filters = {}) => {
    let sql = `SELECT * FROM bookings WHERE assigned_staff_id = ?`;
    const values = [staffId];

    if (filters.status) { sql += ` AND status = ?`; values.push(filters.status); }
    if (filters.date_from) { sql += ` AND service_date >= ?`; values.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND service_date <= ?`; values.push(filters.date_to); }

    sql += ` ORDER BY service_date ASC, service_time ASC`;

    return db.query(sql, values);
};

const updateBookingEstimation = async (id, data) => {
    const sql = `
        UPDATE bookings SET
            estimated_service_cost = ?,
            labor_cost = ?,
            transport_cost = ?,
            equipment_cost_admin = ?,
            tax_rate_admin = ?,
            tax_amount_admin = ?,
            discount_admin = ?,
            final_total = ?,
            estimation_status = 'estimated'
        WHERE id = ?
    `;

    return db.query(sql, [
        data.estimated_service_cost,
        data.labor_cost,
        data.transport_cost,
        data.equipment_cost_admin,
        data.tax_rate_admin,
        data.tax_amount_admin,
        data.discount_admin,
        data.final_total,
        id
    ]);
};

const updateInvoiceGenerated = async (id, invoicePath) => {
    return db.query(
        `UPDATE bookings SET estimation_status = 'invoiced', invoice_generated_at = NOW(), invoice_pdf_path = ? WHERE id = ?`,
        [invoicePath, id]
    );
};

module.exports = {
    createBooking,
    getBookingById,
    getAllBookings,
    getBookingsByUserId,
    updateBookingStatus,
    updateBookingPaymentStatus,
    assignStaffToBooking,
    removeStaffAssignment,
    getBookingCount,
    getStaffBookings,
    updateBookingEstimation,
    updateInvoiceGenerated
};