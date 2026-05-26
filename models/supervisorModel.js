const db = require('../config/db');
const pool = db.pool || require('../config/db');

// ==================== CONTRACTOR & STAFF DATA ====================

const getContractorsList = async () => {
    const sql = `
        SELECT 
            c.id,
            c.company_name,
            c.location,
            c.location_address,
            c.workers_count,
            c.workers_names,
            c.contractor_type,
            c.contact_person,
            c.contact_phone
        FROM contractors c
        WHERE c.status = 'active'
        ORDER BY c.company_name ASC
    `;
    return db.query(sql);
};

const getContractorStaff = async (contractorId) => {
    const sql = `
        SELECT 
            c.id as contractor_id,
            c.company_name,
            c.location,
            c.location_address,
            c.workers_names,
            c.workers_count
        FROM contractors c
        WHERE c.id = ?
    `;
    const contractor = await db.query(sql, [contractorId]);
    
    if (contractor.length === 0) return [];
    
    // Parse workers_names (comma-separated or JSON)
    let workers = [];
    const workersNames = contractor[0].workers_names;
    
    if (workersNames) {
        if (typeof workersNames === 'string' && workersNames.includes(',')) {
            workers = workersNames.split(',').map(w => w.trim());
        } else if (typeof workersNames === 'string') {
            workers = [workersNames];
        } else if (Array.isArray(workersNames)) {
            workers = workersNames;
        }
    }
    
    // Get staff details from users table
    const staffList = [];
    for (const workerName of workers) {
        const nameParts = workerName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const staff = await db.query(
            `SELECT id, first_name, last_name, email, phone, staff_type 
             FROM users 
             WHERE role = 'staff' 
             AND first_name LIKE ? 
             AND last_name LIKE ?`,
            [`%${firstName}%`, `%${lastName}%`]
        );
        
        if (staff.length > 0) {
            staffList.push({
                id: staff[0].id,
                name: `${staff[0].first_name} ${staff[0].last_name}`,
                email: staff[0].email,
                phone: staff[0].phone,
                role: staff[0].staff_type || 'normal',
                contractor_id: contractorId,
                contractor_name: contractor[0].company_name
            });
        } else {
            staffList.push({
                id: null,
                name: workerName,
                email: null,
                phone: null,
                role: 'unknown',
                contractor_id: contractorId,
                contractor_name: contractor[0].company_name
            });
        }
    }
    
    return staffList;
};

// ==================== ATTENDANCE MANAGEMENT ====================

const saveAttendance = async (attendanceData, supervisorId) => {
    const { contractor_id, attendance_date, staff_attendance } = attendanceData;
    
    for (const item of staff_attendance) {
        if (item.staff_id) {
            // Check if attendance already exists for this date
            const existing = await db.query(
                `SELECT id FROM staff_attendance 
                 WHERE staff_id = ? AND attendance_date = ? AND contractor_id = ?`,
                [item.staff_id, attendance_date, contractor_id]
            );
            
            if (existing.length > 0) {
                // Update existing
                await db.query(
                    `UPDATE staff_attendance 
                     SET is_present = ?, marked_by = ? 
                     WHERE id = ?`,
                    [item.is_present ? 1 : 0, supervisorId, existing[0].id]
                );
            } else {
                // Insert new
                await db.query(
                    `INSERT INTO staff_attendance 
                     (contractor_id, staff_id, attendance_date, is_present, daily_wage, marked_by)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [contractor_id, item.staff_id, attendance_date, item.is_present ? 1 : 0, 10000, supervisorId]
                );
            }
        }
    }
    
    return { success: true };
};

const getAttendanceByDate = async (contractorId, date) => {
    const sql = `
        SELECT 
            sa.*,
            u.first_name,
            u.last_name,
            u.email,
            u.phone
        FROM staff_attendance sa
        LEFT JOIN users u ON sa.staff_id = u.id
        WHERE sa.contractor_id = ? AND sa.attendance_date = ?
    `;
    return db.query(sql, [contractorId, date]);
};

// ==================== PAYROLL MANAGEMENT ====================

const updatePayroll = async (weekEndingDate, supervisorId) => {
    // Calculate attendance for the week (last 7 days including week_ending_date)
    const startDate = new Date(weekEndingDate);
    startDate.setDate(startDate.getDate() - 6);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    // Get attendance summary per staff
    const attendanceSummary = await db.query(
        `SELECT 
            sa.staff_id,
            sa.contractor_id,
            COUNT(CASE WHEN sa.is_present = 1 THEN 1 END) as days_present,
            SUM(sa.daily_wage) as total_earned
         FROM staff_attendance sa
         WHERE sa.attendance_date BETWEEN ? AND ?
         GROUP BY sa.staff_id, sa.contractor_id`,
        [startDateStr, weekEndingDate]
    );
    
    for (const summary of attendanceSummary) {
        // Check if payroll already exists for this week
        const existing = await db.query(
            `SELECT id FROM payroll_records 
             WHERE staff_id = ? AND week_ending_date = ?`,
            [summary.staff_id, weekEndingDate]
        );
        
        if (existing.length > 0) {
            await db.query(
                `UPDATE payroll_records 
                 SET days_present = ?, total_earned = ?, updated_at = NOW()
                 WHERE id = ?`,
                [summary.days_present, summary.total_earned, existing[0].id]
            );
        } else {
            await db.query(
                `INSERT INTO payroll_records 
                 (staff_id, contractor_id, week_ending_date, days_present, total_earned, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [summary.staff_id, summary.contractor_id, weekEndingDate, summary.days_present, summary.total_earned, supervisorId]
            );
        }
    }
    
    return { success: true, processed_count: attendanceSummary.length };
};

const getPayrollByWeek = async (weekEndingDate) => {
    const sql = `
        SELECT 
            pr.*,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            c.company_name,
            c.location
        FROM payroll_records pr
        LEFT JOIN users u ON pr.staff_id = u.id
        LEFT JOIN contractors c ON pr.contractor_id = c.id
        WHERE pr.week_ending_date = ?
        ORDER BY c.company_name, u.first_name
    `;
    return db.query(sql, [weekEndingDate]);
};

// ==================== WEEKLY REPORTS ====================

const createWeeklyReport = async (reportData, supervisorId) => {
    const {
        contractor_id,
        week_ending_date,
        work_progress,
        worker_performance,
        equipment_status,
        additional_requests
    } = reportData;
    
    const result = await db.query(
        `INSERT INTO supervisor_reports 
         (contractor_id, week_ending_date, work_progress, worker_performance, 
          equipment_status, additional_requests, submitted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [contractor_id, week_ending_date, work_progress, worker_performance, 
         equipment_status, additional_requests || null, supervisorId]
    );
    
    return { report_id: result.insertId };
};

const getWeeklyReport = async (reportId) => {
    const sql = `
        SELECT 
            sr.*,
            c.company_name,
            c.location,
            c.location_address,
            u.first_name as supervisor_first_name,
            u.last_name as supervisor_last_name,
            u.email as supervisor_email
        FROM supervisor_reports sr
        LEFT JOIN contractors c ON sr.contractor_id = c.id
        LEFT JOIN users u ON sr.submitted_by = u.id
        WHERE sr.id = ?
    `;
    const result = await db.query(sql, [reportId]);
    return result[0] || null;
};

const getWeeklyReportsBySupervisor = async (supervisorId, limit = 20) => {
    const sql = `
        SELECT 
            sr.*,
            c.company_name,
            c.location
        FROM supervisor_reports sr
        LEFT JOIN contractors c ON sr.contractor_id = c.id
        WHERE sr.submitted_by = ?
        ORDER BY sr.created_at DESC
        LIMIT ?
    `;
    return db.query(sql, [supervisorId, limit]);
};

const updateReportPdfPath = async (reportId, pdfPath) => {
    return db.query(
        `UPDATE supervisor_reports SET report_pdf_path = ? WHERE id = ?`,
        [pdfPath, reportId]
    );
};

const markReportSubmittedToAdmin = async (reportId) => {
    return db.query(
        `UPDATE supervisor_reports SET submitted_to_admin = 1 WHERE id = ?`,
        [reportId]
    );
};

// ==================== CHAT SYSTEM ====================

const sendMessage = async (supervisorId, message, attachmentUrl = null, reportId = null) => {
    // Get admin user
    const admin = await db.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    const adminId = admin.length > 0 ? admin[0].id : null;
    
    const result = await db.query(
        `INSERT INTO supervisor_chats 
         (supervisor_id, admin_id, message, attachment_url, report_id, sender_role)
         VALUES (?, ?, ?, ?, ?, 'supervisor')`,
        [supervisorId, adminId, message, attachmentUrl, reportId]
    );
    
    return { message_id: result.insertId };
};

const getMessages = async (supervisorId, limit = 50) => {
    const sql = `
        SELECT 
            sc.*,
            u.first_name as sender_first_name,
            u.last_name as sender_last_name,
            adm.first_name as admin_first_name,
            adm.last_name as admin_last_name
        FROM supervisor_chats sc
        LEFT JOIN users u ON sc.supervisor_id = u.id
        LEFT JOIN users adm ON sc.admin_id = adm.id
        WHERE sc.supervisor_id = ?
        ORDER BY sc.created_at ASC
        LIMIT ?
    `;
    return db.query(sql, [supervisorId, limit]);
};

const markMessagesAsRead = async (supervisorId) => {
    return db.query(
        `UPDATE supervisor_chats SET is_read = 1 
         WHERE supervisor_id = ? AND sender_role = 'admin' AND is_read = 0`,
        [supervisorId]
    );
};

const getUnreadCount = async (supervisorId) => {
    const result = await db.query(
        `SELECT COUNT(*) as count FROM supervisor_chats 
         WHERE supervisor_id = ? AND sender_role = 'admin' AND is_read = 0`,
        [supervisorId]
    );
    return result[0]?.count || 0;
};

// ==================== ADMIN REPLY (For admin controller) ====================

const adminReplyToSupervisor = async (adminId, supervisorId, message) => {
    const result = await db.query(
        `INSERT INTO supervisor_chats 
         (supervisor_id, admin_id, message, sender_role, is_read)
         VALUES (?, ?, ?, 'admin', 0)`,
        [supervisorId, adminId, message]
    );
    return { message_id: result.insertId };
};

const getSupervisorChatList = async (adminId) => {
    const sql = `
        SELECT DISTINCT
            sc.supervisor_id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            (SELECT message FROM supervisor_chats 
             WHERE supervisor_id = sc.supervisor_id 
             ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT created_at FROM supervisor_chats 
             WHERE supervisor_id = sc.supervisor_id 
             ORDER BY created_at DESC LIMIT 1) as last_message_time,
            (SELECT COUNT(*) FROM supervisor_chats 
             WHERE supervisor_id = sc.supervisor_id AND sender_role = 'supervisor' AND is_read = 0) as unread_count
        FROM supervisor_chats sc
        LEFT JOIN users u ON sc.supervisor_id = u.id
        ORDER BY last_message_time DESC
    `;
    return db.query(sql);
};

module.exports = {
    getContractorsList,
    getContractorStaff,
    saveAttendance,
    getAttendanceByDate,
    updatePayroll,
    getPayrollByWeek,
    createWeeklyReport,
    getWeeklyReport,
    getWeeklyReportsBySupervisor,
    updateReportPdfPath,
    markReportSubmittedToAdmin,
    sendMessage,
    getMessages,
    markMessagesAsRead,
    getUnreadCount,
    adminReplyToSupervisor,
    getSupervisorChatList
};