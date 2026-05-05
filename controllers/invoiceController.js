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
    lightGray: '#ecf0f1',
    darkGray: '#2c3e50',
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

        // Validate required fields
        if (!contractor_id || !invoice_date || !due_date || !work_cost) {
            return res.status(400).json({
                message: 'Required fields missing',
                required: ['contractor_id', 'invoice_date', 'due_date', 'work_cost']
            });
        }

        // Validate contractor exists
        const contractor = await getContractorById(contractor_id);
        if (!contractor || contractor.length === 0) {
            return res.status(404).json({ message: 'Contractor not found' });
        }

        const c = contractor[0];

        // Validate dates
        if (new Date(due_date) < new Date(invoice_date)) {
            return res.status(400).json({ message: 'Due date must be after invoice date' });
        }

        // Calculate amounts
        const workCost = parseFloat(work_cost) || 0;
        const equipmentCost = parseFloat(equipment_cost) || 0;
        const subtotal = workCost + equipmentCost;
        const taxRate = parseFloat(tax_rate) || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const totalAmount = subtotal + taxAmount;

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber();

        // Create invoice
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

        // Get created invoice with contractor details
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

        // Generate PDF
        await generateInvoicePDF(inv, filePath);

        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up file after download
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
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

// ==================== SHARE INVOICE (VIEW) ====================

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

        // Generate PDF
        await generateInvoicePDF(inv, filePath);

        // Stream the PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${filename}`);
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        
        // Clean up after viewing
        stream.on('end', () => {
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
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

// ==================== GENERATE PDF ====================

const generateInvoicePDF = (inv, filePath) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Header
        doc.rect(0, 0, doc.page.width, 120).fill(BRANDING.primaryColor);
        doc.fontSize(28).font('Helvetica-Bold').fillColor(BRANDING.white)
           .text('INVOICE', 50, 30, { align: 'left' });
        doc.fontSize(16).fillColor(BRANDING.white)
           .text(inv.invoice_number, 50, 65);

        // Company info
        doc.fontSize(14).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
           .text(BRANDING.companyName, doc.page.width - 250, 30, { width: 200, align: 'right' });
        doc.fontSize(8).font('Helvetica').fillColor(BRANDING.darkGray)
           .text(BRANDING.address, doc.page.width - 250, 50, { width: 200, align: 'right' });
        doc.text(BRANDING.phone, doc.page.width - 250, 62, { width: 200, align: 'right' });
        doc.text(BRANDING.email, doc.page.width - 250, 74, { width: 200, align: 'right' });

        doc.moveDown(2);

        // Bill To
        doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.darkGray).text('Bill To:');
        doc.fontSize(10).font('Helvetica').fillColor(BRANDING.darkGray);
        doc.text(inv.company_name || 'N/A');
        doc.text(`Location: ${inv.location || 'N/A'}`);
        doc.text(`Contact: ${inv.contact_person || 'N/A'}`);
        doc.text(`Email: ${inv.contact_email || 'N/A'}`);
        doc.text(`Phone: ${inv.contact_phone || 'N/A'}`);

        doc.moveDown();

        // Dates
        const dateY = doc.y;
        doc.fontSize(9).font('Helvetica').fillColor(BRANDING.darkGray);
        doc.text(`Invoice Date: ${inv.invoice_date}`, 50, dateY);
        doc.text(`Due Date: ${inv.due_date}`, 250, dateY);
        doc.text(`Status: ${getInvoiceStatusLabel(inv.status)}`, 400, dateY);

        doc.moveDown(2);

        // Work Description
        if (inv.work_description) {
            doc.fontSize(10).font('Helvetica-Bold').fillColor(BRANDING.darkGray).text('Work Description:');
            doc.fontSize(9).font('Helvetica').fillColor(BRANDING.darkGray).text(inv.work_description);
            doc.moveDown();
        }

        // Pricing Table
        const tableTop = doc.y;
        const colWidths = [250, 100, 100];
        const headers = ['Description', 'Amount (TZS)', 'Total (TZS)'];

        // Table header
        doc.rect(50, tableTop, 470, 25).fill(BRANDING.primaryColor);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(BRANDING.white);
        let xPos = 55;
        headers.forEach((header, i) => {
            doc.text(header, xPos, tableTop + 6, { width: colWidths[i] - 10, align: 'left' });
            xPos += colWidths[i];
        });

        let currentY = tableTop + 25;

        // Work Cost row
        doc.rect(50, currentY, 470, 20).fill(BRANDING.lightGray);
        doc.fontSize(9).font('Helvetica').fillColor(BRANDING.darkGray);
        doc.text('Work Cost', 55, currentY + 4);
        doc.text(parseFloat(inv.work_cost).toLocaleString(), 305, currentY + 4);
        doc.text(parseFloat(inv.work_cost).toLocaleString(), 405, currentY + 4);

        currentY += 20;

        // Equipment Cost row
        if (parseFloat(inv.equipment_cost) > 0) {
            doc.rect(50, currentY, 470, 20).fill(BRANDING.white);
            doc.text('Equipment Cost', 55, currentY + 4);
            doc.text(parseFloat(inv.equipment_cost).toLocaleString(), 305, currentY + 4);
            doc.text(parseFloat(inv.equipment_cost).toLocaleString(), 405, currentY + 4);
            currentY += 20;
        }

        // Subtotal row
        doc.rect(50, currentY, 470, 20).fill(BRANDING.lightGray);
        doc.font('Helvetica-Bold').text('Subtotal', 55, currentY + 4);
        doc.text(parseFloat(inv.subtotal).toLocaleString(), 405, currentY + 4);

        currentY += 20;

        // Tax row
        if (parseFloat(inv.tax_rate) > 0) {
            doc.rect(50, currentY, 470, 20).fill(BRANDING.white);
            doc.font('Helvetica').text(`Tax (${inv.tax_rate}%)`, 55, currentY + 4);
            doc.text(parseFloat(inv.tax_amount).toLocaleString(), 405, currentY + 4);
            currentY += 20;
        }

        // Total row
        doc.rect(50, currentY, 470, 30).fill(BRANDING.primaryColor);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.white);
        doc.text('TOTAL', 55, currentY + 7);
        doc.text(`TZS ${parseFloat(inv.total_amount).toLocaleString()}`, 305, currentY + 7, { width: 200, align: 'right' });

        // Notes
        if (inv.notes) {
            doc.moveDown(2);
            doc.fontSize(10).font('Helvetica-Bold').fillColor(BRANDING.darkGray).text('Notes:');
            doc.fontSize(9).font('Helvetica').fillColor(BRANDING.darkGray).text(inv.notes);
        }

        // Footer
        doc.fontSize(7).fillColor('#95a5a6')
           .text(`Generated by ${BRANDING.companyName} on ${new Date().toLocaleDateString()}`, 50, doc.page.height - 50, { align: 'center' });
        doc.text('This is a computer-generated invoice and does not require a signature.', 50, doc.page.height - 38, { align: 'center' });

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