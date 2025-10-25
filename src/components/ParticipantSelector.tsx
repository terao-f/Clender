import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface User {
  id: string;
  name: string;
  nameKana?: string;
  department: string;
  role: string;
  isHr?: boolean;
  isSampleStaff?: boolean;
}

interface Group {
  id: string;
  name: string;
  type: 'business' | 'leave';
  description: string;
  members: string[];
}

interface Department {
  id: string;
  name: string;
  display_order: number;
}

interface ParticipantSelectorProps {
  selectedParticipants: string[];
  onChange: (participants: string[]) => void;
  showBusinessGroups?: boolean; // 業務グループを表示するか
  showLeaveGroups?: boolean;    // 休暇申請グループを表示するか
  readOnlyLeaveGroup?: boolean; // 休暇申請グループを読み取り専用にするか
  selectedGroupId?: string;     // 選択中のグループID（編集時）
  sampleStaffOnly?: boolean;    // サンプル担当者のみ表示
  singleSelect?: boolean;        // 単一選択モード
  label?: string;                // ラベルテキスト
}

export default function ParticipantSelector({
  selectedParticipants,
  onChange,
  showBusinessGroups = true,
  showLeaveGroups = false,
  readOnlyLeaveGroup = false,
  selectedGroupId,
  sampleStaffOnly = false,
  singleSelect = false,
  label
}: ParticipantSelectorProps) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // ユーザー一覧を取得
      let query = supabase
        .from('users')
        .select('id, name, name_kana, department, role, is_sample_staff')
        .order('name_kana');
        
      // サンプル担当者のみフィルター
      if (sampleStaffOnly) {
        console.log('🔍 サンプル担当者のみを取得します');
        query = query.eq('is_sample_staff', true);
      }
        
      const { data: usersData, error: usersError } = await query;

      if (usersError) {
        console.error('Error fetching users:', usersError);
      } else if (usersData) {
        console.log('Fetched users:', usersData.length, 'users');
        if (sampleStaffOnly) {
          console.log('✅ サンプル担当者:', usersData.map(u => u.name).join(', '));
        }
        const convertedUsers = usersData.map(u => ({
          ...u,
          nameKana: u.name_kana,
          isSampleStaff: u.is_sample_staff || false
        }));
        setUsers(convertedUsers);
      } else {
        console.warn('No users data returned');
        setUsers([]);
      }

      // グループ一覧を取得
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .order('type, name');

      // 所属一覧を取得（並び順付き）
      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('*')
        .order('display_order, name');
      
      if (!departmentsError && departmentsData) {
        setDepartments(departmentsData);
      }

      if (groupsError) {
        console.error('Error fetching groups:', groupsError);
      } else if (groupsData) {
        console.log('Fetched groups:', groupsData.length, 'groups');
        // フィルタリング
        let filteredGroups = groupsData;
        
        if (!showBusinessGroups) {
          filteredGroups = filteredGroups.filter(g => g.type !== 'business');
        }
        
        if (!showLeaveGroups) {
          filteredGroups = filteredGroups.filter(g => g.type !== 'leave');
        }

        // 業務グループは自分が関連している場合のみ表示
        if (showBusinessGroups && currentUser) {
          filteredGroups = filteredGroups.filter(g => 
            g.type !== 'business' || g.members.includes(currentUser.id)
          );
        }

        setGroups(filteredGroups);
      } else {
        console.warn('No groups data returned');
        setGroups([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpansion = (groupId: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleDepartmentExpansion = (department: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(department)) {
      newExpanded.delete(department);
    } else {
      newExpanded.add(department);
    }
    setExpandedDepartments(newExpanded);
  };

  const handleUserToggle = (userId: string) => {
    if (singleSelect) {
      // 単一選択モードの場合
      onChange([userId]);
    } else {
      // 複数選択モードの場合
      const newParticipants = selectedParticipants.includes(userId)
        ? selectedParticipants.filter(id => id !== userId)
        : [...selectedParticipants, userId];
      onChange(newParticipants);
    }
  };

  // グループメンバーから削除（中央列用）
  const handleGroupMemberRemove = (userId: string) => {
    const newParticipants = selectedParticipants.filter(id => id !== userId);
    onChange(newParticipants);
  };

  const handleGroupSelectAll = (group: Group, selectAll: boolean) => {
    const groupUserIds = group.members.filter(id => users.find(u => u.id === id));
    
    if (selectAll) {
      // グループの全員を追加
      const newParticipants = [...new Set([...selectedParticipants, ...groupUserIds])];
      onChange(newParticipants);
    } else {
      // グループの全員を削除
      const newParticipants = selectedParticipants.filter(id => !groupUserIds.includes(id));
      onChange(newParticipants);
    }
  };

  const isGroupFullySelected = (group: Group) => {
    const groupUserIds = group.members.filter(id => users.find(u => u.id === id));
    return groupUserIds.length > 0 && groupUserIds.every(id => selectedParticipants.includes(id));
  };

  const getGroupTypeLabel = (type: string) => {
    switch (type) {
      case 'business': return '業務グループ';
      case 'leave': return '休暇申請グループ';
      default: return '';
    }
  };

  const getSelectedUsers = () => {
    return users.filter(user => selectedParticipants.includes(user.id));
  };

  // 選択中のグループを取得
  const getSelectedGroup = () => {
    return selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;
  };

  // 選択中のグループの現在の参加者を取得（実際の選択状態を反映）
  const getCurrentGroupMembers = () => {
    if (!selectedGroupId) return [];
    return users.filter(user => selectedParticipants.includes(user.id));
  };

  // ユーザーが参加している休暇申請グループを取得
  const getUserLeaveGroups = (userId: string) => {
    return groups.filter(group => 
      group.type === 'leave' && 
      group.members.includes(userId) &&
      group.id !== selectedGroupId // 現在編集中のグループは除外
    );
  };

  if (loading) {
    return <div className="text-center py-4">読み込み中...</div>;
  }

  const groupsByType = groups.reduce((acc, group) => {
    if (!acc[group.type]) acc[group.type] = [];
    acc[group.type].push(group);
    return acc;
  }, {} as Record<string, Group[]>);

  // ユーザーを所属ごとにグループ化
  const usersByDepartment = users.reduce((acc, user) => {
    if (!acc[user.department]) acc[user.department] = [];
    acc[user.department].push(user);
    return acc;
  }, {} as Record<string, User[]>);

  return (
    <div className="space-y-4">
      {singleSelect && sampleStaffOnly ? (
        // サンプル担当者の単一選択モード（ドロップダウン）
        <div>
          {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
          <select
            value={selectedParticipants[0] || ''}
            onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">選択してください</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.department})
              </option>
            ))}
          </select>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左側: 会社選択 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">会社選択</h4>
          <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
            {/* 所属別ユーザー */}
            <div className="border-b border-gray-100">
              <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                「所属」：
              </div>
              
              {Object.entries(usersByDepartment)
                .sort(([a], [b]) => {
                  // departmentsテーブルの並び順に従ってソート
                  const deptA = departments.find(d => d.name === a);
                  const deptB = departments.find(d => d.name === b);
                  if (deptA && deptB) {
                    return deptA.display_order - deptB.display_order;
                  }
                  // departmentsテーブルにない場合は名前でソート
                  return a.localeCompare(b, 'ja');
                })
                .map(([department, deptUsers]) => {
                  const isExpanded = expandedDepartments.has(department);
                  const departmentSelectedCount = deptUsers.filter(u => selectedParticipants.includes(u.id)).length;
                  const isAllSelected = departmentSelectedCount === deptUsers.length && deptUsers.length > 0;
                  
                  return (
                    <div key={department} className="border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center px-3 py-2 hover:bg-gray-50">
                        <button
                          onClick={() => toggleDepartmentExpansion(department)}
                          type="button"
                          className="flex items-center mr-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <label className="flex items-center flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            ref={input => {
                              if (input) {
                                input.indeterminate = departmentSelectedCount > 0 && departmentSelectedCount < deptUsers.length;
                              }
                            }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newParticipants = [...new Set([...selectedParticipants, ...deptUsers.map(u => u.id)])];
                                onChange(newParticipants);
                              } else {
                                const newParticipants = selectedParticipants.filter(id => !deptUsers.find(u => u.id === id));
                                onChange(newParticipants);
                              }
                            }}
                            className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{department} ({deptUsers.length}名)</span>
                        </label>
                      </div>
                      {isExpanded && (
                        <div className="pl-8 pb-2">
                          <div className="mb-2">
                            <label className="flex items-center cursor-pointer py-1">
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const newParticipants = [...new Set([...selectedParticipants, ...deptUsers.map(u => u.id)])];
                                    onChange(newParticipants);
                                  } else {
                                    const newParticipants = selectedParticipants.filter(id => !deptUsers.find(u => u.id === id));
                                    onChange(newParticipants);
                                  }
                                }}
                                className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm text-gray-600">全員を選択</span>
                            </label>
                          </div>
                          <div className="space-y-1">
                            {deptUsers
                              .sort((a, b) => (a.nameKana || a.name).localeCompare(b.nameKana || b.name, 'ja'))
                              .map(user => (
                                <label key={user.id} className="flex items-center cursor-pointer py-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedParticipants.includes(user.id)}
                                    onChange={() => handleUserToggle(user.id)}
                                    className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-sm text-gray-600 flex items-center gap-2">
                                    <span>{user.name}</span>
                                    {user.isHr && (
                                      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                        人事
                                      </span>
                                    )}
                                  </span>
                                </label>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            
            {/* 業務グループ選択 */}
            {Object.entries(groupsByType).map(([type, typeGroups]) => (
              <div key={type} className="border-b border-gray-100 last:border-b-0">
                <div className="bg-gray-50 px-3 py-2">
                  <div className="text-sm font-medium text-gray-700">「{getGroupTypeLabel(type)}」：</div>
                </div>
                {typeGroups.map(group => {
                  const isExpanded = expandedGroups.has(group.id);
                  const isFullySelected = isGroupFullySelected(group);
                  const groupUsers = users.filter(u => group.members.includes(u.id));
                  const isReadOnly = readOnlyLeaveGroup && group.type === 'leave';

                  return (
                    <div key={group.id} className="border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center px-3 py-2 hover:bg-gray-50">
                        <button
                          onClick={(e) => toggleGroupExpansion(group.id, e)}
                          type="button"
                          className="flex items-center mr-2 text-gray-600 hover:text-gray-800 focus:outline-none"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <label className="flex items-center flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isFullySelected}
                            ref={input => {
                              if (input) {
                                const hasPartialSelection = !isFullySelected && group.members.some(id => selectedParticipants.includes(id));
                                input.indeterminate = hasPartialSelection;
                              }
                            }}
                            onChange={(e) => handleGroupSelectAll(group, e.target.checked)}
                            disabled={isReadOnly}
                            className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                          />
                          <span className="text-sm font-medium text-gray-700">{group.name}</span>
                        </label>
                      </div>
                      
                      {isExpanded && (
                        <div className="pl-8 pb-2">
                          <div className="mb-2">
                            <label className="flex items-center cursor-pointer py-1">
                              <input
                                type="checkbox"
                                checked={isFullySelected}
                                onChange={(e) => handleGroupSelectAll(group, e.target.checked)}
                                disabled={isReadOnly}
                                className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                              />
                              <span className="text-sm text-gray-600">全員を選択</span>
                            </label>
                          </div>
                          <div className="space-y-1">
                            {groupUsers
                              .sort((a, b) => (a.nameKana || a.name).localeCompare(b.nameKana || b.name, 'ja'))
                              .map(user => (
                                <label key={user.id} className="flex items-center cursor-pointer py-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedParticipants.includes(user.id)}
                                    onChange={() => handleUserToggle(user.id)}
                                    disabled={isReadOnly}
                                    className="mr-2 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                  />
                                  <span className="text-sm text-gray-600 flex items-center gap-2">
                                    <span>{user.name}</span>
                                    {user.isHr && (
                                      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                        人事
                                      </span>
                                    )}
                                  </span>
                                </label>
                              ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 右側: 選択済み */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">選択済み</h4>
          <div className="border border-gray-200 rounded-lg p-3 max-h-80 overflow-y-auto">
            {getSelectedUsers().length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">選択済みの参加者がいません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {getSelectedUsers()
                  .sort((a, b) => (a.nameKana || a.name).localeCompare(b.nameKana || b.name, 'ja'))
                  .map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-blue-50 rounded group hover:bg-blue-100 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.department}</div>
                      </div>
                      <button
                        onClick={() => handleUserToggle(user.id)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="削除"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}