import { useState, useEffect } from 'react';
import { Calendar, Link, Unlink, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { googleAuthService } from '../../services/googleAuthService';
import { googleCalendarSyncService } from '../../services/googleCalendarSyncService';
import { autoSyncService } from '../../services/autoSyncService';
import { simpleSyncService } from '../../services/simpleSyncService';
import { tokenRefreshService } from '../../services/tokenRefreshService';
import { useAuth } from '../../contexts/AuthContext';
import { useCalendar } from '../../contexts/CalendarContext';
import { supabase } from '../../lib/supabase';
import { startTokenValidityCheck } from '../../lib/googleCalendar';
import toast from 'react-hot-toast';

export default function GoogleCalendarSettings() {
  const { currentUser } = useAuth();
  const { refreshSchedules } = useCalendar();
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastPeriodicSyncTime, setLastPeriodicSyncTime] = useState<Date | null>(null);
  const [googleUserInfo, setGoogleUserInfo] = useState<any>(null);
  const [tokenRefreshStatus, setTokenRefreshStatus] = useState<{ isActive: boolean; lastRefresh?: Date }>({ isActive: false });
  const [syncSettings, setSyncSettings] = useState({
    enabled: false,
    syncToGoogle: true,
    syncFromGoogle: false,
    googleCalendarId: 'primary'
  });
  const [authExpired, setAuthExpired] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncStatus, setAutoSyncStatus] = useState<{ isActive: boolean; interval: number }>({
    isActive: false,
    interval: 0
  });

  useEffect(() => {
    checkConnectionStatus();
    if (currentUser) {
      loadSyncSettings();
      checkAutoSyncStatus();
      loadPeriodicSyncTime();
      loadTokenRefreshStatus();
    }
  }, [currentUser]);

  // 定期同期時刻を読み込み
  const loadPeriodicSyncTime = () => {
    const lastPeriodicSync = localStorage.getItem('lastPeriodicSync');
    if (lastPeriodicSync) {
      setLastPeriodicSyncTime(new Date(parseInt(lastPeriodicSync)));
    }
  };

  // トークンリフレッシュ状態を読み込み
  const loadTokenRefreshStatus = async () => {
    try {
      const status = await tokenRefreshService.getRefreshStatus();
      setTokenRefreshStatus(status);
    } catch (error) {
      console.error('トークンリフレッシュ状態の取得エラー:', error);
    }
  };

  // 定期同期を手動で開始（テスト用）
  const startPeriodicSync = async () => {
    if (!currentUser) return;
    
    // terao-j@terao-f.co.jpとterao-f17@terao-f.co.jpのみ対象
    if (currentUser.email !== 'terao-j@terao-f.co.jp' && currentUser.email !== 'terao-f17@terao-f.co.jp') {
      toast.error('定期同期はterao-j@terao-f.co.jpとterao-f17@terao-f.co.jpのみ対象です');
      return;
    }
    
    // 即座に1回実行
    try {
      toast.loading('🔄 定期同期を実行中...', { id: 'periodic-sync-now' });
      
      // simpleSyncServiceを使用して即座に同期実行
      const { simpleSyncService } = await import('../../services/simpleSyncService');
      const result = await simpleSyncService.syncFromGoogle(currentUser.id);
      
      if (result.success) {
        // 同期時刻を保存
        const now = Date.now();
        localStorage.setItem('lastPeriodicSync', now.toString());
        setLastPeriodicSyncTime(new Date(now));
        
        toast.success(`✅ 定期同期完了！${result.count ? ` (${result.count}件)` : ''}`, { 
          id: 'periodic-sync-now',
          duration: 3000 
        });
      } else {
        toast.error(`❌ 定期同期エラー: ${result.message}`, { 
          id: 'periodic-sync-now',
          duration: 5000 
        });
      }
    } catch (error) {
      console.error('定期同期エラー:', error);
      toast.error('❌ 定期同期エラーが発生しました', { 
        id: 'periodic-sync-now',
        duration: 5000 
      });
    }
    
    // 定期同期も開始
    autoSyncService.startAutoSync(currentUser.id);
    toast.success('定期同期を開始しました（1時間間隔）');
    checkAutoSyncStatus();
  };

  // Google認証期限切れイベントの監視
  useEffect(() => {
    const handleAuthExpired = (event: CustomEvent) => {
      console.log('Google認証が期限切れになりました:', event.detail);
      setAuthExpired(true);
      setIsConnected(false);
      
      // 詳細なメッセージを表示
      const message = event.detail?.message || 'Googleカレンダーの認証が期限切れです。再認証してください。';
      const reason = event.detail?.reason || 'unknown';
      
      // 理由に応じた詳細メッセージ
      let detailedMessage = message;
      if (reason === 'refresh_token_invalid') {
        detailedMessage = 'Googleカレンダーの認証が期限切れです。セキュリティのため、再認証が必要です。';
      } else if (reason === 'preemptive_refresh_failed') {
        detailedMessage = 'Googleカレンダーの認証更新に失敗しました。再認証してください。';
      } else if (reason === 'periodic_check_failed') {
        detailedMessage = 'Googleカレンダーの認証チェックに失敗しました。再認証してください。';
      }
      
      toast.error(detailedMessage, {
        duration: 10000, // 10秒間表示
        style: {
          background: '#fef2f2',
          color: '#dc2626',
          border: '1px solid #fecaca',
        },
      });
    };

    // 定期同期時刻更新の監視
    const handlePeriodicSyncUpdate = () => {
      loadPeriodicSyncTime();
    };

    window.addEventListener('google-auth-expired', handleAuthExpired as EventListener);
    window.addEventListener('storage', handlePeriodicSyncUpdate); // localStorage変更を監視
    
    return () => {
      window.removeEventListener('google-auth-expired', handleAuthExpired as EventListener);
      window.removeEventListener('storage', handlePeriodicSyncUpdate);
    };
  }, []);

  // 定期的なトークン有効性チェック
  useEffect(() => {
    if (currentUser && isConnected) {
      console.log('Starting periodic token validity check for user:', currentUser.id);
      const cleanup = startTokenValidityCheck(currentUser.id, 2); // 2分間隔（さらに頻繁にチェック）
      
      return cleanup;
    }
  }, [currentUser, isConnected]);

  // アプリ起動時の自動同期（iPhone対応）
  useEffect(() => {
    console.log('🔄 自動同期チェック:', {
      currentUser: !!currentUser,
      isConnected,
      syncSettingsEnabled: syncSettings.enabled,
      syncFromGoogle: syncSettings.syncFromGoogle
    });
    
    if (currentUser && isConnected && syncSettings.enabled && (currentUser.email === 'terao-j@terao-f.co.jp' || currentUser.email === 'terao-f17@terao-f.co.jp')) {
      console.log('✅ 自動同期条件を満たしています - 自動同期を開始');
      handleAutoSync();
    } else {
      console.log('❌ 自動同期条件を満たしていません');
    }
  }, [currentUser, isConnected, syncSettings.enabled]);

  // 定期的な同期チェック（アプリがアクティブな間のみ）
  useEffect(() => {
    if (currentUser && isConnected && syncSettings.enabled && (currentUser.email === 'terao-j@terao-f.co.jp' || currentUser.email === 'terao-f17@terao-f.co.jp')) {
      console.log('Starting periodic sync check for user:', currentUser.id);
      const interval = setInterval(() => {
        console.log('Performing periodic sync check');
        handleAutoSync();
      }, 30 * 60 * 1000); // 30分間隔
      
      return () => clearInterval(interval);
    }
  }, [currentUser, isConnected, syncSettings.enabled]);

  const checkConnectionStatus = async () => {
    const connected = await googleAuthService.isAuthenticated();
    setIsConnected(connected);
    
    if (connected) {
      const userInfo = await googleAuthService.getUserInfo();
      setGoogleUserInfo(userInfo);
    }
  };

  const loadSyncSettings = async () => {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('google_calendar_sync_settings')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();

    if (data) {
      setSyncSettings({
        enabled: data.enabled,
        syncToGoogle: data.sync_to_google,
        syncFromGoogle: data.sync_from_google,
        googleCalendarId: data.google_calendar_id
      });
      setLastSyncTime(data.last_sync_at ? new Date(data.last_sync_at) : null);
      // 自動同期の状態も同期
      setAutoSyncEnabled(data.enabled);
    }
  };

  const saveSyncSettings = async () => {
    if (!currentUser) return;

    const { error } = await supabase
      .from('google_calendar_sync_settings')
      .upsert({
        user_id: currentUser.id,
        enabled: syncSettings.enabled, // 自動同期のON/OFFも含む
        sync_to_google: syncSettings.syncToGoogle,
        sync_from_google: syncSettings.syncFromGoogle,
        google_calendar_id: syncSettings.googleCalendarId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('同期設定の保存エラー:', error);
      toast.error('設定の保存に失敗しました');
    } else {
      toast.success('設定を保存しました');
      // 自動同期の状態も更新
      setAutoSyncEnabled(syncSettings.enabled);
    }
  };

  const handleConnect = () => {
    // デバッグ情報を表示
    console.log('=== Google OAuth Debug Info ===');
    console.log('Current URL:', window.location.href);
    console.log('Current Origin:', window.location.origin);
    console.log('Current Protocol:', window.location.protocol);
    console.log('Current Host:', window.location.host);
    console.log('Current Hostname:', window.location.hostname);
    console.log('Current Port:', window.location.port);
    console.log('Expected Redirect URI:', `${window.location.origin}/auth/google/callback`);
    
    const authUrl = googleAuthService.getAuthUrl(true); // アカウント選択を強制
    console.log('Full Auth URL:', authUrl);
    
    // URLをパースして確認
    try {
      const url = new URL(authUrl);
      const redirectUri = url.searchParams.get('redirect_uri');
      const clientId = url.searchParams.get('client_id');
      const prompt = url.searchParams.get('prompt');
      console.log('Actual Redirect URI in request:', redirectUri);
      console.log('Client ID in request:', clientId);
      console.log('Prompt parameter:', prompt);
      
      // リダイレクトURIをアラートでも表示（確実に確認するため）
      alert(`使用中のリダイレクトURI:\n${redirectUri}\n\nこのURIをGoogle Cloud Consoleに追加してください。`);
    } catch (e) {
      console.error('Failed to parse auth URL:', e);
    }
    console.log('==============================');
    
    // 一旦処理を停止（デバッグのため）
    if (confirm('デバッグ情報を確認しましたか？続行しますか？')) {
      window.location.href = authUrl;
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Googleカレンダーとの連携を解除しますか？')) {
      await googleAuthService.resetAccount(); // 完全なリセットを実行
      setIsConnected(false);
      setGoogleUserInfo(null);
      toast.success('Googleカレンダーとの連携を解除しました');
    }
  };

  const handleSwitchAccount = async () => {
    if (confirm('別のGoogleアカウントで連携し直しますか？現在の連携は解除されます。')) {
      await googleAuthService.resetAccount(); // 完全なリセットを実行
      setIsConnected(false);
      setGoogleUserInfo(null);
      toast.success('アカウントをリセットしました。新しいアカウントで連携してください。');
    }
  };

  // 自動同期状態を確認
  const checkAutoSyncStatus = () => {
    if (currentUser) {
      const status = autoSyncService.getSyncStatus(currentUser.id);
      setAutoSyncStatus(status);
      setAutoSyncEnabled(status.isActive);
    }
  };

  // 自動同期を開始/停止
  const handleToggleAutoSync = () => {
    if (!currentUser) return;

    if (autoSyncEnabled) {
      autoSyncService.stopAutoSync(currentUser.id);
      setAutoSyncEnabled(false);
      toast.success('自動同期を停止しました');
    } else {
      autoSyncService.startAutoSync(currentUser.id);
      setAutoSyncEnabled(true);
      toast.success('自動同期を開始しました（Google→アプリ: 1時間間隔）');
    }
    checkAutoSyncStatus();
  };

  // 手動同期を実行
  const handleManualSync = async () => {
    if (!currentUser) return;

    setIsSyncing(true);
    try {
      await autoSyncService.manualSync(currentUser.id);
      setLastSyncTime(new Date());
      toast.success('手動同期が完了しました');
      await refreshSchedules();
    } catch (error) {
      console.error('手動同期エラー:', error);
      toast.error('手動同期に失敗しました');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSync = async () => {
    console.log('=== Google Calendar同期開始 ===');
    console.log('currentUser:', currentUser);
    
    // 手動同期のクールダウンチェック（API制限対策）
    const lastManualSync = localStorage.getItem('lastManualSync');
    const now = Date.now();
    const MANUAL_SYNC_COOLDOWN = 2 * 60 * 1000; // 2分のクールダウン
    
    if (lastManualSync && (now - parseInt(lastManualSync)) < MANUAL_SYNC_COOLDOWN) {
      const remainingTime = Math.ceil((MANUAL_SYNC_COOLDOWN - (now - parseInt(lastManualSync))) / 1000);
      toast.error(`同期は${remainingTime}秒後に実行できます（API制限対策）`);
      return;
    }
    
    setIsSyncing(true);
    try {
      // 手動同期の実行時刻を記録
      localStorage.setItem('lastManualSync', now.toString());
      if (!currentUser) {
        toast.error('ユーザー情報が見つかりません');
        return;
      }

      // 新しいシンプルな同期方式を使用
      const now = new Date();
      const oneMonthLater = new Date();
      oneMonthLater.setMonth(now.getMonth() + 1);

      // アプリ → Google同期（シンプル版）
      if (syncSettings.syncToGoogle) {
        console.log('アプリ → Google同期を実行中...');
        const result = await simpleSyncService.syncToGoogle(currentUser.id);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      }

      // Google → アプリ同期（シンプル版）
      if (syncSettings.syncFromGoogle) {
        console.log('Google → アプリ同期を実行中...');
        const result = await simpleSyncService.syncFromGoogle(currentUser.id);
        if (result.success) {
          toast.success(result.message);
          await refreshSchedules(); // カレンダーを更新
        } else {
          toast.error(result.message);
        }
      }

      // 同期完了時刻を更新
      await supabase
        .from('google_calendar_sync_settings')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', currentUser.id);

      setLastSyncTime(new Date());
      toast.success('同期が完了しました');
    } catch (error) {
      console.error('同期エラー:', error);
      toast.error('同期に失敗しました: ' + (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  // 自動同期関数（通知なし）
  const handleAutoSync = async () => {
    if (!currentUser || !isConnected || !syncSettings.enabled) {
      console.log('❌ 自動同期スキップ: 条件を満たしていません');
      return;
    }

    // 🔥 API制限回避: terao-j@terao-f.co.jpとterao-f17@terao-f.co.jpのみを同期対象に限定
    if (currentUser.email !== 'terao-j@terao-f.co.jp' && currentUser.email !== 'terao-f17@terao-f.co.jp') {
      console.log('🚫 自動同期はterao-j@terao-f.co.jpとterao-f17@terao-f.co.jpのみ対象:', currentUser.email);
      return;
    }

    // 自動同期のクールダウンチェック（API制限対策）
    const lastAutoSync = localStorage.getItem('lastAutoSync');
    const now = Date.now();
    const AUTO_SYNC_COOLDOWN = 10 * 60 * 1000; // 10分のクールダウン
    
    if (lastAutoSync && (now - parseInt(lastAutoSync)) < AUTO_SYNC_COOLDOWN) {
      const remainingTime = Math.ceil((AUTO_SYNC_COOLDOWN - (now - parseInt(lastAutoSync))) / 1000 / 60);
      console.log(`🔄 自動同期: クールダウン期間中（残り${remainingTime}分）`);
      return;
    }

    try {
      // 自動同期の実行時刻を記録
      localStorage.setItem('lastAutoSync', now.toString());
      console.log('=== 自動同期開始 ===');
      console.log('同期設定:', {
        syncToGoogle: syncSettings.syncToGoogle,
        syncFromGoogle: syncSettings.syncFromGoogle
      });
      
      const syncTime = new Date();
      const oneYearLater = new Date();
      oneYearLater.setFullYear(syncTime.getFullYear() + 1);

      // アプリ → Google同期（新戦略：未来1年分）
      if (syncSettings.syncToGoogle) {
        console.log('🔄 アプリ → Google同期を実行中（未来1年分）...');
        await googleCalendarSyncService.syncAppToGoogle(currentUser.id, syncTime, oneYearLater);
        console.log('✅ アプリ → Google同期完了');
      }

      // Google → アプリ同期（新戦略：未来1年分）
      if (syncSettings.syncFromGoogle) {
        console.log('🔄 Google → アプリ同期を実行中（未来1年分）...');
        await googleCalendarSyncService.syncGoogleToApp(currentUser.id, syncTime, oneYearLater);
        console.log('✅ Google → アプリ同期完了');
        await refreshSchedules();
        console.log('✅ スケジュール更新完了');
      }

      // 同期完了時刻を更新
      await supabase
        .from('google_calendar_sync_settings')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', currentUser.id);

      setLastSyncTime(new Date());
      console.log('✅ 自動同期完了');
    } catch (error) {
      console.error('❌ 自動同期エラー:', error);
      // 自動同期ではエラー通知を出さない（ユーザー体験を損なわないため）
    }
  };

  // 旧来の複雑な同期処理（削除予定）
  const _oldHandleSync = async () => {
    console.log('=== Google Calendar同期開始 ===');
    console.log('currentUser:', currentUser);
    
    setIsSyncing(true);
    try {
      if (!currentUser) {
        toast.error('ユーザー情報が見つかりません');
        return;
      }

      // 自分関連の今後の予約を取得してGoogle Calendarに同期
      const now = new Date().toISOString();
      console.log('予約を取得中...');
      const { data: schedules, error: fetchError } = await supabase
        .from('schedules')
        .select('*')
        .gte('end_time', now)
        .or(`participants.cs.{${currentUser.id}},created_by.eq.${currentUser.id}`)
        .order('start_time', { ascending: true });
      
      if (fetchError) {
        console.error('予約取得エラー:', fetchError);
        throw fetchError;
      }
      
      console.log('取得した予約数:', schedules?.length || 0);
      if (schedules && schedules.length > 0) {
        console.log('最初の予約:', schedules[0]);
      }
      
      if (!schedules || schedules.length === 0) {
        toast.success('同期する予約がありません');
        return;
      }

      let successCount = 0;
      for (const scheduleData of schedules) {
        try {
          const schedule = {
            ...scheduleData,
            startTime: new Date(scheduleData.start_time),
            endTime: new Date(scheduleData.end_time),
            createdAt: new Date(scheduleData.created_at),
            updatedAt: new Date(scheduleData.updated_at)
          };
          
          // 既存のマッピングがあるか確認（エラーの場合はスキップ）
          let hasExisting = false;
          try {
            const { data: existing } = await supabase
              .from('schedule_google_event_mappings')
              .select('google_event_id')
              .eq('schedule_id', schedule.id)
              .eq('user_id', currentUser.id);
            
            hasExisting = existing && existing.length > 0;
          } catch (mappingError) {
            console.log('マッピング確認をスキップ:', mappingError);
            hasExisting = false;
          }
          
          if (!hasExisting) {
            // マッピングがない場合のみ作成
            console.log(`予約 ${schedule.id} をGoogleカレンダーに同期中...`);
            const result = await googleCalendarSyncService.createGoogleEvent(schedule, currentUser.id);
            if (result) {
              console.log('同期成功:', result);
              successCount++;
            } else {
              console.log('同期スキップまたは失敗');
            }
          } else {
            console.log(`予約 ${schedule.id} は既に同期済み`);
          }
        } catch (error) {
          console.error(`予約 ${scheduleData.id} の同期エラー:`, error);
        }
      }

      setLastSyncTime(new Date());
      toast.success(`${successCount}件の自分関連予約をGoogle Calendarに同期しました`);
    } catch (error) {
      toast.error('同期に失敗しました');
      console.error('同期エラー:', error);
    } finally {
      setIsSyncing(false);
    }
  };




  const handleSyncFromGoogle = async () => {
    // Googleから取り込むのクールダウンチェック（API制限対策）
    const lastGoogleSync = localStorage.getItem('lastGoogleSync');
    const now = Date.now();
    const GOOGLE_SYNC_COOLDOWN = 2 * 60 * 1000; // 2分のクールダウン
    
    if (lastGoogleSync && (now - parseInt(lastGoogleSync)) < GOOGLE_SYNC_COOLDOWN) {
      const remainingTime = Math.ceil((GOOGLE_SYNC_COOLDOWN - (now - parseInt(lastGoogleSync))) / 1000);
      toast.error(`同期は${remainingTime}秒後に実行できます（API制限対策）`);
      return;
    }
    
    try {
      console.log('🔄 Googleカレンダー同期開始（シンプル版）');
      setIsSyncing(true);
      console.log('=== Googleカレンダーから同期開始 ===');
      
      // Google同期の実行時刻を記録
      localStorage.setItem('lastGoogleSync', now.toString());
      
      console.log('simpleSyncService.syncFromGoogle呼び出し開始');
      const result = await simpleSyncService.syncFromGoogle(currentUser.id);
      console.log('simpleSyncService.syncFromGoogle完了');
      
      if (result.success) {
        // 同期完了後、CalendarContextのスケジュールを更新
        console.log('🔄 Googleカレンダー同期完了後、refreshSchedulesを呼び出し');
        await refreshSchedules();
        console.log('✅ refreshSchedules完了');
        
        toast.success(result.message);
        setLastSyncTime(new Date());
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('❌ Googleカレンダー同期エラー:', error);
      console.error('エラーの詳細:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error(`Googleカレンダーからの同期に失敗しました: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };



  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Googleカレンダー連携設定
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Googleカレンダーと連携して、スケジュールを同期できます。</p>
          </div>

          {/* 認証期限切れ警告 */}
          {authExpired && (
            <div className="mt-5">
              <div className="rounded-md bg-red-50 px-4 py-3 border border-red-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      🔐 認証が期限切れです
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>Googleカレンダーの認証が期限切れになりました。セキュリティのため、再認証が必要です。</p>
                      <p className="mt-1 text-xs text-red-600">
                        💡 この問題は定期的に発生する可能性があります。再認証後は自動的に同期が再開されます。
                      </p>
                    </div>
                    <div className="mt-4 flex space-x-3">
                      <button
                        onClick={() => {
                          setAuthExpired(false);
                          handleConnect();
                        }}
                        className="bg-red-100 px-4 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 border border-red-300"
                      >
                        🔄 再認証する
                      </button>
                      <button
                        onClick={() => {
                          setAuthExpired(false);
                        }}
                        className="bg-gray-100 px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 border border-gray-300"
                      >
                        後で
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 連携状態 */}
          <div className="mt-5">
            <div className="rounded-md bg-gray-50 px-6 py-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {isConnected ? (
                    <CheckCircle className="h-8 w-8 text-green-400" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-gray-800">
                    {isConnected ? '連携済み' : '未連携'}
                  </h3>
                  {isConnected && googleUserInfo && (
                    <div className="mt-1 text-sm text-gray-600">
                      <p>アカウント: {googleUserInfo.email}</p>
                      {lastSyncTime && (
                        <p>手動同期: {lastSyncTime.toLocaleString()}</p>
                      )}
                      {lastPeriodicSyncTime && (
                        <p>定期同期: {lastPeriodicSyncTime.toLocaleString()}</p>
                      )}
                      {tokenRefreshStatus.isActive && tokenRefreshStatus.lastRefresh && (
                        <p>トークン更新: {tokenRefreshStatus.lastRefresh.toLocaleString()}</p>
                      )}
                    </div>
                  )}
                  {!isConnected && (
                    <p className="mt-1 text-sm text-gray-600">
                      Googleカレンダーと連携していません
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="mt-5 space-y-3">
            {!isConnected ? (
              <button
                type="button"
                onClick={handleConnect}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Link className="h-5 w-5 mr-2" />
                Googleカレンダーと連携
              </button>
            ) : (
              <>
                {/* 同期設定 */}
                <div className="mt-5 space-y-4 border-t pt-5">
                  <h4 className="text-sm font-medium text-gray-900">同期設定</h4>
                  
                  {/* 同期仕様の説明 */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-blue-900 mb-2">📋 同期仕様について</h5>
                    <div className="text-xs text-blue-700 space-y-1">
                      <p><strong>手動同期:</strong> 「設定を保存」ボタンで同期設定を保存し、手動で同期実行</p>
                      <p><strong>自動同期:</strong> 「同期を有効にする」をONにすると自動で同期開始</p>
                      <p><strong>アプリ → Google:</strong> 予定作成時に即座同期</p>
                      <p><strong>Google → アプリ:</strong> 1時間間隔で定期同期</p>
                      <p><strong>⚠️ 注意:</strong> 自動同期はterao-j@terao-f.co.jpとterao-f17@terao-f.co.jpのみ対象</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="syncEnabled"
                        checked={syncSettings.enabled}
                        onChange={(e) => setSyncSettings({ ...syncSettings, enabled: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="syncEnabled" className="ml-2 text-sm text-gray-700">
                        同期を有効にする（自動同期も含む）
                      </label>
                    </div>

                    <div className="ml-6 space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="syncToGoogle"
                          checked={syncSettings.syncToGoogle}
                          onChange={(e) => setSyncSettings({ ...syncSettings, syncToGoogle: e.target.checked })}
                          disabled={!syncSettings.enabled}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                        />
                        <label htmlFor="syncToGoogle" className="ml-2 text-sm text-gray-700">
                          アプリ → Google Calendar
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="syncFromGoogle"
                          checked={syncSettings.syncFromGoogle}
                          onChange={(e) => setSyncSettings({ ...syncSettings, syncFromGoogle: e.target.checked })}
                          disabled={!syncSettings.enabled}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                        />
                        <label htmlFor="syncFromGoogle" className="ml-2 text-sm text-gray-700">
                          Google Calendar → アプリ
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={saveSyncSettings}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      設定を保存
                    </button>
                    
                    {/* Googleカレンダーからアプリに同期 */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!currentUser) {
                          toast.error('ユーザー情報が見つかりません');
                          return;
                        }
                        
                        setIsSyncing(true);
                        try {
                          // Googleカレンダーからアプリへの同期を実行
                          const result = await googleCalendarSyncService.performFullSync(currentUser.id);
                          
                          if (result.success) {
                            setLastSyncTime(new Date());
                            toast.success('✅ Googleカレンダーからの同期が完了しました');
                            
                            // 同期設定を更新
                            await supabase
                              .from('google_calendar_sync_settings')
                              .update({ last_sync_at: new Date().toISOString() })
                              .eq('user_id', currentUser.id);
                              
                            // 設定を再読み込み
                            await loadSyncSettings();
                          } else {
                            toast.error(result.message);
                          }
                        } catch (error) {
                          console.error('同期エラー:', error);
                          toast.error('同期中にエラーが発生しました');
                        } finally {
                          setIsSyncing(false);
                        }
                      }}
                      disabled={!syncSettings.enabled || isSyncing || !syncSettings.syncFromGoogle}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="inline w-4 h-4 mr-2 animate-spin" />
                          同期中...
                        </>
                      ) : (
                        <>
                          <Calendar className="inline w-4 h-4 mr-2" />
                          Googleから取り込む
                        </>
                      )}
                    </button>


                    {/* アプリからGoogleカレンダーに同期 */}
                    <button
                      type="button"
                      onClick={handleSync}
                      disabled={!syncSettings.enabled || isSyncing || !syncSettings.syncToGoogle}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="inline w-4 h-4 mr-2 animate-spin" />
                          同期中...
                        </>
                      ) : (
                        <>
                          <Calendar className="inline w-4 h-4 mr-2" />
                          アプリから送信
                        </>
                      )}
                    </button>
                  </div>
                </div>


                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    className="inline-flex items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    <RefreshCw className="h-5 w-5 mr-2" />
                    アカウント切り替え
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <Unlink className="h-5 w-5 mr-2" />
                    連携を解除
                  </button>
                </div>
              </>
            )}
          </div>


          {/* 注意事項 */}
          <div className="mt-8 rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  注意事項
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Googleカレンダーとの同期は双方向です</li>
                    <li>削除したイベントは相手側からも削除されます</li>
                    <li>大量のイベントがある場合、同期に時間がかかることがあります</li>
                    <li>🔐 認証トークンは15分間隔で自動更新されます（Webアプリを閉じていても動作）</li>
                    <li>💡 認証が切れた場合は「トークン更新」ボタンで手動更新できます</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}