import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User as UserType } from '../types';

export default function UserSwitch() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { switchUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      console.log('DBからユーザーデータ取得開始');
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name_kana');

      if (error) {
        console.error('ユーザーデータ取得エラー:', error);
        setError('ユーザーデータの取得に失敗しました');
        return;
      }

      console.log('取得したユーザーデータ:', data);

      // DBデータをアプリのUser型に変換
      const convertedUsers: UserType[] = data?.map(u => ({
        id: u.id,
        employeeId: u.employee_id,
        name: u.name,
        nameKana: u.name_kana,
        email: u.email,
        phone: u.phone,
        department: u.department,
        role: u.role,
        defaultWorkDays: u.default_work_days || []
      })) || [];

      setUsers(convertedUsers);
      console.log('変換されたユーザーデータ:', convertedUsers);
    } catch (err) {
      console.error('fetchUsers エラー:', err);
      setError('データベース接続エラー');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    console.log('ユーザー選択:', userId);
    const user = users.find(u => u.id === userId);
    console.log('見つかったユーザー:', user);
    if (user) {
      console.log('switchUser実行');
      switchUser(user);
      console.log('navigate実行');
      navigate('/');
    } else {
      console.error('ユーザーが見つかりません:', userId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Calendar className="h-12 w-12 text-blue-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          ユーザーを選択してください
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          共有PCでのユーザー切り替え
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">ユーザーデータを読み込み中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchUsers}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                再試行
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user.id)}
                  className="w-full flex items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-lg">
                      {user.name.charAt(0)}
                    </span>
                  </div>
                  <div className="ml-4 flex-1 text-left">
                    <div className="text-lg font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">
                      {user.department} • {
                        user.role === 'president' ? '社長' : 
                        user.role === 'admin' ? '管理者' : '社員'
                      }
                    </div>
                  </div>
                  <User className="h-5 w-5 text-gray-400" />
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            このシステムは共有PC用に設計されています
          </p>
        </div>
      </div>
    </div>
  );
}