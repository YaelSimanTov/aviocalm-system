import React, { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { api } from '../../utils/api';
import './kit-creator-modal.css';

/**
 * Kit Creator Modal component
 * Allows admin to combine available VR and Watch devices into a new kit
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to close the modal
 * @param {function} onSuccess - Function to call after successful kit creation
 */
export const KitCreatorModal = ({ isOpen, onClose, onSuccess }) => {
  const [vrDevices, setVrDevices] = useState([]);
  const [watchDevices, setWatchDevices] = useState([]);
  const [selectedVrDevice, setSelectedVrDevice] = useState('');
  const [selectedWatchDevice, setSelectedWatchDevice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available devices when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableDevices();
    }
  }, [isOpen]);

  const fetchAvailableDevices = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all devices
      const devicesResponse = await api.get('/v1/devices');
      
      if (devicesResponse.success && devicesResponse.data) {
        // Filter devices that are Active and not in any kit
        const allDevices = devicesResponse.data;
        
        // Fetch all kits to check which devices are already assigned
        const kitsResponse = await api.get('/v1/kits');
        
        let assignedDeviceIds = [];
        if (kitsResponse.success && kitsResponse.data) {
          assignedDeviceIds = kitsResponse.data.flatMap(kit => [
            kit.vr_device_id,
            kit.watch_device_id
          ]);
        }

        // Filter available devices (Active and not assigned to any kit)
        const availableVrDevices = allDevices.filter(
          device => device.device_type === 'VR' && 
                   device.status === 'Active' && 
                   !assignedDeviceIds.includes(device.device_id)
        );

        const availableWatchDevices = allDevices.filter(
          device => device.device_type === 'Watch' && 
                   device.status === 'Active' && 
                   !assignedDeviceIds.includes(device.device_id)
        );

        setVrDevices(availableVrDevices);
        setWatchDevices(availableWatchDevices);
      } else {
        setError('Failed to fetch devices');
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedVrDevice || !selectedWatchDevice) {
      setError('Please select both a VR device and a Watch device');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.post('/v1/kits', {
        vr_device_id: selectedVrDevice,
        watch_device_id: selectedWatchDevice
      });

      if (response.success) {
        // Reset form and close modal
        setSelectedVrDevice('');
        setSelectedWatchDevice('');
        onClose();
        // Call success callback to refresh parent component
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(response.error || 'Failed to create kit');
      }
    } catch (err) {
      console.error('Error creating kit:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <Package className="modal-icon" />
            <h2>Create New Kit</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X className="modal-close-icon" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="vr-device">VR Headset</label>
            <select
              id="vr-device"
              value={selectedVrDevice}
              onChange={(e) => setSelectedVrDevice(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Select VR Headset</option>
              {vrDevices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  VR Device - {device.device_id.slice(0, 8)}
                </option>
              ))}
            </select>
            {vrDevices.length === 0 && !loading && (
              <p className="form-hint">No available VR headsets</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="watch-device">Smartwatch</label>
            <select
              id="watch-device"
              value={selectedWatchDevice}
              onChange={(e) => setSelectedWatchDevice(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Select Smartwatch</option>
              {watchDevices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  Watch Device - {device.device_id.slice(0, 8)}
                </option>
              ))}
            </select>
            {watchDevices.length === 0 && !loading && (
              <p className="form-hint">No available smartwatches</p>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Kit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default KitCreatorModal;
