import { supabase } from '../lib/supabase';
import { notificationService } from './notificationService';
import { ScheduledNotification, Schedule, User } from '../types';

class SchedulerService {
  private checkInterval: number | null = null;
  private isRunning = false;

  // Start the scheduler
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    // Check for scheduled notifications every minute
    this.checkInterval = window.setInterval(() => {
      this.processScheduledNotifications();
    }, 60000); // 60 seconds

    // Run immediately
    this.processScheduledNotifications();
  }

  // Stop the scheduler
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
  }

  // Process scheduled notifications
  private async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

      // Fetch notifications scheduled for the next 5 minutes
      const { data: scheduledNotifications, error } = await supabase
        .from('scheduled_notifications')
        .select(`
          *,
          schedules (
            id,
            title,
            type,
            start_time,
            end_time,
            details,
            meet_link,
            participants,
            equipment
          )
        `)
        .eq('status', 'pending')
        .lte('scheduled_for', fiveMinutesFromNow.toISOString())
        .order('scheduled_for', { ascending: true });

      if (error) {
        console.error('Error fetching scheduled notifications:', error);
        return;
      }

      if (!scheduledNotifications || scheduledNotifications.length === 0) {
        return;
      }

      // Process each notification
      for (const notification of scheduledNotifications) {
        await this.processNotification(notification);
      }
    } catch (error) {
      console.error('Error in processScheduledNotifications:', error);
    }
  }

  // Process a single notification
  private async processNotification(notification: any): Promise<void> {
    try {
      const scheduledTime = new Date(notification.scheduled_for);
      const now = new Date();

      // If the scheduled time hasn't arrived yet, skip
      if (scheduledTime > now) {
        return;
      }

      // Get user information
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', notification.user_id)
        .single();

      if (userError || !user) {
        console.error('User not found for notification:', notification.user_id);
        await this.markNotificationAsFailed(notification.id, 'User not found');
        return;
      }

      // Get schedule participants' names
      const participantNames = await this.getParticipantNames(notification.schedules.participants);

      // Calculate time until event
      const eventTime = new Date(notification.schedules.start_time);
      const timeUntilEvent = this.formatTimeUntil(eventTime, now);

      // Prepare notification data
      const notificationData = {
        schedule: {
          id: notification.schedules.id,
          title: notification.schedules.title,
          type: notification.schedules.type,
          startTime: new Date(notification.schedules.start_time),
          endTime: new Date(notification.schedules.end_time),
          details: notification.schedules.details,
          meetLink: notification.schedules.meet_link,
          participants: participantNames,
          location: this.getLocationFromEquipment(notification.schedules.equipment)
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        timeUntilEvent
      };

      // Send the reminder notification
      await notificationService.notifyScheduleReminder(notificationData);

      // Mark notification as sent
      await this.markNotificationAsSent(notification.id);
    } catch (error) {
      console.error('Error processing notification:', error);
      await this.markNotificationAsFailed(
        notification.id, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // Mark notification as sent
  private async markNotificationAsSent(notificationId: string): Promise<void> {
    await supabase
      .from('scheduled_notifications')
      .update({ status: 'sent' })
      .eq('id', notificationId);
  }

  // Mark notification as failed
  private async markNotificationAsFailed(notificationId: string, error: string): Promise<void> {
    await supabase
      .from('scheduled_notifications')
      .update({ status: 'failed' })
      .eq('id', notificationId);
  }

  // Get participant names
  private async getParticipantNames(participantIds: string[]): Promise<string[]> {
    if (!participantIds || participantIds.length === 0) return [];

    const { data: users } = await supabase
      .from('users')
      .select('name')
      .in('id', participantIds);

    return users?.map(u => u.name) || [];
  }

  // Get location from equipment
  private getLocationFromEquipment(equipment: any[]): string | undefined {
    if (!equipment || equipment.length === 0) return undefined;

    const rooms = equipment.filter(e => e.type === 'room');
    if (rooms.length > 0) {
      return rooms.map(r => r.name).join(', ');
    }

    return undefined;
  }

  // Format time until event
  private formatTimeUntil(eventTime: Date, currentTime: Date): string {
    const diffMs = eventTime.getTime() - currentTime.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes <= 0) {
      return '今すぐ';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      if (minutes === 0) {
        return `${hours}時間`;
      } else {
        return `${hours}時間${minutes}分`;
      }
    }
  }

  // Schedule immediate notification for testing
  async sendTestReminder(scheduleId: string, userId: string): Promise<boolean> {
    try {
      // Get schedule information
      const { data: schedule, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (scheduleError || !schedule) {
        console.error('Schedule not found:', scheduleId);
        return false;
      }

      // Get user information
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error('User not found:', userId);
        return false;
      }

      // Get participant names
      const participantNames = await this.getParticipantNames(schedule.participants);

      // Prepare notification data
      const notificationData = {
        schedule: {
          id: schedule.id,
          title: schedule.title,
          type: schedule.type,
          startTime: new Date(schedule.start_time),
          endTime: new Date(schedule.end_time),
          details: schedule.details,
          meetLink: schedule.meet_link,
          participants: participantNames,
          location: this.getLocationFromEquipment(schedule.equipment)
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        timeUntilEvent: '15分'
      };

      // Send the test notification
      await notificationService.notifyScheduleReminder(notificationData);

      return true;
    } catch (error) {
      console.error('Error sending test reminder:', error);
      return false;
    }
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();