import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  // Role-based protection (簡素化)
  minRole?: UserRole;
  // Redirect options
  redirectTo?: string;
  // Sample reservation access check
  requireSampleAccess?: boolean;
}

export default function ProtectedRoute({ 
  children,
  minRole,
  requireSampleAccess,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { isAuthenticated, currentUser, isLoading } = useAuth();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Authentication check
  if (!isAuthenticated || !currentUser) {
    return <Navigate to={redirectTo} replace />;
  }

  // Sample reservation access check
  if (requireSampleAccess) {
    const hasSampleAccess = currentUser.role === 'president' || 
                           currentUser.role === 'admin' || 
                           currentUser.isHr === true ||
                           currentUser.isSampleStaff === true;
    
    if (!hasSampleAccess) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">アクセス権限がありません</h2>
            <p className="text-gray-600 mb-4">サンプル予約へのアクセス権限が必要です</p>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              戻る
            </button>
          </div>
        </div>
      );
    }
  }

  // Role check (簡素化)
  if (minRole && currentUser.role !== 'president') {
    console.log('🔍 ProtectedRoute - 権限チェック:', {
      minRole,
      currentUserRole: currentUser.role,
      isPresident: currentUser.role === 'president',
      isAdmin: currentUser.role === 'admin'
    });
    
    if (minRole === 'admin' && currentUser.role !== 'admin' && currentUser.role !== 'president') {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">アクセス権限がありません</h2>
            <p className="text-gray-600 mb-4">管理者権限が必要です</p>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              戻る
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}