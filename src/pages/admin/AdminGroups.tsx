import { useState, useEffect } from 'react';
import { Group, GroupType, User } from '../../types';
import { mockGroups } from '../../data/mockData';
import { Plus, Pencil, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ParticipantSelector from '../../components/ParticipantSelector';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminGroups() {
  const { currentUser } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<Partial<Group>>({ type: 'business' });
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  // Load groups and users from Supabase
  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('type, name');
      
      if (error) {
        console.error('Error fetching groups:', error);
        setGroups(mockGroups);
      } else {
        const convertedGroups: Group[] = data?.map(g => ({
          id: g.id,
          name: g.name,
          type: g.type,
          members: g.members || [],
          createdBy: g.created_by,
          createdAt: new Date(g.created_at)
        })) || [];
        
        // 所属（department）タイプのグループを除外
        const filteredGroups = convertedGroups.filter(g => g.type !== 'department');
        setGroups(filteredGroups);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups(mockGroups);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, name_kana, email, department, role, employee_id, phone')
        .order('name_kana');
      
      if (!error && data) {
        const convertedUsers: User[] = data.map(u => ({
          id: u.id,
          employeeId: u.employee_id || '',
          name: u.name,
          nameKana: u.name_kana,
          email: u.email,
          phone: u.phone || '',
          department: u.department,
          role: u.role,
          defaultWorkDays: []
        }));
        setUsers(convertedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    if (!formData.name?.trim()) {
      toast.error('グループ名を入力してください');
      return;
    }
    
    if (!formData.members || formData.members.length === 0) {
      toast.error('メンバーを選択してください');
      return;
    }
    
    try {
      if (editingGroup) {
        // Update group
        const { error } = await supabase
          .from('groups')
          .update({
            name: formData.name?.trim() || '',
            type: formData.type || 'business',
            members: formData.members || [],
            updated_at: new Date().toISOString()
          })
          .eq('id', editingGroup.id);
        
        if (error) throw error;
        toast.success('グループを更新しました');
      } else {
        // Create group
        // AuthContextのcurrentUserを優先的に使用
        if (!currentUser?.id) {
          toast.error('ユーザー情報が取得できません。ログアウトして再度ログインしてください。');
          return;
        }
        
        const creatorId = currentUser.id;
        console.log('Creating group with user ID:', creatorId);
        
        // 現在のユーザーがusersテーブルに存在するか確認
        const { data: userExists, error: userCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('id', creatorId)
          .single();
          
        if (userCheckError || !userExists) {
          console.error('User not found in users table:', creatorId, userCheckError);
          toast.error('ユーザー情報が見つかりません。管理者に連絡してください。');
          return;
        }
        
        // 既存のグループ名をチェック
        const { data: existingGroups, error: checkError } = await supabase
          .from('groups')
          .select('name')
          .eq('name', formData.name?.trim())
          .single();
        
        if (existingGroups) {
          toast.error('同じ名前のグループが既に存在します');
          return;
        }
        
        const { data, error } = await supabase
          .from('groups')
          .insert([{
            id: crypto.randomUUID(), // 明示的にUUIDを生成
            name: formData.name?.trim() || '',
            type: formData.type as GroupType || 'business',
            members: formData.members || [],
            created_by: creatorId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select();
        
        if (error) {
          console.error('Group creation error details:', {
            error,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            data: {
              name: formData.name,
              type: formData.type,
              members: formData.members,
              created_by: creatorId
            }
          });
          
          if (error.code === '23505') {
            toast.error('同じ名前のグループが既に存在します');
            return;
          }
          if (error.code === '42501') {
            toast.error('グループ作成の権限がありません');
            return;
          }
          if (error.message?.includes('violates row-level security policy')) {
            toast.error('セキュリティポリシーによりグループを作成できません');
            return;
          }
          
          toast.error(`エラー: ${error.message || 'グループの作成に失敗しました'}`);
          return;
        }
        
        if (data) {
          toast.success('グループを作成しました');
        }
      }

      // Refresh data
      await fetchGroups();
      
      setIsModalOpen(false);
      setEditingGroup(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving group:', error);
      if (error instanceof Error) {
        toast.error(`保存エラー: ${error.message}`);
      } else {
        toast.error('保存中にエラーが発生しました');
      }
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData(group);
    setIsModalOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    if (confirm('このグループを削除してもよろしいですか？')) {
      try {
        // 即座にフロントエンドの状態を更新（オプティミスティック更新）
        const previousGroups = groups;
        setGroups(prev => prev.filter(g => g.id !== groupId));
        
        const { error } = await supabase
          .from('groups')
          .delete()
          .eq('id', groupId);
        
        if (error) {
          // エラーの場合は状態を元に戻す
          setGroups(previousGroups);
          throw error;
        }
        
        toast.success('グループを削除しました');
        // 削除成功後、データベースから最新の状態を取得
        await fetchGroups();
      } catch (error) {
        console.error('Error deleting group:', error);
        toast.error('削除中にエラーが発生しました');
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">グループデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">業務グループ管理</h1>
        <button 
          onClick={() => {
            setEditingGroup(null);
            setFormData({ type: 'business' });
            setIsModalOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Users className="h-5 w-5 mr-1" />
          グループ作成
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                グループ名
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                種別
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                メンバー数
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                作成日
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">アクション</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {groups.map((group) => (
              <tr key={group.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{group.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    業務
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    <span className="font-medium">{group.members.length}名</span>
                    {group.members.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        {group.members.slice(0, 3).map(memberId => {
                          const user = users.find(u => u.id === memberId);
                          return user?.name || 'Unknown';
                        }).join(', ')}
                        {group.members.length > 3 && ` 他${group.members.length - 3}名`}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(group.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleEdit(group)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(group.id)}
                    className="text-red-600 hover:text-red-900"
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
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingGroup ? 'グループ編集' : 'グループ作成'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">グループ名</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">メンバー</label>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                  <ParticipantSelector
                    selectedParticipants={formData.members || []}
                    onChange={(members) => setFormData({ ...formData, members })}
                    showBusinessGroups={false}
                    showLeaveGroups={false}
                    selectedGroupId={editingGroup?.id}
                  />
                </div>
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
                  {editingGroup ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}