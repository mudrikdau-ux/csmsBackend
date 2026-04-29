const {
    createService,
    getAllServices,
    getServiceById,
    updateService,
    deleteService
} = require('../models/serviceModel');

// Helper to generate full image URL
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

// ==================== CREATE SERVICE ====================

const addService = async (req, res) => {
    try {
        const {
            name,
            price,
            duration,
            location,
            description,
            includes
        } = req.body;

        // Validate required fields
        if (!name || !price || !duration || !location) {
            return res.status(400).json({ 
                message: 'Name, price, duration, and location are required' 
            });
        }

        // Validate location
        const validLocations = ['Unguja Island', 'Pemba Island', 'Both Islands'];
        if (!validLocations.includes(location)) {
            return res.status(400).json({ 
                message: 'Invalid location',
                valid_locations: validLocations
            });
        }

        // Parse includes
        let parsedIncludes = [];
        if (includes) {
            try {
                parsedIncludes = JSON.parse(includes);
                if (!Array.isArray(parsedIncludes)) {
                    throw new Error();
                }
            } catch {
                // If JSON parse fails, try to split by comma
                parsedIncludes = includes.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
            }
        }

        if (parsedIncludes.length > 6) {
            return res.status(400).json({ message: 'Maximum 6 include items allowed' });
        }

        const image = req.file ? req.file.filename : null;

        await createService({
            name,
            price: parseFloat(price),
            duration: parseInt(duration),
            location,
            description: description || null,
            includes: parsedIncludes,
            image
        });

        res.status(201).json({ 
            message: 'Service created successfully',
            service: {
                name,
                price: parseFloat(price),
                duration: parseInt(duration),
                location,
                includes: parsedIncludes,
                image: image ? getImageUrl(req, image) : null
            }
        });

    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ message: 'Failed to create service' });
    }
};

// ==================== GET ALL SERVICES ====================

const getServices = async (req, res) => {
    try {
        const services = await getAllServices();

        const list = services.map(s => ({
            id: s.id,
            name: s.name,
            price: parseFloat(s.price),
            duration: s.duration,
            location: s.location,
            description: s.description,
            includes: safeJSONParse(s.includes),  // FIXED: Use safeJSONParse
            image: getImageUrl(req, s.image),
            created_at: s.created_at
        }));

        res.json({
            count: list.length,
            services: list
        });

    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ message: 'Failed to fetch services' });
    }
};

// ==================== GET SINGLE SERVICE ====================

const getSingleService = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid service ID' });
        }

        const service = await getServiceById(id);

        if (service.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        const s = service[0];

        res.json({
            service: {
                id: s.id,
                name: s.name,
                price: parseFloat(s.price),
                duration: s.duration,
                location: s.location,
                description: s.description,
                includes: safeJSONParse(s.includes),  // FIXED: Use safeJSONParse
                image: getImageUrl(req, s.image),
                created_at: s.created_at
            }
        });

    } catch (error) {
        console.error('Get service error:', error);
        res.status(500).json({ message: 'Failed to fetch service' });
    }
};

// ==================== UPDATE SERVICE ====================

const editService = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            price,
            duration,
            location,
            description,
            includes
        } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid service ID' });
        }

        // Check if service exists
        const existing = await getServiceById(id);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        // Parse includes if provided
        let parsedIncludes;
        if (includes) {
            try {
                parsedIncludes = JSON.parse(includes);
                if (!Array.isArray(parsedIncludes)) {
                    throw new Error();
                }
            } catch {
                // If JSON parse fails, try to split by comma
                parsedIncludes = includes.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
            }
            if (parsedIncludes && parsedIncludes.length > 6) {
                return res.status(400).json({ message: 'Maximum 6 include items allowed' });
            }
        }

        const image = req.file ? req.file.filename : undefined;

        await updateService(id, {
            name,
            price: price ? parseFloat(price) : undefined,
            duration: duration ? parseInt(duration) : undefined,
            location,
            description,
            includes: parsedIncludes,
            image
        });

        // Get updated service
        const updated = await getServiceById(id);
        const s = updated[0];

        res.json({
            message: 'Service updated successfully',
            service: {
                id: s.id,
                name: s.name,
                price: parseFloat(s.price),
                duration: s.duration,
                location: s.location,
                description: s.description,
                includes: safeJSONParse(s.includes),  // FIXED: Use safeJSONParse
                image: getImageUrl(req, s.image)
            }
        });

    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ message: 'Failed to update service' });
    }
};

// ==================== DELETE SERVICE ====================

const removeService = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: 'Invalid service ID' });
        }

        // Check if exists
        const service = await getServiceById(id);
        if (service.length === 0) {
            return res.status(404).json({ message: 'Service not found' });
        }

        await deleteService(id);

        res.json({ 
            message: 'Service deleted successfully',
            deleted_id: parseInt(id)
        });

    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ message: 'Failed to delete service' });
    }
};

module.exports = {
    addService,
    getServices,
    getSingleService,
    editService,
    removeService
};