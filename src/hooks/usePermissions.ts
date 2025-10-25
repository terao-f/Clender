import { useMemo } from 'react';
import { Permission, UserRole } from '../types';
import { useSecurity } from '../contexts/SecurityContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for checking user permissions and data access
 */
export function usePermissions() {
  const { 
    permissions, 
    rolePermissions, 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    canAccessResource,
    logSecurityEvent 
  } = useSecurity();
  const { currentUser } = useAuth();

  // Memoized permission checkers for better performance
  const permissionCheckers = useMemo(() => ({
    // User management permissions
    canReadUsers: () => hasPermission('users:read'),
    canWriteUsers: () => hasPermission('users:write'),
    canDeleteUsers: () => hasPermission('users:delete'),
    canManageRoles: () => hasPermission('users:manage_roles'),

    // Group management permissions
    canReadGroups: () => hasPermission('groups:read'),
    canWriteGroups: () => hasPermission('groups:write'),
    canDeleteGroups: () => hasPermission('groups:delete'),
    canManageGroupMembers: () => hasPermission('groups:manage_members'),

    // Equipment management permissions
    canReadEquipment: () => hasPermission('equipment:read'),
    canWriteEquipment: () => hasPermission('equipment:write'),
    canDeleteEquipment: () => hasPermission('equipment:delete'),

    // Schedule management permissions
    canReadSchedules: () => hasPermission('schedules:read'),
    canWriteSchedules: () => hasPermission('schedules:write'),
    canDeleteSchedules: () => hasPermission('schedules:delete'),
    canReadAllSchedules: () => hasPermission('schedules:read_all'),
    canManageOthersSchedules: () => hasPermission('schedules:manage_others'),

    // Leave request permissions
    canReadLeaveRequests: () => hasPermission('leave:read'),
    canWriteLeaveRequests: () => hasPermission('leave:write'),
    canApproveLeaveRequests: () => hasPermission('leave:approve'),
    canReadAllLeaveRequests: () => hasPermission('leave:read_all'),

    // Admin permissions
    canAccessAdmin: () => hasPermission('admin:access'),
    canManageSystemSettings: () => hasPermission('admin:system_settings'),
    canViewAuditLogs: () => hasPermission('admin:audit_logs'),

    // System permissions
    canBackupSystem: () => hasPermission('system:backup'),
    canPerformMaintenance: () => hasPermission('system:maintenance'),
  }), [hasPermission]);

  // Data access checkers
  const dataAccessCheckers = useMemo(() => ({
    canViewAllUsers: rolePermissions.dataAccess.canViewAllUsers,
    canViewAllSchedules: rolePermissions.dataAccess.canViewAllSchedules,
    canViewAllLeaveRequests: rolePermissions.dataAccess.canViewAllLeaveRequests,
    canModifyOthersData: rolePermissions.dataAccess.canModifyOthersData,
  }), [rolePermissions]);

  // Resource-specific access checkers
  const resourceCheckers = useMemo(() => ({
    canAccessUser: (userId: string, action: 'read' | 'write' | 'delete' = 'read') => {
      return canAccessResource('user', action, userId);
    },
    
    canAccessSchedule: (scheduleOwnerId: string, action: 'read' | 'write' | 'delete' = 'read') => {
      return canAccessResource('schedule', action, scheduleOwnerId);
    },
    
    canAccessLeaveRequest: (requesterId: string, action: 'read' | 'write' | 'approve' = 'read') => {
      return canAccessResource('leave_request', action, requesterId);
    },
    
    canAccessGroup: (groupOwnerId: string, action: 'read' | 'write' | 'delete' | 'manage_members' = 'read') => {
      return canAccessResource('group', action, groupOwnerId);
    },
    
    canAccessEquipment: (action: 'read' | 'write' | 'delete' = 'read') => {
      return canAccessResource('equipment', action);
    },
  }), [canAccessResource]);

  // Role-based checkers
  const roleCheckers = useMemo(() => ({
    isPresident: () => currentUser?.role === 'president',
    isAdmin: () => currentUser?.role === 'admin',
    isEmployee: () => currentUser?.role === 'employee',
    isAdminOrAbove: () => currentUser?.role === 'admin' || currentUser?.role === 'president',
    isManagerOrAbove: () => currentUser?.role === 'manager' || currentUser?.role === 'admin' || currentUser?.role === 'president',
    hasRole: (role: UserRole) => currentUser?.role === role,
    hasAnyRole: (roles: UserRole[]) => currentUser ? roles.includes(currentUser.role) : false,
    // サンプル予約の権限チェック
    canAccessSampleReservation: () => {
      // 社長、管理者、サンプル担当者（is_hrまたはis_sample_staffフラグがtrue）のみアクセス可能
      return currentUser?.role === 'president' || 
             currentUser?.role === 'admin' || 
             currentUser?.isHr === true ||
             currentUser?.isSampleStaff === true;
    },
  }), [currentUser]);

  // Permission enforcement utilities
  const enforcePermission = (permission: Permission, action?: string) => {
    if (!hasPermission(permission)) {
      logSecurityEvent({
        type: 'permission_denied',
        action: action || `Attempted action requiring permission: ${permission}`,
        resource: permission.split(':')[0],
        severity: 'medium',
      });
      throw new Error(`Permission denied: ${permission}`);
    }
  };

  const enforceAnyPermission = (requiredPermissions: Permission[], action?: string) => {
    if (!hasAnyPermission(requiredPermissions)) {
      logSecurityEvent({
        type: 'permission_denied',
        action: action || `Attempted action requiring any of permissions: ${requiredPermissions.join(', ')}`,
        details: { requiredPermissions },
        severity: 'medium',
      });
      throw new Error(`Permission denied: Requires any of ${requiredPermissions.join(', ')}`);
    }
  };

  const enforceResourceAccess = (resource: string, action: string, resourceOwnerId?: string) => {
    if (!canAccessResource(resource, action, resourceOwnerId)) {
      logSecurityEvent({
        type: 'permission_denied',
        action: `Attempted ${action} on ${resource}`,
        resource,
        resourceId: resourceOwnerId,
        severity: 'medium',
      });
      throw new Error(`Access denied: Cannot ${action} ${resource}`);
    }
  };

  return {
    // Raw permission data
    permissions,
    rolePermissions,
    
    // Basic permission checkers
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    
    // Convenient permission checkers
    ...permissionCheckers,
    
    // Data access checkers
    ...dataAccessCheckers,
    
    // Resource-specific checkers
    ...resourceCheckers,
    
    // Role-based checkers
    ...roleCheckers,
    
    // Permission enforcement
    enforcePermission,
    enforceAnyPermission,
    enforceResourceAccess,
  };
}