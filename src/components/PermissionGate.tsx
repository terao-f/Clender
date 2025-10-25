import { ReactNode, useEffect } from 'react';
import { Permission, UserRole } from '../types';
import { usePermissions } from '../hooks/usePermissions';
// import { useSecurity } from '../contexts/SecurityContext'; // 一時的に無効化

interface PermissionGateProps {
  children: ReactNode;
  // Permission-based access
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  // Role-based access
  role?: UserRole;
  roles?: UserRole[];
  minRole?: UserRole;
  // Resource-based access
  resource?: string;
  action?: string;
  resourceOwnerId?: string;
  // Fallback component
  fallback?: ReactNode;
  // Custom permission check
  customCheck?: () => boolean;
}

/**
 * Permission gate component that conditionally renders children based on user permissions
 */
export default function PermissionGate({
  children,
  permission,
  permissions,
  requireAll = false,
  role,
  roles,
  minRole,
  resource,
  action = 'read',
  resourceOwnerId,
  fallback = null,
  customCheck,
}: PermissionGateProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    hasRole,
    hasAnyRole,
    isAdminOrAbove,
  } = usePermissions();
  // const { logSecurityEvent } = useSecurity(); // 一時的に無効化
  
  // 一時的なログ関数（ログ出力を無効化）
  const logSecurityEvent = (event: any) => {
    // 開発中は低レベルのセキュリティログを無効化
    if (event.severity === 'low') {
      return;
    }
    setTimeout(() => {
      console.log('PermissionGate - セキュリティイベント:', event);
    }, 0);
  };

  // Custom permission check
  if (customCheck) {
    if (!customCheck()) {
      logSecurityEvent({
        type: 'permission_denied',
        action: 'Failed custom permission check',
        severity: 'low',
      });
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Single permission check
  if (permission) {
    if (!hasPermission(permission)) {
      logSecurityEvent({
        type: 'permission_denied',
        action: `Access denied for permission: ${permission}`,
        severity: 'low',
      });
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Multiple permissions check
  if (permissions) {
    const hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
    
    if (!hasAccess) {
      logSecurityEvent({
        type: 'permission_denied',
        action: `Access denied for permissions: ${permissions.join(', ')} (requireAll: ${requireAll})`,
        severity: 'low',
      });
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Single role check
  if (role) {
    if (!hasRole(role)) {
      logSecurityEvent({
        type: 'permission_denied',
        action: `Access denied for role: ${role}`,
        severity: 'low',
      });
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Multiple roles check
  if (roles) {
    if (!hasAnyRole(roles)) {
      logSecurityEvent({
        type: 'permission_denied',
        action: `Access denied for roles: ${roles.join(', ')}`,
        severity: 'low',
      });
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Minimum role level check
  if (minRole) {
    if (minRole === 'admin' && !isAdminOrAbove()) {
      logSecurityEvent({
        type: 'permission_denied',
        action: `Access denied for minimum role: ${minRole}`,
        severity: 'low',
      });
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Resource-based access check
  if (resource) {
    if (!canAccessResource(resource, action, resourceOwnerId)) {
      logSecurityEvent({
        type: 'permission_denied',
        action: `Access denied for resource: ${resource} (action: ${action})`,
        resource,
        resourceId: resourceOwnerId,
        severity: 'low',
      });
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // If no conditions specified, allow access
  return <>{children}</>;
}