const bcrypt = require('bcryptjs');

const {
    createStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    deleteStaff
} = require('../models/adminStaffModel');


// Helper: image URL
const getPhotoUrl = (req, filename) => {
    if (!filename) return null;
    return `${req.protocol}://${req.get('host')}/uploads/staff/${filename}`;
};


// ================= ADD STAFF =================
const addStaff = async (req, res) => {
    try {
        const { full_name, email, phone, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: 'Full name, email, password required'
            });
        }

        // Split name
        const names = full_name.split(' ');
        const first_name = names[0];
        const last_name = names.slice(1).join(' ') || '';

        const hashedPassword = await bcrypt.hash(password, 10);
        const photo = req.file ? req.file.filename : null;

        createStaff({
            first_name,
            last_name,
            email,
            password: hashedPassword,
            phone,
            photo
        }, (err) => {
            if (err) return res.status(500).json(err);

            res.status(201).json({
                message: 'Staff added successfully'
            });
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ================= GET ALL STAFF =================
const getStaff = (req, res) => {
    getAllStaff((err, result) => {
        if (err) return res.status(500).json(err);

        const staffList = result.map(staff => ({
            ...staff,
            full_name: `${staff.first_name} ${staff.last_name}`,
            photo: getPhotoUrl(req, staff.photo)
        }));

        res.json(staffList);
    });
};


// ================= GET SINGLE STAFF =================
const getSingleStaff = (req, res) => {
    const { id } = req.params;

    getStaffById(id, (err, result) => {
        if (err) return res.status(500).json(err);

        if (result.length === 0) {
            return res.status(404).json({ message: 'Staff not found' });
        }

        const staff = result[0];

        staff.full_name = `${staff.first_name} ${staff.last_name}`;
        staff.photo = getPhotoUrl(req, staff.photo);

        res.json(staff);
    });
};


// ================= UPDATE STAFF =================
const editStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, email, phone, password } = req.body;

        const photo = req.file ? req.file.filename : null;

        getStaffById(id, async (err, result) => {
            if (err) return res.status(500).json(err);

            if (result.length === 0) {
                return res.status(404).json({ message: 'Staff not found' });
            }

            const existing = result[0];

            let first_name = existing.first_name;
            let last_name = existing.last_name;

            if (full_name) {
                const names = full_name.split(' ');
                first_name = names[0];
                last_name = names.slice(1).join(' ');
            }

            let hashedPassword = existing.password;

            if (password) {
                hashedPassword = await bcrypt.hash(password, 10);
            }

            updateStaff(id, {
                first_name,
                last_name,
                email: email || existing.email,
                phone: phone || existing.phone,
                password: hashedPassword,
                photo: photo || existing.photo
            }, (err) => {
                if (err) return res.status(500).json(err);

                res.json({ message: 'Staff updated successfully' });
            });
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ================= DELETE STAFF =================
const removeStaff = (req, res) => {
    const { id } = req.params;

    deleteStaff(id, (err) => {
        if (err) return res.status(500).json(err);

        res.json({ message: 'Staff deleted successfully' });
    });
};


module.exports = {
    addStaff,
    getStaff,
    getSingleStaff,
    editStaff,
    removeStaff
};