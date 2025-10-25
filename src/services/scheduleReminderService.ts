import { supabase } from '../lib/supabase';
import { scheduleNotificationService } from './scheduleNotificationService';
import { Schedule, User } from '../types';

/**
 * スケジュールリマインダーサービス
 * 定期的にスケジュールをチェックして、指定時間前にリマインダーメールを送信
 */
export class ScheduleReminderService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 60 * 1000; // 1分間隔でチェック

  /**
   * リマインダーサービスを開始
   */
  start(): void {
    if (this.isRunning) {
      console.log('ScheduleReminderService already running');
      return;
    }

    console.log('Starting ScheduleReminderService...');
    this.isRunning = true;
    
    // 初回実行
    this.checkUpcomingSchedules();
    
    // 定期実行を開始
    this.intervalId = setInterval(() => {
      this.checkUpcomingSchedules();
    }, this.checkIntervalMs);
  }

  /**
   * リマインダーサービスを停止
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('ScheduleReminderService not running');
      return;
    }

    console.log('Stopping ScheduleReminderService...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 近づいているスケジュールをチェックしてリマインダーを送信
   */
  private async checkUpcomingSchedules(): Promise<void> {
    try {
      console.log('=== リマインダーチェック開始 ===');
      
      const now = new Date();
      const checkEndTime = new Date(now.getTime() + 30 * 60 * 1000); // 30分後まで
      
      // 30分以内に開始されるスケジュールを取得
      const { data: upcomingSchedules, error } = await supabase
        .from('schedules')
        .select('*')
        .gte('start_time', now.toISOString())
        .lte('start_time', checkEndTime.toISOString())
        .order('start_time');

      if (error) {
        console.error('スケジュール取得エラー:', error);
        return;
      }

      if (!upcomingSchedules || upcomingSchedules.length === 0) {
        console.log('リマインダー対象のスケジュールなし');
        return;
      }

      console.log(`${upcomingSchedules.length}件のスケジュールをチェック中...`);

      for (const scheduleData of upcomingSchedules) {
        const schedule: Schedule = {
          id: scheduleData.id,
          type: scheduleData.type,
          title: scheduleData.title,
          details: scheduleData.details || '',
          startTime: new Date(scheduleData.start_time),
          endTime: new Date(scheduleData.end_time),
          isAllDay: scheduleData.is_all_day,
          isMultiDay: scheduleData.is_multi_day || false,
          recurrence: scheduleData.recurrence,
          participants: scheduleData.participants || [],
          equipment: scheduleData.equipment || [],
          reminders: scheduleData.reminders || [],
          meetLink: scheduleData.meet_link,
          meetingType: scheduleData.meeting_type || 'in-person',
          createdBy: scheduleData.created_by,
          createdAt: new Date(scheduleData.created_at),
          updatedBy: scheduleData.updated_by,
          updatedAt: scheduleData.updated_at ? new Date(scheduleData.updated_at) : null
        };

        await this.processScheduleReminders(schedule, now);
      }

      console.log('=== リマインダーチェック完了 ===');
    } catch (error) {
      console.error('リマインダーチェック中にエラー:', error);
    }
  }

  /**
   * 個別スケジュールのリマインダーを処理
   */
  private async processScheduleReminders(schedule: Schedule, now: Date): Promise<void> {
    const minutesUntilStart = Math.floor((schedule.startTime.getTime() - now.getTime()) / (1000 * 60));
    
    // デフォルトのリマインダー時間（15分前、5分前）
    const defaultReminderMinutes = [15, 5];
    
    // スケジュールに設定されたリマインダー時間を使用、なければデフォルト
    const reminderMinutes = schedule.reminders && schedule.reminders.length > 0 
      ? schedule.reminders.map(r => r.minutesBefore || 15)
      : defaultReminderMinutes;

    for (const reminderMinute of reminderMinutes) {
      // リマインダー時間の範囲内かチェック（±1分の余裕を持たせる）
      if (Math.abs(minutesUntilStart - reminderMinute) <= 1) {
        console.log(`スケジュール "${schedule.title}" の${reminderMinute}分前リマインダーを送信`);
        
        // 既に送信済みかチェック
        const alreadySent = await this.isReminderAlreadySent(schedule.id, reminderMinute);
        if (alreadySent) {
          console.log(`既に送信済み: ${schedule.id} - ${reminderMinute}分前`);
          continue;
        }

        // 参加者にリマインダーを送信
        await this.sendReminderToParticipants(schedule, reminderMinute);
        
        // 送信記録を保存
        await this.recordReminderSent(schedule.id, reminderMinute);
      }
    }
  }

  /**
   * 参加者にリマインダーメールを送信
   */
  private async sendReminderToParticipants(schedule: Schedule, reminderMinutes: number): Promise<void> {
    if (schedule.participants.length === 0) {
      console.log('参加者がいないためリマインダーをスキップ');
      return;
    }

    try {
      // 参加者情報を取得
      const { data: participantsData, error } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', schedule.participants);

      if (error) {
        console.error('参加者データ取得エラー:', error);
        return;
      }

      if (!participantsData || participantsData.length === 0) {
        console.log('参加者データが見つかりません');
        return;
      }

      // ユーザー設定をチェックして、リマインダー通知が有効な参加者のみに送信
      const eligibleParticipants = await this.filterEligibleParticipants(participantsData);

      if (eligibleParticipants.length === 0) {
        console.log('リマインダー通知が有効な参加者がいないため送信をスキップ');
        return;
      }

      console.log(`リマインダー送信対象: ${eligibleParticipants.length}/${participantsData.length}人`);

      // リマインダーメールを送信
      const emailSent = await scheduleNotificationService.sendScheduleReminderNotification(
        schedule,
        eligibleParticipants,
        reminderMinutes
      );

      if (emailSent) {
        console.log(`✅ ${reminderMinutes}分前リマインダーメール送信成功: ${schedule.title}`);
      } else {
        console.log(`❌ ${reminderMinutes}分前リマインダーメール送信失敗: ${schedule.title}`);
      }
    } catch (error) {
      console.error('リマインダーメール送信エラー:', error);
    }
  }

  /**
   * リマインダー通知が有効な参加者のみをフィルタリング
   */
  private async filterEligibleParticipants(participants: any[]): Promise<any[]> {
    try {
      const participantIds = participants.map(p => p.id);
      
      // ユーザー設定を一括取得
      const { data: settingsData, error } = await supabase
        .from('user_notification_settings')
        .select('user_id, reminder_notifications')
        .in('user_id', participantIds);

      if (error) {
        console.error('通知設定取得エラー:', error);
        // エラーの場合は全員に送信（デフォルト動作）
        return participants;
      }

      // 設定がないユーザーはデフォルトで有効とする
      const settingsMap = new Map();
      settingsData?.forEach(setting => {
        settingsMap.set(setting.user_id, setting.reminder_notifications);
      });

      // リマインダー通知が有効な参加者のみを返す
      const eligibleParticipants = participants.filter(participant => {
        const isEnabled = settingsMap.get(participant.id) ?? true; // デフォルトは有効
        if (!isEnabled) {
          console.log(`リマインダー通知無効: ${participant.name} (${participant.email})`);
        }
        return isEnabled;
      });

      return eligibleParticipants;
    } catch (error) {
      console.error('参加者フィルタリングエラー:', error);
      // エラーの場合は全員に送信（デフォルト動作）
      return participants;
    }
  }

  /**
   * リマインダー送信済みかチェック
   */
  private async isReminderAlreadySent(scheduleId: string, reminderMinutes: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('reminder_logs')
        .select('id')
        .eq('schedule_id', scheduleId)
        .eq('reminder_minutes', reminderMinutes)
        .limit(1);

      if (error) {
        console.error('リマインダーログチェックエラー:', error);
        return false; // エラーの場合は送信していないものとして扱う
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('リマインダーログチェック中にエラー:', error);
      return false;
    }
  }

  /**
   * リマインダー送信記録を保存
   */
  private async recordReminderSent(scheduleId: string, reminderMinutes: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('reminder_logs')
        .insert({
          schedule_id: scheduleId,
          reminder_minutes: reminderMinutes,
          sent_at: new Date().toISOString()
        });

      if (error) {
        console.error('リマインダーログ保存エラー:', error);
      } else {
        console.log(`リマインダーログ保存完了: ${scheduleId} - ${reminderMinutes}分前`);
      }
    } catch (error) {
      console.error('リマインダーログ保存中にエラー:', error);
    }
  }

  /**
   * 手動でリマインダーをテスト送信
   */
  async testReminder(scheduleId: string, reminderMinutes: number = 15): Promise<boolean> {
    try {
      console.log(`=== テストリマインダー送信: ${scheduleId} ===`);
      
      const { data: scheduleData, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (error || !scheduleData) {
        console.error('スケジュール取得エラー:', error);
        return false;
      }

      const schedule: Schedule = {
        id: scheduleData.id,
        type: scheduleData.type,
        title: scheduleData.title,
        details: scheduleData.details || '',
        startTime: new Date(scheduleData.start_time),
        endTime: new Date(scheduleData.end_time),
        isAllDay: scheduleData.is_all_day,
        isMultiDay: scheduleData.is_multi_day || false,
        recurrence: scheduleData.recurrence,
        participants: scheduleData.participants || [],
        equipment: scheduleData.equipment || [],
        reminders: scheduleData.reminders || [],
        meetLink: scheduleData.meet_link,
        meetingType: scheduleData.meeting_type || 'in-person',
        createdBy: scheduleData.created_by,
        createdAt: new Date(scheduleData.created_at),
        updatedBy: scheduleData.updated_by,
        updatedAt: scheduleData.updated_at ? new Date(scheduleData.updated_at) : null
      };

      await this.sendReminderToParticipants(schedule, reminderMinutes);
      return true;

    } catch (error) {
      console.error('テストリマインダー送信エラー:', error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const scheduleReminderService = new ScheduleReminderService();