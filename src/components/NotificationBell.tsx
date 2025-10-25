import { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, Calendar, Users, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { NotificationLog, NotificationCategory } from '../types';
import { supabase } from '../lib/supabase';

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load notifications on mount and when user changes
  useEffect(() => {
    if (currentUser) {
      loadNotifications();
      const cleanup = subscribeToNotifications();
      return cleanup;
    }
  }, [currentUser]);

  // Load recent notifications
  const loadNotifications = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      console.log(`=== 通知読み込み開始: ${currentUser.name} (${currentUser.id}) ===`);
      const logs = await notificationService.getUserNotificationLogs(currentUser.id, 50);
      console.log('取得した通知数:', logs.length);
      console.log('通知データ:', logs);
      setNotifications(logs);
      
      // Count unread notifications
      const unread = logs.filter(log => !log.isRead).length;
      console.log('未読通知数:', unread);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to real-time notifications
  const subscribeToNotifications = () => {
    if (!currentUser) return () => {};

    const channel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_logs',
          filter: `user_id=eq.${currentUser.id}`
        },
        (payload) => {
          // Add new notification to the top of the list
          const newNotification = mapNotificationFromDb(payload.new);
          setNotifications(prev => [newNotification, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
          
          // Show browser notification if it's a push notification
          if (newNotification.type === 'push' && newNotification.status === 'sent') {
            showBrowserNotification(newNotification);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Show browser notification
  const showBrowserNotification = async (notification: NotificationLog) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notif = new Notification(notification.subject || 'お知らせ', {
        body: notification.content || '',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: notification.id,
        timestamp: new Date(notification.createdAt).getTime()
      });

      notif.onclick = () => {
        handleNotificationClick(notification);
        notif.close();
      };
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: NotificationLog) => {
    // Mark as read if not already
    if (!notification.isRead) {
      const success = await notificationService.markNotificationAsRead(notification.id);
      if (success) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, isRead: true, readAt: new Date() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    
    const metadata = notification.metadata;
    
    switch (notification.category) {
      case 'schedule_created':
      case 'schedule_updated':
      case 'schedule_reminder':
        setIsOpen(false);
        // Navigate to MyCalendar page
        navigate('/calendar/my');
        break;
      
      case 'leave_request_submitted':
      case 'leave_request_approved':
      case 'leave_request_rejected':
        setIsOpen(false);
        navigate('/leave');
        break;
      
      default:
        setIsOpen(false);
        navigate('/');
    }
  };

  // Get icon for notification category
  const getNotificationIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'schedule_created':
      case 'schedule_updated':
      case 'schedule_deleted':
      case 'schedule_reminder':
        return <Calendar className="h-5 w-5" />;
      
      case 'leave_request_submitted':
      case 'leave_request_approved':
      case 'leave_request_rejected':
        return <Users className="h-5 w-5" />;
      
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  // Get color for notification status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  // Get notification title based on category
  const getNotificationTitle = (notification: NotificationLog): string => {
    switch (notification.category) {
      case 'schedule_created':
        return '新しいスケジュールが追加されました';
      case 'schedule_updated':
        return 'スケジュールが更新されました';
      case 'schedule_deleted':
        return 'スケジュールが削除されました';
      case 'schedule_reminder':
        return 'スケジュールのリマインダー';
      case 'leave_request_submitted':
        return '休暇申請が提出されました';
      case 'leave_request_approved':
        return '休暇申請が承認されました';
      case 'leave_request_rejected':
        return '休暇申請が却下されました';
      default:
        return 'お知らせ';
    }
  };

  // Format notification time
  const formatNotificationTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return '今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    
    return format(new Date(date), 'MM/dd', { locale: ja });
  };

  // Map notification from database
  const mapNotificationFromDb = (data: any): NotificationLog => {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      category: data.category,
      subject: data.subject,
      content: data.content,
      metadata: data.metadata,
      status: data.status,
      errorMessage: data.error_message,
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      createdAt: new Date(data.created_at),
      isRead: data.is_read || false,
      readAt: data.read_at ? new Date(data.read_at) : undefined
    };
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!currentUser) return;
    
    const success = await notificationService.markAllNotificationsAsRead(currentUser.id);
    if (success) {
      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true, readAt: new Date() }))
      );
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-full"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-50" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown - モバイルでは固定位置、デスクトップでは絶対位置 */}
          <div className="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 max-w-[calc(100vw-1rem)] sm:max-w-sm md:max-w-md lg:w-96 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">通知</h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      すべて既読にする
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  読み込み中...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>通知はありません</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors relative ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {!notification.isRead && (
                        <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                      <div className="flex items-start">
                        <div className={`flex-shrink-0 ${getStatusColor(notification.status)} ${
                          !notification.isRead ? '' : 'opacity-60'
                        }`}>
                          {getNotificationIcon(notification.category)}
                        </div>
                        <div className="ml-3 flex-1">
                          <p className={`text-sm font-medium ${
                            !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.subject || getNotificationTitle(notification)}
                          </p>
                          {notification.content && (
                            <p className={`mt-1 text-sm line-clamp-2 ${
                              !notification.isRead ? 'text-gray-700' : 'text-gray-600'
                            }`}>
                              {notification.content}
                            </p>
                          )}
                          <div className="mt-2 flex items-center text-xs text-gray-500">
                            <span className="flex items-center">
                              {notification.type === 'email' ? (
                                <Mail className="h-3 w-3 mr-1" />
                              ) : (
                                <Bell className="h-3 w-3 mr-1" />
                              )}
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                            {notification.status === 'failed' && (
                              <span className="ml-2 flex items-center text-red-600">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                送信失敗
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/settings/notifications');
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                >
                  通知設定を管理
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}