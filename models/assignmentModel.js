const db = require('../config/db');

// ==================== ASSIGNMENT OPERATIONS ====================

const createAssignment = async (staffId, serviceId) => {
    const sql = `
        INSERT INTO staff_service_assignments 
        (staff_id, service_id, status)
        VALUES (?, ?, 'assigned')
    `;
    return db.query(sql, [staffId, serviceId]);
};

const removeAssignment = async (assignmentId) => {
    const sql = `DELETE FROM staff_service_assignments WHERE id = ?`;
    return db.query(sql, [assignmentId]);
};

const updateAssignmentStatus = async (assignmentId, status) => {
    const sql = `
        UPDATE staff_service_assignments 
        SET status = ?, completed_date = ? 
        WHERE id = ?
    `;
    const completedDate = status === 'completed' ? new Date() : null;
    return db.query(sql, [status, completedDate, assignmentId]);
};

const getAssignmentById = async (assignmentId) => {
    return db.query(`SELECT * FROM staff_service_assignments WHERE id = ?`, [assignmentId]);
};

const getAssignmentsByStaffId = async (staffId) => {
    const sql = `
        SELECT 
            ssa.id as assignment_id,
            ssa.status as assignment_status,
            ssa.assigned_date,
            ssa.completed_date,
            s.id as service_id,
            s.name as service_name,
            s.price,
            s.duration,
            s.location,
            s.description,
            s.image as service_image
        FROM staff_service_assignments ssa
        JOIN services s ON ssa.service_id = s.id
        WHERE ssa.staff_id = ?
        ORDER BY ssa.assigned_date DESC
    `;
    return db.query(sql, [staffId]);
};

const getAssignmentsByServiceId = async (serviceId) => {
    const sql = `
        SELECT 
            ssa.id as assignment_id,
            ssa.status as assignment_status,
            ssa.assigned_date,
            ssa.completed_date,
            u.id as staff_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.photo,
            u.staff_type
        FROM staff_service_assignments ssa
        JOIN users u ON ssa.staff_id = u.id
        WHERE ssa.service_id = ?
        ORDER BY ssa.assigned_date DESC
    `;
    return db.query(sql, [serviceId]);
};

const getAllAssignments = async (filters = {}) => {
    let sql = `
        SELECT 
            ssa.id as assignment_id,
            ssa.status as assignment_status,
            ssa.assigned_date,
            ssa.completed_date,
            ssa.notes,
            u.id as staff_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.photo,
            u.staff_type,
            s.id as service_id,
            s.name as service_name,
            s.price,
            s.duration,
            s.location,
            s.description,
            s.image as service_image
        FROM staff_service_assignments ssa
        JOIN users u ON ssa.staff_id = u.id
        JOIN services s ON ssa.service_id = s.id
        WHERE 1=1
    `;
    const values = [];

    if (filters.staff_id) {
        sql += ` AND ssa.staff_id = ?`;
        values.push(filters.staff_id);
    }

    if (filters.service_id) {
        sql += ` AND ssa.service_id = ?`;
        values.push(filters.service_id);
    }

    if (filters.status) {
        sql += ` AND ssa.status = ?`;
        values.push(filters.status);
    }

    sql += ` ORDER BY ssa.assigned_date DESC`;

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

// ==================== STAFF STATISTICS ====================

const getStaffAssignmentCount = async (staffId) => {
    const sql = `
        SELECT COUNT(*) as count 
        FROM staff_service_assignments 
        WHERE staff_id = ? AND status IN ('assigned', 'in_progress')
    `;
    return db.query(sql, [staffId]);
};

const getAllStaffAssignmentCounts = async () => {
    const sql = `
        SELECT 
            staff_id,
            COUNT(*) as total_assignments,
            SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned_count,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
        FROM staff_service_assignments
        GROUP BY staff_id
    `;
    return db.query(sql);
};

// ==================== SERVICE ASSIGNMENT STATUS ====================

const getServiceAssignmentStatus = async (serviceId) => {
    const sql = `
        SELECT COUNT(*) as count 
        FROM staff_service_assignments 
        WHERE service_id = ? AND status IN ('assigned', 'in_progress')
    `;
    return db.query(sql, [serviceId]);
};

const getAllServiceAssignmentStatuses = async () => {
    const sql = `
        SELECT 
            service_id,
            COUNT(*) as total_assignments,
            SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned_count
        FROM staff_service_assignments
        GROUP BY service_id
    `;
    return db.query(sql);
};

// ==================== UNASSIGNED SERVICES ====================

const getUnassignedServices = async () => {
    const sql = `
        SELECT s.* 
        FROM services s
        WHERE s.id NOT IN (
            SELECT DISTINCT service_id 
            FROM staff_service_assignments 
            WHERE status IN ('assigned', 'in_progress')
        )
        ORDER BY s.created_at DESC
    `;
    return db.query(sql);
};

// ==================== UNASSIGNED STAFF ====================

const getUnassignedStaff = async () => {
    const sql = `
        SELECT u.* 
        FROM users u
        WHERE u.role = 'staff' 
        AND u.id NOT IN (
            SELECT DISTINCT staff_id 
            FROM staff_service_assignments 
            WHERE status IN ('assigned', 'in_progress')
        )
        ORDER BY u.created_at DESC
    `;
    return db.query(sql);
};

// ==================== ASSIGNED STAFF WITH DETAILS ====================

const getAssignedStaff = async () => {
    const sql = `
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.photo,
            u.staff_type,
            COUNT(ssa.id) as total_services,
            SUM(CASE WHEN ssa.status = 'assigned' THEN 1 ELSE 0 END) as assigned_count,
            SUM(CASE WHEN ssa.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
            SUM(CASE WHEN ssa.status = 'completed' THEN 1 ELSE 0 END) as completed_count
        FROM users u
        LEFT JOIN staff_service_assignments ssa ON u.id = ssa.staff_id 
            AND ssa.status IN ('assigned', 'in_progress')
        WHERE u.role = 'staff'
        GROUP BY u.id
        HAVING total_services > 0
        ORDER BY total_services ASC
    `;
    return db.query(sql);
};

// ==================== STAFF WITH LEAST ASSIGNMENTS ====================

const getStaffSortedByAssignmentCount = async () => {
    const sql = `
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.photo,
            u.staff_type,
            COUNT(ssa.id) as total_assignments
        FROM users u
        LEFT JOIN staff_service_assignments ssa ON u.id = ssa.staff_id 
            AND ssa.status IN ('assigned', 'in_progress')
        WHERE u.role = 'staff'
        GROUP BY u.id
        ORDER BY total_assignments ASC
    `;
    return db.query(sql);
};

// ==================== ASSIGNED SERVICES WITH DETAILS ====================

const getAssignedServices = async () => {
    const sql = `
        SELECT 
            s.id as service_id,
            s.name as service_name,
            s.price,
            s.duration,
            s.location,
            s.description,
            s.image as service_image,
            s.created_at,
            GROUP_CONCAT(
                CONCAT(u.first_name, ' ', u.last_name, ' (', u.email, ')')
                SEPARATOR ', '
            ) as assigned_to,
            COUNT(DISTINCT ssa.id) as total_assignments
        FROM services s
        INNER JOIN staff_service_assignments ssa ON s.id = ssa.service_id 
            AND ssa.status IN ('assigned', 'in_progress')
        INNER JOIN users u ON ssa.staff_id = u.id
        GROUP BY s.id
        ORDER BY s.created_at DESC
    `;
    return db.query(sql);
};

module.exports = {
    createAssignment,
    removeAssignment,
    updateAssignmentStatus,
    getAssignmentById,
    getAssignmentsByStaffId,
    getAssignmentsByServiceId,
    getAllAssignments,
    getStaffAssignmentCount,
    getAllStaffAssignmentCounts,
    getServiceAssignmentStatus,
    getAllServiceAssignmentStatuses,
    getUnassignedServices,
    getUnassignedStaff,
    getAssignedStaff,
    getStaffSortedByAssignmentCount,
    getAssignedServices
};