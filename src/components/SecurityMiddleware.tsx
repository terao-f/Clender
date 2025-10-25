import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '../contexts/SecurityContext';
import { useAuth } from '../contexts/AuthContext';

interface SecurityMiddlewareProps {
  children: ReactNode;
}

/**
 * Security middleware component that handles session timeout, 
 * activity monitoring, and security warnings
 */
export default function SecurityMiddleware({ children }: SecurityMiddlewareProps) {
  const { 
    sessionInfo, 
    checkSessionValidity, 
    extendSession, 
    logSecurityEvent,
    securitySettings 
  } = useSecurity();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Session timeout warning threshold (5 minutes before expiry)
  const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Track user activity
  useEffect(() => {
    const trackActivity = () => {
      setLastActivity(Date.now());
      extendSession();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, trackActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity, true);
      });
    };
  }, [extendSession]);

  // Session monitoring
  useEffect(() => {
    if (!sessionInfo || !currentUser) return;

    const interval = setInterval(() => {
      if (!checkSessionValidity()) {
        logSecurityEvent({
          type: 'security_violation',
          action: 'Session expired - forcing logout',
          severity: 'medium',
        });
        
        handleForceLogout('セッションが期限切れです');
        return;
      }

      // Check if we should show timeout warning
      const now = new Date();
      const timeUntilExpiry = sessionInfo.expiresAt.getTime() - now.getTime();
      
      if (timeUntilExpiry <= WARNING_THRESHOLD && timeUntilExpiry > 0) {
        setTimeLeft(Math.ceil(timeUntilExpiry / 1000));
        setShowTimeoutWarning(true);
      } else {
        setShowTimeoutWarning(false);
      }

      // Check for inactive session
      const timeSinceActivity = now.getTime() - lastActivity;
      if (timeSinceActivity > securitySettings.sessionTimeout * 60 * 1000) {
        logSecurityEvent({
          type: 'security_violation',
          action: 'Session timeout due to inactivity',
          severity: 'medium',
        });
        
        handleForceLogout('非アクティブのためセッションがタイムアウトしました');
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [sessionInfo, currentUser, lastActivity, checkSessionValidity, logSecurityEvent, securitySettings.sessionTimeout]);

  // Handle forced logout
  const handleForceLogout = (reason: string) => {
    setShowTimeoutWarning(false);
    logout();
    navigate('/login', { 
      replace: true, 
      state: { message: reason, type: 'warning' }
    });
  };

  // Extend session when user chooses to continue
  const handleExtendSession = () => {
    extendSession();
    setShowTimeoutWarning(false);
    
    logSecurityEvent({
      type: 'admin_action',
      action: 'User extended session',
      severity: 'low',
    });
  };

  // Handle logout from warning
  const handleLogoutFromWarning = () => {
    logSecurityEvent({
      type: 'logout',
      action: 'User logged out from timeout warning',
      severity: 'low',
    });
    
    setShowTimeoutWarning(false);
    logout();
    navigate('/login');
  };

  // Format time left
  const formatTimeLeft = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {children}
      
      {/* Session Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    セッション期限警告
                  </h3>
                  
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      セッションの有効期限が近づいています。
                      <br />
                      残り時間: <span className="font-mono font-bold text-red-600">{formatTimeLeft(timeLeft)}</span>
                    </p>
                    
                    <p className="text-sm text-gray-500 mt-2">
                      継続する場合は「セッション延長」を、
                      ログアウトする場合は「ログアウト」をクリックしてください。
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleExtendSession}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  セッション延長
                </button>
                
                <button
                  type="button"
                  onClick={handleLogoutFromWarning}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}