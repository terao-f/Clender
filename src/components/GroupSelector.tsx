import React, { useState } from 'react';
import { mockGroups, mockUsers } from '../data/mockData';
import { Group, User } from '../types';

// グループ種別の日本語ラベル
const groupTypeLabels: Record<string, string> = {
  department: '所属グループ',
  task: '業務グループ',
  leave: '休暇申請グループ',
};

// グループ種別の順序
const groupTypeOrder: string[] = ['department', 'task', 'leave'];

export default function GroupSelector() {
  // アコーディオンの開閉状態
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // 選択されたユーザーID一覧（デフォルトは空＝誰も選択されていない）
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // グループごとにまとめる
  const groupsByType: Record<string, Group[]> = {
    department: [],
    task: [],
    leave: [],
  };
  mockGroups.forEach(group => {
    groupsByType[group.type].push(group);
  });

  // グループ内の全ユーザーID
  const getGroupUserIds = (group: Group) => group.members;

  // グループ内の全員が選択されているか
  const isAllSelected = (group: Group) =>
    getGroupUserIds(group).every(id => selectedUserIds.includes(id));

  // グループ内の一部が選択されているか
  const isSomeSelected = (group: Group) =>
    getGroupUserIds(group).some(id => selectedUserIds.includes(id));

  // 全員選択/解除
  const handleSelectAll = (group: Group, checked: boolean) => {
    const groupUserIds = getGroupUserIds(group);
    if (checked) {
      setSelectedUserIds(prev => Array.from(new Set([...prev, ...groupUserIds])));
    } else {
      setSelectedUserIds(prev => prev.filter(id => !groupUserIds.includes(id)));
    }
  };

  // 個別選択/解除
  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };

  // アコーディオン開閉
  const toggleAccordion = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // 選択されたユーザー情報
  const selectedUsers: User[] = mockUsers.filter(user => selectedUserIds.includes(user.id));

  return (
    <div className="flex gap-8">
      {/* 左側：グループごとのリスト */}
      <div className="w-96">
        {groupTypeOrder.map(type => (
          <div key={type} className="mb-4">
            <h2 className="font-bold text-lg mb-2">{groupTypeLabels[type]}</h2>
            {groupsByType[type].map(group => (
              <div key={group.id} className="border rounded mb-2">
                <button
                  type="button"
                  className="w-full flex justify-between items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 focus:outline-none"
                  onClick={() => toggleAccordion(group.id)}
                >
                  <span>{group.name}</span>
                  <span>{openGroups[group.id] ? '▲' : '▼'}</span>
                </button>
                {openGroups[group.id] && (
                  <div className="p-4 bg-white">
                    <div className="mb-2">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected(group)}
                          indeterminate={isSomeSelected(group) && !isAllSelected(group)}
                          onChange={e => handleSelectAll(group, e.target.checked)}
                          className="mr-2"
                        />
                        全員を選択
                      </label>
                    </div>
                    <div className="space-y-1">
                      {group.members.map(userId => {
                        const user = mockUsers.find(u => u.id === userId);
                        if (!user) return null;
                        return (
                          <div key={user.id} className="flex items-center ml-4">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.id)}
                              onChange={e => handleSelectUser(user.id, e.target.checked)}
                              className="mr-2"
                            />
                            <span>{user.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* 右側：選択された社員一覧 */}
      <div className="flex-1">
        <h2 className="font-bold text-lg mb-2">選択された社員</h2>
        <div className="border rounded p-4 min-h-[100px] bg-gray-50">
          {selectedUsers.length === 0 ? (
            <span className="text-gray-400">社員が選択されていません</span>
          ) : (
            <ul className="space-y-1">
              {selectedUsers.map(user => (
                <li key={user.id} className="flex items-center justify-between">
                  <span>{user.name}</span>
                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => handleSelectUser(user.id, false)}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
} 