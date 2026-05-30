// import React, { useState, useEffect } from 'react';
// import { useAuth } from '../../context/auth-context';
// import './global-header.css';

// export const GlobalHeader = ({ isSidebarCollapsed }) => {
//   const { user } = useAuth();
//   const [vrConnected, setVrConnected] = useState(true);
//   const [watchConnected, setWatchConnected] = useState(true);
//   const [panicState, setPanicState] = useState(false);

//   // Simulate connectivity status (in real app, this would come from WebSocket/MQTT)
//   useEffect(() => {
//     const connectInterval = setInterval(() => {
//       // Simulate random connectivity changes
//       setVrConnected(Math.random() > 0.1);
//       setWatchConnected(Math.random() > 0.05);
//     }, 5000);

//     // Simulate panic state detection
//     const panicInterval = setInterval(() => {
//       setPanicState(Math.random() > 0.95);
//     }, 10000);

//     return () => {
//       clearInterval(connectInterval);
//       clearInterval(panicInterval);
//     };
//   }, []);

//   return (
//     <header className={`global-header ${panicState ? 'global-header--panic' : ''} ${isSidebarCollapsed ? 'global-header--sidebar-collapsed' : ''}`}>
//       <div className="global-header__content">
//         {/* Left Section - Empty (search moved to Patient List) */}
//         <div className="global-header__left">
//           {/* Reserved for future use */}
//         </div>

//         {/* Center Section - Panic Alert */}
//         {panicState && (
//           <div className="global-header__panic-alert">
//             <div className="global-header__panic-content">
//               <svg className="global-header__panic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5h6.938" />
//               </svg>
//               <span className="global-header__panic-text">DISTRESS ALERT!</span>
//             </div>
//           </div>
//         )}

//         {/* Right Section - Connectivity Status */}
//         <div className="global-header__right">
//           <div className="global-header__status">
//             <div className={`global-header__device ${vrConnected ? 'global-header__device--connected' : 'global-header__device--disconnected'}`}>
//               <svg className="global-header__device-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0116 8.618v6.764a1 1 0 01-1.447.894L10 14l-4.553 2.276A1 1 0 014 15.382V8.618a1 1 0 011.447-.894L10 6l4.553 2.276z" />
//               </svg>
//               <span className="global-header__device-label">VR</span>
//             </div>
            
//             <div className={`global-header__device ${watchConnected ? 'global-header__device--connected' : 'global-header__device--disconnected'}`}>
//               <svg className="global-header__device-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
//               </svg>
//               <span className="global-header__device-label">Watch</span>
//             </div>
//           </div>

//           {/* User Info */}
//           <div className="global-header__user">
//             <div className="global-header__user-info">
//               <span className="global-header__user-name">
//                 {user?.firstName} {user?.lastName}
//               </span>
//               <span className="global-header__user-role">
//                 {user?.role}
//               </span>
//             </div>
//           </div>
//         </div>
//       </div>
//     </header>
//   );
// };


import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { io } from 'socket.io-client';
import { NotificationCenter } from '../notification-center/NotificationCenter';
import './global-header.css';

// Define the connection outside the component to prevent duplicate connections on re-renders
const socket = io('http://localhost:5000', {
  autoConnect: false // We will connect manually inside the useEffect
});

export const GlobalHeader = ({ isSidebarCollapsed }) => {
  const { user } = useAuth();
  
  // Start disconnected by default until the server confirms connection
  const [vrConnected, setVrConnected] = useState(false);
  const [watchConnected, setWatchConnected] = useState(false);
  const [panicState, setPanicState] = useState(false);
  const [warningState, setWarningState] = useState(false);
  const [emergencyState, setEmergencyState] = useState(false);
  const [showManualStop, setShowManualStop] = useState(false);

  useEffect(() => {
    // Open connection to the Node.js server
    socket.connect();

    // 1. Listen for VR headset connection status
    socket.on('vr_status_change', (isConnected) => {
      setVrConnected(isConnected);
    });

    // 2. Listen for Samsung Watch connection status
    socket.on('watch_status_change', (isConnected) => {
      setWatchConnected(isConnected);
    });

    // 3. Listen for real-time distress alerts (e.g., high HR + stressful scene)
    socket.on('distress_alert', (isPanic) => {
      setPanicState(isPanic);
    });

    // 4. Listen for live metrics with safety alerts
    socket.on('live_metrics', (data) => {
      setWarningState(data.isWarning);
      setEmergencyState(data.isEmergency);
      setShowManualStop(data.isEmergency);
    });

    // 5. Listen for emergency stop events
    socket.on('EMERGENCY_STOP', (data) => {
      setEmergencyState(true);
      setShowManualStop(true);
      console.log('[GLOBAL HEADER] Emergency stop triggered:', data);
    });

    // 6. Listen for TERMINATE events from Safety Engine
    socket.on('TERMINATE', (data) => {
      setPanicState(true);
      setEmergencyState(true);
      setShowManualStop(true);
      console.log('[GLOBAL HEADER] TERMINATE event received:', data);
    });

    // Cleanup listeners and disconnect on component unmount
    return () => {
      socket.off('vr_status_change');
      socket.off('watch_status_change');
      socket.off('distress_alert');
      socket.off('live_metrics');
      socket.off('EMERGENCY_STOP');
      socket.off('TERMINATE');
      socket.disconnect();
    };
  }, []);

  const handleManualStop = () => {
    socket.emit('TERMINATE', {
      reason: 'Manual Therapist Override',
      channel: 'manual',
      timestamp: new Date().toISOString(),
      vitals: {
        heartRate: 0, // Will be populated by backend
        stressScore: 0,
        spo2: 0
      }
    });
  };

  return (
    <header className={`global-header ${panicState ? 'global-header--panic' : ''} ${isSidebarCollapsed ? 'global-header--sidebar-collapsed' : ''}`}>
      <div className="global-header__content">
        {/* Left Section - Empty (search moved to Patient List) */}
        <div className="global-header__left">
          {/* Reserved for future use */}
        </div>

        {/* Center Section - Alert Banners */}
        <div className="global-header__alerts">
          {/* Emergency Alert Banner */}
          {emergencyState && (
            <div className="bg-red-600 border-2 border-red-800 text-white px-4 py-2 rounded-lg animate-pulse flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-bold whitespace-nowrap">EMERGENCY ALERT: System Auto-Stop Initiated</span>
            </div>
          )}

          {/* Warning Alert Banner */}
          {warningState && !emergencyState && (
            <div className="bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-4 py-2 rounded-lg flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-bold whitespace-nowrap">Warning: Abnormal Stress Trend Detected</span>
            </div>
          )}

          {/* Panic Alert */}
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
        </div>

        {/* Right Section - Connectivity Status and Controls */}
        <div className="global-header__right">
          {/* Prominent Stop Simulation Button */}
          <button
            onClick={handleManualStop}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 mr-4 whitespace-nowrap border-2 border-red-800 animate-pulse"
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop Simulation
            </div>
          </button>

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

          {/* Notification Bell */}
          <NotificationCenter />

          {/* User Info */}
          <div className="global-header__user">
            <div className="global-header__user-info">
              <span className="global-header__user-name whitespace-nowrap">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="global-header__user-role whitespace-nowrap">
                {user?.role}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};