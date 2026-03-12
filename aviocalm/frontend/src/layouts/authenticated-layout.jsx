import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/sidebar/sidebar';
import { GlobalHeader } from '../components/global-header/global-header';
import './authenticated-layout.css';

export const AuthenticatedLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className={`authenticated-layout ${isSidebarCollapsed ? 'authenticated-layout--sidebar-collapsed' : ''}`}>
      {/* Left Side - Sidebar */}
      <Sidebar onToggleCollapse={setIsSidebarCollapsed} />
      
      {/* Right Side - Header and Content */}
      <div className="authenticated-layout__right">
        {/* Top - Global Header */}
        <GlobalHeader isSidebarCollapsed={isSidebarCollapsed} />
        
        {/* Bottom - Dynamic Page Content */}
        <main className="authenticated-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
