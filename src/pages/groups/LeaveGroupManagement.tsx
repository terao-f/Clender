import { useState, useEffect } from 'react';
import { Group, User } from '../../types';
import { Plus, Pencil, Trash2, Users, X, GripVertical, Save, ChevronDown, ChevronRight, Clock, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ParticipantSelector from '../../components/ParticipantSelector';
import { useAuth } from '../../contexts/AuthContext';
import GroupTabs from '../../components/GroupTabs';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableGroupItemProps {
  group: Group;
  users: User[];
  onEdit: (group: Group) => void;
  onDelete: (groupId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function SortableGroupItem({ group, users, onEdit, onDelete, isExpanded, onToggleExpand }: SortableGroupItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // グループ内の部署ごとにメンバーを整理
  const membersByDepartment = group.members.reduce((acc, memberId) => {
    const user = users.find(u => u.id === memberId);
    if (user) {
      const dept = user.department || '所属なし';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(user);
    }
    return acc;
  }, {} as Record<string, User[]>);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-move mr-3 text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          
          <button
            onClick={onToggleExpand}
            className="mr-3 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>

          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
            <Clock className="h-5 w-5 text-purple-600" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center">
              <h3 className="text-sm font-medium text-gray-900">{group.name}</h3>
              <span className="ml-3 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                休暇申請グループ
              </span>
              <span className="ml-3 text-sm text-gray-500">
                <Users className="h-4 w-4 inline mr-1" />
                {group.members.length}名
              </span>
            </div>
            
            {!isExpanded && group.members.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {Object.keys(membersByDepartment).slice(0, 3).map(dept => 
                  `${dept} (${membersByDepartment[dept].length}名)`
                ).join(', ')}
                {Object.keys(membersByDepartment).length > 3 && 
                  ` 他${Object.keys(membersByDepartment).length - 3}部署`}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(group)}
            className="text-indigo-600 hover:text-indigo-900 p-1"
            title="編集"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(group.id)}
            className="text-red-600 hover:text-red-900 p-1"
            title="削除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4 pl-12">
          {Object.entries(membersByDepartment).map(([dept, deptUsers]) => (
            <div key={dept} className="mb-3">
              <h4 className="text-xs font-semibold text-gray-600 mb-2">
                {dept} ({deptUsers.length}名)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {deptUsers.map(user => (
                  <div key={user.id} className="text-sm px-2 py-1 bg-gray-50 rounded flex items-center">
                    <UserCheck className="h-3 w-3 text-green-500 mr-1" />
                    {user.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {group.members.length === 0 && (
            <p className="text-sm text-gray-500">メンバーが登録されていません</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeaveGroupManagement() {
  const { currentUser } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<Partial<Group>>({});
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        .eq('type', 'leave')
        .order('display_order, name');
      
      if (error) {
        console.error('Error fetching groups:', error);
      } else {
        const convertedGroups: Group[] = data?.map(g => ({
          id: g.id,
          name: g.name,
          type: g.type,
          members: g.members || [],
          createdBy: g.created_by,
          createdAt: new Date(g.created_at),
          displayOrder: g.display_order
        })) || [];
        
        setGroups(convertedGroups);
        setOriginalOrder(convertedGroups.map(g => g.id));
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setGroups((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // 順序が変更されたかチェック
        const currentOrder = newOrder.map(g => g.id);
        setHasChanges(!arraysEqual(currentOrder, originalOrder));
        
        return newOrder;
      });
    }
  };

  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  const handleSaveOrder = async () => {
    try {
      // 各グループの表示順序を更新
      const updates = groups.map((group, index) => ({
        id: group.id,
        display_order: index
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('groups')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
        
        if (error) {
          console.error('Error updating group order:', error);
          toast.error('表示順序の保存に失敗しました');
          return;
        }
      }

      toast.success('表示順序を保存しました');
      setOriginalOrder(groups.map(g => g.id));
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('表示順序の保存に失敗しました');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // バリデーション
    if (!formData.name?.trim()) {
      toast.error('グループ名を入力してください');
      return;
    }
    
    // 重複チェック（新規作成時のみ）
    if (!editingGroup) {
      const existingGroup = groups.find(g => g.name.toLowerCase() === formData.name?.trim().toLowerCase());
      if (existingGroup) {
        toast.error('同じ名前のグループが既に存在します');
        return;
      }
    }
    
    try {
      if (editingGroup) {
        // Update group
        const { error } = await supabase
          .from('groups')
          .update({
            name: formData.name?.trim() || '',
            members: formData.members || [],
            updated_at: new Date().toISOString()
          })
          .eq('id', editingGroup.id);
        
        if (error) throw error;
        toast.success('休暇グループを更新しました');
      } else {
        // Create group
        if (!currentUser?.id) {
          toast.error('ユーザー情報が取得できません');
          return;
        }
        
        // 新しいグループの表示順序を最後に設定
        const maxOrder = Math.max(...groups.map(g => g.displayOrder || 0), -1);
        
        const { data, error } = await supabase
          .from('groups')
          .insert([{
            id: crypto.randomUUID(),
            name: formData.name?.trim() || '',
            type: 'leave',
            members: formData.members || [],
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
        }
      }

      // Refresh data
      await fetchGroups();
      
      setIsModalOpen(false);
      setEditingGroup(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving group:', error);
      toast.error('保存中にエラーが発生しました');
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData(group);
    setIsModalOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    if (confirm('この休暇グループを削除してもよろしいですか？\n削除すると、このグループを使用している休暇申請の承認フローに影響する可能性があります。')) {
      try {
        const { error } = await supabase
          .from('groups')
          .delete()
          .eq('id', groupId);
        
        if (error) throw error;
        
        toast.success('休暇グループを削除しました');
        await fetchGroups();
      } catch (error) {
        console.error('Error deleting group:', error);
        toast.error('削除中にエラーが発生しました');
      }
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const toggleAllExpand = () => {
    if (expandedGroups.size === groups.length) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(groups.map(g => g.id)));
    }
  };

  const filteredGroups = groups.filter(group => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    // グループ名で検索
    if (group.name.toLowerCase().includes(searchLower)) return true;
    
    // メンバー名で検索
    const hasMatchingMember = group.members.some(memberId => {
      const user = users.find(u => u.id === memberId);
      return user?.name.toLowerCase().includes(searchLower) || 
             user?.nameKana?.toLowerCase().includes(searchLower);
    });
    
    return hasMatchingMember;
  });

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">休暇グループデータを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <GroupTabs />
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-gray-900">休暇グループ管理</h1>
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-purple-600" />
            <span className="text-sm text-gray-600">
              {groups.length}個のグループ / 
              {groups.reduce((sum, g) => sum + g.members.length, 0)}名登録
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleAllExpand}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            {expandedGroups.size === groups.length ? '全て折りたたむ' : '全て展開'}
          </button>
          {hasChanges && (
            <button
              onClick={handleSaveOrder}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Save className="h-5 w-5 mr-1" />
              並び順を保存
            </button>
          )}
          <button
            onClick={() => {
              setEditingGroup(null);
              setFormData({});
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Plus className="h-5 w-5 mr-1" />
            休暇グループ作成
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="グループ名またはメンバー名で検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
        />
      </div>

      {filteredGroups.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm ? '検索条件に一致するグループが見つかりません' : '休暇グループが登録されていません'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => {
                setEditingGroup(null);
                setFormData({});
                setIsModalOpen(true);
              }}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-5 w-5 mr-1" />
              最初の休暇グループを作成
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-4 overflow-y-auto flex-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredGroups.map(g => g.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredGroups.map((group) => (
                <SortableGroupItem
                  key={group.id}
                  group={group}
                  users={users}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggleExpand={() => toggleGroupExpand(group.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingGroup ? '休暇グループ編集' : '休暇グループ作成'}
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
                  placeholder="例: 営業部承認グループ"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  承認メンバー
                  <span className="ml-2 text-xs text-gray-500">
                    （このグループの全員が承認すると、次のステップに進みます）
                  </span>
                </label>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                  <ParticipantSelector
                    selectedParticipants={formData.members || []}
                    onChange={(members) => setFormData({ ...formData, members })}
                    showBusinessGroups={false}
                    showLeaveGroups={false}
                    selectedGroupId={editingGroup?.id}
                  />
                </div>
                {formData.members && formData.members.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    選択中: {formData.members.length}名
                  </div>
                )}
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-purple-900 mb-2">休暇グループの使い方</h4>
                <ul className="text-xs text-purple-700 space-y-1">
                  <li>• 休暇申請時に、このグループが承認者として設定されます</li>
                  <li>• グループ内の全員が承認すると、次の承認ステップに進みます</li>
                  <li>• 通常の承認フロー: 申請者 → 休暇グループ → 休暇責任者 → 社長</li>
                </ul>
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
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
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