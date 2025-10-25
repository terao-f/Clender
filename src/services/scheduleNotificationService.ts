import { supabase } from '../lib/supabase';
import { Schedule, User } from '../types';

export interface ScheduleNotificationParams {
  schedule: Schedule;
  participants: User[];
  type: 'created' | 'updated' | 'deleted' | 'reminder' | 'meet_url';
  reminderMinutes?: number;
  operatorName?: string;
}

/**
 * スケジュール通知メール送信サービス
 */
export class ScheduleNotificationService {
  
  /**
   * スケジュール通知メールを送信
   */
  async sendScheduleNotificationEmail(params: ScheduleNotificationParams): Promise<boolean> {
    const { schedule, participants, type, reminderMinutes, operatorName } = params;

    try {
      console.log('=== スケジュール通知メール送信開始 ===');
      console.log('スケジュールID:', schedule.id);
      console.log('通知タイプ:', type);
      console.log('タイトル:', schedule.title);
      console.log('参加者数:', participants.length);
      console.log('実際の参加者:', participants.map(p => `${p.name} (${p.email})`));
      console.log('本番環境: 実際のメールアドレスに送信します');

      if (participants.length === 0) {
        console.warn('メール受信者が見つかりません');
        return false;
      }

      // メール通知が有効な参加者のみをフィルタリング
      const eligibleParticipants = await this.filterEligibleEmailParticipants(participants, type);

      if (eligibleParticipants.length === 0) {
        console.log('メール通知が有効な参加者がいないため送信をスキップ');
        return true; // スキップは成功として扱う
      }

      console.log(`メール送信対象: ${eligibleParticipants.length}/${participants.length}人`);

      // アプリのベースURL（本番環境のURLを使用）
      // Vercelのデプロイ環境を自動検出
      let appUrl = window.location.origin;
      
      // 開発環境の場合、Vercelの本番URLを使用
      if (window.location.hostname === 'localhost') {
        // Vercelの新しいデプロイURLに更新
        appUrl = 'https://clender-app.vercel.app';
      }
      
      // VercelのプレビューURLの場合も本番URLを使用
      if (window.location.hostname.includes('vercel.app') && !window.location.hostname.includes('clender-app')) {
        appUrl = 'https://clender-app.vercel.app';
      }
      
      console.log('メールリンクURL:', appUrl);

      // メール送信データを準備（Resend制限対応）
      const participantEmails = eligibleParticipants.map(p => p.email).filter(email => email && email.trim() !== '');
      
      console.log('実際の参加者メール:', participantEmails);

      const emailData = {
        to: participantEmails,
        type,
        schedule: {
          id: schedule.id,
          title: schedule.title,
          description: schedule.details || '',
          startTime: schedule.startTime.toISOString(),
          endTime: schedule.endTime.toISOString(),
          type: schedule.type,
          location: this.getLocationDisplay(schedule),
          meetLink: schedule.meetLink,
          participants: eligibleParticipants.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email
          }))
        },
        reminderMinutes,
        appUrl,
        operatorName
      };

      console.log('メール送信データ:', JSON.stringify(emailData, null, 2));

      // Supabase Edge Functionを呼び出してメール送信
      console.log('📧📧📧 Calling Edge Function: send-schedule-notification-email');
      console.log('📧📧📧 送信先メールアドレス:', participantEmails);
      const { data, error } = await supabase.functions.invoke('send-schedule-notification-email', {
        body: emailData
      });
      console.log('📧📧📧 Edge Function response:', { data, error });

      if (error) {
        console.error('スケジュール通知Edge Functionエラー:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return false;
      }

      if (!data) {
        console.error('Edge Functionからレスポンスがありません');
        return false;
      }

      if (!data.success) {
        console.error('スケジュール通知メール送信失敗:', data.error);
        console.error('Full response data:', JSON.stringify(data, null, 2));
        return false;
      }

      console.log('スケジュール通知メール送信成功:', data.data);
      console.log('=== スケジュール通知メール送信完了 ===');
      
      return true;

    } catch (error) {
      console.error('スケジュール通知メール送信エラー:', error);
      return false;
    }
  }

  /**
   * スケジュール作成通知
   */
  async sendScheduleCreatedNotification(
    schedule: Schedule,
    participants: User[],
    operatorName?: string
  ): Promise<boolean> {
    // Google Meet URLがある場合は専用テンプレートを使用
    const emailType = schedule.meetLink ? 'meet_url' : 'created';
    
    return this.sendScheduleNotificationEmail({
      schedule,
      participants,
      type: emailType,
      operatorName
    });
  }

  /**
   * スケジュール変更通知
   */
  async sendScheduleUpdatedNotification(
    schedule: Schedule,
    participants: User[],
    operatorName?: string
  ): Promise<boolean> {
    return this.sendScheduleNotificationEmail({
      schedule,
      participants,
      type: 'updated',
      operatorName
    });
  }

  /**
   * スケジュール削除通知
   */
  async sendScheduleDeletedNotification(
    schedule: Schedule,
    participants: User[],
    operatorName?: string
  ): Promise<boolean> {
    return this.sendScheduleNotificationEmail({
      schedule,
      participants,
      type: 'deleted',
      operatorName
    });
  }

  /**
   * スケジュールリマインダー通知
   */
  async sendScheduleReminderNotification(
    schedule: Schedule,
    participants: User[],
    reminderMinutes: number = 15
  ): Promise<boolean> {
    return this.sendScheduleNotificationEmail({
      schedule,
      participants,
      type: 'reminder',
      reminderMinutes
    });
  }

  /**
   * Google Meet URL専用通知
   */
  async sendMeetUrlNotification(
    schedule: Schedule,
    participants: User[]
  ): Promise<boolean> {
    return this.sendScheduleNotificationEmail({
      schedule,
      participants,
      type: 'meet_url'
    });
  }

  /**
   * メール通知が有効な参加者のみをフィルタリング
   */
  private async filterEligibleEmailParticipants(participants: User[], type: string): Promise<User[]> {
    try {
      const participantIds = participants.map(p => p.id);
      
      // ユーザー設定を一括取得
      const { data: settingsData, error } = await supabase
        .from('user_notification_settings')
        .select('user_id, email_notifications')
        .in('user_id', participantIds);

      if (error) {
        console.error('通知設定取得エラー:', error);
        // エラーの場合は全員に送信（デフォルト動作）
        return participants;
      }

      // 設定がないユーザーはデフォルトで有効とする
      const settingsMap = new Map();
      settingsData?.forEach(setting => {
        settingsMap.set(setting.user_id, setting.email_notifications);
      });

      // メール通知が有効な参加者のみを返す
      const eligibleParticipants = participants.filter(participant => {
        const isEnabled = settingsMap.get(participant.id) ?? true; // デフォルトは有効
        if (!isEnabled) {
          console.log(`メール通知無効: ${participant.name} (${participant.email})`);
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
   * 場所の表示用文字列を取得
   */
  private getLocationDisplay(schedule: Schedule): string {
    if (schedule.meetLink) {
      return 'オンライン会議';
    }
    
    // equipment配列から会議室情報を取得
    const room = schedule.equipment?.find(e => e.type === 'room');
    if (room) {
      return room.name;
    }
    
    return '場所未設定';
  }
}

// シングルトンインスタンス
export const scheduleNotificationService = new ScheduleNotificationService();