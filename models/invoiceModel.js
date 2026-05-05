const db = require('../config/db');

// ==================== INVOICE CRUD ====================

const createInvoice = async (data) => {
    const sql = `
        INSERT INTO contractor_invoices (
            contractor_id,
            invoice_number,
            invoice_date,
            due_date,
            work_description,
            work_cost,
            equipment_cost,
            subtotal,
            tax_rate,
            tax_amount,
            total_amount,
            notes,
            status,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.contractor_id,
        data.invoice_number,
        data.invoice_date,
        data.due_date,
        data.work_description || null,
        data.work_cost,
        data.equipment_cost,
        data.subtotal,
        data.tax_rate,
        data.tax_amount,
        data.total_amount,
        data.notes || null,
        data.status || 'generated',
        data.created_by || null
    ]);
};

const getInvoiceById = async (id) => {
    const sql = `
        SELECT ci.*, 
               c.company_name, c.contractor_type, c.location, 
               c.contact_person, c.contact_email, c.contact_phone,
               u.first_name as created_by_first_name, u.last_name as created_by_last_name
        FROM contractor_invoices ci
        LEFT JOIN contractors c ON ci.contractor_id = c.id
        LEFT JOIN users u ON ci.created_by = u.id
        WHERE ci.id = ?
    `;
    return db.query(sql, [id]);
};

const getInvoiceByNumber = async (invoiceNumber) => {
    return db.query(`SELECT * FROM contractor_invoices WHERE invoice_number = ?`, [invoiceNumber]);
};

const getInvoicesByContractorId = async (contractorId) => {
    const sql = `
        SELECT ci.*, c.company_name, c.contractor_type
        FROM contractor_invoices ci
        LEFT JOIN contractors c ON ci.contractor_id = c.id
        WHERE ci.contractor_id = ?
        ORDER BY ci.created_at DESC
    `;
    return db.query(sql, [contractorId]);
};

const getAllInvoices = async (filters = {}) => {
    let sql = `
        SELECT ci.*, c.company_name, c.contractor_type, c.location, c.contact_person
        FROM contractor_invoices ci
        LEFT JOIN contractors c ON ci.contractor_id = c.id
        WHERE 1=1
    `;
    const values = [];

    if (filters.contractor_id) {
        sql += ` AND ci.contractor_id = ?`;
        values.push(filters.contractor_id);
    }
    if (filters.status) {
        sql += ` AND ci.status = ?`;
        values.push(filters.status);
    }
    if (filters.date_from) {
        sql += ` AND ci.invoice_date >= ?`;
        values.push(filters.date_from);
    }
    if (filters.date_to) {
        sql += ` AND ci.invoice_date <= ?`;
        values.push(filters.date_to);
    }
    if (filters.search) {
        sql += ` AND (ci.invoice_number LIKE ? OR c.company_name LIKE ?)`;
        const term = `%${filters.search}%`;
        values.push(term, term);
    }

    sql += ` ORDER BY ci.created_at DESC`;

    if (filters.limit) {
        sql += ` LIMIT ?`;
        values.push(parseInt(filters.limit));
    }
    if (filters.offset) {
        sql += ` OFFSET ?`;
        values.push(parseInt(filters.offset));
    }

    return db.query(sql, values);
};

const updateInvoice = async (id, data) => {
    const sql = `
        UPDATE contractor_invoices SET
            invoice_date = ?,
            due_date = ?,
            work_description = ?,
            work_cost = ?,
            equipment_cost = ?,
            subtotal = ?,
            tax_rate = ?,
            tax_amount = ?,
            total_amount = ?,
            notes = ?,
            status = ?
        WHERE id = ?
    `;

    return db.query(sql, [
        data.invoice_date,
        data.due_date,
        data.work_description,
        data.work_cost,
        data.equipment_cost,
        data.subtotal,
        data.tax_rate,
        data.tax_amount,
        data.total_amount,
        data.notes,
        data.status || 'generated',
        id
    ]);
};

const updateInvoiceStatus = async (id, status) => {
    return db.query(
        `UPDATE contractor_invoices SET status = ? WHERE id = ?`,
        [status, id]
    );
};

const deleteInvoice = async (id) => {
    return db.query(`DELETE FROM contractor_invoices WHERE id = ?`, [id]);
};

const getInvoiceCount = async (filters = {}) => {
    let sql = `SELECT COUNT(*) as count FROM contractor_invoices WHERE 1=1`;
    const values = [];

    if (filters.status) {
        sql += ` AND status = ?`;
        values.push(filters.status);
    }
    if (filters.contractor_id) {
        sql += ` AND contractor_id = ?`;
        values.push(filters.contractor_id);
    }

    return db.query(sql, values);
};

const generateInvoiceNumber = async () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const result = await db.query(
        `SELECT COUNT(*) as count FROM contractor_invoices WHERE invoice_number LIKE ?`,
        [`INV-CON-${year}${month}%`]
    );
    
    const count = result[0].count + 1;
    return `INV-CON-${year}${month}-${String(count).padStart(4, '0')}`;
};

const getInvoiceStats = async () => {
    const sql = `
        SELECT 
            COUNT(*) as total_invoices,
            SUM(total_amount) as total_amount,
            SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
            SUM(CASE WHEN status = 'overdue' THEN total_amount ELSE 0 END) as overdue_amount,
            SUM(CASE WHEN status = 'generated' OR status = 'sent' THEN total_amount ELSE 0 END) as pending_amount
        FROM contractor_invoices
    `;
    return db.query(sql);
};

module.exports = {
    createInvoice,
    getInvoiceById,
    getInvoiceByNumber,
    getInvoicesByContractorId,
    getAllInvoices,
    updateInvoice,
    updateInvoiceStatus,
    deleteInvoice,
    getInvoiceCount,
    generateInvoiceNumber,
    getInvoiceStats
};