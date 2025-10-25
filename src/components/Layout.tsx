import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X, Calendar, Car, Home, Clock, Users, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import UserSwitcher from './UserSwitcher';
import NotificationBell from './NotificationBell';
import SecurityMiddleware from './SecurityMiddleware';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <SecurityMiddleware>
      <div className="h-screen flex overflow-hidden bg-gray-100">
        {/* Mobile sidebar */}
        <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={toggleSidebar}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={toggleSidebar}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <Sidebar onClose={toggleSidebar} />
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64">
            <Sidebar />
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <div className="relative z-20 flex-shrink-0 flex h-16 bg-white shadow">
            <button
              className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
              onClick={toggleSidebar}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-1 px-4 flex justify-between">
              <div className="flex-1 flex items-center">
                <h1 className="text-sm sm:text-lg md:text-xl font-semibold text-gray-900 truncate">
                  <span className="hidden sm:inline">terao-f スケジューラー</span>
                  <span className="sm:hidden">スケジュール</span>
                </h1>
              </div>
              <div className="ml-2 flex items-center space-x-2 sm:space-x-4">
                <NotificationBell />
                <UserSwitcher />
              </div>
            </div>
          </div>

          <main className="flex-1 relative overflow-y-auto focus:outline-none" style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
            <div className="py-2 sm:py-4 md:py-6">
              <div className={`${location.pathname.includes('/calendar') ? '' : 'max-w-7xl'} mx-auto px-2 sm:px-4 md:px-6 lg:px-8`}>
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </SecurityMiddleware>
  );
}