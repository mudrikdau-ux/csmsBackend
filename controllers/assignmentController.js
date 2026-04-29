const {
    createAssignment,
    removeAssignment,
    updateAssignmentStatus,
    getAssignmentById,
    getAssignmentsByStaffId,
    getAssignmentsByServiceId,
    getAllAssignments,
    getUnassignedServices,
    getUnassignedStaff,
    getAssignedStaff,
    getStaffSortedByAssignmentCount,
    getAssignedServices
} = require('../models/assignmentModel');

const { getStaffById } = require('../models/userModel');
const { getServiceById } = require('../models/serviceModel');

// Helper to generate full URL
const getPhotoUrl = (req, filename) => {
    if (!filename) return null;
    return `${req.protocol}://${req.get('host')}/uploads/staff/${filename}`;
};

const getImageUrl = (req, filename) => {
    if (!filename) return null;
    return `${req.protocol}://${req.get('host')}/uploads/services/${filename}`;
};

// Helper to safely parse JSON
const safeJSONParse = (data) => {
    if (!data) return [];
    
    // If it's already an object/array, return it
    if (typeof data === 'object') return data;
    
    try {
        return JSON.parse(data);
    } catch (error) {
        console.warn('JSON parse warning:', error.message, 'Data:', data);
        // If it's a comma-separated string, try to split it
        if (typeof data === 'string' && data.includes(',')) {
            return data.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
        }
        // If it's a single string, wrap it in an array
        if (typeof data === 'string' && data.length > 0) {
            return [data];
        }
        return [];
    }
};

// ==================== ASSIGN STAFF TO SERVICE ====================

const assignStaffToService = async (req, res) => {
    try {
        const { staff_id, service_id } = req.body;

        if (!staff_id || !service_id) {
            return res.status(400).json({ 
                message: 'Staff ID and Service ID are required' 
            });
        }

        // Check if staff exists
        const staff = await getStaffById(staff_id);
        if (staff.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        // Check if service exists
        const service = await getServiceById(service_id);
        if (service.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        // Create assignment
        const result = await createAssignment(staff_id, service_id);

        res.status(201).json({
            message: 'Staff assigned to service successfully',
            assignment: {
                id: result.insertId,
                staff: {
                    id: staff[0].id,
                    name: `${staff[0].first_name} ${staff[0].last_name}`,
                    email: staff[0].email
                },
                service: {
                    id: service[0].id,
                    name: service[0].name
                },
                status: 'assigned'
            }
        });

    } catch (error) {
        console.error('Assign staff error:', error);
        res.status(500).json({ message: 'Failed to assign staff to service' });
    }
};

// ==================== REMOVE ASSIGNMENT ====================

const removeStaffAssignment = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid assignment ID' });
        }

        // Check if assignment exists
        const assignment = await getAssignmentById(id);
        if (assignment.length === 0) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        await removeAssignment(id);

        res.json({
            message: 'Assignment removed successfully',
            deleted_assignment_id: parseInt(id)
        });

    } catch (error) {
        console.error('Remove assignment error:', error);
        res.status(500).json({ message: 'Failed to remove assignment' });
    }
};

// ==================== UPDATE ASSIGNMENT STATUS ====================

const updateAssignmentStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid assignment ID' });
        }

        const validStatuses = ['assigned', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid status',
                valid_statuses: validStatuses
            });
        }

        // Check if assignment exists
        const assignment = await getAssignmentById(id);
        if (assignment.length === 0) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        await updateAssignmentStatus(id, status);

        res.json({
            message: 'Assignment status updated successfully',
            assignment: {
                id: parseInt(id),
                status: status,
                previous_status: assignment[0].status
            }
        });

    } catch (error) {
        console.error('Update assignment status error:', error);
        res.status(500).json({ message: 'Failed to update assignment status' });
    }
};

// ==================== GET UNASSIGNED SERVICES ====================

const getUnassignedServicesController = async (req, res) => {
    try {
        const services = await getUnassignedServices();

        const list = services.map(s => ({
            id: s.id,
            name: s.name,
            price: parseFloat(s.price),
            duration: s.duration,
            location: s.location,
            description: s.description,
            includes: safeJSONParse(s.includes),
            image: getImageUrl(req, s.image),
            status: 'unassigned',
            created_at: s.created_at
        }));

        res.json({
            count: list.length,
            services: list
        });

    } catch (error) {
        console.error('Get unassigned services error:', error);
        res.status(500).json({ message: 'Failed to fetch unassigned services' });
    }
};

// ==================== GET ASSIGNED SERVICES ====================

const getAssignedServicesController = async (req, res) => {
    try {
        const services = await getAssignedServices();

        const list = services.map(s => ({
            id: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price),
            duration: s.duration,
            location: s.location,
            description: s.description,
            image: getImageUrl(req, s.service_image),
            assigned_to: s.assigned_to,
            total_assignments: s.total_assignments,
            status: 'assigned',
            created_at: s.created_at
        }));

        res.json({
            count: list.length,
            services: list
        });

    } catch (error) {
        console.error('Get assigned services error:', error);
        res.status(500).json({ message: 'Failed to fetch assigned services' });
    }
};

// ==================== GET UNASSIGNED STAFF ====================

const getUnassignedStaffController = async (req, res) => {
    try {
        const staff = await getUnassignedStaff();

        const list = staff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            full_name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            phone: s.phone,
            photo: getPhotoUrl(req, s.photo),
            staff_type: s.staff_type,
            status: 'not_assigned',
            services: 0
        }));

        res.json({
            count: list.length,
            staff: list
        });

    } catch (error) {
        console.error('Get unassigned staff error:', error);
        res.status(500).json({ message: 'Failed to fetch unassigned staff' });
    }
};

// ==================== GET ASSIGNED STAFF ====================

const getAssignedStaffController = async (req, res) => {
    try {
        const staff = await getAssignedStaff();

        const list = staff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            full_name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            phone: s.phone,
            photo: getPhotoUrl(req, s.photo),
            staff_type: s.staff_type,
            status: 'assigned',
            progress: s.in_progress_count > 0 ? 'in_progress' : 
                     s.assigned_count > 0 ? 'just_started' : 
                     s.completed_count > 0 ? 'completed' : 'not_started',
            total_services: s.total_services,
            assigned_count: s.assigned_count,
            in_progress_count: s.in_progress_count,
            completed_count: s.completed_count
        }));

        res.json({
            count: list.length,
            staff: list
        });

    } catch (error) {
        console.error('Get assigned staff error:', error);
        res.status(500).json({ message: 'Failed to fetch assigned staff' });
    }
};

// ==================== GET ALL STAFF WITH ASSIGNMENT STATUS ====================

const getAllStaffWithStatus = async (req, res) => {
    try {
        const assignedStaff = await getAssignedStaff();
        const unassignedStaff = await getUnassignedStaff();

        const assignedList = assignedStaff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            full_name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            phone: s.phone,
            photo: getPhotoUrl(req, s.photo),
            staff_type: s.staff_type,
            role: s.staff_type,
            status: 'Assigned',
            progress: s.in_progress_count > 0 ? 'In Progress' : 
                     s.assigned_count > 0 ? 'Just Started' : 
                     s.completed_count > 0 ? 'Completed' : 'Not Started',
            services: s.total_services,
            assigned_count: s.assigned_count,
            in_progress_count: s.in_progress_count,
            completed_count: s.completed_count
        }));

        const unassignedList = unassignedStaff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            full_name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            phone: s.phone,
            photo: getPhotoUrl(req, s.photo),
            staff_type: s.staff_type,
            role: s.staff_type,
            status: 'Not Assigned',
            progress: '-',
            services: 0
        }));

        const allStaff = [...assignedList, ...unassignedList];

        res.json({
            count: allStaff.length,
            staff: allStaff
        });

    } catch (error) {
        console.error('Get all staff with status error:', error);
        res.status(500).json({ message: 'Failed to fetch staff with status' });
    }
};

// ==================== GET ALL SERVICES WITH ASSIGNMENT STATUS ====================

const getAllServicesWithStatus = async (req, res) => {
    try {
        const assignedServices = await getAssignedServices();
        const unassignedServices = await getUnassignedServices();

        const assignedList = assignedServices.map(s => ({
            id: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price),
            duration: s.duration,
            location: s.location,
            description: s.description,
            image: getImageUrl(req, s.service_image),
            status: 'Assigned',
            assigned_to: s.assigned_to,
            total_assignments: s.total_assignments
        }));

        const unassignedList = unassignedServices.map(s => ({
            id: s.id,
            name: s.name,
            price: parseFloat(s.price),
            duration: s.duration,
            location: s.location,
            description: s.description,
            includes: safeJSONParse(s.includes),
            image: getImageUrl(req, s.image),
            status: 'Unassigned'
        }));

        const allServices = [...assignedList, ...unassignedList];

        res.json({
            count: allServices.length,
            services: allServices
        });

    } catch (error) {
        console.error('Get all services with status error:', error);
        res.status(500).json({ message: 'Failed to fetch services with status' });
    }
};

// ==================== GET STAFF SORTED BY ASSIGNMENTS (LEAST FIRST) ====================

const getStaffSortedByAssignments = async (req, res) => {
    try {
        const staff = await getStaffSortedByAssignmentCount();

        const list = staff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            full_name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            phone: s.phone,
            photo: getPhotoUrl(req, s.photo),
            staff_type: s.staff_type,
            total_assignments: s.total_assignments,
            availability: s.total_assignments === 0 ? 'Available' : 
                          s.total_assignments <= 3 ? 'Light Load' : 
                          s.total_assignments <= 6 ? 'Moderate Load' : 'Heavy Load'
        }));

        res.json({
            count: list.length,
            staff: list
        });

    } catch (error) {
        console.error('Get staff sorted error:', error);
        res.status(500).json({ message: 'Failed to fetch staff sorted by assignments' });
    }
};

// ==================== GET STAFF SERVICE DETAILS ====================

const getStaffServiceDetails = async (req, res) => {
    try {
        const { staffId } = req.params;

        if (!staffId || isNaN(staffId)) {
            return res.status(400).json({ message: 'Invalid staff ID' });
        }

        const assignments = await getAssignmentsByStaffId(staffId);

        if (assignments.length === 0) {
            return res.status(200).json({
                staff_id: parseInt(staffId),
                total_services: 0,
                services: []
            });
        }

        const list = assignments.map(a => ({
            assignment_id: a.assignment_id,
            service: {
                id: a.service_id,
                name: a.service_name,
                price: parseFloat(a.price),
                duration: a.duration,
                location: a.location,
                description: a.description,
                image: getImageUrl(req, a.service_image)
            },
            status: a.assignment_status,
            assigned_date: a.assigned_date,
            completed_date: a.completed_date
        }));

        res.json({
            staff_id: parseInt(staffId),
            total_services: list.length,
            services: list
        });

    } catch (error) {
        console.error('Get staff service details error:', error);
        res.status(500).json({ message: 'Failed to fetch staff service details' });
    }
};

// ==================== GET SERVICE ASSIGNMENT DETAILS ====================

const getServiceAssignmentDetails = async (req, res) => {
    try {
        const { serviceId } = req.params;

        if (!serviceId || isNaN(serviceId)) {
            return res.status(400).json({ message: 'Invalid service ID' });
        }

        const assignments = await getAssignmentsByServiceId(serviceId);

        if (assignments.length === 0) {
            return res.status(200).json({
                service_id: parseInt(serviceId),
                total_assignments: 0,
                assignments: []
            });
        }

        const list = assignments.map(a => ({
            assignment_id: a.assignment_id,
            staff: {
                id: a.staff_id,
                first_name: a.first_name,
                last_name: a.last_name,
                full_name: `${a.first_name} ${a.last_name}`,
                email: a.email,
                phone: a.phone,
                photo: getPhotoUrl(req, a.photo),
                staff_type: a.staff_type
            },
            status: a.assignment_status,
            assigned_date: a.assigned_date,
            completed_date: a.completed_date
        }));

        res.json({
            service_id: parseInt(serviceId),
            total_assignments: list.length,
            assignments: list
        });

    } catch (error) {
        console.error('Get service assignment details error:', error);
        res.status(500).json({ message: 'Failed to fetch service assignment details' });
    }
};

// ==================== GET ALL ASSIGNMENTS ====================

const getAllAssignmentsController = async (req, res) => {
    try {
        const filters = {
            staff_id: req.query.staff_id,
            service_id: req.query.service_id,
            status: req.query.status,
            limit: req.query.limit || 50,
            offset: req.query.offset || 0
        };

        const assignments = await getAllAssignments(filters);

        const list = assignments.map(a => ({
            id: a.assignment_id,
            staff: {
                id: a.staff_id,
                name: `${a.first_name} ${a.last_name}`,
                email: a.email,
                phone: a.phone,
                photo: getPhotoUrl(req, a.photo),
                staff_type: a.staff_type
            },
            service: {
                id: a.service_id,
                name: a.service_name,
                price: parseFloat(a.price),
                duration: a.duration,
                location: a.location,
                image: getImageUrl(req, a.service_image)
            },
            status: a.assignment_status,
            notes: a.notes,
            assigned_date: a.assigned_date,
            completed_date: a.completed_date
        }));

        res.json({
            count: list.length,
            assignments: list
        });

    } catch (error) {
        console.error('Get all assignments error:', error);
        res.status(500).json({ message: 'Failed to fetch assignments' });
    }
};

module.exports = {
    assignStaffToService,
    removeStaffAssignment,
    updateAssignmentStatusController,
    getUnassignedServicesController,
    getAssignedServicesController,
    getUnassignedStaffController,
    getAssignedStaffController,
    getAllStaffWithStatus,
    getAllServicesWithStatus,
    getStaffSortedByAssignments,
    getStaffServiceDetails,
    getServiceAssignmentDetails,
    getAllAssignmentsController
};