const bcrypt = require('bcryptjs');

const {
    findUserByEmail,
    createStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    deleteStaff
} = require('../models/userModel');

// Helper to generate full photo URL
const getPhotoUrl = (req, filename) => {
    if (!filename) return null;
    return `${req.protocol}://${req.get('host')}/uploads/staff/${filename}`;
};

// ==================== ADD STAFF ====================

const addStaff = async (req, res) => {
    try {
        const { full_name, email, phone, password, staff_type } = req.body;

        // Validate required fields
        if (!full_name || !email || !password) {
            return res.status(400).json({ 
                message: 'Full name, email, and password are required' 
            });
        }

        // Check if email already exists
        const existing = await findUserByEmail(email);
        if (existing.length > 0) {
            return res.status(400).json({ 
                message: 'Email already exists',
                field: 'email'
            });
        }

        // Split full name
        const names = full_name.trim().split(' ');
        const first_name = names[0];
        const last_name = names.slice(1).join(' ') || '';

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Get photo filename
        const photo = req.file ? req.file.filename : null;

        // Create staff
        await createStaff({
            first_name,
            last_name,
            email,
            password: hashedPassword,
            phone: phone || null,
            photo,
            staff_type: staff_type || 'normal'
        });

        res.status(201).json({ 
            message: 'Staff added successfully',
            staff: {
                first_name,
                last_name,
                email,
                phone,
                staff_type: staff_type || 'normal'
            }
        });

    } catch (error) {
        console.error('Add staff error:', error);
        res.status(500).json({ message: 'Failed to add staff member' });
    }
};

// ==================== GET ALL STAFF ====================

const getStaff = async (req, res) => {
    try {
        const staff = await getAllStaff();

        const list = staff.map(s => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            full_name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            phone: s.phone,
            staff_type: s.staff_type,
            photo: getPhotoUrl(req, s.photo),
            created_at: s.created_at
        }));

        res.json({ 
            count: list.length,
            staff: list 
        });

    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({ message: 'Failed to fetch staff members' });
    }
};

// ==================== GET SINGLE STAFF ====================

const getSingleStaff = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid staff ID' });
        }

        const staff = await getStaffById(id);

        if (staff.length === 0) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        const s = staff[0];

        res.json({
            staff: {
                id: s.id,
                first_name: s.first_name,
                last_name: s.last_name,
                full_name: `${s.first_name} ${s.last_name}`,
                email: s.email,
                phone: s.phone,
                staff_type: s.staff_type,
                photo: getPhotoUrl(req, s.photo),
                gender: s.gender,
                created_at: s.created_at
            }
        });

    } catch (error) {
        console.error('Get single staff error:', error);
        res.status(500).json({ message: 'Failed to fetch staff member' });
    }
};

// ==================== UPDATE STAFF ====================

const editStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, phone, password, staff_type } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid staff ID' });
        }

        // Get existing staff
        const staff = await getStaffById(id);
        
        if (staff.length === 0) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        const existing = staff[0];

        // Handle name
        let first_name = existing.first_name;
        let last_name = existing.last_name;

        if (full_name) {
            const names = full_name.trim().split(' ');
            first_name = names[0];
            last_name = names.slice(1).join(' ') || '';
        }

        // Handle password
        let hashedPassword = existing.password;
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ message: 'Password must be at least 6 characters' });
            }
            hashedPassword = await bcrypt.hash(password, 10);
        }

        // Handle photo
        const photo = req.file ? req.file.filename : existing.photo;

        // Update
        await updateStaff(id, {
            first_name,
            last_name,
            email: email || existing.email,
            phone: phone !== undefined ? phone : existing.phone,
            password: hashedPassword,
            photo,
            staff_type: staff_type || existing.staff_type
        });

        res.json({ 
            message: 'Staff updated successfully',
            staff: {
                id: parseInt(id),
                first_name,
                last_name,
                email: email || existing.email,
                staff_type: staff_type || existing.staff_type
            }
        });

    } catch (error) {
        console.error('Edit staff error:', error);
        res.status(500).json({ message: 'Failed to update staff member' });
    }
};

// ==================== DELETE STAFF ====================

const removeStaff = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid staff ID' });
        }

        // Check if exists
        const staff = await getStaffById(id);
        if (staff.length === 0) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        await deleteStaff(id);

        res.json({ 
            message: 'Staff deleted successfully',
            deleted_id: parseInt(id)
        });

    } catch (error) {
        console.error('Delete staff error:', error);
        res.status(500).json({ message: 'Failed to delete staff member' });
    }
};

module.exports = {
    addStaff,
    getStaff,
    getSingleStaff,
    editStaff,
    removeStaff
};