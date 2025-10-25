import { useState, useEffect } from 'react';
import { User, Group } from '../../types';
import { Users, UserCheck, UserX, Save, AlertCircle, UserPlus, UserMinus, ChevronRight, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import ParticipantSelector from '../../components/ParticipantSelector';

interface UserWithGroups extends User {
  leaveGroups: string[];
}

export default function LeaveGroupManagement() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithGroups[]>([]);
  const [leaveGroups, setLeaveGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modifiedGroups, setModifiedGroups] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ name: string; members: string[] }>({ name: '', members: [] });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // ユーザー一覧を取得
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('name_kana');
      
      // 休暇申請グループ一覧を取得
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .eq('type', 'leave')
        .order('name');
      
      if (!usersError && usersData && !groupsError && groupsData) {
        // ユーザーが所属する休暇申請グループを計算
        const usersWithGroups: UserWithGroups[] = usersData.map(u => {
          const userLeaveGroups = groupsData
            .filter(g => g.members.includes(u.id))
            .map(g => g.id);
          
          return {
            id: u.id,
            employeeId: u.employee_id,
            name: u.name,
            nameKana: u.name_kana,
            email: u.email,
            phone: u.phone,
            department: u.department,
            role: u.role,
            defaultWorkDays: u.default_work_days || [],
            leaveGroups: userLeaveGroups
          };
        });
        
        setUsers(usersWithGroups);
        setLeaveGroups(groupsData);
        
        // デフォルトで最初のグループを選択
        if (groupsData.length > 0) {
          setSelectedGroup(groupsData[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    if (!selectedGroup) return;

    const group = leaveGroups.find(g => g.id === selectedGroup);
    if (!group) return;

    const updatedGroups = leaveGroups.map(g => {
      if (g.id === selectedGroup) {
        const isMember = g.members.includes(userId);
        const newMembers = isMember
          ? g.members.filter(id => id !== userId)
          : [...g.members, userId];
        
        // 変更があったグループを記録
        setModifiedGroups(prev => new Set(prev).add(g.id));
        
        return { ...g, members: newMembers };
      }
      return g;
    });

    setLeaveGroups(updatedGroups);

    // ユーザーの所属グループも更新
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        const userGroups = updatedGroups
          .filter(g => g.members.includes(userId))
          .map(g => g.id);
        return { ...u, leaveGroups: userGroups };
      }
      return u;
    });

    setUsers(updatedUsers);
  };

  const handleSave = async () => {
    // 各ユーザーが最低1つの休暇申請グループに所属しているかチェック
    const usersWithoutGroup = users.filter(u => u.leaveGroups.length === 0);
    if (usersWithoutGroup.length > 0) {
      toast.error(`以下のユーザーは休暇申請グループに所属していません:\n${usersWithoutGroup.map(u => u.name).join(', ')}`);
      return;
    }

    try {
      setSaving(true);
      
      // 変更があったグループのみ更新
      for (const groupId of modifiedGroups) {
        const group = leaveGroups.find(g => g.id === groupId);
        if (group) {
          const { error } = await supabase
            .from('groups')
            .update({
              members: group.members,
              updated_at: new Date().toISOString()
            })
            .eq('id', groupId);
          
          if (error) throw error;
        }
      }
      
      toast.success('保存しました');
      setModifiedGroups(new Set());
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('グループ名を入力してください');
      return;
    }
    
    // 重複チェック
    const existingGroup = leaveGroups.find(g => g.name.toLowerCase() === formData.name.trim().toLowerCase());
    if (existingGroup) {
      toast.error('同じ名前のグループが既に存在します');
      return;
    }
    
    if (!currentUser?.id) {
      toast.error('ユーザー情報が取得できません');
      return;
    }
    
    try {
      // 新しいグループの表示順序を最後に設定
      const maxOrder = Math.max(...leaveGroups.map(g => g.displayOrder || 0), -1);
      
      const { data, error } = await supabase
        .from('groups')
        .insert([{
          id: crypto.randomUUID(),
          name: formData.name.trim(),
          type: 'leave',
          members: formData.members,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          display_order: maxOrder + 1
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
            type: 'leave',
            members: formData.members,
            created_by: currentUser.id
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
        toast.success('休暇グループを作成しました');
        setIsCreateModalOpen(false);
        setFormData({ name: '', members: [] });
        await fetchData(); // データを再取得
      }
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('グループの作成に失敗しました');
    }
  };

  const isUserInSelectedGroup = (userId: string): boolean => {
    const group = leaveGroups.find(g => g.id === selectedGroup);
    return group ? group.members.includes(userId) : false;
  };

  const getUsersInGroup = (groupId: string): User[] => {
    const group = leaveGroups.find(g => g.id === groupId);
    if (!group) return [];
    return users.filter(u => group.members.includes(u.id));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">休暇申請グループ管理</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setFormData({ name: '', members: [] });
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Plus className="h-5 w-5 mr-1" />
            休暇グループ作成
          </button>
          <button
            onClick={handleSave}
            disabled={saving || modifiedGroups.size === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5 mr-1" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">重要な注意事項</p>
            <p className="text-sm text-amber-700 mt-1">各ユーザーは最低1つの休暇申請グループに所属する必要があります。</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左側: 休暇申請グループ一覧 */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-lg rounded-lg">
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-t-lg">
              <h2 className="text-lg font-medium">グループ名リスト</h2>
              <p className="text-xs opacity-90 mt-1">グループを選択してメンバーを管理</p>
            </div>
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
              {leaveGroups.map(group => {
                const isSelected = selectedGroup === group.id;
                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup(group.id)}
                    className={`px-4 py-4 cursor-pointer transition-all duration-200 border-b border-gray-100 ${
                      isSelected 
                        ? 'bg-indigo-50 border-l-4 border-l-indigo-600' 
                        : 'hover:bg-gray-50 hover:border-l-4 hover:border-l-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className={`text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {group.name}
                        </h3>
                        <div className="flex items-center mt-2">
                          <Users className="h-3 w-3 text-gray-400 mr-1" />
                          <span className="text-xs text-gray-500">{group.members.length}名</span>
                          {modifiedGroups.has(group.id) && (
                            <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              変更あり
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="h-4 w-4 text-indigo-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 中央: 現在のグループ参加者リスト */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-lg rounded-lg">
            <div className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
              <h2 className="text-lg font-medium">現在のグループ参加者リスト</h2>
              <p className="text-xs opacity-90 mt-1">
                {selectedGroup ? `${leaveGroups.find(g => g.id === selectedGroup)?.name} のメンバー` : 'グループを選択してください'}
              </p>
            </div>
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
              {selectedGroup ? (
                <div className="p-4">
                  {getUsersInGroup(selectedGroup).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">このグループには参加者がいません</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getUsersInGroup(selectedGroup)
                        .sort((a, b) => a.nameKana.localeCompare(b.nameKana, 'ja'))
                        .map(user => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                                <span className="text-sm font-medium text-green-700">
                                  {user.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium text-gray-900">{user.name}</h4>
                                  {user.isHr && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                      人事
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{user.department}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleUserToggle(user.id)}
                              className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50"
                            >
                              削除
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">左側から休暇申請グループを選択してください</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右側: ユーザーリスト */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-lg rounded-lg">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-600 to-slate-600 text-white rounded-t-lg">
              <h2 className="text-lg font-medium">ユーザーリスト</h2>
              {selectedGroup && (
                <p className="text-xs opacity-90 mt-1">ユーザーをクリックしてグループへの追加・削除を行います</p>
              )}
            </div>
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
              {selectedGroup ? (
                <div className="p-4">
                  <div className="space-y-3">
                    {users
                      .sort((a, b) => a.nameKana.localeCompare(b.nameKana, 'ja'))
                      .map(user => {
                        const isInGroup = isUserInSelectedGroup(user.id);
                        const hasNoGroups = user.leaveGroups.length === 0;
                        const groupNames = user.leaveGroups
                          .map(gId => leaveGroups.find(g => g.id === gId)?.name)
                          .filter(Boolean);
                        
                        return (
                          <div
                            key={user.id}
                            onClick={() => handleUserToggle(user.id)}
                            className={`group flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                              isInGroup
                                ? 'border-gray-600 bg-gray-50 hover:bg-gray-100 shadow-sm'
                                : hasNoGroups
                                ? 'border-red-300 bg-red-50 hover:bg-red-100'
                                : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                isInGroup ? 'bg-gray-200' : hasNoGroups ? 'bg-red-200' : 'bg-gray-200'
                              }`}>
                                <span className={`text-sm font-medium ${
                                  isInGroup ? 'text-gray-700' : hasNoGroups ? 'text-red-700' : 'text-gray-700'
                                }`}>
                                  {user.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium text-gray-900">{user.name}</h4>
                                  {user.isHr && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                      人事
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{user.department}</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                {groupNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                                    {groupNames.map((name, idx) => (
                                      <span
                                        key={idx}
                                        className={`inline-block text-xs px-2 py-1 rounded-full ${
                                          leaveGroups.find(g => g.name === name && g.id === selectedGroup)
                                            ? 'bg-gray-600 text-white'
                                            : 'bg-blue-100 text-blue-800'
                                        }`}
                                      >
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-red-600 font-medium">
                                    ※ グループ未所属
                                  </span>
                                )}
                              </div>
                              <div className={`transition-all duration-200 ${
                                isInGroup ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              }`}>
                                {isInGroup ? (
                                  <UserMinus className="h-5 w-5 text-red-500" />
                                ) : (
                                  <UserPlus className="h-5 w-5 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">左側から休暇申請グループを選択してください</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 休暇グループ作成モーダル */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">休暇グループ作成</h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)} 
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">グループ名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例: 営業部、開発部など"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">メンバー</label>
                <ParticipantSelector
                  selectedParticipants={formData.members}
                  onChange={(members) => setFormData({ ...formData, members })}
                  showBusinessGroups={false}
                  showLeaveGroups={false}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}