import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Clock, User, Calendar, Edit, Trash2, Plus, Filter, Search } from 'lucide-react';
import { ScheduleHistory } from '../../types';
import { ScheduleHistoryService } from '../../services/scheduleHistoryService';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

export default function ScheduleHistoryPage() {
  const { currentUser } = useAuth();
  const { canAccessAdmin } = usePermissions();
  const [history, setHistory] = useState<ScheduleHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'create' | 'update' | 'delete'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    if (canAccessAdmin()) {
      fetchHistory();
    }
  }, [canAccessAdmin, filter, limit]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let historyData: ScheduleHistory[];
      
      if (filter === 'all') {
        historyData = await ScheduleHistoryService.getAllScheduleHistory(limit);
      } else {
        historyData = await ScheduleHistoryService.getHistoryByOperationType(filter, limit);
      }
      
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to fetch schedule history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOperationIcon = (operationType: string) => {
    switch (operationType) {
      case 'create':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'update':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-600" />;
    }
  };

  const getOperationColor = (operationType: string) => {
    switch (operationType) {
      case 'create':
        return 'bg-green-100 text-green-800';
      case 'update':
        return 'bg-blue-100 text-blue-800';
      case 'delete':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOperationText = (operationType: string) => {
    switch (operationType) {
      case 'create':
        return '作成';
      case 'update':
        return '編集';
      case 'delete':
        return '削除';
      default:
        return '操作';
    }
  };

  const filteredHistory = history.filter(item => {
    if (searchTerm) {
      return (
        item.operatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.scheduleData?.title && item.scheduleData.title.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return true;
  });

  if (!canAccessAdmin()) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">この機能にはアクセスできません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">スケジュール操作履歴</h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'create' | 'update' | 'delete')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">すべて</option>
            <option value="create">作成</option>
            <option value="update">編集</option>
            <option value="delete">削除</option>
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={50}>50件</option>
            <option value={100}>100件</option>
            <option value={200}>200件</option>
            <option value={500}>500件</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2 text-gray-600">履歴を読み込み中...</span>
        </div>
      ) : (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作者
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作内容
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    スケジュール詳細
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getOperationIcon(item.operationType)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOperationColor(item.operationType)}`}>
                          {getOperationText(item.operationType)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {item.operatorName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">
                          {format(item.operationTime, 'yyyy/MM/dd HH:mm', { locale: ja })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {item.description}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.scheduleData && item.operationType !== 'delete' ? (
                        <div className="text-sm text-gray-600">
                          <div className="font-medium">{item.scheduleData.title}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(item.scheduleData.startTime), 'MM/dd HH:mm', { locale: ja })} - 
                            {format(new Date(item.scheduleData.endTime), 'MM/dd HH:mm', { locale: ja })}
                          </div>
                          {item.scheduleData.participants && item.scheduleData.participants.length > 0 && (
                            <div className="text-xs text-gray-500">
                              参加者: {item.scheduleData.participants.length}名
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredHistory.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>履歴がありません</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}