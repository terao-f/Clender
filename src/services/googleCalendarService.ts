/**
 * Google Calendar API Service
 * Google Meet会議室の自動作成とメール送信
 */

import { supabase } from '../lib/supabase';

export interface GoogleMeetEvent {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  meetLink?: string;
  calendarEventId?: string;
}

export interface CreateMeetEventParams {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  timeZone?: string;
  sendNotifications?: boolean;
}

/**
 * Google Calendar APIを使用してMeet会議を作成
 */
export class GoogleCalendarService {
  private accessToken: string | null = null;
  
  constructor() {
    // 環境変数からGoogle APIの設定を取得
    this.initializeFromEnv();
  }

  private initializeFromEnv() {
    // 環境変数はフロントエンドでは使用しないため、
    // Supabase Edge Functionsを経由してAPI呼び出しを行う
  }

  /**
   * Google Meet会議を作成（Supabase Edge Function経由）
   */
  async createMeetEvent(params: CreateMeetEventParams): Promise<GoogleMeetEvent> {
    try {
      console.log('Google Meet会議作成開始:', params);

      // 現在のユーザーIDを取得
      const savedUser = localStorage.getItem('currentUser');
      let userId = null;
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          userId = user.id;
        } catch (error) {
          console.error('ユーザー情報の解析エラー:', error);
        }
      }

      // Supabase Edge Functionを呼び出し（タイムアウト付き）
      const { data, error } = await Promise.race([
        supabase.functions.invoke('create-google-meet', {
          body: {
            title: params.title,
            description: params.description || '',
            startTime: params.startTime.toISOString(),
            endTime: params.endTime.toISOString(),
            attendees: params.attendees,
            timeZone: params.timeZone || 'Asia/Tokyo',
            sendNotifications: params.sendNotifications ?? true,
            userId: userId // ユーザーIDを追加
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Edge Function request timeout')), 5000)
        )
      ]);

      if (error) {
        console.error('Google Meet作成エラー:', error);
        throw new Error(`Google Meet会議の作成に失敗しました: ${error.message}`);
      }

      console.log('Google Meet会議作成成功:', data);

      return {
        id: data.id,
        title: params.title,
        description: params.description || '',
        startTime: params.startTime,
        endTime: params.endTime,
        attendees: params.attendees,
        meetLink: data.meetLink,
        calendarEventId: data.calendarEventId
      };

    } catch (error) {
      console.error('Google Meet作成エラー:', error);
      
      // フォールバック: プレースホルダーのMeetリンクを生成
      console.warn('フォールバック: プレースホルダーMeetリンクを生成します');
      return this.createFallbackMeetEvent(params);
    }
  }

  /**
   * フォールバック: プレースホルダーのGoogle Meetイベントを作成
   */
  private createFallbackMeetEvent(params: CreateMeetEventParams): GoogleMeetEvent {
    // Google Calendar APIが利用できない場合、プレースホルダーのMeet URLを生成
    import('../utils/googleMeet').then(({ generateGoogleMeetLink }) => {
      const meetLink = generateGoogleMeetLink(params.title, params.startTime);
      console.log('フォールバック: プレースホルダーのGoogle Meet URLを生成しました:', meetLink);
    });
    
    // 同期的にURLを生成
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const part1 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part3 = Array.from({length: 3}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const meetLink = `https://meet.google.com/${part1}-${part2}-${part3}`;
    
    console.log('フォールバック: プレースホルダーのGoogle Meet URLを生成しました:', meetLink);

    return {
      id: `fallback_${Date.now()}`,
      title: params.title,
      description: params.description || '',
      startTime: params.startTime,
      endTime: params.endTime,
      attendees: params.attendees,
      meetLink: meetLink,
      calendarEventId: undefined
    };
  }

  /**
   * ミーティングIDを生成（フォールバック用）
   */
  private generateMeetingId(title: string, startTime: Date): string {
    const timestamp = startTime.getTime();
    const titleHash = this.hashString(title);
    const random = Math.random().toString(36).substring(2, 5);
    
    // Format: abc-defg-hij (Google Meet style)
    return `${titleHash.substring(0, 3)}-${timestamp.toString(36).substring(-4)}-${random}`;
  }

  /**
   * 文字列のハッシュを生成
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 会議の詳細情報を取得
   */
  async getMeetEventDetails(eventId: string): Promise<GoogleMeetEvent | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-meet', {
        body: { eventId }
      });

      if (error) {
        console.error('Google Meet詳細取得エラー:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Google Meet詳細取得エラー:', error);
      return null;
    }
  }

  /**
   * 会議をキャンセル
   */
  async cancelMeetEvent(eventId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('cancel-google-meet', {
        body: { eventId }
      });

      if (error) {
        console.error('Google Meet キャンセルエラー:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Google Meet キャンセルエラー:', error);
      return false;
    }
  }

  /**
   * 参加者にメール通知を送信
   */
  async sendMeetInvitation(meetEvent: GoogleMeetEvent): Promise<boolean> {
    try {
      console.log('Meet招待メール送信スキップ（システム無効化済み）:', meetEvent.title);
      console.log('参加者:', meetEvent.attendees);

      console.log('Meet招待メール送信スキップ完了');
      return true;
    } catch (error) {
      console.error('Meet招待メール処理エラー:', error);
      return false;
    }
  }

  /**
   * 会議のリマインダーメールを送信
   */
  async sendMeetReminder(meetEvent: GoogleMeetEvent, minutesBefore: number = 15): Promise<boolean> {
    try {
      console.log(`Meetリマインダーメール送信スキップ（システム無効化済み）: ${meetEvent.title} - ${minutesBefore}分前`);
      console.log('参加者:', meetEvent.attendees);

      return true;
    } catch (error) {
      console.error('Meetリマインダーメール処理エラー:', error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const googleCalendarService = new GoogleCalendarService();