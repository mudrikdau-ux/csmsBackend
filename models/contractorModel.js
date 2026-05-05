const db = require('../config/db');

// ==================== CONTRACTOR CRUD ====================

const createContractor = async (data) => {
    const sql = `
        INSERT INTO contractors (
            company_name,
            contractor_type,
            location,
            workers_count,
            workers_names,
            contract_start_date,
            contract_end_date,
            contract_value,
            contact_person,
            contact_email,
            contact_phone,
            services_provided,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.company_name,
        data.contractor_type,
        data.location,
        data.workers_count,
        data.workers_names || null,
        data.contract_start_date,
        data.contract_end_date,
        data.contract_value,
        data.contact_person,
        data.contact_email,
        data.contact_phone,
        data.services_provided || null,
        data.status || 'active'
    ]);
};

const getContractorById = async (id) => {
    return db.query(`SELECT * FROM contractors WHERE id = ?`, [id]);
};

const getAllContractors = async (filters = {}) => {
    let sql = `SELECT * FROM contractors WHERE 1=1`;
    const values = [];

    if (filters.contractor_type && filters.contractor_type !== 'all') {
        sql += ` AND contractor_type = ?`;
        values.push(filters.contractor_type);
    }
    if (filters.status) {
        sql += ` AND status = ?`;
        values.push(filters.status);
    }
    if (filters.location) {
        sql += ` AND location LIKE ?`;
        values.push(`%${filters.location}%`);
    }
    if (filters.date_from) {
        sql += ` AND contract_start_date >= ?`;
        values.push(filters.date_from);
    }
    if (filters.date_to) {
        sql += ` AND contract_end_date <= ?`;
        values.push(filters.date_to);
    }

    sql += ` ORDER BY created_at DESC`;

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

const updateContractor = async (id, data) => {
    const sql = `
        UPDATE contractors SET
            company_name = ?,
            contractor_type = ?,
            location = ?,
            workers_count = ?,
            workers_names = ?,
            contract_start_date = ?,
            contract_end_date = ?,
            contract_value = ?,
            contact_person = ?,
            contact_email = ?,
            contact_phone = ?,
            services_provided = ?,
            status = ?
        WHERE id = ?
    `;

    return db.query(sql, [
        data.company_name,
        data.contractor_type,
        data.location,
        data.workers_count,
        data.workers_names,
        data.contract_start_date,
        data.contract_end_date,
        data.contract_value,
        data.contact_person,
        data.contact_email,
        data.contact_phone,
        data.services_provided,
        data.status || 'active',
        id
    ]);
};

const deleteContractor = async (id) => {
    return db.query(`DELETE FROM contractors WHERE id = ?`, [id]);
};

const updateContractorStatus = async (id, status) => {
    return db.query(
        `UPDATE contractors SET status = ? WHERE id = ?`,
        [status, id]
    );
};

const getContractorCount = async (filters = {}) => {
    let sql = `SELECT COUNT(*) as count FROM contractors WHERE 1=1`;
    const values = [];

    if (filters.contractor_type && filters.contractor_type !== 'all') {
        sql += ` AND contractor_type = ?`;
        values.push(filters.contractor_type);
    }
    if (filters.status) {
        sql += ` AND status = ?`;
        values.push(filters.status);
    }

    return db.query(sql, values);
};

const searchContractors = async (searchTerm) => {
    const sql = `
        SELECT * FROM contractors 
        WHERE company_name LIKE ? 
        OR contact_person LIKE ? 
        OR location LIKE ? 
        OR contact_email LIKE ?
        ORDER BY created_at DESC
    `;
    const term = `%${searchTerm}%`;
    return db.query(sql, [term, term, term, term]);
};

// ==================== INVOICE CRUD ====================

const createInvoice = async (data) => {
    const sql = `
        INSERT INTO contractor_invoices (
            contractor_id,
            invoice_number,
            invoice_date,
            due_date,
            amount,
            description,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.contractor_id,
        data.invoice_number,
        data.invoice_date,
        data.due_date,
        data.amount,
        data.description || null,
        data.status || 'draft'
    ]);
};

const getInvoiceById = async (id) => {
    return db.query(`SELECT * FROM contractor_invoices WHERE id = ?`, [id]);
};

const getInvoicesByContractorId = async (contractorId) => {
    return db.query(
        `SELECT * FROM contractor_invoices WHERE contractor_id = ? ORDER BY created_at DESC`,
        [contractorId]
    );
};

const getAllInvoices = async (filters = {}) => {
    let sql = `
        SELECT ci.*, c.company_name, c.contractor_type, c.location
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

    sql += ` ORDER BY ci.created_at DESC`;

    return db.query(sql, values);
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

const generateInvoiceNumber = async () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const result = await db.query(
        `SELECT COUNT(*) as count FROM contractor_invoices WHERE invoice_number LIKE ?`,
        [`INV-${year}${month}%`]
    );
    
    const count = result[0].count + 1;
    return `INV-${year}${month}-${String(count).padStart(4, '0')}`;
};

module.exports = {
    createContractor,
    getContractorById,
    getAllContractors,
    updateContractor,
    deleteContractor,
    updateContractorStatus,
    getContractorCount,
    searchContractors,
    createInvoice,
    getInvoiceById,
    getInvoicesByContractorId,
    getAllInvoices,
    updateInvoiceStatus,
    deleteInvoice,
    generateInvoiceNumber
};