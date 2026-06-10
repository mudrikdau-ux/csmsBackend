const {
    createBooking,
    getBookingById,
    getAllBookings,
    getBookingsByUserId,
    updateBookingStatus,
    updateBookingPaymentStatus,
    assignStaffToBooking,
    removeStaffAssignment,
    getBookingCount,
    getStaffBookings,
    updateBookingEstimation,
    updateInvoiceGenerated
} = require('../models/bookingModel');

const {
    createCustomerInvoice,
    getCustomerInvoiceById,
    getCustomerInvoicesByUserId,
    updateInvoiceStatus,
    updateInvoicePdfPath
} = require('../models/customerInvoiceModel');

const { getServiceById } = require('../models/serviceModel');
const { getStaffById } = require('../models/userModel');
const { sendBookingConfirmation, sendBookingStatusUpdate, sendInvoiceEmail } = require('../utils/notifications');
const { isAutoAssignEnabled } = require('../models/adminSettingsModel');
const { sendNewBookingNotification } = require('./adminSettingsController');
const db = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ==================== HELPER: CALCULATE DYNAMIC PRICE ====================

const calculateDynamicPrice = (servicePrice, bedrooms, bathrooms, dirtLevel, cleaningFrequency) => {
    let basePrice = servicePrice;
    
    // Size adjustment based on bedrooms and bathrooms
    let sizeAdjustment = 0;
    if (bedrooms) {
        sizeAdjustment += bedrooms * 5000; // TZS 5,000 per bedroom
    }
    if (bathrooms) {
        sizeAdjustment += bathrooms * 3000; // TZS 3,000 per bathroom
    }
    
    // Condition adjustment based on dirt level
    let conditionAdjustment = 0;
    switch(dirtLevel) {
        case 'light':
            conditionAdjustment = 0;
            break;
        case 'moderate':
            conditionAdjustment = basePrice * 0.15; // 15% extra
            break;
        case 'heavy':
            conditionAdjustment = basePrice * 0.30; // 30% extra
            break;
        default:
            conditionAdjustment = 0;
    }
    
    // Frequency discount
    let frequencyDiscount = 0;
    switch(cleaningFrequency) {
        case 'weekly':
            frequencyDiscount = basePrice * 0.10; // 10% off
            break;
        case 'monthly':
            frequencyDiscount = basePrice * 0.05; // 5% off
            break;
        default:
            frequencyDiscount = 0;
    }
    
    const subtotal = basePrice + sizeAdjustment + conditionAdjustment;
    const total = subtotal - frequencyDiscount;
    
    return {
        basePrice,
        sizeAdjustment,
        conditionAdjustment,
        frequencyDiscount,
        total
    };
};

// ==================== HELPER: GENERATE INVOICE PDF ====================

const generateInvoicePDF = async (invoice) => {
    const invoicesDir = path.join(__dirname, '..', 'invoices', 'customer');
    if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
    }
    
    const filename = `invoice_${invoice.invoice_number}.pdf`;
    const filePath = path.join(invoicesDir, filename);
    
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        
        // Header
        doc.rect(0, 0, doc.page.width, 80).fill('#1a5276');
        doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('CleanSpark', 50, 25);
        doc.fontSize(10).text('Professional Cleaning Services', 50, 55);
        
        // Invoice Title
        doc.fillColor('#2c3e50').fontSize(18).font('Helvetica-Bold').text('INVOICE', 50, 110);
        doc.fontSize(10).font('Helvetica').text(`Invoice #: ${invoice.invoice_number}`, 50, 135);
        doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 50, 150);
        doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 50, 165);
        
        // Customer Info
        let yPos = 210;
        doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 50, yPos);
        yPos += 20;
        doc.fontSize(10).font('Helvetica');
        doc.text(`${invoice.first_name} ${invoice.last_name}`, 50, yPos);
        yPos += 15;
        doc.text(invoice.email, 50, yPos);
        yPos += 15;
        if (invoice.phone) doc.text(invoice.phone, 50, yPos);
        yPos += 15;
        doc.text(`${invoice.address}, ${invoice.city}`, 50, yPos);
        
        // Service Details
        yPos = 320;
        doc.fontSize(12).font('Helvetica-Bold').text('Service Details:', 50, yPos);
        yPos += 25;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Service: ${invoice.service_name}`, 50, yPos);
        yPos += 20;
        doc.text(`Date: ${invoice.service_date} at ${invoice.service_time}`, 50, yPos);
        
        // Pricing Table
        yPos = 400;
        const tableTop = yPos;
        const col1 = 50;
        const col3 = 450;
        
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Description', col1, tableTop);
        doc.text('Amount (TZS)', col3, tableTop, { width: 100, align: 'right' });
        
        doc.moveTo(col1, tableTop + 15).lineTo(doc.page.width - 50, tableTop + 15).stroke();
        
        let rowY = tableTop + 25;
        doc.font('Helvetica');
        
        const items = [
            ['Service Cost', invoice.service_cost],
            ['Labor Cost', invoice.labor_cost],
            ['Transport Cost', invoice.transport_cost],
            ['Equipment Cost', invoice.equipment_cost]
        ];
        
        items.forEach(item => {
            if (item[1] > 0) {
                doc.text(item[0], col1, rowY);
                doc.text(item[1].toLocaleString(), col3, rowY, { width: 100, align: 'right' });
                rowY += 20;
            }
        });
        
        rowY += 10;
        doc.moveTo(col1, rowY).lineTo(doc.page.width - 50, rowY).stroke();
        rowY += 10;
        
        doc.font('Helvetica-Bold');
        doc.text('Subtotal', col1, rowY);
        doc.text((invoice.service_cost + invoice.labor_cost + invoice.transport_cost + invoice.equipment_cost).toLocaleString(), col3, rowY, { width: 100, align: 'right' });
        rowY += 20;
        
        if (invoice.tax_rate > 0) {
            doc.text(`Tax (${invoice.tax_rate}%)`, col1, rowY);
            doc.text(invoice.tax_amount.toLocaleString(), col3, rowY, { width: 100, align: 'right' });
            rowY += 20;
        }
        
        if (invoice.discount_amount > 0) {
            doc.text('Discount', col1, rowY);
            doc.text(`-${invoice.discount_amount.toLocaleString()}`, col3, rowY, { width: 100, align: 'right' });
            rowY += 20;
        }
        
        doc.moveTo(col1, rowY).lineTo(doc.page.width - 50, rowY).stroke();
        rowY += 10;
        
        doc.fontSize(14).fillColor('#1a5276');
        doc.text('TOTAL', col1, rowY);
        doc.text(invoice.total_amount.toLocaleString(), col3, rowY, { width: 100, align: 'right' });
        
        // Notes
        if (invoice.notes) {
            rowY += 50;
            doc.fontSize(10).fillColor('#7f8c8d');
            doc.text('Notes:', 50, rowY);
            doc.text(invoice.notes, 50, rowY + 15);
        }
        
        // Footer
        const footerY = doc.page.height - 50;
        doc.fontSize(8).fillColor('#95a5a6');
        doc.text('Thank you for choosing CleanSpark!', 50, footerY, { align: 'center', width: doc.page.width - 100 });
        
        doc.end();
        
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
};

// ==================== AUTO-ASSIGN STAFF ====================

const autoAssignStaff = async (bookingId, serviceDate, serviceTime) => {
    try {
        const enabled = await isAutoAssignEnabled();
        if (!enabled) {
            console.log('🤖 Auto-assign disabled, skipping...');
            return null;
        }

        const staffMembers = await db.query(`SELECT * FROM users WHERE role = 'staff'`);
        
        if (!staffMembers || staffMembers.length === 0) {
            console.log('🤖 No staff members available for auto-assign');
            return null;
        }

        const staffWithLoads = await Promise.all(
            staffMembers.map(async (staff) => {
                const bookings = await db.query(
                    `SELECT COUNT(*) as count FROM bookings WHERE assigned_staff_id = ? AND service_date = ? AND status NOT IN ('cancelled', 'completed')`,
                    [staff.id, serviceDate]
                );
                return { ...staff, current_load: bookings[0].count };
            })
        );

        staffWithLoads.sort((a, b) => a.current_load - b.current_load);
        const selectedStaff = staffWithLoads[0];
        const staffName = `${selectedStaff.first_name} ${selectedStaff.last_name}`;
        
        await assignStaffToBooking(bookingId, selectedStaff.id, staffName);

        console.log(`🤖 Auto-assigned staff: ${staffName} (ID: ${selectedStaff.id}) to booking #${bookingId}`);
        return { id: selectedStaff.id, name: staffName };

    } catch (error) {
        console.error('🤖 Auto-assign error:', error.message);
        return null;
    }
};

// ==================== HELPER: STATUS LABELS ====================

const getStatusLabel = (status) => {
    const labels = {
        'pending': 'Pending',
        'confirmed': 'Upcoming',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return labels[status] || status;
};

// ==================== HELPER: PAYMENT STATUS LABELS ====================

const getPaymentStatusLabel = (status) => {
    return status === 'paid' ? 'Paid ✅' : 'Unpaid ❌';
};

// ==================== CREATE BOOKING (WITH DYNAMIC PRICING) ====================

const createBookingController = async (req, res) => {
    try {
        const data = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;

        // Validate service exists
        const serviceResult = await getServiceById(data.service_id);
        
        if (!serviceResult || serviceResult.length === 0) {
            return res.status(404).json({ 
                message: 'Service not found',
                service_id: data.service_id,
                hint: 'Please check available services at GET /api/services'
            });
        }

        const service = serviceResult[0];

        // Check duplicate booking
        const duplicateBooking = await getBookingsByUserId(userId, {
            service_id: data.service_id,
            service_date: data.service_date,
            status: 'pending'
        });

        if (duplicateBooking.length > 0) {
            return res.status(409).json({
                message: 'You already have a pending booking for this service on this date',
                existing_booking_id: duplicateBooking[0].id
            });
        }

        // Calculate dynamic price based on detailed inputs
        const pricing = calculateDynamicPrice(
            parseFloat(service.price),
            data.bedrooms,
            data.bathrooms,
            data.dirt_level,
            data.cleaning_frequency
        );

        // Create booking with detailed info
        const result = await createBooking({
            ...data,
            user_id: userId,
            email: userEmail,
            base_price: pricing.basePrice,
            extras: pricing.sizeAdjustment + pricing.conditionAdjustment,
            discount: pricing.frequencyDiscount,
            total_price: pricing.total,
            status: 'pending',
            payment_status: 'unpaid'
        });

        const bookingId = result.insertId;

        // Send booking confirmation email to customer
        sendBookingConfirmation(userId, {
            id: bookingId,
            customer_name: `${data.first_name} ${data.last_name}`,
            service_name: service.name,
            service_date: data.service_date,
            service_time: data.service_time,
            address: data.address,
            city: data.city,
            total_price: pricing.total,
            assigned_staff: null,
            estimated: true
        });

        // Auto-assign staff (if enabled in settings)
        const assignedStaff = await autoAssignStaff(bookingId, data.service_date, data.service_time);

        // Send admin notification (if enabled in settings)
        sendNewBookingNotification({
            id: bookingId,
            customer_name: `${data.first_name} ${data.last_name}`,
            service_name: service.name,
            service_date: data.service_date,
            service_time: data.service_time,
            address: data.address,
            city: data.city,
            total_price: pricing.total,
            payment_method: data.payment_method,
            assigned_staff: assignedStaff ? assignedStaff.name : null
        });

        res.status(201).json({
            success: true,
            message: 'Booking created successfully. Admin will review and provide final pricing.',
            booking: {
                id: bookingId,
                user_id: userId,
                service: {
                    id: service.id,
                    name: service.name,
                    price: parseFloat(service.price),
                    duration: service.duration,
                    location: service.location
                },
                cleaners: data.cleaners,
                hours: data.hours,
                frequency: data.frequency,
                materials_provided: data.materials || false,
                property_type: data.property_type,
                property_type_detail: data.property_type_detail,
                bedrooms: data.bedrooms,
                bathrooms: data.bathrooms,
                dirt_level: data.dirt_level,
                cleaning_frequency: data.cleaning_frequency,
                address: data.address,
                area_district: data.area_district,
                city: data.city,
                region: data.region,
                landmark: data.landmark || null,
                building_name: data.building_name,
                floor_number: data.floor_number,
                pin_latitude: data.pin_latitude,
                pin_longitude: data.pin_longitude,
                payment_method: data.payment_method,
                preferred_communication: data.preferred_communication,
                alternative_phone: data.alternative_phone,
                special_instructions_cleaners: data.special_instructions_cleaners,
                pricing: {
                    base_price: pricing.basePrice,
                    size_adjustment: pricing.sizeAdjustment,
                    condition_adjustment: pricing.conditionAdjustment,
                    frequency_discount: pricing.frequencyDiscount,
                    estimated_total: pricing.total
                },
                payment_status: 'unpaid',
                payment_status_label: getPaymentStatusLabel('unpaid'),
                status: assignedStaff ? 'confirmed' : 'pending',
                status_label: getStatusLabel(assignedStaff ? 'confirmed' : 'pending'),
                estimation_status: 'pending',
                service_date: data.service_date,
                service_time: data.service_time,
                auto_assigned: assignedStaff ? {
                    id: assignedStaff.id,
                    name: assignedStaff.name
                } : null
            }
        });

    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to create booking', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: UPDATE BOOKING ESTIMATION ====================

const updateBookingEstimationController = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            service_cost,
            labor_cost,
            transport_cost,
            equipment_cost,
            tax_rate,
            discount
        } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const serviceCost = parseFloat(service_cost) || 0;
        const laborCost = parseFloat(labor_cost) || 0;
        const transportCost = parseFloat(transport_cost) || 0;
        const equipmentCost = parseFloat(equipment_cost) || 0;
        const taxRate = parseFloat(tax_rate) || 0;
        const discountAmount = parseFloat(discount) || 0;

        const subtotal = serviceCost + laborCost + transportCost + equipmentCost;
        const taxAmount = subtotal * (taxRate / 100);
        const finalTotal = subtotal + taxAmount - discountAmount;

        await updateBookingEstimation(id, {
            estimated_service_cost: serviceCost,
            labor_cost: laborCost,
            transport_cost: transportCost,
            equipment_cost_admin: equipmentCost,
            tax_rate_admin: taxRate,
            tax_amount_admin: taxAmount,
            discount_admin: discountAmount,
            final_total: finalTotal
        });

        res.json({
            success: true,
            message: 'Estimation saved successfully',
            estimation: {
                subtotal,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                discount: discountAmount,
                final_total: finalTotal
            }
        });

    } catch (error) {
        console.error('Update estimation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update estimation', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: GENERATE AND SEND INVOICE ====================

// ==================== ADMIN: GENERATE AND SEND INVOICE ====================

const generateAndSendInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const { due_date, notes } = req.body;

        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        if (b.estimation_status !== 'estimated') {
            return res.status(400).json({ message: 'Please save estimation first before generating invoice' });
        }

        // Get service name
        const serviceResult = await getServiceById(b.service_id);
        const serviceName = serviceResult && serviceResult.length > 0 ? serviceResult[0].name : 'Cleaning Service';

        // Ensure all values are proper numbers
        const serviceCost = parseFloat(b.estimated_service_cost) || 0;
        const laborCost = parseFloat(b.labor_cost) || 0;
        const transportCost = parseFloat(b.transport_cost) || 0;
        const equipmentCost = parseFloat(b.equipment_cost_admin) || 0;
        const taxRate = parseFloat(b.tax_rate_admin) || 0;
        const taxAmount = parseFloat(b.tax_amount_admin) || 0;
        const discountAmount = parseFloat(b.discount_admin) || 0;
        const totalAmount = parseFloat(b.final_total) || 0;

        // Calculate subtotal properly
        const subtotal = serviceCost + laborCost + transportCost + equipmentCost;

        // Create invoice record
        const invoiceResult = await createCustomerInvoice({
            booking_id: id,
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: due_date || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
            service_cost: serviceCost,
            labor_cost: laborCost,
            transport_cost: transportCost,
            equipment_cost: equipmentCost,
            subtotal: subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            total_amount: totalAmount,
            notes: notes || null,
            created_by: req.user.id
        });

        const invoiceId = invoiceResult.insertId;
        
        // Get full invoice details
        const invoice = await getCustomerInvoiceById(invoiceId);
        if (!invoice || invoice.length === 0) {
            throw new Error('Failed to retrieve invoice');
        }
        
        // Generate PDF
        const pdfPath = await generateInvoicePDF({
            ...invoice[0],
            service_name: serviceName,
            first_name: b.first_name,
            last_name: b.last_name,
            email: b.email,
            phone: b.phone,
            address: b.address,
            city: b.city,
            service_date: b.service_date,
            service_time: b.service_time
        });
        
        await updateInvoicePdfPath(invoiceId, pdfPath);
        
        // Update booking
        await updateInvoiceGenerated(id, pdfPath);
        
        // Send email to customer
        if (b.user_id) {
            await sendInvoiceEmail(b.user_id, {
                invoice_number: invoice[0].invoice_number,
                total_amount: totalAmount,
                due_date: due_date || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
            });
        }

        res.json({
            success: true,
            message: 'Invoice generated and sent to customer',
            invoice: {
                id: invoiceId,
                invoice_number: invoice[0].invoice_number,
                total_amount: totalAmount,
                pdf_url: `/api/bookings/invoices/${invoiceId}/download`
            }
        });

    } catch (error) {
        console.error('Generate invoice error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to generate invoice', 
            error: error.message 
        });
    }
};

// ==================== CUSTOMER: GET MY INVOICES ====================

const getMyInvoices = async (req, res) => {
    try {
        const userId = req.user.id;
        const invoices = await getCustomerInvoicesByUserId(userId);

        res.json({
            success: true,
            count: invoices.length,
            invoices: invoices.map(inv => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                service_name: inv.service_name,
                service_date: inv.service_date,
                total_amount: parseFloat(inv.total_amount),
                status: inv.status,
                invoice_date: inv.invoice_date,
                due_date: inv.due_date,
                pdf_url: `/api/bookings/invoices/${inv.id}/download`
            }))
        });

    } catch (error) {
        console.error('Get my invoices error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch invoices', 
            error: error.message 
        });
    }
};

// ==================== CUSTOMER: DOWNLOAD INVOICE ====================

const downloadCustomerInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const invoice = await getCustomerInvoiceById(id);
        if (invoice.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Verify ownership
        const booking = await getBookingById(invoice[0].booking_id);
        if (booking[0].user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (invoice[0].pdf_path && fs.existsSync(invoice[0].pdf_path)) {
            return res.download(invoice[0].pdf_path, `Invoice_${invoice[0].invoice_number}.pdf`);
        }

        // Generate PDF if not exists
        const serviceResult = await getServiceById(booking[0].service_id);
        const serviceName = serviceResult && serviceResult.length > 0 ? serviceResult[0].name : 'Cleaning Service';
        
        const pdfPath = await generateInvoicePDF({
            ...invoice[0],
            service_name: serviceName,
            first_name: booking[0].first_name,
            last_name: booking[0].last_name,
            email: booking[0].email,
            phone: booking[0].phone,
            address: booking[0].address,
            city: booking[0].city,
            service_date: booking[0].service_date,
            service_time: booking[0].service_time
        });
        
        await updateInvoicePdfPath(id, pdfPath);
        res.download(pdfPath, `Invoice_${invoice[0].invoice_number}.pdf`);

    } catch (error) {
        console.error('Download invoice error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to download invoice', 
            error: error.message 
        });
    }
};

// ==================== GET MY BOOKINGS (ENHANCED) ====================

const getMyBookings = async (req, res) => {
    try {
        const userId = req.user.id;
        
        let statusFilter = req.query.status;
        
        if (req.query.filter) {
            switch (req.query.filter) {
                case 'upcoming':
                    statusFilter = 'confirmed';
                    break;
                case 'pending':
                    statusFilter = 'pending';
                    break;
                case 'in_progress':
                    statusFilter = 'in_progress';
                    break;
                case 'delivered':
                case 'completed':
                    statusFilter = 'completed';
                    break;
                case 'cancelled':
                    statusFilter = 'cancelled';
                    break;
                case 'unpaid':
                    statusFilter = 'pending';
                    break;
                case 'all':
                    statusFilter = null;
                    break;
            }
        }
        
        const filters = {
            status: statusFilter,
            payment_status: req.query.payment_status,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const bookings = await getBookingsByUserId(userId, filters);

        const enrichedBookings = await Promise.all(
            bookings.map(async (b) => {
                let serviceName = 'Unknown Service';
                let serviceLocation = null;
                let serviceDuration = null;
                let servicePrice = null;
                
                if (b.service_id) {
                    try {
                        const serviceResult = await getServiceById(b.service_id);
                        if (serviceResult && serviceResult.length > 0) {
                            const s = serviceResult[0];
                            serviceName = s.name;
                            serviceLocation = s.location;
                            serviceDuration = s.duration;
                            servicePrice = parseFloat(s.price);
                        }
                    } catch (err) {}
                }

                let assignedStaffDetails = null;
                if (b.assigned_staff_id) {
                    try {
                        const staffResult = await getStaffById(b.assigned_staff_id);
                        if (staffResult && staffResult.length > 0) {
                            const staff = staffResult[0];
                            assignedStaffDetails = {
                                id: staff.id,
                                full_name: `${staff.first_name} ${staff.last_name}`,
                                first_name: staff.first_name,
                                last_name: staff.last_name,
                                email: staff.email,
                                phone: staff.phone,
                                staff_type: staff.staff_type,
                                photo: staff.photo ? `${req.protocol}://${req.get('host')}/uploads/staff/${staff.photo}` : null
                            };
                        }
                    } catch (err) {}
                }

                return {
                    id: b.id,
                    service: {
                        id: b.service_id,
                        name: serviceName,
                        price: servicePrice,
                        duration: serviceDuration,
                        location: serviceLocation
                    },
                    booking_details: {
                        cleaners: b.cleaners,
                        hours: b.hours,
                        frequency: b.frequency,
                        materials_provided: b.materials ? true : false,
                        property_type: b.property_type,
                        property_type_detail: b.property_type_detail,
                        bedrooms: b.bedrooms,
                        bathrooms: b.bathrooms,
                        dirt_level: b.dirt_level,
                        cleaning_frequency: b.cleaning_frequency,
                        address: b.address,
                        area_district: b.area_district,
                        city: b.city,
                        region: b.region,
                        landmark: b.landmark,
                        building_name: b.building_name,
                        floor_number: b.floor_number
                    },
                    schedule: {
                        date: b.service_date,
                        time: b.service_time
                    },
                    instructions: b.instructions,
                    special_instructions_cleaners: b.special_instructions_cleaners,
                    payment: {
                        method: b.payment_method,
                        base_price: parseFloat(b.base_price),
                        extras: parseFloat(b.extras),
                        discount: parseFloat(b.discount),
                        total_price: parseFloat(b.total_price),
                        payment_status: b.payment_status,
                        payment_status_label: getPaymentStatusLabel(b.payment_status)
                    },
                    status: b.status,
                    status_label: getStatusLabel(b.status),
                    estimation_status: b.estimation_status,
                    assigned_staff: assignedStaffDetails,
                    created_at: b.created_at
                };
            })
        );

        const allBookings = await getBookingsByUserId(userId, {});
        const filterCounts = {
            all: allBookings.length,
            upcoming: allBookings.filter(b => b.status === 'confirmed').length,
            pending: allBookings.filter(b => b.status === 'pending').length,
            in_progress: allBookings.filter(b => b.status === 'in_progress').length,
            completed: allBookings.filter(b => b.status === 'completed').length,
            cancelled: allBookings.filter(b => b.status === 'cancelled').length,
            unpaid: allBookings.filter(b => b.payment_status === 'unpaid').length,
            paid: allBookings.filter(b => b.payment_status === 'paid').length
        };

        res.json({
            success: true,
            count: bookings.length,
            filter_counts: filterCounts,
            active_filter: req.query.filter || req.query.status || 'all',
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Get my bookings error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch your bookings', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: GET ALL BOOKINGS ====================

const getAllBookingsController = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            estimation_status: req.query.estimation_status,
            payment_status: req.query.payment_status,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            user_id: req.query.user_id,
            assigned_staff_id: req.query.assigned_staff_id,
            limit: req.query.limit || 100,
            offset: req.query.offset || 0
        };

        const bookings = await getAllBookings(filters);
        const countResult = await getBookingCount({ 
            status: req.query.status,
            estimation_status: req.query.estimation_status,
            payment_status: req.query.payment_status,
            assigned_staff_id: req.query.assigned_staff_id
        });
        const total = countResult[0].count;

        const enrichedBookings = await Promise.all(
            bookings.map(async (b) => {
                let serviceName = 'Unknown Service';
                let serviceLocation = null;
                
                if (b.service_id) {
                    try {
                        const serviceResult = await getServiceById(b.service_id);
                        if (serviceResult && serviceResult.length > 0) {
                            serviceName = serviceResult[0].name;
                            serviceLocation = serviceResult[0].location;
                        }
                    } catch (err) {}
                }

                return {
                    id: b.id,
                    user_id: b.user_id,
                    customer: {
                        name: `${b.first_name} ${b.last_name}`,
                        email: b.email,
                        phone: b.phone,
                        alternative_phone: b.alternative_phone,
                        preferred_communication: b.preferred_communication
                    },
                    service: {
                        id: b.service_id,
                        name: serviceName,
                        location: serviceLocation
                    },
                    cleaning_details: {
                        cleaners: b.cleaners,
                        hours: b.hours,
                        frequency: b.frequency,
                        materials_provided: b.materials,
                        property_type: b.property_type,
                        property_type_detail: b.property_type_detail,
                        bedrooms: b.bedrooms,
                        bathrooms: b.bathrooms,
                        dirt_level: b.dirt_level,
                        cleaning_frequency: b.cleaning_frequency
                    },
                    property: {
                        type: b.property_type,
                        address: b.address,
                        area_district: b.area_district,
                        city: b.city,
                        region: b.region,
                        landmark: b.landmark,
                        building_name: b.building_name,
                        floor_number: b.floor_number
                    },
                    location: {
                        latitude: b.latitude,
                        longitude: b.longitude,
                        pin_latitude: b.pin_latitude,
                        pin_longitude: b.pin_longitude
                    },
                    schedule: {
                        date: b.service_date,
                        time: b.service_time
                    },
                    instructions: b.instructions,
                    special_instructions_cleaners: b.special_instructions_cleaners,
                    payment: {
                        method: b.payment_method,
                        base_price: parseFloat(b.base_price),
                        extras: parseFloat(b.extras),
                        discount: parseFloat(b.discount),
                        total_price: parseFloat(b.total_price),
                        payment_status: b.payment_status,
                        payment_status_label: getPaymentStatusLabel(b.payment_status)
                    },
                    estimation: {
                        estimated_service_cost: parseFloat(b.estimated_service_cost),
                        labor_cost: parseFloat(b.labor_cost),
                        transport_cost: parseFloat(b.transport_cost),
                        equipment_cost: parseFloat(b.equipment_cost_admin),
                        tax_rate: parseFloat(b.tax_rate_admin),
                        tax_amount: parseFloat(b.tax_amount_admin),
                        discount: parseFloat(b.discount_admin),
                        final_total: parseFloat(b.final_total),
                        status: b.estimation_status
                    },
                    status: b.status,
                    status_label: getStatusLabel(b.status),
                    assigned_staff: b.assigned_staff_name ? {
                        id: b.assigned_staff_id,
                        name: b.assigned_staff_name
                    } : null,
                    created_at: b.created_at,
                    invoice_generated_at: b.invoice_generated_at
                };
            })
        );

        res.json({
            success: true,
            total,
            count: bookings.length,
            filters_applied: {
                status: req.query.status || 'all',
                estimation_status: req.query.estimation_status || 'all',
                payment_status: req.query.payment_status || 'all',
                date_from: req.query.date_from || null,
                date_to: req.query.date_to || null
            },
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Get all bookings error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch bookings', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: GET SINGLE BOOKING DETAILS ====================

const getBookingDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        const booking = await getBookingById(id);

        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        let serviceDetails = null;
        if (b.service_id) {
            const serviceResult = await getServiceById(b.service_id);
            if (serviceResult && serviceResult.length > 0) {
                const s = serviceResult[0];
                serviceDetails = {
                    id: s.id,
                    name: s.name,
                    price: parseFloat(s.price),
                    duration: s.duration,
                    location: s.location,
                    description: s.description,
                    includes: s.includes
                };
            }
        }

        let staffDetails = null;
        if (b.assigned_staff_id) {
            const staffResult = await getStaffById(b.assigned_staff_id);
            if (staffResult && staffResult.length > 0) {
                const staff = staffResult[0];
                staffDetails = {
                    id: staff.id,
                    full_name: `${staff.first_name} ${staff.last_name}`,
                    first_name: staff.first_name,
                    last_name: staff.last_name,
                    email: staff.email,
                    phone: staff.phone,
                    staff_type: staff.staff_type,
                    photo: staff.photo ? `${req.protocol}://${req.get('host')}/uploads/staff/${staff.photo}` : null
                };
            }
        }

        res.json({
            success: true,
            booking: {
                id: b.id,
                user_id: b.user_id,
                customer: {
                    name: `${b.first_name} ${b.last_name}`,
                    email: b.email,
                    phone: b.phone,
                    alternative_phone: b.alternative_phone,
                    preferred_communication: b.preferred_communication
                },
                service: serviceDetails,
                cleaning_details: {
                    cleaners: b.cleaners,
                    hours: b.hours,
                    frequency: b.frequency,
                    materials_provided: b.materials,
                    property_type: b.property_type,
                    property_type_detail: b.property_type_detail,
                    bedrooms: b.bedrooms,
                    bathrooms: b.bathrooms,
                    dirt_level: b.dirt_level,
                    cleaning_frequency: b.cleaning_frequency
                },
                property: {
                    type: b.property_type,
                    address: b.address,
                    area_district: b.area_district,
                    city: b.city,
                    region: b.region,
                    landmark: b.landmark,
                    building_name: b.building_name,
                    floor_number: b.floor_number
                },
                location: {
                    latitude: b.latitude,
                    longitude: b.longitude,
                    pin_latitude: b.pin_latitude,
                    pin_longitude: b.pin_longitude
                },
                schedule: {
                    date: b.service_date,
                    time: b.service_time
                },
                instructions: b.instructions,
                special_instructions_cleaners: b.special_instructions_cleaners,
                payment: {
                    method: b.payment_method,
                    base_price: parseFloat(b.base_price),
                    extras: parseFloat(b.extras),
                    discount: parseFloat(b.discount),
                    total_price: parseFloat(b.total_price),
                    payment_status: b.payment_status,
                    payment_status_label: getPaymentStatusLabel(b.payment_status)
                },
                estimation: {
                    estimated_service_cost: parseFloat(b.estimated_service_cost),
                    labor_cost: parseFloat(b.labor_cost),
                    transport_cost: parseFloat(b.transport_cost),
                    equipment_cost: parseFloat(b.equipment_cost_admin),
                    tax_rate: parseFloat(b.tax_rate_admin),
                    tax_amount: parseFloat(b.tax_amount_admin),
                    discount: parseFloat(b.discount_admin),
                    final_total: parseFloat(b.final_total),
                    status: b.estimation_status
                },
                status: b.status,
                status_label: getStatusLabel(b.status),
                assigned_staff: staffDetails,
                created_at: b.created_at,
                invoice_generated_at: b.invoice_generated_at
            }
        });

    } catch (error) {
        console.error('Get booking details error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch booking details', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: ASSIGN STAFF TO BOOKING ====================

const assignStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { staff_id } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        if (!staff_id || isNaN(staff_id)) {
            return res.status(400).json({ message: 'Invalid staff ID' });
        }

        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        if (['completed', 'cancelled'].includes(b.status)) {
            return res.status(400).json({ 
                message: `Cannot assign staff to a ${b.status} booking` 
            });
        }

        const staffResult = await getStaffById(staff_id);
        if (!staffResult || staffResult.length === 0) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        const staff = staffResult[0];
        const staffName = `${staff.first_name} ${staff.last_name}`;

        await assignStaffToBooking(id, staff_id, staffName);

        if (b.user_id) {
            sendBookingStatusUpdate(b.user_id, {
                id: parseInt(id),
                service_name: 'Cleaning Service',
                service_date: b.service_date,
                service_time: b.service_time,
                assigned_staff: staffName
            }, 'confirmed');
        }

        res.json({
            success: true,
            message: 'Staff assigned successfully',
            booking: {
                id: parseInt(id),
                assigned_staff: {
                    id: staff.id,
                    full_name: staffName,
                    first_name: staff.first_name,
                    last_name: staff.last_name,
                    email: staff.email,
                    phone: staff.phone,
                    staff_type: staff.staff_type,
                    photo: staff.photo ? `${req.protocol}://${req.get('host')}/uploads/staff/${staff.photo}` : null
                },
                status: 'confirmed',
                status_label: getStatusLabel('confirmed')
            }
        });

    } catch (error) {
        console.error('Assign staff error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to assign staff', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: REMOVE STAFF ASSIGNMENT ====================

const removeStaff = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        if (!b.assigned_staff_id) {
            return res.status(400).json({ message: 'No staff assigned to this booking' });
        }

        await removeStaffAssignment(id);

        res.json({
            success: true,
            message: 'Staff removed from booking',
            booking: {
                id: parseInt(id),
                status: 'pending',
                status_label: getStatusLabel('pending')
            }
        });

    } catch (error) {
        console.error('Remove staff error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to remove staff', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: UPDATE BOOKING STATUS ====================

const updateBookingStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const currentStatus = booking[0].status;
        if (status === 'confirmed' && !booking[0].assigned_staff_id) {
            return res.status(400).json({ 
                message: 'Cannot confirm booking without assigned staff' 
            });
        }

        await updateBookingStatus(id, status);

        if (booking[0].user_id) {
            sendBookingStatusUpdate(booking[0].user_id, {
                id: parseInt(id),
                service_name: 'Cleaning Service',
                service_date: booking[0].service_date,
                service_time: booking[0].service_time
            }, status);
        }

        res.json({ 
            success: true,
            message: 'Booking status updated successfully',
            booking: {
                id: parseInt(id),
                previous_status: currentStatus,
                previous_status_label: getStatusLabel(currentStatus),
                new_status: status,
                new_status_label: getStatusLabel(status)
            }
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to update booking status', 
            error: error.message 
        });
    }
};

// ==================== ADMIN: UPDATE PAYMENT STATUS ====================

const updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        if (!['paid', 'unpaid'].includes(payment_status)) {
            return res.status(400).json({ 
                message: 'Invalid payment status',
                valid_statuses: ['paid', 'unpaid']
            });
        }

        const booking = await getBookingById(id);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        await updateBookingPaymentStatus(id, payment_status);

        res.json({
            success: true,
            message: `Payment marked as ${payment_status}`,
            booking: {
                id: parseInt(id),
                payment_status,
                payment_status_label: getPaymentStatusLabel(payment_status)
            }
        });

    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to update payment status', 
            error: error.message 
        });
    }
};

// ==================== GET BOOKING STATISTICS ====================

const getBookingStats = async (req, res) => {
    try {
        const totalBookings = await getBookingCount({});
        const pendingBookings = await getBookingCount({ status: 'pending' });
        const confirmedBookings = await getBookingCount({ status: 'confirmed' });
        const inProgressBookings = await getBookingCount({ status: 'in_progress' });
        const completedBookings = await getBookingCount({ status: 'completed' });
        const cancelledBookings = await getBookingCount({ status: 'cancelled' });
        const paidBookings = await getBookingCount({ payment_status: 'paid' });
        const unpaidBookings = await getBookingCount({ payment_status: 'unpaid' });
        const pendingEstimation = await getBookingCount({ estimation_status: 'pending' });
        const estimated = await getBookingCount({ estimation_status: 'estimated' });
        const invoiced = await getBookingCount({ estimation_status: 'invoiced' });

        res.json({
            success: true,
            statistics: {
                total: totalBookings[0].count,
                pending: pendingBookings[0].count,
                upcoming: confirmedBookings[0].count,
                in_progress: inProgressBookings[0].count,
                delivered: completedBookings[0].count,
                cancelled: cancelledBookings[0].count,
                paid: paidBookings[0].count,
                unpaid: unpaidBookings[0].count,
                pending_estimation: pendingEstimation[0].count,
                estimated: estimated[0].count,
                invoiced: invoiced[0].count
            }
        });

    } catch (error) {
        console.error('Get booking stats error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch statistics', 
            error: error.message 
        });
    }
};

// ==================== CUSTOMER: GET RECEIPT ====================

// In bookingController.js, fix the getReceipt function
const getReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid booking ID' });
        }

        const booking = await getBookingById(id);

        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        if (req.user.role !== 'admin' && b.user_id !== req.user.id) {
            return res.status(403).json({ 
                message: 'Access denied. You can only view your own bookings.' 
            });
        }

        // FIX: Safely parse JSON for includes
        let includesArray = [];
        if (b.service_includes) {
            try {
                // If it's already a string, try to parse it
                if (typeof b.service_includes === 'string') {
                    includesArray = JSON.parse(b.service_includes);
                } 
                // If it's already an array, use it directly
                else if (Array.isArray(b.service_includes)) {
                    includesArray = b.service_includes;
                }
                // If it's a comma-separated string, split it
                else if (typeof b.service_includes === 'string' && b.service_includes.includes(',')) {
                    includesArray = b.service_includes.split(',').map(item => item.trim());
                }
                // Single string value
                else if (typeof b.service_includes === 'string') {
                    includesArray = [b.service_includes];
                }
            } catch (e) {
                console.warn('Failed to parse includes:', e);
                // If JSON parse fails, try to handle as comma-separated
                if (typeof b.service_includes === 'string' && b.service_includes.includes(',')) {
                    includesArray = b.service_includes.split(',').map(item => item.trim());
                } else if (typeof b.service_includes === 'string') {
                    includesArray = [b.service_includes];
                }
            }
        }

        let serviceDetails = null;
        if (b.service_id) {
            serviceDetails = {
                id: b.service_id,
                name: b.service_name || 'Unknown Service',
                price: parseFloat(b.service_price) || 0,
                duration: b.service_duration,
                location: b.service_location,
                description: b.service_description,
                includes: includesArray  // Use the parsed array
            };
        }

        let staffDetails = null;
        if (b.assigned_staff_id) {
            staffDetails = {
                id: b.assigned_staff_id,
                full_name: b.assigned_staff_name || `${b.staff_first_name || ''} ${b.staff_last_name || ''}`.trim(),
                first_name: b.staff_first_name,
                last_name: b.staff_last_name,
                email: b.staff_email,
                phone: b.staff_phone,
                staff_type: b.staff_type,
                photo: b.staff_photo ? `/uploads/staff/${b.staff_photo}` : null
            };
        }

        res.json({
            success: true,
            receipt: {
                id: b.id,
                customer: {
                    name: `${b.first_name} ${b.last_name}`,
                    email: b.email,
                    phone: b.phone
                },
                service: serviceDetails || { id: b.service_id, note: 'Service details unavailable' },
                booking_details: {
                    property_type: b.property_type,
                    address: b.address,
                    city: b.city,
                    landmark: b.landmark,
                    service_date: b.service_date,
                    service_time: b.service_time,
                    frequency: b.frequency,
                    cleaners: b.cleaners,
                    hours: b.hours,
                    materials_provided: b.materials ? 'Yes' : 'No',
                    instructions: b.instructions || 'None'
                },
                pricing: {
                    base_price: parseFloat(b.base_price) || 0,
                    extras: parseFloat(b.extras) || 0,
                    discount: parseFloat(b.discount) || 0,
                    total_price: parseFloat(b.total_price) || 0,
                    payment_method: b.payment_method,
                    payment_status: b.payment_status,
                    payment_status_label: b.payment_status === 'paid' ? 'Paid ✅' : 'Unpaid ❌'
                },
                status: b.status,
                status_label: getStatusLabel(b.status),
                assigned_staff: staffDetails,
                special_instructions_cleaners: b.special_instructions_cleaners,
                created_at: b.created_at
            }
        });

    } catch (error) {
        console.error('Get receipt error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch receipt', 
            error: error.message 
        });
    }
};

// ==================== CUSTOMER: CANCEL MY BOOKING ====================

const cancelMyBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const booking = await getBookingById(id);
        
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const b = booking[0];

        if (b.user_id !== userId) {
            return res.status(403).json({ message: 'You can only cancel your own bookings' });
        }

        if (['cancelled', 'completed'].includes(b.status)) {
            return res.status(400).json({ 
                message: `Cannot cancel a ${b.status} booking` 
            });
        }

        await updateBookingStatus(id, 'cancelled');
        await removeStaffAssignment(id);

        res.json({ 
            success: true,
            message: 'Booking cancelled successfully',
            booking_id: parseInt(id),
            status: 'cancelled',
            status_label: getStatusLabel('cancelled')
        });

    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to cancel booking', 
            error: error.message 
        });
    }
};

// ==================== STAFF: GET MY ASSIGNMENTS ====================

const getStaffAssignments = async (req, res) => {
    try {
        const staffId = req.user.id;
        
        const filters = {
            status: req.query.status,
            date_from: req.query.date_from,
            date_to: req.query.date_to
        };

        const bookings = await getStaffBookings(staffId, filters);

        const enrichedBookings = await Promise.all(
            bookings.map(async (b) => {
                let serviceName = 'Unknown Service';
                if (b.service_id) {
                    try {
                        const serviceResult = await getServiceById(b.service_id);
                        if (serviceResult && serviceResult.length > 0) {
                            serviceName = serviceResult[0].name;
                        }
                    } catch (err) {}
                }

                return {
                    id: b.id,
                    customer: {
                        name: `${b.first_name} ${b.last_name}`,
                        phone: b.phone,
                        email: b.email
                    },
                    service: {
                        id: b.service_id,
                        name: serviceName
                    },
                    property: {
                        type: b.property_type,
                        address: b.address,
                        city: b.city,
                        landmark: b.landmark
                    },
                    schedule: {
                        date: b.service_date,
                        time: b.service_time
                    },
                    cleaning_details: {
                        cleaners: b.cleaners,
                        hours: b.hours,
                        materials_provided: b.materials
                    },
                    instructions: b.instructions,
                    payment: {
                        method: b.payment_method,
                        total_price: parseFloat(b.total_price),
                        payment_status: b.payment_status,
                        payment_status_label: getPaymentStatusLabel(b.payment_status)
                    },
                    status: b.status,
                    status_label: getStatusLabel(b.status),
                    created_at: b.created_at
                };
            })
        );

        res.json({
            success: true,
            count: bookings.length,
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error('Get staff assignments error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch assignments', 
            error: error.message 
        });
    }
};

module.exports = {
    createBookingController,
    getMyBookings,
    getAllBookingsController,
    getBookingDetails,
    assignStaff,
    removeStaff,
    updateBookingStatusController,
    updatePaymentStatus,
    getBookingStats,
    getReceipt,
    cancelMyBooking,
    getStaffAssignments,
    updateBookingEstimationController,
    generateAndSendInvoice,
    getMyInvoices,
    downloadCustomerInvoice
};