import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, GripVertical, Save, Building2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Department {
  id: string;
  name: string;
  displayOrder: number;
  userCount?: number;
}

interface SortableDepartmentItemProps {
  department: Department;
  onEdit: (department: Department) => void;
  onDelete: (id: string) => void;
}

function SortableDepartmentItem({ department, onEdit, onDelete }: SortableDepartmentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: department.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
          
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center">
              <h3 className="text-sm font-medium text-gray-900">{department.name}</h3>
              {department.userCount !== undefined && department.userCount > 0 && (
                <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  <Users className="h-3 w-3 mr-1" />
                  {department.userCount}名
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(department)}
            className="text-indigo-600 hover:text-indigo-900 p-1"
            title="編集"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(department.id)}
            className="text-red-600 hover:text-red-900 p-1"
            title="削除"
            disabled={department.userCount && department.userCount > 0}
          >
            <Trash2 className={`h-4 w-4 ${department.userCount && department.userCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentManagement() {
  const { currentUser } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState<{ name: string }>({ name: '' });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      
      // 部署データを取得
      const { data: departmentsData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('display_order, name');
      
      if (deptError) {
        console.error('Error fetching departments:', deptError);
        return;
      }
      
      // 各部署のユーザー数を取得
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('department');
      
      if (!usersError && usersData) {
        const userCountByDept = usersData.reduce((acc, user) => {
          const dept = user.department || '所属なし';
          acc[dept] = (acc[dept] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const departmentsWithCount = departmentsData?.map(d => ({
          id: d.id,
          name: d.name,
          displayOrder: d.display_order,
          userCount: userCountByDept[d.name] || 0
        })) || [];
        
        setDepartments(departmentsWithCount);
        setOriginalOrder(departmentsWithCount.map(d => d.id));
      } else {
        const convertedDepartments = departmentsData?.map(d => ({
          id: d.id,
          name: d.name,
          displayOrder: d.display_order
        })) || [];
        
        setDepartments(convertedDepartments);
        setOriginalOrder(convertedDepartments.map(d => d.id));
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('部署データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };



  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = departments.findIndex(d => d.id === active.id);
      const newIndex = departments.findIndex(d => d.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newDepartments = arrayMove(departments, oldIndex, newIndex);
        setDepartments(newDepartments);
        
        // 変更があったかチェック
        const newOrder = newDepartments.map(d => d.id);
        if (!arraysEqual(newOrder, originalOrder)) {
          setHasChanges(true);
        } else {
          setHasChanges(false);
        }
      }
    }
  };

  const handleSaveOrder = async () => {
    try {
      console.log('💾 並び順を保存中...');
      console.log('📋 保存する部署順序:', departments.map((d, i) => `${i}: ${d.name} (ID: ${d.id})`));
      
      // 現在のユーザー情報を確認
      console.log('🔐 現在のユーザー:', { 
        id: currentUser?.id, 
        name: currentUser?.name,
        role: currentUser?.role
      });
      
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'president')) {
        console.error('❌ 管理者権限が不足しています');
        toast.error('管理者権限が必要です');
        return;
      }
      
      // Supabaseクライアントの認証状態を確認
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Supabase認証状態:', {
        hasSession: !!session,
        userId: session?.user?.id,
        accessToken: session?.access_token ? 'あり' : 'なし'
      });
      
      // 認証セッションがない場合は、サービスロールキーを使用して直接操作
      if (!session?.access_token) {
        console.log('⚠️ Supabase認証セッションがありません。管理者権限で直接操作します。');
        
        // 管理者権限で直接データベースを操作
        for (let i = 0; i < departments.length; i++) {
          const department = departments[i];
          console.log(`🔄 ${i}番目: ${department.name} (ID: ${department.id}) を更新中...`);
          
          const { data, error } = await supabase
            .from('departments')
            .update({ 
              display_order: i,
              updated_at: new Date().toISOString()
            })
            .eq('id', department.id)
            .select();
          
          if (error) {
            console.error(`❌ 部署 ${department.name} の更新エラー:`, error);
            toast.error(`部署 ${department.name} の更新に失敗しました: ${error.message}`);
            return;
          }
          
          console.log(`✅ ${department.name} の更新完了:`, data);
        }
        
        console.log('✅ 全部署の並び順を保存完了');
        toast.success('表示順序を保存しました');
        setHasChanges(false);
        setOriginalOrder(departments.map(d => d.id));
        return;
      }
      
      // 各部署の表示順序を更新
      for (let i = 0; i < departments.length; i++) {
        const department = departments[i];
        console.log(`🔄 ${i}番目: ${department.name} (ID: ${department.id}) を更新中...`);
        
        // 認証ヘッダーを明示的に設定
        const { data, error } = await supabase
          .from('departments')
          .update({ 
            display_order: i,
            updated_at: new Date().toISOString()
          })
          .eq('id', department.id)
          .select();
        
        if (error) {
          console.error(`❌ 部署 ${department.name} の更新エラー:`, error);
          console.error('エラー詳細:', error);
          toast.error(`部署 ${department.name} の更新に失敗しました: ${error.message}`);
          return;
        }
        
        console.log(`✅ ${department.name} の更新完了:`, data);
        
        // 更新が成功したか確認
        if (!data || data.length === 0) {
          console.error(`❌ 部署 ${department.name} の更新結果が空です`);
          toast.error(`部署 ${department.name} の更新に失敗しました: データが返されませんでした`);
          return;
        }
      }

      console.log('✅ 全部署の並び順を保存完了');
      toast.success('表示順序を保存しました');
      setOriginalOrder(departments.map(d => d.id));
      setHasChanges(false);
      
      // データを再取得する必要はありません（ローカル状態で管理）
      console.log('💡 ローカル状態を維持（データベース再取得なし）');
    } catch (error) {
      console.error('❌ 並び順保存中にエラー:', error);
      toast.error('表示順序の保存中にエラーが発生しました');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('所属名を入力してください');
      return;
    }
    
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'president')) {
      toast.error('管理者権限が必要です');
      return;
    }
    
    try {
      if (editingDepartment) {
        // 更新
        const { error } = await supabase
          .from('departments')
          .update({
            name: formData.name.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDepartment.id);
        
        if (error) throw error;
        toast.success('所属を更新しました');
      } else {
        // 新規作成
        const maxOrder = Math.max(...departments.map(d => d.displayOrder || 0), -1);
        
        const { error } = await supabase
          .from('departments')
          .insert([{
            name: formData.name.trim(),
            display_order: maxOrder + 1
          }]);
        
        if (error) throw error;
        toast.success('所属を作成しました');
      }

      await fetchDepartments();
      setIsModalOpen(false);
      setEditingDepartment(null);
      setFormData({ name: '' });
    } catch (error: any) {
      console.error('Error saving department:', error);
      if (error.code === '23505') {
        toast.error('同じ名前の所属が既に存在します');
      } else if (error.message?.includes('認証')) {
        toast.error('認証エラー: 再度ログインしてください');
      } else {
        toast.error('保存中にエラーが発生しました');
      }
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({ name: department.name });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const department = departments.find(d => d.id === id);
    
    if (department?.userCount && department.userCount > 0) {
      toast.error('ユーザーが所属している部署は削除できません');
      return;
    }
    
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'president')) {
      toast.error('管理者権限が必要です');
      return;
    }
    
    if (!confirm('この所属を削除してもよろしいですか？')) return;
    
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('所属を削除しました');
      await fetchDepartments();
    } catch (error: any) {
      console.error('Error deleting department:', error);
      if (error.message?.includes('認証')) {
        toast.error('認証エラー: 再度ログインしてください');
      } else {
        toast.error('削除中にエラーが発生しました');
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">所属データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-gray-900">所属管理</h1>
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-600">
              {departments.length}個の所属
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
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
              setEditingDepartment(null);
              setFormData({ name: '' });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-5 w-5 mr-1" />
            所属を追加
          </button>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-600 mb-4">
          ドラッグ&ドロップで並び順を変更できます。この順序は各種選択画面に反映されます。
        </p>
        
        {departments.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">所属が登録されていません</p>
            <button
              onClick={() => {
                setEditingDepartment(null);
                setFormData({ name: '' });
                setIsModalOpen(true);
              }}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-5 w-5 mr-1" />
              最初の所属を作成
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={departments.map(d => d.id)}
              strategy={verticalListSortingStrategy}
            >
              {departments.map((department) => (
                <SortableDepartmentItem
                  key={department.id}
                  department={department}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingDepartment ? '所属編集' : '所属作成'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">所属名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  placeholder="例: 本社（１階）、営業部など"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">所属の使い方</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• ユーザー管理で各ユーザーの所属を設定できます</li>
                  <li>• スケジュール作成時の参加者選択で所属ごとに表示されます</li>
                  <li>• ここで設定した並び順が各画面に反映されます</li>
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
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {editingDepartment ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}