const {
    createIssue,
    getIssuesByStaffId,
    getIssueById,
    getAllIssues,
    updateIssueStatus,
    getIssueStats,
    deleteIssue
} = require('../models/staffIssueModel');

// ==================== HELPER FUNCTIONS ====================

const getIssueTypeLabel = (type) => {
    const labels = {
        'sick': 'Feeling Sick',
        'unable_to_attend': 'Unable to Attend',
        'personal_emergency': 'Personal Emergency',
        'transport_issue': 'Transport Issue',
        'family_emergency': 'Family Emergency',
        'other': 'Other Issue'
    };
    return labels[type] || type;
};

const getStatusLabel = (status) => {
    const labels = {
        'pending': 'Pending Review',
        'reviewed': 'Under Review',
        'resolved': 'Resolved',
        'rejected': 'Rejected'
    };
    return labels[status] || status;
};

const getStatusColor = (status) => {
    const colors = {
        'pending': '#f39c12',
        'reviewed': '#3498db',
        'resolved': '#27ae60',
        'rejected': '#e74c3c'
    };
    return colors[status] || '#95a5a6';
};

// ==================== STAFF: SUBMIT ISSUE ====================

const submitIssue = async (req, res) => {
    try {
        const staffId = req.user.id;
        const {
            booking_id,
            issue_type,
            issue_title,
            issue_description,
            expected_return_date
        } = req.body;

        // Validate required fields
        if (!issue_type || !issue_title || !issue_description || !expected_return_date) {
            return res.status(400).json({
                message: 'All fields are required',
                required: ['issue_type', 'issue_title', 'issue_description', 'expected_return_date']
            });
        }

        // Validate issue type
        const validTypes = ['sick', 'unable_to_attend', 'personal_emergency', 'transport_issue', 'family_emergency', 'other'];
        if (!validTypes.includes(issue_type)) {
            return res.status(400).json({
                message: 'Invalid issue type',
                valid_types: validTypes
            });
        }

        // Validate title length
        if (issue_title.length < 5 || issue_title.length > 255) {
            return res.status(400).json({ message: 'Issue title must be between 5 and 255 characters' });
        }

        // Validate description length
        if (issue_description.length < 10 || issue_description.length > 2000) {
            return res.status(400).json({ message: 'Issue description must be between 10 and 2000 characters' });
        }

        // Validate expected return date (cannot be in the past)
        const returnDate = new Date(expected_return_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (returnDate < today) {
            return res.status(400).json({ message: 'Expected return date cannot be in the past' });
        }

        // Create issue
        const result = await createIssue({
            staff_id: staffId,
            booking_id: booking_id || null,
            issue_type,
            issue_title: issue_title.trim(),
            issue_description: issue_description.trim(),
            expected_return_date
        });

        const issueId = result.insertId;

        res.status(201).json({
            success: true,
            message: 'Issue submitted successfully. Admin will review it shortly.',
            issue: {
                id: issueId,
                issue_type,
                issue_type_label: getIssueTypeLabel(issue_type),
                issue_title,
                expected_return_date,
                status: 'pending',
                status_label: getStatusLabel('pending')
            }
        });

    } catch (error) {
        console.error('Submit issue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit issue',
            error: error.message
        });
    }
};

// ==================== STAFF: GET MY ISSUES ====================

const getMyIssues = async (req, res) => {
    try {
        const staffId = req.user.id;
        const { status, limit = 50 } = req.query;

        const issues = await getIssuesByStaffId(staffId, { status, limit });

        const enrichedIssues = issues.map(issue => ({
            id: issue.id,
            issue_type: issue.issue_type,
            issue_type_label: getIssueTypeLabel(issue.issue_type),
            issue_title: issue.issue_title,
            issue_description: issue.issue_description,
            expected_return_date: issue.expected_return_date,
            status: issue.status,
            status_label: getStatusLabel(issue.status),
            status_color: getStatusColor(issue.status),
            admin_response: issue.admin_response,
            booking: issue.booking_id ? {
                id: issue.booking_id,
                service_name: issue.service_name,
                service_date: issue.service_date,
                service_time: issue.service_time,
                address: issue.address,
                city: issue.city,
                customer_name: issue.customer_name
            } : null,
            created_at: issue.created_at,
            resolved_at: issue.resolved_at
        }));

        // Get counts for filtering
        const allIssues = await getIssuesByStaffId(staffId, {});
        const counts = {
            all: allIssues.length,
            pending: allIssues.filter(i => i.status === 'pending').length,
            reviewed: allIssues.filter(i => i.status === 'reviewed').length,
            resolved: allIssues.filter(i => i.status === 'resolved').length,
            rejected: allIssues.filter(i => i.status === 'rejected').length
        };

        res.json({
            success: true,
            count: enrichedIssues.length,
            counts,
            issues: enrichedIssues
        });

    } catch (error) {
        console.error('Get my issues error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch issues',
            error: error.message
        });
    }
};

// ==================== STAFF: GET SINGLE ISSUE ====================

const getSingleIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const staffId = req.user.id;

        const issue = await getIssueById(id);

        if (issue.length === 0) {
            return res.status(404).json({ message: 'Issue not found' });
        }

        const i = issue[0];

        // Check if issue belongs to the staff
        if (i.staff_id !== staffId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({
            success: true,
            issue: {
                id: i.id,
                issue_type: i.issue_type,
                issue_type_label: getIssueTypeLabel(i.issue_type),
                issue_title: i.issue_title,
                issue_description: i.issue_description,
                expected_return_date: i.expected_return_date,
                status: i.status,
                status_label: getStatusLabel(i.status),
                status_color: getStatusColor(i.status),
                admin_response: i.admin_response,
                booking: i.booking_id ? {
                    id: i.booking_id,
                    service_name: i.service_name,
                    service_price: parseFloat(i.service_price),
                    service_duration: i.service_duration,
                    service_date: i.service_date,
                    service_time: i.service_time,
                    address: i.address,
                    city: i.city,
                    landmark: i.landmark,
                    customer_name: i.customer_name,
                    customer_email: i.customer_email,
                    customer_phone: i.customer_phone,
                    booking_status: i.booking_status
                } : null,
                staff: {
                    id: i.staff_id,
                    first_name: i.staff_first_name,
                    last_name: i.staff_last_name,
                    full_name: `${i.staff_first_name} ${i.staff_last_name}`,
                    email: i.staff_email,
                    phone: i.staff_phone,
                    photo: i.staff_photo ? `/uploads/staff/${i.staff_photo}` : null
                },
                created_at: i.created_at,
                resolved_at: i.resolved_at,
                updated_at: i.updated_at
            }
        });

    } catch (error) {
        console.error('Get single issue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch issue',
            error: error.message
        });
    }
};

// ==================== ADMIN: GET ALL ISSUES ====================

const adminGetAllIssues = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            staff_id: req.query.staff_id,
            date_from: req.query.date_from,
            date_to: req.query.date_to,
            limit: req.query.limit || 100,
            offset: req.query.offset || 0
        };

        const issues = await getAllIssues(filters);
        const stats = await getIssueStats();

        const enrichedIssues = issues.map(issue => ({
            id: issue.id,
            issue_type: issue.issue_type,
            issue_type_label: getIssueTypeLabel(issue.issue_type),
            issue_title: issue.issue_title,
            issue_description: issue.issue_description,
            expected_return_date: issue.expected_return_date,
            status: issue.status,
            status_label: getStatusLabel(issue.status),
            status_color: getStatusColor(issue.status),
            staff: {
                id: issue.staff_id,
                name: `${issue.staff_first_name} ${issue.staff_last_name}`,
                email: issue.staff_email,
                phone: issue.staff_phone,
                photo: issue.staff_photo ? `/uploads/staff/${issue.staff_photo}` : null
            },
            booking: issue.booking_id ? {
                id: issue.booking_id,
                service_name: issue.service_name,
                service_date: issue.service_date,
                service_time: issue.service_time,
                address: issue.address,
                city: issue.city,
                customer_name: issue.customer_name,
                booking_status: issue.booking_status
            } : null,
            created_at: issue.created_at,
            resolved_at: issue.resolved_at
        }));

        res.json({
            success: true,
            count: enrichedIssues.length,
            stats: {
                total: stats[0]?.total_issues || 0,
                pending: stats[0]?.pending_count || 0,
                reviewed: stats[0]?.reviewed_count || 0,
                resolved: stats[0]?.resolved_count || 0,
                rejected: stats[0]?.rejected_count || 0,
                staff_with_issues: stats[0]?.staff_with_issues || 0
            },
            issues: enrichedIssues
        });

    } catch (error) {
        console.error('Admin get all issues error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch issues',
            error: error.message
        });
    }
};

// ==================== ADMIN: UPDATE ISSUE STATUS ====================

const adminUpdateIssueStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_response } = req.body;

        const validStatuses = ['pending', 'reviewed', 'resolved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        const issue = await getIssueById(id);
        if (issue.length === 0) {
            return res.status(404).json({ message: 'Issue not found' });
        }

        await updateIssueStatus(id, status, admin_response);

        res.json({
            success: true,
            message: `Issue ${status === 'resolved' ? 'marked as resolved' : `status updated to ${status}`}`,
            issue: {
                id: parseInt(id),
                status,
                status_label: getStatusLabel(status),
                status_color: getStatusColor(status)
            }
        });

    } catch (error) {
        console.error('Update issue status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update issue status',
            error: error.message
        });
    }
};

// ==================== ADMIN: DELETE ISSUE ====================

const adminDeleteIssue = async (req, res) => {
    try {
        const { id } = req.params;

        const issue = await getIssueById(id);
        if (issue.length === 0) {
            return res.status(404).json({ message: 'Issue not found' });
        }

        await deleteIssue(id);

        res.json({
            success: true,
            message: 'Issue deleted successfully',
            deleted_id: parseInt(id)
        });

    } catch (error) {
        console.error('Delete issue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete issue',
            error: error.message
        });
    }
};

// ==================== ADMIN: GET ISSUE STATS ====================

const adminGetIssueStats = async (req, res) => {
    try {
        const stats = await getIssueStats();

        res.json({
            success: true,
            stats: {
                total_issues: stats[0]?.total_issues || 0,
                pending: stats[0]?.pending_count || 0,
                reviewed: stats[0]?.reviewed_count || 0,
                resolved: stats[0]?.resolved_count || 0,
                rejected: stats[0]?.rejected_count || 0,
                staff_with_issues: stats[0]?.staff_with_issues || 0
            }
        });

    } catch (error) {
        console.error('Get issue stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

module.exports = {
    submitIssue,
    getMyIssues,
    getSingleIssue,
    adminGetAllIssues,
    adminUpdateIssueStatus,
    adminDeleteIssue,
    adminGetIssueStats
};