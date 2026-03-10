import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { 
  Menu, 
  X, 
  Users, 
  UserPlus, 
  Activity, 
  Brain, 
  BarChart3, 
  Network, 
  Calendar, 
  Shield, 
  Settings, 
  LogOut,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import './sidebar.css';

export const Sidebar = () => {
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

  return (
    <div className={`sidebar ${isExpanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}>
      <div className="sidebar__header">
        <button 
          className="sidebar__toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <X className="sidebar__toggle-icon" /> : <Menu className="sidebar__toggle-icon" />}
        </button>
        <div className="sidebar__logo">
          <span className="sidebar__logo-text">AC</span>
        </div>
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

        {/* Live Session Group */}
        <div className="sidebar__group">
          <button 
            className="sidebar__group-header"
            onClick={() => toggleGroup('liveSession')}
          >
            <Activity className="sidebar__group-icon" />
            <span className="sidebar__group-text">Live Session</span>
            {expandedGroups.liveSession ? 
              <ChevronDown className="sidebar__group-chevron" /> : 
              <ChevronRight className="sidebar__group-chevron" />
            }
          </button>
          {expandedGroups.liveSession && (
            <div className="sidebar__group-items">
              <Link 
                to="/live-monitor" 
                className="sidebar__item"
              >
                <div className="sidebar__item-content">
                  <Activity className="sidebar__item-icon" />
                  <span className="sidebar__text">Active Monitor</span>
                </div>
              </Link>
              <Link 
                to="/ai-insights" 
                className="sidebar__item"
              >
                <div className="sidebar__item-content">
                  <Brain className="sidebar__item-icon" />
                  <span className="sidebar__text">AI Insights</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Analytics Group */}
        <div className="sidebar__group">
          <button 
            className="sidebar__group-header"
            onClick={() => toggleGroup('analytics')}
          >
            <BarChart3 className="sidebar__group-icon" />
            <span className="sidebar__group-text">Analytics</span>
            {expandedGroups.analytics ? 
              <ChevronDown className="sidebar__group-chevron" /> : 
              <ChevronRight className="sidebar__group-chevron" />
            }
          </button>
          {expandedGroups.analytics && (
            <div className="sidebar__group-items">
              <Link 
                to="/stress-trends" 
                className="sidebar__item"
              >
                <div className="sidebar__item-content">
                  <BarChart3 className="sidebar__item-icon" />
                  <span className="sidebar__text">Patient Insights</span>
                </div>
              </Link>
              <Link 
                to="/patient-clusters" 
                className="sidebar__item"
              >
                <div className="sidebar__item-content">
                  <Network className="sidebar__item-icon" />
                  <span className="sidebar__text">Clinical Cohorts</span>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="sidebar__section">
          <Link 
            to="/calendar" 
            className="sidebar__item"
          >
            <div className="sidebar__item-content">
              <Calendar className="sidebar__item-icon" />
              <span className="sidebar__text">Calendar</span>
            </div>
          </Link>
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
                  to="/admin/global-stats" 
                  className="sidebar__item"
                >
                  <div className="sidebar__item-content">
                    <BarChart3 className="sidebar__item-icon" />
                    <span className="sidebar__text">Global Stats</span>
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
                to="/reset-password" 
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
