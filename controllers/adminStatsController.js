const db = require('../config/db');

// ==================== DASHBOARD STATISTICS ====================

const getDashboardStats = async (req, res) => {
    try {
        // Get all stats in parallel for better performance
        const [
            totalServices,
            totalStaff,
            totalBookings,
            pendingBookings,
            confirmedBookings,
            inProgressBookings,
            completedBookings,
            cancelledBookings,
            totalCustomers,
            totalRevenue,
            unpaidRevenue,
            paidRevenue,
            totalContractors,
            activeContractors,
            expiringContractors,
            totalJobApplications,
            pendingApplications,
            reviewedApplications,
            shortlistedApplications,
            hiredApplications,
            rejectedApplications,
            totalInquiries,
            unreadInquiries,
            readInquiries,
            repliedInquiries,
            totalFeedbacks,
            avgRating,
            totalPayments,
            totalPaymentAmount,
            todayBookings,
            todayRevenue,
            thisWeekBookings,
            thisWeekRevenue,
            thisMonthBookings,
            thisMonthRevenue
        ] = await Promise.all([
            // Services
            db.query(`SELECT COUNT(*) as count FROM services`),
            
            // Staff
            db.query(`SELECT COUNT(*) as count FROM users WHERE role = 'staff'`),
            
            // Bookings totals
            db.query(`SELECT COUNT(*) as count FROM bookings`),
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'`),
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'`),
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'in_progress'`),
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'completed'`),
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'cancelled'`),
            
            // Customers
            db.query(`SELECT COUNT(*) as count FROM users WHERE role = 'user'`),
            
            // Revenue
            db.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid' AND status != 'cancelled'`),
            db.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'unpaid' AND status != 'cancelled'`),
            db.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid' AND status != 'cancelled'`),
            
            // Contractors
            db.query(`SELECT COUNT(*) as count FROM contractors`),
            db.query(`SELECT COUNT(*) as count FROM contractors WHERE status = 'active'`),
            db.query(`SELECT COUNT(*) as count FROM contractors WHERE contract_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`),
            
            // Job Applications
            db.query(`SELECT COUNT(*) as count FROM job_applications`),
            db.query(`SELECT COUNT(*) as count FROM job_applications WHERE status = 'pending'`),
            db.query(`SELECT COUNT(*) as count FROM job_applications WHERE status = 'reviewed'`),
            db.query(`SELECT COUNT(*) as count FROM job_applications WHERE status = 'shortlisted'`),
            db.query(`SELECT COUNT(*) as count FROM job_applications WHERE status = 'hired'`),
            db.query(`SELECT COUNT(*) as count FROM job_applications WHERE status = 'rejected'`),
            
            // Contact Inquiries
            db.query(`SELECT COUNT(*) as count FROM contact_inquiries`),
            db.query(`SELECT COUNT(*) as count FROM contact_inquiries WHERE status = 'unread'`),
            db.query(`SELECT COUNT(*) as count FROM contact_inquiries WHERE status = 'read'`),
            db.query(`SELECT COUNT(*) as count FROM contact_inquiries WHERE status = 'replied'`),
            
            // Feedbacks
            db.query(`SELECT COUNT(*) as count FROM feedbacks`),
            db.query(`SELECT AVG(rating_value) as avg FROM feedbacks WHERE is_public = 1`),
            
            // Payments
            db.query(`SELECT COUNT(*) as count FROM payments WHERE payment_status = 'completed'`),
            db.query(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_status = 'completed'`),
            
            // Today's stats
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE DATE(created_at) = CURDATE()`),
            db.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE DATE(created_at) = CURDATE() AND payment_status = 'paid'`),
            
            // This week stats
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE YEARWEEK(created_at) = YEARWEEK(CURDATE())`),
            db.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE YEARWEEK(created_at) = YEARWEEK(CURDATE()) AND payment_status = 'paid'`),
            
            // This month stats
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`),
            db.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) AND payment_status = 'paid'`)
        ]);
        
        // Get monthly revenue trends (last 6 months) - FIXED GROUP BY
        const monthlyRevenue = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%M') as month,
                DATE_FORMAT(created_at, '%b') as month_short,
                MONTH(created_at) as month_num,
                YEAR(created_at) as year_num,
                COUNT(*) as bookings,
                COALESCE(SUM(total_price), 0) as revenue
            FROM bookings
            WHERE payment_status = 'paid' 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, '%M'), DATE_FORMAT(created_at, '%b')
            ORDER BY MIN(created_at) ASC
        `);
        
        // Get recent bookings (last 10)
        const recentBookings = await db.query(`
            SELECT 
                b.id,
                b.first_name,
                b.last_name,
                b.email,
                b.phone,
                b.total_price,
                b.status,
                b.payment_status,
                b.service_date,
                b.service_time,
                b.created_at,
                s.name as service_name,
                CONCAT(st.first_name, ' ', st.last_name) as staff_name
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN users st ON b.assigned_staff_id = st.id
            ORDER BY b.created_at DESC
            LIMIT 10
        `);
        
        // Get recent inquiries (last 5)
        const recentInquiries = await db.query(`
            SELECT 
                id,
                full_name,
                email,
                subject,
                status,
                created_at
            FROM contact_inquiries
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        // Get recent job applications (last 5)
        const recentApplications = await db.query(`
            SELECT 
                id,
                reference_number,
                full_name,
                position_applying,
                status,
                created_at
            FROM job_applications
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        // Get booking by service type
        const bookingsByService = await db.query(`
            SELECT 
                s.name as service_name,
                COUNT(b.id) as bookings_count,
                COALESCE(SUM(b.total_price), 0) as revenue
            FROM services s
            LEFT JOIN bookings b ON s.id = b.service_id
            GROUP BY s.id, s.name
            ORDER BY bookings_count DESC
            LIMIT 5
        `);
        
        // Get weekly booking trend - FIXED GROUP BY
        const weeklyTrend = await db.query(`
            SELECT 
                DAYNAME(service_date) as day,
                DAYOFWEEK(service_date) as day_num,
                COUNT(*) as bookings,
                COALESCE(SUM(total_price), 0) as revenue
            FROM bookings
            WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DAYNAME(service_date), DAYOFWEEK(service_date)
            ORDER BY day_num ASC
        `);
        
        // Get top performing staff
        const topStaff = await db.query(`
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.photo,
                COUNT(b.id) as total_jobs,
                SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                COALESCE(SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_price * 0.02 ELSE 0 END), 0) as earnings,
                ROUND(COALESCE(AVG(sr.average_rating), 0), 1) as avg_rating
            FROM users u
            LEFT JOIN bookings b ON u.id = b.assigned_staff_id
            LEFT JOIN staff_ratings sr ON u.id = sr.staff_id
            WHERE u.role = 'staff'
            GROUP BY u.id, u.first_name, u.last_name, u.photo
            HAVING total_jobs > 0
            ORDER BY completed_jobs DESC
            LIMIT 5
        `);
        
        // Get contractor summary
        const contractorSummary = await db.query(`
            SELECT 
                contractor_type,
                COUNT(*) as count,
                COALESCE(SUM(contract_value), 0) as total_value
            FROM contractors
            GROUP BY contractor_type
        `);
        
        // Get payment method distribution
        const paymentMethods = await db.query(`
            SELECT 
                payment_method,
                COUNT(*) as count,
                COALESCE(SUM(total_price), 0) as total
            FROM bookings
            WHERE payment_status = 'paid'
            GROUP BY payment_method
        `);
        
        res.json({
            success: true,
            stats: {
                // Summary Cards
                summary: {
                    total_services: totalServices[0]?.count || 0,
                    total_staff: totalStaff[0]?.count || 0,
                    total_customers: totalCustomers[0]?.count || 0,
                    total_bookings: totalBookings[0]?.count || 0,
                    total_revenue: parseFloat(totalRevenue[0]?.total || 0),
                    pending_revenue: parseFloat(unpaidRevenue[0]?.total || 0),
                    total_contractors: totalContractors[0]?.count || 0,
                    total_applications: totalJobApplications[0]?.count || 0,
                    total_inquiries: totalInquiries[0]?.count || 0,
                    unread_inquiries: unreadInquiries[0]?.count || 0,
                    total_feedbacks: totalFeedbacks[0]?.count || 0,
                    avg_rating: parseFloat(avgRating[0]?.avg || 0).toFixed(1),
                    total_payments: totalPayments[0]?.count || 0,
                    total_payment_amount: parseFloat(totalPaymentAmount[0]?.total || 0)
                },
                
                // Booking Status Breakdown
                bookings: {
                    total: totalBookings[0]?.count || 0,
                    pending: pendingBookings[0]?.count || 0,
                    confirmed: confirmedBookings[0]?.count || 0,
                    in_progress: inProgressBookings[0]?.count || 0,
                    completed: completedBookings[0]?.count || 0,
                    cancelled: cancelledBookings[0]?.count || 0,
                    completion_rate: totalBookings[0]?.count > 0 
                        ? Math.round((completedBookings[0]?.count / totalBookings[0]?.count) * 100)
                        : 0
                },
                
                // Time-based Stats
                time_stats: {
                    today: {
                        bookings: todayBookings[0]?.count || 0,
                        revenue: parseFloat(todayRevenue[0]?.total || 0)
                    },
                    this_week: {
                        bookings: thisWeekBookings[0]?.count || 0,
                        revenue: parseFloat(thisWeekRevenue[0]?.total || 0)
                    },
                    this_month: {
                        bookings: thisMonthBookings[0]?.count || 0,
                        revenue: parseFloat(thisMonthRevenue[0]?.total || 0)
                    }
                },
                
                // Revenue Stats
                revenue: {
                    total_earned: parseFloat(totalRevenue[0]?.total || 0),
                    pending_amount: parseFloat(unpaidRevenue[0]?.total || 0),
                    paid_amount: parseFloat(paidRevenue[0]?.total || 0),
                    monthly_trend: monthlyRevenue,
                    by_payment_method: paymentMethods,
                    by_service: bookingsByService
                },
                
                // Contractor Stats
                contractors: {
                    total: totalContractors[0]?.count || 0,
                    active: activeContractors[0]?.count || 0,
                    expiring_soon: expiringContractors[0]?.count || 0,
                    by_type: contractorSummary
                },
                
                // Job Application Stats
                job_applications: {
                    total: totalJobApplications[0]?.count || 0,
                    pending: pendingApplications[0]?.count || 0,
                    reviewed: reviewedApplications[0]?.count || 0,
                    shortlisted: shortlistedApplications[0]?.count || 0,
                    hired: hiredApplications[0]?.count || 0,
                    rejected: rejectedApplications[0]?.count || 0
                },
                
                // Inquiry Stats
                inquiries: {
                    total: totalInquiries[0]?.count || 0,
                    unread: unreadInquiries[0]?.count || 0,
                    read: readInquiries[0]?.count || 0,
                    replied: repliedInquiries[0]?.count || 0
                },
                
                // Weekly Trend
                weekly_trend: weeklyTrend,
                
                // Top Performers
                top_performers: topStaff,
                
                // Recent Activities
                recent_activities: {
                    bookings: recentBookings,
                    inquiries: recentInquiries,
                    applications: recentApplications
                }
            }
        });
        
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch dashboard statistics', 
            error: error.message 
        });
    }
};

// ==================== GET RECENT BOOKINGS ONLY ====================

const getRecentBookings = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const bookings = await db.query(`
            SELECT 
                b.id,
                b.first_name,
                b.last_name,
                b.email,
                b.phone,
                b.total_price,
                b.status,
                b.payment_status,
                b.service_date,
                b.service_time,
                b.created_at,
                s.name as service_name,
                CONCAT(st.first_name, ' ', st.last_name) as staff_name,
                st.photo as staff_photo
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN users st ON b.assigned_staff_id = st.id
            ORDER BY b.created_at DESC
            LIMIT ?
        `, [limit]);
        
        res.json({
            success: true,
            count: bookings.length,
            bookings: bookings
        });
        
    } catch (error) {
        console.error('Get recent bookings error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch recent bookings', 
            error: error.message 
        });
    }
};

// ==================== GET CHART DATA ====================

const getChartData = async (req, res) => {
    try {
        const { period = 'monthly' } = req.query;
        
        let revenueData = [];
        
        if (period === 'weekly') {
            // Last 7 days
            revenueData = await db.query(`
                SELECT 
                    DATE(created_at) as date,
                    DAYNAME(created_at) as day,
                    COALESCE(SUM(total_price), 0) as revenue,
                    COUNT(*) as bookings
                FROM bookings
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                AND payment_status = 'paid'
                GROUP BY DATE(created_at), DAYNAME(created_at)
                ORDER BY created_at ASC
            `);
        } else if (period === 'monthly') {
            // Last 6 months
            revenueData = await db.query(`
                SELECT 
                    DATE_FORMAT(created_at, '%b %Y') as month,
                    YEAR(created_at) as year_num,
                    MONTH(created_at) as month_num,
                    COALESCE(SUM(total_price), 0) as revenue,
                    COUNT(*) as bookings
                FROM bookings
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                AND payment_status = 'paid'
                GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, '%b %Y')
                ORDER BY MIN(created_at) ASC
            `);
        } else if (period === 'yearly') {
            // Last 5 years
            revenueData = await db.query(`
                SELECT 
                    YEAR(created_at) as year,
                    COALESCE(SUM(total_price), 0) as revenue,
                    COUNT(*) as bookings
                FROM bookings
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 5 YEAR)
                AND payment_status = 'paid'
                GROUP BY YEAR(created_at)
                ORDER BY created_at ASC
            `);
        }
        
        res.json({
            success: true,
            period: period,
            data: revenueData
        });
        
    } catch (error) {
        console.error('Get chart data error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch chart data', 
            error: error.message 
        });
    }
};

// ==================== GET QUICK STATS (for dashboard cards) ====================

const getQuickStats = async (req, res) => {
    try {
        const [
            totalBookings,
            totalRevenue,
            totalCustomers,
            totalStaff,
            pendingBookings,
            completedBookings,
            totalInquiries,
            unreadInquiries,
            totalApplications,
            pendingApplications
        ] = await Promise.all([
            db.query(`SELECT COUNT(*) as count FROM bookings`),
            db.query(`SELECT COALESCE(SUM(total_price), 0) as total FROM bookings WHERE payment_status = 'paid'`),
            db.query(`SELECT COUNT(*) as count FROM users WHERE role = 'user'`),
            db.query(`SELECT COUNT(*) as count FROM users WHERE role = 'staff'`),
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'`),
            db.query(`SELECT COUNT(*) as count FROM bookings WHERE status = 'completed'`),
            db.query(`SELECT COUNT(*) as count FROM contact_inquiries`),
            db.query(`SELECT COUNT(*) as count FROM contact_inquiries WHERE status = 'unread'`),
            db.query(`SELECT COUNT(*) as count FROM job_applications`),
            db.query(`SELECT COUNT(*) as count FROM job_applications WHERE status = 'pending'`)
        ]);
        
        res.json({
            success: true,
            stats: {
                total_bookings: totalBookings[0]?.count || 0,
                total_revenue: parseFloat(totalRevenue[0]?.total || 0),
                total_customers: totalCustomers[0]?.count || 0,
                total_staff: totalStaff[0]?.count || 0,
                pending_bookings: pendingBookings[0]?.count || 0,
                completed_bookings: completedBookings[0]?.count || 0,
                total_inquiries: totalInquiries[0]?.count || 0,
                unread_inquiries: unreadInquiries[0]?.count || 0,
                total_applications: totalApplications[0]?.count || 0,
                pending_applications: pendingApplications[0]?.count || 0
            }
        });
        
    } catch (error) {
        console.error('Get quick stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch quick stats', 
            error: error.message 
        });
    }
};

module.exports = {
    getDashboardStats,
    getRecentBookings,
    getChartData,
    getQuickStats
};