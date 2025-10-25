import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  switchUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('ログイン試行:', email);
      
      // メールアドレスでユーザーを検索
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .limit(1);

      if (fetchError) {
        console.error('User fetch error:', fetchError);
        return false;
      }

      if (!users || users.length === 0) {
        console.log('ユーザーが見つかりません:', email);
        return false;
      }

      const user = users[0];
      
      console.log('🔍 ログインユーザー情報:', {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      });

      // パスワード検証（実際のプロダクションではハッシュ化されたパスワードと比較）
      // 今回はシンプルな実装として平文比較
      if (user.password && user.password !== password) {
        console.log('パスワードが一致しません');
        return false;
      }

      // パスワードが設定されていない場合は任意のパスワードでログイン可能（既存の動作を維持）
      if (!user.password) {
        console.log('パスワード未設定のユーザー、任意のパスワードでログイン許可');
      }

      // ログイン成功
      const loginUser: User = {
        id: user.id,
        employeeId: user.employee_id,
        name: user.name,
        nameKana: user.name_kana,
        email: user.email,
        phone: user.phone,
        department: user.department,
        role: user.role,
        isHr: user.is_hr || false,
        isSampleStaff: user.is_sample_staff || false,
        defaultWorkDays: user.default_work_days || []
      };

      console.log('ログイン成功:', loginUser.name);
      setCurrentUser(loginUser);
      setIsAuthenticated(true);
      localStorage.setItem('currentUser', JSON.stringify(loginUser));
      console.log('localStorageに保存完了:', JSON.stringify(loginUser));
      
      return true;
    } catch (error) {
      console.error('ログインエラー:', error);
      return false;
    }
  };

  const switchUser = (user: User) => {
    console.log('ユーザー切り替え:', user.name, 'ID:', user.id);
    setCurrentUser(user);
    setIsAuthenticated(true);
    // ローカルストレージに保存（共有PC対応）
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const logout = () => {
    console.log('ログアウト');
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('currentUser');
  };

  // アプリ起動時にローカルストレージからユーザー情報を復元
  useEffect(() => {
    console.log('🔐 AuthProvider: 初期化開始');
    const savedUser = localStorage.getItem('currentUser');
    console.log('🔐 AuthProvider: localStorage内容:', savedUser);
    
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log('🔐 AuthProvider: ユーザー情報パース成功:', user);
        setCurrentUser(user);
        setIsAuthenticated(true);
        console.log('🔐 保存されたユーザー情報を復元:', user.name);
      } catch (error) {
        console.error('🚨 ユーザー情報の復元に失敗:', error);
        
        // Check for specific error patterns
        const errorStr = String(error);
        if (errorStr.includes('利用できません') || errorStr.includes('式')) {
          console.error('🎯 Detected "利用できません" error in AuthContext!');
          console.error('Full error details:', {
            error: error,
            savedUser: savedUser,
            timestamp: new Date().toISOString()
          });
        }
        
        localStorage.removeItem('currentUser');
      }
    } else {
      console.log('🔐 AuthProvider: localStorageにユーザー情報なし');
    }
    
    setIsLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      currentUser,
      isAuthenticated,
      isLoading,
      login,
      switchUser,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}