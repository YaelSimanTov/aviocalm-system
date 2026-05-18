import React, { useState, useEffect } from 'react';
import { X, Wrench } from 'lucide-react';
import { api } from '../../utils/api';
import './edit-kit-modal.css';

/**
 * Edit Kit Modal component
 * Allows admin to swap a single device (VR or Watch) in an existing kit
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to close the modal
 * @param {function} onSuccess - Function to call after successful kit update
 * @param {Object} kit - The kit object being edited (with vr_device_id and watch_device_id)
 */
export const EditKitModal = ({ isOpen, onClose, onSuccess, kit }) => {
  const [vrDevices, setVrDevices] = useState([]);
  const [watchDevices, setWatchDevices] = useState([]);
  const [selectedVrDevice, setSelectedVrDevice] = useState('');
  const [selectedWatchDevice, setSelectedWatchDevice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available devices when modal opens or kit changes
  useEffect(() => {
    if (isOpen && kit) {
      fetchAvailableDevices();
      // Set current devices as default selections
      setSelectedVrDevice(kit.vr_device_id);
      setSelectedWatchDevice(kit.watch_device_id);
    }
  }, [isOpen, kit]);

  const fetchAvailableDevices = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all devices
      const devicesResponse = await api.get('/v1/devices');
      
      if (devicesResponse.success && devicesResponse.data) {
        // Fetch all kits to check which devices are already assigned
        const kitsResponse = await api.get('/v1/kits');
        
        let assignedDeviceIds = [];
        if (kitsResponse.success && kitsResponse.data) {
          assignedDeviceIds = kitsResponse.data
            .filter(k => k.kit_id !== kit.kit_id) // Exclude current kit's devices
            .flatMap(k => [k.vr_device_id, k.watch_device_id]);
        }

        // Get all devices by type
        const allDevices = devicesResponse.data;
        
        // Filter VR devices (Active and not assigned to other kits, or currently assigned to this kit)
        const availableVrDevices = allDevices.filter(
          device => device.device_type === 'VR' && 
                   device.status === 'Active' && 
                   (!assignedDeviceIds.includes(device.device_id) || device.device_id === kit.vr_device_id)
        );

        // Filter Watch devices (Active and not assigned to other kits, or currently assigned to this kit)
        const availableWatchDevices = allDevices.filter(
          device => device.device_type === 'Watch' && 
                   device.status === 'Active' && 
                   (!assignedDeviceIds.includes(device.device_id) || device.device_id === kit.watch_device_id)
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

    // Check if any device was changed
    const vrChanged = selectedVrDevice !== kit.vr_device_id;
    const watchChanged = selectedWatchDevice !== kit.watch_device_id;

    if (!vrChanged && !watchChanged) {
      setError('No changes detected. Please select a different device to swap.');
      return;
    }

    // Only allow one device change at a time
    if (vrChanged && watchChanged) {
      setError('Only one device can be swapped at a time.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = vrChanged 
        ? { vr_device_id: selectedVrDevice }
        : { watch_device_id: selectedWatchDevice };

      const response = await api.patch(`/v1/kits/${kit.kit_id}`, payload);

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
        setError(response.error || 'Failed to update kit');
      }
    } catch (err) {
      console.error('Error updating kit:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !kit) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">
            <Wrench className="modal-icon" />
            <h2>Edit Kit</h2>
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
            >
              {vrDevices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  {device.device_id} {device.device_id === kit.vr_device_id ? '(Current)' : ''}
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
            >
              {watchDevices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  {device.device_id} {device.device_id === kit.watch_device_id ? '(Current)' : ''}
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
              {loading ? 'Updating...' : 'Update Kit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditKitModal;
