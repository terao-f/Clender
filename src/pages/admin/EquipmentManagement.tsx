import { useState, useEffect } from 'react';
import { Room, Vehicle, SampleEquipment } from '../../types';
import { Plus, Pencil, Trash2, Car, DoorOpen, Box, X, GripVertical, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  item: any;
  type: 'room' | 'vehicle' | 'sample';
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}

function SortableItem({ item, type, onEdit, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getIcon = () => {
    switch (type) {
      case 'room':
        return <DoorOpen className="h-5 w-5 text-emerald-600" />;
      case 'vehicle':
        return <Car className="h-5 w-5 text-amber-600" />;
      case 'sample':
        return <Box className="h-5 w-5 text-purple-600" />;
    }
  };

  const getColorClass = () => {
    switch (type) {
      case 'room':
        return 'bg-emerald-100';
      case 'vehicle':
        return 'bg-amber-100';
      case 'sample':
        return 'bg-purple-100';
    }
  };

  return (
    <tr ref={setNodeRef} style={style} className={`hover:bg-gray-50 ${isDragging ? 'bg-gray-100' : ''}`}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div
            {...attributes}
            {...listeners}
            className="cursor-move mr-3 text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          <div className={`flex-shrink-0 h-10 w-10 rounded-full ${getColorClass()} flex items-center justify-center`}>
            {getIcon()}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{item.name}</div>
            {type === 'vehicle' && (
              <div className="text-xs text-gray-500">{item.licensePlate} / {item.type}</div>
            )}
            {type === 'sample' && (
              <div className="text-xs text-gray-500">{item.type}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => onEdit(item)}
          className="text-indigo-600 hover:text-indigo-900 mr-3"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="text-red-600 hover:text-red-900"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

export default function EquipmentManagement() {
  const [activeTab, setActiveTab] = useState<'room' | 'vehicle' | 'sample'>('room');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sampleEquipment, setSampleEquipment] = useState<SampleEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<Record<string, string[]>>({
    room: [],
    vehicle: [],
    sample: []
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .order('display_order, name');
      
      if (roomsData) {
        setRooms(roomsData);
        setOriginalOrder(prev => ({ ...prev, room: roomsData.map(r => r.id) }));
      }

      // Fetch vehicles
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('*')
        .order('display_order, name');
      
      if (vehiclesData) {
        const convertedVehicles = vehiclesData.map(v => ({
          id: v.id,
          name: v.name,
          licensePlate: v.license_plate,
          type: v.type,
          displayOrder: v.display_order,
          createdBy: v.created_by
        }));
        setVehicles(convertedVehicles);
        setOriginalOrder(prev => ({ ...prev, vehicle: convertedVehicles.map(v => v.id) }));
      }

      // Fetch sample equipment
      const { data: equipmentData } = await supabase
        .from('sample_equipment')
        .select('*')
        .order('display_order, name');
      
      if (equipmentData) {
        setSampleEquipment(equipmentData);
        setOriginalOrder(prev => ({ ...prev, sample: equipmentData.map(e => e.id) }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      let items: any[] = [];
      let setItems: any;
      
      switch (activeTab) {
        case 'room':
          items = [...rooms];
          setItems = setRooms;
          break;
        case 'vehicle':
          items = [...vehicles];
          setItems = setVehicles;
          break;
        case 'sample':
          items = [...sampleEquipment];
          setItems = setSampleEquipment;
          break;
      }

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex);
      
      setItems(newOrder);
      
      // Check if order has changed
      const currentOrder = newOrder.map(item => item.id);
      setHasChanges(!arraysEqual(currentOrder, originalOrder[activeTab]));
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
      let items: any[] = [];
      let tableName = '';
      
      switch (activeTab) {
        case 'room':
          items = rooms;
          tableName = 'rooms';
          break;
        case 'vehicle':
          items = vehicles;
          tableName = 'vehicles';
          break;
        case 'sample':
          items = sampleEquipment;
          tableName = 'sample_equipment';
          break;
      }

      // Update display_order for each item
      for (let i = 0; i < items.length; i++) {
        const { error } = await supabase
          .from(tableName)
          .update({ display_order: i })
          .eq('id', items[i].id);
        
        if (error) {
          console.error('Error updating order:', error);
          toast.error('表示順序の保存に失敗しました');
          return;
        }
      }

      toast.success('表示順序を保存しました');
      setOriginalOrder(prev => ({ ...prev, [activeTab]: items.map(item => item.id) }));
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('表示順序の保存に失敗しました');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('名前を入力してください');
      return;
    }
    
    try {
      let tableName = '';
      let insertData: any = {};
      let updateData: any = {};
      
      switch (activeTab) {
        case 'room':
          tableName = 'rooms';
          insertData = {
            name: formData.name.trim(),
            display_order: rooms.length,
            created_by: '550e8400-e29b-41d4-a716-446655440001'
          };
          updateData = {
            name: formData.name.trim(),
            updated_at: new Date().toISOString()
          };
          break;
          
        case 'vehicle':
          tableName = 'vehicles';
          insertData = {
            name: formData.name.trim(),
            license_plate: formData.licensePlate || '',
            type: formData.type || '',
            display_order: vehicles.length,
            created_by: '550e8400-e29b-41d4-a716-446655440001'
          };
          updateData = {
            name: formData.name.trim(),
            license_plate: formData.licensePlate || '',
            type: formData.type || '',
            updated_at: new Date().toISOString()
          };
          break;
          
        case 'sample':
          tableName = 'sample_equipment';
          insertData = {
            name: formData.name.trim(),
            type: formData.type || 'サンプル作成',
            display_order: sampleEquipment.length
          };
          updateData = {
            name: formData.name.trim(),
            type: formData.type || 'サンプル作成',
            updated_at: new Date().toISOString()
          };
          break;
      }
      
      if (editingItem) {
        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast.success('更新しました');
      } else {
        const { error } = await supabase
          .from(tableName)
          .insert([insertData]);
        
        if (error) throw error;
        toast.success('作成しました');
      }

      await fetchAllData();
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({});
    } catch (error: any) {
      console.error('Error saving:', error);
      if (error.code === '23505') {
        toast.error('同じ名前が既に存在します');
      } else {
        toast.error('保存中にエラーが発生しました');
      }
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除してもよろしいですか？')) return;
    
    try {
      let tableName = '';
      
      switch (activeTab) {
        case 'room':
          tableName = 'rooms';
          break;
        case 'vehicle':
          tableName = 'vehicles';
          break;
        case 'sample':
          tableName = 'sample_equipment';
          break;
      }
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success('削除しました');
      await fetchAllData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('削除中にエラーが発生しました');
    }
  };

  const getCurrentItems = () => {
    switch (activeTab) {
      case 'room':
        return rooms;
      case 'vehicle':
        return vehicles;
      case 'sample':
        return sampleEquipment;
      case 'department':
        return departments;
      default:
        return [];
    }
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case 'room':
        return '会議室';
      case 'vehicle':
        return '車両';
      case 'sample':
        return 'サンプル設備';
      case 'department':
        return '所属';
    }
  };

  const getTabIcon = () => {
    switch (activeTab) {
      case 'room':
        return <DoorOpen className="h-5 w-5" />;
      case 'vehicle':
        return <Car className="h-5 w-5" />;
      case 'sample':
        return <Box className="h-5 w-5" />;
    }
  };

  const getTabColor = () => {
    switch (activeTab) {
      case 'room':
        return 'bg-emerald-600 hover:bg-emerald-700';
      case 'vehicle':
        return 'bg-amber-600 hover:bg-amber-700';
      case 'sample':
        return 'bg-purple-600 hover:bg-purple-700';
      case 'department':
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">設備データを読み込み中...</p>
        </div>
      </div>
    );
  }

  const currentItems = getCurrentItems();

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">設備管理</h1>
      
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['room', 'vehicle', 'sample', 'department'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (hasChanges) {
                  if (confirm('保存されていない変更があります。タブを切り替えますか？')) {
                    setActiveTab(tab);
                    setHasChanges(false);
                  }
                } else {
                  setActiveTab(tab);
                }
              }}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm flex items-center
                ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab === 'room' && <DoorOpen className="h-5 w-5 mr-2" />}
              {tab === 'vehicle' && <Car className="h-5 w-5 mr-2" />}
              {tab === 'sample' && <Box className="h-5 w-5 mr-2" />}
              {tab === 'room' && '会議室'}
              {tab === 'vehicle' && '車両'}
              {tab === 'sample' && 'サンプル設備'}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600">
          ドラッグ&ドロップで並び順を変更できます
        </p>
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <button
              onClick={handleSaveOrder}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              <Save className="h-5 w-5 mr-1" />
              並び順を保存
            </button>
          )}
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({});
              setIsModalOpen(true);
            }}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${getTabColor()}`}
          >
            {getTabIcon()}
            <span className="ml-1">{getTabLabel()}を追加</span>
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="bg-white shadow rounded-lg overflow-hidden flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getTabLabel()}
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">アクション</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <SortableContext
                items={currentItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {currentItems.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    type={activeTab}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </tbody>
          </table>
          
          {currentItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">{getTabLabel()}が登録されていません</p>
            </div>
          )}
        </div>
      </DndContext>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingItem ? `${getTabLabel()}編集` : `${getTabLabel()}作成`}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {activeTab === 'department' ? '所属名' : '名前'}
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>

              {activeTab === 'vehicle' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ナンバープレート</label>
                    <input
                      type="text"
                      value={formData.licensePlate || ''}
                      onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">メーカー</label>
                    <input
                      type="text"
                      value={formData.type || ''}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      placeholder="例: トヨタ、ホンダ、日産など"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </>
              )}

              {activeTab === 'sample' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">種別</label>
                  <select
                    value={formData.type || ''}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="サンプル作成">サンプル作成</option>
                    <option value="CAD・マーキング">CAD・マーキング</option>
                    <option value="サンプル裁断">サンプル裁断</option>
                    <option value="サンプル縫製">サンプル縫製</option>
                    <option value="サンプル内職">サンプル内職</option>
                    <option value="プレス">プレス</option>
                    <option value="仕上げ・梱包">仕上げ・梱包</option>
                  </select>
                </div>
              )}

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
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  {editingItem ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}