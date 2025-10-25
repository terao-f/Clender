import { supabase } from '../lib/supabase';
import { 
  NotificationPreferences, 
  SendEmailRequest, 
  SendPushRequest,
  EmailServiceResponse,
  PushServiceResponse,
  NotificationCategory,
  ScheduleNotificationData,
  LeaveNotificationData,
  NotificationLog
} from '../types';

// Notification service configuration
const NOTIFICATION_CONFIG = {
  emailService: {
    from: 'noreply@example.com',
    fromName: 'スケジュール管理システム',
    replyTo: 'support@example.com'
  },
  pushService: {
    vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: import.meta.env.VITE_VAPID_PRIVATE_KEY || '',
    subject: 'mailto:support@company.com'
  },
  appUrl: import.meta.env.VITE_APP_URL || 'http://localhost:5173'
};

class NotificationService {
  // Get user's notification preferences
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      // Always return default preferences (table removed)
      console.log('デフォルト通知設定を返します');
      return this.getDefaultPreferences();
    } catch (error) {
      // エラーが発生してもデフォルト値を返す
      return this.getDefaultPreferences();
    }
  }

  // Update user's notification preferences
  async updateUserPreferences(
    userId: string, 
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      // テーブル削除済み：デフォルト値を返すのみ
      console.log('通知設定更新スキップ（テーブル削除済み）');
      return true;
    } catch (error) {
      console.error('Error in updateUserPreferences:', error);
      return false;
    }
  }

  // Send email notification
  async sendEmail(request: SendEmailRequest): Promise<EmailServiceResponse> {
    console.log('=== sendEmail開始 ===');
    console.log('送信先:', request.to);
    console.log('テンプレート:', request.templateName);
    console.log('変数:', request.variables);
    
    try {
      // Call Supabase Edge Function to send email
      console.log('Edge Function呼び出し開始');
      // メール送信システム削除済み
      throw new Error('Email system has been disabled');

      if (error) {
        throw error;
      }

      // Log the email notification
      if (request.userId) {
        await this.logNotification({
          userId: request.userId,
          type: 'email',
          category: this.getNotificationCategory(request.templateName),
          subject: data.subject,
          content: data.bodyText,
          metadata: request.metadata || {},
          status: 'sent',
          sentAt: new Date()
        });
      }

      return {
        success: true,
        messageId: data.messageId
      };
    } catch (error) {
      console.error('Error sending email:', error);
      
      // Log failed notification
      if (request.userId) {
        await this.logNotification({
          userId: request.userId,
          type: 'email',
          category: this.getNotificationCategory(request.templateName),
          metadata: request.metadata || {},
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  // Get default notification preferences
  private getDefaultPreferences(): NotificationPreferences {
    console.log('デフォルト通知設定を返します');
    return {
      id: 'default',
      userId: 'default',
      // Email notification settings
      emailEnabled: true,
      emailScheduleCreated: true,
      emailScheduleUpdated: true,
      emailScheduleDeleted: true,
      emailScheduleReminder: true,
      emailLeaveRequest: true,
      emailLeaveApproval: true,
      // Push notification settings
      pushEnabled: false,
      pushScheduleCreated: true,
      pushScheduleUpdated: true,
      pushScheduleDeleted: false,
      pushScheduleReminder: true,
      pushLeaveRequest: true,
      pushLeaveApproval: true,
      // Browser notification subscription
      pushSubscription: undefined,
      // Reminder time preferences (in minutes before event)
      defaultReminderTime: 15,
      // Quiet hours
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Send push notification
  async sendPush(request: SendPushRequest): Promise<PushServiceResponse> {
    try {
      // Get user's push subscription
      const preferences = await this.getUserPreferences(request.userId);
      
      if (!preferences?.pushEnabled || !preferences.pushSubscription) {
        return {
          success: false,
          error: 'Push notifications not enabled for user'
        };
      }

      // Call Supabase Edge Function to send push notification
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          subscription: preferences.pushSubscription,
          notification: {
            title: request.title,
            body: request.body,
            icon: request.icon || '/icon-192x192.png',
            badge: request.badge || '/badge-72x72.png',
            tag: request.tag,
            data: request.data,
            requireInteraction: request.requireInteraction,
            actions: request.actions
          }
        }
      });

      if (error) {
        throw error;
      }

      // Log the push notification
      await this.logNotification({
        userId: request.userId,
        type: 'push',
        category: this.getCategoryFromData(request.data),
        subject: request.title,
        content: request.body,
        metadata: request.data || {},
        status: 'sent',
        sentAt: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending push notification:', error);
      
      // Log failed notification
      await this.logNotification({
        userId: request.userId,
        type: 'push',
        category: this.getCategoryFromData(request.data),
        subject: request.title,
        content: request.body,
        metadata: request.data || {},
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send push notification'
      };
    }
  }

  // Subscribe to push notifications
  async subscribeToPush(userId: string, subscription: PushSubscriptionJSON): Promise<boolean> {
    try {
      // テーブル削除済み：プッシュ通知設定スキップ
      console.log('プッシュ通知登録スキップ（テーブル削除済み）');
      return true;
    } catch (error) {
      console.error('Error in subscribeToPush:', error);
      return false;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribeFromPush(userId: string): Promise<boolean> {
    try {
      // テーブル削除済み：プッシュ通知解除スキップ
      console.log('プッシュ通知解除スキップ（テーブル削除済み）');
      return true;
    } catch (error) {
      console.error('Error in unsubscribeFromPush:', error);
      return false;
    }
  }

  // Send schedule created notification
  async notifyScheduleCreated(data: ScheduleNotificationData): Promise<void> {
    console.log(`=== notifyScheduleCreated開始: ${data.user.name} ===`);
    
    // Always save notification log (for in-app notifications)
    const notificationSubject = `${data.schedule.title}`;
    const notificationContent = `${this.formatDateTime(data.schedule.startTime)} - ${this.formatDateTime(data.schedule.endTime)}${data.schedule.location ? `\n場所: ${data.schedule.location}` : ''}`;
    
    await this.logNotification({
      userId: data.user.id,
      type: 'email',
      category: 'schedule_created',
      subject: notificationSubject,
      content: notificationContent,
      metadata: { 
        scheduleId: data.schedule.id,
        scheduleTitle: data.schedule.title,
        scheduleType: data.schedule.type,
        startTime: data.schedule.startTime,
        endTime: data.schedule.endTime
      },
      status: 'sent',
      sentAt: new Date(),
      isRead: false
    });
    console.log('通知ログ保存完了');
    
    // Check preferences for email/push notifications
    const preferences = await this.getUserPreferences(data.user.id);
    console.log('ユーザー通知設定:', preferences);
    if (!preferences) {
      console.log('通知設定なし、アプリ内通知のみ');
      return;
    }

    // Check if user wants email notifications for schedule creation
    console.log('メール送信チェック:', {
      emailEnabled: preferences.emailEnabled,
      emailScheduleCreated: preferences.emailScheduleCreated
    });

    // Check if user wants push notifications for schedule creation
    if (preferences.pushEnabled && preferences.pushScheduleCreated) {
      await this.sendPush({
        userId: data.user.id,
        title: '新しいスケジュール',
        body: `${data.schedule.title} - ${this.formatDateTime(data.schedule.startTime)}`,
        tag: `schedule-${data.schedule.id}`,
        data: {
          type: 'schedule_created',
          scheduleId: data.schedule.id
        },
        actions: [
          { action: 'view', title: '詳細を見る' },
          { action: 'dismiss', title: '閉じる' }
        ]
      });
    }
  }

  // Send schedule updated notification
  async notifyScheduleUpdated(data: ScheduleNotificationData): Promise<void> {
    const preferences = await this.getUserPreferences(data.user.id);
    if (!preferences) return;


    // Check if user wants push notifications for schedule updates
    if (preferences.pushEnabled && preferences.pushScheduleUpdated) {
      await this.sendPush({
        userId: data.user.id,
        title: 'スケジュールが更新されました',
        body: `${data.schedule.title} - ${this.formatDateTime(data.schedule.startTime)}`,
        tag: `schedule-${data.schedule.id}`,
        data: {
          type: 'schedule_updated',
          scheduleId: data.schedule.id
        }
      });
    }
  }

  // Send schedule deleted notification
  async notifyScheduleDeleted(data: ScheduleNotificationData): Promise<void> {
    const preferences = await this.getUserPreferences(data.user.id);
    if (!preferences) return;


    // Check if user wants push notifications for schedule deletion
    if (preferences.pushEnabled && preferences.pushScheduleDeleted) {
      await this.sendPush({
        userId: data.user.id,
        title: 'スケジュールが削除されました',
        body: `${data.schedule.title} - ${this.formatDateTime(data.schedule.startTime)}`,
        tag: `schedule-${data.schedule.id}`,
        data: {
          type: 'schedule_deleted',
          scheduleId: data.schedule.id
        }
      });
    }
  }

  // Send schedule reminder notification
  async notifyScheduleReminder(data: ScheduleNotificationData): Promise<void> {
    const preferences = await this.getUserPreferences(data.user.id);
    if (!preferences) return;


    // Check if user wants push reminders
    if (preferences.pushEnabled && preferences.pushScheduleReminder) {
      await this.sendPush({
        userId: data.user.id,
        title: `リマインダー: ${data.schedule.title}`,
        body: `${data.timeUntilEvent}後に開始されます`,
        tag: `reminder-${data.schedule.id}`,
        data: {
          type: 'schedule_reminder',
          scheduleId: data.schedule.id
        },
        requireInteraction: true,
        actions: [
          { action: 'view', title: '詳細を見る' },
          { action: 'join', title: '参加する' }
        ]
      });
    }
  }

  // Get notification logs for a user (DISABLED)
  async getUserNotificationLogs(
    userId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<NotificationLog[]> {
    // Notification logs disabled - table removed
    console.log('通知ログ取得スキップ（テーブル削除済み）');
    return [];
  }

  // Mark notification as read (DISABLED)
  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    // Notification logs disabled - table removed
    console.log('通知既読設定スキップ（テーブル削除済み）');
    return true;
  }

  // Mark all notifications as read for a user (DISABLED)
  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    // Notification logs disabled - table removed
    console.log('全通知既読設定スキップ（テーブル削除済み）');
    return true;
  }

  // Log notification to database (DISABLED)
  async logNotification(log: Omit<NotificationLog, 'id' | 'createdAt'>): Promise<void> {
    // Notification logging disabled - table removed
    console.log('通知ログ保存スキップ（テーブル削除済み）');
    return;
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    }).format(date);
  }

  private getNotificationCategory(templateName: string): NotificationCategory {
    const categoryMap: Record<string, NotificationCategory> = {
      schedule_created: 'schedule_created',
      schedule_updated: 'schedule_updated',
      schedule_deleted: 'schedule_deleted',
      schedule_reminder: 'schedule_reminder',
      leave_request_submitted: 'leave_request_submitted',
      leave_request_approved: 'leave_request_approved',
      leave_request_rejected: 'leave_request_rejected'
    };

    return categoryMap[templateName] || 'schedule_created';
  }

  private getCategoryFromData(data?: Record<string, any>): NotificationCategory {
    if (!data?.type) return 'schedule_created';
    
    const typeMap: Record<string, NotificationCategory> = {
      schedule_created: 'schedule_created',
      schedule_updated: 'schedule_updated',
      schedule_deleted: 'schedule_deleted',
      schedule_reminder: 'schedule_reminder',
      leave_request: 'leave_request_submitted',
      leave_approved: 'leave_request_approved',
      leave_rejected: 'leave_request_rejected'
    };

    return typeMap[data.type] || 'schedule_created';
  }

  private mapNotificationLogFromDb(data: any): NotificationLog {
    return {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      category: data.category,
      subject: data.subject,
      content: data.content,
      metadata: data.metadata || {},
      status: data.status,
      errorMessage: data.error_message,
      sentAt: data.sent_at ? new Date(data.sent_at) : undefined,
      createdAt: new Date(data.created_at),
      isRead: data.is_read || false,
      readAt: data.read_at ? new Date(data.read_at) : undefined
    };
  }

  private mapPreferencesFromDb(data: any): NotificationPreferences {
    // 既存のテーブル構造に基づいてデフォルト値を返す
    // 既存のDBには詳細な設定がないため、シンプルにデフォルト値を使用
    const defaults = this.getDefaultPreferences();
    return {
      ...defaults,
      id: data.id,
      userId: data.user_id
    };
  }

  private mapPreferencesToDb(preferences: Partial<NotificationPreferences>): any {
    const dbPreferences: any = {};

    if (preferences.emailEnabled !== undefined) dbPreferences.email_enabled = preferences.emailEnabled;
    if (preferences.emailScheduleCreated !== undefined) dbPreferences.email_schedule_created = preferences.emailScheduleCreated;
    if (preferences.emailScheduleUpdated !== undefined) dbPreferences.email_schedule_updated = preferences.emailScheduleUpdated;
    if (preferences.emailScheduleDeleted !== undefined) dbPreferences.email_schedule_deleted = preferences.emailScheduleDeleted;
    if (preferences.emailScheduleReminder !== undefined) dbPreferences.email_schedule_reminder = preferences.emailScheduleReminder;
    if (preferences.emailLeaveRequest !== undefined) dbPreferences.email_leave_request = preferences.emailLeaveRequest;
    if (preferences.emailLeaveApproval !== undefined) dbPreferences.email_leave_approval = preferences.emailLeaveApproval;
    if (preferences.pushEnabled !== undefined) dbPreferences.push_enabled = preferences.pushEnabled;
    if (preferences.pushScheduleCreated !== undefined) dbPreferences.push_schedule_created = preferences.pushScheduleCreated;
    if (preferences.pushScheduleUpdated !== undefined) dbPreferences.push_schedule_updated = preferences.pushScheduleUpdated;
    if (preferences.pushScheduleDeleted !== undefined) dbPreferences.push_schedule_deleted = preferences.pushScheduleDeleted;
    if (preferences.pushScheduleReminder !== undefined) dbPreferences.push_schedule_reminder = preferences.pushScheduleReminder;
    if (preferences.pushLeaveRequest !== undefined) dbPreferences.push_leave_request = preferences.pushLeaveRequest;
    if (preferences.pushLeaveApproval !== undefined) dbPreferences.push_leave_approval = preferences.pushLeaveApproval;
    if (preferences.pushSubscription !== undefined) dbPreferences.push_subscription = preferences.pushSubscription;
    if (preferences.defaultReminderTime !== undefined) dbPreferences.default_reminder_time = preferences.defaultReminderTime;
    if (preferences.quietHoursEnabled !== undefined) dbPreferences.quiet_hours_enabled = preferences.quietHoursEnabled;
    if (preferences.quietHoursStart !== undefined) dbPreferences.quiet_hours_start = preferences.quietHoursStart;
    if (preferences.quietHoursEnd !== undefined) dbPreferences.quiet_hours_end = preferences.quietHoursEnd;

    return dbPreferences;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();