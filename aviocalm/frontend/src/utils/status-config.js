/**
 * Single source of truth for device status configuration.
 * Used by StatusBadge, DeviceStatusDropdown, and any future status-related UI.
 *
 * value      - exact string stored in the database (matches DB CHECK constraint)
 * label      - uppercase display text shown in all UI components
 * dotClass   - CSS modifier for color-coded dot in DeviceStatusDropdown
 * badgeClass - CSS modifier for StatusBadge pill
 * tagClass   - CSS modifier for DeviceStatusDropdown trigger pill
 */
export const STATUS_CONFIG = [
  {
    value:      'Active',
    label:      'ACTIVE',
    dotClass:   'dsd-dot--active',
    badgeClass: 'status-badge--active',
    tagClass:   'dsd-tag--active',
  },
  {
    value:      'Broken',
    label:      'BROKEN',
    dotClass:   'dsd-dot--broken',
    badgeClass: 'status-badge--broken',
    tagClass:   'dsd-tag--broken',
  },
  {
    value:      'Maintenance',
    label:      'MAINTENANCE',
    dotClass:   'dsd-dot--maintenance',
    badgeClass: 'status-badge--maintenance',
    tagClass:   'dsd-tag--maintenance',
  },
];

/**
 * Look up a status entry by its DB value.
 * Returns the last entry (Maintenance) as a safe fallback.
 */
export const getStatusEntry = (value) =>
  STATUS_CONFIG.find(s => s.value === value) ?? STATUS_CONFIG[STATUS_CONFIG.length - 1];
