const express = require('express');
const router = express.Router();
const { 
    registerDevice, 
    createNewKit, 
    getAllDevicesHandler, 
    getAllKitsHandler, 
    getAvailableKitsHandler,
    updateKitHandler
} = require('../controllers/inventory-controller');

// POST /api/v1/devices - Register a new device
router.post('/devices', registerDevice);

// GET /api/v1/devices - Get all devices
router.get('/devices', getAllDevicesHandler);

// POST /api/v1/kits - Create a new kit
router.post('/kits', createNewKit);

// GET /api/v1/kits - Get all kits
router.get('/kits', getAllKitsHandler);

// GET /api/v1/kits/available - Get available kits
router.get('/kits/available', getAvailableKitsHandler);

// PATCH /api/v1/kits/:kit_id - Update a kit by swapping a single device
router.patch('/kits/:kit_id', updateKitHandler);

module.exports = router;
