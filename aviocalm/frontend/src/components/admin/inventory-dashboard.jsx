import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, Smartphone, Wrench } from 'lucide-react';
import { StatusBadge } from '../status-badge';
import { DeviceStatusDropdown } from '../device-status-dropdown/device-status-dropdown';
import { KitCreatorModal } from '../kit-creator-modal';
import { DeviceRegistrationModal } from '../device-registration-modal';
import { EditKitModal } from '../edit-kit-modal';
import { api } from '../../utils/api';
import './inventory-dashboard.css';

/**
 * Inventory Dashboard component
 * Displays Registered Devices and Active Kits tables
 * Allows admin to manage hardware inventory
 */
export const InventoryDashboard = () => {
  const [devices, setDevices] = useState([]);
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState(null);

  // Fetch devices and kits on component mount
  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch devices
      const devicesResponse = await api.get('/v1/devices');
      
      // Fetch kits
      const kitsResponse = await api.get('/v1/kits');

      if (devicesResponse.success && devicesResponse.data) {
        setDevices(devicesResponse.data);
      } else {
        setError('Failed to fetch devices');
      }

      if (kitsResponse.success && kitsResponse.data) {
        setKits(kitsResponse.data);
      } else {
        setError('Failed to fetch kits');
      }
    } catch (err) {
      console.error('Error fetching inventory data:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKit = () => {
    setIsModalOpen(true);
  };

  const handleKitCreated = () => {
    // Refresh inventory data after kit creation
    fetchInventoryData();
  };

  const handleRegisterDevice = () => {
    setIsDeviceModalOpen(true);
  };

  const handleDeviceRegistered = () => {
    // Refresh inventory data after device registration
    fetchInventoryData();
  };

  const handleEditKit = (kit) => {
    setSelectedKit(kit);
    setIsEditModalOpen(true);
  };

  const handleKitUpdated = () => {
    // Refresh inventory data after kit update
    fetchInventoryData();
  };

  const handleRefresh = () => {
    fetchInventoryData();
  };

  /**
   * Update a device's status via PUT /api/v1/devices/:id/status
   * After saving, re-fetch all inventory so Active Kits reflects the change immediately
   */
  const handleDeviceStatusChange = async (deviceId, newStatus) => {
    try {
      // Optimistically update local devices state for instant UI feedback
      setDevices(prev =>
        prev.map(d => d.device_id === deviceId ? { ...d, status: newStatus } : d)
      );

      const response = await api.put(`/v1/devices/${deviceId}/status`, { status: newStatus });

      if (!response.success) {
        setError('Failed to update device status');
        fetchInventoryData(); // Revert by re-fetching
      } else {
        // Refresh kits so VR/Watch status columns reflect the new device status
        const kitsResponse = await api.get('/v1/kits');
        if (kitsResponse.success && kitsResponse.data) {
          setKits(kitsResponse.data);
        }
      }
    } catch (err) {
      console.error('Error updating device status:', err);
      setError('Network error. Please try again.');
      fetchInventoryData(); // Revert on error
    }
  };

  if (loading) {
    return (
      <div className="inventory-dashboard">
        <div className="loading-state">
          <RefreshCw className="loading-spinner" />
          <p>Loading inventory data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-dashboard">
      <div className="dashboard-header">
        <div className="header-title">
          <Package className="header-icon" />
          <h1>Hardware Inventory</h1>
        </div>
        <button className="btn btn-primary" onClick={handleCreateKit}>
          <Plus className="btn-icon" />
          Create Kit
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="dashboard-content">
        {/* Registered Devices Section */}
        <div className="section">
          <div className="section-header">
            <h2>Registered Devices</h2>
            <div className="section-header-actions">
              <button className="btn btn-secondary" onClick={handleRegisterDevice}>
                <Smartphone className="btn-icon" />
                Register Device
              </button>
              <button className="btn-icon-only" onClick={handleRefresh} title="Refresh">
                <RefreshCw className="icon-small" />
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device ID (SN)</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="no-data">
                      No devices registered
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.device_id}>
                      <td className="device-id">{device.device_id.slice(0, 8)}...</td>
                      <td>{device.device_type}</td>
                      <td>
                        <DeviceStatusDropdown
                          status={device.status}
                          onChange={(newStatus) => handleDeviceStatusChange(device.device_id, newStatus)}
                        />
                      </td>
                      <td>
                        {device.last_seen 
                          ? new Date(device.last_seen).toLocaleString()
                          : 'Never'
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Kits Section */}
        <div className="section">
          <div className="section-header">
            <h2>Active Kits</h2>
            <button className="btn-icon-only" onClick={handleRefresh} title="Refresh">
              <RefreshCw className="icon-small" />
            </button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kit ID</th>
                  <th>VR Device</th>
                  <th>VR Status</th>
                  <th>Watch Device</th>
                  <th>Watch Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {kits.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="no-data">
                      No kits created
                    </td>
                  </tr>
                ) : (
                  kits.map((kit) => (
                    <tr key={kit.kit_id}>
                      <td className="device-id">{kit.kit_id.slice(0, 8)}...</td>
                      <td>{kit.vr_device_id.slice(0, 8)}...</td>
                      <td>
                        <StatusBadge status={kit.vr_status} />
                      </td>
                      <td>{kit.watch_device_id.slice(0, 8)}...</td>
                      <td>
                        <StatusBadge status={kit.watch_status} />
                      </td>
                      <td>
                        <button
                          className="btn-icon-only"
                          onClick={() => handleEditKit(kit)}
                          title="Edit Kit"
                        >
                          <Wrench className="icon-small" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Kit Creator Modal */}
      <KitCreatorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleKitCreated}
      />

      {/* Device Registration Modal */}
      <DeviceRegistrationModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        onSuccess={handleDeviceRegistered}
      />

      {/* Edit Kit Modal */}
      <EditKitModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedKit(null);
        }}
        onSuccess={handleKitUpdated}
        kit={selectedKit}
      />
    </div>
  );
};

export default InventoryDashboard;
