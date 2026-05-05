const db = require('../config/db');

// ==================== REPORT GENERATION ====================

const saveReport = async (data) => {
    const sql = `
        INSERT INTO reports (
            report_type, report_format, date_from, date_to,
            generated_by, file_path, report_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return db.query(sql, [
        data.report_type,
        data.report_format,
        data.date_from,
        data.date_to,
        data.generated_by,
        data.file_path || null,
        JSON.stringify(data.report_data)
    ]);
};

const getReportById = async (id) => {
    return db.query(`
        SELECT r.*, u.first_name, u.last_name, u.email 
        FROM reports r
        LEFT JOIN users u ON r.generated_by = u.id
        WHERE r.id = ?
    `, [id]);
};

const getAllReports = async (filters = {}) => {
    let sql = `
        SELECT r.*, u.first_name, u.last_name 
        FROM reports r
        LEFT JOIN users u ON r.generated_by = u.id
        WHERE 1=1
    `;
    const values = [];

    if (filters.report_type) {
        sql += ` AND r.report_type = ?`;
        values.push(filters.report_type);
    }
    if (filters.date_from) {
        sql += ` AND r.created_at >= ?`;
        values.push(filters.date_from);
    }
    if (filters.date_to) {
        sql += ` AND r.created_at <= ?`;
        values.push(filters.date_to + ' 23:59:59');
    }

    sql += ` ORDER BY r.created_at DESC`;

    if (filters.limit) {
        sql += ` LIMIT ?`;
        values.push(parseInt(filters.limit));
    }

    return db.query(sql, values);
};

// ==================== BOOKING ANALYTICS ====================

const getBookingStatsByDateRange = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_bookings,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(total_price) as total_revenue
        FROM bookings
        WHERE created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

const getBookingTrends = async (dateFrom, dateTo) => {
    // Daily trends
    const dailyTrends = await getBookingStatsByDateRange(dateFrom, dateTo);

    // Weekly trends
    const weeklySql = `
        SELECT 
            YEARWEEK(created_at) as week,
            MIN(DATE(created_at)) as week_start,
            MAX(DATE(created_at)) as week_end,
            COUNT(*) as total_bookings,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(total_price) as total_revenue
        FROM bookings
        WHERE created_at BETWEEN ? AND ?
        GROUP BY YEARWEEK(created_at)
        ORDER BY week ASC
    `;

    const weeklyTrends = await db.query(weeklySql, [dateFrom, dateTo + ' 23:59:59']);

    // Monthly trends
    const monthlySql = `
        SELECT 
            DATE_FORMAT(created_at, '%Y-%m') as month,
            COUNT(*) as total_bookings,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(total_price) as total_revenue
        FROM bookings
        WHERE created_at BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month ASC
    `;

    const monthlyTrends = await db.query(monthlySql, [dateFrom, dateTo + ' 23:59:59']);

    return { daily: dailyTrends, weekly: weeklyTrends, monthly: monthlyTrends };
};

const getBookingStatusDistribution = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            status,
            COUNT(*) as count,
            SUM(total_price) as total_value
        FROM bookings
        WHERE created_at BETWEEN ? AND ?
        GROUP BY status
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

const getBookingByService = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            b.service_id,
            s.name as service_name,
            COUNT(*) as booking_count,
            SUM(b.total_price) as total_revenue,
            AVG(b.total_price) as average_price,
            AVG(b.cleaners) as avg_cleaners,
            AVG(b.hours) as avg_hours
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.created_at BETWEEN ? AND ?
        GROUP BY b.service_id, s.name
        ORDER BY booking_count DESC
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

const getBookingByLocation = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            city,
            COUNT(*) as booking_count,
            SUM(total_price) as total_revenue,
            COUNT(DISTINCT user_id) as unique_customers
        FROM bookings
        WHERE created_at BETWEEN ? AND ?
        GROUP BY city
        ORDER BY booking_count DESC
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

// ==================== REVENUE ANALYTICS ====================

const getRevenueStats = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_bookings,
            SUM(total_price) as gross_revenue,
            SUM(extras) as total_extras,
            SUM(discount) as total_discounts,
            SUM(total_price) - SUM(discount) as net_revenue,
            AVG(total_price) as average_order_value
        FROM bookings
        WHERE created_at BETWEEN ? AND ?
        AND status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

const getRevenueByPaymentMethod = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            payment_method,
            COUNT(*) as transaction_count,
            SUM(total_price) as total_amount,
            AVG(total_price) as average_amount
        FROM bookings
        WHERE created_at BETWEEN ? AND ?
        AND status != 'cancelled'
        GROUP BY payment_method
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

const getRevenueSummary = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            COUNT(*) as total_bookings,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
            SUM(CASE WHEN status != 'cancelled' THEN total_price ELSE 0 END) as gross_revenue,
            SUM(CASE WHEN status = 'completed' THEN total_price ELSE 0 END) as earned_revenue,
            SUM(extras) as total_extras,
            SUM(discount) as total_discounts,
            AVG(CASE WHEN status != 'cancelled' THEN total_price ELSE NULL END) as avg_order_value,
            MAX(total_price) as highest_order,
            MIN(CASE WHEN status != 'cancelled' THEN total_price ELSE NULL END) as lowest_order
        FROM bookings
        WHERE created_at BETWEEN ? AND ?
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

// ==================== STAFF PERFORMANCE ====================

const getStaffPerformance = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            b.assigned_staff_id,
            b.assigned_staff_name,
            u.staff_type,
            u.phone as staff_phone,
            u.email as staff_email,
            COUNT(*) as total_assignments,
            SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
            SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_jobs,
            SUM(b.total_price) as total_revenue_handled,
            AVG(b.total_price) as avg_job_value,
            AVG(CASE WHEN b.status = 'completed' THEN b.hours ELSE NULL END) as avg_hours_per_job
        FROM bookings b
        LEFT JOIN users u ON b.assigned_staff_id = u.id
        WHERE b.created_at BETWEEN ? AND ?
        AND b.assigned_staff_id IS NOT NULL
        GROUP BY b.assigned_staff_id, b.assigned_staff_name, u.staff_type, u.phone, u.email
        ORDER BY completed_jobs DESC
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

const getTopPerformers = async (dateFrom, dateTo, limit = 10) => {
    const sql = `
        SELECT 
            b.assigned_staff_id,
            b.assigned_staff_name,
            COUNT(*) as total_jobs,
            SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed,
            ROUND(
                (SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1
            ) as completion_rate,
            SUM(b.total_price) as revenue_generated
        FROM bookings b
        WHERE b.created_at BETWEEN ? AND ?
        AND b.assigned_staff_id IS NOT NULL
        GROUP BY b.assigned_staff_id, b.assigned_staff_name
        HAVING COUNT(*) >= 1
        ORDER BY completed DESC, completion_rate DESC
        LIMIT ?
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59', limit]);
};

// ==================== CONTRACTOR ANALYTICS ====================

const getContractorStats = async (dateFrom, dateTo) => {
    const sql = `
        SELECT 
            contractor_type,
            COUNT(*) as total_contractors,
            SUM(workers_count) as total_workers,
            SUM(contract_value) as total_contract_value,
            AVG(contract_value) as avg_contract_value,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contracts,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_contracts,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_contracts,
            SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated_contracts
        FROM contractors
        WHERE created_at BETWEEN ? AND ?
        GROUP BY contractor_type
    `;

    return db.query(sql, [dateFrom, dateTo + ' 23:59:59']);
};

const getContractorExpiringSoon = async (daysThreshold = 30) => {
    const sql = `
        SELECT 
            id, company_name, contractor_type, location,
            contract_end_date,
            DATEDIFF(contract_end_date, CURDATE()) as days_remaining,
            contract_value, contact_person, contact_phone
        FROM contractors
        WHERE status = 'active'
        AND contract_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ORDER BY days_remaining ASC
    `;

    return db.query(sql, [daysThreshold]);
};

// ==================== COMPREHENSIVE REPORT ====================

const getComprehensiveReport = async (dateFrom, dateTo) => {
    const report = {};

    // Booking summary
    report.booking_summary = await getRevenueSummary(dateFrom, dateTo);

    // Revenue by service
    report.revenue_by_service = await getBookingByService(dateFrom, dateTo);

    // Staff performance
    report.staff_performance = await getStaffPerformance(dateFrom, dateTo);

    // Contractor stats
    report.contractor_stats = await getContractorStats(dateFrom, dateTo);

    // Status distribution
    report.status_distribution = await getBookingStatusDistribution(dateFrom, dateTo);

    // Revenue by payment method
    report.revenue_by_payment = await getRevenueByPaymentMethod(dateFrom, dateTo);

    // Location analysis
    report.location_analysis = await getBookingByLocation(dateFrom, dateTo);

    return report;
};

// ==================== CACHE FUNCTIONS ====================

const getCachedData = async (cacheKey) => {
    const result = await db.query(
        `SELECT cache_data FROM analytics_cache WHERE cache_key = ? AND expires_at > NOW()`,
        [cacheKey]
    );
    return result.length > 0 ? result[0].cache_data : null;
};

const setCachedData = async (cacheKey, data, expiryMinutes = 60) => {
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    
    await db.query(
        `INSERT INTO analytics_cache (cache_key, cache_data, expires_at) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE cache_data = ?, expires_at = ?`,
        [cacheKey, JSON.stringify(data), expiresAt, JSON.stringify(data), expiresAt]
    );
};

module.exports = {
    saveReport,
    getReportById,
    getAllReports,
    getBookingTrends,
    getBookingStatusDistribution,
    getBookingByService,
    getBookingByLocation,
    getRevenueStats,
    getRevenueByPaymentMethod,
    getRevenueSummary,
    getStaffPerformance,
    getTopPerformers,
    getContractorStats,
    getContractorExpiringSoon,
    getComprehensiveReport,
    getCachedData,
    setCachedData
};