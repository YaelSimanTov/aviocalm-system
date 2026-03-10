import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/sidebar/sidebar';
import { GlobalHeader } from '../components/global-header/global-header';
import './authenticated-layout.css';

export const AuthenticatedLayout = () => {
  return (
    <div className="authenticated-layout">
      {/* Left Side - Sidebar */}
      <Sidebar />
      
      {/* Right Side - Header and Content */}
      <div className="authenticated-layout__right">
        {/* Top - Global Header */}
        <GlobalHeader />
        
        {/* Bottom - Dynamic Page Content */}
        <main className="authenticated-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
