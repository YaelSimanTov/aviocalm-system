import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/auth-context';
import './global-header.css';

export const GlobalHeader = ({ isSidebarCollapsed }) => {
  const { user } = useAuth();

  // נהפוך את ה-VR לסטייט אמיתי שמושפע מהשרת
  const [vrConnected, setVrConnected] = useState(false);
  const [watchConnected, setWatchConnected] = useState(false);
  const [panicState, setPanicState] = useState(false);
  const [watchData, setWatchData] = useState(null);
  const [watchError, setWatchError] = useState(null);

  useEffect(() => {
    // חיבור ל-Socket.io
    const socket = io('http://localhost:5000');

    socket.on('connect', () => {
      console.log('Connected to AvioCalm Real-Time Server');
      setWatchError(null);
    });

    // האזנה לעדכוני סטטוס חיבור (מה ששלחנו בשרת ב-io.emit)
    socket.on('watch_status_change', (connected) => {
      setWatchConnected(connected);
    });

    socket.on('vr_status_change', (connected) => {
      setVrConnected(connected);
    });

    // הערוץ המרכזי שבו זורמים המדדים מהשעון וה-VR יחד
    socket.on('live_metrics', (data) => {
      console.log('Live metrics received:', data);
      
      // התאמת השדות למה שהקומפוננטה מצפה (נרמול)
      const normalizedData = {
        heartRate: data.hr,
        spo2: data.spo2,
        stressScore: data.stressScore,
        vrState: data.vrState,
        recordedAt: data.timestamp
      };

      setWatchData(normalizedData);
      setWatchConnected(true);
    });

    // האזנה להתראות מצוקה (Distress Alert)
    socket.on('distress_alert', (alert) => {
      // alert מגיע כאובייקט: { active: true/false, reason: "..." }
      setPanicState(alert.active);
      if (alert.active && alert.reason) {
        setWatchData(prev => ({ ...prev, alertReason: alert.reason }));
      }
    });

    socket.on('disconnect', () => {
      setWatchConnected(false);
      setVrConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <header className={`global-header ${panicState ? 'global-header--panic' : ''} ${isSidebarCollapsed ? 'global-header--sidebar-collapsed' : ''}`}>
      <div className="global-header__content">
        
        {/* Left Section - המדדים בזמן אמת */}
        <div className="global-header__left">
          {watchData && (
            <div className="global-header__watch-vitals">
              <span>HR: {watchData.heartRate}</span>
              <span>SpO2: {watchData.spo2 ?? 'N/A'}%</span>
              <span>Stress: {watchData.stressScore}</span>
              <span className="global-header__vr-context">Scene: {watchData.vrState}</span>
            </div>
          )}
        </div>

        {/* Center Section - התראת מצוקה בולטת */}
        {panicState && (
          <div className="global-header__panic-alert">
            <div className="global-header__panic-content">
              <svg className="global-header__panic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5h6.938" />
              </svg>
              <span className="global-header__panic-text">
                DISTRESS DETECTED {watchData?.alertReason ? `(${watchData.alertReason})` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Right Section - נוריות סטטוס */}
        <div className="global-header__right">
          <div className="global-header__status">
            {/* סטטוס VR */}
            <div className={`global-header__device ${vrConnected ? 'global-header__device--connected' : 'global-header__device--disconnected'}`}>
              <svg className="global-header__device-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0116 8.618v6.764a1 1 0 01-1.447.894L10 14l-4.553 2.276A1 1 0 014 15.382V8.618a1 1 0 011.447-.894L10 6l4.553 2.276z" />
              </svg>
              <span className="global-header__device-label">VR</span>
            </div>

            {/* סטטוס שעון */}
            <div className={`global-header__device ${watchConnected ? 'global-header__device--connected' : 'global-header__device--disconnected'}`}>
              <svg className="global-header__device-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="global-header__device-label">Watch</span>
            </div>
          </div>

          <div className="global-header__user">
            <div className="global-header__user-info">
              <span className="global-header__user-name">{user?.firstName} {user?.lastName}</span>
              <span className="global-header__user-role">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};