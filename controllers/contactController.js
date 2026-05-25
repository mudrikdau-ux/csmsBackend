const nodemailer = require('nodemailer');
const {
    createInquiry,
    getInquiryById,
    getAllInquiries,
    updateInquiryStatus,
    addReply,
    getInquiryCount,
    markAsRead,
    deleteInquiry
} = require('../models/contactModel');

// Email transporter for replies
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==================== PUBLIC: SUBMIT INQUIRY ====================

const submitInquiry = async (req, res) => {
    try {
        const {
            full_name,
            email,
            phone,
            service_type,
            subject,
            message,
            subscribe
        } = req.body;

        // Validate required fields
        if (!full_name || !email || !phone || !service_type || !subject || !message) {
            return res.status(400).json({
                message: 'All fields are required',
                required: ['full_name', 'email', 'phone', 'service_type', 'subject', 'message']
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Validate phone
        if (!/^[\d\+\-\(\) ]{10,20}$/.test(phone)) {
            return res.status(400).json({ message: 'Invalid phone number format' });
        }

        // Validate message length
        if (message.length < 10) {
            return res.status(400).json({ message: 'Message must be at least 10 characters' });
        }

        // Create inquiry
        const result = await createInquiry({
            full_name: full_name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            service_type: service_type.trim(),
            subject: subject.trim(),
            message: message.trim(),
            subscribe: subscribe || false
        });

        // Send confirmation email to customer
        try {
            const info = await transporter.sendMail({
                from: `"CleanSpark" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'We received your inquiry - CleanSpark',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
                        <div style="background: #1a5276; padding: 30px; text-align: center;">
                            <h1 style="color: #fff; margin: 0;">📩 Inquiry Received</h1>
                        </div>
                        <div style="padding: 30px;">
                            <h2 style="color: #2c3e50;">Hello ${full_name},</h2>
                            <p style="color: #34495e; line-height: 1.6;">Thank you for contacting CleanSpark. We have received your inquiry regarding <strong>${subject}</strong>.</p>
                            <p style="color: #34495e; line-height: 1.6;">Our team will review your message and get back to you within 24 hours.</p>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Your Inquiry Details:</strong></p>
                                <p style="color: #7f8c8d;">Service: ${service_type}</p>
                                <p style="color: #7f8c8d;">Subject: ${subject}</p>
                            </div>
                            <p style="color: #7f8c8d; font-size: 12px;">If you have any urgent questions, call us at +255 777 000 000.</p>
                        </div>
                        <div style="background: #1a5276; padding: 15px; text-align: center;">
                            <p style="color: #fff; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} CleanSpark Cleaning Services</p>
                        </div>
                    </div>
                `
            });
            console.log('✅ Confirmation email sent to:', email, 'Message ID:', info.messageId);
        } catch (emailError) {
            console.error('❌ Confirmation email failed:', emailError.message);
            console.error('Full error:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Your inquiry has been submitted successfully. We will get back to you soon!',
            inquiry_id: result.insertId
        });

    } catch (error) {
        console.error('Submit inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit inquiry',
            error: error.message
        });
    }
};

// ==================== ADMIN: GET ALL INQUIRIES ====================

const getInquiries = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            service_type: req.query.service_type,
            search: req.query.search,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const inquiries = await getAllInquiries(filters);
        
        // Get counts for tabs
        const allCount = await getInquiryCount({});
        const unreadCount = await getInquiryCount({ status: 'unread' });
        const readCount = await getInquiryCount({ status: 'read' });
        const repliedCount = await getInquiryCount({ status: 'replied' });

        res.json({
            success: true,
            count: inquiries.length,
            filter_counts: {
                all: allCount[0].count,
                unread: unreadCount[0].count,
                read: readCount[0].count,
                replied: repliedCount[0].count
            },
            inquiries: inquiries.map(inq => ({
                id: inq.id,
                from: inq.full_name,
                type: 'Customer',
                email: inq.email,
                phone: inq.phone,
                service_type: inq.service_type,
                subject: inq.subject,
                preview: inq.message.substring(0, 100) + (inq.message.length > 100 ? '...' : ''),
                status: inq.status,
                status_label: getStatusLabel(inq.status),
                subscribe: inq.subscribe === 1,
                date: inq.created_at,
                has_reply: inq.reply_message ? true : false
            }))
        });

    } catch (error) {
        console.error('Get inquiries error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inquiries',
            error: error.message
        });
    }
};

// ==================== ADMIN: GET SINGLE INQUIRY ====================

const getSingleInquiry = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid inquiry ID' });
        }

        const inquiry = await getInquiryById(id);

        if (!inquiry || inquiry.length === 0) {
            return res.status(404).json({ message: 'Inquiry not found' });
        }

        const inq = inquiry[0];

        // Mark as read if unread
        if (inq.status === 'unread') {
            await markAsRead(id);
        }

        res.json({
            success: true,
            inquiry: {
                id: inq.id,
                from: inq.full_name,
                type: 'Customer',
                email: inq.email,
                phone: inq.phone,
                service_type: inq.service_type,
                subject: inq.subject,
                message: inq.message,
                subscribe: inq.subscribe === 1,
                status: inq.status,
                status_label: getStatusLabel(inq.status),
                reply: inq.reply_message ? {
                    message: inq.reply_message,
                    replied_by: inq.replied_by_name ? `${inq.replied_by_name} ${inq.replied_by_lastname || ''}` : 'Admin',
                    replied_at: inq.replied_at
                } : null,
                date: inq.created_at
            }
        });

    } catch (error) {
        console.error('Get single inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inquiry',
            error: error.message
        });
    }
};

// ==================== ADMIN: REPLY TO INQUIRY ====================

const replyToInquiry = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply_message } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid inquiry ID' });
        }

        if (!reply_message || reply_message.trim().length < 5) {
            return res.status(400).json({ message: 'Reply message must be at least 5 characters' });
        }

        const inquiry = await getInquiryById(id);

        if (!inquiry || inquiry.length === 0) {
            return res.status(404).json({ message: 'Inquiry not found' });
        }

        const inq = inquiry[0];

        // Save reply to database
        await addReply(id, reply_message.trim(), req.user.id);

        // ✅ Send reply email to customer with detailed logging
        let emailSent = false;
        let emailErrorMsg = null;
        
        try {
            const mailOptions = {
                from: `"CleanSpark Support" <${process.env.EMAIL_USER}>`,
                to: inq.email,
                subject: `Re: ${inq.subject} - CleanSpark`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #fff; border-radius: 10px; overflow: hidden;">
                        <div style="background: #27ae60; padding: 30px; text-align: center;">
                            <h1 style="color: #fff; margin: 0;">💬 Response to Your Inquiry</h1>
                        </div>
                        <div style="padding: 30px;">
                            <h2 style="color: #2c3e50;">Hello ${inq.full_name},</h2>
                            <p style="color: #34495e; line-height: 1.6;">Thank you for reaching out to us. Here is our response to your inquiry regarding <strong>${inq.subject}</strong>:</p>
                            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
                                <p style="color: #2c3e50; line-height: 1.6;">${reply_message.replace(/\n/g, '<br>')}</p>
                            </div>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="color: #7f8c8d; font-size: 12px;"><strong>Your original message:</strong> ${inq.message.substring(0, 200)}...</p>
                            </div>
                            <p style="color: #7f8c8d; font-size: 12px;">If you have further questions, feel free to reply to this email or call us at +255 777 000 000.</p>
                        </div>
                        <div style="background: #1a5276; padding: 15px; text-align: center;">
                            <p style="color: #fff; margin: 0; font-size: 12px;">© ${new Date().getFullYear()} CleanSpark Cleaning Services</p>
                        </div>
                    </div>
                `
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('✅ Reply email sent to:', inq.email);
            console.log('✅ Message ID:', info.messageId);
            console.log('✅ Response:', info.response);
            emailSent = true;
        } catch (emailError) {
            emailErrorMsg = emailError.message;
            console.error('❌ Reply email FAILED:');
            console.error('❌ Error message:', emailError.message);
            console.error('❌ Error code:', emailError.code);
            console.error('❌ Full error:', JSON.stringify(emailError, null, 2));
        }

        res.json({
            success: true,
            message: emailSent 
                ? 'Reply sent successfully to customer email' 
                : `Reply saved but email could not be sent. Error: ${emailErrorMsg}`,
            inquiry: {
                id: parseInt(id),
                status: 'replied',
                status_label: 'Replied',
                email_sent: emailSent
            }
        });

    } catch (error) {
        console.error('Reply to inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send reply',
            error: error.message
        });
    }
};

// ==================== ADMIN: UPDATE INQUIRY STATUS ====================

const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid inquiry ID' });
        }

        const validStatuses = ['unread', 'read', 'replied', 'archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        await updateInquiryStatus(id, status);

        res.json({
            success: true,
            message: 'Status updated',
            inquiry: { id: parseInt(id), status, status_label: getStatusLabel(status) }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
    }
};

// ==================== ADMIN: DELETE INQUIRY ====================

const removeInquiry = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid inquiry ID' });
        }

        const inquiry = await getInquiryById(id);
        if (!inquiry || inquiry.length === 0) {
            return res.status(404).json({ message: 'Inquiry not found' });
        }

        await deleteInquiry(id);

        res.json({ success: true, message: 'Inquiry deleted' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete inquiry', error: error.message });
    }
};

// ==================== HELPER ====================

const getStatusLabel = (status) => {
    const labels = {
        'unread': 'Unread',
        'read': 'Read',
        'replied': 'Replied',
        'archived': 'Archived'
    };
    return labels[status] || status;
};

module.exports = {
    submitInquiry,
    getInquiries,
    getSingleInquiry,
    replyToInquiry,
    updateStatus,
    removeInquiry
};