// Googleカレンダー自動同期サービス
import { googleCalendarSyncService } from './googleCalendarSyncService';
import { useAuth } from '../contexts/AuthContext';

class AutoSyncService {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly SYNC_INTERVAL = 60 * 60 * 1000; // 1時間間隔（新戦略）
  private readonly SYNC_RANGE_FUTURE_YEARS = 1; // 同期範囲: 未来1年（過去は除外）
  private lastSyncTime: Map<string, number> = new Map(); // 最後の同期時刻
  private errorCount: Map<string, number> = new Map(); // エラー回数

  /**
   * ユーザーの自動同期を開始
   */
  startAutoSync(userId: string): void {
    // 🔥 API制限回避: terao-j@terao-f.co.jpのみを同期対象に限定
    // userIdはデータベースのIDなので、メールアドレスで判定する必要がある
    // この関数は直接メールアドレスでの判定はできないため、呼び出し元で判定する
    console.log('🔄 自動同期を開始:', userId);
    
    // 既存の同期を停止
    this.stopAutoSync(userId);

    // 即座に1回実行
    this.performSync(userId);

    // 定期的な同期を設定
    const interval = setInterval(() => {
      this.performSync(userId);
    }, this.SYNC_INTERVAL);

    this.syncIntervals.set(userId, interval);
    console.log(`✅ イベント駆動型同期が開始されました（Google→アプリ: ${this.SYNC_INTERVAL / 1000}秒間隔、API制限対策付き）`);
  }

  /**
   * ユーザーの自動同期を停止
   */
  stopAutoSync(userId: string): void {
    const interval = this.syncIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(userId);
      console.log('⏹️ 自動同期を停止:', userId);
    }
  }

  /**
   * すべての自動同期を停止
   */
  stopAllAutoSync(): void {
    for (const [userId, interval] of this.syncIntervals) {
      clearInterval(interval);
      console.log('⏹️ 自動同期を停止:', userId);
    }
    this.syncIntervals.clear();
  }

  /**
   * Google → アプリの同期のみを実行（定期実行）
   * 注意: アプリ → Googleの同期はイベント駆動型（CalendarContext内）で実行
   */
  private async performSync(userId: string): Promise<void> {
    // クールダウンチェック
    const lastSync = this.lastSyncTime.get(userId) || 0;
    const now = Date.now();
    const minInterval = 60 * 1000; // 最低1分間隔
    
    if (now - lastSync < minInterval) {
      console.log('⏱️ クールダウン期間中、同期をスキップ:', userId);
      return;
    }

    try {
      console.log('📥 Google → アプリ同期を実行中...', userId);
      
      // 🔥 API制限回避: 同期範囲を大幅に縮小（過去1ヶ月〜未来1ヶ月）
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 1); // 過去1ヶ月まで
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 1); // 未来1ヶ月まで

      // Google → アプリの同期のみを実行（新規取得のみ）
      await googleCalendarSyncService.syncGoogleToApp(userId, timeMin, timeMax, true);
      
      // 成功時の処理
      this.lastSyncTime.set(userId, now);
      this.errorCount.delete(userId); // エラーカウントをリセット
      
      // 同期時刻をlocalStorageに保存（UI表示用）
      localStorage.setItem('lastPeriodicSync', now.toString());
      
      // Toast通知で同期完了を表示
      try {
        const { toast } = await import('react-hot-toast');
        const syncTime = new Date(now).toLocaleString('ja-JP');
        toast.success(`🔄 定期同期完了 (${syncTime})`, { 
          id: 'periodic-sync',
          duration: 3000 
        });
      } catch (toastError) {
        console.log('Toast通知エラー:', toastError);
      }
      
      console.log('✅ Google → アプリ同期完了:', userId);
    } catch (error) {
      console.error('❌ Google → アプリ同期エラー:', error);
      
      // エラー回数を増加
      const currentErrorCount = this.errorCount.get(userId) || 0;
      this.errorCount.set(userId, currentErrorCount + 1);
      
      // エラー時のToast通知
      try {
        const { toast } = await import('react-hot-toast');
        const syncTime = new Date(now).toLocaleString('ja-JP');
        toast.error(`❌ 定期同期エラー (${syncTime})`, { 
          id: 'periodic-sync-error',
          duration: 5000 
        });
      } catch (toastError) {
        console.log('Toast通知エラー:', toastError);
      }
      
      // API制限エラーの場合は特別な処理
      if (error.message.includes('API制限') || error.message.includes('quotaExceeded')) {
        console.warn('🚫 API制限エラーを検出、同期間隔を延長します');
        this.handleApiLimitError(userId);
      } else {
        this.handleSyncError(userId);
      }
    }
  }

  /**
   * API制限エラーを処理
   */
  private handleApiLimitError(userId: string): void {
    console.log('🚫 API制限エラーを検出、同期を一時停止します');
    this.stopAutoSync(userId);
    
    // 3分後に再開（API制限の回復を待つ）
    setTimeout(() => {
      console.log('🔄 API制限回復、同期を再開します:', userId);
      this.startAutoSync(userId);
    }, 3 * 60 * 1000); // 3分後に再開
  }

  /**
   * 一般的な同期エラーを処理
   */
  private handleSyncError(userId: string): void {
    const errorCount = this.errorCount.get(userId) || 0;
    
    if (errorCount >= 3) {
      console.log('⚠️ 連続エラーが3回以上、同期を長時間停止します');
      this.stopAutoSync(userId);
      
      // 30分後に再開
      setTimeout(() => {
        console.log('🔄 長時間停止後、同期を再開します:', userId);
        this.errorCount.delete(userId); // エラーカウントをリセット
        this.startAutoSync(userId);
      }, 30 * 60 * 1000); // 30分後に再開
    } else {
      console.log('⚠️ 同期エラーを検出、一時的に間隔を延長します');
      this.stopAutoSync(userId);
      
      // エラー回数に応じて待機時間を調整（指数バックオフ）
      const waitTime = Math.pow(2, errorCount) * 60 * 1000; // 1分、2分、4分...
      setTimeout(() => {
        this.startAutoSync(userId);
      }, waitTime);
    }
  }

  /**
   * 手動で双方向同期を実行
   */
  async manualSync(userId: string): Promise<void> {
    console.log('🔄 手動双方向同期を実行中...', userId);
    
    const now = new Date();
    const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7日前
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30日後

    await googleCalendarSyncService.syncBidirectional(userId, timeMin, timeMax);
    console.log('✅ 手動双方向同期完了:', userId);
  }

  /**
   * 現在の同期状態を取得
   */
  getSyncStatus(userId: string): { isActive: boolean; interval: number } {
    return {
      isActive: this.syncIntervals.has(userId),
      interval: this.SYNC_INTERVAL
    };
  }

  /**
   * すべての同期状態を取得
   */
  getAllSyncStatus(): Map<string, { isActive: boolean; interval: number }> {
    const status = new Map();
    for (const userId of this.syncIntervals.keys()) {
      status.set(userId, this.getSyncStatus(userId));
    }
    return status;
  }
}

export const autoSyncService = new AutoSyncService();
