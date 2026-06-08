const db = require('../config/db');

const generateInvoiceNumber = async () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const result = await db.query(
        `SELECT COUNT(*) as count FROM customer_invoices WHERE invoice_number LIKE ?`,
        [`INV-CUST-${year}${month}%`]
    );
    
    const count = result[0].count + 1;
    return `INV-CUST-${year}${month}-${String(count).padStart(6, '0')}`;
};

const createCustomerInvoice = async (data) => {
    const invoiceNumber = await generateInvoiceNumber();
    
    const sql = `
        INSERT INTO customer_invoices (
            booking_id, invoice_number, invoice_date, due_date,
            service_cost, labor_cost, transport_cost, equipment_cost,
            subtotal, tax_rate, tax_amount, discount_amount, total_amount,
            notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Ensure subtotal is a number, not a concatenated string
    const subtotal = parseFloat(data.service_cost) + 
                     parseFloat(data.labor_cost) + 
                     parseFloat(data.transport_cost) + 
                     parseFloat(data.equipment_cost);

    return db.query(sql, [
        data.booking_id,
        invoiceNumber,
        data.invoice_date,
        data.due_date,
        parseFloat(data.service_cost),
        parseFloat(data.labor_cost),
        parseFloat(data.transport_cost),
        parseFloat(data.equipment_cost),
        subtotal,  // This must be a number, not a string concatenation
        parseFloat(data.tax_rate),
        parseFloat(data.tax_amount),
        parseFloat(data.discount_amount),
        parseFloat(data.total_amount),
        data.notes || null,
        data.status || 'draft',
        data.created_by
    ]);
};

const getCustomerInvoiceById = async (id) => {
    const sql = `
        SELECT ci.*, 
               b.first_name, b.last_name, b.email, b.phone, b.address, b.city,
               b.service_date, b.service_time, s.name as service_name,
               u.first_name as created_by_first_name, u.last_name as created_by_last_name
        FROM customer_invoices ci
        LEFT JOIN bookings b ON ci.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN users u ON ci.created_by = u.id
        WHERE ci.id = ?
    `;
    return db.query(sql, [id]);
};

const getCustomerInvoicesByBookingId = async (bookingId) => {
    const sql = `
        SELECT * FROM customer_invoices WHERE booking_id = ? ORDER BY created_at DESC
    `;
    return db.query(sql, [bookingId]);
};

const getCustomerInvoicesByUserId = async (userId) => {
    const sql = `
        SELECT ci.*, b.service_date, b.service_time, s.name as service_name
        FROM customer_invoices ci
        LEFT JOIN bookings b ON ci.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.user_id = ?
        ORDER BY ci.created_at DESC
    `;
    return db.query(sql, [userId]);
};

const updateInvoiceStatus = async (id, status, sentAt = null) => {
    let sql = `UPDATE customer_invoices SET status = ?`;
    const values = [status];
    
    if (sentAt) {
        sql += `, sent_at = ?`;
        values.push(sentAt);
    }
    
    sql += ` WHERE id = ?`;
    values.push(id);
    
    return db.query(sql, values);
};

const updateInvoicePdfPath = async (id, pdfPath) => {
    return db.query(`UPDATE customer_invoices SET pdf_path = ? WHERE id = ?`, [pdfPath, id]);
};

const deleteCustomerInvoice = async (id) => {
    return db.query(`DELETE FROM customer_invoices WHERE id = ?`, [id]);
};

module.exports = {
    createCustomerInvoice,
    getCustomerInvoiceById,
    getCustomerInvoicesByBookingId,
    getCustomerInvoicesByUserId,
    updateInvoiceStatus,
    updateInvoicePdfPath,
    deleteCustomerInvoice
};