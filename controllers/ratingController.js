const {
    createRating,
    getRatingsByStaffId,
    getStaffRatingSummary,
    getRatingsByCustomerId,
    canRateBooking,
    getRatableBookings,
    getTopRatedStaff,
    getAllRatings,
    getRatingStats,
    updateRatingStatus,
    deleteRating
} = require('../models/ratingModel');

// ==================== HELPER FUNCTIONS ====================

const getStarPercentage = (rating) => {
    return (rating / 5) * 100;
};

const getRatingText = (rating) => {
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 3.5) return 'Good';
    if (rating >= 2.5) return 'Average';
    if (rating >= 1.5) return 'Below Average';
    return 'Poor';
};

// ==================== CUSTOMER: SUBMIT RATING ====================

const submitRating = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { 
            booking_id, 
            satisfaction_rating, 
            punctuality_rating, 
            cleanliness_rating, 
            review_text,
            is_public 
        } = req.body;
        
        // Validate required fields
        if (!booking_id || !satisfaction_rating || !punctuality_rating || !cleanliness_rating) {
            return res.status(400).json({ 
                message: 'Booking ID and all ratings are required' 
            });
        }
        
        // Validate rating values (1-5)
        const ratings = [satisfaction_rating, punctuality_rating, cleanliness_rating];
        for (const rating of ratings) {
            if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
                return res.status(400).json({ 
                    message: 'Ratings must be integers between 1 and 5' 
                });
            }
        }
        
        // Check if booking can be rated
        const check = await canRateBooking(booking_id, customerId);
        
        if (!check.can_rate) {
            return res.status(400).json({ message: check.reason });
        }
        
        // Create rating
        const result = await createRating({
            booking_id,
            customer_id: customerId,
            staff_id: check.staff_id,
            satisfaction_rating,
            punctuality_rating,
            cleanliness_rating,
            review_text,
            is_public: is_public !== undefined ? is_public : 1
        });
        
        const averageRating = (satisfaction_rating + punctuality_rating + cleanliness_rating) / 3;
        
        res.status(201).json({
            success: true,
            message: 'Thank you for your feedback! Your rating has been submitted.',
            rating: {
                id: result.rating_id,
                satisfaction_rating,
                punctuality_rating,
                cleanliness_rating,
                average_rating: averageRating.toFixed(1),
                rating_text: getRatingText(averageRating),
                review_text: review_text || null
            }
        });
        
    } catch (error) {
        console.error('Submit rating error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit rating', error: error.message });
    }
};

// ==================== CUSTOMER: GET RATABLE BOOKINGS ====================

const getRatableBookingsController = async (req, res) => {
    try {
        const customerId = req.user.id;
        const bookings = await getRatableBookings(customerId);
        
        res.json({
            success: true,
            count: bookings.length,
            bookings: bookings.map(b => ({
                id: b.id,
                service_name: b.service_name,
                service_date: b.service_date,
                service_time: b.service_time,
                total_price: parseFloat(b.total_price),
                staff: b.staff_id ? {
                    id: b.staff_id,
                    name: `${b.staff_first_name} ${b.staff_last_name}`,
                    photo: b.staff_photo ? `/uploads/staff/${b.staff_photo}` : null
                } : null
            }))
        });
        
    } catch (error) {
        console.error('Get ratable bookings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
    }
};

// ==================== CUSTOMER: GET MY RATINGS ====================

const getMyRatings = async (req, res) => {
    try {
        const customerId = req.user.id;
        const ratings = await getRatingsByCustomerId(customerId);
        
        res.json({
            success: true,
            count: ratings.length,
            ratings: ratings.map(r => ({
                id: r.id,
                staff: {
                    id: r.staff_id,
                    name: `${r.staff_first_name} ${r.staff_last_name}`
                },
                service: {
                    name: r.service_name,
                    date: r.service_date
                },
                ratings: {
                    satisfaction: r.satisfaction_rating,
                    punctuality: r.punctuality_rating,
                    cleanliness: r.cleanliness_rating,
                    average: parseFloat(r.average_rating)
                },
                review_text: r.review_text,
                created_at: r.created_at
            }))
        });
        
    } catch (error) {
        console.error('Get my ratings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch ratings', error: error.message });
    }
};

// ==================== STAFF: GET MY RATINGS ====================

const getStaffRatings = async (req, res) => {
    try {
        const staffId = req.user.id;
        const { limit = 20, min_rating } = req.query;
        
        const ratings = await getRatingsByStaffId(staffId, { limit, min_rating });
        const summary = await getStaffRatingSummary(staffId);
        
        res.json({
            success: true,
            summary: summary || {
                total_ratings: 0,
                overall_average: 0,
                average_satisfaction: 0,
                average_punctuality: 0,
                average_cleanliness: 0,
                five_star_count: 0,
                four_star_count: 0,
                three_star_count: 0,
                two_star_count: 0,
                one_star_count: 0
            },
            ratings: ratings.map(r => ({
                id: r.id,
                customer: {
                    name: `${r.customer_first_name} ${r.customer_last_name}`
                },
                service: {
                    name: r.service_name,
                    date: r.service_date
                },
                ratings: {
                    satisfaction: r.satisfaction_rating,
                    punctuality: r.punctuality_rating,
                    cleanliness: r.cleanliness_rating,
                    average: parseFloat(r.average_rating)
                },
                review_text: r.review_text,
                created_at: r.created_at
            }))
        });
        
    } catch (error) {
        console.error('Get staff ratings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch ratings', error: error.message });
    }
};

// ==================== STAFF: GET RATING SUMMARY ====================

const getStaffRatingSummaryController = async (req, res) => {
    try {
        const staffId = req.user.id;
        const summary = await getStaffRatingSummary(staffId);
        
        if (!summary) {
            return res.json({
                success: true,
                summary: {
                    total_ratings: 0,
                    overall_average: 0,
                    average_satisfaction: 0,
                    average_punctuality: 0,
                    average_cleanliness: 0,
                    rating_text: 'No ratings yet',
                    star_percentage: 0
                }
            });
        }
        
        res.json({
            success: true,
            summary: {
                total_ratings: summary.total_ratings,
                overall_average: parseFloat(summary.overall_average),
                average_satisfaction: parseFloat(summary.average_satisfaction),
                average_punctuality: parseFloat(summary.average_punctuality),
                average_cleanliness: parseFloat(summary.average_cleanliness),
                rating_text: getRatingText(parseFloat(summary.overall_average)),
                star_percentage: getStarPercentage(parseFloat(summary.overall_average)),
                distribution: {
                    five_star: summary.five_star_count,
                    four_star: summary.four_star_count,
                    three_star: summary.three_star_count,
                    two_star: summary.two_star_count,
                    one_star: summary.one_star_count
                }
            }
        });
        
    } catch (error) {
        console.error('Get staff rating summary error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch summary', error: error.message });
    }
};

// ==================== PUBLIC: GET TOP RATED STAFF ====================

const getTopRatedStaffController = async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const topStaff = await getTopRatedStaff(limit);
        
        res.json({
            success: true,
            count: topStaff.length,
            top_staff: topStaff.map(s => ({
                id: s.id,
                name: `${s.first_name} ${s.last_name}`,
                photo: s.photo ? `/uploads/staff/${s.photo}` : null,
                staff_type: s.staff_type,
                total_ratings: s.total_ratings,
                average_rating: parseFloat(s.overall_average),
                rating_text: getRatingText(parseFloat(s.overall_average)),
                criteria: {
                    satisfaction: parseFloat(s.average_satisfaction),
                    punctuality: parseFloat(s.average_punctuality),
                    cleanliness: parseFloat(s.average_cleanliness)
                }
            }))
        });
        
    } catch (error) {
        console.error('Get top rated staff error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch top staff', error: error.message });
    }
};

// ==================== PUBLIC: GET STAFF RATING DETAILS ====================

const getPublicStaffRatings = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { limit = 20 } = req.query;
        
        const summary = await getStaffRatingSummary(staffId);
        const ratings = await getRatingsByStaffId(staffId, { limit });
        
        res.json({
            success: true,
            staff: {
                id: staffId,
                name: ratings[0] ? `${ratings[0].staff_first_name} ${ratings[0].staff_last_name}` : 'Staff Member'
            },
            summary: summary || {
                total_ratings: 0,
                overall_average: 0,
                average_satisfaction: 0,
                average_punctuality: 0,
                average_cleanliness: 0
            },
            ratings: ratings.map(r => ({
                id: r.id,
                customer_name: `${r.customer_first_name} ${r.customer_last_name}`.charAt(0) + '***',
                service_name: r.service_name,
                service_date: r.service_date,
                ratings: {
                    satisfaction: r.satisfaction_rating,
                    punctuality: r.punctuality_rating,
                    cleanliness: r.cleanliness_rating,
                    average: parseFloat(r.average_rating)
                },
                review_text: r.review_text,
                created_at: r.created_at
            }))
        });
        
    } catch (error) {
        console.error('Get public staff ratings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch ratings', error: error.message });
    }
};

// ==================== ADMIN: GET ALL RATINGS ====================

const adminGetAllRatings = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            staff_id: req.query.staff_id,
            min_rating: req.query.min_rating,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };
        
        const ratings = await getAllRatings(filters);
        const stats = await getRatingStats();
        
        res.json({
            success: true,
            count: ratings.length,
            stats: stats[0],
            ratings: ratings.map(r => ({
                id: r.id,
                customer: {
                    name: `${r.customer_first_name} ${r.customer_last_name}`,
                    email: r.customer_email
                },
                staff: {
                    id: r.staff_id,
                    name: `${r.staff_first_name} ${r.staff_last_name}`,
                    email: r.staff_email
                },
                service: {
                    name: r.service_name,
                    date: r.service_date
                },
                ratings: {
                    satisfaction: r.satisfaction_rating,
                    punctuality: r.punctuality_rating,
                    cleanliness: r.cleanliness_rating,
                    average: parseFloat(r.average_rating)
                },
                review_text: r.review_text,
                status: r.status,
                created_at: r.created_at
            }))
        });
        
    } catch (error) {
        console.error('Admin get all ratings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch ratings', error: error.message });
    }
};

// ==================== ADMIN: UPDATE RATING STATUS ====================

const adminUpdateRatingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status', valid_statuses: validStatuses });
        }
        
        await updateRatingStatus(id, status);
        
        res.json({
            success: true,
            message: `Rating ${status} successfully`
        });
        
    } catch (error) {
        console.error('Update rating status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update rating', error: error.message });
    }
};

// ==================== ADMIN: DELETE RATING ====================

const adminDeleteRating = async (req, res) => {
    try {
        const { id } = req.params;
        await deleteRating(id);
        
        res.json({
            success: true,
            message: 'Rating deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete rating error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete rating', error: error.message });
    }
};

module.exports = {
    submitRating,
    getRatableBookingsController,
    getMyRatings,
    getStaffRatings,
    getStaffRatingSummaryController,
    getTopRatedStaffController,
    getPublicStaffRatings,
    adminGetAllRatings,
    adminUpdateRatingStatus,
    adminDeleteRating
};