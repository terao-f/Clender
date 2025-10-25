import { Link, useLocation } from 'react-router-dom';
import { Calendar, Car, DoorOpen, Clock, Users, Settings, Building2, Box, Bell, Shield, Mail, CalendarDays, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import PermissionGate from './PermissionGate';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { 
    canReadSchedules, 
    canWriteSchedules, 
    canReadLeaveRequests, 
    canAccessAdmin, 
    canViewAuditLogs,
    isManagerOrAbove,
    canAccessSampleReservation
  } = usePermissions();

  const [pendingLeaveRequestsCount, setPendingLeaveRequestsCount] = useState(0);

  // Fetch pending leave requests count
  useEffect(() => {
    if (currentUser && canReadLeaveRequests()) {
      fetchPendingLeaveRequestsCount();
    }
  }, [currentUser, canReadLeaveRequests]);


  const fetchPendingLeaveRequestsCount = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('id, approvers')
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending leave requests:', error);
        return;
      }

      // Count requests that need current user's approval
      const needsApproval = data?.filter(request => {
        if (!request.approvers || !Array.isArray(request.approvers)) return false;
        return request.approvers.some((approver: any) => 
          approver.userId === currentUser?.id && approver.status === 'pending'
        );
      });

      setPendingLeaveRequestsCount(needsApproval?.length || 0);
    } catch (error) {
      console.error('Error fetching pending leave requests count:', error);
    }
  };

  const navigation = useMemo(() => [
    { name: 'ダッシュボード', href: '/', icon: <Building2 className="h-6 w-6" />, show: true },
    { name: 'カレンダー', href: '/calendar/my', icon: <Calendar className="h-6 w-6" />, show: canReadSchedules() },
    { name: '会議室予約', href: '/calendar/room', icon: <DoorOpen className="h-6 w-6" />, show: canWriteSchedules() },
    { name: '車両予約', href: '/calendar/vehicle', icon: <Car className="h-6 w-6" />, show: canWriteSchedules() },
    { name: 'サンプル予約', href: '/calendar/sample', icon: <Box className="h-6 w-6" />, show: canAccessSampleReservation() },
    { name: '休暇申請', href: '/leave', icon: <Clock className="h-6 w-6" />, show: canReadLeaveRequests(), badge: pendingLeaveRequestsCount },
    { name: '業務グループ', href: '/groups/business', icon: <Users className="h-6 w-6" />, show: true },
    { name: '通知設定', href: '/settings/notifications', icon: <Bell className="h-6 w-6" />, show: true },
    { name: 'Googleカレンダー', href: '/settings/google-calendar', icon: <Calendar className="h-6 w-6" />, show: true },
  ], [currentUser, pendingLeaveRequestsCount, canReadSchedules, canWriteSchedules, canAccessSampleReservation, canReadLeaveRequests, isManagerOrAbove]);

  const adminNavigation = [
    { name: 'ユーザー管理', href: '/admin/users', icon: <Users className="h-6 w-6" />, permission: 'users:read' as const },
    { name: '業務グループ管理', href: '/admin/groups', icon: <Users className="h-6 w-6" />, permission: 'groups:read' as const },
    { name: '休暇グループ管理', href: '/admin/leave-groups', icon: <Clock className="h-6 w-6" />, permission: 'groups:read' as const },
    { name: '設備管理', href: '/admin/equipment', icon: <Settings className="h-6 w-6" />, permission: 'equipment:read' as const },
    { name: '所属管理', href: '/admin/departments', icon: <Building2 className="h-6 w-6" />, permission: 'admin:access' as const },
    { name: 'メール管理', href: '/admin/email-templates', icon: <Mail className="h-6 w-6" />, permission: 'admin:access' as const },
    { name: '祝日・休日管理', href: '/admin/holidays', icon: <CalendarDays className="h-6 w-6" />, permission: 'admin:access' as const },
    { name: '操作履歴', href: '/admin/operation-logs', icon: <FileText className="h-6 w-6" />, permission: 'admin:access' as const },
    // 一時的に無効化: { name: 'スケジュール履歴', href: '/admin/schedule-history', icon: <Calendar className="h-6 w-6" />, permission: 'admin:access' as const },
    // 一時的に無効化: { name: '監査ログ', href: '/admin/audit', icon: <Shield className="h-6 w-6" />, permission: 'admin:audit_logs' as const },
  ];

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center justify-center flex-shrink-0 px-4 mb-8">
          <img src="/terao-f-logo.png" alt="terao-f CO.,LTD." className="h-32 w-full object-contain" />
        </div>
        <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
          {navigation.map((item) => {
            if (!item.show) return null;
            
            const isActive = location.pathname === item.href || 
                            (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={handleLinkClick}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${isActive
                    ? 'bg-blue-100 text-blue-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <div className={`mr-3 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                  {item.icon}
                </div>
                <span className="flex-1">{item.name}</span>
                {item.badge && item.badge > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <PermissionGate permission="admin:access">
            <div className="pt-6">
              <div className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                管理者メニュー
              </div>
              {adminNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <PermissionGate key={item.name} permission={item.permission}>
                    <Link
                      to={item.href}
                      onClick={handleLinkClick}
                      className={`
                        group flex items-center px-2 py-2 text-sm font-medium rounded-md
                        ${isActive
                          ? 'bg-blue-100 text-blue-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                      `}
                    >
                      <div className={`mr-3 ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                        {item.icon}
                      </div>
                      {item.name}
                    </Link>
                  </PermissionGate>
                );
              })}
            </div>
          </PermissionGate>
        </nav>
      </div>
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-700">{currentUser?.name}</div>
            <div className="text-xs text-gray-500">{currentUser?.department}</div>
          </div>
        </div>
      </div>
    </div>
  );
}