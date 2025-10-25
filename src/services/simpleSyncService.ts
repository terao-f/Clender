import { Schedule } from '../types';
import { supabase } from '../lib/supabase';
import { GoogleCalendarClient, getValidAccessToken } from '../lib/googleCalendar';

export class SimpleSyncService {
  
  // Google → アプリ同期（シンプル版）
  async syncFromGoogle(userId: string, options: { includeDeleted?: boolean } = {}): Promise<{ success: boolean; message: string; count?: number; deletedCount?: number }> {
    try {
      console.log('=== Google → アプリ同期開始（シンプル版） ===');
      
      // 🔥 API制限回避: terao-j@terao-f.co.jpのみを同期対象に限定
      // userIdはデータベースのIDなので、メールアドレスで判定する必要がある
      // この関数は直接メールアドレスでの判定はできないため、呼び出し元で判定する
      console.log('🔄 Google → アプリ同期開始:', userId);
      
      // アクセストークンを取得
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('アクセストークンが取得できません');
        
        // 自動復旧を試行
        console.log('🔄 Google認証の自動復旧を試行中...');
        try {
          const { googleAuthService } = await import('../services/googleAuthService');
          const refreshedToken = await googleAuthService.getValidAccessToken();
          if (refreshedToken) {
            console.log('✅ Google認証の自動復旧成功');
            // 復旧成功したら再度同期を試行
            return this.syncFromGoogle(userId);
          }
        } catch (recoveryError) {
          console.log('❌ 自動復旧失敗:', recoveryError);
        }
        
        return { success: false, message: 'Google認証の再設定が必要です（設定 > カレンダー連携）' };
      }

      // 🔥 API制限回避: 同期範囲を大幅に縮小（過去1ヶ月〜未来1ヶ月）
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1); // 過去1ヶ月まで
      
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 1); // 未来1ヶ月まで

      const client = new GoogleCalendarClient(accessToken);
      
      // Googleカレンダーからイベントを取得
      console.log('Googleカレンダーからイベントを取得中...');
      const events = await client.listEvents('primary', timeMin, timeMax);
      
      if (!events?.items || events.items.length === 0) {
        console.log('同期対象のイベントがありません');
        return { success: true, message: '同期対象のイベントがありません', count: 0 };
      }

      let addedCount = 0;
      
      // 各イベントをアプリに追加
      for (const event of events.items) {
        if (event.status === 'cancelled') continue;
        
        try {
          // 重複チェック（タイトル、開始時刻、終了時刻で厳密に判定）
          const eventTitle = event.summary || 'Googleカレンダーから同期';
          const eventStartTime = new Date(event.start?.dateTime || event.start?.date || '');
          const eventEndTime = new Date(event.end?.dateTime || event.end?.date || '');
          
          // Google CalendarのイベントIDもチェック（より確実な重複検知）
          const googleEventId = event.id;
          
          const { data: existingSchedules } = await supabase
            .from('schedules')
            .select('id, title, start_time, end_time, google_event_id')
            .eq('is_from_google_calendar', true)
            .eq('created_by', userId);

          // より厳密な重複チェック
          const duplicateSchedule = existingSchedules?.find(schedule => {
            // 1. Google Event IDが一致する場合（最も確実）
            if (googleEventId && schedule.google_event_id === googleEventId) {
              return true;
            }
            
            // 2. タイトル、開始時刻、終了時刻がすべて一致する場合
            const dbStartTime = new Date(schedule.start_time);
            const dbEndTime = new Date(schedule.end_time);
            
            return schedule.title === eventTitle &&
                   Math.abs(dbStartTime.getTime() - eventStartTime.getTime()) < 60000 && // 1分以内
                   Math.abs(dbEndTime.getTime() - eventEndTime.getTime()) < 60000; // 1分以内
          });

          if (duplicateSchedule) {
            console.log('重複する予定をスキップ:', {
              title: eventTitle,
              startTime: eventStartTime.toISOString(),
              endTime: eventEndTime.toISOString(),
              googleEventId: googleEventId,
              existingScheduleId: duplicateSchedule.id,
              isAllDay: !event.start?.dateTime,
              isFromGoogleCalendar: true
            });
            continue;
          }

          // 新しい予定を作成（存在するカラムのみ）
          const newSchedule: any = {
            title: event.summary || 'Googleカレンダーから同期',
            details: event.description || '',
            start_time: new Date(event.start?.dateTime || event.start?.date || '').toISOString(),
            end_time: new Date(event.end?.dateTime || event.end?.date || '').toISOString(),
            type: 'meeting',
            is_all_day: !event.start?.dateTime,
            is_multi_day: false,
            participants: [userId], // 🔥 修正: 現在のユーザーを参加者として追加
            equipment: [],
            reminders: { use_default: false, overrides: [] },
            meet_link: event.hangoutLink || '',
            is_from_google_calendar: true,
            google_event_id: googleEventId, // Google Event IDを保存
            created_by: userId,
            updated_at: new Date().toISOString()
          };

          // locationフィールドは一時的にスキップ（スキーマキャッシュ問題回避）
          // if (event.location) {
          //   newSchedule.location = event.location;
          // }

          const { error: insertError } = await supabase
            .from('schedules')
            .insert([newSchedule]);

          if (insertError) {
            console.error('予定の挿入エラー:', insertError);
            console.error('挿入しようとしたデータ:', newSchedule);
            continue;
          }

          addedCount++;
          console.log('予定を追加:', event.summary);

        } catch (error) {
          console.error('イベント処理エラー:', error);
          continue;
        }
      }

      // 重複した予定を削除
      console.log('🔍 重複した予定を検索・削除中...');
      const duplicateRemovalResult = await this.removeDuplicateSchedules(userId);
      if (duplicateRemovalResult.success && duplicateRemovalResult.removedCount > 0) {
        console.log(`✅ 重複削除完了: ${duplicateRemovalResult.removedCount}件の重複を削除`);
      }

      // 削除検知機能（常に実行）
      let deletedCount = 0;
      deletedCount = await this.detectAndDeleteRemovedEvents(userId, events.items, timeMin, timeMax);

      console.log(`=== Google → アプリ同期完了: ${addedCount}件追加、${deletedCount}件削除 ===`);
      
      // メッセージを作成
      let message = '';
      if (addedCount > 0 && deletedCount > 0) {
        message = `${addedCount}件追加、${deletedCount}件削除しました`;
      } else if (addedCount > 0) {
        message = `${addedCount}件の予定を追加しました`;
      } else if (deletedCount > 0) {
        message = `${deletedCount}件の予定を削除しました`;
      } else {
        message = '変更はありませんでした';
      }
      
      return { 
        success: true, 
        message,
        count: addedCount,
        deletedCount 
      };

    } catch (error) {
      console.error('Google → アプリ同期エラー:', error);
      return { 
        success: false, 
        message: `同期エラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      };
    }
  }

  // 重複した予定を削除する
  async removeDuplicateSchedules(userId: string): Promise<{ success: boolean; message: string; removedCount?: number }> {
    try {
      console.log('🔍 重複した予定を検索中...');
      
      // Google Calendar由来の予定を取得
      const { data: schedules, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('is_from_google_calendar', true)
        .eq('created_by', userId)
        .order('created_at', { ascending: true }); // 古い順にソート

      if (error) {
        console.error('予定の取得エラー:', error);
        return { success: false, message: '予定の取得に失敗しました' };
      }

      if (!schedules || schedules.length === 0) {
        return { success: true, message: '対象の予定がありません', removedCount: 0 };
      }

      // 重複を検出（Google Event ID、タイトル + 開始時刻 + 終了時刻で判定）
      const uniqueSchedules = new Map();
      const duplicateIds: string[] = [];

      for (const schedule of schedules) {
        // Google Event IDがある場合はそれを優先
        const key = schedule.google_event_id || `${schedule.title}_${schedule.start_time}_${schedule.end_time}`;
        
        if (uniqueSchedules.has(key)) {
          // 重複発見：後から作成されたものを削除対象とする
          duplicateIds.push(schedule.id);
          console.log(`🔍 重複発見: ${schedule.title} (${new Date(schedule.start_time).toLocaleString('ja-JP')}) - Google Event ID: ${schedule.google_event_id || 'なし'}`);
        } else {
          uniqueSchedules.set(key, schedule);
        }
      }

      if (duplicateIds.length === 0) {
        return { success: true, message: '重複した予定はありませんでした', removedCount: 0 };
      }

      // 重複した予定を削除
      const { error: deleteError } = await supabase
        .from('schedules')
        .delete()
        .in('id', duplicateIds);

      if (deleteError) {
        console.error('重複削除エラー:', deleteError);
        return { success: false, message: '重複削除に失敗しました' };
      }

      console.log(`✅ 重複削除完了: ${duplicateIds.length}件の重複を削除`);
      return { 
        success: true, 
        message: `${duplicateIds.length}件の重複した予定を削除しました`,
        removedCount: duplicateIds.length 
      };

    } catch (error) {
      console.error('重複削除エラー:', error);
      return { success: false, message: `重複削除エラー: ${error instanceof Error ? error.message : '不明なエラー'}` };
    }
  }

  // 削除されたイベントを検知してアプリからも削除
  async detectAndDeleteRemovedEvents(
    userId: string, 
    googleEvents: any[], 
    timeMin: Date, 
    timeMax: Date
  ): Promise<number> {
    try {
      console.log('🔍 削除されたイベントを検知中...');
      
      // 同期範囲内のGoogle Calendar由来の予定をデータベースから取得
      const { data: appEvents, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('is_from_google_calendar', true)
        .eq('created_by', userId)
        .gte('start_time', timeMin.toISOString())
        .lte('start_time', timeMax.toISOString());

      if (error) {
        console.error('アプリ予定の取得エラー:', error);
        return 0;
      }

      if (!appEvents || appEvents.length === 0) {
        console.log('削除対象の予定がありません');
        return 0;
      }

      // Google Calendarのイベントタイトルと日付のセットを作成（日付レベルでの比較）
      const googleEventSet = new Set(
        googleEvents.map(event => {
          const startDate = new Date(event.start?.dateTime || event.start?.date || '');
          // 日付のみで比較（YYYY-MM-DD形式）
          const dateKey = startDate.toISOString().split('T')[0];
          return `${event.summary || 'Googleカレンダーから同期'}_${dateKey}`;
        })
      );

      let deletedCount = 0;

      // アプリの予定をチェックして、Googleに存在しないものを削除
      for (const appEvent of appEvents) {
        const appStartDate = new Date(appEvent.start_time);
        // 日付のみで比較（YYYY-MM-DD形式）
        const appDateKey = appStartDate.toISOString().split('T')[0];
        const appEventKey = `${appEvent.title}_${appDateKey}`;

        if (!googleEventSet.has(appEventKey)) {
          console.log(`🗑️ 削除対象の予定: ${appEvent.title} (${new Date(appEvent.start_time).toLocaleString('ja-JP')})`);
          
          // データベースから削除
          const { error: deleteError } = await supabase
            .from('schedules')
            .delete()
            .eq('id', appEvent.id);

          if (deleteError) {
            console.error('予定削除エラー:', deleteError);
            continue;
          }

          deletedCount++;
          console.log(`✅ 削除完了: ${appEvent.title}`);
        }
      }

      if (deletedCount > 0) {
        console.log(`🔍 削除検知完了: ${deletedCount}件の予定を削除`);
      } else {
        console.log('🔍 削除検知完了: 削除対象の予定はありませんでした');
      }
      return deletedCount;

    } catch (error) {
      console.error('削除検知エラー:', error);
      return 0;
    }
  }

  // Google → アプリ完全同期（Googleカレンダーと完全に一致させる）
  async fullSyncFromGoogle(userId: string): Promise<{ success: boolean; message: string; addedCount?: number; removedCount?: number }> {
    try {
      console.log('=== Google → アプリ完全同期開始 ===');
      
      // アクセストークンを取得
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('アクセストークンが取得できません');
        
        // 自動復旧を試行
        console.log('🔄 Google認証の自動復旧を試行中...');
        try {
          const { googleAuthService } = await import('../services/googleAuthService');
          const refreshedToken = await googleAuthService.getValidAccessToken();
          if (refreshedToken) {
            console.log('✅ Google認証の自動復旧成功');
            return this.fullSyncFromGoogle(userId);
          }
        } catch (recoveryError) {
          console.log('❌ 自動復旧失敗:', recoveryError);
        }
        
        return { success: false, message: 'Google認証の再設定が必要です（設定 > カレンダー連携）' };
      }

      // 同期範囲を設定（過去1年〜未来1年）- 削除検知対応
      const timeMin = new Date();
      timeMin.setFullYear(timeMin.getFullYear() - 1); // 過去1年まで
      const timeMax = new Date();
      timeMax.setFullYear(timeMax.getFullYear() + 1); // 未来1年まで

      const client = new GoogleCalendarClient(accessToken);
      
      // Googleカレンダーからイベントを取得
      console.log('Googleカレンダーからイベントを取得中...');
      const events = await client.listEvents('primary', timeMin, timeMax);
      
      console.log(`Google Calendarから${events?.items?.length || 0}件のイベントを取得`);

      // 同期範囲内の既存のGoogle Calendar由来の予定をすべて削除
      console.log('🗑️ 既存のGoogle Calendar由来の予定をすべて削除中...');
      const { error: deleteError } = await supabase
        .from('schedules')
        .delete()
        .eq('is_from_google_calendar', true)
        .eq('created_by', userId)
        .gte('start_time', timeMin.toISOString())
        .lte('start_time', timeMax.toISOString());

      if (deleteError) {
        console.error('既存予定の削除エラー:', deleteError);
        return { success: false, message: '既存予定の削除に失敗しました' };
      }

      console.log('✅ 既存のGoogle Calendar由来の予定を削除完了');

      let addedCount = 0;

      // Googleカレンダーのイベントをすべて追加
      if (events?.items && events.items.length > 0) {
        console.log('📅 Googleカレンダーのイベントを追加中...');
        
        for (const event of events.items) {
          if (event.status === 'cancelled') continue;
          
          try {
            // 新しい予定を作成
            const newSchedule: any = {
              title: event.summary || 'Googleカレンダーから同期',
              details: event.description || '',
              start_time: new Date(event.start?.dateTime || event.start?.date || '').toISOString(),
              end_time: new Date(event.end?.dateTime || event.end?.date || '').toISOString(),
              type: 'meeting',
              is_all_day: !event.start?.dateTime,
              is_multi_day: false,
              participants: [userId],
              equipment: [],
              reminders: { use_default: false, overrides: [] },
              meet_link: event.hangoutLink || '',
              is_from_google_calendar: true,
              created_by: userId,
              updated_at: new Date().toISOString()
            };

            // locationフィールドは一時的にスキップ（スキーマキャッシュ問題回避）
            // if (event.location) {
            //   newSchedule.location = event.location;
            // }

            const { error: insertError } = await supabase
              .from('schedules')
              .insert([newSchedule]);

            if (insertError) {
              console.error('予定の挿入エラー:', insertError);
              console.error('挿入しようとしたデータ:', newSchedule);
              continue;
            }

            addedCount++;
            console.log(`✅ 予定を追加: ${event.summary || 'Googleカレンダーから同期'}`);

          } catch (error) {
            console.error('イベント処理エラー:', error);
            continue;
          }
        }
      }

      console.log(`=== Google → アプリ完全同期完了: ${addedCount}件の予定を追加 ===`);
      return { 
        success: true, 
        message: `Googleカレンダーと完全に同期しました（${addedCount}件の予定）`,
        addedCount,
        removedCount: 0 // 削除件数は取得が困難なため0とする
      };

    } catch (error) {
      console.error('Google → アプリ完全同期エラー:', error);
      return { 
        success: false, 
        message: `完全同期エラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      };
    }
  }

  // アプリ → Google同期（完全同期版）
  async syncToGoogle(userId: string): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      console.log('=== アプリ → Google完全同期開始 ===');
      
      // 🔥 API制限回避: terao-j@terao-f.co.jpのみを同期対象に限定
      // userIdはデータベースのIDなので、メールアドレスで判定する必要がある
      // この関数は直接メールアドレスでの判定はできないため、呼び出し元で判定する
      console.log('🔄 アプリ → Google同期開始:', userId);
      
      // アクセストークンを取得
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('アクセストークンが取得できません');
        return { success: false, message: 'Google認証が必要です' };
      }

      // 🔥 API制限回避: 同期範囲を大幅に縮小（過去1ヶ月〜未来1ヶ月）
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1); // 過去1ヶ月まで
      
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 1); // 未来1ヶ月まで

      const client = new GoogleCalendarClient(accessToken);
      
      console.log('同期範囲（過去1ヶ月〜未来1ヶ月）:', { 
        timeMin: timeMin.toISOString(), 
        timeMax: timeMax.toISOString() 
      });
      
      // 1. まずGoogleカレンダーの既存イベントをすべて削除
      console.log('🗑️ Googleカレンダーの既存イベントを削除中...');
      
      const existingEvents = await client.listEvents('primary', timeMin, timeMax);
      console.log('📊 取得した既存イベント数:', existingEvents?.items?.length || 0);
      
      if (existingEvents?.items && existingEvents.items.length > 0) {
        console.log('📋 削除対象イベント一覧:');
        existingEvents.items.forEach((event, index) => {
          console.log(`${index + 1}. ${event.summary || '(タイトルなし)'} - Status: ${event.status} - ID: ${event.id}`);
        });
        
        let deletedCount = 0;
        let errorCount = 0;
        
        // バッチ処理で削除（Google API制限厳守）
        const batchSize = 1; // 1件ずつ処理（確実な制限回避）
        const activeEvents = existingEvents.items.filter(event => event.status !== 'cancelled' && event.id);
        
        for (let i = 0; i < activeEvents.length; i += batchSize) {
          const batch = activeEvents.slice(i, i + batchSize);
          console.log(`🗑️ バッチ削除実行中 [${i + 1}-${Math.min(i + batchSize, activeEvents.length)}/${activeEvents.length}]`);
          
          // バッチ内の各イベントを並列削除
          const deletePromises = batch.map(async (event, index) => {
            try {
              // 1秒間隔で確実に制限回避（10リクエスト/秒を下回る）
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒間隔
              
              console.log(`🗑️ 削除実行中: "${event.summary}" (ID: ${event.id})`);
              await client.deleteEvent('primary', event.id);
              deletedCount++;
              console.log(`✅ 削除成功: ${event.summary}`);
              
              return { success: true, event };
            } catch (error) {
              errorCount++;
              console.error(`❌ 削除失敗: ${event.summary}`, error);
              return { success: false, event, error };
            }
          });
          
          // バッチの完了を待つ
          await Promise.allSettled(deletePromises);
          
          // バッチ間の待機時間（API制限対策）
          if (i + batchSize < activeEvents.length) {
            console.log('⏱️ バッチ間待機中...');
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機
          }
        }
        
        console.log(`📊 削除処理完了: 成功${deletedCount}件, エラー${errorCount}件`);
        
      } else {
        console.log('📭 削除対象のイベントがありません');
      }
      
      // 削除処理完了後の確認（改善版）
      console.log('🔍 削除処理完了後の確認中...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機
      
      const afterDeleteEvents = await client.listEvents('primary', timeMin, timeMax);
      const activeEvents = afterDeleteEvents?.items?.filter(e => e.status !== 'cancelled') || [];
      
      console.log(`📊 削除後の残存イベント数: ${activeEvents.length}件`);
      
      if (activeEvents.length > 0) {
        console.log('⚠️ まだ削除されていないイベント:');
        activeEvents.forEach((event, index) => {
          console.log(`${index + 1}. "${event.summary}" (ID: ${event.id}, Status: ${event.status})`);
        });
        
        // 残存イベントがある場合は追加で削除を試行
        console.log('🔄 残存イベントの追加削除を実行中...');
        let secondDeleteCount = 0;
        
        for (const event of activeEvents) {
          if (event.id && event.status !== 'cancelled') {
            try {
              console.log(`🗑️ 再削除実行: "${event.summary}"`);
              await client.deleteEvent('primary', event.id);
              secondDeleteCount++;
              console.log(`✅ 再削除成功 [${secondDeleteCount}]: ${event.summary}`);
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
              console.error(`❌ 再削除失敗: ${event.summary}`, error);
            }
          }
        }
        
        // 最終確認
        console.log('🔍 最終確認中...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        const finalCheck = await client.listEvents('primary', timeMin, timeMax);
        const finalActiveEvents = finalCheck?.items?.filter(e => e.status !== 'cancelled') || [];
        console.log(`📊 最終確認: 残存イベント数 ${finalActiveEvents.length}件`);
        
        if (finalActiveEvents.length > 0) {
          console.log('⚠️ 完全削除できなかったイベント:');
          finalActiveEvents.forEach((event, index) => {
            console.log(`${index + 1}. "${event.summary}" (ID: ${event.id})`);
          });
        } else {
          console.log('✅ すべてのイベントが最終的に削除されました！');
        }
      } else {
        console.log('✅ すべてのイベントが正常に削除されました！');
      }
      
      // 2. アプリの予定を取得（Googleカレンダーから同期されたものは除外）
      // 参加者として含まれている予定のみを対象とする
      console.log('アプリの予定を取得中...');
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .contains('participants', [userId])
        .eq('is_from_google_calendar', false)
        .gte('start_time', timeMin.toISOString())
        .lte('start_time', timeMax.toISOString());
      
      console.log('同期対象のアプリ予定数:', schedules?.length || 0);

      if (schedulesError) {
        console.error('予定取得エラー:', schedulesError);
        return { success: false, message: '予定の取得に失敗しました' };
      }

      if (!schedules || schedules.length === 0) {
        console.log('同期対象の予定がありません - Googleカレンダーをクリアしました');
        return { success: true, message: 'Googleカレンダーをクリアしました（アプリに予定がありません）', count: 0 };
      }

      let addedCount = 0;
      
      // 3. アプリの予定をバッチ処理でGoogleカレンダーに追加
      console.log('📤 アプリ予定のバッチ追加を開始...');
      
      const addBatchSize = 1; // 1件ずつ追加（API制限対策強化）
      
      for (let i = 0; i < schedules.length; i += addBatchSize) {
        const batch = schedules.slice(i, i + addBatchSize);
        console.log(`📤 バッチ追加実行中 [${i + 1}-${Math.min(i + addBatchSize, schedules.length)}/${schedules.length}]`);
        
        // バッチ内の各予定を並列追加
        const addPromises = batch.map(async (schedule, index) => {
          try {
            // 2秒間隔で確実に制限回避（10リクエスト/秒を大幅に下回る）
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒間隔
            
            console.log(`📤 追加実行中: "${schedule.title}"`);
            
            // Googleカレンダーイベントを作成
            const googleEvent = {
              summary: schedule.title,
              description: schedule.details || '',
              start: {
                dateTime: schedule.is_all_day ? undefined : new Date(schedule.start_time).toISOString(),
                date: schedule.is_all_day ? new Date(schedule.start_time).toISOString().split('T')[0] : undefined,
                timeZone: 'Asia/Tokyo'
              },
              end: {
                dateTime: schedule.is_all_day ? undefined : new Date(schedule.end_time).toISOString(),
                date: schedule.is_all_day ? new Date(schedule.end_time).toISOString().split('T')[0] : undefined,
                timeZone: 'Asia/Tokyo'
              },
            location: schedule.location || '',
            reminders: {
              useDefault: false,
              overrides: []
            }
            };

            const createdEvent = await client.createEvent('primary', googleEvent);
            
            if (createdEvent) {
              addedCount++;
              console.log(`✅ 追加成功: ${schedule.title}`);
              return { success: true, schedule };
            }
            
            return { success: false, schedule, error: 'イベント作成に失敗' };

          } catch (error) {
            console.error(`❌ 追加失敗: ${schedule.title}`, error);
            return { success: false, schedule, error };
          }
        });
        
        // バッチの完了を待つ
        const results = await Promise.allSettled(addPromises);
        
        // バッチ間の待機時間（API制限対策）
        if (i + addBatchSize < schedules.length) {
          console.log('⏱️ バッチ間待機中...');
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機
        }
      }

      console.log(`=== アプリ → Google完全同期完了: ${addedCount}件追加 ===`);
      return { 
        success: true, 
        message: `Googleカレンダーを完全同期しました（${addedCount}件の予定）`, 
        count: addedCount 
      };

    } catch (error) {
      console.error('アプリ → Google同期エラー:', error);
      return { 
        success: false, 
        message: `同期エラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      };
    }
  }

  // 単一予定をGoogleカレンダーに同期（効率的なイベント駆動用）
  async syncSingleScheduleToGoogle(schedule: Schedule, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('=== 単一予定 → Google同期開始 ===');
      console.log('対象予定:', schedule.title);
      
      // アクセストークンを取得
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('アクセストークンが取得できません');
        return { success: false, message: 'Google認証が必要です' };
      }

      const client = new GoogleCalendarClient(accessToken);

      // 参加者として含まれているかチェック
      if (!schedule.participants.includes(userId)) {
        console.log('ユーザーが参加者でないため同期スキップ:', schedule.title);
        return { success: true, message: '参加者でないため同期不要' };
      }

      // Googleカレンダーから同期された予定は除外
      if (schedule.isFromGoogleCalendar) {
        console.log('Googleカレンダー由来の予定のため同期スキップ:', schedule.title);
        return { success: true, message: 'Googleカレンダー由来のため同期不要' };
      }

      // Googleイベント形式に変換
      const googleEvent = {
        summary: schedule.title,
        description: schedule.details || '',
        start: {
          dateTime: schedule.startTime.toISOString(),
          timeZone: 'Asia/Tokyo'
        },
        end: {
          dateTime: schedule.endTime.toISOString(),
          timeZone: 'Asia/Tokyo'
        },
        location: schedule.location || '',
        reminders: {
          useDefault: false,
          overrides: []
        }
      };

      // 既存のGoogleイベントを検索（タイトルと時間で）
      const timeMin = new Date(schedule.startTime.getTime() - 60 * 60 * 1000); // 1時間前
      const timeMax = new Date(schedule.endTime.getTime() + 60 * 60 * 1000);   // 1時間後
      
      const existingEvents = await client.listEvents('primary', timeMin, timeMax);
      const duplicateEvent = existingEvents?.items?.find(event => 
        event.summary === schedule.title &&
        event.status !== 'cancelled'
      );

      if (duplicateEvent) {
        console.log('既存のGoogleイベントを更新:', schedule.title);
        await client.updateEvent('primary', duplicateEvent.id!, googleEvent);
      } else {
        console.log('新規Googleイベントを作成:', schedule.title);
        await client.createEvent('primary', googleEvent);
      }

      console.log('✅ 単一予定同期完了:', schedule.title);
      return { success: true, message: `${schedule.title} を同期しました` };

    } catch (error) {
      console.error('❌ 単一予定同期エラー:', error);
      return { 
        success: false, 
        message: `同期エラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      };
    }
  }

  // 単一予定をGoogleカレンダーから削除（効率的な削除用）
  async deleteSingleScheduleFromGoogle(schedule: Schedule, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('=== 単一予定削除 → Google同期開始 ===');
      console.log('削除対象予定:', schedule.title);
      
      // アクセストークンを取得
      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        console.error('アクセストークンが取得できません');
        return { success: false, message: 'Google認証が必要です' };
      }

      const client = new GoogleCalendarClient(accessToken);

      // Googleカレンダーから同期された予定は除外
      if (schedule.isFromGoogleCalendar) {
        console.log('Googleカレンダー由来の予定のため削除スキップ:', schedule.title);
        return { success: true, message: 'Googleカレンダー由来のため削除不要' };
      }

      // 対象イベントを検索（タイトルと時間で）
      const timeMin = new Date(schedule.startTime.getTime() - 60 * 60 * 1000); // 1時間前
      const timeMax = new Date(schedule.endTime.getTime() + 60 * 60 * 1000);   // 1時間後
      
      const existingEvents = await client.listEvents('primary', timeMin, timeMax);
      const targetEvent = existingEvents?.items?.find(event => 
        event.summary === schedule.title &&
        event.status !== 'cancelled'
      );

      if (targetEvent) {
        console.log('Googleイベントを削除:', schedule.title);
        await client.deleteEvent('primary', targetEvent.id!);
        console.log('✅ 単一予定削除完了:', schedule.title);
        return { success: true, message: `${schedule.title} を削除しました` };
      } else {
        console.log('削除対象のGoogleイベントが見つかりません:', schedule.title);
        return { success: true, message: '削除対象が見つかりませんでした' };
      }

    } catch (error) {
      console.error('❌ 単一予定削除エラー:', error);
      return { 
        success: false, 
        message: `削除エラー: ${error instanceof Error ? error.message : '不明なエラー'}` 
      };
    }
  }
}

// シングルトンインスタンス
export const simpleSyncService = new SimpleSyncService();
