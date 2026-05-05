const {
    createContractor,
    getContractorById,
    getAllContractors,
    updateContractor,
    deleteContractor,
    updateContractorStatus,
    getContractorCount,
    searchContractors,
    createInvoice,
    getInvoiceById,
    getInvoicesByContractorId,
    getAllInvoices,
    updateInvoiceStatus,
    deleteInvoice,
    generateInvoiceNumber
} = require('../models/contractorModel');

// ==================== HELPER FUNCTIONS ====================

const getStatusLabel = (status) => {
    const labels = {
        'active': 'Active',
        'expired': 'Expired',
        'terminated': 'Terminated',
        'completed': 'Completed'
    };
    return labels[status] || status;
};

const getContractStatus = (contract) => {
    const today = new Date();
    const endDate = new Date(contract.contract_end_date);
    const startDate = new Date(contract.contract_start_date);
    
    if (contract.status === 'terminated') return 'terminated';
    if (contract.status === 'completed') return 'completed';
    if (endDate < today) return 'expired';
    if (startDate > today) return 'upcoming';
    return 'active';
};

const calculateDaysRemaining = (endDate) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
};

// ==================== ADD CONTRACTOR ====================

const addContractor = async (req, res) => {
    try {
        const {
            company_name,
            contractor_type,
            location,
            workers_count,
            workers_names,
            contract_start_date,
            contract_end_date,
            contract_value,
            contact_person,
            contact_email,
            contact_phone,
            services_provided
        } = req.body;

        // Validate required fields
        if (!company_name || !contractor_type || !location || !workers_count || 
            !contract_start_date || !contract_end_date || !contract_value || 
            !contact_person || !contact_email || !contact_phone) {
            return res.status(400).json({
                message: 'All required fields must be filled',
                required_fields: [
                    'company_name', 'contractor_type', 'location', 'workers_count',
                    'contract_start_date', 'contract_end_date', 'contract_value',
                    'contact_person', 'contact_email', 'contact_phone'
                ]
            });
        }

        // Validate contractor type
        if (!['government', 'private'].includes(contractor_type)) {
            return res.status(400).json({
                message: 'Contractor type must be either "government" or "private"'
            });
        }

        // Validate dates
        if (new Date(contract_end_date) <= new Date(contract_start_date)) {
            return res.status(400).json({
                message: 'Contract end date must be after start date'
            });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact_email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Validate phone
        if (!/^[\d\+\-\(\) ]{10,20}$/.test(contact_phone)) {
            return res.status(400).json({ message: 'Invalid phone number format' });
        }

        // Process workers names (can be array or comma-separated string)
        let processedWorkersNames = workers_names;
        if (Array.isArray(workers_names)) {
            processedWorkersNames = workers_names.join(', ');
        }

        // Process services provided
        let processedServices = services_provided;
        if (Array.isArray(services_provided)) {
            processedServices = services_provided.join(', ');
        }

        const result = await createContractor({
            company_name: company_name.trim(),
            contractor_type,
            location: location.trim(),
            workers_count: parseInt(workers_count),
            workers_names: processedWorkersNames,
            contract_start_date,
            contract_end_date,
            contract_value: parseFloat(contract_value),
            contact_person: contact_person.trim(),
            contact_email: contact_email.trim().toLowerCase(),
            contact_phone,
            services_provided: processedServices,
            status: 'active'
        });

        const contractorId = result.insertId;

        // Auto-update status based on dates
        const newContractor = await getContractorById(contractorId);
        const autoStatus = getContractStatus(newContractor[0]);
        if (autoStatus !== 'active') {
            await updateContractorStatus(contractorId, autoStatus);
        }

        res.status(201).json({
            success: true,
            message: 'Contractor added successfully',
            contractor: {
                id: contractorId,
                company_name: company_name.trim(),
                contractor_type,
                location: location.trim(),
                workers_count: parseInt(workers_count),
                contract_period: {
                    start: contract_start_date,
                    end: contract_end_date,
                    days_remaining: calculateDaysRemaining(contract_end_date)
                },
                contract_value: parseFloat(contract_value),
                contact_person: contact_person.trim(),
                status: autoStatus !== 'active' ? autoStatus : 'active',
                status_label: getStatusLabel(autoStatus !== 'active' ? autoStatus : 'active')
            }
        });

    } catch (error) {
        console.error('Add contractor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add contractor',
            error: error.message
        });
    }
};

// ==================== GET ALL CONTRACTORS ====================

const getContractors = async (req, res) => {
    try {
        const filters = {
            contractor_type: req.query.type || req.query.contractor_type || 'all',
            status: req.query.status,
            location: req.query.location,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 100,
            offset: req.query.offset || 0
        };

        const contractors = await getAllContractors(filters);
        
        // Get counts for filter tabs
        const allCount = await getContractorCount({});
        const governmentCount = await getContractorCount({ contractor_type: 'government' });
        const privateCount = await getContractorCount({ contractor_type: 'private' });
        const activeCount = await getContractorCount({ status: 'active' });
        const expiredCount = await getContractorCount({ status: 'expired' });

        // Enrich contractor data
        const enrichedContractors = contractors.map(c => {
            const currentStatus = getContractStatus(c);
            
            return {
                id: c.id,
                company_name: c.company_name,
                contractor_type: c.contractor_type,
                contractor_type_label: c.contractor_type === 'government' ? 'Government' : 'Private',
                location: c.location,
                workers: {
                    count: c.workers_count,
                    names: c.workers_names ? c.workers_names.split(', ') : []
                },
                contract_period: {
                    start: c.contract_start_date,
                    end: c.contract_end_date,
                    days_remaining: calculateDaysRemaining(c.contract_end_date),
                    is_expired: currentStatus === 'expired'
                },
                contract_value: parseFloat(c.contract_value),
                contact: {
                    person: c.contact_person,
                    email: c.contact_email,
                    phone: c.contact_phone
                },
                services: c.services_provided ? c.services_provided.split(', ') : [],
                status: currentStatus,
                status_label: getStatusLabel(currentStatus),
                created_at: c.created_at,
                updated_at: c.updated_at
            };
        });

        res.json({
            success: true,
            total: contractors.length,
            filter_counts: {
                all: allCount[0].count,
                government: governmentCount[0].count,
                private: privateCount[0].count,
                active: activeCount[0].count,
                expired: expiredCount[0].count
            },
            active_filter: filters.contractor_type,
            contractors: enrichedContractors
        });

    } catch (error) {
        console.error('Get contractors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contractors',
            error: error.message
        });
    }
};

// ==================== GET SINGLE CONTRACTOR ====================

const getSingleContractor = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid contractor ID' });
        }

        const contractor = await getContractorById(id);

        if (contractor.length === 0) {
            return res.status(404).json({ message: 'Contractor not found' });
        }

        const c = contractor[0];
        const currentStatus = getContractStatus(c);

        // Get invoices for this contractor
        const invoices = await getInvoicesByContractorId(id);

        res.json({
            success: true,
            contractor: {
                id: c.id,
                company_name: c.company_name,
                contractor_type: c.contractor_type,
                contractor_type_label: c.contractor_type === 'government' ? 'Government' : 'Private',
                location: c.location,
                workers: {
                    count: c.workers_count,
                    names: c.workers_names ? c.workers_names.split(', ') : []
                },
                contract_period: {
                    start: c.contract_start_date,
                    end: c.contract_end_date,
                    days_remaining: calculateDaysRemaining(c.contract_end_date),
                    is_expired: currentStatus === 'expired'
                },
                contract_value: parseFloat(c.contract_value),
                contact: {
                    person: c.contact_person,
                    email: c.contact_email,
                    phone: c.contact_phone
                },
                services: c.services_provided ? c.services_provided.split(', ') : [],
                status: currentStatus,
                status_label: getStatusLabel(currentStatus),
                invoices: invoices.map(inv => ({
                    id: inv.id,
                    invoice_number: inv.invoice_number,
                    invoice_date: inv.invoice_date,
                    due_date: inv.due_date,
                    amount: parseFloat(inv.amount),
                    description: inv.description,
                    status: inv.status,
                    status_label: getInvoiceStatusLabel(inv.status),
                    created_at: inv.created_at
                })),
                created_at: c.created_at,
                updated_at: c.updated_at
            }
        });

    } catch (error) {
        console.error('Get contractor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contractor',
            error: error.message
        });
    }
};

// ==================== UPDATE CONTRACTOR ====================

const editContractor = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid contractor ID' });
        }

        // Check if contractor exists
        const existing = await getContractorById(id);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Contractor not found' });
        }

        const current = existing[0];

        // Process updates
        const data = {
            company_name: updates.company_name || current.company_name,
            contractor_type: updates.contractor_type || current.contractor_type,
            location: updates.location || current.location,
            workers_count: updates.workers_count || current.workers_count,
            workers_names: updates.workers_names || current.workers_names,
            contract_start_date: updates.contract_start_date || current.contract_start_date,
            contract_end_date: updates.contract_end_date || current.contract_end_date,
            contract_value: updates.contract_value || current.contract_value,
            contact_person: updates.contact_person || current.contact_person,
            contact_email: updates.contact_email || current.contact_email,
            contact_phone: updates.contact_phone || current.contact_phone,
            services_provided: updates.services_provided || current.services_provided,
            status: updates.status || current.status
        };

        // Process arrays if needed
        if (Array.isArray(data.workers_names)) {
            data.workers_names = data.workers_names.join(', ');
        }
        if (Array.isArray(data.services_provided)) {
            data.services_provided = data.services_provided.join(', ');
        }

        await updateContractor(id, data);

        // Get updated contractor
        const updated = await getContractorById(id);
        const c = updated[0];
        const currentStatus = getContractStatus(c);

        res.json({
            success: true,
            message: 'Contractor updated successfully',
            contractor: {
                id: parseInt(id),
                company_name: c.company_name,
                contractor_type: c.contractor_type,
                status: currentStatus,
                status_label: getStatusLabel(currentStatus)
            }
        });

    } catch (error) {
        console.error('Update contractor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contractor',
            error: error.message
        });
    }
};

// ==================== DELETE CONTRACTOR ====================

const removeContractor = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid contractor ID' });
        }

        const existing = await getContractorById(id);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Contractor not found' });
        }

        await deleteContractor(id);

        res.json({
            success: true,
            message: 'Contractor deleted successfully',
            deleted_id: parseInt(id)
        });

    } catch (error) {
        console.error('Delete contractor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete contractor',
            error: error.message
        });
    }
};

// ==================== UPDATE CONTRACTOR STATUS ====================

const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid contractor ID' });
        }

        const validStatuses = ['active', 'expired', 'terminated', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        const existing = await getContractorById(id);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Contractor not found' });
        }

        await updateContractorStatus(id, status);

        res.json({
            success: true,
            message: 'Contractor status updated',
            contractor: {
                id: parseInt(id),
                status,
                status_label: getStatusLabel(status)
            }
        });

    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update status',
            error: error.message
        });
    }
};

// ==================== SEARCH CONTRACTORS ====================

const searchContractorsController = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({
                message: 'Search query must be at least 2 characters'
            });
        }

        const contractors = await searchContractors(q);

        const enriched = contractors.map(c => ({
            id: c.id,
            company_name: c.company_name,
            contractor_type: c.contractor_type,
            location: c.location,
            contact_person: c.contact_person,
            status: getContractStatus(c),
            status_label: getStatusLabel(getContractStatus(c))
        }));

        res.json({
            success: true,
            count: contractors.length,
            search_term: q,
            contractors: enriched
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Search failed',
            error: error.message
        });
    }
};

// ==================== INVOICE FUNCTIONS ====================

const getInvoiceStatusLabel = (status) => {
    const labels = {
        'draft': 'Draft',
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
        const { id } = req.params;
        const { amount, description, due_date } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid contractor ID' });
        }

        if (!amount || !due_date) {
            return res.status(400).json({
                message: 'Amount and due date are required'
            });
        }

        // Check contractor exists
        const contractor = await getContractorById(id);
        if (contractor.length === 0) {
            return res.status(404).json({ message: 'Contractor not found' });
        }

        const c = contractor[0];

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber();

        // Create invoice
        const result = await createInvoice({
            contractor_id: parseInt(id),
            invoice_number: invoiceNumber,
            invoice_date: new Date().toISOString().split('T')[0],
            due_date,
            amount: parseFloat(amount),
            description: description || `Services for ${c.company_name}`,
            status: 'draft'
        });

        const invoiceId = result.insertId;

        // Get created invoice
        const invoice = await getInvoiceById(invoiceId);

        res.status(201).json({
            success: true,
            message: 'Invoice generated successfully',
            invoice: {
                id: invoice[0].id,
                invoice_number: invoice[0].invoice_number,
                contractor: {
                    id: c.id,
                    company_name: c.company_name
                },
                invoice_date: invoice[0].invoice_date,
                due_date: invoice[0].due_date,
                amount: parseFloat(invoice[0].amount),
                description: invoice[0].description,
                status: invoice[0].status,
                status_label: getInvoiceStatusLabel(invoice[0].status)
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

// ==================== GET CONTRACTOR INVOICES ====================

const getContractorInvoices = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid contractor ID' });
        }

        const invoices = await getInvoicesByContractorId(id);

        const enriched = invoices.map(inv => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            invoice_date: inv.invoice_date,
            due_date: inv.due_date,
            amount: parseFloat(inv.amount),
            description: inv.description,
            status: inv.status,
            status_label: getInvoiceStatusLabel(inv.status),
            created_at: inv.created_at
        }));

        res.json({
            success: true,
            count: invoices.length,
            invoices: enriched
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

// ==================== UPDATE INVOICE STATUS ====================

const updateInvoiceStatusController = async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { status } = req.body;

        if (!invoiceId || isNaN(invoiceId)) {
            return res.status(400).json({ message: 'Invalid invoice ID' });
        }

        const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        const invoice = await getInvoiceById(invoiceId);
        if (invoice.length === 0) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        await updateInvoiceStatus(invoiceId, status);

        res.json({
            success: true,
            message: 'Invoice status updated',
            invoice: {
                id: parseInt(invoiceId),
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

module.exports = {
    addContractor,
    getContractors,
    getSingleContractor,
    editContractor,
    removeContractor,
    updateStatus,
    searchContractorsController,
    generateInvoice,
    getContractorInvoices,
    updateInvoiceStatusController
};