import { User, Schedule, LeaveRequest, Group, UserRole } from '../types';
import { filterDataByPermissions } from './security';

/**
 * Data access control utilities for filtering and managing data based on user permissions
 */

export interface DataFilter<T> {
  (data: T[], currentUser: User): T[];
}

/**
 * User data filtering
 */
export const filterUsers: DataFilter<User> = (users, currentUser) => {
  // President can see all users
  if (currentUser.role === 'president') {
    return users;
  }

  // Admin can see all users but with limited modification rights
  if (currentUser.role === 'admin') {
    return users;
  }

  // Employees can only see users in their department or public information
  return users.filter(user => 
    user.department === currentUser.department || 
    user.id === currentUser.id
  );
};

/**
 * Schedule data filtering
 */
export const filterSchedules: DataFilter<Schedule> = (schedules, currentUser) => {
  // President can see all schedules
  if (currentUser.role === 'president') {
    return schedules;
  }

  // Admin can see all schedules
  if (currentUser.role === 'admin') {
    return schedules;
  }

  // Employees can see:
  // 1. Their own schedules
  // 2. Schedules they are participants in
  // 3. Department-wide schedules (if applicable)
  return schedules.filter(schedule => 
    schedule.createdBy === currentUser.id ||
    schedule.participants.includes(currentUser.id) ||
    // Include schedules for equipment/rooms commonly used by their department
    isScheduleRelevantToDepartment(schedule, currentUser.department)
  );
};

/**
 * Leave request data filtering
 */
export const filterLeaveRequests: DataFilter<LeaveRequest> = (requests, currentUser) => {
  // President can see all leave requests
  if (currentUser.role === 'president') {
    return requests;
  }

  // Admin can see all leave requests for approval purposes
  if (currentUser.role === 'admin') {
    return requests;
  }

  // Employees can only see their own leave requests
  return requests.filter(request => request.userId === currentUser.id);
};

/**
 * Group data filtering
 */
export const filterGroups: DataFilter<Group> = (groups, currentUser) => {
  // President can see all groups
  if (currentUser.role === 'president') {
    return groups;
  }

  // Admin can see all groups for management purposes
  if (currentUser.role === 'admin') {
    return groups;
  }

  // Employees can see:
  // 1. Groups they are members of
  // 2. Public/department groups
  return groups.filter(group => 
    group.members.includes(currentUser.id) ||
    group.type === 'department' ||
    group.createdBy === currentUser.id
  );
};

/**
 * Check if a schedule is relevant to a specific department
 */
function isScheduleRelevantToDepartment(schedule: Schedule, department: string): boolean {
  // This is a simplified check - in a real app, you might have more complex rules
  // For example, certain equipment might be associated with specific departments
  
  // Check if the schedule involves equipment commonly used by the department
  if (schedule.equipment && schedule.equipment.length > 0) {
    // Example: CAD-CAM department can see CAD equipment schedules
    if (department === 'CAD-CAM' && schedule.type.includes('CAD')) {
      return true;
    }
    
    // Example: WEB department can see Web meeting room schedules
    if (department === 'WEB' && schedule.equipment.some(eq => eq.id === '4')) { // Web room
      return true;
    }
  }

  return false;
}

/**
 * Data modification permissions
 */
export interface DataModificationCheck {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  reason?: string;
}

/**
 * Check permissions for user data modification
 */
export function checkUserModificationPermissions(
  targetUser: User,
  currentUser: User
): DataModificationCheck {
  // Self-modification rules
  if (targetUser.id === currentUser.id) {
    return {
      canCreate: false, // Can't create yourself
      canRead: true,
      canUpdate: true, // Can update own profile (with restrictions)
      canDelete: false, // Can't delete yourself
    };
  }

  // Role-based rules
  switch (currentUser.role) {
    case 'president':
      return {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
      };

    case 'admin':
      // Admin can't modify president accounts or other admin roles
      if (targetUser.role === 'president') {
        return {
          canCreate: false,
          canRead: true,
          canUpdate: false,
          canDelete: false,
          reason: '社長アカウントは変更できません',
        };
      }
      if (targetUser.role === 'admin') {
        return {
          canCreate: false,
          canRead: true,
          canUpdate: false,
          canDelete: false,
          reason: '他の管理者アカウントは変更できません',
        };
      }
      return {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
      };

    case 'employee':
      return {
        canCreate: false,
        canRead: targetUser.department === currentUser.department,
        canUpdate: false,
        canDelete: false,
        reason: '他のユーザーの情報は変更できません',
      };

    default:
      return {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
        reason: '権限がありません',
      };
  }
}

/**
 * Check permissions for schedule modification
 */
export function checkScheduleModificationPermissions(
  schedule: Schedule,
  currentUser: User
): DataModificationCheck {
  // Owner can modify their own schedules
  if (schedule.createdBy === currentUser.id) {
    return {
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    };
  }

  // Role-based rules
  switch (currentUser.role) {
    case 'president':
      return {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
      };

    case 'admin':
      return {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
      };

    case 'employee':
      // Employees can read schedules they participate in
      const canRead = schedule.participants.includes(currentUser.id) ||
                     isScheduleRelevantToDepartment(schedule, currentUser.department);
      
      return {
        canCreate: true, // Can create new schedules
        canRead,
        canUpdate: false,
        canDelete: false,
        reason: '他の人のスケジュールは変更できません',
      };

    default:
      return {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
        reason: '権限がありません',
      };
  }
}

/**
 * Check permissions for leave request modification
 */
export function checkLeaveRequestModificationPermissions(
  leaveRequest: LeaveRequest,
  currentUser: User
): DataModificationCheck {
  // Own leave requests
  if (leaveRequest.userId === currentUser.id) {
    return {
      canCreate: true,
      canRead: true,
      canUpdate: leaveRequest.status === 'pending', // Can only update pending requests
      canDelete: leaveRequest.status === 'pending',
    };
  }

  // Role-based rules for others' requests
  switch (currentUser.role) {
    case 'president':
      return {
        canCreate: false, // Can't create requests for others
        canRead: true,
        canUpdate: true, // Can approve/reject
        canDelete: false,
      };

    case 'admin':
      return {
        canCreate: false,
        canRead: true,
        canUpdate: true, // Can approve/reject
        canDelete: false,
      };

    case 'employee':
      return {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
        reason: '他の人の休暇申請は見ることができません',
      };

    default:
      return {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
        reason: '権限がありません',
      };
  }
}

/**
 * Sensitive data redaction for different user roles
 */
export function redactSensitiveUserData(user: User, currentUser: User): Partial<User> {
  const baseData = {
    id: user.id,
    name: user.name,
    department: user.department,
    role: user.role,
  };

  // President and admin can see all data
  if (currentUser.role === 'president' || currentUser.role === 'admin') {
    return user;
  }

  // Users can see their own full data
  if (user.id === currentUser.id) {
    return user;
  }

  // Same department employees can see limited data
  if (user.department === currentUser.department) {
    return {
      ...baseData,
      email: user.email,
      phone: user.phone.replace(/\d{4}$/, 'XXXX'), // Mask last 4 digits
    };
  }

  // Others can only see basic information
  return baseData;
}

/**
 * Data aggregation utilities with permission checking
 */
export function getScheduleStatistics(schedules: Schedule[], currentUser: User) {
  const filteredSchedules = filterSchedules(schedules, currentUser);
  
  return {
    total: filteredSchedules.length,
    byType: filteredSchedules.reduce((acc, schedule) => {
      acc[schedule.type] = (acc[schedule.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    thisWeek: filteredSchedules.filter(schedule => {
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      return schedule.startTime >= weekStart;
    }).length,
    canViewAll: currentUser.role !== 'employee',
  };
}

export function getUserStatistics(users: User[], currentUser: User) {
  const filteredUsers = filterUsers(users, currentUser);
  
  return {
    total: filteredUsers.length,
    byRole: filteredUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<UserRole, number>),
    byDepartment: filteredUsers.reduce((acc, user) => {
      acc[user.department] = (acc[user.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    canViewAll: currentUser.role !== 'employee',
  };
}