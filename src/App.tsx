import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { CalendarProvider } from './contexts/CalendarContext';
import { schedulerService } from './services/schedulerService';
import { setupNotificationHandlers } from './utils/notifications';
import { usePreventPullToRefresh } from './hooks/usePreventPullToRefresh';
import ErrorBoundary from './components/ErrorBoundary';
import { setupGlobalErrorHandlers } from './utils/errorHandler';
import UserSwitch from './pages/UserSwitch';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
// import MyCalendar from './pages/calendar/MyCalendar';
// import MyCalendarSimple from './pages/calendar/MyCalendarSimple';
import MyCalendarStandalone from './pages/calendar/MyCalendarStandalone';
import VehicleReservation from './pages/calendar/VehicleReservation';
import RoomReservation from './pages/calendar/RoomReservation';
import SampleReservation from './pages/calendar/SampleReservation';
import LeaveRequests from './pages/leave/LeaveRequests';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGroups from './pages/admin/AdminGroups';
import AdminEquipment from './pages/admin/AdminEquipment';
import EquipmentManagement from './pages/admin/EquipmentManagement';
import LeaveGroupManagement from './pages/admin/LeaveGroupManagement';
import BusinessGroupManagement from './pages/groups/BusinessGroupManagement';
import LeaveGroupManagementNew from './pages/groups/LeaveGroupManagement';
import ScheduleHistory from './pages/admin/ScheduleHistory';
import EmailTemplateManagement from './pages/admin/EmailTemplateManagement';
import HolidayManagement from './pages/admin/HolidayManagement';
import OperationLogs from './pages/admin/OperationLogs';
import NotificationSettings from './pages/settings/NotificationSettings';
import GoogleCalendarSettings from './pages/settings/GoogleCalendarSettings';
import DepartmentManagement from './pages/admin/DepartmentManagement';
import GoogleCallback from './pages/auth/GoogleCallback';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// CalendarProviderのラッパーコンポーネント
function CalendarProviderWrapper({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  
  // アプリ起動時の自動同期
  useEffect(() => {
    let hasRunStartupSync = false;
    
    const runStartupSync = async () => {
      if (hasRunStartupSync) return;
      
      // 最後の起動時同期から5分以内はスキップ（API制限対策）
      const lastStartupSync = localStorage.getItem('lastStartupSync');
      const now = Date.now();
      const STARTUP_SYNC_COOLDOWN = 5 * 60 * 1000; // 5分のクールダウン
      
      if (lastStartupSync && (now - parseInt(lastStartupSync)) < STARTUP_SYNC_COOLDOWN) {
        const remainingTime = Math.ceil((STARTUP_SYNC_COOLDOWN - (now - parseInt(lastStartupSync))) / 1000 / 60);
        console.log(`🔄 起動時同期: クールダウン期間中（残り${remainingTime}分）`);
        return;
      }
      
      try {
        hasRunStartupSync = true;
        console.log('🚀 アプリ起動時のGoogle Calendar同期開始');
        
        // 起動時同期の実行時刻を記録
        localStorage.setItem('lastStartupSync', now.toString());
        
        // 現在のユーザーを取得（localStorageから直接）
        const currentUserStr = localStorage.getItem('currentUser');
        if (!currentUserStr) {
          console.log('👤 ユーザー未ログイン - 起動時同期スキップ');
          return;
        }
        
        const currentUserFromStorage = JSON.parse(currentUserStr);
        if (!currentUserFromStorage?.id) {
          console.log('👤 ユーザーIDが見つかりません - 起動時同期スキップ');
          return;
        }

            // 🔥 API制限回避: terao-j@terao-f.co.jpとterao-f17@terao-f.co.jpのみを同期対象に限定
            if (currentUserFromStorage.email !== 'terao-j@terao-f.co.jp' && currentUserFromStorage.email !== 'terao-f17@terao-f.co.jp') {
              console.log('🚫 起動時同期はterao-j@terao-f.co.jpとterao-f17@terao-f.co.jpのみ対象:', currentUserFromStorage.email);
              return;
            }
        
        // Google認証トークンをチェック
        const tokensStr = localStorage.getItem('googleAuthTokens');
        if (!tokensStr) {
          console.log('🔑 Google認証トークンがありません - 起動時同期スキップ');
          
          // Toast表示でユーザーに通知
          try {
            const { toast } = await import('react-hot-toast');
            toast('🔑 Google Calendar連携が必要です', { 
              id: 'auth-required',
              duration: 5000,
              icon: '⚠️'
            });
          } catch (e) {
            console.log('Toast表示エラー:', e);
          }
          return;
        }
        
        // トークンの有効性をチェック
        try {
          const tokens = JSON.parse(tokensStr);
          if (!tokens.access_token || !tokens.refresh_token) {
            console.log('🔑 Google認証トークンが不完全 - 起動時同期スキップ');
            
            // Toast表示でユーザーに通知
            const { toast } = await import('react-hot-toast');
            toast('🔑 Google Calendar再認証が必要です', { 
              id: 'reauth-required',
              duration: 5000,
              icon: '⚠️'
            });
            return;
          }
        } catch (parseError) {
          console.log('🔑 Google認証トークンパースエラー - 起動時同期スキップ');
          return;
        }
        
        // 同期中表示（遅延を入れてDOM準備完了を待つ）
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒待機
        
        const { toast } = await import('react-hot-toast');
        toast.loading('🚀 起動時同期中...', { 
          id: 'startup-sync',
          duration: 15000 // 最大15秒表示
        });
        
        console.log('🍞 起動時同期Toast表示完了');
        
        // simpleSyncServiceを動的インポート
        const { simpleSyncService } = await import('./services/simpleSyncService.ts');
        const result = await simpleSyncService.syncFromGoogle(currentUserFromStorage.id);
        
        if (result.success) {
          toast.success(`✅ 起動完了！${result.count ? ` (${result.count}件)` : ''}`, { 
            id: 'startup-sync',
            duration: 2000 
          });
        } else {
          toast.error(`❌ ${result.message}`, { 
            id: 'startup-sync',
            duration: 3000 
          });
        }
        
        console.log('✅ アプリ起動時の自動同期完了:', result);
        console.log('🍞 起動時同期Toast更新完了');
      } catch (error) {
        console.error('❌ アプリ起動時の自動同期エラー:', error);
        
        // エラー表示
        try {
          const { toast } = await import('react-hot-toast');
          toast.error('❌ 起動時同期エラー', { 
            id: 'startup-sync',
            duration: 3000 
          });
        } catch (toastError) {
          console.error('Toast error:', toastError);
        }
      }
    };
    
    // ページ読み込み完了後に実行（ユーザー状態に関係なく）
    setTimeout(runStartupSync, 3000); // 3秒遅延で確実に初期化完了を待つ
  }, []); // 依存配列を空にして、マウント時のみ実行
  
  return (
    <CalendarProvider currentUser={currentUser}>
      {children}
    </CalendarProvider>
  );
}

function App() {
  // スマホでのプルダウン更新を防止（一時的に無効化）
  // usePreventPullToRefresh();

  useEffect(() => {
    console.log('🚀 App component initializing...');
    
    // Setup global error handlers
    console.log('🔧 Setting up global error handlers...');
    setupGlobalErrorHandlers();
    
    // Start the notification scheduler
    // Temporarily disabled until scheduled_notifications table is created
    // schedulerService.start();
    
    console.log('✅ App component initialization complete');
    
    // Setup notification click handlers
    setupNotificationHandlers();
    
    // Cleanup on unmount
    return () => {
      // schedulerService.stop();
    };
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <SecurityProvider>
            <CalendarProviderWrapper>
              <Toaster position="top-right" />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/user-switch" element={<UserSwitch />} />
              <Route path="/auth/google/callback" element={<GoogleCallback />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="calendar">
                  <Route index element={<Navigate to="/calendar/my" replace />} />
                  <Route path="my" element={<MyCalendarStandalone />} />
                  <Route path="vehicle" element={<VehicleReservation />} />
                  <Route path="room" element={<RoomReservation />} />
                  <Route 
                    path="sample" 
                    element={
                      <ProtectedRoute requireSampleAccess={true}>
                        <SampleReservation />
                      </ProtectedRoute>
                    } 
                  />
                </Route>
                <Route path="leave" element={<LeaveRequests />} />
                <Route path="groups">
                  <Route index element={<BusinessGroupManagement />} />
                  <Route path="business" element={<BusinessGroupManagement />} />
                </Route>
                <Route path="settings">
                  <Route path="notifications" element={<NotificationSettings />} />
                  <Route path="google-calendar" element={<GoogleCalendarSettings />} />
                </Route>
                <Route path="admin">
                  <Route 
                    path="users" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <AdminUsers />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="groups" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <AdminGroups />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="equipment" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <EquipmentManagement />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="departments" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <DepartmentManagement />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="leave-groups" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <LeaveGroupManagement />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="schedule-history" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <ScheduleHistory />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="email-templates" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <EmailTemplateManagement />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="holidays" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <HolidayManagement />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="operation-logs" 
                    element={
                      <ProtectedRoute minRole="admin">
                        <OperationLogs />
                      </ProtectedRoute>
                    } 
                  />
                </Route>
              </Route>
            </Routes>
          </CalendarProviderWrapper>
        </SecurityProvider>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
}

export default App;