import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, LogOut } from 'lucide-react';
import { Notification, User } from '../types';

interface HeaderProps {
  title: string;
  user: User | null;
  isDarkMode: boolean;
  onDarkModeToggle: () => void;
  onViewProfile?: () => void;
  onLogout?: () => void;
  children?: React.ReactNode; // Allow custom buttons/elements
}

export const Header: React.FC<HeaderProps> = ({
  title,
  user,
  isDarkMode,
  onDarkModeToggle,
  onViewProfile,
  onLogout,
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Refs for click-outside detection
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Load notifications from localStorage
    const stored = localStorage.getItem(`notifications-${user?.id}`);
    if (stored) {
      setNotifications(JSON.parse(stored));
    }
  }, [user?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (notificationId: string) => {
    const updated = notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    setNotifications(updated);
    localStorage.setItem(`notifications-${user?.id}`, JSON.stringify(updated));
  };

  const handleDeleteNotification = (notificationId: string) => {
    const updated = notifications.filter(n => n.id !== notificationId);
    setNotifications(updated);
    localStorage.setItem(`notifications-${user?.id}`, JSON.stringify(updated));
  };

  const handleClearAll = () => {
    setNotifications([]);
    localStorage.setItem(`notifications-${user?.id}`, JSON.stringify([]));
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-8 shadow-sm z-40 transition-colors duration-200">
      <h1 className="text-xl font-bold text-gray-800 dark:text-white capitalize">
        {title.replace(/-/g, ' ')}
      </h1>

      <div className="flex items-center space-x-4">
        {/* Custom children (e.g., Sales Floor toggle) */}
        {children}

        {/* Dark Mode Toggle */}
        <button
          onClick={onDarkModeToggle}
          className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 z-50 max-h-96 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="mx-auto text-gray-400 mb-2" size={32} />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b border-gray-100 dark:border-slate-700 ${getNotificationColor(notification.type)} ${!notification.read ? 'bg-opacity-100' : 'bg-opacity-50'}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                            {notification.title}
                          </h4>
                          <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteNotification(notification.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Check size={14} />
                          Mark as read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer transition ${
              user?.profilePicture
                ? 'overflow-hidden'
                : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-200'
            }`}
            title={user ? `${user.firstName} ${user.lastName}` : 'Profile'}
          >
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={`${user.firstName} ${user.lastName}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                {user?.firstName.charAt(0).toUpperCase()}
                {user?.lastName.charAt(0).toUpperCase()}
              </>
            )}
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50">
              <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                      user?.profilePicture
                        ? 'overflow-hidden'
                        : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-200'
                    }`}
                  >
                    {user?.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        {user?.firstName.charAt(0).toUpperCase()}
                        {user?.lastName.charAt(0).toUpperCase()}
                      </>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {user?.firstName} {user?.lastName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                      user?.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' :
                      user?.role === 'manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-200'
                    }`}>
                      {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button 
                  onClick={() => {
                    onViewProfile?.();
                    setShowProfile(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
                >
                  View Profile
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition">
                  Change Password
                </button>
                <div className="border-t border-gray-200 dark:border-slate-600 my-1"></div>
                <button 
                  onClick={() => {
                    onLogout?.();
                    setShowProfile(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
