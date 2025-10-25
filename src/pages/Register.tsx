import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    nameKana: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    department: '',
    role: 'employee' as 'employee' | 'admin' | 'president'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('パスワードが一致しません');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('パスワードは6文字以上で入力してください');
      return;
    }

    setIsLoading(true);

    try {
      // まず、メールアドレスが既に登録されているかチェック
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${formData.email},employee_id.eq.${formData.employeeId}`)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        // より詳細なエラーメッセージを表示
        const existingUser = existingUsers[0];
        const { data: userData } = await supabase
          .from('users')
          .select('email, employee_id')
          .or(`email.eq.${formData.email},employee_id.eq.${formData.employeeId}`)
          .limit(1)
          .single();
        
        if (userData) {
          if (userData.email === formData.email && userData.employee_id === formData.employeeId) {
            toast.error('このメールアドレスと社員番号は既に登録されています');
          } else if (userData.email === formData.email) {
            toast.error('このメールアドレスは既に登録されています');
          } else if (userData.employee_id === formData.employeeId) {
            toast.error('社員番号が重複しています。');
          }
        } else {
          toast.error('このメールアドレスまたは社員番号は既に登録されています');
        }
        setIsLoading(false);
        return;
      }

      // UUIDを生成（簡易版）
      const userId = crypto.randomUUID();

      // usersテーブルに直接ユーザー情報を保存
      const { error: dbError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          employee_id: formData.employeeId,
          name: formData.name,
          name_kana: formData.nameKana,
          email: formData.email,
          phone: formData.phone || null,
          department: formData.department,
          role: formData.role,
          password: formData.password, // 開発環境では平文で保存
          default_work_days: []
        }]);

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      // 登録成功メッセージ
      toast.success('登録が完了しました');
      
      // 自動的にログイン
      const loginSuccess = await login(formData.email, formData.password);
      if (loginSuccess) {
        navigate('/');
      } else {
        navigate('/login');
      }
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // エラーメッセージの処理
      if (error.code === '23505') {
        // PostgreSQLの重複エラー
        toast.error('この社員番号またはメールアドレスは既に使用されています');
      } else if (error.message?.includes('duplicate key')) {
        toast.error('この社員番号またはメールアドレスは既に使用されています');
      } else {
        toast.error('登録に失敗しました。入力内容を確認してください');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            新規アカウント登録
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            既にアカウントをお持ちの方は{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              ログイン
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="employeeId" className="sr-only">
                社員番号
              </label>
              <input
                id="employeeId"
                name="employeeId"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="社員番号"
                value={formData.employeeId}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="name" className="sr-only">
                氏名
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="氏名"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="nameKana" className="sr-only">
                氏名（カナ）
              </label>
              <input
                id="nameKana"
                name="nameKana"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="氏名（カナ）"
                value={formData.nameKana}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレス"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード（6文字以上）"
                value={formData.password}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード（確認）"
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="phone" className="sr-only">
                電話番号
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="電話番号（任意）"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="department" className="sr-only">
                部署
              </label>
              <input
                id="department"
                name="department"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="部署"
                value={formData.department}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="role" className="sr-only">
                権限
              </label>
              <select
                id="role"
                name="role"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.role}
                onChange={handleInputChange}
              >
                <option value="employee">一般社員</option>
                <option value="admin">管理者</option>
                <option value="president">社長</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="font-medium text-blue-800">登録について</p>
            <p className="mt-1">登録後、自動的にログインされダッシュボードに移動します。</p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登録中...' : '登録する'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}