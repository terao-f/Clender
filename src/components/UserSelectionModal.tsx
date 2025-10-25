import { useState, useEffect } from 'react';
import { X, Search, UserPlus, UserMinus, GripVertical } from 'lucide-react';
import { User } from '../types';

interface UserSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  selectedUsers: string[];
  onUsersChange: (userIds: string[]) => void;
}

export default function UserSelectionModal({
  isOpen,
  onClose,
  users,
  selectedUsers,
  onUsersChange
}: UserSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelectedUsers, setTempSelectedUsers] = useState<string[]>(selectedUsers);

  useEffect(() => {
    setTempSelectedUsers(selectedUsers);
  }, [selectedUsers]);

  if (!isOpen) return null;

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nameKana.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setTempSelectedUsers(prev => {
      if (prev.includes(userId)) {
        // Remove the user
        return prev.filter(id => id !== userId);
      } else {
        // Add the user to the end to maintain selection order
        return [...prev, userId];
      }
    });
  };

  const toggleAll = () => {
    if (tempSelectedUsers.length === users.length) {
      setTempSelectedUsers([]);
    } else {
      setTempSelectedUsers(users.map(u => u.id));
    }
  };

  const handleApply = () => {
    console.log('UserSelectionModal - Applying changes');
    console.log('  - tempSelectedUsers order:', tempSelectedUsers);
    console.log('  - tempSelectedUsers names:', tempSelectedUsers.map(id => {
      const user = users.find(u => u.id === id);
      return user ? user.name : 'Unknown';
    }));
    onUsersChange(tempSelectedUsers);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">カレンダー表示ユーザー管理</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="名前、部署で検索..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={tempSelectedUsers.length === users.length && users.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900">
                    全員を選択 ({tempSelectedUsers.length}/{users.length})
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-500">
                ※ 選択した順番でカレンダーに表示されます
              </p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="mb-2 p-2 bg-gray-50 border-b">
                <div className="text-sm font-medium text-gray-700">選択済みユーザー（ドラッグで並び替え可能）</div>
              </div>
              {tempSelectedUsers.length > 0 && (
                <div className="p-2 space-y-1 border-b bg-gray-50">
                  {tempSelectedUsers.map((userId, index) => {
                    const user = users.find(u => u.id === userId);
                    if (!user) return null;
                    return (
                      <div
                        key={user.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', index.toString());
                          e.currentTarget.classList.add('opacity-50');
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove('opacity-50');
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          const rect = e.currentTarget.getBoundingClientRect();
                          const midpoint = rect.top + rect.height / 2;
                          if (e.clientY < midpoint) {
                            e.currentTarget.classList.add('border-t-2', 'border-blue-500');
                            e.currentTarget.classList.remove('border-b-2');
                          } else {
                            e.currentTarget.classList.add('border-b-2', 'border-blue-500');
                            e.currentTarget.classList.remove('border-t-2');
                          }
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('border-t-2', 'border-b-2', 'border-blue-500');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-t-2', 'border-b-2', 'border-blue-500');
                          const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                          const toIndex = index;
                          if (fromIndex !== toIndex) {
                            const newOrder = [...tempSelectedUsers];
                            const [movedItem] = newOrder.splice(fromIndex, 1);
                            const rect = e.currentTarget.getBoundingClientRect();
                            const midpoint = rect.top + rect.height / 2;
                            const insertIndex = e.clientY < midpoint ? toIndex : toIndex + 1;
                            const adjustedIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
                            newOrder.splice(adjustedIndex, 0, movedItem);
                            setTempSelectedUsers(newOrder);
                          }
                        }}
                        className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 cursor-move hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center space-x-2">
                          <GripVertical className="h-4 w-4 text-gray-400" />
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              <span>{user.name}</span>
                              {user.isHr && (
                                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                  人事
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{user.department}</div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleUser(user.id);
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="max-h-64 overflow-y-auto">
                {filteredUsers.filter(user => !tempSelectedUsers.includes(user.id)).map(user => {
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-200 cursor-pointer"
                      onClick={() => toggleUser(user.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => {}}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            <span>{user.name}</span>
                            {user.isHr && (
                              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                人事
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{user.department}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center text-xs text-gray-400">
                          <UserPlus className="h-4 w-4 mr-1" />
                          非表示
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={handleApply}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              適用
            </button>
            <button
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}