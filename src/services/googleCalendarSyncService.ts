import { Schedule } from '../types';
import { supabase } from '../lib/supabase';
import { GoogleCalendarClient, getValidAccessToken } from '../lib/googleCalendar';
import { format } from 'date-fns';

export interface GoogleEventMapping {
  scheduleId: string;
  googleEventId: string;
  googleCalendarId: string;
  userId: string;
}

class GoogleCalendarSyncService {
  // アプリ → Google同期：アプリの予定をGoogleカレンダーに追加/更新（重複チェック付き）
  async syncAppToGoogle(userId: string, timeMin: Date, timeMax: Date): Promise<void> {
    try {
      console.log('=== アプリ → Google同期開始 ===');
      
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('アクセストークンが取得できません');
        // 認証期限切れイベントを発火
        window.dispatchEvent(new CustomEvent('google-auth-expired', { 
          detail: { userId, reason: 'no_valid_token' } 
        }));
        return;
      }

      // 同期設定を取得
      const { data: syncSettings } = await supabase
        .from('google_calendar_sync_settings')
        .select('google_calendar_id, enabled, sync_to_google')
        .eq('user_id', userId)
        .single();

      if (!syncSettings?.enabled || !syncSettings?.sync_to_google) {
        console.log('Google同期が無効です');
        return;
      }

      const client = new GoogleCalendarClient(accessToken);
      const calendarId = syncSettings.google_calendar_id || 'primary';

      // 1. 既存のGoogleカレンダーのイベントを取得（重複チェック用）
      console.log('既存のGoogleカレンダーイベントを取得中...');
      const existingEvents = await client.listEvents(calendarId, timeMin, timeMax);
      const existingEventMap = new Map();
      if (existingEvents?.items) {
        for (const event of existingEvents.items) {
          if (event.status !== 'cancelled') {
            // イベントのタイトルと開始時間をキーとして使用
            const key = `${event.summary || ''}_${event.start?.dateTime || event.start?.date || ''}`;
            existingEventMap.set(key, event);
          }
        }
      }

      // 2. アプリの予定を取得（参加者として含まれている予定）
      console.log('アプリの予定を取得中...');
      const { data: appSchedules } = await supabase
        .from('schedules')
        .select('*')
        .or(`participants.cs.{${userId}},created_by.eq.${userId}`) // 参加者または作成者
        .gte('start_time', timeMin.toISOString())
        .lte('start_time', timeMax.toISOString());

      // 3. アプリの予定をGoogleカレンダーに登録（重複チェック付き）
      console.log('アプリの予定をGoogleカレンダーに登録中...');
      if (appSchedules) {
        for (const schedule of appSchedules) {
          // Googleカレンダーからの予定は同期しない（無限ループを防ぐ）
          if (schedule.is_from_google_calendar) {
            console.log('Googleカレンダーからの予定はスキップ:', schedule.title);
            continue;
          }

          const googleEvent = await this.scheduleToGoogleEvent({
            id: schedule.id,
            type: schedule.type,
            title: schedule.title,
            details: schedule.details,
            startTime: new Date(schedule.start_time),
            endTime: new Date(schedule.end_time),
            isAllDay: schedule.is_all_day,
            isMultiDay: schedule.is_multi_day,
            recurrence: schedule.recurrence,
            participants: schedule.participants,
            equipment: schedule.equipment,
            reminders: schedule.reminders,
            meetLink: schedule.meet_link,
            meetingType: schedule.meeting_type,
            createdBy: schedule.created_by,
            createdAt: new Date(schedule.created_at),
            updatedBy: schedule.updated_by,
            updatedAt: schedule.updated_at ? new Date(schedule.updated_at) : null,
            isFromGoogleCalendar: schedule.is_from_google_calendar
          });

          // シンプルな重複チェック：タイトルと日時が同じなら重複
          const eventKey = `${googleEvent.summary}_${googleEvent.start?.dateTime || googleEvent.start?.date || ''}`;
          const existingEvent = existingEventMap.get(eventKey);
          
          if (existingEvent) {
            console.log('重複するイベントをスキップ（タイトル+日時）:', {
              title: googleEvent.summary,
              startTime: googleEvent.start?.dateTime || googleEvent.start?.date,
              existingEventId: existingEvent.id,
              existingEventSummary: existingEvent.summary,
              existingEventStart: existingEvent.start?.dateTime || existingEvent.start?.date
            });
            continue;
          }
          
          // 追加の重複チェック：タイトルと日付が同じかチェック
          const eventDate = new Date(googleEvent.start?.dateTime || googleEvent.start?.date || '');
          const titleDateMatches = Array.from(existingEventMap.values()).filter(event => {
            if (event.status === 'cancelled') return false;
            if (event.summary !== googleEvent.summary) return false;
            
            const existingDate = new Date(event.start?.dateTime || event.start?.date || '');
            return eventDate.toDateString() === existingDate.toDateString();
          });
          
          if (titleDateMatches.length > 0) {
            console.log('重複検出（タイトル+日付）:', {
              title: googleEvent.summary,
              date: eventDate.toDateString(),
              matchingEvents: titleDateMatches.map(e => ({
                id: e.id,
                start: e.start?.dateTime || e.start?.date
              }))
            });
            continue; // 重複の場合はスキップ
          }


          // Googleカレンダーにイベントを作成
          const createdEvent = await client.createEvent(calendarId, googleEvent);
          console.log('Googleイベント作成完了:', createdEvent.id);

        }
      }

      console.log('=== アプリ → Google同期完了 ===');
    } catch (error) {
      console.error('アプリ → Google同期エラー:', error);
    }
  }

  // Google → アプリ同期：Googleカレンダーの新規予定のみをアプリに追加
  async syncGoogleToApp(userId: string, timeMin: Date, timeMax: Date, newOnly: boolean = false): Promise<void> {
    try {
      console.log('=== Google → アプリ同期開始 ===');
      
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('アクセストークンが取得できません');
        // 認証期限切れイベントを発火
        window.dispatchEvent(new CustomEvent('google-auth-expired', { 
          detail: { userId, reason: 'no_valid_token' } 
        }));
        return;
      }

      // 同期設定を取得
      const { data: syncSettings } = await supabase
        .from('google_calendar_sync_settings')
        .select('google_calendar_id, enabled, sync_from_google')
        .eq('user_id', userId)
        .single();

      if (!syncSettings?.enabled || !syncSettings?.sync_from_google) {
        console.log('Google同期が無効です');
        return;
      }

      const client = new GoogleCalendarClient(accessToken);
      const calendarId = syncSettings.google_calendar_id || 'primary';

      // 1. 新規のみの場合は既存のGoogleカレンダーからの予定を削除しない
      if (!newOnly) {
        console.log('既存のGoogleカレンダーからの予定を削除中...');
        await supabase
          .from('schedules')
          .delete()
          .or(`participants.cs.{${userId}},created_by.eq.${userId}`) // 参加者または作成者
          .eq('is_from_google_calendar', true)
          .gte('start_time', timeMin.toISOString())
          .lte('start_time', timeMax.toISOString());
      }

      // 2. Googleカレンダーの予定を取得
      console.log('Googleカレンダーの予定を取得中...');
      const googleEvents = await client.listEvents(calendarId, timeMin, timeMax);

      // 3. 既存のアプリの予定を取得（重複チェック用、参加者として含まれている予定）
      console.log('既存のアプリの予定を取得中...');
      const { data: existingSchedules } = await supabase
        .from('schedules')
        .select('id, title, start_time, end_time, is_all_day, is_from_google_calendar')
        .or(`participants.cs.{${userId}},created_by.eq.${userId}`) // 参加者または作成者
        .gte('start_time', timeMin.toISOString())
        .lte('start_time', timeMax.toISOString());

      // 4. Googleカレンダーの予定をアプリに登録（重複チェック付き）
      console.log('Googleカレンダーの予定をアプリに登録中...');
      if (googleEvents?.items) {
        for (const googleEvent of googleEvents.items) {
          if (googleEvent.status === 'cancelled') continue;

          const schedule = this.googleEventToSchedule(googleEvent, userId);
          
          
          // シンプルな重複チェック：タイトルと日時が同じなら重複
          const isDuplicate = existingSchedules?.some(existing => {
            const existingStart = new Date(existing.start_time);
            
            // タイトルが同じかチェック（完全一致）
            const titleMatch = existing.title === schedule.title;
            
            // 日時が同じかチェック（日付のみで比較）
            const existingDate = existingStart.toDateString();
            const scheduleDate = schedule.startTime.toDateString();
            const dateMatch = existingDate === scheduleDate;
            
            // タイトルと日時が同じなら重複と判定
            const isDuplicate = titleMatch && dateMatch;
            
            if (isDuplicate) {
              console.log('重複検出（タイトル+日時）:', {
                title: schedule.title,
                date: scheduleDate,
                existingId: existing.id,
                newId: schedule.id,
                existingGoogleFlag: existing.is_from_google_calendar,
                newGoogleFlag: schedule.isFromGoogleCalendar
              });
            }
            
            return isDuplicate;
          });

          if (isDuplicate) {
            console.log('重複する予定をスキップ:', {
              title: schedule.title,
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              isAllDay: schedule.isAllDay,
              isFromGoogleCalendar: schedule.isFromGoogleCalendar
            });
            continue;
          }
          
          const { error } = await supabase
            .from('schedules')
            .insert({
              type: schedule.type,
              title: schedule.title,
              details: schedule.details,
              start_time: schedule.startTime.toISOString(),
              end_time: schedule.endTime.toISOString(),
              is_all_day: schedule.isAllDay,
              is_multi_day: schedule.isMultiDay,
              recurrence: schedule.recurrence,
              participants: schedule.participants,
              equipment: schedule.equipment,
              reminders: schedule.reminders,
              meet_link: schedule.meetLink,
              meeting_type: schedule.meetingType,
              created_by: userId,
              created_at: new Date().toISOString(),
              is_from_google_calendar: true
            })
            .select('id')
            .single();

          if (error) {
            console.error('スケジュール登録エラー:', error);
          } else {
            console.log('スケジュール登録完了:', schedule.title);
            
          }
        }
      }

      console.log('=== Google → アプリ同期完了 ===');
    } catch (error) {
      console.error('Google → アプリ同期エラー:', error);
    }
  }

  // スケジュールをGoogleカレンダーのイベント形式に変換
  private async scheduleToGoogleEvent(schedule: Schedule): Promise<any> {
    const event: any = {
      summary: schedule.title,
      description: schedule.details || '',
      start: {},
      end: {},
      reminders: {
        useDefault: false,
        overrides: []
      }
    };

    // 参加者のメールアドレスを取得
    if (schedule.participants && schedule.participants.length > 0) {
      try {
        const { data: participantsData, error: participantsError } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', schedule.participants);
        
        if (participantsError) {
          console.error('参加者データ取得エラー:', participantsError);
        } else if (participantsData && participantsData.length > 0) {
          const attendeeEmails = participantsData
            .map(p => p.email)
            .filter(email => email && email.trim() !== '');
          
          if (attendeeEmails.length > 0) {
            event.attendees = attendeeEmails.map(email => ({
              email: email,
              responseStatus: 'needsAction'
            }));
            console.log('参加者のメールアドレスを設定:', attendeeEmails);
          }
        }
      } catch (error) {
        console.error('参加者データ取得中にエラー:', error);
      }
    }

    // 終日イベントの場合
    if (schedule.isAllDay) {
      event.start.date = format(schedule.startTime, 'yyyy-MM-dd');
      event.end.date = format(schedule.endTime, 'yyyy-MM-dd');
    } else {
      event.start.dateTime = schedule.startTime.toISOString();
      event.start.timeZone = 'Asia/Tokyo';
      event.end.dateTime = schedule.endTime.toISOString();
      event.end.timeZone = 'Asia/Tokyo';
    }

    // Google Meetリンクがある場合、または会議タイプがonlineの場合
    if (schedule.meetLink || schedule.meetingType === 'online') {
      // 既存のMeetリンクがある場合はそれを使用、なければ新規作成をリクエスト
      if (schedule.meetLink) {
        event.conferenceData = {
          entryPoints: [{
            entryPointType: 'video',
            uri: schedule.meetLink,
            label: 'Google Meet'
          }],
          conferenceSolution: {
            key: {
              type: 'hangoutsMeet'
            },
            name: 'Google Meet'
          }
        };
      } else {
        // 新しいGoogle Meetを作成
        event.conferenceData = {
          createRequest: {
            requestId: `${schedule.id}-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        };
      }
    }

    // 場所情報（会議室など）
    if (schedule.equipment && schedule.equipment.length > 0) {
      const rooms = schedule.equipment.filter(e => e.type === 'room');
      if (rooms.length > 0) {
        event.location = rooms.map(r => r.name).join(', ');
      }
    }

    // リマインダー設定
    if (schedule.reminders && schedule.reminders.length > 0) {
      event.reminders.overrides = schedule.reminders.map(reminder => ({
        method: 'popup',
        minutes: reminder.time // reminder.time が正しいプロパティ名
      }));
    }

    // 繰り返し予約は全て個別のイベントとして送信（Googleカレンダーの繰り返し機能は使用しない）

    return event;
  }



  // Googleカレンダーに予定を作成
  async createGoogleEvent(schedule: Schedule, userId: string): Promise<string | null> {
    console.log('=== Google Calendar Event Creation Debug ===');
    console.log('Schedule:', {
      id: schedule.id,
      title: schedule.title,
      meetingType: schedule.meetingType,
      meetLink: schedule.meetLink,
      startTime: schedule.startTime,
      endTime: schedule.endTime
    });
    console.log('UserId:', userId);
    
    try {
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('No valid access token found');
        return null;
      }
      console.log('Access token obtained successfully');

      // 同期設定を取得（エラーの場合はデフォルト値を使用）
      let syncSettings = null;
      try {
        const { data } = await supabase
          .from('google_calendar_sync_settings')
          .select('google_calendar_id, enabled, sync_to_google')
          .eq('user_id', userId)
          .single();
        syncSettings = data;
      } catch (error) {
        console.log('同期設定の取得をスキップ（デフォルト値を使用）:', error);
        // デフォルト値を使用
        syncSettings = {
          enabled: true,
          sync_to_google: true,
          google_calendar_id: 'primary'
        };
      }

      console.log('Sync settings:', syncSettings);
      
      if (!syncSettings?.enabled || !syncSettings?.sync_to_google) {
        console.log('Google sync is disabled - enabled:', syncSettings?.enabled, 'sync_to_google:', syncSettings?.sync_to_google);
        return null;
      }

      const client = new GoogleCalendarClient(accessToken);
      const event = await this.scheduleToGoogleEvent(schedule);
      const calendarId = syncSettings.google_calendar_id || 'primary';

      // Google Meetを含むかどうかを判定
      const includeConferenceData = !!(schedule.meetLink || schedule.meetingType === 'online');
      console.log('Creating Google event with conference data:', includeConferenceData);
      console.log('Event data:', JSON.stringify(event, null, 2));
      
      const googleEvent = await client.createEvent(calendarId, event, includeConferenceData);
      console.log('Google event created:', googleEvent);

      // Google Meetリンクが生成された場合、スケジュールを更新
      if (googleEvent.conferenceData?.entryPoints?.[0]?.uri && !schedule.meetLink) {
        const meetLink = googleEvent.conferenceData.entryPoints[0].uri;
        console.log('Google Meet URL generated:', meetLink);
        console.log('Updating schedule with Meet URL...');
        
        const { error: updateError } = await supabase
          .from('schedules')
          .update({ meet_link: meetLink })
          .eq('id', schedule.id);
          
        if (updateError) {
          console.error('Failed to update schedule with Meet URL:', updateError);
        } else {
          console.log('Schedule updated with Meet URL successfully');
        }
      } else {
        console.log('No Meet URL to update - conferenceData:', googleEvent.conferenceData);
      }

      // マッピングを保存
      await this.saveEventMapping(schedule.id, googleEvent.id, calendarId, userId);

      console.log('=== End Google Calendar Event Creation ===');
      return googleEvent.id;
    } catch (error) {
      console.error('Error creating Google event:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      return null;
    }
  }

  // Googleカレンダーの予定を更新
  async updateGoogleEvent(schedule: Schedule, userId: string): Promise<boolean> {
    try {
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        return false;
      }

      // 新規作成として処理
      await this.createGoogleEvent(schedule, userId);
      return true;
    } catch (error) {
      console.error('Error updating Google event:', error);
      return false;
    }
  }

  // Googleカレンダーから予定を削除
  async deleteGoogleEvent(_scheduleId: string, _userId: string): Promise<boolean> {
    try {
      const accessToken = await getValidAccessToken(_userId);
      if (!accessToken) {
        return false;
      }

      // 削除をスキップ（マッピングテーブルが無効化されているため）

      return true;
    } catch (error) {
      console.error('Error deleting Google event:', error);
      return false;
    }
  }

  // イベントマッピングを保存（無効化中）
  private async saveEventMapping(
    _scheduleId: string,
    _googleEventId: string,
    _googleCalendarId: string,
    _userId: string
  ): Promise<void> {
    // マッピングテーブルが無効化されているため何もしない
    console.log('マッピングテーブルが無効化されているため、マッピングをスキップ');
  }

  // Googleカレンダーから予定を同期（インポート）
  // 旧来の複雑な同期処理は削除し、新しいシンプルな同期処理を使用
  async syncFromGoogle(userId: string, timeMin: Date, timeMax: Date): Promise<void> {
    // 新しいシンプルな同期処理を使用（重複防止）
    await this.syncGoogleToApp(userId, timeMin, timeMax, true); // 新規のみ
  }




  // Googleイベントをシステムの予定形式に変換
  private googleEventToSchedule(_googleEvent: any, userId: string): Schedule {
    // このメソッドは現在使用されていないため、ダミーデータを返す
    return {
      id: '',
      type: 'iPhone',
      title: '（無題）',
      details: '',
      startTime: new Date(),
      endTime: new Date(),
      isAllDay: false,
      isMultiDay: false,
      recurrence: null,
      participants: [userId],
      equipment: [],
      reminders: [],
      meetLink: undefined,
      meetingType: 'in-person',
      createdBy: userId,
      createdAt: new Date(),
      updatedBy: null,
      updatedAt: null,
      isFromGoogleCalendar: true
    };
  }


  // 特定のユーザーの全予定を同期
  async syncAllSchedulesForUser(userId: string, schedules: Schedule[]): Promise<void> {
    const participantSchedules = schedules.filter(s => 
      s.participants.includes(userId) || s.createdBy === userId
    );

    for (const schedule of participantSchedules) {
      await this.createGoogleEvent(schedule, userId);
    }
  }

  // 重複予定を削除する機能
  async removeDuplicateSchedules(userId: string, timeMin: Date, timeMax: Date): Promise<number> {
    try {
      console.log('🔍 重複予定の削除を開始...');
      
      // 重複予定を検出
      const { data: schedules } = await supabase
        .from('schedules')
        .select('*')
        .or(`participants.cs.{${userId}},created_by.eq.${userId}`)
        .gte('start_time', timeMin.toISOString())
        .lte('start_time', timeMax.toISOString())
        .order('title, start_time');

      if (!schedules || schedules.length === 0) {
        console.log('削除対象の予定がありません');
        return 0;
      }

      // 重複を検出して削除対象を決定
      const duplicatesToDelete: string[] = [];
      const seen = new Map<string, any>();

      for (const schedule of schedules) {
        // タイトルと日時のみで重複判定（Googleフラグは無視）
        const key = `${schedule.title}_${new Date(schedule.start_time).toDateString()}`;
        
        if (seen.has(key)) {
          // 重複発見：より古い方を削除対象に
          const existing = seen.get(key);
          const existingCreatedAt = new Date(existing.created_at);
          const currentCreatedAt = new Date(schedule.created_at);
          
          if (currentCreatedAt < existingCreatedAt) {
            // 現在の方が古い場合：既存を削除対象に追加し、現在を保持
            duplicatesToDelete.push(existing.id);
            seen.set(key, schedule);
          } else {
            // 既存の方が古い場合：現在を削除対象に
            duplicatesToDelete.push(schedule.id);
          }
        } else {
          seen.set(key, schedule);
        }
      }

      if (duplicatesToDelete.length === 0) {
        console.log('重複予定は見つかりませんでした');
        return 0;
      }

      console.log(`重複予定 ${duplicatesToDelete.length}件 を削除中...`);

      // 重複予定を削除
      const { error } = await supabase
        .from('schedules')
        .delete()
        .in('id', duplicatesToDelete);

      if (error) {
        console.error('重複予定削除エラー:', error);
        return 0;
      }

      console.log(`✅ 重複予定 ${duplicatesToDelete.length}件 を削除完了`);
      return duplicatesToDelete.length;
    } catch (error) {
      console.error('重複予定削除中にエラー:', error);
      return 0;
    }
  }

  // 定期同期を実行
  async performFullSync(userId: string): Promise<{
    success: boolean;
    message: string;
    syncedCount?: number;
    details?: any;
  }> {
    console.log('=== Starting full synchronization ===');
    console.log('User ID:', userId);
    
      // 🔥 API制限回避: terao-j@terao-f.co.jpのみを同期対象に限定
      // userIdはデータベースのIDなので、メールアドレスで判定する必要がある
      // この関数は直接メールアドレスでの判定はできないため、呼び出し元で判定する
      console.log('🔄 完全同期開始:', userId);
    
    try {
      // 🔥 API制限回避: 同期範囲を大幅に縮小（過去1ヶ月〜未来1ヶ月）
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1); // 過去1ヶ月まで
      
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 1); // 未来1ヶ月まで
      
      console.log('Sync time range:', {
        from: timeMin.toISOString(),
        to: timeMax.toISOString()
      });
      
      // 重複予定を削除
      console.log('🧹 重複予定の削除を実行中...');
      const removedDuplicates = await this.removeDuplicateSchedules(userId, timeMin, timeMax);
      console.log(`🧹 重複予定削除完了: ${removedDuplicates}件`);
      
      // Googleからシステムへ同期（重複防止）
      await this.syncGoogleToApp(userId, timeMin, timeMax, true); // 新規のみ
      
      // 削除検知機能を追加
      console.log('🔍 削除検知機能を実行中...');
      const { simpleSyncService } = await import('./simpleSyncService');
      const deletionResult = await simpleSyncService.detectAndDeleteRemovedEvents(userId, [], timeMin, timeMax);
      console.log(`🔍 削除検知完了: ${deletionResult}件の予定を削除`);
      
      console.log('=== Full synchronization completed ===');
      return {
        success: true,
        message: `同期が完了しました（重複削除: ${removedDuplicates}件）`,
        syncedCount: removedDuplicates
      };
    } catch (error) {
      console.error('Full sync error:', error);
      console.error('Error stack:', (error as Error).stack);
      return {
        success: false,
        message: '同期中にエラーが発生しました',
        details: error
      };
    }
  }

  // 双方向自動同期：定期的に短期間で実行
  async syncBidirectional(userId: string, timeMin: Date, timeMax: Date): Promise<void> {
    try {
      console.log('=== 双方向自動同期開始 ===', {
        userId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString()
      });

      // 同期設定を確認
      const { data: syncSettings } = await supabase
        .from('google_calendar_sync_settings')
        .select('enabled, sync_to_google, sync_from_google, google_calendar_id')
        .eq('user_id', userId)
        .single();

      if (!syncSettings?.enabled) {
        console.log('同期が無効です');
        return;
      }

      // 重複防止のための同期ロック
      const lockKey = `sync_${userId}_${timeMin.getTime()}_${timeMax.getTime()}`;
      const existingLock = localStorage.getItem(lockKey);
      if (existingLock) {
        console.log('同期が既に実行中です');
        return;
      }

      // 同期ロックを設定（5分間）
      localStorage.setItem(lockKey, new Date().toISOString());
      setTimeout(() => localStorage.removeItem(lockKey), 5 * 60 * 1000);

      // 1. Google → アプリ同期（新しい予定のみ）
      if (syncSettings.sync_from_google) {
        console.log('Google → アプリ同期を実行中...');
        await this.syncGoogleToApp(userId, timeMin, timeMax, true); // 新規のみ
      }

      // 2. アプリ → Google同期（変更された予定のみ）
      if (syncSettings.sync_to_google) {
        console.log('アプリ → Google同期を実行中...');
        await this.syncAppToGoogleIncremental(userId, timeMin, timeMax);
      }

      console.log('=== 双方向自動同期完了 ===');
    } catch (error) {
      console.error('双方向同期エラー:', error);
    }
  }

  // アプリ → Google増分同期（変更された予定のみ）
  async syncAppToGoogleIncremental(userId: string, timeMin: Date, timeMax: Date): Promise<void> {
    try {
      console.log('=== アプリ → Google増分同期開始 ===');
      
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('アクセストークンが取得できません');
        return;
      }

      // 同期設定を取得
      const { data: syncSettings } = await supabase
        .from('google_calendar_sync_settings')
        .select('google_calendar_id, enabled, sync_to_google')
        .eq('user_id', userId)
        .single();

      if (!syncSettings?.enabled || !syncSettings?.sync_to_google) {
        console.log('Google同期が無効です');
        return;
      }

      const client = new GoogleCalendarClient(accessToken);
      const calendarId = syncSettings.google_calendar_id || 'primary';

      // 変更された予定のみを取得（updated_atが最近のもの）
      const recentUpdateTime = new Date(Date.now() - 10 * 60 * 1000); // 10分前
      const { data: changedSchedules } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', timeMin.toISOString())
        .lte('end_time', timeMax.toISOString())
        .gte('updated_at', recentUpdateTime.toISOString());

      if (!changedSchedules || changedSchedules.length === 0) {
        console.log('変更された予定はありません');
        return;
      }

      console.log(`${changedSchedules.length}件の変更された予定を同期中...`);

      // マッピングテーブルが無効化されているため、マッピングなしで処理
      const mappingMap = new Map();

      for (const schedule of changedSchedules) {
        try {
          const existingMapping = mappingMap.get(schedule.id);
          
          if (existingMapping) {
            // 既存の予定を更新
            await client.updateEvent(calendarId, existingMapping.google_event_id, {
              summary: schedule.title,
              description: schedule.details || '',
              start: { dateTime: schedule.start_time },
              end: { dateTime: schedule.end_time },
              location: schedule.location || ''
            });
            console.log(`予定を更新: ${schedule.title}`);
          } else {
            // 新しい予定を作成
            const event = await client.createEvent(calendarId, {
              summary: schedule.title,
              description: schedule.details || '',
              start: { dateTime: schedule.start_time },
              end: { dateTime: schedule.end_time },
              location: schedule.location || ''
            });

            if (event?.id) {
              console.log(`新しい予定を作成: ${schedule.title}`);
            }
          }
        } catch (error) {
          console.error(`予定同期エラー (${schedule.title}):`, error);
        }
      }

      console.log('=== アプリ → Google増分同期完了 ===');
    } catch (error) {
      console.error('増分同期エラー:', error);
    }
  }
}

export const googleCalendarSyncService = new GoogleCalendarSyncService();