import React from 'react';
import { getStatusEntry } from '../../utils/status-config';
import './status-badge.css';

/**
 * Status Badge component for displaying device status with color coding.
 * Uses STATUS_CONFIG as the single source of truth for labels and color classes.
 * @param {string} status - DB value ('Active', 'Broken', 'Maintenance')
 */
export const StatusBadge = ({ status }) => {
  const entry = getStatusEntry(status);

  return (
    <span className={`status-badge ${entry.badgeClass}`}>
      {entry.label}
    </span>
  );
};

export default StatusBadge;
