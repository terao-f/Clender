// Notification System Types

export type NotificationType = 'email' | 'push' | 'both';
export type NotificationCategory = 
  | 'schedule_created' 
  | 'schedule_updated' 
  | 'schedule_deleted' 
  | 'schedule_reminder'
  | 'leave_request_submitted'
  | 'leave_request_approved'
  | 'leave_request_rejected';

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

// User notification preferences
export interface NotificationPreferences {
  id: string;
  userId: string;
  // Email notification settings
  emailEnabled: boolean;
  emailScheduleCreated: boolean;
  emailScheduleUpdated: boolean;
  emailScheduleDeleted: boolean;
  emailScheduleReminder: boolean;
  emailLeaveRequest: boolean;
  emailLeaveApproval: boolean;
  // Push notification settings
  pushEnabled: boolean;
  pushScheduleCreated: boolean;
  pushScheduleUpdated: boolean;
  pushScheduleDeleted: boolean;
  pushScheduleReminder: boolean;
  pushLeaveRequest: boolean;
  pushLeaveApproval: boolean;
  // Browser notification subscription
  pushSubscription?: PushSubscriptionJSON;
  // Reminder time preferences (in minutes before event)
  defaultReminderTime: number;
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
  createdAt: Date;
  updatedAt: Date;
}

// Email template
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Notification log entry
export interface NotificationLog {
  id: string;
  userId: string;
  type: 'email' | 'push';
  category: NotificationCategory;
  subject?: string;
  content?: string;
  metadata: Record<string, any>;
  status: NotificationStatus;
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
  isRead?: boolean;
  readAt?: Date;
}

// Scheduled notification
export interface ScheduledNotification {
  id: string;
  scheduleId: string;
  userId: string;
  reminderTime: number; // Minutes before event
  notificationType: NotificationType;
  scheduledFor: Date;
  status: NotificationStatus;
  notificationLogId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Push subscription JSON format
export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Notification request payloads
export interface SendEmailRequest {
  to: string;
  templateName: string;
  variables: Record<string, any>;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface SendPushRequest {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

// Email service response
export interface EmailServiceResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Push service response
export interface PushServiceResponse {
  success: boolean;
  error?: string;
}

// Notification service configuration
export interface NotificationConfig {
  emailService: {
    from: string;
    fromName: string;
    replyTo?: string;
  };
  pushService: {
    vapidPublicKey: string;
    vapidPrivateKey: string;
    subject: string;
  };
  appUrl: string;
}

// Helper types for notification content generation
export interface ScheduleNotificationData {
  schedule: {
    id: string;
    title: string;
    type: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    details?: string;
    meetLink?: string;
    participants: string[];
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  changes?: string[]; // For update notifications
  deletedBy?: string; // For delete notifications
  reason?: string; // For delete notifications
  timeUntilEvent?: string; // For reminder notifications
}

export interface LeaveNotificationData {
  leaveRequest: {
    id: string;
    type: string;
    date: Date;
    reason: string;
  };
  requester: {
    id: string;
    name: string;
    email: string;
  };
  approver?: {
    id: string;
    name: string;
    email: string;
  };
  comments?: string;
  rejectionReason?: string;
}