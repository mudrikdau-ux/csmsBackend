const db = require('../config/db');
const {
    getStaffById,
    updateUserPassword,
    getUserById,
    getStaffPerformanceStats,
    getStaffEarnings,
    getStaffCompletionRate,
    getCashPaymentBookings,
    validateCashPayment,
    getStaffCashPaymentStats,
    getStaffCashPaymentHistory
} = require('../models/userModel');
const bcrypt = require('bcryptjs');

// ==================== HELPER FUNCTIONS ====================

const safeJSONParse = (data) => {
    if (!data) return [];
    if (typeof data === 'object') return data;
    try {
        return JSON.parse(data);
    } catch {
        if (typeof data === 'string' && data.includes(',')) {
            return data.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
        }
        if (typeof data === 'string' && data.length > 0) {
            return [data];
        }
        return [];
    }
};

const getStatusLabel = (status) => {
    const labels = {
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return labels[status] || status;
};

// ==================== GET STAFF ASSIGNED JOBS ====================

const getAssignedJobs = async (req, res) => {
    try {
        const staffId = req.user.id;
        const { status } = req.query;
        
        let sql = `
            SELECT 
                b.id,
                b.first_name as customer_first_name,
                b.last_name as customer_last_name,
                b.email as customer_email,
                b.phone as customer_phone,
                b.address,
                b.city,
                b.landmark,
                b.service_date,
                b.service_time,
                b.total_price,
                b.status,
                b.payment_status,
                b.payment_method,
                b.instructions,
                b.cleaners,
                b.hours,
                b.frequency,
                b.property_type,
                b.materials,
                b.created_at as booking_created_at,
                s.name as service_name,
                s.duration as service_duration,
                s.description as service_description,
                s.includes as service_includes,
                s.price as service_price,
                s.location as service_location
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            WHERE b.assigned_staff_id = ?
        `;
        
        const values = [staffId];
        
        if (status && status !== 'all') {
            sql += ` AND b.status = ?`;
            values.push(status);
        }
        
        sql += ` ORDER BY FIELD(b.status, 'in_progress', 'pending', 'confirmed', 'completed', 'cancelled'), b.service_date ASC, b.service_time ASC`;
        
        const jobs = await db.query(sql, values);
        
        const processedJobs = jobs.map(job => ({
            id: job.id,
            service: {
                id: job.service_id,
                name: job.service_name,
                price: parseFloat(job.service_price),
                duration: job.service_duration,
                location: job.service_location,
                description: job.service_description,
                includes: job.service_includes ? safeJSONParse(job.service_includes) : []
            },
            customer: {
                first_name: job.customer_first_name,
                last_name: job.customer_last_name,
                full_name: `${job.customer_first_name} ${job.customer_last_name}`,
                email: job.customer_email,
                phone: job.customer_phone
            },
            location: {
                address: job.address,
                city: job.city,
                landmark: job.landmark
            },
            schedule: {
                date: job.service_date,
                time: job.service_time
            },
            booking_details: {
                cleaners: job.cleaners,
                hours: job.hours,
                frequency: job.frequency,
                property_type: job.property_type,
                materials_provided: job.materials === 1,
                instructions: job.instructions
            },
            payment: {
                method: job.payment_method,
                total_price: parseFloat(job.total_price),
                payment_status: job.payment_status
            },
            status: job.status,
            status_label: getStatusLabel(job.status),
            created_at: job.booking_created_at
        }));
        
        res.json({
            success: true,
            count: processedJobs.length,
            jobs: processedJobs
        });
        
    } catch (error) {
        console.error('Get assigned jobs error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch assigned jobs', error: error.message });
    }
};

// ==================== GET SINGLE JOB DETAILS ====================

const getJobDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const staffId = req.user.id;
        
        const sql = `
            SELECT 
                b.*,
                s.name as service_name,
                s.duration as service_duration,
                s.description as service_description,
                s.includes as service_includes,
                s.price as service_price,
                s.location as service_location
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            WHERE b.id = ? AND b.assigned_staff_id = ?
        `;
        
        const jobs = await db.query(sql, [id, staffId]);
        
        if (jobs.length === 0) {
            return res.status(404).json({ message: 'Job not found or not assigned to you' });
        }
        
        const job = jobs[0];
        
        res.json({
            success: true,
            job: {
                id: job.id,
                service: {
                    id: job.service_id,
                    name: job.service_name,
                    price: parseFloat(job.service_price),
                    duration: job.service_duration,
                    location: job.service_location,
                    description: job.service_description,
                    includes: job.service_includes ? safeJSONParse(job.service_includes) : []
                },
                customer: {
                    first_name: job.first_name,
                    last_name: job.last_name,
                    full_name: `${job.first_name} ${job.last_name}`,
                    email: job.email,
                    phone: job.phone
                },
                location: {
                    address: job.address,
                    city: job.city,
                    landmark: job.landmark,
                    latitude: job.latitude,
                    longitude: job.longitude
                },
                schedule: {
                    date: job.service_date,
                    time: job.service_time
                },
                booking_details: {
                    cleaners: job.cleaners,
                    hours: job.hours,
                    frequency: job.frequency,
                    property_type: job.property_type,
                    materials_provided: job.materials === 1,
                    instructions: job.instructions
                },
                payment: {
                    method: job.payment_method,
                    total_price: parseFloat(job.total_price),
                    payment_status: job.payment_status,
                    base_price: parseFloat(job.base_price),
                    extras: parseFloat(job.extras),
                    discount: parseFloat(job.discount)
                },
                status: job.status,
                status_label: getStatusLabel(job.status),
                created_at: job.created_at,
                completed_date: job.completed_date
            }
        });
        
    } catch (error) {
        console.error('Get job details error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch job details', error: error.message });
    }
};

// ==================== UPDATE JOB STATUS ====================

const updateJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const staffId = req.user.id;
        
        const validStatuses = ['in_progress', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid status', 
                valid_statuses: validStatuses 
            });
        }
        
        const job = await db.query(
            `SELECT status, payment_status, total_price FROM bookings WHERE id = ? AND assigned_staff_id = ?`,
            [id, staffId]
        );
        
        if (job.length === 0) {
            return res.status(404).json({ message: 'Job not found or not assigned to you' });
        }
        
        const currentStatus = job[0].status;
        
        if (currentStatus === 'completed') {
            return res.status(400).json({ message: 'Job is already completed' });
        }
        
        if (status === 'in_progress' && currentStatus === 'pending') {
            await db.query(
                `UPDATE bookings SET status = 'in_progress' WHERE id = ?`,
                [id]
            );
        } else if (status === 'completed') {
            await db.query(
                `UPDATE bookings SET status = 'completed', completed_date = NOW() WHERE id = ?`,
                [id]
            );
        } else if (status === 'in_progress' && currentStatus === 'confirmed') {
            await db.query(
                `UPDATE bookings SET status = 'in_progress' WHERE id = ?`,
                [id]
            );
        } else {
            return res.status(400).json({ message: 'Cannot update status from current state' });
        }
        
        res.json({
            success: true,
            message: status === 'in_progress' ? 'Job started successfully' : 'Job marked as completed',
            job: {
                id: parseInt(id),
                status: status,
                status_label: getStatusLabel(status)
            }
        });
        
    } catch (error) {
        console.error('Update job status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update job status', error: error.message });
    }
};

// ==================== GET JOB HISTORY ====================

const getJobHistory = async (req, res) => {
    try {
        const staffId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;
        
        const sql = `
            SELECT 
                b.id,
                b.first_name as customer_first_name,
                b.last_name as customer_last_name,
                b.email as customer_email,
                b.phone as customer_phone,
                b.address,
                b.city,
                b.service_date,
                b.service_time,
                b.total_price,
                b.status,
                b.payment_status,
                b.payment_method,
                b.completed_date,
                s.name as service_name,
                s.duration as service_duration
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            WHERE b.assigned_staff_id = ? AND b.status = 'completed'
            ORDER BY b.completed_date DESC
            LIMIT ? OFFSET ?
        `;
        
        const history = await db.query(sql, [staffId, parseInt(limit), parseInt(offset)]);
        
        const processedHistory = history.map(job => ({
            id: job.id,
            service: {
                name: job.service_name,
                duration: job.service_duration
            },
            customer: {
                full_name: `${job.customer_first_name} ${job.customer_last_name}`,
                email: job.customer_email,
                phone: job.customer_phone
            },
            location: {
                address: job.address,
                city: job.city
            },
            schedule: {
                date: job.service_date,
                time: job.service_time
            },
            payment: {
                method: job.payment_method,
                total_price: parseFloat(job.total_price),
                payment_status: job.payment_status
            },
            completed_date: job.completed_date
        }));
        
        res.json({
            success: true,
            count: history.length,
            history: processedHistory
        });
        
    } catch (error) {
        console.error('Get job history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch job history', error: error.message });
    }
};

// ==================== GET PERFORMANCE STATS ====================

const getPerformanceStats = async (req, res) => {
    try {
        const staffId = req.user.id;
        
        const stats = await getStaffPerformanceStats(staffId);
        const earnings = await getStaffEarnings(staffId);
        const completion = await getStaffCompletionRate(staffId);
        
        res.json({
            success: true,
            stats: {
                total_jobs: parseInt(stats[0]?.total_jobs) || 0,
                completed_jobs: parseInt(stats[0]?.completed_jobs) || 0,
                in_progress_jobs: parseInt(stats[0]?.in_progress_jobs) || 0,
                pending_jobs: parseInt(stats[0]?.pending_jobs) || 0,
                cancelled_jobs: parseInt(stats[0]?.cancelled_jobs) || 0,
                total_earnings: parseFloat(earnings[0]?.total_earnings) || 0,
                today_earnings: parseFloat(earnings[0]?.today_earnings) || 0,
                completion_rate: parseFloat(completion[0]?.completion_rate) || 0
            }
        });
        
    } catch (error) {
        console.error('Get performance stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch performance stats', error: error.message });
    }
};

// ==================== GET STAFF PROFILE ====================

const getStaffProfile = async (req, res) => {
    try {
        const staffId = req.user.id;
        const staff = await getStaffById(staffId);
        
        if (staff.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }
        
        const s = staff[0];
        
        res.json({
            success: true,
            profile: {
                id: s.id,
                first_name: s.first_name,
                last_name: s.last_name,
                full_name: `${s.first_name} ${s.last_name}`,
                email: s.email,
                phone: s.phone,
                staff_type: s.staff_type,
                address: s.address || 'Not provided',
                photo: s.photo ? `/uploads/staff/${s.photo}` : null,
                joined_date: s.created_at,
                rating: s.rating || 5
            }
        });
        
    } catch (error) {
        console.error('Get staff profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
    }
};

// ==================== CHANGE STAFF PASSWORD ====================

const changeStaffPassword = async (req, res) => {
    try {
        const staffId = req.user.id;
        const { current_password, new_password, confirm_password } = req.body;
        
        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({ message: 'All password fields are required' });
        }
        
        if (new_password !== confirm_password) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }
        
        if (new_password.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }
        
        const staff = await getStaffById(staffId);
        if (staff.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }
        
        const s = staff[0];
        
        const isMatch = await bcrypt.compare(current_password, s.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await updateUserPassword(staffId, hashedPassword);
        
        res.json({
            success: true,
            message: 'Password changed successfully. Please login again with your new password.'
        });
        
    } catch (error) {
        console.error('Change staff password error:', error);
        res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
    }
};


module.exports = {
    getAssignedJobs,
    getJobDetails,
    updateJobStatus,
    getJobHistory,
    getPerformanceStats,
    getStaffProfile,
    changeStaffPassword
};