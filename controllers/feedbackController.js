const {
    createFeedback,
    getFeedbackById,
    getAllFeedbacks,
    getFeedbacksByUserId,
    updateFeedback,
    deleteFeedback,
    getFeedbackStats,
    getRecentFeedbacks
} = require('../models/feedbackModel');

// ==================== EMOJI RATING HELPERS ====================

const getRatingEmoji = (rating) => {
    const emojis = {
        'very_sad': '😡',
        'sad': '😟',
        'neutral': '😐',
        'happy': '😊',
        'very_happy': '😍'
    };
    return emojis[rating] || '😐';
};

const getRatingLabel = (rating) => {
    const labels = {
        'very_sad': 'Very Dissatisfied',
        'sad': 'Dissatisfied',
        'neutral': 'Neutral',
        'happy': 'Satisfied',
        'very_happy': 'Very Satisfied'
    };
    return labels[rating] || 'Neutral';
};

const getRatingValue = (rating) => {
    const values = {
        'very_sad': 1,
        'sad': 2,
        'neutral': 3,
        'happy': 4,
        'very_happy': 5
    };
    return values[rating] || 3;
};

// ==================== SUBMIT FEEDBACK ====================

const submitFeedback = async (req, res) => {
    try {
        const {
            rating,
            feedback_text,
            booking_id
        } = req.body;

        const userId = req.user.id;

        // Validate rating
        const validRatings = ['very_sad', 'sad', 'neutral', 'happy', 'very_happy'];
        if (!rating || !validRatings.includes(rating)) {
            return res.status(400).json({
                message: 'Please select a valid rating',
                valid_ratings: validRatings
            });
        }

        // Validate feedback text
        if (!feedback_text || feedback_text.trim().length < 10) {
            return res.status(400).json({
                message: 'Feedback text must be at least 10 characters'
            });
        }

        if (feedback_text.length > 1000) {
            return res.status(400).json({
                message: 'Feedback text must be less than 1000 characters'
            });
        }

        const ratingValue = getRatingValue(rating);

        const result = await createFeedback({
            user_id: userId,
            booking_id: booking_id || null,
            rating,
            rating_value: ratingValue,
            feedback_text: feedback_text.trim(),
            is_public: 1
        });

        const feedbackId = result.insertId;
        const feedback = await getFeedbackById(feedbackId);

        const f = feedback[0];

        res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully. Thank you for your review!',
            feedback: {
                id: f.id,
                user: {
                    id: f.user_id,
                    name: `${f.first_name} ${f.last_name}`,
                    gender: f.gender
                },
                rating: {
                    value: f.rating,
                    rating_value: f.rating_value,
                    emoji: getRatingEmoji(f.rating),
                    label: getRatingLabel(f.rating)
                },
                feedback_text: f.feedback_text,
                service: f.service_name || null,
                booking_id: f.booking_id,
                is_public: f.is_public,
                created_at: f.created_at
            }
        });

    } catch (error) {
        console.error('Submit feedback error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit feedback',
            error: error.message
        });
    }
};

// ==================== GET PUBLIC FEEDBACKS (Anyone can view) ====================

const getPublicFeedbacks = async (req, res) => {
    try {
        const filters = {
            rating: req.query.rating,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const feedbacks = await getAllFeedbacks(filters);
        const stats = await getFeedbackStats();

        const enriched = feedbacks.map(f => ({
            id: f.id,
            user: {
                name: `${f.first_name} ${f.last_name}`,
                gender: f.gender
            },
            rating: {
                value: f.rating,
                rating_value: f.rating_value,
                emoji: getRatingEmoji(f.rating),
                label: getRatingLabel(f.rating)
            },
            feedback_text: f.feedback_text,
            service: f.service_name || 'General Feedback',
            created_at: f.created_at
        }));

        res.json({
            success: true,
            count: feedbacks.length,
            stats: {
                total_feedbacks: stats[0].total_feedbacks,
                average_rating: parseFloat(stats[0].average_rating || 0).toFixed(1),
                distribution: {
                    very_happy: stats[0].very_happy_count,
                    happy: stats[0].happy_count,
                    neutral: stats[0].neutral_count,
                    sad: stats[0].sad_count,
                    very_sad: stats[0].very_sad_count
                }
            },
            feedbacks: enriched
        });

    } catch (error) {
        console.error('Get public feedbacks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feedbacks',
            error: error.message
        });
    }
};

// ==================== GET RECENT FEEDBACKS ====================

const getRecentFeedbacksController = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const feedbacks = await getRecentFeedbacks(limit);
        const stats = await getFeedbackStats();

        const enriched = feedbacks.map(f => ({
            id: f.id,
            user: {
                name: `${f.first_name} ${f.last_name}`,
                gender: f.gender
            },
            rating: {
                value: f.rating,
                rating_value: f.rating_value,
                emoji: getRatingEmoji(f.rating),
                label: getRatingLabel(f.rating)
            },
            feedback_text: f.feedback_text,
            service: f.service_name || 'General Feedback',
            created_at: f.created_at
        }));

        res.json({
            success: true,
            stats: {
                total: stats[0].total_feedbacks,
                average: parseFloat(stats[0].average_rating || 0).toFixed(1)
            },
            feedbacks: enriched
        });

    } catch (error) {
        console.error('Get recent feedbacks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent feedbacks',
            error: error.message
        });
    }
};

// ==================== GET MY FEEDBACKS ====================

const getMyFeedbacks = async (req, res) => {
    try {
        const userId = req.user.id;
        const feedbacks = await getFeedbacksByUserId(userId);

        const enriched = feedbacks.map(f => ({
            id: f.id,
            rating: {
                value: f.rating,
                rating_value: f.rating_value,
                emoji: getRatingEmoji(f.rating),
                label: getRatingLabel(f.rating)
            },
            feedback_text: f.feedback_text,
            service: f.service_name || 'General Feedback',
            booking_id: f.booking_id,
            is_public: f.is_public,
            created_at: f.created_at
        }));

        res.json({
            success: true,
            count: feedbacks.length,
            feedbacks: enriched
        });

    } catch (error) {
        console.error('Get my feedbacks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your feedbacks',
            error: error.message
        });
    }
};

// ==================== UPDATE MY FEEDBACK ====================

const updateMyFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { rating, feedback_text } = req.body;

        const feedback = await getFeedbackById(id);
        if (!feedback || feedback.length === 0) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        // Check ownership
        if (feedback[0].user_id !== userId) {
            return res.status(403).json({ message: 'You can only edit your own feedback' });
        }

        const updates = {};
        if (rating) {
            const validRatings = ['very_sad', 'sad', 'neutral', 'happy', 'very_happy'];
            if (!validRatings.includes(rating)) {
                return res.status(400).json({ message: 'Invalid rating', valid_ratings: validRatings });
            }
            updates.rating = rating;
            updates.rating_value = getRatingValue(rating);
        } else {
            updates.rating = feedback[0].rating;
            updates.rating_value = feedback[0].rating_value;
        }

        if (feedback_text) {
            if (feedback_text.trim().length < 10) {
                return res.status(400).json({ message: 'Feedback text must be at least 10 characters' });
            }
            updates.feedback_text = feedback_text.trim();
        } else {
            updates.feedback_text = feedback[0].feedback_text;
        }

        updates.is_public = feedback[0].is_public;

        await updateFeedback(id, updates);

        res.json({
            success: true,
            message: 'Feedback updated successfully'
        });

    } catch (error) {
        console.error('Update feedback error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update feedback',
            error: error.message
        });
    }
};

// ==================== DELETE MY FEEDBACK ====================

const deleteMyFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const feedback = await getFeedbackById(id);
        if (!feedback || feedback.length === 0) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        if (feedback[0].user_id !== userId) {
            return res.status(403).json({ message: 'You can only delete your own feedback' });
        }

        await deleteFeedback(id);

        res.json({
            success: true,
            message: 'Feedback deleted successfully'
        });

    } catch (error) {
        console.error('Delete feedback error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete feedback',
            error: error.message
        });
    }
};

module.exports = {
    submitFeedback,
    getPublicFeedbacks,
    getRecentFeedbacksController,
    getMyFeedbacks,
    updateMyFeedback,
    deleteMyFeedback
};