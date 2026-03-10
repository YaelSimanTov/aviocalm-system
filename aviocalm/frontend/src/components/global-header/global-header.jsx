import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import './global-header.css';

export const GlobalHeader = () => {
  const { user } = useAuth();
  const [vrConnected, setVrConnected] = useState(true);
  const [watchConnected, setWatchConnected] = useState(true);
  const [panicState, setPanicState] = useState(false);

  // Simulate connectivity status (in real app, this would come from WebSocket/MQTT)
  useEffect(() => {
    const connectInterval = setInterval(() => {
      // Simulate random connectivity changes
      setVrConnected(Math.random() > 0.1);
      setWatchConnected(Math.random() > 0.05);
    }, 5000);

    // Simulate panic state detection
    const panicInterval = setInterval(() => {
      setPanicState(Math.random() > 0.95);
    }, 10000);

    return () => {
      clearInterval(connectInterval);
      clearInterval(panicInterval);
    };
  }, []);

  return (
    <header className={`global-header ${panicState ? 'global-header--panic' : ''}`}>
      <div className="global-header__content">
        {/* Left Section - Empty (search moved to Patient List) */}
        <div className="global-header__left">
          {/* Reserved for future use */}
        </div>

        {/* Center Section - Panic Alert */}
        {panicState && (
          <div className="global-header__panic-alert">
            <div className="global-header__panic-content">
              <svg className="global-header__panic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5h6.938" />
              </svg>
              <span className="global-header__panic-text">DISTRESS ALERT!</span>
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
            
            <div className={`global-header__device ${watchConnected ? 'global-header__device--connected' : 'global-header__device--disconnected'}`}>
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
