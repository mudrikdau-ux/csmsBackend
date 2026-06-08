const db = require('../config/db');

// ==================== REPORT CRUD ====================

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
    const dailyTrends = await getBookingStatsByDateRange(dateFrom, dateTo);

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

// ==================== STAFF REPORT (ALL STAFFS) ====================

const getStaffReportData = async (dateFrom, dateTo) => {
    // Get all staff members with their personal details
    const staffList = await db.query(`
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.address,
            u.gender,
            u.staff_type,
            u.photo,
            u.created_at as joined_date,
            u.rating as avg_rating,
            u.total_ratings
        FROM users u
        WHERE u.role = 'staff'
        ORDER BY u.first_name ASC
    `);

    // Summary statistics
    const summary = await db.query(`
        SELECT 
            COUNT(*) as total_staff,
            SUM(CASE WHEN staff_type = 'supervisor' THEN 1 ELSE 0 END) as total_supervisors,
            SUM(CASE WHEN staff_type = 'general_supervisor' THEN 1 ELSE 0 END) as total_general_supervisors,
            SUM(CASE WHEN staff_type = 'normal' THEN 1 ELSE 0 END) as total_normal_staff,
            ROUND(AVG(rating), 1) as average_rating,
            SUM(total_ratings) as total_customer_ratings
        FROM users
        WHERE role = 'staff'
    `);

    // For each staff, get their job statistics
    const staffWithDetails = await Promise.all(staffList.map(async (staff) => {
        // Get job statistics within date range
        const jobStats = await db.query(`
            SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_jobs,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_jobs,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_jobs,
                SUM(total_price) as total_revenue,
                SUM(CASE WHEN payment_status = 'paid' THEN total_price ELSE 0 END) as collected_revenue,
                SUM(CASE WHEN status = 'completed' AND payment_status = 'paid' THEN total_price * 0.02 ELSE 0 END) as total_earnings
            FROM bookings
            WHERE assigned_staff_id = ?
            AND created_at BETWEEN ? AND ?
        `, [staff.id, dateFrom, dateTo + ' 23:59:59']);

        // Get current assignments
        const currentAssignments = await db.query(`
            SELECT 
                b.id,
                b.service_date,
                b.service_time,
                b.address,
                b.city,
                b.total_price,
                b.status,
                s.name as service_name,
                CONCAT(b.first_name, ' ', b.last_name) as customer_name
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            WHERE b.assigned_staff_id = ? 
            AND b.status IN ('confirmed', 'in_progress', 'pending')
            AND b.created_at BETWEEN ? AND ?
            ORDER BY b.service_date ASC
            LIMIT 3
        `, [staff.id, dateFrom, dateTo + ' 23:59:59']);

        // Get recent completed jobs
        const recentJobs = await db.query(`
            SELECT 
                b.id,
                b.service_date,
                b.completed_date,
                b.total_price,
                s.name as service_name,
                CONCAT(b.first_name, ' ', b.last_name) as customer_name
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            WHERE b.assigned_staff_id = ? 
            AND b.status = 'completed'
            AND b.created_at BETWEEN ? AND ?
            ORDER BY b.completed_date DESC
            LIMIT 3
        `, [staff.id, dateFrom, dateTo + ' 23:59:59']);

        // Get rating summary
        const ratingSummary = await db.query(`
            SELECT 
                COUNT(*) as total_ratings,
                ROUND(AVG(satisfaction_rating), 1) as avg_satisfaction,
                ROUND(AVG(punctuality_rating), 1) as avg_punctuality,
                ROUND(AVG(cleanliness_rating), 1) as avg_cleanliness,
                ROUND(AVG(average_rating), 1) as overall_rating
            FROM staff_ratings
            WHERE staff_id = ? AND status = 'approved'
        `, [staff.id]);

        return {
            personal_info: {
                id: staff.id,
                first_name: staff.first_name,
                last_name: staff.last_name,
                full_name: `${staff.first_name} ${staff.last_name}`,
                email: staff.email,
                phone: staff.phone || 'Not provided',
                address: staff.address || 'Not provided',
                gender: staff.gender || 'Not specified',
                staff_type: staff.staff_type || 'normal',
                staff_type_label: staff.staff_type === 'supervisor' ? 'Supervisor' : 
                                 staff.staff_type === 'general_supervisor' ? 'General Supervisor' : 'Staff',
                joined_date: staff.joined_date,
                photo: staff.photo ? `/uploads/staff/${staff.photo}` : null
            },
            job_statistics: {
                total_jobs: parseInt(jobStats[0]?.total_jobs) || 0,
                completed_jobs: parseInt(jobStats[0]?.completed_jobs) || 0,
                in_progress_jobs: parseInt(jobStats[0]?.in_progress_jobs) || 0,
                pending_jobs: parseInt(jobStats[0]?.pending_jobs) || 0,
                confirmed_jobs: parseInt(jobStats[0]?.confirmed_jobs) || 0,
                cancelled_jobs: parseInt(jobStats[0]?.cancelled_jobs) || 0,
                completion_rate: jobStats[0]?.total_jobs > 0 
                    ? Math.round((jobStats[0]?.completed_jobs / jobStats[0]?.total_jobs) * 100) 
                    : 0,
                total_revenue: parseFloat(jobStats[0]?.total_revenue) || 0,
                collected_revenue: parseFloat(jobStats[0]?.collected_revenue) || 0,
                total_earnings: parseFloat(jobStats[0]?.total_earnings) || 0
            },
            ratings: {
                total_ratings: parseInt(ratingSummary[0]?.total_ratings) || 0,
                average_satisfaction: parseFloat(ratingSummary[0]?.avg_satisfaction) || 0,
                average_punctuality: parseFloat(ratingSummary[0]?.avg_punctuality) || 0,
                average_cleanliness: parseFloat(ratingSummary[0]?.avg_cleanliness) || 0,
                overall_rating: parseFloat(ratingSummary[0]?.overall_rating) || 0,
                rating_label: getRatingLabel(parseFloat(ratingSummary[0]?.overall_rating) || 0)
            },
            current_assignments: currentAssignments.map(a => ({
                id: a.id,
                service_name: a.service_name,
                customer_name: a.customer_name,
                service_date: a.service_date,
                service_time: a.service_time,
                address: `${a.address}, ${a.city}`,
                total_price: parseFloat(a.total_price),
                status: a.status
            })),
            recent_jobs: recentJobs.map(j => ({
                id: j.id,
                service_name: j.service_name,
                customer_name: j.customer_name,
                service_date: j.service_date,
                completed_date: j.completed_date,
                total_price: parseFloat(j.total_price)
            }))
        };
    }));

    // Calculate totals across all staff
    const totals = {
        total_jobs: staffWithDetails.reduce((sum, s) => sum + s.job_statistics.total_jobs, 0),
        total_completed_jobs: staffWithDetails.reduce((sum, s) => sum + s.job_statistics.completed_jobs, 0),
        total_revenue: staffWithDetails.reduce((sum, s) => sum + s.job_statistics.total_revenue, 0),
        total_earnings: staffWithDetails.reduce((sum, s) => sum + s.job_statistics.total_earnings, 0),
        average_completion_rate: staffWithDetails.length > 0 
            ? Math.round(staffWithDetails.reduce((sum, s) => sum + s.job_statistics.completion_rate, 0) / staffWithDetails.length)
            : 0
    };

    // Staff by type distribution
    const staffDistribution = {
        labels: ['Supervisors', 'General Supervisors', 'Normal Staff'],
        data: [summary[0]?.total_supervisors || 0, summary[0]?.total_general_supervisors || 0, summary[0]?.total_normal_staff || 0]
    };

    // Top performing staff
    const topPerformers = [...staffWithDetails]
        .sort((a, b) => b.job_statistics.completed_jobs - a.job_statistics.completed_jobs)
        .slice(0, 5)
        .map(s => ({
            name: s.personal_info.full_name,
            staff_type: s.personal_info.staff_type_label,
            completed_jobs: s.job_statistics.completed_jobs,
            completion_rate: s.job_statistics.completion_rate,
            total_revenue: s.job_statistics.total_revenue,
            rating: s.ratings.overall_rating
        }));

    return {
        summary: {
            total_staff: summary[0]?.total_staff || 0,
            total_supervisors: summary[0]?.total_supervisors || 0,
            total_general_supervisors: summary[0]?.total_general_supervisors || 0,
            total_normal_staff: summary[0]?.total_normal_staff || 0,
            average_rating: parseFloat(summary[0]?.average_rating || 0).toFixed(1),
            total_customer_ratings: summary[0]?.total_customer_ratings || 0
        },
        totals,
        staff_distribution: staffDistribution,
        top_performers: topPerformers,
        staff_list: staffWithDetails
    };
};

const getRatingLabel = (rating) => {
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 3.5) return 'Good';
    if (rating >= 2.5) return 'Average';
    if (rating >= 1.5) return 'Below Average';
    return 'Poor';
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

    report.booking_summary = await getRevenueSummary(dateFrom, dateTo);
    report.revenue_by_service = await getBookingByService(dateFrom, dateTo);
    report.contractor_stats = await getContractorStats(dateFrom, dateTo);
    report.status_distribution = await getBookingStatusDistribution(dateFrom, dateTo);
    report.revenue_by_payment = await getRevenueByPaymentMethod(dateFrom, dateTo);
    report.location_analysis = await getBookingByLocation(dateFrom, dateTo);
    report.staff_summary = await getStaffReportData(dateFrom, dateTo);

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
    getStaffReportData,
    getContractorStats,
    getContractorExpiringSoon,
    getComprehensiveReport,
    getCachedData,
    setCachedData
};