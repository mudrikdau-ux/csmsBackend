const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const {
    createInvoice,
    getInvoiceById,
    getInvoicesByContractorId,
    getAllInvoices,
    updateInvoiceStatus,
    deleteInvoice,
    generateInvoiceNumber,
    getInvoiceStats
} = require('../models/invoiceModel');

const { getContractorById } = require('../models/contractorModel');

// Ensure invoices directory exists
const invoicesDir = path.join(__dirname, '..', 'invoices');
if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
}

// Branding
const BRANDING = {
    primaryColor: '#1a5276',
    secondaryColor: '#2e86c1',
    accentColor: '#3498db',
    successColor: '#27ae60',
    warningColor: '#f39c12',
    dangerColor: '#e74c3c',
    lightGray: '#f8f9fa',
    borderGray: '#dee2e6',
    mediumGray: '#bdc3c7',
    darkGray: '#2c3e50',
    textGray: '#6c757d',
    white: '#ffffff',
    companyName: 'CleanSpark',
    tagline: 'Professional Cleaning Services',
    address: 'Stone Town, Zanzibar',
    phone: '+255 777 000 000',
    email: 'info@cleanspark.co.tz',
    website: 'www.cleanspark.co.tz'
};

// ==================== STATUS HELPERS ====================

const getInvoiceStatusLabel = (status) => {
    const labels = {
        'draft': 'Draft',
        'generated': 'Generated',
        'sent': 'Sent',
        'paid': 'Paid',
        'overdue': 'Overdue',
        'cancelled': 'Cancelled'
    };
    return labels[status] || status;
};

const getStatusColor = (status) => {
    const colors = {
        'draft': '#95a5a6',
        'generated': '#3498db',
        'sent': '#f39c12',
        'paid': '#27ae60',
        'overdue': '#e74c3c',
        'cancelled': '#c0392b'
    };
    return colors[status] || '#7f8c8d';
};

// ==================== GENERATE INVOICE ====================

const generateInvoice = async (req, res) => {
    try {
        const {
            contractor_id,
            invoice_date,
            due_date,
            work_description,
            work_cost,
            equipment_cost,
            tax_rate,
            notes
        } = req.body;

        if (!contractor_id || !invoice_date || !due_date || !work_cost) {
            return res.status(400).json({
                message: 'Required fields missing',
                required: ['contractor_id', 'invoice_date', 'due_date', 'work_cost']
            });
        }

        const contractor = await getContractorById(contractor_id);
        if (!contractor || contractor.length === 0) {
            return res.status(404).json({ message: 'Contractor not found' });
        }

        const c = contractor[0];

        if (new Date(due_date) < new Date(invoice_date)) {
            return res.status(400).json({ message: 'Due date must be after invoice date' });
        }

        const workCost = parseFloat(work_cost) || 0;
        const equipmentCost = parseFloat(equipment_cost) || 0;
        const subtotal = workCost + equipmentCost;
        const taxRate = parseFloat(tax_rate) || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;

        const invoiceNumber = await generateInvoiceNumber();

        const result = await createInvoice({
            contractor_id: parseInt(contractor_id),
            invoice_number: invoiceNumber,
            invoice_date,
            due_date,
            work_description: work_description || `Cleaning services for ${c.company_name}`,
            work_cost: workCost,
            equipment_cost: equipmentCost,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            notes: notes || null,
            status: 'generated',
            created_by: req.user.id
        });

        const invoiceId = result.insertId;
        const invoice = await getInvoiceById(invoiceId);

        res.status(201).json({
            success: true,
            message: 'Invoice generated successfully',
            invoice: {
                id: invoice[0].id,
                invoice_number: invoice[0].invoice_number,
                contractor: {
                    id: c.id,
                    company_name: c.company_name,
                    contractor_type: c.contractor_type,
                    location: c.location,
                    contact_person: c.contact_person,
                    contact_email: c.contact_email,
                    contact_phone: c.contact_phone
                },
                dates: {
                    invoice_date: invoice[0].invoice_date,
                    due_date: invoice[0].due_date
                },
                work_description: invoice[0].work_description,
                pricing: {
                    work_cost: parseFloat(invoice[0].work_cost),
                    equipment_cost: parseFloat(invoice[0].equipment_cost),
                    subtotal: parseFloat(invoice[0].subtotal),
                    tax_rate: parseFloat(invoice[0].tax_rate),
                    tax_amount: parseFloat(invoice[0].tax_amount),
                    total_amount: parseFloat(invoice[0].total_amount)
                },
                status: invoice[0].status,
                status_label: getInvoiceStatusLabel(invoice[0].status),
                created_at: invoice[0].created_at
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

// ==================== GET ALL INVOICES ====================

const getInvoices = async (req, res) => {
    try {
        const filters = {
            contractor_id: req.query.contractor_id,
            status: req.query.status,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            search: req.query.search,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const invoices = await getAllInvoices(filters);
        const stats = await getInvoiceStats();

        res.json({
            success: true,
            count: invoices.length,
            stats: {
                total_invoices: stats[0].total_invoices,
                total_amount: parseFloat(stats[0].total_amount || 0),
                paid_amount: parseFloat(stats[0].paid_amount || 0),
                overdue_amount: parseFloat(stats[0].overdue_amount || 0),
                pending_amount: parseFloat(stats[0].pending_amount || 0)
            },
            invoices: invoices.map(inv => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                contractor: {
                    id: inv.contractor_id,
                    company_name: inv.company_name,
                    contractor_type: inv.contractor_type,
                    location: inv.location,
                    contact_person: inv.contact_person
                },
                invoice_date: inv.invoice_date,
                due_date: inv.due_date,
                total_amount: parseFloat(inv.total_amount),
                status: inv.status,
                status_label: getInvoiceStatusLabel(inv.status),
                created_at: inv.created_at
            }))
        });

    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices',
            error: error.message
        });
    }
};

// ==================== GET SINGLE INVOICE ====================

const getSingleInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid invoice ID' });
        }

        const invoice = await getInvoiceById(id);

        if (!invoice || invoice.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        const inv = invoice[0];

        res.json({
            success: true,
            invoice: {
                id: inv.id,
                invoice_number: inv.invoice_number,
                contractor: {
                    id: inv.contractor_id,
                    company_name: inv.company_name,
                    contractor_type: inv.contractor_type,
                    contractor_type_label: inv.contractor_type === 'government' ? 'Government' : 'Private',
                    location: inv.location,
                    contact_person: inv.contact_person,
                    contact_email: inv.contact_email,
                    contact_phone: inv.contact_phone
                },
                dates: {
                    invoice_date: inv.invoice_date,
                    due_date: inv.due_date,
                    is_overdue: new Date(inv.due_date) < new Date() && !['paid', 'cancelled'].includes(inv.status)
                },
                work_description: inv.work_description,
                pricing: {
                    work_cost: parseFloat(inv.work_cost),
                    equipment_cost: parseFloat(inv.equipment_cost),
                    subtotal: parseFloat(inv.subtotal),
                    tax_rate: parseFloat(inv.tax_rate),
                    tax_amount: parseFloat(inv.tax_amount),
                    total_amount: parseFloat(inv.total_amount)
                },
                notes: inv.notes,
                status: inv.status,
                status_label: getInvoiceStatusLabel(inv.status),
                created_by: inv.created_by_first_name ? `${inv.created_by_first_name} ${inv.created_by_last_name}` : 'System',
                created_at: inv.created_at,
                updated_at: inv.updated_at
            }
        });

    } catch (error) {
        console.error('Get single invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoice',
            error: error.message
        });
    }
};

// ==================== GET CONTRACTOR INVOICES ====================

const getContractorInvoices = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid contractor ID' });
        }

        const invoices = await getInvoicesByContractorId(id);

        res.json({
            success: true,
            count: invoices.length,
            invoices: invoices.map(inv => ({
                id: inv.id,
                invoice_number: inv.invoice_number,
                contractor: {
                    id: inv.contractor_id,
                    company_name: inv.company_name
                },
                invoice_date: inv.invoice_date,
                due_date: inv.due_date,
                total_amount: parseFloat(inv.total_amount),
                status: inv.status,
                status_label: getInvoiceStatusLabel(inv.status),
                created_at: inv.created_at
            }))
        });

    } catch (error) {
        console.error('Get contractor invoices error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contractor invoices',
            error: error.message
        });
    }
};

// ==================== UPDATE INVOICE STATUS ====================

const updateInvoiceStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid invoice ID' });
        }

        const validStatuses = ['draft', 'generated', 'sent', 'paid', 'overdue', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        const invoice = await getInvoiceById(id);
        if (!invoice || invoice.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        await updateInvoiceStatus(id, status);

        res.json({
            success: true,
            message: 'Invoice status updated',
            invoice: {
                id: parseInt(id),
                status,
                status_label: getInvoiceStatusLabel(status)
            }
        });

    } catch (error) {
        console.error('Update invoice status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update invoice status',
            error: error.message
        });
    }
};

// ==================== DELETE INVOICE ====================

const deleteInvoiceController = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid invoice ID' });
        }

        const invoice = await getInvoiceById(id);
        if (!invoice || invoice.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        await deleteInvoice(id);

        res.json({
            success: true,
            message: 'Invoice deleted successfully',
            deleted_id: parseInt(id)
        });

    } catch (error) {
        console.error('Delete invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete invoice',
            error: error.message
        });
    }
};

// ==================== DOWNLOAD INVOICE PDF ====================

const downloadInvoicePDF = async (req, res) => {
    try {
        const { id } = req.params;

        const invoice = await getInvoiceById(id);
        if (!invoice || invoice.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        const inv = invoice[0];
        const filename = `invoice_${inv.invoice_number}.pdf`;
        const filePath = path.join(invoicesDir, filename);

        await generateInvoicePDF(inv, filePath);

        res.download(filePath, filename, (err) => {
            if (err) console.error('Download error:', err);
            setTimeout(() => {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }, 5000);
        });

    } catch (error) {
        console.error('Download invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download invoice',
            error: error.message
        });
    }
};

// ==================== VIEW INVOICE PDF ====================

const viewInvoicePDF = async (req, res) => {
    try {
        const { id } = req.params;

        const invoice = await getInvoiceById(id);
        if (!invoice || invoice.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        const inv = invoice[0];
        const filename = `invoice_${inv.invoice_number}.pdf`;
        const filePath = path.join(invoicesDir, filename);

        await generateInvoicePDF(inv, filePath);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${filename}`);
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        
        stream.on('end', () => {
            setTimeout(() => {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }, 5000);
        });

    } catch (error) {
        console.error('View invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to view invoice',
            error: error.message
        });
    }
};

// ==================== PROFESSIONAL PDF GENERATION ====================

const generateInvoicePDF = (inv, filePath) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ 
            margin: 40, 
            size: 'A4',
            bufferPages: true 
        });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const pageWidth = doc.page.width;
        const margin = 40;
        const contentWidth = pageWidth - (margin * 2);

        const formatCurrency = (amount) => {
            return 'TZS ' + parseFloat(amount).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        const formatDate = (dateString) => {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        };

        // ========== TOP ACCENT BAR ==========
        doc.rect(0, 0, pageWidth, 6).fill(BRANDING.primaryColor);

        // ========== HEADER SECTION ==========
        let yPos = 20;

        // Company Logo Box (Left)
        doc.rect(margin, yPos, 90, 75).fill(BRANDING.secondaryColor);
        doc.fillColor(BRANDING.white)
           .fontSize(28)
           .font('Helvetica-Bold')
           .text('CS', margin, yPos + 12, { width: 90, align: 'center' });
        doc.fontSize(9)
           .font('Helvetica')
           .text('CleanSpark', margin, yPos + 50, { width: 90, align: 'center' });

        // Company Details (Right)
        const rightX = pageWidth - margin - 200;
        doc.fillColor(BRANDING.primaryColor)
           .fontSize(22)
           .font('Helvetica-Bold')
           .text('CleanSpark', rightX, yPos);
        
        doc.fillColor(BRANDING.darkGray)
           .fontSize(9)
           .font('Helvetica')
           .text(BRANDING.tagline, rightX, yPos + 28);
        
        doc.fillColor(BRANDING.textGray)
           .fontSize(8)
           .text(BRANDING.address, rightX, yPos + 42)
           .text(`Tel: ${BRANDING.phone}`, rightX, yPos + 54)
           .text(`Email: ${BRANDING.email}`, rightX, yPos + 66);

        yPos += 90;

        // ========== DIVIDER LINE ==========
        yPos += 5;
        doc.strokeColor(BRANDING.accentColor)
           .lineWidth(1.5)
           .moveTo(margin, yPos)
           .lineTo(pageWidth - margin, yPos)
           .stroke();

        yPos += 15;

        // ========== INVOICE TITLE & STATUS ==========
        // Invoice Title Box
        doc.rect(margin, yPos, 220, 50).fill(BRANDING.secondaryColor);
        doc.fillColor(BRANDING.white)
           .fontSize(26)
           .font('Helvetica-Bold')
           .text('INVOICE', margin + 10, yPos + 10);

        // Status Badge (Right)
        const infoX = pageWidth - margin - 220;
        const statusColor = getStatusColor(inv.status);
        const statusLabel = {
            'draft': 'DRAFT', 'generated': 'GENERATED', 'sent': 'SENT',
            'paid': 'PAID', 'overdue': 'OVERDUE', 'cancelled': 'CANCELLED'
        }[inv.status] || inv.status.toUpperCase();
        
        doc.roundedRect(infoX + 80, yPos, 140, 22, 4).fill(statusColor);
        doc.fillColor(BRANDING.white)
           .fontSize(9)
           .font('Helvetica-Bold')
           .text(statusLabel, infoX + 80, yPos + 5, { width: 140, align: 'center' });

        // Invoice Number
        doc.fillColor(BRANDING.darkGray)
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('INVOICE #', infoX, yPos + 30);
        doc.fillColor(BRANDING.primaryColor)
           .fontSize(15)
           .font('Helvetica-Bold')
           .text(inv.invoice_number, infoX, yPos + 44);

        yPos += 60;

        // ========== BILL TO & DATES SECTION ==========
        yPos += 10;

        const billToWidth = contentWidth * 0.55;
        const billToHeight = 110;

        // Bill To Box
        doc.rect(margin, yPos, billToWidth, billToHeight).stroke(BRANDING.borderGray);
        doc.rect(margin, yPos, billToWidth, 30).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.primaryColor)
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('BILL TO', margin + 10, yPos + 8);

        doc.fillColor(BRANDING.darkGray)
           .fontSize(10)
           .font('Helvetica-Bold')
           .text(inv.company_name || 'N/A', margin + 15, yPos + 40);
        
        doc.fillColor('#555555')
           .fontSize(9)
           .font('Helvetica')
           .text(`Contact: ${inv.contact_person || 'N/A'}`, margin + 15, yPos + 58)
           .text(`Location: ${inv.location || 'N/A'}`, margin + 15, yPos + 74)
           .text(`Email: ${inv.contact_email || 'N/A'}`, margin + 15, yPos + 90);

        // Dates Box (Right)
        const datesX = margin + billToWidth + 10;
        const datesWidth = contentWidth - billToWidth - 10;
        
        doc.rect(datesX, yPos, datesWidth, billToHeight).stroke(BRANDING.borderGray);
        doc.rect(datesX, yPos, datesWidth, 30).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.primaryColor)
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('DATES', datesX + 10, yPos + 8);

        doc.fillColor('#555555')
           .fontSize(9)
           .font('Helvetica')
           .text('Invoice Date:', datesX + 15, yPos + 45);
        doc.fillColor(BRANDING.darkGray)
           .font('Helvetica-Bold')
           .text(formatDate(inv.invoice_date), datesX + 15, yPos + 64);
        
        doc.fillColor('#555555')
           .font('Helvetica')
           .text('Due Date:', datesX + 15, yPos + 84);
        doc.fillColor(BRANDING.darkGray)
           .font('Helvetica-Bold')
           .text(formatDate(inv.due_date), datesX + 15, yPos + 103);

        // Overdue warning
        const isOverdue = new Date(inv.due_date) < new Date() && !['paid', 'cancelled'].includes(inv.status);
        if (isOverdue) {
            doc.fillColor(BRANDING.dangerColor)
               .fontSize(8)
               .font('Helvetica-Bold')
               .text('OVERDUE', datesX + 15, yPos + 120);
        }

        yPos += billToHeight + 20;

        // ========== SERVICE DESCRIPTION ==========
        if (inv.work_description) {
            doc.rect(margin, yPos, contentWidth, 30).fill(BRANDING.lightGray);
            doc.fillColor(BRANDING.primaryColor)
               .fontSize(11)
               .font('Helvetica-Bold')
               .text('SERVICE DESCRIPTION', margin + 10, yPos + 8);

            yPos += 38;
            
            doc.fillColor('#555555')
               .fontSize(9)
               .font('Helvetica')
               .text(inv.work_description, margin + 5, yPos, { 
                   width: contentWidth - 10,
                   lineGap: 2
               });

            const textHeight = doc.heightOfString(inv.work_description, { 
                width: contentWidth - 10,
                fontSize: 9
            });
            yPos += textHeight + 15;
        }

        // ========== PRICING TABLE ==========
        yPos += 5;

        const col1X = margin + 10;
        const col2X = margin + 350;
        const colWidth = 130;

        // Table Header
        doc.rect(margin, yPos, contentWidth, 35).fill(BRANDING.primaryColor);
        doc.fillColor(BRANDING.white)
           .fontSize(10)
           .font('Helvetica-Bold');
        doc.text('Description', col1X, yPos + 11);
        doc.text('Amount', col2X, yPos + 11, { width: colWidth, align: 'right' });

        let rowY = yPos + 35;

        // Work Cost Row
        doc.rect(margin, rowY, contentWidth, 30).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.darkGray)
           .fontSize(10)
           .font('Helvetica')
           .text('Cleaning Services (Labor)', col1X, rowY + 8);
        doc.font('Helvetica-Bold')
           .text(formatCurrency(inv.work_cost), col2X, rowY + 8, { width: colWidth, align: 'right' });
        
        doc.strokeColor(BRANDING.borderGray)
           .lineWidth(0.5)
           .moveTo(margin, rowY + 30)
           .lineTo(pageWidth - margin, rowY + 30)
           .stroke();
        rowY += 30;

        // Equipment Cost Row
        if (parseFloat(inv.equipment_cost) > 0) {
            doc.rect(margin, rowY, contentWidth, 30).fill(BRANDING.white);
            doc.fillColor(BRANDING.darkGray)
               .fontSize(10)
               .font('Helvetica')
               .text('Equipment & Materials', col1X, rowY + 8);
            doc.font('Helvetica-Bold')
               .text(formatCurrency(inv.equipment_cost), col2X, rowY + 8, { width: colWidth, align: 'right' });
            
            doc.moveTo(margin, rowY + 30)
               .lineTo(pageWidth - margin, rowY + 30)
               .stroke(BRANDING.borderGray);
            rowY += 30;
        }

        // Subtotal Row
        doc.rect(margin, rowY, contentWidth, 30).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.darkGray)
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('Subtotal', col1X, rowY + 8);
        doc.text(formatCurrency(inv.subtotal), col2X, rowY + 8, { width: colWidth, align: 'right' });
        rowY += 30;

        // Tax Row
        if (parseFloat(inv.tax_rate) > 0) {
            doc.rect(margin, rowY, contentWidth, 30).fill(BRANDING.white);
            doc.fillColor(BRANDING.darkGray)
               .fontSize(10)
               .font('Helvetica')
               .text(`VAT/Tax (${inv.tax_rate}%)`, col1X, rowY + 8);
            doc.font('Helvetica-Bold')
               .text(formatCurrency(inv.tax_amount), col2X, rowY + 8, { width: colWidth, align: 'right' });
            
            doc.moveTo(margin, rowY + 30)
               .lineTo(pageWidth - margin, rowY + 30)
               .stroke(BRANDING.borderGray);
            rowY += 30;
        }

        // TOTAL Row
        doc.rect(margin, rowY, contentWidth, 45).fill(BRANDING.secondaryColor);
        doc.fillColor(BRANDING.white)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('TOTAL', col1X, rowY + 14);
        doc.fontSize(18)
           .text(formatCurrency(inv.total_amount), col2X, rowY + 10, { width: colWidth, align: 'right' });

        rowY += 55;

        // ========== NOTES ==========
        if (inv.notes) {
            yPos = rowY + 15;
            doc.rect(margin, yPos, contentWidth, 30).fill(BRANDING.lightGray);
            doc.fillColor(BRANDING.primaryColor)
               .fontSize(11)
               .font('Helvetica-Bold')
               .text('NOTES / PAYMENT INSTRUCTIONS', margin + 10, yPos + 8);

            yPos += 38;
            
            doc.fillColor('#555555')
               .fontSize(9)
               .font('Helvetica')
               .text(inv.notes, margin + 10, yPos, { width: contentWidth - 20, lineGap: 3 });

            rowY = yPos + doc.heightOfString(inv.notes, { width: contentWidth - 20, fontSize: 9 }) + 20;
        }

        // ========== PAYMENT TERMS ==========
        yPos = Math.max(rowY + 15, yPos + 70);
        
        doc.roundedRect(margin, yPos, contentWidth, 55, 6).fill(BRANDING.lightGray);
        doc.strokeColor(BRANDING.borderGray)
           .roundedRect(margin, yPos, contentWidth, 55, 6).stroke();
        
        doc.fillColor(BRANDING.primaryColor)
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('PAYMENT TERMS', margin + 15, yPos + 10);
        
        doc.fillColor(BRANDING.textGray)
           .fontSize(8)
           .font('Helvetica')
           .text('Payment is due within 30 days from the invoice date. Please include the invoice number with your payment. For questions, contact billing@cleanspark.co.tz', 
                 margin + 15, yPos + 28, { width: contentWidth - 30 });

        // ========== FOOTER ==========
        const footerY = doc.page.height - 40;
        
        doc.strokeColor(BRANDING.accentColor)
           .lineWidth(1)
           .moveTo(margin, footerY)
           .lineTo(pageWidth - margin, footerY)
           .stroke();

        doc.fillColor('#95a5a6')
           .fontSize(7)
           .font('Helvetica')
           .text(`Thank you for your business! | Generated on ${new Date().toLocaleDateString()} | This is a computer-generated invoice`, 
                 margin, footerY + 8, { align: 'center', width: contentWidth });

        // Page number
        doc.fillColor('#95a5a6')
           .fontSize(7)
           .text('Page 1', pageWidth - margin - 30, doc.page.height - 25);

        doc.end();

        stream.on('finish', resolve);
        stream.on('error', reject);
    });
};

module.exports = {
    generateInvoice,
    getInvoices,
    getSingleInvoice,
    getContractorInvoices,
    updateInvoiceStatusController,
    deleteInvoiceController,
    downloadInvoicePDF,
    viewInvoicePDF
};