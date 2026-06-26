import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { STATUS_CONFIG, getStatusEntry } from '../../utils/status-config';
import './device-status-dropdown.css';

/**
 * Custom status dropdown for device rows in the Hardware Inventory table.
 * Renders a pill-shaped trigger and a floating menu with color-coded option dots.
 * Uses STATUS_CONFIG as the single source of truth for labels and color classes.
 */
export const DeviceStatusDropdown = ({ status, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const current = getStatusEntry(status);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleSelect = (value) => {
    setIsOpen(false);
    if (value !== status) {
      onChange(value);
    }
  };

  return (
    <div className="dsd-container" ref={containerRef}>
      {/* Trigger pill */}
      <button
        className={`dsd-tag ${current.tagClass}`}
        onClick={() => setIsOpen(prev => !prev)}
        type="button"
      >
        <span className={`dsd-dot ${current.dotClass}`} />
        <span className="dsd-tag-text">{current.label}</span>
        <ChevronDown className={`dsd-chevron ${isOpen ? 'dsd-chevron--open' : ''}`} />
      </button>

      {/* Floating menu */}
      {isOpen && (
        <div className="dsd-menu">
          {STATUS_CONFIG.map(option => (
            <button
              key={option.value}
              type="button"
              className={`dsd-menu-item ${option.value === status ? 'dsd-menu-item--selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              <span className={`dsd-dot ${option.dotClass}`} />
              <span className="dsd-menu-item-text">{option.label}</span>
              {option.value === status && (
                <span className="dsd-menu-item-check">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeviceStatusDropdown;
