/**
 * Inventory Controller
 * Handles HTTP requests for device and kit management
 */

const { createDevice, createKit, getAllDevices, getAllKits, getAvailableKits, updateKit } = require('../services/inventory-service');

/**
 * Register a new device
 * POST /api/v1/devices
 */
const registerDevice = async (req, res) => {
    try {
        const { device_id, device_type } = req.body;

        // Validation
        if (!device_id) {
            return res.status(400).json({
                success: false,
                error: 'device_id is required'
            });
        }

        if (!device_type) {
            return res.status(400).json({
                success: false,
                error: 'device_type is required'
            });
        }

        // Create device via service
        const device = await createDevice({ device_id, device_type });

        res.status(201).json({
            success: true,
            data: {
                device_id: device.device_id,
                device_type: device.device_type,
                status: device.status,
                last_seen: device.last_seen
            }
        });

    } catch (error) {
        console.error('Register device error:', error);
        
        // Handle specific validation errors
        if (error.message.includes('Invalid device type') || error.message.includes('device_id is required')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        // Handle duplicate device_id error
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                error: 'Device ID already exists'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Create a new kit
 * POST /api/v1/kits
 */
const createNewKit = async (req, res) => {
    try {
        const { vr_device_id, watch_device_id } = req.body;

        // Validation
        if (!vr_device_id || !watch_device_id) {
            return res.status(400).json({
                success: false,
                error: 'vr_device_id and watch_device_id are required'
            });
        }

        // Create kit via service (includes validation)
        const kit = await createKit({ vr_device_id, watch_device_id });

        res.status(201).json({
            success: true,
            data: {
                kit_id: kit.kit_id,
                vr_device_id: kit.vr_device_id,
                watch_device_id: kit.watch_device_id
            }
        });

    } catch (error) {
        console.error('Create kit error:', error);
        
        // Handle specific validation errors
        if (error.message.includes('not found') || 
            error.message.includes('must reference') ||
            error.message.includes('must be different') ||
            error.message.includes('already associated')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Get all devices
 * GET /api/v1/devices
 */
const getAllDevicesHandler = async (req, res) => {
    try {
        const devices = await getAllDevices();

        res.json({
            success: true,
            data: devices
        });

    } catch (error) {
        console.error('Get all devices error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Get all kits
 * GET /api/v1/kits
 */
const getAllKitsHandler = async (req, res) => {
    try {
        const kits = await getAllKits();

        res.json({
            success: true,
            data: kits
        });

    } catch (error) {
        console.error('Get all kits error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Get available kits
 * GET /api/v1/kits/available
 */
const getAvailableKitsHandler = async (req, res) => {
    try {
        const kits = await getAvailableKits();

        res.json({
            success: true,
            data: kits
        });

    } catch (error) {
        console.error('Get available kits error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Update a kit by swapping a single device
 * PATCH /api/v1/kits/:kit_id
 */
const updateKitHandler = async (req, res) => {
    try {
        const { kit_id } = req.params;
        const { vr_device_id, watch_device_id } = req.body;

        // Validation
        if (!vr_device_id && !watch_device_id) {
            return res.status(400).json({
                success: false,
                error: 'Either vr_device_id or watch_device_id must be provided'
            });
        }

        // Update kit via service (includes validation)
        const updatedKit = await updateKit(kit_id, { vr_device_id, watch_device_id });

        res.json({
            success: true,
            data: {
                kit_id: updatedKit.kit_id,
                vr_device_id: updatedKit.vr_device_id,
                watch_device_id: updatedKit.watch_device_id
            }
        });

    } catch (error) {
        console.error('Update kit error:', error);
        
        // Handle specific validation errors
        if (error.message.includes('not found') || 
            error.message.includes('Cannot swap') ||
            error.message.includes('already associated') ||
            error.message.includes('Only one device')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

module.exports = {
    registerDevice,
    createNewKit,
    getAllDevicesHandler,
    getAllKitsHandler,
    getAvailableKitsHandler,
    updateKitHandler
};
