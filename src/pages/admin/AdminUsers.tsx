import { useState, useEffect } from 'react';
import { User, Department, UserRole } from '../../types';
import { mockUsers } from '../../data/mockData';
import { Plus, Pencil, Trash2, UserPlus, X, HelpCircle, ChevronUp, ChevronDown, Eye, EyeOff, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import UserDeleteHelper from '../../components/UserDeleteHelper';
import { useAuth } from '../../contexts/AuthContext';

type SortField = 'employeeId' | 'name' | 'nameKana' | 'email' | 'department' | 'role';
type SortDirection = 'asc' | 'desc';

export default function AdminUsers() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [loading, setLoading] = useState(true);
  const [deleteHelperUser, setDeleteHelperUser] = useState<User | null>(null);
  const [sortField, setSortField] = useState<SortField>('nameKana');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [leaveManagerId, setLeaveManagerId] = useState<string | null>(null);

  // Load users from Supabase
  useEffect(() => {
    fetchUsers();
    fetchLeaveManager();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name_kana');
      
      if (error) {
        console.error('Error fetching users:', error);
        setUsers(mockUsers);
      } else {
        const convertedUsers: User[] = data?.map(u => ({
          id: u.id,
          employeeId: u.employee_id,
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone,
          department: u.department,
          role: u.role,
          isHr: u.is_hr || false,
          isSampleStaff: u.is_sample_staff || false,
          defaultWorkDays: u.default_work_days || [
            { day: 1, startTime: '09:00', endTime: '18:00' },
            { day: 2, startTime: '09:00', endTime: '18:00' },
            { day: 3, startTime: '09:00', endTime: '18:00' },
            { day: 4, startTime: '09:00', endTime: '18:00' },
            { day: 5, startTime: '09:00', endTime: '18:00' },
          ]
        })) || [];
        setUsers(convertedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchLeaveManager = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_manager_settings')
        .select('user_id')
        .eq('is_active', true)
        .maybeSingle();
      
      console.log('fetchLeaveManager - data:', data);
      console.log('fetchLeaveManager - error:', error);
      
      if (data) {
        setLeaveManagerId(data.user_id);
        console.log('Leave manager ID set to:', data.user_id);
      } else {
        setLeaveManagerId(null);
        console.log('No active leave manager found');
      }
    } catch (error) {
      console.error('Error fetching leave manager:', error);
    }
  };
  
  // Sort users
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with ascending order
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const sortedUsers = [...users].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    
    // Handle null/undefined values
    if (!aValue) aValue = '';
    if (!bValue) bValue = '';
    
    // Convert to string for comparison
    aValue = String(aValue).toLowerCase();
    bValue = String(bValue).toLowerCase();
    
    // Japanese collation for name fields
    if (sortField === 'name' || sortField === 'nameKana') {
      const comparison = aValue.localeCompare(bValue, 'ja');
      return sortDirection === 'asc' ? comparison : -comparison;
    }
    
    // Standard comparison for other fields
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Column header component with sort indicator
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    return (
      <th 
        scope="col" 
        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center space-x-1">
          <span>{children}</span>
          <div className="flex flex-col">
            <ChevronUp 
              className={`h-3 w-3 ${sortField === field && sortDirection === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
            />
            <ChevronDown 
              className={`h-3 w-3 -mt-1 ${sortField === field && sortDirection === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
            />
          </div>
        </div>
      </th>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced Validation
    const errors = [];
    
    if (!formData.name?.trim()) {
      errors.push('名前を入力してください');
    }
    
    if (!formData.email?.trim()) {
      errors.push('メールアドレスを入力してください');
    } else if (!formData.email.includes('@')) {
      errors.push('有効なメールアドレスを入力してください');
    }
    
    if (!formData.employeeId?.trim()) {
      errors.push('社員番号を入力してください');
    }
    
    // 新規作成時のみパスワードをチェック
    if (!editingUser) {
      if (!password.trim()) {
        errors.push('パスワードを入力してください');
      } else if (password.length < 6) {
        errors.push('パスワードは6文字以上で入力してください');
      }
    }
    
    // 編集時にパスワード変更がチェックされている場合
    if (editingUser && changePassword) {
      if (!password.trim()) {
        errors.push('新しいパスワードを入力してください');
      } else if (password.length < 6) {
        errors.push('パスワードは6文字以上で入力してください');
      }
    }
    
    if (!formData.department) {
      errors.push('所属を選択してください');
    }
    
    if (!formData.role) {
      errors.push('権限を選択してください');
    }
    
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    
    try {
      const defaultWorkDays = [
        { day: 1, startTime: '09:00', endTime: '18:00' },
        { day: 2, startTime: '09:00', endTime: '18:00' },
        { day: 3, startTime: '09:00', endTime: '18:00' },
        { day: 4, startTime: '09:00', endTime: '18:00' },
        { day: 5, startTime: '09:00', endTime: '18:00' },
      ];

      if (editingUser) {
        // Update user
        const updateData = {
          employee_id: formData.employeeId || '',
          name: formData.name || '',
          name_kana: formData.nameKana || '',
          email: formData.email || '',
          phone: formData.phone || '',
          department: formData.department || '所属なし',
          role: formData.role || 'employee',
          is_hr: formData.isHr === true, // 明示的にboolean型に変換
          is_sample_staff: formData.isSampleStaff === true,
          default_work_days: formData.defaultWorkDays || defaultWorkDays,
          updated_at: new Date().toISOString()
        };
        
        console.log('Updating user data:', updateData);
        
        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);
        
        if (error) {
          console.error('Supabase update error:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          console.error('Error details:', error.details);
          console.error('Error hint:', error.hint);
          throw error;
        }
        
        // 休暇申請責任者の設定を更新
        console.log('isLeaveManager form value:', formData.isLeaveManager);
        console.log('Current user:', currentUser);
        console.log('Editing user:', editingUser);
        
        if (formData.isLeaveManager !== undefined) {
          console.log('Processing leave manager setting:', formData.isLeaveManager);
          
          if (formData.isLeaveManager) {
            console.log('Setting user as leave manager...');
            
            // まず既存の休暇申請責任者を無効化
            const { error: deactivateError } = await supabase
              .from('leave_manager_settings')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .neq('user_id', editingUser.id);
            
            if (deactivateError) {
              console.error('Error deactivating existing leave manager:', deactivateError);
            }
            
            // 既存のレコードがあるか確認（is_activeの状態に関わらず）
            const { data: existingRecord, error: checkError } = await supabase
              .from('leave_manager_settings')
              .select('id, is_active')
              .eq('user_id', editingUser.id)
              .maybeSingle();
            
            console.log('Current user role:', currentUser?.role);
            console.log('Existing leave manager record:', existingRecord);
            console.log('Check error:', checkError);
            
            if (existingRecord) {
              // 既存レコードを更新（既にアクティブでも更新）
              const { error: updateError } = await supabase
                .from('leave_manager_settings')
                .update({
                  is_active: true,
                  updated_at: new Date().toISOString()
                })
                .eq('user_id', editingUser.id);
              
              if (updateError) {
                console.error('Leave manager update error:', updateError);
                console.error('Update error details:', {
                  code: updateError.code,
                  message: updateError.message,
                  details: updateError.details,
                  hint: updateError.hint
                });
                toast.error('休暇申請責任者の設定に失敗しました');
              } else {
                toast.success('休暇申請責任者を設定しました');
              }
            } else {
              // 新規レコードを作成
              const { error: insertError } = await supabase
                .from('leave_manager_settings')
                .insert({
                  user_id: editingUser.id,
                  is_active: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              
              if (insertError) {
                // 重複エラーの場合は、upsertで再試行
                if (insertError.code === '23505') {
                  console.log('Duplicate key error, trying update instead...');
                  const { error: updateError } = await supabase
                    .from('leave_manager_settings')
                    .update({
                      is_active: true,
                      updated_at: new Date().toISOString()
                    })
                    .eq('user_id', editingUser.id);
                  
                  if (updateError) {
                    console.error('Leave manager update after duplicate error:', updateError);
                    toast.error('休暇申請責任者の設定に失敗しました');
                  } else {
                    toast.success('休暇申請責任者を設定しました');
                  }
                } else {
                  console.error('Leave manager insert error:', insertError);
                  console.error('Insert error details:', {
                    code: insertError.code,
                    message: insertError.message,
                    details: insertError.details,
                    hint: insertError.hint
                  });
                  toast.error('休暇申請責任者の設定に失敗しました');
                }
              } else {
                toast.success('休暇申請責任者を設定しました');
              }
            }
          } else {
            // 休暇申請責任者から解除
            const { error: deactivateError } = await supabase
              .from('leave_manager_settings')
              .update({ 
                is_active: false,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', editingUser.id);
            
            if (deactivateError) {
              console.error('Error deactivating leave manager:', deactivateError);
            }
          }
        }
        
        // パスワード変更処理（社長・管理者権限）
        if (changePassword && (currentUser?.role === 'president' || currentUser?.role === 'admin')) {
          try {
            // Supabase Auth APIを使用してパスワードを更新
            // 注意: 実際の本番環境では、サーバーサイドでの処理が推奨されます
            
            // まずは対象ユーザーのメールアドレスを取得
            const targetEmail = editingUser.email;
            
            if (!targetEmail) {
              toast.error('ユーザーのメールアドレスが設定されていません');
              throw new Error('No email address');
            }
            
            // Supabase Admin APIを使用する代替方法
            // 注意: これは管理者権限が必要で、通常はサーバーサイドで実行すべきです
            try {
              // パスワードをユーザーテーブルに保存（暫定的な解決策）
              const { error: updateError } = await supabase
                .from('users')
                .update({ 
                  password: password,
                  updated_at: new Date().toISOString()
                })
                .eq('id', editingUser.id);
              
              if (updateError) {
                console.error('Password update error:', updateError);
                toast.error('パスワードの更新に失敗しました');
              } else {
                toast.success('パスワードを更新しました');
                toast(`新しいパスワード: ${password}`, { 
                  duration: 10000,
                  icon: '🔐'
                });
                
                // Authのパスワードも更新を試みる（可能な場合）
                const { error: authError } = await supabase.auth.updateUser({
                  password: password
                });
                
                if (authError) {
                  console.log('Auth password update skipped:', authError.message);
                }
              }
            } catch (dbError) {
              console.error('Database update error:', dbError);
              toast.error('パスワードの更新に失敗しました');
            }
          } catch (error) {
            console.error('Password update error:', error);
            toast.error('パスワードの更新に失敗しました');
          }
        }
        
        toast.success('ユーザーを更新しました');
      } else {
        // Create user with authentication
        try {
          // 重複チェック
          const { data: existingUsers } = await supabase
            .from('users')
            .select('id, email, employee_id')
            .or(`email.eq.${formData.email},employee_id.eq.${formData.employeeId}`)
            .limit(1);

          if (existingUsers && existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            if (existingUser.email === formData.email && existingUser.employee_id === formData.employeeId) {
              toast.error('このメールアドレスと社員番号は既に登録されています');
            } else if (existingUser.email === formData.email) {
              toast.error('このメールアドレスは既に登録されています');
            } else if (existingUser.employee_id === formData.employeeId) {
              toast.error('社員番号が重複しています。');
            }
            return;
          }

          // First, create auth user with password
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email || '',
            password: password,
            options: {
              data: {
                name: formData.name,
                employee_id: formData.employeeId
              }
            }
          });
          
          if (authError) {
            console.error('Auth creation error:', authError);
            if (authError.message.includes('already registered')) {
              toast.error('このメールアドレスは既に登録されています');
            } else {
              toast.error(`認証エラー: ${authError.message}`);
            }
            return;
          }
          
          // Then create user profile
          const insertData = {
            id: authData.user?.id, // Use auth user ID
            employee_id: formData.employeeId || '',
            name: formData.name || '',
            name_kana: formData.nameKana || '',
            email: formData.email || '',
            phone: formData.phone || '',
            department: formData.department || '所属なし',
            role: formData.role || 'employee',
            is_hr: formData.isHr === true,
            is_sample_staff: formData.isSampleStaff === true,
            default_work_days: defaultWorkDays
          };
          
          console.log('Inserting user data:', insertData);
          
          const { data, error } = await supabase
            .from('users')
            .insert([insertData])
            .select();
          
          if (error) {
            console.error('Supabase insert error:', error);
            // If profile creation fails, we should ideally delete the auth user
            // But for now, just report the error
            throw error;
          }
          
          toast.success('ユーザーを作成しました');
          toast(`パスワード: ${password}`, { 
            duration: 10000,
            icon: '🔐'
          });
        } catch (error: any) {
          console.error('User creation error:', error);
          throw error;
        }
      }

      // Refresh data
      await fetchUsers();
      await fetchLeaveManager();
      
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({});
      setPassword(''); // パスワードをクリア
      setShowPassword(false);
      setChangePassword(false);
    } catch (error: any) {
      console.error('Error saving user:', error);
      console.error('FormData:', formData);
      
      if (error.code === '42703') {
        toast.error('データベースにis_hrカラムが存在しません。管理者に連絡してください。');
      } else if (error.code === '23505') {
        // ユニーク制約違反
        if (error.message?.includes('employee_id')) {
          toast.error('社員番号が重複しています。');
        } else if (error.message?.includes('email')) {
          toast.error('このメールアドレスは既に登録されています');
        } else {
          toast.error('重複するデータが存在します');
        }
      } else if (error.message) {
        toast.error(`保存エラー: ${error.message}`);
      } else if (error.details) {
        toast.error(`保存エラー: ${error.details}`);
      } else {
        toast.error('保存中にエラーが発生しました');
      }
    }
  };

  const handleEdit = async (user: User) => {
    setEditingUser(user);
    
    // 休暇申請責任者かどうかを確認
    const { data: leaveManagerData, error: leaveManagerError } = await supabase
      .from('leave_manager_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    
    console.log('handleEdit - user:', user);
    console.log('handleEdit - leaveManagerData:', leaveManagerData);
    console.log('handleEdit - leaveManagerError:', leaveManagerError);
    
    const isLeaveManager = !!leaveManagerData;
    console.log('handleEdit - isLeaveManager:', isLeaveManager);
    
    setFormData({
      ...user,
      isSampleStaff: user.isSampleStaff || false,
      isLeaveManager: isLeaveManager
    });
    setPassword(''); // パスワードをクリア
    setChangePassword(false); // パスワード変更チェックボックスをリセット
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (confirm('このユーザーを削除してもよろしいですか？')) {
      try {
        // First, check if this user has any associated data
        const userToDelete = users.find(u => u.id === userId);
        if (!userToDelete) {
          toast.error('ユーザーが見つかりません');
          return;
        }

        // Log the deletion attempt
        console.log('Attempting to delete user:', {
          id: userId,
          name: userToDelete.name,
          role: userToDelete.role
        });

        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);
        
        if (error) {
          console.error('Detailed deletion error:', error);
          
          // Check for specific error types
          if (error.code === '23503') {
            toast.error('このユーザーは他のデータで使用されているため削除できません');
          } else if (error.code === '42501') {
            toast.error('削除権限がありません');
          } else if (error.message?.includes('row-level security')) {
            toast.error('セキュリティポリシーにより削除が制限されています');
          } else {
            toast.error(`削除エラー: ${error.message || '不明なエラー'}`);
          }
          
          // Provide more specific error messages
          if (error.code === '23503') {
            toast.error('このユーザーには関連データが存在するため削除できません。先に関連データを削除してください。');
          } else if (error.code === '42501') {
            toast.error('権限エラー: このユーザーを削除する権限がありません。');
          } else if (error.message?.includes('row-level security')) {
            toast.error('セキュリティポリシーによりこのユーザーを削除できません。');
          } else {
            toast.error(`削除エラー: ${error.message || '不明なエラーが発生しました'}`);
          }
          return;
        }
        
        toast.success('ユーザーを削除しました');
        await fetchUsers(); // Refresh data
      } catch (error: any) {
        console.error('Unexpected error deleting user:', error);
        toast.error(`予期しないエラー: ${error?.message || '削除中にエラーが発生しました'}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">ユーザーデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">ユーザー管理</h1>
        <button 
          onClick={() => {
            setEditingUser(null);
            setPassword(''); // パスワードをリセット
            setShowPassword(false);
            // 自動的にユニークな社員番号を生成
            const timestamp = Date.now().toString(36).toUpperCase();
            const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
            setFormData({
              employeeId: `EMP-${timestamp}-${randomPart}`,
              role: 'employee' as UserRole, // デフォルトで社員権限を設定
              department: '所属なし' as Department, // デフォルトで所属なしを設定
              isSampleStaff: false, // サンプル担当者フラグの初期値
              isHr: false, // 人事担当者フラグの初期値
              isLeaveManager: false // 休暇申請責任者フラグの初期値
            });
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <UserPlus className="h-5 w-5 mr-1" />
          ユーザー作成
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="nameKana">社員情報</SortableHeader>
              <SortableHeader field="department">所属</SortableHeader>
              <SortableHeader field="role">権限</SortableHeader>
              <SortableHeader field="email">連絡先</SortableHeader>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">アクション</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-700 font-medium text-sm">
                        {user.name.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.nameKana}</div>
                      <div className="text-xs text-gray-400">{user.employeeId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.department}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'president' ? 'bg-purple-100 text-purple-800' :
                      user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'president' ? '社長' :
                       user.role === 'admin' ? '管理者' : '社員'}
                    </span>
                    {user.isHr && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                        人事
                      </span>
                    )}
                    {user.isSampleStaff && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                        サンプル担当者
                      </span>
                    )}
                    {user.id === leaveManagerId && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        休暇責任者
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>{user.email}</div>
                  <div>{user.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleEdit(user)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                    title="編集"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteHelperUser(user)}
                    className="text-yellow-600 hover:text-yellow-900 mr-3"
                    title="削除前チェック"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-900"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingUser ? 'ユーザー編集' : 'ユーザー作成'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">社員番号</label>
                <input
                  type="text"
                  value={formData.employeeId || ''}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  placeholder="自動生成されます"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">名前</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">フリガナ</label>
                <input
                  type="text"
                  value={formData.nameKana || ''}
                  onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@company.com"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">パスワード</label>
                  <div className="mt-1 relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="6文字以上で入力してください"
                      className="block w-full pr-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      required={!editingUser}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    ユーザーの初回ログイン用パスワード
                  </p>
                </div>
              )}
              {editingUser && (currentUser?.role === 'president' || currentUser?.role === 'admin') && (
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={changePassword}
                      onChange={(e) => {
                        setChangePassword(e.target.checked);
                        if (!e.target.checked) {
                          setPassword('');
                          setShowPassword(false);
                        }
                      }}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      <Key className="h-4 w-4 inline mr-1" />
                      パスワードを変更する
                    </span>
                  </label>
                  {changePassword && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">新しいパスワード</label>
                      <div className="mt-1 relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="6文字以上で入力してください"
                          className="block w-full pr-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        このユーザーの新しいログインパスワード
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">電話番号</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">所属</label>
                <select
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value as Department })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="本社（１階）">本社（１階）</option>
                  <option value="本社（２階）">本社（２階）</option>
                  <option value="本社（３階）">本社（３階）</option>
                  <option value="仕上げ・プレス">仕上げ・プレス</option>
                  <option value="CAD-CAM">CAD-CAM</option>
                  <option value="WEB">WEB</option>
                  <option value="所属なし">所属なし</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">権限</label>
                <select
                  value={formData.role || 'employee'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="employee">社員</option>
                  <option value="admin">管理者</option>
                  <option value="president">社長</option>
                </select>
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isSampleStaff || false}
                    onChange={(e) => setFormData({ ...formData, isSampleStaff: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">サンプル担当者</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">サンプル予約の担当者として選択可能になります</p>
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isHr || false}
                    onChange={(e) => setFormData({ ...formData, isHr: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">人事担当者</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">休暇申請の社長承認後に通知を受け取ります</p>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isLeaveManager || false}
                    onChange={(e) => {
                      console.log('Leave manager checkbox changed:', e.target.checked);
                      setFormData({ ...formData, isLeaveManager: e.target.checked });
                    }}
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">休暇申請責任者</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">休暇申請グループ承認後、社長承認前に承認権限を持ちます（1人のみ設定可能）</p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {editingUser ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Delete Helper Modal */}
      {deleteHelperUser && (
        <UserDeleteHelper
          user={deleteHelperUser}
          onClose={() => setDeleteHelperUser(null)}
        />
      )}
    </div>
  );
}