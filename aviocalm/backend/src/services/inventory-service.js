/**
 * Inventory Service
 * Handles business logic for device and kit management
 * Validates device assignments and prevents duplicate kit associations
 */

const pool = require('../config/db');

class InventoryService {
    /**
     * Register a new device in the system
     * @param {Object} deviceData - Device information
     * @returns {Promise<Object>} Created device record
     */
    async createDevice(deviceData) {
        const { device_id, device_type } = deviceData;

        // Validate device ID
        if (!device_id) {
            throw new Error('device_id is required');
        }

        // Validate device type
        if (!device_type || !['VR', 'Watch'].includes(device_type)) {
            throw new Error('Invalid device type. Must be VR or Watch');
        }

        const query = `
            INSERT INTO devices (device_id, device_type, status, last_seen)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const values = [device_id, device_type, 'Active', null];
        const result = await pool.query(query, values);

        return result.rows[0];
    }

    /**
     * Create a new kit by packaging VR and Watch devices
     * @param {Object} kitData - Kit information with vr_device_id and watch_device_id
     * @returns {Promise<Object>} Created kit record
     */
    async createKit(kitData) {
        const { vr_device_id, watch_device_id } = kitData;

        // Validate both device IDs are provided
        if (!vr_device_id || !watch_device_id) {
            throw new Error('Both vr_device_id and watch_device_id are required');
        }

        // Validate devices are different
        if (vr_device_id === watch_device_id) {
            throw new Error('VR device and Watch device must be different');
        }

        // Fetch both devices to verify they exist
        const devicesQuery = `
            SELECT device_id, device_type, status
            FROM devices
            WHERE device_id IN ($1, $2)
        `;

        const devicesResult = await pool.query(devicesQuery, [vr_device_id, watch_device_id]);

        if (devicesResult.rows.length !== 2) {
            throw new Error('One or both devices not found');
        }

        const vrDevice = devicesResult.rows.find(d => d.device_id === vr_device_id);
        const watchDevice = devicesResult.rows.find(d => d.device_id === watch_device_id);

        // Verify device types: one must be VR, the other must be Watch
        if (vrDevice.device_type !== 'VR') {
            throw new Error('vr_device_id must reference a VR device');
        }

        if (watchDevice.device_type !== 'Watch') {
            throw new Error('watch_device_id must reference a Watch device');
        }

        // CRITICAL: Check if either device is already associated with an existing kit
        const existingKitQuery = `
            SELECT kit_id
            FROM kits
            WHERE vr_device_id = $1 OR watch_device_id = $2
        `;

        const existingKitResult = await pool.query(existingKitQuery, [vr_device_id, watch_device_id]);

        if (existingKitResult.rows.length > 0) {
            throw new Error('One or both devices are already associated with an existing kit');
        }

        // Create the kit
        const kitQuery = `
            INSERT INTO kits (vr_device_id, watch_device_id)
            VALUES ($1, $2)
            RETURNING *
        `;

        const kitResult = await pool.query(kitQuery, [vr_device_id, watch_device_id]);

        return kitResult.rows[0];
    }

    /**
     * Get all devices
     * @returns {Promise<Array>} Array of all devices
     */
    async getAllDevices() {
        const query = `
            SELECT device_id, device_type, status, last_seen
            FROM devices
            ORDER BY device_id
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get all kits with device details
     * @returns {Promise<Array>} Array of all kits with device information
     */
    async getAllKits() {
        const query = `
            SELECT 
                k.kit_id,
                k.kit_number,
                k.vr_device_id,
                vr.device_type as vr_device_type,
                vr.status as vr_status,
                k.watch_device_id,
                w.device_type as watch_device_type,
                w.status as watch_status
            FROM kits k
            LEFT JOIN devices vr ON k.vr_device_id = vr.device_id
            LEFT JOIN devices w ON k.watch_device_id = w.device_id
            ORDER BY k.kit_number
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Get available kits (not currently assigned to a patient)
     * Returns kits that do NOT have an active assignment (unassigned_at IS NULL)
     * AND where both inner devices are 'Active'
     * @returns {Promise<Array>} Array of available kits with device details
     */
    async getAvailableKits() {
        const query = `
            SELECT 
                k.kit_id,
                k.kit_number,
                k.vr_device_id,
                vr.device_type as vr_device_type,
                vr.status as vr_status,
                k.watch_device_id,
                w.device_type as watch_device_type,
                w.status as watch_status
            FROM kits k
            LEFT JOIN patient_assignments pa ON k.kit_id = pa.kit_id AND pa.unassigned_at IS NULL
            JOIN devices vr ON k.vr_device_id = vr.device_id
            JOIN devices w ON k.watch_device_id = w.device_id
            WHERE pa.assignment_id IS NULL
            AND vr.status = 'Active'
            AND w.status = 'Active'
            ORDER BY k.kit_number
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Update a kit by swapping a single device (VR or Watch)
     * @param {string} kitId - The kit ID to update
     * @param {Object} updateData - Contains either vr_device_id or watch_device_id
     * @returns {Promise<Object>} Updated kit record
     */
    async updateKit(kitId, updateData) {
        const { vr_device_id, watch_device_id } = updateData;

        // Validate that at least one device ID is provided
        if (!vr_device_id && !watch_device_id) {
            throw new Error('Either vr_device_id or watch_device_id must be provided');
        }

        // Validate that only one device type is being updated at a time
        if (vr_device_id && watch_device_id) {
            throw new Error('Only one device can be swapped at a time');
        }

        // Verify the target kit exists
        const kitQuery = `
            SELECT kit_id, vr_device_id, watch_device_id
            FROM kits
            WHERE kit_id = $1
        `;

        const kitResult = await pool.query(kitQuery, [kitId]);

        if (kitResult.rows.length === 0) {
            throw new Error('Kit not found');
        }

        const currentKit = kitResult.rows[0];

        // Determine which device is being updated
        const isVrUpdate = vr_device_id !== undefined;
        const newDeviceId = isVrUpdate ? vr_device_id : watch_device_id;
        const currentDeviceId = isVrUpdate ? currentKit.vr_device_id : currentKit.watch_device_id;
        const expectedDeviceType = isVrUpdate ? 'VR' : 'Watch';

        // Verify the new device exists
        const deviceQuery = `
            SELECT device_id, device_type, status
            FROM devices
            WHERE device_id = $1
        `;

        const deviceResult = await pool.query(deviceQuery, [newDeviceId]);

        if (deviceResult.rows.length === 0) {
            throw new Error('Device not found');
        }

        const newDevice = deviceResult.rows[0];

        // Verify the new device matches the expected type
        if (newDevice.device_type !== expectedDeviceType) {
            throw new Error(`Cannot swap a ${newDevice.device_type} device into a ${expectedDeviceType} slot`);
        }

        // CRITICAL: Ensure the new device is not currently assigned to another active kit
        const existingKitQuery = `
            SELECT kit_id
            FROM kits
            WHERE (vr_device_id = $1 OR watch_device_id = $1) AND kit_id != $2
        `;

        const existingKitResult = await pool.query(existingKitQuery, [newDeviceId, kitId]);

        if (existingKitResult.rows.length > 0) {
            throw new Error('The new device is already associated with another active kit');
        }

        // Update the kit with the new device
        const updateQuery = isVrUpdate
            ? `UPDATE kits SET vr_device_id = $1 WHERE kit_id = $2 RETURNING *`
            : `UPDATE kits SET watch_device_id = $1 WHERE kit_id = $2 RETURNING *`;

        const updateResult = await pool.query(updateQuery, [newDeviceId, kitId]);

        return updateResult.rows[0];
    }

    /**
     * Update the status of a single device
     * @param {string} deviceId - The device UUID
     * @param {string} status - New status: 'Active', 'Broken', or 'Maintenance'
     * @returns {Promise<Object>} Updated device record
     */
    async updateDeviceStatus(deviceId, status) {
        const validStatuses = ['Active', 'Broken', 'Maintenance'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const query = `
            UPDATE devices
            SET status = $1
            WHERE device_id = $2
            RETURNING device_id, device_type, status
        `;

        const result = await pool.query(query, [status, deviceId]);

        if (result.rows.length === 0) {
            throw new Error('Device not found');
        }

        return result.rows[0];
    }
}

// Create singleton instance
const inventoryService = new InventoryService();

module.exports = {
    createDevice: (deviceData) => inventoryService.createDevice(deviceData),
    createKit: (kitData) => inventoryService.createKit(kitData),
    getAllDevices: () => inventoryService.getAllDevices(),
    getAllKits: () => inventoryService.getAllKits(),
    getAvailableKits: () => inventoryService.getAvailableKits(),
    updateKit: (kitId, updateData) => inventoryService.updateKit(kitId, updateData),
    updateDeviceStatus: (deviceId, status) => inventoryService.updateDeviceStatus(deviceId, status)
};
