const db = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const {
    getStaffById,
    updateUserPassword,
    getUserById
} = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { sendMessage, getMessages, markMessagesAsRead, getUnreadCount, markReportSubmittedToAdmin, updateReportPdfPath } = require('../models/supervisorModel');

// Ensure reports directory exists
const reportsDir = path.join(__dirname, '..', 'reports', 'general_supervisor');
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

// Branding for PDF
const BRANDING = {
    primaryColor: '#1a5276',
    secondaryColor: '#2e86c1',
    successColor: '#27ae60',
    warningColor: '#f39c12',
    dangerColor: '#e74c3c',
    lightGray: '#f8f9fa',
    borderGray: '#dee2e6',
    darkGray: '#2c3e50',
    textGray: '#6c757d',
    white: '#ffffff',
    companyName: 'CleanSpark',
    tagline: 'Professional Cleaning Services',
    address: 'Stone Town, Zanzibar',
    phone: '+255 777 000 000',
    email: 'info@cleanspark.co.tz'
};

// ==================== HELPER FUNCTIONS ====================

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

const getPaymentStatusLabel = (status) => {
    return status === 'paid' ? 'Paid ✅' : 'Unpaid ❌';
};

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

// ==================== PROFILE ====================

const getProfile = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const staff = await getStaffById(supervisorId);
        
        if (staff.length === 0) {
            return res.status(404).json({ message: 'User not found' });
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
                joined_date: s.created_at
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
    }
};

const changePassword = async (req, res) => {
    try {
        const supervisorId = req.user.id;
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
        
        const staff = await getStaffById(supervisorId);
        if (staff.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const s = staff[0];
        
        const isMatch = await bcrypt.compare(current_password, s.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await updateUserPassword(supervisorId, hashedPassword);
        
        res.json({
            success: true,
            message: 'Password changed successfully. Please login again with your new password.'
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
    }
};

// ==================== MY TEAM - ALL STAFF ====================

const getMyTeam = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        
        // Get all staff with their job statistics
        const staff = await db.query(`
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.photo,
                u.staff_type,
                u.created_at as joined_date,
                COUNT(DISTINCT b.id) as total_jobs,
                SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                SUM(CASE WHEN b.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_jobs,
                SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
                SUM(CASE WHEN b.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_jobs,
                SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_jobs,
                ROUND(COALESCE(AVG(sr.average_rating), 0), 1) as avg_rating
            FROM users u
            LEFT JOIN bookings b ON u.id = b.assigned_staff_id
            LEFT JOIN staff_ratings sr ON u.id = sr.staff_id AND sr.status = 'approved'
            WHERE u.role = 'staff' AND u.staff_type != 'general_supervisor'
            GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.photo, u.staff_type, u.created_at
            ORDER BY u.first_name ASC
        `);
        
        const enrichedStaff = staff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            full_name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            phone: s.phone,
            photo: s.photo ? `/uploads/staff/${s.photo}` : null,
            staff_type: s.staff_type,
            joined_date: s.joined_date,
            stats: {
                total_jobs: parseInt(s.total_jobs) || 0,
                completed_jobs: parseInt(s.completed_jobs) || 0,
                in_progress_jobs: parseInt(s.in_progress_jobs) || 0,
                pending_jobs: parseInt(s.pending_jobs) || 0,
                confirmed_jobs: parseInt(s.confirmed_jobs) || 0,
                cancelled_jobs: parseInt(s.cancelled_jobs) || 0,
                completion_rate: s.total_jobs > 0 ? Math.round((s.completed_jobs / s.total_jobs) * 100) : 0,
                avg_rating: parseFloat(s.avg_rating) || 0
            }
        }));
        
        res.json({
            success: true,
            count: enrichedStaff.length,
            staff: enrichedStaff
        });
        
    } catch (error) {
        console.error('Get my team error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch team', error: error.message });
    }
};

// ==================== TEAM JOBS MANAGEMENT ====================

const getTeamJobs = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { status, date_from, date_to } = req.query;
        
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
                b.completed_date,
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
        
        if (date_from) {
            sql += ` AND b.service_date >= ?`;
            values.push(date_from);
        }
        
        if (date_to) {
            sql += ` AND b.service_date <= ?`;
            values.push(date_to);
        }
        
        sql += ` ORDER BY FIELD(b.status, 'in_progress', 'confirmed', 'pending', 'completed', 'cancelled'), b.service_date ASC, b.service_time ASC`;
        
        const jobs = await db.query(sql, values);
        
        const enrichedJobs = jobs.map(job => ({
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
                payment_status: job.payment_status,
                payment_status_label: getPaymentStatusLabel(job.payment_status)
            },
            status: job.status,
            status_label: getStatusLabel(job.status),
            created_at: job.booking_created_at,
            completed_date: job.completed_date
        }));
        
        res.json({
            success: true,
            count: enrichedJobs.length,
            staff_id: parseInt(staffId),
            jobs: enrichedJobs
        });
        
    } catch (error) {
        console.error('Get team jobs error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch team jobs', error: error.message });
    }
};

const getAllTeamJobs = async (req, res) => {
    try {
        const { status, date_from, date_to, staff_id } = req.query;
        
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
                b.completed_date,
                s.name as service_name,
                s.duration as service_duration,
                s.description as service_description,
                s.includes as service_includes,
                s.price as service_price,
                s.location as service_location,
                u.id as staff_id,
                u.first_name as staff_first_name,
                u.last_name as staff_last_name,
                u.photo as staff_photo
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN users u ON b.assigned_staff_id = u.id
            WHERE u.role = 'staff' AND u.staff_type != 'general_supervisor'
        `;
        
        const values = [];
        
        if (status && status !== 'all') {
            sql += ` AND b.status = ?`;
            values.push(status);
        }
        
        if (date_from) {
            sql += ` AND b.service_date >= ?`;
            values.push(date_from);
        }
        
        if (date_to) {
            sql += ` AND b.service_date <= ?`;
            values.push(date_to);
        }
        
        if (staff_id) {
            sql += ` AND b.assigned_staff_id = ?`;
            values.push(staff_id);
        }
        
        sql += ` ORDER BY FIELD(b.status, 'in_progress', 'confirmed', 'pending', 'completed', 'cancelled'), b.service_date ASC, b.service_time ASC`;
        
        const jobs = await db.query(sql, values);
        
        const enrichedJobs = jobs.map(job => ({
            id: job.id,
            staff: {
                id: job.staff_id,
                name: `${job.staff_first_name} ${job.staff_last_name}`,
                photo: job.staff_photo ? `/uploads/staff/${job.staff_photo}` : null
            },
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
                payment_status: job.payment_status,
                payment_status_label: getPaymentStatusLabel(job.payment_status)
            },
            status: job.status,
            status_label: getStatusLabel(job.status),
            created_at: job.booking_created_at,
            completed_date: job.completed_date
        }));
        
        res.json({
            success: true,
            count: enrichedJobs.length,
            jobs: enrichedJobs
        });
        
    } catch (error) {
        console.error('Get all team jobs error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch team jobs', error: error.message });
    }
};

const updateTeamJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['in_progress', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid status', 
                valid_statuses: validStatuses 
            });
        }
        
        const job = await db.query(`SELECT status, assigned_staff_id FROM bookings WHERE id = ?`, [jobId]);
        
        if (job.length === 0) {
            return res.status(404).json({ message: 'Job not found' });
        }
        
        const currentStatus = job[0].status;
        
        if (currentStatus === 'completed') {
            return res.status(400).json({ message: 'Job is already completed' });
        }
        
        if (status === 'in_progress') {
            await db.query(`UPDATE bookings SET status = 'in_progress' WHERE id = ?`, [jobId]);
        } else if (status === 'completed') {
            await db.query(`UPDATE bookings SET status = 'completed', completed_date = NOW() WHERE id = ?`, [jobId]);
        } else {
            return res.status(400).json({ message: 'Cannot update status from current state' });
        }
        
        res.json({
            success: true,
            message: status === 'in_progress' ? 'Job marked as started' : 'Job marked as completed',
            job: {
                id: parseInt(jobId),
                status: status,
                status_label: getStatusLabel(status)
            }
        });
        
    } catch (error) {
        console.error('Update team job status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update job status', error: error.message });
    }
};

// ==================== CASH PAYMENT VALIDATION (General Supervisor only) ====================

const getCashPaymentList = async (req, res) => {
    try {
        const bookings = await db.query(`
            SELECT 
                b.id,
                b.first_name,
                b.last_name,
                b.email,
                b.phone,
                b.address,
                b.city,
                b.service_date,
                b.service_time,
                b.total_price,
                b.status,
                b.payment_status,
                s.name as service_name,
                s.duration,
                u.id as staff_id,
                u.first_name as staff_first_name,
                u.last_name as staff_last_name,
                b.created_at
            FROM bookings b
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN users u ON b.assigned_staff_id = u.id
            WHERE b.payment_method = 'cash'
            AND b.payment_status = 'unpaid'
            AND b.status NOT IN ('cancelled')
            ORDER BY b.service_date ASC, b.service_time ASC
        `);
        
        const enrichedBookings = bookings.map(b => ({
            id: b.id,
            customer: {
                name: `${b.first_name} ${b.last_name}`,
                email: b.email,
                phone: b.phone
            },
            staff: b.staff_id ? {
                id: b.staff_id,
                name: `${b.staff_first_name} ${b.staff_last_name}`
            } : null,
            service: {
                name: b.service_name,
                duration: b.duration
            },
            location: {
                address: b.address,
                city: b.city
            },
            schedule: {
                date: b.service_date,
                time: b.service_time
            },
            total_price: parseFloat(b.total_price),
            payment_status: b.payment_status,
            status: b.status
        }));
        
        res.json({
            success: true,
            count: bookings.length,
            payments: enrichedBookings
        });
        
    } catch (error) {
        console.error('Get cash payment list error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch cash payment list', error: error.message });
    }
};

const validateCashPayment = async (req, res) => {
    const pool = require('../config/db').pool;
    const connection = await new Promise((resolve, reject) => {
        pool.getConnection((err, connection) => {
            if (err) reject(err);
            else resolve(connection);
        });
    });
    
    try {
        const supervisorId = req.user.id;
        const { booking_id, amount_received, payment_note } = req.body;
        
        if (!booking_id || !amount_received) {
            return res.status(400).json({ message: 'Booking ID and amount received are required' });
        }
        
        const amountReceived = parseFloat(amount_received);
        if (isNaN(amountReceived) || amountReceived <= 0) {
            return res.status(400).json({ message: 'Invalid amount received' });
        }
        
        await new Promise((resolve, reject) => {
            connection.beginTransaction((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Get booking details
        const booking = await new Promise((resolve, reject) => {
            connection.query(
                `SELECT 
                    b.id, 
                    b.total_price, 
                    b.payment_status, 
                    b.user_id, 
                    b.first_name, 
                    b.last_name, 
                    b.email, 
                    b.phone, 
                    b.service_id, 
                    b.assigned_staff_id
                 FROM bookings b 
                 WHERE b.id = ?`,
                [booking_id],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
        
        if (!booking || booking.length === 0) {
            throw new Error('Booking not found');
        }
        
        const bookingData = booking[0];
        
        if (bookingData.payment_status === 'paid') {
            throw new Error('Payment already validated for this booking');
        }
        
        const totalPrice = parseFloat(bookingData.total_price);
        
        if (amountReceived < totalPrice) {
            throw new Error(`Amount received (${amountReceived}) is less than total price (${totalPrice})`);
        }
        
        const changeAmount = amountReceived - totalPrice;
        
        // Generate receipt number
        const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Use NULL for user_id if booking has no user_id (allow NULL after constraint change)
        const userId = bookingData.user_id && bookingData.user_id > 0 ? bookingData.user_id : null;
        
        // Create cash payment record - user_id can be NULL now
        await new Promise((resolve, reject) => {
            connection.query(
                `INSERT INTO cash_payments (
                    booking_id, staff_id, user_id, amount_received, change_amount, payment_note, receipt_number
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [booking_id, bookingData.assigned_staff_id, userId, amountReceived, changeAmount, payment_note || null, receiptNumber],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
        
        // Update booking payment status
        await new Promise((resolve, reject) => {
            connection.query(
                `UPDATE bookings SET payment_status = 'paid' WHERE id = ?`,
                [booking_id],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
        
        await new Promise((resolve, reject) => {
            connection.commit((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({
            success: true,
            message: 'Payment validated successfully',
            receipt: {
                receipt_number: receiptNumber,
                change_amount: changeAmount,
                amount_received: amountReceived
            }
        });
        
    } catch (error) {
        await new Promise((resolve) => {
            connection.rollback(() => resolve());
        });
        console.error('Validate cash payment error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to validate payment' });
    } finally {
        connection.release();
    }
};

const getCashPaymentStats = async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                COUNT(*) as total_validated,
                SUM(amount_received) as total_received,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_validated,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN amount_received ELSE 0 END) as today_received
            FROM cash_payments
        `);
        
        res.json({
            success: true,
            stats: {
                total_validated: parseInt(stats[0]?.total_validated) || 0,
                total_received: parseFloat(stats[0]?.total_received) || 0,
                today_validated: parseInt(stats[0]?.today_validated) || 0,
                today_received: parseFloat(stats[0]?.today_received) || 0
            }
        });
        
    } catch (error) {
        console.error('Get cash payment stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payment stats', error: error.message });
    }
};

const getCashPaymentHistory = async (req, res) => {
    try {
        const limit = req.query.limit || 50;
        const history = await db.query(`
            SELECT 
                cp.*,
                b.first_name,
                b.last_name,
                b.email,
                b.phone,
                b.service_date,
                b.total_price as booking_total,
                s.name as service_name,
                u.first_name as staff_first_name,
                u.last_name as staff_last_name
            FROM cash_payments cp
            LEFT JOIN bookings b ON cp.booking_id = b.id
            LEFT JOIN services s ON b.service_id = s.id
            LEFT JOIN users u ON b.assigned_staff_id = u.id
            ORDER BY cp.created_at DESC
            LIMIT ?
        `, [parseInt(limit)]);
        
        const processedHistory = history.map(h => ({
            id: h.id,
            receipt_number: h.receipt_number,
            customer: {
                name: `${h.first_name} ${h.last_name}`,
                email: h.email,
                phone: h.phone
            },
            staff: {
                name: `${h.staff_first_name} ${h.staff_last_name}`
            },
            service: {
                name: h.service_name
            },
            booking_total: parseFloat(h.booking_total),
            amount_received: parseFloat(h.amount_received),
            change_amount: parseFloat(h.change_amount),
            payment_note: h.payment_note,
            created_at: h.created_at
        }));
        
        res.json({
            success: true,
            count: history.length,
            history: processedHistory
        });
        
    } catch (error) {
        console.error('Get cash payment history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payment history', error: error.message });
    }
};

// ==================== WEEKLY REPORTS (Same as supervisor) ====================

const generateWeeklyReport = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const {
            week_ending_date,
            work_progress,
            worker_performance,
            equipment_status,
            additional_requests
        } = req.body;
        
        if (!week_ending_date || !work_progress || !worker_performance || !equipment_status) {
            return res.status(400).json({ 
                message: 'Week ending date, work progress, worker performance, and equipment status are required' 
            });
        }
        
        const result = await db.query(
            `INSERT INTO general_supervisor_reports 
             (supervisor_id, week_ending_date, work_progress, worker_performance, 
              equipment_status, additional_requests)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [supervisorId, week_ending_date, work_progress, worker_performance, equipment_status, additional_requests || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Weekly report generated successfully',
            report_id: result.insertId
        });
    } catch (error) {
        console.error('Generate weekly report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message });
    }
};

const getMyReports = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const reports = await db.query(`
            SELECT 
                gsr.*,
                u.first_name as supervisor_first_name,
                u.last_name as supervisor_last_name
            FROM general_supervisor_reports gsr
            LEFT JOIN users u ON gsr.supervisor_id = u.id
            WHERE gsr.supervisor_id = ?
            ORDER BY gsr.created_at DESC
        `, [supervisorId]);
        
        res.json({
            success: true,
            count: reports.length,
            reports: reports.map(r => ({
                id: r.id,
                week_ending_date: r.week_ending_date,
                submitted_to_admin: r.submitted_to_admin === 1,
                created_at: r.created_at
            }))
        });
    } catch (error) {
        console.error('Get my reports error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reports', error: error.message });
    }
};

const downloadWeeklyReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const report = await db.query(`
            SELECT 
                gsr.*,
                u.first_name as supervisor_first_name,
                u.last_name as supervisor_last_name,
                u.email as supervisor_email
            FROM general_supervisor_reports gsr
            LEFT JOIN users u ON gsr.supervisor_id = u.id
            WHERE gsr.id = ?
        `, [reportId]);
        
        if (!report || report.length === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }
        
        const r = report[0];
        const filename = `weekly_report_${r.id}_${Date.now()}.pdf`;
        const filePath = path.join(reportsDir, filename);
        
        await generateReportPDF(r, filePath);
        
        await db.query(`UPDATE general_supervisor_reports SET report_pdf_path = ? WHERE id = ?`, [filePath, reportId]);
        
        if (!fs.existsSync(filePath)) {
            throw new Error('PDF file was not created successfully');
        }
        
        res.download(filePath, filename, (err) => {
            if (err) console.error('Download error:', err);
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 5000);
        });
    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to download report', 
            error: error.message 
        });
    }
};

const generateReportPDF = (report, filePath) => {
    return new Promise((resolve, reject) => {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const stream = fs.createWriteStream(filePath);
            
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                reject(err);
            });
            
            doc.pipe(stream);
            
            const pageWidth = doc.page.width;
            const margin = 40;
            
            // Header
            doc.rect(0, 0, pageWidth, 80).fill(BRANDING.primaryColor);
            doc.fillColor('#ffffff')
               .fontSize(24)
               .font('Helvetica-Bold')
               .text('CleanSpark', margin, 25);
            doc.fontSize(12)
               .text('General Supervisor Weekly Report', margin, 55);
            
            // Report Details
            let yPos = 110;
            doc.fillColor('#2c3e50')
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('REPORT DETAILS', margin, yPos);
            
            yPos += 30;
            doc.fontSize(10)
               .font('Helvetica');
            
            const formatDate = (dateStr) => {
                if (!dateStr) return 'N/A';
                const d = new Date(dateStr);
                return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            };
            
            const details = [
                ['Week Ending:', formatDate(report.week_ending_date)],
                ['Report Generated:', formatDate(new Date())],
                ['Supervisor:', `${report.supervisor_first_name || ''} ${report.supervisor_last_name || ''}`.trim() || 'N/A']
            ];
            
            details.forEach(([label, value]) => {
                doc.fillColor('#7f8c8d').text(label, margin, yPos, { width: 120 });
                doc.fillColor('#2c3e50').text(value || 'N/A', margin + 130, yPos);
                yPos += 20;
            });
            
            yPos += 20;
            
            // Work Progress
            doc.fillColor('#1a5276')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('WORK PROGRESS & OBSERVATIONS', margin, yPos);
            yPos += 25;
            doc.fillColor('#34495e')
               .fontSize(9)
               .font('Helvetica')
               .text(report.work_progress || 'No observations recorded', margin, yPos, {
                   width: pageWidth - 80,
                   lineGap: 4
               });
            
            yPos += doc.heightOfString(report.work_progress || 'No observations recorded', {
                width: pageWidth - 80,
                fontSize: 9
            }) + 25;
            
            // Worker Performance
            doc.fillColor('#1a5276')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('WORKER PERFORMANCE', margin, yPos);
            yPos += 25;
            doc.fillColor('#34495e')
               .fontSize(9)
               .font('Helvetica')
               .text(report.worker_performance || 'No performance data', margin, yPos, {
                   width: pageWidth - 80,
                   lineGap: 4
               });
            
            yPos += doc.heightOfString(report.worker_performance || 'No performance data', {
                width: pageWidth - 80,
                fontSize: 9
            }) + 25;
            
            // Equipment Status
            doc.fillColor('#1a5276')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('EQUIPMENT STATUS & REQUESTS', margin, yPos);
            yPos += 25;
            doc.fillColor('#34495e')
               .fontSize(9)
               .font('Helvetica')
               .text(report.equipment_status || 'No equipment issues', margin, yPos, {
                   width: pageWidth - 80,
                   lineGap: 4
               });
            
            yPos += doc.heightOfString(report.equipment_status || 'No equipment issues', {
                width: pageWidth - 80,
                fontSize: 9
            }) + 25;
            
            // Additional Requests
            if (report.additional_requests) {
                doc.fillColor('#1a5276')
                   .fontSize(12)
                   .font('Helvetica-Bold')
                   .text('ADDITIONAL REQUESTS / COMMENTS', margin, yPos);
                yPos += 25;
                doc.fillColor('#34495e')
                   .fontSize(9)
                   .font('Helvetica')
                   .text(report.additional_requests, margin, yPos, {
                       width: pageWidth - 80,
                       lineGap: 4
                   });
                yPos += doc.heightOfString(report.additional_requests, {
                    width: pageWidth - 80,
                    fontSize: 9
                }) + 25;
            }
            
            // Footer
            const footerY = doc.page.height - 40;
            if (footerY > yPos) {
                doc.strokeColor('#3498db')
                   .lineWidth(1)
                   .moveTo(margin, footerY)
                   .lineTo(pageWidth - margin, footerY)
                   .stroke();
                
                doc.fillColor('#95a5a6')
                   .fontSize(7)
                   .font('Helvetica')
                   .text(`Generated by CleanSpark General Supervisor System | ${new Date().toLocaleString()}`, 
                         margin, footerY + 8, { align: 'center', width: pageWidth - 80 });
            }
            
            doc.end();
            
            stream.on('finish', () => {
                console.log('PDF generated successfully:', filePath);
                resolve();
            });
            
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                reject(err);
            });
            
        } catch (error) {
            console.error('PDF generation error:', error);
            reject(error);
        }
    });
};

const submitReportToAdmin = async (req, res) => {
    try {
        const { reportId } = req.params;
        
        await db.query(`UPDATE general_supervisor_reports SET submitted_to_admin = 1 WHERE id = ?`, [reportId]);
        
        // Send message in chat
        const report = await db.query(`SELECT week_ending_date FROM general_supervisor_reports WHERE id = ?`, [reportId]);
        if (report.length > 0) {
            await sendMessage(
                req.user.id,
                `📋 Weekly report (Week ending ${report[0].week_ending_date}) has been submitted for review.`,
                null,
                null
            );
        }
        
        res.json({
            success: true,
            message: 'Report submitted to admin successfully'
        });
    } catch (error) {
        console.error('Submit report to admin error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit report', error: error.message });
    }
};

// ==================== CHAT SYSTEM (Same as supervisor) ====================

const sendChatMessage = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const { message, report_id } = req.body;
        
        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }
        
        let attachmentUrl = null;
        if (req.file) {
            attachmentUrl = `/uploads/chats/${req.file.filename}`;
        }
        
        const result = await sendMessage(supervisorId, message, attachmentUrl, report_id);
        
        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            message_id: result.message_id
        });
    } catch (error) {
        console.error('Send chat message error:', error);
        res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
    }
};

const getChatMessages = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const messages = await getMessages(supervisorId);
        
        await markMessagesAsRead(supervisorId);
        
        res.json({
            success: true,
            count: messages.length,
            unread_count: 0,
            messages: messages.map(m => ({
                id: m.id,
                message: m.message,
                attachment_url: m.attachment_url,
                report_id: m.report_id,
                sender_role: m.sender_role,
                sender_name: m.sender_role === 'supervisor' || m.sender_role === 'general_supervisor'
                    ? `${m.sender_first_name} ${m.sender_last_name}`
                    : `Admin ${m.admin_first_name || ''}`,
                created_at: m.created_at,
                is_read: m.is_read === 1
            }))
        });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
    }
};

const getUnreadMessageCount = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const count = await getUnreadCount(supervisorId);
        
        res.json({
            success: true,
            unread_count: count
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: error.message });
    }
};

module.exports = {
    getProfile,
    changePassword,
    getMyTeam,
    getTeamJobs,
    getAllTeamJobs,
    updateTeamJobStatus,
    getCashPaymentList,
    validateCashPayment,
    getCashPaymentStats,
    getCashPaymentHistory,
    generateWeeklyReport,
    getMyReports,
    downloadWeeklyReport,
    submitReportToAdmin,
    sendChatMessage,
    getChatMessages,
    getUnreadMessageCount
};