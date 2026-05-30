import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Clock, AlertTriangle, Activity, ChevronRight } from 'lucide-react';
import { api } from '../../utils/api';

// How often to poll for new alerts (ms)
const POLL_INTERVAL_MS = 30_000;

// Visual config per alert_type — severity-based palette (must match SessionDetails.jsx).
// Safety:      Red  — Critical / absolute danger
// Panic:       Teal — High / sustained anxiety; teal avoids blending with the blue/purple chart lines
// Statistical: Amber — Warning / relative anomaly
const ALERT_TYPE_CONFIG = {
  Safety: {
    badgeClass:  'bg-red-100 text-red-700 border-red-200',
    dotClass:    'bg-red-500',
    stripeClass: 'bg-red-500',
  },
  Panic: {
    badgeClass:  'bg-teal-100 text-teal-700 border-teal-200',
    dotClass:    'bg-teal-500',
    stripeClass: 'bg-teal-500',
  },
  Statistical: {
    badgeClass:  'bg-amber-100 text-amber-700 border-amber-200',
    dotClass:    'bg-amber-500',
    stripeClass: 'bg-amber-500',
  },
};

// Fallback config for unknown alert types
const DEFAULT_ALERT_CONFIG = {
  badgeClass:  'bg-gray-100 text-gray-700 border-gray-200',
  dotClass:    'bg-gray-400',
  stripeClass: 'bg-gray-400',
};

// Converts raw seconds into a human-readable string (e.g. "1m 30s")
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

// Formats an ISO timestamp string to the local timezone
function formatTimestamp(isoString) {
  if (!isoString) return '';
  const utcString = isoString.endsWith('Z') ? isoString : `${isoString}Z`;
  return new Date(utcString).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

// ─────────────────────────────────────────────────────────────────────────────
// AlertDetailModal
// Displayed when the therapist clicks an alert row in the dropdown.
// ─────────────────────────────────────────────────────────────────────────────
function AlertDetailModal({ alert, onClose, onReviewSession }) {
  const cfg = ALERT_TYPE_CONFIG[alert.alert_type] ?? DEFAULT_ALERT_CONFIG;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Colored top stripe (type indicator) */}
        <div className={`h-1.5 w-full ${cfg.stripeClass}`} />

        <div className="p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>

          {/* Alert type badge */}
          <div className="mb-5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.badgeClass}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {alert.alert_type} Alert
            </span>
          </div>

          {/* Patient */}
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">
            Patient
          </p>
          <p className="text-sm font-semibold text-gray-800 mb-4">
            {alert.patient_name}
            <span className="font-normal text-gray-400 ml-2">
              #{alert.patient_national_id}
            </span>
          </p>

          {/* What happened */}
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">
            What happened
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-5">
            {alert.description}
          </p>

          {/* Duration callout */}
          <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Clock className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Duration of danger state</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight">
                {formatDuration(alert.duration_seconds)}
              </p>
            </div>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-400 mb-6">
            Breach started at: {formatTimestamp(alert.timestamp)}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onReviewSession(alert.patient_id, alert.session_id)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
            >
              <Activity className="w-4 h-4" />
              Review Session Graph
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationCenter
// Bell icon + unread badge + dropdown list + alert detail modal.
// ─────────────────────────────────────────────────────────────────────────────
export function NotificationCenter() {
  const navigate = useNavigate();
  const [alerts, setAlerts]               = useState([]);
  const [isOpen, setIsOpen]               = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const dropdownRef = useRef(null);

  // Fetch unread alerts from the backend
  const fetchAlerts = useCallback(async () => {
    const res = await api.getUnreadAlerts();
    if (res.success && Array.isArray(res.data)) {
      setAlerts(res.data);
    }
  }, []);

  // Initial load + polling every POLL_INTERVAL_MS
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Close the dropdown when the user clicks outside the panel
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Clicking an alert row: optimistically remove from list, show modal, fire PATCH
  const handleAlertClick = useCallback(async (alert) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    setIsOpen(false);
    setSelectedAlert(alert);
    await api.markAlertRead(alert.id);
  }, []);

  const unreadCount = alerts.length;

  return (
    <>
      {/* Bell button with badge */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative p-2 rounded-full hover:bg-white/20 transition-colors"
          aria-label={`Notifications — ${unreadCount} unread`}
        >
          <Bell className="w-5 h-5 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm border border-white/30">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
            {/* Dropdown header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs text-gray-400">{unreadCount} unread</span>
              )}
            </div>

            {/* Alert list */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <Bell className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No unread notifications</p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const cfg = ALERT_TYPE_CONFIG[alert.alert_type] ?? DEFAULT_ALERT_CONFIG;
                  return (
                    <button
                      key={alert.id}
                      onClick={() => handleAlertClick(alert)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Colored dot */}
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dotClass}`} />

                        <div className="flex-1 min-w-0">
                          {/* Type badge + patient name */}
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badgeClass}`}>
                              {alert.alert_type}
                            </span>
                            <span className="text-xs text-gray-500 truncate font-medium">
                              {alert.patient_name}
                            </span>
                          </div>

                          {/* Description preview */}
                          <p className="text-xs text-gray-500 truncate leading-snug">
                            {alert.description}
                          </p>

                          {/* Timestamp + duration */}
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimestamp(alert.created_at)}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span>{formatDuration(alert.duration_seconds)}</span>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Alert detail modal — rendered outside the dropdown so it's not clipped */}
      {selectedAlert !== null && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onReviewSession={(patientId, sessionId) => {
            setSelectedAlert(null);
            navigate(`/patients/${patientId}/sessions/${sessionId}`);
          }}
        />
      )}
    </>
  );
}
