const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const {
    createPayment,
    getPaymentById,
    getPaymentsByUserId,
    getUserOutstandingBalance,
    getUserPaymentStats,
    generatePaymentNumber,
    updateBookingPaymentStatus,
    getUnpaidBookings
} = require('../models/paymentModel');

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '..', 'receipts');
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
}

// ==================== BRANDING ====================

const BRANDING = {
    primaryColor: '#1a5276',
    secondaryColor: '#2e86c1',
    successColor: '#27ae60',
    lightGray: '#f8f9fa',
    borderGray: '#dee2e6',
    darkGray: '#2c3e50',
    textGray: '#6c757d',
    white: '#ffffff',
    companyName: 'CleanSpark',
    address: 'Stone Town, Zanzibar',
    phone: '+255 777 000 000',
    email: 'info@cleanspark.co.tz'
};

// ==================== GET OUTSTANDING BALANCE ====================

const getOutstandingBalance = async (req, res) => {
    try {
        const userId = req.user.id;
        const balance = await getUserOutstandingBalance(userId);
        const unpaidBookings = await getUnpaidBookings(userId);

        res.json({
            success: true,
            balance: {
                total_due: parseFloat(balance[0].total_due || 0),
                total_paid: parseFloat(balance[0].total_paid || 0),
                outstanding_balance: parseFloat(balance[0].outstanding_balance || 0),
                total_bookings: balance[0].total_bookings,
                total_payments: balance[0].total_payments
            },
            unpaid_bookings: unpaidBookings.map(b => ({
                id: b.id,
                service_id: b.service_id,
                total_price: parseFloat(b.total_price),
                service_date: b.service_date,
                status: b.status,
                payment_status: b.payment_status
            }))
        });

    } catch (error) {
        console.error('Get outstanding balance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch outstanding balance',
            error: error.message
        });
    }
};

// ==================== PAY NOW (Make Payment) ====================

const makePayment = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            booking_id,
            amount,
            payment_method,
            transaction_id,
            reference,
            notes
        } = req.body;

        // Validate
        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: 'Valid payment amount is required' });
        }

        if (!payment_method || !['cash', 'card', 'mobile_money', 'bank_transfer'].includes(payment_method)) {
            return res.status(400).json({
                message: 'Valid payment method is required',
                valid_methods: ['cash', 'card', 'mobile_money', 'bank_transfer']
            });
        }

        // Generate payment number
        const paymentNumber = await generatePaymentNumber();

        // Create payment record
        const result = await createPayment({
            user_id: userId,
            booking_id: booking_id || null,
            payment_number: paymentNumber,
            transaction_id: transaction_id || `TXN-${Date.now()}`,
            reference: reference || `REF-${paymentNumber}`,
            amount: parseFloat(amount),
            payment_method,
            payment_status: 'completed',
            payment_date: new Date().toISOString().split('T')[0],
            notes: notes || null
        });

        const paymentId = result.insertId;

        // Update booking payment status if booking_id provided
        if (booking_id) {
            const balance = await getUserOutstandingBalance(userId);
            if (parseFloat(balance[0].outstanding_balance || 0) <= 0) {
                await updateBookingPaymentStatus(booking_id, 'paid');
            } else {
                await updateBookingPaymentStatus(booking_id, 'partial');
            }
        }

        // Get created payment with details
        const payment = await getPaymentById(paymentId);
        const p = payment[0];

        res.status(201).json({
            success: true,
            message: 'Payment processed successfully',
            payment: {
                id: p.id,
                payment_number: p.payment_number,
                transaction_id: p.transaction_id,
                reference: p.reference,
                amount: parseFloat(p.amount),
                payment_method: p.payment_method,
                payment_date: p.payment_date,
                payment_status: p.payment_status
            }
        });

    } catch (error) {
        console.error('Make payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process payment',
            error: error.message
        });
    }
};

// ==================== PAY ALL OUTSTANDING ====================

const payAllOutstanding = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            payment_method,
            transaction_id,
            reference,
            notes
        } = req.body;

        // Validate payment method
        if (!payment_method || !['cash', 'card', 'mobile_money', 'bank_transfer'].includes(payment_method)) {
            return res.status(400).json({
                message: 'Valid payment method is required',
                valid_methods: ['cash', 'card', 'mobile_money', 'bank_transfer']
            });
        }

        // Get unpaid bookings
        const unpaidBookings = await getUnpaidBookings(userId);

        if (unpaidBookings.length === 0) {
            return res.status(400).json({
                message: 'No outstanding payments found. All bookings are paid!'
            });
        }

        // Calculate total outstanding
        const totalOutstanding = unpaidBookings.reduce((sum, b) => sum + parseFloat(b.total_price), 0);

        // Generate payment number
        const paymentNumber = await generatePaymentNumber();

        // Create one payment for all outstanding bookings
        const result = await createPayment({
            user_id: userId,
            booking_id: null, // Multiple bookings
            payment_number: paymentNumber,
            transaction_id: transaction_id || `TXN-${Date.now()}`,
            reference: reference || `REF-BULK-${paymentNumber}`,
            amount: totalOutstanding,
            payment_method,
            payment_status: 'completed',
            payment_date: new Date().toISOString().split('T')[0],
            notes: notes || `Bulk payment for ${unpaidBookings.length} bookings`
        });

        const paymentId = result.insertId;

        // Mark all unpaid bookings as paid
        for (const booking of unpaidBookings) {
            await updateBookingPaymentStatus(booking.id, 'paid');
        }

        // Get created payment with details
        const payment = await getPaymentById(paymentId);
        const p = payment[0];

        res.status(201).json({
            success: true,
            message: `Successfully paid TZS ${totalOutstanding.toLocaleString()} for ${unpaidBookings.length} bookings`,
            payment: {
                id: p.id,
                payment_number: p.payment_number,
                transaction_id: p.transaction_id,
                reference: p.reference,
                amount: parseFloat(p.amount),
                payment_method: p.payment_method,
                payment_date: p.payment_date,
                payment_status: p.payment_status
            },
            bookings_paid: unpaidBookings.map(b => ({
                id: b.id,
                amount: parseFloat(b.total_price),
                service_date: b.service_date
            })),
            summary: {
                total_bookings_paid: unpaidBookings.length,
                total_amount: totalOutstanding,
                remaining_balance: 0
            }
        });

    } catch (error) {
        console.error('Pay all outstanding error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process bulk payment',
            error: error.message
        });
    }
};


// ==================== GET PAYMENT HISTORY ====================

const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const filters = {
            payment_status: req.query.payment_status,
            payment_method: req.query.payment_method,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const payments = await getPaymentsByUserId(userId, filters);
        const stats = await getUserPaymentStats(userId);
        const balance = await getUserOutstandingBalance(userId);

        res.json({
            success: true,
            count: payments.length,
            stats: {
                total_payments: stats[0].total_payments,
                total_amount_paid: parseFloat(stats[0].total_amount_paid || 0),
                average_payment: parseFloat(stats[0].average_payment || 0),
                largest_payment: parseFloat(stats[0].largest_payment || 0)
            },
            outstanding: {
                balance: parseFloat(balance[0].outstanding_balance || 0),
                total_due: parseFloat(balance[0].total_due || 0),
                total_paid: parseFloat(balance[0].total_paid || 0)
            },
            payments: payments.map(p => ({
                id: p.id,
                payment_number: p.payment_number,
                transaction_id: p.transaction_id,
                reference: p.reference,
                amount: parseFloat(p.amount),
                payment_method: p.payment_method,
                payment_date: p.payment_date,
                payment_status: p.payment_status,
                booking_id: p.booking_id,
                service_name: p.service_name || null,
                created_at: p.created_at
            }))
        });

    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history',
            error: error.message
        });
    }
};

// ==================== GET PAYMENT RECEIPT ====================

const getPaymentReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid payment ID' });
        }

        const payment = await getPaymentById(id);

        if (!payment || payment.length === 0) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        const p = payment[0];

        // Check ownership
        if (p.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({
            success: true,
            receipt: {
                payment_info: {
                    id: p.id,
                    payment_number: p.payment_number,
                    transaction_id: p.transaction_id,
                    reference: p.reference,
                    payment_method: p.payment_method,
                    payment_date: p.payment_date,
                    amount: parseFloat(p.amount),
                    status: p.payment_status,
                    notes: p.notes
                },
                payer_info: {
                    name: `${p.first_name} ${p.last_name}`,
                    email: p.user_email,
                    phone: p.user_phone
                },
                booking_info: p.booking_id ? {
                    id: p.booking_id,
                    service: p.service_name,
                    date: p.service_date,
                    total: parseFloat(p.booking_total || 0)
                } : null,
                created_at: p.created_at
            }
        });

    } catch (error) {
        console.error('Get payment receipt error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment receipt',
            error: error.message
        });
    }
};

// ==================== DOWNLOAD PAYMENT RECEIPT PDF ====================

const downloadPaymentReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const payment = await getPaymentById(id);

        if (!payment || payment.length === 0) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        const p = payment[0];

        if (p.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const filename = `receipt_${p.payment_number}.pdf`;
        const filePath = path.join(receiptsDir, filename);

        // Generate PDF
        await generatePaymentReceiptPDF(p, filePath);

        res.download(filePath, filename, (err) => {
            if (err) console.error('Download error:', err);
            setTimeout(() => {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }, 5000);
        });

    } catch (error) {
        console.error('Download payment receipt error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download receipt',
            error: error.message
        });
    }
};

// ==================== GENERATE PDF RECEIPT ====================

const generatePaymentReceiptPDF = (p, filePath) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const pageWidth = doc.page.width;
        const margin = 40;
        const contentWidth = pageWidth - (margin * 2);

        // Top bar
        doc.rect(0, 0, pageWidth, 6).fill(BRANDING.primaryColor);

        let yPos = 20;

        // Company Logo
        doc.rect(margin, yPos, 90, 65).fill(BRANDING.secondaryColor);
        doc.fillColor(BRANDING.white).fontSize(24).font('Helvetica-Bold')
           .text('CS', margin, yPos + 8, { width: 90, align: 'center' });
        doc.fontSize(9).text('CleanSpark', margin, yPos + 42, { width: 90, align: 'center' });

        // Company Info
        const rightX = pageWidth - margin - 180;
        doc.fillColor(BRANDING.primaryColor).fontSize(20).font('Helvetica-Bold')
           .text('PAYMENT RECEIPT', rightX, yPos);
        doc.fillColor(BRANDING.darkGray).fontSize(9).font('Helvetica')
           .text(BRANDING.companyName, rightX, yPos + 30)
           .fillColor(BRANDING.textGray).fontSize(8)
           .text(BRANDING.address, rightX, yPos + 44)
           .text(`Tel: ${BRANDING.phone}`, rightX, yPos + 56);

        yPos += 80;

        // Divider
        doc.strokeColor('#3498db').lineWidth(1)
           .moveTo(margin, yPos).lineTo(pageWidth - margin, yPos).stroke();

        yPos += 20;

        // Receipt Number & Status
        doc.fillColor(BRANDING.primaryColor).fontSize(14).font('Helvetica-Bold')
           .text(`Receipt #: ${p.payment_number}`, margin, yPos);

        // Status Badge
        const statusColor = p.payment_status === 'completed' ? '#27ae60' : '#f39c12';
        doc.roundedRect(pageWidth - margin - 120, yPos, 100, 22, 4).fill(statusColor);
        doc.fillColor(BRANDING.white).fontSize(9).font('Helvetica-Bold')
           .text(p.payment_status.toUpperCase(), pageWidth - margin - 120, yPos + 5, { width: 100, align: 'center' });

        yPos += 35;

        // Payer Info Box
        doc.rect(margin, yPos, contentWidth * 0.55, 90).stroke(BRANDING.borderGray);
        doc.rect(margin, yPos, contentWidth * 0.55, 25).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.primaryColor).fontSize(10).font('Helvetica-Bold')
           .text('PAYER INFORMATION', margin + 10, yPos + 7);

        doc.fillColor(BRANDING.darkGray).fontSize(9).font('Helvetica')
           .text(`Name: ${p.first_name} ${p.last_name}`, margin + 15, yPos + 35)
           .text(`Email: ${p.user_email || 'N/A'}`, margin + 15, yPos + 52)
           .text(`Phone: ${p.user_phone || 'N/A'}`, margin + 15, yPos + 69);

        // Payment Details Box
        const detailsX = margin + contentWidth * 0.55 + 10;
        const detailsWidth = contentWidth - contentWidth * 0.55 - 10;
        doc.rect(detailsX, yPos, detailsWidth, 90).stroke(BRANDING.borderGray);
        doc.rect(detailsX, yPos, detailsWidth, 25).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.primaryColor).fontSize(10).font('Helvetica-Bold')
           .text('PAYMENT DETAILS', detailsX + 10, yPos + 7);

        doc.fillColor(BRANDING.darkGray).fontSize(9).font('Helvetica')
           .text(`Method: ${p.payment_method}`, detailsX + 15, yPos + 35)
           .text(`Date: ${p.payment_date}`, detailsX + 15, yPos + 52)
           .text(`Transaction: ${p.transaction_id || 'N/A'}`, detailsX + 15, yPos + 69);

        yPos += 110;

        // Amount Box
        doc.rect(margin, yPos, contentWidth, 55).fill(BRANDING.primaryColor);
        doc.fillColor(BRANDING.white).fontSize(12).font('Helvetica')
           .text('AMOUNT PAID', margin + 15, yPos + 10);
        doc.fontSize(24).font('Helvetica-Bold')
           .text(`TZS ${parseFloat(p.amount).toLocaleString()}`, margin + 15, yPos + 28);

        if (p.notes) {
            yPos += 75;
            doc.fillColor(BRANDING.textGray).fontSize(8).font('Helvetica')
               .text(`Notes: ${p.notes}`, margin, yPos);
        }

        // Footer
        const footerY = doc.page.height - 40;
        doc.strokeColor('#3498db').lineWidth(1)
           .moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).stroke();
        doc.fillColor('#95a5a6').fontSize(7).font('Helvetica')
           .text('Thank you for your payment! | This is a computer-generated receipt',
                 margin, footerY + 8, { align: 'center', width: contentWidth });

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
    });
};

module.exports = {
    getOutstandingBalance,
    makePayment,
    payAllOutstanding,
    getPaymentHistory,
    getPaymentReceipt,
    downloadPaymentReceipt
};