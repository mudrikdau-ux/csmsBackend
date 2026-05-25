const nodemailer = require('nodemailer');
const {
    getSetting,
    getAllSettings,
    updateSetting,
    isEmailNotificationsEnabled,
    isAutoAssignEnabled
} = require('../models/adminSettingsModel');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==================== GET ALL SETTINGS ====================

const getSettings = async (req, res) => {
    try {
        const settings = await getAllSettings();
        const settingsObj = {};
        settings.forEach(s => {
            settingsObj[s.setting_key] = {
                value: s.setting_value === '1',
                description: s.description,
                updated_at: s.updated_at
            };
        });

        res.json({
            success: true,
            settings: {
                email_notifications: settingsObj.email_notifications || { value: true, description: 'Admin email notifications for new bookings' },
                auto_assign_staff: settingsObj.auto_assign_staff || { value: true, description: 'Auto-assign staff to new bookings' }
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch settings', error: error.message });
    }
};

// ==================== TOGGLE SETTING ====================

const toggleSetting = async (req, res) => {
    try {
        const { key, value } = req.body;

        const validKeys = ['email_notifications', 'auto_assign_staff'];
        if (!validKeys.includes(key)) {
            return res.status(400).json({ message: 'Invalid setting key', valid_keys: validKeys });
        }

        const settingValue = value === true || value === 'true' || value === 1 || value === '1' ? '1' : '0';

        await updateSetting(key, settingValue);

        const labels = {
            'email_notifications': 'Admin email notifications',
            'auto_assign_staff': 'Auto-assign staff'
        };

        res.json({
            success: true,
            message: `${labels[key]} ${settingValue === '1' ? 'ENABLED' : 'DISABLED'}`,
            setting: {
                key,
                value: settingValue === '1',
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update setting', error: error.message });
    }
};

// ==================== SEND BOOKING NOTIFICATION TO ADMIN ====================

const sendNewBookingNotification = async (booking) => {
    try {
        const enabled = await isEmailNotificationsEnabled();
        if (!enabled) {
            console.log('📧 Admin email notifications disabled, skipping...');
            return { sent: false, reason: 'Notifications disabled' };
        }

        // Get admin email from env or database
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

        const mailOptions = {
            from: `"CleanSpark System" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            subject: `🔔 New Booking #${booking.id} - ${booking.service_name || 'Cleaning Service'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
                    <div style="background: #1a5276; padding: 30px; text-align: center;">
                        <h1 style="color: #fff; margin: 0;">🔔 New Booking Received</h1>
                    </div>
                    <div style="padding: 30px;">
                        <h2 style="color: #2c3e50;">New Booking Alert!</h2>
                        <p style="color: #34495e;">A new booking has been created and requires your attention.</p>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Booking ID:</strong> #${booking.id}</p>
                            <p><strong>Customer:</strong> ${booking.customer_name || 'N/A'}</p>
                            <p><strong>Service:</strong> ${booking.service_name || 'N/A'}</p>
                            <p><strong>Date:</strong> ${booking.service_date}</p>
                            <p><strong>Time:</strong> ${booking.service_time}</p>
                            <p><strong>Address:</strong> ${booking.address}, ${booking.city}</p>
                            <p><strong>Total:</strong> TZS ${parseFloat(booking.total_price || 0).toLocaleString()}</p>
                            <p><strong>Payment:</strong> ${booking.payment_method || 'N/A'}</p>
                            ${booking.assigned_staff ? `<p><strong>Auto-Assigned Staff:</strong> ${booking.assigned_staff}</p>` : ''}
                        </div>
                        <p style="color: #7f8c8d; font-size: 12px;">Login to admin panel to manage this booking.</p>
                    </div>
                    <div style="background: #1a5276; padding: 15px; text-align: center;">
                        <p style="color: #fff; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} CleanSpark Cleaning Services</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Admin notification sent:', info.messageId);
        return { sent: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Admin notification failed:', error.message);
        return { sent: false, reason: error.message };
    }
};

module.exports = {
    getSettings,
    toggleSetting,
    sendNewBookingNotification
};