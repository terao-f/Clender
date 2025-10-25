import { useState, useEffect } from 'react';
import { mockRooms, mockVehicles, mockSampleEquipment } from '../../data/mockData';
import { Room, Vehicle, SampleEquipment } from '../../types';
import { Plus, Pencil, Trash2, Car, DoorOpen, Box, X, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function AdminEquipment() {
  // State for each equipment type
  const [rooms, setRooms] = useState<Room[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sampleEquipment, setSampleEquipment] = useState<SampleEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Drag state
  const [draggedItem, setDraggedItem] = useState<{type: 'room' | 'vehicle' | 'sample', index: number} | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'room' | 'vehicle' | 'sample' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  // Load data from Supabase
  useEffect(() => {
    fetchAllData();
  }, []);
  
  // Load and save equipment order in localStorage
  const getEquipmentOrder = (type: 'rooms' | 'vehicles' | 'sampleEquipment'): string[] => {
    const saved = localStorage.getItem(`equipment_order_${type}`);
    return saved ? JSON.parse(saved) : [];
  };
  
  const saveEquipmentOrder = (type: 'rooms' | 'vehicles' | 'sampleEquipment', items: any[]) => {
    const order = items.map(item => item.id);
    localStorage.setItem(`equipment_order_${type}`, JSON.stringify(order));
  };
  
  const sortByOrder = <T extends { id: string }>(items: T[], type: 'rooms' | 'vehicles' | 'sampleEquipment'): T[] => {
    const order = getEquipmentOrder(type);
    if (order.length === 0) return items;
    
    return [...items].sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .order('name');
      
      if (roomsError) {
        console.error('Error fetching rooms:', roomsError);
        setRooms(sortByOrder(mockRooms, 'rooms'));
      } else {
        const sortedRooms = sortByOrder(roomsData || [], 'rooms');
        setRooms(sortedRooms);
      }

      // Fetch vehicles  
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('name');
      
      if (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError);
        setVehicles(sortByOrder(mockVehicles, 'vehicles'));
      } else {
        const convertedVehicles = vehiclesData?.map(v => ({
          id: v.id,
          name: v.name,
          licensePlate: v.license_plate,
          type: v.type,
          createdBy: v.created_by
        })) || [];
        const sortedVehicles = sortByOrder(convertedVehicles, 'vehicles');
        setVehicles(sortedVehicles);
      }

      // Fetch sample equipment
      const { data: equipmentData, error: equipmentError } = await supabase
        .from('sample_equipment')
        .select('*')
        .order('name');
      
      if (equipmentError) {
        console.error('Error fetching sample equipment:', equipmentError);
        setSampleEquipment(sortByOrder(mockSampleEquipment, 'sampleEquipment'));
      } else {
        const sortedEquipment = sortByOrder(equipmentData || [], 'sampleEquipment');
        setSampleEquipment(sortedEquipment);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setRooms(mockRooms);
      setVehicles(mockVehicles);
      setSampleEquipment(mockSampleEquipment);
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      switch (modalType) {
        case 'room':
          if (editingItem) {
            // Update room
            const { error } = await supabase
              .from('rooms')
              .update({
                name: formData.name || '',
                updated_at: new Date().toISOString()
              })
              .eq('id', editingItem.id);
            
            if (error) throw error;
            toast.success('会議室を更新しました');
          } else {
            // Create room
            const { error } = await supabase
              .from('rooms')
              .insert([{
                name: formData.name || '',
                created_by: '550e8400-e29b-41d4-a716-446655440001' // Default user ID
              }]);
            
            if (error) throw error;
            toast.success('会議室を作成しました');
          }
          break;

        case 'vehicle':
          if (editingItem) {
            // Update vehicle
            const { error } = await supabase
              .from('vehicles')
              .update({
                name: formData.name || '',
                license_plate: formData.licensePlate || '',
                type: formData.type || '',
                updated_at: new Date().toISOString()
              })
              .eq('id', editingItem.id);
            
            if (error) throw error;
            toast.success('車両を更新しました');
          } else {
            // Create vehicle
            const { error } = await supabase
              .from('vehicles')
              .insert([{
                name: formData.name || '',
                license_plate: formData.licensePlate || '',
                type: formData.type || '',
                created_by: '550e8400-e29b-41d4-a716-446655440001' // Default user ID
              }]);
            
            if (error) throw error;
            toast.success('車両を作成しました');
          }
          break;

        case 'sample':
          if (editingItem) {
            // Update sample equipment
            const { error } = await supabase
              .from('sample_equipment')
              .update({
                name: formData.name || '',
                type: formData.type || 'サンプル作成',
                updated_at: new Date().toISOString()
              })
              .eq('id', editingItem.id);
            
            if (error) throw error;
            toast.success('サンプル設備を更新しました');
          } else {
            // Create sample equipment
            const { error } = await supabase
              .from('sample_equipment')
              .insert([{
                name: formData.name || '',
                type: formData.type || 'サンプル作成'
              }]);
            
            if (error) throw error;
            toast.success('サンプル設備を作成しました');
          }
          break;
      }

      // Refresh data
      await fetchAllData();
      
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({});
      setModalType(null);
    } catch (error) {
      console.error('Error saving data:', error);
      toast.error('保存中にエラーが発生しました');
    }
  };

  // Handle edit
  const handleEdit = (item: any, type: 'room' | 'vehicle' | 'sample') => {
    setEditingItem(item);
    setFormData(item);
    setModalType(type);
    setIsModalOpen(true);
  };

  // Handle delete
  const handleDelete = async (id: string, type: 'room' | 'vehicle' | 'sample') => {
    if (confirm('この設備を削除してもよろしいですか？')) {
      try {
        let error;
        
        switch (type) {
          case 'room':
            ({ error } = await supabase.from('rooms').delete().eq('id', id));
            break;
          case 'vehicle':
            ({ error } = await supabase.from('vehicles').delete().eq('id', id));
            break;
          case 'sample':
            ({ error } = await supabase.from('sample_equipment').delete().eq('id', id));
            break;
        }

        if (error) throw error;
        
        toast.success('削除しました');
        await fetchAllData(); // Refresh data
      } catch (error) {
        console.error('Error deleting data:', error);
        toast.error('削除中にエラーが発生しました');
      }
    }
  };
  
  // Handle drag and drop reordering
  const handleDragStart = (e: React.DragEvent, type: 'room' | 'vehicle' | 'sample', index: number) => {
    setDraggedItem({ type, index });
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = (e: React.DragEvent, targetType: 'room' | 'vehicle' | 'sample', targetIndex: number) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.type !== targetType) return;
    
    const fromIndex = draggedItem.index;
    const toIndex = targetIndex;
    
    if (fromIndex === toIndex) return;
    
    // Reorder items locally
    let items: any[] = [];
    let setItems: any;
    let storageKey: 'rooms' | 'vehicles' | 'sampleEquipment' = 'rooms';
    
    switch (targetType) {
      case 'room':
        items = [...rooms];
        setItems = setRooms;
        storageKey = 'rooms';
        break;
      case 'vehicle':
        items = [...vehicles];
        setItems = setVehicles;
        storageKey = 'vehicles';
        break;
      case 'sample':
        items = [...sampleEquipment];
        setItems = setSampleEquipment;
        storageKey = 'sampleEquipment';
        break;
    }
    
    const [movedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, movedItem);
    
    // Update local state and save to localStorage
    setItems(items);
    saveEquipmentOrder(storageKey, items);
    
    toast.success('並び順を更新しました');
    setDraggedItem(null);
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

  return (
    <div className="h-full flex flex-col space-y-8">
      {/* Rooms Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">会議室</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({});
              setModalType('room');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <DoorOpen className="h-5 w-5 mr-1" />
            会議室を追加
          </button>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  会議室名
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">アクション</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rooms.map((room, index) => (
                <tr 
                  key={room.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'room', index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'room', index)}
                  className="hover:bg-gray-50 cursor-move"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <GripVertical className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <DoorOpen className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{room.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(room, 'room')}
                      className="text-emerald-600 hover:text-emerald-900 mr-3"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id, 'room')}
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
      </div>

      {/* Vehicles Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">車両</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({});
              setModalType('vehicle');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            <Car className="h-5 w-5 mr-1" />
            車両を追加
          </button>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  車両情報
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ナンバー
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  メーカー
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">アクション</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vehicles.map((vehicle, index) => (
                <tr 
                  key={vehicle.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'vehicle', index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'vehicle', index)}
                  className="hover:bg-gray-50 cursor-move"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <GripVertical className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Car className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{vehicle.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.licensePlate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vehicle.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(vehicle, 'vehicle')}
                      className="text-amber-600 hover:text-amber-900 mr-3"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(vehicle.id, 'vehicle')}
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
      </div>

      {/* Sample Equipment Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">サンプル設備</h2>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({});
              setModalType('sample');
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <Box className="h-5 w-5 mr-1" />
            設備を追加
          </button>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  設備名
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  種別
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">アクション</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sampleEquipment.map((equipment, index) => (
                <tr 
                  key={equipment.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'sample', index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'sample', index)}
                  className="hover:bg-gray-50 cursor-move"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <GripVertical className="h-5 w-5 text-gray-400 mr-2" />
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <Box className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{equipment.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {equipment.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(equipment, 'sample')}
                      className="text-purple-600 hover:text-purple-900 mr-3"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(equipment.id, 'sample')}
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingItem ? '編集' : '新規作成'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {modalType === 'room' ? '会議室名' :
                   modalType === 'vehicle' ? '車両名' : '設備名'}
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              {modalType === 'vehicle' && (
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

              {modalType === 'sample' && (
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
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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