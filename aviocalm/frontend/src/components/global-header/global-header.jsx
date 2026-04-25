import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import './global-header.css';

export const GlobalHeader = ({ isSidebarCollapsed }) => {
  const { user } = useAuth();

  // VR is still simulated for now because we are working only on the watch
  const [vrConnected, setVrConnected] = useState(true);

  // Real watch data from backend
  const [watchConnected, setWatchConnected] = useState(false);
  const [panicState, setPanicState] = useState(false);
  const [watchData, setWatchData] = useState(null);
  const [watchError, setWatchError] = useState(null);

  useEffect(() => {
    const fetchLatestWatchData = async () => {
      try {
        const response = await fetch('/api/watch/latest');

        if (!response.ok) {
          setWatchConnected(false);
          setWatchError('No watch data');
          setPanicState(false);
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          setWatchData(result.data);
          setWatchConnected(true);
          setWatchError(null);
          setPanicState(Boolean(result.data.distressAlert));
        } else {
          setWatchConnected(false);
          setWatchError('Invalid watch response');
          setPanicState(false);
        }
      } catch (error) {
        console.error('Failed to fetch latest watch data:', error);
        setWatchConnected(false);
        setWatchError('Watch API error');
        setPanicState(false);
      }
    };

    fetchLatestWatchData();

    const interval = setInterval(fetchLatestWatchData, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className={`global-header ${panicState ? 'global-header--panic' : ''} ${isSidebarCollapsed ? 'global-header--sidebar-collapsed' : ''}`}>
      <div className="global-header__content">
        {/* Left Section */}
        <div className="global-header__left">
          {watchData && (
            <div className="global-header__watch-vitals">
              <span>HR: {watchData.heartRate}</span>
              <span>SpO2: {watchData.spo2 ?? 'N/A'}</span>
              <span>Stress: {watchData.stressScore}</span>
            </div>
          )}
        </div>

        {/* Center Section - Distress Alert */}
        {panicState && (
          <div className="global-header__panic-alert">
            <div className="global-header__panic-content">
              <svg className="global-header__panic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5h6.938" />
              </svg>
              <span className="global-header__panic-text">
                DISTRESS ALERT{watchData?.alertReason ? `: ${watchData.alertReason}` : '!'}
              </span>
            </div>
          </div>
        )}

        {/* Right Section - Connectivity Status */}
        <div className="global-header__right">
          <div className="global-header__status">
            <div className={`global-header__device ${vrConnected ? 'global-header__device--connected' : 'global-header__device--disconnected'}`}>
              <svg className="global-header__device-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0116 8.618v6.764a1 1 0 01-1.447.894L10 14l-4.553 2.276A1 1 0 014 15.382V8.618a1 1 0 011.447-.894L10 6l4.553 2.276z" />
              </svg>
              <span className="global-header__device-label">VR</span>
            </div>

            <div
              className={`global-header__device ${watchConnected ? 'global-header__device--connected' : 'global-header__device--disconnected'}`}
              title={watchError || watchData?.recordedAt || ''}
            >
              <svg className="global-header__device-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="global-header__device-label">Watch</span>
            </div>
          </div>

          {/* User Info */}
          <div className="global-header__user">
            <div className="global-header__user-info">
              <span className="global-header__user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="global-header__user-role">
                {user?.role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};