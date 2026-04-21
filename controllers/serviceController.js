const {
    createService,
    getAllServices,
    getServiceById,
    updateService,
    deleteService
} = require('../models/serviceModel');


// CREATE SERVICE
const addService = (req, res) => {
    const {
        name,
        price,
        duration,
        location,
        description,
        includes
    } = req.body;

    const image = req.file ? req.file.filename : null;

    const parsedIncludes = JSON.parse(includes);

    if (parsedIncludes.length > 6) {
        return res.status(400).json({ message: 'Max 6 includes allowed' });
    }

    createService({
        name,
        price,
        duration,
        location,
        description,
        includes: parsedIncludes,
        image
    }, (err) => {
        if (err) return res.status(500).json(err);

        res.json({ message: 'Service created successfully' });
    });
};


// GET ALL SERVICES
const getServices = (req, res) => {
    getAllServices((err, results) => {
        if (err) return res.status(500).json(err);

        res.json(results);
    });
};


// GET SINGLE SERVICE
const getSingleService = (req, res) => {
    const { id } = req.params;

    getServiceById(id, (err, result) => {
        if (err) return res.status(500).json(err);

        if (result.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        res.json(result[0]);
    });
};


// UPDATE SERVICE
const editService = (req, res) => {
    const { id } = req.params;

    const {
        name,
        price,
        duration,
        location,
        description,
        includes
    } = req.body;

    const image = req.file ? req.file.filename : null;

    const parsedIncludes = JSON.parse(includes);

    updateService(id, {
        name,
        price,
        duration,
        location,
        description,
        includes: parsedIncludes,
        image
    }, (err) => {
        if (err) return res.status(500).json(err);

        res.json({ message: 'Service updated successfully' });
    });
};


// DELETE SERVICE
const removeService = (req, res) => {
    const { id } = req.params;

    deleteService(id, (err) => {
        if (err) return res.status(500).json(err);

        res.json({ message: 'Service deleted successfully' });
    });
};

module.exports = {
    addService,
    getServices,
    getSingleService,
    editService,
    removeService
};