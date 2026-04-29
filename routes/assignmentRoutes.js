const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/auth');

const {
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
} = require('../controllers/assignmentController');

// All routes require admin authentication
router.use(verifyAdmin);

// ==================== ASSIGNMENT CRUD ====================

// Create assignment
router.post('/assign', assignStaffToService);

// Remove assignment
router.delete('/:id', removeStaffAssignment);

// Update assignment status
router.put('/:id/status', updateAssignmentStatusController);

// Get all assignments
router.get('/', getAllAssignmentsController);

// ==================== SERVICES BY STATUS ====================

// Get unassigned services
router.get('/services/unassigned', getUnassignedServicesController);

// Get assigned services
router.get('/services/assigned', getAssignedServicesController);

// Get all services with status
router.get('/services/all', getAllServicesWithStatus);

// Get service assignment details
router.get('/services/:serviceId/details', getServiceAssignmentDetails);

// ==================== STAFF BY STATUS ====================

// Get unassigned staff
router.get('/staff/unassigned', getUnassignedStaffController);

// Get assigned staff
router.get('/staff/assigned', getAssignedStaffController);

// Get all staff with status
router.get('/staff/all', getAllStaffWithStatus);

// Get staff sorted by assignments (least first)
router.get('/staff/sorted', getStaffSortedByAssignments);

// Get staff service details
router.get('/staff/:staffId/details', getStaffServiceDetails);

module.exports = router;