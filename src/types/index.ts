// User types
export type UserRole = 'employee' | 'admin' | 'president';

export type Department = 
  | '本社（１階）' 
  | '本社（２階）' 
  | '本社（３階）' 
  | '仕上げ・プレス' 
  | 'CAD-CAM' 
  | 'WEB' 
  | '所属なし';

export interface User {
  id: string;
  employeeId: string;
  name: string;
  nameKana: string;
  email: string;
  phone: string;
  department: Department;
  role: UserRole;
  defaultWorkDays: WorkDay[];
  isHr?: boolean;
  isSampleStaff?: boolean;
}

export interface WorkDay {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

// Group types
export type GroupType = 'business' | 'leave';

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  members: string[]; // User IDs
  createdBy: string; // User ID
  createdAt: Date;
  displayOrder?: number;
}

// Calendar and schedule types
export type ScheduleType = 
  // 車両予約用
  | '外出'
  | '営業'
  | '配送'
  | '出張'
  // 会議室予約用
  | '会議'
  | '打ち合わせ'
  | '面接'
  | '研修'
  | 'プレゼン'
  // サンプル予約用
  | 'サンプル作成'
  | 'CAD・マーキング'
  | 'サンプル裁断'
  | 'サンプル縫製'
  | 'サンプル内職'
  | 'プレス'
  | '仕上げ・梱包'
  // 共通
  | 'その他';

export type RecurrenceType = 
  | 'none' 
  | 'daily' 
  | 'weekly' 
  | 'monthly' 
  | 'yearly' 
  | 'weekday' 
  | 'custom';

export interface Schedule {
  id: string;
  type: string; // ScheduleType から string へ変更（予約種別によって動的に変更されるため）
  title: string;
  details: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  recurrence: Recurrence | null;
  original_id?: string | null; // 繰り返し予約のインスタンス識別用
  participants: string[]; // User IDs
  equipment: Equipment[]; // Equipment IDs and types
  reminders: Reminder[];
  createdBy: string; // User ID
  createdAt: Date;
  isMultiDay?: boolean;
  updatedBy: string | null; // User ID
  updatedAt: Date | null;
  // サンプル予約用の追加フィールド
  quantity?: number;
  assignedTo?: string;
  notes?: string;
  // Google Meet連携用フィールド
  meetLink?: string;
  meetingType?: 'in-person' | 'online';
  // メール送信制御用フィールド
  sendEmailOnSave?: boolean;
  // Googleカレンダーからの入力フラグ
  isFromGoogleCalendar?: boolean;
  // 非公開スケジュールフラグ
  isPrivate?: boolean;
}

export interface Recurrence {
  frequency: string;
  interval: number;
  endType: 'never' | 'date' | 'count';
  endDate: Date | null;
  count: number | null;
  weekdays?: number[]; // 0-6 for Sunday-Saturday
}

export interface Equipment {
  id: string;
  name: string;
  type: 'room' | 'vehicle' | 'sample';
}

export interface Reminder {
  time: number; // Minutes before the event
  methods: ('email' | 'calendar' | 'notification')[];
}

// Room types
export interface Room {
  id: string;
  name: string;
  createdBy: string; // User ID
  displayOrder?: number;
}

// Vehicle types
export interface Vehicle {
  id: string;
  name: string;
  licensePlate: string;
  type: string; // Car manufacturer (e.g., Toyota, Honda, Nissan)
  createdBy: string; // User ID
  displayOrder?: number;
}

// Sample equipment types
export interface SampleEquipment {
  id: string;
  name: string;
  type: 'サンプル作成' | 'CAD・マーキング' | 'サンプル裁断' | 'サンプル縫製' | 'サンプル内職' | 'プレス' | '仕上げ・梱包';
  displayOrder?: number;
}

export interface SampleReservationDetails {
  productionNumber: string;
  productCode: string;
  quantity: number;
  assignedTo: string; // User ID
  order: number;
}

// Leave request types
export type LeaveType = 'vacation' | 'late' | 'early';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  userId: string;
  date: Date;
  reason: string;
  status: LeaveStatus;
  approvers: {
    userId: string;
    status: LeaveStatus;
    timestamp: Date | null;
  }[];
  createdAt: Date;
  // メール送信用のフィールド
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

// Security and Permission types
export type Permission = 
  // User management
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'users:manage_roles'
  // Group management
  | 'groups:read'
  | 'groups:write'
  | 'groups:delete'
  | 'groups:manage_members'
  // Equipment management
  | 'equipment:read'
  | 'equipment:write'
  | 'equipment:delete'
  // Schedule management
  | 'schedules:read'
  | 'schedules:write'
  | 'schedules:delete'
  | 'schedules:read_all'
  | 'schedules:manage_others'
  // Leave requests
  | 'leave:read'
  | 'leave:write'
  | 'leave:approve'
  | 'leave:read_all'
  // Admin functions
  | 'admin:access'
  | 'admin:system_settings'
  | 'admin:audit_logs'
  // System functions
  | 'system:backup'
  | 'system:maintenance';

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
  dataAccess: {
    canViewAllUsers: boolean;
    canViewAllSchedules: boolean;
    canViewAllLeaveRequests: boolean;
    canModifyOthersData: boolean;
  };
}

export interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'permission_denied' | 'data_access' | 'data_modification' | 'admin_action' | 'security_violation';
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface SecuritySettings {
  sessionTimeout: number; // minutes
  maxLoginAttempts: number;
  lockoutDuration: number; // minutes
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
  auditLogRetention: number; // days
}

// Schedule history types
export interface ScheduleHistory {
  id: string;
  scheduleId: string;
  operationType: 'create' | 'update' | 'delete';
  operatorId: string;
  operatorName: string;
  operationTime: Date;
  description: string;
  scheduleData?: any; // JSONB data
  createdAt: Date;
}

// Holiday types
export type HolidayType = 'national_holiday' | 'company_holiday';

export interface Holiday {
  id: string;
  date: Date;
  name: string;
  type: HolidayType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Export notification types
export * from './notifications';