import React from 'react';
import './status-badge.css';

/**
 * Status Badge component for displaying device status with color coding
 * @param {string} status - The status to display ('Active', 'Broken', 'Maintenance')
 */
export const StatusBadge = ({ status }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'status-badge--active';
      case 'Broken':
        return 'status-badge--broken';
      case 'Maintenance':
        return 'status-badge--maintenance';
      default:
        return 'status-badge--unknown';
    }
  };

  return (
    <span className={`status-badge ${getStatusColor(status)}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
