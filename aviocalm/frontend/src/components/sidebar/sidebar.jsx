import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { 
  Menu, 
  X, 
  Users, 
  UserPlus, 
  Shield, 
  Settings, 
  LogOut,
  ChevronRight,
  ChevronDown,
  Package
} from 'lucide-react';
import './sidebar.css';

export const Sidebar = ({ onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const handleLogout = () => {
    logout();
  };

  const handleToggleCollapse = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    // Notify parent component about the collapse state
    onToggleCollapse(!newExpandedState);
  };

  return (
    <div className={`sidebar ${isExpanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}>
      <div className="sidebar__header">
        <button 
          className="sidebar__toggle"
          onClick={handleToggleCollapse}
        >
          {isExpanded ? <X className="sidebar__toggle-icon" /> : <Menu className="sidebar__toggle-icon" />}
        </button>
      </div>

      <nav className="sidebar__nav">
        {/* Clinical Group */}
        <div className="sidebar__group">
          <button 
            className="sidebar__group-header"
            onClick={() => toggleGroup('clinical')}
          >
            <Users className="sidebar__group-icon" />
            <span className="sidebar__group-text">Clinical</span>
            {expandedGroups.clinical ? 
              <ChevronDown className="sidebar__group-chevron" /> : 
              <ChevronRight className="sidebar__group-chevron" />
            }
          </button>
          {expandedGroups.clinical && (
            <div className="sidebar__group-items">
              <Link 
                to="/patients" 
                className="sidebar__item"
              >
                <div className="sidebar__item-content">
                  <Users className="sidebar__item-icon" />
                  <span className="sidebar__text">Patient List</span>
                </div>
              </Link>
              <Link 
                to="/patients/add" 
                className="sidebar__item"
              >
                <div className="sidebar__item-content">
                  <UserPlus className="sidebar__item-icon" />
                  <span className="sidebar__text">Add Patient</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Admin Group - Owner Only */}
        {user?.role === 'Owner' && (
          <div className="sidebar__group">
            <button 
              className="sidebar__group-header"
              onClick={() => toggleGroup('admin')}
            >
              <Shield className="sidebar__group-icon" />
              <span className="sidebar__group-text">Admin</span>
              {expandedGroups.admin ? 
                <ChevronDown className="sidebar__group-chevron" /> : 
                <ChevronRight className="sidebar__group-chevron" />
              }
            </button>
            {expandedGroups.admin && (
              <div className="sidebar__group-items">
                <Link 
                  to="/admin/team-management" 
                  className="sidebar__item"
                >
                  <div className="sidebar__item-content">
                    <Users className="sidebar__item-icon" />
                    <span className="sidebar__text">Team Management</span>
                  </div>
                </Link>
                <Link 
                  to="/admin/hardware-inventory" 
                  className="sidebar__item"
                >
                  <div className="sidebar__item-content">
                    <Package className="sidebar__item-icon" />
                    <span className="sidebar__text">Hardware Inventory</span>
                  </div>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Settings Group */}
        <div className="sidebar__group">
          <button 
            className="sidebar__group-header"
            onClick={() => toggleGroup('settings')}
          >
            <Settings className="sidebar__group-icon" />
            <span className="sidebar__group-text">Settings</span>
            {expandedGroups.settings ? 
              <ChevronDown className="sidebar__group-chevron" /> : 
              <ChevronRight className="sidebar__group-chevron" />
            }
          </button>
          {expandedGroups.settings && (
            <div className="sidebar__group-items">
              <Link 
                to="/change-password" 
                className="sidebar__item"
              >
                <div className="sidebar__item-content">
                  <Settings className="sidebar__item-icon" />
                  <span className="sidebar__text">Change Password</span>
                </div>
              </Link>
              <button 
                onClick={handleLogout}
                className="sidebar__item sidebar__item--logout"
              >
                <div className="sidebar__item-content">
                  <LogOut className="sidebar__item-icon" />
                  <span className="sidebar__text">Logout</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};
