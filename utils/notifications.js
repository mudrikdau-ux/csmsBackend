const nodemailer = require('nodemailer');
const { getEmailNotificationPreference, logNotification } = require('../models/userModel');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send email to user ONLY if they have enabled email notifications
 * @param {number} userId - User ID
 * @param {string} subject - Email subject
 * @param {string} htmlMessage - Email HTML content
 * @param {string} type - Notification type (for logging)
 * @returns {object} - Result of operation
 */
const sendEmailIfEnabled = async (userId, subject, htmlMessage, type = 'general') => {
    try {
        // Check if user has email notifications enabled
        const prefs = await getEmailNotificationPreference(userId);
        
        if (!prefs || prefs.length === 0) {
            return { sent: false, reason: 'User not found' };
        }

        const user = prefs[0];

        // Check if email notifications are enabled
        if (user.email_notifications === 0 ) {
            // Log that notification was skipped
            await logNotification({
                user_id: userId,
                notification_type: type,
                subject: subject,
                message: htmlMessage.replace(/<[^>]*>/g, '').substring(0, 500),
                sent_to: user.email,
                status: 'skipped'
            });
            
            return { sent: false, reason: 'User has disabled email notifications' };
        }

        // Send email
        const mailOptions = {
            from: `"CleanSpark" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: subject,
            html: htmlMessage
        };

        await transporter.sendMail(mailOptions);

        // Log successful notification
        await logNotification({
            user_id: userId,
            notification_type: type,
            subject: subject,
            message: htmlMessage.replace(/<[^>]*>/g, '').substring(0, 500),
            sent_to: user.email,
            status: 'sent'
        });

        console.log(`Email sent to ${user.email}: ${subject}`);
        return { sent: true, email: user.email };

    } catch (error) {
        console.error('Send email error:', error);
        
        // Log failed notification
        await logNotification({
            user_id: userId,
            notification_type: type,
            subject: subject,
            message: error.message,
            sent_to: 'unknown',
            status: 'failed'
        });
        
        return { sent: false, reason: error.message };
    }
};

// ==================== PREDEFINED NOTIFICATION TEMPLATES ====================

/**
 * Send booking confirmation
 */
const sendBookingConfirmation = async (userId, booking) => {
    const subject = `Booking Confirmed - #${booking.id}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
            <div style="background: #1a5276; padding: 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0;">✅ Booking Confirmed</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #2c3e50;">Hello ${booking.customer_name || 'Valued Customer'},</h2>
                <p style="color: #34495e; line-height: 1.6;">Your booking has been confirmed. Here are the details:</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Booking ID:</strong> #${booking.id}</p>
                    <p><strong>Service:</strong> ${booking.service_name || 'Cleaning Service'}</p>
                    <p><strong>Date:</strong> ${booking.service_date}</p>
                    <p><strong>Time:</strong> ${booking.service_time}</p>
                    <p><strong>Address:</strong> ${booking.address}, ${booking.city}</p>
                    <p><strong>Total:</strong> TZS ${parseFloat(booking.total_price || 0).toLocaleString()}</p>
                    ${booking.assigned_staff ? `<p><strong>Assigned Staff:</strong> ${booking.assigned_staff}</p>` : ''}
                </div>

                <p style="color: #7f8c8d; font-size: 12px;">If you have any questions, please contact us at info@cleanspark.co.tz</p>
            </div>
            <div style="background: #1a5276; padding: 15px; text-align: center;">
                <p style="color: #fff; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} CleanSpark Cleaning Services</p>
            </div>
        </div>
    `;
    
    return sendEmailIfEnabled(userId, subject, html, 'booking_confirmation');
};

/**
 * Send booking status update
 */
const sendBookingStatusUpdate = async (userId, booking, newStatus) => {
    const statusLabels = {
        'confirmed': 'Confirmed ✅',
        'in_progress': 'In Progress 🔄',
        'completed': 'Completed 🎉',
        'cancelled': 'Cancelled ❌'
    };
    
    const subject = `Booking #${booking.id} - ${statusLabels[newStatus] || newStatus}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
            <div style="background: #1a5276; padding: 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0;">Booking Status Update</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #2c3e50;">Hello,</h2>
                <p style="color: #34495e; line-height: 1.6;">Your booking status has been updated:</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <h3 style="color: #3498db; margin: 0;">${statusLabels[newStatus] || newStatus}</h3>
                    <p style="color: #7f8c8d;">Booking #${booking.id} - ${booking.service_name || 'Cleaning Service'}</p>
                    <p style="color: #7f8c8d;">${booking.service_date} at ${booking.service_time}</p>
                </div>

                <p style="color: #7f8c8d; font-size: 12px;">Login to your account to view full details.</p>
            </div>
            <div style="background: #1a5276; padding: 15px; text-align: center;">
                <p style="color: #fff; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} CleanSpark Cleaning Services</p>
            </div>
        </div>
    `;
    
    return sendEmailIfEnabled(userId, subject, html, 'booking_status_update');
};

/**
 * Send booking reminder (24 hours before)
 */
const sendBookingReminder = async (userId, booking) => {
    const subject = `Reminder: Booking #${booking.id} Tomorrow`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
            <div style="background: #f39c12; padding: 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0;">⏰ Booking Reminder</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #2c3e50;">Hello,</h2>
                <p style="color: #34495e; line-height: 1.6;">This is a reminder that your cleaning service is scheduled for tomorrow:</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Service:</strong> ${booking.service_name || 'Cleaning Service'}</p>
                    <p><strong>Date:</strong> ${booking.service_date}</p>
                    <p><strong>Time:</strong> ${booking.service_time}</p>
                    <p><strong>Address:</strong> ${booking.address}, ${booking.city}</p>
                    <p><strong>Staff:</strong> ${booking.assigned_staff || 'To be assigned'}</p>
                </div>

                <p style="color: #7f8c8d; font-size: 12px;">Please ensure someone is available at the premises during the service time.</p>
            </div>
            <div style="background: #1a5276; padding: 15px; text-align: center;">
                <p style="color: #fff; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} CleanSpark Cleaning Services</p>
            </div>
        </div>
    `;
    
    return sendEmailIfEnabled(userId, subject, html, 'booking_reminder');
};

/**
 * Send promotional email
 */
const sendPromotionalEmail = async (userId, promotion) => {
    const subject = promotion.subject || 'Special Offer from CleanSpark';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
            <div style="background: #2e86c1; padding: 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0;">${promotion.title || 'Special Offer'}</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #2c3e50;">Hello,</h2>
                <p style="color: #34495e; line-height: 1.6;">${promotion.message || 'Check out our latest offers!'}</p>
                
                ${promotion.discount ? `
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <h2 style="color: #e74c3c; margin: 0;">${promotion.discount}% OFF</h2>
                    <p style="color: #7f8c8d;">Use code: <strong>${promotion.code || 'CLEANSPARK'}</strong></p>
                </div>
                ` : ''}

                <p style="color: #7f8c8d; font-size: 12px;">To unsubscribe from promotional emails, go to your account settings.</p>
            </div>
            <div style="background: #1a5276; padding: 15px; text-align: center;">
                <p style="color: #fff; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} CleanSpark Cleaning Services</p>
            </div>
        </div>
    `;
    
    return sendEmailIfEnabled(userId, subject, html, 'promotional');
};

/**
 * Send welcome email after registration
 */
const sendWelcomeEmail = async (userId, userName) => {
    const subject = 'Welcome to CleanSpark! 🎉';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
            <div style="background: #1a5276; padding: 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0;">Welcome to CleanSpark!</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #2c3e50;">Hello ${userName},</h2>
                <p style="color: #34495e; line-height: 1.6;">Thank you for joining CleanSpark Cleaning Services! We're excited to have you.</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #3498db;">What you can do:</h3>
                    <ul style="color: #34495e;">
                        <li>Browse our cleaning services</li>
                        <li>Book a service online</li>
                        <li>Track your bookings</li>
                        <li>Rate our services</li>
                    </ul>
                </div>

                <p style="color: #7f8c8d; font-size: 12px;">If you have any questions, reply to this email or contact info@cleanspark.co.tz</p>
            </div>
            <div style="background: #1a5276; padding: 15px; text-align: center;">
                <p style="color: #fff; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} CleanSpark Cleaning Services</p>
            </div>
        </div>
    `;
    
    return sendEmailIfEnabled(userId, subject, html, 'welcome');
};

/**
 * Send OTP email (always sent regardless of preferences)
 */
const sendOTPEmailDirect = async (email, name, otp, expiryMinutes = 5) => {
    const subject = 'Your Login Verification Code (OTP)';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; background: #fff; padding: 30px; border-radius: 10px;">
            <h2 style="color: #1a5276;">CleanSpark</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your verification code is:</p>
            <div style="background: #f0f8ff; padding: 20px; text-align: center; margin: 20px 0;">
                <h1 style="letter-spacing: 10px; color: #3498db; margin: 0;">${otp}</h1>
            </div>
            <p style="color: #e74c3c; font-size: 12px;">Expires in ${expiryMinutes} minutes</p>
            <hr>
            <p style="font-size: 12px; color: #95a5a6;">If you didn't request this code, please ignore this email.</p>
        </div>
    `;
    
    const mailOptions = {
        from: `"CleanSpark" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: html
    };

    await transporter.sendMail(mailOptions);
    return true;
};

module.exports = {
    sendEmailIfEnabled,
    sendBookingConfirmation,
    sendBookingStatusUpdate,
    sendBookingReminder,
    sendPromotionalEmail,
    sendWelcomeEmail,
    sendOTPEmailDirect
};