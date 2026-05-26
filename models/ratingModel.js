const db = require('../config/db');

// ==================== CREATE RATING ====================

const createRating = async (data) => {
    const sql = `
        INSERT INTO staff_ratings (
            booking_id, customer_id, staff_id,
            satisfaction_rating, punctuality_rating, cleanliness_rating,
            review_text, is_public, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.query(sql, [
        data.booking_id,
        data.customer_id,
        data.staff_id,
        data.satisfaction_rating,
        data.punctuality_rating,
        data.cleanliness_rating,
        data.review_text || null,
        data.is_public !== undefined ? data.is_public : 1,
        'approved'  // Auto-approve for now
    ]);
    
    // Update staff rating summary
    await updateStaffRatingSummary(data.staff_id);
    
    return { rating_id: result.insertId };
};

// ==================== UPDATE STAFF RATING SUMMARY ====================

const updateStaffRatingSummary = async (staffId) => {
    // Calculate averages
    const stats = await db.query(`
        SELECT 
            COUNT(*) as total_ratings,
            AVG(satisfaction_rating) as avg_satisfaction,
            AVG(punctuality_rating) as avg_punctuality,
            AVG(cleanliness_rating) as avg_cleanliness,
            AVG(average_rating) as overall_avg,
            SUM(CASE WHEN average_rating >= 4.5 THEN 1 ELSE 0 END) as five_star,
            SUM(CASE WHEN average_rating >= 3.5 AND average_rating < 4.5 THEN 1 ELSE 0 END) as four_star,
            SUM(CASE WHEN average_rating >= 2.5 AND average_rating < 3.5 THEN 1 ELSE 0 END) as three_star,
            SUM(CASE WHEN average_rating >= 1.5 AND average_rating < 2.5 THEN 1 ELSE 0 END) as two_star,
            SUM(CASE WHEN average_rating < 1.5 THEN 1 ELSE 0 END) as one_star
        FROM staff_ratings
        WHERE staff_id = ? AND status = 'approved'
    `, [staffId]);
    
    const s = stats[0];
    
    // Upsert into summary table
    await db.query(`
        INSERT INTO staff_rating_summary (
            staff_id, total_ratings, 
            average_satisfaction, average_punctuality, average_cleanliness,
            overall_average,
            five_star_count, four_star_count, three_star_count, two_star_count, one_star_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            total_ratings = VALUES(total_ratings),
            average_satisfaction = VALUES(average_satisfaction),
            average_punctuality = VALUES(average_punctuality),
            average_cleanliness = VALUES(average_cleanliness),
            overall_average = VALUES(overall_average),
            five_star_count = VALUES(five_star_count),
            four_star_count = VALUES(four_star_count),
            three_star_count = VALUES(three_star_count),
            two_star_count = VALUES(two_star_count),
            one_star_count = VALUES(one_star_count)
    `, [
        staffId,
        s.total_ratings || 0,
        s.avg_satisfaction || 0,
        s.avg_punctuality || 0,
        s.avg_cleanliness || 0,
        s.overall_avg || 0,
        s.five_star || 0,
        s.four_star || 0,
        s.three_star || 0,
        s.two_star || 0,
        s.one_star || 0
    ]);
    
    // Update users table for quick access
    await db.query(`
        UPDATE users 
        SET total_ratings = ?, avg_rating = ?
        WHERE id = ?
    `, [s.total_ratings || 0, s.overall_avg || 0, staffId]);
    
    return { success: true };
};

// ==================== GET RATINGS BY STAFF ====================

const getRatingsByStaffId = async (staffId, filters = {}) => {
    let sql = `
        SELECT 
            sr.*,
            u.first_name as customer_first_name,
            u.last_name as customer_last_name,
            b.service_date,
            s.name as service_name
        FROM staff_ratings sr
        LEFT JOIN users u ON sr.customer_id = u.id
        LEFT JOIN bookings b ON sr.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE sr.staff_id = ? AND sr.status = 'approved'
    `;
    const values = [staffId];
    
    if (filters.min_rating) {
        sql += ` AND sr.average_rating >= ?`;
        values.push(parseFloat(filters.min_rating));
    }
    
    if (filters.date_from) {
        sql += ` AND sr.created_at >= ?`;
        values.push(filters.date_from);
    }
    
    if (filters.date_to) {
        sql += ` AND sr.created_at <= ?`;
        values.push(filters.date_to + ' 23:59:59');
    }
    
    sql += ` ORDER BY sr.created_at DESC`;
    
    if (filters.limit) {
        sql += ` LIMIT ?`;
        values.push(parseInt(filters.limit));
    }
    
    return db.query(sql, values);
};

const getStaffRatingSummary = async (staffId) => {
    const sql = `
        SELECT 
            srs.*,
            u.first_name,
            u.last_name,
            u.email,
            u.photo
        FROM staff_rating_summary srs
        LEFT JOIN users u ON srs.staff_id = u.id
        WHERE srs.staff_id = ?
    `;
    const result = await db.query(sql, [staffId]);
    return result[0] || null;
};

// ==================== GET RATINGS BY CUSTOMER ====================

const getRatingsByCustomerId = async (customerId) => {
    const sql = `
        SELECT 
            sr.*,
            st.first_name as staff_first_name,
            st.last_name as staff_last_name,
            b.service_date,
            s.name as service_name
        FROM staff_ratings sr
        LEFT JOIN users st ON sr.staff_id = st.id
        LEFT JOIN bookings b ON sr.booking_id = b.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE sr.customer_id = ?
        ORDER BY sr.created_at DESC
    `;
    return db.query(sql, [customerId]);
};

// ==================== GET RATING BY BOOKING ====================

const getRatingByBookingId = async (bookingId) => {
    const sql = `
        SELECT * FROM staff_ratings WHERE booking_id = ?
    `;
    const result = await db.query(sql, [bookingId]);
    return result[0] || null;
};

// ==================== CHECK IF BOOKING CAN BE RATED ====================

const canRateBooking = async (bookingId, customerId) => {
    const sql = `
        SELECT 
            b.id,
            b.status,
            b.assigned_staff_id,
            b.user_id as customer_id
        FROM bookings b
        WHERE b.id = ? AND b.user_id = ? AND b.status = 'completed'
    `;
    const booking = await db.query(sql, [bookingId, customerId]);
    
    if (booking.length === 0) {
        return { can_rate: false, reason: 'Booking not found, not yours, or not completed' };
    }
    
    // Check if already rated
    const existingRating = await getRatingByBookingId(bookingId);
    if (existingRating) {
        return { can_rate: false, reason: 'You have already rated this service' };
    }
    
    return { 
        can_rate: true, 
        staff_id: booking[0].assigned_staff_id,
        booking: booking[0]
    };
};

// ==================== GET RATABLE BOOKINGS FOR CUSTOMER ====================

const getRatableBookings = async (customerId) => {
    const sql = `
        SELECT 
            b.id,
            b.service_date,
            b.service_time,
            b.total_price,
            b.status,
            s.name as service_name,
            u.id as staff_id,
            u.first_name as staff_first_name,
            u.last_name as staff_last_name,
            u.photo as staff_photo,
            (SELECT COUNT(*) FROM staff_ratings WHERE booking_id = b.id) as is_rated
        FROM bookings b
        LEFT JOIN services s ON b.service_id = s.id
        LEFT JOIN users u ON b.assigned_staff_id = u.id
        WHERE b.user_id = ? 
        AND b.status = 'completed'
        AND b.assigned_staff_id IS NOT NULL
        HAVING is_rated = 0
        ORDER BY b.service_date DESC
    `;
    return db.query(sql, [customerId]);
};

// ==================== GET TOP RATED STAFF (FIXED) ====================

const getTopRatedStaff = async (limit = 10) => {
    // Ensure limit is a number, not a string
    const numericLimit = parseInt(limit) || 10;
    
    const sql = `
        SELECT 
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.photo,
            u.staff_type,
            srs.total_ratings,
            srs.overall_average,
            srs.average_satisfaction,
            srs.average_punctuality,
            srs.average_cleanliness,
            srs.five_star_count,
            srs.four_star_count
        FROM staff_rating_summary srs
        LEFT JOIN users u ON srs.staff_id = u.id
        WHERE u.role = 'staff' AND srs.total_ratings > 0
        ORDER BY srs.overall_average DESC, srs.total_ratings DESC
        LIMIT ?
    `;
    return db.query(sql, [numericLimit]);
};

// ==================== UPDATE RATING (Admin only) ====================

const updateRatingStatus = async (ratingId, status) => {
    await db.query(
        `UPDATE staff_ratings SET status = ? WHERE id = ?`,
        [status, ratingId]
    );
    
    // Get staff_id to update summary
    const rating = await db.query(`SELECT staff_id FROM staff_ratings WHERE id = ?`, [ratingId]);
    if (rating.length > 0) {
        await updateStaffRatingSummary(rating[0].staff_id);
    }
    
    return { success: true };
};

const deleteRating = async (ratingId) => {
    const rating = await db.query(`SELECT staff_id FROM staff_ratings WHERE id = ?`, [ratingId]);
    await db.query(`DELETE FROM staff_ratings WHERE id = ?`, [ratingId]);
    
    if (rating.length > 0) {
        await updateStaffRatingSummary(rating[0].staff_id);
    }
    
    return { success: true };
};

// ==================== ADMIN GET ALL RATINGS ====================

const getAllRatings = async (filters = {}) => {
    let sql = `
        SELECT 
            sr.*,
            c.first_name as customer_first_name,
            c.last_name as customer_last_name,
            c.email as customer_email,
            s.first_name as staff_first_name,
            s.last_name as staff_last_name,
            s.email as staff_email,
            b.service_date,
            sv.name as service_name
        FROM staff_ratings sr
        LEFT JOIN users c ON sr.customer_id = c.id
        LEFT JOIN users s ON sr.staff_id = s.id
        LEFT JOIN bookings b ON sr.booking_id = b.id
        LEFT JOIN services sv ON b.service_id = sv.id
        WHERE 1=1
    `;
    const values = [];
    
    if (filters.status) {
        sql += ` AND sr.status = ?`;
        values.push(filters.status);
    }
    
    if (filters.staff_id) {
        sql += ` AND sr.staff_id = ?`;
        values.push(filters.staff_id);
    }
    
    if (filters.min_rating) {
        sql += ` AND sr.average_rating >= ?`;
        values.push(parseFloat(filters.min_rating));
    }
    
    if (filters.date_from) {
        sql += ` AND sr.created_at >= ?`;
        values.push(filters.date_from);
    }
    
    if (filters.date_to) {
        sql += ` AND sr.created_at <= ?`;
        values.push(filters.date_to + ' 23:59:59');
    }
    
    sql += ` ORDER BY sr.created_at DESC`;
    
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

const getRatingStats = async () => {
    const sql = `
        SELECT 
            COUNT(*) as total_ratings,
            AVG(satisfaction_rating) as avg_satisfaction,
            AVG(punctuality_rating) as avg_punctuality,
            AVG(cleanliness_rating) as avg_cleanliness,
            AVG(average_rating) as overall_avg,
            COUNT(DISTINCT staff_id) as staff_with_ratings,
            COUNT(DISTINCT customer_id) as customers_who_rated
        FROM staff_ratings
        WHERE status = 'approved'
    `;
    return db.query(sql);
};

module.exports = {
    createRating,
    getRatingsByStaffId,
    getStaffRatingSummary,
    getRatingsByCustomerId,
    getRatingByBookingId,
    canRateBooking,
    getRatableBookings,
    getTopRatedStaff,
    updateRatingStatus,
    deleteRating,
    getAllRatings,
    getRatingStats,
    updateStaffRatingSummary
};