import React, { useState } from 'react';
import { X, Smartphone, Headset } from 'lucide-react';
import { api } from '../../utils/api';
import './device-registration-modal.css';

/**
 * Device Registration Modal component
 * Allows admin to register a new standalone device (VR or Watch)
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to close the modal
 * @param {function} onSuccess - Function to call after successful device registration
 */
export const DeviceRegistrationModal = ({ isOpen, onClose, onSuccess }) => {
  const [deviceId, setDeviceId] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!deviceId) {
      setError('Please enter a device ID');
      return;
    }

    if (!deviceType) {
      setError('Please select a device type');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.post('/v1/devices', {
        device_id: deviceId,
        device_type: deviceType
      });

      if (response.success) {
        // Reset form and close modal
        setDeviceId('');
        setDeviceType('');
        onClose();
        // Call success callback to refresh parent component
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(response.error || 'Failed to register device');
      }
    } catch (err) {
      console.error('Error registering device:', err);
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
            <Smartphone className="modal-icon" />
            <h2>Register New Device</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X className="modal-close-icon" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="device-id">Device ID (Serial Number)</label>
            <input
              id="device-id"
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              disabled={loading}
              required
              placeholder="e.g., QUEST3-001"
            />
          </div>

          <div className="form-group">
            <label htmlFor="device-type">Device Type</label>
            <select
              id="device-type"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Select Device Type</option>
              <option value="VR">VR Headset</option>
              <option value="Watch">Smartwatch</option>
            </select>
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
              {loading ? 'Registering...' : 'Register Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceRegistrationModal;
