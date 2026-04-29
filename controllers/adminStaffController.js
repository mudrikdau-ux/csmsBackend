const bcrypt = require('bcryptjs');

const {
    findUserByEmail,
    createStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    deleteStaff
} = require('../models/userModel');


// Image helper
const getPhotoUrl = (req, filename) => {
    if (!filename) return null;
    return `${req.protocol}://${req.get('host')}/uploads/staff/${filename}`;
};


// ================= ADD STAFF =================
const addStaff = async (req, res) => {
    try {
        const { full_name, email, phone, password, staff_type } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: 'Full name, email, password required'
            });
        }

        // 🔥 CHECK IF EMAIL EXISTS
        findUserByEmail(email, async (err, result) => {
            if (err) return res.status(500).json(err);

            if (result.length > 0) {
                return res.status(400).json({
                    message: 'Email already exists'
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
                photo,
                staff_type
            }, (err) => {
                if (err) return res.status(500).json(err);

                res.json({ message: 'Staff added successfully' });
            });
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ================= GET STAFF =================
const getStaff = (req, res) => {
    getAllStaff((err, result) => {
        const list = result.map(s => ({
            ...s,
            full_name: `${s.first_name} ${s.last_name}`,
            photo: getPhotoUrl(req, s.photo)
        }));

        res.json(list);
    });
};


// ================= GET ONE =================
const getSingleStaff = (req, res) => {
    const { id } = req.params;

    getStaffById(id, (err, result) => {
        if (result.length === 0) {
            return res.status(404).json({ message: 'Not found' });
        }

        const s = result[0];

        res.json({
            ...s,
            full_name: `${s.first_name} ${s.last_name}`,
            photo: getPhotoUrl(req, s.photo)
        });
    });
};


// ================= UPDATE =================
const editStaff = async (req, res) => {
    const { id } = req.params;
    const { full_name, email, phone, password, staff_type } = req.body;

    const photo = req.file ? req.file.filename : null;

    getStaffById(id, async (err, result) => {
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
            photo: photo || existing.photo,
            staff_type: staff_type || existing.staff_type
        }, () => {
            res.json({ message: 'Updated successfully' });
        });
    });
};


// ================= DELETE =================
const removeStaff = (req, res) => {
    deleteStaff(req.params.id, () => {
        res.json({ message: 'Deleted successfully' });
    });
};


module.exports = {
    addStaff,
    getStaff,
    getSingleStaff,
    editStaff,
    removeStaff
};