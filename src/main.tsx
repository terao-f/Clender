import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// グローバル型定義
declare global {
  interface Window {
    autoSyncService?: any;
    googleCalendarSyncService?: any;
    GoogleCalendarDebugger?: any;
    currentUser?: any;
    user?: any;
    simpleSyncService?: any;
  }
}

// アプリ起動時のトークンチェック
const initializeTokenRefresh = async () => {
  try {
    console.log('🔄 アプリ起動時トークンチェック開始');
    
    // 現在のユーザーを取得
    const currentUserStr = localStorage.getItem('currentUser');
    if (!currentUserStr) {
      console.log('👤 ユーザー未ログイン - トークンチェックスキップ');
      return;
    }
    
    const currentUser = JSON.parse(currentUserStr);
    if (!currentUser?.id) {
      console.log('👤 ユーザーIDが見つかりません - トークンチェックスキップ');
      return;
    }
    
    // トークンリフレッシュサービスを動的インポート
    const { tokenRefreshService } = await import('./services/tokenRefreshService.ts');
    await tokenRefreshService.checkAndRefreshTokensOnStartup(currentUser.id);
    
    console.log('✅ アプリ起動時トークンチェック完了');
  } catch (error) {
    console.error('❌ アプリ起動時トークンチェックエラー:', error);
  }
};

// アプリ起動時にトークンチェックを実行
initializeTokenRefresh();

// 開発環境でのデバッグ機能を有効化
if (import.meta.env.DEV) {
  import('./utils/googleCalendarDebug.ts');
  import('./services/autoSyncService.ts').then(module => {
    window.autoSyncService = module.autoSyncService;
  });
  import('./services/googleCalendarSyncService.ts').then(module => {
    window.googleCalendarSyncService = module.googleCalendarSyncService;
  });
  import('./services/googleAuthService.ts').then(module => {
    window.googleAuthService = module.googleAuthService;
  });
  import('./services/simpleSyncService.ts').then(module => {
    window.simpleSyncService = module.simpleSyncService;
  });
}

// フォーカス時の自動同期を設定
let lastFocusTime = Date.now();
const FOCUS_SYNC_COOLDOWN = 10 * 60 * 1000; // 10分のクールダウン（API制限対策）

const handleFocusSync = async (eventType: string) => {
  // 🚫 API制限回避のため、フォーカス時の同期を無効化
  console.log('🚫 API制限回避のため、フォーカス時の同期を無効化:', eventType);
  return;
  
  const now = Date.now();
  
  // クールダウン期間中はスキップ
  if (now - lastFocusTime < FOCUS_SYNC_COOLDOWN) {
    console.log('🔄 フォーカス同期: クールダウン期間中のためスキップ');
    return;
  }
  
  lastFocusTime = now;
  
  try {
    console.log(`🎯 アプリにフォーカスが戻りました (${eventType}) - Google Calendar同期開始`);
    
    // 現在のユーザーを取得
    const currentUserStr = localStorage.getItem('currentUser');
    if (!currentUserStr) {
      console.log('👤 ユーザー未ログイン - 同期スキップ');
      return;
    }
    
    const currentUser = JSON.parse(currentUserStr);
    if (!currentUser?.id) {
      console.log('👤 ユーザーIDが見つかりません - 同期スキップ');
      return;
    }
    
    // Google認証トークンをチェック
    const tokensStr = localStorage.getItem('googleAuthTokens');
    if (!tokensStr) {
      console.log('🔑 Google認証トークンがありません - 同期スキップ');
      return;
    }
    
    // 同期中表示
    const { toast } = await import('react-hot-toast');
    toast.loading('📥 Google Calendarから同期中...', { 
      id: 'focus-sync',
      duration: 10000 // 最大10秒表示
    });
    
    // simpleSyncServiceを動的インポート
    const { simpleSyncService } = await import('./services/simpleSyncService.ts');
    const result = await simpleSyncService.syncFromGoogle(currentUser.id);
    
    if (result.success) {
      toast.success(`✅ 同期完了！${result.count ? ` (${result.count}件)` : ''}`, { 
        id: 'focus-sync',
        duration: 2000 
      });
    } else {
      toast.error(`❌ ${result.message}`, { 
        id: 'focus-sync',
        duration: 3000 
      });
    }
    
    console.log('✅ フォーカス時の自動同期完了:', result);
  } catch (error) {
    console.error('❌ フォーカス時の自動同期エラー:', error);
    
    // エラー表示
    try {
      const { toast } = await import('react-hot-toast');
      toast.error('❌ 同期エラー', { 
        id: 'focus-sync',
        duration: 3000 
      });
    } catch (toastError) {
      console.error('Toast error:', toastError);
    }
  }
};

// フォーカスイベントとvisibilitychangeイベントの両方を監視
window.addEventListener('focus', () => handleFocusSync('focus'));

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    handleFocusSync('visibility');
  }
});

console.log('🎯 フォーカス時自動同期が設定されました');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
