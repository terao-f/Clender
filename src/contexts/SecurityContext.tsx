import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  Permission, 
  RolePermissions, 
  SecurityEvent, 
  SessionInfo, 
  SecuritySettings,
  UserRole 
} from '../types';
import { useAuth } from './AuthContext';

// Default security settings
const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  sessionTimeout: 480, // 8 hours
  maxLoginAttempts: 5,
  lockoutDuration: 30,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },
  auditLogRetention: 90,
};

// Role-based permissions configuration
const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  president: {
    role: 'president',
    permissions: [
      // Full access to everything
      'users:read', 'users:write', 'users:delete', 'users:manage_roles',
      'groups:read', 'groups:write', 'groups:delete', 'groups:manage_members',
      'equipment:read', 'equipment:write', 'equipment:delete',
      'schedules:read', 'schedules:write', 'schedules:delete', 'schedules:read_all', 'schedules:manage_others',
      'leave:read', 'leave:write', 'leave:approve', 'leave:read_all',
      'admin:access', 'admin:system_settings', 'admin:audit_logs',
      'system:backup', 'system:maintenance'
    ],
    dataAccess: {
      canViewAllUsers: true,
      canViewAllSchedules: true,
      canViewAllLeaveRequests: true,
      canModifyOthersData: true,
    },
  },
  admin: {
    role: 'admin',
    permissions: [
      // User and group management
      'users:read', 'users:write',
      'groups:read', 'groups:write', 'groups:delete', 'groups:manage_members',
      // Equipment management
      'equipment:read', 'equipment:write', 'equipment:delete',
      // Schedule management (with restrictions)
      'schedules:read', 'schedules:write', 'schedules:delete', 'schedules:read_all', 'schedules:manage_others',
      // Leave management
      'leave:read', 'leave:write', 'leave:approve', 'leave:read_all',
      // Limited admin access
      'admin:access'
    ],
    dataAccess: {
      canViewAllUsers: true,
      canViewAllSchedules: true,
      canViewAllLeaveRequests: true,
      canModifyOthersData: false,
    },
  },
  employee: {
    role: 'employee',
    permissions: [
      // Basic read access
      'users:read',
      'groups:read',
      'equipment:read',
      // All schedule management (can manage everyone's schedules)
      'schedules:read', 'schedules:write', 'schedules:delete', 'schedules:read_all', 'schedules:manage_others',
      // Own leave requests
      'leave:read', 'leave:write'
    ],
    dataAccess: {
      canViewAllUsers: false,
      canViewAllSchedules: true,
      canViewAllLeaveRequests: false,
      canModifyOthersData: true,
    },
  },
};

interface SecurityContextType {
  permissions: Permission[];
  rolePermissions: RolePermissions;
  securitySettings: SecuritySettings;
  sessionInfo: SessionInfo | null;
  securityEvents: SecurityEvent[];
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  canAccessResource: (resource: string, action: string, resourceOwnerId?: string) => boolean;
  logSecurityEvent: (event: Omit<SecurityEvent, 'id' | 'timestamp' | 'userId' | 'userEmail' | 'userRole'>) => void;
  updateSecuritySettings: (settings: Partial<SecuritySettings>) => void;
  checkSessionValidity: () => boolean;
  extendSession: () => void;
  getAuditLogs: (filters?: Partial<SecurityEvent>) => SecurityEvent[];
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const { currentUser, isAuthenticated } = useAuth();
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);

  // Get current user's role permissions
  const rolePermissions = currentUser ? ROLE_PERMISSIONS[currentUser.role] : ROLE_PERMISSIONS.employee;
  const permissions = rolePermissions.permissions;

  // Initialize session when user authenticates
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const now = new Date();
      const sessionId = `session_${currentUser.id}_${now.getTime()}`;
      
      setSessionInfo({
        id: sessionId,
        userId: currentUser.id,
        createdAt: now,
        lastActivity: now,
        expiresAt: new Date(now.getTime() + securitySettings.sessionTimeout * 60 * 1000),
        isActive: true,
      });

      // Log login event safely
      setTimeout(() => {
        logSecurityEvent({
          type: 'login',
          action: 'User logged in',
          severity: 'low',
        });
      }, 0);
    } else {
      if (sessionInfo) {
        // Log logout event safely
        setTimeout(() => {
          logSecurityEvent({
            type: 'logout',
            action: 'User logged out',
            severity: 'low',
          });
        }, 0);
      }
      setSessionInfo(null);
    }
  }, [isAuthenticated, currentUser]);

  // Check if user has a specific permission
  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser || !isAuthenticated) return false;
    return permissions.includes(permission);
  };

  // Check if user has any of the specified permissions
  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    if (!currentUser || !isAuthenticated) return false;
    return requiredPermissions.some(permission => permissions.includes(permission));
  };

  // Check if user has all specified permissions
  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
    if (!currentUser || !isAuthenticated) return false;
    return requiredPermissions.every(permission => permissions.includes(permission));
  };

  // Check if user can access a specific resource
  const canAccessResource = (resource: string, action: string, resourceOwnerId?: string): boolean => {
    if (!currentUser || !isAuthenticated) return false;

    // President can access everything
    if (currentUser.role === 'president') return true;

    // Check if user owns the resource
    const isOwner = resourceOwnerId === currentUser.id;

    // Resource-specific access control
    switch (resource) {
      case 'user':
        if (action === 'read') return hasPermission('users:read');
        if (action === 'write') return hasPermission('users:write') || isOwner;
        if (action === 'delete') return hasPermission('users:delete');
        if (action === 'manage_roles') return hasPermission('users:manage_roles');
        break;

      case 'schedule':
        if (action === 'read') {
          return hasPermission('schedules:read') && 
                 (hasPermission('schedules:read_all') || isOwner);
        }
        if (action === 'write') {
          return hasPermission('schedules:write') && 
                 hasPermission('schedules:manage_others');
        }
        if (action === 'delete') {
          return hasPermission('schedules:delete') && 
                 hasPermission('schedules:manage_others');
        }
        break;

      case 'leave_request':
        if (action === 'read') {
          return hasPermission('leave:read') && 
                 (hasPermission('leave:read_all') || isOwner);
        }
        if (action === 'write') return hasPermission('leave:write') || isOwner;
        if (action === 'approve') return hasPermission('leave:approve');
        break;

      case 'group':
        if (action === 'read') return hasPermission('groups:read');
        if (action === 'write') return hasPermission('groups:write');
        if (action === 'delete') return hasPermission('groups:delete');
        if (action === 'manage_members') return hasPermission('groups:manage_members');
        break;

      case 'equipment':
        if (action === 'read') return hasPermission('equipment:read');
        if (action === 'write') return hasPermission('equipment:write');
        if (action === 'delete') return hasPermission('equipment:delete');
        break;

      default:
        return false;
    }

    return false;
  };

  // Log security events
  const logSecurityEvent = (event: Omit<SecurityEvent, 'id' | 'timestamp' | 'userId' | 'userEmail' | 'userRole'>) => {
    if (!currentUser) return;

    const securityEvent: SecurityEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId: currentUser.id,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      ...event,
    };

    setSecurityEvents(prev => {
      const newEvents = [securityEvent, ...prev];
      // Keep only recent events (last 1000)
      return newEvents.slice(0, 1000);
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Security Event:', securityEvent);
    }
  };

  // Update security settings
  const updateSecuritySettings = (settings: Partial<SecuritySettings>) => {
    if (!hasPermission('admin:system_settings')) {
      logSecurityEvent({
        type: 'permission_denied',
        action: 'Attempted to update security settings',
        severity: 'medium',
      });
      return;
    }

    setSecuritySettings(prev => ({ ...prev, ...settings }));
    logSecurityEvent({
      type: 'admin_action',
      action: 'Updated security settings',
      details: settings,
      severity: 'medium',
    });
  };

  // Check session validity
  const checkSessionValidity = (): boolean => {
    // 開発環境では常にtrue
    if (process.env.NODE_ENV === 'development') return true;
    
    if (!sessionInfo || !sessionInfo.isActive) return false;
    
    const now = new Date();
    const isExpired = now > sessionInfo.expiresAt;
    
    if (isExpired) {
      setSessionInfo(prev => prev ? { ...prev, isActive: false } : null);
      setTimeout(() => {
        logSecurityEvent({
          type: 'security_violation',
          action: 'Session expired',
          severity: 'medium',
        });
      }, 0);
      return false;
    }

    // Update last activity
    setSessionInfo(prev => prev ? { ...prev, lastActivity: now } : null);
    return true;
  };

  // Extend session
  const extendSession = () => {
    if (!sessionInfo) return;
    
    const now = new Date();
    setSessionInfo(prev => prev ? {
      ...prev,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + securitySettings.sessionTimeout * 60 * 1000),
    } : null);
  };

  // Get audit logs with optional filters
  const getAuditLogs = (filters?: Partial<SecurityEvent>): SecurityEvent[] => {
    if (!hasPermission('admin:audit_logs')) {
      logSecurityEvent({
        type: 'permission_denied',
        action: 'Attempted to access audit logs',
        severity: 'medium',
      });
      return [];
    }

    let filteredEvents = securityEvents;

    if (filters) {
      filteredEvents = securityEvents.filter(event => {
        return Object.entries(filters).every(([key, value]) => {
          if (value === undefined) return true;
          return event[key as keyof SecurityEvent] === value;
        });
      });
    }

    return filteredEvents;
  };

  // Session timeout monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionInfo && !checkSessionValidity()) {
        // Session expired, force logout
        window.location.href = '/login';
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [sessionInfo]);

  return (
    <SecurityContext.Provider value={{
      permissions,
      rolePermissions,
      securitySettings,
      sessionInfo,
      securityEvents,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessResource,
      logSecurityEvent,
      updateSecuritySettings,
      checkSessionValidity,
      extendSession,
      getAuditLogs,
    }}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}