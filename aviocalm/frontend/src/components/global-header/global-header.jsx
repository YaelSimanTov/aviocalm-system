import React from 'react';
import { useAuth } from '../../context/auth-context';
import { NotificationCenter } from '../notification-center/notification-center';
import './global-header.css';

export const GlobalHeader = ({ isSidebarCollapsed }) => {
  const { user } = useAuth();

  return (
    <header className={`global-header ${isSidebarCollapsed ? 'global-header--sidebar-collapsed' : ''}`}>
      <div className="global-header__content">
        {/* Left Section - Empty (search moved to Patient List) */}
        <div className="global-header__left">
          {/* Reserved for future use */}
        </div>

        {/* Center Section - Empty (alert banners removed for in-clinic use) */}
        <div className="global-header__alerts">
          {/* Reserved for future use */}
        </div>

        {/* Right Section - Minimalist navigation elements only */}
        <div className="global-header__right">
          {/* Notification Bell -- visible only for Therapist accounts */}
          {user?.role === 'Therapist' && <NotificationCenter />}

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